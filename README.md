# F2 JARVIS — rebuilt project

This version rebuilds the interface and browser logic from scratch.

## Features
- Animated cybernetic AI face built with HTML/CSS/SVG (no external image required).
- Eye gaze follows pointer/touch position and performs idle scanning.
- Animated blink, face scan, neon circuits, energy rings and audio bars.
- Text chat through the Groq Chat Completions API.
- Microphone recording -> Groq Whisper transcription -> AI response.
- Browser/device text-to-speech for reading AI responses aloud.
- Approximate lip movement while speech is playing.
- Azerbaijani, Turkish, English and Russian language handling.
- API keys remain on the server.

## Important voice limitation
The speech output uses the device/browser's installed speech voices. It is not a custom cinematic AI voice, and Azerbaijani voice availability depends on the phone. Lip movement is an animation synchronized approximately with speech events; it is not phoneme-perfect facial capture. This is push-to-talk (record, stop, process, reply), not full-duplex live conversation.

## Deploy on Render
1. Upload all files in this folder to the **root** of your GitHub `Jarvis` repository, replacing old files.
2. Commit the changes to the `main` branch.
3. Render service settings:
   - Build command: `npm install`
   - Start command: `npm start`
   - Root directory: leave blank
4. In Render > Environment, set:
   - `GROQ_API_KEY` = your Groq API key
   - `GROQ_MODEL` = `openai/gpt-oss-120b` (optional)
   - `GROQ_STT_MODEL` = `whisper-large-v3-turbo` (optional)
5. Deploy and open `/api/health` on your Render site. It should show `ok: true` and `aiConfigured: true`.

## Test
- Send a text message first.
- If it answers, enable microphone permission and test push-to-talk.
- Tap **Danışmağa başla**, speak, then tap **Yazını bitir və göndər**.
- If the text answer appears but there is no voice, check phone media volume, browser sound permission and Android text-to-speech voices.

## Local run
Requires Node.js 20+.
```bash
npm install
cp .env.example .env
# Put your real GROQ_API_KEY in .env
npm start
```
Open `http://localhost:3000`.
