import React, { useState, useEffect } from 'react';
import DashboardLayout from './DashboardLayout';

const Webhooks = () => {
    const [webhookUrl, setWebhookUrl] = useState('');
    const [secret, setSecret] = useState('');
    const [logs, setLogs] = useState([]);

    const apiKey = localStorage.getItem('x-api-key');
    const apiSecret = localStorage.getItem('x-api-secret');

    // Fetch Config & Logs
    useEffect(() => {
        // Fetch Merchant Config (Reuse existing endpoint or mock)
        fetch('http://localhost:8000/api/v1/test/merchant', {
            headers: { 'X-Api-Key': apiKey, 'X-Api-Secret': apiSecret }
        })
            .then(res => res.json())
            .then(data => {
                setSecret(data.webhook_secret || 'Not Set');
                // Note: In a real app, we would fetch the current URL too
            });

        // Fetch Logs
        fetch('http://localhost:8000/api/v1/webhooks', {
            headers: { 'X-Api-Key': apiKey, 'X-Api-Secret': apiSecret }
        })
            .then(res => res.json())
            .then(data => setLogs(data.data || []));
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('http://localhost:8000/api/v1/merchants/webhook-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Api-Key': apiKey,
                    'X-Api-Secret': apiSecret
                },
                body: JSON.stringify({ webhook_url: webhookUrl })
            });

            if (res.ok) {
                alert("Configuration Saved!");
            } else {
                alert("Failed to save configuration");
            }
        } catch (error) {
            console.error(error);
            alert("Error saving configuration");
        }
    };

    const handleRetry = async (logId) => {
        await fetch(`http://localhost:8000/api/v1/webhooks/${logId}/retry`, {
            method: 'POST',
            headers: { 'X-Api-Key': apiKey, 'X-Api-Secret': apiSecret }
        });
        alert("Retry Scheduled");
        window.location.reload();
    };

    return (
        <DashboardLayout title="Webhooks" subtitle="Manage events and notifications">
            <div className="card" style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#111827' }}>Configuration</h3>
                <form onSubmit={handleSave}>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>Webhook URL</label>
                        <input
                            data-test-id="webhook-url-input"
                            type="url"
                            value={webhookUrl}
                            onChange={(e) => setWebhookUrl(e.target.value)}
                            placeholder="https://your-site.com/webhook"
                        />
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>Signing Secret</label>
                        <div data-test-id="webhook-secret" className="key-box">
                            {secret}
                        </div>
                    </div>
                    <button type="submit" data-test-id="login-button" style={{ width: 'auto', padding: '10px 20px', marginTop: 0 }}>
                        Save Configuration
                    </button>
                </form>
            </div>

            <div className="card">
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#111827' }}>Delivery Logs</h3>
                <div className="table-container" style={{ borderRadius: '0', borderWidth: '1px 0 0 0', boxShadow: 'none' }}>
                    <table style={{ border: 'none' }}>
                        <thead>
                            <tr>
                                <th>Event</th>
                                <th>Status</th>
                                <th>Attempts</th>
                                <th>Last Attempt</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map(log => (
                                <tr key={log.id}>
                                    <td>{log.event}</td>
                                    <td>
                                        <span className={`status-badge status-${log.status}`}>
                                            {log.status}
                                        </span>
                                    </td>
                                    <td>{log.attempts}</td>
                                    <td>{new Date(log.last_attempt_at).toLocaleString()}</td>
                                    <td>
                                        {log.status !== 'success' && (
                                            <button
                                                onClick={() => handleRetry(log.id)}
                                                style={{ padding: '6px 12px', fontSize: '13px', cursor: 'pointer', background: 'white', border: '1px solid #d1d5db', borderRadius: '4px', color: '#374151' }}
                                            >
                                                Retry
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default Webhooks;