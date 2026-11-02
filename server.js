
import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

// Yalnız frontend fayllarını açıq et
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/index.html', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/app.js', (_req, res) => {
  res.sendFile(path.join(__dirname, 'app.js'));
});

app.get('/style.css', (_req, res) => {
  res.sendFile(path.join(__dirname, 'style.css'));
});

// Əgər assets qovluğu varsa, onun fayllarını təqdim et
app.use('/assets', express.static(path.join(__dirname, 'assets'), {
  dotfiles: 'deny',
  index: false
}));

const groqKey = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

const SYSTEM = `
Sənin adın F2 JARVIS-dir.
Sən ağıllı, peşəkar və köməkçi süni intellekt assistentisən.
Əsas dilin Azərbaycan dilidir.
İstifadəçi başqa dildə danışarsa, həmin dildə cavab ver.
Sakit, aydın, təbii və peşəkar danış.
Cavabları lazımsız uzatma.
Səni kim yaradıb soruşulanda dəqiq belə cavab ver:
Məni F2 Fərid yaradıb.
`;

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    name: 'F2 JARVIS',
    aiConfigured: Boolean(groqKey),
    aiProvider: 'Groq',
    model: GROQ_MODEL,
    supabaseConfigured: Boolean(supabase)
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim();

    if (!message) {
      return res.status(400).json({
        error: 'Mesaj boş ola bilməz.'
      });
    }

    if (/səni kim yaradıb|kim yaradıb|yaradıcın kimdir/i.test(message)) {
      return res.json({
        reply: 'Məni F2 Fərid yaradıb.'
      });
    }

    if (!groqKey) {
      return res.status(503).json({
        error: 'GROQ_API_KEY Render Environment bölməsində qurulmayıb.'
      });
    }

    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: message }
          ],
          max_completion_tokens: 1200
        }),
        signal: AbortSignal.timeout(60000)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('GROQ API ERROR:', response.status, data);

      if (response.status === 401) {
        return res.status(502).json({
          error: 'Groq API açarı etibarsızdır. Render Environment bölməsini yoxla.'
        });
      }

      if (response.status === 429) {
        return res.status(429).json({
          error: 'Groq sorğu limiti dolub. Bir az sonra yenidən yoxla.'
        });
      }

      return res.status(502).json({
        error: data?.error?.message || 'Groq AI sorğusu uğursuz oldu.'
      });
    }

    const reply = data?.choices?.[0]?.message?.content;

    if (!reply) {
      return res.status(502).json({
        error: 'Groq boş cavab qaytardı.'
      });
    }

    return res.json({ reply });
  } catch (error) {
    console.error('CHAT ERROR:', error);

    return res.status(500).json({
      error: error.name === 'TimeoutError'
        ? 'AI cavabı gecikir. Yenidən cəhd et.'
        : 'AI sorğusu zamanı xəta baş verdi.'
    });
  }
});

// Groq mətn API-si Gemini Live tokeni yaratmır
app.post('/api/live-token', (_req, res) => {
  res.status(501).json({
    error: 'Groq mətn API-si canlı səs tokeni yaratmır. Səsli rejim ayrıca qoşulmalıdır.'
  });
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
      return res.status(401).json({
        error: 'Giriş tokeni tələb olunur.'
      });
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
      return res.status(401).json({
        error: 'Sessiya etibarsızdır.'
      });
    }

    const userMessage = String(req.body?.user_message || '').slice(0, 10000);
    const assistantMessage = String(req.body?.assistant_message || '').slice(0, 10000);

    if (!userMessage || !assistantMessage) {
      return res.status(400).json({
        error: 'Söhbət məlumatları tam deyil.'
      });
    }

    const { error } = await userClient
      .from('chat_history')
      .insert({
        user_id: user.id,
        user_message: userMessage,
        assistant_message: assistantMessage
      });

    if (error) throw error;

    return res.json({ ok: true });
  } catch (error) {
    console.error('HISTORY ERROR:', error);

    return res.status(500).json({
      error: 'Söhbət yadda saxlanmadı.'
    });
  }
});

// Naməlum API ünvanları
app.use('/api', (_req, res) => {
  res.status(404).json({
    error: 'API endpoint tapılmadı.'
  });
});

app.use((error, _req, res, _next) => {
  console.error('SERVER ERROR:', error);

  res.status(500).json({
    error: 'Server xətası baş verdi.'
  });
});

const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`F2 JARVIS Groq ilə işləyir: ${PORT}`);
});
        
