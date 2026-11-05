
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

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname, { extensions: ["html"] }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

// ==========================================
// API CONFIGURATION
// ==========================================

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

const COMETAPI_KEY = process.env.COMETAPI_KEY;
const COMETAPI_MODEL = process.env.COMETAPI_MODEL || "claude-haiku-5-5";
const COMETAPI_URL = "https://api.cometapi.com/v1/messages";

const AI_PROVIDER = (
  process.env.AI_PROVIDER || (COMETAPI_KEY ? "claude" : "groq")
).toLowerCase();

const GROQ_STT_MODEL =
  process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo";

const IMAGE_API_KEY = process.env.COMETAPI_KEY;
const IMAGE_MODEL =
  process.env.IMAGE_MODEL || "gemini-nano-banana-2.1";

const IMAGE_API_URL = "https://api.cometapi.com/v1beta/models";

const FREE_TTS_PROVIDER = "Microsoft Edge Neural TTS";

// ==========================================
// VOICES
// ==========================================

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

// ==========================================
// SYSTEM PROMPT
// ==========================================

const SYSTEM_PROMPT = `Sən F2 JARVIS adlı ağıllı, faydalı və nəzakətli AI köməkçisisən.
İstifadəçinin yazdığı və ya danışdığı dildə cavab ver.
Azərbaycan dilində aydın, təbii və düzgün yaz.
Cavabları konkret və faydalı et.
İstifadəçi başqa dilə keçərsə, həmin dilə uyğunlaş.
Əgər "Səni kim yaradıb?" deyə soruşsalar, dəqiq belə cavab ver:
"Məni F2 Fərid yaradıb."
Özünü ChatGPT və ya başqa məhsul kimi təqdim etmə.
Adın F2 JARVIS-dir.
Bilmədiyin faktı uydurma.`;

// ==========================================
// HELPERS
// ==========================================

function apiError(res, error, fallback = "Server xətası.") {
  console.error(error);

  return res.status(error.status || 500).json({
    error: error.message || fallback
  });
}

function getAIStatus() {
  if (AI_PROVIDER === "claude") {
    return {
      configured: Boolean(COMETAPI_KEY),
      provider: "CometAPI / Claude",
      model: COMETAPI_MODEL
    };
  }

  return {
    configured: Boolean(GROQ_API_KEY),
    provider: "Groq",
    model: GROQ_MODEL
  };
}

// ==========================================
// HEALTH API
// ==========================================

app.get("/api/health", (_req, res) => {
  const ai = getAIStatus();

  res.json({
    ok: true,
    name: "F2 JARVIS",
    aiConfigured: ai.configured,
    aiProvider: ai.provider,
    model: ai.model,
    groqConfigured: Boolean(GROQ_API_KEY),
    claudeConfigured: Boolean(COMETAPI_KEY),
    transcriptionConfigured: Boolean(GROQ_API_KEY),
    voiceConfigured: true,
    voiceProvider: FREE_TTS_PROVIDER,
    imageGenerationConfigured: Boolean(IMAGE_API_KEY),
    imageProvider: "CometAPI / Gemini Nano Banana",
    imageModel: IMAGE_MODEL
  });
});

// ==========================================
// CLAUDE AI
// ==========================================

async function askClaude(messages) {
  if (!COMETAPI_KEY) {
    throw Object.assign(
      new Error("COMETAPI_KEY Render Environment-də əlavə edilməyib."),
      { status: 503 }
    );
  }

  const response = await fetch(COMETAPI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${COMETAPI_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: COMETAPI_MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages
    }),
    signal: AbortSignal.timeout(90000)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw Object.assign(
      new Error(
        data?.error?.message ||
        data?.message ||
        "Claude API cavab vermədi."
      ),
      { status: response.status }
    );
  }

  const answer = Array.isArray(data?.content)
    ? data.content
        .filter(block => block.type === "text")
        .map(block => block.text)
        .join("\n")
        .trim()
    : typeof data?.content === "string"
      ? data.content.trim()
      : "";

  if (!answer) {
    throw Object.assign(
      new Error("Claude boş cavab qaytardı."),
      { status: 502 }
    );
  }

  return answer;
}

// ==========================================
// GROQ AI
// ==========================================

async function askGroq(messages) {
  if (!GROQ_API_KEY) {
    throw Object.assign(
      new Error("GROQ_API_KEY Render Environment-də əlavə edilməyib."),
      { status: 503 }
    );
  }

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 1200
      }),
      signal: AbortSignal.timeout(60000)
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw Object.assign(
      new Error(data?.error?.message || "Groq AI cavabı alınmadı."),
      { status: response.status }
    );
  }

  const answer = data?.choices?.[0]?.message?.content?.trim();

  if (!answer) {
    throw Object.assign(
      new Error("Groq boş cavab qaytardı."),
      { status: 502 }
    );
  }

  return answer;
}

// ==========================================
// MAIN CHAT API
// ==========================================

app.post("/api/chat", async (req, res) => {
  try {
    const messages = Array.isArray(req.body?.messages)
      ? req.body.messages
      : [];

    const safeMessages = messages
      .filter(m =>
        m &&
        ["user", "assistant"].includes(m.role) &&
        typeof m.content === "string"
      )
      .slice(-12)
      .map(m => ({
        role: m.role,
        content: m.content.slice(0, 6000)
      }));

    if (
      !safeMessages.length ||
      safeMessages.at(-1).role !== "user"
    ) {
      return res.status(400).json({
        error: "Mesaj tapılmadı."
      });
    }

    let answer;

    if (AI_PROVIDER === "claude") {
      answer = await askClaude(safeMessages);
    } else if (AI_PROVIDER === "groq") {
      answer = await askGroq(safeMessages);
    } else {
      return res.status(500).json({
        error: "AI_PROVIDER üçün claude və ya groq seçilməlidir."
      });
    }

    res.json({
      answer,
      provider: AI_PROVIDER,
      model: AI_PROVIDER === "claude"
        ? COMETAPI_MODEL
        : GROQ_MODEL
    });
  } catch (error) {
    return apiError(res, error, "AI sorğusu zamanı xəta baş verdi.");
  }
});

// ==========================================
// NANO BANANA IMAGE GENERATION
// ==========================================

app.post("/api/generate-image", async (req, res) => {
  try {
    if (!IMAGE_API_KEY) {
      return res.status(503).json({
        success: false,
        error: "COMETAPI_KEY Render Environment-də əlavə edilməyib."
      });
    }

    const prompt = typeof req.body?.prompt === "string"
      ? req.body.prompt.trim()
      : "";

    if (prompt.length < 3) {
      return res.status(400).json({
        success: false,
        error: "Şəkil yaratmaq üçün təsvir yaz."
      });
    }

    if (prompt.length > 4000) {
      return res.status(400).json({
        success: false,
        error: "Təsvir maksimum 4000 simvol ola bilər."
      });
    }

    const response = await fetch(
      `${IMAGE_API_URL}/${IMAGE_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": IMAGE_API_KEY
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"]
          }
        }),
        signal: AbortSignal.timeout(180000)
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Nano Banana API error:", data);

      return res.status(response.status).json({
        success: false,
        error:
          data?.error?.message ||
          data?.message ||
          "Nano Banana şəkil yarada bilmədi."
      });
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];

    const imagePart = parts.find(
      part => part.inlineData?.data
    );

    const description = parts
      .filter(part => typeof part.text === "string")
      .map(part => part.text)
      .join("\n");

    if (!imagePart) {
      return res.status(502).json({
        success: false,
        error: "API şəkil qaytarmadı.",
        details: description || "Şəkil məlumatı tapılmadı."
      });
    }

    const mimeType =
      imagePart.inlineData.mimeType || "image/png";

    if (!["image/png", "image/jpeg", "image/webp"].includes(mimeType)) {
      return res.status(502).json({
        success: false,
        error: "Dəstəklənməyən şəkil formatı."
      });
    }

    res.json({
      success: true,
      provider: "CometAPI / Gemini Nano Banana",
      model: IMAGE_MODEL,
      image: `data:${mimeType};base64,${imagePart.inlineData.data}`,
      mimeType,
      description
    });

  } catch (error) {
    console.error("Image generation error:", error);

    const timedOut =
      error.name === "TimeoutError" ||
      error.name === "AbortError";

    res.status(timedOut ? 504 : 500).json({
      success: false,
      error: timedOut
        ? "Şəkil yaratma vaxtı bitdi. Yenidən yoxla."
        : "Şəkil yaradılarkən server xətası baş verdi."
    });
  }
});

// ==========================================
// GROQ WHISPER SPEECH TO TEXT
// ==========================================

app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!GROQ_API_KEY) {
      return res.status(503).json({
        error: "GROQ_API_KEY əlavə edilməyib."
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "Səs faylı göndərilməyib."
      });
    }

    const form = new FormData();

    const blob = new Blob(
      [req.file.buffer],
      { type: req.file.mimetype || "audio/webm" }
    );

    form.append(
      "file",
      blob,
      req.file.originalname || "recording.webm"
    );

    form.append("model", GROQ_STT_MODEL);
    form.append("response_format", "json");

    const response = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`
        },
        body: form,
        signal: AbortSignal.timeout(90000)
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Səs tanınmadı."
      });
    }

    res.json({
      text: data.text || ""
    });

  } catch (error) {
    return apiError(res, error, "Səs emalı zamanı xəta baş verdi.");
  }
});

// ==========================================
// EDGE NEURAL TEXT TO SPEECH
// ==========================================

app.post("/api/speak", async (req, res) => {
  try {
    const text = typeof req.body?.text === "string"
      ? req.body.text.trim()
      : "";

    const languageCode =
      typeof req.body?.languageCode === "string"
        ? req.body.languageCode.toLowerCase()
        : "az";

    if (!text) {
      return res.status(400).json({
        error: "Danışdırılacaq mətn boşdur."
      });
    }

    if (text.length > 4500) {
      return res.status(400).json({
        error: "Mətn maksimum 4500 simvol ola bilər."
      });
    }

    const lang = languageCode.split("-")[0].split("_")[0];
    const voice = EDGE_VOICES[lang] || EDGE_VOICES.az;

    const tts = new EdgeTTS();

    const audioResult = await tts.generate(text, voice, {
      pitch: -10,
      rate: "+5%",
      volume: "100%",
      outputFormat: "audio-24khz-96kbitrate-mono-mp3",
      timeout: 45000
    });

    if (!audioResult?.audio?.length) {
      return res.status(502).json({
        error: "Səs xidməti audio qaytarmadı."
      });
    }

    const audio = Buffer.from(audioResult.audio);

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audio.length),
      "Cache-Control": "no-store"
    });

    res.send(audio);

  } catch (error) {
    return apiError(res, error, "Səs xidməti hazırda cavab vermir.");
  }
});

// ==========================================
// FALLBACK
// ==========================================

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      error: "API route tapılmadı."
    });
  }

  res.sendFile(
    path.join(__dirname, "index.html"),
    err => err && next(err)
  );
});

// ==========================================
// GLOBAL ERROR HANDLER
// ==========================================

app.use((err, _req, res, _next) => {
  console.error("Server error:", err);

  res.status(err.status || 500).json({
    error: err.message || "Server xətası."
  });
});

// ==========================================
// START
// ==========================================

app.listen(PORT, () => {
  console.log(`F2 JARVIS server listening on ${PORT}`);
  console.log(`AI Provider: ${AI_PROVIDER}`);
  console.log(`Image Provider: CometAPI / ${IMAGE_MODEL}`);
});
        
