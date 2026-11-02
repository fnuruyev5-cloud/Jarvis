(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const state = {
    recorder: null, stream: null, chunks: [], recording: false, busy: false,
    history: [], voices: [], utterance: null, mouthTimer: null, recognition: null,
    discardRecording: false
  };

  const labels = {
    ready: "SİSTEM HAZIRDIR",
    listening: "SİZİ DİNLƏYİRƏM",
    thinking: "MƏLUMATI EMAL EDİRƏM",
    speaking: "F2 JARVIS DANIŞIR",
    error: "SİSTEM XƏTASI"
  };

  function setStatus(message, mode = "ready") {
    const status = $("status");
    const label = $("orbLabel");
    if (status) status.textContent = message;
    if (label) label.textContent = labels[mode] || labels.ready;
    document.body.dataset.state = mode;
  }

  function addMessage(text, who = "assistant", extraClass = "") {
    const container = $("messages");
    if (!container) return null;
    const article = document.createElement("article");
    article.className = `message ${who} ${extraClass}`.trim();
    const name = document.createElement("b");
    name.textContent = who === "assistant" ? "F2 JARVIS" : who === "user" ? "SİZ" : "SİSTEM";
    const p = document.createElement("p");
    p.textContent = String(text);
    article.append(name, p);
    container.append(article);
    container.scrollTop = container.scrollHeight;
    return article;
  }

  async function postJSON(url, payload) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Server xətası: ${response.status}`);
    return data;
  }

  function detectLanguage(text) {
    if (/[әөүğıİ]/i.test(text) || /\b(salam|mən|sən|üçün|necə|bəli|xeyr|kömək|yaradıb|danış)\b/i.test(text)) return "az";
    if (/[ыэъё]/i.test(text)) return "ru";
    if (/[ğüşöçı]/i.test(text)) return "tr";
    return "en";
  }

  function refreshVoices() {
    if (!("speechSynthesis" in window)) return;
    state.voices = window.speechSynthesis.getVoices() || [];
    const select = $("voiceSelect");
    if (!select) return;
    const previous = select.value;
    select.innerHTML = '<option value="auto">Avtomatik</option>';
    state.voices.forEach((voice, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${voice.name} (${voice.lang})`;
      select.append(option);
    });
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
  }

  function setMouth(value) {
    const mouth = document.querySelector(".mouth");
    if (mouth) mouth.style.setProperty("--mouth-open", String(value));
  }

  function animateMouthForText(text) {
    const letters = String(text || "").toLowerCase();
    const vowels = (letters.match(/[aeiouəöüı]/g) || []).length;
    const open = Math.max(.45, Math.min(1.55, .35 + vowels * .12));
    setMouth(open);
  }

  function stopMouthAnimation() {
    clearInterval(state.mouthTimer);
    state.mouthTimer = null;
    setMouth(.45);
  }

  function chooseVoice(language) {
    const selected = $("voiceSelect")?.value || "auto";
    if (selected !== "auto") {
      const manuallySelected = state.voices[Number(selected)];
      if (manuallySelected) return manuallySelected;
    }
    const starts = prefix => state.voices.find(v => (v.lang || "").toLowerCase().startsWith(prefix));
    // Prefer Azerbaijani if installed, then Turkish for closer pronunciation, then English.
    return starts(language === "az" ? "az" : language) ||
      (language === "az" ? starts("tr") : null) ||
      starts("en") || state.voices[0] || null;
  }

  function speak(text) {
    if (!$("speak")?.checked) {
      setStatus("Sistem hazırdır", "ready");
      return;
    }
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      addMessage("Bu brauzerdə səsli oxuma dəstəklənmir. Cavab ekranda göstərildi.", "system", "error");
      setStatus("Səs sistemi dəstəklənmir", "error");
      return;
    }

    window.speechSynthesis.cancel();
    stopMouthAnimation();

    const utterance = new SpeechSynthesisUtterance(text);
    state.utterance = utterance;
    const language = detectLanguage(text);
    const voice = chooseVoice(language);
    utterance.lang = voice?.lang || ({ az: "az-AZ", tr: "tr-TR", ru: "ru-RU", en: "en-US" }[language]);
    if (voice) utterance.voice = voice;
    utterance.rate = .92;
    utterance.pitch = .78;
    utterance.volume = 1;

    utterance.onstart = () => {
      setStatus("F2 JARVIS danışır…", "speaking");
      let tick = 0;
      state.mouthTimer = setInterval(() => {
        tick++;
        const open = [.5, .95, 1.35, .65, 1.1, .45][tick % 6];
        setMouth(open);
      }, 115);
    };
    utterance.onboundary = event => {
      const start = Number(event.charIndex || 0);
      const length = Math.max(Number(event.charLength || 1), 1);
      animateMouthForText(text.slice(start, start + length));
    };
    utterance.onend = () => {
      state.utterance = null;
      stopMouthAnimation();
      setStatus("Sistem hazırdır", "ready");
    };
    utterance.onerror = event => {
      state.utterance = null;
      stopMouthAnimation();
      setStatus("Səs oxunmadı", "error");
      addMessage(`Brauzer səs xətası: ${event.error || "səs başladılmadı"}. Telefonun media səsini və TTS səs paketlərini yoxla.`, "system", "error");
    };

    // Chrome Android can pause speech if it is not resumed after starting.
    window.speechSynthesis.speak(utterance);
    setTimeout(() => {
      if (state.utterance === utterance && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    }, 700);
  }

  async function sendMessage(raw) {
    const message = String(raw || "").trim();
    if (!message || state.busy) return;
    state.busy = true;
    $("send").disabled = true;
    addMessage(message, "user");
    $("input").value = "";
    const pending = addMessage("F2 JARVIS düşünür…", "assistant", "pending");
    setStatus("AI cavab hazırlayır…", "thinking");

    try {
      const data = await postJSON("/api/chat", {
        message,
        history: state.history.slice(-10)
      });
      pending?.remove();
      if (!data.reply || typeof data.reply !== "string") throw new Error("AI boş cavab qaytardı.");
      addMessage(data.reply, "assistant");
      state.history.push({ role: "user", content: message }, { role: "assistant", content: data.reply });
      state.history = state.history.slice(-20);
      // Text response is already displayed before speech starts, so a TTS issue won't hide it.
      speak(data.reply);
    } catch (error) {
      pending?.remove();
      addMessage(error.message || "AI cavab verə bilmədi.", "system", "error");
      setStatus("AI bağlantı xətası", "error");
    } finally {
      state.busy = false;
      $("send").disabled = false;
      $("input").focus();
    }
  }

  async function transcribeRecording(blob, mimeType) {
    const formData = new FormData();
    const extension = mimeType.includes("mp4") ? "m4a" : "webm";
    formData.append("audio", blob, `f2-voice.${extension}`);
    const response = await fetch("/api/transcribe", { method: "POST", body: formData, cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Nitq tanınmadı (${response.status})`);
    if (!data.text?.trim()) throw new Error("Danışıqdan mətn alınmadı. Bir daha danış.");
    return data.text.trim();
  }

  async function finishRecording() {
    const recorder = state.recorder;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  }

  async function handleRecordingStop() {
    const mime = state.recorder?.mimeType || "audio/webm";
    const blob = new Blob(state.chunks, { type: mime });
    state.stream?.getTracks().forEach(track => track.stop());
    state.stream = null;
    state.recording = false;
    $("voice").innerHTML = '<span class="mic-icon">🎙</span> Danışmağa başla';

    if (state.discardRecording) {
      state.discardRecording = false;
      setStatus("Səs dayandırıldı", "ready");
      return;
    }
    if (!blob.size) {
      setStatus("Səs yazılmadı", "ready");
      return;
    }

    setStatus("Səs mətnə çevrilir…", "thinking");
    try {
      const transcript = await transcribeRecording(blob, mime);
      addMessage(`Eşidilən: ${transcript}`, "user", "transcript");
      await sendMessage(transcript);
    } catch (error) {
      addMessage(error.message || "Səs emal edilmədi.", "system", "error");
      setStatus("Nitq tanıma xətası", "error");
    }
  }

  async function startRecording() {
    if (state.recording || state.busy) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      startBrowserRecognition();
      return;
    }
    try {
      state.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      state.chunks = [];
      state.discardRecording = false;
      const supportedType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
        .find(type => MediaRecorder.isTypeSupported(type));
      state.recorder = new MediaRecorder(state.stream, supportedType ? { mimeType: supportedType } : undefined);
      state.recorder.ondataavailable = event => {
        if (event.data?.size) state.chunks.push(event.data);
      };
      state.recorder.onstop = handleRecordingStop;
      state.recorder.onerror = event => {
        addMessage(event.error?.message || "Mikrofon yazısı zamanı xəta baş verdi.", "system", "error");
        setStatus("Mikrofon xətası", "error");
      };
      state.recorder.start(300);
      state.recording = true;
      $("voice").innerHTML = "■ Yazını bitir və göndər";
      setStatus("Danışığını dinləyirəm…", "listening");
    } catch (error) {
      state.stream?.getTracks().forEach(track => track.stop());
      state.stream = null;
      addMessage(`Mikrofon açıla bilmədi: ${error.message || "icazə verilmədi"}. Brauzerdə mikrofon icazəsini aktiv et.`, "system", "error");
      setStatus("Mikrofon əlçatan deyil", "error");
    }
  }

  function startBrowserRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addMessage("Bu brauzer mikrofonla nitq tanımanı dəstəkləmir. Mesajı yazıb göndərə bilərsən.", "system", "error");
      return;
    }
    const recognition = new SpeechRecognition();
    state.recognition = recognition;
    recognition.lang = "az-AZ";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setStatus("Danışığını dinləyirəm…", "listening");
    recognition.onresult = event => sendMessage(event.results[0][0].transcript);
    recognition.onerror = event => {
      addMessage(`Nitq tanıma xətası: ${event.error}`, "system", "error");
      setStatus("Nitq tanınmadı", "error");
    };
    recognition.onend = () => {
      state.recognition = null;
      if (!state.busy && !state.utterance) setStatus("Sistem hazırdır", "ready");
    };
    try { recognition.start(); }
    catch (error) {
      addMessage(`Mikrofon başladılmadı: ${error.message}`, "system", "error");
      state.recognition = null;
    }
  }

  function stopEverything() {
    if (state.recorder && state.recorder.state !== "inactive") {
      state.discardRecording = true;
      state.recorder.stop();
    } else {
      state.stream?.getTracks().forEach(track => track.stop());
      state.stream = null;
      state.recording = false;
    }
    if (state.recognition) {
      try { state.recognition.stop(); } catch (_) {}
      state.recognition = null;
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    state.utterance = null;
    stopMouthAnimation();
    $("voice").innerHTML = '<span class="mic-icon">🎙</span> Danışmağa başla';
    setStatus("Səs dayandırıldı", "ready");
  }

  function setupEyes() {
    const stage = $("faceStage");
    if (!stage) return;
    function lookAt(x, y) {
      const rect = stage.getBoundingClientRect();
      const dx = (x - (rect.left + rect.width / 2)) / (rect.width / 2);
      const dy = (y - (rect.top + rect.height / 2)) / (rect.height / 2);
      const gazeX = Math.max(-5, Math.min(5, dx * 5));
      const gazeY = Math.max(-3, Math.min(3, dy * 3));
      stage.style.setProperty("--gaze-x", `${gazeX}px`);
      stage.style.setProperty("--gaze-y", `${gazeY}px`);
    }
    window.addEventListener("pointermove", event => lookAt(event.clientX, event.clientY), { passive: true });
    let gaze = 0;
    setInterval(() => {
      if (document.body.dataset.state !== "ready") return;
      gaze = gaze === 0 ? 4 : gaze === 4 ? -4 : 0;
      stage.style.setProperty("--gaze-x", `${gaze}px`);
      stage.style.setProperty("--gaze-y", "0px");
    }, 2300);
  }

  function checkHealth() {
    fetch("/api/health", { cache: "no-store" })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Server statusu alınmadı.");
        $("backend").textContent = data.aiConfigured ? `Groq · ${data.model}` : "GROQ_API_KEY qurulmayıb";
        $("speechBackend").textContent = data.speechRecognition ? "Groq Whisper aktivdir" : "GROQ_API_KEY tələb olunur";
        setStatus(data.aiConfigured ? "Sistem hazırdır" : "AI açarı qurulmayıb", data.aiConfigured ? "ready" : "error");
      })
      .catch(error => {
        $("backend").textContent = "Server bağlantısı yoxdur";
        $("speechBackend").textContent = error.message;
        setStatus("Backend bağlantı xətası", "error");
      });
  }

  $("form").addEventListener("submit", event => {
    event.preventDefault();
    sendMessage($("input").value);
  });
  $("voice").addEventListener("click", () => state.recording ? finishRecording() : startRecording());
  $("stop").addEventListener("click", stopEverything);
  $("clear").addEventListener("click", () => {
    $("messages").innerHTML = "";
    state.history = [];
    addMessage("Söhbət təmizləndi. Yeni söhbətə başlaya bilərik.", "assistant");
  });
  $("settings").addEventListener("click", () => $("dlg").showModal());
  $("closeSettings").addEventListener("click", () => $("dlg").close());

  if ("speechSynthesis" in window) {
    refreshVoices();
    window.speechSynthesis.onvoiceschanged = refreshVoices;
  }
  setupEyes();
  checkHealth();

  window.addEventListener("beforeunload", () => {
    state.stream?.getTracks().forEach(track => track.stop());
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  });
  window.addEventListener("error", event => console.error("F2 JARVIS:", event.error || event.message));
  window.addEventListener("unhandledrejection", event => console.error("F2 JARVIS async:", event.reason));
})();
