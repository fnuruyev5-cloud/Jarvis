# F2 JARVIS — Əlavə modul

Bu ZIP mövcud layihəni əvəz etmir. İçindəki iki fayl əsas layihəyə əlavə olunur.

## Fayllar
- `jarvis-addon.js` — “Hey Jarvis”, səsli söhbət dövrü, danışıq və kamera görüntüsünü backend-ə göndərmə.
- `jarvis-addon.css` — əlavə idarəetmə panelinin görünüşü.
- `INSTALL-AZ.md` — quraşdırma təlimatı.

## Quraşdırma
1. ZIP-i açın.
2. `jarvis-addon.js` və `jarvis-addon.css` fayllarını layihənin `public` qovluğuna qoyun. Əgər `index.html` kök qovluqdadırsa, faylları onun yanına da qoya bilərsiniz.
3. `index.html` faylında `</head>` sətrindən əvvəl əlavə edin:
   `<link rel="stylesheet" href="/jarvis-addon.css">`
4. `</body>` sətrindən əvvəl əlavə edin:
   `<script src="/jarvis-addon.js" defer></script>`
5. GitHub-a yükləyin və Render deploy-un bitməsini gözləyin.

Əgər faylları `public` qovluğuna qoymusunuzsa, yuxarıdakı URL-lər uyğundur. Kök qovluğa qoymusunuzsa və server statik faylları kökdən təqdim edirsə, yenə eyni yollar işləyə bilər; 404 olarsa yolu server quruluşuna uyğun dəyişin.

## Vacib uyğunluq qeydləri
- Mövcud `/api/chat` endpoint-i POST JSON qəbul etməli və cavabda `reply`, `response`, `answer`, `message` və ya `text` sahələrindən birini qaytarmalıdır.
- Mövcud `/api/speak` endpoint-i POST `{ "text": "..." }` qəbul edib audio faylı (MP3 və s.) qaytarmalıdır. Əgər endpoint JSON qaytarırsa, mövcud server API-sinə uyğunlaşdırmaq lazımdır.
- Kamera görüntüsünün həqiqi AI analizi üçün ayrıca `POST /api/vision` endpoint-i lazımdır. Bu əlavə modul kameranı açır və şəkli göndərir, lakin mövcud backend-də vision endpoint yoxdursa, analiz işləməyəcək. Mətn modeli şəkli avtomatik görə bilmir.
- “Hey Jarvis” brauzerin Web Speech API funksiyasından istifadə edir. Səhifə açıq qalmalı, HTTPS olmalı və mikrofon icazəsi verilməlidir. Android brauzerlərində davamlı tanıma bəzən sistem tərəfindən dayandırıla bilər.
- Brauzerlər təhlükəsizlik səbəbindən səhifə açılanda avtomatik mikrofon və səs başladılmasına icazə verməyə bilər. İlk dəfə **Başlat / Dinlə** düyməsinə toxunmaq lazımdır.
- “Stop Jarvis” demək və ya Dayandır düyməsinə toxunmaq dinləməni dayandırır.
- Heç bir API açarını bu fayllara yazmayın. Açarlar yalnız Render Environment-də qalmalıdır.

## Parametrlər
`jarvis-addon.js` yüklənməzdən əvvəl `window.F2JARVIS_ADDON` təyin etməklə dili və endpoint-ləri dəyişə bilərsiniz. Məsələn:
```html
<script>
window.F2JARVIS_ADDON = {
  language: "az-AZ",
  wakePhrase: "hey jarvis",
  chatEndpoint: "/api/chat",
  speakEndpoint: "/api/speak",
  visionEndpoint: "/api/vision"
};
</script>
<script src="/jarvis-addon.js" defer></script>
```
