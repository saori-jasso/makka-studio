/*
 * La tienda ve distinto al administrador (rol "administrador"): no compra, no tiene carrito
 * ni "Mis compras", y siempre ve una barra para volver al panel.
 * - Oculta el botón del carrito.
 * - En páginas de compra (<body data-buyers-only>) lo manda de regreso al panel.
 * - Muestra la barra "Estás viendo la tienda como administrador".
 * Necesita services/session.js cargado antes. Con backend, el servidor debe rechazar compras de administradores.
 */
(function () {
  "use strict";

  if (!window.MakkaSession || !window.MakkaSession.isAdmin()) {
    return;
  }

  if (document.body.hasAttribute("data-buyers-only")) {
    window.location.replace("dashboard.html");
    return;
  }

  document.querySelectorAll(".cart-btn").forEach(function (button) { button.hidden = true; });

  var header = document.querySelector(".site-header");
  if (!header) { return; }

  var bar = document.createElement("div");
  bar.className = "staff-bar";
  bar.innerHTML =
    '<div class="container staff-bar__inner">' +
    '<p class="staff-bar__text">Estás viendo la tienda como administrador.</p>' +
    '<a class="btn btn--violet btn--sm" href="dashboard.html">Volver al panel</a>' +
    "</div>";
  header.parentNode.insertBefore(bar, header);
})();
