/* F2 JARVIS Add-on — wake word, continuous voice, and camera capture.
   Additive module: does not replace your existing app.js/server.js.
   Configure window.F2JARVIS_ADDON before loading this file if needed. */
(() => {
  "use strict";

  const cfg = Object.assign({
    chatEndpoint: "/api/chat",
    speakEndpoint: "/api/speak",
    visionEndpoint: "/api/vision", // Requires a vision-enabled backend route.
    language: "az-AZ",
    wakePhrase: "hey jarvis",
    stopPhrase: "stop jarvis",
    autoResume: true,
    greeting: "Salam. Mən F2 JARVIS. Sizi dinləyirəm.",
    voiceRate: 1,
    debug: false
  }, window.F2JARVIS_ADDON || {});

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const state = {
    enabled: false, listening: false, speaking: false, busy: false,
    cameraStream: null, recognition: null, restartTimer: null,
    lastFinal: "", conversation: false
  };

  const log = (...args) => { if (cfg.debug) console.log("[F2 JARVIS]", ...args); };
  const $ = (id) => document.getElementById(id);

  function mount() {
    if ($("f2-addon")) return;
    const root = document.createElement("section");
    root.id = "f2-addon";
    root.innerHTML = `
      <div class="f2a-top">
        <div><span class="f2a-dot"></span><b>F2 JARVIS</b><small id="f2a-status">Hazırdır</small></div>
        <button id="f2a-close" aria-label="Bağla">×</button>
      </div>
      <div class="f2a-orb" id="f2a-orb"><span></span><span></span><span></span></div>
      <div class="f2a-caption" id="f2a-caption">“Hey Jarvis” deyin və ya Başlat düyməsinə toxunun</div>
      <div class="f2a-transcript" id="f2a-transcript" aria-live="polite"></div>
      <div class="f2a-actions">
        <button id="f2a-start" class="primary">Başlat / Dinlə</button>
        <button id="f2a-stop">Dayandır</button>
        <button id="f2a-camera">Kamera</button>
      </div>
      <div class="f2a-camera-wrap" id="f2a-camera-wrap" hidden>
        <video id="f2a-video" autoplay playsinline muted></video>
        <button id="f2a-snapshot">Şəkli analiz et</button>
      </div>`;
    document.body.appendChild(root);

    $("f2a-start").addEventListener("click", start);
    $("f2a-stop").addEventListener("click", stop);
    $("f2a-close").addEventListener("click", () => root.remove());
    $("f2a-camera").addEventListener("click", openCamera);
    $("f2a-snapshot").addEventListener("click", analyzeSnapshot);
    setStatus(SpeechRecognition ? "Mikrofon icazəsi gözlənilir" : "Bu brauzerdə səs tanıma dəstəklənmir");
  }

  function setStatus(message, mode) {
    const el = $("f2a-status");
    if (el) el.textContent = message;
    const orb = $("f2a-orb");
    if (orb) orb.dataset.state = mode || (state.speaking ? "speaking" : state.listening ? "listening" : "idle");
    if (window.J) {
      window.J.state = state.speaking ? "speaking" : state.listening ? "listening" : "idle";
    }
  }

  function transcript(text, who) {
    const el = $("f2a-transcript");
    if (!el) return;
    const line = document.createElement("div");
    line.className = "f2a-line " + (who || "");
    line.textContent = (who === "user" ? "Siz: " : "JARVIS: ") + text;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
  }

  function makeRecognition() {
    if (!SpeechRecognition) return null;
    const rec = new SpeechRecognition();
    rec.lang = cfg.language;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => { state.listening = true; setStatus("Dinləyir…", "listening"); };
    rec.onerror = (event) => {
      log("recognition error", event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        state.enabled = false;
        setStatus("Mikrofon icazəsini aktiv edin");
      }
    };
    rec.onend = () => {
      state.listening = false;
      if (state.enabled && cfg.autoResume && !state.speaking && !state.busy) {
        clearTimeout(state.restartTimer);
        state.restartTimer = setTimeout(() => {
          try { rec.start(); } catch (e) { log("restart", e.message); }
        }, 450);
      }
    };
    rec.onresult = async (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const phrase = (event.results[i][0].transcript || "").trim();
        if (event.results[i].isFinal && phrase) {
          state.lastFinal = phrase;
          await handlePhrase(phrase);
        } else interim += phrase;
      }
      if (interim && $("f2a-caption")) $("f2a-caption").textContent = interim;
    };
    return rec;
  }

  async function start() {
    if (!SpeechRecognition) {
      setStatus("Chrome/Edge brauzerində yoxlayın");
      return;
    }
    if (state.enabled) {
      try { state.recognition && state.recognition.start(); } catch (_) {}
      return;
    }
    state.enabled = true;
    state.conversation = true;
    state.recognition = makeRecognition();
    try {
      state.recognition.start();
      // Audio playback is initiated after this user gesture to comply with browser rules.
      if (cfg.greeting) await speak(cfg.greeting);
    } catch (error) {
      state.enabled = false;
      setStatus("Mikrofon açılmadı. Sayt icazəsini yoxlayın.");
      log(error);
    }
  }

  function stop() {
    state.enabled = false;
    state.conversation = false;
    state.speaking = false;
    clearTimeout(state.restartTimer);
    try { state.recognition && state.recognition.stop(); } catch (_) {}
    stopCamera();
    setStatus("Dayandırıldı", "idle");
  }

  function pauseRecognition() {
    try { if (state.recognition && state.listening) state.recognition.stop(); } catch (_) {}
  }

  async function handlePhrase(text) {
    const normalized = text.toLocaleLowerCase("az").replace(/[.,!?]/g, "").trim();
    const wake = cfg.wakePhrase.toLocaleLowerCase("az");
    const stopWord = cfg.stopPhrase.toLocaleLowerCase("az");

    if (normalized.includes(stopWord)) {
      stop();
      return;
    }
    if (!state.conversation) {
      if (normalized.includes(wake)) {
        state.conversation = true;
        transcript(text, "user");
        await speak("Bəli, sizi dinləyirəm.");
      }
      return;
    }
    // Ignore a bare wake phrase but acknowledge it.
    if (normalized === wake || normalized === "jarvis") {
      await speak("Bəli?");
      return;
    }
    // If wake phrase is required for every command, strip it when present.
    const clean = normalized.includes(wake) ? text.replace(new RegExp(wake, "i"), "").trim() : text;
    if (!clean) return;
    transcript(clean, "user");
    await askAI(clean);
  }

  async function askAI(message) {
    if (state.busy) return;
    state.busy = true;
    pauseRecognition();
    setStatus("Cavab hazırlanır…");
    try {
      const response = await fetch(cfg.chatEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, prompt: message, text: message })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      const answer = data.reply || data.response || data.answer || data.message || data.text;
      if (!answer) throw new Error("Server cavab formatında reply/response/answer tapılmadı.");
      transcript(String(answer), "assistant");
      await speak(String(answer));
    } catch (error) {
      transcript("Xəta: " + error.message, "assistant");
      setStatus("AI sorğusunda xəta");
      log(error);
    } finally {
      state.busy = false;
      if (state.enabled) {
        try { state.recognition.start(); } catch (_) {}
      }
    }
  }

  async function speak(text) {
    state.speaking = true;
    pauseRecognition();
    setStatus("Danışır…", "speaking");
    try {
      const response = await fetch(cfg.speakEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, rate: cfg.voiceRate })
      });
      if (!response.ok) throw new Error("TTS endpoint cavab vermədi");
      const blob = await response.blob();
      if (!blob.type.includes("audio") && blob.size < 1000) throw new Error("Audio cavabı etibarlı deyil");
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); };
      await audio.play();
      await new Promise(resolve => { audio.onended = resolve; audio.onerror = resolve; });
    } catch (error) {
      log("TTS unavailable; using browser voice", error.message);
      if ("speechSynthesis" in window) {
        await new Promise(resolve => {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = cfg.language;
          utterance.rate = 1.04;
          utterance.pitch = 0.82;
          utterance.onend = resolve;
          utterance.onerror = resolve;
          speechSynthesis.cancel();
          speechSynthesis.speak(utterance);
        });
      }
    } finally {
      state.speaking = false;
      setStatus(state.enabled ? "Dinləyir…" : "Hazırdır");
    }
  }

  async function openCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus("Kamera bu brauzerdə dəstəklənmir");
      return;
    }
    try {
      state.cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      $("f2a-video").srcObject = state.cameraStream;
      $("f2a-camera-wrap").hidden = false;
      setStatus("Kamera aktivdir");
    } catch (error) {
      setStatus("Kamera icazəsi verilmədi");
      log(error);
    }
  }

  function stopCamera() {
    if (state.cameraStream) state.cameraStream.getTracks().forEach(track => track.stop());
    state.cameraStream = null;
    if ($("f2a-video")) $("f2a-video").srcObject = null;
    if ($("f2a-camera-wrap")) $("f2a-camera-wrap").hidden = true;
  }

  async function analyzeSnapshot() {
    const video = $("f2a-video");
    if (!video || !video.videoWidth) { setStatus("Əvvəl kameranı açın"); return; }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const image = canvas.toDataURL("image/jpeg", 0.82);
    setStatus("Şəkil analiz edilir…");
    try {
      const response = await fetch(cfg.visionEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, prompt: "Bu görüntüdə nə var? Azərbaycan dilində təsvir et." })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      const answer = data.reply || data.answer || data.description || data.text;
      if (!answer) throw new Error("Vision serverindən cavab gəlmədi.");
      transcript(String(answer), "assistant");
      await speak(String(answer));
    } catch (error) {
      transcript("Kamera açılır, amma görüntü analizi üçün /api/vision backend marşrutu lazımdır: " + error.message, "assistant");
      setStatus("Vision backend tələb olunur");
      log(error);
    }
  }

  window.F2JARVIS = { start, stop, speak, ask: askAI, openCamera, stopCamera, state };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
