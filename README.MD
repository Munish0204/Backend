# 🎙️ Speech-to-Text Backend (MERN + Supabase)

This is the backend of a Speech-to-Text web application built with Node.js, Express.js, and Supabase. It handles:
- Audio file uploads
- Transcription using a Speech-to-Text API (e.g., AssemblyAI, Whisper)
- Storing transcription and audio metadata in Supabase

---

## 🛠️ Tech Stack

- **Node.js + Express** – REST API
- **Supabase** – Realtime DB for storing transcriptions
- **Multer** – For handling audio file uploads
- **Speech-to-Text API** – External service for transcription (plug-in ready)
- **CORS** – For connecting with React frontend

---

## .env

PORT=8000
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_or_service_role_key
SPEECH_API_KEY=your_transcription_api_key  # if needed


## Run the Server

npm run dev


## Dependencies

npm install express cors multer axios dotenv @supabase/supabase-js
