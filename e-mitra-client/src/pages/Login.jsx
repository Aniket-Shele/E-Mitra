import React from 'react';

function Login({ userId, setUserId, setCurrentView }) {
  
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!userId.trim()) return alert("Please enter a User ID");
    
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/users/${userId}`);
      const data = await res.json();
      
      if (data.exists) setCurrentView('dashboard');
      else setCurrentView('onboarding');
    } catch (err) {
      alert("Cannot connect to backend. Is FastAPI running?");
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%' }}>
      <form onSubmit={handleLogin} className="lofi-window" style={{ width: '400px', textAlign: 'center' }}>
        
        <div className="lofi-title-bar" style={{ justifyContent: 'center', borderBottom: 'none' }}>
          <span style={{ fontSize: '32px', color: '#fff', letterSpacing: '2px' }}>E-MITRA</span>
        </div>

        <p style={{ color: '#cbd5e1', marginBottom: '30px' }}>Enter your patient ID to begin.</p>
        
        <input 
          type="text" 
          placeholder="e.g. yourname_birthyear" 
          className="lofi-input" 
          style={{ textAlign: 'center', fontSize: '24px' }}
          value={userId} 
          onChange={(e) => setUserId(e.target.value)} 
        />
        
        <button type="submit" className="lofi-btn" style={{ width: '100%' }}>
          Connect
        </button>
      </form>
    </div>
  );
}

export default Login;   