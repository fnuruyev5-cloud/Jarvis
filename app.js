const $ = (id) => document.getElementById(id);

let mediaRecorder = null;
let audioStream = null;
let audioChunks = [];
let recording = false;
let busy = false;
let chatHistory = [];
let availableVoices = [];

function setStatus(message, mode = "ready") {
  $("status").textContent = message;
  $("orbLabel").textContent = ({
    ready: "SİSTEM HAZIRDIR",
    listening: "DİNLƏYİRƏM",
    thinking: "DÜŞÜNÜRƏM",
    speaking: "DANIŞIRAM",
    error: "BAĞLANTI XƏTASI"
  })[mode] || "SİSTEM HAZIRDIR";
  document.body.dataset.state = mode;
  $("orb").classList.toggle("active", mode === "listening" || mode === "speaking");
}

function addMessage(text, who = "assistant") {
  const article = document.createElement("article");
  article.className = who === "assistant" ? "message assistant" : "message user";
  const name = document.createElement("b");
  name.textContent = who === "assistant" ? "F2 JARVIS" : "SİZ";
  const p = document.createElement("p");
  p.textContent = text;
  article.append(name, p);
  $("messages").append(article);
  $("messages").scrollTop = $("messages").scrollHeight;
}

async function postJSON(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Server xətası.");
  return data;
}

function detectVoiceLanguage(text) {
  if (/[әөүğıİçş]/i.test(text)) return "az";
  if (/[ыэъё]/i.test(text)) return "ru";
  if (/[ğüşöçıİ]/i.test(text)) return "tr";
  return "en";
}

function refreshVoices() {
  availableVoices = speechSynthesis?.getVoices?.() || [];
  const select = $("voiceSelect");
  if (!select) return;
  const old = select.value;
  select.innerHTML = '<option value="auto">Avtomatik uyğun səs</option>';
  availableVoices.forEach((voice, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${voice.name} (${voice.lang})`;
    select.append(option);
  });
  if (old && [...select.options].some(o => o.value === old)) select.value = old;
}

function speak(text) {
  if (!$("speak").checked || !("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const lang = detectVoiceLanguage(text);
  utterance.lang = ({ az: "az-AZ", tr: "tr-TR", ru: "ru-RU", en: "en-US" })[lang];
  utterance.rate = 0.94;
  utterance.pitch = 0.88;
  const chosen = $("voiceSelect")?.value || "auto";
  if (chosen !== "auto" && availableVoices[Number(chosen)]) {
    utterance.voice = availableVoices[Number(chosen)];
  } else {
    const preferred = availableVoices.find(v => v.lang.toLowerCase().startsWith(lang))
      || availableVoices.find(v => v.lang.toLowerCase().startsWith("tr"))
      || availableVoices.find(v => v.lang.toLowerCase().startsWith("en"));
    if (preferred) utterance.voice = preferred;
  }
  utterance.onstart = () => setStatus("F2 JARVIS danışır…", "speaking");
  utterance.onend = () => setStatus("Sistem hazırdır", "ready");
  utterance.onerror = () => setStatus("Sistem hazırdır", "ready");
  speechSynthesis.speak(utterance);
}

async function sendMessage(rawText) {
  const message = String(rawText || "").trim();
  if (!message || busy) return;
  busy = true;
  addMessage(message, "user");
  $("input").value = "";
  setStatus("AI cavab hazırlayır…", "thinking");

  try {
    const data = await postJSON("/api/chat", {
      message,
      history: chatHistory.slice(-10)
    });
    addMessage(data.reply);
    chatHistory.push({ role: "user", content: message });
    chatHistory.push({ role: "assistant", content: data.reply });
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
    speak(data.reply);
    if (!$("speak").checked) setStatus("Sistem hazırdır", "ready");
  } catch (error) {
    addMessage(error.message);
    setStatus("Xəta baş verdi", "error");
  } finally {
    busy = false;
  }
}

async function startRecording() {
  if (recording || busy) return;
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    startBrowserRecognition();
    return;
  }

  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
      .find(type => MediaRecorder.isTypeSupported(type));
    mediaRecorder = new MediaRecorder(audioStream, mime ? { mimeType: mime } : undefined);
    mediaRecorder.ondataavailable = event => {
      if (event.data?.size) audioChunks.push(event.data);
    };
    mediaRecorder.onstop = processRecording;
    mediaRecorder.start();
    recording = true;
    $("mic").classList.add("active");
    setStatus("Danışığını dinləyirəm…", "listening");
  } catch (error) {
    addMessage("Mikrofona icazə verilmədi. Brauzer icazələrini yoxla.");
    setStatus("Mikrofon əlçatan deyil", "error");
  }
}

async function processRecording() {
  const blob = new Blob(audioChunks, { type: mediaRecorder?.mimeType || "audio/webm" });
  audioStream?.getTracks().forEach(track => track.stop());
  audioStream = null;
  recording = false;
  $("mic").classList.remove("active");
  if (!blob.size) {
    setStatus("Sistem hazırdır", "ready");
    return;
  }

  setStatus("Danışıq mətnə çevrilir…", "thinking");
  try {
    const form = new FormData();
    const ext = blob.type.includes("mp4") ? "m4a" : "webm";
    form.append("audio", blob, `voice.${ext}`);
    const response = await fetch("/api/transcribe", { method: "POST", body: form });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Səs tanınmadı.");
    $("input").value = data.text;
    await sendMessage(data.text);
  } catch (error) {
    addMessage(error.message);
    setStatus("Səs tanıma xətası", "error");
  }
}

function startBrowserRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    addMessage("Bu brauzerdə mikrofonla nitq tanıma dəstəklənmir.");
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = navigator.language || "az-AZ";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onstart = () => setStatus("Brauzer dinləyir…", "listening");
  recognition.onresult = event => sendMessage(event.results[0][0].transcript);
  recognition.onerror = event => {
    addMessage(`Nitq tanıma xətası: ${event.error}`);
    setStatus("Sistem hazırdır", "ready");
  };
  recognition.onend = () => {
    $("mic").classList.remove("active");
    if (!busy) setStatus("Sistem hazırdır", "ready");
  };
  recognition.start();
  $("mic").classList.add("active");
}

function stopEverything() {
  if (recording && mediaRecorder?.state !== "inactive") mediaRecorder.stop();
  audioStream?.getTracks().forEach(track => track.stop());
  audioStream = null;
  recording = false;
  $("mic").classList.remove("active");
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  setStatus("Səs dayandırıldı", "ready");
}

$("form").addEventListener("submit", event => {
  event.preventDefault();
  sendMessage($("input").value);
});
$("mic").addEventListener("click", () => {
  if (recording) {
    if (mediaRecorder?.state !== "inactive") mediaRecorder.stop();
  } else {
    startRecording();
  }
});
$("voice").addEventListener("click", () => recording ? mediaRecorder?.stop() : startRecording());
$("stop").addEventListener("click", stopEverything);
$("clear").addEventListener("click", () => {
  $("messages").innerHTML = "";
  chatHistory = [];
});
$("settings").addEventListener("click", () => $("dlg").showModal());
$("closeSettings").addEventListener("click", () => $("dlg").close());

if ("speechSynthesis" in window) {
  refreshVoices();
  speechSynthesis.onvoiceschanged = refreshVoices;
}

fetch("/api/health")
  .then(response => response.json())
  .then(data => {
    $("backend").textContent = data.aiConfigured ? `Groq • ${data.model}` : "Groq açarı qurulmayıb";
    $("speechBackend").textContent = data.speechRecognition ? "AI nitq tanıma aktivdir" : "Nitq tanıma açarı yoxdur";
    setStatus(data.aiConfigured ? "Sistem hazırdır" : "Backend işləyir, AI açarı gözlənilir", data.aiConfigured ? "ready" : "error");
  })
  .catch(() => {
    $("backend").textContent = "Offline";
    setStatus("Backend serverinə qoşulmur", "error");
  });

window.addEventListener("beforeunload", () => {
  audioStream?.getTracks().forEach(track => track.stop());
  if ("speechSynthesis" in window) speechSynthesis.cancel();
});
