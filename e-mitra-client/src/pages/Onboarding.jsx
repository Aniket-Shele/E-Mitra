import React, { useState } from 'react';

function Onboarding({ userId, setCurrentView }) {
  const [step, setStep] = useState(1);
  const [dob, setDob] = useState('');
  const [age, setAge] = useState(null);
  const [ageGroup, setAgeGroup] = useState(null);

  // Consolidated state for all possible questions
  const [formData, setFormData] = useState({
    // Common Questions (C1-C5)
    name: '',
    sleep_quality: 'Generally fine',
    feeling_scale: '3',
    support_system: 'Yes',
    coping_style: 'Just being heard',

    // Group 1: 12-19
    g1_q1: 'Going well/Mostly okay',
    g1_q2: 'I still enjoy them as much as before',
    g1_q3: 'Almost never',
    g1_q4: 'I usually manage it well',
    g1_q5: 'Never',
    g1_q6: '',
    g1_q7: '',

    // Group 2: 20-39
    g2_q1: 'Never',
    g2_q2: 'No',
    g2_q3: 'Never',
    g2_q4: 'Never',
    g2_q5: 'Never',
    g2_q6: '',
    g2_q7: '',

    // Group 3: 40-60
    g3_q1: 'No',
    g3_q2: 'No',
    g3_q3: 'Never',
    g3_q4: 'Not at all',
    g3_q5: 'Never',
    g3_q6: '',
    g3_q7: '',
  });

  const handleDobSubmit = (e) => {
    e.preventDefault();
    if (!dob) return alert("Please enter your Date of Birth");

    const birthDate = new Date(dob);
    const today = new Date();
    let calculatedAge = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        calculatedAge--;
    }

    setAge(calculatedAge);

    // Route to correct clinical group
    if (calculatedAge >= 12 && calculatedAge <= 19) setAgeGroup(1);
    else if (calculatedAge >= 20 && calculatedAge <= 39) setAgeGroup(2);
    else if (calculatedAge >= 40 && calculatedAge <= 60) setAgeGroup(3);
    else {
        alert("At this time, E-Mitra is optimized for users between ages 12 and 60.");
        return;
    }

    setStep(2); // Move to the questions step
  };

  const submitOnboarding = async (e) => {
    e.preventDefault();
    try {
      // Package the specific clinical data based on their age group
      let clinical_data = {};
      if (ageGroup === 1) {
        clinical_data = {
            school_status: formData.g1_q1, motivation: formData.g1_q2, stress_freq: formData.g1_q3,
            handle_stress: formData.g1_q4, safety_check: formData.g1_q5, current_stressor: formData.g1_q6, recent_upset: formData.g1_q7
        };
      } else if (ageGroup === 2) {
        clinical_data = {
            anxious: formData.g2_q1, depressed: formData.g2_q2, control: formData.g2_q3,
            unusual_beliefs: formData.g2_q4, substances: formData.g2_q5, current_stressor: formData.g2_q6, additional_info: formData.g2_q7
        };
      } else if (ageGroup === 3) {
        clinical_data = {
            depression_12m: formData.g3_q1, lost_interest_12m: formData.g3_q2, worry_freq: formData.g3_q3,
            daily_impact: formData.g3_q4, death_thoughts: formData.g3_q5, current_stressor: formData.g3_q6, additional_info: formData.g3_q7
        };
      }

      const payload = {
        user_id: userId,
        name: formData.name,
        age: age.toString(),
        sleep_quality: formData.sleep_quality,
        feeling_scale: formData.feeling_scale,
        support_system: formData.support_system,
        coping_style: formData.coping_style,
        ...clinical_data
      };

      await fetch(`http://127.0.0.1:8000/api/users`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      setCurrentView('dashboard');
    } catch (err) { alert("Failed to save profile."); }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // --- STEP 1: DATE OF BIRTH ---
  if (step === 1) {
    return (
      <form onSubmit={handleDobSubmit} className="lofi-window" style={{ width: '400px', textAlign: 'center' }}>
        <div className="lofi-title-bar"><span>E-Mitra Intake</span></div>
        <p style={{ color: '#94a3b8', marginBottom: '20px' }}>To personalize your therapy experience, please provide your date of birth.</p>
        <input
            type="date"
            required
            className="lofi-input"
            value={dob}
            onChange={e => setDob(e.target.value)}
            style={{ width: '100%', marginBottom: '20px' }}
        />
        <button type="submit" className="lofi-btn" style={{ width: '100%' }}>CONTINUE</button>
      </form>
    );
  }

  // --- STEP 2: CLINICAL QUESTIONS ---
  return (
    <form onSubmit={submitOnboarding} className="lofi-window" style={{ width: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
      <div className="lofi-title-bar">
        <span>E-Mitra Intake Form (Age: {age})</span>
      </div>

      {/* --- COMMON QUESTIONS --- */}
      <h3 style={{ color: '#a5b4fc' }}>General Information</h3>

      <label className="lofi-label">What should I call you?</label>
      <input required className="lofi-input" value={formData.name} onChange={e => handleChange('name', e.target.value)} />

      <label className="lofi-label">How has your sleep been lately?</label>
      <select className="lofi-input" value={formData.sleep_quality} onChange={e => handleChange('sleep_quality', e.target.value)}>
        <option>Generally fine</option><option>A bit off</option><option>Quite bad</option><option>Very poor</option>
      </select>

      <label className="lofi-label">How have you been feeling over the past few weeks? (1 = Low, 5 = Positive)</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
        <span>1</span>
        <input type="range" min="1" max="5" value={formData.feeling_scale} onChange={e => handleChange('feeling_scale', e.target.value)} style={{ flex: 1 }} />
        <span>5 (Current: {formData.feeling_scale})</span>
      </div>

      <label className="lofi-label">Would you say you have people around you you can openly talk to about how you feel?</label>
      <select className="lofi-input" value={formData.support_system} onChange={e => handleChange('support_system', e.target.value)}>
        <option>Yes</option><option>Sometimes</option><option>Not really</option>
      </select>

      <label className="lofi-label">When you're going through something difficult emotionally, what kind of support do you find most helpful?</label>
      <select className="lofi-input" value={formData.coping_style} onChange={e => handleChange('coping_style', e.target.value)}>
        <option>Just being heard</option><option>Practical advice</option><option>A mix</option><option>Not sure</option>
      </select>

      <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '30px 0' }} />

      {/* --- GROUP 1: AGES 12-19 --- */}
      {ageGroup === 1 && (
        <>
          <h3 style={{ color: '#a5b4fc' }}>Adolescent Questionnaire</h3>

          <label className="lofi-label">How have things been going at school or college lately?</label>
          <select className="lofi-input" value={formData.g1_q1} onChange={e => handleChange('g1_q1', e.target.value)}>
            <option>Going well/Mostly okay</option><option>A little difficult lately</option><option>Quite difficult</option><option>Very difficult</option>
          </select>

          <label className="lofi-label">What do you usually do for fun, and how interested or motivated do you feel to do those things lately?</label>
          <select className="lofi-input" value={formData.g1_q2} onChange={e => handleChange('g1_q2', e.target.value)}>
            <option>I still enjoy them as much as before</option><option>I enjoy them a little less</option><option>I enjoy them much less</option><option>I rarely feel interested in them anymore</option>
          </select>

          <label className="lofi-label">How often have you been feeling stressed, down, very worried, or more irritable than usual recently?</label>
          <select className="lofi-input" value={formData.g1_q3} onChange={e => handleChange('g1_q3', e.target.value)}>
            <option>Almost never</option><option>Sometimes</option><option>Often</option><option>Almost every day</option>
          </select>

          <label className="lofi-label">When something is bothering you, do you usually feel able to handle it, or does it sometimes feel too overwhelming to manage?</label>
          <select className="lofi-input" value={formData.g1_q4} onChange={e => handleChange('g1_q4', e.target.value)}>
            <option>I usually manage it well</option><option>I struggle sometimes</option><option>I often feel overwhelmed</option><option>I almost always feel overwhelmed</option>
          </select>

          <label className="lofi-label">When you feel extremely upset or overwhelmed, have you ever thought about hurting yourself or felt that life was not worth living?</label>
          <select className="lofi-input" value={formData.g1_q5} onChange={e => handleChange('g1_q5', e.target.value)}>
            <option>Never</option><option>Once or twice</option><option>Sometimes</option><option>Often</option><option>I would rather talk about this privately</option>
          </select>

          <label className="lofi-label" style={{ color: '#94a3b8' }}>Optional: Is there anything happening at home, school, or with your friends that has been bothering you lately?</label>
          <textarea rows="2" className="lofi-input" value={formData.g1_q6} onChange={e => handleChange('g1_q6', e.target.value)} />

          <label className="lofi-label" style={{ color: '#94a3b8' }}>Optional: Can you tell me about a time recently when you felt really upset, stressed, angry, or overwhelmed, and what happened?</label>
          <textarea rows="2" className="lofi-input" value={formData.g1_q7} onChange={e => handleChange('g1_q7', e.target.value)} />
        </>
      )}

      {/* --- GROUP 2: AGES 20-39 --- */}
      {ageGroup === 2 && (
        <>
          <h3 style={{ color: '#a5b4fc' }}>Emerging Adulthood Questionnaire</h3>

          <label className="lofi-label">Do you often feel anxious or worried, even when there doesn't seem to be a clear reason?</label>
          <select className="lofi-input" value={formData.g2_q1} onChange={e => handleChange('g2_q1', e.target.value)}>
            <option>Never</option><option>Sometimes</option><option>Often</option><option>Almost always</option>
          </select>

          <label className="lofi-label">Have you recently been feeling more down, sad, hopeless, or less interested in things than you normally would?</label>
          <select className="lofi-input" value={formData.g2_q2} onChange={e => handleChange('g2_q2', e.target.value)}>
            <option>No</option><option>Occasionally</option><option>Quite often</option><option>Almost every day</option>
          </select>

          <label className="lofi-label">Have there been times when your thoughts, feelings, or behaviour have felt difficult to control or have caused problems in your daily life?</label>
          <select className="lofi-input" value={formData.g2_q3} onChange={e => handleChange('g2_q3', e.target.value)}>
            <option>Never</option><option>Occasionally</option><option>Sometimes</option><option>Frequently</option>
          </select>

          <label className="lofi-label">Have you ever experienced things such as hearing or seeing things that others don't, feeling that other people are watching or talking about you, or having unusually intense or unusual beliefs?</label>
          <select className="lofi-input" value={formData.g2_q4} onChange={e => handleChange('g2_q4', e.target.value)}>
            <option>Never</option><option>Once or twice</option><option>Sometimes</option><option>Frequently</option>
          </select>

          <label className="lofi-label">Have you been using alcohol, drugs, or other substances to help you relax, cope, feel better, or deal with difficult emotions?</label>
          <select className="lofi-input" value={formData.g2_q5} onChange={e => handleChange('g2_q5', e.target.value)}>
            <option>Never</option><option>Rarely</option><option>Sometimes</option><option>Often</option>
          </select>

          <label className="lofi-label" style={{ color: '#94a3b8' }}>Optional: What has been the main difficulty or concern in your life recently, and how has it been affecting you?</label>
          <textarea rows="2" className="lofi-input" value={formData.g2_q6} onChange={e => handleChange('g2_q6', e.target.value)} />

          <label className="lofi-label" style={{ color: '#94a3b8' }}>Optional: Is there anything about your thoughts, feelings, relationships, or behaviour that you think is important for me to know?</label>
          <textarea rows="2" className="lofi-input" value={formData.g2_q7} onChange={e => handleChange('g2_q7', e.target.value)} />
        </>
      )}

      {/* --- GROUP 3: AGES 40-60 --- */}
      {ageGroup === 3 && (
        <>
          <h3 style={{ color: '#a5b4fc' }}>Middle Adulthood Questionnaire</h3>

          <label className="lofi-label">During the past 12 months, was there ever a time when you felt sad, blue, or depressed for two weeks or more in a row?</label>
          <select className="lofi-input" value={formData.g3_q1} onChange={e => handleChange('g3_q1', e.target.value)}>
            <option>No</option><option>Yes</option><option>Prefer not to say</option>
          </select>

          <label className="lofi-label">During the past 12 months, was there ever a period lasting two weeks or more when you lost interest in most things you normally enjoy, such as hobbies, work, or other activities?</label>
          <select className="lofi-input" value={formData.g3_q2} onChange={e => handleChange('g3_q2', e.target.value)}>
            <option>No</option><option>Yes</option><option>Prefer not to say</option>
          </select>

          <label className="lofi-label">During the past 12 months, how often was your worry so strong that you found it difficult to put it out of your mind or control it?</label>
          <select className="lofi-input" value={formData.g3_q3} onChange={e => handleChange('g3_q3', e.target.value)}>
            <option>Never</option><option>Rarely</option><option>Sometimes</option><option>Often</option>
          </select>

          <label className="lofi-label">During the past 30 days, how much have your mental or emotional difficulties affected your ability to work or carry out your usual daily activities?</label>
          <select className="lofi-input" value={formData.g3_q4} onChange={e => handleChange('g3_q4', e.target.value)}>
            <option>Not at all</option><option>A little</option><option>Somewhat</option><option>A lot</option><option>Completely</option>
          </select>

          <label className="lofi-label">During a period when you were feeling particularly low or distressed, did you ever think a lot about death, including your own death?</label>
          <select className="lofi-input" value={formData.g3_q5} onChange={e => handleChange('g3_q5', e.target.value)}>
            <option>Never</option><option>Once or twice</option><option>Sometimes</option><option>Often</option><option>Prefer not to say</option>
          </select>

          <label className="lofi-label" style={{ color: '#94a3b8' }}>Optional: Is there anything happening in your life right now that has been causing you significant emotional stress or affecting your well-being?</label>
          <textarea rows="2" className="lofi-input" value={formData.g3_q6} onChange={e => handleChange('g3_q6', e.target.value)} />

          <label className="lofi-label" style={{ color: '#94a3b8' }}>Optional: Is there anything about your mental or emotional well-being that you feel these questions have not captured?</label>
          <textarea rows="2" className="lofi-input" value={formData.g3_q7} onChange={e => handleChange('g3_q7', e.target.value)} />
        </>
      )}

      <button type="submit" className="lofi-btn" style={{ width: '100%', marginTop: '20px' }}>SAVE PROFILE & START THERAPY</button>
    </form>
  );
}

export default Onboarding;