# F2 JARVIS — Free Neural TTS

Bu versiyada ElevenLabs çıxarılıb. Səs üçün Microsoft Edge-in onlayn neural TTS xidmətinə qoşulan açıq mənbəli Node paketi istifadə olunur. Bu üsul ElevenLabs API açarı və ödəniş tələb etmir. Xidmət internet bağlantısından və Microsoft-un endpointinin işlək qalmasından asılıdır; limitsiz və rəsmi SLA zəmanətli API kimi qəbul edilməməlidir.

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

## Vacib qeydlər
- Səsli sual vermə push-to-talk rejimindədir: mikrofon düyməsinə bas, danış, bitirəndə yenidən bas.
- Bu, tam duplex canlı danışıq deyil.
- Microsoft Edge TTS kitabxanası Microsoft Edge-in onlayn danışıq xidmətinə API açarı olmadan qoşulur. Üçüncü tərəf paketidir, rəsmi Azure Speech SDK deyil; Microsoft xidməti dəyişərsə işləməyə bilər.
- Səs 3-cü ElevenLabs nümunəsinin eynisi deyil. Azərbaycan dilində Babək kişi neural səsidir.
- Digər dillər üçün uyğun kişi səsləri seçilir; hər dildə eyni səs kimliyi saxlanmaya bilər.
- Supabase bu paketə qoşulmayıb.
