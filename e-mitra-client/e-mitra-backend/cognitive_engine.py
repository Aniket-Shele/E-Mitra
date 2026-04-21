import os
from pymongo import MongoClient
import ollama
from dotenv import load_dotenv

# Load the connection string from your .env file
load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")

# --- DATABASE SETUP (MONGODB ATLAS) ---
print("Connecting to MongoDB Atlas Cognitive Core...")

# 🚨 SAFETY CHECK: Ensure the .env file was loaded
if not MONGO_URI:
    print("❌ ERROR: MONGO_URI is missing! Please make sure your .env file is saved in the same folder as this script.")
    exit()

try:
    client = MongoClient(MONGO_URI)
    # Send a ping to confirm a successful connection
    client.admin.command('ping')
    print("✅ Pinged your deployment. You successfully connected to MongoDB Atlas!")
except Exception as e:
    print(f"❌ Failed to connect to Atlas: {e}")
    exit()

db = client.emitra_db
users_collection = db.users       # Permanent Memory (Profiles)
diary_collection = db.diary       # Semi-Permanent Memory (Metadata)
sessions_collection = db.sessions # Temporary Memory

def check_user_exists(user_id: str):
    """Checks if a user profile already exists in MongoDB."""
    user = users_collection.find_one({"user_id": user_id}, {"_id": 0})
    if user:
        return {"exists": True, "profile": user["profile"]}
    return {"exists": False}

def create_user_profile(user_id: str, profile_data: dict):
    """Saves a new user's clinical intake form to Permanent Memory."""
    users_collection.update_one(
        {"user_id": user_id},
        {"$set": {"profile": profile_data}},
        upsert=True
    )

def save_to_mongo_diary(user_id: str, new_fact: str):
    """Appends an extracted fact to the user's semi-permanent diary in MongoDB"""
    diary_collection.update_one(
        {"user_id": user_id},
        {"$addToSet": {"known_facts": new_fact}}, # $addToSet prevents duplicates
        upsert=True
    )
    print(f"📝 Therapist Note Taken for {user_id}: {new_fact}")

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
    """Constructs the prompt with all Memory Tiers and queries Ollama."""
    
    # 1. Fetch Permanent Memory (User Profile)
    user_data = users_collection.find_one({"user_id": user_id})
    profile_str = ""
    if user_data and "profile" in user_data:
        for key, value in user_data["profile"].items():
            profile_str += f"- {key.replace('_', ' ').title()}: {value}\n"

    # 2. Fetch Semi-Permanent Memory (Diary)
    diary_data = diary_collection.find_one({"user_id": user_id})
    known_facts_str = "No prior notes recorded yet."
    diary_context = []
    if diary_data and "known_facts" in diary_data:
        diary_context = diary_data["known_facts"]
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
        # Build the memory block for Ollama
        messages_for_ollama = [{'role': 'system', 'content': system_prompt}]
        
        # Inject previous conversation flow
        for msg in chat_history: 
            messages_for_ollama.append(msg)
            
        # Inject the current message
        messages_for_ollama.append({'role': 'user', 'content': user_message})

        # Ask Ollama
        response = ollama.chat(model='llama3.1', messages=messages_for_ollama)
        ai_reply = response['message']['content']
        
        return {"reply": ai_reply, "diary_context_used": diary_context}
    except Exception as e:
        print(f"Ollama Error: {e}")
        return {"reply": "I'm having trouble connecting to my cognitive core.", "diary_context_used": []}