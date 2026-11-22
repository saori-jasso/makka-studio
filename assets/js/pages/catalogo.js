(function () {
  "use strict";

  var PAGE_SIZE = 8;
  var UI = window.MakkaUI;
  var escapeHtml = UI.escapeHtml;
  var formatPrice = UI.formatPrice;
  var cardHtml = UI.cardHtml;
  var DEFAULTS = { categoria: "todos", q: "", min: null, max: null, material: "", orden: "destacados" };

  /* ---------- Funciones puras (sin DOM) ---------- */

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function toPrice(value) {
    if (value === null || value === undefined || String(value).trim() === "") {
      return null;
    }
    var number = Number(value);
    return isFinite(number) && number >= 0 ? number : NaN;
  }

  function filterProducts(products, state, categories) {
    var names = {};
    categories.forEach(function (category) {
      names[category.slug] = category.nombre;
    });
    var query = normalize(state.q);

    return products.filter(function (product) {
      if (state.categoria !== "todos" && product.categoria !== state.categoria) {
        return false;
      }
      if (state.min !== null && product.precio < state.min) {
        return false;
      }
      if (state.max !== null && product.precio > state.max) {
        return false;
      }
      if (state.material && (product.materiales || []).indexOf(state.material) === -1) {
        return false;
      }
      if (query) {
        var haystack = normalize([product.nombre, product.descripcion, names[product.categoria]].join(" "));
        return haystack.indexOf(query) !== -1;
      }
      return true;
    });
  }

  function sortProducts(products, order) {
    var list = products.slice();
    var sorters = {
      "precio-asc": function (a, b) { return a.precio - b.precio; },
      "precio-desc": function (a, b) { return b.precio - a.precio; },
      calificacion: function (a, b) { return b.calificacion - a.calificacion; },
      nombre: function (a, b) { return a.nombre.localeCompare(b.nombre, "es"); }
    };
    return sorters[order] ? list.sort(sorters[order]) : list;
  }

  function priceSummary(state, bound) {
    if (state.min === null && state.max === null) {
      return "Todos los precios ($0 a " + formatPrice(bound) + " MXN)";
    }
    if (state.max === null) {
      return "Desde " + formatPrice(state.min) + " MXN";
    }
    if (state.min === null) {
      return "Hasta " + formatPrice(state.max) + " MXN";
    }
    return formatPrice(state.min) + " a " + formatPrice(state.max) + " MXN";
  }

  window.MakkaCatalogLogic = {
    normalize: normalize,
    escapeHtml: escapeHtml,
    toPrice: toPrice,
    filterProducts: filterProducts,
    sortProducts: sortProducts,
    priceSummary: priceSummary,
    cardHtml: cardHtml
  };

  /* ---------- Interfaz ---------- */

  var grid = document.getElementById("catalogo-grid");
  if (!grid) {
    return;
  }

  var form = document.getElementById("catalogo-filtros");
  var searchInput = document.getElementById("busqueda");
  var clearSearch = document.getElementById("busqueda-borrar");
  var minInput = document.getElementById("precio-min");
  var maxInput = document.getElementById("precio-max");
  var priceHint = document.getElementById("precio-resumen");
  var priceError = document.getElementById("precio-error");
  var sortSelect = document.getElementById("orden");
  var counter = document.getElementById("catalogo-contador");
  var clearAll = document.getElementById("limpiar-filtros");
  var moreWrap = document.getElementById("catalogo-mas");
  var moreButton = document.getElementById("cargar-mas");
  var emptyBox = document.getElementById("estado-vacio");
  var errorBox = document.getElementById("estado-error");
  var emptyClear = document.getElementById("vacio-limpiar");
  var retryButton = document.getElementById("error-reintentar");
  var categoryButtons = document.querySelectorAll("[data-categoria]");
  var materialInputs = document.querySelectorAll('input[name="material"]');

  var state = Object.assign({}, DEFAULTS);
  var visible = PAGE_SIZE;
  var catalog = { categorias: [], productos: [] };
  var priceBound = 500;
  var debounceTimer;

  function readUrl() {
    var params = new URLSearchParams(window.location.search);
    var slug = params.get("categoria");
    state.categoria = slug || DEFAULTS.categoria;
    state.q = (params.get("q") || "").slice(0, 80);
    state.min = toPrice(params.get("min"));
    state.max = toPrice(params.get("max"));
    state.min = isNaN(state.min) ? null : state.min;
    state.max = isNaN(state.max) ? null : state.max;
    state.material = ["PLA", "PETG"].indexOf(params.get("material")) !== -1 ? params.get("material") : "";
    state.orden = ["precio-asc", "precio-desc", "calificacion", "nombre"].indexOf(params.get("orden")) !== -1 ? params.get("orden") : "destacados";
  }

  function isFiltered() {
    return Object.keys(DEFAULTS).some(function (key) { return state[key] !== DEFAULTS[key]; });
  }

  function syncControls() {
    categoryButtons.forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-categoria") === state.categoria));
    });
    searchInput.value = state.q;
    clearSearch.hidden = !state.q;
    minInput.value = state.min === null ? "" : state.min;
    maxInput.value = state.max === null ? "" : state.max;
    sortSelect.value = state.orden;
    materialInputs.forEach(function (input) { input.checked = input.value === state.material; });
    priceHint.textContent = priceSummary(state, priceBound);
    priceError.hidden = true;
    minInput.removeAttribute("aria-invalid");
    maxInput.removeAttribute("aria-invalid");
  }

  function showLoading() {
    var card =
      '<li><div class="skeleton-card" aria-hidden="true"><div class="skeleton skeleton--media"></div><div class="skeleton skeleton--line"></div><div class="skeleton skeleton--line skeleton--short"></div></div></li>';
    grid.innerHTML = new Array(PAGE_SIZE + 1).join(card);
    grid.setAttribute("aria-busy", "true");
    grid.hidden = false;
    emptyBox.hidden = true;
    errorBox.hidden = true;
    moreWrap.hidden = true;
    clearAll.hidden = true;
    counter.textContent = "Cargando productos...";
  }

  function showError() {
    grid.innerHTML = "";
    grid.hidden = true;
    emptyBox.hidden = true;
    moreWrap.hidden = true;
    errorBox.hidden = false;
    clearAll.hidden = true;
    counter.textContent = "";
  }

  function render(focusIndex) {
    var filtered = sortProducts(filterProducts(catalog.productos, state, catalog.categorias), state.orden);
    var shown = filtered.slice(0, visible);

    grid.innerHTML = shown.map(cardHtml).join("");
    grid.setAttribute("aria-busy", "false");
    grid.hidden = shown.length === 0;
    errorBox.hidden = true;
    emptyBox.hidden = filtered.length !== 0;
    moreWrap.hidden = shown.length >= filtered.length;
    clearAll.hidden = !isFiltered();
    priceHint.textContent = priceSummary(state, priceBound);

    if (filtered.length === 0) {
      counter.textContent = "Mostrando 0 productos";
    } else {
      counter.textContent = "Mostrando " + shown.length + " de " + filtered.length + (filtered.length === 1 ? " producto" : " productos");
    }

    if (typeof focusIndex === "number" && grid.children[focusIndex]) {
      var link = grid.children[focusIndex].querySelector(".product-card__link--stretch") || grid.children[focusIndex].querySelector("a");
      if (link) { link.focus(); }
    }
  }

  function update() {
    visible = PAGE_SIZE;
    render();
  }

  function applyPrice() {
    var min = toPrice(minInput.value);
    var max = toPrice(maxInput.value);
    var message = "";

    if (isNaN(min) || isNaN(max)) {
      message = "Escribe solo números de 0 en adelante.";
    } else if (min !== null && max !== null && min > max) {
      message = "El precio mínimo no puede ser mayor que el máximo.";
    }

    priceError.hidden = !message;
    priceError.textContent = message;
    [minInput, maxInput].forEach(function (input) {
      input[message ? "setAttribute" : "removeAttribute"]("aria-invalid", "true");
    });

    if (message) { return false; }
    state.min = min;
    state.max = max;
    return true;
  }

  function resetAll() {
    state = Object.assign({}, DEFAULTS);
    syncControls();
    update();
  }

  function load() {
    showLoading();
    window.MakkaApi.getCatalogo()
      .then(function (data) {
        catalog = data;
        var top = catalog.productos.reduce(function (max, product) { return Math.max(max, product.precio); }, 0);
        priceBound = Math.max(100, Math.ceil(top / 100) * 100);
        minInput.placeholder = "0";
        maxInput.placeholder = String(priceBound);

        var valid = catalog.categorias.some(function (category) { return category.slug === state.categoria; });
        if (!valid) { state.categoria = "todos"; }

        syncControls();
        render();
      })
      .catch(showError);
  }

  categoryButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      state.categoria = button.getAttribute("data-categoria");
      syncControls();
      update();
    });
  });

  searchInput.addEventListener("input", function () {
    clearSearch.hidden = !searchInput.value;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      state.q = searchInput.value.slice(0, 80);
      update();
    }, 150);
  });

  searchInput.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && searchInput.value) {
      event.preventDefault();
      clearSearch.click();
    }
  });

  clearSearch.addEventListener("click", function () {
    searchInput.value = "";
    state.q = "";
    clearSearch.hidden = true;
    searchInput.focus();
    update();
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    clearTimeout(debounceTimer);
    state.q = searchInput.value.slice(0, 80);
    if (applyPrice()) { update(); }
  });

  materialInputs.forEach(function (input) {
    input.addEventListener("change", function () {
      state.material = input.value;
      update();
    });
  });

  sortSelect.addEventListener("change", function () {
    state.orden = sortSelect.value;
    update();
  });

  moreButton.addEventListener("click", function () {
    var previous = visible;
    visible += PAGE_SIZE;
    render(previous);
  });

  clearAll.addEventListener("click", resetAll);
  emptyClear.addEventListener("click", resetAll);
  retryButton.addEventListener("click", load);

  readUrl();
  syncControls();
  load();
})();
