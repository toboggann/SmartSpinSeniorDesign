  // ---------- Config ----------
    const STORAGE_KEY = "smartspin_calendar_loads";
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

    // ---------- Storage ----------
    function loadData() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
      } catch {
        return {};
      }
    }

    function saveData(data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    function dateKey(year, month, day) {
      return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
      const data = loadData();
      const today = new Date();
      const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

      const weekdays = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
      let html = weekdays.map(w => `<div class="cal-weekday">${w}</div>`).join("");

      // Leading empty cells
      for (let i = 0; i < firstDay; i++) {
        html += `<div class="cal-day cal-empty"></div>`;
      }

      // Day cells
      for (let d = 1; d <= daysInMonth; d++) {
        const key = dateKey(year, month, d);
        const loads = data[key] || [];
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

      // Attach handlers
      grid.querySelectorAll(".cal-day:not(.cal-empty)").forEach(el => {
        el.addEventListener("click", () => openModal(el.dataset.date));
        el.addEventListener("keydown", e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openModal(el.dataset.date);
          }
        });
      });
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

      // Populate load type dropdown
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
      const data = loadData();
      const loads = data[selectedDateKey] || [];

      if (loads.length === 0) {
        list.innerHTML = `<div class="load-empty">No loads planned yet. Add one below.</div>`;
        return;
      }

      list.innerHTML = loads.map((l, i) => {
        const type = LOAD_TYPES.find(t => t.id === l.typeId) || LOAD_TYPES[LOAD_TYPES.length - 1];
        const label = l.label || type.name;
        const notes = l.notes ? `<span class="load-notes">${escapeHtml(l.notes)}</span>` : "";
        return `
          <div class="load-item">
            <span class="load-swatch" style="background:${type.color}"></span>
            <span class="load-name">${escapeHtml(label)}</span>
            ${notes}
            <button class="load-delete" data-idx="${i}" aria-label="Delete load">×</button>
          </div>
        `;
      }).join("");

      list.querySelectorAll(".load-delete").forEach(btn => {
        btn.addEventListener("click", () => {
          const idx = Number(btn.dataset.idx);
          const data = loadData();
          data[selectedDateKey].splice(idx, 1);
          if (data[selectedDateKey].length === 0) delete data[selectedDateKey];
          saveData(data);
          renderLoadList();
          renderCalendar();
        });
      });
    }

    function addLoad(e) {
      e.preventDefault();
      const typeId = document.getElementById("loadType").value;
      const label = document.getElementById("loadLabel").value.trim();
      const notes = document.getElementById("loadNotes").value.trim();

      const data = loadData();
      if (!data[selectedDateKey]) data[selectedDateKey] = [];
      data[selectedDateKey].push({ typeId, label, notes });
      saveData(data);

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
      if (e.key === "Escape") closeModal();
    });

    renderLegend();
    renderCalendar();