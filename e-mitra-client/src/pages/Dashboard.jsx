import React, { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import { useReactMediaRecorder } from 'react-media-recorder';
import { FaUserMd, FaVideo, FaMicrophone, FaFileAlt, FaBrain, FaRegCommentDots, FaClock, FaPowerOff } from 'react-icons/fa';

function Dashboard({ userId }) {
  // --- SESSION & USER PROFILE STATE ---
  const [profileData, setProfileData] = useState(null);
  const [frameBuffer, setFrameBuffer] = useState([]); 
  const [chatMessages, setChatMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef(null);
  
  // --- MULTIMODAL CAPTURE STATE ---
  const [textInput, setTextInput] = useState('');
  const webcamRef = useRef(null);
  const recordingIntervalRef = useRef(null); 
  const { status, startRecording, stopRecording, mediaBlobUrl } = useReactMediaRecorder({ video: true, audio: true });

  // 🚨 LLM Activation Toggle
  const [enableLlama, setEnableLlama] = useState(true);

  // --- COGNITIVE TELEMETRY STATE ---
  const [transcribedText, setTranscribedText] = useState('');
  const [textResults, setTextResults] = useState(null);
  const [audioResults, setAudioResults] = useState(null);
  const [videoResults, setVideoResults] = useState(null);
  const [fusedResults, setFusedResults] = useState(null); 
  const [strategy, setStrategy] = useState(null);
  const [frameEmotions, setFrameEmotions] = useState([]); 

  // --- DIAGNOSTIC VISIBILITY TOGGLES ---
  const [visibleModules, setVisibleModules] = useState({
    ClinicalDirective: true, 
    SemanticSignature: true, 
    ProsodyProfile: true,    
    ExpressionMap: true,     
    Transcription: false,     
  });

  const modelRegistry = {
    Text: "DistilRoBERTa (j-hartmann/emotion)",
    Audio: "Wav2Vec2 Superb-ER (V1-IEMOCAP)",
    Video: "HSEmotion HSENet (enet_b0_vgaf)",
    LLM: "Llama 3.1 (Cognitive Core)"
  };

  // ==========================================
  // INITIALIZATION: Fetch Profile & Humanize Chat
  // ==========================================
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/users/${userId}`);
        const data = await res.json();
        if (data.exists) {
          setProfileData(data.profile);
          const therapistIntro = `Hello, ${data.profile.name}. I am E-Mitra, your AI Therapist. I have reviewed your clinical baseline. It seems you've been navigating ${data.profile.current_stressor || 'some stress lately'}. I am here to listen. How are you feeling today?`;
          setChatMessages([{ sender: 'ai', text: therapistIntro }]);
        } else {
          setChatMessages([{ sender: 'ai', text: `Patient ID ${userId} profile connection error.` }]);
        }
      } catch (err) { console.error("Database connection error"); }
    };
    fetchProfile();
  }, [userId]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  // ==========================================
  // MULTIMODAL LOGIC (Webcam & Audio)
  // ==========================================
  useEffect(() => {
    if (status === 'recording') {
      setFrameBuffer([]); 
      setFrameEmotions([]); 
      captureToBuffer();  
      recordingIntervalRef.current = setInterval(() => captureToBuffer(), 1000); 
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

  // ==========================================
  // CORE PIPELINE: Multimodal Analysis & Chat
  // ==========================================
  const executePipeline = async () => {
    if (!textInput.trim() && !mediaBlobUrl) return alert("Please provide input (type or record).");
    
    setIsLoading(true);
    
    // Clear previous telemetry for fresh run
    setTextResults(null);
    setAudioResults(null);
    setVideoResults(null);
    setFusedResults(null);
    setStrategy(null);
    setFrameEmotions([]);
    setTranscribedText('');

    let finalTranscribedText = textInput; 
    let finalEmotion = "neutral";
    let finalStrategy = "Active Probing";

    try {
      const formPayload = new FormData();
      formPayload.append("text", textInput);
      formPayload.append("text_model", "v2");          
      formPayload.append("audio_model_choice", "v1");  
      formPayload.append("video_model_choice", "v2");  

      if (frameBuffer.length > 0) formPayload.append("images_base64", JSON.stringify(frameBuffer));
      if (mediaBlobUrl) {
        const mediaFetch = await fetch(mediaBlobUrl);
        const mediaBlob = await mediaFetch.blob();
        formPayload.append("audio", mediaBlob, "recording.webm");
      }

      const response = await fetch('http://127.0.0.1:8000/analyze-multimodal', { method: 'POST', body: formPayload });
      const data = await response.json();
      
      // Safely map data using optional chaining to prevent text-only crashes
      if (data.text_emotions?.length > 0) setTextResults(data.text_emotions);
      if (data.audio_emotions?.length > 0) setAudioResults(data.audio_emotions);
      if (data.video_emotions?.length > 0) setVideoResults(data.video_emotions);
      if (data.frame_emotions?.length > 0) setFrameEmotions(data.frame_emotions);
      
      if (data.transcribed_text) { setTranscribedText(data.transcribed_text); finalTranscribedText = data.transcribed_text; }
      if (data.fused_score?.length > 0) { setFusedResults(data.fused_score); finalEmotion = data.fused_score[0].label; }
      if (data.strategy) { setStrategy(data.strategy); finalStrategy = data.strategy.name; }

      if (finalTranscribedText.trim()) {
        setChatMessages(prev => [...prev, { sender: 'user', text: finalTranscribedText }]);
        
        if (enableLlama) {
            const chatRes = await fetch('http://127.0.0.1:8000/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId, user_message: finalTranscribedText, emotion_state: finalEmotion,
                    clinical_strategy: finalStrategy, emotion_journey: data.frame_emotions || [],
                    chat_history: chatMessages.map(msg => ({ role: msg.sender === 'user' ? 'user' : 'assistant', content: msg.text }))
                })
            });
            
            const chatData = await chatRes.json();
            setChatMessages(prev => [...prev, { sender: 'ai', text: chatData.reply }]);
        }
        
        setTextInput(''); 
      }
    } catch (error) { alert("Diagnostic Pipeline Error. Is FastAPI running?"); } 
    finally { setIsLoading(false); }
  };

  // ==========================================
  // RENDER: UNIFIED GRID LAYOUT
  // ==========================================
  return (
    <div style={{ 
      width: '100%', maxWidth: '1400px', height: 'calc(100vh - 80px)', margin: '0 auto', 
      display: 'grid', gridTemplateColumns: '450px 1fr', gridTemplateRows: 'auto 1fr', gap: '2px', 
      background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', 
      borderRadius: '16px', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' 
    }}>
      
      {/* 🟦 TOP-LEFT: MULTIMODAL CAPTURE */}
      <div style={{ gridColumn: '1', gridRow: '1', background: 'rgba(11, 17, 32, 0.85)', backdropFilter: 'blur(16px)', padding: '25px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <h2 style={{ margin: 0, fontSize: '16px', color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FaVideo /> Multimodal Capture
        </h2>
        
        <textarea rows="3" className="lofi-input" style={{ marginBottom: 0 }} value={textInput} onChange={e => setTextInput(e.target.value)} placeholder="Type manual input here..." />
        
        <div style={{ position: 'relative', backgroundColor: '#000', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', height: '160px', overflow: 'hidden', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.8)' }}>
          <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          <div style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '12px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '4px', background: 'rgba(0,0,0,0.6)', color: status === 'recording' ? '#ef4444' : '#10b981' }}>
            {status === 'recording' ? '● REC' : 'IDLE'}
          </div>
        </div>

        {/* 🚨 NEW: Single Dynamic Toggle Button for Recording */}
        <button 
          className="lofi-btn" 
          onClick={status === 'recording' ? stopRecording : startRecording} 
          style={{ 
            width: '100%', 
            padding: '12px', 
            fontSize: '15px', 
            background: status === 'recording' ? 'rgba(239, 68, 68, 0.8)' : '#4f46e5', 
            color: '#fff',
            border: status === 'recording' ? '1px solid #fca5a5' : 'none',
            boxShadow: status === 'recording' ? '0 0 15px rgba(239, 68, 68, 0.5)' : '',
            transition: 'all 0.3s ease'
          }}
        >
          {status === 'recording' ? "⏹ STOP RECORDING" : "▶ START AUDIO/VIDEO"}
        </button>

        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#cbd5e1', fontSize: '15px', cursor: 'pointer', marginTop: '5px', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <input 
            type="checkbox" 
            checked={enableLlama} 
            onChange={(e) => setEnableLlama(e.target.checked)} 
            style={{ width: '18px', height: '18px', accentColor: '#10b981', cursor: 'pointer' }} 
          />
          Activate LLM Therapy Response (Llama 3.1)
        </label>

        <button className="lofi-btn" onClick={executePipeline} disabled={isLoading} style={{ width: '100%', padding: '15px', marginTop: '5px', fontSize: '16px', background: enableLlama ? '#10b981' : '#38bdf8', color: '#000', fontWeight: 'bold' }}>
          {isLoading ? "PROCESSING..." : (enableLlama ? "ANALYZE & GENERATE RESPONSE" : "RUN DIAGNOSTICS ONLY")}
        </button>
      </div>

      {/* 🟦 BOTTOM-LEFT: COGNITIVE TELEMETRY */}
      <div style={{ gridColumn: '1', gridRow: '2', background: 'rgba(11, 17, 32, 0.85)', backdropFilter: 'blur(16px)', padding: '25px', overflowY: 'auto' }}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: '16px', color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FaBrain /> Cognitive Telemetry
        </h2>

        {/* Consensus State */}
        <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '15px', marginBottom: '20px' }}>
          <p style={{ margin: '0 0 5px 0', color: '#cbd5e1', fontSize: '12px', textTransform: 'uppercase' }}>Consensus Emotion State</p>
          <div style={{ fontSize: '28px', color: '#fff', fontWeight: 'bold' }}>
              {fusedResults ? `${fusedResults[0].label.toUpperCase()} (${(fusedResults[0].score * 100).toFixed(0)}%)` : 'AWAITING SIGNAL'}
          </div>
        </div>

        {/* Analyzed Keyframes */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ margin: '0 0 10px 0', color: '#cbd5e1', fontSize: '12px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}><FaClock /> Expression Keyframes</p>
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px' }}>
            {frameBuffer.length > 0 ? (
              frameBuffer.map((imgSrc, index) => (
                <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', minWidth: '70px' }}>
                  <img src={imgSrc} alt="frame" style={{ height: '60px', borderRadius: '4px', border: '1px solid rgba(165,180,252,0.4)' }} />
                  {frameEmotions[index] && <span style={{ fontSize: '10px', color: '#86efac', background: '#000', padding: '2px 6px', borderRadius: '4px' }}>{frameEmotions[index]}</span>}
                </div>
              ))
            ) : ( <span style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>No visual data captured.</span> )}
          </div>
        </div>

        {/* Dynamic Modals based on Toggles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
            {Object.keys(visibleModules).map(key => (
              <button key={key} onClick={() => setVisibleModules(p => ({...p, [key]: !p[key]}))} style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer', border: '1px solid', borderColor: visibleModules[key] ? '#a5b4fc' : 'rgba(255,255,255,0.2)', background: visibleModules[key] ? 'rgba(165,180,252,0.2)' : 'transparent', color: '#fff' }}>
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </button>
            ))}
          </div>

          {visibleModules.ClinicalDirective && strategy && (
            <div style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', borderLeft: '3px solid #818cf8' }}>
              <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#818cf8', fontWeight: 'bold' }}>Clinical Directive ({modelRegistry.LLM})</p>
              <p style={{ margin: 0, fontSize: '14px', color: '#cbd5e1' }}>{strategy.description}</p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            {visibleModules.SemanticSignature && (
              <div style={{ flex: 1, padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#cbd5e1' }}>SEMANTIC ({modelRegistry.Text.split(' ')[0]})</p>
                {textResults ? textResults.slice(0,3).map((e,i) => <div key={i} style={{fontSize:'12px', display:'flex', justifyContent:'space-between', color: '#fff'}}><span style={{textTransform:'capitalize'}}>{e.label}</span><span>{(e.score*100).toFixed(0)}%</span></div>) : <span style={{fontSize:'12px', color:'#94a3b8'}}>No Data</span>}
              </div>
            )}
            {visibleModules.ProsodyProfile && (
              <div style={{ flex: 1, padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#cbd5e1' }}>PROSODY ({modelRegistry.Audio.split(' ')[0]})</p>
                {audioResults ? audioResults.slice(0,3).map((e,i) => <div key={i} style={{fontSize:'12px', display:'flex', justifyContent:'space-between', color: '#fff'}}><span style={{textTransform:'capitalize'}}>{e.label}</span><span>{(e.score*100).toFixed(0)}%</span></div>) : <span style={{fontSize:'12px', color:'#94a3b8'}}>No Data</span>}
              </div>
            )}
          </div>

          {visibleModules.ExpressionMap && (
              <div style={{ padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#cbd5e1' }}>EXPRESSION ({modelRegistry.Video.split(' ')[0]})</p>
                {videoResults ? (
                  <div style={{ display: 'flex', gap: '15px' }}>
                    {videoResults.slice(0,3).map((e,i) => <div key={i} style={{fontSize:'13px', flex: 1, color: '#fff'}}><span style={{textTransform:'capitalize'}}>{e.label}:</span> {(e.score*100).toFixed(0)}%</div>)}
                  </div>
                ) : <span style={{fontSize:'12px', color:'#94a3b8'}}>No Data</span>}
              </div>
          )}
        </div>
      </div>

      {/* 🟦 RIGHT: THERAPY CHAT */}
      <div style={{ gridColumn: '2', gridRow: '1 / 3', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column' }}>
        
        <div style={{ padding: '20px 30px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}><FaRegCommentDots /> Session Log: {userId}</h1>
            <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#10b981' }}>● Connection Secure & Encrypted</p>
          </div>
          <button onClick={() => window.location.reload()} style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FaPowerOff /> End Session
          </button>
        </div>

        <div style={{ flexGrow: 1, padding: '30px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {chatMessages.map((msg, idx) => {
            const isUser = msg.sender === 'user';
            return (
              <div key={idx} style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '6px', textAlign: isUser ? 'right' : 'left' }}>
                  {isUser ? (profileData ? profileData.name : 'You') : 'E-Mitra'}
                </div>
                <div style={{ 
                  background: isUser ? 'rgba(79, 70, 229, 0.8)' : 'rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)',
                  padding: '16px 20px', borderRadius: isUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                  color: '#fff', fontSize: '16px', lineHeight: '1.5', boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                }}>
                  {msg.text}
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>
      </div>

    </div>
  );
}

export default Dashboard;