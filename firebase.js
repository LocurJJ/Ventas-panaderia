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

  function installFixedSalesLayout() {
    if (document.getElementById("fixed-sales-layout-patch")) return;
    const style = document.createElement("style");
    style.id = "fixed-sales-layout-patch";
    style.textContent = `
      @media (min-width: 901px) {
        html, body { height: 100%; overflow: hidden !important; }
        .app { height: 100vh !important; overflow: hidden !important; }
        .sidebar { height: 100vh !important; overflow: auto !important; flex-shrink: 0 !important; }
        .content { height: 100vh !important; overflow: hidden !important; }
        #sellView .cart { height: calc(100vh - 40px) !important; flex-shrink: 0 !important; }
        #sellView .products { height: calc(100vh - 40px) !important; max-height: calc(100vh - 40px) !important; overflow-y: auto !important; overflow-x: hidden !important; }
        #sellView .product-grid { padding-bottom: 24px !important; }
        #shiftView .shift-panel,
        #notebookView .notebook,
        #productManageView .product-manage-panel,
        #clientsView .notebook { max-height: calc(100vh - 40px) !important; overflow: auto !important; }
      }
    `;
    document.head.appendChild(style);
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

  function addExpensePatched() {
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
    renderShiftPatched();
    alert("Gasto agregado.");
  }

  function addReinforcementPatched() {
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
    renderShiftPatched();
    alert("Refuerzo agregado.");
  }

  function deleteExpensePatched(id) {
    const shifts = readList(SHIFTS_KEY);
    const shift = getOpenShift(shifts);
    if (!shift) return;
    shift.expenses = (shift.expenses || []).filter((expense) => expense.id !== id);
    persistShifts(shifts);
    renderShiftPatched();
  }

  function deleteReinforcementPatched(id) {
    const shifts = readList(SHIFTS_KEY);
    const shift = getOpenShift(shifts);
    if (!shift) return;
    shift.reinforcements = (shift.reinforcements || []).filter((reinforcement) => reinforcement.id !== id);
    persistShifts(shifts);
    renderShiftPatched();
  }

  function renderShiftPatched() {
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
  }

  function installOverrides() {
    installFixedSalesLayout();
    ensureReinforcementUi();
    window.addExpense = addExpensePatched;
    window.addReinforcement = addReinforcementPatched;
    window.deleteExpense = deleteExpensePatched;
    window.deleteReinforcement = deleteReinforcementPatched;
    window.renderShift = renderShiftPatched;
    renderShiftPatched();
  }

  window.addEventListener("DOMContentLoaded", installOverrides);
  setTimeout(installOverrides, 0);
})();

(function setupLocalProductImages() {
  const PRODUCTS_KEY = "panaderia_josue_productos_v1";
  const DB_NAME = "panaderia_josue_imagenes_locales_v1";
  const STORE_NAME = "imagenes";
  const cache = new Map();
  let dbPromise = null;
  let installed = false;

  function readProducts() {
    try {
      const products = JSON.parse(localStorage.getItem(PRODUCTS_KEY) || "[]");
      return Array.isArray(products) ? products : [];
    } catch (error) {
      return [];
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatMoney(value) {
    return Number(value || 0).toLocaleString("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    });
  }

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE_NAME, { keyPath: "productId" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return dbPromise;
  }

  async function getLocalImage(productId) {
    if (!productId) return "";
    if (cache.has(productId)) return cache.get(productId);
    const database = await openDb();
    const value = await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(productId);
      request.onsuccess = () => resolve(request.result?.dataUrl || "");
      request.onerror = () => reject(request.error);
    });
    cache.set(productId, value);
    return value;
  }

  async function setLocalImage(productId, dataUrl) {
    const database = await openDb();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({
        productId,
        dataUrl,
        updatedAt: new Date().toISOString(),
      });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    cache.set(productId, dataUrl);
  }

  async function removeLocalImage(productId) {
    const database = await openDb();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(productId);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    cache.delete(productId);
  }

  function fileToCompressedDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => resolve(reader.result);
        image.onload = () => {
          const maxSide = 700;
          const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.84));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function preloadImages(products) {
    await Promise.all(products.map((product) => getLocalImage(product.id).catch(() => "")));
  }

  function installStyles() {
    if (document.getElementById("local-product-images-style")) return;
    const style = document.createElement("style");
    style.id = "local-product-images-style";
    style.textContent = `
      .product.local-image-card { padding: 12px !important; overflow: hidden !important; }
      .product-local-thumb { width: 100%; height: 84px; object-fit: cover; border-radius: 10px; display: block; margin-bottom: 10px; background: rgba(255,255,255,.18); }
      .product.local-image-card strong, .product.local-image-card span, .product.local-image-card small { display: block; }
      .local-image-box { border: 1px solid #dbe2ef; border-radius: 12px; padding: 12px; display: grid; gap: 10px; background: #f8fafc; }
      .local-image-box strong { font-size: 15px; }
      .local-image-preview { width: 100%; max-height: 180px; object-fit: contain; border-radius: 10px; display: none; background: white; border: 1px solid #e5e7eb; }
      .local-image-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
      .local-image-actions input { flex: 1; min-width: 220px; }
      .local-image-note { color: #64748b; font-size: 13px; }
      .local-image-remove { border: 0; border-radius: 10px; padding: 10px 14px; background: #fee2e2; color: #b91c1c; cursor: pointer; }
    `;
    document.head.appendChild(style);
  }

  async function renderProductsWithImages() {
    const grid = document.getElementById("productGrid");
    if (!grid) return;

    const products = readProducts();
    await preloadImages(products);

    const search = document.getElementById("searchInput")?.value.trim().toLowerCase() || "";
    const filtered = products
      .filter((product) => `${product.name} ${product.barcode || ""}`.toLowerCase().includes(search))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

    if (!filtered.length) {
      grid.innerHTML = "<p class='empty'>No hay productos para mostrar.</p>";
      return;
    }

    grid.innerHTML = filtered.map((product) => {
      const image = cache.get(product.id);
      const imageHtml = image ? `<img class="product-local-thumb" src="${image}" alt="${escapeHtml(product.name)}">` : "";
      return `
        <button class="product ${product.weighable ? "weighable" : ""} ${image ? "local-image-card" : ""}" type="button" onclick="addProduct('${product.id}')">
          ${imageHtml}
          <strong>${escapeHtml(product.name)}</strong>
          <span>${formatMoney(product.salePrice)}${product.weighable ? "/kg" : ""}</span>
          <small>Stock: ${Number(product.stock || 0).toLocaleString("es-AR")}${product.weighable ? " kg" : ""}</small>
        </button>
      `;
    }).join("");
  }

  function ensureImageControls() {
    const form = document.getElementById("productManageForm");
    if (!form || document.getElementById("productLocalImageInput")) return;

    const box = document.createElement("div");
    box.className = "local-image-box";
    box.innerHTML = `
      <strong>Imagen local</strong>
      <img class="local-image-preview" id="productLocalImagePreview" alt="Vista previa">
      <div class="local-image-actions">
        <input id="productLocalImageInput" type="file" accept="image/*">
        <button class="local-image-remove" id="removeProductLocalImage" type="button">Quitar imagen</button>
      </div>
      <span class="local-image-note">La imagen se guarda solo en esta computadora. Los datos del producto siguen en la base de datos.</span>
    `;

    const stockTools = form.querySelector(".stock-tools");
    if (stockTools) {
      stockTools.before(box);
    } else {
      form.appendChild(box);
    }

    document.getElementById("productLocalImageInput").addEventListener("change", async (event) => {
      const input = event.currentTarget;
      const productId = document.getElementById("productManageId")?.value;
      const file = input.files?.[0];
      if (!file) return;
      if (!productId) {
        alert("Primero guarda o selecciona el producto, despues cargale la imagen.");
        input.value = "";
        return;
      }
      const dataUrl = await fileToCompressedDataUrl(file);
      await setLocalImage(productId, dataUrl);
      await updateImagePreview(productId);
      await renderProductsWithImages();
      alert("Imagen guardada solo en esta computadora.");
    });

    document.getElementById("removeProductLocalImage").addEventListener("click", async () => {
      const productId = document.getElementById("productManageId")?.value;
      if (!productId) return;
      await removeLocalImage(productId);
      await updateImagePreview(productId);
      await renderProductsWithImages();
    });
  }

  async function updateImagePreview(productId) {
    const preview = document.getElementById("productLocalImagePreview");
    const input = document.getElementById("productLocalImageInput");
    if (!preview) return;
    if (input) input.value = "";
    const image = productId ? await getLocalImage(productId).catch(() => "") : "";
    if (image) {
      preview.src = image;
      preview.style.display = "block";
    } else {
      preview.removeAttribute("src");
      preview.style.display = "none";
    }
  }

  function wrapProductFormFunctions() {
    if (typeof window.selectProductForEdit === "function" && !window.selectProductForEdit.__localImageWrapped) {
      const original = window.selectProductForEdit;
      window.selectProductForEdit = function wrappedSelectProductForEdit(id) {
        const result = original.apply(this, arguments);
        ensureImageControls();
        setTimeout(() => updateImagePreview(id), 0);
        return result;
      };
      window.selectProductForEdit.__localImageWrapped = true;
    }

    if (typeof window.startNewManagedProduct === "function" && !window.startNewManagedProduct.__localImageWrapped) {
      const original = window.startNewManagedProduct;
      window.startNewManagedProduct = function wrappedStartNewManagedProduct() {
        const result = original.apply(this, arguments);
        ensureImageControls();
        setTimeout(() => updateImagePreview(""), 0);
        return result;
      };
      window.startNewManagedProduct.__localImageWrapped = true;
    }
  }

  function install() {
    if (installed) return;
    installed = true;
    installStyles();
    ensureImageControls();
    wrapProductFormFunctions();

    const searchInput = document.getElementById("searchInput");
    if (searchInput && !searchInput.dataset.localImagesPatched) {
      searchInput.dataset.localImagesPatched = "true";
      searchInput.addEventListener("input", renderProductsWithImages);
    }

    const manageList = document.getElementById("productManageList");
    if (manageList && !manageList.dataset.localImagesPatched) {
      manageList.dataset.localImagesPatched = "true";
      manageList.addEventListener("click", () => {
        setTimeout(() => updateImagePreview(document.getElementById("productManageId")?.value || ""), 0);
      });
    }

    const originalRenderProducts = window.renderProducts;
    window.renderProducts = function renderProductsLocalImagesBridge() {
      if (typeof originalRenderProducts === "function") {
        originalRenderProducts.apply(this, arguments);
      }
      renderProductsWithImages();
    };

    if (typeof listenOnline === "function") {
      listenOnline(PRODUCTS_KEY, () => {
        renderProductsWithImages();
        updateImagePreview(document.getElementById("productManageId")?.value || "");
      });
    }

    renderProductsWithImages();
    updateImagePreview(document.getElementById("productManageId")?.value || "");
  }

  window.addEventListener("DOMContentLoaded", () => setTimeout(install, 300));
  setTimeout(install, 900);
})();
