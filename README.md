# F2 JARVIS — Free Neural TTS

Bu versiyada ElevenLabs çıxarılıb. AI cavabları Groq, səs çıxışı isə Microsoft Edge-in onlayn neural TTS xidmətinə qoşulan açıq mənbəli Node paketi ilə işləyir. Bu üsul ElevenLabs API açarı tələb etmir. Xidmət internet bağlantısından və Microsoft endpointinin işlək qalmasından asılıdır; rəsmi, limitsiz API zəmanəti yoxdur.

## Daxil edilən kişi səsləri
- Azərbaycan: `az-AZ-BabekNeural`
- Türk: `tr-TR-AhmetNeural`
- İngilis: `en-US-GuyNeural`
- Rus: `ru-RU-DmitryNeural`
- Alman, fransız, ispan, italyan, portuqal və ərəb dilləri üçün də uyğun kişi səsləri seçilir.

Azərbaycan dili üçün Microsoft-un rəsmi səs siyahısında `az-AZ-BabekNeural` kişi səsi göstərilir: https://learn.microsoft.com/azure/ai-services/speech-service/language-support?tabs=tts

## GitHub-a yükləmə
ZIP-i aç və aşağıdakı faylları GitHub `Jarvis` reposunun `main` branch-ində root qovluğa yükləyərək köhnə eyni adlı faylları əvəz et:
- `index.html`
- `style.css`
- `app.js`
- `face.js` (hologram üz animasiyası)
- `server.js`
- `package.json`
- `.env.example`
- `README.md`

## Render
Render → service → Environment:
- `GROQ_API_KEY` — əvvəlki Groq açarın (mövcud dəyəri saxla)
- `GROQ_MODEL` — `openai/gpt-oss-120b`
- `GROQ_STT_MODEL` — `whisper-large-v3-turbo`

ElevenLabs üçün heç bir dəyişən lazım deyil. Əvvəl əlavə etdiyin `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID` dəyişənlərini silə bilərsən.

Build Command: `npm install`
Start Command: `npm start`
Root Directory: boş

Sonra Manual Deploy → Deploy latest commit.

## Yoxlama
`https://jarvis-5okr.onrender.com/api/health` aç. Burada `voiceConfigured: true` və `voiceProvider: "Microsoft Edge Neural TTS"` görünməlidir.

## Yeni səsli rejim
- Mikrofon düyməsinə bir dəfə basaraq dinləməni aktiv et.
- “Hey Jarvis” (və ya “Jarvis”) de. Sonra sualını adi danışıqla ver.
- JARVIS danışığını bitirdikdən sonra sükut fasiləsini avtomatik aşkarlayıb cavab verir və növbəti sualı dinləyir.
- Söhbəti “Dayandır” düyməsi ilə bağla. İlk aktivləşdirmədə qısa açılış səsi və salamlaması səslənir.
- Nitq tanıma brauzerin Web Speech API imkanından istifadə edir. Android Chrome-da sayt açıq və ön planda qalmalıdır; ekran sönəndə və ya başqa tətbiqə keçəndə brauzer mikrofonu dayandıra bilər. Bəzi cihazlarda Azərbaycan dili nitq tanıma dəstəyi zəifdirsə, Türk dili rejimi ehtiyat variant kimi yoxlanır.
- Cavab səsi əvvəlkindən bir qədər sürətli və daha dərin tonda qurulub. Bu, ayrıca aktyor səsinin klonu deyil.
- Microsoft Edge TTS kitabxanası Microsoft Edge-in onlayn danışıq xidmətinə API açarı olmadan qoşulur. Üçüncü tərəf paketidir, rəsmi Azure Speech SDK deyil; Microsoft xidməti dəyişərsə işləməyə bilər.
- Azərbaycan dili üçün Babək kişi neural səsi seçilib; bu, ayrıca aktyor səsinin klonu deyil.
- Digər dillər üçün uyğun kişi səsləri seçilir; hər dildə eyni səs kimliyi saxlanmaya bilər.
- Supabase bu paketə qoşulmayıb.
