(function () {
  const NEW_SUPPLIER = "Coca Cola";

  function addSupplierOption(select) {
    if (!select || Array.from(select.options).some((option) => option.value === NEW_SUPPLIER)) return;
    const option = document.createElement("option");
    option.value = NEW_SUPPLIER;
    option.textContent = NEW_SUPPLIER;
    const otherOption = Array.from(select.options).find((item) => item.value === "Otro");
    if (otherOption) {
      select.insertBefore(option, otherOption);
    } else {
      select.appendChild(option);
    }
  }

  function refreshSupplierSelects() {
    addSupplierOption(document.getElementById("supplierInput"));
    document.querySelectorAll(".purchase-supplier-select").forEach(addSupplierOption);
  }

  document.addEventListener("DOMContentLoaded", () => {
    refreshSupplierSelects();
    const observer = new MutationObserver(refreshSupplierSelects);
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
