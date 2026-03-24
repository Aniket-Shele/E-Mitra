# E-Mitra: Empathetic AI Companion 🧠💙

E-Mitra (Sanskrit for "Friend") is an advanced, privacy-first multimodal AI companion designed to provide cognitive and emotional support. 

Instead of relying solely on text, E-Mitra perceives user states through a **Tri-Modal Late Fusion Engine**. It simultaneously analyzes semantic meaning (Text), vocal prosody (Audio/Tone), and facial expressions (Computer Vision) to calculate a unified, highly accurate emotional consensus.

## ✨ Core Features (Phase 1 & 2)
* **Semantic Analysis:** Analyzes text input using DistilRoBERTa.
* **Vocal Prosody Analysis:** Analyzes audio tone and pitch using Wav2Vec2.
* **Automatic Speech Recognition (ASR):** Uses OpenAI's Whisper (Tiny) to automatically transcribe spoken words into text.
* **Facial Expression Detection:** Uses a Vision Transformer (ViT) to analyze webcam keyframes.
* **Late Fusion Consensus:** A weighted algorithm that mathematically fuses conflicting multimodal data (e.g., Happy Words + Sad Voice) into a single dominant emotional state.
* **Privacy-First:** Transcripts, audio blobs, and video frames are processed entirely in RAM and immediately destroyed. **Zero transcripts are stored.**

## 🛠️ Technology Stack
* **Frontend:** React.js (Vite), `react-webcam`, `react-media-recorder`
* **Backend:** Python, FastAPI, Uvicorn
* **AI/Machine Learning:** Hugging Face `transformers`, PyTorch, Pillow

---

## 🚀 Getting Started

### Prerequisites
Before running this project, ensure you have the following installed on your system:
1. **Node.js** (v16 or higher)
2. **Python** (v3.9 or higher)
3. **FFmpeg** (Required for audio processing)
   * Mac: `brew install ffmpeg`
   * Windows: Install via `winget install ffmpeg` or download from the official site.

### 1. Backend Setup (FastAPI & AI Models)
Open a terminal and navigate to your backend folder (e.g., `e-mitra-backend`).

```bash
# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Mac/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install required Python libraries
pip install fastapi uvicorn python-multipart transformers torch Pillow

2. Frontend Setup (React/Vite)
Open a second terminal and navigate to your frontend folder (e.g., e-mitra-client).

Bash
# Install Node dependencies
npm install

# Install required media libraries
npm install react-webcam react-media-recorder
💻 Running the Application
You must run both the backend and frontend servers simultaneously.

Terminal 1 (Backend):

Bash
uvicorn main:app --reload
Note: The very first time you boot the server, it will take a few minutes to download the Hugging Face models (~1GB total) to your local cache. Subsequent boot times will be practically instant.

Terminal 2 (Frontend):

Bash
npm run dev
Navigate to http://localhost:5173 in your browser.

🧪 How to Use the Diagnostic Dashboard
Ensure your browser has granted Camera and Microphone permissions.

Leave the text override box blank to test the full pipeline.

Click Start Recording, look at the camera, and speak a sentence expressing an emotion.

Click Stop Recording, then click Initialize Analysis.

The system will transcribe your speech, analyze your tone, evaluate your facial expression, and output the final E-Mitra Consensus.


***
