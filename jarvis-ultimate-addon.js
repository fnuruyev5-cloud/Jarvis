(()=>{'use strict';if(window.__F2_JARVIS_ADDON__)return;window.__F2_JARVIS_ADDON__=true;
const $=id=>document.getElementById(id),root=document.createElement('div');
root.innerHTML=`<button id="ja-launcher">✦ JARVIS TOOLS</button><section id="ja-panel" hidden>
<div class="ja-head"><strong>JARVIS AI · COMMAND CENTER</strong><button id="ja-close">✕</button></div>
<nav class="ja-tabs"><button data-tab="system" aria-selected="true">Sistem</button><button data-tab="camera" aria-selected="false">Kamera</button><button data-tab="tools" aria-selected="false">Alətlər</button><button data-tab="notes" aria-selected="false">Qeydlər</button></nav>
<div class="ja-view active" data-view="system"><div class="ja-grid">
<div class="ja-card"><b>Tarix / vaxt</b><span id="ja-clock">—</span></div><div class="ja-card"><b>İnternet</b><span id="ja-online">—</span></div>
<div class="ja-card"><b>Batareya</b><span id="ja-battery">—</span></div><div class="ja-card"><b>Mikrofon</b><span class="ja-muted">Mövcud JARVIS səs sistemindən istifadə edir.</span></div></div>
<p class="ja-muted">Mobil brauzer arxa planda mikrofonu məhdudlaşdıra bilər.</p>
<input id="ja-command" class="ja-field" placeholder="Əmr yaz: saat neçədir? / kameranı aç / salam">
<div class="ja-actions"><button id="ja-run">Əmri icra et</button><button id="ja-fullscreen">Tam ekran</button></div><div id="ja-result">Sistem hazırdır.</div></div>
<div class="ja-view" data-view="camera"><p class="ja-muted">Kamera üçün HTTPS və icazə tələb olunur.</p>
<div class="ja-actions"><button id="ja-open-camera">Kameranı aç</button><button id="ja-switch">Ön / arxa</button><button id="ja-stop-camera">Dayandır</button></div>
<video id="ja-video" autoplay playsinline muted></video><div class="ja-actions"><button id="ja-capture">Şəkli analiz et</button><label class="ja-file">Şəkil seç<input id="ja-image" type="file" accept="image/*" hidden></label></div>
<div class="ja-actions"><button id="ja-ocr">OCR oxu</button><button id="ja-qr">QR skan et</button></div><div id="ja-camera-result"></div></div>
<div class="ja-view" data-view="tools"><div class="ja-grid">
<div class="ja-card"><b>Tərcümə</b><button data-send="Bu mətni Azərbaycan dilinə tərcümə et: ">Çata göndər</button></div>
<div class="ja-card"><b>Riyaziyyat</b><button data-send="Bu məsələni addım-addım həll et: ">Çata göndər</button></div>
<div class="ja-card"><b>Kod köməkçisi</b><button data-send="Bu kodu təhlil et və düzəlt: ">Çata göndər</button></div>
<div class="ja-card"><b>Sənəd oxu</b><input id="ja-doc" type="file" accept=".txt,.md,.csv,.json,.log"></div></div><p class="ja-muted">Sənəd mətni mövcud JARVIS çatına ötürülür.</p></div>
<div class="ja-view" data-view="notes"><p class="ja-muted">Qeydlər bu brauzerdə lokal saxlanır.</p><textarea id="ja-notes" class="ja-field" rows="5" placeholder="Şəxsi qeydlər..."></textarea>
<div class="ja-actions"><button id="ja-save-notes">Saxla</button><button id="ja-clear-notes">Sil</button></div>
<input id="ja-timer" class="ja-field" placeholder="Taymer: saniyə, məsələn 60"><button id="ja-start-timer">Taymeri başlat</button></div></section>`;
document.body.appendChild(root);const panel=$('ja-panel'),out=$('ja-result'),camout=$('ja-camera-result');let stream=null,facing='environment';
const status=t=>out.textContent=t,tab=t=>{document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===t)));document.querySelectorAll('[data-view]').forEach(v=>v.classList.toggle('active',v.dataset.view===t));};
$('ja-launcher').onclick=()=>panel.hidden=!panel.hidden;$('ja-close').onclick=()=>panel.hidden=true;document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
function tick(){$('ja-clock').textContent=new Date().toLocaleString();$('ja-online').textContent=navigator.onLine?'Onlayn':'Oflayn';}tick();setInterval(tick,15000);addEventListener('online',tick);addEventListener('offline',tick);
if(navigator.getBattery)navigator.getBattery().then(b=>$('ja-battery').textContent=Math.round(b.level*100)+'%'+(b.charging?' · enerji yığılır':'')).catch(()=>$('ja-battery').textContent='Əlçatan deyil');else $('ja-battery').textContent='Dəstəklənmir';
function sendChat(text){const input=$('messageInput')||document.querySelector('#chatForm input,form input[type="text"],textarea');const form=$('chatForm')||input?.form;if(!input||!form){status('Çatın mesaj sahəsi tapılmadı. Mətn: '+text);return;}input.value=text;input.dispatchEvent(new Event('input',{bubbles:true}));form.requestSubmit();panel.hidden=true;}
$('ja-run').onclick=()=>{const raw=$('ja-command').value.trim();if(!raw)return;if(/saat|vaxt/i.test(raw))status('Hazırkı vaxt: '+new Date().toLocaleString());else if(/kamera/i.test(raw)){tab('camera');openCamera();}else sendChat(raw);};
$('ja-fullscreen').onclick=async()=>{try{await document.documentElement.requestFullscreen();}catch(e){status('Tam ekran mümkün olmadı: '+e.message);}};
async function openCamera(){if(!navigator.mediaDevices?.getUserMedia){camout.textContent='Kamera üçün HTTPS və uyğun brauzer tələb olunur.';return;}stopCamera();try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing}},audio:false});$('ja-video').srcObject=stream;await $('ja-video').play();camout.textContent='Kamera aktivdir.';}catch(e){camout.textContent='Kamera açıla bilmədi: '+e.message;}}
function stopCamera(){stream?.getTracks().forEach(t=>t.stop());stream=null;$('ja-video').srcObject=null;}
$('ja-open-camera').onclick=openCamera;$('ja-stop-camera').onclick=()=>{stopCamera();camout.textContent='Kamera dayandırıldı.';};$('ja-switch').onclick=()=>{facing=facing==='environment'?'user':'environment';if(stream)openCamera();};
async function analyze(data){camout.textContent='AI şəkli analiz edir…';try{const r=await fetch('/api/vision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:data,prompt:'Şəkli Azərbaycan dilində təsvir et və görünən yazıları oxu.'})});const d=await r.json();if(!r.ok)throw Error(d.error||'HTTP '+r.status);const a=d.answer||d.description||d.text;if(!a)throw Error('Vision cavabı boşdur');camout.textContent=a;sendChat('Şəkil analizi: '+a);}catch(e){camout.textContent='Analiz alınmadı: '+e.message+'. Server route quraşdırılmalıdır.';}}
$('ja-capture').onclick=()=>{const v=$('ja-video');if(!v.videoWidth){camout.textContent='Əvvəl kameranı aç.';return;}const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);analyze(c.toDataURL('image/jpeg',.8));};
$('ja-image').onchange=e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>8*1024*1024){camout.textContent='Şəkil 8 MB-dan kiçik olmalıdır.';return;}const rd=new FileReader();rd.onload=()=>analyze(rd.result);rd.readAsDataURL(f);};
$('ja-ocr').onclick=async()=>{if(!window.Tesseract){camout.textContent='OCR kitabxanası qoşulmayıb. Təlimata bax.';return;}const v=$('ja-video');if(!v.videoWidth){camout.textContent='Əvvəl kameranı aç.';return;}const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);camout.textContent='OCR oxuyur…';try{const r=await Tesseract.recognize(c,'aze+eng+tur');camout.textContent=r.data.text||'Mətn tapılmadı.';}catch(e){camout.textContent=e.message;}};
$('ja-qr').onclick=async()=>{const v=$('ja-video');if(!v.videoWidth){camout.textContent='Əvvəl kameranı aç.';return;}if(!('BarcodeDetector'in window)){camout.textContent='Brauzer QR oxumağı dəstəkləmir.';return;}try{const q=await new BarcodeDetector({formats:['qr_code']}).detect(v);camout.textContent=q.length?q.map(x=>x.rawValue).join('\\n'):'QR tapılmadı.';}catch(e){camout.textContent=e.message;}};
$('ja-doc').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>1000000){status('Sənəd 1 MB-dan kiçik olmalıdır.');return;}sendChat('Bu sənədi xülasə et ('+f.name+'):\\n'+(await f.text()).slice(0,25000));};
document.querySelectorAll('[data-send]').forEach(b=>b.onclick=()=>sendChat(b.dataset.send));
const k='f2jarvis.addon.notes';$('ja-notes').value=localStorage.getItem(k)||'';$('ja-save-notes').onclick=()=>{localStorage.setItem(k,$('ja-notes').value);status('Qeydlər saxlandı.');};
$('ja-clear-notes').onclick=()=>{if(confirm('Qeydləri silmək istəyirsən?')){$('ja-notes').value='';localStorage.removeItem(k);}};
$('ja-start-timer').onclick=()=>{const n=Number($('ja-timer').value);if(!Number.isInteger(n)||n<1||n>86400){status('1–86400 arası saniyə daxil et.');return;}setTimeout(()=>alert('JARVIS: Taymer bitdi.'),n*1000);status(n+' saniyəlik taymer başladı. Səhifə açıq qalmalıdır.');};
addEventListener('pagehide',stopCamera);window.JARVISAddon={openCamera,stopCamera,sendChat};
})();
