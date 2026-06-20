const PASSWORD = "1704";
const STORAGE_KEY = "panaderia_josue_productos_v1";
const WHATSAPP_KEY = "panaderia_josue_whatsapp_v1";
const SALES_KEY = "panaderia_josue_ventas_v1";
const SHIFTS_KEY = "panaderia_josue_turnos_v1";

const suppliers = [
  "Oscar",
  "Baqueano",
  "de Quesos (Leo)",
  "Grupo MAX",
  "Maxi Consumo",
  "Don angel",
  "Golosinas",
  "Serenisima",
  "Pastas",
  "Tapas",
  "Coca Cola",
  "Otro",
];

let products = loadProducts();
let changedProducts = loadWhatsappProducts();
let selectedId = null;
let whatsappClearedAt = 0;

const $ = (id) => document.getElementById(id);

const welcomeView = $("welcomeView");
const adminView = $("adminView");
const adminOpenButton = $("adminOpenButton");
const passwordDialog = $("passwordDialog");
const passwordForm = $("passwordForm");
const passwordInput = $("passwordInput");
const passwordError = $("passwordError");
const cancelPasswordButton = $("cancelPasswordButton");
const confirmDialog = $("confirmDialog");
const productForm = $("productForm");
const productList = $("productList");
const productSearch = $("productSearch");
const productCount = $("productCount");
const supplierInput = $("supplierInput");
const productId = $("productId");
const nameInput = $("nameInput");
const costInput = $("costInput");
const saleInput = $("saleInput");
const barcodeInput = $("barcodeInput");
const stockInput = $("stockInput");
const decreaseStockButton = $("decreaseStockButton");
const increaseStockButton = $("increaseStockButton");
const increaseStockTenButton = $("increaseStockTenButton");
const weighableInput = $("weighableInput");
const formTitle = $("formTitle");
const deleteProductButton = $("deleteProductButton");
const whatsappMessage = $("whatsappMessage");
const adminTitle = $("adminTitle");
const adminProductsView = $("adminProductsView");
const adminReportsView = $("adminReportsView");
const adminReportLocalSelect = $("adminReportLocalSelect");
const adminReportList = $("adminReportList");
const adminStatsControls = $("adminStatsControls");
const adminStatsFromInput = $("adminStatsFromInput");
const adminStatsToInput = $("adminStatsToInput");
const adminStatsSortInput = $("adminStatsSortInput");
const adminStatsProductInput = $("adminStatsProductInput");
const exportProductStatsButton = $("exportProductStatsButton");

function loadProducts() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch (error) {
    console.warn("No se pudo leer productos.", error);
    return [];
  }
}

function saveProducts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  if (typeof saveOnline === "function") saveOnline(STORAGE_KEY, products);
}

function loadWhatsappProducts() {
  try {
    const value = JSON.parse(localStorage.getItem(WHATSAPP_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch (error) {
    console.warn("No se pudo leer el mensaje de WhatsApp.", error);
    return [];
  }
}

function loadList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch (error) {
    console.warn(`No se pudo leer ${key}.`, error);
    return [];
  }
}

function saveWhatsappProducts() {
  localStorage.setItem(WHATSAPP_KEY, JSON.stringify(changedProducts));
  if (typeof saveOnline === "function") saveOnline(WHATSAPP_KEY, changedProducts);
}

function clearWhatsappProducts() {
  whatsappClearedAt = Date.now();
  changedProducts = [];
  localStorage.setItem(WHATSAPP_KEY, "[]");
  if (typeof saveOnline === "function") saveOnline(WHATSAPP_KEY, []);
  renderWhatsappMessage();
}

function showView(view) {
  welcomeView.classList.add("hidden");
  adminView.classList.add("hidden");
  view.classList.remove("hidden");
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

function formatDateOnly(value) {
  if (!value) return "-";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }
  return new Date(value).toLocaleDateString("es-AR");
}

function formatTimeOnly(value) {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function roundSalePrice(value) {
  const raw = Number(value || 0);
  const remainder = raw % 100;
  const base = raw - remainder;
  return remainder >= 50 ? base + 100 : base;
}

function calculateSalePrice() {
  const cost = Number(costInput.value || 0);
  if (cost <= 0) {
    saleInput.value = "";
    return;
  }
  saleInput.value = roundSalePrice(cost * 1.3);
}

function fillSuppliers() {
  supplierInput.innerHTML = suppliers.map((supplier) => `<option value="${supplier}">${supplier}</option>`).join("");
}

function renderProducts() {
  const search = productSearch.value.trim().toLowerCase();
  const filtered = products
    .filter((product) => {
      const text = `${product.name} ${product.barcode || ""} ${product.supplier || ""}`.toLowerCase();
      return text.includes(search);
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  productCount.textContent = `${products.length} producto${products.length === 1 ? "" : "s"}`;

  if (filtered.length === 0) {
    productList.innerHTML = `<p class="muted">No hay productos para mostrar.</p>`;
    return;
  }

  productList.innerHTML = filtered.map((product) => `
    <button class="product-item ${product.id === selectedId ? "active" : ""}" data-id="${product.id}">
      <strong>${escapeHtml(product.name)}</strong>
      <small>Venta: ${formatMoney(product.salePrice)} | Costo: ${formatMoney(product.cost)}</small>
      <small>Stock: ${product.stock || 0} ${product.weighable ? "kg/unidad pesable" : "un."} | ${escapeHtml(product.supplier)}</small>
      <small>Codigo: ${escapeHtml(product.barcode || "Sin codigo")}</small>
    </button>
  `).join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resetForm() {
  selectedId = null;
  productForm.reset();
  productId.value = "";
  stockInput.value = 0;
  supplierInput.value = "Oscar";
  formTitle.textContent = "Anadir producto";
  deleteProductButton.classList.add("hidden");
  renderProducts();
  nameInput.focus();
}

function selectProduct(id) {
  const product = products.find((item) => item.id === id);
  if (!product) return;

  selectedId = id;
  productId.value = product.id;
  nameInput.value = product.name;
  costInput.value = product.cost;
  saleInput.value = product.salePrice;
  barcodeInput.value = product.barcode || "";
  stockInput.value = product.stock || 0;
  supplierInput.value = product.supplier || "Otro";
  weighableInput.checked = Boolean(product.weighable);
  formTitle.textContent = "Modificar producto";
  deleteProductButton.classList.remove("hidden");
  renderProducts();
}

function getFormProduct() {
  const cost = Number(costInput.value || 0);
  let salePrice = Number(saleInput.value || 0);

  if (salePrice <= 0 && cost > 0) {
    salePrice = roundSalePrice(cost * 1.3);
    saleInput.value = salePrice;
  }

  return {
    id: productId.value || crypto.randomUUID(),
    name: nameInput.value.trim(),
    cost,
    salePrice,
    barcode: barcodeInput.value.trim(),
    stock: Number(stockInput.value || 0),
    supplier: supplierInput.value,
    weighable: weighableInput.checked,
    updatedAt: new Date().toISOString(),
  };
}

function adjustStock(amount) {
  const current = Number(stockInput.value || 0);
  const next = Math.max(0, current + amount);
  stockInput.value = Number(next.toFixed(2));
}

function confirmSave() {
  return new Promise((resolve) => {
    confirmDialog.showModal();
    confirmDialog.addEventListener("close", () => {
      resolve(confirmDialog.returnValue === "yes");
    }, { once: true });
  });
}

function addToWhatsapp(product) {
  changedProducts = changedProducts.filter((item) => item.id !== product.id);
  changedProducts.push({ id: product.id, name: product.name, salePrice: product.salePrice });
  saveWhatsappProducts();
  renderWhatsappMessage();
}

function renderWhatsappMessage() {
  if (changedProducts.length === 0) {
    whatsappMessage.value = "";
    return;
  }

  whatsappMessage.value = changedProducts
    .map((product) => `${product.name}---$${Number(product.salePrice).toLocaleString("es-AR")}`)
    .join("\n");
}

function showAdminProducts() {
  adminTitle.textContent = "Productos";
  adminProductsView.classList.remove("hidden");
  adminReportsView.classList.add("hidden");
}

function showAdminReports() {
  adminTitle.textContent = "Reportes";
  adminProductsView.classList.add("hidden");
  adminReportsView.classList.remove("hidden");
  renderAdminReports();
}

function getShiftSummary(shift, sales) {
  const shiftSales = sales.filter((sale) => sale.shiftId === shift.id);
  const expenses = normalizeShiftMovements(shift.expenses);
  const reinforcements = normalizeShiftMovements(shift.reinforcements);
  const totalSales = shiftSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const cashSales = shiftSales.reduce((sum, sale) => sum + getSaleCashNet(sale), 0);
  const digitalSales = shiftSales.reduce((sum, sale) => sum + getSaleDigitalNet(sale), 0);
  const expenseTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const reinforcementTotal = reinforcements.reduce((sum, reinforcement) => sum + Number(reinforcement.amount || 0), 0);
  const expectedCash = Number(shift.initialCash || 0) + cashSales + reinforcementTotal - expenseTotal;
  return { shiftSales, totalSales, cashSales, digitalSales, expenseTotal, reinforcementTotal, expectedCash };
}

function normalizeShiftMovements(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === "object") return Object.values(value).filter(Boolean);
  return [];
}

function normalizePaymentMethod(sale) {
  return String(sale?.method || "").toLowerCase();
}

function getSaleCashNet(sale) {
  const method = normalizePaymentMethod(sale);
  const total = Number(sale.total || 0);
  const cash = Number(sale.cash || 0);
  const change = Number(sale.change || 0);

  if (method === "efectivo") return total;
  if (method === "transferencia" || method === "digital") return 0;
  if (method === "mixto") return Math.max(0, cash - change);
  if (method === "familia" || method === "cuenta corriente") return 0;

  return cash > 0 ? Math.max(0, cash - change) : 0;
}

function getSaleDigitalNet(sale) {
  const method = normalizePaymentMethod(sale);
  const total = Number(sale.total || 0);
  const transfer = Number(sale.transfer || 0);

  if (method === "transferencia" || method === "digital") return total;
  if (method === "efectivo") return 0;
  if (method === "mixto") return Math.min(total, transfer);
  if (method === "familia" || method === "cuenta corriente") return 0;

  return transfer > 0 ? transfer : 0;
}

function renderAdminReports() {
  const selectedLocal = adminReportLocalSelect.value;
  if (selectedLocal === "Estadisticas") {
    renderAdminStatistics();
    return;
  }
  if (selectedLocal === "Gastos") {
    renderAdminExpenses();
    return;
  }

  adminStatsControls.classList.add("hidden");
  const sales = loadList(SALES_KEY);
  const shifts = loadList(SHIFTS_KEY);
  const closedShifts = shifts
    .filter((shift) => shift.local === selectedLocal && shift.status === "closed")
    .sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt));

  if (closedShifts.length === 0) {
    adminReportList.innerHTML = `<p class="muted">Todavia no hay turnos cerrados para ${selectedLocal}.</p>`;
    return;
  }

  adminReportList.innerHTML = closedShifts.map((shift) => {
    const summary = getShiftSummary(shift, sales);
    const difference = Number(shift.countedCash || 0) - summary.expectedCash;
    const reportTitle = `${formatDateOnly(shift.openedAt)} - ${formatTimeOnly(shift.openedAt)} h`;
    const reportSubtitle = `Hasta ${formatTimeOnly(shift.closedAt)} h - ${summary.shiftSales.length} venta${summary.shiftSales.length === 1 ? "" : "s"}`;
    const detail = summary.shiftSales.map((sale) => {
      const items = sale.items.map((item) => item.name).join(", ");
      return `<li>Venta ${sale.saleNumber || "-"}: ${escapeHtml(items)} - ${formatMoney(sale.total)} - ${escapeHtml(sale.method)}</li>`;
    }).join("");

    return `
      <details class="report-card">
        <summary class="report-summary">
          <span>
            <strong>${escapeHtml(selectedLocal)}</strong>
            <small>${escapeHtml(reportTitle)} - ${escapeHtml(reportSubtitle)}</small>
          </span>
          <span class="report-summary-total">
            ${formatMoney(summary.totalSales)}
            <span class="report-arrow">&gt;</span>
          </span>
        </summary>
        <div class="report-body">
          <p class="muted">Fecha ${formatDateOnly(shift.openedAt)} - Desde ${formatTimeOnly(shift.openedAt)} h hasta ${formatTimeOnly(shift.closedAt)} h</p>
          <div class="report-row"><span>Total vendido</span><strong>${formatMoney(summary.totalSales)}</strong></div>
          <div class="report-row"><span>Efectivo</span><strong>${formatMoney(summary.cashSales)}</strong></div>
          <div class="report-row"><span>Digital</span><strong>${formatMoney(summary.digitalSales)}</strong></div>
          <div class="report-row"><span>Gastos</span><strong>${formatMoney(summary.expenseTotal)}</strong></div>
          <div class="report-row"><span>Refuerzos</span><strong>${formatMoney(summary.reinforcementTotal)}</strong></div>
          <div class="report-row"><span>Cierre de caja teorico</span><strong>${formatMoney(summary.expectedCash)}</strong></div>
          <div class="report-row"><span>Cerro realmente con</span><strong>${formatMoney(shift.countedCash)}</strong></div>
          <div class="report-row"><span>Diferencia</span><strong>${formatMoney(difference)}</strong></div>
          <div class="report-detail">
            <strong>Detalle</strong>
            <ul>${detail || "<li>Sin ventas en este turno.</li>"}</ul>
          </div>
        </div>
      </details>
    `;
  }).join("");
}

function renderAdminExpenses() {
  adminStatsControls.classList.add("hidden");
  const shifts = loadList(SHIFTS_KEY);
  const shiftsWithExpenses = shifts
    .filter((shift) => normalizeShiftMovements(shift.expenses).length > 0)
    .sort((a, b) => new Date(b.closedAt || b.openedAt) - new Date(a.closedAt || a.openedAt));

  if (shiftsWithExpenses.length === 0) {
    adminReportList.innerHTML = "<p class='muted'>Todavia no hay gastos guardados.</p>";
    return;
  }

  const totalExpenses = shiftsWithExpenses.reduce((sum, shift) => {
    return sum + normalizeShiftMovements(shift.expenses).reduce((subtotal, expense) => subtotal + Number(expense.amount || 0), 0);
  }, 0);

  adminReportList.innerHTML = `
    <div class="stats-period">
      <strong>Total de gastos</strong>
      <span>${shiftsWithExpenses.length} turno${shiftsWithExpenses.length === 1 ? "" : "s"} con gastos</span>
      <span>${formatMoney(totalExpenses)}</span>
    </div>
    ${shiftsWithExpenses.map((shift) => {
      const expenses = normalizeShiftMovements(shift.expenses);
      const shiftTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
      const detail = expenses.map((expense) => `
        <li>
          ${formatTimeOnly(expense.date || shift.closedAt || shift.openedAt)} h -
          ${escapeHtml(expense.description || "Gasto")} -
          ${formatMoney(expense.amount)}
        </li>
      `).join("");

      return `
        <details class="report-card">
          <summary class="report-summary">
            <span>
              <strong>${escapeHtml(shift.local || "Local")} - ${shift.status === "closed" ? "Cerrado" : "Abierto"}</strong>
              <small>${formatDateOnly(shift.closedAt || shift.openedAt)} - ${shift.status === "closed" ? "Cierre" : "Abierto"} ${formatTimeOnly(shift.closedAt || shift.openedAt)} h</small>
            </span>
            <span class="report-summary-total">
              ${formatMoney(shiftTotal)}
              <span class="report-arrow">&gt;</span>
            </span>
          </summary>
          <div class="report-body">
            <p class="muted">Turno desde ${formatTimeOnly(shift.openedAt)} h${shift.closedAt ? ` hasta ${formatTimeOnly(shift.closedAt)} h` : " - todavia abierto"}</p>
            <div class="report-row"><span>Cantidad de gastos</span><strong>${expenses.length}</strong></div>
            <div class="report-row"><span>Total gastado</span><strong>${formatMoney(shiftTotal)}</strong></div>
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

function dateInputValue(value) {
  const date = value ? new Date(value) : new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function ensureStatsDates() {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  if (!adminStatsFromInput.value) adminStatsFromInput.value = dateInputValue(monthStart);
  if (!adminStatsToInput.value) adminStatsToInput.value = dateInputValue(today);
}

function getStatsRange() {
  ensureStatsDates();
  const from = new Date(`${adminStatsFromInput.value}T00:00:00`);
  const to = new Date(`${adminStatsToInput.value}T23:59:59`);
  return { from, to };
}

function formatStatsQuantity(value, weighable) {
  const quantity = Number(value || 0);
  if (!weighable) return `${quantity.toLocaleString("es-AR")} un.`;
  if (quantity < 1) return `${Math.round(quantity * 1000).toLocaleString("es-AR")} g`;
  return `${quantity.toLocaleString("es-AR", { maximumFractionDigits: 3 })} kg`;
}

function getProductStatKey(item, product) {
  return product?.id || item.productId || `name:${item.name || "Producto"}`;
}

function buildProductStats(sales) {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const groups = {
    weighable: new Map(),
    unit: new Map(),
  };

  sales.forEach((sale) => {
    (sale.items || []).forEach((item) => {
      const product = productsById.get(item.productId);
      const isWeighable = Boolean(item.weighable || product?.weighable);
      const target = isWeighable ? groups.weighable : groups.unit;
      const key = getProductStatKey(item, product);
      const current = target.get(key) || {
        key,
        name: item.name || product?.name || "Producto",
        quantity: 0,
        revenue: 0,
        saleCount: 0,
        weighable: isWeighable,
      };

      current.quantity += Number(item.quantity || 0);
      current.revenue += Number(item.total || 0);
      current.saleCount += 1;
      target.set(key, current);
    });
  });

  const sortBy = adminStatsSortInput.value;
  const sorter = (a, b) => sortBy === "revenue"
    ? b.revenue - a.revenue
    : b.quantity - a.quantity;

  return {
    weighable: Array.from(groups.weighable.values()).sort(sorter),
    unit: Array.from(groups.unit.values()).sort(sorter),
  };
}

function populateStatsProductSelect(stats) {
  const previousValue = adminStatsProductInput.value;
  const items = [...stats.weighable, ...stats.unit]
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  adminStatsProductInput.innerHTML = `
    <option value="">Elegir producto</option>
    ${items.map((item) => `
      <option value="${escapeHtml(item.key)}">${escapeHtml(item.name)}</option>
    `).join("")}
  `;

  if (items.some((item) => item.key === previousValue)) {
    adminStatsProductInput.value = previousValue;
  }
}

function buildSelectedProductDailyStats(sales, productKey) {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const days = new Map();
  let productName = "";
  let weighable = false;

  sales.forEach((sale) => {
    const dateKey = dateInputValue(sale.date);
    (sale.items || []).forEach((item) => {
      const product = productsById.get(item.productId);
      const key = getProductStatKey(item, product);
      if (key !== productKey) return;

      productName = item.name || product?.name || productName || "Producto";
      weighable = Boolean(item.weighable || product?.weighable);
      const current = days.get(dateKey) || {
        date: dateKey,
        quantity: 0,
        revenue: 0,
        saleCount: 0,
      };

      current.quantity += Number(item.quantity || 0);
      current.revenue += Number(item.total || 0);
      current.saleCount += 1;
      days.set(dateKey, current);
    });
  });

  const rows = Array.from(days.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const totalSales = rows.reduce((sum, row) => sum + row.saleCount, 0);

  return { productName, weighable, rows, totalQuantity, totalRevenue, totalSales };
}

function renderSelectedProductStats(productStats) {
  if (!adminStatsProductInput.value) return "";
  if (productStats.rows.length === 0) {
    return `
      <details class="report-card stats-card" open>
        <summary class="report-summary">
          <span>
            <strong>Producto seleccionado</strong>
            <small>Sin ventas en este periodo</small>
          </span>
          <span class="report-summary-total">
            -
            <span class="report-arrow">&gt;</span>
          </span>
        </summary>
        <div class="report-body">
          <p class="muted">No hay datos para exportar con ese producto y esas fechas.</p>
        </div>
      </details>
    `;
  }

  const rows = productStats.rows.map((row) => `
    <div class="stats-row">
      <span>${formatDateOnly(row.date)}</span>
      <strong>${formatStatsQuantity(row.quantity, productStats.weighable)}</strong>
      <strong>${formatMoney(row.revenue)}</strong>
    </div>
  `).join("");

  return `
    <details class="report-card stats-card" open>
      <summary class="report-summary">
        <span>
          <strong>Estadistica por producto</strong>
          <small>${escapeHtml(productStats.productName)}</small>
        </span>
        <span class="report-summary-total">
          ${formatStatsQuantity(productStats.totalQuantity, productStats.weighable)}
          <span class="report-arrow">&gt;</span>
        </span>
      </summary>
      <div class="report-body">
        <div class="stats-heading">
          <span>Dia</span>
          <span>Cantidad</span>
          <span>Ingreso</span>
        </div>
        ${rows}
        <div class="stats-row stats-total-row">
          <span>Total</span>
          <strong>${formatStatsQuantity(productStats.totalQuantity, productStats.weighable)}</strong>
          <strong>${formatMoney(productStats.totalRevenue)}</strong>
        </div>
      </div>
    </details>
  `;
}

function exportSelectedProductStatsPdf() {
  const productKey = adminStatsProductInput.value;
  if (!productKey) {
    alert("Elegi un producto para exportar.");
    return;
  }

  const { from, to } = getStatsRange();
  const sales = loadList(SALES_KEY).filter((sale) => {
    const date = new Date(sale.date);
    return date >= from && date <= to;
  });
  const productStats = buildSelectedProductDailyStats(sales, productKey);

  if (productStats.rows.length === 0) {
    alert("No hay ventas de ese producto en el periodo elegido.");
    return;
  }

  const rows = productStats.rows.map((row) => `
    <tr>
      <td>${formatDateOnly(row.date)}</td>
      <td>${formatStatsQuantity(row.quantity, productStats.weighable)}</td>
      <td>${row.saleCount}</td>
      <td>${formatMoney(row.revenue)}</td>
    </tr>
  `).join("");

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("El navegador bloqueo la ventana del PDF. Permitila y volve a intentar.");
    return;
  }

  printWindow.document.write(`
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>Estadistica ${escapeHtml(productStats.productName)}</title>
      <style>
        body { font-family: Arial, sans-serif; color: #111827; margin: 32px; }
        h1 { margin: 0 0 8px; font-size: 28px; }
        p { margin: 0 0 18px; color: #4b5563; }
        table { width: 100%; border-collapse: collapse; margin-top: 18px; }
        th, td { border-bottom: 1px solid #d1d5db; padding: 10px; text-align: left; }
        th { background: #f3f4f6; }
        td:nth-child(2), td:nth-child(3), td:nth-child(4),
        th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: right; }
        tfoot td { font-weight: 800; }
      </style>
    </head>
    <body>
      <h1>Estadistica de producto</h1>
      <p>
        Producto: <strong>${escapeHtml(productStats.productName)}</strong><br>
        Periodo: ${formatDateOnly(from)} al ${formatDateOnly(to)}
      </p>
      <table>
        <thead>
          <tr>
            <th>Dia</th>
            <th>Cantidad</th>
            <th>Ventas</th>
            <th>Ingreso</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td>${formatStatsQuantity(productStats.totalQuantity, productStats.weighable)}</td>
            <td>${productStats.totalSales}</td>
            <td>${formatMoney(productStats.totalRevenue)}</td>
          </tr>
        </tfoot>
      </table>
      <script>
        window.onload = () => {
          window.print();
        };
      <\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

function renderStatsCard(title, items, weighable) {
  const best = items[0];
  const rows = items.map((item, index) => `
    <div class="stats-row">
      <span>${index + 1}. ${escapeHtml(item.name)}</span>
      <strong>${formatStatsQuantity(item.quantity, weighable)}</strong>
      <strong>${formatMoney(item.revenue)}</strong>
    </div>
  `).join("");

  return `
    <details class="report-card stats-card">
      <summary class="report-summary">
        <span>
          <strong>${title}</strong>
          <small>${best ? escapeHtml(best.name) : "Sin ventas en este rango"}</small>
        </span>
        <span class="report-summary-total">
          ${best ? formatStatsQuantity(best.quantity, weighable) : "-"}
          <span class="report-arrow">&gt;</span>
        </span>
      </summary>
      <div class="report-body">
        <div class="stats-heading">
          <span>Producto</span>
          <span>Cantidad</span>
          <span>Ingreso</span>
        </div>
        ${rows || "<p class='muted'>No hay productos para mostrar.</p>"}
      </div>
    </details>
  `;
}

function renderAdminStatistics() {
  adminStatsControls.classList.remove("hidden");
  const { from, to } = getStatsRange();
  const sales = loadList(SALES_KEY).filter((sale) => {
    const date = new Date(sale.date);
    return date >= from && date <= to;
  });
  const stats = buildProductStats(sales);
  populateStatsProductSelect(stats);
  const selectedProductStats = adminStatsProductInput.value
    ? buildSelectedProductDailyStats(sales, adminStatsProductInput.value)
    : null;
  const totalSales = sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);

  adminReportList.innerHTML = `
    <div class="stats-period">
      <strong>Periodo</strong>
      <span>${formatDateOnly(from)} al ${formatDateOnly(to)}</span>
      <span>${sales.length} venta${sales.length === 1 ? "" : "s"} - ${formatMoney(totalSales)}</span>
    </div>
    ${renderStatsCard("Mejor producto pesable", stats.weighable, true)}
    ${renderStatsCard("Mejor producto por unidad", stats.unit, false)}
    ${selectedProductStats ? renderSelectedProductStats(selectedProductStats) : ""}
  `;
}

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const product = getFormProduct();

  if (!product.name) {
    alert("Falta el nombre del producto.");
    return;
  }

  if (product.salePrice <= 0 || Number.isNaN(product.salePrice)) {
    alert("Revisa el precio de venta. Tiene que ser mayor a 0.");
    saleInput.focus();
    return;
  }

  if (product.cost < 0 || Number.isNaN(product.cost)) {
    alert("Revisa el precio de compra. No puede ser negativo.");
    costInput.focus();
    return;
  }

  const repeatedBarcode = product.barcode && products.find((item) => item.id !== product.id && item.barcode === product.barcode);
  if (repeatedBarcode) {
    alert(`Ese codigo de barra ya lo tiene ${repeatedBarcode.name}.`);
    barcodeInput.focus();
    return;
  }

  const ok = await confirmSave();
  if (!ok) return;

  const index = products.findIndex((item) => item.id === product.id);
  if (index >= 0) {
    products[index] = product;
  } else {
    products.push(product);
  }

  saveProducts();
  addToWhatsapp(product);
  selectedId = product.id;
  renderProducts();
  selectProduct(product.id);
  alert("Producto guardado.");
});

productList.addEventListener("click", (event) => {
  const button = event.target.closest(".product-item");
  if (!button) return;
  selectProduct(button.dataset.id);
});

productSearch.addEventListener("input", renderProducts);
costInput.addEventListener("input", calculateSalePrice);
decreaseStockButton.addEventListener("click", () => adjustStock(-1));
increaseStockButton.addEventListener("click", () => adjustStock(1));
increaseStockTenButton.addEventListener("click", () => adjustStock(10));
$("newProductButton").addEventListener("click", resetForm);
$("clearFormButton").addEventListener("click", resetForm);

$("copyWhatsappButton").addEventListener("click", async () => {
  if (!whatsappMessage.value.trim()) {
    alert("No hay mensaje para copiar todavia.");
    return;
  }
  await navigator.clipboard.writeText(whatsappMessage.value);
  alert("Mensaje copiado para WhatsApp.");
});

const clearWhatsappButton = $("clearWhatsappButton");
if (clearWhatsappButton) {
  clearWhatsappButton.addEventListener("click", () => {
    const ok = confirm("Seguro que queres limpiar el mensaje de WhatsApp?");
    if (!ok) return;
    clearWhatsappProducts();
  });
}

deleteProductButton.addEventListener("click", () => {
  if (!selectedId) return;
  const product = products.find((item) => item.id === selectedId);
  const ok = confirm(`Seguro que queres borrar ${product?.name || "este producto"}?`);
  if (!ok) return;

  products = products.filter((item) => item.id !== selectedId);
  changedProducts = changedProducts.filter((item) => item.id !== selectedId);
  saveProducts();
  saveWhatsappProducts();
  renderWhatsappMessage();
  resetForm();
});

adminOpenButton.addEventListener("click", () => {
  passwordInput.value = "";
  passwordError.classList.add("hidden");
  passwordDialog.showModal();
  setTimeout(() => passwordInput.focus(), 100);
});

passwordForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (passwordInput.value === PASSWORD) {
    passwordDialog.close();
    showView(adminView);
    showAdminProducts();
    renderProducts();
    renderWhatsappMessage();
  } else {
    passwordError.classList.remove("hidden");
    passwordInput.select();
  }
});

cancelPasswordButton.addEventListener("click", () => passwordDialog.close());
$("backHomeFromAdmin").addEventListener("click", () => showView(welcomeView));
$("adminProductsButton").addEventListener("click", showAdminProducts);
$("adminReportsButton").addEventListener("click", showAdminReports);
adminReportLocalSelect.addEventListener("change", renderAdminReports);
adminStatsFromInput.addEventListener("change", renderAdminReports);
adminStatsToInput.addEventListener("change", renderAdminReports);
adminStatsSortInput.addEventListener("change", renderAdminReports);
adminStatsProductInput.addEventListener("change", renderAdminReports);
exportProductStatsButton.addEventListener("click", exportSelectedProductStatsPdf);

if (typeof listenOnline === "function") {
  listenOnline(STORAGE_KEY, (data) => {
    if (!Array.isArray(data)) return;
    products = data;
    renderProducts();
    if (!adminProductsView.classList.contains("hidden")) renderProducts();
    if (!adminReportsView.classList.contains("hidden")) renderAdminReports();
  });

  listenOnline(WHATSAPP_KEY, (data) => {
    if (!Array.isArray(data)) return;
    if (whatsappClearedAt && Date.now() - whatsappClearedAt < 4000 && data.length > 0) return;
    changedProducts = data;
    renderWhatsappMessage();
  });

  listenOnline(SALES_KEY, (data) => {
    if (!Array.isArray(data)) return;
    localStorage.setItem(SALES_KEY, JSON.stringify(data));
    if (!adminReportsView.classList.contains("hidden")) renderAdminReports();
  });

  listenOnline(SHIFTS_KEY, (data) => {
    if (!Array.isArray(data)) return;
    localStorage.setItem(SHIFTS_KEY, JSON.stringify(data));
    if (!adminReportsView.classList.contains("hidden")) renderAdminReports();
  });
}

document.querySelectorAll("[data-open-sales]").forEach((button) => {
  button.addEventListener("click", () => {
    const local = button.dataset.openSales;
    window.location.href = `ventas.html?local=${encodeURIComponent(local)}`;
  });
});

fillSuppliers();
renderProducts();
renderWhatsappMessage();
