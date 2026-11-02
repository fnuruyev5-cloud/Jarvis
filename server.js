import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  : null;

const SYSTEM = `Sənin adın F2 JARVIS-dir. Əsas dilin Azərbaycan dilidir; istifadəçi başqa dildə danışarsa həmin dildə cavab ver. Sakit, ağıllı, nəzakətli, qısa və peşəkar danış. Özünəməxsus, dərin, aydın, sakit kişi səsi ilə səsləndirilməyə uyğun cümlələr qur; heç bir aktyorun və ya müəllif hüquqları ilə qorunan personajın səsini təqlid etmə. "Səni kim yaradıb?" soruşulanda dəqiq belə cavab ver: "Məni F2 Fərid yaradıb." Özünü OpenAI və ya başqa şirkət yaratmış kimi təqdim etmə.`;

app.get('/api/health', (_req,res) => res.json({
  ok: true,
  name: 'F2 JARVIS',
  aiConfigured: Boolean(ai),
  supabaseConfigured: Boolean(supabase)
}));

app.post('/api/chat', async (req,res) => {
  try {
    const message = String(req.body?.message || '').trim();
    if (!message) return res.status(400).json({ error: 'Mesaj boş ola bilməz.' });
    if (/səni kim yaradıb|kim yaradıb|yaradıcın kimdir/i.test(message)) {
      return res.json({ reply: 'Məni F2 Fərid yaradıb.' });
    }
    if (!ai) return res.status(503).json({ error: 'Gemini server açarı qurulmayıb. Backend-də GEMINI_API_KEY əlavə et.' });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: message,
      config: { systemInstruction: SYSTEM, temperature: 0.7 }
    });
    res.json({ reply: response.text || 'Hazırda cavab yarada bilmədim.' });
  } catch (e) {
    console.error('chat_error', e?.message || e);
    res.status(500).json({ error: 'AI sorğusu zamanı xəta baş verdi.' });
  }
});

// Creates a short-lived Gemini Live ephemeral token. The long-lived API key stays on server.
app.post('/api/live-token', async (_req,res) => {
  try {
    if (!ai) return res.status(503).json({ error: 'GEMINI_API_KEY qurulmayıb.' });
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: process.env.GEMINI_LIVE_MODEL || 'gemini-2.5-flash-native-audio-preview-12-2025',
          config: {
            responseModalities: ['AUDIO'],
            systemInstruction: SYSTEM,
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } }
          }
        }
      }
    });
    res.json({ token: token.name });
  } catch (e) {
    console.error('live_token_error', e?.message || e);
    res.status(500).json({ error: 'Gemini Live sessiya açarı yaradıla bilmədi. Model/API imkanlarını və layihə limitlərini yoxla.' });
  }
});

// Supabase Auth session is verified server-side before storing history.
app.post('/api/history', async (req,res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase parametrləri qurulmayıb.' });
    const auth = String(req.headers.authorization || '');
    const accessToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!accessToken) return res.status(401).json({ error: 'Giriş tokeni tələb olunur.' });
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) return res.status(401).json({ error: 'Sessiya etibarsızdır.' });
    const { user_message, assistant_message } = req.body || {};
    const { error } = await supabase.from('chat_history').insert({
      user_id: user.id,
      user_message: String(user_message || '').slice(0,10000),
      assistant_message: String(assistant_message || '').slice(0,10000)
    });
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    console.error('history_error', e?.message || e);
    res.status(500).json({ error: 'Söhbət yadda saxlanmadı.' });
  }
});

app.get('/{*splat}', (req, res) => {.sendFile(path.join(__dirname,'public','index.html')));
const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`F2 JARVIS server listening on ${port}`));
