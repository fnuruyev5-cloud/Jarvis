import express from "express";
import dotenv from "dotenv";
import multer from "multer";
import { EdgeTTS } from "@andresaya/edge-tts";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 3000);

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const GROQ_STT_MODEL = process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo";
const FREE_TTS_PROVIDER = "Microsoft Edge Neural TTS";
const EDGE_VOICES = {
  az: "az-AZ-BabekNeural",
  tr: "tr-TR-AhmetNeural",
  en: "en-US-GuyNeural",
  ru: "ru-RU-DmitryNeural",
  de: "de-DE-ConradNeural",
  fr: "fr-FR-HenriNeural",
  es: "es-ES-AlvaroNeural",
  it: "it-IT-DiegoNeural",
  pt: "pt-BR-AntonioNeural",
  ar: "ar-SA-HamedNeural"
};

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname, { extensions: ["html"] }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

const SYSTEM_PROMPT = `Sən F2 JARVIS adlı ağıllı, faydalı və nəzakətli AI köməkçisisən.
İstifadəçinin yazdığı və ya danışdığı dildə cavab ver. Azərbaycan dilində aydın, təbii və düzgün yaz.
Cavabları konkret və faydalı et. İstifadəçi başqa dilə keçərsə, həmin dilə uyğunlaş.
Əgər "Səni kim yaradıb?" deyə soruşsalar, dəqiq belə cavab ver: "Məni F2 Fərid yaradıb."
Özünü ChatGPT və ya başqa məhsul kimi təqdim etmə; adın F2 JARVIS-dir.
Bilmədiyin faktı uydurma.`;

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    name: "F2 JARVIS",
    aiConfigured: Boolean(GROQ_API_KEY),
    aiProvider: "Groq",
    model: GROQ_MODEL,
    transcriptionConfigured: Boolean(GROQ_API_KEY),
    voiceConfigured: true,
    voiceProvider: FREE_TTS_PROVIDER,
    voiceModel: "Neural voices (no API key)"
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    if (!GROQ_API_KEY) {
      return res.status(503).json({ error: "Groq API açarı Render Environment-də əlavə edilməyib." });
    }

    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const safeMessages = messages
      .filter(m => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
      .slice(-12)
      .map(m => ({ role: m.role, content: m.content.slice(0, 6000) }));

    if (!safeMessages.length || safeMessages.at(-1).role !== "user") {
      return res.status(400).json({ error: "Mesaj tapılmadı." });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...safeMessages],
        temperature: 0.7,
        max_tokens: 1200
      }),
      signal: AbortSignal.timeout(60000)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Groq error:", data);
      return res.status(response.status).json({
        error: data?.error?.message || "AI cavabı alınmadı."
      });
    }

    const answer = data?.choices?.[0]?.message?.content?.trim();
    if (!answer) return res.status(502).json({ error: "AI boş cavab qaytardı." });
    res.json({ answer });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "AI sorğusu zamanı xəta baş verdi." });
  }
});

app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!GROQ_API_KEY) {
      return res.status(503).json({ error: "Səsin mətnə çevrilməsi üçün Groq API açarı lazımdır." });
    }
    if (!req.file) return res.status(400).json({ error: "Səs faylı göndərilməyib." });

    const form = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype || "audio/webm" });
    form.append("file", blob, req.file.originalname || "recording.webm");
    form.append("model", GROQ_STT_MODEL);
    form.append("response_format", "json");

    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${GROQ_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(90000)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Groq transcription error:", data);
      return res.status(response.status).json({ error: data?.error?.message || "Səs tanınmadı." });
    }
    res.json({ text: data.text || "" });
  } catch (error) {
    console.error("Transcription error:", error);
    res.status(500).json({ error: "Səs emalı zamanı xəta baş verdi." });
  }
});

app.post("/api/speak", async (req, res) => {
  try {
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    const languageCode = typeof req.body?.languageCode === "string" ? req.body.languageCode.toLowerCase() : "az";
    if (!text) return res.status(400).json({ error: "Danışdırılacaq mətn boşdur." });
    if (text.length > 4500) return res.status(400).json({ error: "Mətn çox uzundur. 4500 simvoldan qısa göndərin." });

    const lang = languageCode.split("-")[0].split("_")[0];
    const voice = EDGE_VOICES[lang] || EDGE_VOICES.az;
    const tts = new EdgeTTS();
    const audioResult = await tts.generate(text, voice, {
      pitch: -8,
      rate: "-5%",
      volume: "90%",
      outputFormat: "audio-24khz-96kbitrate-mono-mp3",
      timeout: 45000
    });

    if (!audioResult?.audio?.length) {
      return res.status(502).json({ error: "Pulsuz səs xidməti audio qaytarmadı. Bir az sonra yenidən yoxla." });
    }

    const audio = Buffer.from(audioResult.audio);
    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audio.length),
      "Cache-Control": "no-store"
    });
    res.send(audio);
  } catch (error) {
    console.error("Free TTS error:", error);
    res.status(502).json({
      error: "Pulsuz səs xidməti hazırda cavab vermir. Mətn cavabı söhbətdə qalır."
    });
  }
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "API route tapılmadı." });
  res.sendFile(path.join(__dirname, "index.html"), err => err && next(err));
});

app.use((err, _req, res, _next) => {
  console.error("Server error:", err);
  res.status(err.status || 500).json({ error: err.message || "Server xətası." });
});

app.listen(PORT, () => console.log(`F2 JARVIS server listening on ${PORT}`));
