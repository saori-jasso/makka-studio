/*
 * Reporte de ventas (administrador). Calcula todo con las compras de window.MakkaCompras.
 * Qué cuenta como venta: compras con el pago ya validado (pago-validado, en-produccion, enviado o entregado), por la fecha de la compra.
 *   Ventas totales = suma de esas compras. Pedidos completados = las que ya están entregadas.
 *   Ticket promedio = ventas totales / número de compras. Producto más vendido = el de más piezas.
 *   Con una categoría elegida, solo se cuentan las piezas de esa categoría.
 * El backend debe calcularlo con la fecha de validación del pago. "Exportar PDF" abre la impresión del navegador (Guardar como PDF).
 */
(function () {
  "use strict";

  var UI = window.MakkaUI;
  var esc = UI.escapeHtml;

  var SOLD = ["pago-validado", "en-produccion", "enviado", "entregado"];
  var MONTH_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  var DAILY_LIMIT_DAYS = 62;

  /* ---------- Funciones puras ---------- */

  function pad(number) { return String(number).padStart(2, "0"); }
  function dayKey(date) { return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()); }
  function monthKey(date) { return date.getFullYear() + "-" + pad(date.getMonth() + 1); }

  function parseDay(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
    if (!match) { return null; }
    var date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return isNaN(date.getTime()) ? null : date;
  }

  function daysBetween(from, to) { return Math.round((to - from) / 86400000) + 1; }

  /* Claves del eje X (todos los días o todos los meses del rango, aunque no haya ventas) */
  function buildKeys(from, to) {
    var keys = [];
    var monthly = daysBetween(from, to) > DAILY_LIMIT_DAYS;
    if (monthly) {
      var cursor = new Date(from.getFullYear(), from.getMonth(), 1);
      while (cursor <= to) { keys.push(monthKey(cursor)); cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1); }
    } else {
      var day = new Date(from.getFullYear(), from.getMonth(), from.getDate());
      while (day <= to) { keys.push(dayKey(day)); day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1); }
    }
    return { keys: keys, monthly: monthly };
  }

  function keyLabel(key, monthly) {
    var parts = key.split("-");
    return monthly ? MONTH_SHORT[Number(parts[1]) - 1] + " " + parts[0].slice(2) : Number(parts[2]) + " " + MONTH_SHORT[Number(parts[1]) - 1];
  }

  /*
   * purchases: lista de compras; products: [{ id, nombre, categoria }]; categories: [{ slug, nombre }]
   * options: { from: "AAAA-MM-DD", to: "AAAA-MM-DD", category: slug o "" }
   */
  function computeReport(purchases, products, categories, options) {
    var from = parseDay(options.from);
    var to = parseDay(options.to);
    var end = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);
    var byId = {};
    products.forEach(function (product) { byId[String(product.id)] = product; });
    var catName = {};
    categories.forEach(function (category) { catName[category.slug] = category.nombre; });

    var axis = buildKeys(from, to);
    var series = {};
    axis.keys.forEach(function (key) { series[key] = 0; });
    var byCategory = {};
    var ranking = {};
    var report = { total: 0, orders: 0, completed: 0, ticket: 0, top: null, series: [], monthly: axis.monthly, categories: [], ranking: [], from: from, to: to };

    purchases.forEach(function (purchase) {
      if (SOLD.indexOf(purchase.estatus) === -1) { return; }
      var date = new Date(purchase.fecha);
      if (isNaN(date.getTime()) || date < from || date > end) { return; }

      var lines = (purchase.lineas || []).map(function (line) {
        var product = byId[String(line.id)];
        var slug = product ? product.categoria : "sin-categoria";
        return { line: line, slug: slug };
      }).filter(function (item) { return !options.category || item.slug === options.category; });
      if (!lines.length) { return; }

      var amount = options.category
        ? lines.reduce(function (sum, item) { return sum + item.line.precio * item.line.cantidad; }, 0)
        : (Number(purchase.total) || lines.reduce(function (sum, item) { return sum + item.line.precio * item.line.cantidad; }, 0));

      report.total += amount;
      report.orders += 1;
      if (purchase.estatus === "entregado") { report.completed += 1; }
      series[axis.monthly ? monthKey(date) : dayKey(date)] += amount;

      lines.forEach(function (item) {
        var value = item.line.precio * item.line.cantidad;
        byCategory[item.slug] = (byCategory[item.slug] || 0) + value;
        var key = String(item.line.id !== undefined && item.line.id !== null ? item.line.id : item.line.nombre);
        var entry = ranking[key] || (ranking[key] = { nombre: item.line.nombre, categoria: item.slug, piezas: 0, ventas: 0 });
        entry.piezas += Number(item.line.cantidad) || 0;
        entry.ventas += value;
      });
    });

    report.ticket = report.orders ? report.total / report.orders : 0;
    report.series = axis.keys.map(function (key) { return { key: key, label: keyLabel(key, axis.monthly), value: series[key] }; });
    report.categories = Object.keys(byCategory).map(function (slug) {
      return { slug: slug, nombre: catName[slug] || "Sin categoría", ventas: byCategory[slug] };
    }).sort(function (a, b) { return b.ventas - a.ventas; });
    report.ranking = Object.keys(ranking).map(function (key) {
      var entry = ranking[key];
      entry.categoriaNombre = catName[entry.categoria] || "Sin categoría";
      return entry;
    }).sort(function (a, b) { return b.piezas - a.piezas || b.ventas - a.ventas; });
    report.top = report.ranking[0] || null;
    return report;
  }

  /* Gráfica de línea en SVG (sin librerías ni internet) */
  function lineChartSvg(series, formatMoney) {
    var width = 640;
    var height = 260;
    var left = 56;
    var right = 16;
    var top = 16;
    var bottom = 34;
    var max = series.reduce(function (m, point) { return Math.max(m, point.value); }, 0) || 1;
    var step = Math.pow(10, Math.floor(Math.log10(max)));
    var niceMax = Math.ceil(max / step) * step;
    var plotW = width - left - right;
    var plotH = height - top - bottom;
    function x(index) { return left + (series.length === 1 ? plotW / 2 : (plotW * index) / (series.length - 1)); }
    function y(value) { return top + plotH - (plotH * value) / niceMax; }

    var grid = "";
    for (var i = 0; i <= 4; i++) {
      var value = (niceMax * i) / 4;
      grid += '<line x1="' + left + '" x2="' + (width - right) + '" y1="' + y(value).toFixed(1) + '" y2="' + y(value).toFixed(1) + '" class="rep-grid-line"/>' +
        '<text x="' + (left - 8) + '" y="' + (y(value) + 4).toFixed(1) + '" text-anchor="end" class="rep-axis">' + esc(formatMoney(value).replace(/\.00$/, "")) + "</text>";
    }
    var every = Math.max(1, Math.ceil(series.length / 7));
    var labels = series.map(function (point, index) {
      if (index % every !== 0 && index !== series.length - 1) { return ""; }
      return '<text x="' + x(index).toFixed(1) + '" y="' + (height - 10) + '" text-anchor="middle" class="rep-axis">' + esc(point.label) + "</text>";
    }).join("");
    var points = series.map(function (point, index) { return x(index).toFixed(1) + "," + y(point.value).toFixed(1); }).join(" ");
    var area = left + "," + (top + plotH) + " " + points + " " + x(series.length - 1).toFixed(1) + "," + (top + plotH);
    var dots = series.map(function (point, index) {
      return '<circle cx="' + x(index).toFixed(1) + '" cy="' + y(point.value).toFixed(1) + '" r="' + (series.length > 40 ? 2 : 4) + '" class="rep-dot"><title>' + esc(point.label + ": " + formatMoney(point.value)) + "</title></circle>";
    }).join("");

    return '<svg viewBox="0 0 ' + width + " " + height + '" class="rep-svg" focusable="false" aria-hidden="true">' + grid +
      '<polygon points="' + area + '" class="rep-area"/><polyline points="' + points + '" class="rep-line"/>' + dots + labels + "</svg>";
  }

  window.MakkaReporteLogic = { computeReport: computeReport, lineChartSvg: lineChartSvg, buildKeys: buildKeys, SOLD: SOLD };

  /* ---------- Pantalla ---------- */

  var admin = window.MakkaAdmin;
  if (!admin || !admin.allowed) {
    return;
  }

  var Compras = window.MakkaCompras;
  var Store = window.MakkaProductos;
  var Utils = window.MakkaAdminUI;
  var categories = Store.categories();

  function byIdEl(id) { return document.getElementById(id); }

  function defaultRange() {
    var today = new Date();
    return { from: dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)), to: dayKey(today) };
  }

  function setError(message) {
    var box = byIdEl("rep-error");
    box.textContent = message || "";
    box.hidden = !message;
  }

  function render() {
    var from = byIdEl("rep-inicio").value;
    var to = byIdEl("rep-fin").value;
    var category = byIdEl("rep-categoria").value;
    var purchases = Compras.list();
    byIdEl("demo-cargar").hidden = purchases.length > 0;

    if (!parseDay(from) || !parseDay(to)) { setError("Elige las dos fechas del rango."); return; }
    if (parseDay(from) > parseDay(to)) { setError("La fecha inicial debe ser anterior o igual a la final."); return; }
    setError("");

    var report = computeReport(purchases, Store.list(), categories, { from: from, to: to, category: category });
    var catLabel = category ? (categories.filter(function (item) { return item.slug === category; })[0] || {}).nombre : "Todas";
    byIdEl("rep-rango").textContent = "Del " + Utils.formatDate(from) + " al " + Utils.formatDate(to) + " · Categoría: " + catLabel;

    var empty = report.orders === 0;
    byIdEl("rep-vacio").hidden = !empty;
    byIdEl("rep-contenido").hidden = empty;
    if (empty) { return; }

    byIdEl("rep-total").textContent = Utils.money(report.total);
    byIdEl("rep-completados").textContent = String(report.completed);
    byIdEl("rep-ticket").textContent = Utils.money(report.ticket);
    byIdEl("rep-top").textContent = report.top ? report.top.nombre : "-";

    byIdEl("rep-periodo").textContent = report.monthly ? "mes" : "día";
    var best = report.series.reduce(function (m, point) { return point.value > m.value ? point : m; }, report.series[0]);
    var chart = byIdEl("rep-linea");
    chart.innerHTML = lineChartSvg(report.series, Utils.money);
    chart.setAttribute("aria-label", "Gráfica de ventas por " + (report.monthly ? "mes" : "día") + ". Total " + Utils.money(report.total) + ". Mejor " + (report.monthly ? "mes" : "día") + ": " + best.label + " con " + Utils.money(best.value) + ".");

    var maxCat = report.categories.reduce(function (m, item) { return Math.max(m, item.ventas); }, 0) || 1;
    var sumCat = report.categories.reduce(function (sum, item) { return sum + item.ventas; }, 0) || 1;
    byIdEl("rep-categorias").innerHTML = report.categories.map(function (item) {
      return '<li class="rep-bar"><div class="rep-bar__head"><span>' + esc(item.nombre) + "</span><strong>" + Utils.money(item.ventas) + ' <small>' + Math.round((item.ventas / sumCat) * 100) + '%</small></strong></div>' +
        '<div class="rep-bar__track"><span class="rep-bar__fill" style="width:' + Math.max(3, Math.round((item.ventas / maxCat) * 100)) + '%"></span></div></li>';
    }).join("");

    byIdEl("rep-ranking").innerHTML = report.ranking.slice(0, 10).map(function (item, index) {
      return "<tr>" +
        '<td data-label="#">' + (index + 1) + "</td>" +
        '<td data-label="Producto"><span class="dash-table__folio">' + esc(item.nombre) + "</span></td>" +
        '<td data-label="Categoría">' + esc(item.categoriaNombre) + "</td>" +
        '<td data-label="Piezas">' + item.piezas + "</td>" +
        '<td data-label="Ventas"><span class="dash-table__money">' + Utils.money(item.ventas) + "</span></td></tr>";
    }).join("");
  }

  function resetRange() {
    var range = defaultRange();
    byIdEl("rep-inicio").value = range.from;
    byIdEl("rep-fin").value = range.to;
    byIdEl("rep-categoria").value = "";
  }

  byIdEl("rep-categoria").insertAdjacentHTML("beforeend", categories.map(function (category) {
    return '<option value="' + esc(category.slug) + '">' + esc(category.nombre) + "</option>";
  }).join(""));

  byIdEl("rep-form").addEventListener("submit", function (event) { event.preventDefault(); render(); });
  byIdEl("rep-limpiar").addEventListener("click", function () { resetRange(); render(); });
  byIdEl("rep-vacio-reset").addEventListener("click", function () { resetRange(); render(); });
  byIdEl("rep-pdf").addEventListener("click", function () { window.print(); });

  byIdEl("demo-cargar").addEventListener("click", function () {
    if (!window.MakkaDemo || !window.MakkaDemo.load("compras")) { Utils.toast("No se pudieron cargar los datos de ejemplo"); return; }
    render();
    Utils.toast("Cargamos datos de ejemplo");
  });

  resetRange();
  render();
})();
