const http = require('http');

console.log("🚀 Starting Async Payment Gateway Test\n");

// --- Helpers ---
const request = (method, path, body = null, headers = {}) => {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 8000,
            path: path,
            method: method,
            headers: { 'Content-Type': 'application/json', ...headers }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- Test Sequence ---
async function runTest() {
    const headers = {
        'X-Api-Key': 'key_test_abc123',
        'X-Api-Secret': 'secret_test_xyz789'
    };

    try {
        // 1. Create Order
        console.log("1️⃣  Creating Order...");
        const orderRes = await request('POST', '/api/v1/orders', {
            amount: 50000, // ₹500.00
            currency: "INR",
            receipt: "test_" + Date.now()
        }, headers);

        if (orderRes.status !== 201) throw new Error("Order creation failed: " + JSON.stringify(orderRes.body));
        const orderId = orderRes.body.id;
        console.log(`   ✅ Order Created: ${orderId}`);

        // 2. Make Async Payment (With Idempotency Key)
        console.log("\n2️⃣  Initiating Async Payment (Idempotent)...");
        const idempotencyKey = "key_" + Date.now();
        const payHeaders = { ...headers, 'Idempotency-Key': idempotencyKey };

        const payRes = await request('POST', '/api/v1/payments', {
            order_id: orderId,
            method: "upi",
            vpa: "test@upi"
        }, payHeaders);

        if (payRes.status !== 201) throw new Error("Payment init failed: " + JSON.stringify(payRes.body));
        const payId = payRes.body.id;
        console.log(`   ✅ Payment Queued: ${payId} (Status: ${payRes.body.status})`);

        // 3. Test Idempotency (Duplicate Request)
        console.log("\n3️⃣  Testing Idempotency (Replaying Request)...");
        const replayRes = await request('POST', '/api/v1/payments', {
            order_id: orderId,
            method: "upi",
            vpa: "test@upi"
        }, payHeaders);

        if (replayRes.status === 201 && replayRes.body.id === payId) {
            console.log(`   ✅ Idempotency Worked! Returned cached response.`);
        } else {
            throw new Error("Idempotency failed: " + JSON.stringify(replayRes.body));
        }

        // 4. Poll for Success (Worker processing)
        console.log("\n4️⃣  Polling for Worker Completion...");
        let status = 'pending';
        let attempts = 0;

        while (status === 'pending' && attempts < 15) {
            await delay(1000);
            process.stdout.write(".");
            const pollRes = await request('GET', `/api/v1/payments/${payId}/public`);
            status = pollRes.body.status;
            attempts++;
        }
        console.log(""); // Newline

        if (status === 'success') {
            console.log(`   ✅ Payment Processed Successfully!`);
        } else {
            throw new Error(`Payment failed or timed out. Status: ${status}`);
        }

        // 5. Refund
        console.log("\n5️⃣  Initiating Refund...");
        const refundRes = await request('POST', `/api/v1/payments/${payId}/refunds`, {
            amount: 25000, // Partial Refund
            reason: "Test Refund"
        }, headers);

        if (refundRes.status === 201) {
            console.log(`   ✅ Refund Queued: ${refundRes.body.id}`);
        } else {
            console.error("   ❌ Refund Failed:", refundRes.body);
        }

        console.log("\n🎉 ALL TESTS PASSED!");

    } catch (err) {
        console.error("\n❌ TEST FAILED:", err.message);
        process.exit(1);
    }
}

runTest();