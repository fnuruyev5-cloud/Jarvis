F2 JARVIS — MICROPHONE + MOBILE BUTTON FIX

This is an add-on patch, not a full project replacement. It fixes oversized / displaced microphone buttons on mobile while retaining the existing composer layout.

INSTALL
1. Extract this ZIP.
2. Upload mic-fix.css and mic-fix.js to the repository ROOT (same folder as index.html and app.js). Replace the older files with these versions if asked.
3. In index.html, inside <head>, add (or keep) this line once:
   <link rel="stylesheet" href="mic-fix.css">
4. Just before </body>, AFTER your existing app.js script, add (or keep) this line once:
   <script src="mic-fix.js"></script>
5. The microphone button should use one selector: id="micBtn", id="mic", id="mic-button", id="microphoneBtn", or data-mic-button.
6. Commit changes, then Render → Manual Deploy → Deploy latest commit.

MOBILE CHECK
- Open the HTTPS Render site in Android Chrome.
- Chrome site settings → Microphone → Allow.
- Reload the site. The mic button should be a compact circle (50px on most phones) and remain in its existing message/composer row rather than stretching across the screen.

IMPORTANT
- This patch cannot style a microphone button whose actual selector is completely different. If it still moves or stretches, the real button's HTML id/class is needed.
- SpeechRecognition support varies by browser. Use current Android Chrome and keep the page in the foreground.
- This does not enable background listening with the phone locked.
