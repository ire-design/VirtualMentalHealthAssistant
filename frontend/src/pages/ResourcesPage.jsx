import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/ResourcesPage.css';

function ResourcesPage() {
  const navigate = useNavigate();

  return (
    <div className="resources-container">
      <div className="resources-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Back</button>
        <h1>Mental Health Resources</h1>
        <p>Helpful information and coping strategies for academic stress</p>
      </div>

      <div className="resources-content">
        
        <section className="resource-section">
          <h2> Emergency Contacts</h2>
          <div className="contact-cards">
            <div className="contact-card">
              <h3>Befrienders Kenya</h3>
              <p className="number">0800 723 253</p>
              <p>24/7 Crisis Support (Toll-free)</p>
            </div>
            <div className="contact-card">
              <h3>MHFA Kenya</h3>
              <p className="number">0800 720 710</p>
              <p>Mental Health First Aid</p>
            </div>
            <div className="contact-card">
              <h3>Emergency Services</h3>
              <p className="number">999 / 112</p>
              <p>Medical Emergencies</p>
            </div>
          </div>
        </section>

        <section className="resource-section">
          <h2>Coping with Exam Stress</h2>
          <ul className="tips-list">
            <li>Create a realistic study schedule and stick to it</li>
            <li>Take regular 10-minute breaks every hour</li>
            <li>Practice deep breathing: 4 seconds in, 4 seconds hold, 4 seconds out</li>
            <li>Get 7-8 hours of sleep, especially before exams</li>
            <li>Break large topics into smaller, manageable chunks</li>
            <li>Form study groups with classmates for support</li>
          </ul>
        </section>

        <section className="resource-section">
          <h2>Stress Management Techniques</h2>
          <ul className="tips-list">
            <li><strong>5-4-3-2-1 Grounding:</strong> Name 5 things you see, 4 you hear, 3 you touch, 2 you smell, 1 you taste</li>
            <li><strong>Progressive Muscle Relaxation:</strong> Tense and relax each muscle group</li>
            <li><strong>Journaling:</strong> Write down worries for 10 minutes daily</li>
            <li><strong>Physical Activity:</strong> 20-30 minutes of walking or exercise</li>
            <li><strong>Mindfulness:</strong> Focus on the present moment without judgment</li>
          </ul>
        </section>

        <section className="resource-section">
          <h2> When to Seek Professional Help</h2>
          <ul className="tips-list">
            <li>Feeling hopeless or worthless for more than 2 weeks</li>
            <li>Difficulty sleeping or eating for extended periods</li>
            <li>Persistent thoughts of self-harm or suicide</li>
            <li>Unable to focus on studies despite trying</li>
            <li>Avoiding friends, family, and social activities</li>
            <li>Physical symptoms (headaches, stomach issues) with no medical cause</li>
          </ul>
        </section>

        <section className="resource-section">
          <h2> MUT Campus Support</h2>
          <p>Murang'a University of Technology offers counseling services. Contact the Student Guidance and Counselling Office for appointments.</p>
        </section>

        <div className="cta-section">
          <button className="btn-chat" onClick={() => navigate('/chat')}>
            Talk to the Assistant
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResourcesPage;