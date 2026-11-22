/*
 * Estructura común del panel del administrador (barra superior, menú lateral y permiso de acceso).
 * Lo cargan todas las pantallas del panel; cada una marca la suya con <body data-admin="dashboard|productos|pedidos|...">.
 * Deja en window.MakkaAdmin:
 *   allowed -> true si hay una sesión de administrador (entonces se muestra el panel)
 *   user    -> { nombre, email, rol } de quien entró
 * Para activar una pantalla nueva del panel, ponle su "href" en ITEMS.
 * IMPORTANTE: esta revisión solo cuida la pantalla. El backend debe comprobar el rol administrador en cada petición.
 */
window.MakkaAdmin = (function () {
  "use strict";

  /* Pantallas del panel. href: null = todavía no existe (se ve apagada). */
  var ITEMS = [
    { id: "dashboard", label: "Dashboard", href: "dashboard.html", icon: "home" },
    { id: "productos", label: "Productos", href: "admin-productos.html", icon: "box" },
    { id: "pedidos", label: "Pedidos y pagos", href: "admin-pedidos.html", icon: "card" },
    { id: "personalizados", label: "Pedidos personalizados", href: "admin-personalizados.html", icon: "sparkle" },
    { id: "usuarios", label: "Usuarios y roles", href: "admin-usuarios.html", icon: "users" },
    { id: "reporte", label: "Reporte de ventas", href: "admin-reporte.html", icon: "chart" }
  ];

  var admin = { allowed: false, user: null };
  var app = document.getElementById("admin-app");
  var block = document.getElementById("admin-bloqueo");
  var Session = window.MakkaSession;

  if (!app || !block || !Session) {
    return admin;
  }

  var user = Session.isLoggedIn() ? Session.user() : null;

  /* Sin sesión o sin rol de administrador: solo se muestra el aviso */
  if (!user || user.rol !== "administrador") {
    var title = document.getElementById("bloqueo-titulo");
    var text = document.getElementById("bloqueo-texto");
    var here = (document.body.getAttribute("data-page-file") || "dashboard.html");
    if (!user) {
      title.textContent = "Inicia sesión para entrar al panel";
      text.textContent = "Esta zona es solo para el equipo de Makka Studio.";
      var login = document.getElementById("bloqueo-login");
      login.href = "login.html?siguiente=" + encodeURIComponent(here);
      login.hidden = false;
    } else {
      title.textContent = "No tienes permiso para ver esta página";
      text.textContent = "Esta zona es solo para administradores. Si crees que es un error, avísale al equipo de Makka Studio.";
    }
    block.hidden = false;
    return admin;
  }

  admin.allowed = true;
  admin.user = user;
  app.hidden = false;

  var name = String(user.nombre || "Admin").trim() || "Admin";
  var initial = name.charAt(0).toUpperCase();
  document.getElementById("admin-nombre").textContent = name;
  /* Avatar del perfil del administrador; si no tiene uno válido se usa la inicial */
  window.MakkaAvatar.render(document.getElementById("admin-avatar"), user.avatar, initial);

  /* ---------- Menú lateral ---------- */
  var current = document.body.getAttribute("data-admin");
  var navList = document.getElementById("admin-nav");

  function pendingPayments() {
    var Compras = window.MakkaCompras;
    if (!Compras) { return 0; }
    return Compras.list().filter(function (purchase) { return purchase.estatus === "pago-pendiente"; }).length;
  }

  function newRequests() {
    var Requests = window.MakkaSolicitudes;
    if (!Requests) { return 0; }
    return Requests.list().filter(function (request) { return request.estatus === "En revisión"; }).length;
  }

  function icon(file) {
    var img = document.createElement("img");
    img.src = "assets/img/icons/" + file + ".svg";
    img.alt = "";
    img.width = 22;
    img.height = 22;
    return img;
  }

  ITEMS.forEach(function (item) {
    var li = document.createElement("li");
    var node;
    var iconBox = document.createElement("span");
    iconBox.className = "admin-nav__icon";
    iconBox.appendChild(icon(item.icon));

    if (item.href) {
      node = document.createElement("a");
      node.href = item.href;
      if (item.id === current) { node.setAttribute("aria-current", "page"); }
    } else {
      node = document.createElement("span");
      node.className = "is-soon";
      node.setAttribute("aria-disabled", "true");
      node.title = "Próximamente";
    }
    node.className = "admin-nav__link" + (item.href ? "" : " is-soon");
    node.appendChild(iconBox);

    var label = document.createElement("span");
    label.className = "admin-nav__label";
    label.textContent = item.label;
    node.appendChild(label);

    if (!item.href) {
      var soon = icon("clock");
      soon.className = "admin-nav__soon";
      soon.width = 16;
      soon.height = 16;
      soon.alt = "Próximamente";
      node.appendChild(soon);
    } else {
      var count = item.id === "pedidos" ? pendingPayments() : item.id === "personalizados" ? newRequests() : 0;
      if (count > 0) {
        var badge = document.createElement("span");
        badge.className = "admin-nav__badge";
        badge.textContent = String(count);
        badge.title = item.id === "pedidos" ? "Pagos por validar" : "Solicitudes nuevas";
        node.appendChild(badge);
      }
    }

    li.appendChild(node);
    navList.appendChild(li);
  });

  /* ---------- Menú de la persona ---------- */
  var menuButton = document.getElementById("admin-menu-btn");
  var menuList = document.getElementById("admin-menu-lista");
  var menu = document.getElementById("admin-menu");

  function setMenu(open) {
    menuList.hidden = !open;
    menuButton.setAttribute("aria-expanded", String(open));
  }

  menuButton.addEventListener("click", function () { setMenu(menuList.hidden); });

  function logout() {
    Session.logout();
    window.location.href = "index.html";
  }

  document.getElementById("admin-salir").addEventListener("click", logout);
  document.getElementById("admin-salir-lado").addEventListener("click", logout);

  /* ---------- Menú lateral en pantallas chicas ---------- */
  var toggle = document.getElementById("admin-toggle");
  var side = document.getElementById("admin-side");

  function setSide(open) {
    side.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
  }

  toggle.addEventListener("click", function () { setSide(toggle.getAttribute("aria-expanded") !== "true"); });

  document.addEventListener("click", function (event) {
    if (!menu.contains(event.target)) { setMenu(false); }
    if (!side.contains(event.target) && !toggle.contains(event.target)) { setSide(false); }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") { return; }
    if (!menuList.hidden) { setMenu(false); menuButton.focus(); }
    if (side.classList.contains("is-open")) { setSide(false); toggle.focus(); }
  });

  return admin;
})();
