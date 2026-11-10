/* F2 JARVIS — real microphone capture + Groq Whisper + AI + Edge TTS.
   Uses MediaRecorder/getUserMedia instead of browser SpeechRecognition, which
   frequently starts/stops unreliably on Android Chrome. */
const $ = id => document.getElementById(id);
const messagesEl = $('messages');
const form = $('chatForm');
const input = $('messageInput');
const sendBtn = $('sendBtn');
const voiceBtn = $('voiceBtn');
const coreWrap = $('coreWrap');
const stateLabel = $('stateLabel');
const voiceHint = $('voiceHint');
const settingsDialog = $('settingsDialog');

const HISTORY_KEY = 'f2jarvis.chat.history.v2';
const HISTORY_LIMIT = 80;
let history = [];
try {
  const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  if (Array.isArray(saved)) {
    history = saved.filter(item =>
      item && ['user', 'assistant'].includes(item.role) &&
      typeof item.content === 'string'
    ).slice(-HISTORY_LIMIT);
  }
} catch (error) {
  console.warn('Chat history could not be restored:', error);
}

function saveHistory() {
  try {
    history = history.slice(-HISTORY_LIMIT);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.warn('Chat history could not be saved:', error);
    setHint('Söhbət yaddaşı dolub. Köhnə mesajları təmizləyə bilərsən.');
  }
}
let currentAudio = null;
let currentAudioUrl = null;
let audioDone = null;
let speakEnabled = true;
let autoSpeak = true;
let lastUserLanguage = 'az';

let voiceMode = false;
let mediaStream = null;
let mediaRecorder = null;
let audioContext = null;
let analyser = null;
let monitorFrame = 0;
let chunks = [];
let busy = false;
let speaking = false;
let processingVoice = false;
let discardSegment = false;
let speechDetected = false;
let speechStartedAt = 0;
let lastVoiceAt = 0;
let segmentStartedAt = 0;
let restartTimer = null;

window.J = window.J || { state: 'idle', lvl: 0 };

function setState(state, label) {
  if (coreWrap) coreWrap.dataset.state = state;
  if (stateLabel) stateLabel.textContent = label;
  window.J.state = state;
}

function setHint(message) {
  if (voiceHint) voiceHint.textContent = message;
}

function setVoiceButton(active) {
  if (!voiceBtn) return;
  voiceBtn.classList.toggle('active', active);
  voiceBtn.setAttribute('aria-pressed', String(active));
  voiceBtn.setAttribute('aria-label', active ? 'Səsli danışığı dayandır' : 'Səsli danışığı başlat');
  voiceBtn.title = active ? 'Səsli danışığı dayandır' : 'Səsli danışığı başlat';
  voiceBtn.textContent = active ? '■' : '🎙';
}

function copyText(text, button) {
  const value = String(text || '');
  const fallback = () => {
    const area = document.createElement('textarea');
    area.value = value;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    try { document.execCommand('copy'); } catch (_) {}
    area.remove();
  };

  const done = () => {
    if (!button) return;
    const old = button.textContent;
    button.textContent = 'Kopyalandı ✓';
    setTimeout(() => { button.textContent = old || 'Kopyala'; }, 1400);
  };

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(value).then(done).catch(() => {
      fallback();
      done();
    });
  } else {
    fallback();
    done();
  }
}

function addMessage(role, text) {
  if (!messagesEl) return null;
  const row = document.createElement('div');
  row.className = `message ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  if (role === 'assistant') {
    const title = document.createElement('b');
    title.textContent = 'F2 JARVIS';
    const body = document.createElement('p');
    body.textContent = text;
    bubble.append(title, body);
    const avatar = document.createElement('div');
    avatar.className = 'bot-avatar';
    avatar.textContent = 'F2';
    row.append(avatar, bubble);
  } else {
    bubble.textContent = text;
    row.append(bubble);
  }

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'f2-message-copy';
  copy.textContent = 'Kopyala';
  copy.setAttribute('aria-label', 'Mesajı kopyala');
  copy.addEventListener('click', () => copyText(text, copy));
  bubble.append(copy);

  messagesEl.append(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return row;
}

function addImageMessage(url, prompt) {
  if (!messagesEl || !url) return;
  const row = document.createElement('div');
  row.className = 'message assistant';
  const avatar = document.createElement('div');
  avatar.className = 'bot-avatar';
  avatar.textContent = 'F2';
  const bubble = document.createElement('div');
  bubble.className = 'bubble f2-image-bubble';
  const title = document.createElement('b');
  title.textContent = 'F2 JARVIS · Yaradılmış şəkil';
  const caption = document.createElement('p');
  caption.textContent = prompt || 'Şəkil hazırdır.';
  const image = document.createElement('img');
  image.src = url;
  image.alt = 'F2 JARVIS tərəfindən yaradılmış şəkil';
  image.loading = 'lazy';
  const actions = document.createElement('div');
  actions.className = 'f2-image-actions';
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'f2-message-copy';
  copy.textContent = 'Promptu kopyala';
  copy.addEventListener('click', () => copyText(prompt, copy));
  const download = document.createElement('a');
  download.href = url;
  download.target = '_blank';
  download.rel = 'noopener';
  download.textContent = 'Şəkli aç';
  actions.append(copy, download);
  bubble.append(title, caption, image, actions);
  row.append(avatar, bubble);
  messagesEl.append(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
function detectLanguage(text) {
  const t = text.toLowerCase();
  if (/[а-яё]/i.test(text)) return 'ru';
  if (/[əğıöüşç]/i.test(t) || /\b(salam|mən|sən|üçün|necə|bəli|xeyr|çox)\b/.test(t)) return 'az';
  if (/[ğİı]/.test(text) || /\b(merhaba|nasılsın|teşekkür|lütfen|için|değil)\b/.test(t)) return 'tr';
  if (/\b(hello|the|what|how|please|thanks|good)\b/.test(t)) return 'en';
  return lastUserLanguage || 'az';
}

function stopAudio() {
  if (audioDone) {
    const done = audioDone;
    audioDone = null;
    done();
  }
  if (currentAudio) {
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = null;
  }
  window.J.lvl = 0;
}

async function speak(text) {
  if (!speakEnabled || !text) return;
  stopAudio();
  speaking = true;
  setState('speaking', 'JARVIS DANIŞIR');

  try {
    const response = await fetch('/api/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language: lastUserLanguage, languageCode: lastUserLanguage })
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Səs xidməti cavab vermədi.');
    }

    const blob = await response.blob();
    currentAudioUrl = URL.createObjectURL(blob);
    currentAudio = new Audio(currentAudioUrl);
    currentAudio.preload = 'auto';

    let raf = 0;
    let meter = null;
    try {
      if (audioContext && audioContext.state !== 'closed') {
        const source = audioContext.createMediaElementSource(currentAudio);
        meter = audioContext.createAnalyser();
        meter.fftSize = 256;
        source.connect(meter);
        meter.connect(audioContext.destination);
      }
    } catch (error) {
      console.debug('Audio visualizer unavailable:', error);
      meter = null;
    }

    const playback = new Promise((resolve, reject) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (audioDone === finish) audioDone = null;
        resolve();
      };
      audioDone = finish;
      currentAudio.onended = finish;
      currentAudio.onerror = () => {
        if (settled) return;
        settled = true;
        if (audioDone === finish) audioDone = null;
        reject(new Error('JARVIS səsinin oxudulması alınmadı.'));
      };

      if (meter) {
        const data = new Uint8Array(meter.fftSize);
        const tick = () => {
          if (!currentAudio || currentAudio.paused || settled) return;
          meter.getByteTimeDomainData(data);
          let sum = 0;
          for (const value of data) {
            const sample = (value - 128) / 128;
            sum += sample * sample;
          }
          window.J.lvl = Math.min(0.5, Math.sqrt(sum / data.length) * 1.8);
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }
    });

    await currentAudio.play();
    await playback;
    cancelAnimationFrame(raf);
  } catch (error) {
    console.error('TTS error:', error);
    setHint(`${error.message} Mətn cavabı söhbətdə qalır.`);
  } finally {
    stopAudio();
    speaking = false;
    if (voiceMode) {
      setState('listening', 'SƏNİ DİNLƏYİRƏM');
    } else {
      setState('idle', 'SİSTEM HAZIRDIR');
    }
  }
}

function stopMonitor() {
  if (monitorFrame) cancelAnimationFrame(monitorFrame);
  monitorFrame = 0;
}

function startSegment() {
  if (!voiceMode || busy || speaking || processingVoice || !mediaStream) return;
  if (!window.MediaRecorder) {
    setHint('Bu brauzer səs yazmağı dəstəkləmir. Chrome-u yenilə.');
    return;
  }

  try {
    chunks = [];
    speechDetected = false;
    speechStartedAt = 0;
    lastVoiceAt = 0;
    segmentStartedAt = Date.now();
    discardSegment = false;

    const mimeCandidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus'
    ];
    const mimeType = mimeCandidates.find(type => MediaRecorder.isTypeSupported?.(type));
    mediaRecorder = mimeType
      ? new MediaRecorder(mediaStream, { mimeType, audioBitsPerSecond: 64000 })
      : new MediaRecorder(mediaStream);

    mediaRecorder.ondataavailable = event => {
      if (event.data && event.data.size) chunks.push(event.data);
    };
    mediaRecorder.onerror = event => {
      console.error('MediaRecorder error:', event.error || event);
      setHint('Mikrofon yazısı xətaya düşdü. Yenidən başladılır...');
    };
    mediaRecorder.onstop = () => {
      stopMonitor();
      const recorder = mediaRecorder;
      mediaRecorder = null;
      const recordedChunks = chunks;
      chunks = [];
      if (discardSegment) {
        discardSegment = false;
        if (voiceMode) scheduleSegment(250);
        return;
      }
      const type = recorder?.mimeType || recordedChunks[0]?.type || 'audio/webm';
      const blob = new Blob(recordedChunks, { type });
      if (!speechDetected || blob.size < 1200) {
        if (voiceMode) {
          setHint('Dinləyirəm... danışmağa başla.');
          scheduleSegment(180);
        }
        return;
      }
      processVoiceBlob(blob, type);
    };

    mediaRecorder.start(250);
    setState('listening', 'SƏNİ DİNLƏYİRƏM');
    setHint('Danış. Sən susandan sonra JARVIS sualını avtomatik göndərəcək.');
    monitorSilence();
  } catch (error) {
    console.error('Recorder start error:', error);
    setHint(`Mikrofon yazısı başlaya bilmədi: ${error.message}`);
    stopVoiceMode(false);
  }
}

function monitorSilence() {
  if (!voiceMode || !analyser || !mediaRecorder || mediaRecorder.state !== 'recording') return;
  const data = new Uint8Array(analyser.fftSize);

  const tick = () => {
    if (!voiceMode || !mediaRecorder || mediaRecorder.state !== 'recording') return;

    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const value of data) {
      const sample = (value - 128) / 128;
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / data.length);
    const now = Date.now();
    const elapsed = now - segmentStartedAt;

    if (rms > 0.018) {
      if (!speechDetected) speechStartedAt = now;
      speechDetected = true;
      lastVoiceAt = now;
    }

    const silenceLongEnough = speechDetected && now - lastVoiceAt > 1150;
    const maxDurationReached = elapsed > 14000;
    const emptyTimeout = !speechDetected && elapsed > 18000;

    if ((silenceLongEnough && now - speechStartedAt > 350) ||
        (maxDurationReached && speechDetected) || emptyTimeout) {
      stopCurrentSegment();
      return;
    }

    monitorFrame = requestAnimationFrame(tick);
  };

  stopMonitor();
  monitorFrame = requestAnimationFrame(tick);
}

function stopCurrentSegment(discard = false) {
  stopMonitor();
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
  discardSegment = discard;
  try {
    mediaRecorder.stop();
  } catch (error) {
    console.warn('Recorder stop:', error);
  }
}

function scheduleSegment(delay = 350) {
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    if (voiceMode && !busy && !speaking && !processingVoice) startSegment();
  }, delay);
}

async function processVoiceBlob(blob, mimeType) {
  if (!voiceMode || processingVoice) return;
  processingVoice = true;
  setState('thinking', 'SƏS MƏTNƏ ÇEVRİLİR');
  setHint('Səsini tanıyıram...');

  try {
    const extension = mimeType.includes('mp4') ? 'm4a'
      : mimeType.includes('ogg') ? 'ogg'
      : mimeType.includes('wav') ? 'wav' : 'webm';
    const formData = new FormData();
    formData.append('audio', blob, `f2-jarvis-recording.${extension}`);

    const response = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Səs tanınmadı.');

    let recognized = (data.text || '').trim();
    if (!recognized) {
      setHint('Səsi aydın eşitmədim. Bir az ucadan danış.');
      return;
    }

    // Wake phrase is optional: users can say "Hey Jarvis" or simply ask.
    const wake = recognized.match(/\b(?:hey\s*)?(?:jarvis|jervis|jerviz|jərvis)\b/i);
    if (wake) {
      recognized = (recognized.slice(0, wake.index) + ' ' +
        recognized.slice(wake.index + wake[0].length)).trim();
      recognized = recognized.replace(/^[,.:;!?-]+\s*/, '');
    }

    if (recognized) {
      setHint(`Eşidildi: “${recognized}”`);
      await askJarvis(recognized, true);
    }
  } catch (error) {
    console.error('Voice processing error:', error);
    addMessage('assistant', `Səs xətası: ${error.message}`);
    setHint(`${error.message} Yenidən danışa bilərsən.`);
  } finally {
    processingVoice = false;
    if (voiceMode && !busy && !speaking) scheduleSegment(500);
  }
}

async function startVoiceMode() {
  if (voiceMode) {
    stopVoiceMode();
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    setHint('Mikrofon üçün HTTPS lazımdır. Saytı Render-in https:// ünvanı ilə aç.');
    return;
  }
  if (!window.MediaRecorder) {
    setHint('Bu brauzer MediaRecorder dəstəkləmir. Android Chrome-u yenilə.');
    return;
  }

  try {
    setHint('Mikrofon icazəsi gözlənilir...');
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1
      },
      video: false
    });

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('AudioContext dəstəklənmir.');
    audioContext = new AudioContextClass();
    await audioContext.resume();

    const source = audioContext.createMediaStreamSource(mediaStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    voiceMode = true;
    setVoiceButton(true);
    setHint('Mikrofon aktivdir. Danışmağa başla; susandan sonra cavab verəcəyəm.');
    setState('listening', 'MİKROFON AKTİVDİR');

    if (!window.__f2Greeted) {
      window.__f2Greeted = true;
      await speak('Sistem işə düşdü. Salam, mən F2 JARVIS. Səni dinləyirəm.');
    }
    if (voiceMode) startSegment();
  } catch (error) {
    console.error('Microphone permission/start error:', error);
    stopVoiceMode(false);
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      setHint('Mikrofon icazəsi verilməyib. Android Chrome → Sayt parametrləri → Mikrofon → İcazə ver.');
    } else if (error.name === 'NotFoundError') {
      setHint('Mikrofon tapılmadı. Telefonun mikrofonunu yoxla.');
    } else {
      setHint(`Mikrofon açıla bilmədi: ${error.message}`);
    }
    setState('idle', 'MİKROFON GÖZLƏNİLİR');
  }
}

function stopVoiceMode(updateHint = true) {
  voiceMode = false;
  processingVoice = false;
  clearTimeout(restartTimer);
  stopMonitor();
  stopCurrentSegment(true);
  stopAudio();
  speaking = false;

  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close().catch(() => {});
  }
  audioContext = null;
  analyser = null;
  mediaRecorder = null;
  chunks = [];

  setVoiceButton(false);
  setState('idle', 'SİSTEM HAZIRDIR');
  if (updateHint) setHint('Səsli danışıq dayandırıldı. Yenidən başlatmaq üçün mikrofon düyməsinə bas.');
}

async function askJarvis(text, shouldSpeak = true) {
  const clean = text.trim();
  if (!clean || busy) return;

  busy = true;
  history.push({ role: 'user', content: clean });
  saveHistory();
  addMessage('user', clean);
  input.value = '';
  sendBtn.disabled = true;
  setState('thinking', 'JARVIS DÜŞÜNÜR');

  const typing = document.createElement('div');
  typing.className = 'typing';
  typing.textContent = 'F2 JARVIS cavab hazırlayır...';
  messagesEl.append(typing);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  try {
    lastUserLanguage = detectLanguage(clean);
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'AI cavabı alınmadı.');

    const answer = data.answer || 'Cavab alınmadı.';
    history.push({ role: 'assistant', content: answer });
    saveHistory();
    typing.remove();
    addMessage('assistant', answer);
    busy = false;

    if (speakEnabled && (shouldSpeak || autoSpeak)) {
      await speak(answer);
    } else {
      setState(voiceMode ? 'listening' : 'idle',
        voiceMode ? 'SƏNİ DİNLƏYİRƏM' : 'SİSTEM HAZIRDIR');
    }
  } catch (error) {
    typing.remove();
    addMessage('assistant', `Xəta: ${error.message}`);
    busy = false;
    setState(voiceMode ? 'listening' : 'idle',
      voiceMode ? 'SƏNİ DİNLƏYİRƏM' : 'SİSTEM HAZIRDIR');
  } finally {
    sendBtn.disabled = false;
  }
}

form?.addEventListener('submit', async event => {
  event.preventDefault();
  const text = input?.value?.trim();
  if (!text) return;
  if (voiceMode) stopCurrentSegment(true);
  await askJarvis(text, false);
  if (voiceMode && !speaking && !busy) scheduleSegment(500);
});

voiceBtn?.addEventListener('click', startVoiceMode);

$('clearBtn')?.addEventListener('click', () => {
  history = [];
  saveHistory();
  if (messagesEl) messagesEl.innerHTML = '';
  addMessage('assistant', 'Söhbət təmizləndi. Yeni sualını verə bilərsən.');
});

$('settingsBtn')?.addEventListener('click', () => settingsDialog?.showModal());
$('speakToggle')?.addEventListener('change', event => {
  speakEnabled = event.target.checked;
  if (!speakEnabled) stopAudio();
});
$('autoSpeakToggle')?.addEventListener('change', event => {
  autoSpeak = event.target.checked;
});

async function checkHealth() {
  try {
    const response = await fetch('/api/health');
    const data = await response.json();
    $('connection').textContent = data.aiConfigured
      ? (data.voiceConfigured ? 'AI + SƏS AKTİVDİR' : 'AI AKTİVDİR · SƏS AÇARI LAZIMDIR')
      : 'COMETAPI / GROQ AÇARI LAZIMDIR';
  } catch {
    $('connection').textContent = 'SERVERƏ BAĞLANTI YOXDUR';
  }
}
checkHealth();

window.addEventListener('pagehide', () => {
  stopVoiceMode(false);
});


/* ==========================================
   F2 CHAT TOOLS — IMAGE + LIVE CAMERA CHAT
========================================== */

function askForImagePrompt() {
  const prompt = window.prompt('Yaratmaq istədiyin şəkli təsvir et:');
  if (!prompt || prompt.trim().length < 3) return;
  generateImage(prompt.trim());
}

async function generateImage(prompt) {
  const button = $('imageToolBtn');
  if (button) {
    button.disabled = true;
    button.textContent = 'YARADILIR...';
  }
  setState('thinking', 'ŞƏKİL HAZIRLANIR');
  setHint('AI şəkli hazırlayır. Bir az gözlə...');

  try {
    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Şəkil yaratmaq mümkün olmadı.');
    const url = data.image || data.imageUrl || data.url ||
      data.data?.data?.[0]?.url || data.data?.data?.[0]?.b64_json || data.data?.url;
    if (!url) throw new Error('Şəkil API-si link qaytarmadı. Model və API hesabını yoxla.');
    addImageMessage(url, prompt);
    setHint('Şəkil hazırdır.');
  } catch (error) {
    addMessage('assistant', `Şəkil yaratma xətası: ${error.message}`);
    setHint(error.message);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = '✦ Şəkil yarat';
    }
    setState(voiceMode ? 'listening' : 'idle',
      voiceMode ? 'SƏNİ DİNLƏYİRƏM' : 'SİSTEM HAZIRDIR');
  }
}

let liveCameraStream = null;
let liveCameraTimer = null;
let liveCameraBusy = false;

function ensureCameraDialog() {
  let dialog = $('f2LiveCameraDialog');
  if (dialog) return dialog;

  dialog = document.createElement('dialog');
  dialog.id = 'f2LiveCameraDialog';
  dialog.className = 'f2-camera-dialog';
  dialog.innerHTML = `
    <div class="f2-camera-card">
      <header><strong>F2 JARVIS · CANLI GÖRÜNTÜLÜ SÖHBƏT</strong>
        <button type="button" id="f2CameraClose" aria-label="Bağla">✕</button>
      </header>
      <video id="f2CameraVideo" autoplay muted playsinline></video>
      <div class="f2-camera-actions">
        <button type="button" id="f2CameraStart">Kameranı aç</button>
        <button type="button" id="f2CameraAsk">AI-yə göstər</button>
        <button type="button" id="f2CameraLive">Canlı analizi başlat</button>
        <button type="button" id="f2CameraVoice">🎙 Mikrofonu başlat</button>
        <button type="button" id="f2CameraStop">Dayandır</button>
      </div>
      <p id="f2CameraStatus">Kameranı açmaq üçün düyməyə bas.</p>
    </div>`;
  document.body.append(dialog);

  $('f2CameraClose').addEventListener('click', closeLiveCamera);
  $('f2CameraStart').addEventListener('click', startLiveCamera);
  $('f2CameraAsk').addEventListener('click', () => analyzeCameraFrame(false));
  $('f2CameraLive').addEventListener('click', toggleLiveAnalysis);
  $('f2CameraVoice').addEventListener('click', async () => {
    if (voiceMode) {
      stopVoiceMode();
      $('f2CameraVoice').textContent = '🎙 Mikrofonu başlat';
    } else {
      await startVoiceMode();
      $('f2CameraVoice').textContent = voiceMode ? '■ Mikrofonu dayandır' : '🎙 Mikrofonu başlat';
    }
  });
  $('f2CameraStop').addEventListener('click', stopLiveCamera);
  dialog.addEventListener('click', event => {
    if (event.target === dialog) closeLiveCamera();
  });
  return dialog;
}

function cameraStatus(text) {
  const el = $('f2CameraStatus');
  if (el) el.textContent = text;
}

async function openLiveCamera() {
  const dialog = ensureCameraDialog();
  if (!dialog.open) dialog.showModal();
  if (!liveCameraStream) await startLiveCamera();
}

async function startLiveCamera() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Kamera üçün HTTPS və müasir Chrome lazımdır.');
    }
    if (liveCameraStream) return;
    liveCameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    const video = $('f2CameraVideo');
    video.srcObject = liveCameraStream;
    await video.play();
    cameraStatus('Kamera aktivdir. AI-yə göstər düyməsinə bas və ya canlı analizi başlat.');
  } catch (error) {
    cameraStatus(`Kamera açıla bilmədi: ${error.message}`);
  }
}

async function analyzeCameraFrame(automatic = false) {
  if (liveCameraBusy) return;
  const video = $('f2CameraVideo');
  if (!video || !video.videoWidth) {
    cameraStatus('Əvvəlcə kameranı aç.');
    return;
  }

  liveCameraBusy = true;
  cameraStatus(automatic ? 'Canlı görüntü analiz edilir...' : 'Görüntü AI-yə göndərilir...');
  try {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 960 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL('image/jpeg', 0.72);
    const prompt = automatic
      ? 'Bu canlı kamera kadrını analiz et. Əvvəlki müşahidədən fərqli olan vacib dəyişiklikləri qısa izah et. Görmədiyin şeyi uydurma.'
      : 'Kamerada nə görürsən? Ətraflı, amma aydın şəkildə izah et.';

    const response = await fetch('/api/vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, prompt })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'AI görüntünü analiz edə bilmədi.');

    const answer = data.answer || data.reply || 'Görüntü analiz edildi.';
    const visualPrompt = automatic
      ? '[Canlı kamera görüntüsü] Son görüntüdə müşahidə edilənləri təhlil et.'
      : '[Kamera görüntüsü] Kamerada nə olduğunu təhlil et.';
    history.push({ role: 'user', content: visualPrompt });
    history.push({ role: 'assistant', content: answer });
    saveHistory();
    if (!automatic) addMessage('user', '📷 Kamera görüntüsünü analiz et.');
    addMessage('assistant', answer);
    cameraStatus(answer);
    if (autoSpeak && speakEnabled) await speak(answer);
  } catch (error) {
    cameraStatus(`Analiz xətası: ${error.message}`);
  } finally {
    liveCameraBusy = false;
  }
}

function toggleLiveAnalysis() {
  if (liveCameraTimer) {
    clearInterval(liveCameraTimer);
    liveCameraTimer = null;
    cameraStatus('Canlı analiz dayandırıldı.');
    $('f2CameraLive').textContent = 'Canlı analizi başlat';
    return;
  }
  if (!liveCameraStream) {
    cameraStatus('Əvvəlcə kameranı aç.');
    return;
  }
  $('f2CameraLive').textContent = 'Canlı analizi dayandır';
  analyzeCameraFrame(true);
  liveCameraTimer = setInterval(() => analyzeCameraFrame(true), 9000);
  cameraStatus('Canlı analiz aktivdir. Təxminən 9 saniyədən bir kadr AI-yə göndərilir.');
}

function stopLiveCamera() {
  if (liveCameraTimer) clearInterval(liveCameraTimer);
  liveCameraTimer = null;
  if (liveCameraStream) liveCameraStream.getTracks().forEach(track => track.stop());
  liveCameraStream = null;
  const video = $('f2CameraVideo');
  if (video) video.srcObject = null;
  if ($('f2CameraLive')) $('f2CameraLive').textContent = 'Canlı analizi başlat';
  cameraStatus('Kamera dayandırıldı.');
}

function closeLiveCamera() {
  stopLiveCamera();
  const dialog = $('f2LiveCameraDialog');
  if (dialog?.open) dialog.close();
}

$('imageToolBtn')?.addEventListener('click', askForImagePrompt);
$('cameraToolBtn')?.addEventListener('click', openLiveCamera);

/* Restore the last conversation after refresh. */
if (history.length && messagesEl) {
  messagesEl.innerHTML = '';
  history.forEach(item => addMessage(item.role, item.content));
}
window.F2JARVIS = {
  ask: text => askJarvis(String(text || ''), false),
  generateImage,
  openCamera: openLiveCamera,
  startVoice: startVoiceMode,
  stopVoice: stopVoiceMode,
  getHistory: () => history.slice()
};
