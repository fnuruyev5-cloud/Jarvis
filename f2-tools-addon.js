
/* F2 JARVIS — PREMIUM TOOLS ADDON */
(() => {
  if (window.__F2_TOOLS_ADDON__) return;
  window.__F2_TOOLS_ADDON__ = true;

  const $ = selector => document.querySelector(selector);

  const launcher = document.createElement("button");
  launcher.id = "f2ToolsLauncher";
  launcher.type = "button";
  launcher.innerHTML = "✦ JARVIS TOOLS";

  const panel = document.createElement("section");
  panel.id = "f2ToolsPanel";

  panel.innerHTML = `
    <div class="f2-tools-header">
      <div>
        <small>F2 SYSTEM</small>
        <h3>✦ JARVIS TOOLS</h3>
      </div>
      <button type="button" id="f2ToolsClose" aria-label="Bağla">✕</button>
    </div>

    <div class="f2-tool-section">
      <h4>📷 Kamera sistemi</h4>
      <div class="f2-tools-row">
        <button type="button" id="f2CameraStart">Kameranı aç</button>
        <button type="button" id="f2CameraCapture">Şəkil çək</button>
        <button type="button" id="f2CameraStop">Bağla</button>
      </div>
      <video id="f2CameraVideo" autoplay playsinline></video>
      <canvas id="f2CameraCanvas"></canvas>
      <button type="button" id="f2CameraDownload" class="f2-wide-btn">
        Şəkli yüklə
      </button>
      <p class="f2-tools-note" id="f2CameraStatus">Kamera hazırdır.</p>
    </div>

    <div class="f2-tool-section">
      <h4>🎨 AI şəkil generatoru</h4>
      <textarea id="f2ImagePrompt"
        placeholder="Yaratmaq istədiyin şəkli ətraflı təsvir et..."></textarea>
      <button type="button" id="f2GenerateImage" class="f2-wide-btn">
        ✦ Şəkil yarat
      </button>
      <p class="f2-tools-note" id="f2ImageStatus">
        Nano Banana API bağlantısı gözlənilir.
      </p>
      <img id="f2ImageResult" alt="F2 JARVIS AI şəkli">
      <a id="f2ImageDownload" download="f2-jarvis-ai.png">
        Şəkli yüklə
      </a>
    </div>

    <div class="f2-tool-section">
      <h4>🧠 Əlavə alətlər</h4>
      <div class="f2-tools-row">
        <button type="button" id="f2OpenSpline">Spline 3D</button>
        <button type="button" id="f2CheckVision">Vision yoxla</button>
      </div>
      <p class="f2-tools-note">
        Vision modelləri ayrıca inteqrasiya tələb edir.
      </p>
    </div>

    <div class="f2-tools-footer">
      F2 JARVIS • TOOLS SYSTEM
    </div>
  `;

  document.body.append(launcher, panel);

  const togglePanel = () => panel.classList.toggle("open");

  launcher.addEventListener("click", togglePanel);

  $("#f2ToolsClose").addEventListener("click", () => {
    panel.classList.remove("open");
  });

  // ========================================
  // CAMERA
  // ========================================

  let cameraStream = null;
  let capturedBlob = null;

  const video = $("#f2CameraVideo");
  const canvas = $("#f2CameraCanvas");
  const cameraStatus = $("#f2CameraStatus");

  $("#f2CameraStart").addEventListener("click", async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Kamera API dəstəklənmir. HTTPS yoxla.");
      }

      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }

      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      video.srcObject = cameraStream;
      video.style.display = "block";

      await video.play();

      cameraStatus.textContent = "Kamera aktivdir.";

    } catch (error) {
      cameraStatus.textContent = "Kamera xətası: " + error.message;
    }
  });

  $("#f2CameraCapture").addEventListener("click", () => {
    if (!video.videoWidth) {
      cameraStatus.textContent = "Əvvəl kameranı aç.";
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0);

    canvas.toBlob(blob => {
      if (!blob) {
        cameraStatus.textContent = "Şəkil çəkilə bilmədi.";
        return;
      }

      capturedBlob = blob;
      cameraStatus.textContent = "Şəkil uğurla çəkildi.";
    }, "image/jpeg", 0.92);
  });

  $("#f2CameraDownload").addEventListener("click", () => {
    if (!capturedBlob) {
      cameraStatus.textContent = "Əvvəl şəkil çək.";
      return;
    }

    const url = URL.createObjectURL(capturedBlob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "f2-jarvis-camera.jpg";
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });

  $("#f2CameraStop").addEventListener("click", stopCamera);

  function stopCamera() {
    cameraStream?.getTracks().forEach(track => track.stop());
    cameraStream = null;
    video.srcObject = null;
    video.style.display = "none";
    cameraStatus.textContent = "Kamera bağlandı.";
  }

  window.addEventListener("pagehide", stopCamera);

  // ========================================
  // NANO BANANA IMAGE GENERATION
  // ========================================

  const generateButton = $("#f2GenerateImage");
  const imagePrompt = $("#f2ImagePrompt");
  const imageStatus = $("#f2ImageStatus");
  const imageResult = $("#f2ImageResult");
  const imageDownload = $("#f2ImageDownload");

  generateButton.addEventListener("click", async () => {
    const prompt = imagePrompt.value.trim();

    if (prompt.length < 3) {
      imageStatus.textContent = "Əvvəl şəkil təsvirini yaz.";
      return;
    }

    generateButton.disabled = true;
    generateButton.textContent = "Şəkil yaradılır...";
    imageStatus.textContent = "Nano Banana işləyir...";
    imageResult.style.display = "none";
    imageDownload.style.display = "none";

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success === false) {
        throw new Error(
          data.error || "Şəkil yaratmaq mümkün olmadı."
        );
      }

      const imageUrl =
        data.image || data.imageUrl || data.dataUrl;

      if (!imageUrl) {
        throw new Error("Server şəkil məlumatı qaytarmadı.");
      }

      imageResult.src = imageUrl;
      imageResult.style.display = "block";

      imageDownload.href = imageUrl;
      imageDownload.style.display = "block";

      imageStatus.textContent = "✓ Şəkil hazırdır.";

    } catch (error) {
      imageStatus.textContent = "Xəta: " + error.message;
    } finally {
      generateButton.disabled = false;
      generateButton.textContent = "✦ Şəkil yarat";
    }
  });

  // ========================================
  // SPLINE 3D
  // ========================================

  $("#f2OpenSpline").addEventListener("click", () => {
    window.open(
      "https://app.spline.design/",
      "_blank",
      "noopener,noreferrer"
    );
  });

  // ========================================
  // VISION LIBRARIES
  // ========================================

  $("#f2CheckVision").addEventListener("click", () => {
    const mediaPipe = Boolean(
      window.Pose ||
      window.FaceMesh ||
      window.Hands ||
      window.FilesetResolver
    );

    const tensorflow = Boolean(window.tf);

    alert(
      "F2 JARVIS VISION STATUS\n\n" +
      "MediaPipe: " + (mediaPipe ? "Tapıldı" : "Yüklənməyib") +
      "\nTensorFlow.js: " + (tensorflow ? "Tapıldı" : "Yüklənməyib") +
      "\n\nKitabxanaların olması hələ AI kamera funksiyalarının hazır olması demək deyil."
    );
  });

  // ========================================
  // COPY CODE BUTTONS
  // ========================================

  function addCopyButtons(root = document) {
    root.querySelectorAll("pre").forEach(pre => {
      if (pre.dataset.f2CopyReady) return;

      pre.dataset.f2CopyReady = "1";

      const button = document.createElement("button");
      button.className = "f2-copy-code";
      button.type = "button";
      button.textContent = "Kodu kopyala";

      button.addEventListener("click", async () => {
        const code =
          pre.querySelector("code")?.innerText || pre.innerText;

        try {
          await navigator.clipboard.writeText(code);
          button.textContent = "Kopyalandı ✓";
        } catch {
          const area = document.createElement("textarea");
          area.value = code;
          area.style.position = "fixed";
          area.style.opacity = "0";

          document.body.appendChild(area);
          area.select();

          const copied = document.execCommand("copy");
          area.remove();

          button.textContent = copied
            ? "Kopyalandı ✓"
            : "Kopyalama alınmadı";
        }

        setTimeout(() => {
          button.textContent = "Kodu kopyala";
        }, 1600);
      });

      pre.insertBefore(button, pre.firstChild);
    });
  }

  addCopyButtons();

  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;

        if (node.matches?.("pre")) {
          addCopyButtons(node.parentNode);
        } else {
          addCopyButtons(node);
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

})();
