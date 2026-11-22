/*
 * Sesión provisional (RF-01 aún no está conectado al backend).
 * Cuando exista el login real, isLoggedIn()/user() deben preguntar al backend y las páginas no cambian.
 */
window.MakkaSession = (function () {
  "use strict";

  var KEY = "makka_sesion";
  var memory = null;

  function read() {
    try {
      return window.localStorage.getItem(KEY);
    } catch (error) {
      return memory;
    }
  }

  function write(value) {
    memory = value;
    try {
      if (value) { window.localStorage.setItem(KEY, value); } else { window.localStorage.removeItem(KEY); }
    } catch (error) {
      /* Sin almacenamiento: la sesión dura mientras la página esté abierta. */
    }
  }

  function isLoggedIn() {
    return Boolean(read());
  }

  /* { nombre, email, rol, avatar } del usuario con sesión, o null */
  function user() {
    var raw = read();
    if (!raw) { return null; }
    try {
      var data = JSON.parse(raw);
      if (data && typeof data === "object") { return data; }
    } catch (error) {
      /* valor antiguo de prueba */
    }
    return { nombre: "Cliente", email: "", rol: "cliente" };
  }

  /* El administrador gestiona la tienda desde el panel: no compra ni tiene carrito.
     Con backend, estos endpoints (carrito, compras, solicitudes) solo deben aceptar el rol cliente. */
  function isAdmin() {
    var current = user();
    return Boolean(current && current.rol === "administrador");
  }

  function login(data) {
    write(JSON.stringify({ nombre: data.nombre, email: data.email, rol: data.rol || "cliente", avatar: data.avatar || "" }));
  }

  function logout() {
    write(null);
  }

  return { isLoggedIn: isLoggedIn, isAdmin: isAdmin, user: user, login: login, logout: logout };
})();
