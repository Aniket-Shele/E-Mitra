from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import pipeline
import ollama
import os
import base64
import json
import cv2
import numpy as np
from io import BytesIO
from PIL import Image
from moviepy import AudioFileClip  # Required for the 16kHz WAV conversion fix

app = FastAPI()

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

# --- 1. TEXT MODELS ---
print("Loading Text Models...")
text_v1 = pipeline("text-classification", model="cardiffnlp/twitter-roberta-base-emotion", top_k=None)
text_v2 = pipeline("text-classification", model="j-hartmann/emotion-english-distilroberta-base", top_k=None)

# --- 2. AUDIO MODELS ---
print("Loading Audio Models...")
audio_v1 = pipeline("audio-classification", model="superb/wav2vec2-base-superb-er") # V1 (More flexible but less accurate)
audio_v2 = pipeline("audio-classification", model="ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition") # V2 RAVDESS
asr_model = pipeline("automatic-speech-recognition", model="openai/whisper-tiny.en")

# --- 3. VIDEO MODELS ---
print("Loading Video Models...")
video_v1 = pipeline("image-classification", model="dima806/facial_emotions_image_detection") # Basic FER
video_v2 = pipeline("image-classification", model="motheecreator/vit-Facial-Expression-Recognition") # AffectNet

# --- 4. OPENCV FACE DETECTOR ---
print("Loading OpenCV Face Detector...")
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

print("All Models Loaded Successfully!")

# --- FACE CROPPING LOGIC ---
def crop_face(img_pil):
    """Detects a face and crops it with a 20% margin. Returns original if no face is found."""
    img_cv = cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
    
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    
    if len(faces) > 0:
        x, y, w, h = max(faces, key=lambda rect: rect[2] * rect[3]) 
        margin_x, margin_y = int(w * 0.2), int(h * 0.2)
        x1, y1 = max(0, x - margin_x), max(0, y - margin_y)
        x2, y2 = min(img_cv.shape[1], x + w + margin_x), min(img_cv.shape[0], y + h + margin_y)
        
        cropped_cv = img_cv[y1:y2, x1:x2]
        return Image.fromarray(cv2.cvtColor(cropped_cv, cv2.COLOR_BGR2RGB))
    
    return img_pil 

# --- MEMORY & DIARY LOGIC ---
DIARY_FILE = "therapist_diary.json"

def load_diary():
    if not os.path.exists(DIARY_FILE):
        with open(DIARY_FILE, "w") as f: json.dump({"known_facts": []}, f)
    with open(DIARY_FILE, "r") as f: return json.load(f)

def save_to_diary(new_fact):
    diary = load_diary()
    if new_fact not in diary["known_facts"]:
        diary["known_facts"].append(new_fact)
        with open(DIARY_FILE, "w") as f: json.dump(diary, f, indent=4)
        print(f"📝 Therapist Note Taken: {new_fact}")

def extract_profile_data(user_message: str):
    extraction_prompt = f"""
    You are a silent psychological note-taker. Analyze this user's message: "{user_message}"
    Does the user explicitly state their name, a personal preference, a relationship, a current stressor, or a goal?
    If YES, summarize the core fact in a single, short bullet point. If NO, output exactly the word "NONE".
    """
    try:
        response = ollama.chat(model='llama3.1', messages=[{'role': 'user', 'content': extraction_prompt}])
        fact = response['message']['content'].strip()
        if fact.upper() != "NONE" and len(fact) > 5: save_to_diary(fact)
    except Exception as e: print(f"Note-taker error: {e}")

# --- FUSION & STRATEGY LOGIC ---
def perform_late_fusion(text_scores, audio_scores, video_scores):
    fused_state = {"happy": 0.0, "sad": 0.0, "angry": 0.0, "neutral": 0.0, "anxious_fear": 0.0}
    
    def get_score(scores_list, target_labels):
        if not scores_list: return 0.0
        for item in scores_list:
            if item['label'].lower() in target_labels: return item['score']
        return 0.0

    if text_scores:
        fused_state["happy"] += get_score(text_scores, ["joy"]) * 0.40
        fused_state["sad"] += get_score(text_scores, ["sadness"]) * 0.40
        fused_state["angry"] += get_score(text_scores, ["anger", "disgust"]) * 0.40
        fused_state["neutral"] += get_score(text_scores, ["neutral"]) * 0.40
        fused_state["anxious_fear"] += get_score(text_scores, ["fear", "surprise"]) * 0.40

    if audio_scores:
        fused_state["happy"] += get_score(audio_scores, ["hap", "happy"]) * 0.30
        fused_state["sad"] += get_score(audio_scores, ["sad"]) * 0.30
        fused_state["angry"] += get_score(audio_scores, ["ang", "angry", "disgust"]) * 0.30
        fused_state["neutral"] += get_score(audio_scores, ["neu", "neutral", "calm"]) * 0.30
        fused_state["anxious_fear"] += get_score(audio_scores, ["fearful", "surprised"]) * 0.30

    if video_scores:
        fused_state["happy"] += get_score(video_scores, ["happy"]) * 0.30
        fused_state["sad"] += get_score(video_scores, ["sad"]) * 0.30
        fused_state["angry"] += get_score(video_scores, ["angry", "disgust"]) * 0.30
        fused_state["neutral"] += get_score(video_scores, ["neutral"]) * 0.30
        fused_state["anxious_fear"] += get_score(video_scores, ["fear", "surprise"]) * 0.30

    total = sum(fused_state.values())
    if total > 0:
        for k in fused_state: fused_state[k] = (fused_state[k] / total)
            
    return sorted([{"label": k, "score": v} for k, v in fused_state.items()], key=lambda x: x['score'], reverse=True)

def determine_strategy(fused_scores):
    if not fused_scores: return {"name": "Standby", "description": "Awaiting telemetry."}
    dominant = fused_scores[0]['label']
    if dominant == "anxious_fear": return {"name": "Cognitive Care", "description": "Focus on logical reassurance."}
    elif dominant == "sad": return {"name": "Reminiscence Therapy", "description": "Anchor to positive memories."}
    elif dominant == "angry": return {"name": "De-escalation", "description": "Provide a safe space to vent."}
    elif dominant == "happy": return {"name": "Positive Reinforcement", "description": "Mirror the joy."}
    else: return {"name": "Active Probing", "description": "Ask open-ended questions."}

# --- API ENDPOINTS ---
@app.post("/analyze-multimodal")
async def analyze_multimodal(
    text: str = Form(""), 
    audio: UploadFile = File(None), 
    images_base64: str = Form("[]"),
    text_model: str = Form("v2"),
    audio_model_choice: str = Form("v2"),
    video_model_choice: str = Form("v2")
):
    results = {"text_emotions": [], "audio_emotions": [], "video_emotions": [], "transcribed_text": "", "fused_score": [], "strategy": {}}
    final_text_to_analyze = text.strip()
    
    # --- FIXED: AUDIO PROCESSING & CONVERSION ---
    if audio:
        temp_file_path = f"temp_{audio.filename}"
        wav_file_path = f"converted_{audio.filename}.wav" 
        
        with open(temp_file_path, "wb") as f: f.write(await audio.read())
        try:
            # 🚨 FORCE CONVERSION TO 16kHz MONO WAV SO V2 RAVDESS DOES NOT FLATLINE
            audio_clip = AudioFileClip(temp_file_path)
            audio_clip.write_audiofile(
                wav_file_path, 
                fps=16000,                  # Force 16,000 Hz sample rate
                codec='pcm_s16le',          # Standard 16-bit WAV codec
                ffmpeg_params=["-ac", "1"], # Force Mono (1 channel)
                logger=None
            )
            audio_clip.close()
            
            # Send the clean 16kHz WAV file to the models
            results["audio_emotions"] = audio_v2(wav_file_path) if audio_model_choice == "v2" else audio_v1(wav_file_path)
            transcription = asr_model(wav_file_path)
            results["transcribed_text"] = transcription["text"].strip()
            
            if not final_text_to_analyze: final_text_to_analyze = results["transcribed_text"]
        except Exception as e: 
            print(f"Audio processing error: {e}")
        finally:
            if os.path.exists(temp_file_path): os.remove(temp_file_path)
            if os.path.exists(wav_file_path): os.remove(wav_file_path)
                
    # Process Text
    if final_text_to_analyze:
        results["text_emotions"] = text_v2(final_text_to_analyze)[0] if text_model == "v2" else text_v1(final_text_to_analyze)[0]

    # Process Video (WITH FACE CROPPING)
    if images_base64:
        try:
            frames = json.loads(images_base64)
            all_frame_scores = []
            vision_pipe = video_v2 if video_model_choice == "v2" else video_v1
            
            for b64 in frames:
                header, encoded = b64.split(",", 1)
                img = Image.open(BytesIO(base64.b64decode(encoded)))
                
                # Apply OpenCV cropping before passing to the AI
                img_cropped = crop_face(img)
                all_frame_scores.append(vision_pipe(img_cropped))
            
            if all_frame_scores:
                avg_scores = {}
                for frame_preds in all_frame_scores:
                    for p in frame_preds: avg_scores[p['label']] = avg_scores.get(p['label'], 0) + p['score']
                num_frames = len(all_frame_scores)
                results["video_emotions"] = sorted([{"label": k, "score": v / num_frames} for k, v in avg_scores.items()], key=lambda x: x['score'], reverse=True)
        except Exception as e: print(e)
    
    # Run Fusion
    results["fused_score"] = perform_late_fusion(results["text_emotions"], results["audio_emotions"], results["video_emotions"])
    results["strategy"] = determine_strategy(results["fused_score"])
                
    return results

class ChatRequest(BaseModel):
    user_message: str
    emotion_state: str
    clinical_strategy: str

@app.post("/chat")
async def generate_chat_response(request: ChatRequest, background_tasks: BackgroundTasks):
    diary = load_diary()
    known_facts_str = "\n".join([f"- {fact}" for fact in diary["known_facts"]])
    if not known_facts_str: known_facts_str = "No prior notes recorded yet."

    system_prompt = f"""
    You are E-Mitra, an empathetic, highly intelligent AI companion. 
    Keep your responses natural, conversational, and concise (under 3 sentences). Do not sound like a robot.
    
    --- TELEMETRY DATA ---
    Current User Emotion: {request.emotion_state}
    Clinical Strategy to Apply: {request.clinical_strategy}
    
    --- THERAPIST'S DIARY (What you know about this user) ---
    {known_facts_str}
    ----------------------
    Respond directly to the user's message below, utilizing the strategy and context provided.
    """
    try:
        response = ollama.chat(model='llama3.1', messages=[
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': request.user_message}
        ])
        ai_reply = response['message']['content']
        background_tasks.add_task(extract_profile_data, request.user_message)
        return {"reply": ai_reply, "diary_context_used": diary["known_facts"]}
    except Exception as e:
        print(f"Ollama Error: {e}")
        return {"reply": "I'm having trouble connecting to my cognitive core (Ollama). Make sure Llama 3.1 is running!", "diary_context_used": []}