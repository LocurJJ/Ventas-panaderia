(function () {
  const PRODUCTS_KEY = "panaderia_josue_productos_v1";
  const SALES_KEY = "panaderia_josue_ventas_v1";
  const SETTINGS_KEY = "panaderia_josue_compra_config_v1";
  const ORDER_KEY = "panaderia_josue_lista_compra_v1";
  const OWN_PRODUCTION_SUPPLIER = "elaboracion propia";
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
    OWN_PRODUCTION_SUPPLIER,
    "Otro",
  ];

  const state = {
    products: [],
    sales: [],
    settings: {},
    order: [],
  };

  const $ = (id) => document.getElementById(id);

  function readList(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (error) {
      console.warn("No se pudo leer", key, error);
      return [];
    }
  }

  function readObject(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "{}");
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch (error) {
      console.warn("No se pudo leer", key, error);
      return {};
    }
  }

  function saveData(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    if (typeof window.saveOnline === "function") window.saveOnline(key, value);
  }

  function saveProducts() {
    saveData(PRODUCTS_KEY, state.products);
  }

  function loadData() {
    state.products = readList(PRODUCTS_KEY);
    state.sales = readList(SALES_KEY);
    state.settings = readObject(SETTINGS_KEY);
    state.order = readList(ORDER_KEY);
  }

  function hideMainViews() {
    ["welcomeView", "adminView", "purchaseView", "purchaseListView"].forEach((id) => {
      const view = $(id);
      if (view) view.classList.add("hidden");
    });
  }

  function showPurchaseView() {
    loadData();
    hideMainViews();
    $("purchaseView")?.classList.remove("hidden");
    renderPurchaseProducts();
  }

  function showPurchaseListView() {
    loadData();
    hideMainViews();
    $("purchaseListView")?.classList.remove("hidden");
    renderPurchaseOrder();
  }

  function showHomeView() {
    hideMainViews();
    $("welcomeView")?.classList.remove("hidden");
  }

  function formatMoney(value) {
    return Number(value || 0).toLocaleString("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    });
  }

  function formatQty(value, weighable) {
    const number = Number(value || 0);
    const text = number.toLocaleString("es-AR", {
      maximumFractionDigits: weighable ? 3 : 0,
    });
    return `${text}${weighable ? " kg" : " un."}`;
  }

  function dayKey(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  }

  function itemProductId(item) {
    return String(item.productId || item.id || "");
  }

  function buildStats() {
    const byProduct = new Map();

    state.sales.forEach((sale) => {
      const dateKey = dayKey(sale.date || sale.createdAt);
      (sale.items || []).forEach((item) => {
        const id = itemProductId(item);
        if (!id) return;

        if (!byProduct.has(id)) {
          byProduct.set(id, {
            total: 0,
            revenue: 0,
            frequency: 0,
            days: new Map(),
          });
        }

        const quantity = Number(item.quantity || item.qty || 0);
        const total = Number(item.total || 0);
        const stats = byProduct.get(id);
        stats.total += quantity;
        stats.revenue += total;
        stats.frequency += 1;
        stats.days.set(dateKey, Number(stats.days.get(dateKey) || 0) + quantity);
      });
    });

    return byProduct;
  }

  function summarizeProduct(product, statsByProduct) {
    const settings = state.settings[product.id] || {};
    const stats = statsByProduct.get(String(product.id)) || {
      total: 0,
      revenue: 0,
      frequency: 0,
      days: new Map(),
    };
    const dailyValues = Array.from(stats.days.values());
    const min = dailyValues.length ? Math.min(...dailyValues) : 0;
    const max = dailyValues.length ? Math.max(...dailyValues) : 0;
    const average = dailyValues.length
      ? stats.total / dailyValues.length
      : 0;
    const variance = dailyValues.length
      ? dailyValues.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / dailyValues.length
      : 0;
    const deviation = Math.sqrt(variance);
    const leadTime = Number(settings.leadTime || 1);
    const packSize = Number(settings.packSize || defaultPackSize(product));
    const stock = Number(product.stock || 0);
    const target = Math.max(max, average * (leadTime + 3));
    const suggestedUnits = Math.max(0, target - stock);
    const suggestedPacks = suggestedUnits > 0 ? Math.ceil(suggestedUnits / Math.max(1, packSize)) : 0;

    return {
      product,
      total: stats.total,
      revenue: stats.revenue,
      min,
      max,
      range: max - min,
      average,
      deviation,
      frequency: stats.frequency,
      leadTime,
      packSize,
      stock,
      suggestedPacks,
      suggestedUnits: suggestedPacks * packSize,
    };
  }

  function defaultPackSize(product) {
    const name = String(product.name || "").toLowerCase();
    if (name.includes("leche") || name.includes("yogur") || name.includes("baggio")) return 12;
    if (name.includes("gaseosa") || name.includes("manaos") || name.includes("coca")) return 6;
    return 1;
  }

  function updateSetting(productId, field, value) {
    const current = state.settings[productId] || {};
    state.settings[productId] = {
      ...current,
      [field]: Math.max(1, Number(value || 1)),
    };
    saveData(SETTINGS_KEY, state.settings);
    renderPurchaseProducts();
  }

  function updateProductField(productId, field, value) {
    const product = state.products.find((item) => String(item.id) === String(productId));
    if (!product) return;

    if (field === "stock") {
      product.stock = Number(value || 0);
    } else if (field === "supplier") {
      product.supplier = value || "Otro";
    }

    product.updatedAt = new Date().toISOString();
    saveProducts();
    renderPurchaseProducts();
  }

  function addToOrder(productId, packs) {
    loadData();
    const statsByProduct = buildStats();
    const product = state.products.find((item) => String(item.id) === String(productId));
    if (!product) return;

    const summary = summarizeProduct(product, statsByProduct);
    const packCount = Math.max(1, Number(packs || summary.suggestedPacks || 1));
    const existingIndex = state.order.findIndex((item) => String(item.productId) === String(productId));
    const orderItem = {
      id: `${productId}-${Date.now()}`,
      productId,
      name: product.name,
      supplier: product.supplier || "Otro",
      packSize: summary.packSize,
      leadTime: summary.leadTime,
      packs: packCount,
      units: packCount * summary.packSize,
      stock: summary.stock,
      status: "pendiente",
      createdAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      state.order[existingIndex] = {
        ...state.order[existingIndex],
        ...orderItem,
        id: state.order[existingIndex].id,
      };
    } else {
      state.order.push(orderItem);
    }

    saveData(ORDER_KEY, state.order);
    renderPurchaseProducts();
    alert("Producto agregado a la lista de compra.");
  }

  function removeOrderItem(id) {
    state.order = state.order.filter((item) => item.id !== id);
    saveData(ORDER_KEY, state.order);
    renderPurchaseOrder();
  }

  function confirmOrderItem(id, receivedUnits) {
    loadData();

    const orderIndex = state.order.findIndex((item) => String(item.id) === String(id));
    if (orderIndex < 0) return;

    const orderItem = state.order[orderIndex];
    const quantity = Number(receivedUnits || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      alert("Carga la cantidad que se compro antes de confirmar.");
      return;
    }

    const product = state.products.find((item) => String(item.id) === String(orderItem.productId));
    if (!product) {
      alert("No encontre el producto para actualizar el stock.");
      return;
    }

    const currentStock = Number(product.stock || 0);
    product.stock = currentStock + quantity;
    product.updatedAt = new Date().toISOString();
    saveProducts();

    const requestedUnits = Number(orderItem.units || 0);
    const remainingUnits = Math.max(0, requestedUnits - quantity);
    if (remainingUnits > 0) {
      const packSize = Math.max(1, Number(orderItem.packSize || 1));
      state.order[orderIndex] = {
        ...orderItem,
        units: remainingUnits,
        packs: Math.ceil(remainingUnits / packSize),
        stock: product.stock,
        updatedAt: new Date().toISOString(),
      };
    } else {
      state.order.splice(orderIndex, 1);
    }

    saveData(ORDER_KEY, state.order);
    renderPurchaseOrder();
    alert("Compra confirmada y stock actualizado.");
  }

  function clearOrder() {
    if (!state.order.length) return;
    if (!confirm("Seguro que queres limpiar la lista de compra?")) return;
    state.order = [];
    saveData(ORDER_KEY, state.order);
    renderPurchaseOrder();
  }

  function renderPurchaseProducts() {
    const list = $("purchaseProductList");
    if (!list) return;

    const search = String($("purchaseSearchInput")?.value || "").trim().toLowerCase();
    const sort = $("purchaseSortInput")?.value || "suggested";
    const statsByProduct = buildStats();
    const rows = state.products
      .map((product) => summarizeProduct(product, statsByProduct))
      .filter((summary) => String(summary.product.supplier || "").toLowerCase() !== OWN_PRODUCTION_SUPPLIER)
      .filter((summary) => {
        const text = `${summary.product.name || ""} ${summary.product.supplier || ""}`.toLowerCase();
        return text.includes(search);
      })
      .sort((a, b) => {
        if (sort === "average") return b.average - a.average;
        if (sort === "stock") return a.stock - b.stock;
        if (sort === "name") return String(a.product.name || "").localeCompare(String(b.product.name || ""));
        return b.suggestedUnits - a.suggestedUnits;
      });

    if (!rows.length) {
      list.innerHTML = `<tr><td colspan="10">No hay productos para mostrar.</td></tr>`;
      return;
    }

    list.innerHTML = rows.map((row) => {
      const id = String(row.product.id);
      const packsValue = row.suggestedPacks || 1;
      const suggestion = row.suggestedPacks
        ? `${row.suggestedPacks} pack${row.suggestedPacks === 1 ? "" : "s"} (${formatQty(row.suggestedUnits, row.product.weighable)})`
        : "Sin compra";

      return `
        <tr>
          <td class="purchase-product-name">${escapeHtml(row.product.name)}</td>
          <td>
            <input class="purchase-small-input" type="number" step="0.01" value="${row.stock}" data-product-id="${id}" data-product-field="stock">
          </td>
          <td class="purchase-number">${formatQty(row.total, row.product.weighable)}</td>
          <td class="purchase-number">${formatQty(row.min, row.product.weighable)}</td>
          <td class="purchase-number">${formatQty(row.max, row.product.weighable)}</td>
          <td class="purchase-number">${formatQty(row.average, row.product.weighable)}</td>
          <td>
            <select class="purchase-supplier-select" data-product-id="${id}" data-product-field="supplier">
              ${supplierOptions(row.product.supplier)}
            </select>
          </td>
          <td><input class="purchase-small-input" type="number" min="1" value="${row.leadTime}" data-setting-id="${id}" data-setting-field="leadTime"></td>
          <td><input class="purchase-small-input" type="number" min="1" value="${row.packSize}" data-setting-id="${id}" data-setting-field="packSize"></td>
          <td>
            <input class="purchase-small-input" type="number" min="1" value="${packsValue}" data-pack-id="${id}">
            <button class="purchase-add-button" type="button" data-add-id="${id}">Anadir</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  function renderPurchaseOrder() {
    const list = $("purchaseOrderList");
    if (!list) return;

    if (!state.order.length) {
      list.innerHTML = `<p class="muted">Todavia no agregaste productos a la lista.</p>`;
      return;
    }

    const groups = state.order.reduce((acc, item) => {
      const supplier = item.supplier || "Otro";
      if (!acc[supplier]) acc[supplier] = [];
      acc[supplier].push(item);
      return acc;
    }, {});

    list.innerHTML = Object.entries(groups).map(([supplier, items]) => `
      <section class="purchase-supplier-group">
        <h3>${escapeHtml(supplier)}</h3>
        ${items.map((item) => `
          <article class="purchase-order-item">
            <div>
              <strong>${escapeHtml(item.name)}</strong>
              <span class="purchase-order-meta">
                ${item.packs} pack${Number(item.packs) === 1 ? "" : "s"} x ${item.packSize} = ${item.units} unidades | Stock al pedir: ${item.stock}
              </span>
            </div>
            <label class="purchase-received">
              Packs
              <input class="purchase-small-input" type="number" min="0" step="1" value="${item.packs}" data-received-packs="${item.id}" data-pack-size="${item.packSize}">
            </label>
            <label class="purchase-received">
              Comprado
              <input class="purchase-small-input" type="number" min="0" step="0.01" value="${item.units}" data-received-order="${item.id}">
            </label>
            <button class="purchase-confirm-button" type="button" data-confirm-order="${item.id}">Confirmar</button>
            <button class="purchase-delete-button" type="button" data-remove-order="${item.id}">X</button>
          </article>
        `).join("")}
      </section>
    `).join("");
  }

  function supplierOptions(selectedSupplier) {
    const selected = selectedSupplier || "Otro";
    const options = suppliers.includes(selected) ? suppliers : [...suppliers, selected];
    return options.map((supplier) => `
      <option value="${escapeHtml(supplier)}"${supplier === selected ? " selected" : ""}>${escapeHtml(supplier)}</option>
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

  function wireEvents() {
    $("purchaseOpenButton")?.addEventListener("click", showPurchaseView);
    $("purchaseListOpenButton")?.addEventListener("click", showPurchaseListView);
    $("goPurchaseListButton")?.addEventListener("click", showPurchaseListView);
    $("goPurchaseButton")?.addEventListener("click", showPurchaseView);
    $("backHomeFromPurchase")?.addEventListener("click", showHomeView);
    $("backHomeFromPurchaseList")?.addEventListener("click", showHomeView);
    $("clearPurchaseOrderButton")?.addEventListener("click", clearOrder);
    $("purchaseSearchInput")?.addEventListener("input", renderPurchaseProducts);
    $("purchaseSortInput")?.addEventListener("change", renderPurchaseProducts);

    $("purchaseProductList")?.addEventListener("change", (event) => {
      const productInput = event.target.closest("[data-product-id]");
      if (productInput) {
        updateProductField(productInput.dataset.productId, productInput.dataset.productField, productInput.value);
        return;
      }

      const input = event.target.closest("[data-setting-id]");
      if (!input) return;
      updateSetting(input.dataset.settingId, input.dataset.settingField, input.value);
    });

    $("purchaseProductList")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-add-id]");
      if (!button) return;
      const input = document.querySelector(`[data-pack-id="${CSS.escape(button.dataset.addId)}"]`);
      addToOrder(button.dataset.addId, input?.value);
    });

    $("purchaseOrderList")?.addEventListener("click", (event) => {
      const confirmButton = event.target.closest("[data-confirm-order]");
      if (confirmButton) {
        const input = document.querySelector(`[data-received-order="${CSS.escape(confirmButton.dataset.confirmOrder)}"]`);
        confirmOrderItem(confirmButton.dataset.confirmOrder, input?.value);
        return;
      }

      const button = event.target.closest("[data-remove-order]");
      if (!button) return;
      removeOrderItem(button.dataset.removeOrder);
    });

    $("purchaseOrderList")?.addEventListener("input", (event) => {
      const packInput = event.target.closest("[data-received-packs]");
      if (!packInput) return;

      const unitsInput = document.querySelector(`[data-received-order="${CSS.escape(packInput.dataset.receivedPacks)}"]`);
      if (!unitsInput) return;

      const packs = Number(packInput.value || 0);
      const packSize = Number(packInput.dataset.packSize || 1);
      unitsInput.value = Math.max(0, packs * packSize);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadData();
    wireEvents();

    if (typeof window.listenOnline === "function") {
      window.listenOnline(PRODUCTS_KEY, (value) => {
        if (Array.isArray(value)) {
          state.products = value;
          renderPurchaseProducts();
        }
      });
      window.listenOnline(SALES_KEY, (value) => {
        if (Array.isArray(value)) {
          state.sales = value;
          renderPurchaseProducts();
        }
      });
      window.listenOnline(ORDER_KEY, (value) => {
        if (Array.isArray(value)) {
          state.order = value;
          renderPurchaseOrder();
        }
      });
    }
  });
})();
