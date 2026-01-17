const http = require('http');

console.log("🔍 Starting Basic System Verification...\n");

const request = (path, method, headers, body) => {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 8000,
            path: path,
            method: method,
            headers: headers
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
};

async function test() {
    try {
        // 1. Health Check (DB Connection)
        process.stdout.write("1️⃣  Testing Health (DB)... ");
        const r1 = await request('/health', 'GET', {});
        if (r1.status === 200) console.log("✅ OK");
        else console.log("❌ FAILED", r1.body);

        // 2. Job Queue Status (Redis Connection) - NEW
        process.stdout.write("2️⃣  Testing Job Queue (Redis)... ");
        const r2 = await request('/api/v1/test/jobs/status', 'GET', {});
        if (r2.status === 200) {
            const data = JSON.parse(r2.body);
            if (data.worker_status === 'running') console.log("✅ OK (Worker Running)");
            else console.log("⚠️  WARNING: Worker might be stopped");
        } else {
            console.log("❌ FAILED (Redis issue?)", r2.body);
        }

        // 3. Merchant Auth Test
        process.stdout.write("3️⃣  Testing Merchant Auth... ");
        const r3 = await request('/api/v1/test/merchant', 'GET', {});
        if (r3.status === 200) console.log("✅ OK");
        else console.log("❌ FAILED", r3.body);

        // 4. Create Order (Core Logic)
        process.stdout.write("4️⃣  Testing Order Creation... ");
        const r4 = await request('/api/v1/orders', 'POST', {
            'Content-Type': 'application/json',
            'X-Api-Key': 'key_test_abc123',
            'X-Api-Secret': 'secret_test_xyz789'
        }, JSON.stringify({ amount: 50000, currency: 'INR', receipt: 'verify_script' }));

        if (r4.status === 201) console.log("✅ OK");
        else console.log("❌ FAILED", r4.body);

        console.log("\n✨ System looks healthy! Now run 'node test_async_flow.js' for the full flow.");

    } catch (e) {
        console.error("\n❌ Script Error:", e.message);
    }
}

test();