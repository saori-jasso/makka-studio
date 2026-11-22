(function () {
  "use strict";

  var UI = window.MakkaUI;
  var esc = UI.escapeHtml;

  /* Estatus de una compra que ya cuentan como venta (el pago ya se validó) */
  var SOLD = ["pago-validado", "en-produccion", "enviado", "entregado"];

  var STATUS = {
    "pago-pendiente": "Pago pendiente de validación",
    "pago-validado": "Pago validado",
    "en-produccion": "En producción",
    "enviado": "Enviado",
    "entregado": "Entregado",
    "cancelado": "Cancelado"
  };

  /* ---------- Funciones puras ---------- */

  function statusKey(text) {
    return String(text).toLowerCase().replace(/ó/g, "o").replace(/\s+/g, "-");
  }

  /* Suma de las compras con pago validado (o más adelante) hechas en el mes de "now" */
  function monthSales(purchases, now) {
    return purchases.reduce(function (sum, purchase) {
      var date = new Date(purchase.fecha);
      var sameMonth = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
      return sameMonth && SOLD.indexOf(purchase.estatus) !== -1 ? sum + (Number(purchase.total) || 0) : sum;
    }, 0);
  }

  function computeStats(purchases, requests, now) {
    return {
      pagos: purchases.filter(function (purchase) { return purchase.estatus === "pago-pendiente"; }).length,
      produccion: purchases.filter(function (purchase) { return purchase.estatus === "en-produccion"; }).length,
      solicitudes: requests.filter(function (request) { return statusKey(request.estatus) === "en-revision"; }).length,
      ventas: monthSales(purchases, now)
    };
  }

  /* Texto del "ánimo" del panel según lo que hay pendiente */
  function moodText(stats) {
    var parts = [];
    if (stats.pagos) { parts.push(stats.pagos + (stats.pagos === 1 ? " pago por validar" : " pagos por validar")); }
    if (stats.solicitudes) { parts.push(stats.solicitudes + (stats.solicitudes === 1 ? " solicitud nueva" : " solicitudes nuevas")); }
    if (!parts.length) { return "¡Todo al día! No hay nada pendiente."; }
    return "Tienes " + parts.join(" y ") + ".";
  }

  function customerName(email, users) {
    var key = String(email || "").toLowerCase();
    var found = users.filter(function (user) { return String(user.email).toLowerCase() === key; })[0];
    if (!found) { return email || "Sin correo"; }
    return (String(found.nombre || "") + " " + String(found.apellido || "")).trim() || email;
  }

  /* Las últimas compras, de la más nueva a la más vieja */
  function latestOrders(purchases, users, limit) {
    return purchases.slice().sort(function (a, b) { return new Date(b.fecha) - new Date(a.fecha); })
      .slice(0, limit || 5)
      .map(function (purchase) {
        return { folio: purchase.folio, cliente: customerName(purchase.correo, users), total: purchase.total, estatus: purchase.estatus };
      });
  }

  window.MakkaDashboardLogic = { computeStats: computeStats, monthSales: monthSales, moodText: moodText, latestOrders: latestOrders, customerName: customerName, SOLD: SOLD };

  /* ---------- Pantalla ---------- */

  var admin = window.MakkaAdmin;
  if (!admin || !admin.allowed) {
    return;
  }

  var Auth = window.MakkaAuth;
  var Compras = window.MakkaCompras;
  var Solicitudes = window.MakkaSolicitudes;

  function byId(id) { return document.getElementById(id); }
  function money(value) { return UI.formatPrice(value, 2); }
  function toast(message) {
    if (window.MakkaToast && window.MakkaToast.show) { window.MakkaToast.show({ mensaje: message }); }
  }

  var name = String(admin.user.nombre || "Admin").trim() || "Admin";
  byId("dash-titulo").textContent = "Hola, " + name;
  window.MakkaAvatar.render(byId("dash-avatar"), admin.user.avatar, name.charAt(0).toUpperCase());

  function render() {
    var purchases = Compras.list();
    var requests = Solicitudes.list();
    var users = Auth.listUsers();
    var stats = computeStats(purchases, requests, new Date());

    byId("kpi-pagos").textContent = String(stats.pagos);
    byId("kpi-produccion").textContent = String(stats.produccion);
    byId("kpi-solicitudes").textContent = String(stats.solicitudes);
    byId("kpi-ventas").textContent = money(stats.ventas);
    byId("dash-animo").textContent = moodText(stats);
    byId("dash-cta").hidden = stats.pagos === 0;

    var orders = latestOrders(purchases, users, 5);
    byId("ultimos-vacio").hidden = orders.length > 0;
    byId("ultimos-tabla").hidden = orders.length === 0;
    byId("demo-cargar").hidden = !SHOW_DEMO_TOOLS || purchases.length > 0 || requests.length > 0;

    byId("ultimos-cuerpo").innerHTML = orders.map(function (order) {
      return "<tr>" +
        '<td data-label="Pedido"><span class="dash-table__folio">#' + esc(order.folio) + "</span></td>" +
        '<td data-label="Cliente">' + esc(order.cliente) + "</td>" +
        '<td data-label="Total"><span class="dash-table__money">' + money(order.total) + "</span></td>" +
        '<td data-label="Estatus"><span class="chip status status--' + esc(order.estatus) + '">' + esc(STATUS[order.estatus] || order.estatus) + "</span></td>" +
        "</tr>";
    }).join("");
  }

  /* SOLO PRUEBA: con backend, pon false (o quita el botón "demo-cargar" del HTML). */
  var SHOW_DEMO_TOOLS = true;

  byId("demo-cargar").addEventListener("click", function () {
    if (!window.MakkaDemo || !window.MakkaDemo.load()) {
      toast("No se pudieron cargar los datos de ejemplo");
      return;
    }
    render();
    toast("Cargamos datos de ejemplo");
  });

  /* ---------- Ayuda con contraseñas ---------- */
  var linkForm = byId("enlace-form");
  var linkInput = byId("enlace-correo");
  var linkError = byId("err-enlace");
  var linkBox = byId("enlace-resultado");
  var linkUrl = byId("enlace-url");
  var linkWhatsapp = byId("enlace-whatsapp");

  function setLinkError(message) {
    linkError.hidden = !message;
    linkError.textContent = message || "";
    if (message) { linkInput.setAttribute("aria-invalid", "true"); } else { linkInput.removeAttribute("aria-invalid"); }
  }

  linkInput.addEventListener("input", function () { setLinkError(""); });

  /* Mensaje de WhatsApp para el cliente; "" si no tiene un teléfono de 10 dígitos */
  function whatsappUrl(phone, nameText, url) {
    var digits = String(phone || "").replace(/\D/g, "");
    if (digits.length !== 10) { return ""; }
    var text = "Hola " + nameText + ", este es tu enlace para crear una contraseña nueva en Makka Studio (vence en 24 horas): " + url;
    return "https://wa.me/52" + digits + "?text=" + encodeURIComponent(text);
  }

  window.MakkaDashboardLogic.whatsappUrl = whatsappUrl;

  linkForm.addEventListener("submit", function (event) {
    event.preventDefault();
    linkBox.hidden = true;

    if (!Auth.isEmail(linkInput.value)) {
      setLinkError("Ingresa un correo válido");
      linkInput.focus();
      return;
    }

    var made = Auth.createResetLink(linkInput.value);
    if (!made.ok) {
      setLinkError("No encontramos una cuenta con ese correo");
      linkInput.focus();
      return;
    }

    var profile = Auth.getProfile(linkInput.value) || {};
    var url = new URL("restablecer-contrasena.html?token=" + encodeURIComponent(made.token), window.location.href).href;
    linkUrl.value = url;
    byId("enlace-quien").textContent = profile.nombre || linkInput.value;

    var wa = whatsappUrl(profile.telefono, profile.nombre || "", url);
    linkWhatsapp.hidden = !wa;
    if (wa) { linkWhatsapp.href = wa; }
    linkBox.hidden = false;
  });

  byId("enlace-copiar").addEventListener("click", function () {
    linkUrl.select();
    var copied = false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(linkUrl.value).then(function () { toast("Enlace copiado"); }, function () { toast("Selecciónalo y copia con Ctrl+C"); });
      return;
    }
    try { copied = document.execCommand("copy"); } catch (error) { copied = false; }
    toast(copied ? "Enlace copiado" : "Selecciónalo y copia con Ctrl+C");
  });

  render();
})();
