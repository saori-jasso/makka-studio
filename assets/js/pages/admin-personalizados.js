/*
 * Solicitudes personalizadas (administrador): revisar la solicitud, aprobar o rechazar el archivo 3D y cotizar.
 * Lee y cambia con window.MakkaSolicitudes; cuando exista el backend, solo cambia ese servicio.
 * Las revisiones de esta pantalla son comodidad: el backend debe validar el rol y las transiciones de estatus.
 */
(function () {
  "use strict";

  var UI = window.MakkaUI;
  var esc = UI.escapeHtml;

  var STATUS_KEY = { "En revisión": "en-revision", "Cotizado": "cotizado", "Aceptado": "aceptado", "Rechazado": "rechazado" };

  var TABS = [
    { id: "todas", label: "Todas", empty: "Todavía no hay solicitudes.", match: function () { return true; } },
    { id: "revision", label: "En revisión", empty: "No hay solicitudes por revisar. ¡Todo al día!", match: function (r) { return r.estatus === "En revisión"; } },
    { id: "cotizadas", label: "Cotizadas", empty: "No hay solicitudes cotizadas.", match: function (r) { return r.estatus === "Cotizado"; } },
    { id: "aceptadas", label: "Aceptadas", empty: "No hay solicitudes aceptadas.", match: function (r) { return r.estatus === "Aceptado"; } },
    { id: "rechazadas", label: "Rechazadas", empty: "No hay solicitudes rechazadas.", match: function (r) { return r.estatus === "Rechazado"; } }
  ];

  var ERRORS = {
    "estatus": "Esta solicitud ya cambió de estatus. Revisa la lista.",
    "sin-archivo": "Esta solicitud no trae archivo 3D.",
    "precio": "Escribe un precio mayor a 0 y menor a $100,000.",
    "archivo-rechazado": "El archivo está rechazado. Pídele al cliente otro formato antes de cotizar.",
    "no-existe": "No encontramos la solicitud.",
    "guardar": "No se pudo guardar el cambio. Intenta de nuevo."
  };

  var FILE_ERROR = "El archivo no se puede abrir. Pídele al cliente otro formato.";

  /* ---------- Funciones puras ---------- */

  function tabById(id) { return TABS.filter(function (tab) { return tab.id === id; })[0] || TABS[0]; }

  function newestFirst(requests) {
    return requests.slice().sort(function (a, b) { return new Date(b.creada) - new Date(a.creada); });
  }

  function tabCounts(requests) {
    var counts = {};
    TABS.forEach(function (tab) { counts[tab.id] = requests.filter(tab.match).length; });
    return counts;
  }

  function matchesSearch(request, name, query) {
    var text = String(query || "").trim().toLowerCase();
    if (!text) { return true; }
    return [request.id, request.correo, name].join(" ").toLowerCase().indexOf(text) !== -1;
  }

  /* Mensaje de WhatsApp para el cliente según el estatus */
  function whatsappText(request, name, formatMoney) {
    var hello = "Hola " + (name || "") + ", ";
    switch (request.estatus) {
      case "Cotizado":
        return hello + "ya revisamos tu pedido personalizado " + request.id + ". La cotización es de " + formatMoney(request.cotizacion) + " MXN." +
          (request.notasCotizacion ? " " + request.notasCotizacion : "") + " ¿Te gustaría continuar?";
      case "Aceptado":
        return hello + "gracias por aceptar la cotización de tu pedido " + request.id + ". Te mandamos los datos para tu transferencia.";
      case "Rechazado":
        return hello + "no podemos hacer tu pedido personalizado " + request.id + "." + (request.motivoRechazo ? " Motivo: " + request.motivoRechazo : "");
      default:
        return request.archivoEstado === "rechazado"
          ? hello + "no pudimos abrir el archivo 3D de tu pedido " + request.id + "." + (request.archivoNota ? " " + request.archivoNota : "") + " ¿Nos lo puedes mandar en otro formato (.STL u .OBJ)?"
          : hello + "estamos revisando tu pedido personalizado " + request.id + ". Te escribimos pronto con la cotización.";
    }
  }

  window.MakkaPersonalizadosLogic = { TABS: TABS, tabById: tabById, tabCounts: tabCounts, matchesSearch: matchesSearch, newestFirst: newestFirst, whatsappText: whatsappText };

  /* ---------- Pantalla ---------- */

  var admin = window.MakkaAdmin;
  if (!admin || !admin.allowed) {
    return;
  }

  var Auth = window.MakkaAuth;
  var Requests = window.MakkaSolicitudes;
  var Utils = window.MakkaAdminUI;

  function byId(id) { return document.getElementById(id); }

  var state = { tab: "todas", query: "", selected: "" };
  var wide = window.matchMedia ? window.matchMedia("(min-width: 1100px)") : { matches: true };

  var params = new URLSearchParams(window.location.search);
  if (params.get("tab")) { state.tab = tabById(params.get("tab")).id; }
  if (params.get("id")) { state.selected = params.get("id"); }

  function profileOf(email) {
    var key = String(email || "").toLowerCase();
    var found = Auth.listUsers().filter(function (user) { return String(user.email).toLowerCase() === key; })[0];
    if (!found) { return { nombre: "", telefono: "" }; }
    return { nombre: (String(found.nombre || "") + " " + String(found.apellido || "")).trim(), telefono: found.telefono || "" };
  }

  function chip(status) {
    var key = STATUS_KEY[status] || "en-revision";
    return '<span class="chip status status--' + key + '">' + esc(status) + "</span>";
  }

  function fileCell(request) {
    if (!request.archivo3d) { return '<span class="dash-note">Sin archivo</span>'; }
    if (request.archivoEstado === "aprobado") { return "Aprobado"; }
    if (request.archivoEstado === "rechazado") { return "Rechazado"; }
    return "Por revisar";
  }

  /* ----- Pestañas y lista ----- */
  function renderTabs(requests) {
    var counts = tabCounts(requests);
    byId("per-tabs").innerHTML = TABS.map(function (tab) {
      var on = tab.id === state.tab;
      return '<button class="ord-tab' + (on ? " is-active" : "") + '" type="button" role="tab" id="tab-' + tab.id + '" aria-selected="' + on + '" tabindex="' + (on ? 0 : -1) + '" data-tab="' + tab.id + '">' +
        esc(tab.label) + '<span class="ord-tab__count' + (tab.id === "revision" && counts.revision ? " is-alert" : "") + '">' + counts[tab.id] + "</span></button>";
    }).join("");
  }

  function renderList(requests) {
    var tab = tabById(state.tab);
    var rows = newestFirst(requests.filter(tab.match)).filter(function (request) {
      return matchesSearch(request, profileOf(request.correo).nombre, state.query);
    });
    byId("per-vacio").hidden = rows.length > 0;
    byId("per-tabla").hidden = rows.length === 0;
    byId("per-vacio-texto").textContent = state.query.trim() ? "No encontramos solicitudes con esa búsqueda." : tab.empty;
    byId("demo-cargar").hidden = requests.length > 0;

    byId("per-cuerpo").innerHTML = rows.map(function (request) {
      var selected = request.id === state.selected;
      var profile = profileOf(request.correo);
      return '<tr class="' + (selected ? "is-selected" : "") + '" data-id="' + esc(request.id) + '">' +
        '<td data-label="#"><button class="ord-row" type="button" data-id="' + esc(request.id) + '"' + (selected ? ' aria-current="true"' : "") + ">" + esc(request.id) + "</button></td>" +
        '<td data-label="Cliente">' + esc(profile.nombre || request.correo || "Sin correo") + "</td>" +
        '<td data-label="Tipo de producto">' + esc(request.categoriaNombre || "") + "</td>" +
        '<td data-label="Fecha">' + esc(Utils.formatDate(request.creada)) + "</td>" +
        '<td data-label="Archivo">' + fileCell(request) + "</td>" +
        '<td data-label="Estatus">' + chip(request.estatus) + "</td></tr>";
    }).join("");
  }

  /* ----- Detalle ----- */
  function row(label, value) {
    if (value === undefined || value === null || value === "") { return ""; }
    return '<div class="ord-data__row"><dt>' + esc(label) + "</dt><dd>" + esc(value) + "</dd></div>";
  }

  function fileHtml(request) {
    if (!request.archivo3d) {
      return '<p class="dash-note">El cliente no mandó archivo 3D.</p>';
    }
    var html = '<p class="ord-proof">' + Utils.icon("file", 22) + "<span><strong>" + esc(request.archivo3d.nombre) + "</strong><br><small>" + Utils.fileSize(request.archivo3d.tamano) + " · la descarga estará disponible cuando exista el servidor</small></span></p>";
    if (request.archivoEstado === "aprobado") { html += '<p class="ord-eta">' + Utils.icon("check", 20) + "<span>Archivo aprobado</span></p>"; }
    if (request.archivoEstado === "rechazado") {
      html += '<p class="ord-warn">' + Utils.icon("alert", 20) + "<span>" + esc(FILE_ERROR) + (request.archivoNota ? " Nota: " + esc(request.archivoNota) : "") + "</span></p>";
    }
    if (request.estatus === "En revisión") {
      html += '<div class="form-group"><label class="form-label" for="per-nota-archivo">Nota si lo rechazas <span class="form-label__opt">Opcional</span></label>' +
        '<div class="field"><input class="field__input" id="per-nota-archivo" type="text" maxlength="200" placeholder="Ej. El archivo viene dañado"></div></div>' +
        '<div class="ord-btns"><button class="btn btn--honey btn--sm" type="button" data-action="aprobar-archivo">Aprobar archivo</button>' +
        '<button class="btn btn--white btn--sm" type="button" data-action="rechazar-archivo">Rechazar archivo</button></div>';
    }
    return html;
  }

  function quoteHtml(request) {
    var open = request.estatus === "En revisión" || request.estatus === "Cotizado";
    var html = "";
    if (request.cotizacion) {
      html += '<p class="ord-eta">' + Utils.icon("receipt", 20) + "<span>Cotización enviada: <strong>" + Utils.money(request.cotizacion) + " MXN</strong>" + (request.notasCotizacion ? "<br>" + esc(request.notasCotizacion) : "") + "</span></p>";
    }
    if (open) {
      html += '<div class="form-group"><label class="form-label" for="per-precio">Precio cotizado (MXN)</label>' +
        '<div class="field"><input class="field__input" id="per-precio" type="number" inputmode="decimal" min="0" step="0.01" value="' + (request.cotizacion || "") + '" placeholder="0.00"></div></div>' +
        '<div class="form-group"><label class="form-label" for="per-notas">Notas para el cliente <span class="form-label__opt">Opcional</span></label>' +
        '<textarea class="field__textarea" id="per-notas" rows="3" maxlength="300" placeholder="Ej. Entrega en 8 días hábiles">' + esc(request.notasCotizacion || "") + "</textarea></div>" +
        '<p class="form-error" id="per-error" role="alert" hidden></p>' +
        '<div class="ord-btns"><button class="btn btn--honey btn--sm" type="button" data-action="cotizar">' + Utils.icon("receipt", 20).replace("<img", '<img class="btn__icon"') + (request.estatus === "Cotizado" ? "Actualizar cotización" : "Enviar cotización") + "</button></div>";
    }
    return html;
  }

  function actionsHtml(request) {
    var html = "";
    if (request.estatus === "Cotizado") {
      html += '<div class="ord-btns"><button class="btn btn--violet btn--sm" type="button" data-action="aceptar">El cliente aceptó</button></div>';
    }
    if (request.estatus === "En revisión" || request.estatus === "Cotizado") {
      html += '<details class="ord-fold"><summary>Rechazar solicitud</summary>' +
        '<div class="form-group"><label class="form-label" for="per-motivo">Motivo <span class="form-label__opt">Opcional</span></label>' +
        '<textarea class="field__textarea" id="per-motivo" rows="3" maxlength="300" placeholder="Ej. Excede el tamaño máximo de impresión"></textarea></div>' +
        '<div class="ord-btns"><button class="btn btn--white btn--sm" type="button" data-action="rechazar">Rechazar solicitud</button></div></details>';
    }
    if (request.estatus === "Rechazado" && request.motivoRechazo) {
      html += '<p class="ord-cancel-note">' + Utils.icon("alert", 20) + "<span>" + esc(request.motivoRechazo) + "</span></p>";
    }
    return html;
  }

  function detailHtml(request) {
    var profile = profileOf(request.correo);
    var name = profile.nombre || request.correo || "Sin correo";
    var wa = Utils.whatsapp(profile.telefono, whatsappText(request, profile.nombre, Utils.money));
    var refs = (request.imagenesReferencia || []).map(function (file) { return file.nombre; }).join(", ");

    return '<div class="ord-detail__head"><div><h2 class="dash-card__title" id="per-detalle-titulo" tabindex="-1">Solicitud ' + esc(request.id) + '</h2><p class="dash-note">' + esc(Utils.formatDate(request.creada)) + "</p></div>" + chip(request.estatus) + "</div>" +
      '<div class="ord-block"><h3 class="ord-block__title">Cliente</h3><p class="ord-client"><strong>' + esc(name) + "</strong><br>" + esc(request.correo || "") + (profile.telefono ? "<br>" + esc(profile.telefono) : "") + "</p>" +
      (wa ? '<a class="btn btn--violet btn--sm" href="' + esc(wa) + '" target="_blank" rel="noopener noreferrer">Avisar por WhatsApp</a>' : '<p class="dash-note">Sin teléfono registrado para avisar por WhatsApp.</p>') + "</div>" +
      '<div class="ord-block"><h3 class="ord-block__title">Lo que pidió</h3><dl class="ord-data">' +
      row("Qué quiere pedir", request.tipoPedido) + row("Producto del catálogo", request.producto && request.producto.nombre) + row("Tipo de producto", request.categoriaNombre) +
      row("Colores", (request.colores || []).join(", ")) + row("Material", request.material) + row("Tamaño aproximado", request.tamano) +
      row("Descripción", request.descripcion) + row("Texto o nombre a incluir", request.texto) + row("Cantidad", request.cantidad) +
      row("Fecha en que lo necesita", request.fechaNecesaria ? Utils.formatDate(request.fechaNecesaria) : "") + row("Imágenes de referencia", refs) +
      "</dl></div>" +
      '<div class="ord-block"><h3 class="ord-block__title">Archivo 3D</h3>' + fileHtml(request) + "</div>" +
      '<div class="ord-block"><h3 class="ord-block__title">Cotización</h3>' + quoteHtml(request) + "</div>" +
      (actionsHtml(request) ? '<div class="ord-block">' + actionsHtml(request) + "</div>" : "");
  }

  function renderDetail(requests) {
    var request = requests.filter(function (item) { return item.id === state.selected; })[0];
    byId("per-detalle-vacio").hidden = !!request;
    byId("per-detalle-contenido").hidden = !request;
    byId("per-detalle-contenido").innerHTML = request ? detailHtml(request) : "";
  }

  function render() {
    var requests = Requests.list();
    renderTabs(requests);
    renderList(requests);
    renderDetail(requests);
  }

  function select(id, focus) {
    state.selected = id;
    render();
    if (focus) {
      var title = byId("per-detalle-titulo");
      if (title) {
        if (!wide.matches) { byId("per-detalle").scrollIntoView({ block: "start" }); }
        title.focus({ preventScroll: true });
      }
    }
  }

  function setTab(id) {
    state.tab = tabById(id).id;
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, "", state.tab === "todas" ? "admin-personalizados.html" : "admin-personalizados.html?tab=" + state.tab);
    }
    render();
  }

  /* ----- Eventos ----- */
  byId("per-tabs").addEventListener("click", function (event) {
    var button = event.target.closest("[data-tab]");
    if (button) { setTab(button.getAttribute("data-tab")); byId("tab-" + state.tab).focus(); }
  });

  byId("per-tabs").addEventListener("keydown", function (event) {
    var keys = { ArrowRight: 1, ArrowLeft: -1 };
    if (!keys[event.key]) { return; }
    event.preventDefault();
    var index = TABS.indexOf(tabById(state.tab));
    setTab(TABS[(index + keys[event.key] + TABS.length) % TABS.length].id);
    byId("tab-" + state.tab).focus();
  });

  byId("per-cuerpo").addEventListener("click", function (event) {
    var row = event.target.closest("[data-id]");
    if (row) { select(row.getAttribute("data-id"), true); }
  });

  byId("per-buscar").addEventListener("input", function (event) {
    state.query = event.target.value;
    renderList(Requests.list());
  });

  byId("demo-cargar").addEventListener("click", function () {
    if (!window.MakkaDemo || !window.MakkaDemo.load()) { Utils.toast("No se pudieron cargar los datos de ejemplo"); return; }
    render();
    Utils.toast("Cargamos datos de ejemplo");
  });

  function showError(message) {
    var box = byId("per-error");
    if (!box) { Utils.toast(message); return; }
    box.textContent = message;
    box.hidden = false;
  }

  function done(result, message) {
    if (!result.ok) { showError(ERRORS[result.error] || ERRORS.guardar); return; }
    render();
    Utils.toast(message);
  }

  byId("per-detalle").addEventListener("click", function (event) {
    var button = event.target.closest("[data-action]");
    if (!button || !state.selected) { return; }
    var id = state.selected;
    var action = button.getAttribute("data-action");
    var field = function (name) { var node = byId(name); return node ? node.value : ""; };

    if (action === "aprobar-archivo") {
      done(Requests.approveFile(id), "Archivo aprobado");
    } else if (action === "rechazar-archivo") {
      var result = Requests.rejectFile(id, field("per-nota-archivo"));
      done(result, FILE_ERROR);
    } else if (action === "cotizar") {
      var wasQuoted = (Requests.list().filter(function (item) { return item.id === id; })[0] || {}).estatus === "Cotizado";
      done(Requests.quote(id, field("per-precio"), field("per-notas")), (wasQuoted ? "Cotización actualizada" : "Cotización guardada") + ". Avísale al cliente por WhatsApp.");
    } else if (action === "aceptar") {
      done(Requests.accept(id), "Solicitud aceptada");
    } else if (action === "rechazar") {
      done(Requests.reject(id, field("per-motivo")), "Solicitud rechazada");
    }
  });

  render();
})();
