# Quraşdırma — F2 JARVIS Add-on

1. Layihənin ehtiyat nüsxəsini saxlayın.
2. `jarvis-addon.js` və `jarvis-addon.css` fayllarını `index.html`-in xidmət olunan statik qovluğuna köçürün.
3. `index.html` daxilində `</head>`-dən əvvəl:
   ```html
   <link rel="stylesheet" href="/jarvis-addon.css">
   ```
4. `</body>`-dən əvvəl:
   ```html
   <script src="/jarvis-addon.js" defer></script>
   ```
5. GitHub `main` branch-ə commit/push edin. Render avtomatik deploy etməlidir.
6. Saytı HTTPS ilə açın, bir dəfə **Başlat / Dinlə** düyməsinə toxunun və mikrofon icazəsi verin.
7. “Hey Jarvis” deyərək oyadın; söhbəti bitirmək üçün “Stop Jarvis” deyin və ya Dayandır düyməsinə basın.

## Vacib
Bu modulun işləməsi üçün mövcud `/api/chat` və `/api/speak` API-ləri ilə cavab formatları uyğun olmalıdır. Kamera analizi üçün ayrıca `/api/vision` server marşrutu tələb olunur. Bu ZIP həmin server marşrutunu öz-özünə yaratmır.
