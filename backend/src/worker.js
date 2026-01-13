const { Pool } = require('pg');
const { paymentQueue, webhookQueue, refundQueue } = require('./queue');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

// Database Connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

console.log("🚀 Worker Service Started...");

// --- 1. Process Payment Job ---
paymentQueue.process(async (job) => {
    const { paymentId } = job.data;
    console.log(`[Payment] Processing ${paymentId}...`);

    try {
        // Fetch Payment
        const res = await pool.query('SELECT * FROM payments WHERE id = $1', [paymentId]);
        if (res.rows.length === 0) return;
        const payment = res.rows[0];

        // Simulate Delay
        const isTestMode = process.env.TEST_MODE === 'true';
        const delay = isTestMode
            ? parseInt(process.env.TEST_PROCESSING_DELAY || 1000)
            : Math.floor(Math.random() * (10000 - 5000 + 1) + 5000);

        await new Promise(r => setTimeout(r, delay));

        // Determine Outcome
        let isSuccess;
        if (isTestMode) {
            isSuccess = process.env.TEST_PAYMENT_SUCCESS !== 'false';
        } else {
            isSuccess = payment.method === 'upi' ? Math.random() < 0.9 : Math.random() < 0.95;
        }

        const status = isSuccess ? 'success' : 'failed';
        const errorCode = isSuccess ? null : 'PAYMENT_FAILED';
        const errorDesc = isSuccess ? null : 'Payment declined by bank';

        // Update DB
        await pool.query(
            `UPDATE payments SET status = $1, error_code = $2, error_description = $3, updated_at = NOW() WHERE id = $4`,
            [status, errorCode, errorDesc, paymentId]
        );

        // Trigger Webhook
        await webhookQueue.add({
            merchant_id: payment.merchant_id,
            event: isSuccess ? 'payment.success' : 'payment.failed',
            payload: {
                payment: {
                    id: payment.id,
                    order_id: payment.order_id,
                    amount: payment.amount,
                    currency: payment.currency,
                    status: status,
                    method: payment.method
                }
            }
        });

        console.log(`[Payment] ${paymentId} -> ${status}`);
    } catch (err) {
        console.error(`[Payment Error] ${paymentId}:`, err);
    }
});

// --- 2. Deliver Webhook Job ---
webhookQueue.process(async (job) => {
    const { merchant_id, event, payload, attempt = 1 } = job.data;

    // Test Mode Intervals
    const isTestIntervals = process.env.WEBHOOK_RETRY_INTERVALS_TEST === 'true';
    const delays = isTestIntervals
        ? [0, 5000, 10000, 15000, 20000] // Test: 0s, 5s, 10s...
        : [0, 60000, 300000, 1800000, 7200000]; // Prod: 0, 1m, 5m, 30m, 2h

    try {
        // Fetch Merchant logic for URL & Secret
        const mRes = await pool.query('SELECT webhook_url, webhook_secret FROM merchants WHERE id = $1', [merchant_id]);
        if (mRes.rows.length === 0 || !mRes.rows[0].webhook_url) {
            console.log(`[Webhook] No URL for merchant ${merchant_id}`);
            return;
        }
        const { webhook_url, webhook_secret } = mRes.rows[0];

        // Create Signature
        const signature = crypto
            .createHmac('sha256', webhook_secret || '')
            .update(JSON.stringify(payload))
            .digest('hex');

        // Log Attempt Start
        const logRes = await pool.query(
            `INSERT INTO webhook_logs (merchant_id, event, payload, status, attempts, created_at) 
             VALUES ($1, $2, $3, 'pending', $4, NOW()) RETURNING id`,
            [merchant_id, event, payload, attempt]
        );
        const logId = logRes.rows[0].id;

        // Send Request
        console.log(`[Webhook] Sending ${event} to ${webhook_url} (Attempt ${attempt})`);
        const response = await axios.post(webhook_url, payload, {
            headers: {
                'Content-Type': 'application/json',
                'X-Webhook-Signature': signature
            },
            timeout: 5000
        });

        // Log Success
        await pool.query(
            `UPDATE webhook_logs SET status = 'success', response_code = $1, last_attempt_at = NOW() WHERE id = $2`,
            [response.status, logId]
        );

    } catch (err) {
        const statusCode = err.response ? err.response.status : 500;
        console.error(`[Webhook Failed] Attempt ${attempt}: ${err.message}`);

        // Handle Retries
        if (attempt < 5) {
            const nextDelay = delays[attempt]; // attempt is 1-based, index is 0-based, so next delay is at index 'attempt'

            // Re-queue with delay
            await webhookQueue.add(
                { ...job.data, attempt: attempt + 1 },
                { delay: nextDelay }
            );

            // Update Log (Keep pending)
            // Note: In a real system, we'd update the log ID created above, 
            // but for simplicity we rely on creating a new log entry for every attempt or just re-queueing.
        }
    }
});

// --- 3. Process Refund Job ---
refundQueue.process(async (job) => {
    const { refundId } = job.data;
    console.log(`[Refund] Processing ${refundId}...`);

    try {
        const res = await pool.query('SELECT * FROM refunds WHERE id = $1', [refundId]);
        if (res.rows.length === 0) return;
        const refund = res.rows[0];

        // Simulate Processing
        await new Promise(r => setTimeout(r, 3000));

        // Update Refund Status
        await pool.query(
            `UPDATE refunds SET status = 'processed', processed_at = NOW() WHERE id = $1`,
            [refundId]
        );

        // Trigger Webhook
        await webhookQueue.add({
            merchant_id: refund.merchant_id,
            event: 'refund.processed',
            payload: {
                refund: {
                    id: refund.id,
                    payment_id: refund.payment_id,
                    amount: refund.amount,
                    status: 'processed'
                }
            }
        });

        console.log(`[Refund] ${refundId} -> processed`);
    } catch (e) {
        console.error(e);
    }
});