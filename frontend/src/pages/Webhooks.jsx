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
        // NOTE: You need to implement this endpoint in backend if you want it to persist
        // For now, we just simulate the UI action
        alert("Configuration Saved (Simulation)");
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
            <div data-test-id="webhook-config" className="card" style={{ padding: '20px', marginBottom: '20px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ marginBottom: '15px' }}>Configuration</h3>
                <form onSubmit={handleSave}>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Webhook URL</label>
                        <input
                            data-test-id="webhook-url-input"
                            type="url"
                            value={webhookUrl}
                            onChange={(e) => setWebhookUrl(e.target.value)}
                            placeholder="https://your-site.com/webhook"
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                        />
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Signing Secret</label>
                        <div data-test-id="webhook-secret" style={{ background: '#f3f4f6', padding: '10px', borderRadius: '4px', fontFamily: 'monospace' }}>
                            {secret}
                        </div>
                    </div>
                    <button type="submit" style={{ padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        Save Configuration
                    </button>
                </form>
            </div>

            <div className="card" style={{ padding: '20px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ marginBottom: '15px' }}>Delivery Logs</h3>
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #eee' }}>
                            <th style={{ padding: '10px' }}>Event</th>
                            <th style={{ padding: '10px' }}>Status</th>
                            <th style={{ padding: '10px' }}>Attempts</th>
                            <th style={{ padding: '10px' }}>Last Attempt</th>
                            <th style={{ padding: '10px' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map(log => (
                            <tr key={log.id} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '10px' }}>{log.event}</td>
                                <td style={{ padding: '10px' }}>
                                    <span style={{
                                        padding: '2px 8px', borderRadius: '10px', fontSize: '12px',
                                        background: log.status === 'success' ? '#dcfce7' : '#fee2e2',
                                        color: log.status === 'success' ? '#166534' : '#991b1b'
                                    }}>
                                        {log.status}
                                    </span>
                                </td>
                                <td style={{ padding: '10px' }}>{log.attempts}</td>
                                <td style={{ padding: '10px' }}>{new Date(log.last_attempt_at).toLocaleString()}</td>
                                <td style={{ padding: '10px' }}>
                                    {log.status !== 'success' && (
                                        <button
                                            onClick={() => handleRetry(log.id)}
                                            style={{ padding: '5px 10px', fontSize: '12px', cursor: 'pointer' }}
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
        </DashboardLayout>
    );
};

export default Webhooks;