import os
import cv2
import numpy as np
import warnings
from PIL import Image
from transformers import pipeline
from moviepy import VideoFileClip
from emotiefflib.facial_analysis import EmotiEffLibRecognizer
from transformers import logging as hf_logging

warnings.filterwarnings("ignore")
hf_logging.set_verbosity_error()

print("\n🚀 E-Mitra Evaluation Pipeline (Diagnostic Build)\n")

print("Loading Audio Model (V1 - Superb)...")
asr_model = pipeline("automatic-speech-recognition", model="openai/whisper-tiny.en")
audio_model = pipeline("audio-classification", model="superb/wav2vec2-base-superb-er")

print("Loading Video Model (V2 - EmotiEffLib enet_b0_8_best_vgaf)...")
video_model = EmotiEffLibRecognizer(model_name='enet_b0_8_best_vgaf', device='cpu')
video_labels = ['anger', 'contempt', 'disgust', 'fear', 'happiness', 'neutral', 'sadness', 'surprise']

print("Loading OpenCV Face Cropper...")
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

def normalize_emotions(raw_scores, modality):
    normalized = {"happy": 0.0, "sad": 0.0, "angry": 0.0, "neutral": 0.0, "anxious_fear": 0.0}

    AUDIO_MAP = {
        "happy": "happy", "hap": "happy",
        "sad": "sad",
        "angry": "angry", "ang": "angry",
        "neutral": "neutral", "neu": "neutral",
        "fearful": "anxious_fear", "fea": "anxious_fear",
        "surprised": "anxious_fear",
        "disgust": "angry", "dis": "angry"
    }

    VIDEO_MAP = {
        "happiness": "happy",
        "sadness": "sad",
        "anger": "angry",
        "contempt": "angry",  
        "disgust": "anxious_fear",  
        "neutral": "neutral",
        "fear": "anxious_fear",
        "surprise": "anxious_fear"
    }

    DAMPEN_LABELS = {"contempt", "disgust"}
    # SYNCED: Lowered multipliers to match the live app fix
    BOOST_LABELS = {"sadness": 1.5, "fear": 1.5, "surprise": 1.2, "anger": 1.2, "happiness": 1.0}

    mapping = AUDIO_MAP if modality == "audio" else VIDEO_MAP

    if not raw_scores:
        return []

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
        for k in normalized:
            normalized[k] /= total

    return sorted([{"label": k, "score": v} for k, v in normalized.items()], key=lambda x: x["score"], reverse=True)

def crop_face(img_pil):
    img_cv = cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(40, 40))
    if len(faces) > 0:
        x, y, w, h = max(faces, key=lambda r: r[2] * r[3])
        if w * h < 900:  
            return None
        mx, my = int(w * 0.2), int(h * 0.2)
        x1, y1 = max(0, x - mx), max(0, y - my)
        x2, y2 = min(img_cv.shape[1], x + w + mx), min(img_cv.shape[0], y + h + my)
        cropped = img_cv[y1:y2, x1:x2]
        return Image.fromarray(cv2.cvtColor(cropped, cv2.COLOR_BGR2RGB))
    return None  

def video_pipeline(img_pil):
    try:
        img_arr = np.array(img_pil.convert("RGB"))
        _, scores = video_model.predict_emotions(img_arr, logits=False)
        if hasattr(scores, 'shape') and len(scores.shape) > 1:
            scores = scores[0]
        return [{"label": video_labels[i], "score": float(scores[i])} for i in range(8)]
    except Exception as e:
        return []

def perform_late_fusion(audio_scores, video_scores):
    fused = {"happy": 0.0, "sad": 0.0, "angry": 0.0, "neutral": 0.0, "anxious_fear": 0.0}
    for item in audio_scores:
        if item["label"] in ("happy", "angry"):
            fused[item["label"]] += item["score"] * 0.15
    for item in video_scores: fused[item["label"]] += item["score"] * 1.0
    total = sum(fused.values())
    if total > 0:
        for k in fused: fused[k] /= total
    return sorted([{"label": k, "score": v} for k, v in fused.items()], key=lambda x: x["score"], reverse=True)

RAVDESS_MAP = {
    "01": "NEUTRAL",
    "02": "NEUTRAL",   
    "03": "HAPPY",
    "04": "SAD",
    "05": "ANGRY",
    "06": "ANXIOUS_FEAR",
}

test_dir = "ravdess_test"
if not os.path.exists(test_dir):
    os.makedirs(test_dir)
    print(f"\n❌ Created '{test_dir}' folder. Place .mp4 files inside and run again.\n")
    exit()

videos = sorted([v for v in os.listdir(test_dir) if v.endswith(".mp4")])
if not videos:
    print(f"\n❌ No .mp4 files in '{test_dir}'.\n")
    exit()

print(f"\n{'='*110}")
print(f"{'File':<25} {'True':<14} {'Fused':<14} {'Audio':<14} {'Video':<14} {'A-correct':<12} {'V-correct':<12} {'Result'}")
print(f"{'='*110}")

total = correct_fused = correct_audio = correct_video = 0

from collections import defaultdict
class_total = defaultdict(int)
class_correct = defaultdict(int)
audio_confusion = defaultdict(int)
video_confusion = defaultdict(int)

for video_name in videos:
    parts = video_name.split("-")
    if len(parts) < 3:
        continue

    emotion_code = parts[2]
    if emotion_code in ["07", "08"]:
        continue
    true_emotion = RAVDESS_MAP.get(emotion_code, "UNKNOWN")
    if true_emotion == "UNKNOWN":
        continue

    total += 1
    video_path = os.path.join(test_dir, video_name)
    wav_path = os.path.join(test_dir, "temp_eval.wav")

    audio_scores = []
    try:
        clip = VideoFileClip(video_path)
        clip.audio.write_audiofile(wav_path, fps=16000, codec='pcm_s16le',
                                   ffmpeg_params=["-ac", "1"], logger=None)
        raw_audio = audio_model(wav_path)
        if true_emotion in ("SAD", "ANXIOUS_FEAR"):
            print(f"  [RAW AUDIO] {video_name} (true={true_emotion}): {[(x['label'], round(x['score'],3)) for x in raw_audio]}")
        audio_scores = normalize_emotions(raw_audio, "audio")
    except Exception as e:
        print(f"  [Audio Error] {video_name}: {e}")

    video_scores = []
    all_frame_scores = []
    try:
        duration = clip.duration
        start_t = max(0.3, duration * 0.15)
        end_t   = min(duration - 0.3, duration * 0.85)
        timestamps = np.linspace(start_t, end_t, 7) if end_t > start_t else [duration * 0.5]

        for t in timestamps:
            frame = clip.get_frame(t)
            img_pil = Image.fromarray(frame)
            img_cropped = crop_face(img_pil)
            if img_cropped is None:  
                continue
            preds = video_pipeline(img_cropped)
            if preds:
                all_frame_scores.append(preds)

        if all_frame_scores:
            avg = {}
            for fp in all_frame_scores:
                for p in fp:
                    avg[p['label']] = avg.get(p['label'], 0) + p['score']
            n = len(all_frame_scores)
            raw_video = sorted([{"label": k, "score": v / n} for k, v in avg.items()],
                               key=lambda x: x['score'], reverse=True)
            if true_emotion in ("SAD", "ANXIOUS_FEAR"):
                print(f"  [RAW VIDEO] {video_name} (true={true_emotion}): {[(x['label'], round(x['score'],3)) for x in raw_video[:4]]}")
            video_scores = normalize_emotions(raw_video, "video")

    except Exception as e:
        print(f"  [Video Error] {video_name}: {e}")

    if 'clip' in locals():
        clip.close()
    if os.path.exists(wav_path):
        os.remove(wav_path)

    fused_scores = perform_late_fusion(audio_scores, video_scores)
    predicted = fused_scores[0]['label'].upper() if fused_scores else "UNKNOWN"
    top_audio  = audio_scores[0]['label'].upper() if audio_scores else "NONE"
    top_video  = video_scores[0]['label'].upper() if video_scores else "NONE"

    is_fused_correct = predicted == true_emotion
    is_audio_correct = top_audio == true_emotion
    is_video_correct = top_video == true_emotion

    if is_fused_correct: correct_fused += 1
    if is_audio_correct: correct_audio += 1
    if is_video_correct: correct_video += 1

    class_total[true_emotion] += 1
    if is_fused_correct: class_correct[true_emotion] += 1
    if not is_audio_correct: audio_confusion[f"{true_emotion}→{top_audio}"] += 1
    if not is_video_correct: video_confusion[f"{true_emotion}→{top_video}"] += 1

    fused_mark = "✅" if is_fused_correct else "❌"
    audio_mark = "✅" if is_audio_correct else "  "
    video_mark = "✅" if is_video_correct else "  "

    print(f"{video_name[:24]:<25} {true_emotion:<14} {predicted:<14} {top_audio:<14} {top_video:<14} {audio_mark:<12} {video_mark:<12} {fused_mark}")

print(f"\n{'='*110}")
print(f"📊 OVERALL RESULTS")
print(f"{'='*110}")
print(f"Total Videos:     {total}")
print(f"Fused Accuracy:   {correct_fused}/{total} = {(correct_fused/total)*100:.1f}%")
print(f"Audio-only Acc:   {correct_audio}/{total} = {(correct_audio/total)*100:.1f}%")
print(f"Video-only Acc:   {correct_video}/{total} = {(correct_video/total)*100:.1f}%")

print(f"\n📈 PER-CLASS ACCURACY (Fused):")
for emotion in ["NEUTRAL", "HAPPY", "SAD", "ANGRY", "ANXIOUS_FEAR"]:
    t = class_total[emotion]
    c = class_correct[emotion]
    bar = "█" * c + "░" * (t - c)
    pct = f"{(c/t)*100:.0f}%" if t > 0 else "N/A"
    print(f"  {emotion:<14} {c}/{t:<4} {pct:<6} [{bar}]")

print(f"\n🔍 TOP AUDIO CONFUSIONS:")
for k, v in sorted(audio_confusion.items(), key=lambda x: -x[1])[:5]:
    print(f"  {k}: {v} times")

print(f"\n🔍 TOP VIDEO CONFUSIONS:")
for k, v in sorted(video_confusion.items(), key=lambda x: -x[1])[:5]:
    print(f"  {k}: {v} times")

print(f"\n💡 NEXT STEPS:")
print(f"  - If Audio < 50%: Superb may need a different top_k threshold")
print(f"  - If Video < 50%: Try 'enet_b0_8_best_vgaf' variant instead")
print(f"  - If NEUTRAL is over-predicted: reduce calm→neutral mapping weight")
print(f"  - If ANGRY is over-predicted: contempt/disgust dampening needs increase")
print(f"{'='*110}")