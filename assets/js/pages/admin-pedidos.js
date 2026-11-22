/*
 * Pedidos y pagos (administrador).
 * Lee y cambia las compras con window.MakkaCompras; cuando exista el backend, solo cambia ese servicio.
 * Las revisiones de esta pantalla son comodidad: el backend debe validar el rol y las transiciones de estatus.
 */
(function () {
  "use strict";

  var UI = window.MakkaUI;
  var esc = UI.escapeHtml;

  var STATUS = {
    "pago-pendiente": "Pago pendiente de validación",
    "pago-validado": "Pago validado",
    "en-produccion": "En producción",
    "enviado": "Enviado",
    "entregado": "Entregado",
    "cancelado": "Cancelado"
  };

  /* Pestañas (brief): cada una filtra con "match". "Todos" no incluye lo archivado; "Historial" reúne lo archivado y lo cancelado. */
  var TABS = [
    { id: "todos", label: "Todos", empty: "Todavía no hay pedidos.", match: function (p) { return !p.archivada; } },
    { id: "pagos", label: "Validar pago", empty: "No hay pagos por validar. ¡Todo al día!", match: function (p) { return p.estatus === "pago-pendiente" && !p.archivada; } },
    { id: "produccion", label: "En producción", empty: "No hay pedidos en producción.", match: function (p) { return (p.estatus === "pago-validado" || p.estatus === "en-produccion") && !p.archivada; } },
    { id: "enviados", label: "Enviados", empty: "No hay pedidos enviados.", match: function (p) { return p.estatus === "enviado" && !p.archivada; } },
    { id: "entregados", label: "Entregados", empty: "No hay pedidos entregados sin archivar.", match: function (p) { return p.estatus === "entregado" && !p.archivada; } },
    { id: "historial", label: "Historial", empty: "El historial está vacío.", match: function (p) { return !!p.archivada || p.estatus === "cancelado"; } }
  ];

  var ERRORS = {
    "estatus": "Este pedido ya cambió de estatus. Revisa la lista.",
    "sin-comprobante": "Este pedido no tiene comprobante de pago.",
    "fecha": "Elige una fecha de entrega válida.",
    "no-permitido": "Ese cambio no está permitido para este pedido.",
    "no-existe": "No encontramos el pedido.",
    "guardar": "No se pudo guardar el cambio. Intenta de nuevo."
  };

  var MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  /* ---------- Funciones puras ---------- */

  function tabById(id) {
    return TABS.filter(function (tab) { return tab.id === id; })[0] || TABS[0];
  }

  function newestFirst(purchases) {
    return purchases.slice().sort(function (a, b) { return new Date(b.fecha) - new Date(a.fecha); });
  }

  function pieces(purchase) {
    return (purchase.lineas || []).reduce(function (sum, line) { return sum + (Number(line.cantidad) || 0); }, 0);
  }

  function tabCounts(purchases) {
    var counts = {};
    TABS.forEach(function (tab) { counts[tab.id] = purchases.filter(tab.match).length; });
    return counts;
  }

  function matchesSearch(purchase, name, query) {
    var text = String(query || "").trim().toLowerCase();
    if (!text) { return true; }
    return [purchase.folio, purchase.correo, name].join(" ").toLowerCase().indexOf(text) !== -1;
  }

  function isoDate(date) {
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  }

  /* "2026-11-12" o "2026-11-12T10:00:00.000Z" -> "12 de noviembre de 2026" */
  function formatDate(value) {
    var only = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
    var date = only ? new Date(Number(only[1]), Number(only[2]) - 1, Number(only[3])) : new Date(value);
    if (isNaN(date.getTime())) { return ""; }
    return date.getDate() + " de " + MONTHS[date.getMonth()] + " de " + date.getFullYear();
  }

  function fileSize(bytes) {
    var size = Number(bytes) || 0;
    if (size >= 1048576) { return (size / 1048576).toFixed(1) + " MB"; }
    return Math.max(1, Math.round(size / 1024)) + " KB";
  }

  /* Siguiente paso del flujo: { status, label } o null */
  function nextStep(purchase) {
    var next = (window.MakkaCompras.NEXT[purchase.estatus] || [])[0];
    if (!next) { return null; }
    var labels = { "en-produccion": "Pasar a producción", "enviado": "Marcar como enviado", "entregado": "Marcar como entregado" };
    return { status: next, label: labels[next] };
  }

  /* Mensaje de WhatsApp para avisar al cliente; "" si no hay teléfono de 10 dígitos */
  function whatsappUrl(phone, name, purchase) {
    var digits = String(phone || "").replace(/\D/g, "");
    if (digits.length !== 10) { return ""; }
    var hello = "Hola " + (name || "") + ", ";
    var folio = "#" + purchase.folio;
    var eta = purchase.entregaEstimada ? " Entrega estimada: " + formatDate(purchase.entregaEstimada) + "." : "";
    var text;
    switch (purchase.estatus) {
      case "pago-validado": text = hello + "validamos tu pago del pedido " + folio + "." + eta; break;
      case "en-produccion": text = hello + "ya estamos preparando tu pedido " + folio + "." + eta; break;
      case "enviado": text = hello + "tu pedido " + folio + " ya va en camino." + eta; break;
      case "entregado": text = hello + "tu pedido " + folio + " quedó entregado. ¡Gracias por tu compra!"; break;
      case "cancelado": text = hello + "tu pedido " + folio + " fue cancelado." + (purchase.motivo ? " Motivo: " + purchase.motivo : ""); break;
      default:
        text = purchase.pagoRechazado
          ? hello + "no pudimos validar el comprobante del pedido " + folio + "." + (purchase.observacionPago ? " " + purchase.observacionPago : "") + " ¿Nos lo puedes enviar de nuevo?"
          : hello + "recibimos tu comprobante del pedido " + folio + " y lo estamos revisando.";
    }
    return "https://wa.me/52" + digits + "?text=" + encodeURIComponent(text);
  }

  window.MakkaPedidosLogic = {
    TABS: TABS, tabById: tabById, tabCounts: tabCounts, matchesSearch: matchesSearch, newestFirst: newestFirst,
    pieces: pieces, nextStep: nextStep, whatsappUrl: whatsappUrl, formatDate: formatDate, isoDate: isoDate, fileSize: fileSize
  };

  /* ---------- Pantalla ---------- */

  var admin = window.MakkaAdmin;
  if (!admin || !admin.allowed) {
    return;
  }

  var Auth = window.MakkaAuth;
  var Compras = window.MakkaCompras;

  function byId(id) { return document.getElementById(id); }
  function money(value) { return UI.formatPrice(value, 2); }
  function toast(message) {
    if (window.MakkaToast && window.MakkaToast.show) { window.MakkaToast.show({ mensaje: message }); }
  }
  function icon(file, size) {
    return '<img src="assets/img/icons/' + file + '.svg" alt="" width="' + (size || 22) + '" height="' + (size || 22) + '">';
  }

  var state = { tab: "todos", query: "", selected: "" };
  var wide = window.matchMedia ? window.matchMedia("(min-width: 1100px)") : { matches: true };

  var params = new URLSearchParams(window.location.search);
  if (params.get("tab")) { state.tab = tabById(params.get("tab")).id; }
  if (params.get("folio")) { state.selected = params.get("folio"); }

  function users() { return Auth.listUsers(); }

  function profileOf(email) {
    var key = String(email || "").toLowerCase();
    var found = users().filter(function (user) { return String(user.email).toLowerCase() === key; })[0];
    if (!found) { return { nombre: "", telefono: "" }; }
    return { nombre: (String(found.nombre || "") + " " + String(found.apellido || "")).trim(), telefono: found.telefono || "" };
  }

  function displayName(purchase) { return profileOf(purchase.correo).nombre || purchase.correo || "Sin correo"; }

  function findPurchase(folio) {
    return Compras.list().filter(function (purchase) { return purchase.folio === folio; })[0];
  }

  /* ----- Pestañas ----- */
  function renderTabs(purchases) {
    var counts = tabCounts(purchases);
    byId("ped-tabs").innerHTML = TABS.map(function (tab) {
      var on = tab.id === state.tab;
      return '<button class="ord-tab' + (on ? " is-active" : "") + '" type="button" role="tab" id="tab-' + tab.id + '" aria-selected="' + on + '" tabindex="' + (on ? 0 : -1) + '" data-tab="' + tab.id + '">' +
        esc(tab.label) + '<span class="ord-tab__count' + (tab.id === "pagos" && counts.pagos ? " is-alert" : "") + '">' + counts[tab.id] + "</span></button>";
    }).join("");
  }

  /* ----- Lista ----- */
  function renderList(purchases) {
    var tab = tabById(state.tab);
    var rows = newestFirst(purchases.filter(tab.match)).filter(function (purchase) {
      return matchesSearch(purchase, profileOf(purchase.correo).nombre, state.query);
    });

    byId("ped-vacio").hidden = rows.length > 0;
    byId("ped-tabla").hidden = rows.length === 0;
    byId("ped-vacio-texto").textContent = state.query.trim() ? "No encontramos pedidos con esa búsqueda." : tab.empty;
    byId("demo-cargar").hidden = purchases.length > 0;

    byId("ped-cuerpo").innerHTML = rows.map(function (purchase) {
      var selected = purchase.folio === state.selected;
      return '<tr class="' + (selected ? "is-selected" : "") + '" data-folio="' + esc(purchase.folio) + '">' +
        '<td data-label="Pedido"><button class="ord-row" type="button" data-folio="' + esc(purchase.folio) + '"' + (selected ? ' aria-current="true"' : "") + '>#' + esc(purchase.folio) + "</button></td>" +
        '<td data-label="Fecha">' + esc(formatDate(purchase.fecha)) + "</td>" +
        '<td data-label="Cliente">' + esc(displayName(purchase)) + "</td>" +
        '<td data-label="Piezas">' + pieces(purchase) + "</td>" +
        '<td data-label="Total"><span class="dash-table__money">' + money(purchase.total) + "</span></td>" +
        '<td data-label="Estatus"><span class="chip status status--' + esc(purchase.estatus) + '">' + esc(STATUS[purchase.estatus] || purchase.estatus) + "</span></td>" +
        "</tr>";
    }).join("");
  }

  /* ----- Detalle ----- */
  var STEPS = [
    { key: "pago", label: "Pago", icon: "card" },
    { key: "produccion", label: "Producción", icon: "printer" },
    { key: "enviado", label: "Enviado", icon: "truck" },
    { key: "entregado", label: "Entregado", icon: "check" }
  ];

  /* Cuántos pasos del avance ya están completos según el estatus */
  function stepsDone(status) {
    return { "pago-pendiente": 0, "pago-validado": 1, "en-produccion": 1, "enviado": 2, "entregado": 4 }[status] || 0;
  }

  function stepsHtml(purchase) {
    if (purchase.estatus === "cancelado") {
      return '<p class="ord-cancel-note">' + icon("alert", 20) + "<span>Pedido cancelado" + (purchase.motivo ? ": " + esc(purchase.motivo) : "") + "</span></p>";
    }
    var done = stepsDone(purchase.estatus);
    var current = purchase.estatus === "pago-validado" ? 1 : purchase.estatus === "en-produccion" ? 1 : done;
    return '<ol class="ord-steps" aria-label="Avance del pedido">' + STEPS.map(function (step, index) {
      var cls = index < done ? "is-done" : index === current ? "is-current" : "";
      return '<li class="ord-step ' + cls + '"' + (cls === "is-current" ? ' aria-current="step"' : "") + '><span class="ord-step__dot">' + icon(step.icon, 18) + "</span><span>" + step.label + "</span></li>";
    }).join("") + "</ol>";
  }

  function actionsHtml(purchase) {
    var status = purchase.estatus;
    var html = "";
    var step = nextStep(purchase);

    if (status === "pago-pendiente") {
      var defaultDate = isoDate(new Date(Date.now() + 7 * 86400000));
      html += '<div class="ord-block"><h3 class="ord-block__title">Validar pago</h3>' +
        (purchase.comprobante ? "" : '<p class="form-error">Este pedido no tiene comprobante.</p>') +
        '<div class="form-group"><label class="form-label" for="ped-entrega">Fecha estimada de entrega</label>' +
        '<div class="field"><input class="field__input" id="ped-entrega" type="date" min="' + isoDate(new Date()) + '" value="' + defaultDate + '"></div></div>' +
        '<p class="form-error" id="ped-error" hidden></p>' +
        '<div class="ord-btns"><button class="btn btn--honey btn--sm" type="button" data-action="validar"' + (purchase.comprobante ? "" : " disabled") + ">" + icon("check", 20).replace("<img", '<img class="btn__icon"') + "Validar pago</button></div>" +
        '<details class="ord-fold"><summary>Rechazar comprobante</summary>' +
        '<div class="form-group"><label class="form-label" for="ped-obs">Observación para el cliente <span class="form-label__opt">(opcional)</span></label>' +
        '<textarea class="field__textarea" id="ped-obs" rows="3" maxlength="300" placeholder="Ej. La imagen se ve cortada"></textarea></div>' +
        '<div class="ord-btns"><button class="btn btn--white btn--sm" type="button" data-action="rechazar">Rechazar pago</button></div></details></div>';
    } else if (step) {
      html += '<div class="ord-block"><h3 class="ord-block__title">Siguiente paso</h3><div class="ord-btns"><button class="btn btn--honey btn--sm" type="button" data-action="avanzar" data-next="' + step.status + '">' + step.label + "</button></div></div>";
    }

    if (["pago-validado", "en-produccion", "enviado"].indexOf(status) !== -1) {
      html += '<div class="ord-block"><h3 class="ord-block__title">Entrega estimada</h3>' +
        '<div class="form-group"><label class="form-label" for="ped-entrega">Fecha</label>' +
        '<div class="field"><input class="field__input" id="ped-entrega" type="date" value="' + esc(purchase.entregaEstimada || "") + '"></div></div>' +
        '<p class="form-error" id="ped-error" hidden></p>' +
        '<div class="ord-btns"><button class="btn btn--white btn--sm" type="button" data-action="fecha">Guardar fecha</button></div></div>';
    }

    if (Compras.ADMIN_CANCELABLES.indexOf(status) !== -1) {
      html += '<div class="ord-block"><details class="ord-fold"><summary>Cancelar pedido</summary>' +
        '<div class="form-group"><label class="form-label" for="ped-motivo">Motivo <span class="form-label__opt">(opcional)</span></label>' +
        '<textarea class="field__textarea" id="ped-motivo" rows="3" maxlength="300" placeholder="Ej. El cliente pidió cancelar"></textarea></div>' +
        '<div class="ord-btns"><button class="btn btn--white btn--sm" type="button" data-action="cancelar">Confirmar cancelación</button></div></details></div>';
    }

    if (status === "entregado" || status === "cancelado") {
      html += purchase.archivada
        ? '<p class="dash-note">Este pedido ya está en el historial.</p>'
        : '<div class="ord-block"><div class="ord-btns"><button class="btn btn--white btn--sm" type="button" data-action="archivar">' + icon("archive", 20).replace("<img", '<img class="btn__icon"') + "Mover al historial</button></div></div>";
    }
    return html;
  }

  function detailHtml(purchase) {
    var profile = profileOf(purchase.correo);
    var name = profile.nombre || purchase.correo || "Sin correo";
    var wa = whatsappUrl(profile.telefono, profile.nombre || "", purchase);

    var lines = (purchase.lineas || []).map(function (line) {
      var meta = [line.material, line.color].filter(Boolean).join(" · ");
      return '<li class="ord-line"><div><p class="ord-line__name">' + esc(line.cantidad) + " × " + esc(line.nombre) + "</p>" +
        (meta ? '<p class="ord-line__meta">' + esc(meta) + "</p>" : "") + "</div>" +
        '<span class="ord-line__price">' + money(line.precio * line.cantidad) + "</span></li>";
    }).join("");

    var proof = purchase.comprobante
      ? '<p class="ord-proof">' + icon("receipt", 22) + "<span><strong>" + esc(purchase.comprobante.nombre) + "</strong><br><small>" + fileSize(purchase.comprobante.tamano) + " · el archivo completo lo recibirá el servidor</small></span></p>"
      : '<p class="form-error">Sin comprobante</p>';

    var rejected = purchase.estatus === "pago-pendiente" && purchase.pagoRechazado
      ? '<p class="ord-warn">' + icon("alert", 20) + "<span>Pago rechazado el " + esc(formatDate(purchase.pagoRechazado)) + (purchase.observacionPago ? ": " + esc(purchase.observacionPago) : "") + "</span></p>"
      : "";

    return '<div class="ord-detail__head"><div><h2 class="dash-card__title" id="ped-detalle-titulo" tabindex="-1">Pedido #' + esc(purchase.folio) + '</h2><p class="dash-note">' + esc(formatDate(purchase.fecha)) + "</p></div>" +
      '<span class="chip status status--' + esc(purchase.estatus) + '">' + esc(STATUS[purchase.estatus] || purchase.estatus) + "</span></div>" +
      stepsHtml(purchase) +
      (purchase.entregaEstimada && purchase.estatus !== "cancelado" ? '<p class="ord-eta">' + icon("calendar", 20) + "<span>Entrega estimada: " + esc(formatDate(purchase.entregaEstimada)) + "</span></p>" : "") +
      rejected +
      '<div class="ord-block"><h3 class="ord-block__title">Cliente</h3><p class="ord-client"><strong>' + esc(name) + "</strong><br>" + esc(purchase.correo || "") +
      (profile.telefono ? "<br>" + esc(profile.telefono) : "") + "</p>" +
      (wa ? '<a class="btn btn--violet btn--sm" href="' + esc(wa) + '" target="_blank" rel="noopener noreferrer">Avisar por WhatsApp</a>' : '<p class="dash-note">Sin teléfono registrado para avisar por WhatsApp.</p>') + "</div>" +
      '<div class="ord-block"><h3 class="ord-block__title">Piezas</h3><ul class="ord-lines">' + lines + '</ul><p class="ord-total"><span>Total</span><strong>' + money(purchase.total) + " MXN</strong></p></div>" +
      '<div class="ord-block"><h3 class="ord-block__title">Comprobante de pago</h3>' + proof + "</div>" +
      actionsHtml(purchase);
  }

  function renderDetail(purchases) {
    var purchase = purchases.filter(function (item) { return item.folio === state.selected; })[0];
    byId("ped-detalle-vacio").hidden = !!purchase;
    byId("ped-detalle-contenido").hidden = !purchase;
    byId("ped-detalle-contenido").innerHTML = purchase ? detailHtml(purchase) : "";
  }

  function render() {
    var purchases = Compras.list();
    renderTabs(purchases);
    renderList(purchases);
    renderDetail(purchases);
  }

  function select(folio, focus) {
    state.selected = folio;
    render();
    if (focus) {
      var title = byId("ped-detalle-titulo");
      if (title) {
        if (!wide.matches) { byId("ped-detalle").scrollIntoView({ block: "start" }); }
        title.focus({ preventScroll: true });
      }
    }
  }

  function setTab(id) {
    state.tab = tabById(id).id;
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, "", state.tab === "todos" ? "admin-pedidos.html" : "admin-pedidos.html?tab=" + state.tab);
    }
    render();
  }

  /* ----- Eventos ----- */
  byId("ped-tabs").addEventListener("click", function (event) {
    var button = event.target.closest("[data-tab]");
    if (button) { setTab(button.getAttribute("data-tab")); byId("tab-" + state.tab).focus(); }
  });

  byId("ped-tabs").addEventListener("keydown", function (event) {
    var keys = { ArrowRight: 1, ArrowLeft: -1 };
    if (!keys[event.key]) { return; }
    event.preventDefault();
    var index = TABS.indexOf(tabById(state.tab));
    setTab(TABS[(index + keys[event.key] + TABS.length) % TABS.length].id);
    byId("tab-" + state.tab).focus();
  });

  byId("ped-cuerpo").addEventListener("click", function (event) {
    var row = event.target.closest("[data-folio]");
    if (row) { select(row.getAttribute("data-folio"), true); }
  });

  byId("ped-buscar").addEventListener("input", function (event) {
    state.query = event.target.value;
    renderList(Compras.list());
  });

  byId("demo-cargar").addEventListener("click", function () {
    if (!window.MakkaDemo || !window.MakkaDemo.load()) { toast("No se pudieron cargar los datos de ejemplo"); return; }
    render();
    toast("Cargamos datos de ejemplo");
  });

  function showError(message) {
    var box = byId("ped-error");
    if (!box) { toast(message); return; }
    box.textContent = message;
    box.hidden = false;
  }

  function done(result, message) {
    if (!result.ok) {
      showError(ERRORS[result.error] || ERRORS.guardar);
      return;
    }
    render();
    toast(message);
  }

  byId("ped-detalle").addEventListener("click", function (event) {
    var button = event.target.closest("[data-action]");
    if (!button || !state.selected) { return; }
    var folio = state.selected;
    var action = button.getAttribute("data-action");
    var field = function (id) { var node = byId(id); return node ? node.value : ""; };

    if (action === "validar") {
      var date = field("ped-entrega");
      if (!date) { showError("Elige la fecha estimada de entrega."); return; }
      done(Compras.validatePayment(folio, date), "Pago validado");
    } else if (action === "rechazar") {
      done(Compras.rejectPayment(folio, field("ped-obs")), "Pago rechazado");
    } else if (action === "avanzar") {
      done(Compras.setStatus(folio, button.getAttribute("data-next")), "Estatus actualizado");
    } else if (action === "fecha") {
      done(Compras.setDelivery(folio, field("ped-entrega")), "Fecha de entrega guardada");
    } else if (action === "cancelar") {
      done(Compras.cancelByAdmin(folio, field("ped-motivo")), "Pedido cancelado");
    } else if (action === "archivar") {
      done(Compras.archive(folio), "Pedido movido al historial");
    }
  });

  render();
})();
