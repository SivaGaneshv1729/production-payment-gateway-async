import React, { useState, useEffect } from 'react';

const Checkout = () => {
    const [order, setOrder] = useState(null);
    const [method, setMethod] = useState(null);
    const [status, setStatus] = useState('initial');
    const [payId, setPayId] = useState(null);

    const searchParams = new URLSearchParams(window.location.search);
    const orderId = searchParams.get('order_id');
    const isEmbedded = searchParams.get('embedded') === 'true';

    useEffect(() => {
        if (orderId) {
            fetch(`http://localhost:8000/api/v1/orders/${orderId}/public`)
                .then(res => res.json())
                .then(data => {
                    if (data.error) alert(data.error.description);
                    else setOrder(data);
                })
                .catch(err => console.error(err));
        }
    }, [orderId]);

    // Notify Parent Window (SDK) on Success
    useEffect(() => {
        if (status === 'success' && isEmbedded) {
            window.parent.postMessage({
                type: 'payment_success',
                data: { paymentId: payId, orderId: orderId }
            }, '*');
        }
    }, [status, payId, isEmbedded, orderId]);

    const handlePayment = async (e, type) => {
        e.preventDefault();

        let payload = { order_id: orderId, method: type };

        if (type === 'upi') {
            payload.vpa = e.target.querySelector('[data-test-id="vpa-input"]').value;
        } else {
            payload.card = {
                number: e.target.querySelector('[data-test-id="card-number-input"]').value,
                expiry_month: e.target.querySelector('[data-test-id="expiry-input"]').value.split('/')[0],
                expiry_year: e.target.querySelector('[data-test-id="expiry-input"]').value.split('/')[1],
                cvv: e.target.querySelector('[data-test-id="cvv-input"]').value,
                holder_name: e.target.querySelector('[data-test-id="cardholder-name-input"]').value
            };
        }

        setStatus('processing');

        try {
            const res = await fetch('http://localhost:8000/api/v1/payments/public', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.error) {
                setStatus('failed');
                return;
            }

            setPayId(data.id);

            // Poll for completion (Async Flow)
            const interval = setInterval(async () => {
                const pollRes = await fetch(`http://localhost:8000/api/v1/payments/${data.id}/public`);
                const pollData = await pollRes.json();

                if (pollData.status === 'success' || pollData.status === 'failed') {
                    setStatus(pollData.status);
                    clearInterval(interval);
                }
            }, 2000);

        } catch (err) {
            console.error("Payment error", err);
            setStatus('failed');
        }
    };

    if (!orderId) return <div>Missing Order ID</div>;
    if (!order) return <div>Loading Order...</div>;

    // If embedded, hide the header/logo to look cleaner in iframe
    const containerStyle = isEmbedded ? { padding: '20px' } : { padding: '40px', maxWidth: '480px', margin: '0 auto' };

    return (
        <div data-test-id="checkout-container" style={containerStyle}>
            {!isEmbedded && (
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>PayPoint</h2>
                </div>
            )}

            <div data-test-id="order-summary" className="order-summary-box">
                <p style={{ color: '#6b7280', fontSize: '14px' }}>Payable Amount</p>
                <h1 data-test-id="order-amount" style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>
                    ₹{order.amount / 100}
                </h1>
                <div style={{ fontSize: '12px', color: '#9ca3af' }}>Order: {order.id}</div>
            </div>

            {status === 'initial' && (
                <>
                    <div data-test-id="payment-methods" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                        <button data-test-id="method-upi" onClick={() => setMethod('upi')} style={{ flex: 1, padding: '10px' }}>UPI</button>
                        <button data-test-id="method-card" onClick={() => setMethod('card')} style={{ flex: 1, padding: '10px' }}>Card</button>
                    </div>

                    {method === 'upi' && (
                        <form data-test-id="upi-form" onSubmit={(e) => handlePayment(e, 'upi')}>
                            <input data-test-id="vpa-input" placeholder="user@bank" required style={{ width: '100%', padding: '10px', marginBottom: '10px' }} />
                            <button data-test-id="pay-button" type="submit" style={{ width: '100%', padding: '12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px' }}>Pay Now</button>
                        </form>
                    )}

                    {method === 'card' && (
                        <form data-test-id="card-form" onSubmit={(e) => handlePayment(e, 'card')}>
                            <input data-test-id="card-number-input" placeholder="Card Number" required style={{ width: '100%', padding: '10px', marginBottom: '10px' }} />
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <input data-test-id="expiry-input" placeholder="MM/YY" required style={{ flex: 1, padding: '10px', marginBottom: '10px' }} />
                                <input data-test-id="cvv-input" placeholder="CVV" required style={{ flex: 1, padding: '10px', marginBottom: '10px' }} />
                            </div>
                            <input data-test-id="cardholder-name-input" placeholder="Cardholder Name" required style={{ width: '100%', padding: '10px', marginBottom: '10px' }} />
                            <button data-test-id="pay-button" type="submit" style={{ width: '100%', padding: '12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px' }}>Pay Now</button>
                        </form>
                    )}
                </>
            )}

            {status === 'processing' && (
                <div data-test-id="processing-state" style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="spinner" style={{ margin: '0 auto 20px' }}></div>
                    <p>Processing Payment...</p>
                </div>
            )}

            {status === 'success' && (
                <div data-test-id="success-state" style={{ textAlign: 'center', padding: '40px', color: 'green' }}>
                    <h2>Payment Successful!</h2>
                    <p>ID: {payId}</p>
                </div>
            )}

            {status === 'failed' && (
                <div data-test-id="error-state" style={{ textAlign: 'center', padding: '40px', color: 'red' }}>
                    <h2>Payment Failed</h2>
                    <button onClick={() => setStatus('initial')} style={{ marginTop: '20px', padding: '10px 20px' }}>Try Again</button>
                </div>
            )}
        </div>
    );
};

export default Checkout;