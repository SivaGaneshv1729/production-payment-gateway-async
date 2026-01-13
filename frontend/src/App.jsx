import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Webhooks from './pages/Webhooks';
import ApiDocs from './pages/ApiDocs';

const ProtectedRoute = ({ children }) => {
    const isAuthenticated = localStorage.getItem('x-api-key');
    return isAuthenticated ? children : <Navigate to="/login" />;
};

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
                <Route path="/webhooks" element={<ProtectedRoute><Webhooks /></ProtectedRoute>} />
                <Route path="/docs" element={<ProtectedRoute><ApiDocs /></ProtectedRoute>} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;