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
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));
app.use(express.static(__dirname));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }
});

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const COMETAPI_KEY = process.env.COMETAPI_KEY || "";
const RUNWAY_API_KEY = process.env.RUNWAY_API_KEY || "";
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const GROQ_STT_MODEL = process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo";
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
const COMETAPI_MODEL = process.env.COMETAPI_MODEL || "claude-haiku-5-5";
const VIDEO_MODEL = process.env.VIDEO_MODEL || "wan3.0-prime";
const IMAGE_MODEL = process.env.IMAGE_MODEL || "gemini-nano-banana-2.1";
const GROQ_BASE = "https://api.groq.com/openai/v1";
const COMET_BASE = "https://api.cometapi.com";
const RUNWAY_VERSION = "2024-11-06";
const REQUEST_TIMEOUT = 120000;
const videoTasks = new Map();

const SYSTEM_PROMPT = `
Sənin adın F2 JARVIS-dir. Sən peşəkar, mehriban və faydalı süni intellekt köməkçisisən.
İstifadəçinin yazdığı dildə cavab ver. Əvvəlki söhbət kontekstini nəzərə al.
Aydın və təbii cavab ver, bilmədiyin məlumatı uydurma.
Səndən səni kimin yaratdığını soruşsalar: "Məni F2 Fərid yaradıb."
Özünü ChatGPT kimi təqdim etmə.
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

function sendError(res, status, message, extra = {}) {
  return res.status(status).json({ ok: false, error: message, ...extra });
}

function errorText(data, fallback = "API sorğusu uğursuz oldu.") {
  return data?.error?.message || data?.error?.detail ||
    data?.message || data?.detail || fallback;
}

async function requestJson(url, options = {}, timeout = REQUEST_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const type = response.headers.get("content-type") || "";
    const data = type.includes("application/json")
      ? await response.json()
      : { raw: await response.text() };
    if (!response.ok) {
      throw new Error(errorText(data, `API xətası: ${response.status}`));
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function bearer(key, extra = {}) {
  return { Authorization: `Bearer ${key}`, ...extra };
}

function safeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(m => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
    .slice(-40)
    .map(m => ({ role: m.role, content: m.content.slice(0, 20000) }));
}

function extractText(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) return content.map(x => x.text || "").join("\n").trim();
  if (Array.isArray(data?.content)) return data.content.map(x => x.text || "").join("\n").trim();
  return String(data?.output_text || data?.message || "").trim();
}

async function groqChat(messages) {
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY Render Environment-də yoxdur.");
  return requestJson(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: bearer(GROQ_API_KEY, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      temperature: 0.7,
      max_tokens: 4096
    })
  });
}

async function cometChat(messages) {
  if (!COMETAPI_KEY) throw new Error("COMETAPI_KEY Render Environment-də yoxdur.");
  return requestJson(`${COMET_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: bearer(COMETAPI_KEY, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      model: COMETAPI_MODEL,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      temperature: 0.7,
      max_tokens: 4096
    })
  });
}

/* HEALTH */
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    name: "F2 JARVIS",
    aiConfigured: Boolean(GROQ_API_KEY || COMETAPI_KEY),
    groqConfigured: Boolean(GROQ_API_KEY),
    cometConfigured: Boolean(COMETAPI_KEY),
    runwayConfigured: Boolean(RUNWAY_API_KEY),
    voiceConfigured: Boolean(GROQ_API_KEY),
    imageConfigured: Boolean(COMETAPI_KEY),
    videoConfigured: Boolean(COMETAPI_KEY),
    videoEditorConfigured: Boolean(RUNWAY_API_KEY || COMETAPI_KEY),
    history: "browser-local-storage"
  });
});

/* MODEL LIST */
app.get("/api/models", (_req, res) => {
  res.json({
    ok: true,
    models: [
      { id: GROQ_MODEL, name: GROQ_MODEL, type: "chat" },
      { id: IMAGE_MODEL, name: IMAGE_MODEL, type: "image" },
      { id: VIDEO_MODEL, name: VIDEO_MODEL, type: "video" },
      { id: "gen4_aleph", name: "Runway Aleph", type: "video-edit" },
      { id: "upscale_v1", name: "Video Upscale", type: "upscale" }
    ]
  });
});

/* CHAT */
app.post("/api/chat", async (req, res) => {
  try {
    const messages = safeMessages(req.body?.messages);
    if (!messages.length) return sendError(res, 400, "Mesaj boş ola bilməz.");

    let data;
    let provider;
    const preference = String(process.env.AI_PROVIDER || "auto").toLowerCase();

    if (preference === "groq") {
      data = await groqChat(messages);
      provider = "groq";
    } else if (preference === "comet") {
      data = await cometChat(messages);
      provider = "comet";
    } else if (COMETAPI_KEY) {
      try {
        data = await cometChat(messages);
        provider = "comet";
      } catch (err) {
        if (!GROQ_API_KEY) throw err;
        console.warn("CometAPI failed; trying Groq:", err.message);
        data = await groqChat(messages);
        provider = "groq";
      }
    } else {
      data = await groqChat(messages);
      provider = "groq";
    }

    const answer = extractText(data);
    if (!answer) throw new Error("AI boş cavab qaytardı.");
    res.json({ ok: true, answer, reply: answer, provider });
  } catch (err) {
    console.error("CHAT ERROR:", err);
    sendError(res, 502, err.message || "AI cavabı alınmadı.");
  }
});

/* CAMERA / IMAGE VISION — Groq vision */
app.post("/api/vision", async (req, res) => {
  try {
    if (!GROQ_API_KEY) return sendError(res, 503, "Kamera analizi üçün GROQ_API_KEY lazımdır.");
    const image = req.body?.image;
    const prompt = String(req.body?.prompt || "Bu görüntünü təsvir et.").slice(0, 2500);
    if (typeof image !== "string" || !/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(image)) {
      return sendError(res, 400, "Şəkil düzgün formatda göndərilməyib.");
    }
    if (image.length > 11000000) return sendError(res, 413, "Şəkil çox böyükdür.");
    const data = await requestJson(`${GROQ_BASE}/chat/completions`, {
      method: "POST",
      headers: bearer(GROQ_API_KEY, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        model: GROQ_VISION_MODEL,
        temperature: 0.25,
        max_tokens: 1200,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: image } }
          ]
        }]
      })
    });
    const answer = extractText(data);
    if (!answer) throw new Error("Vision modeli boş cavab qaytardı.");
    res.json({ ok: true, answer, reply: answer });
  } catch (err) {
    console.error("VISION ERROR:", err);
    sendError(res, 502, err.message || "Görüntü analiz edilə bilmədi.");
  }
});

/* IMAGE GENERATION */
app.post("/api/generate-image", async (req, res) => {
  try {
    if (!COMETAPI_KEY) return sendError(res, 503, "Şəkil yaratmaq üçün COMETAPI_KEY lazımdır.");
    const prompt = String(req.body?.prompt || "").trim();
    if (prompt.length < 3) return sendError(res, 400, "Şəkil təsviri yaz.");
    const model = String(req.body?.model || IMAGE_MODEL);
    const data = await requestJson(`${COMET_BASE}/v1/images/generations`, {
      method: "POST",
      headers: bearer(COMETAPI_KEY, { "Content-Type": "application/json" }),
      body: JSON.stringify({ model, prompt, n: 1, size: req.body?.size || "1024x1024" })
    });
    const item = data?.data?.[0] || data?.images?.[0] || data?.result || {};
    const imageUrl = item?.url || item?.image_url || data?.url || data?.image_url || null;
    const b64 = item?.b64_json || item?.base64 || null;
    res.json({ ok: true, url: imageUrl, imageUrl, image: b64 ? `data:image/png;base64,${b64}` : null, data });
  } catch (err) {
    console.error("IMAGE ERROR:", err);
    sendError(res, 502, err.message || "Şəkil yaratmaq mümkün olmadı.");
  }
});

/* GENERAL VIDEO GENERATION */
app.post("/api/videos", async (req, res) => {
  try {
    if (!COMETAPI_KEY) return sendError(res, 503, "Video yaratmaq üçün COMETAPI_KEY lazımdır.");
    const prompt = String(req.body?.prompt || "").trim();
    const seconds = Number(req.body?.seconds || 5);
    const model = String(req.body?.model || VIDEO_MODEL);
    if (prompt.length < 3) return sendError(res, 400, "Video təsviri yaz.");
    if (![5, 10, 15].includes(seconds)) return sendError(res, 400, "Müddət 5, 10 və ya 15 saniyə olmalıdır.");

    const videoForm = new FormData();
    videoForm.append("model", model);
    videoForm.append("prompt", prompt);
    videoForm.append("seconds", String(seconds));
    videoForm.append("size", String(req.body?.size || "1280x720"));

    const data = await requestJson(`${COMET_BASE}/v1/videos`, {
      method: "POST",
      headers: bearer(COMETAPI_KEY),
      body: videoForm
    });
    const id = data?.id || data?.task_id || data?.data?.id;
    const immediateUrl = data?.videoUrl || data?.video_url || data?.url;
    if (id) videoTasks.set(String(id), { id: String(id), provider: "comet-video", createdAt: Date.now() });
    res.json({ ok: true, id: id ? String(id) : null, jobId: id ? String(id) : null, task_id: id ? String(id) : null, videoUrl: immediateUrl || null, video_url: immediateUrl || null, status: data?.status || (immediateUrl ? "completed" : "processing"), data });
  } catch (err) {
    console.error("VIDEO CREATE ERROR:", err);
    sendError(res, 502, err.message || "Video yaratma sorğusu uğursuz oldu.");
  }
});

/* Runway upload: returns a provider-hosted URI, not a browser file path. */
async function uploadVideoToRunway(file) {
  if (RUNWAY_API_KEY) {
    const uploadInfo = await requestJson("https://api.dev.runwayml.com/v1/uploads", {
      method: "POST",
      headers: bearer(RUNWAY_API_KEY, {
        "Content-Type": "application/json",
        "X-Runway-Version": RUNWAY_VERSION
      }),
      body: JSON.stringify({ filename: file.originalname || "f2-video.mp4", type: "ephemeral" })
    });
    const uploadUrl = uploadInfo.uploadUrl || uploadInfo.upload_url;
    const fields = uploadInfo.fields || {};
    const runwayUri = uploadInfo.runwayUri || uploadInfo.uri;
    if (!uploadUrl || !runwayUri) throw new Error("Runway upload URL/URI cavabı natamamdır.");
    const formData = new FormData();
    Object.entries(fields).forEach(([k, v]) => formData.append(k, String(v)));
    formData.append("file", new Blob([file.buffer], { type: file.mimetype || "video/mp4" }), file.originalname || "f2-video.mp4");
    const uploaded = await fetch(uploadUrl, { method: "POST", body: formData });
    if (!uploaded.ok) throw new Error(`Runway-a video yüklənmədi (${uploaded.status}).`);
    return runwayUri;
  }
  if (file.buffer.length > 5 * 1024 * 1024) {
    throw new Error("CometAPI data URI üçün video 5 MB-dan kiçik olmalıdır. Böyük fayl üçün RUNWAY_API_KEY əlavə et.");
  }
  if (!COMETAPI_KEY) throw new Error("Video redaktəsi üçün RUNWAY_API_KEY və ya COMETAPI_KEY lazımdır.");
  return `data:${file.mimetype || "video/mp4"};base64,${file.buffer.toString("base64")}`;
}

async function createRunwayTask(pathname, body) {
  const direct = Boolean(RUNWAY_API_KEY);
  const base = direct ? "https://api.dev.runwayml.com" : `${COMET_BASE}/runwayml`;
  const key = direct ? RUNWAY_API_KEY : COMETAPI_KEY;
  return requestJson(`${base}${pathname}`, {
    method: "POST",
    headers: bearer(key, { "Content-Type": "application/json", "X-Runway-Version": RUNWAY_VERSION }),
    body: JSON.stringify(body)
  });
}

/* VIDEO EDIT */
app.post("/api/videos/edit", upload.single("video"), async (req, res) => {
  try {
    if (!req.file) return sendError(res, 400, "Redaktə üçün video faylı seçilməyib.");
    const promptText = String(req.body?.prompt || "").trim();
    if (promptText.length < 3) return sendError(res, 400, "Redaktə təsviri yaz.");
    const videoUri = await uploadVideoToRunway(req.file);
    const model = RUNWAY_API_KEY ? "gen4_aleph" : String(req.body?.model || "gen4_aleph");
    const data = await createRunwayTask("/v1/video_to_video", { model, videoUri, promptText });
    const id = data?.id || data?.task_id;
    if (id) videoTasks.set(String(id), { id: String(id), provider: RUNWAY_API_KEY ? "runway" : "comet-runway", createdAt: Date.now() });
    res.json({ ok: true, id: id ? String(id) : null, jobId: id ? String(id) : null, task_id: id ? String(id) : null, videoUrl: data?.videoUrl || data?.video_url || null, status: data?.status || "processing", data });
  } catch (err) {
    console.error("VIDEO EDIT ERROR:", err);
    sendError(res, 502, err.message || "Video redaktəsi baş tutmadı.");
  }
});

/* VIDEO UPSCALE */
app.post("/api/videos/upscale", upload.single("video"), async (req, res) => {
  try {
    if (!req.file) return sendError(res, 400, "Keyfiyyət artırmaq üçün video seçilməyib.");
    const videoUri = await uploadVideoToRunway(req.file);
    const requested = String(req.body?.quality || "4k").toLowerCase();
    const resolution = requested === "720p" ? "720p" : requested === "1080p" ? "1k" : requested === "2k" ? "2k" : "4k";
    const data = await createRunwayTask("/v1/video_upscale", { model: "upscale_v1", videoUri, resolution });
    const id = data?.id || data?.task_id;
    if (id) videoTasks.set(String(id), { id: String(id), provider: RUNWAY_API_KEY ? "runway" : "comet-runway", createdAt: Date.now() });
    res.json({ ok: true, id: id ? String(id) : null, jobId: id ? String(id) : null, task_id: id ? String(id) : null, videoUrl: data?.videoUrl || data?.video_url || null, status: data?.status || "processing", data });
  } catch (err) {
    console.error("VIDEO UPSCALE ERROR:", err);
    sendError(res, 502, err.message || "Video keyfiyyəti artırıla bilmədi.");
  }
});

/* VIDEO TASK STATUS */
app.get("/api/videos/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const task = videoTasks.get(id);
    if (!task) return sendError(res, 404, "Tapşırıq bu server yaddaşında tapılmadı. Server yenidən başladılıbsa, tapşırığı təkrar başladın.");
    let data;
    if (task.provider === "runway" || task.provider === "comet-runway") {
      const direct = task.provider === "runway";
      const base = direct ? "https://api.dev.runwayml.com" : `${COMET_BASE}/runwayml`;
      const key = direct ? RUNWAY_API_KEY : COMETAPI_KEY;
      data = await requestJson(`${base}/v1/tasks/${encodeURIComponent(id)}`, {
        headers: bearer(key, { "X-Runway-Version": RUNWAY_VERSION })
      });
    } else {
      data = await requestJson(`${COMET_BASE}/v1/videos/${encodeURIComponent(id)}`, {
        headers: bearer(COMETAPI_KEY)
      });
    }
    const rawStatus = String(data?.status || data?.task_status || data?.state || "processing").toLowerCase();
    const output = data?.output || data?.outputs || data?.result || data?.data?.output || data?.data?.result || null;
    const firstOutput = Array.isArray(output) ? output[0] : output;
    const videoUrl = data?.videoUrl || data?.video_url || data?.url ||
      (typeof firstOutput === "string" ? firstOutput : firstOutput?.url);
    const status = ["succeed", "succeeded", "success", "completed", "complete"].includes(rawStatus) ? "completed" :
      ["failed", "error", "cancelled"].includes(rawStatus) ? "failed" : "processing";
    res.json({ ok: true, id, status, videoUrl: videoUrl || null, video_url: videoUrl || null, error: data?.error || null, data });
  } catch (err) {
    console.error("VIDEO STATUS ERROR:", err);
    sendError(res, 502, err.message || "Video statusu alınmadı.");
  }
});

/* SPEECH TO TEXT — GROQ WHISPER */
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!GROQ_API_KEY) return sendError(res, 503, "Səs tanıma üçün GROQ_API_KEY lazımdır.");
    if (!req.file) return sendError(res, 400, "Audio faylı göndərilməyib.");
    const formData = new FormData();
    formData.append("file", new Blob([req.file.buffer], { type: req.file.mimetype || "audio/webm" }), req.file.originalname || "f2-recording.webm");
    formData.append("model", GROQ_STT_MODEL);
    formData.append("response_format", "json");
    const data = await requestJson(`${GROQ_BASE}/audio/transcriptions`, {
      method: "POST",
      headers: bearer(GROQ_API_KEY),
      body: formData
    });
    const text = String(data?.text || "").trim();
    if (!text) return sendError(res, 422, "Səsdən mətn tanınmadı.");
    res.json({ ok: true, text, transcript: text });
  } catch (err) {
    console.error("TRANSCRIBE ERROR:", err);
    sendError(res, 502, err.message || "Səs tanınmadı.");
  }
});

/* TEXT TO SPEECH — EDGE TTS */
app.post("/api/speak", async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    if (!text) return sendError(res, 400, "Səsləndiriləcək mətn yoxdur.");
    if (text.length > 5000) return sendError(res, 400, "Mətn 5000 simvoldan qısa olmalıdır.");
    const language = String(req.body?.language || req.body?.languageCode || "az").toLowerCase().slice(0, 2);
    const voice = String(req.body?.voice || EDGE_VOICES[language] || EDGE_VOICES.az);
    const tts = new EdgeTTS();
    const result = await tts.generate(text, voice, {
      rate: "-5%", pitch: "-2Hz", volume: "100%",
      outputFormat: "audio-24khz-96kbitrate-mono-mp3"
    });
    if (!result?.audio?.length) throw new Error("Edge TTS audio yaratmadı.");
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.send(Buffer.from(result.audio));
  } catch (err) {
    console.error("SPEAK ERROR:", err);
    sendError(res, 502, err.message || "Səs yaratmaq mümkün olmadı.");
  }
});

/* Express 4 fallback */
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/* Multer / unexpected errors */
app.use((err, _req, res, _next) => {
  console.error("SERVER ERROR:", err);
  const status = err?.code === "LIMIT_FILE_SIZE" ? 413 : 500;
  res.status(status).json({ ok: false, error: err?.message || "Server xətası." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("F2 JARVIS server running on port", PORT);
  console.log("Groq:", Boolean(GROQ_API_KEY), "| CometAPI:", Boolean(COMETAPI_KEY), "| Runway:", Boolean(RUNWAY_API_KEY));
});
