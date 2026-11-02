F2 JARVIS — MICROPHONE FIX PATCH

IMPORTANT
This is a small add-on patch, not a full replacement for your project. It is designed to repair microphone button binding and continuous browser speech recognition without replacing your existing design or server.

INSTALL
1. Extract this ZIP.
2. Upload mic-fix.js and mic-fix.css to the ROOT folder of your GitHub repository (the same folder as index.html and app.js).
3. Open index.html in GitHub and add these lines just before </head>:

<link rel="stylesheet" href="mic-fix.css">

4. Add this line just before </body>, AFTER your existing app.js script:

<script src="mic-fix.js"></script>

5. The microphone button should have one of these selectors: id="micBtn", id="mic", id="mic-button", id="microphoneBtn", or data-mic-button.
   Example: <button id="micBtn" type="button" aria-label="Mikrofon">🎙</button>
6. The message input should ideally have id="messageInput" (or data-chat-input). The send button should ideally have id="sendBtn" (or data-send-button).
7. Commit changes, then Render → Manual Deploy → Deploy latest commit.

HOW IT WORKS
- Tap the microphone once to request permission and start continuous listening.
- Say “Hey Jarvis” to wake it. Then speak your request.
- Tap the microphone again to stop listening.
- It dispatches a `f2jarvis:transcript` event and also fills the detected message into the chat input and clicks the send button if found.
- When your existing AI code finishes its reply, it can dispatch:
  document.dispatchEvent(new Event('f2jarvis:response-finished'));

BROWSER REQUIREMENTS
- Open the deployed site over HTTPS (Render URL is HTTPS).
- Use Android Chrome and allow Microphone permission for the site.
- Browser SpeechRecognition availability depends on browser/device and network. If unsupported, the patch shows an error instead of silently doing nothing.
- This is foreground browser listening, not background listening while the phone is locked.

IF THE BUTTON STILL DOES NOTHING
Check that the actual button has id="micBtn" or data-mic-button and that mic-fix.js is loaded after app.js. Open Chrome site settings → Microphone → Allow, then reload the page.
