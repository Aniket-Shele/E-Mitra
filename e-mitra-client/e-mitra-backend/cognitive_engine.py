import os
from pymongo import MongoClient
import ollama
from dotenv import load_dotenv
from cryptography.fernet import Fernet

# Load variables from .env
load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")

# --- SECURITY & ENCRYPTION SETUP ---
if not MONGO_URI or not ENCRYPTION_KEY:
    print("❌ ERROR: MONGO_URI or ENCRYPTION_KEY is missing from your .env file!")
    exit()

cipher_suite = Fernet(ENCRYPTION_KEY.encode())

def encrypt_data(text: str) -> str:
    """Scrambles plain text into AES-encrypted ciphertext."""
    if not text: return text
    return cipher_suite.encrypt(text.encode()).decode()

def decrypt_data(ciphertext: str) -> str:
    """Unscrambles ciphertext back to plain text."""
    if not ciphertext: return ciphertext
    try:
        return cipher_suite.decrypt(ciphertext.encode()).decode()
    except:
        return ciphertext # Fallback just in case old unencrypted data is in the DB

# --- DATABASE SETUP (MONGODB ATLAS) ---
print("Connecting to MongoDB Atlas Cognitive Core (Encrypted Mode)...")
try:
    client = MongoClient(MONGO_URI)
    client.admin.command('ping')
    print("✅ Pinged your deployment. You successfully connected to MongoDB Atlas!")
except Exception as e:
    print(f"❌ Failed to connect to Atlas: {e}")
    exit()

db = client.emitra_db
users_collection = db.users       
diary_collection = db.diary       
sessions_collection = db.sessions 

def check_user_exists(user_id: str):
    """Checks if user exists, and decrypts their profile for the frontend."""
    user = users_collection.find_one({"user_id": user_id}, {"_id": 0})
    if user and "profile" in user:
        decrypted_profile = {k: decrypt_data(v) for k, v in user["profile"].items()}
        return {"exists": True, "profile": decrypted_profile}
    return {"exists": False}

def create_user_profile(user_id: str, profile_data: dict):
    """Encrypts all profile fields before saving to Permanent Memory."""
    encrypted_profile = {k: encrypt_data(str(v)) for k, v in profile_data.items()}
    users_collection.update_one(
        {"user_id": user_id},
        {"$set": {"profile": encrypted_profile}},
        upsert=True
    )

def save_to_mongo_diary(user_id: str, new_fact: str):
    """Encrypts extracted facts before appending to the diary."""
    encrypted_fact = encrypt_data(new_fact)
    diary_collection.update_one(
        {"user_id": user_id},
        {"$addToSet": {"known_facts": encrypted_fact}}, 
        upsert=True
    )
    print(f"📝 Secure Therapist Note Taken for {user_id}: [ENCRYPTED]")

def extract_profile_data(user_id: str, user_message: str):
    """Runs silently in the background to extract psychological metadata."""
    extraction_prompt = f"""
    You are a silent psychological note-taker. Analyze this user's message: "{user_message}"
    Does the user explicitly state their name, a personal preference, a relationship, a current stressor, or a goal?
    If YES, summarize the core fact in a single, short bullet point. If NO, output exactly the word "NONE".
    """
    try:
        response = ollama.chat(model='llama3.1', messages=[{'role': 'user', 'content': extraction_prompt}])
        fact = response['message']['content'].strip()
        if fact.upper() != "NONE" and len(fact) > 5: 
            save_to_mongo_diary(user_id, fact)
    except Exception as e: 
        print(f"Note-taker error: {e}")

def generate_chat_response(user_id: str, user_message: str, emotion_state: str, clinical_strategy: str, emotion_journey: list, chat_history: list):
    """Decrypts data to construct the prompt, then queries Ollama."""
    
    # 1. Fetch & Decrypt Permanent Memory
    user_data = users_collection.find_one({"user_id": user_id})
    profile_str = ""
    if user_data and "profile" in user_data:
        for key, encrypted_value in user_data["profile"].items():
            decrypted_val = decrypt_data(encrypted_value)
            profile_str += f"- {key.replace('_', ' ').title()}: {decrypted_val}\n"

    # 2. Fetch & Decrypt Semi-Permanent Memory
    diary_data = diary_collection.find_one({"user_id": user_id})
    known_facts_str = "No prior notes recorded yet."
    diary_context = []
    if diary_data and "known_facts" in diary_data:
        diary_context = [decrypt_data(fact) for fact in diary_data["known_facts"]]
        known_facts_str = "\n".join([f"- {fact}" for fact in diary_context])

    # 3. Process the Temporal Emotional Journey
    if emotion_journey:
        journey_timeline = " ➔ ".join(emotion_journey)
    else:
        journey_timeline = emotion_state

    # 4. Construct the Cognitive Prompt
    system_prompt = f"""
    You are E-Mitra, an empathetic, highly intelligent AI companion. 
    Keep your responses natural, conversational, and concise (under 3 sentences). Do not sound like a robot.
    
    --- USER PROFILE (Permanent Knowledge) ---
    {profile_str}
    
    --- THERAPIST'S DIARY (Extracted Metadata) ---
    {known_facts_str}
    
    --- CURRENT TELEMETRY ---
    Overall Dominant Emotion: {emotion_state}
    Micro-Expression Journey (Start to End of Message): {journey_timeline}
    Clinical Strategy to Apply: {clinical_strategy}
    ----------------------
    Respond directly to the user's latest message based on their profile, their emotional journey, and the chat history provided.
    """
    
    try:
        messages_for_ollama = [{'role': 'system', 'content': system_prompt}]
        for msg in chat_history: messages_for_ollama.append(msg)
        messages_for_ollama.append({'role': 'user', 'content': user_message})

        response = ollama.chat(model='llama3.1', messages=messages_for_ollama)
        ai_reply = response['message']['content']
        
        return {"reply": ai_reply, "diary_context_used": diary_context}
    except Exception as e:
        print(f"Ollama Error: {e}")
        return {"reply": "I'm having trouble connecting to my cognitive core.", "diary_context_used": []}