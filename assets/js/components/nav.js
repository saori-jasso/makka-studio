(function () {
  var toggle = document.querySelector(".site-header__toggle");
  var panel = document.getElementById("menu-principal");

  if (!toggle || !panel) {
    return;
  }

  function setOpen(open) {
    panel.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
  }

  toggle.addEventListener("click", function () {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      setOpen(false);
      toggle.focus();
    }
  });

  document.addEventListener("click", function (event) {
    if (!panel.contains(event.target) && !toggle.contains(event.target)) {
      setOpen(false);
    }
  });
})();
