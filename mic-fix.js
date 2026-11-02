/* F2 JARVIS microphone recovery patch
 * Load this file after the page's existing app.js.
 * Preferred button: id="micBtn" or data-mic-button
 * Preferred input:  id="messageInput" or data-chat-input
 */
(() => {
  'use strict';
  if (window.__F2_MIC_FIX_LOADED__) return;
  window.__F2_MIC_FIX_LOADED__ = true;

  const BUTTONS = '#micBtn, #mic, #mic-button, #microphoneBtn, [data-mic-button], [aria-label*="microphone" i], [aria-label*="mikrofon" i]';
  const INPUTS = '#messageInput, #chatInput, #promptInput, #userInput, [data-chat-input], textarea, input[type="text"]';
  const SENDS = '#sendBtn, #send-button, #send, [data-send-button], button[type="submit"]';
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let active = false;
  let starting = false;
  let permissionStream = null;
  let lastFinal = '';
  let restartTimer = null;

  const $ = (s, root = document) => root.querySelector(s);
  const setStatus = (state, message) => {
    window.J = window.J || { state: 'idle', lvl: 0 };
    if (state === 'listening') window.J.state = 'listening';
    else if (state === 'speaking') window.J.state = 'speaking';
    else if (window.J.state !== 'speaking') window.J.state = 'idle';
    document.documentElement.dataset.f2MicState = state;
    document.dispatchEvent(new CustomEvent('f2jarvis:mic-status', { detail: { state, message } }));
    const status = $('[data-mic-status], #micStatus, #status');
    if (status && message) status.textContent = message;
    document.querySelectorAll(BUTTONS).forEach(btn => {
      btn.classList.toggle('is-listening', state === 'listening');
      btn.setAttribute('aria-pressed', String(active));
      btn.title = active ? 'Dinləmə aktivdir — dayandırmaq üçün bas' : 'JARVIS-i dinləməyə başlat';
    });
  };

  function getButtonFromTarget(target) {
    return target instanceof Element ? target.closest(BUTTONS) : null;
  }

  async function requestMicPermission() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Bu brauzer mikrofon icazəsini dəstəkləmir. Chrome istifadə edin.');
    }
    // Request permission from a real button click, then release the device.
    permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    permissionStream.getTracks().forEach(track => track.stop());
    permissionStream = null;
  }

  function makeRecognition() {
    if (!SR) throw new Error('Səs tanıma bu brauzerdə mövcud deyil. Android Chrome-da yoxlayın.');
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.lang = document.documentElement.lang || 'az-AZ';
    r.onstart = () => { starting = false; setStatus('listening', 'JARVIS dinləyir… “Hey Jarvis” deyin.'); };
    r.onerror = (event) => {
      starting = false;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        active = false;
        setStatus('error', 'Mikrofon icazəsi rədd edildi. Sayt icazələrindən mikrofonu aktiv edin.');
      } else if (event.error === 'no-speech') {
        setStatus('listening', 'Sizi dinləyirəm…');
      } else {
        setStatus('error', 'Mikrofon xətası: ' + event.error);
      }
    };
    r.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = (event.results[i][0]?.transcript || '').trim();
        if (event.results[i].isFinal && text) {
          if (text === lastFinal) continue;
          lastFinal = text;
          handleFinalTranscript(text);
        } else interim += text;
      }
      if (interim) setStatus('listening', 'Eşidilir: ' + interim);
    };
    r.onend = () => {
      starting = false;
      if (active) {
        clearTimeout(restartTimer);
        restartTimer = setTimeout(() => {
          if (!active || starting) return;
          try { starting = true; r.start(); }
          catch (_) { starting = false; }
        }, 350);
      } else setStatus('idle', 'Dinləmə dayandırıldı.');
    };
    return r;
  }

  function handleFinalTranscript(text) {
    const clean = text.replace(/[.!?]+$/g, '').trim();
    const wake = /\b(hey\s+)?jarvis\b/i.test(clean);
    const command = clean.replace(/^.*?\bjarvis\b[,:\s-]*/i, '').trim();
    if (wake && !command) {
      setStatus('listening', 'Buyurun, sizi dinləyirəm.');
      speakLocal('Buyurun, sizi dinləyirəm.');
      return;
    }
    const message = wake ? command : clean;
    if (!message) return;
    setStatus('thinking', 'Cavab hazırlanır…');
    document.dispatchEvent(new CustomEvent('f2jarvis:transcript', { detail: { text: message, raw: text } }));
    const input = $(INPUTS);
    if (input) {
      input.value = message;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      const form = input.closest('form');
      const send = (form && $(SENDS, form)) || $(SENDS);
      if (send) send.click();
      else if (form) form.requestSubmit?.();
    }
  }

  function speakLocal(text) {
    if (!('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = document.documentElement.lang || 'az-AZ';
      u.rate = 0.96;
      u.pitch = 0.82;
      u.onstart = () => setStatus('speaking', 'JARVIS danışır…');
      u.onend = () => { if (active) setStatus('listening', 'JARVIS yenidən dinləyir…'); };
      speechSynthesis.speak(u);
    } catch (_) {}
  }

  async function start() {
    if (active || starting) return;
    try {
      await requestMicPermission();
      if (!recognition) recognition = makeRecognition();
      active = true;
      starting = true;
      lastFinal = '';
      recognition.start();
    } catch (err) {
      active = false;
      starting = false;
      setStatus('error', err?.message || 'Mikrofon açıla bilmədi.');
      alert(err?.message || 'Mikrofon açıla bilmədi. Sayt HTTPS üzərindən açılmalıdır.');
    }
  }

  function stop() {
    active = false;
    starting = false;
    clearTimeout(restartTimer);
    try { recognition?.stop(); } catch (_) {}
    try { permissionStream?.getTracks().forEach(t => t.stop()); } catch (_) {}
    setStatus('idle', 'Dinləmə dayandırıldı.');
  }

  // Capture-phase delegation means this still works if app.js attached a broken handler.
  document.addEventListener('click', (event) => {
    const button = getButtonFromTarget(event.target);
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (active) stop(); else start();
  }, true);

  // Existing chat UI can notify this patch when its AI response has finished.
  document.addEventListener('f2jarvis:response-finished', () => {
    if (active) setStatus('listening', 'JARVIS yenidən dinləyir…');
  });

  // Public controls for debugging / other app scripts.
  window.F2Mic = { start, stop, get active() { return active; } };
  window.addEventListener('pagehide', stop);
  console.info('[F2 JARVIS] microphone recovery patch loaded');
})();
