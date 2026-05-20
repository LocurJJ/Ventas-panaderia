const firebaseConfig = {
  apiKey: "AIzaSyAl2gyZygEHklr5gq2WuDShwuW6GmSEKQ",
  authDomain: "panaderia-venta.firebaseapp.com",
  databaseURL: "https://panaderia-venta-default-rtdb.firebaseio.com",
  projectId: "panaderia-venta",
  storageBucket: "panaderia-venta.firebasestorage.app",
  messagingSenderId: "672040680513",
  appId: "1:672040680513:web:ed523e825a36749b325ac0"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.database();

function dbPath(key) {
  return "panaderia_josue/" + key;
}

function saveOnline(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  return db.ref(dbPath(key)).set(value);
}

function listenOnline(key, callback) {
  db.ref(dbPath(key)).on("value", (snapshot) => {
    const value = snapshot.val();

    let list = [];

    if (Array.isArray(value)) {
      list = value.filter(Boolean);
    } else if (value && typeof value === "object") {
      list = Object.values(value);
    }

    localStorage.setItem(key, JSON.stringify(list));
    callback(list);
  });
}

(function setupCashMovementsPatch() {
  const SHIFTS_KEY = "panaderia_josue_turnos_v1";
  const SALES_KEY = "panaderia_josue_ventas_v1";

  function getLocalName() {
    return new URLSearchParams(window.location.search).get("local") || "Central";
  }

  function readList(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function makeId() {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function money(value) {
    return Number(value || 0).toLocaleString("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    });
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function dateTime(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getOpenShift(shifts) {
    const local = getLocalName();
    return shifts.find((shift) => shift.local === local && shift.status === "open");
  }

  function persistShifts(shifts) {
    localStorage.setItem(SHIFTS_KEY, JSON.stringify(shifts));
    saveOnline(SHIFTS_KEY, shifts);
  }

  function ensureReinforcementUi() {
    const shiftExpected = document.getElementById("shiftExpectedCash");
    if (shiftExpected && !document.getElementById("shiftReinforcements")) {
      const row = document.createElement("div");
      row.className = "shift-row";
      row.innerHTML = '<span>Refuerzos</span><strong id="shiftReinforcements">$0</strong>';
      shiftExpected.closest(".shift-row")?.before(row);
    }

    const expenseList = document.getElementById("expenseList");
    if (expenseList && !document.getElementById("reinforcementList")) {
      const box = expenseList.closest(".shift-box");
      const form = document.createElement("div");
      form.className = "shift-form";
      form.innerHTML = '<input id="reinforcementDescriptionInput" placeholder="Detalle del refuerzo"><input id="reinforcementAmountInput" type="number" min="0" step="1" placeholder="Importe"><button class="secondary-btn" type="button" onclick="addReinforcement()">Agregar refuerzo</button>';
      const title = document.createElement("h3");
      title.textContent = "Refuerzos";
      const list = document.createElement("div");
      list.className = "sale-list";
      list.id = "reinforcementList";
      expenseList.before(form);
      expenseList.after(title, list);
    }
  }

  window.addExpense = function addExpensePatched() {
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
    persistShifts(shifts);
    if (descriptionInput) descriptionInput.value = "";
    if (amountInput) amountInput.value = "";
    window.renderShift?.();
    alert("Gasto agregado.");
  };

  window.addReinforcement = function addReinforcement() {
    const shifts = readList(SHIFTS_KEY);
    const shift = getOpenShift(shifts);
    if (!shift) return;

    const descriptionInput = document.getElementById("reinforcementDescriptionInput");
    const amountInput = document.getElementById("reinforcementAmountInput");
    const amount = Number(amountInput?.value || 0);
    if (amount <= 0) {
      alert("Carga el importe del refuerzo.");
      return;
    }

    shift.reinforcements = Array.isArray(shift.reinforcements) ? shift.reinforcements : [];
    shift.reinforcements.push({
      id: makeId(),
      description: descriptionInput?.value.trim() || "Refuerzo",
      amount,
      date: new Date().toISOString(),
    });
    persistShifts(shifts);
    if (descriptionInput) descriptionInput.value = "";
    if (amountInput) amountInput.value = "";
    window.renderShift?.();
    alert("Refuerzo agregado.");
  };

  window.deleteExpense = function deleteExpensePatched(id) {
    const shifts = readList(SHIFTS_KEY);
    const shift = getOpenShift(shifts);
    if (!shift) return;
    shift.expenses = (shift.expenses || []).filter((expense) => expense.id !== id);
    persistShifts(shifts);
    window.renderShift?.();
  };

  window.deleteReinforcement = function deleteReinforcement(id) {
    const shifts = readList(SHIFTS_KEY);
    const shift = getOpenShift(shifts);
    if (!shift) return;
    shift.reinforcements = (shift.reinforcements || []).filter((reinforcement) => reinforcement.id !== id);
    persistShifts(shifts);
    window.renderShift?.();
  };

  window.renderShift = function renderShiftPatched() {
    ensureReinforcementUi();

    const shifts = readList(SHIFTS_KEY);
    const sales = readList(SALES_KEY);
    const shift = getOpenShift(shifts);
    const closedBox = document.getElementById("closedShiftBox");
    const openBox = document.getElementById("openShiftBox");
    if (!closedBox || !openBox) return;

    if (!shift) {
      closedBox.classList.remove("hidden");
      openBox.classList.add("hidden");
      return;
    }

    closedBox.classList.add("hidden");
    openBox.classList.remove("hidden");

    const shiftSales = sales.filter((sale) => sale.shiftId === shift.id);
    const expenses = Array.isArray(shift.expenses) ? shift.expenses : [];
    const reinforcements = Array.isArray(shift.reinforcements) ? shift.reinforcements : [];
    const expenseTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const reinforcementTotal = reinforcements.reduce((sum, reinforcement) => sum + Number(reinforcement.amount || 0), 0);
    const cashSales = shiftSales.reduce((sum, sale) => sum + Number(sale.cash || 0) - Number(sale.change || 0), 0);
    const digitalSales = shiftSales.reduce((sum, sale) => sum + Number(sale.transfer || 0), 0);
    const expectedCash = Number(shift.initialCash || 0) + cashSales + reinforcementTotal - expenseTotal;

    document.getElementById("shiftOpenedAt").textContent = dateTime(shift.openedAt);
    document.getElementById("shiftInitialCash").textContent = money(shift.initialCash);
    document.getElementById("shiftExpenses").textContent = money(expenseTotal);
    document.getElementById("shiftReinforcements").textContent = money(reinforcementTotal);
    document.getElementById("shiftCashSales").textContent = money(cashSales);
    document.getElementById("shiftDigitalSales").textContent = money(digitalSales);
    document.getElementById("shiftExpectedCash").textContent = money(expectedCash);

    const expenseList = document.getElementById("expenseList");
    expenseList.innerHTML = expenses.length
      ? expenses.map((expense) => `<div class="sale-item"><div class="sale-main"><strong>${esc(expense.description)}</strong><strong>${money(expense.amount)}</strong><button class="delete-btn" type="button" onclick="deleteExpense('${expense.id}')">X</button></div></div>`).join("")
      : "<p class='empty'>Sin gastos cargados.</p>";

    const reinforcementList = document.getElementById("reinforcementList");
    reinforcementList.innerHTML = reinforcements.length
      ? reinforcements.map((reinforcement) => `<div class="sale-item"><div class="sale-main"><strong>${esc(reinforcement.description)}</strong><strong>${money(reinforcement.amount)}</strong><button class="delete-btn" type="button" onclick="deleteReinforcement('${reinforcement.id}')">X</button></div></div>`).join("")
      : "<p class='empty'>Sin refuerzos cargados.</p>";
  };

  window.addEventListener("DOMContentLoaded", () => {
    ensureReinforcementUi();
    window.renderShift?.();
  });
})();
