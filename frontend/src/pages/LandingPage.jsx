import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/LandingPage.css';

function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-container">
      <div className="landing-content">
        <div className="hero">
          <div className="mut-badge">MUT</div>
          <h1>Virtual Mental Health Assistant</h1>
          <p className="tagline">Your 24/7 companion for academic stress support</p>
          
          <div className="cta-buttons">
            <button className="btn-start" onClick={() => navigate('/chat')}>
              Start Anonymous Chat
            </button>
            <button className="btn-login" onClick={() => navigate('/login')}>
              Login
            </button>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <span className="emoji">🔒</span>
              <h3>Confidential</h3>
              <p>100% private & secure</p>
            </div>
            <div className="feature-card">
              <span className="emoji">🕐</span>
              <h3>24/7 Available</h3>
              <p>Help anytime you need</p>
            </div>
            <div className="feature-card">
              <span className="emoji">🎓</span>
              <h3>Academic Focus</h3>
              <p>Built for students</p>
            </div>
          </div>

          <div className="disclaimer">
            <small>Crisis support: <strong>Befrienders Kenya 0800 723 253</strong></small>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;