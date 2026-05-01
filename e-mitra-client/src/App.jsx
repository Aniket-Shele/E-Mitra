import React, { useState } from 'react';
import './styles/lofi-theme.css'; 
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import { FaPalette } from 'react-icons/fa'; // Import a theme icon

// 🚨 Add your different video/gif filenames here from 'public' folder
const BACKGROUND_MEDIA = [
  { type: 'video', src: '/bgv3.mp4' },
  { type: 'video', src: '/bgv2.mp4' },
  { type: 'video', src: '/bgv1.mp4' },
  { type: 'video', src: '/bgv4.mp4' },
  { type: 'video', src: '/bgv5.mp4' },

  { type: 'image', src: '/bg1.gif' },
  { type: 'image', src: '/bg2.gif' },
  { type: 'image', src: '/bg3.gif' },
  { type: 'image', src: '/bg4.gif' },
  { type: 'image', src: '/bg5.gif' },
  { type: 'image', src: '/bg6.gif' }
  
];

function App() {
  const [currentView, setCurrentView] = useState('login'); 
  const [userId, setUserId] = useState('');
  const [themeIndex, setThemeIndex] = useState(0);

  const toggleTheme = () => {
    setThemeIndex((prev) => (prev + 1) % BACKGROUND_MEDIA.length);
  };

  const currentBg = BACKGROUND_MEDIA[themeIndex];

  return (
    <div className="app-container" style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      
      {/* Dynamic Lo-Fi Background */}
      {currentBg.type === 'video' ? (
        <video key={currentBg.src} autoPlay loop muted playsInline className="bg-video">
           <source src={currentBg.src} type="video/mp4" />
        </video>
      ) : (
        <img key={currentBg.src} src={currentBg.src} alt="Background" className="bg-video" />
      )}

      {/* Floating Theme Switcher Button */}
      <button 
        onClick={toggleTheme}
        className="lofi-btn"
        style={{
          position: 'fixed', top: '15px', left: '15px', zIndex: 1000,
          background: 'rgba(79, 70, 229, 0.4)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)',
          padding: '8px 15px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px'
        }}
      >
        <FaPalette /> Change Environment
      </button>

      <div className="content-overlay" style={{ height: '100%', width: '100%', overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: '40px 20px', boxSizing: 'border-box' }}>
        {currentView === 'login' && <Login userId={userId} setUserId={setUserId} setCurrentView={setCurrentView} />}
        {currentView === 'onboarding' && <Onboarding userId={userId} setCurrentView={setCurrentView} />}
        {currentView === 'dashboard' && <Dashboard userId={userId} />}
      </div>
    </div>
  );
}

export default App;