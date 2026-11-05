
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
app.use(express.json({ limit: "12mb" }));
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
const COMET_CHAT_URL = "https://api.cometapi.com/v1/chat/completions";
const COMET_MODELS_URL = "https://api.cometapi.com/api/models";
const COMET_VIDEO_URL = "https://api.cometapi.com/v1/videos";

const AI_PROVIDER = (
  process.env.AI_PROVIDER || (COMETAPI_KEY ? "claude" : "groq")
).toLowerCase();

const GROQ_STT_MODEL =
  process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo";

const IMAGE_API_KEY = COMETAPI_KEY;
const IMAGE_MODEL =
  process.env.IMAGE_MODEL || "gemini-nano-banana-2.1";

const IMAGE_API_URL = "https://api.cometapi.com/v1beta/models";

const VIDEO_MODEL = process.env.VIDEO_MODEL || "wan3.0-prime";

const FREE_TTS_PROVIDER = "Microsoft Edge Neural TTS";

const REQUEST_TIMEOUT = 120000;

// ==========================================
// MODEL FALLBACK CATALOG
// ==========================================

const FALLBACK_MODELS = [
  { id: "hy4", name: "Hy 4", type: "chat" },
  { id: "gpt-6.2-sol", name: "GPT 6.2 Sol", type: "chat" },
  { id: "gpt-6.1-terra", name: "GPT 6.1 Terra", type: "vision" },
  { id: "kimi-k3.1-pro", name: "Kimi K3.1 Pro", type: "vision" },
  { id: "muse-wonder", name: "Muse Wonder", type: "chat" },
  { id: "claude-haiku-5-5", name: "Claude Haiku 5.5", type: "vision" },
  { id: "gpt-6-luna", name: "GPT-6 Luna", type: "vision" },
  { id: "deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash", type: "chat" },
  { id: "deepseek-v4-flash-vision-exp", name: "DeepSeek V4 Flash Vision", type: "vision" },
  { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", type: "chat" },
  { id: "gpt-image-2.6-sunburst", name: "GPT Image 2.6", type: "image" },
  { id: "gemini-nano-banana-2.1", name: "Gemini Nano Banana", type: "image" },
  { id: "flux-3-image", name: "Flux 3 Image", type: "image" },
  { id: "wan3.0-prime", name: "Wan Video", type: "video" }
];

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

function requireCometKey() {
  if (!COMETAPI_KEY) {
    throw Object.assign(
      new Error("COMETAPI_KEY Render Environment-də əlavə edilməyib."),
      { status: 503 }
    );
  }
}

async function cometRequest(url, options = {}, timeout = REQUEST_TIMEOUT) {
  requireCometKey();

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${COMETAPI_KEY}`,
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(timeout)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      data?.error ||
      `CometAPI xətası: ${response.status}`;

    throw Object.assign(
      new Error(typeof message === "string" ? message : JSON.stringify(message)),
      { status: response.status }
    );
  }

  return data;
}

function getAIStatus() {
  if (AI_PROVIDER === "claude") {
    return {
      configured: Boolean(COMETAPI_KEY),
      provider: "CometAPI",
      model: COMETAPI_MODEL
    };
  }

  return {
    configured: Boolean(GROQ_API_KEY),
    provider: "Groq",
    model: GROQ_MODEL
  };
}

function cleanMessages(messages) {
  return messages
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
}

function getTextAnswer(data) {
  const content = data?.choices?.[0]?.message?.content;

  if (typeof content === "string") return content.trim();

  if (Array.isArray(content)) {
    return content
      .filter(part => part.type === "text" || part.text)
      .map(part => part.text || "")
      .join("\n")
      .trim();
  }

  return "";
}

// ==========================================
// MODEL CATALOG
// ==========================================

let modelCache = [];
let modelCacheTime = 0;

function inferModelType(model) {
  const id = String(model.id || model.name || "").toLowerCase();
  const capabilities = JSON.stringify(
    model.capabilities || model.abilities || model.supported_parameters || []
  ).toLowerCase();

  if (
    id.includes("video") ||
    id.includes("wan3") ||
    id.includes("seedance")
  ) return "video";

  if (
    id.includes("image") ||
    id.includes("nano-banana") ||
    id.includes("flux")
  ) return "image";

  if (
    id.includes("vision") ||
    id.includes("flash-vision") ||
    capabilities.includes("vision") ||
    capabilities.includes("image")
  ) return "vision";

  return "chat";
}

function normalizeModelList(data) {
  const list =
    Array.isArray(data) ? data :
    Array.isArray(data?.data) ? data.data :
    Array.isArray(data?.models) ? data.models :
    Array.isArray(data?.result) ? data.result :
    [];

  return list
    .filter(item => item && typeof item === "object")
    .map(item => {
      const id = item.id || item.model || item.name;

      if (!id || typeof id !== "string") return null;

      const type = inferModelType(item);

      return {
        id,
        name: item.display_name || item.title || item.name || id,
        type,
        description: item.description || "",
        available: item.available !== false
      };
    })
    .filter(Boolean)
    .filter(model =>
      !/coming.?soon|deprecated|unavailable/i.test(
        model.name + " " + model.id
      )
    );
}

async function getModels(force = false) {
  if (!COMETAPI_KEY) return FALLBACK_MODELS;

  if (
    !force &&
    modelCache.length &&
    Date.now() - modelCacheTime < 10 * 60 * 1000
  ) {
    return modelCache;
  }

  try {
    const data = await cometRequest(
      COMET_MODELS_URL,
      { method: "GET" },
      30000
    );

    const models = normalizeModelList(data);

    if (models.length) {
      modelCache = models;
      modelCacheTime = Date.now();
      return models;
    }
  } catch (error) {
    console.error("Model catalog error:", error.message);
  }

  return modelCache.length ? modelCache : FALLBACK_MODELS;
}

app.get("/api/models", async (req, res) => {
  try {
    const models = await getModels(req.query.refresh === "1");

    res.json({
      success: true,
      provider: "CometAPI",
      models
    });
  } catch (error) {
    apiError(res, error, "Model siyahısı alına bilmədi.");
  }
});

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
    cometConfigured: Boolean(COMETAPI_KEY),
    transcriptionConfigured: Boolean(GROQ_API_KEY),
    voiceConfigured: true,
    voiceProvider: FREE_TTS_PROVIDER,
    imageGenerationConfigured: Boolean(IMAGE_API_KEY),
    imageProvider: "CometAPI",
    imageModel: IMAGE_MODEL,
    visionConfigured: Boolean(COMETAPI_KEY),
    videoConfigured: Boolean(COMETAPI_KEY),
    videoModel: VIDEO_MODEL
  });
});

// ==========================================
// CLAUDE AI
// ==========================================

async function askClaude(messages) {
  requireCometKey();

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
// COMETAPI MODEL CHAT
// ==========================================

async function askCometModel(messages, model) {
  const data = await cometRequest(
    COMET_CHAT_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 2048
      })
    },
    120000
  );

  const answer = getTextAnswer(data);

  if (!answer) {
    throw Object.assign(
      new Error("CometAPI boş cavab qaytardı."),
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

  const answer = getTextAnswer(data);

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
    const messages = cleanMessages(
      Array.isArray(req.body?.messages) ? req.body.messages : []
    );

    if (!messages.length || messages.at(-1).role !== "user") {
      return res.status(400).json({ error: "Mesaj tapılmadı." });
    }

    const selectedModel =
      typeof req.body?.model === "string"
        ? req.body.model.trim()
        : "";

    let answer;
    let provider;
    let model;

    if (selectedModel) {
      const models = await getModels();
      const selected = models.find(item => item.id === selectedModel);

      if (!selected || !["chat", "vision"].includes(selected.type)) {
        return res.status(400).json({
          error: "Seçilmiş model mövcud deyil və ya mətn söhbətini dəstəkləmir."
        });
      }

      answer = await askCometModel(messages, selectedModel);
      provider = "CometAPI";
      model = selectedModel;
    } else if (AI_PROVIDER === "claude") {
      answer = await askClaude(messages);
      provider = "CometAPI / Claude";
      model = COMETAPI_MODEL;
    } else if (AI_PROVIDER === "groq") {
      answer = await askGroq(messages);
      provider = "Groq";
      model = GROQ_MODEL;
    } else {
      return res.status(500).json({
        error: "AI_PROVIDER üçün claude və ya groq seçilməlidir."
      });
    }

    res.json({ answer, provider, model });
  } catch (error) {
    apiError(res, error, "AI sorğusu zamanı xəta baş verdi.");
  }
});

// ==========================================
// AI CAMERA / VISION
// ==========================================

app.post("/api/vision", async (req, res) => {
  try {
    requireCometKey();

    const image = req.body?.image;
    const prompt = typeof req.body?.prompt === "string"
      ? req.body.prompt.trim()
      : "Bu görüntünü analiz et və Azərbaycan dilində izah et.";

    const model =
      typeof req.body?.model === "string" && req.body.model.trim()
        ? req.body.model.trim()
        : "deepseek-v4-flash-vision-exp";

    if (typeof image !== "string") {
      return res.status(400).json({ error: "Şəkil göndərilməyib." });
    }

    const match = image.match(
      /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/
    );

    if (!match) {
      return res.status(400).json({
        error: "Şəkil JPEG, PNG və ya WEBP base64 formatında olmalıdır."
      });
    }

    if (image.length > 10 * 1024 * 1024) {
      return res.status(413).json({ error: "Şəkil çox böyükdür." });
    }

    if (prompt.length > 3000) {
      return res.status(400).json({ error: "Analiz mətni çox uzundur." });
    }

    const models = await getModels();
    const selected = models.find(item => item.id === model);

    if (selected && selected.type !== "vision") {
      return res.status(400).json({
        error: "Seçilmiş model Vision dəstəkləmir."
      });
    }

    const data = await cometRequest(
      COMET_CHAT_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT
            },
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: { url: image }
                }
              ]
            }
          ],
          max_tokens: 1200,
          temperature: 0.5
        })
      },
      120000
    );

    const answer = getTextAnswer(data);

    if (!answer) {
      throw Object.assign(
        new Error("Vision modeli analiz cavabı qaytarmadı."),
        { status: 502 }
      );
    }

    res.json({
      success: true,
      answer,
      model,
      provider: "CometAPI Vision"
    });
  } catch (error) {
    apiError(res, error, "Kamera görüntüsü analiz edilə bilmədi.");
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
      return res.status(response.status).json({
        success: false,
        error:
          data?.error?.message ||
          data?.message ||
          "Nano Banana şəkil yarada bilmədi."
      });
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(part => part.inlineData?.data);

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

    const mimeType = imagePart.inlineData.mimeType || "image/png";

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
    apiError(res, error, "Şəkil yaradılarkən server xətası baş verdi.");
  }
});

// ==========================================
// AI VIDEO GENERATION
// ==========================================

app.post("/api/videos", async (req, res) => {
  try {
    requireCometKey();

    const prompt = typeof req.body?.prompt === "string"
      ? req.body.prompt.trim()
      : "";

    const seconds = Number(req.body?.seconds || 5);

    const model =
      typeof req.body?.model === "string" && req.body.model.trim()
        ? req.body.model.trim()
        : VIDEO_MODEL;

    if (prompt.length < 3 || prompt.length > 4000) {
      return res.status(400).json({
        error: "Video təsviri 3–4000 simvol arasında olmalıdır."
      });
    }

    if (![5, 10, 15].includes(seconds)) {
      return res.status(400).json({
        error: "Bu interfeysdə video müddəti 5, 10 və ya 15 saniyə ola bilər."
      });
    }

    const models = await getModels();
    const selected = models.find(item => item.id === model);

    i
