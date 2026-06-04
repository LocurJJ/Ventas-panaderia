document.write('<script src="https://cdn.jsdelivr.net/gh/LocurJJ/Ventas-panaderia@61056808b91c2bf004732abd052ee3e7f3c5b832/firebase.js"><\/script>');

(function fixShiftExpenseButton() {
  const SHIFTS_KEY = "panaderia_josue_turnos_v1";
  function readList(key) { try { const value = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(value) ? value : []; } catch (error) { return []; } }
  function saveList(key, value) { localStorage.setItem(key, JSON.stringify(value)); if (typeof saveOnline === "function") saveOnline(key, value); }
  function makeId() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function getLocalName() { return new URLSearchParams(window.location.search).get("local") || "Central"; }
  function getOpenShiftFromList(shifts) { const local = getLocalName(); return shifts.find((shift) => shift.local === local && shift.status === "open"); }
  function installExpensePatch() {
    window.addExpense = function addExpense() {
      const shifts = readList(SHIFTS_KEY);
      const shift = getOpenShiftFromList(shifts);
      if (!shift) return;
      const descriptionInput = document.getElementById("expenseDescriptionInput");
      const amountInput = document.getElementById("expenseAmountInput");
      const amount = Number(amountInput?.value || 0);
      if (amount <= 0) { alert("Carga el importe del gasto."); return; }
      shift.expenses = Array.isArray(shift.expenses) ? shift.expenses : [];
      shift.expenses.push({ id: makeId(), description: descriptionInput?.value.trim() || "Gasto", amount, date: new Date().toISOString() });
      saveList(SHIFTS_KEY, shifts);
      if (descriptionInput) descriptionInput.value = "";
      if (amountInput) amountInput.value = "";
      if (typeof window.renderShift === "function") window.renderShift();
      alert("Gasto agregado.");
    };
    window.deleteExpense = function deleteExpense(id) {
      const shifts = readList(SHIFTS_KEY);
      const shift = getOpenShiftFromList(shifts);
      if (!shift) return;
      shift.expenses = (Array.isArray(shift.expenses) ? shift.expenses : []).filter((expense) => expense.id !== id);
      saveList(SHIFTS_KEY, shifts);
      if (typeof window.renderShift === "function") window.renderShift();
    };
    document.querySelectorAll("button").forEach((button) => {
      if ((button.textContent || "").trim().toLowerCase() === "agregar gasto") button.onclick = window.addExpense;
    });
  }
  function installLater() { setTimeout(installExpensePatch, 700); setTimeout(installExpensePatch, 1500); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installLater); else installLater();
})();

(function installAdminExpenseReports() {
  const SHIFTS_KEY = "panaderia_josue_turnos_v1";
  function readList(key) { try { const value = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(value) ? value : []; } catch (error) { return []; } }
  function movements(value) { if (Array.isArray(value)) return value.filter(Boolean); if (value && typeof value === "object") return Object.values(value).filter(Boolean); return []; }
  function money(value) { return Number(value || 0).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }); }
  function dateOnly(value) { if (!value) return "-"; return new Date(value).toLocaleDateString("es-AR"); }
  function timeOnly(value) { if (!value) return "-"; return new Date(value).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }); }
  function esc(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
  function ensureExpenseOption() { const select = document.getElementById("adminReportLocalSelect"); if (!select || select.querySelector('option[value="Gastos"]')) return; const option = document.createElement("option"); option.value = "Gastos"; option.textContent = "Gastos"; select.appendChild(option); }
  function renderAdminExpenses() {
    const statsControls = document.getElementById("adminStatsControls");
    const list = document.getElementById("adminReportList");
    if (!list) return;
    if (statsControls) statsControls.classList.add("hidden");
    const closedShifts = readList(SHIFTS_KEY).filter((shift) => shift.status === "closed" && movements(shift.expenses).length > 0).sort((a, b) => new Date(b.closedAt || b.openedAt) - new Date(a.closedAt || a.openedAt));
    if (closedShifts.length === 0) { list.innerHTML = "<p class='muted'>Todavia no hay gastos guardados en turnos cerrados.</p>"; return; }
    const total = closedShifts.reduce((sum, shift) => sum + movements(shift.expenses).reduce((subtotal, expense) => subtotal + Number(expense.amount || 0), 0), 0);
    list.innerHTML = `<div class="stats-period"><strong>Total de gastos</strong><span>${closedShifts.length} turno${closedShifts.length === 1 ? "" : "s"} con gastos</span><span>${money(total)}</span></div>${closedShifts.map((shift) => { const expenses = movements(shift.expenses); const shiftTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0); const detail = expenses.map((expense) => `<li>${timeOnly(expense.date || shift.closedAt || shift.openedAt)} h - ${esc(expense.description || "Gasto")} - ${money(expense.amount)}</li>`).join(""); return `<details class="report-card"><summary class="report-summary"><span><strong>${esc(shift.local || "Local")}</strong><small>${dateOnly(shift.closedAt || shift.openedAt)} - Cierre ${timeOnly(shift.closedAt || shift.openedAt)} h</small></span><span class="report-summary-total">${money(shiftTotal)} <span class="report-arrow">&gt;</span></span></summary><div class="report-body"><p class="muted">Turno desde ${timeOnly(shift.openedAt)} h hasta ${timeOnly(shift.closedAt)} h</p><div class="report-row"><span>Cantidad de gastos</span><strong>${expenses.length}</strong></div><div class="report-row"><span>Total gastado</span><strong>${money(shiftTotal)}</strong></div><div class="report-detail"><strong>Detalle</strong><ul>${detail}</ul></div></div></details>`; }).join("")}`;
  }
  function install() {
    ensureExpenseOption();
    const select = document.getElementById("adminReportLocalSelect");
    if (!select || select.dataset.expenseReportsInstalled === "true") return;
    select.dataset.expenseReportsInstalled = "true";
    const previousRender = typeof window.renderAdminReports === "function" ? window.renderAdminReports : null;
    window.renderAdminReports = function renderAdminReportsWithExpenses() { ensureExpenseOption(); if (document.getElementById("adminReportLocalSelect")?.value === "Gastos") { renderAdminExpenses(); return; } if (previousRender) previousRender(); };
    select.addEventListener("change", () => { if (select.value === "Gastos") renderAdminExpenses(); });
    document.getElementById("adminReportsButton")?.addEventListener("click", () => { setTimeout(() => { ensureExpenseOption(); if (document.getElementById("adminReportLocalSelect")?.value === "Gastos") renderAdminExpenses(); }, 0); });
  }
  function installLater() { setTimeout(install, 800); setTimeout(install, 1600); setTimeout(install, 2600); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installLater); else installLater();
})();

(function installCartQuantityPatch() {
  function installStyle() { if (document.getElementById("cart-quantity-style-patch")) return; const style = document.createElement("style"); style.id = "cart-quantity-style-patch"; style.textContent = `.quantity-edit{width:64px;padding:7px;border:1px solid #ddd;border-radius:8px;text-align:center}.cart-delete-btn{width:28px;height:28px;border:0;border-radius:999px;background:#fee2e2;color:#b91c1c;font-size:20px;font-weight:800;line-height:1;display:inline-grid;place-items:center;transition:background .15s ease,transform .15s ease}.cart-delete-btn:hover{background:#fecaca;transform:scale(1.05)}button:disabled{cursor:not-allowed;opacity:.65}`; document.head.appendChild(style); }
  function install() {
    installStyle();
    if (typeof window.renderCart !== "function" || window.renderCart.__quantityPatch) return;
    const originalRenderCart = window.renderCart;
    window.changeQuantity = function changeQuantity(id, newQuantity) { try { const item = cart.find((product) => product.id === id); if (!item || item.weighable) return; const quantity = Math.max(1, Math.floor(Number(newQuantity || 1))); item.quantity = quantity; item.total = Number(item.unitPrice || 0) * quantity; window.renderCart(); } catch (error) { console.warn("No se pudo cambiar la cantidad.", error); } };
    window.renderCart = function renderCartWithEditableQuantity() {
      originalRenderCart.apply(this, arguments);
      try {
        const rows = document.querySelectorAll("#cartItems tr");
        rows.forEach((row) => {
          const priceInput = row.querySelector(".price-edit");
          const quantityCell = row.children[1];
          const deleteCell = row.children[3];
          if (!priceInput || !quantityCell) return;
          const idMatch = String(priceInput.getAttribute("onchange") || "").match(/changePrice\('([^']+)'/);
          const id = idMatch?.[1];
          const quantityText = quantityCell.textContent.trim();
          if (id && /^\d+$/.test(quantityText)) quantityCell.innerHTML = `<input class="quantity-edit" type="number" min="1" step="1" value="${quantityText}" onchange="changeQuantity('${id}', this.value)">`;
          const deleteButton = deleteCell?.querySelector("button");
          if (deleteButton && !deleteButton.classList.contains("cart-delete-btn")) { deleteButton.className = "cart-delete-btn"; deleteButton.innerHTML = "&times;"; deleteButton.setAttribute("aria-label", "Quitar producto"); }
        });
      } catch (error) { console.warn("No se pudo mejorar el carrito.", error); }
    };
    window.renderCart.__quantityPatch = true;
    window.renderCart();
  }
  function installLater() { setTimeout(install, 900); setTimeout(install, 1800); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installLater); else installLater();
})();

(function installAccountPrintOnlyPatch() {
  const PRODUCTS_KEY = "panaderia_josue_productos_v1";
  const SALES_KEY = "panaderia_josue_ventas_v1";
  const ACCOUNTS_KEY = "panaderia_josue_fiados_v1";
  function readList(key) { try { const value = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(value) ? value : []; } catch (error) { return []; } }
  function saveList(key, value) { localStorage.setItem(key, JSON.stringify(value)); if (typeof saveOnline === "function") saveOnline(key, value); }
  function money(value) { return Number(value || 0).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }); }
  function esc(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
  function formatKg(value) { const quantity = Number(value || 0); if (quantity < 1) return `${Math.round(quantity * 1000)} g`; return `${quantity.toLocaleString("es-AR", { maximumFractionDigits: 3 })} kg`; }
  function currentPrice(item, products) { const product = products.find((entry) => entry.id === item.productId); return Number(product?.salePrice ?? item.unitPrice ?? 0); }
  function quantityText(item) { return item.weighable ? formatKg(item.quantity) : `${Number(item.quantity || 0).toLocaleString("es-AR")} un.`; }
  function printReceipt(customerName, items, total) {
    const rows = items.map((item) => `<tr><td>${esc(item.name)}</td><td>${quantityText(item)}</td><td>${money(item.unitPrice)}${item.weighable ? "/kg" : ""}</td><td>${money(item.total)}</td></tr>`).join("");
    const now = new Date().toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const win = window.open("", "_blank", "width=720,height=900");
    if (!win) { alert("No se pudo abrir la impresion. Revisa si el navegador bloqueo ventanas emergentes."); return false; }
    win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cuenta ${esc(customerName)}</title><style>body{font-family:Arial,sans-serif;color:#111827;padding:28px}h1{margin:0 0 6px;font-size:28px}.muted{color:#64748b;margin-bottom:22px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border-bottom:1px solid #e5e7eb;padding:10px 8px;text-align:left}th:last-child,td:last-child{text-align:right}.total{margin-top:18px;text-align:right;font-size:24px;font-weight:800}.box{margin-top:20px;border:1px solid #e5e7eb;border-radius:10px;padding:14px}.payment td:first-child{font-weight:700}@media print{body{padding:0}}</style></head><body><h1>Panaderia Josue</h1><div class="muted">Cuenta de ${esc(customerName)} - ${now}</div><table><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio actual</th><th>Subtotal</th></tr></thead><tbody>${rows}</tbody></table><div class="total">Total: ${money(total)}</div><div class="box"><strong>Pago</strong><table class="payment"><tr><td>Total de la cuenta</td><td>${money(total)}</td></tr></table></div></body></html>`);
    win.document.close(); win.focus(); setTimeout(() => win.print(), 250); return true;
  }
  function install() {
    if (!document.getElementById("clientList")) return;
    window.settleCustomerAccount = function settleCustomerAccountPrintOnly(encodedName) {
      const customerName = decodeURIComponent(encodedName);
      const accounts = readList(ACCOUNTS_KEY);
      const salesList = readList(SALES_KEY);
      const products = readList(PRODUCTS_KEY);
      const accountEntries = accounts.filter((entry) => entry.customer === customerName);
      const legacySales = salesList.filter((sale) => sale.customer === customerName && sale.customerType && sale.customerType !== "normal");
      if (accountEntries.length === 0 && legacySales.length === 0) return;
      const items = [...accountEntries, ...legacySales].flatMap((entry) => entry.items || []).map((item) => { const unitPrice = currentPrice(item, products); return { ...item, unitPrice, total: unitPrice * Number(item.quantity || 0) }; });
      const total = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
      const ok = confirm(`Se va a imprimir la cuenta de ${customerName} por ${money(total)} y limpiarla. No se suma a caja.`);
      if (!ok) return;
      printReceipt(customerName, items, total);
      saveList(ACCOUNTS_KEY, accounts.filter((entry) => entry.customer !== customerName));
      saveList(SALES_KEY, salesList.filter((sale) => !(sale.customer === customerName && sale.customerType && sale.customerType !== "normal")));
      window.renderNotebook?.(); window.renderClients?.(); window.renderShift?.();
    };
    setTimeout(() => { document.querySelectorAll(".account-settle").forEach((button) => { if ((button.textContent || "").trim().toLowerCase() === "cobrar cuenta") button.textContent = "Imprimir cuenta"; }); }, 100);
  }
  function installLater() { setTimeout(install, 1000); setTimeout(install, 2200); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installLater); else installLater();
})();

(function installSalesNotebookGuard() {
  const SALES_KEY = "panaderia_josue_ventas_v1";
  const SALES_BACKUP_KEY = "panaderia_josue_ventas_respaldo_v1";
  const DELETED_SALES_KEY = "panaderia_josue_ventas_borradas_v1";
  let saving = false;
  function readList(key) { try { const value = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(value) ? value : []; } catch (error) { return []; } }
  function writeLocal(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function safeOnline(key, value) { try { if (typeof saveOnline === "function") saveOnline(key, value); } catch (error) { console.warn("No se pudo sincronizar online. Queda guardado local.", error); } }
  function safeCall(fn) { try { if (typeof fn === "function") fn(); } catch (error) { console.warn("Accion secundaria fallida.", error); } }
  function deletedIds() { return new Set(readList(DELETED_SALES_KEY).map((entry) => entry.id || entry).filter(Boolean)); }
  function rememberDeletedSale(id) { const deleted = readList(DELETED_SALES_KEY).filter((entry) => entry.id !== id); deleted.unshift({ id, deletedAt: new Date().toISOString() }); writeLocal(DELETED_SALES_KEY, deleted.slice(0, 500)); }
  function mergeSalesById(...lists) {
    const deleted = deletedIds();
    const map = new Map();
    lists.flat().filter(Boolean).forEach((sale) => {
      if (!sale.id || deleted.has(sale.id)) return;
      const current = map.get(sale.id);
      const currentTime = new Date(current?.updatedAt || current?.date || 0).getTime();
      const saleTime = new Date(sale.updatedAt || sale.date || 0).getTime();
      if (!current || saleTime >= currentTime) map.set(sale.id, sale);
    });
    return [...map.values()].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }
  function persistSales(nextSales) {
    const currentSales = typeof sales !== "undefined" && Array.isArray(sales) ? sales : readList(SALES_KEY);
    sales = mergeSalesById(nextSales, currentSales, readList(SALES_BACKUP_KEY));
    writeLocal(SALES_KEY, sales);
    writeLocal(SALES_BACKUP_KEY, sales);
    safeOnline(SALES_KEY, sales);
    return sales;
  }
  function nextSaleNumber(shiftId) {
    const list = typeof getShiftSales === "function" ? getShiftSales(shiftId) : readList(SALES_KEY).filter((sale) => sale.shiftId === shiftId);
    return Math.max(0, ...list.map((sale) => Number(sale.saleNumber || 0))) + 1;
  }
  function setButtonSaving(button, isSaving) { if (!button) return; button.disabled = isSaving; button.textContent = isSaving ? "Guardando..." : "Guardar venta"; }
  function installConfirmOverride() {
    const confirmButton = document.getElementById("confirmPaymentButton") || document.querySelector(".payment-actions .confirm-pay");
    if (confirmButton && !confirmButton.id) confirmButton.id = "confirmPaymentButton";
    window.confirmPayment = function confirmPaymentGuarded() {
      if (saving) return;
      let saleNumber = 0;
      const button = document.getElementById("confirmPaymentButton") || document.querySelector(".payment-actions .confirm-pay");
      try {
        const shift = getOpenShift();
        if (!shift) { alert("Primero tenes que abrir un turno de caja."); safeCall(closePayment); safeCall(showShiftView); return; }
        const total = Number(getCartTotal() || 0);
        const customer = getSelectedCustomer();
        const cash = Number(document.getElementById("cashInput")?.value || 0);
        const transfer = Number(document.getElementById("transferInput")?.value || 0);
        const paid = cash + transfer;
        if (customer.type === "normal" && paid < total) { alert(`Faltan ${formatMoney(total - paid)}.`); return; }
        const items = cart.map((item) => ({ ...item }));
        const now = new Date().toISOString();
        saving = true;
        setButtonSaving(button, true);
        saleNumber = nextSaleNumber(shift.id);
        const sale = {
          id: makeId(), shiftId: shift.id, saleNumber, local, date: now, updatedAt: now,
          customer: customer.name, customerType: customer.type, items, total,
          cash: customer.type === "normal" ? cash : 0,
          transfer: customer.type === "normal" ? transfer : 0,
          change: customer.type === "normal" ? Math.max(0, paid - total) : 0,
          method: getPaymentMethod(customer, cash, transfer)
        };
        persistSales([sale]);
        safeCall(() => adjustProductsStock(items, -1));
        cart = [];
        const customerSelect = document.getElementById("customerSelect");
        if (customerSelect) customerSelect.value = "Consumidor final";
        safeCall(closePayment);
        safeCall(renderCart); safeCall(renderProducts); safeCall(renderProductManageList); safeCall(renderNotebook); safeCall(renderClients); safeCall(renderShift);
        alert(customer.type === "normal" ? `Venta ${saleNumber} guardada en Cuaderno.` : "Consumo anotado en Cuaderno.");
      } catch (error) {
        console.error("No se pudo guardar la venta.", error);
        alert(`No se pudo guardar la venta: ${error?.message || error}. Avisame con esta foto.`);
      } finally {
        saving = false;
        setButtonSaving(button, false);
      }
    };
    window.confirmPayment.__salesGuard = true;
  }
  function installDeleteOverride() {
    if (typeof window.deleteSale !== "function" || window.deleteSale.__salesGuardV2) return;
    const originalDeleteSale = window.deleteSale;
    window.deleteSale = function deleteSaleGuarded(id) { rememberDeletedSale(id); originalDeleteSale(id); writeLocal(SALES_BACKUP_KEY, readList(SALES_KEY)); };
    window.deleteSale.__salesGuardV2 = true;
  }
  function installOnlineMerge() {
    if (typeof listenOnline !== "function" || window.__salesNotebookGuardListeningV2) return;
    window.__salesNotebookGuardListeningV2 = true;
    listenOnline(SALES_KEY, (onlineSales) => {
      const incoming = Array.isArray(onlineSales) ? onlineSales : [];
      const currentSales = typeof sales !== "undefined" && Array.isArray(sales) ? sales : readList(SALES_KEY);
      const merged = mergeSalesById(incoming, currentSales, readList(SALES_BACKUP_KEY));
      sales = merged;
      writeLocal(SALES_KEY, merged);
      writeLocal(SALES_BACKUP_KEY, merged);
      if (incoming.length !== merged.length) safeOnline(SALES_KEY, merged);
      safeCall(renderNotebook); safeCall(renderClients); safeCall(renderShift);
    });
  }
  function install() { installConfirmOverride(); installDeleteOverride(); installOnlineMerge(); }
  function installLater() { setTimeout(install, 500); setTimeout(install, 1500); setTimeout(install, 3000); setTimeout(install, 5000); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installLater); else installLater();
})();
