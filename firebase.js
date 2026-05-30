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
      shift.expenses.push({ id: makeId(), description: descriptionInput?.value.trim() || "Gasto", amount, date: new Date().toISOString() });
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
      if ((button.textContent || "").trim().toLowerCase() === "agregar gasto") button.onclick = window.addExpense;
    });
  }

  function installAfterOldScripts() { setTimeout(installExpensePatch, 700); setTimeout(installExpensePatch, 1500); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installAfterOldScripts); else installAfterOldScripts();
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
    const statsControls = document.getElementById("adminStatsControls"); const list = document.getElementById("adminReportList"); if (!list) return; if (statsControls) statsControls.classList.add("hidden");
    const closedShifts = readList(SHIFTS_KEY).filter((shift) => shift.status === "closed" && movements(shift.expenses).length > 0).sort((a, b) => new Date(b.closedAt || b.openedAt) - new Date(a.closedAt || a.openedAt));
    if (closedShifts.length === 0) { list.innerHTML = "<p class='muted'>Todavia no hay gastos guardados en turnos cerrados.</p>"; return; }
    const total = closedShifts.reduce((sum, shift) => sum + movements(shift.expenses).reduce((subtotal, expense) => subtotal + Number(expense.amount || 0), 0), 0);
    list.innerHTML = `<div class="stats-period"><strong>Total de gastos</strong><span>${closedShifts.length} turno${closedShifts.length === 1 ? "" : "s"} con gastos</span><span>${money(total)}</span></div>${closedShifts.map((shift) => { const expenses = movements(shift.expenses); const shiftTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0); const detail = expenses.map((expense) => `<li>${timeOnly(expense.date || shift.closedAt || shift.openedAt)} h - ${esc(expense.description || "Gasto")} - ${money(expense.amount)}</li>`).join(""); return `<details class="report-card"><summary class="report-summary"><span><strong>${esc(shift.local || "Local")}</strong><small>${dateOnly(shift.closedAt || shift.openedAt)} - Cierre ${timeOnly(shift.closedAt || shift.openedAt)} h</small></span><span class="report-summary-total">${money(shiftTotal)} <span class="report-arrow">&gt;</span></span></summary><div class="report-body"><p class="muted">Turno desde ${timeOnly(shift.openedAt)} h hasta ${timeOnly(shift.closedAt)} h</p><div class="report-row"><span>Cantidad de gastos</span><strong>${expenses.length}</strong></div><div class="report-row"><span>Total gastado</span><strong>${money(shiftTotal)}</strong></div><div class="report-detail"><strong>Detalle</strong><ul>${detail}</ul></div></div></details>`; }).join("")}`;
  }
  function install() { ensureExpenseOption(); const select = document.getElementById("adminReportLocalSelect"); if (!select || select.dataset.expenseReportsInstalled === "true") return; select.dataset.expenseReportsInstalled = "true"; const previousRender = typeof window.renderAdminReports === "function" ? window.renderAdminReports : null; window.renderAdminReports = function renderAdminReportsWithExpenses() { ensureExpenseOption(); if (document.getElementById("adminReportLocalSelect")?.value === "Gastos") { renderAdminExpenses(); return; } if (previousRender) previousRender(); }; select.addEventListener("change", () => { if (select.value === "Gastos") renderAdminExpenses(); }); document.getElementById("adminReportsButton")?.addEventListener("click", () => { setTimeout(() => { ensureExpenseOption(); if (document.getElementById("adminReportLocalSelect")?.value === "Gastos") renderAdminExpenses(); }, 0); }); }
  function installLater() { setTimeout(install, 800); setTimeout(install, 1600); setTimeout(install, 2600); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installLater); else installLater();
})();

(function installCartQuantityPatch() {
  function installStyle() { if (document.getElementById("cart-quantity-style-patch")) return; const style = document.createElement("style"); style.id = "cart-quantity-style-patch"; style.textContent = `.quantity-edit{width:64px;padding:7px;border:1px solid #ddd;border-radius:8px;text-align:center}.cart-delete-btn{width:28px;height:28px;border:0;border-radius:999px;background:#fee2e2;color:#b91c1c;font-size:20px;font-weight:800;line-height:1;display:inline-grid;place-items:center;transition:background .15s ease,transform .15s ease}.cart-delete-btn:hover{background:#fecaca;transform:scale(1.05)}`; document.head.appendChild(style); }
  function install() {
    installStyle(); if (typeof window.renderCart !== "function" || window.renderCart.__quantityPatch) return; const originalRenderCart = window.renderCart;
    window.changeQuantity = function changeQuantity(id, newQuantity) { try { const item = cart.find((product) => product.id === id); if (!item || item.weighable) return; const quantity = Math.max(1, Math.floor(Number(newQuantity || 1))); item.quantity = quantity; item.total = Number(item.unitPrice || 0) * quantity; window.renderCart(); } catch (error) { console.warn("No se pudo cambiar la cantidad.", error); } };
    window.renderCart = function renderCartWithEditableQuantity() { originalRenderCart.apply(this, arguments); try { const rows = document.querySelectorAll("#cartItems tr"); rows.forEach((row) => { const priceInput = row.querySelector(".price-edit"); const quantityCell = row.children[1]; const deleteCell = row.children[3]; if (!priceInput || !quantityCell) return; const idMatch = String(priceInput.getAttribute("onchange") || "").match(/changePrice\('([^']+)'/); const id = idMatch?.[1]; const quantityText = quantityCell.textContent.trim(); if (id && /^\d+$/.test(quantityText)) quantityCell.innerHTML = `<input class="quantity-edit" type="number" min="1" step="1" value="${quantityText}" onchange="changeQuantity('${id}', this.value)">`; const deleteButton = deleteCell?.querySelector("button"); if (deleteButton && !deleteButton.classList.contains("cart-delete-btn")) { deleteButton.className = "cart-delete-btn"; deleteButton.innerHTML = "&times;"; deleteButton.setAttribute("aria-label", "Quitar producto"); } }); } catch (error) { console.warn("No se pudo mejorar el carrito.", error); } };
    window.renderCart.__quantityPatch = true; window.renderCart();
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
      const sales = readList(SALES_KEY);
      const products = readList(PRODUCTS_KEY);
      const accountEntries = accounts.filter((entry) => entry.customer === customerName);
      const legacySales = sales.filter((sale) => sale.customer === customerName && sale.customerType && sale.customerType !== "normal");
      if (accountEntries.length === 0 && legacySales.length === 0) return;
      const items = [...accountEntries, ...legacySales].flatMap((entry) => entry.items || []).map((item) => {
        const unitPrice = currentPrice(item, products);
        return { ...item, unitPrice, total: unitPrice * Number(item.quantity || 0) };
      });
      const total = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
      const ok = confirm(`Se va a imprimir la cuenta de ${customerName} por ${money(total)} y limpiarla. No se suma a caja.`);
      if (!ok) return;
      printReceipt(customerName, items, total);
      saveList(ACCOUNTS_KEY, accounts.filter((entry) => entry.customer !== customerName));
      saveList(SALES_KEY, sales.filter((sale) => !(sale.customer === customerName && sale.customerType && sale.customerType !== "normal")));
      window.renderNotebook?.(); window.renderClients?.(); window.renderShift?.();
    };

    setTimeout(() => {
      document.querySelectorAll(".account-settle").forEach((button) => {
        if ((button.textContent || "").trim().toLowerCase() === "cobrar cuenta") button.textContent = "Imprimir cuenta";
      });
    }, 100);
  }

  function installLater() { setTimeout(install, 1000); setTimeout(install, 2200); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installLater); else installLater();
})();

(function installArcaPrepPatch() {
  function money(value) { return Number(value || 0).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }); }
  function esc(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
  function kg(value) { const quantity = Number(value || 0); if (quantity < 1) return `${Math.round(quantity * 1000)} g`; return `${quantity.toLocaleString("es-AR", { maximumFractionDigits: 3 })} kg`; }
  function installStyle() {
    if (document.getElementById("arca-prep-style-patch")) return;
    const style = document.createElement("style");
    style.id = "arca-prep-style-patch";
    style.textContent = `.arca-btn{width:100%;border:1px solid #2563eb;background:#eff6ff;color:#1d4ed8;padding:13px;border-radius:12px;font-size:16px;font-weight:800;margin-top:10px;cursor:pointer}.arca-btn:hover{background:#dbeafe}.arca-summary{display:grid;gap:8px;margin:12px 0}.arca-row{display:flex;justify-content:space-between;gap:16px;border-bottom:1px solid #e5e7eb;padding:7px 0}.arca-row span:first-child{color:#475569}.arca-copy{width:100%;min-height:170px;border:1px solid #d1d5db;border-radius:12px;padding:12px;font:14px/1.45 Consolas,monospace;resize:vertical}`;
    document.head.appendChild(style);
  }
  function getTotal() {
    if (typeof getCartTotal === "function") return Number(getCartTotal() || 0);
    try { return (cart || []).reduce((sum, item) => sum + Number(item.total || 0), 0); } catch (error) { return 0; }
  }
  function getItems() {
    try { return Array.isArray(cart) ? cart : []; } catch (error) { return []; }
  }
  function prepData() {
    const items = getItems();
    const total = getTotal();
    const detail = items.map((item) => `${item.name} (${item.weighable ? kg(item.quantity) : `${Number(item.quantity || 0).toLocaleString("es-AR")} un.`})`).join(", ") || "Productos";
    return {
      puntoVenta: "00003",
      comprobante: "Factura B",
      concepto: "Productos",
      receptor: "Consumidor Final",
      condicionVenta: "Contado",
      productoServicio: "Productos",
      detalleInterno: detail,
      cantidad: "1",
      unidadMedida: "unidades",
      precioUnitario: total,
      alicuotaIva: "10,5%",
      total
    };
  }
  function installModal() {
    if (document.getElementById("arcaModal")) return;
    document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop hidden" id="arcaModal"><div class="payment-modal"><div class="modal-head"><h2>Preparar ARCA</h2><button type="button" onclick="closeArcaPrep()">×</button></div><p class="muted">Estos datos son para copiar en RCEL. No se envia nada a ARCA automaticamente.</p><h3 id="arcaTotal">Total: $0</h3><div class="arca-summary" id="arcaSummary"></div><textarea class="arca-copy" id="arcaCopyText" readonly></textarea><button class="confirm-pay" type="button" onclick="copyArcaPrep()">Copiar datos</button></div></div>`);
  }
  function installButton() {
    installStyle(); installModal();
    if (document.getElementById("arcaPrepButton")) return;
    const totalBox = document.querySelector(".total");
    if (!totalBox) return;
    totalBox.insertAdjacentHTML("beforeend", `<button class="arca-btn" id="arcaPrepButton" type="button" onclick="openArcaPrep()">Preparar ARCA</button>`);
  }
  window.openArcaPrep = function openArcaPrep() {
    installButton();
    const data = prepData();
    if (data.total <= 0) { alert("Agrega productos a la venta antes de preparar ARCA."); return; }
    const rows = [
      ["Punto de venta", data.puntoVenta], ["Comprobante", data.comprobante], ["Concepto", data.concepto], ["Receptor", data.receptor],
      ["Condicion de venta", data.condicionVenta], ["Producto/Servicio", data.productoServicio], ["Cantidad", data.cantidad],
      ["Unidad de medida", data.unidadMedida], ["Precio unitario", money(data.precioUnitario)], ["Alicuota IVA", data.alicuotaIva]
    ];
    const summary = document.getElementById("arcaSummary");
    const textarea = document.getElementById("arcaCopyText");
    document.getElementById("arcaTotal").textContent = `Total: ${money(data.total)}`;
    summary.innerHTML = rows.map(([label, value]) => `<div class="arca-row"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join("") + `<div class="arca-row"><span>Detalle interno</span><strong>${esc(data.detalleInterno)}</strong></div>`;
    textarea.value = `Punto de venta: ${data.puntoVenta}\nTipo de comprobante: ${data.comprobante}\nConcepto: ${data.concepto}\nReceptor: ${data.receptor}\nCondicion de venta: ${data.condicionVenta}\nProducto/Servicio: ${data.productoServicio}\nDetalle interno: ${data.detalleInterno}\nCantidad: ${data.cantidad}\nUnidad de medida: ${data.unidadMedida}\nPrecio unitario: ${data.total}\nAlicuota IVA: ${data.alicuotaIva}\nTotal: ${data.total}`;
    document.getElementById("arcaModal").classList.remove("hidden");
  };
  window.closeArcaPrep = function closeArcaPrep() { document.getElementById("arcaModal")?.classList.add("hidden"); };
  window.copyArcaPrep = async function copyArcaPrep() {
    const text = document.getElementById("arcaCopyText")?.value || "";
    if (!text.trim()) return;
    try { await navigator.clipboard.writeText(text); alert("Datos de ARCA copiados."); }
    catch (error) { document.getElementById("arcaCopyText")?.select(); alert("No se pudo copiar automatico. Quedo seleccionado para copiarlo manualmente."); }
  };
  function installLater() { setTimeout(installButton, 900); setTimeout(installButton, 1800); setTimeout(installButton, 2800); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installLater); else installLater();
})();
