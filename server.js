
import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

// Fayllar GitHub-un əsas qovluğundadır
app.use(express.static(__dirname));

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

const SYSTEM = `
Sənin adın F2 JARVIS-dir.
Əsas dilin Azərbaycan dilidir.
Başqa dildə danışılarsa həmin dildə cavab ver.
Sakit, ağıllı və peşəkar danış.
Səni kim yaradıb soruşulanda dəqiq belə cavab ver:
Məni F2 Fərid yaradıb.
`;

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    name: 'F2 JARVIS',
    aiConfigured: Boolean(ai),
    supabaseConfigured: Boolean(supabase)
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim();

    if (!message) {
      return res.status(400).json({ error: 'Mesaj boş ola bilməz.' });
    }

    if (/səni kim yaradıb|kim yaradıb|yaradıcın kimdir/i.test(message)) {
      return res.json({ reply: 'Məni F2 Fərid yaradıb.' });
    }

    if (!ai) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY Render Environment bölməsində qurulmayıb.'
      });
    }

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      contents: message,
      config: {
        systemInstruction: SYSTEM,
        temperature: 0.7
      }
    });

    res.json({
      reply: response.text || 'Cavab yaradıla bilmədi.'
    });
  } catch (error) {
    console.error('CHAT ERROR:', error);
    res.status(500).json({
      error: 'AI sorğusu zamanı xəta baş verdi.'
    });
  }
});

app.post('/api/live-token', async (_req, res) => {
  try {
    if (!ai) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY qurulmayıb.'
      });
    }

    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: process.env.GEMINI_LIVE_MODEL ||
            'gemini-2.5-flash-native-audio-preview-12-2025',
          config: {
            responseModalities: ['AUDIO'],
            systemInstruction: SYSTEM,
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Charon' }
              }
            }
          }
        }
      }
    });

    res.json({ token: token.name });
  } catch (error) {
    console.error('LIVE TOKEN ERROR:', error);
    res.status(500).json({
      error: 'Gemini Live token yaradıla bilmədi.'
    });
  }
});

app.post('/api/history', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        error: 'Supabase parametrləri qurulmayıb.'
      });
    }

    const authorization = req.headers.authorization || '';
    const accessToken = authorization.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : '';

    if (!accessToken) {
      return res.status(401).json({ error: 'Giriş tokeni tələb olunur.' });
    }

    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: `Bearer ${accessToken}` }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    const { data: { user }, error: authError } =
      await userClient.auth.getUser();

    if (authError || !user) {
      return res.status(401).json({ error: 'Sessiya etibarsızdır.' });
    }

    const userMessage = String(req.body?.user_message || '').slice(0, 10000);
    const assistantMessage = String(req.body?.assistant_message || '').slice(0, 10000);

    if (!userMessage || !assistantMessage) {
      return res.status(400).json({ error: 'Söhbət məlumatları tam deyil.' });
    }

    const { error } = await userClient.from('chat_history').insert({
      user_id: user.id,
      user_message: userMessage,
      assistant_message: assistantMessage
    });

    if (error) throw error;

    res.json({ ok: true });
  } catch (error) {
    console.error('HISTORY ERROR:', error);
    res.status(500).json({ error: 'Söhbət yadda saxlanmadı.' });
  }
});

// Ana səhifə
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Naməlum API ünvanları
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint tapılmadı.' });
});

app.use((error, _req, res, _next) => {
  console.error('SERVER ERROR:', error);
  res.status(500).json({ error: 'Server xətası baş verdi.' });
});

const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`F2 JARVIS işləyir: ${PORT}`);
});
    
