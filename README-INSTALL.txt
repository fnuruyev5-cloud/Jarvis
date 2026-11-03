# F2 JARVIS — Android voice fix patch

## ZIP içindəkilər
- `app.js` — real mikrofon yazısı, səsin Groq Whisper ilə mətnə çevrilməsi, AI cavabı və Edge Neural TTS.
- `index.html` — mikrofon düyməsi mesaj yazma sahəsinin soluna, göndər düyməsinin yanına köçürülüb.
- `voice-fix.css` — yeni mikrofon düyməsinin görünüşü və aktiv/dinləmə animasiyası.

## Quraşdırma
1. ZIP-i aç.
2. Bu üç faylı GitHub layihəsinin əsas qovluğuna yüklə və mövcud faylları əvəz et:
   - `app.js`
   - `index.html`
   - `voice-fix.css` (yeni fayldır)
3. `server.js`, `package.json`, `face.js`, `schema.sql` və `.env` fayllarına toxunma.
4. GitHub-da Commit changes et. Render avtomatik deploy etməlidir.
5. Saytı Android Chrome-da `https://` ilə aç. Sayt parametrlərindən mikrofon icazəsini ver.
6. Mesaj qutusunun solundakı mikrofon düyməsinə bas, icazə istənəndə Allow seç və danış. Sən susandan sonra səs göndəriləcək, JARVIS cavab verəcək və səsini oxuyacaq. Düyməyə yenidən basmaq səsli rejimi dayandırır.

## Vacib
- Render serverində `GROQ_API_KEY` Environment Variable mövcud qalmalıdır.
- Mövcud `server.js` daxilində `/api/transcribe`, `/api/chat`, `/api/speak` marşrutları artıq var; bu yamaq onlardan istifadə edir.
- Mikrofon yalnız HTTPS-də və istifadəçi icazəsi ilə işləyir. Telefon ekranı kilidlənəndə və ya başqa tətbiqə keçəndə Android brauzeri mikrofona fasilə verə bilər.
- Səs tanıma üçün brauzerin `SpeechRecognition` funksiyasına güvənilmir; MediaRecorder ilə audio yazılır və serverdə Groq Whisper-ə göndərilir.
