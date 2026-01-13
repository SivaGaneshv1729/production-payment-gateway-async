import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const DashboardLayout = ({ children, title, subtitle }) => {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#f3f4f6' }}>
            {/* Sidebar */}
            <div style={{ width: '250px', background: '#111827', color: 'white', padding: '20px' }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '40px' }}>PayPoint Admin</div>
                <nav style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <Link to="/" style={{ color: '#d1d5db', textDecoration: 'none' }}>Overview</Link>
                    <Link to="/transactions" style={{ color: '#d1d5db', textDecoration: 'none' }}>Transactions</Link>
                    <Link to="/webhooks" style={{ color: '#d1d5db', textDecoration: 'none' }}>Webhooks</Link>
                    <Link to="/docs" style={{ color: '#d1d5db', textDecoration: 'none' }}>Integration Guide</Link>
                </nav>
                <button
                    onClick={handleLogout}
                    style={{ marginTop: 'auto', background: 'transparent', border: '1px solid #374151', color: 'white', padding: '8px', cursor: 'pointer', width: '100%', marginTop: '50px' }}
                >
                    Logout
                </button>
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, padding: '40px' }}>
                <div style={{ marginBottom: '30px' }}>
                    <h1 style={{ fontSize: '28px', color: '#111827', margin: 0 }}>{title}</h1>
                    {subtitle && <p style={{ color: '#6b7280', marginTop: '5px' }}>{subtitle}</p>}
                </div>
                {children}
            </div>
        </div>
    );
};

export default DashboardLayout;