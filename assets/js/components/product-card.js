/*
 * Piezas de interfaz compartidas por Catálogo y Detalle de producto.
 * Debe cargarse antes de los scripts de cada página.
 */
window.MakkaUI = (function () {
  "use strict";

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function formatPrice(value, decimals) {
    var parts = Number(value).toFixed(decimals || 0).split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return "$" + parts.join(".");
  }

  function validHex(value) {
    return /^#[0-9a-f]{6}$/i.test(String(value));
  }

  var ARROW_PREV = '<svg viewBox="0 0 24 24" fill="none" stroke="#111111" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>';
  var ARROW_NEXT = '<svg viewBox="0 0 24 24" fill="none" stroke="#111111" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>';

  /* El color de la foto principal: el que aparece en su texto alternativo ("...rosa", "...roja"). */
  function mainColorIndex(colors, mainImage) {
    var alt = String((mainImage && mainImage.alt) || "").toLowerCase();
    for (var i = 0; i < colors.length; i += 1) {
      var stem = String(colors[i].nombre).toLowerCase().slice(0, -1);
      if (stem.length >= 3 && new RegExp("(^|[^a-záéíóúñ])" + stem).test(alt)) { return i; }
    }
    return -1;
  }

  /*
   * Fotos que se pueden deslizar en la tarjeta: la principal primero y luego la de cada color.
   * Cada una es { nombre: color o "", imagen }. Con un solo color (o ninguno) no hay nada que deslizar.
   */
  function slidesFor(product) {
    var main = product.imagen || {};
    var colors = (product.colores || []).filter(function (color) {
      return validHex(color.hex) && color.disponible !== false && color.imagenes && color.imagenes.length;
    });
    if (colors.length < 2) { return [{ nombre: "", imagen: main }]; }

    var match = mainColorIndex(colors, main);
    var slides = [{ nombre: match === -1 ? "" : colors[match].nombre, imagen: main }];
    colors.forEach(function (color, position) {
      if (position !== match) { slides.push({ nombre: color.nombre, imagen: color.imagenes[0] }); }
    });
    return slides;
  }

  function cardHtml(product, index) {
    var rating = Math.max(0, Math.min(5, Number(product.calificacion) || 0));
    var slides = slidesFor(product);
    var many = slides.length > 1;
    var linked = {};
    slides.forEach(function (slide) { linked[slide.nombre] = true; });
    var href = "producto.html?id=" + encodeURIComponent(product.id);
    var first = slides[0].nombre;

    var slideItems = slides.map(function (slide, position) {
      var image = slide.imagen || {};
      var label = slide.nombre ? " en color " + slide.nombre : "";
      return '<li class="card-slide" data-color="' + escapeHtml(slide.nombre) + '">' +
        '<a class="card-slide__link" draggable="false" href="' + href + (slide.nombre ? "&amp;color=" + encodeURIComponent(slide.nombre) : "") + '" tabindex="-1" aria-label="Ver ' + escapeHtml(product.nombre + label) + '">' +
        '<img src="' + escapeHtml(image.src) + '" alt="' + escapeHtml(image.alt || product.nombre) + '" width="' + Number(image.ancho) + '" height="' + Number(image.alto) + '" draggable="false"' +
        (index < 4 && position === 0 ? ' fetchpriority="high"' : ' loading="lazy"') + ' decoding="async"></a></li>';
    }).join("");

    var swatches = (product.colores || [])
      .filter(function (color) { return validHex(color.hex); })
      .map(function (color) {
        var name = escapeHtml(color.nombre);
        if (many && linked[color.nombre]) {
          return '<li><button class="swatch swatch--btn" type="button" data-color="' + name + '" style="--swatch:' + color.hex + '" aria-pressed="' + (color.nombre === first) + '" aria-label="Ver en color ' + name + '" title="' + name + '"></button></li>';
        }
        return '<li class="swatch" style="--swatch:' + color.hex + '" title="' + name + '"><span class="sr-only">' + name + "</span></li>";
      })
      .join("");

    return (
      '<li><article class="product-card product-card--stretch">' +
      '<div class="product-card__media">' +
      (product.personalizable ? '<span class="product-card__tag">Personalizable</span>' : "") +
      '<ul class="card-slides' + (many ? " card-slides--many" : "") + '"' + (many ? ' aria-label="Colores de ' + escapeHtml(product.nombre) + '"' : "") + ">" + slideItems + "</ul>" +
      (many
        ? '<button class="card-arrow card-arrow--prev" type="button" data-dir="-1" aria-label="Color anterior">' + ARROW_PREV + "</button>" +
          '<button class="card-arrow card-arrow--next" type="button" data-dir="1" aria-label="Color siguiente">' + ARROW_NEXT + "</button>" +
          '<span class="product-card__color" aria-live="polite"' + (first ? "" : " hidden") + ">" + escapeHtml(first) + "</span>"
        : "") +
      "</div>" +
      '<div class="product-card__body">' +
      '<h3 class="product-card__name"><a class="product-card__link--stretch" href="' + href + '">' + escapeHtml(product.nombre) + "</a></h3>" +
      '<span class="stars" style="--rating: ' + rating + '" role="img" aria-label="' + rating + ' de 5 estrellas"></span>' +
      '<p class="product-card__desc">' + escapeHtml(product.descripcion || "") + "</p>" +
      (swatches ? '<ul class="swatches" aria-label="Colores disponibles">' + swatches + "</ul>" : "") +
      '<p class="product-card__price">' + formatPrice(product.precio) + " <small>MXN" + (product.precioUnidad ? " " + escapeHtml(product.precioUnidad) : "") + "</small></p>" +
      "</div></article></li>"
    );
  }

  /* ---------- Deslizar fotos de color en las tarjetas ---------- */

  function reducedMotion() {
    return Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function slideIndex(list) {
    var width = list.clientWidth || 1;
    return Math.max(0, Math.min(list.children.length - 1, Math.round(list.scrollLeft / width)));
  }

  function goTo(list, position) {
    var last = list.children.length - 1;
    var target = position > last ? 0 : position < 0 ? last : position;
    if (list.scrollTo) {
      list.scrollTo({ left: target * list.clientWidth, behavior: reducedMotion() ? "auto" : "smooth" });
    } else {
      list.scrollLeft = target * list.clientWidth;
    }
  }

  /* Pone el nombre del color y marca el punto de color que corresponde a la foto que se ve */
  function syncCard(list) {
    var card = list.closest(".product-card");
    var slide = list.children[slideIndex(list)];
    if (!card || !slide) { return; }
    var color = slide.getAttribute("data-color") || "";
    var label = card.querySelector(".product-card__color");
    if (label) {
      label.textContent = color;
      label.hidden = !color;
    }
    Array.prototype.forEach.call(card.querySelectorAll(".swatch--btn"), function (button) {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-color") === color));
    });
  }

  function initCarousels() {
    if (typeof document === "undefined" || !document.addEventListener) { return; }
    var drag = null;
    var blockClick = false;

    // "scroll" no sube por el documento, por eso se escucha en la fase de captura
    document.addEventListener("scroll", function (event) {
      var list = event.target;
      if (!list || !list.classList || !list.classList.contains("card-slides") || list.makkaFrame) { return; }
      list.makkaFrame = window.requestAnimationFrame(function () {
        list.makkaFrame = 0;
        syncCard(list);
      });
    }, true);

    document.addEventListener("click", function (event) {
      if (blockClick) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      var arrow = event.target.closest && event.target.closest(".card-arrow");
      var dot = event.target.closest && event.target.closest(".swatch--btn");
      var card = (arrow || dot) && (arrow || dot).closest(".product-card");
      var list = card && card.querySelector(".card-slides");
      if (!list) { return; }
      if (arrow) {
        goTo(list, slideIndex(list) + Number(arrow.getAttribute("data-dir")));
      } else {
        var name = dot.getAttribute("data-color");
        Array.prototype.forEach.call(list.children, function (slide, position) {
          if (slide.getAttribute("data-color") === name) { goTo(list, position); }
        });
      }
    }, true);

    // Con el mouse también se puede arrastrar la foto (en pantallas táctiles ya se desliza sola)
    document.addEventListener("pointerdown", function (event) {
      if (event.pointerType !== "mouse" || event.button !== 0) { return; }
      var list = event.target.closest && event.target.closest(".card-slides--many");
      if (!list) { return; }
      drag = { list: list, x: event.clientX, left: list.scrollLeft, start: slideIndex(list), moved: false };
    });

    document.addEventListener("pointermove", function (event) {
      if (!drag) { return; }
      var delta = event.clientX - drag.x;
      if (!drag.moved && Math.abs(delta) > 6) {
        drag.moved = true;
        drag.list.classList.add("is-dragging");
      }
      if (drag.moved) { drag.list.scrollLeft = drag.left - delta; }
    });

    function endDrag(event) {
      if (!drag) { return; }
      var finished = drag;
      drag = null;
      if (!finished.moved) { return; }
      var delta = event.clientX - finished.x;
      var threshold = finished.list.clientWidth * 0.18;
      var next = finished.start + (delta < -threshold ? 1 : delta > threshold ? -1 : 0);
      finished.list.classList.remove("is-dragging");
      goTo(finished.list, Math.max(0, Math.min(finished.list.children.length - 1, next)));
      blockClick = true; // el arrastre no debe abrir el producto
      window.setTimeout(function () { blockClick = false; }, 0);
    }
    document.addEventListener("pointerup", endDrag);
    document.addEventListener("pointercancel", endDrag);
  }

  initCarousels();

  return { escapeHtml: escapeHtml, formatPrice: formatPrice, validHex: validHex, cardHtml: cardHtml, slidesFor: slidesFor };
})();
