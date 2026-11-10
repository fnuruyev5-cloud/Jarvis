# F2 JARVIS

F2 JARVIS is a mobile-first web AI assistant with chat, voice, image generation, camera vision and video tools.

## Setup

1. Upload the contents of this folder to the root of your GitHub repository.
2. Deploy the repository on Render using `npm install` and `npm start`.
3. Configure the environment variables below in Render.

## Environment variables

| Variable | Purpose |
|---|---|
| `GROQ_API_KEY` | Chat fallback, Whisper transcription and image vision |
| `COMETAPI_KEY` | Image generation, text-to-video and Comet video endpoints |
| `RUNWAY_API_KEY` | Recommended for video upload, video-to-video editing and upscale |
| `AI_PROVIDER` | `auto`, `groq`, or `comet`; defaults to auto |
| `GROQ_MODEL` | Defaults to `openai/gpt-oss-120b` |
| `GROQ_STT_MODEL` | Defaults to `whisper-large-v3-turbo` |
| `GROQ_VISION_MODEL` | Defaults to `meta-llama/llama-4-scout-17b-16e-instruct` |
| `COMETAPI_MODEL` | Defaults to `claude-haiku-5-5` |
| `IMAGE_MODEL` | Defaults to `gemini-nano-banana-2.1` |
| `VIDEO_MODEL` | Defaults to `wan3.0-prime` |

Never put API keys in frontend files or commit them to GitHub.

## Features

- AI chat with persistent browser-local conversation history
- Message copy buttons
- Microphone recording + Groq Whisper transcription
- Edge TTS spoken replies
- Image generation directly from the chat tools
- Camera snapshots and periodic live-frame analysis through the vision endpoint
- AI Video Studio: text-to-video, video-to-video edit, and video upscale

## Important limitations

- Microphone and camera require HTTPS and browser permissions.
- Conversation history is stored in the current browser's local storage; it is not synced between devices.
- Live camera mode sends a frame every 9 seconds while enabled and may consume API credits.
- Provider model availability, output quality, duration and cost depend on the user's provider account.
- When using CometAPI's inline data-URI fallback for video editing/upscale, the server limits the input video to 5 MB. Configure `RUNWAY_API_KEY` for the provider upload flow and larger inputs.
- 4K output depends on provider/model/account support and is not guaranteed for every source video.
- In-memory task tracking can be lost if the Render instance restarts before a video job finishes.

See `INSTALL-AZ.txt` for Azerbaijani installation steps.
