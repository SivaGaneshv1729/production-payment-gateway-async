import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

const DashboardLayout = ({ children, title, subtitle }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    return (
        <div className="dashboard-layout">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M2 17L12 22L22 17" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M2 12L12 17L22 12" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    PayPoint Admin
                </div>
                <nav>
                    <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
                        Overview
                    </Link>
                    <Link to="/transactions" className={`nav-link ${location.pathname.includes('/transactions') ? 'active' : ''}`}>
                        Transactions
                    </Link>
                    <Link to="/webhooks" className={`nav-link ${location.pathname.includes('/webhooks') ? 'active' : ''}`}>
                        Webhooks
                    </Link>
                    <Link to="/docs" className={`nav-link ${location.pathname.includes('/docs') ? 'active' : ''}`}>
                        Integration Guide
                    </Link>
                </nav>
                <button
                    onClick={handleLogout}
                    style={{ marginTop: 'auto', background: 'transparent', border: '1px solid #e5e7eb', color: '#374151', padding: '8px', cursor: 'pointer', width: '100%', borderRadius: '6px' }}
                >
                    Logout
                </button>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                <div className="page-header">
                    <h1>{title}</h1>
                    {subtitle && <div className="welcome-text">{subtitle}</div>}
                </div>
                {children}
            </main>
        </div>
    );
};

export default DashboardLayout;