document.write('<script src="https://cdn.jsdelivr.net/gh/LocurJJ/Ventas-panaderia@61056808b91c2bf004732abd052ee3e7f3c5b832/firebase.js"><\/script>');

(function fixShiftExpenseButton() {
  const SHIFTS_KEY = "panaderia_josue_turnos_v1";

  function readList(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function saveList(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    if (typeof saveOnline === "function") saveOnline(key, value);
  }

  function makeId() {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function getLocalName() {
    return new URLSearchParams(window.location.search).get("local") || "Central";
  }

  function getOpenShift(shifts) {
    const local = getLocalName();
    return shifts.find((shift) => shift.local === local && shift.status === "open");
  }

  function installExpensePatch() {
    window.addExpense = function addExpense() {
      const shifts = readList(SHIFTS_KEY);
      const shift = getOpenShift(shifts);
      if (!shift) return;

      const descriptionInput = document.getElementById("expenseDescriptionInput");
      const amountInput = document.getElementById("expenseAmountInput");
      const amount = Number(amountInput?.value || 0);
      if (amount <= 0) {
        alert("Carga el importe del gasto.");
        return;
      }

      shift.expenses = Array.isArray(shift.expenses) ? shift.expenses : [];
      shift.expenses.push({
        id: makeId(),
        description: descriptionInput?.value.trim() || "Gasto",
        amount,
        date: new Date().toISOString(),
      });

      saveList(SHIFTS_KEY, shifts);
      if (descriptionInput) descriptionInput.value = "";
      if (amountInput) amountInput.value = "";
      if (typeof window.renderShift === "function") window.renderShift();
      alert("Gasto agregado.");
    };

    window.deleteExpense = function deleteExpense(id) {
      const shifts = readList(SHIFTS_KEY);
      const shift = getOpenShift(shifts);
      if (!shift) return;
      shift.expenses = (Array.isArray(shift.expenses) ? shift.expenses : []).filter((expense) => expense.id !== id);
      saveList(SHIFTS_KEY, shifts);
      if (typeof window.renderShift === "function") window.renderShift();
    };

    document.querySelectorAll("button").forEach((button) => {
      if ((button.textContent || "").trim().toLowerCase() === "agregar gasto") {
        button.onclick = window.addExpense;
      }
    });
  }

  function installAfterOldScripts() {
    setTimeout(installExpensePatch, 700);
    setTimeout(installExpensePatch, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installAfterOldScripts);
  } else {
    installAfterOldScripts();
  }
})();

(function installAdminExpenseReports() {
  const SHIFTS_KEY = "panaderia_josue_turnos_v1";

  function readList(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function movements(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (value && typeof value === "object") return Object.values(value).filter(Boolean);
    return [];
  }

  function money(value) {
    return Number(value || 0).toLocaleString("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    });
  }

  function dateOnly(value) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("es-AR");
  }

  function timeOnly(value) {
    if (!value) return "-";
    return new Date(value).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function ensureExpenseOption() {
    const select = document.getElementById("adminReportLocalSelect");
    if (!select || select.querySelector('option[value="Gastos"]')) return;
    const option = document.createElement("option");
    option.value = "Gastos";
    option.textContent = "Gastos";
    select.appendChild(option);
  }

  function renderAdminExpenses() {
    const statsControls = document.getElementById("adminStatsControls");
    const list = document.getElementById("adminReportList");
    if (!list) return;
    if (statsControls) statsControls.classList.add("hidden");

    const closedShifts = readList(SHIFTS_KEY)
      .filter((shift) => shift.status === "closed" && movements(shift.expenses).length > 0)
      .sort((a, b) => new Date(b.closedAt || b.openedAt) - new Date(a.closedAt || a.openedAt));

    if (closedShifts.length === 0) {
      list.innerHTML = "<p class='muted'>Todavia no hay gastos guardados en turnos cerrados.</p>";
      return;
    }

    const total = closedShifts.reduce((sum, shift) => {
      return sum + movements(shift.expenses).reduce((subtotal, expense) => subtotal + Number(expense.amount || 0), 0);
    }, 0);

    list.innerHTML = `
      <div class="stats-period">
        <strong>Total de gastos</strong>
        <span>${closedShifts.length} turno${closedShifts.length === 1 ? "" : "s"} con gastos</span>
        <span>${money(total)}</span>
      </div>
      ${closedShifts.map((shift) => {
        const expenses = movements(shift.expenses);
        const shiftTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
        const detail = expenses.map((expense) => `
          <li>${timeOnly(expense.date || shift.closedAt || shift.openedAt)} h - ${esc(expense.description || "Gasto")} - ${money(expense.amount)}</li>
        `).join("");

        return `
          <details class="report-card">
            <summary class="report-summary">
              <span>
                <strong>${esc(shift.local || "Local")}</strong>
                <small>${dateOnly(shift.closedAt || shift.openedAt)} - Cierre ${timeOnly(shift.closedAt || shift.openedAt)} h</small>
              </span>
              <span class="report-summary-total">
                ${money(shiftTotal)}
                <span class="report-arrow">&gt;</span>
              </span>
            </summary>
            <div class="report-body">
              <p class="muted">Turno desde ${timeOnly(shift.openedAt)} h hasta ${timeOnly(shift.closedAt)} h</p>
              <div class="report-row"><span>Cantidad de gastos</span><strong>${expenses.length}</strong></div>
              <div class="report-row"><span>Total gastado</span><strong>${money(shiftTotal)}</strong></div>
              <div class="report-detail">
                <strong>Detalle</strong>
                <ul>${detail}</ul>
              </div>
            </div>
          </details>
        `;
      }).join("")}
    `;
  }

  function install() {
    ensureExpenseOption();
    const select = document.getElementById("adminReportLocalSelect");
    if (!select || select.dataset.expenseReportsInstalled === "true") return;
    select.dataset.expenseReportsInstalled = "true";

    const previousRender = typeof window.renderAdminReports === "function" ? window.renderAdminReports : null;
    window.renderAdminReports = function renderAdminReportsWithExpenses() {
      ensureExpenseOption();
      if (document.getElementById("adminReportLocalSelect")?.value === "Gastos") {
        renderAdminExpenses();
        return;
      }
      if (previousRender) previousRender();
    };

    select.addEventListener("change", () => {
      if (select.value === "Gastos") renderAdminExpenses();
    });

    document.getElementById("adminReportsButton")?.addEventListener("click", () => {
      setTimeout(() => {
        ensureExpenseOption();
        if (document.getElementById("adminReportLocalSelect")?.value === "Gastos") renderAdminExpenses();
      }, 0);
    });
  }

  function installLater() {
    setTimeout(install, 800);
    setTimeout(install, 1600);
    setTimeout(install, 2600);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installLater);
  } else {
    installLater();
  }
})();
