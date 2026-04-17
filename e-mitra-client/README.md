Here is the completely updated, highly professional `README.md` for E-Mitra. It includes all your latest architectural upgrades (the V2 models, the OpenCV face cropping, the 16kHz audio conversion, the Ollama integration, and the automated evaluation script), perfectly formatted with dedicated instructions for both Mac and Windows.

Copy this entire block and paste it into your `README.md` file:

```markdown
# E-Mitra: Empathetic AI Companion 🧠💙

E-Mitra (Sanskrit for "Friend") is an advanced, privacy-first multimodal AI companion designed to provide cognitive and emotional support.

Instead of relying solely on text, E-Mitra perceives user states through a **Tri-Modal Late Fusion Engine**. It simultaneously analyzes semantic meaning (Text), vocal prosody (Audio/Tone), and facial expressions (Computer Vision) to calculate a unified, highly accurate emotional consensus, which then dictates a clinical conversational strategy.

---

## ✨ Core Features & Upgrades (Phase 2 & 3)

* **Tri-Modal Late Fusion Consensus:** A mathematically weighted algorithm (40% Text, 30% Audio, 30% Video) that prevents "Domain Shift" false positives by balancing linguistic context against raw vocal/facial energy.
* **Dynamic Face Cropping:** Uses OpenCV (`haarcascade`) to dynamically isolate and crop the user's face with a 20% margin before feeding it to the Vision Transformer, dramatically increasing accuracy.
* **Audio Prosody Normalization:** Automatically captures `.webm` browser recordings and downsamples them to pure `16,000 Hz Mono .wav` files using `moviepy`, ensuring perfect compatibility with the Wav2Vec2 audio pipeline.
* **Clinical Strategy Mapping:** Translates the dominant emotional state into a psychological directive (e.g., *Reminiscence Therapy* for Sadness, *Cognitive Care* for Anxious/Fear, *De-escalation* for Anger).
* **Local LLM Chat (Ollama):** Powered by `Llama 3.1`, E-Mitra responds empathetically based on the fused telemetry data. 
* **Therapist's Memory Diary:** An autonomous background note-taker that silently extracts facts, stressors, and relationships from the user's input and saves them locally (`therapist_diary.json`) for future context.
* **Privacy-First:** Transcripts, audio blobs, and video frames are processed entirely in RAM and immediately destroyed. Zero telemetry is stored in the cloud.

---

## 🛠️ Technology Stack & AI Models

**Frontend:** React.js (Vite), `react-webcam`, `react-media-recorder`
**Backend:** Python, FastAPI, Uvicorn
**Local LLM:** Ollama (Llama 3.1)

**The AI Pipeline (V1 vs V2 Models):**
* **Text (Semantics):** V2 Hartmann DistilRoBERTa *(Replaced V1 Twitter RoBERTa)*
* **Audio (Prosody):** V2 RAVDESS Wav2Vec2 *(Replaced V1 Superb)*
* **Video (Expressions):** V2 AffectNet ViT *(Replaced V1 FER2013)*
* **Speech-to-Text (ASR):** OpenAI Whisper (Tiny)

---

## 🚀 Getting Started

### Prerequisites
Before running this project, ensure you have the following installed on your system:
1.  **Node.js** (v16 or higher)
2.  **Python** (v3.9 or higher)
3.  **FFmpeg** (Required for `moviepy` audio processing)
    * **Mac:** `brew install ffmpeg`
    * **Windows:** `winget install ffmpeg` (or download from the official site)
4.  **Ollama** (Required for the Chat interface)
    * Download from [Ollama.com](https://ollama.com/)
    * Once installed, open your terminal and run: `ollama pull llama3.1`

---

### 1. Backend Setup (FastAPI & AI Models)

Open a terminal and navigate to your backend folder (e.g., `e-mitra-backend`).

**For Mac / Linux:**
```bash
# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install required Python libraries
pip3 install fastapi uvicorn python-multipart transformers torch torchvision Pillow opencv-python moviepy requests ollama
```

**For Windows:**
```cmd
# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate

# Install required Python libraries
pip install fastapi uvicorn python-multipart transformers torch torchvision Pillow opencv-python moviepy requests ollama
```

---

### 2. Frontend Setup (React/Vite)

Open a second terminal and navigate to your frontend folder (e.g., `e-mitra-client`).

```bash
# Install Node dependencies
npm install

# Install required media libraries
npm install react-webcam react-media-recorder
```

---

## 💻 Running the Application

You must run both the backend and frontend servers simultaneously. Make sure Ollama is running in the background on your computer!

**Terminal 1 (Backend):**
```bash
# Mac
uvicorn main:app --reload

# Windows
python -m uvicorn main:app --reload
```
*(Note: The very first time you boot the server, it will take a few minutes to download the Hugging Face models (~1GB total) to your local cache. Subsequent boot times will be nearly instant.)*

**Terminal 2 (Frontend):**
```bash
npm run dev
```
Navigate to `http://localhost:5173` in your browser.

---

## 🧪 Running the Diagnostic Evaluation Script (`run_eval.py`)

E-Mitra includes a built-in automated evaluation pipeline to test the Late Fusion Engine against raw video files (like the RAVDESS dataset) and print a diagnostic "X-Ray" of the model's internal scores.

1. Ensure your FastAPI server (`main.py`) is running in a separate terminal.
2. Place `.mp4` video files into a folder named `ravdess_test` inside your backend directory. 
3. **The Trojan Horse Filename:** The script reads the *third number* separated by dashes to determine the "True" emotion. To test custom YouTube videos, rename them accordingly:
   * `01-01-05-01.mp4` (05 = Angry)
   * `01-01-04-01.mp4` (04 = Sad)
   * `01-01-03-01.mp4` (03 = Happy)
   * `01-01-06-01.mp4` (06 = Anxious/Fear)
4. Run the script:
   * **Mac:** `python3 run_eval.py`
   * **Windows:** `python run_eval.py`

---

## 🗣️ How to Use the Diagnostic Dashboard

1. Ensure your browser has granted **Camera** and **Microphone** permissions.
2. Select your desired AI models (V1 vs V2) using the dropdown menus in the semantic, prosody, and expression windows.
3. Leave the Semantic Input box blank to test the full Whisper ASR transcription pipeline.
4. Click **Start**, look at the camera, and speak a sentence expressing an emotion.
5. Click **Stop**, then click **Initialize Analysis & Respond**.
6. Watch the system transcribe your speech, extract your face, convert your audio, and calculate the final E-Mitra Consensus.
7. Click the floating **💬 Chat Icon** in the bottom right to talk to E-Mitra based on your emotional telemetry!
```
