const http = require('http');

const headers = {
    'Content-Type': 'application/json',
    'X-Api-Key': 'key_test_abc123',
    'X-Api-Secret': 'secret_test_xyz789'
};

const payload = JSON.stringify({
    // Use host.docker.internal for Windows/Docker Desktop
    webhook_url: 'http://host.docker.internal:4000/webhook'
});

const req = http.request({
    hostname: 'localhost',
    port: 8000,
    path: '/api/v1/merchants/webhook-config',
    method: 'POST',
    headers: headers
}, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Body:', data);
    });
});

req.write(payload);
req.end();
