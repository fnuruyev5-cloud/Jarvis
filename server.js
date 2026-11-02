
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

// Frontend faylları əsas qovluqdadır
const ROOT = __dirname;

// Yalnız frontend fayllarını təqdim et
app.get('/style.css', (_req, res) => {
  res.sendFile(path.join(ROOT, 'style.css'));
});

app.get('/app.js', (_req, res) => {
  res.sendFile(path.join(ROOT, 'app.js'));
});

// Gemini
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

// Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const SYSTEM = `
Sənin adın F2 JARVIS-dir.
Əsas dilin Azərbaycan dilidir.
İstifadəçi başqa dildə danışarsa, həmin dildə cavab ver.
Sakit, ağıllı, nəzakətli, qısa və peşəkar danış.
Dərin, aydın, sakit kişi səsi ilə səsləndirilməyə uyğun cümlələr qur.
Heç bir aktyorun və ya müəllif hüquqları ilə qorunan personajın səsini təqlid etmə.
"Səni kim yaradıb?" sualına dəqiq belə cavab ver:
"Məni F2 Fərid yaradıb."
Özünü başqa şirkət yaratmış kimi təqdim etmə.
`;

// Health
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    name: 'F2 JARVIS',
    aiConfigured: Boolean(ai),
    supabaseConfigured
  });
});

// AI chat
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
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: message,
      config: {
        systemInstruction: SYSTEM,
        temperature: 0.7
      }
    });

    return res.json({
      reply: response.text || 'Hazırda cavab yarada bilmədim.'
    });
  } catch (error) {
    console.error('chat_error:', error?.message || error);
    return res.status(500).json({
      error: 'AI sorğusu zamanı xəta baş verdi.'
    });
  }
});

// Gemini Live token
app.post('/api/live-token', async (_req, res) => {
  try {
    if (!ai) {
      return res.status(503).json({ error: 'GEMINI_API_KEY qurulmayıb.' });
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

    return res.json({ token: token.name });
  } catch (error) {
    console.error('live_token_error:', error?.message || error);
    return res.status(500).json({
      error: 'Gemini Live token yaradıla bilmədi.'
    });
  }
});

// Supabase chat history
app.post('/api/history', async (req, res) => {
  try {
    if (!supabaseConfigured) {
      return res.status(503).json({
        error: 'Supabase parametrləri qurulmayıb.'
      });
    }

    const authorization = String(req.headers.authorization || '');
    const accessToken = authorization.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : '';

    if (!accessToken) {
      return res.status(401).json({ error: 'Giriş tokeni tələb olunur.' });
    }

    const userSupabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        },
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      }
    );

    const {
      data: { user },
      error: authError
    } = await userSupabase.auth.getUser();

    if (authError || !user) {
      return res.status(401).json({ error: 'Sessiya etibarsızdır.' });
    }

    const userMessage = String(req.body?.user_message || '').slice(0, 10000);
    const assistantMessage = String(req.body?.assistant_message || '').slice(0, 10000);

    if (!userMessage || !assistantMessage) {
      return res.status(400).json({ error: 'Söhbət məlumatları tam deyil.' });
    }

    const { error } = await userSupabase
      .from('chat_history')
      .insert({
        user_id: user.id,
        user_message: userMessage,
        assistant_message: assistantMessage
      });

    if (error) throw error;

    return res.json({ ok: true });
  } catch (error) {
    console.error('history_error:', error?.message || error);
    return res.status(500).json({
      error: 'Söhbət yadda saxlanmadı.'
    });
  }
});

// Unknown API routes
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint tapılmadı.' });
});

// Main frontend
app.get('/', (_req, res) => {
  res.sendFile(path.join(ROOT, 'index.html'));
});

// Other frontend routes
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(ROOT, 'index.html'));
});

// Server errors
app.use((error, _req, res, _next) => {
  console.error('server_error:', error?.message || error);

  if (res.headersSent) return;

  res.status(error.status || 500).json({
    error: 'Server xətası baş verdi.'
  });
});

// Start
const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`F2 JARVIS server listening on ${PORT}`);
});
