import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../styles/Navbar.css';

function Navbar() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  if (!user) return null; // Don't show navbar if not logged in

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <div className="nav-left">
          <Link to="/dashboard" className="logo">
            <span className="mut-badge">MUT</span>
            <span className="app-name">Mental Health Assistant</span>
          </Link>
        </div>

        <div className="nav-right">
          <Link to="/dashboard" className="nav-link">Dashboard</Link>
          <Link to="/chat" className="nav-link">Chat</Link>
          
          <div className="user-section">
            <span className="user-name">{user.name}</span>
            <button className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;