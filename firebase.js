document.write('<script src="https://cdn.jsdelivr.net/gh/LocurJJ/Ventas-panaderia@61056808b91c2bf004732abd052ee3e7f3c5b832/firebase.js"><\/script>');

(function installStableOnlineStorage() {
  const SALES_KEY = "panaderia_josue_ventas_v1";
  const SALES_BACKUP_KEY = "panaderia_josue_ventas_respaldo_v1";
  const ACCOUNTS_KEY = "panaderia_josue_fiados_v1";
  const DELETED_SALES_KEY = "panaderia_josue_ventas_borradas_v1";
  let savingSale = false;

  function asList(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (value && typeof value === "object") return Object.values(value).filter(Boolean);
    return [];
  }

  function readList(key) {
    try { return asList(JSON.parse(localStorage.getItem(key) || "[]")); }
    catch (error) { return []; }
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

  function writeLocal(key, value) {
    const prepared = key === SALES_KEY || key === SALES_BACKUP_KEY ? compactSales(value) : value;
    if (key === SALES_BACKUP_KEY) {
      try { localStorage.removeItem(key); localStorage.setItem(key, JSON.stringify(prepared.slice(0, 50))); }
      catch (error) { try { localStorage.removeItem(key); } catch (removeError) {} }
      return;
    }
    if (key === SALES_KEY) {
      try { localStorage.removeItem(SALES_BACKUP_KEY); } catch (error) {}
      try { localStorage.removeItem(key); localStorage.setItem(key, JSON.stringify(prepared)); return; } catch (error) {}
      try { localStorage.removeItem(key); localStorage.setItem(key, JSON.stringify(prepared.slice(0, 1000))); return; } catch (error) {}
      try { localStorage.removeItem(key); localStorage.setItem(key, JSON.stringify(prepared.slice(0, 300))); return; } catch (error) {}
      try { localStorage.removeItem(key); } catch (error) {}
      console.warn("No hay espacio para guardar ventas en este navegador. La base online queda como fuente principal.");
      return;
    }
    try { localStorage.setItem(key, JSON.stringify(prepared)); }
    catch (error) { console.warn("No se pudo guardar localmente", key, error); }
  }

  function saveRemote(key, value) {
    try {
      if (typeof db !== "undefined" && typeof dbPath === "function") return db.ref(dbPath(key)).set(value);
      if (typeof saveOnline === "function") return saveOnline(key, value);
    } catch (error) {
      console.warn("No se pudo sincronizar online", key, error);
    }
    return Promise.resolve();
  }

  function installSafeStorageApi() {
    window.saveOnline = function saveOnlineSafe(key, value) {
      writeLocal(key, value);
      return saveRemote(key, value);
    };
    window.listenOnline = function listenOnlineSafe(key, callback) {
      if (typeof db === "undefined" || typeof dbPath !== "function") return;
      db.ref(dbPath(key)).on("value", (snapshot) => {
        const list = asList(snapshot.val());
        writeLocal(key, list);
        callback(list);
      });
    };
    try { saveOnline = window.saveOnline; } catch (error) {}
    try { listenOnline = window.listenOnline; } catch (error) {}
  }

  function cleanupOldStorage() {
    try { localStorage.removeItem(SALES_BACKUP_KEY); } catch (error) {}
    try {
      const cleaned = compactSales(readList(SALES_KEY));
      localStorage.removeItem(SALES_KEY);
      writeLocal(SALES_KEY, cleaned);
    } catch (error) {
      try { localStorage.removeItem(SALES_KEY); } catch (removeError) {}
    }
  }

  function deletedIds() {
    return new Set(readList(DELETED_SALES_KEY).map((entry) => entry.id || entry).filter(Boolean));
  }

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
    return compactSales([...map.values()]).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }

  function persistSales(nextSales) {
    const current = typeof sales !== "undefined" && Array.isArray(sales) ? sales : readList(SALES_KEY);
    const merged = mergeSalesById(nextSales, current, readList(SALES_KEY), readList(SALES_BACKUP_KEY));
    try { sales = merged; } catch (error) {}
    saveRemote(SALES_KEY, merged);
    writeLocal(SALES_KEY, merged);
    writeLocal(SALES_BACKUP_KEY, merged);
    return merged;
  }

  function nextSaleNumber(shiftId) {
    const current = typeof getShiftSales === "function" ? getShiftSales(shiftId) : readList(SALES_KEY).filter((sale) => sale.shiftId === shiftId);
    return Math.max(0, ...current.map((sale) => Number(sale.saleNumber || 0))) + 1;
  }

  function safeCall(fn) {
    try { if (typeof fn === "function") fn(); }
    catch (error) { console.warn("Accion secundaria fallida", error); }
  }

  function selectedCustomer() {
    if (typeof getSelectedCustomer === "function") return getSelectedCustomer();
    const name = document.getElementById("customerSelect")?.value || "Consumidor final";
    return { name, type: name === "Consumidor final" ? "normal" : "account" };
  }

  function paymentMethod(customer, cash, transfer) {
    if (typeof getPaymentMethod === "function") return getPaymentMethod(customer, cash, transfer);
    if (customer.type !== "normal") return customer.type === "family" ? "Familia" : "Fiado";
    if (cash > 0 && transfer > 0) return "Mixto";
    return transfer > 0 ? "Transferencia" : "Efectivo";
  }

  function makeLocalId() {
    if (typeof makeId === "function") return makeId();
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function saveAccountEntry(sale) {
    if (!sale.customerType || sale.customerType === "normal") return;
    const accounts = readList(ACCOUNTS_KEY);
    accounts.unshift({
      id: sale.id,
      shiftId: sale.shiftId,
      local: sale.local,
      date: sale.date,
      customer: sale.customer,
      customerType: sale.customerType,
      items: sale.items,
      note: sale.customerType === "family" ? "Familia" : "Cuenta corriente"
    });
    writeLocal(ACCOUNTS_KEY, accounts);
    saveRemote(ACCOUNTS_KEY, accounts);
  }

  function setButtonSaving(button, active) {
    if (!button) return;
    button.disabled = active;
    button.textContent = active ? "Guardando..." : "Guardar venta";
  }

  function installConfirmPayment() {
    const button = document.getElementById("confirmPaymentButton") || document.querySelector(".payment-actions .confirm-pay");
    if (button && !button.id) button.id = "confirmPaymentButton";
    window.confirmPayment = function confirmPaymentStable() {
      if (savingSale) return;
      const activeButton = document.getElementById("confirmPaymentButton") || document.querySelector(".payment-actions .confirm-pay");
      try {
        const shift = typeof getOpenShift === "function" ? getOpenShift() : null;
        if (!shift) { alert("Primero tenes que abrir un turno de caja."); safeCall(closePayment); safeCall(showShiftView); return; }
        const total = Number(typeof getCartTotal === "function" ? getCartTotal() : 0);
        if (!Array.isArray(cart) || cart.length === 0 || total <= 0) { alert("Agrega productos antes de cobrar."); return; }
        const customer = selectedCustomer();
        const cash = Number(document.getElementById("cashInput")?.value || 0);
        const transfer = Number(document.getElementById("transferInput")?.value || 0);
        const paid = cash + transfer;
        if (customer.type === "normal" && paid < total) { alert(`Faltan ${formatMoney(total - paid)}.`); return; }

        savingSale = true;
        setButtonSaving(activeButton, true);
        const now = new Date().toISOString();
        const saleNumber = nextSaleNumber(shift.id);
        const sale = {
          id: makeLocalId(),
          shiftId: shift.id,
          saleNumber,
          local: new URLSearchParams(window.location.search).get("local") || "Central",
          date: now,
          updatedAt: now,
          customer: customer.name,
          customerType: customer.type,
          items: cart.map(compactItem),
          total,
          cash: customer.type === "normal" ? cash : 0,
          transfer: customer.type === "normal" ? transfer : 0,
          change: customer.type === "normal" ? Math.max(0, paid - total) : 0,
          method: paymentMethod(customer, cash, transfer)
        };

        persistSales([sale]);
        saveAccountEntry(sale);
        safeCall(() => adjustProductsStock(sale.items, -1));
        cart = [];
        const customerSelect = document.getElementById("customerSelect");
        if (customerSelect) customerSelect.value = "Consumidor final";
        safeCall(closePayment);
        safeCall(renderCart);
        safeCall(renderProducts);
        safeCall(renderProductManageList);
        safeCall(renderNotebook);
        safeCall(renderClients);
        safeCall(renderShift);
        alert(customer.type === "normal" ? `Venta ${saleNumber} guardada en Cuaderno.` : "Consumo anotado en Cuaderno.");
      } catch (error) {
        console.error("No se pudo guardar la venta", error);
        alert(`No se pudo guardar la venta: ${error?.message || error}. Avisame con esta foto.`);
      } finally {
        savingSale = false;
        setButtonSaving(activeButton, false);
      }
    };
    window.confirmPayment.__stableStorage = true;
  }

  function installQuantityPatch() {
    if (document.getElementById("cart-quantity-style-patch")) return;
    const style = document.createElement("style");
    style.id = "cart-quantity-style-patch";
    style.textContent = `.quantity-edit{width:64px;padding:7px;border:1px solid #ddd;border-radius:8px;text-align:center}.cart-delete-btn{width:28px;height:28px;border:0;border-radius:999px;background:#fee2e2;color:#b91c1c;font-size:20px;font-weight:800;line-height:1;display:inline-grid;place-items:center}.cart-delete-btn:hover{background:#fecaca}`;
    document.head.appendChild(style);
    if (typeof window.renderCart !== "function" || window.renderCart.__quantityPatch) return;
    const originalRenderCart = window.renderCart;
    window.changeQuantity = function changeQuantity(id, value) {
      const item = cart.find((product) => product.id === id);
      if (!item || item.weighable) return;
      item.quantity = Math.max(1, Math.floor(Number(value || 1)));
      item.total = Number(item.unitPrice || 0) * item.quantity;
      window.renderCart();
    };
    window.renderCart = function renderCartWithQuantity() {
      originalRenderCart.apply(this, arguments);
      document.querySelectorAll("#cartItems tr").forEach((row) => {
        const priceInput = row.querySelector(".price-edit");
        const quantityCell = row.children[1];
        const deleteButton = row.children[3]?.querySelector("button");
        const id = String(priceInput?.getAttribute("onchange") || "").match(/changePrice\('([^']+)'/)?.[1];
        const quantityText = quantityCell?.textContent.trim();
        if (id && /^\d+$/.test(quantityText)) quantityCell.innerHTML = `<input class="quantity-edit" type="number" min="1" step="1" value="${quantityText}" onchange="changeQuantity('${id}', this.value)">`;
        if (deleteButton) { deleteButton.className = "cart-delete-btn"; deleteButton.innerHTML = "&times;"; deleteButton.setAttribute("aria-label", "Quitar producto"); }
      });
    };
    window.renderCart.__quantityPatch = true;
    window.renderCart();
  }

  function install() {
    installSafeStorageApi();
    cleanupOldStorage();
    installConfirmPayment();
    installQuantityPatch();
  }

  function installLater() {
    [700, 1800, 3200, 5200, 7500, 11000].forEach((delay) => setTimeout(install, delay));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installLater);
  else installLater();
})();

(function installSafeShiftMovements() {
  const SHIFTS_KEY = "panaderia_josue_turnos_v1";
  const SALES_KEY = "panaderia_josue_ventas_v1";
  const SALES_BACKUP_KEY = "panaderia_josue_ventas_respaldo_v1";

  function asList(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (value && typeof value === "object") return Object.values(value).filter(Boolean);
    return [];
  }

  function readList(key) {
    try { return asList(JSON.parse(localStorage.getItem(key) || "[]")); }
    catch (error) { return []; }
  }

  function getLocalName() {
    return new URLSearchParams(window.location.search).get("local") || "Central";
  }

  function getOpenShiftFrom(shifts) {
    const local = getLocalName();
    return shifts.find((shift) => shift.local === local && shift.status === "open");
  }

  function makeLocalId() {
    if (typeof makeId === "function") return makeId();
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function freeSalesSpace() {
    try { localStorage.removeItem(SALES_BACKUP_KEY); } catch (error) {}
    try {
      const sales = readList(SALES_KEY);
      localStorage.removeItem(SALES_KEY);
      localStorage.setItem(SALES_KEY, JSON.stringify(sales.slice(0, 300)));
    } catch (error) {
      try { localStorage.removeItem(SALES_KEY); } catch (removeError) {}
    }
  }

  function writeLocalShifts(shifts) {
    try { localStorage.setItem(SHIFTS_KEY, JSON.stringify(shifts)); return true; }
    catch (error) {}
    freeSalesSpace();
    try { localStorage.setItem(SHIFTS_KEY, JSON.stringify(shifts)); return true; }
    catch (error) { console.warn("No se pudo guardar turnos localmente", error); return false; }
  }

  function saveRemoteShifts(shifts) {
    try {
      if (typeof db !== "undefined" && typeof dbPath === "function") return db.ref(dbPath(SHIFTS_KEY)).set(shifts);
      if (typeof saveOnline === "function") return saveOnline(SHIFTS_KEY, shifts);
    } catch (error) {
      console.warn("No se pudieron sincronizar los turnos", error);
    }
    return Promise.resolve();
  }

  function persistShiftsSafe(shifts) {
    writeLocalShifts(shifts);
    saveRemoteShifts(shifts);
  }

  function refreshShift() {
    if (typeof window.renderShift === "function") window.renderShift();
  }

  function addMovement(type) {
    const shifts = readList(SHIFTS_KEY);
    const shift = getOpenShiftFrom(shifts);
    if (!shift) { alert("Primero tenes que abrir un turno de caja."); return; }
    const isExpense = type === "expenses";
    const descriptionInput = document.getElementById(isExpense ? "expenseDescriptionInput" : "reinforcementDescriptionInput");
    const amountInput = document.getElementById(isExpense ? "expenseAmountInput" : "reinforcementAmountInput");
    const amount = Number(amountInput?.value || 0);
    if (amount <= 0) { alert(isExpense ? "Carga el importe del gasto." : "Carga el importe del refuerzo."); return; }
    shift[type] = Array.isArray(shift[type]) ? shift[type] : [];
    shift[type].push({
      id: makeLocalId(),
      description: descriptionInput?.value.trim() || (isExpense ? "Gasto" : "Refuerzo"),
      amount,
      date: new Date().toISOString()
    });
    persistShiftsSafe(shifts);
    if (descriptionInput) descriptionInput.value = "";
    if (amountInput) amountInput.value = "";
    refreshShift();
    alert(isExpense ? "Gasto agregado." : "Refuerzo agregado.");
  }

  function deleteMovement(type, id) {
    const shifts = readList(SHIFTS_KEY);
    const shift = getOpenShiftFrom(shifts);
    if (!shift) return;
    shift[type] = asList(shift[type]).filter((item) => item.id !== id);
    persistShiftsSafe(shifts);
    refreshShift();
  }

  function install() {
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

  function installLater() {
    [900, 1800, 3200, 5200, 8000, 12000].forEach((delay) => setTimeout(install, delay));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installLater);
  else installLater();
})();
