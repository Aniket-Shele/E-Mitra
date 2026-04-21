# main.py
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import pipeline
import os
import ssl                                                               
ssl._create_default_https_context = ssl._create_unverified_context       
import json
import base64
import cv2
import numpy as np
from io import BytesIO
from PIL import Image
from moviepy import AudioFileClip
from emotiefflib.facial_analysis import EmotiEffLibRecognizer
import warnings
from transformers import logging as hf_logging

# 🚨 IMPORT OUR NEW COGNITIVE ENGINE
from cognitive_engine import (
    check_user_exists, 
    create_user_profile, 
    extract_profile_data, 
    generate_chat_response
)

warnings.filterwarnings("ignore")
hf_logging.set_verbosity_error()

app = FastAPI()
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

# --- 1. LOAD AI MODELS ---
print("Loading Text Models...")
text_v1 = pipeline("text-classification", model="cardiffnlp/twitter-roberta-base-emotion", top_k=None)
text_v2 = pipeline("text-classification", model="j-hartmann/emotion-english-distilroberta-base", top_k=None)

print("Loading Audio Models...")
audio_v1 = pipeline("audio-classification", model="superb/wav2vec2-base-superb-er") 
audio_v2 = pipeline("audio-classification", model="ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition") 
asr_model = pipeline("automatic-speech-recognition", model="openai/whisper-tiny.en")

print("Loading Video Models...")
video_v1 = pipeline("image-classification", model="dima806/facial_emotions_image_detection") 
video_v2_model = EmotiEffLibRecognizer(model_name='enet_b0_8_best_vgaf', device='cpu')
video_v2_labels = ['anger', 'contempt', 'disgust', 'fear', 'happiness', 'neutral', 'sadness', 'surprise']

print("Loading OpenCV Face Detector...")
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
print("System Online!")

# --- PIPELINE FUNCTIONS ---
def normalize_emotions(raw_scores, modality):
    normalized = {"happy": 0.0, "sad": 0.0, "angry": 0.0, "neutral": 0.0, "anxious_fear": 0.0}
    TEXT_MAP = {"joy": "happy", "sadness": "sad", "anger": "angry", "disgust": "angry", "neutral": "neutral", "fear": "anxious_fear", "surprise": "anxious_fear"}
    AUDIO_MAP = {"happy": "happy", "hap": "happy", "sad": "sad", "angry": "angry", "ang": "angry", "neutral": "neutral", "neu": "neutral", "fearful": "anxious_fear", "fea": "anxious_fear", "surprised": "anxious_fear", "disgust": "angry", "dis": "angry"}
    VIDEO_MAP = {"happiness": "happy", "happy": "happy", "sadness": "sad", "sad": "sad", "anger": "angry", "angry": "angry", "contempt": "angry", "disgust": "anxious_fear", "neutral": "neutral", "fear": "anxious_fear", "surprise": "anxious_fear"}
    
    DAMPEN_LABELS = {"contempt", "disgust"}
    BOOST_LABELS = {"sadness": 1.5, "fear": 1.5, "surprise": 1.2, "anger": 1.2, "happiness": 1.0}
    mapping = TEXT_MAP if modality == "text" else AUDIO_MAP if modality == "audio" else VIDEO_MAP

    if not raw_scores: return []
    for item in raw_scores:
        raw_label = item["label"].lower()
        score = item["score"]
        if modality == "audio" and raw_label in ("calm", "cal"):
            normalized["neutral"] += score * 0.4
            normalized["sad"]     += score * 0.6
            continue
        if modality == "video":
            if raw_label in DAMPEN_LABELS: score *= 0.5
            if raw_label in BOOST_LABELS: score *= BOOST_LABELS[raw_label]
        if raw_label in mapping:
            normalized[mapping[raw_label]] += score

    total = sum(normalized.values())
    if total > 0:
        for k in normalized: normalized[k] /= total
    return sorted([{"label": k, "score": v} for k, v in normalized.items()], key=lambda x: x["score"], reverse=True)

def video_v2_pipeline(img_pil):
    try:
        img_arr = np.array(img_pil.convert("RGB"))
        _, scores = video_v2_model.predict_emotions(img_arr, logits=False)
        if hasattr(scores, 'shape') and len(scores.shape) > 1: scores = scores[0]
        return [{"label": video_v2_labels[i], "score": float(scores[i])} for i in range(8)]
    except Exception as e: return []

def crop_face(img_pil):
    img_cv = cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(40, 40))
    if len(faces) > 0:
        x, y, w, h = max(faces, key=lambda r: r[2] * r[3]) 
        mx, my = int(w * 0.2), int(h * 0.2)
        x1, y1 = max(0, x - mx), max(0, y - my)
        x2, y2 = min(img_cv.shape[1], x + w + mx), min(img_cv.shape[0], y + h + my)
        cropped_cv = img_cv[y1:y2, x1:x2]
        return Image.fromarray(cv2.cvtColor(cropped_cv, cv2.COLOR_BGR2RGB))
    return img_pil 

def perform_late_fusion(text_scores, audio_scores, video_scores):
    fused_state = {"happy": 0.0, "sad": 0.0, "angry": 0.0, "neutral": 0.0, "anxious_fear": 0.0}
    if text_scores:
        for item in text_scores: fused_state[item["label"]] += item["score"] * 0.40
    if audio_scores:
        for item in audio_scores: fused_state[item["label"]] += item["score"] * 0.30
    if video_scores:
        for item in video_scores: fused_state[item["label"]] += item["score"] * 0.30
    total = sum(fused_state.values())
    if total > 0:
        for k in fused_state: fused_state[k] /= total
    return sorted([{"label": k, "score": v} for k, v in fused_state.items()], key=lambda x: x['score'], reverse=True)

def determine_strategy(fused_scores):
    if not fused_scores: return {"name": "Standby", "description": "Awaiting telemetry."}
    dominant = fused_scores[0]['label']
    if dominant == "anxious_fear": return {"name": "Cognitive Care", "description": "Focus on logical reassurance."}
    elif dominant == "sad": return {"name": "Reminiscence Therapy", "description": "Anchor to positive memories."}
    elif dominant == "angry": return {"name": "De-escalation", "description": "Provide a safe space to vent."}
    elif dominant == "happy": return {"name": "Positive Reinforcement", "description": "Mirror the joy."}
    else: return {"name": "Active Probing", "description": "Ask open-ended questions."}


# --- API ENDPOINTS (ROUTING TO COGNITIVE ENGINE) ---
class UserProfile(BaseModel):
    user_id: str
    name: str
    age: str
    occupation: str
    living_situation: str
    baseline_personality: str
    primary_goal: str
    coping_mechanisms: str
    support_system: str
    triggers: str

@app.get("/api/users/{user_id}")
async def check_user(user_id: str):
    """Checks if a user profile already exists in MongoDB."""
    return check_user_exists(user_id)

@app.post("/api/users")
async def create_user(profile: UserProfile):
    """Saves a new user's clinical intake form to Permanent Memory."""
    profile_data = profile.dict()
    user_id = profile_data.pop("user_id") 
    create_user_profile(user_id, profile_data)
    return {"status": "success", "message": "Clinical Profile Saved"}

@app.post("/analyze-multimodal")
async def analyze_multimodal(
    text: str = Form(""), 
    audio: UploadFile = File(None), 
    images_base64: str = Form("[]"),
    text_model: str = Form("v2"),
    audio_model_choice: str = Form("v1"), 
    video_model_choice: str = Form("v2")
):
    results = {"text_emotions": [], "audio_emotions": [], "video_emotions": [], "frame_emotions": [], "transcribed_text": "", "fused_score": [], "strategy": {}}
    final_text_to_analyze = text.strip()
    
    if audio:
        temp_file_path = f"temp_{audio.filename}"
        wav_file_path = f"converted_{audio.filename}.wav" 
        with open(temp_file_path, "wb") as f: f.write(await audio.read())
        try:
            audio_clip = AudioFileClip(temp_file_path)
            audio_clip.write_audiofile(wav_file_path, fps=16000, codec='pcm_s16le', ffmpeg_params=["-ac", "1"], logger=None)
            audio_clip.close()
            raw_audio = audio_v2(wav_file_path) if audio_model_choice == "v2" else audio_v1(wav_file_path)
            results["audio_emotions"] = normalize_emotions(raw_audio, "audio")
            transcription = asr_model(wav_file_path)
            results["transcribed_text"] = transcription["text"].strip()
            if not final_text_to_analyze: final_text_to_analyze = results["transcribed_text"]
        except Exception as e: print(f"Audio error: {e}")
        finally:
            if os.path.exists(temp_file_path): os.remove(temp_file_path)
            if os.path.exists(wav_file_path): os.remove(wav_file_path)
                
    if final_text_to_analyze:
        raw_text = text_v2(final_text_to_analyze)[0] if text_model == "v2" else text_v1(final_text_to_analyze)[0]
        results["text_emotions"] = normalize_emotions(raw_text, "text")

    if images_base64:
        try:
            frames = json.loads(images_base64)
            all_frame_scores = []
            for b64 in frames:
                header, encoded = b64.split(",", 1)
                img = Image.open(BytesIO(base64.b64decode(encoded)))
                img_cropped = crop_face(img)
                preds = video_v2_pipeline(img_cropped) if video_model_choice == "v2" else video_v1(img_cropped)
                if preds: 
                    all_frame_scores.append(preds)
                    norm_frame = normalize_emotions(preds, "video")
                    results["frame_emotions"].append(norm_frame[0]['label'].upper() if norm_frame else "NO FACE")
                else:
                    results["frame_emotions"].append("NO FACE")
            
            if all_frame_scores:
                avg_scores = {}
                for fp in all_frame_scores:
                    for p in fp: avg_scores[p['label']] = avg_scores.get(p['label'], 0) + p['score']
                num_frames = len(all_frame_scores)
                raw_video = sorted([{"label": k, "score": v / num_frames} for k, v in avg_scores.items()], key=lambda x: x['score'], reverse=True)
                results["video_emotions"] = normalize_emotions(raw_video, "video")
        except Exception as e: print(e)
    
    results["fused_score"] = perform_late_fusion(results["text_emotions"], results["audio_emotions"], results["video_emotions"])
    results["strategy"] = determine_strategy(results["fused_score"])
    return results

class ChatRequest(BaseModel):
    user_id: str 
    user_message: str
    emotion_state: str
    clinical_strategy: str
    emotion_journey: list = []
    chat_history: list = []

@app.post("/chat")
async def chat_endpoint(request: ChatRequest, background_tasks: BackgroundTasks):
    """Routes the chat request to the Cognitive Engine for LLM processing."""
    
    result = generate_chat_response(
        user_id=request.user_id,
        user_message=request.user_message,
        emotion_state=request.emotion_state,
        clinical_strategy=request.clinical_strategy,
        emotion_journey=request.emotion_journey,
        chat_history=request.chat_history
    )
    
    # Run background note-taker via the cognitive engine
    background_tasks.add_task(extract_profile_data, request.user_id, request.user_message)
    
    return result