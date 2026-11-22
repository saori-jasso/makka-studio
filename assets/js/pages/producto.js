(function () {
  "use strict";

  var UI = window.MakkaUI;
  var esc = UI.escapeHtml;

  var ARROW_PREV = '<svg viewBox="0 0 24 24" fill="none" stroke="#111111" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>';
  var ARROW_NEXT = '<svg viewBox="0 0 24 24" fill="none" stroke="#111111" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>';

  /* ---------- Funciones puras ---------- */

  function findProduct(products, id) {
    return products.filter(function (product) { return String(product.id) === String(id); })[0] || null;
  }

  function imagesFor(product, color) {
    if (color && color.imagenes && color.imagenes.length) { return color.imagenes; }
    if (product.imagenes && product.imagenes.length) { return product.imagenes; }
    return [product.imagen];
  }

  function relatedProducts(products, product, limit) {
    var others = products.filter(function (item) { return item.id !== product.id; });
    var same = others.filter(function (item) { return item.categoria === product.categoria; });
    var rest = others
      .filter(function (item) { return item.categoria !== product.categoria; })
      .sort(function (a, b) { return b.calificacion - a.calificacion; });
    return same.concat(rest).slice(0, limit);
  }

  function parseQuantity(value) {
    var number = Number(value);
    return isFinite(number) && number >= 1 && Math.floor(number) === number ? number : null;
  }

  window.MakkaProductLogic = {
    findProduct: findProduct,
    imagesFor: imagesFor,
    relatedProducts: relatedProducts,
    parseQuantity: parseQuantity
  };

  /* ---------- Interfaz ---------- */

  var detail = document.getElementById("producto-detalle");
  if (!detail) {
    return;
  }

  var crumbs = document.getElementById("migas");
  var notFound = document.getElementById("estado-no-encontrado");
  var errorBox = document.getElementById("estado-error");
  var retry = document.getElementById("error-reintentar");
  var relatedSection = document.getElementById("relacionados");
  var relatedGrid = document.getElementById("relacionados-grid");

  var catalog = null;
  var product = null;
  var imageIndex = 0;
  var images = [];
  var selectedColor = null;
  var available = true;

  function showLoading() {
    detail.innerHTML =
      '<div class="detail-skeleton" aria-hidden="true"><div class="skeleton skeleton--media"></div><div class="detail-skeleton__info">' +
      '<div class="skeleton skeleton--line" style="width:30%"></div><div class="skeleton skeleton--line" style="height:3rem"></div>' +
      '<div class="skeleton skeleton--line" style="width:45%;height:3rem"></div><div class="skeleton skeleton--line" style="height:6rem"></div></div></div>';
    detail.setAttribute("aria-busy", "true");
    detail.hidden = false;
    notFound.hidden = true;
    errorBox.hidden = true;
    relatedSection.hidden = true;
  }

  function showNotFound() {
    detail.hidden = true;
    errorBox.hidden = true;
    relatedSection.hidden = true;
    notFound.hidden = false;
    document.title = "Producto no encontrado | Makka Studio";
  }

  function showError() {
    detail.hidden = true;
    notFound.hidden = true;
    relatedSection.hidden = true;
    errorBox.hidden = false;
  }

  function categoryName(slug) {
    var match = catalog.categorias.filter(function (category) { return category.slug === slug; })[0];
    return match ? match.nombre : "";
  }

  function galleryHtml() {
    var image = images[imageIndex] || images[0];
    var many = images.length > 1;

    return (
      '<div class="gallery__stage">' +
      (product.personalizable ? '<span class="chip chip--violet gallery__tag">Personalizable</span>' : "") +
      (many ? '<button class="gallery__arrow gallery__arrow--prev" type="button" data-dir="-1" aria-label="Imagen anterior">' + ARROW_PREV + "</button>" : "") +
      '<img class="gallery__main" src="' + esc(image.grande || image.src) + '" alt="' + esc(image.alt || product.nombre) + '" width="' + Number(image.ancho) + '" height="' + Number(image.alto) + '" fetchpriority="high" decoding="async">' +
      (many ? '<button class="gallery__arrow gallery__arrow--next" type="button" data-dir="1" aria-label="Imagen siguiente">' + ARROW_NEXT + "</button>" : "") +
      "</div>" +
      (many
        ? '<ul class="gallery__thumbs" aria-label="Imágenes del producto">' +
          images.map(function (item, index) {
            return '<li><button class="gallery__thumb" type="button" data-index="' + index + '" aria-label="Ver imagen ' + (index + 1) + '"' + (index === imageIndex ? ' aria-current="true"' : "") + '><img src="' + esc(item.src) + '" alt="" width="' + Number(item.ancho) + '" height="' + Number(item.alto) + '" loading="lazy"></button></li>';
          }).join("") +
          "</ul>"
        : "")
    );
  }

  function renderGallery() {
    document.getElementById("galeria").innerHTML = galleryHtml();
  }

  function colorPickerHtml() {
    var colors = (product.colores || []).filter(function (color) { return UI.validHex(color.hex); });
    var selectable = colors.some(function (color) { return color.imagenes && color.imagenes.length; });
    if (!selectable) {
      return '<div class="buy__group buy__fixed"><span class="buy__legend">Color</span>' +
        '<p class="buy__fixed-text">Esta pieza va en los colores que ves en la foto. ¿La quieres en otros? ' +
        '<a href="pedidos-personalizados.html?producto=' + encodeURIComponent(product.id) + '">Pídela personalizada</a>.</p></div>';
    }
    var single = colors.length === 1;

    return (
      '<fieldset class="buy__group" id="grupo-color"><legend class="buy__legend">Elige un color<span class="buy__picked" id="color-elegido"></span></legend>' +
      '<div class="color-picker">' +
      colors.map(function (color, index) {
        var off = color.disponible === false;
        return '<label class="color-pick" title="' + esc(color.nombre) + (off ? " (agotado)" : "") + '"><input type="radio" name="color" value="' + esc(color.nombre) + '"' + (off ? " disabled" : "") + (single && !off ? " checked" : "") + '><span class="color-pick__dot" style="--swatch:' + color.hex + '"></span><span class="sr-only">' + esc(color.nombre) + (off ? ", no disponible" : "") + "</span></label>";
      }).join("") +
      "</div>" +
      '<p class="buy__error" id="color-error" role="alert" hidden>Elige un color</p></fieldset>'
    );
  }

  function materialHtml() {
    var materials = product.materiales || [];
    if (materials.length < 2) { return ""; }

    return (
      '<fieldset class="buy__group"><legend class="buy__legend">Material</legend><div class="toggle-group">' +
      materials.map(function (material, index) {
        return '<label class="toggle"><input type="radio" name="material" value="' + esc(material) + '"' + (index === 0 ? " checked" : "") + "><span>" + esc(material) + "</span></label>";
      }).join("") +
      "</div></fieldset>"
    );
  }

  function detailHtml() {
    var materials = product.materiales || [];
    var rating = Math.max(0, Math.min(5, Number(product.calificacion) || 0));
    var unit = product.precioUnidad ? " " + esc(product.precioUnidad) : "";

    return (
      '<div class="gallery" id="galeria">' + galleryHtml() + "</div>" +
      '<div class="product-info">' +
      '<a class="chip chip--pale product-info__category" href="catalogo.html?categoria=' + encodeURIComponent(product.categoria) + '">' + esc(categoryName(product.categoria)) + "</a>" +
      '<h1 class="product-info__title">' + esc(product.nombre) + "</h1>" +
      '<div class="product-info__rating"><span class="stars" style="--rating: ' + rating + '" role="img" aria-label="' + rating + ' de 5 estrellas"></span><span>' + rating + "</span></div>" +
      '<p class="product-info__price">' + UI.formatPrice(product.precio, 2) + " <small>MXN" + unit + "</small></p>" +
      '<p class="product-info__desc">' + esc(product.descripcion || "") + "</p>" +
      '<dl class="product-info__facts">' +
      '<div><dt>Material</dt><dd>' + (materials.length ? esc(materials.join(" o ")) : "Por definir") + "</dd></div>" +
      (product.medidas ? '<div><dt>Medidas</dt><dd>' + esc(product.medidas) + "</dd></div>" : "") +
      '<div><dt>Disponibilidad</dt><dd><span class="status' + (available ? "" : " status--out") + '">' + (available ? "Disponible" : "Agotado") + "</span></dd></div>" +
      '<div><dt>Entrega</dt><dd>Solo en San Luis Potosí</dd></div>' +
      "</dl>" +
      '<form class="buy" id="compra" novalidate>' +
      colorPickerHtml() +
      materialHtml() +
      (isStaff() ? staffBoxHtml() : '<div class="buy__row">' +
      '<div class="buy__group buy__group--qty"><label class="buy__legend" for="cantidad">Cantidad</label>' +
      '<div class="qty"><button class="qty__btn" type="button" data-step="-1" aria-label="Disminuir cantidad">−</button>' +
      '<input class="qty__input" id="cantidad" name="cantidad" type="number" inputmode="numeric" min="1" max="' + window.MakkaCart.MAX_QTY + '" value="1">' +
      '<button class="qty__btn" type="button" data-step="1" aria-label="Aumentar cantidad">+</button></div></div>' +
      '<button class="btn btn--honey btn--lg buy__add" type="submit"' + (available ? "" : " disabled") + '><img class="btn__icon" src="assets/img/icons/cart.svg" alt="" width="24" height="24">Agregar al carrito</button>' +
      "</div>" +
      '<p class="buy__error" id="cantidad-error" role="alert" hidden>La cantidad debe ser mayor a 0</p>' +
      (available ? "" : '<p class="buy__soldout">Por ahora no disponible, pero puedes pedirlo personalizado.</p>') +
      '<a class="btn btn--violet btn--lg buy__custom" href="pedidos-personalizados.html?producto=' + encodeURIComponent(product.id) + '"><img class="btn__icon" src="assets/img/icons/sparkle.svg" alt="" width="24" height="24">Me gusta, lo quiero más personalizado</a>') +
      "</form>" +
      '<p class="product-info__note">Los colores pueden variar un poco de la foto porque cada pieza se imprime a mano.</p>' +
      "</div>"
    );
  }

  function isStaff() {
    return Boolean(window.MakkaSession && window.MakkaSession.isAdmin());
  }

  function staffBoxHtml() {
    return '<div class="staff-note"><p>Eres administrador, por eso aquí no se compra. Este producto se gestiona desde el panel.</p>' +
      '<a class="btn btn--violet btn--lg" href="admin-productos.html?editar=' + encodeURIComponent(product.id) + '">Editar este producto</a></div>';
  }

  function bindDetail() {
    var gallery = document.getElementById("galeria");
    var form = document.getElementById("compra");
    var qtyInput = document.getElementById("cantidad");
    var qtyError = document.getElementById("cantidad-error");
    var colorError = document.getElementById("color-error");
    var picked = document.getElementById("color-elegido");
    var touchStart = null;

    function go(step) {
      imageIndex = (imageIndex + step + images.length) % images.length;
      renderGallery();
    }

    gallery.addEventListener("click", function (event) {
      var arrow = event.target.closest("[data-dir]");
      var thumb = event.target.closest("[data-index]");
      if (arrow) {
        go(Number(arrow.getAttribute("data-dir")));
      } else if (thumb) {
        imageIndex = Number(thumb.getAttribute("data-index"));
        renderGallery();
      }
    });

    gallery.addEventListener("touchstart", function (event) {
      touchStart = event.changedTouches[0].clientX;
    }, { passive: true });

    gallery.addEventListener("touchend", function (event) {
      if (touchStart === null || images.length < 2) { return; }
      var delta = event.changedTouches[0].clientX - touchStart;
      touchStart = null;
      if (Math.abs(delta) > 40) { go(delta < 0 ? 1 : -1); }
    }, { passive: true });

    document.querySelectorAll('input[name="color"]').forEach(function (input) {
      function sync() {
        if (!input.checked) { return; }
        selectedColor = (product.colores || []).filter(function (color) { return color.nombre === input.value; })[0] || null;
        picked.textContent = ": " + input.value;
        if (colorError) { colorError.hidden = true; }
        var next = imagesFor(product, selectedColor);
        if (next !== images) {
          images = next;
          imageIndex = 0;
          renderGallery();
        }
      }
      input.addEventListener("change", sync);
      sync();
    });

    // Si llegó desde el catálogo con ?color=, deja ese color elegido
    var wanted = new URLSearchParams(window.location.search).get("color");
    if (wanted) {
      Array.prototype.some.call(document.querySelectorAll('input[name="color"]'), function (input) {
        if (input.value !== wanted || input.disabled) { return false; }
        input.checked = true;
        input.dispatchEvent(new Event("change"));
        return true;
      });
    }

    // Precarga las fotos de cada color la primera vez que el usuario se acerca a los colores
    var picker = document.querySelector(".color-picker");
    if (picker) {
      var preloaded = false;
      var preload = function () {
        if (preloaded) { return; }
        preloaded = true;
        (product.colores || []).forEach(function (color) {
          (color.imagenes || []).forEach(function (item) { new Image().src = item.grande || item.src; });
        });
      };
      picker.addEventListener("pointerover", preload, { once: true });
      picker.addEventListener("focusin", preload, { once: true });
    }

    document.querySelectorAll("[data-step]").forEach(function (button) {
      button.addEventListener("click", function () {
        var current = parseQuantity(qtyInput.value) || 1;
        var next = Math.max(1, Math.min(window.MakkaCart.MAX_QTY, current + Number(button.getAttribute("data-step"))));
        qtyInput.value = next;
        qtyError.hidden = true;
      });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!available || isStaff()) { return; }

      var quantity = parseQuantity(qtyInput.value);
      var colorInput = form.querySelector('input[name="color"]');
      var colorValue = (form.querySelector('input[name="color"]:checked') || {}).value || "";
      var materialValue = (form.querySelector('input[name="material"]:checked') || {}).value || (product.materiales || [])[0] || "";

      qtyError.hidden = quantity !== null;
      if (colorError) { colorError.hidden = !colorInput || Boolean(colorValue); }

      if (quantity === null) { qtyInput.focus(); return; }
      if (colorInput && !colorValue) { colorInput.focus(); return; }

      window.MakkaCart.add({ id: product.id, color: colorValue, material: materialValue, cantidad: quantity });
      window.MakkaToast.show({ mensaje: "Producto agregado al carrito", enlace: { texto: "Ver carrito", href: "carrito.html" } });
    });
  }

  function render() {
    available = product.disponible !== false;
    selectedColor = null;
    images = imagesFor(product, null);
    imageIndex = 0;

    detail.innerHTML = detailHtml();
    detail.setAttribute("aria-busy", "false");
    bindDetail();

    var category = categoryName(product.categoria);
    crumbs.innerHTML =
      '<li><a href="catalogo.html">Catálogo</a></li>' +
      '<li><a href="catalogo.html?categoria=' + encodeURIComponent(product.categoria) + '">' + esc(category) + "</a></li>" +
      '<li aria-current="page">' + esc(product.nombre) + "</li>";

    document.title = product.nombre + " | Makka Studio";
    var meta = document.querySelector('meta[name="description"]');
    if (meta) { meta.setAttribute("content", product.nombre + ": " + (product.descripcion || "")); }

    var related = relatedProducts(catalog.productos, product, 4);
    relatedGrid.innerHTML = related.map(function (item) { return UI.cardHtml(item, 4); }).join("");
    relatedSection.hidden = related.length === 0;
  }

  function load() {
    var params = new URLSearchParams(window.location.search);
    var id = params.get("id");

    showLoading();
    window.MakkaApi.getCatalogo()
      .then(function (data) {
        catalog = data;
        product = id ? findProduct(data.productos, id) : null;
        if (!product) { showNotFound(); return; }
        render();
      })
      .catch(showError);
  }

  retry.addEventListener("click", load);
  load();
})();
