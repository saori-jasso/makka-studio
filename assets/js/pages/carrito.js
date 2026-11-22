(function () {
  "use strict";

  var UI = window.MakkaUI;
  var esc = UI.escapeHtml;

  /* ---------- Funciones puras ---------- */

  function lineKey(item) {
    return [item.id, item.color || "", item.material || ""].join("|");
  }

  function findProduct(products, id) {
    return products.filter(function (product) { return String(product.id) === String(id); })[0] || null;
  }

  function parseQuantity(value) {
    var number = Number(value);
    return isFinite(number) && number >= 1 && Math.floor(number) === number ? number : null;
  }

  function imageFor(product, colorName) {
    var color = (product.colores || []).filter(function (item) { return item.nombre === colorName; })[0];
    if (color && color.imagenes && color.imagenes.length) { return color.imagenes[0]; }
    return product.imagen || {};
  }

  /* Une lo guardado en el carrito con los datos actuales del catálogo. */
  function buildLines(items, products) {
    var lines = items.map(function (item) {
      var product = findProduct(products, item.id);
      var available = Boolean(product) && product.disponible !== false;
      var quantity = Number(item.cantidad) || 1;
      var price = product ? Number(product.precio) || 0 : 0;
      return {
        item: item,
        key: lineKey(item),
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
      subtotal: lines.reduce(function (total, line) { return total + line.subtotal; }, 0),
      hasUnavailable: lines.some(function (line) { return !line.available; })
    };
  }

  window.MakkaCartLogic = {
    lineKey: lineKey,
    findProduct: findProduct,
    parseQuantity: parseQuantity,
    imageFor: imageFor,
    buildLines: buildLines
  };

  /* ---------- Interfaz ---------- */

  var list = document.getElementById("carrito-lista");
  if (!list) {
    return;
  }

  var Cart = window.MakkaCart;
  var loading = document.getElementById("carrito-cargando");
  var content = document.getElementById("carrito-contenido");
  var emptyBox = document.getElementById("estado-vacio");
  var errorBox = document.getElementById("estado-error");
  var retry = document.getElementById("error-reintentar");
  var heading = document.getElementById("carrito-lista-titulo");
  var countChip = document.getElementById("carrito-cuenta");
  var piecesLabel = document.getElementById("resumen-piezas");
  var subtotalEl = document.getElementById("resumen-subtotal");
  var totalEl = document.getElementById("resumen-total");
  var notice = document.getElementById("carrito-aviso");
  var goButton = document.getElementById("btn-continuar");
  var goBlocked = document.getElementById("btn-continuar-bloqueado");
  var sessionNote = document.getElementById("resumen-sesion");

  var products = [];
  var store = Cart;

  /* Sesión provisional: cuando exista el login real (RF-01) se cambia esta función. */
  function isLoggedIn() {
    return window.MakkaSession ? window.MakkaSession.isLoggedIn() : false;
  }

  function money(value) { return UI.formatPrice(value, 2); }

  function show(target) {
    [loading, content, emptyBox, errorBox].forEach(function (box) { box.hidden = box !== target; });
  }

  function lineHtml(line) {
    var product = line.product;
    var item = line.item;
    var key = esc(line.key);

    if (!line.available) {
      var thumb = product ? imageFor(product, item.color) : {};
      return (
        '<li class="cart-line is-unavailable" data-key="' + key + '">' +
        '<div class="cart-line__media">' + (thumb.src ? '<img src="' + esc(thumb.src) + '" alt="" width="' + Number(thumb.ancho) + '" height="' + Number(thumb.alto) + '">' : "") + "</div>" +
        '<div class="cart-line__main"><div class="cart-line__head"><h3 class="cart-line__name">' + esc(product ? product.nombre : "Producto no disponible") + "</h3>" +
        removeHtml(product ? product.nombre : "producto no disponible") + "</div>" +
        '<p class="cart-line__unavailable" role="alert">Este producto ya no está disponible</p></div></li>'
      );
    }

    var image = imageFor(product, item.color);
    var colorData = (product.colores || []).filter(function (color) { return color.nombre === item.color; })[0];
    var colorHtml = item.color
      ? '<span class="cart-line__color">' + (colorData && UI.validHex(colorData.hex) ? '<span class="cart-line__dot" style="--swatch:' + colorData.hex + '" aria-hidden="true"></span>' : "") + "Color: " + esc(item.color) + "</span>"
      : '<span class="cart-line__color">Colores de la foto</span>';
    var unit = product.precioUnidad ? " <small>" + esc(product.precioUnidad) + "</small>" : "";
    var id = "cant-" + key.replace(/[^a-z0-9]/gi, "_");

    return (
      '<li class="cart-line" data-key="' + key + '">' +
      '<a class="cart-line__media" href="producto.html?id=' + encodeURIComponent(product.id) + '" tabindex="-1" aria-hidden="true"><img src="' + esc(image.src) + '" alt="" width="' + Number(image.ancho) + '" height="' + Number(image.alto) + '" loading="lazy" decoding="async"></a>' +
      '<div class="cart-line__main">' +
      '<div class="cart-line__head"><h3 class="cart-line__name"><a href="producto.html?id=' + encodeURIComponent(product.id) + '">' + esc(product.nombre) + "</a></h3>" + removeHtml(product.nombre) + "</div>" +
      '<p class="cart-line__meta">' + (item.material ? "<span>Material: " + esc(item.material) + "</span>" : "") + colorHtml + "</p>" +
      '<div class="cart-line__figures">' +
      '<div class="cart-line__fig"><label class="cart-line__label" for="' + id + '">Cantidad</label>' +
      '<div class="qty qty--sm"><button class="qty__btn" type="button" data-step="-1" aria-label="Disminuir cantidad de ' + esc(product.nombre) + '">−</button>' +
      '<input class="qty__input" id="' + id + '" type="number" inputmode="numeric" min="1" max="' + store.MAX_QTY + '" value="' + line.quantity + '">' +
      '<button class="qty__btn" type="button" data-step="1" aria-label="Aumentar cantidad de ' + esc(product.nombre) + '">+</button></div>' +
      '<p class="cart-line__error" role="alert" hidden>La cantidad debe ser mayor a 0</p></div>' +
      '<div class="cart-line__fig"><span class="cart-line__label">Precio</span><span class="cart-line__value">' + money(line.price) + unit + "</span></div>" +
      '<div class="cart-line__fig cart-line__fig--total"><span class="cart-line__label">Subtotal</span><span class="cart-line__value" data-subtotal>' + money(line.subtotal) + "</span></div>" +
      "</div></div></li>"
    );
  }

  function removeHtml(name) {
    return '<button class="cart-line__remove" type="button" data-remove aria-label="Quitar ' + esc(name) + ' del carrito"><img src="assets/img/icons/trash.svg" alt="" width="24" height="24"></button>';
  }

  function updateSummary(result) {
    countChip.textContent = result.lines.length + (result.lines.length === 1 ? " producto" : " productos");
    piecesLabel.textContent = "Subtotal (" + result.pieces + (result.pieces === 1 ? " pieza)" : " piezas)");
    subtotalEl.textContent = money(result.subtotal) + " MXN";
    totalEl.textContent = money(result.subtotal) + " MXN";

    var blocked = result.hasUnavailable || result.pieces === 0;
    notice.hidden = !result.hasUnavailable;
    goButton.hidden = blocked;
    goBlocked.hidden = !blocked;

    var logged = isLoggedIn();
    goButton.href = logged ? "confirmar-compra.html" : "login.html?siguiente=confirmar-compra.html";
    sessionNote.hidden = logged || blocked;
  }

  function current() {
    return buildLines(store.items(), products);
  }

  function render() {
    var result = current();
    if (!result.lines.length) {
      show(emptyBox);
      return;
    }
    list.innerHTML = result.lines.map(lineHtml).join("");
    updateSummary(result);
    show(content);
  }

  function refreshNumbers() {
    var result = current();
    result.lines.forEach(function (line) {
      var row = list.querySelector('[data-key="' + (window.CSS && CSS.escape ? CSS.escape(line.key) : line.key) + '"]');
      var cell = row && row.querySelector("[data-subtotal]");
      if (cell) { cell.textContent = money(line.subtotal); }
    });
    updateSummary(result);
    Cart.update();
  }

  function itemFromRow(row) {
    var key = row.getAttribute("data-key");
    return store.items().filter(function (item) { return lineKey(item) === key; })[0];
  }

  function changeQuantity(row, requested) {
    var item = itemFromRow(row);
    if (!item) { return; }
    var input = row.querySelector(".qty__input");
    var error = row.querySelector(".cart-line__error");
    var quantity = parseQuantity(requested);

    if (quantity === null) {
      error.hidden = false;
      input.value = item.cantidad;
      return;
    }

    quantity = Math.min(store.MAX_QTY, quantity);
    error.hidden = true;
    store.setQuantity(item, quantity);
    input.value = quantity;
    refreshNumbers();
  }

  list.addEventListener("click", function (event) {
    var row = event.target.closest(".cart-line");
    if (!row) { return; }

    var step = event.target.closest("[data-step]");
    if (step) {
      var item = itemFromRow(row);
      if (item) { changeQuantity(row, Number(item.cantidad) + Number(step.getAttribute("data-step"))); }
      return;
    }

    if (event.target.closest("[data-remove]")) {
      var target = itemFromRow(row);
      if (!target) { return; }
      var name = (row.querySelector(".cart-line__name") || {}).textContent || "Producto";
      store.remove(target);
      Cart.update();
      render();
      window.MakkaToast.show({ mensaje: "Quitamos «" + name + "» de tu carrito" });
      if (!emptyBox.hidden) { return; }
      heading.focus();
    }
  });

  list.addEventListener("change", function (event) {
    var input = event.target.closest(".qty__input");
    var row = input && input.closest(".cart-line");
    if (row) { changeQuantity(row, input.value); }
  });

  function load() {
    store = Cart;

    show(loading);
    window.MakkaApi.getCatalogo()
      .then(function (data) {
        products = data.productos || [];
        render();
      })
      .catch(function () { show(errorBox); });
  }

  retry.addEventListener("click", load);
  load();
})();
