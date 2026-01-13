const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const crypto = require('crypto');
const { paymentQueue, webhookQueue, refundQueue } = require('./queue');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Database Connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// --- Helpers ---

const generateId = (prefix) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return prefix + result;
};

const validateLuhn = (num) => {
    const cleanNum = (num + '').replace(/[\s-]/g, '');
    if (!/^\d+$/.test(cleanNum)) return false;
    if (cleanNum.length < 13 || cleanNum.length > 19) return false;
    let arr = cleanNum.split('').reverse().map(x => parseInt(x));
    let lastDigit = arr.splice(0, 1)[0];
    let sum = arr.reduce((acc, val, i) => (i % 2 !== 0 ? acc + val : acc + ((val * 2) % 9) || 9), 0);
    sum += lastDigit;
    return sum % 10 === 0;
};

const getCardNetwork = (num) => {
    const cleanNum = (num + '').replace(/[\s-]/g, '');
    if (/^4/.test(cleanNum)) return 'visa';
    if (/^5[1-5]/.test(cleanNum)) return 'mastercard';
    if (/^3[47]/.test(cleanNum)) return 'amex';
    if (/^60|^65|^8[1-9]/.test(cleanNum)) return 'rupay';
    return 'unknown';
};

// --- Middleware ---

const authenticate = async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const apiSecret = req.headers['x-api-secret'];

    // Bypass auth for health check, test endpoints, and public endpoints
    if (req.path === '/health' || req.path.includes('/public') || req.path.includes('/test')) {
        return next();
    }

    try {
        const result = await pool.query(
            'SELECT * FROM merchants WHERE api_key = $1 AND api_secret = $2',
            [apiKey, apiSecret]
        );
        if (result.rows.length === 0) {
            return res.status(401).json({ error: { code: 'AUTHENTICATION_ERROR', description: 'Invalid API credentials' } });
        }
        req.merchant = result.rows[0];
        next();
    } catch (err) {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', description: 'Authentication Error' } });
    }
};

const checkIdempotency = async (req, res, next) => {
    const key = req.headers['idempotency-key'];
    if (!key) return next();

    try {
        // Cleanup expired keys first (optional optimization)
        await pool.query('DELETE FROM idempotency_keys WHERE expires_at < NOW()');

        const result = await pool.query(
            'SELECT * FROM idempotency_keys WHERE key = $1 AND merchant_id = $2',
            [key, req.merchant.id]
        );

        if (result.rows.length > 0) {
            const record = result.rows[0];
            return res.status(201).json(record.response);
        }

        // Attach key to req to use it in the handler
        req.idempotencyKey = key;
        next();
    } catch (err) {
        console.error(err);
        next();
    }
};

app.use(authenticate);

// --- Endpoints ---

// 1. Health Check
app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: "healthy", database: "connected" });
    } catch (e) {
        res.json({ status: "unhealthy", database: "disconnected" });
    }
});

// 2. Create Order
app.post('/api/v1/orders', async (req, res) => {
    const { amount, currency, receipt, notes } = req.body;
    if (amount < 100) return res.status(400).json({ error: { code: "BAD_REQUEST_ERROR", description: "amount must be at least 100" } });

    const orderId = generateId('order_');
    try {
        const result = await pool.query(
            `INSERT INTO orders (id, merchant_id, amount, currency, receipt, notes, status) 
             VALUES ($1, $2, $3, $4, $5, $6, 'created') RETURNING *`,
            [orderId, req.merchant.id, amount, currency || 'INR', receipt, notes]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: { code: "INTERNAL_ERROR", description: "Server Error" } });
    }
});

// 3. Get Order (Public)
app.get('/api/v1/orders/:id/public', async (req, res) => {
    const result = await pool.query('SELECT id, amount, currency, status FROM orders WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: { code: "NOT_FOUND_ERROR", description: "Order not found" } });
    res.json(result.rows[0]);
});

// 4. Create Payment (Async)
app.post('/api/v1/payments', checkIdempotency, async (req, res) => {
    return handlePaymentCreation(req, res, true);
});

app.post('/api/v1/payments/public', async (req, res) => {
    return handlePaymentCreation(req, res, false);
});

const handlePaymentCreation = async (req, res, requiresAuth) => {
    const { order_id, method, vpa, card } = req.body;

    // Validate Order
    const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [order_id]);
    if (orderRes.rows.length === 0) return res.status(404).json({ error: { code: "NOT_FOUND_ERROR", description: "Order not found" } });
    const order = orderRes.rows[0];

    if (requiresAuth && order.merchant_id !== req.merchant.id) {
        return res.status(401).json({ error: { code: 'AUTHENTICATION_ERROR', description: "Order mismatch" } });
    }

    // Validate Input
    if (method === 'upi') {
        if (!/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(vpa)) return res.status(400).json({ error: { code: "INVALID_VPA", description: "Invalid VPA" } });
    } else if (method === 'card') {
        if (!card || !validateLuhn(card.number)) return res.status(400).json({ error: { code: "INVALID_CARD", description: "Invalid Card" } });
    } else {
        return res.status(400).json({ error: { code: "BAD_REQUEST_ERROR", description: "Invalid method" } });
    }

    const payId = generateId('pay_');
    const cardNetwork = method === 'card' ? getCardNetwork(card.number) : null;
    const cardLast4 = method === 'card' ? card.number.replace(/[\s-]/g, '').slice(-4) : null;

    try {
        // Insert 'Pending' Payment
        const result = await pool.query(
            `INSERT INTO payments (id, order_id, merchant_id, amount, currency, method, status, vpa, card_network, card_last4, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9, NOW()) RETURNING *`,
            [payId, order_id, order.merchant_id, order.amount, order.currency, method, vpa, cardNetwork, cardLast4]
        );

        const paymentData = result.rows[0];

        // Add to Job Queue
        await paymentQueue.add({ paymentId: payId });

        // Save Idempotency if key exists
        if (req.idempotencyKey) {
            await pool.query(
                `INSERT INTO idempotency_keys (key, merchant_id, response, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL '24 hours')`,
                [req.idempotencyKey, req.merchant.id, paymentData]
            );
        }

        res.status(201).json(paymentData);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: { code: "INTERNAL_ERROR", description: "Server Error" } });
    }
};

// 5. Capture Payment
app.post('/api/v1/payments/:id/capture', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `UPDATE payments SET captured = true, updated_at = NOW() 
             WHERE id = $1 AND merchant_id = $2 AND status = 'success' AND captured = false RETURNING *`,
            [id, req.merchant.id]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: { code: "BAD_REQUEST_ERROR", description: "Payment not in capturable state" } });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
    }
});

// 6. Refunds
app.post('/api/v1/payments/:id/refunds', async (req, res) => {
    const { amount, reason } = req.body;
    const paymentId = req.params.id;

    try {
        // Check Payment
        const payRes = await pool.query('SELECT * FROM payments WHERE id = $1 AND merchant_id = $2', [paymentId, req.merchant.id]);
        if (payRes.rows.length === 0) return res.status(404).json({ error: { code: "NOT_FOUND_ERROR", description: "Payment not found" } });
        const payment = payRes.rows[0];

        if (payment.status !== 'success') {
            return res.status(400).json({ error: { code: "BAD_REQUEST_ERROR", description: "Payment not successful" } });
        }

        // Check Available Amount
        const refundRes = await pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM refunds WHERE payment_id = $1", [paymentId]);
        const totalRefunded = parseInt(refundRes.rows[0].total);

        if (amount + totalRefunded > payment.amount) {
            return res.status(400).json({ error: { code: "BAD_REQUEST_ERROR", description: "Refund amount exceeds available amount" } });
        }

        // Create Refund
        const refundId = generateId('rfnd_');
        const newRefund = await pool.query(
            `INSERT INTO refunds (id, payment_id, merchant_id, amount, reason, status) 
             VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,
            [refundId, paymentId, req.merchant.id, amount, reason]
        );

        // Queue Job
        await refundQueue.add({ refundId });

        res.status(201).json(newRefund.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
    }
});

app.get('/api/v1/refunds/:id', async (req, res) => {
    const result = await pool.query('SELECT * FROM refunds WHERE id = $1 AND merchant_id = $2', [req.params.id, req.merchant.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: { code: "NOT_FOUND_ERROR" } });
    res.json(result.rows[0]);
});

// 7. Webhooks & Logs
app.get('/api/v1/webhooks', async (req, res) => {
    const { limit = 10, offset = 0 } = req.query;
    try {
        const logs = await pool.query(
            'SELECT * FROM webhook_logs WHERE merchant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
            [req.merchant.id, limit, offset]
        );
        const count = await pool.query('SELECT COUNT(*) FROM webhook_logs WHERE merchant_id = $1', [req.merchant.id]);

        res.json({
            data: logs.rows,
            total: parseInt(count.rows[0].count),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (err) {
        res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
    }
});

app.post('/api/v1/webhooks/:id/retry', async (req, res) => {
    try {
        const logRes = await pool.query('SELECT * FROM webhook_logs WHERE id = $1 AND merchant_id = $2', [req.params.id, req.merchant.id]);
        if (logRes.rows.length === 0) return res.status(404).json({ error: { code: "NOT_FOUND_ERROR" } });

        const log = logRes.rows[0];

        // Reset and Queue
        await pool.query("UPDATE webhook_logs SET status = 'pending', attempts = 0 WHERE id = $1", [log.id]);

        await webhookQueue.add({
            merchant_id: log.merchant_id,
            event: log.event,
            payload: log.payload,
            attempt: 1
        });

        res.json({ id: log.id, status: "pending", message: "Webhook retry scheduled" });
    } catch (err) {
        res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
    }
});

// 8. Public Payment Status (Polling)
app.get('/api/v1/payments/:id/public', async (req, res) => {
    const result = await pool.query('SELECT * FROM payments WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: { code: "NOT_FOUND_ERROR" } });
    res.json(result.rows[0]);
});

// 9. Dashboard Payments List
app.get('/api/v1/payments', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM payments WHERE merchant_id = $1 ORDER BY created_at DESC', [req.merchant.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
    }
});

// --- Test Endpoints ---

app.get('/api/v1/test/merchant', async (req, res) => {
    const result = await pool.query("SELECT id, email, api_key, webhook_secret FROM merchants WHERE email = 'test@example.com'");
    if (result.rows.length > 0) res.json(result.rows[0]);
    else res.status(404).json({});
});

app.get('/api/v1/test/jobs/status', async (req, res) => {
    const paymentCounts = await paymentQueue.getJobCounts();
    const webhookCounts = await webhookQueue.getJobCounts();
    const refundCounts = await refundQueue.getJobCounts();

    res.json({
        pending: paymentCounts.waiting + webhookCounts.waiting + refundCounts.waiting,
        processing: paymentCounts.active + webhookCounts.active + refundCounts.active,
        completed: paymentCounts.completed + webhookCounts.completed + refundCounts.completed,
        failed: paymentCounts.failed + webhookCounts.failed + refundCounts.failed,
        worker_status: "running"
    });
});

// Add this with your other authenticated endpoints
app.post('/api/v1/merchants/webhook-config', async (req, res) => {
    const { webhook_url } = req.body;
    try {
        await pool.query(
            'UPDATE merchants SET webhook_url = $1 WHERE id = $2',
            [webhook_url, req.merchant.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
    }
});

app.listen(8000, () => console.log('Server running on 8000'));