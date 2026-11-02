import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const GROQ_STT_MODEL = process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/app.js", (_req, res) => res.sendFile(path.join(__dirname, "app.js")));
app.get("/style.css", (_req, res) => res.sendFile(path.join(__dirname, "style.css")));
app.use("/assets", express.static(path.join(__dirname, "assets"), { maxAge: "1d" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    name: "F2 JARVIS",
    aiConfigured: Boolean(GROQ_API_KEY),
    aiProvider: "Groq",
    model: GROQ_MODEL,
    speechRecognition: Boolean(GROQ_API_KEY),
    supabaseConfigured: Boolean(supabase)
  });
});

const SYSTEM_PROMPT = `
Sən F2 JARVIS adlı şəxsi süni intellekt köməkçisisən.
İstifadəçinin yazdığı və ya danışdığı dildə cavab ver. Azərbaycan dilində səlis,
aydın və təbii danış. Türk, ingilis, rus və digər dillərdə də həmin dildə cavab ver.
Sakit, ağıllı, nəzakətli və peşəkar üslub saxla. Lazımsız uzatma.
İstifadəçi "Səni kim yaradıb?" deyərsə, dəqiq belə cavab ver:
"Məni F2 Fərid yaradıb."
Özünü insan və ya canlı varlıq kimi təqdim etmə. Bilmədiyin məlumatı uydurma.
`;

app.post("/api/chat", async (req, res) => {
  try {
    if (!GROQ_API_KEY) {
      return res.status(503).json({ error: "GROQ_API_KEY Render Environment-də qurulmayıb." });
    }
    const message = String(req.body?.message || "").trim();
    const history = Array.isArray(req.body?.history) ? req.body.history.slice(-12) : [];
    if (!message) return res.status(400).json({ error: "Mesaj boş ola bilməz." });

    const safeHistory = history
      .filter(x => x && ["user", "assistant"].includes(x.role) && typeof x.content === "string")
      .map(x => ({ role: x.role, content: x.content.slice(0, 4000) }));

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...safeHistory,
          { role: "user", content: message }
        ],
        temperature: 0.65,
        max_completion_tokens: 1200
      }),
      signal: AbortSignal.timeout(60000)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const status = response.status;
      const detail = data?.error?.message || "Groq sorğusu uğursuz oldu.";
      return res.status(status === 401 ? 502 : status).json({
        error: status === 401
          ? "Groq API açarı etibarsızdır. Render Environment-də GROQ_API_KEY dəyərini yoxla."
          : status === 429
            ? "Groq limitinə çatıldı. Bir az sonra yenidən yoxla."
            : detail
      });
    }

    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) return res.status(502).json({ error: "AI boş cavab qaytardı." });
    res.json({ ok: true, reply });
  } catch (error) {
    console.error("chat error:", error);
    res.status(500).json({ error: "AI sorğusu zamanı xəta baş verdi." });
  }
});

/* Audio transcription: language is detected by the speech model.
   The Groq key stays on the server and is never sent to the browser. */
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!GROQ_API_KEY) {
      return res.status(503).json({ error: "Səs tanıma üçün GROQ_API_KEY qurulmayıb." });
    }
    if (!req.file) return res.status(400).json({ error: "Audio faylı göndərilməyib." });

    const form = new FormData();
    const audioBlob = new Blob([req.file.buffer], {
      type: req.file.mimetype || "audio/webm"
    });
    form.append("file", audioBlob, req.file.originalname || "voice.webm");
    form.append("model", GROQ_STT_MODEL);
    form.append("response_format", "json");
    form.append("temperature", "0");

    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(90000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Səs tanıma xidməti cavab vermədi."
      });
    }
    const transcript = String(data?.text || "").trim();
    if (!transcript) return res.status(422).json({ error: "Danışıq aydın eşidilmədi. Yenidən danış." });
    res.json({ ok: true, text: transcript, language: data?.language || null });
  } catch (error) {
    console.error("transcribe error:", error);
    res.status(500).json({ error: "Səs faylı emal edilərkən xəta baş verdi." });
  }
});

/* Optional authenticated history endpoint. Requires a chat_history table:
   user_id uuid, role text, content text, created_at timestamptz default now(). */
app.post("/api/history", async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: "Supabase hələ konfiqurasiya edilməyib." });
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "Giriş tokeni tələb olunur." });

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user) return res.status(401).json({ error: "Sessiya etibarsızdır." });

    const role = req.body?.role;
    const content = String(req.body?.content || "").trim();
    if (!["user", "assistant"].includes(role) || !content) {
      return res.status(400).json({ error: "Tarix məlumatı düzgün deyil." });
    }
    const { error } = await userClient.from("chat_history").insert({
      user_id: userData.user.id,
      role,
      content: content.slice(0, 8000)
    });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true });
  } catch (error) {
    console.error("history error:", error);
    res.status(500).json({ error: "Söhbət tarixçəsi yadda saxlanmadı." });
  }
});

app.use("/api", (_req, res) => res.status(404).json({ error: "API ünvanı tapılmadı." }));
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Server xətası baş verdi." });
});

app.listen(PORT, () => console.log(`F2 JARVIS server listening on ${PORT}`));
