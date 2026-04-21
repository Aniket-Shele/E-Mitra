import React, { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import { useReactMediaRecorder } from 'react-media-recorder';

function App() {
  // --- ROUTING & USER STATE ---
  const [currentView, setCurrentView] = useState('login'); // 'login', 'onboarding', 'dashboard'
  const [userId, setUserId] = useState('');
  
  // Intake Form State
  const [formData, setFormData] = useState({
    name: '', age: '', occupation: '', living_situation: '',
    baseline_personality: '', primary_goal: '', coping_mechanisms: '',
    support_system: '', triggers: ''
  });

  // --- DASHBOARD STATE ---
  const [textInput, setTextInput] = useState('');
  const [capturedText, setCapturedText] = useState('');
  const [frameBuffer, setFrameBuffer] = useState([]); 
  const [transcribedText, setTranscribedText] = useState('');
  const [textResults, setTextResults] = useState(null);
  const [audioResults, setAudioResults] = useState(null);
  const [videoResults, setVideoResults] = useState(null);
  const [fusedResults, setFusedResults] = useState(null); 
  const [strategy, setStrategy] = useState(null);
  const [frameEmotions, setFrameEmotions] = useState([]); 
  const [chatMessages, setChatMessages] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [activeTextModel, setActiveTextModel] = useState('v2'); 
  const [activeAudioModel, setActiveAudioModel] = useState('v1'); 
  const [activeVideoModel, setActiveVideoModel] = useState('v2'); 
  
  const webcamRef = useRef(null);
  const recordingIntervalRef = useRef(null); 
  const { status, startRecording, stopRecording, mediaBlobUrl } = useReactMediaRecorder({ video: true, audio: true });

  const theme = { bg: '#0f172a', panelBg: '#1e293b', titleBar: '#0f172a', border: '#334155', accent: '#38bdf8', success: '#10b981', textMain: '#f8fafc', textMuted: '#94a3b8' };
  const windowStyle = { backgroundColor: theme.panelBg, border: `1px solid ${theme.border}`, borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' };
  const titleBarStyle = { backgroundColor: theme.titleBar, padding: '12px 15px', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontWeight: 'bold', color: theme.textMuted, letterSpacing: '1px', textTransform: 'uppercase' };

  // --- LOGIN & ONBOARDING LOGIC ---
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!userId.trim()) return alert("Please enter a User ID");
    
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/users/${userId}`);
      const data = await res.json();
      
      if (data.exists) {
        setChatMessages([{ sender: 'ai', text: `Hello, ${data.profile.name}. I am E-Mitra. Welcome back to your session. How are you feeling today?` }]);
        setCurrentView('dashboard');
      } else {
        setCurrentView('onboarding');
      }
    } catch (err) {
      alert("Cannot connect to backend. Is FastAPI running?");
    }
  };

  const submitOnboarding = async (e) => {
    e.preventDefault();
    try {
      const payload = { user_id: userId, ...formData };
      await fetch(`http://127.0.0.1:8000/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setChatMessages([{ sender: 'ai', text: `Hello, ${formData.name}. Thank you for sharing that with me. I'm here to help you manage your goals. Where would you like to start today?` }]);
      setCurrentView('dashboard');
    } catch (err) {
      alert("Failed to save profile.");
    }
  };

  // --- DASHBOARD LOGIC ---
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages, isChatOpen]); 
  useEffect(() => {
    if (status === 'recording') {
      setFrameBuffer([]); 
      setFrameEmotions([]); 
      captureToBuffer();  
      recordingIntervalRef.current = setInterval(() => { captureToBuffer(); }, 1000);
    } else {
      clearInterval(recordingIntervalRef.current);
    }
    return () => clearInterval(recordingIntervalRef.current);
  }, [status]);

  const captureToBuffer = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) setFrameBuffer(prev => [...prev, imageSrc]);
    }
  };

  const handleSimulateSend = async () => {
    setCapturedText(textInput);
    if (!textInput.trim() && !mediaBlobUrl) return alert("Please provide text or record a video first.");

    setIsLoading(true);
    let finalTranscribedText = textInput; 
    let finalEmotion = "neutral";
    let finalStrategy = "Active Probing";

    try {
      const formPayload = new FormData();
      formPayload.append("text", textInput);
      formPayload.append("text_model", activeTextModel);
      formPayload.append("audio_model_choice", activeAudioModel);
      formPayload.append("video_model_choice", activeVideoModel);

      if (frameBuffer.length > 0) formPayload.append("images_base64", JSON.stringify(frameBuffer));
      if (mediaBlobUrl) {
        const mediaFetch = await fetch(mediaBlobUrl);
        const mediaBlob = await mediaFetch.blob();
        formPayload.append("audio", mediaBlob, "recording.webm");
      }

      const response = await fetch('http://127.0.0.1:8000/analyze-multimodal', { method: 'POST', body: formPayload });
      const data = await response.json();
      
      if (data.text_emotions.length > 0) setTextResults(data.text_emotions);
      if (data.audio_emotions.length > 0) setAudioResults(data.audio_emotions);
      if (data.video_emotions.length > 0) setVideoResults(data.video_emotions);
      if (data.frame_emotions) setFrameEmotions(data.frame_emotions);
      if (data.transcribed_text) { setTranscribedText(data.transcribed_text); finalTranscribedText = data.transcribed_text; }
      if (data.fused_score.length > 0) { setFusedResults(data.fused_score); finalEmotion = data.fused_score[0].label; }
      if (data.strategy) { setStrategy(data.strategy); finalStrategy = data.strategy.name; }

      if (finalTranscribedText.trim()) {
        setChatMessages(prev => [...prev, { sender: 'user', text: finalTranscribedText }]);
        setIsChatLoading(true);
        setIsChatOpen(true); 

        const chatRes = await fetch('http://127.0.0.1:8000/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId, // 🚨 SEND THE DYNAMIC USER ID
                user_message: finalTranscribedText,
                emotion_state: finalEmotion,
                clinical_strategy: finalStrategy,
                emotion_journey: data.frame_emotions || [],
                chat_history: chatMessages.map(msg => ({ role: msg.sender === 'user' ? 'user' : 'assistant', content: msg.text }))
            })
        });
        
        const chatData = await chatRes.json();
        setChatMessages(prev => [...prev, { sender: 'ai', text: chatData.reply }]);
        setTextInput('');
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to connect to Python backend.");
      setIsChatLoading(false);
    } finally {
      setIsLoading(false);
      setIsChatLoading(false);
    }
  };

  // ==========================================
  // RENDER: LOGIN SCREEN
  // ==========================================
  if (currentView === 'login') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', backgroundColor: theme.bg, color: theme.textMain, fontFamily: '"Inter", sans-serif' }}>
        <form onSubmit={handleLogin} style={{ ...windowStyle, padding: '40px', width: '400px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h2 style={{ textAlign: 'center', color: theme.accent, margin: 0 }}>E-MITRA SECURE LOGIN</h2>
          <p style={{ fontSize: '13px', color: theme.textMuted, textAlign: 'center', margin: 0 }}>Enter your unique patient identifier to begin your session.</p>
          <input 
            type="text" 
            placeholder="Enter User ID (e.g., Aniket_01)" 
            value={userId} 
            onChange={(e) => setUserId(e.target.value)}
            style={{ padding: '12px', borderRadius: '6px', border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.textMain, outline: 'none' }}
          />
          <button type="submit" style={{ padding: '12px', backgroundColor: theme.accent, color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>CONNECT TO SESSION</button>
        </form>
      </div>
    );
  }

  // ==========================================
  // RENDER: ONBOARDING SCREEN
  // ==========================================
  if (currentView === 'onboarding') {
    const inputStyle = { width: '100%', padding: '10px', borderRadius: '6px', border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.textMain, outline: 'none', marginBottom: '15px' };
    const labelStyle = { display: 'block', fontSize: '12px', color: theme.textMuted, marginBottom: '5px', fontWeight: 'bold' };

    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0', minHeight: '100vh', width: '100vw', backgroundColor: theme.bg, color: theme.textMain, fontFamily: '"Inter", sans-serif', overflowY: 'auto' }}>
        <form onSubmit={submitOnboarding} style={{ ...windowStyle, padding: '40px', width: '600px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ color: theme.accent, margin: '0 0 10px 0' }}>Clinical Intake Form</h2>
          <p style={{ fontSize: '13px', color: theme.textMuted, marginBottom: '30px' }}>Profile not found for ID: <b>{userId}</b>. Please complete this baseline assessment.</p>
          
          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ flex: 1 }}><label style={labelStyle}>1. Full Name</label><input required style={inputStyle} value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} /></div>
            <div style={{ flex: 1 }}><label style={labelStyle}>2. Age</label><input required style={inputStyle} value={formData.age} onChange={e=>setFormData({...formData, age: e.target.value})} /></div>
          </div>
          
          <label style={labelStyle}>3. Occupation / Field of Study</label>
          <input required style={inputStyle} value={formData.occupation} onChange={e=>setFormData({...formData, occupation: e.target.value})} />

          <label style={labelStyle}>4. Living Situation (Alone, Roommates, Family, etc.)</label>
          <input required style={inputStyle} value={formData.living_situation} onChange={e=>setFormData({...formData, living_situation: e.target.value})} />

          <label style={labelStyle}>5. Baseline Personality (Introverted, Analytical, Anxious, Outgoing?)</label>
          <textarea required rows="2" style={inputStyle} value={formData.baseline_personality} onChange={e=>setFormData({...formData, baseline_personality: e.target.value})} />

          <label style={labelStyle}>6. How do you cope with overwhelming stress?</label>
          <textarea required rows="2" style={inputStyle} value={formData.coping_mechanisms} onChange={e=>setFormData({...formData, coping_mechanisms: e.target.value})} />

          <label style={labelStyle}>7. Primary goal for E-Mitra sessions?</label>
          <textarea required rows="2" style={inputStyle} value={formData.primary_goal} onChange={e=>setFormData({...formData, primary_goal: e.target.value})} />

          <label style={labelStyle}>8. Do you have a strong support system?</label>
          <input required style={inputStyle} value={formData.support_system} onChange={e=>setFormData({...formData, support_system: e.target.value})} />

          <label style={labelStyle}>9. Any specific triggers or topics to avoid?</label>
          <input required style={inputStyle} placeholder="Type 'None' if NA" value={formData.triggers} onChange={e=>setFormData({...formData, triggers: e.target.value})} />

          <button type="submit" style={{ marginTop: '20px', padding: '15px', backgroundColor: theme.success, color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px' }}>SAVE PROFILE & START THERAPY</button>
        </form>
      </div>
    );
  }

  // ==========================================
  // RENDER: MAIN DASHBOARD
  // ==========================================
  return (
    <div style={{ display: 'flex', justifyContent: 'center', minHeight: '100vh', width: '100vw', backgroundColor: '#000', color: theme.textMain, fontFamily: '"Inter", "Segoe UI", sans-serif' }}>
      
      <div style={{ width: '100%', maxWidth: '1200px', backgroundColor: theme.bg, borderLeft: `1px solid ${theme.border}`, borderRight: `1px solid ${theme.border}`, boxShadow: '0 0 30px rgba(0,0,0,0.8)', padding: '40px', display: 'flex', flexDirection: 'column', gap: '30px', position: 'relative' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `2px solid ${theme.accent}`, paddingBottom: '15px' }}>
          <h1 style={{ margin: 0, fontSize: '28px', color: theme.textMain, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '12px', height: '12px', backgroundColor: theme.accent, borderRadius: '50%', display: 'inline-block', boxShadow: `0 0 10px ${theme.accent}` }}></span>
            E-MITRA / SYSTEM DIAGNOSTICS
          </h1>
          {/* 🚨 SESSION END BUTTON */}
          <button 
            onClick={() => { if(window.confirm("End session and clear temporary memory?")) window.location.reload(); }}
            style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
            END SESSION ({userId})
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
          <div style={windowStyle}>
            <div style={titleBarStyle}>
              <span>1. Semantic Input</span>
              <select value={activeTextModel} onChange={(e) => setActiveTextModel(e.target.value)} style={{ backgroundColor: 'transparent', color: theme.textMain, border: 'none', outline: 'none', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>
                <option value="v2" style={{ backgroundColor: theme.panelBg }}>🧠 V2: Hartmann (Clinical)</option>
              </select>
            </div>
            <div style={{ padding: '20px', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <textarea rows="5" style={{ flexGrow: 1, width: '100%', backgroundColor: theme.bg, color: theme.textMain, border: `1px solid ${theme.border}`, borderRadius: '6px', padding: '15px', outline: 'none', resize: 'none', fontFamily: 'inherit', fontSize: '15px' }} placeholder="Type manual input or leave blank for video transcription..." value={textInput} onChange={(e) => setTextInput(e.target.value)} />
            </div>
          </div>

          <div style={windowStyle}>
            <div style={titleBarStyle}>
              <span>2. Multimodal Capture</span>
              <span style={{ color: status === 'recording' ? '#ef4444' : theme.success, fontWeight: 'bold' }}>
                {status === 'recording' ? `● REC (${frameBuffer.length})` : 'IDLE'}
              </span>
            </div>
            <div style={{ backgroundColor: '#000', display: 'flex', justifyContent: 'center', position: 'relative', height: '180px', overflow: 'hidden' }}>
              <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div style={{ padding: '15px', display: 'flex', justifyContent: 'center', gap: '15px', backgroundColor: theme.panelBg }}>
                <button onClick={startRecording} style={{ flex: 1, padding: '10px', backgroundColor: 'transparent', border: `1px solid ${theme.accent}`, color: theme.accent, borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>START</button>
                <button onClick={stopRecording} style={{ flex: 1, padding: '10px', backgroundColor: theme.bg, border: `1px solid ${theme.border}`, color: theme.textMuted, borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>STOP</button>
            </div>
          </div>
        </div>

        <button onClick={handleSimulateSend} disabled={isLoading || isChatLoading} style={{ width: '100%', padding: '18px', fontSize: '16px', letterSpacing: '2px', backgroundColor: isLoading ? theme.bg : theme.accent, color: isLoading ? theme.textMuted : '#0f172a', border: `1px solid ${isLoading ? theme.border : theme.accent}`, borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', textTransform: 'uppercase', transition: 'all 0.2s ease', boxShadow: isLoading ? 'none' : `0 4px 15px ${theme.accent}40` }}>
          {isLoading ? "Executing Pipeline..." : "Initialize Analysis & Respond"}
        </button>

        <div style={{ ...windowStyle, backgroundColor: theme.bg }}>
          <div style={{ ...titleBarStyle, backgroundColor: theme.panelBg }}>
            <span>Fusion Matrix & Clinical Directive</span>
          </div>

          <div style={{ padding: '20px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px', backgroundColor: theme.panelBg, padding: '20px', borderRadius: '8px', border: `1px solid ${theme.border}` }}>
              <h2 style={{ margin: '0 0 5px 0', color: theme.textMuted, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Consensus State</h2>
              {fusedResults ? (
                <span style={{ fontSize: '28px', fontWeight: 'bold', color: theme.accent, textTransform: 'uppercase' }}>
                  {fusedResults[0].label} <span style={{fontSize: '16px'}}>({(fusedResults[0].score * 100).toFixed(1)}%)</span>
                </span>
              ) : <span style={{ color: theme.textMuted, fontSize: '15px' }}>Awaiting...</span>}
            </div>

            <div style={{ flex: 1.5, minWidth: '300px', backgroundColor: theme.panelBg, padding: '20px', borderRadius: '8px', border: `1px solid ${theme.success}` }}>
              <h2 style={{ margin: '0 0 8px 0', color: theme.success, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', backgroundColor: theme.success, borderRadius: '50%', display: 'inline-block' }}></span>
                System Directive: {strategy ? strategy.name : "Standby"}
              </h2>
              <p style={{ margin: 0, color: theme.textMain, fontSize: '15px', fontStyle: 'italic', opacity: 0.9 }}>
                {strategy ? strategy.description : "Awaiting telemetry to determine clinical approach."}
              </p>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', padding: '0 20px 20px 20px', gap: '20px' }}>
            <div style={{ backgroundColor: theme.panelBg, padding: '15px', borderRadius: '8px', border: `1px solid ${theme.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                 <h3 style={{ margin: 0, color: theme.accent, fontSize: '11px', letterSpacing: '1px' }}>SEMANTICS (TEXT)</h3>
              </div>
              {textResults ? (
                <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
                  {textResults.slice(0, 4).map((emo, idx) => (
                    <li key={idx} style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${theme.bg}`, paddingBottom: '6px', fontSize: '14px' }}>
                      <span style={{ fontWeight: '600' }}>{emo.label.toUpperCase()}</span> <span style={{ color: theme.accent }}>{(emo.score * 100).toFixed(0)}%</span>
                    </li>
                  ))}
                </ul>
              ) : <span style={{ fontSize: '13px', color: theme.textMuted }}>No data.</span>}
            </div>

            <div style={{ backgroundColor: theme.panelBg, padding: '15px', borderRadius: '8px', border: `1px solid ${theme.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                 <h3 style={{ margin: 0, color: '#fca5a5', fontSize: '11px', letterSpacing: '1px' }}>PROSODY (AUDIO)</h3>
                 <select value={activeAudioModel} onChange={(e) => setActiveAudioModel(e.target.value)} style={{ backgroundColor: 'transparent', color: '#fca5a5', border: 'none', outline: 'none', fontSize: '10px', cursor: 'pointer' }}>
                   <option value="v1" style={{ backgroundColor: theme.panelBg }}>🎙️ V1: Superb</option>
                 </select>
              </div>
              {audioResults ? (
                <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
                  {audioResults.slice(0, 4).map((emo, idx) => (
                    <li key={idx} style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${theme.bg}`, paddingBottom: '6px', fontSize: '14px' }}>
                      <span style={{ fontWeight: '600' }}>{emo.label.toUpperCase()}</span> <span style={{ color: '#fca5a5' }}>{(emo.score * 100).toFixed(0)}%</span>
                    </li>
                  ))}
                </ul>
              ) : <span style={{ fontSize: '13px', color: theme.textMuted }}>No data.</span>}
            </div>

            <div style={{ backgroundColor: theme.panelBg, padding: '15px', borderRadius: '8px', border: `1px solid ${theme.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                 <h3 style={{ margin: 0, color: '#86efac', fontSize: '11px', letterSpacing: '1px' }}>EXPRESSIONS (VIDEO)</h3>
                 <select value={activeVideoModel} onChange={(e) => setActiveVideoModel(e.target.value)} style={{ backgroundColor: 'transparent', color: '#86efac', border: 'none', outline: 'none', fontSize: '10px', cursor: 'pointer' }}>
                   <option value="v2" style={{ backgroundColor: theme.panelBg }}>📷 V2: EmotiEffLib</option>
                 </select>
              </div>
              {videoResults ? (
                <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
                  {videoResults.slice(0, 4).map((emo, idx) => (
                    <li key={idx} style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${theme.bg}`, paddingBottom: '6px', fontSize: '14px' }}>
                      <span style={{ fontWeight: '600' }}>{emo.label.toUpperCase()}</span> <span style={{ color: '#86efac' }}>{(emo.score * 100).toFixed(0)}%</span>
                    </li>
                  ))}
                </ul>
              ) : <span style={{ fontSize: '13px', color: theme.textMuted }}>No data.</span>}
            </div>
          </div>

          <div style={{ padding: '0 20px 20px 20px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '300px', border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '20px', backgroundColor: theme.panelBg }}>
                 <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '1px' }}>Transcribed Payload</h4>
                 <p style={{ margin: 0, fontSize: '15px', fontStyle: 'italic', color: theme.accent }}>"{transcribedText || capturedText || "Awaiting extraction..."}"</p>
                 {mediaBlobUrl && <audio src={mediaBlobUrl} controls style={{ width: '100%', height: '40px', marginTop: '15px' }} />}
              </div>
              
              <div style={{ flex: 1, minWidth: '300px', border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '20px', backgroundColor: theme.panelBg, display: 'flex', flexDirection: 'column' }}>
                 <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '1px' }}>Analysis Keyframes ({frameBuffer.length})</h4>
                 <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '5px' }}>
                   {frameBuffer.length > 0 ? (
                     frameBuffer.map((imgSrc, index) => (
                       <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                         <img src={imgSrc} alt={`Frame ${index}`} style={{ height: '60px', borderRadius: '6px', border: `1px solid ${theme.accent}` }} />
                         {frameEmotions[index] && (
                           <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#86efac', backgroundColor: '#0f172a', padding: '3px 6px', borderRadius: '4px', border: `1px solid ${theme.border}`, letterSpacing: '0.5px' }}>
                             {frameEmotions[index]}
                           </span>
                         )}
                       </div>
                     ))
                   ) : (
                     <p style={{ margin: 0, color: '#ef4444', fontSize: '14px' }}>No Signal</p>
                   )}
                 </div>
                 {frameEmotions.length > 0 && (
                   <div style={{ marginTop: '15px', padding: '12px', backgroundColor: '#0b1120', borderRadius: '6px', border: `1px dashed ${theme.border}` }}>
                     <h4 style={{ margin: '0 0 5px 0', fontSize: '10px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '1px' }}>Micro-Expression Journey</h4>
                     <p style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', color: theme.accent }}>
                       {frameEmotions.join(' ➔ ')}
                     </p>
                   </div>
                 )}
              </div>
          </div>
        </div>
      </div>

      {/* CHAT FAB */}
      <button onClick={() => setIsChatOpen(!isChatOpen)} style={{ position: 'fixed', bottom: '40px', right: '40px', width: '70px', height: '70px', borderRadius: '50%', backgroundColor: theme.accent, color: '#000', border: 'none', fontSize: '30px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: `0 10px 25px ${theme.accent}66`, zIndex: 1000, transition: 'transform 0.2s', transform: isChatOpen ? 'scale(0.9)' : 'scale(1)' }}>
        {isChatOpen ? '✖' : '💬'}
      </button>

      {/* CHAT WINDOW */}
      {isChatOpen && (
        <div style={{ position: 'fixed', bottom: '130px', right: '40px', width: '400px', height: '600px', backgroundColor: '#0b1120', borderRadius: '16px', border: `1px solid ${theme.border}`, boxShadow: '0 15px 40px rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: `1px solid ${theme.border}`, backgroundColor: theme.panelBg, display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ width: '45px', height: '45px', borderRadius: '50%', backgroundColor: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>🤖</div>
            <div>
              <h2 style={{ margin: '0', fontSize: '18px', color: theme.textMain, fontWeight: 'bold' }}>E-Mitra Companion</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px' }}>
                <span style={{ width: '8px', height: '8px', backgroundColor: theme.success, borderRadius: '50%', display: 'inline-block' }}></span>
                <span style={{ fontSize: '13px', color: theme.success, fontWeight: '500' }}>Online • {userId}</span>
              </div>
            </div>
          </div>
          <div style={{ flexGrow: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {chatMessages.map((msg, idx) => {
              const isUser = msg.sender === 'user';
              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                  <span style={{ fontSize: '12px', color: theme.textMuted, marginBottom: '6px', fontWeight: '500', marginLeft: isUser ? '0' : '4px', marginRight: isUser ? '4px' : '0' }}>{isUser ? 'Chotu' : 'E-Mitra'}</span>
                  <div style={{ backgroundColor: isUser ? theme.accent : theme.panelBg, color: isUser ? '#000' : theme.textMain, padding: '14px 18px', borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px', maxWidth: '85%', fontSize: '15px', lineHeight: '1.5' }}>
                    {msg.text}
                  </div>
                </div>
              );
            })}
            {isChatLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '12px', color: theme.textMuted, marginBottom: '6px', fontWeight: '500', marginLeft: '4px' }}>E-Mitra</span>
                <div style={{ backgroundColor: theme.panelBg, color: theme.textMuted, padding: '14px 18px', borderRadius: '16px 16px 16px 4px', fontSize: '14px', fontStyle: 'italic' }}>Thinking...</div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;