/* F2 JARVIS Tools Add-on. Load after the main app scripts. */
(() => {
  if (window.__F2_TOOLS_ADDON__) return;
  window.__F2_TOOLS_ADDON__ = true;

  const $ = (s) => document.querySelector(s);
  const launcher = document.createElement('button');
  launcher.id = 'f2ToolsLauncher';
  launcher.type = 'button';
  launcher.textContent = '✦ JARVIS TOOLS';
  document.body.appendChild(launcher);

  const panel = document.createElement('section');
  panel.id = 'f2ToolsPanel';
  panel.innerHTML = `
    <h3>✦ JARVIS TOOLS</h3>
    <div class="f2-tools-row">
      <button type="button" id="f2CameraStart">Kameranı aç</button>
      <button type="button" id="f2CameraCapture">Şəkil çək</button>
      <button type="button" id="f2CameraStop">Bağla</button>
    </div>
    <video id="f2CameraVideo" autoplay playsinline></video>
    <canvas id="f2CameraCanvas"></canvas>
    <div class="f2-tools-row"><button type="button" id="f2CameraDownload">Şəkli yüklə</button></div>
    <hr style="border-color:#35cbe833;margin:14px 0">
    <h3>AI şəkil generatoru</h3>
    <textarea id="f2ImagePrompt" placeholder="Yaratmaq istədiyin şəkli təsvir et..."></textarea>
    <div class="f2-tools-row"><button type="button" id="f2GenerateImage">Şəkil yarat</button></div>
    <p class="f2-tools-note" id="f2ImageStatus">Nano Banana API serverdə COMETAPI_KEY tələb edir.</p>
    <img id="f2ImageResult" alt="AI tərəfindən yaradılmış şəkil">
    <hr style="border-color:#35cbe833;margin:14px 0">
    <h3>Əlavə alətlər</h3>
    <div class="f2-tools-row">
      <button type="button" id="f2OpenSpline">Spline 3D</button>
      <button type="button" id="f2CheckVision">Vision kitabxanaları</button>
    </div>
    <p class="f2-tools-note">MediaPipe və TensorFlow.js üçün model və tətbiq məntiqi ayrıca inteqrasiya edilməlidir.</p>
  `;
  document.body.appendChild(panel);
  launcher.addEventListener('click', () => panel.classList.toggle('open'));

  let cameraStream = null;
  let capturedBlob = null;
  const video = $('#f2CameraVideo');
  const canvas = $('#f2CameraCanvas');

  $('#f2CameraStart').addEventListener('click', async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Bu brauzerdə kamera API dəstəklənmir.');
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      video.srcObject = cameraStream;
      video.style.display = 'block';
      await video.play();
    } catch (e) {
      alert('Kamera açıla bilmədi: ' + e.message + '\\nHTTPS bağlantısı və kamera icazəsini yoxla.');
    }
  });

  $('#f2CameraCapture').addEventListener('click', () => {
    if (!video.videoWidth) return alert('Əvvəl kameranı aç.');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      capturedBlob = blob;
      alert('Şəkil çəkildi. İndi “Şəkli yüklə” düyməsinə bas.');
    }, 'image/jpeg', 0.92);
  });

  $('#f2CameraDownload').addEventListener('click', () => {
    if (!capturedBlob) return alert('Əvvəl şəkil çək.');
    const url = URL.createObjectURL(capturedBlob);
    const a = document.createElement('a');
    a.href = url; a.download = 'f2-jarvis-camera.jpg'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  });

  $('#f2CameraStop').addEventListener('click', () => {
    cameraStream?.getTracks().forEach(t => t.stop());
    cameraStream = null; video.srcObject = null; video.style.display = 'none';
  });

  $('#f2GenerateImage').addEventListener('click', async () => {
    const prompt = $('#f2ImagePrompt').value.trim();
    const status = $('#f2ImageStatus');
    const result = $('#f2ImageResult');
    if (!prompt) return alert('Əvvəl şəkil təsvirini yaz.');
    status.textContent = 'Şəkil yaradılır...';
    result.style.display = 'none';
    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.message || 'Şəkil yaratmaq mümkün olmadı.');
      const imageUrl = data.image || data.imageUrl || data.dataUrl;
      if (!imageUrl) throw new Error('Server cavabında şəkil tapılmadı.');
      result.src = imageUrl;
      result.style.display = 'block';
      status.textContent = 'Şəkil hazırdır.';
    } catch (e) {
      status.textContent = 'Xəta: ' + e.message;
    }
  });

  $('#f2OpenSpline').addEventListener('click', () => window.open('https://app.spline.design/', '_blank', 'noopener'));
  $('#f2CheckVision').addEventListener('click', () => {
    const mp = !!(window.Pose || window.FaceMesh || window.Hands || window.FilesetResolver);
    const tf = !!window.tf;
    alert(`MediaPipe: ${mp ? 'tapıldı' : 'yüklənməyib'}\\nTensorFlow.js: ${tf ? 'tapıldı' : 'yüklənməyib'}\\n\\nBu yoxlama kitabxanaların mövcudluğunu göstərir; modelləri ayrıca qoşmaq lazımdır.`);
  });

  function addCopyButtons(root = document) {
    root.querySelectorAll('pre').forEach(pre => {
      if (pre.dataset.f2CopyReady) return;
      pre.dataset.f2CopyReady = '1';
      const btn = document.createElement('button');
      btn.className = 'f2-copy-code';
      btn.type = 'button';
      btn.textContent = 'Kodu kopyala';
      btn.addEventListener('click', async () => {
        const code = pre.querySelector('code')?.innerText || pre.innerText;
        try {
          await navigator.clipboard.writeText(code);
          btn.textContent = 'Kopyalandı ✓';
          setTimeout(() => btn.textContent = 'Kodu kopyala', 1400);
        } catch {
          btn.textContent = 'Kopyalama alınmadı';
          setTimeout(() => btn.textContent = 'Kodu kopyala', 1600);
        }
      });
      pre.insertBefore(btn, pre.firstChild);
    });
  }
  addCopyButtons();
  new MutationObserver(mutations => mutations.forEach(m => m.addedNodes.forEach(n => {
    if (n.nodeType === 1) { if (n.matches?.('pre')) addCopyButtons(n.parentNode); else addCopyButtons(n); }
  }))).observe(document.body, { childList: true, subtree: true });
})();
