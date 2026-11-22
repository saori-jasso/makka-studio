/*
 * Cuando hay sesión iniciada, cambia los botones "Iniciar sesión / Crear cuenta" del encabezado
 * por un menú de la persona: Mi perfil, Mis compras y Cerrar sesión (el administrador ve "Ir al panel" y no "Mis compras").
 * Necesita services/session.js cargado antes.
 */
(function () {
  "use strict";

  var holder = document.querySelector(".site-header__auth");
  if (!holder || !window.MakkaSession || !window.MakkaSession.isLoggedIn()) {
    return;
  }

  var user = window.MakkaSession.user() || {};
  var name = String(user.nombre || "Cliente").trim() || "Cliente";
  var initial = name.charAt(0).toUpperCase();

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text) { node.textContent = text; }
    return node;
  }

  var menu = el("div", "user-menu");
  var button = el("button", "user-menu__btn");
  button.type = "button";
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", "menu-usuario");
  var avatar = el("span", "user-menu__avatar");
  if (window.MakkaAvatar) { window.MakkaAvatar.render(avatar, user.avatar, initial); } else { avatar.textContent = initial; }
  button.appendChild(avatar);
  button.appendChild(el("span", "user-menu__name", "Hola, " + name));

  var list = el("ul", "user-menu__list");
  list.id = "menu-usuario";
  list.hidden = true;

  (window.MakkaSession.isAdmin()
    ? [["Ir al panel", "dashboard.html"], ["Mi perfil", "perfil.html"]]
    : [["Mi perfil", "perfil.html"], ["Mis compras", "mis-compras.html"]]).forEach(function (item) {
    var li = el("li");
    var link = el("a", "user-menu__item", item[0]);
    link.href = item[1];
    if (window.location.pathname.slice(-item[1].length) === item[1]) { link.setAttribute("aria-current", "page"); }
    li.appendChild(link);
    list.appendChild(li);
  });

  var logoutItem = el("li");
  var logout = el("button", "user-menu__item user-menu__item--logout", "Cerrar sesión");
  logout.type = "button";
  logoutItem.appendChild(logout);
  list.appendChild(logoutItem);

  menu.appendChild(button);
  menu.appendChild(list);
  holder.textContent = "";
  holder.appendChild(menu);

  function setOpen(open) {
    list.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
  }

  button.addEventListener("click", function () { setOpen(list.hidden); });

  document.addEventListener("click", function (event) {
    if (!menu.contains(event.target)) { setOpen(false); }
  });

  menu.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !list.hidden) {
      event.stopPropagation();
      setOpen(false);
      button.focus();
    }
  });

  logout.addEventListener("click", function () {
    window.MakkaSession.logout();
    window.location.href = "index.html";
  });
})();
