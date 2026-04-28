// ---------- Config ----------
const API_BASE =
  window.location.port === "5500"
    ? "http://127.0.0.1:3000"
    : window.location.origin;

const LOAD_TYPES = [
  { id: "whites",    name: "Whites",     cls: "load-whites",    color: "#6aa9d6" },
  { id: "darks",     name: "Darks",      cls: "load-darks",     color: "#4a5a7a" },
  { id: "colors",    name: "Colors",     cls: "load-colors",    color: "#d68fb4" },
  { id: "delicates", name: "Delicates",  cls: "load-delicates", color: "#b794d6" },
  { id: "towels",    name: "Towels",     cls: "load-towels",    color: "#e0a670" },
  { id: "bedding",   name: "Bedding",    cls: "load-bedding",   color: "#7ac2b0" },
  { id: "workout",   name: "Workout",    cls: "load-workout",   color: "#8ec36f" },
  { id: "custom",    name: "Other",      cls: "load-custom",    color: "#a8a8a8" },
];

// ---------- State ----------
let currentDate = new Date();
currentDate.setDate(1);
let selectedDateKey = null;
let isLoggedIn = false;
let calendarData = {}; // { "2026-04-16": [{id, typeId, label, notes}, ...] }

// ---------- Auth check ----------
async function checkLogin() {
  try {
    const res = await fetch(`${API_BASE}/api/me`, { credentials: "include" });
    const payload = await res.json();
    isLoggedIn = !!(payload.loggedIn && payload.account);
  } catch {
    isLoggedIn = false;
  }
}

// ---------- Server data ----------
async function fetchCalendarData() {
  if (!isLoggedIn) {
    calendarData = {};
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/api/calendar`, { credentials: "include" });
    if (res.status === 401) {
      isLoggedIn = false;
      calendarData = {};
      return;
    }
    const payload = await res.json();
    calendarData = payload.ok ? payload.data : {};
  } catch (err) {
    console.error("Failed to load calendar:", err);
    calendarData = {};
  }
}

async function addLoadToServer(date, typeId, label, notes) {
  const res = await fetch(`${API_BASE}/api/calendar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ date, typeId, label, notes }),
  });
  if (res.status === 401) {
    isLoggedIn = false;
    showLoginPrompt();
    return null;
  }
  const payload = await res.json();
  return payload.ok ? payload.id : null;
}

async function deleteLoadFromServer(loadId) {
  const res = await fetch(`${API_BASE}/api/calendar/${loadId}`, {
    method: "DELETE",
    credentials: "include",
  });
  return res.ok;
}

function dateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// ---------- Login prompt ----------
function showLoginPrompt() {
  // Reuse if already exists
  let prompt = document.getElementById("loginPrompt");
  if (prompt) {
    prompt.classList.add("open");
    return;
  }
  prompt = document.createElement("div");
  prompt.id = "loginPrompt";
  prompt.className = "cal-modal-backdrop open";
  prompt.innerHTML = `
    <div class="cal-modal" role="dialog" aria-modal="true" style="max-width:420px;text-align:center;">
      <h2>Please log in</h2>
      <p style="font-family:'Quicksand',sans-serif;color:#5a7aa8;">
        You need to be logged in to add loads to your calendar.
      </p>
      <div class="modal-actions" style="justify-content:center;">
        <a class="btn-add" href="accounts.html" style="text-decoration:none;display:inline-block;">Log in / Sign up</a>
        <button type="button" class="btn-close" id="closeLoginPrompt">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(prompt);
  prompt.addEventListener("click", (e) => {
    if (e.target.id === "loginPrompt" || e.target.id === "closeLoginPrompt") {
      prompt.classList.remove("open");
    }
  });
}

// ---------- Rendering ----------
function renderLegend() {
  const legend = document.getElementById("calLegend");
  legend.innerHTML = LOAD_TYPES.map(t =>
    `<span class="legend-item"><span class="legend-dot" style="background:${t.color}"></span>${t.name}</span>`
  ).join("");
}

function renderCalendar() {
  const grid = document.getElementById("calGrid");
  const title = document.getElementById("calTitle");
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthNames = ["January","February","March","April","May","June",
                      "July","August","September","October","November","December"];
  title.textContent = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const weekdays = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  let html = weekdays.map(w => `<div class="cal-weekday">${w}</div>`).join("");

  for (let i = 0; i < firstDay; i++) {
    html += `<div class="cal-day cal-empty"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const key = dateKey(year, month, d);
    const loads = calendarData[key] || [];
    const isToday = key === todayKey;
    const hasLoads = loads.length > 0;

    const classes = [
      "cal-day",
      isToday ? "cal-today" : "",
      hasLoads ? "cal-has-loads" : ""
    ].filter(Boolean).join(" ");

    const chipsHtml = loads.slice(0, 2).map(l => {
      const type = LOAD_TYPES.find(t => t.id === l.typeId) || LOAD_TYPES[LOAD_TYPES.length - 1];
      const label = l.label || type.name;
      return `<span class="cal-load-chip ${type.cls}" title="${escapeHtml(label)}">${escapeHtml(label)}</span>`;
    }).join("");

    const moreHtml = loads.length > 2
      ? `<span class="cal-load-more">+${loads.length - 2} more</span>`
      : "";

    html += `
      <div class="${classes}" data-date="${key}" role="button" tabindex="0">
        <div class="cal-day-num">${d}</div>
        ${chipsHtml}
        ${moreHtml}
      </div>
    `;
  }

  grid.innerHTML = html;

  grid.querySelectorAll(".cal-day:not(.cal-empty)").forEach(el => {
    el.addEventListener("click", () => handleDayClick(el.dataset.date));
    el.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleDayClick(el.dataset.date);
      }
    });
  });
}

function handleDayClick(key) {
  if (!isLoggedIn) {
    showLoginPrompt();
    return;
  }
  openModal(key);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

// ---------- Modal ----------
function openModal(key) {
  selectedDateKey = key;
  const backdrop = document.getElementById("modalBackdrop");
  const modalDate = document.getElementById("modalDate");
  const [y, m, d] = key.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  modalDate.textContent = dateObj.toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  const sel = document.getElementById("loadType");
  sel.innerHTML = LOAD_TYPES.map(t => `<option value="${t.id}">${t.name}</option>`).join("");

  renderLoadList();
  backdrop.classList.add("open");
  document.getElementById("loadLabel").value = "";
  document.getElementById("loadNotes").value = "";
}

function closeModal() {
  document.getElementById("modalBackdrop").classList.remove("open");
  selectedDateKey = null;
}

function renderLoadList() {
  const list = document.getElementById("loadList");
  const loads = calendarData[selectedDateKey] || [];

  if (loads.length === 0) {
    list.innerHTML = `<div class="load-empty">No loads planned yet. Add one below.</div>`;
    return;
  }

  list.innerHTML = loads.map((l) => {
    const type = LOAD_TYPES.find(t => t.id === l.typeId) || LOAD_TYPES[LOAD_TYPES.length - 1];
    const label = l.label || type.name;
    const notes = l.notes ? `<span class="load-notes">${escapeHtml(l.notes)}</span>` : "";
    return `
      <div class="load-item">
        <span class="load-swatch" style="background:${type.color}"></span>
        <span class="load-name">${escapeHtml(label)}</span>
        ${notes}
        <button class="load-delete" data-id="${l.id}" aria-label="Delete load">×</button>
      </div>
    `;
  }).join("");

  list.querySelectorAll(".load-delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      const loadId = Number(btn.dataset.id);
      const ok = await deleteLoadFromServer(loadId);
      if (ok) {
        // Remove from local cache
        calendarData[selectedDateKey] = (calendarData[selectedDateKey] || [])
          .filter(l => l.id !== loadId);
        if (calendarData[selectedDateKey].length === 0) {
          delete calendarData[selectedDateKey];
        }
        renderLoadList();
        renderCalendar();
      }
    });
  });
}

async function addLoad(e) {
  e.preventDefault();
  if (!isLoggedIn) {
    showLoginPrompt();
    return;
  }
  const typeId = document.getElementById("loadType").value;
  const label = document.getElementById("loadLabel").value.trim();
  const notes = document.getElementById("loadNotes").value.trim();

  const newId = await addLoadToServer(selectedDateKey, typeId, label, notes);
  if (newId === null) return;

  if (!calendarData[selectedDateKey]) calendarData[selectedDateKey] = [];
  calendarData[selectedDateKey].push({ id: newId, typeId, label, notes });

  document.getElementById("loadLabel").value = "";
  document.getElementById("loadNotes").value = "";
  renderLoadList();
  renderCalendar();
}

// ---------- Wire up ----------
document.getElementById("prevMonth").addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
});
document.getElementById("nextMonth").addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
});
document.getElementById("todayBtn").addEventListener("click", () => {
  currentDate = new Date();
  currentDate.setDate(1);
  renderCalendar();
});
document.getElementById("closeModal").addEventListener("click", closeModal);
document.getElementById("modalBackdrop").addEventListener("click", e => {
  if (e.target.id === "modalBackdrop") closeModal();
});
document.getElementById("addLoadForm").addEventListener("submit", addLoad);
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeModal();
    const prompt = document.getElementById("loginPrompt");
    if (prompt) prompt.classList.remove("open");
  }
});

// ---------- Init ----------
(async function init() {
  renderLegend();
  await checkLogin();
  await fetchCalendarData();
  renderCalendar();
})();