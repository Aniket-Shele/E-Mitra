import React, { useState } from 'react';

function Onboarding({ userId, setCurrentView }) {
  const [formData, setFormData] = useState({
    name: '', age: '', situation: 'Studying', coping_checkbox: [], coping_text: '',
    additional_info: '', support_system: 'Yes, I have a few people I trust',
    current_stressor: '', feeling_scale: '3', sleep_quality: 'Generally fine',
    intense_emotions: '', personality_1: 'Ambivert', personality_2: 'Balanced', personality_3: 'Reserved', triggers: ''
  });

  const submitOnboarding = async (e) => {
    e.preventDefault();
    try {
      const payload = { 
        user_id: userId, name: formData.name, age: formData.age, situation: formData.situation,
        coping_style: `Prefers: ${formData.coping_checkbox.join(', ')}. Context: ${formData.coping_text}`,
        additional_info: formData.additional_info || "None", support_system: formData.support_system,
        current_stressor: formData.current_stressor, feeling_scale: `${formData.feeling_scale}/5`,
        sleep_quality: formData.sleep_quality, intense_emotions: formData.intense_emotions || "None",
        personality: `${formData.personality_1}, ${formData.personality_2}, ${formData.personality_3}`,
        triggers: formData.triggers || "None"
      };

      await fetch(`http://127.0.0.1:8000/api/users`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      setCurrentView('dashboard');
    } catch (err) { alert("Failed to save profile."); }
  };

  const handleCopingCheck = (val) => {
    setFormData(prev => {
      const isChecked = prev.coping_checkbox.includes(val);
      return { ...prev, coping_checkbox: isChecked ? prev.coping_checkbox.filter(i => i !== val) : [...prev.coping_checkbox, val] };
    });
  };

  return (
    <form onSubmit={submitOnboarding} className="lofi-window" style={{ width: '800px' }}>
      <div className="lofi-title-bar">
        <span>E-Mitra IntakeForm</span>
      </div>
      
      <p style={{ color: '#94a3b8', marginBottom: '20px' }}>Establishing baseline metrics for ID: <b>{userId}</b>.</p>

      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={{ flex: 1 }}>
          <label className="lofi-label">What should I call you?</label>
          <input required className="lofi-input" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="lofi-label">What is your age?</label>
          <input type="number" required className="lofi-input" value={formData.age} onChange={e=>setFormData({...formData, age: e.target.value})} />
        </div>
      </div>

      <label className="lofi-label">What best describes your current situation?</label>
      <select className="lofi-input" value={formData.situation} onChange={e=>setFormData({...formData, situation: e.target.value})}>
        <option>Studying</option><option>Working</option><option>Both</option><option>Something else</option>
      </select>

      <label className="lofi-label">How have you been feeling over the past few weeks? (1 = Low, 5 = Positive)</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
        <span>1</span>
        <input type="range" min="1" max="5" value={formData.feeling_scale} onChange={e=>setFormData({...formData, feeling_scale: e.target.value})} style={{ flex: 1 }} />
        <span>5 (Current: {formData.feeling_scale})</span>
      </div>

      <label className="lofi-label">How has your sleep been lately?</label>
      <select className="lofi-input" value={formData.sleep_quality} onChange={e=>setFormData({...formData, sleep_quality: e.target.value})}>
        <option>Generally fine</option><option>A bit off</option><option>Quite bad</option><option>Very poor</option>
      </select>

      <label className="lofi-label">Would you say you have people around you — friends or family — you can openly talk to?</label>
      <select className="lofi-input" value={formData.support_system} onChange={e=>setFormData({...formData, support_system: e.target.value})}>
        <option>Yes, I have a few people I trust</option><option>Sometimes, but not always</option><option>Not really — I mostly keep things to myself</option>
      </select>

      <label className="lofi-label">What’s currently causing you the most stress or pressure?</label>
      <textarea required rows="2" className="lofi-input" value={formData.current_stressor} onChange={e=>setFormData({...formData, current_stressor: e.target.value})} />

      <label className="lofi-label">When you're going through something difficult emotionally, how do you deal with it?</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px' }}>
        {["Just being heard and understood", "Practical advice and steps I can take", "A mix of both", "I'm not sure yet"].map(opt => (
          <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" checked={formData.coping_checkbox.includes(opt)} onChange={() => handleCopingCheck(opt)} /> {opt}
          </label>
        ))}
      </div>
      <input placeholder="Any specific coping methods you use?" className="lofi-input" value={formData.coping_text} onChange={e=>setFormData({...formData, coping_text: e.target.value})} />

      <label className="lofi-label">Which of these describe you? (Select all that apply)</label>
      <div style={{ display: 'flex', gap: '15px' }}>
        <select className="lofi-input" value={formData.personality_1} onChange={e=>setFormData({...formData, personality_1: e.target.value})}><option>Introverted</option><option>Extroverted</option><option>Ambivert</option></select>
        <select className="lofi-input" value={formData.personality_2} onChange={e=>setFormData({...formData, personality_2: e.target.value})}><option>Logical</option><option>Emotional</option><option>Balanced</option></select>
        <select className="lofi-input" value={formData.personality_3} onChange={e=>setFormData({...formData, personality_3: e.target.value})}><option>Expressive</option><option>Reserved</option></select>
      </div>

      <label className="lofi-label">Are there certain topics or situations that make you feel anxious or uncomfortable during conversations?</label>
      <textarea required rows="2" className="lofi-input" value={formData.triggers} onChange={e=>setFormData({...formData, triggers: e.target.value})} />

      <label className="lofi-label" style={{ color: '#94a3b8' }}>OPTIONAL: Can you recall the last time your emotions felt intense or overwhelming?</label>
      <textarea rows="2" className="lofi-input" value={formData.intense_emotions} onChange={e=>setFormData({...formData, intense_emotions: e.target.value})} />
      
      <label className="lofi-label" style={{ color: '#94a3b8' }}>OPTIONAL: Is there anything you'd like me to know about you that might help me support you better?</label>
      <textarea rows="2" className="lofi-input" value={formData.additional_info} onChange={e=>setFormData({...formData, additional_info: e.target.value})} />

      <button type="submit" className="lofi-btn" style={{ width: '100%', marginTop: '20px' }}>SAVE PROFILE & START THERAPY</button>
    </form>
  );
}

export default Onboarding;