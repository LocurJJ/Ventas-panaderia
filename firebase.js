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

(function setupSalesPatches() {
  const PRODUCTS_KEY = "panaderia_josue_productos_v1";
  const SALES_KEY = "panaderia_josue_ventas_v1";
  const SHIFTS_KEY = "panaderia_josue_turnos_v1";
  const ACCOUNTS_KEY = "panaderia_josue_fiados_v1";
  const IMAGE_DB = "panaderia_josue_imagenes_locales_v1";
  const IMAGE_STORE = "imagenes";
  const imageCache = new Map();
  let imageDbPromise = null;

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

  function formatKg(value) {
    const quantity = Number(value || 0);
    if (quantity < 1) return `${Math.round(quantity * 1000)} g`;
    return `${quantity.toLocaleString("es-AR", { maximumFractionDigits: 3 })} kg`;
  }

  function getCurrentPrice(item, products) {
    const product = products.find((entry) => entry.id === item.productId);
    return Number(product?.salePrice ?? item.unitPrice ?? 0);
  }

  function getCurrentItemValue(item, products) {
    return getCurrentPrice(item, products) * Number(item.quantity || 0);
  }

  function getLocalName() {
    return new URLSearchParams(window.location.search).get("local") || "Central";
  }

  function getOpenShift(shifts) {
    const local = getLocalName();
    return shifts.find((shift) => shift.local === local && shift.status === "open");
  }

  function paymentMethod(cash, transfer) {
    if (cash > 0 && transfer > 0) return "Mixto";
    if (transfer > 0) return "Transferencia";
    return "Efectivo";
  }

  function adjustStock(items, direction) {
    const products = readList(PRODUCTS_KEY);
    items.forEach((item) => {
      const product = products.find((entry) => entry.id === item.productId);
      if (!product) return;
      product.stock = Number(product.stock || 0) + direction * Number(item.quantity || 0);
      product.updatedAt = new Date().toISOString();
    });
    saveList(PRODUCTS_KEY, products);
  }

  function installLayoutPatch() {
    if (document.getElementById("fixed-sales-layout-patch")) return;
    const style = document.createElement("style");
    style.id = "fixed-sales-layout-patch";
    style.textContent = `
      @media (min-width: 901px) {
        html, body { height: 100%; overflow: hidden !important; }
        .app { height: 100vh !important; overflow: hidden !important; }
        .sidebar { height: 100vh !important; overflow: auto !important; flex-shrink: 0 !important; }
        .content { height: 100vh !important; overflow: hidden !important; }
        #sellView .cart { height: calc(100vh - 40px) !important; min-height: 0 !important; flex-shrink: 0 !important; }
        #sellView .products { height: calc(100vh - 40px) !important; max-height: calc(100vh - 40px) !important; overflow-y: auto !important; overflow-x: hidden !important; }
        #sellView .product-grid { padding-bottom: 24px !important; }
        #sellView .cart-table { display: block !important; flex: 1 1 auto !important; min-height: 0 !important; overflow-y: auto !important; overflow-x: hidden !important; padding-right: 4px !important; margin-bottom: 12px !important; }
        #sellView .cart-table thead, #sellView .cart-table tbody { display: table !important; width: 100% !important; table-layout: fixed !important; }
        #sellView .total { flex-shrink: 0 !important; margin-top: 12px !important; }
        #shiftView .shift-panel,
        #notebookView .notebook,
        #productManageView .product-manage-panel,
        #clientsView .notebook { max-height: calc(100vh - 40px) !important; overflow: auto !important; }
      }
      .account-settle { width: auto !important; margin: 10px 0 4px; padding: 10px 14px !important; border-radius: 10px !important; font-size: 14px !important; }
    `;
    document.head.appendChild(style);
  }

  function openImageDb() {
    if (imageDbPromise) return imageDbPromise;
    imageDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(IMAGE_DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(IMAGE_STORE, { keyPath: "productId" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return imageDbPromise;
  }

  async function getLocalImage(productId) {
    if (!productId) return "";
    if (imageCache.has(productId)) return imageCache.get(productId);
    const database = await openImageDb();
    const value = await new Promise((resolve, reject) => {
      const transaction = database.transaction(IMAGE_STORE, "readonly");
      const request = transaction.objectStore(IMAGE_STORE).get(productId);
      request.onsuccess = () => resolve(request.result?.dataUrl || "");
      request.onerror = () => reject(request.error);
    });
    imageCache.set(productId, value);
    return value;
  }

  async function setLocalImage(productId, dataUrl) {
    const database = await openImageDb();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(IMAGE_STORE, "readwrite");
      transaction.objectStore(IMAGE_STORE).put({ productId, dataUrl, updatedAt: new Date().toISOString() });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    imageCache.set(productId, dataUrl);
  }

  async function removeLocalImage(productId) {
    const database = await openImageDb();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(IMAGE_STORE, "readwrite");
      transaction.objectStore(IMAGE_STORE).delete(productId);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    imageCache.delete(productId);
  }

  function fileToDataUrl(file) {
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
          canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.84));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function renderProductsWithImages() {
    const grid = document.getElementById("productGrid");
    if (!grid) return;
    const products = readList(PRODUCTS_KEY);
    await Promise.all(products.map((product) => getLocalImage(product.id).catch(() => "")));
    const search = document.getElementById("searchInput")?.value.trim().toLowerCase() || "";
    const filtered = products.filter((product) => `${product.name} ${product.barcode || ""}`.toLowerCase().includes(search));

    if (!filtered.length) {
      grid.innerHTML = "<p class='empty'>No hay productos para mostrar.</p>";
      return;
    }

    grid.innerHTML = filtered.map((product) => {
      const image = imageCache.get(product.id);
      return `
        <button class="product ${product.weighable ? "weighable" : ""} ${image ? "local-image-card" : ""}" type="button" onclick="addProduct('${product.id}')">
          ${image ? `<img class="product-local-thumb" src="${image}" alt="${esc(product.name)}">` : ""}
          <strong>${esc(product.name)}</strong>
          <span>${money(product.salePrice)}${product.weighable ? "/kg" : ""}</span>
          <small>Stock: ${Number(product.stock || 0).toLocaleString("es-AR")}${product.weighable ? " kg" : ""}</small>
        </button>
      `;
    }).join("");
  }

  function installImageUi() {
    if (document.getElementById("local-product-images-style")) return;
    const style = document.createElement("style");
    style.id = "local-product-images-style";
    style.textContent = `
      .product.local-image-card { padding: 12px !important; overflow: hidden !important; }
      .product-local-thumb { width: 100%; height: 84px; object-fit: cover; border-radius: 10px; display: block; margin-bottom: 10px; background: rgba(255,255,255,.18); }
      .local-image-box { border: 1px solid #dbe2ef; border-radius: 12px; padding: 12px; display: grid; gap: 10px; background: #f8fafc; }
      .local-image-preview { width: 100%; max-height: 180px; object-fit: contain; border-radius: 10px; display: none; background: white; border: 1px solid #e5e7eb; }
      .local-image-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
      .local-image-actions input { flex: 1; min-width: 220px; }
      .local-image-note { color: #64748b; font-size: 13px; }
      .local-image-remove { border: 0; border-radius: 10px; padding: 10px 14px; background: #fee2e2; color: #b91c1c; cursor: pointer; }
    `;
    document.head.appendChild(style);
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
    if (stockTools) stockTools.before(box); else form.appendChild(box);

    document.getElementById("productLocalImageInput").addEventListener("change", async (event) => {
      const productId = document.getElementById("productManageId")?.value;
      const file = event.currentTarget.files?.[0];
      if (!file) return;
      if (!productId) {
        alert("Primero guarda o selecciona el producto, despues cargale la imagen.");
        event.currentTarget.value = "";
        return;
      }
      const dataUrl = await fileToDataUrl(file);
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

  function printAccountReceipt(customerName, items, total, payment) {
    const detailRows = items.map((item) => `
      <tr><td>${esc(item.name)}</td><td>${item.weighable ? formatKg(item.quantity) : `${Number(item.quantity || 0).toLocaleString("es-AR")} un.`}</td><td>${money(item.unitPrice)}${item.weighable ? "/kg" : ""}</td><td>${money(item.total)}</td></tr>
    `).join("");
    const paymentRows = payment
      ? `<tr><td>Efectivo</td><td>${money(payment.cash)}</td></tr><tr><td>Transferencia / QR</td><td>${money(payment.transfer)}</td></tr><tr><td>Vuelto</td><td>${money(payment.change)}</td></tr>`
      : `<tr><td>Cuenta limpiada</td><td>${money(total)}</td></tr>`;
    const win = window.open("", "_blank", "width=720,height=900");
    if (!win) {
      alert("No se pudo abrir la impresion. Revisa si el navegador bloqueo ventanas emergentes.");
      return;
    }
    const now = new Date().toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cuenta ${esc(customerName)}</title><style>body{font-family:Arial,sans-serif;color:#111827;padding:28px}h1{margin:0 0 6px;font-size:28px}.muted{color:#64748b;margin-bottom:22px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border-bottom:1px solid #e5e7eb;padding:10px 8px;text-align:left}th:last-child,td:last-child{text-align:right}.total{margin-top:18px;text-align:right;font-size:24px;font-weight:800}.box{margin-top:20px;border:1px solid #e5e7eb;border-radius:10px;padding:14px}.payment td:first-child{font-weight:700}@media print{body{padding:0}}</style></head><body><h1>Panaderia Josue</h1><div class="muted">Cuenta de ${esc(customerName)} - ${now}</div><table><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio actual</th><th>Subtotal</th></tr></thead><tbody>${detailRows}</tbody></table><div class="total">Total: ${money(total)}</div><div class="box"><strong>Pago</strong><table class="payment">${paymentRows}</table></div></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  }

  function accountEntries() {
    const accounts = readList(ACCOUNTS_KEY).map((entry) => ({ ...entry, source: "account" }));
    const legacy = readList(SALES_KEY)
      .filter((sale) => sale.customerType && sale.customerType !== "normal")
      .map((sale) => ({ ...sale, source: "sale" }));
    return [...accounts, ...legacy].sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  function currentAccountItems(customerName) {
    const products = readList(PRODUCTS_KEY);
    const entries = accountEntries().filter((entry) => entry.customer === customerName);
    const items = entries.flatMap((entry) => entry.items || []).map((item) => {
      const unitPrice = getCurrentPrice(item, products);
      return { ...item, unitPrice, total: unitPrice * Number(item.quantity || 0) };
    });
    const total = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
    return { entries, items, total };
  }

  window.deleteAccountEntry = function deleteAccountEntry(id) {
    const accounts = readList(ACCOUNTS_KEY);
    const account = accounts.find((entry) => entry.id === id);
    if (account) {
      if (!confirm("Seguro que queres borrar este consumo? Se devuelve el stock.")) return;
      adjustStock(account.items || [], 1);
      saveList(ACCOUNTS_KEY, accounts.filter((entry) => entry.id !== id));
      window.renderClients?.();
      window.renderProducts?.();
      return;
    }

    const sales = readList(SALES_KEY);
    const sale = sales.find((entry) => entry.id === id);
    if (!sale) return;
    if (!confirm("Seguro que queres borrar este consumo? Se devuelve el stock.")) return;
    adjustStock(sale.items || [], 1);
    saveList(SALES_KEY, sales.filter((entry) => entry.id !== id));
    window.renderClients?.();
    window.renderProducts?.();
  };

  window.settleCustomerAccount = function settleCustomerAccount(encodedName) {
    const customerName = decodeURIComponent(encodedName);
    const customers = [
      { name: "Lorena", type: "account" },
      { name: "Ulices", type: "account" },
      { name: "Josue", type: "family" },
      { name: "Juan y bety", type: "family" },
      { name: "Gera", type: "family" },
      { name: "Laura", type: "family" },
    ];
    const customer = customers.find((entry) => entry.name === customerName);
    const { entries, items, total } = currentAccountItems(customerName);
    if (!entries.length) return;

    if (customer?.type === "account") {
      const shifts = readList(SHIFTS_KEY);
      const shift = getOpenShift(shifts);
      if (!shift) {
        alert("Para cobrar una cuenta primero tenes que abrir un turno.");
        window.showShiftView?.();
        return;
      }
      const cashText = prompt(`Total a cobrar: ${money(total)}\nCuanto paga en efectivo?`, String(total));
      if (cashText === null) return;
      const transferText = prompt("Cuanto paga en transferencia / QR?", "0");
      if (transferText === null) return;
      const cash = Number(cashText || 0);
      const transfer = Number(transferText || 0);
      const paid = cash + transfer;
      if (Number.isNaN(cash) || Number.isNaN(transfer) || cash < 0 || transfer < 0) {
        alert("Carga importes validos.");
        return;
      }
      if (paid < total) {
        alert(`Faltan ${money(total - paid)}.`);
        return;
      }

      const sales = readList(SALES_KEY).filter((sale) => !(sale.customer === customerName && sale.customerType && sale.customerType !== "normal"));
      const shiftSales = sales.filter((sale) => sale.shiftId === shift.id);
      sales.unshift({
        id: makeId(),
        shiftId: shift.id,
        saleNumber: shiftSales.length + 1,
        local: getLocalName(),
        date: new Date().toISOString(),
        customer: customerName,
        customerType: "normal",
        items,
        total,
        cash,
        transfer,
        change: Math.max(0, paid - total),
        method: paymentMethod(cash, transfer),
        accountPayment: true,
      });
      saveList(SALES_KEY, sales);
      printAccountReceipt(customerName, items, total, { cash, transfer, change: Math.max(0, paid - total) });
    } else {
      if (!confirm(`Seguro que queres limpiar esta cuenta por ${money(total)}? No se devuelve stock.`)) return;
      printAccountReceipt(customerName, items, total, null);
      const sales = readList(SALES_KEY).filter((sale) => !(sale.customer === customerName && sale.customerType && sale.customerType !== "normal"));
      saveList(SALES_KEY, sales);
    }

    saveList(ACCOUNTS_KEY, readList(ACCOUNTS_KEY).filter((entry) => entry.customer !== customerName));
    window.renderNotebook?.();
    window.renderShift?.();
    window.renderClients?.();
  };

  function renderClientsPatched() {
    const list = document.getElementById("clientList");
    if (!list) return;
    const customers = [
      { name: "Lorena", type: "account" },
      { name: "Ulices", type: "account" },
      { name: "Josue", type: "family" },
      { name: "Juan y bety", type: "family" },
      { name: "Gera", type: "family" },
      { name: "Laura", type: "family" },
    ];
    const entries = accountEntries();
    const products = readList(PRODUCTS_KEY);

    list.innerHTML = customers.map((customer) => {
      const customerEntries = entries.filter((entry) => entry.customer === customer.name);
      if (!customerEntries.length) {
        return `<article class="sale-item"><div class="sale-main"><strong>${esc(customer.name)}</strong><span class="item-note">${customer.type === "family" ? "Familia" : "Cuenta corriente"}</span><strong>${money(0)}</strong></div></article>`;
      }
      const total = customerEntries.reduce((sum, entry) => sum + (entry.items || []).reduce((itemSum, item) => itemSum + getCurrentItemValue(item, products), 0), 0);
      const detail = customerEntries.map((entry) => {
        const items = (entry.items || []).map((item) => {
          const currentPrice = getCurrentPrice(item, products);
          const quantity = item.weighable ? formatKg(item.quantity) : `${item.quantity} un.`;
          return `${esc(item.name)} x ${quantity} (${money(currentPrice)}${item.weighable ? "/kg" : ""})`;
        }).join(", ");
        const entryTotal = (entry.items || []).reduce((sum, item) => sum + getCurrentItemValue(item, products), 0);
        return `<li>${dateTime(entry.date)} - ${items} - Hoy: ${money(entryTotal)} <button class="delete-btn" type="button" onclick="deleteAccountEntry('${entry.id}')">X</button></li>`;
      }).join("");
      const settleLabel = customer.type === "family" ? "Limpiar cuenta" : "Cobrar cuenta";
      return `<article class="sale-item open"><div class="sale-main"><strong>${esc(customer.name)}</strong><span class="item-note">${customer.type === "family" ? "Familia sin cobrar" : "Cuenta corriente"}</span><strong>${money(total)}</strong></div><div class="sale-detail"><div>Total con precios actuales: ${money(total)}</div><button class="pay-btn account-settle" type="button" onclick="settleCustomerAccount('${encodeURIComponent(customer.name)}')">${settleLabel}</button><ul>${detail}</ul></div></article>`;
    }).join("");
  }

  function wrapConfirmPayment() {
    if (typeof window.confirmPayment !== "function" || window.confirmPayment.__accountsWrapped) return;
    const original = window.confirmPayment;
    window.confirmPayment = function confirmPaymentAccountsBridge() {
      const beforeIds = new Set(readList(SALES_KEY).map((sale) => sale.id));
      const result = original.apply(this, arguments);
      setTimeout(() => {
        const sales = readList(SALES_KEY);
        const newAccountSales = sales.filter((sale) => !beforeIds.has(sale.id) && sale.customerType && sale.customerType !== "normal");
        if (!newAccountSales.length) return;
        const accounts = readList(ACCOUNTS_KEY);
        newAccountSales.forEach((sale) => {
          accounts.unshift({
            id: sale.id,
            shiftId: sale.shiftId,
            local: sale.local,
            date: sale.date,
            customer: sale.customer,
            customerType: sale.customerType,
            items: sale.items || [],
            note: sale.customerType === "family" ? "Familia" : "Cuenta corriente",
          });
        });
        saveList(ACCOUNTS_KEY, accounts);
        saveList(SALES_KEY, sales.filter((sale) => !newAccountSales.some((accountSale) => accountSale.id === sale.id)));
        renderClientsPatched();
        window.renderNotebook?.();
        window.renderShift?.();
      }, 250);
      return result;
    };
    window.confirmPayment.__accountsWrapped = true;
  }

  function installAccountPatch() {
    window.renderClients = renderClientsPatched;
    wrapConfirmPayment();
    renderClientsPatched();
    if (typeof listenOnline === "function" && !window.__accountsListenerInstalled) {
      window.__accountsListenerInstalled = true;
      listenOnline(ACCOUNTS_KEY, () => renderClientsPatched());
    }
  }

  function installImagePatch() {
    installImageUi();
    ensureImageControls();
    const search = document.getElementById("searchInput");
    if (search && !search.dataset.localImagesPatched) {
      search.dataset.localImagesPatched = "true";
      search.addEventListener("input", renderProductsWithImages);
    }
    const manageList = document.getElementById("productManageList");
    if (manageList && !manageList.dataset.localImagesPatched) {
      manageList.dataset.localImagesPatched = "true";
      manageList.addEventListener("click", () => setTimeout(() => updateImagePreview(document.getElementById("productManageId")?.value || ""), 0));
    }
    const originalRenderProducts = window.renderProducts;
    if (typeof originalRenderProducts === "function" && !originalRenderProducts.__localImagesWrapped) {
      window.renderProducts = function renderProductsLocalImagesBridge() {
        originalRenderProducts.apply(this, arguments);
        renderProductsWithImages();
      };
      window.renderProducts.__localImagesWrapped = true;
    }
    renderProductsWithImages();
  }

  function install() {
    installLayoutPatch();
    installImagePatch();
    installAccountPatch();
  }

  window.addEventListener("DOMContentLoaded", () => setTimeout(install, 350));
  setTimeout(install, 900);
})();
