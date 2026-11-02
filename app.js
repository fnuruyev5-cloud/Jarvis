const $ = (id) => document.getElementById(id);
const messagesEl = $("messages");
const form = $("chatForm");
const input = $("messageInput");
const sendBtn = $("sendBtn");
const voiceBtn = $("voiceBtn");
const voiceLabel = $("voiceLabel");
const stopBtn = $("stopBtn");
const coreWrap = $("coreWrap");
const stateLabel = $("stateLabel");
const voiceHint = $("voiceHint");
const settingsDialog = $("settingsDialog");

let history = [];
let recorder = null;
let chunks = [];
let recording = false;
let currentAudio = null;
let currentAudioUrl = null;
let speakEnabled = true;
let autoSpeak = true;
let lastUserLanguage = "az";

function setState(state, label) {
  coreWrap.dataset.state = state;
  stateLabel.textContent = label;
}

function addMessage(role, text) {
  const row = document.createElement("div");
  row.className = `message ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  if (role === "assistant") {
    const title = document.createElement("b");
    title.textContent = "F2 JARVIS";
    const body = document.createElement("p");
    body.textContent = text;
    bubble.append(title, body);
    const avatar = document.createElement("div");
    avatar.className = "bot-avatar";
    avatar.textContent = "F2";
    row.append(avatar, bubble);
  } else {
    bubble.textContent = text;
    row.append(bubble);
  }
  messagesEl.append(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return row;
}

function detectLanguage(text) {
  const t = text.toLowerCase();
  if (/[а-яё]/i.test(text)) return "ru";
  if (/[əğıöüşç]/i.test(t) || /\b(salam|mən|sən|üçün|necə|bəli|xeyr|çox)\b/.test(t)) return "az";
  if (/[ğİı]/.test(text) || /\b(merhaba|nasılsın|teşekkür|lütfen|için|değil)\b/.test(t)) return "tr";
  if (/\b(hello|the|what|how|please|thanks|good)\b/.test(t)) return "en";
  return lastUserLanguage || "az";
}

async function speak(text) {
  if (!speakEnabled || !text) return;
  stopAudio();
  setState("speaking", "JARVIS DANIŞIR");
  try {
    const response = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, languageCode: lastUserLanguage })
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "ElevenLabs səs xətası.");
    }
    const blob = await response.blob();
    currentAudioUrl = URL.createObjectURL(blob);
    currentAudio = new Audio(currentAudioUrl);
    currentAudio.onended = () => {
      stopAudio();
      setState("idle", "SİSTEM HAZIRDIR");
    };
    currentAudio.onerror = () => {
      stopAudio();
      setState("idle", "SİSTEM HAZIRDIR");
      voiceHint.textContent = "Səs oxudulmadı. Mesaj ekranda qalır.";
    };
    await currentAudio.play();
  } catch (error) {
    console.error(error);
    setState("idle", "SİSTEM HAZIRDIR");
    voiceHint.textContent = `${error.message} Mətn cavabı söhbətdə qalır.`;
  }
}

function stopAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = null;
  }
}

async function askJarvis(text, shouldSpeak = false) {
  const clean = text.trim();
  if (!clean) return;
  lastUserLanguage = detectLanguage(clean);
  history.push({ role: "user", content: clean });
  addMessage("user", clean);
  input.value = "";
  sendBtn.disabled = true;
  setState("thinking", "JARVIS DÜŞÜNÜR");
  const typing = document.createElement("div");
  typing.className = "typing";
  typing.textContent = "F2 JARVIS cavab hazırlayır...";
  messagesEl.append(typing);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "AI cavabı alınmadı.");
    const answer = data.answer || "Cavab alınmadı.";
    history.push({ role: "assistant", content: answer });
    typing.remove();
    addMessage("assistant", answer);
    setState("idle", "SİSTEM HAZIRDIR");
    if (speakEnabled && (shouldSpeak || autoSpeak)) await speak(answer);
  } catch (error) {
    typing.remove();
    addMessage("assistant", `Xəta: ${error.message}`);
    setState("idle", "SİSTEM HAZIRDIR");
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  askJarvis(input.value, false);
});

async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    voiceHint.textContent = "Bu brauzer səs yazısını dəstəkləmir. Chrome ilə yoxla.";
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = async () => {
      stream.getTracks().forEach(track => track.stop());
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      if (!blob.size) {
        setState("idle", "SİSTEM HAZIRDIR");
        voiceHint.textContent = "Səs yazısı boşdur. Yenidən cəhd et.";
        return;
      }
      await transcribe(blob);
    };
    recorder.start();
    recording = true;
    voiceBtn.classList.add("recording");
    voiceLabel.textContent = "Bitirmək üçün yenidən bas";
    stopBtn.disabled = false;
    setState("listening", "SƏNİ DİNLƏYİRƏM");
    voiceHint.textContent = "Danışığını bitirəndə düyməyə yenidən bas.";
  } catch (error) {
    voiceHint.textContent = "Mikrofona icazə verilmədi. Brauzer icazələrini yoxla.";
    console.error(error);
  }
}

function stopRecording() {
  if (recorder && recording) {
    recording = false;
    recorder.stop();
    voiceBtn.classList.remove("recording");
    voiceLabel.textContent = "Danışmaq üçün bas";
    stopBtn.disabled = true;
    setState("thinking", "SƏS EMAL OLUNUR");
  }
}

async function transcribe(blob) {
  try {
    const formData = new FormData();
    formData.append("audio", blob, "f2-jarvis-recording.webm");
    const response = await fetch("/api/transcribe", { method: "POST", body: formData });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Səs tanınmadı.");
    const text = (data.text || "").trim();
    if (!text) throw new Error("Danışıq başa düşülmədi. Bir daha danış.");
    lastUserLanguage = detectLanguage(text);
    voiceHint.textContent = `Eşidildi: “${text}”`;
    await askJarvis(text, true);
  } catch (error) {
    setState("idle", "SİSTEM HAZIRDIR");
    voiceHint.textContent = error.message;
  }
}

voiceBtn.addEventListener("click", () => recording ? stopRecording() : startRecording());
stopBtn.addEventListener("click", () => {
  if (recording) stopRecording();
  stopAudio();
  setState("idle", "SİSTEM HAZIRDIR");
});

$("clearBtn").addEventListener("click", () => {
  history = [];
  stopAudio();
  messagesEl.innerHTML = "";
  addMessage("assistant", "Söhbət təmizləndi. Yeni sualını verə bilərsən.");
});
$("settingsBtn").addEventListener("click", () => settingsDialog.showModal());
$("speakToggle").addEventListener("change", e => { speakEnabled = e.target.checked; if (!speakEnabled) stopAudio(); });
$("autoSpeakToggle").addEventListener("change", e => { autoSpeak = e.target.checked; });

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    $("connection").textContent = data.aiConfigured ? (data.voiceConfigured ? "AI + SƏS AKTİVDİR" : "AI AKTİVDİR · SƏS AÇARI LAZIMDIR") : "API AÇARI LAZIMDIR";
  } catch {
    $("connection").textContent = "SERVERƏ BAĞLANTI YOXDUR";
  }
}
checkHealth();
