import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const GROQ_STT_MODEL = process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

app.use((req, res, next) => {
  if (req.path === "/" || req.path.endsWith(".js") || req.path.endsWith(".css")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  }
  next();
});

app.use(express.static(__dirname, {
  index: "index.html",
  dotfiles: "ignore",
  setHeaders(res, filePath) {
    if (filePath.endsWith(".js") || filePath.endsWith(".css") || filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-store");
    }
  }
}));

app.get("/api/health", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({
    ok: true,
    name: "F2 JARVIS",
    aiConfigured: Boolean(GROQ_API_KEY),
    aiProvider: "Groq",
    model: GROQ_MODEL,
    speechRecognition: Boolean(GROQ_API_KEY)
  });
});

const SYSTEM_PROMPT = `
Sən F2 JARVIS adlı şəxsi süni intellekt köməkçisisən.
İstifadəçinin yazdığı və ya danışdığı dildə cavab ver.
Azərbaycan dilində səlis, aydın, təbii və düzgün yaz.
Türk, ingilis, rus və digər dillərdə də həmin dildə cavab ver.
Sakit, ağıllı, nəzakətli, peşəkar və köməksevər ol. Lazımsız uzatma.
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
      .filter(item => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string")
      .map(item => ({ role: item.role, content: item.content.slice(0, 4000) }));

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
      console.error("Groq chat error:", response.status, data?.error?.message || data);
      const detail = data?.error?.message || "Groq sorğusu uğursuz oldu.";
      return res.status(response.status === 401 ? 502 : response.status).json({
        error: response.status === 401
          ? "Groq API açarı etibarsızdır. Render Environment-də GROQ_API_KEY dəyərini yoxla."
          : response.status === 429
            ? "Groq limitinə çatıldı. Bir az sonra yenidən yoxla."
            : detail
      });
    }

    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) return res.status(502).json({ error: "AI boş cavab qaytardı." });
    res.json({ ok: true, reply });
  } catch (error) {
    console.error("Chat endpoint error:", error);
    res.status(500).json({ error: "AI sorğusu zamanı xəta baş verdi. Render loglarını yoxlamaq lazımdır." });
  }
});

app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!GROQ_API_KEY) {
      return res.status(503).json({ error: "Səs tanıma üçün GROQ_API_KEY qurulmayıb." });
    }
    if (!req.file) return res.status(400).json({ error: "Audio faylı göndərilməyib." });

    const form = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype || "audio/webm" });
    form.append("file", blob, req.file.originalname || "f2-voice.webm");
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
      console.error("Groq transcription error:", response.status, data?.error?.message || data);
      return res.status(response.status).json({
        error: data?.error?.message || "Groq nitq tanıma xidməti cavab vermədi."
      });
    }

    const text = String(data?.text || "").trim();
    if (!text) return res.status(422).json({ error: "Danışıq aydın eşidilmədi. Bir daha danış." });
    res.json({ ok: true, text, language: data?.language || null });
  } catch (error) {
    console.error("Transcription endpoint error:", error);
    res.status(500).json({ error: "Səs faylı emal edilərkən xəta baş verdi." });
  }
});

app.use("/api", (_req, res) => res.status(404).json({ error: "API ünvanı tapılmadı." }));

app.use((error, _req, res, _next) => {
  console.error("Express error:", error);
  if (error?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "Səs faylı 20 MB limitini keçir." });
  }
  res.status(500).json({ error: "Server xətası baş verdi." });
});

app.listen(PORT, () => console.log(`F2 JARVIS server listening on ${PORT}`));
