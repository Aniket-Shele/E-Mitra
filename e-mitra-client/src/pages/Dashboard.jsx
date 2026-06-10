import React, { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import { useReactMediaRecorder } from 'react-media-recorder';
import { FaUserMd, FaVideo, FaMicrophone, FaFileAlt, FaBrain, FaRegCommentDots, FaClock, FaPowerOff, FaVolumeUp } from 'react-icons/fa';

function Dashboard({ userId }) {
  // --- SESSION & USER PROFILE STATE ---
  const [profileData, setProfileData] = useState(null);
  const [frameBuffer, setFrameBuffer] = useState([]); 
  const [chatMessages, setChatMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef(null);
  
  // --- MULTIMODAL CAPTURE STATE ---
  const [textInput, setTextInput] = useState('');
  const [enableLlama, setEnableLlama] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState('English'); // Multilingual State
  const webcamRef = useRef(null);
  const recordingIntervalRef = useRef(null); 
  
  const { status, startRecording, stopRecording, mediaBlobUrl, clearBlobUrl } = useReactMediaRecorder({ video: true, audio: true });

  // --- COGNITIVE TELEMETRY STATE ---
  const [transcribedText, setTranscribedText] = useState('');
  const [textResults, setTextResults] = useState(null);
  const [audioResults, setAudioResults] = useState(null);
  const [videoResults, setVideoResults] = useState(null);
  const [fusedResults, setFusedResults] = useState(null); 
  const [strategy, setStrategy] = useState(null);
  const [frameEmotions, setFrameEmotions] = useState([]); 

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

  // --- INITIALIZATION ---
// --- INITIALIZATION & MULTILINGUAL GREETING ---
// --- INITIALIZATION & MULTILINGUAL GREETING ---
useEffect(() => {
  const fetchProfile = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/users/${userId}`);
      const data = await res.json();
      if (data.exists) {
        setProfileData(data.profile);
        
        // Use a functional state update to safely inspect previous messages
        setChatMessages(prev => {
          // 🚨 CRITICAL: If history already exists, DO NOT wipe it out!
          if (prev.length > 0) return prev; 
          
          const stressor = data.profile.current_stressor || 'some stress lately';
          let therapistIntro = "";

          if (selectedLanguage === 'Hindi') {
            therapistIntro = `नमस्ते, ${data.profile.name}। मैं ई-मित्रा हूँ, आपका एआई थेरेपिस्ट। मैंने आपके क्लिनिकल बेसलाइन की समीक्षा की है। ऐसा लगता है कि आप ${stressor} का सामना कर रहे हैं। मैं यहाँ सुनने के लिए हूँ। आज आप कैसा महसूस कर रहे हैं?`;
          } else if (selectedLanguage === 'Marathi') {
            therapistIntro = `नमस्कार, ${data.profile.name}। मी ई-मित्रा आहे, तुमचा एआय थेरपिस्ट। मी तुमच्या क्लिनिकल बेसलाइनचे पुनरावलोकन केले आहे. असे दिसते की तुम्ही सध्या ${stressor} चा सामना करत आहात. मी तुम्हाला ऐकण्यासाठी इथे आहे. आज तुम्हाला कसे वाटत आहे?`;
          } else {
            therapistIntro = `Hello, ${data.profile.name}. I am E-Mitra, your AI Therapist. I have reviewed your clinical baseline. It seems you've been navigating ${stressor}. I am here to listen. How are you feeling today?`;
          }

          return [{ sender: 'ai', text: therapistIntro }];
        });
      } else {
        setChatMessages(prev => prev.length > 0 ? prev : [{ sender: 'ai', text: `Patient ID ${userId} profile connection error.` }]);
      }
    } catch (err) { console.error("Database connection error"); }
  };
  fetchProfile();
}, [userId]); // <--- 🚨 FIXED: Removed selectedLanguage from dependencies!

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

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

// --- ADVANCED TEXT TO SPEECH ENGINE ---
  const speakText = (text, language) => {
    if (!window.speechSynthesis) return alert("Your browser does not support Voice.");
    
    window.speechSynthesis.cancel(); // Stop current audio
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Function to apply the best human-like voice
    const applyBestVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      let selectedVoice;

      if (language === 'Hindi') {
        utterance.lang = 'hi-IN';
        // Hunt for premium Google Hindi voice
        selectedVoice = voices.find(v => v.lang.includes('hi') && v.name.includes('Google'));
        if (!selectedVoice) selectedVoice = voices.find(v => v.lang.includes('hi'));
      } 
      else if (language === 'Marathi') {
        utterance.lang = 'mr-IN';
        selectedVoice = voices.find(v => v.lang.includes('mr')); // Standard Marathi
      } 
      else {
        utterance.lang = 'en-US';
        // Hunt for High-Quality "YouTube Video" style voices (Chrome, Mac, Windows)
        selectedVoice = voices.find(v => v.lang === 'en-US' && v.name.includes('Google US English'));
        if (!selectedVoice) selectedVoice = voices.find(v => v.lang.includes('en') && (v.name.includes('Samantha') || v.name.includes('Natural')));
        if (!selectedVoice) selectedVoice = voices.find(v => v.lang === 'en-US');
      }

      if (selectedVoice) utterance.voice = selectedVoice;
      
      utterance.rate = 1.1; // Fixed the "Alien" speed. Normal human speed.
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    };

    // Chrome has a bug where voices don't load instantly. This safely waits for them.
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = applyBestVoice;
    } else {
      applyBestVoice();
    }
  };

  // --- MAIN PROCESSING PIPELINE ---
  const executePipeline = async () => {
    if (!textInput.trim() && !mediaBlobUrl) return alert("Please provide input (type or record).");
    
    setIsLoading(true);
    setTextResults(null); setAudioResults(null); setVideoResults(null);
    setFusedResults(null); setStrategy(null); setFrameEmotions([]);
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

      // 1. Run Multimodal Analysis
      const response = await fetch('http://127.0.0.1:8000/analyze-multimodal', { method: 'POST', body: formPayload });
      const data = await response.json();
      
      if (data.text_emotions?.length > 0) setTextResults(data.text_emotions);
      if (data.audio_emotions?.length > 0) setAudioResults(data.audio_emotions);
      if (data.video_emotions?.length > 0) setVideoResults(data.video_emotions);
      if (data.frame_emotions?.length > 0) setFrameEmotions(data.frame_emotions);
      
      if (data.transcribed_text) { 
        setTranscribedText(data.transcribed_text); 
        if (!textInput.trim()) finalTranscribedText = data.transcribed_text; 
      }
      
      if (data.fused_score?.length > 0) { setFusedResults(data.fused_score); finalEmotion = data.fused_score[0].label; }
      if (data.strategy) { setStrategy(data.strategy); finalStrategy = data.strategy.name; }

      // 2. Generate LLM Response with Language Awareness
      if (finalTranscribedText.trim()) {
        setChatMessages(prev => [...prev, { sender: 'user', text: finalTranscribedText }]);
        
        if (enableLlama) {
            const chatRes = await fetch('http://127.0.0.1:8000/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId, 
                    user_message: finalTranscribedText, 
                    emotion_state: finalEmotion,
                    clinical_strategy: finalStrategy, 
                    emotion_journey: data.frame_emotions || [],
                    chat_history: chatMessages.map(msg => ({ role: msg.sender === 'user' ? 'user' : 'assistant', content: msg.text })),
                    language: selectedLanguage // Pass selected language to Llama 3.1
                })
            });
            
            const chatData = await chatRes.json();
            setChatMessages(prev => [...prev, { sender: 'ai', text: chatData.reply }]);
        }
        
        // Reset Inputs
        setTextInput(''); 
        setFrameBuffer([]);
        if (clearBlobUrl) clearBlobUrl(); 
      }
    } catch (error) { alert("Pipeline Error. Is the backend running?"); } 
    finally { setIsLoading(false); }
  };

  return (
    <div style={{ 
      width: '100%', maxWidth: '1400px', height: 'calc(100vh - 80px)', margin: '0 auto', 
      display: 'grid', gridTemplateColumns: '450px 1fr', gridTemplateRows: 'auto 1fr', gap: '2px', 
      background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', 
      borderRadius: '16px', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' 
    }}>
      
      {/* LEFT PANEL: CAPTURE & SETTINGS */}
      <div style={{ gridColumn: '1', gridRow: '1', background: 'rgba(11, 17, 32, 0.85)', backdropFilter: 'blur(16px)', padding: '25px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <h2 style={{ margin: 0, fontSize: '16px', color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FaVideo /> Multimodal Capture
        </h2>
        
        <textarea rows="3" className="lofi-input" value={textInput} onChange={e => setTextInput(e.target.value)} placeholder="Type manual input here..." />
        
        <div style={{ position: 'relative', backgroundColor: '#000', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', height: '160px', overflow: 'hidden' }}>
          <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          <div style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '12px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '4px', background: 'rgba(0,0,0,0.6)', color: status === 'recording' ? '#ef4444' : '#10b981' }}>
            {status === 'recording' ? '● REC' : 'IDLE'}
          </div>
        </div>

        <button 
          className="lofi-btn" 
          onClick={status === 'recording' ? stopRecording : startRecording} 
          style={{ width: '100%', padding: '12px', background: status === 'recording' ? 'rgba(239, 68, 68, 0.8)' : '#4f46e5' }}
        >
          {status === 'recording' ? "⏹ STOP RECORDING" : "▶ START AUDIO/VIDEO"}
        </button>

        {/* SETTINGS & LANGUAGE */}
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#cbd5e1', fontSize: '14px', marginBottom: '12px' }}>
            <input type="checkbox" checked={enableLlama} onChange={(e) => setEnableLlama(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#10b981' }} />
            Activate LLM Therapy (Llama 3.1)
          </label>

          <p style={{ margin: '0 0 5px 0', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Therapy Language</p>
          <select 
            value={selectedLanguage} 
            onChange={(e) => setSelectedLanguage(e.target.value)}
            style={{ width: '100%', padding: '10px', background: '#000', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px' }}
          >
            <option value="English">English</option>
            <option value="Hindi">Hindi (हिंदी)</option>
            <option value="Marathi">Marathi (मराठी)</option>
          </select>
        </div>

        <button className="lofi-btn" onClick={executePipeline} disabled={isLoading} style={{ width: '100%', padding: '15px', background: '#10b981', color: '#000', fontWeight: 'bold' }}>
          {isLoading ? "PROCESSING..." : "ANALYZE & GENERATE RESPONSE"}
        </button>
      </div>

      {/* LEFT PANEL: TELEMETRY */}
      <div style={{ gridColumn: '1', gridRow: '2', background: 'rgba(11, 17, 32, 0.85)', backdropFilter: 'blur(16px)', padding: '25px', overflowY: 'auto' }}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: '16px', color: '#a5b4fc', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FaBrain /> Cognitive Telemetry
        </h2>

        <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '15px', marginBottom: '20px' }}>
          <p style={{ margin: '0 0 5px 0', color: '#cbd5e1', fontSize: '11px' }}>FUSED EMOTION STATE</p>
          <div style={{ fontSize: '24px', color: '#fff', fontWeight: 'bold' }}>
              {fusedResults ? `${fusedResults[0].label.toUpperCase()} (${(fusedResults[0].score * 100).toFixed(0)}%)` : 'AWAITING SIGNAL'}
          </div>
        </div>

        {/* KEYFRAMES */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ margin: '0 0 10px 0', color: '#cbd5e1', fontSize: '11px' }}><FaClock /> EXPRESSION KEYFRAMES</p>
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px' }}>
            {frameBuffer.length > 0 ? frameBuffer.map((imgSrc, index) => (
              <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <img src={imgSrc} alt="frame" style={{ height: '50px', borderRadius: '4px', border: '1px solid rgba(165,180,252,0.4)' }} />
                {frameEmotions[index] && <span style={{ fontSize: '9px', color: '#86efac', background: '#000', padding: '2px 4px' }}>{frameEmotions[index]}</span>}
              </div>
            )) : <span style={{ fontSize: '12px', color: '#64748b' }}>No visual data.</span>}
          </div>
        </div>

        {/* DIAGNOSTIC MODULES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {visibleModules.ClinicalDirective && strategy && (
            <div style={{ padding: '12px', background: 'rgba(129, 140, 248, 0.1)', borderRadius: '6px', borderLeft: '3px solid #818cf8' }}>
              <p style={{ margin: '0 0 5px 0', fontSize: '11px', color: '#818cf8', fontWeight: 'bold' }}>CLINICAL STRATEGY</p>
              <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1' }}>{strategy.description}</p>
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1, padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
              <p style={{ fontSize: '10px', color: '#cbd5e1' }}>SEMANTIC (Text)</p>
              {textResults?.slice(0,2).map((e,i) => <div key={i} style={{fontSize:'11px', display:'flex', justifyContent:'space-between'}}><span>{e.label}</span><span>{(e.score*100).toFixed(0)}%</span></div>)}
            </div>
            <div style={{ flex: 1, padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
              <p style={{ fontSize: '10px', color: '#cbd5e1' }}>PROSODY (Audio)</p>
              {audioResults?.slice(0,2).map((e,i) => <div key={i} style={{fontSize:'11px', display:'flex', justifyContent:'space-between'}}><span>{e.label}</span><span>{(e.score*100).toFixed(0)}%</span></div>)}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: CHAT LOG */}
      <div style={{ gridColumn: '2', gridRow: '1 / 3', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 30px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '20px', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}><FaRegCommentDots /> Session Log: {userId}</h1>
          <button onClick={() => window.location.reload()} style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer' }}>
            <FaPowerOff /> End Session
          </button>
        </div>

        <div style={{ flexGrow: 1, padding: '30px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {chatMessages.map((msg, idx) => {
            const isUser = msg.sender === 'user';
            return (
              <div key={idx} style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px', textAlign: isUser ? 'right' : 'left' }}>{isUser ? 'You' : 'Dr. E-Mitra'}</div>
                <div style={{ 
                  background: isUser ? 'rgba(79, 70, 229, 0.8)' : 'rgba(255, 255, 255, 0.1)',
                  padding: '12px 18px', borderRadius: '15px', color: '#fff', fontSize: '15px'
                }}>
                  {msg.text}
                  {!isUser && (
                     <button 
                       onClick={() => speakText(msg.text, selectedLanguage)}
                       style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '10px', background: 'rgba(16, 185, 129, 0.3)', color: '#10b981', border: '1px solid #10b981', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                     >
                       <FaVolumeUp /> Listen
                     </button>
                  )}
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