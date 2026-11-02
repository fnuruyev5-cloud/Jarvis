# F2 JARVIS — Full-stack starter

Azerbaijani-first personal AI assistant web app with a secure Node backend, Gemini text chat, browser speech recognition/speech synthesis, a Gemini Live ephemeral-token endpoint, and Supabase history schema.

## 1. Run locally
- Install Node.js 20+
- Copy `.env.example` to `.env`
- Add your `GEMINI_API_KEY` in `.env` (never in frontend files)
- Run `npm install`
- Run `npm start`
- Open `http://localhost:3000`

## 2. Deploy the backend
GitHub Pages cannot run Node.js. Push this project to a private or public GitHub repository (without `.env`) and deploy it to a Node.js hosting service that supports environment variables. Set `GEMINI_API_KEY`, and optionally Supabase settings, in the host's Secrets/Environment Variables panel. Set the start command to `npm start`.

## 3. Supabase
- Create a Supabase project.
- Open SQL Editor and run `supabase/schema.sql`.
- Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` on the backend.
- This starter includes the history table and RLS policies. Full sign-in UI and per-user history loading still need to be wired before enabling multi-user history in production.

## 4. Gemini Live voice
The backend exposes `POST /api/live-token` to mint a short-lived ephemeral token without exposing the permanent Gemini key. Gemini Live model availability, API access, quotas, and SDK behavior depend on your Google AI Studio project and region. This starter includes the token endpoint but does not yet implement the complete browser microphone/audio streaming transport. The current microphone uses browser speech recognition and the reply uses browser text-to-speech. Do not mistake that fallback for full duplex Gemini Live.

## 5. F2 JARVIS identity
The system instruction sets the assistant identity and the creator response:
“Məni F2 Fərid yaradıb.”
Voice timbre depends on the browser/device voice inventory. The selected Live voice is an available preset, not an actor voice clone.

## 6. Security
- Never commit `.env`.
- Never put Gemini, Groq, OpenRouter, or Supabase service-role keys in `public/`.
- The API keys shared in chat should be revoked and replaced before use.
- Use HTTPS in production for microphone permissions.
- Add rate limiting, abuse protection, request logging with secrets redacted, and auth checks before public production launch.
