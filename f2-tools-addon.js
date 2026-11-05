
/* F2 JARVIS — PREMIUM AI TOOLS */
(() => {
  if (window.__F2_TOOLS_ADDON__) return;
  window.__F2_TOOLS_ADDON__ = true;

  const $ = id => document.getElementById(id);

  const launcher = document.createElement("button");
  launcher.id = "f2ToolsLauncher";
  launcher.type = "button";
  launcher.textContent = "✦ JARVIS TOOLS";

  const panel = document.createElement("section");
  panel.id = "f2ToolsPanel";

  panel.innerHTML = `
    <div class="f2-tools-header">
      <div><small>F2 SYSTEM</small><h3>✦ JARVIS TOOLS</h3></div>
      <button id="f2ToolsClose">✕</button>
    </div>

    <div class="f2-tool-section">
      <h4>📷 AI Kamera</h4>
      <div class="f2-tools-row">
        <button id="f2CameraStart">Kameranı aç</button>
        <button id="f2CameraCapture">Şəkil çək</button>
        <button id="f2CameraStop">Bağla</button>
      </div>
      <video id="f2CameraVideo" autoplay playsinline></video>
      <canvas id="f2CameraCanvas"></canvas>
      <button id="f2CameraAsk" class="f2-wide-btn">JARVIS, bunu analiz et</button>
      <button id="f2CameraDownload" class="f2-wide-btn">Şəkli yüklə</button>
      <p class="f2-tools-note" id="f2CameraStatus">Kamera hazırdır.</p>
    </div>

    <div class="f2-tool-section">
      <h4>🎨 AI Şəkil generatoru</h4>
      <textarea id="f2ImagePrompt" placeholder="Şəkli təsvir et..."></textarea>
      <button id="f2GenerateImage" class="f2-wide-btn">✦ Şəkil yarat</button>
      <p id="f2ImageStatus" class="f2-tools-note">Hazırdır.</p>
      <img id="f2ImageResult" alt="AI nəticəsi">
      <a id="f2ImageDownload" download="f2-jarvis.png">Şəkli yüklə</a>
    </div>

    <div class="f2-tool-section">
      <h4>🎬 AI Video generatoru</h4>
      <textarea id="f2VideoPrompt" placeholder="Video səhnəsini təsvir et..."></textarea>
      <label for="f2VideoDuration">Video müddəti</label>
      <select id="f2VideoDuration">
        <option value="5">5 saniyə</option>
        <option value="10">10 saniyə</option>
        <option value="15">15 saniyə</option>
      </select>
      <button id="f2GenerateVideo" class="f2-wide-btn">🎬 Video yarat</button>
      <p id="f2VideoStatus" class="f2-tools-note">Video generatoru hazırdır.</p>
      <video id="f2VideoResult" controls playsinline></video>
    </div>

    <div class="f2-tool-section">
      <h4>🧠 Əlavə alətlər</h4>
      <div class="f2-tools-row">
        <button id="f2OpenSpline">Spline 3D</button>
        <button id="f2CheckVision">Vision yoxla</button>
      </div>
    </div>

    <div class="f2-tools-footer">F2 JARVIS • TOOLS SYSTEM</div>
  `;

  document.body.append(launcher, panel);

  const toggle = () => panel.classList.toggle("open");
  launcher.addEventListener("click", toggle);
  $("f2ToolsClose").addEventListener("click", () => panel.classList.remove("open"));

  // CAMERA
  let cameraStream = null;
  let capturedBlob = null;

  const video = $("f2CameraVideo");
  const canvas = $("f2CameraCanvas");
  const cameraStatus = $("f2CameraStatus");

  $("f2CameraStart").addEventListener("click", async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Kamera üçün HTTPS bağlantısı lazımdır.");
      }

      stopCamera(false);

      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false
      });

      video.srcObject = cameraStream;
      video.style.display = "block";
      await video.play();
      cameraStatus.textContent = "Kamera aktivdir.";
    } catch (error) {
      cameraStatus.textContent = "Kamera xətası: " + error.message;
    }
  });

  $("f2CameraCapture").addEventListener("click", captureFrame);

  function captureFrame() {
    if (!video.videoWidth) {
      cameraStatus.textContent = "Əvvəl kameranı aç.";
      return false;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);

    return true;
  }

  $("f2CameraAsk").addEventListener("click", async () => {
    if (!captureFrame()) return;

    cameraStatus.textContent = "JARVIS görüntünü analiz edir...";

    try {
      const image = canvas.toDataURL("image/jpeg", 0.75);

      const response = await fetch("/api/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image,
          prompt: "Bu görüntünü diqqətlə analiz et. Gördüklərini Azərbaycan dilində izah et."
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Vision xətası");

      const answer = data.answer || data.text;
      if (!answer) throw new Error("AI cavabı gəlmədi.");

      cameraStatus.textContent = answer;

      if (typeof window.askJarvis === "function") {
        window.askJarvis("Kamera analizi: " + answer, true);
      } else if (typeof window.speak === "function") {
        window.speak(answer);
      }
    } catch (error) {
      cameraStatus.textContent = "Xəta: " + error.message;
    }
  });

  $("f2CameraDownload").addEventListener("click", () => {
    if (!captureFrame()) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/jpeg", 0.92);
    link.download = "f2-jarvis-camera.jpg";
    link.click();
  });

  $("f2CameraStop").addEventListener("click", () => stopCamera());

  function stopCamera(update = true) {
    cameraStream?.getTracks().forEach(track => track.stop());
    cameraStream = null;
    video.srcObject = null;
    video.style.display = "none";
    if (update) cameraStatus.textContent = "Kamera bağlandı.";
  }

  window.addEventListener("pagehide", () => stopCamera(false));

  // IMAGE GENERATION
  $("f2GenerateImage").addEventListener("click", async () => {
    const prompt = $("f2ImagePrompt").value.trim();
    const status = $("f2ImageStatus");
    const button = $("f2GenerateImage");

    if (prompt.length < 3) {
      status.textContent = "Əvvəl təsvir yaz.";
      return;
    }

    button.disabled = true;
    status.textContent = "Şəkil yaradılır...";

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Şəkil yaradıla bilmədi.");

      const image = data.image || data.imageUrl || data.dataUrl;
      if (!image) throw new Error("Şəkil məlumatı gəlmədi.");

      $("f2ImageResult").src = image;
      $("f2ImageResult").style.display = "block";
      $("f2ImageDownload").href = image;
      $("f2ImageDownload").style.display = "block";
      status.textContent = "✓ Şəkil hazırdır.";
    } catch (error) {
      status.textContent = "Xəta: " + error.message;
    } finally {
      button.disabled = false;
    }
  });

  // VIDEO GENERATION
  $("f2GenerateVideo").addEventListener("click", async () => {
    const prompt = $("f2VideoPrompt").value.trim();
    const duration = Number($("f2VideoDuration").value);
    const button = $("f2GenerateVideo");
    const status = $("f2VideoStatus");

    if (prompt.length < 3) {
      status.textContent = "Video təsviri yaz.";
      return;
    }

    button.disabled = true;
    status.textContent = "Video yaradılması başladılır...";

    try {
      const response = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, seconds: duration })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Video başlatmaq olmadı.");

      const id = data.id || data.video_id;
      if (!id) throw new Error("Video tapşırıq ID-si gəlmədi.");

      status.textContent = "Video hazırlanır...";

      let completed = false;

      for (let attempt = 0; attempt < 90; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        const check = await fetch("/api/videos/" + encodeURIComponent(id));
        const result = await check.json();

        if (!check.ok) throw new Error(result.error || "Video statusu alınmadı.");

        const state = String(result.status || result.state || "").toLowerCase();

        if (["completed", "succeeded", "success", "done"].includes(state)) {
          const url = result.url || result.video_url || result.output?.url;
          if (!url) throw new Error("Hazır video linki gəlmədi.");

          $("f2VideoResult").src = url;
          $("f2VideoResult").style.display = "block";
          status.textContent = "✓ Video hazırdır.";
          completed = true;
          break;
        }

        if (["failed", "error", "cancelled"].includes(state)) {
          throw new Error(result.error || "Video yaradılması uğursuz oldu.");
        }
      }

      if (!completed) status.textContent = "Video hələ hazırlanır. Sonra yenidən yoxla.";
    } catch (error) {
      status.textContent = "Xəta: " + error.message;
    } finally {
      button.disabled = false;
    }
  });

  // OTHER TOOLS
  $("f2OpenSpline").addEventListener("click", () => {
    window.open("https://app.spline.design/", "_blank", "noopener,noreferrer");
  });

  $("f2CheckVision").addEventListener("click", () => {
    alert("F2 JARVIS VISION\nKamera analiz funksiyası server API vasitəsilə işləyir.");
  });

  // COPY CODE BUTTONS
  function addCopyButtons(root = document) {
    root.querySelectorAll("pre").forEach(pre => {
      if (pre.dataset.f2CopyReady) return;
      pre.dataset.f2CopyReady = "1";

      const button = document.createElement("button");
      button.className = "f2-copy-code";
      button.type = "button";
      button.textContent = "Kodu kopyala";

      button.addEventListener("click", async () => {
        const code = pre.querySelector("code")?.innerText || pre.innerText;

        try {
          await navigator.clipboard.writeText(code);
          button.textContent = "Kopyalandı ✓";
        } catch {
          const area = document.createElement("textarea");
          area.value = code;
          document.body.append(area);
          area.select();
          const ok = document.execCommand("copy");
          area.remove();
          button.textContent = ok ? "Kopyalandı ✓" : "Kopyalanmadı";
        }

        setTimeout(() => button.textContent = "Kodu kopyala", 1600);
      });

      pre.insertBefore(button, pre.firstChild);
    });
  }

  addCopyButtons();

  new MutationObserver(mutations => {
    mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
      if (node.nodeType === 1) addCopyButtons(node.matches?.("pre") ? node.parentNode : node);
    }));
  }).observe(document.body, { childList: true, subtree: true });

})();
 
