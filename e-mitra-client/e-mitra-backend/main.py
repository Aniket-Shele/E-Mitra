from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from transformers import pipeline
import os
import base64
from io import BytesIO
from PIL import Image

app = FastAPI()

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

print("Loading Text Models...")
twitter_model = pipeline("text-classification", model="cardiffnlp/twitter-roberta-base-emotion", top_k=None)
hartmann_model = pipeline("text-classification", model="j-hartmann/emotion-english-distilroberta-base", top_k=None)

print("Loading Audio & ASR Models...")
audio_model = pipeline("audio-classification", model="superb/wav2vec2-base-superb-er")
asr_model = pipeline("automatic-speech-recognition", model="openai/whisper-tiny.en")

print("Loading Vision Model...")
vision_model = pipeline("image-classification", model="dima806/facial_emotions_image_detection")

print("All Models Loaded Successfully!")

# --- NEW: THE LATE FUSION ALGORITHM ---
def perform_late_fusion(text_scores, audio_scores, video_scores):
    # 1. Define our universal emotion categories
    fused_state = {"happy": 0.0, "sad": 0.0, "angry": 0.0, "neutral": 0.0, "anxious_fear": 0.0}
    
    # 2. Extract values safely (defaulting to 0 if a modality is missing)
    def get_score(scores_list, target_labels):
        if not scores_list: return 0.0
        for item in scores_list:
            if item['label'].lower() in target_labels: return item['score']
        return 0.0

    # 3. Text Weights (40%)
    if text_scores:
        fused_state["happy"] += get_score(text_scores, ["joy"]) * 0.40
        fused_state["sad"] += get_score(text_scores, ["sadness"]) * 0.40
        fused_state["angry"] += get_score(text_scores, ["anger", "disgust"]) * 0.40
        fused_state["neutral"] += get_score(text_scores, ["neutral"]) * 0.40
        fused_state["anxious_fear"] += get_score(text_scores, ["fear", "surprise"]) * 0.40

    # 4. Audio Weights (30%)
    if audio_scores:
        fused_state["happy"] += get_score(audio_scores, ["hap"]) * 0.30
        fused_state["sad"] += get_score(audio_scores, ["sad"]) * 0.30
        fused_state["angry"] += get_score(audio_scores, ["ang"]) * 0.30
        fused_state["neutral"] += get_score(audio_scores, ["neu"]) * 0.30
        # Wav2Vec doesn't have explicit fear, so we map high-energy negative tone slightly to anxiety if needed, but we'll keep it simple for now.

    # 5. Video Weights (30%)
    if video_scores:
        fused_state["happy"] += get_score(video_scores, ["happy"]) * 0.30
        fused_state["sad"] += get_score(video_scores, ["sad"]) * 0.30
        fused_state["angry"] += get_score(video_scores, ["angry", "disgust"]) * 0.30
        fused_state["neutral"] += get_score(video_scores, ["neutral"]) * 0.30
        fused_state["anxious_fear"] += get_score(video_scores, ["fear", "surprise"]) * 0.30

    # 6. Normalize so everything adds up to 100% nicely
    total = sum(fused_state.values())
    if total > 0:
        for k in fused_state:
            fused_state[k] = (fused_state[k] / total)
            
    # Sort to find the dominant emotion easily
    sorted_fused = sorted([{"label": k, "score": v} for k, v in fused_state.items()], key=lambda x: x['score'], reverse=True)
    return sorted_fused

@app.post("/analyze-multimodal")
async def analyze_multimodal(text: str = Form(""), audio: UploadFile = File(None), image_base64: str = Form("")):
    results = {"text_emotions": {}, "audio_emotions": [], "video_emotions": [], "transcribed_text": "", "fused_score": []}
    
    final_text_to_analyze = text.strip()
    
    if audio:
        temp_file_path = f"temp_{audio.filename}"
        with open(temp_file_path, "wb") as f:
            f.write(await audio.read())
        try:
            results["audio_emotions"] = audio_model(temp_file_path)
            transcription = asr_model(temp_file_path)
            results["transcribed_text"] = transcription["text"].strip()
            if not final_text_to_analyze: final_text_to_analyze = results["transcribed_text"]
        except Exception as e: print(e)
        finally:
            if os.path.exists(temp_file_path): os.remove(temp_file_path)
                
    if final_text_to_analyze:
        results["text_emotions"]["twitter"] = twitter_model(final_text_to_analyze)[0]
        results["text_emotions"]["hartmann"] = hartmann_model(final_text_to_analyze)[0]

    if image_base64:
        try:
            header, encoded = image_base64.split(",", 1)
            image_data = base64.b64decode(encoded)
            img = Image.open(BytesIO(image_data))
            results["video_emotions"] = vision_model(img)
        except Exception as e: print(e)
    
    # NEW: Run the Fusion Engine before returning!
    active_text = results["text_emotions"].get("hartmann", [])
    results["fused_score"] = perform_late_fusion(active_text, results["audio_emotions"], results["video_emotions"])
                
    return results