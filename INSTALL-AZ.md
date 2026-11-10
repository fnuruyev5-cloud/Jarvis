F2 JARVIS — YENİLƏNMİŞ LAYİHƏNİN QURAŞDIRILMASI

1. ZIP-i aç.
2. İçindəki Jarvis-main qovluğunun fayllarını GitHub repozitoriyasının əsas qovluğuna yüklə.
3. Eyni adlı faylları soruşduqda Replace / Əvəz et seç.
4. GitHub-da commit et. Render avtomatik deploy etməlidir.

ƏSAS YENİLİKLƏR
- Mikrofon: MediaRecorder + Groq Whisper ilə danışığı mətnə çevirir.
- Səsli cavab: server tərəfində Edge TTS.
- Söhbət yaddaşı: brauzerin localStorage yaddaşında saxlanır və səhifə yenilənəndə bərpa olunur.
- Mesajlarda Kopyala düyməsi.
- Mesaj bölməsində Şəkil yarat düyməsi.
- Canlı kamera pəncərəsi: kadrı AI-yə göstərmək və periodik canlı analiz.
- AI Video Studio: mətnlə video yaratma, yüklənmiş videonu redaktə etmə və upscale.
- Serverdə /api/chat, /api/transcribe, /api/speak, /api/vision, /api/generate-image,
  /api/videos, /api/videos/edit, /api/videos/upscale və task status endpoint-ləri.

RENDER ENVIRONMENT DƏYİŞƏNLƏRİ
GROQ_API_KEY       = Groq API açarın (chat, Whisper, vision)
COMETAPI_KEY       = CometAPI açarın (şəkil/video yaratma və uyğun video servisləri)
RUNWAY_API_KEY     = Runway API açarın (video upload/redaktə/upscale üçün tövsiyə olunur)
AI_PROVIDER        = auto
GROQ_MODEL         = openai/gpt-oss-120b
GROQ_STT_MODEL     = whisper-large-v3-turbo
GROQ_VISION_MODEL  = meta-llama/llama-4-scout-17b-16e-instruct
COMETAPI_MODEL     = claude-haiku-5-5
IMAGE_MODEL        = gemini-nano-banana-2.1
VIDEO_MODEL        = wan3.0-prime

QEYDLƏR
- API açarlarını GitHub koduna, index.html-ə və frontend JavaScript fayllarına yazma.
- Mikrofon/kamera yalnız HTTPS-də və brauzer icazəsi verildikdə işləyir.
- Mikrofon üçün Android Chrome sayt icazələrində Microphone = Allow olmalıdır.
- Canlı kamera analizi hər 9 saniyədə bir kadr göndərir; bu API sorğuları və mümkün kredit sərfiyyatı yarada bilər.
- Şəkil/video modellərinin mövcudluğu, qiyməti və nəticəsi CometAPI/Runway hesabının model girişlərinə, balansına və limitlərinə bağlıdır.
- CometAPI üzərindən video faylı birbaşa data URI kimi göndərildikdə bu server 5 MB limit qoyur.
  Böyük video faylları üçün RUNWAY_API_KEY konfiqurasiya et.
- 4K upscale yalnız provayderin seçilmiş model və hesabı dəstəklədikdə işləyəcək.
- Söhbət yaddaşı bu brauzer və cihazda saxlanır; başqa cihazla avtomatik sinxronlaşmır.
- Video tapşırıq statusları server yaddaşında saxlanır; Render server yenidən başladıqda aktiv tapşırıq ID xəritəsi itə bilər.

TEST
Deploy-dan sonra https://SENIN-SAYTIN.onrender.com/api/health ünvanını aç.
aiConfigured, groqConfigured və videoEditorConfigured sahələrinə bax.
