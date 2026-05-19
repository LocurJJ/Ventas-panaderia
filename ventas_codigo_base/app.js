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
  "Otro"
];

let products = loadProducts();
let changedProducts = loadWhatsappProducts();
let selectedId = null;
let currentSalesLocation = "Central";

const $ = (id) => document.getElementById(id);

const welcomeView = $("welcomeView");
const adminView = $("adminView");
const salesView = $("salesView");
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
const salesLocation = $("salesLocation");

function loadProducts(){
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

function saveProducts(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

function loadWhatsappProducts(){
  return JSON.parse(localStorage.getItem(WHATSAPP_KEY) || "[]");
}

function saveWhatsappProducts(){
  localStorage.setItem(WHATSAPP_KEY, JSON.stringify(changedProducts));
}

function showView(view){
  welcomeView.classList.add("hidden");
  adminView.classList.add("hidden");
  salesView.classList.add("hidden");
  view.classList.remove("hidden");
}

function formatMoney(value){
  return Number(value || 0).toLocaleString("es-AR", {
    style:"currency",
    currency:"ARS",
    maximumFractionDigits:0
  });
}

function roundToNearest100(value){
  return Math.round(Number(value || 0) / 100) * 100;
}

function calculateSalePrice(){
  const cost = Number(costInput.value || 0);
  if(cost <= 0) return;
  saleInput.value = roundToNearest100(cost * 1.3);
}

function fillSuppliers(){
  supplierInput.innerHTML = suppliers.map(s => `<option value="${s}">${s}</option>`).join("");
}

function renderProducts(){
  const search = productSearch.value.trim().toLowerCase();
  const filtered = products
    .filter(p => {
      const text = `${p.name} ${p.barcode} ${p.supplier}`.toLowerCase();
      return text.includes(search);
    })
    .sort((a,b) => a.name.localeCompare(b.name));

  productCount.textContent = `${products.length} producto${products.length === 1 ? "" : "s"}`;

  if(filtered.length === 0){
    productList.innerHTML = `<p class="muted">No hay productos para mostrar.</p>`;
    return;
  }

  productList.innerHTML = filtered.map(p => `
    <button class="product-item ${p.id === selectedId ? "active" : ""}" data-id="${p.id}">
      <strong>${p.name}</strong>
      <small>Venta: ${formatMoney(p.salePrice)} | Costo: ${formatMoney(p.cost)}</small>
      <small>Stock: ${p.stock || 0} ${p.weighable ? "kg/unidad pesable" : "un."} | ${p.supplier}</small>
      <small>Código: ${p.barcode || "Sin código"}</small>
    </button>
  `).join("");
}

function resetForm(){
  selectedId = null;
  productForm.reset();
  productId.value = "";
  stockInput.value = 0;
  formTitle.textContent = "Añadir producto";
  deleteProductButton.classList.add("hidden");
  renderProducts();
  nameInput.focus();
}

function selectProduct(id){
  const p = products.find(item => item.id === id);
  if(!p) return;
  selectedId = id;
  productId.value = p.id;
  nameInput.value = p.name;
  costInput.value = p.cost;
  saleInput.value = p.salePrice;
  barcodeInput.value = p.barcode || "";
  stockInput.value = p.stock || 0;
  supplierInput.value = p.supplier || "Otro";
  weighableInput.checked = !!p.weighable;
  formTitle.textContent = "Modificar producto";
  deleteProductButton.classList.remove("hidden");
  renderProducts();
}

function getFormProduct(){
  return {
    id: productId.value || crypto.randomUUID(),
    name: nameInput.value.trim(),
    cost: Number(costInput.value || 0),
    salePrice: Number(saleInput.value || 0),
    barcode: barcodeInput.value.trim(),
    stock: Number(stockInput.value || 0),
    supplier: supplierInput.value,
    weighable: weighableInput.checked,
    updatedAt: new Date().toISOString()
  };
}

function confirmSave(){
  return new Promise(resolve => {
    confirmDialog.showModal();
    confirmDialog.addEventListener("close", () => {
      resolve(confirmDialog.returnValue === "yes");
    }, {once:true});
  });
}

function addToWhatsapp(product){
  changedProducts = changedProducts.filter(p => p.id !== product.id);
  changedProducts.push({id: product.id, name: product.name, salePrice: product.salePrice});
  saveWhatsappProducts();
  renderWhatsappMessage();
}

function renderWhatsappMessage(){
  if(changedProducts.length === 0){
    whatsappMessage.value = "";
    return;
  }
  whatsappMessage.value = changedProducts
    .map(p => `${p.name}---$${Number(p.salePrice).toLocaleString("es-AR")}`)
    .join("\n");
}

productForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const product = getFormProduct();

  if(!product.name){
    alert("Falta el nombre del producto.");
    return;
  }

  const ok = await confirmSave();
  if(!ok) return;

  const index = products.findIndex(p => p.id === product.id);
  if(index >= 0){
    products[index] = product;
  }else{
    products.push(product);
  }

  saveProducts();
  addToWhatsapp(product);
  selectedId = product.id;
  renderProducts();
  selectProduct(product.id);
  alert("Producto guardado.");
});

productList.addEventListener("click", (e) => {
  const button = e.target.closest(".product-item");
  if(!button) return;
  selectProduct(button.dataset.id);
});

productSearch.addEventListener("input", renderProducts);
costInput.addEventListener("input", calculateSalePrice);
$("newProductButton").addEventListener("click", resetForm);
$("clearFormButton").addEventListener("click", resetForm);

$("copyWhatsappButton").addEventListener("click", async () => {
  if(!whatsappMessage.value.trim()){
    alert("No hay mensaje para copiar todavía.");
    return;
  }
  await navigator.clipboard.writeText(whatsappMessage.value);
  alert("Mensaje copiado para WhatsApp.");
});

deleteProductButton.addEventListener("click", () => {
  if(!selectedId) return;
  const product = products.find(p => p.id === selectedId);
  const ok = confirm(`¿Seguro que querés borrar ${product?.name || "este producto"}?`);
  if(!ok) return;
  products = products.filter(p => p.id !== selectedId);
  changedProducts = changedProducts.filter(p => p.id !== selectedId);
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

passwordForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if(passwordInput.value === PASSWORD){
    passwordDialog.close();
    showView(adminView);
    renderProducts();
    renderWhatsappMessage();
  }else{
    passwordError.classList.remove("hidden");
    passwordInput.select();
  }
});

cancelPasswordButton.addEventListener("click", () => passwordDialog.close());
$("backHomeFromAdmin").addEventListener("click", () => showView(welcomeView));
$("backHomeFromSales").addEventListener("click", () => showView(welcomeView));

document.querySelectorAll("[data-open-sales]").forEach(button => {
  button.addEventListener("click", () => {
    currentSalesLocation = button.dataset.openSales;
    salesLocation.textContent = currentSalesLocation;
    showView(salesView);
  });
});

fillSuppliers();
renderProducts();
renderWhatsappMessage();
