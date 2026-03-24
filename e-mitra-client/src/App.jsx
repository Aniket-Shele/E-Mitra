import React, { useState, useRef } from 'react';
import Webcam from 'react-webcam';
import { useReactMediaRecorder } from 'react-media-recorder';

function App() {
  // --- STATES ---
  const [textInput, setTextInput] = useState('');
  const [capturedText, setCapturedText] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);
  const [transcribedText, setTranscribedText] = useState('');
  
  // AI Results States
  const [twitterResults, setTwitterResults] = useState(null);
  const [hartmannResults, setHartmannResults] = useState(null);
  const [audioResults, setAudioResults] = useState(null);
  const [videoResults, setVideoResults] = useState(null);
  const [fusedResults, setFusedResults] = useState(null); // The Consensus Score
  
  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [activeModel, setActiveModel] = useState('hartmann'); 
  
  const webcamRef = useRef(null);
  const { status, startRecording, stopRecording, mediaBlobUrl } = useReactMediaRecorder({ video: true, audio: true });

  // --- LOGIC ---
  const captureFrame = React.useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setCapturedImage(imageSrc);
      return imageSrc;
    }
    return null;
  }, [webcamRef]);

  const handleSimulateSend = async () => {
    setCapturedText(textInput);
    const currentFrame = captureFrame();
    
    if (!textInput.trim() && !mediaBlobUrl) {
      alert("Please provide text or record a video first.");
      return; 
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("text", textInput);
      
      if (currentFrame) formData.append("image_base64", currentFrame);

      if (mediaBlobUrl) {
        const mediaFetch = await fetch(mediaBlobUrl);
        const mediaBlob = await mediaFetch.blob();
        formData.append("audio", mediaBlob, "recording.webm");
      }

      const response = await fetch('http://127.0.0.1:8000/analyze-multimodal', {
        method: 'POST',
        body: formData, 
      });

      const data = await response.json();
      
      // Update UI with all individual models and the fused consensus
      if (data.text_emotions.twitter) setTwitterResults(data.text_emotions.twitter);
      if (data.text_emotions.hartmann) setHartmannResults(data.text_emotions.hartmann);
      if (data.audio_emotions.length > 0) setAudioResults(data.audio_emotions);
      if (data.video_emotions.length > 0) setVideoResults(data.video_emotions);
      if (data.transcribed_text) setTranscribedText(data.transcribed_text);
      if (data.fused_score.length > 0) setFusedResults(data.fused_score);

    } catch (error) {
      console.error("Error:", error);
      alert("Failed to connect to Python backend.");
    } finally {
      setIsLoading(false);
    }
  };

  const activeTextResults = activeModel === 'hartmann' ? hartmannResults : twitterResults;

  // --- REUSABLE STYLES ---
  const theme = { bg: '#0f172a', panelBg: '#1e293b', titleBar: '#0f172a', border: '#334155', accent: '#38bdf8', textMain: '#e2e8f0', textMuted: '#94a3b8' };
  const windowStyle = { backgroundColor: theme.panelBg, border: `1px solid ${theme.border}`, borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' };
  const titleBarStyle = { backgroundColor: theme.titleBar, padding: '10px 15px', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', fontWeight: 'bold', color: theme.textMuted, letterSpacing: '1px', textTransform: 'uppercase' };

  return (
    <div style={{ backgroundColor: theme.bg, color: theme.textMain, minHeight: '100vh', padding: '30px', fontFamily: '"Inter", "Segoe UI", sans-serif' }}>
      
      {/* HEADER */}
      <div style={{ borderBottom: `2px solid ${theme.accent}`, paddingBottom: '15px', marginBottom: '40px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', color: theme.textMain, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ width: '12px', height: '12px', backgroundColor: theme.accent, borderRadius: '50%', display: 'inline-block', boxShadow: `0 0 10px ${theme.accent}` }}></span>
          E-MITRA / SYSTEM DIAGNOSTICS
        </h1>
      </div>
      
      {/* INPUT WINDOWS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '40px' }}>
        
        {/* TEXT WINDOW */}
        <div style={windowStyle}>
          <div style={titleBarStyle}>
            <span>1. Text Override (Optional)</span>
            <select value={activeModel} onChange={(e) => setActiveModel(e.target.value)} style={{ backgroundColor: 'transparent', color: theme.textMain, border: 'none', outline: 'none', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
              <option value="hartmann" style={{ backgroundColor: theme.panelBg }}>🧠 V2: Hartmann</option>
              <option value="twitter" style={{ backgroundColor: theme.panelBg }}>🐦 V1: Twitter</option>
            </select>
          </div>
          <div style={{ padding: '15px', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
            <p style={{ fontSize: '12px', color: theme.textMuted, marginBottom: '10px' }}>*If left blank, text will be automatically extracted from your video recording.</p>
            <textarea rows="5" style={{ flexGrow: 1, width: '100%', backgroundColor: theme.bg, color: theme.textMain, border: `1px solid ${theme.border}`, borderRadius: '4px', padding: '10px', outline: 'none', resize: 'none', fontFamily: 'monospace' }} placeholder="Type manual input here..." value={textInput} onChange={(e) => setTextInput(e.target.value)} />
          </div>
        </div>

        {/* MULTIMODAL CAPTURE WINDOW */}
        <div style={windowStyle}>
          <div style={titleBarStyle}>
            <span>2. Multimodal Capture (Video + Audio)</span>
            <span style={{ color: status === 'recording' ? '#ef4444' : theme.accent, fontWeight: 'bold' }}>
              {status === 'recording' ? '● RECORDING' : 'IDLE'}
            </span>
          </div>
          <div style={{ backgroundColor: '#000', display: 'flex', justifyContent: 'center', position: 'relative', height: '200px' }}>
            <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" style={{ width: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ padding: '15px', display: 'flex', justifyContent: 'center', gap: '15px', backgroundColor: theme.panelBg }}>
              <button onClick={startRecording} style={{ padding: '8px 24px', backgroundColor: 'transparent', border: `1px solid ${theme.accent}`, color: theme.accent, borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', textTransform: 'uppercase' }}>Start Recording</button>
              <button onClick={stopRecording} style={{ padding: '8px 24px', backgroundColor: theme.bg, border: `1px solid ${theme.border}`, color: theme.textMuted, borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', textTransform: 'uppercase' }}>Stop Recording</button>
          </div>
        </div>

      </div>

      {/* EXECUTE BUTTON */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '50px' }}>
        <button onClick={handleSimulateSend} disabled={isLoading} style={{ padding: '15px 40px', fontSize: '16px', letterSpacing: '2px', backgroundColor: isLoading ? theme.bg : theme.accent, color: isLoading ? theme.textMuted : '#000', border: `1px solid ${isLoading ? theme.border : theme.accent}`, borderRadius: '30px', cursor: 'pointer', fontWeight: 'bold', textTransform: 'uppercase', transition: 'all 0.3s ease', boxShadow: isLoading ? 'none' : `0 0 15px ${theme.accent}66` }}>
          {isLoading ? "Executing Full Pipeline..." : "Initialize Analysis"}
        </button>
      </div>

      {/* FULL MULTIMODAL DASHBOARD */}
      <div style={{ ...windowStyle, backgroundColor: theme.bg }}>
        <div style={{ ...titleBarStyle, backgroundColor: theme.panelBg }}>
          <span>Telemetry & Fusion Matrix</span>
        </div>

        {/* NEW: THE LATE FUSION ENGINE CONSENSUS */}
        <div style={{ padding: '20px 20px 0 20px' }}>
          <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '8px', border: `2px solid ${theme.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: `0 0 20px ${theme.accent}40` }}>
            <div>
              <h2 style={{ margin: '0 0 5px 0', color: theme.textMain, textTransform: 'uppercase', letterSpacing: '2px' }}>E-Mitra Consensus (Late Fusion)</h2>
              <p style={{ margin: 0, color: theme.textMuted, fontSize: '13px' }}>Weighted algorithmic synthesis of Semantic, Prosodic, and Visual data.</p>
            </div>
            
            {fusedResults ? (
              <div style={{ textAlign: 'right' }}>
                <span style={{ display: 'block', fontSize: '12px', color: theme.textMuted, textTransform: 'uppercase', marginBottom: '5px' }}>Dominant State:</span>
                <span style={{ fontSize: '32px', fontWeight: 'bold', color: theme.accent, textTransform: 'uppercase' }}>
                  {fusedResults[0].label} ({(fusedResults[0].score * 100).toFixed(1)}%)
                </span>
              </div>
            ) : (
              <span style={{ color: theme.textMuted }}>Awaiting Processing...</span>
            )}
          </div>
        </div>
        
        <div style={{ display: 'flex', padding: '20px', gap: '15px' }}>
          
          {/* TEXT */}
          <div style={{ flex: '1', backgroundColor: theme.panelBg, padding: '15px', borderRadius: '6px', border: `1px solid ${theme.border}` }}>
            <h3 style={{ marginTop: 0, color: theme.accent, fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase' }}>Semantics (Text)</h3>
            {isLoading ? <p style={{ color: theme.textMuted }}>Processing...</p> : activeTextResults ? (
              <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
                {activeTextResults.slice(0, 5).map((emo, idx) => (
                  <li key={idx} style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', borderBottom: `1px dotted ${theme.border}`, paddingBottom: '4px', fontSize: '13px' }}>
                    <span style={{ fontWeight: 'bold' }}>{emo.label.toUpperCase()}</span> 
                    <span style={{ color: theme.accent }}>{(emo.score * 100).toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            ) : <p style={{ color: theme.textMuted }}>No data.</p>}
          </div>

          {/* AUDIO */}
          <div style={{ flex: '1', backgroundColor: theme.panelBg, padding: '15px', borderRadius: '6px', border: `1px solid ${theme.border}` }}>
            <h3 style={{ marginTop: 0, color: '#fca5a5', fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase' }}>Prosody (Audio)</h3>
            {isLoading ? <p style={{ color: theme.textMuted }}>Processing...</p> : audioResults ? (
              <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
                {audioResults.map((emo, idx) => (
                  <li key={idx} style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', borderBottom: `1px dotted ${theme.border}`, paddingBottom: '4px', fontSize: '13px' }}>
                    <span style={{ fontWeight: 'bold', color: '#e2e8f0' }}>{emo.label.toUpperCase()}</span> 
                    <span style={{ color: '#fca5a5' }}>{(emo.score * 100).toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            ) : <p style={{ color: theme.textMuted }}>No data.</p>}
          </div>

          {/* VISION */}
          <div style={{ flex: '1', backgroundColor: theme.panelBg, padding: '15px', borderRadius: '6px', border: `1px solid ${theme.border}` }}>
            <h3 style={{ marginTop: 0, color: '#86efac', fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase' }}>Expressions (Video)</h3>
            {isLoading ? <p style={{ color: theme.textMuted }}>Processing...</p> : videoResults ? (
              <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
                {videoResults.slice(0, 5).map((emo, idx) => (
                  <li key={idx} style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', borderBottom: `1px dotted ${theme.border}`, paddingBottom: '4px', fontSize: '13px' }}>
                    <span style={{ fontWeight: 'bold', color: '#e2e8f0' }}>{emo.label.toUpperCase()}</span> 
                    <span style={{ color: '#86efac' }}>{(emo.score * 100).toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            ) : <p style={{ color: theme.textMuted }}>No data.</p>}
          </div>

        </div>

        {/* RAW DATA CAPTURED */}
        <div style={{ padding: '0 20px 20px 20px', display: 'flex', gap: '15px' }}>
            <div style={{ flex: 2, border: `1px solid ${theme.border}`, borderRadius: '6px', padding: '15px', backgroundColor: theme.panelBg }}>
               <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: theme.textMuted }}>TRANSCRIBED PAYLOAD</h4>
               <p style={{ margin: 0, fontSize: '14px', fontStyle: 'italic', color: theme.accent }}>"{transcribedText || capturedText || "Awaiting extraction..."}"</p>
               {mediaBlobUrl && <audio src={mediaBlobUrl} controls style={{ width: '100%', height: '30px', marginTop: '15px' }} />}
            </div>
            <div style={{ flex: 1, border: `1px solid ${theme.border}`, borderRadius: '6px', padding: '15px', backgroundColor: theme.panelBg, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
               <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: theme.textMuted }}>ANALYSIS KEYFRAME</h4>
               {capturedImage ? <img src={capturedImage} alt="Captured" style={{ width: '100px', borderRadius: '4px', border: `1px solid ${theme.accent}` }} /> : <p style={{ margin: 0, color: '#ef4444' }}>No Signal</p>}
            </div>
        </div>
      </div>

    </div>
  );
}

export default App;