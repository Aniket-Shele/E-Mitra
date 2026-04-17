import os
import cv2
import base64
import json
import requests
from moviepy import VideoFileClip
import warnings
warnings.filterwarnings("ignore")

# 1. THE RAVDESS SECRET CODE MAPPING
EMOTION_MAP = {
    "01": "neutral",
    "02": "neutral",      
    "03": "happy",
    "04": "sad",
    "05": "angry",
    "06": "anxious_fear", 
    "07": "angry",        
    "08": "anxious_fear"  
}

test_dir = "ravdess_test"
url = "http://127.0.0.1:8000/analyze-multimodal"

correct = 0 
total = 0

print("🚀 Starting E-Mitra Automated Evaluation Pipeline (Diagnostic Mode)...")
print("-" * 110)

for filename in os.listdir(test_dir):
    if not filename.endswith(".mp4"): continue

    # Parse the Ground Truth
    parts = filename.split('-')
    if len(parts) < 3: continue
    emotion_code = parts[2]
    true_emotion = EMOTION_MAP.get(emotion_code)

    if not true_emotion: continue

    filepath = os.path.join(test_dir, filename)

    # 1. Simulate React: Extract Audio
    temp_audio = f"temp_{filename}.wav"
    try:
        clip = VideoFileClip(filepath)
        clip.audio.write_audiofile(temp_audio, logger=None)
    except Exception as e:
        continue 

    # 2. Simulate React: Extract 5 Video Frames
    cap = cv2.VideoCapture(filepath)
    frames_b64 = []
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    if total_frames > 0:
        for i in range(1, 6):
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(total_frames * (i / 6)))
            ret, frame = cap.read()
            if ret:
                _, buffer = cv2.imencode('.jpg', frame)
                b64_str = "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')
                frames_b64.append(b64_str)
    cap.release()

    # 3. Send to FastAPI Backend
    if os.path.exists(temp_audio):
        with open(temp_audio, "rb") as f:
            files = {"audio": (temp_audio, f, "audio/wav")}
            data = {
                "text": "", 
                "images_base64": json.dumps(frames_b64),
                "text_model": "v2",
                "audio_model_choice": "v1",
                "video_model_choice": "v2"
            }
            
            try:
                response = requests.post(url, data=data, files=files)
                res_json = response.json()
            except Exception as e:
                print(f"Failed to connect to backend for {filename}")
                continue
                
        # Cleanup temp audio
        os.remove(temp_audio)

        # 4. Grade the AI & PEEK UNDER THE HOOD
        if res_json and res_json.get("fused_score"):
            pred_emotion = res_json["fused_score"][0]["label"]
            
            # Extract raw standalone predictions
            raw_audio = res_json["audio_emotions"][0]["label"] if res_json.get("audio_emotions") else "none"
            raw_video = res_json["video_emotions"][0]["label"] if res_json.get("video_emotions") else "none"
            
            is_match = (pred_emotion == true_emotion)
            if is_match: correct += 1
            total += 1
            
            icon = "✅" if is_match else "❌"
            print(f"File: {filename} | True: {true_emotion.ljust(12).upper()} | Fused: {pred_emotion.ljust(12).upper()} | Audio: {raw_audio.ljust(10).upper()} | Video: {raw_video.ljust(10).upper()} | {icon}")

print("-" * 110)
print(f"📊 DIAGNOSTIC EVALUATION COMPLETE")
print(f"Total Videos Tested: {total}")
print(f"Total Correct:       {correct}")
if total > 0:
    print(f"Overall Accuracy:    {(correct/total)*100:.2f}%")