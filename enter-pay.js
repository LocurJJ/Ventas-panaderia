(function installEnterToSavePayment() {
  function paymentIsOpen() {
    const modal = document.getElementById("paymentModal");
    return modal && !modal.classList.contains("hidden");
  }

  function savePaymentFromEnter(event) {
    if (event.key !== "Enter" || !paymentIsOpen()) return;
    const target = event.target;
    const isPaymentInput = target && (target.id === "cashInput" || target.id === "transferInput");
    if (!isPaymentInput) return;

    event.preventDefault();
    event.stopPropagation();

    const button = document.getElementById("confirmPaymentButton");
    if (button && button.disabled) return;

    if (typeof window.confirmPayment === "function") {
      window.confirmPayment();
    } else if (button) {
      button.click();
    }
  }

  function focusCashWhenOpen() {
    const modal = document.getElementById("paymentModal");
    const cash = document.getElementById("cashInput");
    if (!modal || !cash) return;
    if (!modal.classList.contains("hidden")) {
      setTimeout(() => cash.focus(), 60);
    }
  }

  document.addEventListener("keydown", savePaymentFromEnter, true);

  function installObserver() {
    const modal = document.getElementById("paymentModal");
    if (!modal || modal.__enterObserver) return;
    modal.__enterObserver = true;
    new MutationObserver(focusCashWhenOpen).observe(modal, { attributes: true, attributeFilter: ["class"] });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installObserver);
  } else {
    installObserver();
  }
})();
