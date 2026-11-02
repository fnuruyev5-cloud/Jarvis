# F2 JARVIS — Updated starter

## Render
- Root Directory: boş saxla
- Build Command: `npm install`
- Start Command: `npm start`
- Node: 20 və ya daha yeni

## Render Environment
Ən azı `GROQ_API_KEY` əlavə et. Dəyəri GitHub-a və ya frontend-ə yazma.
İstəyə görə `GROQ_MODEL` və `GROQ_STT_MODEL` dəyişənlərini də əlavə edə bilərsən.

## Funksiyalar
- Groq ilə mətn AI cavabları
- `/api/transcribe` vasitəsilə Groq Whisper nitq tanıma; model dili avtomatik müəyyən edə bilər
- Cavabların brauzer/cihaz TTS səsi ilə oxunması
- Mikrofon yazısı və dinləmə/düşünmə/danışma animasiyaları
- İstəyə bağlı Supabase auth tokeni ilə tarixçə yazma endpoint-i

## Vacib məhdudiyyətlər
Bu versiya tam duplex, fasiləsiz real-time voice assistant deyil. İstifadəçi danışığı yazılır, serverdə transkripsiya edilir, sonra Groq mətn cavabı qaytarır. Cavab səsi cihazın `speechSynthesis` mühərrikindən gəlir; keyfiyyət və Azərbaycan dili səsi cihaz/brauzerdən asılıdır. Premium bulud TTS və canlı audio axını ayrıca inteqrasiya olunmalıdır.

## Supabase tarixçə
`/api/history` endpoint-i üçün `chat_history` cədvəli yaradılmalıdır:
- `user_id uuid`
- `role text`
- `content text`
- `created_at timestamptz default now()`

Bu başlanğıc paketində frontend Supabase login və tarixçənin yüklənməsi qurulmayıb. Supabase dəyişənləri olmadan da əsas Groq chat işləyir.
