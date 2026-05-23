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
