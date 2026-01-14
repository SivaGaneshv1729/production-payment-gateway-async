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

    if (!orderId) return <div style={{ padding: '20px' }}>Missing Order ID</div>;
    if (!order) return <div style={{ padding: '20px' }}>Loading Order...</div>;

    // If embedded, hide the header/logo to look cleaner in iframe
    // Note: CSS handles container width/style via data-test-id="checkout-container"
    const containerStyle = isEmbedded ? { padding: '0', boxShadow: 'none', border: 'none', maxWidth: '100%' } : {};

    return (
        <div data-test-id="checkout-container" style={containerStyle}>
            {!isEmbedded && (
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#4f46e5' }}>PayPoint</h2>
                </div>
            )}

            <div data-test-id="order-summary" className="order-summary-box">
                <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '8px' }}>Payable Amount</p>
                <h1 data-test-id="order-amount" style={{ fontSize: '32px', fontWeight: '800', lineHeight: '1', margin: '0' }}>
                    ₹{order.amount / 100}
                </h1>
                <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '12px', fontFamily: 'monospace' }}>Order: {order.id}</div>
            </div>

            {status === 'initial' && (
                <>
                    <div data-test-id="payment-methods" className="method-toggle">
                        <button
                            data-test-id="method-upi"
                            onClick={() => setMethod('upi')}
                            className={`method-btn ${method === 'upi' ? 'active' : ''}`}
                        >
                            UPI
                        </button>
                        <button
                            data-test-id="method-card"
                            onClick={() => setMethod('card')}
                            className={`method-btn ${method === 'card' ? 'active' : ''}`}
                        >
                            Card
                        </button>
                    </div>

                    {method === 'upi' && (
                        <form data-test-id="upi-form" onSubmit={(e) => handlePayment(e, 'upi')}>
                            <div className="form-group">
                                <label>UPI ID</label>
                                <input data-test-id="vpa-input" placeholder="user@bank" required />
                            </div>
                            <button data-test-id="pay-button" type="submit">Pay Now</button>
                        </form>
                    )}

                    {method === 'card' && (
                        <form data-test-id="card-form" onSubmit={(e) => handlePayment(e, 'card')}>
                            <div className="form-group">
                                <label>Card Number</label>
                                <input data-test-id="card-number-input" placeholder="0000 0000 0000 0000" required />
                            </div>
                            <div style={{ display: 'flex', gap: '16px' }}>
                                <div style={{ flex: 1 }}>
                                    <label>Expiry</label>
                                    <input data-test-id="expiry-input" placeholder="MM/YY" required />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label>CVV</label>
                                    <input data-test-id="cvv-input" placeholder="123" required />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Cardholder Name</label>
                                <input data-test-id="cardholder-name-input" placeholder="Name on Card" required />
                            </div>
                            <button data-test-id="pay-button" type="submit">Pay Now</button>
                        </form>
                    )}
                </>
            )}

            {status === 'processing' && (
                <div data-test-id="processing-state" className="state-container">
                    <div className="spinner"></div>
                    <p style={{ color: '#6b7280', fontWeight: '500' }}>Processing Payment...</p>
                </div>
            )}

            {status === 'success' && (
                <div data-test-id="success-state" className="state-container">
                    <div style={{ color: '#10b981', marginBottom: '16px' }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                    </div>
                    <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>Payment Successful!</h2>
                    <p style={{ color: '#6b7280', fontSize: '14px', fontFamily: 'monospace' }}>ID: {payId}</p>
                </div>
            )}

            {status === 'failed' && (
                <div data-test-id="error-state" className="state-container">
                    <div style={{ color: '#ef4444', marginBottom: '16px' }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                    </div>
                    <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>Payment Failed</h2>
                    <button onClick={() => setStatus('initial')} style={{ maxWidth: '200px', margin: '20px auto 0' }}>Try Again</button>
                </div>
            )}
        </div>
    );
};

export default Checkout;