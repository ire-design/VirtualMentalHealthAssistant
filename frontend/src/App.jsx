import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ChatInterface from './components/chatInterface.jsx';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import Navbar from './components/Navbar';
import ResourcesPage from './pages/ResourcesPage';
import ReportsPage from './pages/ReportsPage';


function App() {
  return (
    <Router>

    <div className='App'>
      <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/chat" element={<ChatInterface />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>

    </Router>
  );
}

export default App
