/* F2 JARVIS — AI VIDEO STUDIO + VIDEO EDITOR */
(() => {
  "use strict";
  if (window.F2VideoStudioLoaded) return;
  window.F2VideoStudioLoaded = true;

  const launcher = document.createElement("button");
  launcher.id = "f2VideoEditorLauncher";
  launcher.type = "button";
  launcher.textContent = "✦ AI VIDEO STUDIO";

  const panel = document.createElement("section");
  panel.id = "f2VideoEditorPanel";
  panel.innerHTML = `
    <div class="f2ve-header">
      <div><div class="f2ve-title">F2 AI VIDEO STUDIO</div>
      <div class="f2ve-subtitle">Video yarat · redaktə et · keyfiyyəti artır</div></div>
      <button id="f2veClose" type="button" aria-label="Bağla">✕</button>
    </div>
    <div class="f2ve-tabs">
      <button type="button" class="active" data-tab="generate">Video yarat</button>
      <button type="button" data-tab="edit">AI redaktə</button>
      <button type="button" data-tab="upscale">4K artır</button>
    </div>
    <div class="f2ve-content">
      <section class="f2ve-view active" data-view="generate">
        <label class="f2ve-label" for="f2vePrompt">Video təsviri</label>
        <textarea id="f2vePrompt" placeholder="Məsələn: Gecə futuristik Bakı, neon işıqlar, cinematic kamera hərəkəti..."></textarea>
        <label class="f2ve-label" for="f2veDuration">Müddət</label>
        <select id="f2veDuration"><option value="5">5 saniyə</option><option value="10">10 saniyə</option><option value="15">15 saniyə</option></select>
        <button id="f2veGenerate" class="f2ve-primary" type="button">✦ VIDEO YARAT</button>
      </section>
      <section class="f2ve-view" data-view="edit">
        <label class="f2ve-label" for="f2veEditFile">Redaktə olunacaq video</label>
        <input id="f2veEditFile" type="file" accept="video/*">
        <video id="f2veEditPreview" class="f2ve-preview" controls playsinline hidden></video>
        <label class="f2ve-label" for="f2veEditPrompt">Nəyi dəyişmək istəyirsən?</label>
        <textarea id="f2veEditPrompt" placeholder="Məsələn: Videonu cinematic et, gün batımı işığı əlavə et, rəngləri dəyiş..."></textarea>
        <button id="f2veEdit" class="f2ve-primary" type="button">✦ AI İLƏ REDAKTƏ ET</button>
      </section>
      <section class="f2ve-view" data-view="upscale">
        <label class="f2ve-label" for="f2veUpscaleFile">Keyfiyyəti artırılacaq video</label>
        <input id="f2veUpscaleFile" type="file" accept="video/*">
        <label class="f2ve-label" for="f2veQuality">Nəticə keyfiyyəti</label>
        <select id="f2veQuality"><option value="720p">720p</option><option value="1080p">1080p / 1K</option><option value="2k">2K</option><option value="4k" selected>4K</option></select>
        <button id="f2veUpscale" class="f2ve-primary" type="button">⬆ KEYFİYYƏTİ ARTIR</button>
      </section>
      <div id="f2veStatus" role="status">Hazırdır. İstifadə etmək üçün bir alət seç.</div>
      <div id="f2veResultBox" hidden>
        <div class="f2ve-label">Nəticə videosu</div>
        <video id="f2veResult" controls playsinline></video>
        <a id="f2veDownload" download="f2-jarvis-video.mp4" target="_blank" rel="noopener">Videonu aç / yüklə</a>
      </div>
      <p class="f2ve-note">Diqqət: AI video yaratmaq pulsuz deyil. CometAPI Wan 3.0 Prime hazırkı siyahı qiyməti təxminən $0.0544/saniyədir (5 saniyə ≈ $0.27, 10 saniyə ≈ $0.54). Qiymət və kredit balansı dəyişə bilər. Sorğu göndərməzdən əvvəl CometAPI hesabındakı qiyməti yoxla.</p>
    </div>`;

  document.body.append(launcher, panel);
  const $ = id => document.getElementById(id);
  let selectedEditFile = null;
  let selectedUpscaleFile = null;
  let pollController = null;

  function status(message, error = false) {
    const el = $("f2veStatus");
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("error", error);
  }

  function switchTab(name) {
    panel.querySelectorAll("[data-tab]").forEach(button => {
      button.classList.toggle("active", button.dataset.tab === name);
    });
    panel.querySelectorAll("[data-view]").forEach(view => {
      view.classList.toggle("active", view.dataset.view === name);
    });
  }

  function setBusy(button, busy, label) {
    button.disabled = busy;
    if (busy) {
      button.dataset.oldLabel = button.textContent;
      button.textContent = label;
    } else {
      button.textContent = button.dataset.oldLabel || label;
    }
  }

  function showResult(url) {
    if (!url || typeof url !== "string") return false;
    $("f2veResult").src = url;
    $("f2veDownload").href = url;
    $("f2veResultBox").hidden = false;
    return true;
  }

  function findVideoUrl(data) {
    const candidates = [
      data?.videoUrl, data?.video_url, data?.url,
      data?.output, data?.outputs?.[0], data?.result,
      data?.data?.videoUrl, data?.data?.video_url,
      data?.data?.url, data?.data?.output,
      data?.data?.outputs?.[0], data?.data?.result
    ];
    for (const value of candidates) {
      if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
      if (value && typeof value === "object" && typeof value.url === "string") return value.url;
    }
    return null;
  }

  async function readJson(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || `Server xətası: ${response.status}`);
    return data;
  }

  async function pollTask(id) {
    if (pollController) pollController.abort();
    pollController = new AbortController();
    status("Video hazırlanır. Bu proses bir neçə dəqiqə çəkə bilər...");
    for (let attempt = 0; attempt < 120; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      if (pollController.signal.aborted) throw new Error("Tapşırıq dayandırıldı.");
      const response = await fetch(`/api/videos/${encodeURIComponent(id)}`, {
        signal: pollController.signal
      });
      const data = await readJson(response);
      const url = findVideoUrl(data);
      if (url || data.status === "completed" || data.status === "succeeded") {
        if (url) {
          showResult(url);
          status("Video hazırdır! Nəticəni izləyə və yükləyə bilərsən.");
          return;
        }
        throw new Error("Video tamamlandı, amma API video linki qaytarmadı.");
      }
      if (data.status === "failed" || data.status === "error") {
        throw new Error(data.error?.message || data.error || "Video yaradılması uğursuz oldu.");
      }
      status(`Video hazırlanır... (${Math.min(attempt + 1, 120)}/120)`);
    }
    throw new Error("Video hazırlanması üçün gözləmə vaxtı bitdi. Sonra yenidən yoxla.");
  }

  async function handleTaskResponse(data) {
    const url = findVideoUrl(data);
    if (url) {
      showResult(url);
      status("Video hazırdır!");
      return;
    }
    const id = data.id || data.task_id || data.jobId;
    if (id) {
      await pollTask(id);
      return;
    }
    throw new Error(data.message || "API tapşırıq ID-si və ya video linki qaytarmadı.");
  }

  async function generateVideo() {
    const prompt = $("f2vePrompt").value.trim();
    if (prompt.length < 3) return status("Video təsviri yaz.", true);
    const button = $("f2veGenerate");
    setBusy(button, true, "VIDEO HAZIRLANIR...");
    status("AI video sorğusu göndərilir...");
    try {
      const response = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, seconds: Number($("f2veDuration").value) })
      });
      await handleTaskResponse(await readJson(response));
    } catch (error) {
      status(error.message || "Video yaradılmadı.", true);
    } finally {
      setBusy(button, false, "✦ VIDEO YARAT");
    }
  }

  async function submitVideoFile(endpoint, file, fields, button, label) {
    if (!file) return status("Əvvəlcə video faylı seç.", true);
    if (!file.type.startsWith("video/")) return status("Yalnız video faylı seçilə bilər.", true);
    const form = new FormData();
    form.append("video", file, file.name);
    Object.entries(fields).forEach(([key, value]) => form.append(key, String(value)));
    setBusy(button, true, label);
    status("Video serverə təhlükəsiz göndərilir...");
    try {
      const response = await fetch(endpoint, { method: "POST", body: form });
      await handleTaskResponse(await readJson(response));
    } catch (error) {
      status(error.message || "Video əməliyyatı uğursuz oldu.", true);
    } finally {
      setBusy(button, false, button.dataset.oldLabel || label);
    }
  }

  launcher.addEventListener("click", () => panel.classList.add("active"));
  $("f2veClose").addEventListener("click", () => panel.classList.remove("active"));
  panel.querySelectorAll("[data-tab]").forEach(button =>
    button.addEventListener("click", () => switchTab(button.dataset.tab))
  );
  $("f2veGenerate").addEventListener("click", generateVideo);

  $("f2veEditFile").addEventListener("change", event => {
    selectedEditFile = event.target.files?.[0] || null;
    const preview = $("f2veEditPreview");
    if (preview && selectedEditFile) {
      preview.src = URL.createObjectURL(selectedEditFile);
      preview.hidden = false;
    }
    status(selectedEditFile ? `Seçildi: ${selectedEditFile.name}` : "Video seçilməyib.");
  });

  $("f2veUpscaleFile").addEventListener("change", event => {
    selectedUpscaleFile = event.target.files?.[0] || null;
    status(selectedUpscaleFile ? `Seçildi: ${selectedUpscaleFile.name}` : "Video seçilməyib.");
  });

  $("f2veEdit").addEventListener("click", () => {
    const prompt = $("f2veEditPrompt").value.trim();
    if (prompt.length < 3) return status("Video üçün redaktə təlimatı yaz.", true);
    submitVideoFile("/api/videos/edit", selectedEditFile, { prompt, model: "gen4_aleph" }, $("f2veEdit"), "AI REDAKTƏ EDİR...");
  });

  $("f2veUpscale").addEventListener("click", () => {
    submitVideoFile("/api/videos/upscale", selectedUpscaleFile, { quality: $("f2veQuality").value }, $("f2veUpscale"), "KEYFİYYƏT ARTIRILIR...");
  });

  window.F2VideoStudio = {
    open: () => panel.classList.add("active"),
    close: () => panel.classList.remove("active"),
    selectTab: switchTab
  };
})();