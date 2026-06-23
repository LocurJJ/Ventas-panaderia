(function () {
  const NEW_SUPPLIERS = ["Coca Cola", "elaboracion propia"];

  function addSupplierOption(select, supplier) {
    if (!select || Array.from(select.options).some((option) => option.value === supplier)) return;
    const option = document.createElement("option");
    option.value = supplier;
    option.textContent = supplier;
    const otherOption = Array.from(select.options).find((item) => item.value === "Otro");
    if (otherOption) {
      select.insertBefore(option, otherOption);
    } else {
      select.appendChild(option);
    }
  }

  function refreshSupplierSelects() {
    NEW_SUPPLIERS.forEach((supplier) => {
      addSupplierOption(document.getElementById("supplierInput"), supplier);
      document.querySelectorAll(".purchase-supplier-select").forEach((select) => addSupplierOption(select, supplier));
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    refreshSupplierSelects();
    const observer = new MutationObserver(refreshSupplierSelects);
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
