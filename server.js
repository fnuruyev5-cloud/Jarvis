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

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));
app.use(express.static(__dirname));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024
  }
});

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const COMETAPI_KEY = process.env.COMETAPI_KEY || "";
const RUNWAY_API_KEY = process.env.RUNWAY_API_KEY || "";

const GROQ_MODEL =
  process.env.GROQ_MODEL || "openai/gpt-oss-120b";

const COMETAPI_MODEL =
  process.env.COMETAPI_MODEL || "claude-haiku-5-5";

const VIDEO_MODEL =
  process.env.VIDEO_MODEL || "wan3.0-prime";

const IMAGE_MODEL =
  process.env.IMAGE_MODEL || "gemini-nano-banana-2.1";

const GROQ_BASE = "https://api.groq.com/openai/v1";
const COMET_BASE = "https://api.cometapi.com";

const RUNWAY_VERSION = "2024-11-06";
const REQUEST_TIMEOUT = 120000;

const SYSTEM_PROMPT = `
Sənin adın F2 JARVIS-dir.
Sən ağıllı, peşəkar və mehriban süni intellekt köməkçisisən.
İstifadəçinin hansı dildə yazdığını müəyyən et və həmin dildə cavab ver.
Cavablarını aydın, faydalı və təbii yaz.
Səndən səni kimin yaratdığını soruşsalar belə cavab ver:
"Məni F2 Fərid yaradıb."
Özünü ChatGPT kimi təqdim etmə.
Bilmədiyin məlumatı uydurma.
`;

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

const videoTasks = new Map();

function sendError(res, status, message, extra = {}) {
  return res.status(status).json({
    ok: false,
    error: message,
    ...extra
  });
}

function getErrorMessage(data, fallback = "API sorğusu uğursuz oldu.") {
  return (
    data?.error?.message ||
    data?.error?.detail ||
    data?.message ||
    data?.detail ||
    fallback
  );
}

async function fetchJson(url, options = {}, timeout = REQUEST_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    const contentType = response.headers.get("content-type") || "";
    let data;

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = { raw: await response.text() };
    }

    if (!response.ok) {
      throw new Error(
        getErrorMessage(data, `Server xətası: ${response.status}`)
      );
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

function authHeaders(key, extra = {}) {
  return {
    Authorization: `Bearer ${key}`,
    ...extra
  };
}

function getChatMessages(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter(item =>
      item &&
      ["user", "assistant", "system"].includes(item.role) &&
      typeof item.content === "string"
    )
    .slice(-30)
    .map(item => ({
      role: item.role,
      content: item.content.slice(0, 20000)
    }));
}

async function askGroq(messages) {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY Render Environment-də tapılmadı.");
  }

  return fetchJson(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: authHeaders(GROQ_API_KEY, {
      "Content-Type": "application/json"
    }),
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 4096
    })
  });
}

async function askComet(messages) {
  if (!COMETAPI_KEY) {
    throw new Error("COMETAPI_KEY Render Environment-də tapılmadı.");
  }

  return fetchJson(`${COMET_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: authHeaders(COMETAPI_KEY, {
      "Content-Type": "application/json"
    }),
    body: JSON.stringify({
      model: COMETAPI_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 4096
    })
  });
}

function extractAnswer(data) {
  return (
    data?.choices?.[0]?.message?.content ||
    data?.content?.map?.(item => item.text || "").join("\n") ||
    data?.output_text ||
    data?.message ||
    ""
  );
}

/* ==========================================
   HEALTH
========================================== */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    name: "F2 JARVIS",
    aiConfigured: Boolean(GROQ_API_KEY || COMETAPI_KEY),
    groqConfigured: Boolean(GROQ_API_KEY),
    cometConfigured: Boolean(COMETAPI_KEY),
    runwayConfigured: Boolean(RUNWAY_API_KEY),
    voiceConfigured: true,
    imageConfigured: Boolean(COMETAPI_KEY),
    videoConfigured: Boolean(COMETAPI_KEY),
    videoEditorConfigured: Boolean(COMETAPI_KEY || RUNWAY_API_KEY),
    timestamp: new Date().toISOString()
  });
});

/* ==========================================
   MODELS
========================================== */

app.get("/api/models", (req, res) => {
  res.json({
    ok: true,
    models: [
      { id: GROQ_MODEL, name: GROQ_MODEL, type: "chat" },
      { id: COMETAPI_MODEL, name: COMETAPI_MODEL, type: "chat" },
      { id: IMAGE_MODEL, name: IMAGE_MODEL, type: "image" },
      { id: VIDEO_MODEL, name: VIDEO_MODEL, type: "video" },
      { id: "gen4_aleph", name: "Runway Aleph", type: "video-edit" },
      { id: "upscale_v1", name: "Runway Upscale", type: "upscale" }
    ]
  });
});

/* ==========================================
   AI CHAT
========================================== */

app.post("/api/chat", async (req, res) => {
  try {
    const messages = getChatMessages(req.body?.messages);

    if (!messages.length) {
      return sendError(res, 400, "Mesaj boş ola bilməz.");
    }

    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.filter(item => item.role !== "system")
    ];

    let data;
    let provider = "";

    if (process.env.AI_PROVIDER === "groq") {
      data = await askGroq(fullMessages);
      provider = "groq";
    } else if (process.env.AI_PROVIDER === "comet") {
      data = await askComet(fullMessages);
      provider = "comet";
    } else {
      try {
        if (COMETAPI_KEY) {
          data = await askComet(fullMessages);
          provider = "comet";
        } else {
          data = await askGroq(fullMessages);
          provider = "groq";
        }
      } catch (firstError) {
        if (GROQ_API_KEY && provider !== "groq") {
          data = await askGroq(fullMessages);
          provider = "groq";
        } else {
          throw firstError;
        }
      }
    }

    const answer = extractAnswer(data);

    if (!answer) {
      throw new Error("AI boş cavab qaytardı.");
    }

    res.json({
      ok: true,
      answer,
      reply: answer,
      provider
    });
  } catch (error) {
    console.error("CHAT ERROR:", error);
    sendError(res, 500, error.message || "AI sorğusu zamanı xəta baş verdi.");
  }
});

/* ==========================================
   CAMERA / VISION
========================================== */

app.post("/api/vision", async (req, res) => {
  try {
    if (!COMETAPI_KEY) {
      return sendError(res, 503, "Kamera analizi üçün COMETAPI_KEY lazımdır.");
    }

    const { image, prompt } = req.body || {};

    if (!image) {
      return sendError(res, 400, "Şəkil göndərilməyib.");
    }

    const imageUrl = image.startsWith("data:")
      ? image
      : `data:image/jpeg;base64,${image}`;

    const data = await fetchJson(`${COMET_BASE}/v1/chat/completions`, {
      method: "POST",
      headers: authHeaders(COMETAPI_KEY, {
        "Content-Type": "application/json"
      }),
      body: JSON.stringify({
        model: COMETAPI_MODEL,
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt || "Bu şəkli diqqətlə analiz et və gördüklərini izah et."
              },
              {
                type: "image_url",
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
        max_tokens: 2000
      })
    });

    const answer = extractAnswer(data);

    res.json({
      ok: true,
      answer,
      reply: answer
    });
  } catch (error) {
    console.error("VISION ERROR:", error);
    sendError(res, 500, error.message || "Şəkil analiz edilə bilmədi.");
  }
});

/* ==========================================
   IMAGE GENERATION
========================================== */

app.post("/api/generate-image", async (req, res) => {
  try {
    if (!COMETAPI_KEY) {
      return sendError(res, 503, "Şəkil yaratmaq üçün COMETAPI_KEY lazımdır.");
    }

    const prompt = String(req.body?.prompt || "").trim();
    const model = String(req.body?.model || IMAGE_MODEL);

    if (prompt.length < 3) {
      return sendError(res, 400, "Şəkil üçün təsvir yaz.");
    }

    const data = await fetchJson(`${COMET_BASE}/v1/images/generations`, {
      method: "POST",
      headers: authHeaders(COMETAPI_KEY, {
        "Content-Type": "application/json"
      }),
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        size: req.body?.size || "1024x1024"
      })
    });

    const item = data?.data?.[0] || data?.images?.[0] || {};
    const imageUrl = item.url || item.image_url || null;
    const base64 = item.b64_json || item.base64 || null;

    res.json({
      ok: true,
      url: imageUrl,
      imageUrl,
      image: base64 ? `data:image/png;base64,${base64}` : null,
      data
    });
  } catch (error) {
    console.error("IMAGE ERROR:", error);
    sendError(res, 500, error.message || "Şəkil yaratmaq mümkün olmadı.");
  }
});

/* ==========================================
   GENERAL VIDEO GENERATION
========================================== */

app.post("/api/videos", async (req, res) => {
  try {
    if (!COMETAPI_KEY) {
      return sendError(res, 503, "Video yaratmaq üçün COMETAPI_KEY lazımdır.");
    }

    const prompt = String(req.body?.prompt || "").trim();
    const model = String(req.body?.model || VIDEO_MODEL);
    const seconds = Number(req.body?.seconds || 5);

    if (prompt.length < 3) {
      return sendError(res, 400, "Video təsviri yazılmalıdır.");
    }

    if (![5, 10, 15].includes(seconds)) {
      return sendError(res, 400, "Video müddəti 5, 10 və ya 15 saniyə olmalıdır.");
    }

    const data = await fetchJson(`${COMET_BASE}/v1/videos`, {
      method: "POST",
      headers: authHeaders(COMETAPI_KEY, {
        "Content-Type": "application/json"
      }),
      body: JSON.stringify({
        model,
        prompt,
        seconds,
        duration: seconds,
        size: req.body?.size || "1280x720"
      })
    });

    const id = data?.id || data?.task_id || data?.data?.id;

    if (!id) {
      return res.json({
        ok: true,
        data,
        message: "Video API cavabı alındı, lakin tapşırıq ID-si qaytarılmadı."
      });
    }

    videoTasks.set(String(id), {
      id: String(id),
      provider: "comet-video",
      status: data.status || "queued",
      createdAt: Date.now()
    });

    res.json({
      ok: true,
      id: String(id),
      jobId: String(id),
      task_id: String(id),
      status: data.status || "queued",
      data
    });
  } catch (error) {
    console.error("VIDEO GENERATION ERROR:", error);
    sendError(res, 500, error.message || "Video yaratmaq mümkün olmadı.");
  }
});

/* ==========================================
   RUNWAY VIDEO INPUT UPLOAD
========================================== */

async function createRunwayVideoUri(file) {
  if (RUNWAY_API_KEY) {
    const createUpload = await fetchJson(
      "https://api.dev.runwayml.com/v1/uploads",
      {
        method: "POST",
        headers: authHeaders(RUNWAY_API_KEY, {
          "Content-Type": "application/json",
          "X-Runway-Version": RUNWAY_VERSION
        }),
        body: JSON.stringify({
          filename: file.originalname || "f2-video.mp4",
          type: "ephemeral"
        })
      }
    );

    if (!createUpload.uploadUrl || !createUpload.fields || !createUpload.runwayUri) {
      throw new Error("Runway upload məlumatları düzgün qaytarılmadı.");
    }

    const form = new FormData();

    for (const [key, value] of Object.entries(createUpload.fields)) {
      form.append(key, String(value));
    }

    form.append(
      "file",
      new Blob([file.buffer], {
        type: file.mimetype || "video/mp4"
      }),
      file.originalname || "f2-video.mp4"
    );

    const uploadResponse = await fetch(createUpload.uploadUrl, {
      method: "POST",
      body: form
    });

    if (!uploadResponse.ok) {
      throw new Error(`Runway fayl yükləmə xətası: ${uploadResponse.status}`);
    }

    return createUpload.runwayUri;
  }

  if (!COMETAPI_KEY) {
    throw new Error("Video redaktəsi üçün RUNWAY_API_KEY və ya COMETAPI_KEY lazımdır.");
  }

  if (file.buffer.length > 5 * 1024 * 1024) {
    throw new Error(
      "CometAPI birbaşa video girişində 5 MB limitinə görə bu fayl böyükdür. RUNWAY_API_KEY əlavə et."
    );
  }

  const mime = file.mimetype || "video/mp4";
  return `data:${mime};base64,${file.buffer.toString("base64")}`;
}

async function runwayRequest(endpoint, body) {
  const useRunway = Boolean(RUNWAY_API_KEY);
  const base = useRunway
    ? "https://api.dev.runwayml.com"
    : `${COMET_BASE}/runwayml`;

  const key = useRunway ? RUNWAY_API_KEY : COMETAPI_KEY;

  if (!key) {
    throw new Error("Runway və ya CometAPI açarı yoxdur.");
  }

  return fetchJson(`${base}${endpoint}`, {
    method: "POST",
    headers: authHeaders(key, {
      "Content-Type": "application/json",
      "X-Runway-Version": RUNWAY_VERSION
    }),
    body: JSON.stringify(body)
  });
}

/* ==========================================
   VIDEO EDITOR — EDIT
========================================== */

app.post("/api/videos/edit", upload.single("video"), async (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, 400, "Redaktə üçün video faylı seçilməyib.");
    }

    const prompt = String(req.body?.prompt || "").trim();

    if (prompt.length < 3) {
      return sendError(res, 400, "Video redaktəsi üçün təsvir yaz.");
    }

    const videoUri = await createRunwayVideoUri(req.file);

    const model = RUNWAY_API_KEY
      ? "aleph2"
      : String(req.body?.model || "gen4_aleph");

    const data = await runwayRequest("/v1/video_to_video", {
      model,
      videoUri,
      promptText: prompt,
      outputFormat: "mp4"
    });

    const id = data?.id || data?.task_id;

    if (!id) {
      return res.json({
        ok: true,
        data,
        message: "Video redaktə sorğusu göndərildi."
      });
    }

    videoTasks.set(String(id), {
      id: String(id),
      provider: "runway",
      status: data.status || "PENDING",
      createdAt: Date.now()
    });

    res.json({
      ok: true,
      id: String(id),
      jobId: String(id),
      task_id: String(id),
      status: data.status || "PENDING",
      data
    });
  } catch (error) {
    console.error("VIDEO EDIT ERROR:", error);
    sendError(res, 500, error.message || "Video redaktəsi baş tutmadı.");
  }
});

/* ==========================================
   VIDEO EDITOR — UPSCALE
========================================== */

app.post("/api/videos/upscale", upload.single("video"), async (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, 400, "Keyfiyyət artırmaq üçün video seçilməyib.");
    }

    const videoUri = await createRunwayVideoUri(req.file);

    const quality = String(req.body?.quality || "4k").toLowerCase();
    const resolution = quality === "720p" ? "720p" :
      quality === "1080p" ? "1k" :
      quality === "2k" ? "2k" : "4k";

    const data = await runwayRequest("/v1/video_upscale", {
      model: "upscale_v1",
      videoUri,
      resolution
    });

    const id = data?.id || data?.task_id;

    if (!id) {
      return res.json({
        ok: true,
        data,
        message: "Video keyfiyyət artırma sorğusu göndərildi."
      });
    }

    videoTasks.set(String(id), {
      id: String(id),
      provider: "runway",
      status: data.status || "PENDING",
      createdAt: Date.now()
    });

    res.json({
      ok: true,
      id: String(id),
      jobId: String(id),
      task_id: String(id),
      status: data.status || "PENDING",
      data
    });
  } catch (error) {
    console.error("VIDEO UPSCALE ERROR:", error);
    sendError(res, 500, error.message || "Video keyfiyyəti artırıla bilmədi.");
  }
});

/* ==========================================
   VIDEO TASK STATUS
========================================== */

app.get("/api/videos/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const task = videoTasks.get(id);

    if (!task) {
      return sendError(res, 404, "Video tapşırığı tapılmadı.");
    }

    let data;

    if (task.provider === "runway") {
      const useRunway = Boolean(RUNWAY_API_KEY);
      const base = useRunway
        ? "https://api.dev.runwayml.com"
        : `${COMET_BASE}/runwayml`;

      const key = useRunway ? RUNWAY_API_KEY : COMETAPI_KEY;

      data = await fetchJson(`${base}/v1/tasks/${encodeURIComponent(id)}`, {
        method: "GET",
        headers: authHeaders(key, {
          "X-Runway-Version": RUNWAY_VERSION
        })
      });
    } else {
      data = await fetchJson(
        `${COMET_BASE}/v1/videos/${encodeURIComponent(id)}`,
        {
          method: "GET",
          headers: authHeaders(COMETAPI_KEY)
        }
      );
    }

    const status = String(
      data?.status || data?.task_status || data?.state || "processing"
    ).toLowerCase();

    const output =
      data?.output ||
      data?.outputs ||
      data?.result ||
      data?.data?.output ||
      data?.data?.result ||
      null;

    const videoUrl =
      data?.videoUrl ||
      data?.video_url ||
      data?.url ||
      (Array.isArray(output) ? output[0] : output);

    const normalizedStatus =
      ["succeeded", "success", "completed", "complete"].includes(status)
        ? "completed"
        : ["failed", "error", "cancelled"].includes(status)
          ? "failed"
          : "processing";

    videoTasks.set(id, {
      ...task,
      status: normalizedStatus,
      updatedAt: Date.now()
    });

    res.json({
      ok: true,
      id,
      status: normalizedStatus,
      videoUrl: typeof videoUrl === "string" ? videoUrl : null,
      video_url: typeof videoUrl === "string" ? videoUrl : null,
      output,
      error: data?.error || null,
      data
    });
  } catch (error) {
    console.error("VIDEO STATUS ERROR:", error);
    sendError(res, 500, error.message || "Video statusu yoxlanıla bilmədi.");
  }
});

/* ==========================================
   SPEECH TO TEXT — GROQ WHISPER
========================================== */

app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!GROQ_API_KEY) {
      return sendError(res, 503, "Səs tanıma üçün GROQ_API_KEY lazımdır.");
    }

    if (!req.file) {
      return sendError(res, 400, "Audio faylı göndərilməyib.");
    }

    const form = new FormData();

    form.append(
      "file",
      new Blob([req.file.buffer], {
        type: req.file.mimetype || "audio/webm"
      }),
      req.file.originalname || "recording.webm"
    );

    form.append(
      "model",
      process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo"
    );

    form.append("response_format", "json");

    const dat
