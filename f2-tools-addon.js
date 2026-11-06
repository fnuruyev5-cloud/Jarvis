/* ==========================================
   F2 JARVIS — VIDEO STUDIO
   AI Video Generation
========================================== */

(() => {
  "use strict";

  if (window.F2VideoStudioLoaded) return;
  window.F2VideoStudioLoaded = true;

  const launcher = document.createElement("button");
  launcher.id = "f2VideoEditorLauncher";
  launcher.textContent = "✦ AI VIDEO STUDIO";

  const panel = document.createElement("section");
  panel.id = "f2VideoEditorPanel";

  panel.innerHTML = `
    <div class="f2ve-header">
      <div>
        <div class="f2ve-title">F2 AI VIDEO STUDIO</div>
        <div class="f2ve-subtitle">AI video generation</div>
      </div>
      <button id="f2veClose">✕</button>
    </div>

    <div class="f2ve-content">
      <div class="f2ve-label">Video təsviri</div>

      <textarea id="f2vePrompt"
        placeholder="Məsələn: Futuristik şəhərdə uçan avtomobil, cinematic 4K görüntü..."></textarea>

      <div class="f2ve-label">Video müddəti</div>

      <select id="f2veDuration">
        <option value="5">5 saniyə</option>
        <option value="10">10 saniyə</option>
        <option value="15">15 saniyə</option>
      </select>

      <div class="f2ve-label">AI modeli</div>

      <select id="f2veModel">
        <option value="wan3.0-prime">Wan 3.0 Prime</option>
      </select>

      <button id="f2veGenerate" class="f2ve-primary">
        ✦ VIDEO YARAT
      </button>

      <div id="f2veStatus">Hazırdır.</div>

      <div id="f2veResultBox" hidden>
        <div class="f2ve-label">Yaradılmış video</div>
        <video id="f2veResult" controls playsinline></video>
        <a id="f2veDownload" download="f2-jarvis-video.mp4">
          Videonu yüklə
        </a>
      </div>
    </div>
  `;

  document.body.append(launcher, panel);

  const $ = id => document.getElementById(id);

  function status(message, error = false) {
    $("f2veStatus").textContent = message;
    $("f2veStatus").style.color =
      error ? "#ff7777" : "#65eaff";
  }

  launcher.onclick = () => panel.classList.add("active");
  $("f2veClose").onclick = () => panel.classList.remove("active");

  function showResult(url) {
    $("f2veResult").src = url;
    $("f2veDownload").href = url;
    $("f2veResultBox").hidden = false;
  }

  $("f2veGenerate").addEventListener("click", async () => {
    const prompt = $("f2vePrompt").value.trim();

    if (prompt.length < 3) {
      status("Video təsviri yaz.", true);
      return;
    }

    const button = $("f2veGenerate");
    button.disabled = true;
    button.textContent = "VIDEO HAZIRLANIR...";

    status("AI video sorğusu göndərilir...");

    try {
      const response = await fetch("/api/videos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt,
          seconds: Number($("f2veDuration").value),
          model: $("f2veModel").value
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Video yaradılmadı.");
      }

      const url =
        data.videoUrl ||
        data.video_url ||
        data.url;

      if (url) {
        showResult(url);
        status("Video hazırdır!");
      } else if (data.id || data.task_id || data.jobId) {
        status("Video işi yaradıldı. Tapşırıq ID: " +
          (data.id || data.task_id || data.jobId));
      } else {
        status("Server cavabı alındı, lakin video linki yoxdur.", true);
      }

    } catch (error) {
      status(error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = "✦ VIDEO YARAT";
    }
  });

  window.F2VideoStudio = {
    open: () => panel.classList.add("active"),
    close: () => panel.classList.remove("active")
  };

})();
