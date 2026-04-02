const chatRoot = document.getElementById("chatRoot");
const API_BASE =
  window.location.port === "5500"
    ? "http://127.0.0.1:3000"
    : window.location.origin;

function renderChat() {
  chatRoot.innerHTML = `
    <h1>Chat</h1>
    <section class="chat-shell">
      <div class="chat-window" id="chatWindow"></div>
      <form class="chat-input-row" id="chatForm">
        <div class="chat-input-wrapper" id="chatInputWrapper">
          <img id="imagePreview" src="" alt="preview" style="display:none; height:36px; border-radius:6px; margin-right:6px; vertical-align:middle;" />
          <input
            id="chatInput"
            type="text"
            placeholder="Type a message..."
            aria-label="Chat message"
            style="border:none; outline:none; flex:1; font:inherit; background:transparent;"
          />
        </div>
        <input type="file" id="fileInput" accept="image/*" style="display:none" />
        <label for="fileInput" class="btn-image">+</label>
        <button type="submit" class="btn-primary">Send</button>
      </form>
    </section>
  `;

  // Add wrapper styles dynamically so it matches your existing input look
  const style = document.createElement("style");
  style.textContent = `
    .chat-input-wrapper {
      display: flex;
      align-items: center;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 0.78rem 0.85rem;
      background: #fff;
      flex: 1;
    }
    .chat-input-wrapper:focus-within {
      outline: 2px solid #b9dbfb;
      border-color: #9fcdf7;
    }
  `;
  document.head.appendChild(style);

  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");
  const chatWindow = document.getElementById("chatWindow");
  const fileInput = document.getElementById("fileInput");
  const imagePreview = document.getElementById("imagePreview");

  let selectedFile = null;
  let selectedBase64 = null;

  function addMessage(content, role, isImage = false) {
    const bubble = document.createElement("p");
    bubble.className = `chat-bubble ${role}`;
    if (isImage) {
      const img = document.createElement("img");
      img.src = content;
      img.alt = "uploaded image";
      img.style.cssText = "max-width:200px; max-height:200px; border-radius:8px; display:block;";
      bubble.appendChild(img);
    } else {
      bubble.textContent = content;
    }
    chatWindow.appendChild(bubble);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  addMessage("Hi, I'm SmartSpin. Ask me about laundry care.", "ai");

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;

  selectedFile = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      // Resize to max 800px on longest side
      const MAX = 800;
      let { width, height } = img;
      if (width > height && width > MAX) {
        height = Math.round((height * MAX) / width);
        width = MAX;
      } else if (height > width && height > MAX) {
        width = Math.round((width * MAX) / height);
        height = MAX;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);

      // Compress to JPEG at 70% quality
      selectedBase64 = canvas.toDataURL("image/jpeg", 0.7);
      imagePreview.src = selectedBase64;
      imagePreview.style.display = "inline-block";
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
});

  chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = chatInput.value.trim();
    if (!message && !selectedBase64) return;

    // Show user messages in chat
    if (selectedBase64) addMessage(selectedBase64, "user", true);
    if (message) addMessage(message, "user");

    // Grab values then clear the form
    const textToSend = message;
    const imageToSend = selectedBase64;
    chatInput.value = "";
    selectedFile = null;
    selectedBase64 = null;
    imagePreview.src = "";
    imagePreview.style.display = "none";
    fileInput.value = "";

    try {
      const body = { message: textToSend };
      if (imageToSend) {
        // Strip the data URL prefix so your API receives raw base64
        body.image = imageToSend.split(",")[1];
        body.imageType = selectedFile?.type || "image/jpeg";
      }

      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body)
      });

      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Chat failed");

      addMessage(data.reply, "ai");
    } catch (error) {
      console.error("Chat error:", error);
      addMessage("Sorry, I couldn't process that message.", "ai");
    }
  });
}

async function init() {
  try {
    const response = await fetch(`${API_BASE}/api/me`, { credentials: "include" });
    const payload = await response.json();
    if (payload.loggedIn) {
      renderChat();
      return;
    }
  } catch (error) {
    console.error("Failed to check login:", error);
  }
  chatRoot.innerHTML = `<h1>Sorry, you need to log in</h1>`;
}

init();