(function () {
  "use strict";

  var UI = window.MakkaUI;
  var esc = UI.escapeHtml;

  var MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  /* Textos de cada estatus. La clave es la que guarda compras.js (o el texto de solicitudes.js). */
  var STATUS = {
    "pago-pendiente": "Pago pendiente de validación",
    "pago-validado": "Pago validado",
    "en-produccion": "En producción",
    "enviado": "Enviado",
    "entregado": "Entregado",
    "cancelado": "Cancelado",
    "en-revision": "En revisión",
    "cotizado": "Cotizado",
    "aceptado": "Aceptado",
    "rechazado": "Rechazado"
  };

  /* Estatus que pasan a la pestaña "Historial" */
  var HISTORY = ["entregado", "cancelado", "rechazado"];

  /* ---------- Funciones puras ---------- */

  /* "2026-11-12T10:00:00.000Z" o "2026-11-12" -> "12 de noviembre de 2026" */
  function formatDate(iso) {
    var only = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
    var date = only ? new Date(Number(only[1]), Number(only[2]) - 1, Number(only[3])) : new Date(iso);
    if (isNaN(date.getTime())) { return ""; }
    return date.getDate() + " de " + MONTHS[date.getMonth()] + " de " + date.getFullYear();
  }

  /* Las solicitudes guardan el estatus como texto ("En revisión"); lo convertimos a clave ("en-revision"). */
  function statusKey(text) {
    return String(text).toLowerCase().replace(/ó/g, "o").replace(/\s+/g, "-");
  }

  function isHistory(order) {
    return HISTORY.indexOf(order.status) !== -1;
  }

  /* Une compras y solicitudes de esta persona en una sola lista, de la más nueva a la más vieja. */
  function buildOrders(purchases, requests, email) {
    var mine = String(email || "").toLowerCase();
    var list = [];

    purchases.forEach(function (purchase) {
      if (String(purchase.correo).toLowerCase() !== mine) { return; }
      list.push({ type: "compra", id: purchase.folio, date: purchase.fecha, status: purchase.estatus, data: purchase });
    });

    requests.forEach(function (request) {
      if (String(request.correo || "").toLowerCase() !== mine) { return; }
      list.push({ type: "personalizado", id: request.id, date: request.creada, status: statusKey(request.estatus), data: request });
    });

    return list.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
  }

  /* Texto de "Entrega estimada" según el estatus. La fecha (entregaEstimada) la pone el administrador al validar el pago. */
  function deliveryText(purchase) {
    if (purchase.estatus === "entregado" || purchase.estatus === "cancelado") { return ""; }
    if (purchase.entregaEstimada) { return "Entrega estimada: " + formatDate(purchase.entregaEstimada) + ". Si cambia, te avisamos por WhatsApp."; }
    if (purchase.estatus === "pago-pendiente") { return "Entrega estimada: te confirmaremos la fecha cuando validemos tu pago."; }
    return "Entrega estimada: por confirmar. Te avisamos por WhatsApp en cuanto la tengamos.";
  }

  function canCancel(order) {
    return order.type === "compra" && window.MakkaCompras.CANCELABLES.indexOf(order.status) !== -1;
  }

  window.MakkaMisComprasLogic = { deliveryText: deliveryText, formatDate: formatDate, statusKey: statusKey, buildOrders: buildOrders, isHistory: isHistory, STATUS: STATUS };

  /* ---------- Interfaz ---------- */

  var list = document.getElementById("lista-compras");
  if (!list) {
    return;
  }

  var boxes = {
    sesion: document.getElementById("estado-sesion"),
    vacio: document.getElementById("estado-vacio"),
    contenido: document.getElementById("compras-contenido")
  };
  var tabs = { actuales: document.getElementById("tab-actuales"), historial: document.getElementById("tab-historial") };
  var counts = { actuales: document.getElementById("cuenta-actuales"), historial: document.getElementById("cuenta-historial") };
  var emptyList = document.getElementById("lista-vacia");
  var dialog = document.getElementById("dialogo-cancelar");
  var dialogFolio = document.getElementById("cancelar-folio");
  var dialogReason = document.getElementById("cancelar-motivo");

  var orders = [];
  var tab = "actuales";
  var toCancel = "";
  var lastButton = null;

  function money(value) { return UI.formatPrice(value, 2); }

  function show(name) {
    Object.keys(boxes).forEach(function (key) { boxes[key].hidden = key !== name; });
  }

  function chipHtml(status) {
    return '<span class="chip status status--' + esc(status) + '">' + esc(STATUS[status] || status) + "</span>";
  }

  function purchaseHtml(order) {
    var purchase = order.data;
    var pieces = purchase.lineas.reduce(function (total, line) { return total + Number(line.cantidad || 0); }, 0);

    var lines = purchase.lineas.map(function (line) {
      var meta = [line.material, line.color].filter(Boolean).join(" · ");
      return '<li class="order__line"><div><p class="order__line-name">' + esc(line.cantidad) + " × " + esc(line.nombre) + "</p>" +
        (meta ? '<p class="order__line-meta">' + esc(meta) + "</p>" : "") + "</div>" +
        '<span class="order__line-price">' + money(line.precio * line.cantidad) + "</span></li>";
    }).join("");

    var notes = "";
    if (purchase.comprobante) { notes += '<p class="order__note">Comprobante enviado: ' + esc(purchase.comprobante.nombre) + "</p>"; }
    if (purchase.estatus === "pago-pendiente" && purchase.pagoRechazado) {
      notes += '<p class="order__note">No pudimos validar tu pago' + (purchase.observacionPago ? ": " + esc(purchase.observacionPago) : "") + ". Escríbenos por WhatsApp para resolverlo.</p>";
    }
    if (purchase.estatus === "cancelado" && purchase.motivo) { notes += '<p class="order__note">Motivo de la cancelación: ' + esc(purchase.motivo) + "</p>"; }

    var foot = "";
    if (canCancel(order)) {
      foot = '<button class="btn btn--white btn--sm" type="button" data-cancel="' + esc(order.id) + '">Cancelar pedido</button>';
    } else if (order.status === "en-produccion" || order.status === "enviado") {
      foot = '<button class="btn btn--white btn--sm" type="button" disabled>Cancelar pedido</button>' +
        '<span class="order__locked">Este pedido ya está en producción y no puede cancelarse</span>';
    }

    return (
      '<li class="order"><article aria-labelledby="pedido-' + esc(order.id) + '">' +
      '<div class="order__head"><div><h2 class="order__folio" id="pedido-' + esc(order.id) + '">Pedido #' + esc(order.id) + '</h2><p class="order__date">' + esc(formatDate(order.date)) + "</p></div>" + chipHtml(order.status) + "</div>" +
      '<div class="order__summary"><p>' + pieces + (pieces === 1 ? " pieza" : " piezas") + '</p><p class="order__total">' + money(purchase.total) + " MXN</p></div>" +
      (deliveryText(purchase) ? '<p class="order__eta">' + esc(deliveryText(purchase)) + "</p>" : "") +
      '<details class="order__more"><summary>Ver detalle</summary><div class="order__detail"><ul>' + lines + "</ul>" + notes + "</div></details>" +
      (foot ? '<div class="order__foot">' + foot + "</div>" : "") +
      "</article></li>"
    );
  }

  function requestHtml(order) {
    var request = order.data;
    var rows = [
      ["Tipo", request.tipoPedido],
      ["Categoría", request.categoriaNombre || request.categoria],
      ["Cantidad", request.cantidad],
      ["Material", request.material],
      ["Colores", (request.colores || []).join(", ")],
      ["Descripción", request.descripcion]
    ].filter(function (row) { return row[1]; }).map(function (row) {
      return '<p class="order__note"><strong>' + esc(row[0]) + ":</strong> " + esc(row[1]) + "</p>";
    }).join("");

    var quote = order.status === "cotizado" && request.cotizacion
      ? '<p class="order__quote">Cotización lista: ' + money(request.cotizacion) + " MXN." + (request.notasCotizacion ? " " + esc(request.notasCotizacion) : "") + " Te escribimos por WhatsApp para confirmar.</p>"
      : "";
    if (request.archivoEstado === "rechazado" && order.status === "en-revision") {
      quote = '<p class="order__quote">No pudimos abrir tu archivo 3D' + (request.archivoNota ? ": " + esc(request.archivoNota) : "") + ". Escríbenos por WhatsApp para mandar otro formato.</p>";
    }
    if (order.status === "rechazado" && request.motivoRechazo) {
      quote = '<p class="order__quote">Motivo: ' + esc(request.motivoRechazo) + "</p>";
    }

    return (
      '<li class="order"><article aria-labelledby="pedido-' + esc(order.id) + '">' +
      '<div class="order__head"><div><h2 class="order__folio" id="pedido-' + esc(order.id) + '">Pedido personalizado #' + esc(order.id) + '</h2><p class="order__date">' + esc(formatDate(order.date)) + "</p></div>" + chipHtml(order.status) + "</div>" +
      quote +
      '<details class="order__more"><summary>Ver detalle</summary><div class="order__detail">' + rows + "</div></details>" +
      "</article></li>"
    );
  }

  function render() {
    var current = orders.filter(function (order) { return !isHistory(order); });
    var history = orders.filter(isHistory);
    var shown = tab === "actuales" ? current : history;

    counts.actuales.textContent = current.length;
    counts.historial.textContent = history.length;
    Object.keys(tabs).forEach(function (key) { tabs[key].setAttribute("aria-pressed", String(key === tab)); });

    emptyList.hidden = shown.length > 0;
    emptyList.textContent = tab === "actuales" ? "No tienes pedidos en curso." : "Todavía no tienes pedidos en el historial.";
    list.innerHTML = shown.map(function (order) { return order.type === "compra" ? purchaseHtml(order) : requestHtml(order); }).join("");
  }

  function load() {
    var user = window.MakkaSession.user();
    if (!user) { show("sesion"); return; }

    orders = buildOrders(window.MakkaCompras.list(), window.MakkaSolicitudes.list(), user.email);
    if (!orders.length) { show("vacio"); return; }

    show("contenido");
    render();
  }

  tabs.actuales.addEventListener("click", function () { tab = "actuales"; render(); });
  tabs.historial.addEventListener("click", function () { tab = "historial"; render(); });

  list.addEventListener("click", function (event) {
    var button = event.target.closest("[data-cancel]");
    if (!button) { return; }
    toCancel = button.getAttribute("data-cancel");
    lastButton = button;
    dialogFolio.textContent = "Pedido #" + toCancel;
    dialogReason.value = "";
    dialog.returnValue = "";
    dialog.showModal();
  });

  dialog.addEventListener("close", function () {
    if (dialog.returnValue === "si") {
      var result = window.MakkaCompras.cancel(toCancel, dialogReason.value);
      if (result.ok) {
        window.MakkaToast.show({ mensaje: "Cancelamos tu pedido #" + toCancel });
        load();
        tabs[tab].focus();
        return;
      }
      window.MakkaToast.show({ mensaje: "No pudimos cancelar el pedido. Intenta de nuevo." });
    }
    if (lastButton && lastButton.isConnected) { lastButton.focus(); }
  });

  load();
})();
