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
        <input
          id="chatInput"
          type="text"
          placeholder="Type a message..."
          aria-label="Chat message"
        />
        <button type="submit" class="btn-primary">Send</button>
        <button type="image" class="btn-image">+</button>
      </form>
    </section>
  `;

  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");
  const chatWindow = document.getElementById("chatWindow");

  function addMessage(text, role) {
    const bubble = document.createElement("p");
    bubble.className = `chat-bubble ${role}`;
    bubble.textContent = text;
    chatWindow.appendChild(bubble);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  addMessage("Hi, I'm SmartSpin. Ask me about laundry care.", "ai");

  chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = chatInput.value.trim();
    if (!message) return;

    addMessage(message, "user");
    chatInput.value = "";

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({ message })
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Chat failed");
      }

      addMessage(data.reply, "ai");
    } catch (error) {
      console.error("Chat error:", error);
      addMessage("Sorry, I couldn't process that message.", "ai");
    }
  });
}

async function init() {
  try {
    const response = await fetch(`${API_BASE}/api/me`, {
      credentials: "include"
    });
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