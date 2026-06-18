(function installAdminFixes() {
  const STORAGE_KEY = "panaderia_josue_productos_v1";
  const WHATSAPP_KEY = "panaderia_josue_whatsapp_v1";
  let clearingWhatsapp = false;

  function readList(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function writeList(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    if (typeof window.saveOnline === "function") window.saveOnline(key, value);
  }

  function roundSalePrice(value) {
    const raw = Number(value || 0);
    const remainder = raw % 100;
    const base = raw - remainder;
    return remainder >= 50 ? base + 100 : base;
  }

  function clearWhatsappMessage(event) {
    const button = event.target.closest("#clearWhatsappButton");
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const ok = confirm("Seguro que queres limpiar el mensaje de WhatsApp?");
    if (!ok) return;

    clearingWhatsapp = true;
    const textarea = document.getElementById("whatsappMessage");
    if (textarea) textarea.value = "";
    writeList(WHATSAPP_KEY, []);

    setTimeout(() => { clearingWhatsapp = false; }, 5000);
  }

  function keepWhatsappCleanIfNeeded() {
    if (!clearingWhatsapp) return;
    const textarea = document.getElementById("whatsappMessage");
    if (textarea && textarea.value.trim()) textarea.value = "";
    localStorage.setItem(WHATSAPP_KEY, "[]");
  }

  function validateProductBeforeSave(event) {
    const form = event.target.closest("#productForm");
    if (!form) return;

    const productId = document.getElementById("productId")?.value || "";
    const nameInput = document.getElementById("nameInput");
    const costInput = document.getElementById("costInput");
    const saleInput = document.getElementById("saleInput");
    const barcodeInput = document.getElementById("barcodeInput");

    const name = nameInput?.value.trim() || "";
    const cost = Number(costInput?.value || 0);
    let salePrice = Number(saleInput?.value || 0);
    const barcode = barcodeInput?.value.trim() || "";

    if (!name) return;

    if (salePrice <= 0 && cost > 0) {
      salePrice = roundSalePrice(cost * 1.3);
      if (saleInput) saleInput.value = salePrice;
    }

    if (Number.isNaN(cost) || cost < 0) {
      event.preventDefault();
      event.stopImmediatePropagation();
      alert("Revisa el precio de compra. No puede ser negativo.");
      costInput?.focus();
      return;
    }

    if (Number.isNaN(salePrice) || salePrice <= 0) {
      event.preventDefault();
      event.stopImmediatePropagation();
      alert("Revisa el precio de venta. Tiene que ser mayor a 0.");
      saleInput?.focus();
      return;
    }

    if (barcode) {
      const products = readList(STORAGE_KEY);
      const repeated = products.find((product) => product.id !== productId && String(product.barcode || "").trim() === barcode);
      if (repeated) {
        event.preventDefault();
        event.stopImmediatePropagation();
        alert(`Ese codigo de barra ya lo tiene ${repeated.name}.`);
        barcodeInput?.focus();
      }
    }
  }

  document.addEventListener("click", clearWhatsappMessage, true);
  document.addEventListener("submit", validateProductBeforeSave, true);
  setInterval(keepWhatsappCleanIfNeeded, 300);
})();
