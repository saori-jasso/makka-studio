/* "Lo más querido": los productos visibles marcados como destacados (hasta 4); si faltan, se completa con los siguientes del catálogo. */
(function () {
  var grid = document.getElementById("destacados");
  if (!grid || !window.MakkaApi) { return; }

  var esc = window.MakkaUI.escapeHtml;

  function card(product) {
    var image = product.imagen || {};
    var rating = Math.max(0, Math.min(5, Number(product.calificacion) || 0));
    return (
      '<article class="product-card"><a class="product-card__link" href="producto.html?id=' + encodeURIComponent(product.id) + '">' +
      '<div class="product-card__media"><img src="' + esc(image.src) + '" alt="' + esc(image.alt || product.nombre) + '" width="' + Number(image.ancho) + '" height="' + Number(image.alto) + '" loading="lazy"></div>' +
      '<div class="product-card__body"><h3 class="product-card__name">' + esc(product.nombre) + "</h3>" +
      '<span class="stars" style="--rating: ' + rating + '" role="img" aria-label="' + rating + ' de 5 estrellas"></span></div></a></article>'
    );
  }

  function pick(products) {
    var flagged = products.filter(function (product) { return product.destacado === true; });
    var others = products.filter(function (product) { return product.destacado !== true; });
    return flagged.concat(others).slice(0, 4);
  }

  window.MakkaApi.getCatalogo().then(function (catalog) {
    var list = pick(catalog.productos || []);
    grid.innerHTML = list.map(card).join("");
    if (!list.length) { grid.outerHTML = '<p class="section-head__text">Pronto tendremos piezas nuevas. Mientras tanto, mira el catálogo.</p>'; }
  }).catch(function () {
    grid.outerHTML = '<p class="section-head__text">No pudimos cargar las piezas. Intenta de nuevo en un momento.</p>';
  });
})();

(function () {
  var bee = document.getElementById("hero-bee");
  var bubble = document.getElementById("hero-bubble");

  if (!bee || !bubble) {
    return;
  }

  var phrases = [
    "¡Bzzz! ¡Hola!",
    "¿Qué vamos a imprimir hoy?",
    "Aquí cada pieza es única",
    "¡Mira el catálogo!",
    "Yo pongo las alas, tú la idea"
  ];
  var index = 0;

  bee.addEventListener("click", function () {
    index = (index + 1) % phrases.length;
    bubble.textContent = phrases[index];
  });
})();
