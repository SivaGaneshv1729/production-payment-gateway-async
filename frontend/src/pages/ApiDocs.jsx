import React from 'react';
import DashboardLayout from './DashboardLayout';

const ApiDocs = () => {
    return (
        <DashboardLayout title="Integration Guide" subtitle="How to integrate your payment gateway">
            <div data-test-id="api-docs">
                <section data-test-id="section-create-order" className="card" style={{ padding: '20px', marginBottom: '20px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ marginBottom: '10px' }}>1. Create Order</h3>
                    <p style={{ marginBottom: '10px' }}>Create an order on your backend before initiating payment.</p>
                    <pre data-test-id="code-snippet-create-order" style={{ background: '#f8fafc', padding: '15px', borderRadius: '6px', overflowX: 'auto', fontSize: '14px' }}>
                        {`curl -X POST http://localhost:8000/api/v1/orders \\
  -H "X-Api-Key: key_test_abc123" \\
  -H "X-Api-Secret: secret_test_xyz789" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 50000,
    "currency": "INR",
    "receipt": "receipt_123"
  }'`}
                    </pre>
                </section>

                <section data-test-id="section-sdk-integration" className="card" style={{ padding: '20px', marginBottom: '20px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ marginBottom: '10px' }}>2. SDK Integration</h3>
                    <p style={{ marginBottom: '10px' }}>Include the SDK and initialize payment.</p>
                    <pre data-test-id="code-snippet-sdk" style={{ background: '#f8fafc', padding: '15px', borderRadius: '6px', overflowX: 'auto', fontSize: '14px' }}>
                        {`<script src="http://localhost:3001/checkout.js"></script>
<script>
const checkout = new PaymentGateway({
  key: 'key_test_abc123',
  orderId: 'order_xyz',
  onSuccess: (response) => {
    console.log('Payment ID:', response.paymentId);
  }
});
checkout.open();
</script>`}
                    </pre>
                </section>

                <section data-test-id="section-webhook-verification" className="card" style={{ padding: '20px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ marginBottom: '10px' }}>3. Verify Webhook Signature</h3>
                    <p style={{ marginBottom: '10px' }}>Verify the webhook authenticity using HMAC-SHA256.</p>
                    <pre data-test-id="code-snippet-webhook" style={{ background: '#f8fafc', padding: '15px', borderRadius: '6px', overflowX: 'auto', fontSize: '14px' }}>
                        {`const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return signature === expectedSignature;
}`}
                    </pre>
                </section>
            </div>
        </DashboardLayout>
    );
};

export default ApiDocs;
