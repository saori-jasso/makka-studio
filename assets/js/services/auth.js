/*
 * Cuentas provisionales (RF-01) guardadas en el navegador (localStorage).
 * SOLO PARA DISEÑO Y PRUEBAS: la contraseña se guarda sin cifrar, no uses contraseñas reales.
 * Cuando exista el backend, reemplaza register() y login() manteniendo lo que devuelven:
 *   register(datos) -> { ok: true }  o  { ok: false, error: "correo-registrado" }
 *   login(correo, contraseña) -> { ok: true, usuario }  o  { ok: false, error: "credenciales" | "bloqueado" }
 * (el bloqueo por intentos fallidos lo aplica el backend).
 * Recuperar contraseña (sin correos: la tienda manda por WhatsApp un enlace de un solo uso, restablecer-contrasena.html?token=...):
 *   createResetLink(correo) -> { ok: true, token } o { ok: false, error: "sin-cuenta" }. Lo hace SOLO el administrador
 *     después de confirmar quién es el cliente. El servidor nunca debe dárselo a un cliente.
 *   checkResetToken(token) -> { ok: true } o { ok: false, error: "token-invalido" }
 *   resetPassword(token, nueva) -> { ok: true } o { ok: false, error: "token-invalido" }
 * Administrador (solo el panel lo usa; el backend debe exigir rol administrador):
 *   listUsers() -> [{ nombre, apellido, email, telefono, rol, alta }] (sin contraseñas)
 *   setRole(correo, rol) -> { ok: true } o { ok: false, error: "rol" | "sin-cuenta" | "ultimo-admin" }
 *     (roles: cliente, empleado, administrador; siempre debe quedar al menos un administrador)
 * Perfil:
 *   getProfile(correo) -> { nombre, apellido, email, telefono, avatar } o null   (avatar = id del animalito, p. ej. "zorro"; ver components/avatar.js)
 *   updateProfile(correo, { nombre, apellido, telefono, avatar }) -> { ok: true, usuario } o { ok: false }
 *   changePassword(correo, actual, nueva) -> { ok: true } o { ok: false, error: "clave-actual" }
 */
window.MakkaAuth = (function () {
  "use strict";

  var KEY = "makka_usuarios";
  var memory = [];

  /* ---------- Validaciones (también las usan las páginas) ---------- */

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value).trim());
  }

  function digits(value) {
    return String(value).replace(/\D/g, "");
  }

  function isPhone(value) {
    return digits(value).length === 10;
  }

  function isPassword(value) {
    return String(value).length >= 8;
  }

  /* Solo se aceptan destinos internos tipo "pagina.html" para evitar redirecciones a otros sitios. */
  function safeNext(value, fallback) {
    return /^[a-z0-9-]+\.html$/i.test(String(value || "")) ? value : (fallback || "index.html");
  }

  /* ---------- Almacenamiento ---------- */

  function readUsers() {
    try {
      var list = JSON.parse(window.localStorage.getItem(KEY) || "[]");
      return Array.isArray(list) ? list : [];
    } catch (error) {
      return memory;
    }
  }

  function writeUsers(list) {
    memory = list;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(list));
    } catch (error) {
      /* Sin almacenamiento: los datos duran mientras la página esté abierta. */
    }
  }

  function findUser(email) {
    var key = String(email).trim().toLowerCase();
    return readUsers().filter(function (user) { return user.email === key; })[0] || null;
  }

  /* ---------- Operaciones ---------- */

  function register(data) {
    if (findUser(data.email)) { return { ok: false, error: "correo-registrado" }; }

    var users = readUsers();
    users.push({
      nombre: String(data.nombre).trim(),
      apellido: String(data.apellido).trim(),
      email: String(data.email).trim().toLowerCase(),
      telefono: digits(data.telefono),
      clave: data.password,
      rol: "cliente",
      alta: new Date().toISOString()
    });
    writeUsers(users);
    return { ok: true };
  }

  function login(email, password) {
    var user = findUser(email);
    if (!user || user.clave !== password) { return { ok: false, error: "credenciales" }; }
    return { ok: true, usuario: { nombre: user.nombre, email: user.email, rol: user.rol, avatar: user.avatar || "" } };
  }

  /* ---------- Recuperar contraseña (prueba) ---------- */

  var RESET_KEY = "makka_reset";
  var RESET_MINUTES = 24 * 60;

  function readResets() {
    try {
      var list = JSON.parse(window.localStorage.getItem(RESET_KEY) || "[]");
      return Array.isArray(list) ? list : [];
    } catch (error) {
      return [];
    }
  }

  function writeResets(list) {
    try { window.localStorage.setItem(RESET_KEY, JSON.stringify(list)); } catch (error) { /* sin almacenamiento */ }
  }

  function newToken() {
    var text = "";
    while (text.length < 32) { text += Math.random().toString(36).slice(2); }
    return text.slice(0, 32);
  }

  function findReset(token) {
    var now = Date.now();
    return readResets().filter(function (entry) { return entry.token === token && entry.expira > now; })[0] || null;
  }

  /* Lo hace la tienda (administrador) después de confirmar quién es el cliente. Token de un solo uso, vence a las 24 horas. */
  function createResetLink(email) {
    var user = findUser(email);
    if (!user) { return { ok: false, error: "sin-cuenta" }; }
    var now = Date.now();
    var list = readResets().filter(function (entry) { return entry.expira > now && entry.email !== user.email; });
    var token = newToken();
    list.push({ token: token, email: user.email, expira: now + RESET_MINUTES * 60000 });
    writeResets(list);
    return { ok: true, token: token };
  }

  function checkResetToken(token) {
    return findReset(String(token || "")) ? { ok: true } : { ok: false, error: "token-invalido" };
  }

  function resetPassword(token, next) {
    var entry = findReset(String(token || ""));
    if (!entry) { return { ok: false, error: "token-invalido" }; }
    var users = readUsers();
    var user = users.filter(function (item) { return item.email === entry.email; })[0];
    if (!user) { return { ok: false, error: "token-invalido" }; }
    user.clave = next;
    writeUsers(users);
    writeResets(readResets().filter(function (item) { return item.token !== entry.token; }));
    return { ok: true };
  }

  /* Lista de cuentas sin contraseñas, para el panel del administrador. */
  function listUsers() {
    return readUsers().map(function (user) {
      return { nombre: user.nombre, apellido: user.apellido, email: user.email, telefono: user.telefono, rol: user.rol || "cliente", alta: user.alta || "" };
    });
  }

  var ROLES = ["cliente", "empleado", "administrador"];

  /* Cambia el rol de una cuenta. No deja que se quite al último administrador. */
  function setRole(email, role) {
    if (ROLES.indexOf(role) === -1) { return { ok: false, error: "rol" }; }
    var users = readUsers();
    var key = String(email).trim().toLowerCase();
    var user = users.filter(function (entry) { return entry.email === key; })[0];
    if (!user) { return { ok: false, error: "sin-cuenta" }; }
    var others = users.filter(function (entry) { return entry.email !== key && entry.rol === "administrador"; }).length;
    if (user.rol === "administrador" && role !== "administrador" && others === 0) { return { ok: false, error: "ultimo-admin" }; }
    user.rol = role;
    writeUsers(users);
    return { ok: true };
  }

  function getProfile(email) {
    var user = findUser(email);
    if (!user) { return null; }
    return { nombre: user.nombre, apellido: user.apellido, email: user.email, telefono: user.telefono, avatar: user.avatar || "" };
  }

  /* Solo se pueden cambiar estos campos. El correo no se edita porque identifica la cuenta y sus pedidos. */
  function updateProfile(email, data) {
    var users = readUsers();
    var key = String(email).trim().toLowerCase();
    var user = users.filter(function (entry) { return entry.email === key; })[0];
    if (!user) { return { ok: false }; }

    if (data.nombre !== undefined) { user.nombre = String(data.nombre).trim(); }
    if (data.apellido !== undefined) { user.apellido = String(data.apellido).trim(); }
    if (data.telefono !== undefined) { user.telefono = digits(data.telefono); }
    if (data.avatar !== undefined) { user.avatar = String(data.avatar); }
    writeUsers(users);
    return { ok: true, usuario: { nombre: user.nombre, email: user.email, rol: user.rol, avatar: user.avatar || "" } };
  }

  function changePassword(email, current, next) {
    var users = readUsers();
    var key = String(email).trim().toLowerCase();
    var user = users.filter(function (entry) { return entry.email === key; })[0];
    if (!user || user.clave !== current) { return { ok: false, error: "clave-actual" }; }
    user.clave = next;
    writeUsers(users);
    return { ok: true };
  }

  /*
   * SOLO PRUEBA: cuenta de administrador para ver el panel sin backend (correo admin@makka.studio, contraseña Admin1234).
   * Con backend real, pon CREATE_DEMO_ADMIN en false: los administradores se crean en el servidor.
   */
  var CREATE_DEMO_ADMIN = true;

  function ensureDemoAdmin() {
    if (!CREATE_DEMO_ADMIN) { return; }
    var users = readUsers();
    var exists = users.some(function (user) { return user.email === "admin@makka.studio"; });
    if (exists) { return; }
    users.push({
      nombre: "Admin",
      apellido: "Makka",
      email: "admin@makka.studio",
      telefono: "4444482898",
      clave: "Admin1234",
      rol: "administrador",
      avatar: "zorro",
      alta: new Date().toISOString()
    });
    writeUsers(users);
  }

  ensureDemoAdmin();

  return {
    isEmail: isEmail,
    isPhone: isPhone,
    isPassword: isPassword,
    digits: digits,
    safeNext: safeNext,
    register: register,
    login: login,
    createResetLink: createResetLink,
    checkResetToken: checkResetToken,
    resetPassword: resetPassword,
    listUsers: listUsers,
    setRole: setRole,
    ROLES: ROLES,
    getProfile: getProfile,
    updateProfile: updateProfile,
    changePassword: changePassword
  };
})();
