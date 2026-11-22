(function () {
  "use strict";

  var UI = window.MakkaUI;
  var esc = UI.escapeHtml;
  var MAX_BYTES = 5 * 1024 * 1024;

  var MESSAGES = {
    formato: "Formato no permitido. Sube una imagen JPG o PNG.",
    peso: "El archivo es muy pesado. El máximo es 5 MB."
  };

  /* ---------- Funciones puras ---------- */

  function extension(name) {
    var match = /\.([^.]+)$/.exec(String(name).toLowerCase());
    return match ? match[1] : "";
  }

  function formatSize(bytes) {
    if (bytes >= 1024 * 1024) { return (bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "") + " MB"; }
    return Math.max(1, Math.round(bytes / 1024)) + " KB";
  }

  /* Devuelve el mensaje de error del comprobante, o "" si es válido. */
  function checkFile(file) {
    var ext = extension(file.name);
    if (ext !== "jpg" && ext !== "jpeg" && ext !== "png") { return MESSAGES.formato; }
    if (file.size > MAX_BYTES) { return MESSAGES.peso; }
    return "";
  }

  /* Une lo guardado en el carrito con los datos del catálogo. */
  function buildLines(items, products) {
    var lines = items.map(function (item) {
      var product = products.filter(function (entry) { return String(entry.id) === String(item.id); })[0] || null;
      var available = Boolean(product) && product.disponible !== false;
      var quantity = Number(item.cantidad) || 1;
      var price = product ? Number(product.precio) || 0 : 0;
      return {
        item: item,
        product: product,
        available: available,
        quantity: quantity,
        price: price,
        subtotal: available ? price * quantity : 0
      };
    });

    return {
      lines: lines,
      pieces: lines.reduce(function (total, line) { return total + (line.available ? line.quantity : 0); }, 0),
      total: lines.reduce(function (total, line) { return total + line.subtotal; }, 0),
      hasUnavailable: lines.some(function (line) { return !line.available; })
    };
  }

  window.MakkaConfirmarLogic = { extension: extension, formatSize: formatSize, checkFile: checkFile, buildLines: buildLines };

  /* ---------- Interfaz ---------- */

  var content = document.getElementById("compra-contenido");
  if (!content) {
    return;
  }

  var Cart = window.MakkaCart;
  var boxes = {
    sesion: document.getElementById("estado-sesion"),
    vacio: document.getElementById("estado-vacio"),
    exito: document.getElementById("estado-exito"),
    contenido: content
  };
  var linesList = document.getElementById("compra-lineas");
  var sendButton = document.getElementById("compra-enviar");
  var errorBox = document.getElementById("compra-error");
  var fileError = document.getElementById("err-comprobante");
  var input = document.getElementById("comprobante");
  var drop = document.getElementById("drop-comprobante");
  var fileList = document.getElementById("lista-comprobante");

  var current = null; /* resultado de buildLines */
  var file = null;

  function money(value) { return UI.formatPrice(value, 2); }

  function show(name) {
    Object.keys(boxes).forEach(function (key) { boxes[key].hidden = key !== name; });
  }

  function showFileError(message) {
    fileError.hidden = !message;
    fileError.textContent = message || "";
  }

  function renderLines() {
    linesList.innerHTML = current.lines.map(function (line) {
      if (!line.available) {
        return '<li class="checkout__line"><span class="checkout__line-name">' + esc(line.product ? line.product.nombre : "Producto no disponible") +
          '</span><span class="checkout__line-meta">Ya no está disponible</span></li>';
      }
      var details = [];
      if (line.item.material) { details.push(line.item.material); }
      if (line.item.color) { details.push(line.item.color); }
      details.push(line.quantity + " × " + money(line.price));
      return '<li class="checkout__line"><div><p class="checkout__line-name">' + esc(line.product.nombre) +
        '</p><p class="checkout__line-meta">' + esc(details.join(" · ")) + '</p></div>' +
        '<span class="checkout__line-price">' + money(line.subtotal) + "</span></li>";
    }).join("");

    if (current.hasUnavailable) {
      linesList.insertAdjacentHTML("afterend", '<p class="checkout__warn" role="alert">Hay productos que ya no están disponibles. <a href="carrito.html">Quítalos del carrito</a> para continuar.</p>');
    }
  }

  function renderSummary() {
    document.getElementById("resumen-piezas").textContent = "Subtotal (" + current.pieces + (current.pieces === 1 ? " pieza)" : " piezas)");
    document.getElementById("resumen-subtotal").textContent = money(current.total) + " MXN";
    document.getElementById("resumen-total").textContent = money(current.total) + " MXN";
    document.getElementById("compra-concepto").textContent = "Pedido #" + window.MakkaCompras.nextFolio();
    document.getElementById("compra-monto").textContent = money(current.total) + " MXN";
  }

  function updateButton() {
    sendButton.disabled = !file || current.hasUnavailable || current.pieces === 0;
  }

  function renderFile() {
    fileList.innerHTML = "";
    if (!file) { updateButton(); return; }

    var item = document.createElement("li");
    item.className = "file-item";
    item.innerHTML = '<span class="file-item__icon">' + esc(extension(file.name).toUpperCase()) + "</span>" +
      '<div class="file-item__info"><p class="file-item__name" title="' + esc(file.name) + '">' + esc(file.name) + "</p>" +
      '<p class="file-item__size">' + formatSize(file.size) + "</p></div>" +
      '<button class="file-item__remove" type="button" aria-label="Quitar ' + esc(file.name) + '"><img src="assets/img/icons/trash.svg" alt="" width="20" height="20"></button>';
    item.querySelector("button").addEventListener("click", function () {
      file = null;
      showFileError("");
      renderFile();
      input.focus();
    });
    fileList.appendChild(item);
    updateButton();
  }

  function pick(files) {
    if (!files || !files.length) { return; }
    var problem = checkFile(files[0]);
    showFileError(problem);
    if (!problem) { file = files[0]; }
    errorBox.hidden = true;
    renderFile();
  }

  input.addEventListener("change", function () {
    pick(input.files);
    input.value = "";
  });

  ["dragenter", "dragover"].forEach(function (type) {
    drop.addEventListener(type, function (event) { event.preventDefault(); drop.classList.add("is-dragover"); });
  });
  ["dragleave", "drop"].forEach(function (type) {
    drop.addEventListener(type, function (event) { event.preventDefault(); drop.classList.remove("is-dragover"); });
  });
  drop.addEventListener("drop", function (event) {
    if (event.dataTransfer) { pick(event.dataTransfer.files); }
  });

  sendButton.addEventListener("click", function () {
    if (!file || sendButton.disabled) { return; }

    var user = window.MakkaSession.user() || {};
    var result = window.MakkaCompras.create({
      correo: user.email || "",
      lineas: current.lines.filter(function (line) { return line.available; }).map(function (line) {
        return { id: line.product.id, nombre: line.product.nombre, color: line.item.color || "", material: line.item.material || "", cantidad: line.quantity, precio: line.price };
      }),
      total: current.total,
      comprobante: { nombre: file.name, tamano: file.size }
    });

    if (!result.ok) {
      errorBox.hidden = false;
      return;
    }

    Cart.clear();
    document.getElementById("exito-folio").textContent = "#" + result.folio;
    show("exito");
    document.getElementById("exito-titulo").focus();
    window.scrollTo(0, 0);
  });

  function start() {
    if (!window.MakkaSession.isLoggedIn()) { show("sesion"); return; }
    if (!Cart.items().length) { show("vacio"); return; }

    window.MakkaApi.getCatalogo().then(function (data) {
      current = buildLines(Cart.items(), data.productos || []);
      if (!current.lines.length) { show("vacio"); return; }
      renderLines();
      renderSummary();
      updateButton();
      show("contenido");
    });
  }

  start();
})();
