/* ==========================================
   F2 JARVIS — AI VIDEO EDITOR ADDON
   Upload • AI Edit • 4K Upscale
========================================== */

(() => {
  "use strict";

  if (window.F2VideoEditorLoaded) return;
  window.F2VideoEditorLoaded = true;

  const style = document.createElement("style");
  style.id = "f2-video-editor-inline";
  document.head.appendChild(style);

  const launcher = document.createElement("button");
  launcher.id = "f2VideoEditorLauncher";
  launcher.innerHTML = "✦ AI VIDEO EDITOR";

  const panel = document.createElement("section");
  panel.id = "f2VideoEditorPanel";

  panel.innerHTML = `
    <div class="f2ve-header">
      <div>
        <div class="f2ve-title">F2 AI VIDEO EDITOR</div>
        <div class="f2ve-subtitle">AI-powered video studio</div>
      </div>
      <button id="f2veClose">✕</button>
    </div>

    <div class="f2ve-content">

      <div class="f2ve-upload" id="f2veDrop">
        <div class="f2ve-upload-icon">＋</div>
        <strong>Video yüklə</strong>
        <span>MP4, MOV, WEBM</span>
        <input type="file" id="f2veFile" accept="video/*" hidden>
        <button id="f2veChoose">Video seç</button>
      </div>

      <div id="f2vePreviewBox" hidden>
        <video id="f2vePreview" controls playsinline></video>
        <div id="f2veFileName"></div>
        <button id="f2veRemove" class="f2ve-secondary">
          Videonu sil
        </button>
      </div>

      <div class="f2ve-label">AI-yə nə etmək istədiyini yaz</div>

      <textarea id="f2vePrompt"
        placeholder="Məsələn: Arxa fonu futuristik şəhərlə dəyiş, videoya cinematic effekt əlavə et..."></textarea>

      <div class="f2ve-label">Redaktə modeli</div>

      <select id="f2veModel">
        <option value="gen4_aleph">Runway Gen-4 Aleph</option>
      </select>

      <button id="f2veEdit" class="f2ve-primary">
        ✦ AI İLƏ REDAKTƏ ET
      </button>

      <div class="f2ve-divider"></div>

      <div class="f2ve-label">Video keyfiyyətini yüksəlt</div>

      <select id="f2veQuality">
        <option value="4K">4K Ultra HD</option>
        <option value="1080p">1080p Full HD</option>
      </select>

      <button id="f2veUpscale" class="f2ve-secondary">
        ⬆ KEYFİYYƏTİ YÜKSƏLT
      </button>

      <div id="f2veStatus">Hazırdır.</div>

      <div id="f2veResultBox" hidden>
        <div class="f2ve-label">Nəticə</div>
        <video id="f2veResult" controls playsinline></video>
        <a id="f2veDownload" download="f2-jarvis-edited-video.mp4">
          Videonu yüklə
        </a>
      </div>

    </div>
  `;

  document.body.appendChild(launcher);
  document.body.appendChild(panel);

  const $ = id => document.getElementById(id);

  let selectedFile = null;
  let originalURL = null;
  let jobTimer = null;

  function status(message, error = false) {
    $("f2veStatus").textContent = message;
    $("f2veStatus").style.color = error ? "#ff7777" : "#65eaff";
  }

  function setBusy(busy) {
    $("f2veEdit").disabled = busy;
    $("f2veUpscale").disabled = busy;

    $("f2veEdit").textContent = busy
      ? "İŞLƏNİR..."
      : "✦ AI İLƏ REDAKTƏ ET";

    $("f2veUpscale").textContent = busy
      ? "İŞLƏNİR..."
      : "⬆ KEYFİYYƏTİ YÜKSƏLT";
  }

  function openPanel() {
    panel.classList.add("active");
  }

  function closePanel() {
    panel.classList.remove("active");
  }

  launcher.addEventListener("click", openPanel);
  $("f2veClose").addEventListener("click", closePanel);

  $("f2veChoose").addEventListener("click", () => {
    $("f2veFile").click();
  });

  $("f2veDrop").addEventListener("click", event => {
    if (event.target.tagName !== "BUTTON") {
      $("f2veFile").click();
    }
  });

  $("f2veFile").addEventListener("change", event => {
    const file = event.target.files[0];
    if (file) loadVideo(file);
  });

  function loadVideo(file) {
    if (!file.type.startsWith("video/")) {
      status("Video faylı seçilməlidir.", true);
      return;
    }

    if (file.size > 200 * 1024 * 1024) {
      status("Video maksimum 200 MB ola bilər.", true);
      return;
    }

    selectedFile = file;

    if (originalURL) URL.revokeObjectURL(originalURL);

    originalURL = URL.createObjectURL(file);

    $("f2vePreview").src = originalURL;
    $("f2veFileName").textContent =
      file.name + " • " + (file.size / 1024 / 1024).toFixed(1) + " MB";

    $("f2vePreviewBox").hidden = false;
    $("f2veDrop").hidden = true;

    $("f2veResultBox").hidden = true;

    status("Video yükləndi. Redaktəyə hazırsan.");
  }

  $("f2veRemove").addEventListener("click", () => {
    selectedFile = null;
    $("f2veFile").value = "";
    $("f2vePreview").pause();
    $("f2vePreview").removeAttribute("src");
    $("f2vePreviewBox").hidden = true;
    $("f2veDrop").hidden = false;
    $("f2veResultBox").hidden = true;

    if (originalURL) {
      URL.revokeObjectURL(originalURL);
      originalURL = null;
    }

    status("Video silindi.");
  });

  async function submitVideo(endpoint, extra = {}) {
    if (!selectedFile) {
      status("Əvvəlcə video yüklə.", true);
      return;
    }

    const formData = new FormData();
    formData.append("video", selectedFile);

    Object.entries(extra).forEach(([key, value]) => {
      formData.append(key, value);
    });

    setBusy(true);
    status("Video serverə göndərilir...");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Server xətası");
      }

      const videoUrl =
        data.videoUrl ||
        data.video_url ||
        data.url;

      if (videoUrl) {
        showResult(videoUrl);
        status("Video hazırdır!");
        return;
      }

      const jobId = data.id || data.jobId || data.task_id;

      if (jobId) {
        status("AI videonu hazırlayır...");
        pollJob(jobId);
        return;
      }

      throw new Error("Server video nəticəsi qaytarmadı.");

    } catch (error) {
      status(error.message || "Video redaktəsi uğursuz oldu.", true);
    } finally {
      setBusy(false);
    }
  }

  async function pollJob(jobId) {
    let attempts = 0;

    clearInterval(jobTimer);

    jobTimer = setInterval(async () => {
      attempts++;

      if (attempts > 120) {
        clearInterval(jobTimer);
        status("İşləmə vaxtı bitdi. Yenidən yoxla.", true);
        return;
      }

      try {
        const response = await fetch(
          "/api/videos/" + encodeURIComponent(jobId)
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Status yoxlanılmadı.");
        }

        const state = String(
          data.status || data.state || ""
        ).toLowerCase();

        const url =
          data.videoUrl ||
          data.video_url ||
          data.url ||
          data.output?.url;

        if (
          url ||
          ["completed", "complete", "succeeded", "success", "done"].includes(state)
        ) {
          clearInterval(jobTimer);

          if (url) {
            showResult(url);
            status("Video uğurla hazırlandı!");
          } else {
            status("Video tamamlandı, amma nəticə linki tapılmadı.", true);
          }

          setBusy(false);
          return;
        }

        if (["failed", "error", "cancelled"].includes(state)) {
          clearInterval(jobTimer);
          status(data.error || "AI video hazırlaya bilmədi.", true);
          setBusy(false);
          return;
        }

        status("Video hazırlanır... " + attempts);

      } catch (error) {
        clearInterval(jobTimer);
        status(error.message, true);
        setBusy(false);
      }
    }, 5000);
  }

  function showResult(url) {
    $("f2veResult").src = url;
    $("f2veDownload").href = url;
    $("f2veResultBox").hidden = false;
  }

  $("f2veEdit").addEventListener("click", () => {
    const prompt = $("f2vePrompt").value.trim();

    if (!prompt) {
      status("Redaktə üçün göstəriş yaz.", true);
      return;
    }

    submitVideo("/api/videos/edit", {
      prompt,
      model: $("f2veModel").value
    });
  });

  $("f2veUpscale").addEventListener("click", () => {
    submitVideo("/api/videos/upscale", {
      quality: $("f2veQuality").value
    });
  });

  window.F2VideoEditor = {
    open: openPanel,
    close: closePanel,
    loadVideo
  };

})();
