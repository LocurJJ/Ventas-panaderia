
const PASSWORD = "1704";
const STORAGE_KEY = "panaderia_josue_productos_v1";
const WHATSAPP_KEY = "panaderia_josue_whatsapp_v1";

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
  "Otro",
];

let products = loadProducts();
let changedProducts = loadWhatsappProducts();
let selectedId = null;

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
const weighableInput = $("weighableInput");
const formTitle = $("formTitle");
const deleteProductButton = $("deleteProductButton");
const whatsappMessage = $("whatsappMessage");

function loadProducts() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

function saveProducts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

function loadWhatsappProducts() {
  return JSON.parse(localStorage.getItem(WHATSAPP_KEY) || "[]");
}

function saveWhatsappProducts() {
  localStorage.setItem(WHATSAPP_KEY, JSON.stringify(changedProducts));
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
  return {
    id: productId.value || crypto.randomUUID(),
    name: nameInput.value.trim(),
    cost: Number(costInput.value || 0),
    salePrice: Number(saleInput.value || 0),
    barcode: barcodeInput.value.trim(),
    stock: Number(stockInput.value || 0),
    supplier: supplierInput.value,
    weighable: weighableInput.checked,
    updatedAt: new Date().toISOString(),
  };
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

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const product = getFormProduct();

  if (!product.name) {
    alert("Falta el nombre del producto.");
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
    renderProducts();
    renderWhatsappMessage();
  } else {
    passwordError.classList.remove("hidden");
    passwordInput.select();
  }
});

cancelPasswordButton.addEventListener("click", () => passwordDialog.close());
$("backHomeFromAdmin").addEventListener("click", () => showView(welcomeView));

document.querySelectorAll("[data-open-sales]").forEach((button) => {
  button.addEventListener("click", () => {
    const local = button.dataset.openSales;
    window.location.href = `ventas.html?local=${encodeURIComponent(local)}`;
  });
});

fillSuppliers();
renderProducts();
renderWhatsappMessage();
