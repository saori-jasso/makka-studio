/*
 * Usuarios y roles (administrador). Lee y cambia con window.MakkaAuth; cuando exista el backend, solo cambia ese servicio.
 * Roles: cliente, empleado y administrador. Hoy solo el administrador entra al panel; qué puede hacer un empleado
 * se define después. Las revisiones de esta pantalla son comodidad: el backend debe validar quién cambia roles.
 */
(function () {
  "use strict";

  var UI = window.MakkaUI;
  var esc = UI.escapeHtml;
  var PAGE_SIZE = 15;

  var ROLE_LABEL = { cliente: "Cliente", empleado: "Empleado", administrador: "Administrador" };
  var ROLE_CHIP = { cliente: "chip--pale", empleado: "chip--violet", administrador: "chip--honey" };

  /* ---------- Funciones puras ---------- */

  function fullName(user) {
    return (String(user.nombre || "") + " " + String(user.apellido || "")).trim() || user.email;
  }

  function filterUsers(users, filters) {
    var query = String(filters.query || "").trim().toLowerCase();
    return users.filter(function (user) {
      if (filters.role && user.rol !== filters.role) { return false; }
      return !query || (fullName(user) + " " + user.email).toLowerCase().indexOf(query) !== -1;
    });
  }

  function countByRole(users) {
    var counts = { total: users.length, cliente: 0, empleado: 0, administrador: 0 };
    users.forEach(function (user) { if (counts[user.rol] !== undefined) { counts[user.rol] += 1; } });
    return counts;
  }

  function sortUsers(users) {
    return users.slice().sort(function (a, b) { return fullName(a).localeCompare(fullName(b), "es"); });
  }

  window.MakkaUsuariosLogic = { fullName: fullName, filterUsers: filterUsers, countByRole: countByRole, sortUsers: sortUsers };

  /* ---------- Pantalla ---------- */

  var admin = window.MakkaAdmin;
  if (!admin || !admin.allowed) {
    return;
  }

  var Auth = window.MakkaAuth;
  var Utils = window.MakkaAdminUI;
  var me = String(admin.user.email || "").toLowerCase();

  function byId(id) { return document.getElementById(id); }

  var state = { query: "", role: "", shown: PAGE_SIZE, target: null };

  function renderSummary(users) {
    var counts = countByRole(users);
    var items = [["Cuentas", counts.total, "users"], ["Clientes", counts.cliente, "user"], ["Empleados", counts.empleado, "store"], ["Administradores", counts.administrador, "shield"]];
    byId("usr-resumen").innerHTML = items.map(function (item) {
      return '<article class="adm-stat"><span class="adm-stat__icon" aria-hidden="true">' + Utils.icon(item[2], 22) + '</span><p class="adm-stat__value">' + item[1] + '</p><h2 class="adm-stat__label">' + item[0] + "</h2></article>";
    }).join("");
  }

  function render() {
    var users = Auth.listUsers();
    renderSummary(users);
    var rows = sortUsers(filterUsers(users, state));
    var shown = rows.slice(0, state.shown);

    byId("usr-vacio").hidden = rows.length > 0;
    byId("usr-tabla").hidden = rows.length === 0;
    byId("usr-vacio-texto").textContent = users.length ? "No encontramos cuentas con esa búsqueda." : "Todavía no hay cuentas.";
    byId("usr-contador").textContent = rows.length ? "Mostrando " + shown.length + " de " + rows.length + (rows.length === 1 ? " cuenta" : " cuentas") : "";
    byId("usr-mas").hidden = rows.length <= shown.length;
    byId("demo-cargar").hidden = users.some(function (user) { return user.rol !== "administrador"; });

    byId("usr-cuerpo").innerHTML = shown.map(function (user) {
      var mine = String(user.email).toLowerCase() === me;
      return "<tr>" +
        '<td data-label="Nombre"><span class="dash-table__folio">' + esc(fullName(user)) + "</span>" + (mine ? ' <span class="chip chip--pale adm-you">Tú</span>' : "") + "</td>" +
        '<td data-label="Correo">' + esc(user.email) + "</td>" +
        '<td data-label="Teléfono">' + esc(user.telefono || "-") + "</td>" +
        '<td data-label="Rol"><span class="chip ' + (ROLE_CHIP[user.rol] || "chip--pale") + '">' + esc(ROLE_LABEL[user.rol] || user.rol) + "</span></td>" +
        '<td data-label="Fecha de alta">' + esc(Utils.formatDate(user.alta) || "-") + "</td>" +
        '<td data-label="Acción"><button class="adm-act" type="button" data-email="' + esc(user.email) + '">' + Utils.icon("edit", 18) + "Cambiar rol</button></td></tr>";
    }).join("");
  }

  var dialog = byId("usr-dialogo");

  function showError(message) {
    var box = byId("usr-error");
    box.textContent = message || "";
    box.hidden = !message;
  }

  byId("usr-buscar").addEventListener("input", function (event) { state.query = event.target.value; state.shown = PAGE_SIZE; render(); });
  byId("usr-rol").addEventListener("change", function (event) { state.role = event.target.value; state.shown = PAGE_SIZE; render(); });
  byId("usr-mas").addEventListener("click", function () { state.shown += PAGE_SIZE; render(); });
  byId("usr-cancelar").addEventListener("click", function () { Utils.closeDialog(dialog); });

  byId("demo-cargar").addEventListener("click", function () {
    if (!window.MakkaDemo || !window.MakkaDemo.load("usuarios")) { Utils.toast("No se pudieron cargar los datos de ejemplo"); return; }
    render();
    Utils.toast("Cargamos datos de ejemplo");
  });

  byId("usr-cuerpo").addEventListener("click", function (event) {
    var button = event.target.closest("[data-email]");
    if (!button) { return; }
    var email = button.getAttribute("data-email");
    var user = Auth.listUsers().filter(function (item) { return item.email === email; })[0];
    if (!user) { return; }
    state.target = user;
    showError("");
    byId("usr-dialogo-titulo").textContent = "Cambiar rol de " + fullName(user);
    byId("usr-nuevo-rol").value = user.rol;
    Utils.openDialog(dialog);
    byId("usr-nuevo-rol").focus();
  });

  function apply(user, role) {
    var result = Auth.setRole(user.email, role);
    if (!result.ok) {
      showError(result.error === "ultimo-admin"
        ? "Esta es la única cuenta de administrador. Asigna antes a otra persona como administrador."
        : "No se pudo cambiar el rol. Intenta de nuevo.");
      return;
    }
    Utils.closeDialog(dialog);
    /* Si la persona se quitó sus propios permisos, ya no puede seguir en el panel */
    if (String(user.email).toLowerCase() === me && role !== "administrador") {
      window.MakkaSession.login(Object.assign({}, window.MakkaSession.user(), { rol: role }));
      window.location.href = "index.html";
      return;
    }
    render();
    Utils.toast("Los permisos se actualizaron.");
  }

  byId("usr-form").addEventListener("submit", function (event) {
    event.preventDefault();
    var user = state.target;
    var role = byId("usr-nuevo-rol").value;
    if (!user) { return; }
    if (role === user.rol) { Utils.closeDialog(dialog); return; }
    if (String(user.email).toLowerCase() === me && role !== "administrador") {
      /* Antes de quitarse el acceso, se pide confirmar */
      var check = Auth.listUsers().filter(function (item) { return item.rol === "administrador" && item.email !== user.email; }).length;
      if (!check) { showError("Esta es la única cuenta de administrador. Asigna antes a otra persona como administrador."); return; }
      Utils.closeDialog(dialog);
      Utils.confirm({ titulo: "¿Quitarte el acceso de administrador?", texto: "Saldrás del panel y ya no podrás volver a entrar sin que otro administrador te cambie el rol.", boton: "Sí, cambiar mi rol", peligro: true }).then(function (yes) {
        if (yes) { apply(user, role); }
      });
      return;
    }
    apply(user, role);
  });

  render();
})();
