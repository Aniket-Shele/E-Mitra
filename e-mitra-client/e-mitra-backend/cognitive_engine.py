import os
from pymongo import MongoClient
import ollama
from dotenv import load_dotenv
from cryptography.fernet import Fernet
import json

# Load variables from .env
load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")

if not MONGO_URI or not ENCRYPTION_KEY:
    print("❌ ERROR: MONGO_URI or ENCRYPTION_KEY is missing from your .env file!")
    exit()

cipher_suite = Fernet(ENCRYPTION_KEY.encode())

def encrypt_data(text: str) -> str:
    if not text: return text
    return cipher_suite.encrypt(text.encode()).decode()

def decrypt_data(ciphertext: str) -> str:
    if not ciphertext: return ciphertext
    try:
        return cipher_suite.decrypt(ciphertext.encode()).decode()
    except:
        return ciphertext

print("Connecting to MongoDB Atlas Cognitive Core (Encrypted Mode)...")
try:
    client = MongoClient(MONGO_URI)
    client.admin.command('ping')
    print("✅ connected to MongoDB Atlas Secure Intelligence core.")
except Exception as e:
    print(f"❌ Failed to connect to Atlas: {e}")
    exit()

db = client.emitra_db
users_collection = db.users
diary_collection = db.diary

# --- 🚨 INTEL DATABASE 1: AGE ARCHETYPES ---
AGE_ARCHETYPE_LIBRARY = {
    "Child": {
        "label": "Playful Supporter",
        "philosophy": "Child-Friendly Tone. Focus on imaginative safety. Use simple language. Anchor to tangible positive feelings. Mirror and label emotions safely."
    },
    "Adult": {
        "label": "Empathetic Peer",
        "philosophy": "Adult Conversational Tone. Validate their struggles. Acknowledge life complexity. Encourage self-compassion. Focus on actionable insights."
    },
    "Elderly": {
        "label": "Warm Sage",
        "philosophy": "Elderly Supportive Tone. Patient. Warm. Deeply validating. Revere memory. Focus on legacy and purpose. Gentle inquiry into loneliness and loss."
    }
}

# --- 🚨 INTEL DATABASE 2: CLINICAL FRAMEWORKS ---
CLINICAL_FRAMEWORKS = {
    "Active Probing": "Framework: Solution-Focused Brief Therapy (SFBT). Ask forward-looking questions.",
    "Cognitive Care": "Framework: Cognitive Behavioral Therapy (CBT). Help them identify thought patterns.",
    "Reminiscence Therapy": "Framework: Narrative Therapy. Focus on past resilience.",
    "De-escalation": "Framework: Mindfulness & Grounding. Focus on the present moment and physical safety.",
    "Positive Reinforcement": "Framework: Strengths-Based Therapy. Validate and amplify the positive."
}

def check_user_exists(user_id: str):
    user = users_collection.find_one({"user_id": user_id}, {"_id": 0})
    if user and "profile" in user:
        decrypted_profile = {k: decrypt_data(v) for k, v in user["profile"].items()}
        return {"exists": True, "profile": decrypted_profile}
    return {"exists": False}

def create_user_profile(user_id: str, profile_data: dict):
    encrypted_profile = {k: encrypt_data(str(v)) for k, v in profile_data.items()}
    users_collection.update_one(
        {"user_id": user_id},
        {"$set": {"profile": encrypted_profile}},
        upsert=True
    )

def save_to_mongo_diary(user_id: str, new_fact: str):
    encrypted_fact = encrypt_data(new_fact)
    diary_collection.update_one(
        {"user_id": user_id},
        {"$addToSet": {"known_facts": encrypted_fact}},
        upsert=True
    )
    print(f"📝 Secure Note Logged: [ENCRYPTED]")

# ========================================================
# 🚨 PART 3: DYNAMIC DATABASE MEMORY MANAGER 🚨
# ========================================================
def extract_profile_data(user_id: str, user_message: str):
    """Runs silently in the background. Uses LLM to determine if the user wants to update their permanent profile."""
    extraction_prompt = f"""
    You are a silent psychological database manager. Analyze this user's message: "{user_message}"

    Determine if the user is explicitly asking to update their profile (e.g., "Change my triggers to...", "My situation is now...").
    If they are, output ONLY a valid JSON object like this:
    {{"action": "update_profile", "field": "triggers", "value": "the new trigger"}}
    (Valid fields: name, age, situation, coping_style, support_system, current_stressor, sleep_quality, personality, triggers)

    If they are not updating their profile, but they mention a significant new fact (a stressor, a goal, a relationship event), output ONLY a JSON like this:
    {{"action": "add_diary", "value": "Summarized fact in one sentence"}}

    If neither, output exactly: {{"action": "none"}}
    """
    try:
        response = ollama.chat(model='llama3.1', messages=[{'role': 'user', 'content': extraction_prompt}], format='json')
        data = json.loads(response['message']['content'].strip())

        action = data.get("action", "none")

        if action == "update_profile":
            field_to_update = data.get("field")
            new_value = data.get("value")
            if field_to_update and new_value:
                encrypted_value = encrypt_data(str(new_value))
                users_collection.update_one(
                    {"user_id": user_id},
                    {"$set": {f"profile.{field_to_update}": encrypted_value}}
                )
                print(f"🔄 PERMANENT MEMORY UPDATED: Changed '{field_to_update}' to '{new_value}' for {user_id}")

        elif action == "add_diary":
            fact = data.get("value")
            if fact:
                save_to_mongo_diary(user_id, fact)

    except Exception as e:
        print(f"Memory Manager error: {e}")

def determine_age_archetype(decrypted_profile: dict):
    archetype_key = "Adult"
    philosophy_prompt = AGE_ARCHETYPE_LIBRARY["Adult"]["philosophy"]
    if "age" in decrypted_profile:
        try:
            age_int = int(str(decrypted_profile["age"]).strip())
            if age_int <= 12: archetype_key = "Child"
            elif age_int > 60: archetype_key = "Elderly"
            archetype = AGE_ARCHETYPE_LIBRARY[archetype_key]
            philosophy_prompt = f"Conversational Archetype: {archetype['label']}. {archetype['philosophy']}"
        except: pass
    return philosophy_prompt

def generate_chat_response(user_id: str, user_message: str, emotion_state: str, clinical_strategy: str, emotion_journey: list, chat_history: list, language: str = "English"):
    user_data = users_collection.find_one({"user_id": user_id})
    decrypted_profile = {}
    profile_str = ""
    user_triggers = "None specified"

    if user_data and "profile" in user_data:
        for key, encrypted_value in user_data["profile"].items():
            decrypted_val = decrypt_data(encrypted_value)
            decrypted_profile[key] = decrypted_val
            profile_str += f"- {key.replace('_', ' ').title()}: {decrypted_val}\n"
            if key == "triggers": user_triggers = decrypted_val

    diary_data = diary_collection.find_one({"user_id": user_id})
    known_facts_str = "No prior notes recorded yet."
    if diary_data and "known_facts" in diary_data:
        known_facts_str = "\n".join([f"- {decrypt_data(fact)}" for fact in diary_data["known_facts"]])

    if emotion_journey: journey_timeline = " ➔ ".join(emotion_journey)
    else: journey_timeline = emotion_state

    age_based_philosophy_prompt = determine_age_archetype(decrypted_profile)
    therapist_technique = CLINICAL_FRAMEWORKS.get(clinical_strategy, CLINICAL_FRAMEWORKS["Active Probing"])

    language_directive = f"You MUST generate your final therapeutic response entirely in {language}."

    if language.lower() == "marathi" or language == "Marathi (मराठी)":
        language_directive += """
    CRITICAL RULE 1: You MUST write strictly in Marathi using the Devanagari script (e.g., "तुम्ही कसे आहात?").
    CRITICAL RULE 2: ABSOLUTELY DO NOT use Hindi words or Hindi grammar. STRICTLY FORBID ENGLISH CODE-SWITCHING.
    - Do NOT say "थैंक यू" or "धन्यवाद" (Hindi) ➔ You MUST say "आभारी आहे".
    - Do NOT say "हेल्प" or "मदद" (Hindi) ➔ You MUST say "मदत".
    - Do NOT say "हाय" or "हेलो" ➔ You MUST say "नमस्कार".
    - Do NOT say "सॉरी" or "क्षमा करें" (Hindi) ➔ You MUST say "माफ करा".
    """
    elif language.lower() == "hindi" or language == "Hindi (हिंदी)":
        language_directive += """
    CRITICAL RULE 1: You MUST write strictly in Hindi using the Devanagari script (e.g., "आप कैसे हैं?").
    CRITICAL RULE 2: STRICTLY FORBID ENGLISH CODE-SWITCHING. Do NOT use English conversational vocabulary wrapped in Devanagari text.
    - Do NOT say "थैंक यू" or "थैंक्स" ➔ You MUST say "धन्यवाद".
    - Do NOT say "हेल्प" ➔ You MUST say "मदद" or "सहायता".
    - Do NOT say "हाय" or "हेलो" ➔ You MUST say "नमस्ते" or "नमस्कार".
    - Do NOT say "सॉरी" ➔ You MUST say "क्षमा करें".
    """
    else:
        language_directive += """
    CRITICAL RULE 1: Ensure the vocabulary feels rich, deeply human, naturally cultural, and completely native to provide authentic therapeutic comfort.
    """

    system_prompt = f"""
    You are Dr. E-Mitra, an advanced AI psychotherapist. You are highly conversational, deeply analytical, and use flawless grammar.
    Your goal is to foster a dynamic, two-way therapeutic dialogue. Do not just agree with the user; gently challenge cognitive distortions (like catastrophizing or black-and-white thinking) when appropriate.

    --- USER PROFILE (Permanent Knowledge) ---
    {profile_str}

    --- THERAPIST'S DIARY (Silently Extracted Notes) ---
    {known_facts_str}

    --- CURRENT TELEMETRY ---
    Consensus Emotion State: {emotion_state}
    Expression Journey (Message Timeline): {journey_timeline}
    ----------------------

    🚨 CORE PHILOSOPHY & AGE DIRECTIVE 🚨
    {age_based_philosophy_prompt}
    Adapt your vocabulary and clinical depth entirely to the user's age and specific profile data. If their intake form indicates depressive symptoms (low energy, poor sleep, isolation), utilize Behavioral Activation techniques. If it indicates anxiety, utilize Grounding techniques.

    🚨 MEMORY CONSENT RULE 🚨
    If the user mentions a significant new life event, trigger, or coping mechanism, YOU MUST ASK PERMISSION to update their permanent file. (e.g., "That sounds like a major step. Would you like me to update your profile to reflect this new goal?"). NEVER assume permission.

    🚨 LANGUAGE DIRECTIVE 🚨
    {language_directive}

    🚨 CLINICAL STRATEGY TO APPLY NOW: {clinical_strategy} 🚨
    {therapist_technique}
    ----------------------

    INSTRUCTIONS:
    1. Actively listen and reflect on what the user said.
    2. Provide a thoughtful, clinically sound response.
    3. Always end with exactly ONE compelling, open-ended question to drive the conversation deeper.
    """

    try:
        messages_for_ollama = [{'role': 'system', 'content': system_prompt}]
        for msg in chat_history: messages_for_ollama.append(msg)
        messages_for_ollama.append({'role': 'user', 'content': user_message})

        response = ollama.chat(model='llama3.1', messages=messages_for_ollama)
        ai_reply = response['message']['content']

        return {"reply": ai_reply}
    except Exception as e:
        print(f"Ollama Error: {e}")
        return {"reply": "Connection with cognitive core unstable."}