document.write('<script src="https://cdn.jsdelivr.net/gh/LocurJJ/Ventas-panaderia@61056808b91c2bf004732abd052ee3e7f3c5b832/firebase.js"><\/script>');
document.write('<link rel="stylesheet" href="night-sales.css?v=20260618-1">');

(function installPanaderiaSafeguards() {
  const SALES_KEY = "panaderia_josue_ventas_v1";
  const SALES_BACKUP_KEY = "panaderia_josue_ventas_respaldo_v1";
  const ACCOUNTS_KEY = "panaderia_josue_fiados_v1";
  const SHIFTS_KEY = "panaderia_josue_turnos_v1";
  const deletedCleanups = new Set();

  const nativeSetItem = Storage.prototype.setItem;

  function asList(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (value && typeof value === "object") return Object.values(value).filter(Boolean);
    return [];
  }

  function readList(key) {
    try { return asList(JSON.parse(localStorage.getItem(key) || "[]")); }
    catch (error) { return []; }
  }

  function money(value) {
    return Number(value || 0).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
  }

  function formatDateTime(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString("es-AR", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
  }

  function compactItem(item) {
    return {
      productId: item.productId || item.id || "",
      id: item.productId || item.id || "",
      name: item.name || "Producto",
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice || item.price || 0),
      total: Number(item.total || 0),
      weighable: !!item.weighable
    };
  }

  function compactSale(sale) {
    return {
      id: sale.id,
      shiftId: sale.shiftId,
      saleNumber: sale.saleNumber,
      local: sale.local,
      date: sale.date,
      updatedAt: sale.updatedAt || sale.date,
      customer: sale.customer || "Consumidor final",
      customerType: sale.customerType || "normal",
      items: asList(sale.items).map(compactItem),
      total: Number(sale.total || 0),
      cash: Number(sale.cash || 0),
      transfer: Number(sale.transfer || 0),
      change: Number(sale.change || 0),
      method: sale.method || "Efectivo"
    };
  }

  function compactSales(list) {
    return asList(list).filter((sale) => sale && sale.id).map(compactSale);
  }

  function accountSignature(entry) {
    const customer = String(entry.customer || "").trim().toLowerCase();
    const when = entry.date ? new Date(entry.date) : new Date(0);
    const minute = Number.isNaN(when.getTime()) ? "" : when.toISOString().slice(0, 16);
    const items = asList(entry.items).map((item) => {
      const id = item.productId || item.id || item.name || "";
      const qty = Number(item.quantity || 0).toFixed(3);
      return `${id}:${qty}`;
    }).sort().join("|");
    return `${customer}|${minute}|${items}`;
  }

  function dedupeAccounts(list) {
    const map = new Map();
    asList(list).forEach((entry) => {
      if (!entry) return;
      const signature = accountSignature(entry);
      const key = signature || entry.id || `${Date.now()}-${Math.random()}`;
      const current = map.get(key);
      const currentTime = new Date(current?.date || 0).getTime();
      const entryTime = new Date(entry.date || 0).getTime();
      if (!current || entryTime >= currentTime) map.set(key, entry);
    });
    return [...map.values()].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }

  function prepareValue(key, value) {
    if (key === SALES_KEY || key === SALES_BACKUP_KEY) return compactSales(value);
    if (key === ACCOUNTS_KEY) return dedupeAccounts(value);
    if (key === SHIFTS_KEY) return asList(value);
    return value;
  }

  function safeLocalSet(key, value) {
    const prepared = prepareValue(key, value);
    const text = JSON.stringify(prepared);
    try {
      nativeSetItem.call(localStorage, key, text);
      return true;
    } catch (error) {
      try { nativeSetItem.call(localStorage, SALES_BACKUP_KEY, "[]"); } catch (backupError) {}
      if (key === SALES_KEY) {
        try { nativeSetItem.call(localStorage, key, JSON.stringify(prepared.slice(0, 500))); return true; } catch (secondError) {}
        try { nativeSetItem.call(localStorage, key, JSON.stringify(prepared.slice(0, 150))); return true; } catch (thirdError) {}
      }
      if (key === SALES_BACKUP_KEY) {
        try { nativeSetItem.call(localStorage, key, JSON.stringify(prepared.slice(0, 50))); return true; } catch (backupError) {}
      }
      console.warn("No se pudo guardar localmente", key, error);
      return false;
    }
  }

  Storage.prototype.setItem = function patchedSetItem(key, value) {
    if (this === localStorage && [SALES_KEY, SALES_BACKUP_KEY, ACCOUNTS_KEY, SHIFTS_KEY].includes(key)) {
      try { return safeLocalSet(key, JSON.parse(value || "[]")); }
      catch (error) { return safeLocalSet(key, []); }
    }
    return nativeSetItem.call(this, key, value);
  };

  function remoteSet(key, value) {
    const prepared = prepareValue(key, value);
    safeLocalSet(key, prepared);
    try {
      if (typeof db !== "undefined" && typeof dbPath === "function") return db.ref(dbPath(key)).set(prepared);
    } catch (error) {
      console.warn("No se pudo sincronizar online", key, error);
    }
    return Promise.resolve();
  }

  window.saveOnline = function saveOnlineSafe(key, value) {
    return remoteSet(key, value);
  };

  window.listenOnline = function listenOnlineSafe(key, callback) {
    try {
      if (typeof db === "undefined" || typeof dbPath !== "function") return;
      db.ref(dbPath(key)).on("value", (snapshot) => {
        const data = prepareValue(key, asList(snapshot.val()));
        safeLocalSet(key, data);
        callback(data);
      });
    } catch (error) {
      console.warn("No se pudo escuchar la base online", key, error);
    }
  };

  try { saveOnline = window.saveOnline; } catch (error) {}
  try { listenOnline = window.listenOnline; } catch (error) {}

  function cleanDuplicateAccounts() {
    const current = readList(ACCOUNTS_KEY);
    const cleaned = dedupeAccounts(current);
    if (cleaned.length === current.length) return false;
    safeLocalSet(ACCOUNTS_KEY, cleaned);
    remoteSet(ACCOUNTS_KEY, cleaned);
    if (!deletedCleanups.has(cleaned.length)) {
      deletedCleanups.add(cleaned.length);
      console.info(`Cuentas corrientes limpiadas: ${current.length - cleaned.length} duplicados quitados.`);
    }
    return true;
  }

  function getLocalName() {
    return new URLSearchParams(window.location.search).get("local") || "Central";
  }

  function getOpenShift(shifts) {
    const local = getLocalName();
    return asList(shifts).find((shift) => shift.local === local && shift.status === "open");
  }

  function makeId() {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function persistShifts(shifts) {
    safeLocalSet(SHIFTS_KEY, shifts);
    remoteSet(SHIFTS_KEY, shifts);
  }

  function addMovement(type) {
    const shifts = readList(SHIFTS_KEY);
    const shift = getOpenShift(shifts);
    if (!shift) { alert("Primero tenes que abrir un turno de caja."); return; }
    const isExpense = type === "expenses";
    const descriptionInput = document.getElementById(isExpense ? "expenseDescriptionInput" : "reinforcementDescriptionInput");
    const amountInput = document.getElementById(isExpense ? "expenseAmountInput" : "reinforcementAmountInput");
    const amount = Number(amountInput?.value || 0);
    if (amount <= 0) { alert(isExpense ? "Carga el importe del gasto." : "Carga el importe del refuerzo."); return; }
    shift[type] = asList(shift[type]);
    shift[type].push({
      id: makeId(),
      description: descriptionInput?.value.trim() || (isExpense ? "Gasto" : "Refuerzo"),
      amount,
      date: new Date().toISOString()
    });
    persistShifts(shifts);
    if (descriptionInput) descriptionInput.value = "";
    if (amountInput) amountInput.value = "";
    if (typeof window.renderShift === "function") window.renderShift();
    alert(isExpense ? "Gasto agregado." : "Refuerzo agregado.");
  }

  function deleteMovement(type, id) {
    const shifts = readList(SHIFTS_KEY);
    const shift = getOpenShift(shifts);
    if (!shift) return;
    shift[type] = asList(shift[type]).filter((item) => item.id !== id);
    persistShifts(shifts);
    if (typeof window.renderShift === "function") window.renderShift();
  }

  function installShiftButtons() {
    window.addExpense = function addExpenseSafe() { addMovement("expenses"); };
    window.deleteExpense = function deleteExpenseSafe(id) { deleteMovement("expenses", id); };
    window.addReinforcement = function addReinforcementSafe() { addMovement("reinforcements"); };
    window.deleteReinforcement = function deleteReinforcementSafe(id) { deleteMovement("reinforcements", id); };
    document.querySelectorAll("button").forEach((button) => {
      const text = (button.textContent || "").trim().toLowerCase();
      if (text === "agregar gasto") button.onclick = window.addExpense;
      if (text === "agregar refuerzo") button.onclick = window.addReinforcement;
    });
  }

  function shiftExpenses(shift) {
    return asList(shift.expenses).map((expense) => ({ ...expense, local: shift.local, shiftOpenedAt: shift.openedAt, shiftClosedAt: shift.closedAt }));
  }

  function renderAdminExpenses() {
    const select = document.getElementById("adminReportLocalSelect");
    const list = document.getElementById("adminReportList");
    const controls = document.getElementById("adminStatsControls");
    if (!select || !list || select.value !== "Gastos") return;
    if (controls) controls.classList.add("hidden");
    const allExpenses = readList(SHIFTS_KEY).flatMap(shiftExpenses).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    if (allExpenses.length === 0) {
      list.innerHTML = "<p class='muted'>Todavia no hay gastos cargados.</p>";
      return;
    }
    const total = allExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    list.innerHTML = `
      <article class="report-card open">
        <button class="report-summary" type="button">
          <span><strong>Gastos cargados</strong><small>${allExpenses.length} movimientos</small></span>
          <strong>${money(total)}</strong>
        </button>
        <div class="report-detail">
          ${allExpenses.map((expense) => `
            <div class="report-row">
              <span>${formatDateTime(expense.date)} - ${expense.local || ""} - ${escapeHtml(expense.description || "Gasto")}</span>
              <strong>${money(expense.amount)}</strong>
            </div>
          `).join("")}
        </div>
      </article>`;
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  }

  function installAdminReports() {
    const select = document.getElementById("adminReportLocalSelect");
    if (!select) return;
    if (![...select.options].some((option) => option.value === "Gastos")) {
      select.insertAdjacentHTML("beforeend", '<option value="Gastos">Gastos</option>');
    }
    if (!select.__expenseHotfix) {
      select.__expenseHotfix = true;
      select.addEventListener("change", () => setTimeout(renderAdminExpenses, 0));
      document.getElementById("adminReportsButton")?.addEventListener("click", () => setTimeout(renderAdminExpenses, 100));
    }
    renderAdminExpenses();
  }

  function installCartPolish() {
    if (document.getElementById("cart-polish-hotfix")) return;
    const style = document.createElement("style");
    style.id = "cart-polish-hotfix";
    style.textContent = `.cart-delete-btn{width:28px;height:28px;border:0;border-radius:999px;background:#fee2e2;color:#b91c1c;font-size:20px;font-weight:800;line-height:1;display:inline-grid;place-items:center}.cart-delete-btn:hover{background:#fecaca}.quantity-edit{width:64px;padding:7px;border:1px solid #ddd;border-radius:8px;text-align:center}`;
    document.head.appendChild(style);
  }

  function run() {
    cleanDuplicateAccounts();
    installShiftButtons();
    installAdminReports();
    installCartPolish();
  }

  function runLater() {
    [100, 700, 1500, 3000, 6000, 10000].forEach((delay) => setTimeout(run, delay));
    setInterval(cleanDuplicateAccounts, 15000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", runLater);
  else runLater();
})();
