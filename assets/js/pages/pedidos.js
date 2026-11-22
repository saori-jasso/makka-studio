(function () {
  "use strict";

  var UI = window.MakkaUI;
  var esc = UI.escapeHtml;

  var MAX_MODEL = 50 * 1024 * 1024;
  var MAX_IMAGE = 5 * 1024 * 1024;
  var MAX_REFS = 5;
  var MAX_QTY = 99;
  var DRAFT_KEY = "makka_pedido_borrador";

  var COLOR_NAMES = {
    "Black": "Negro",
    "White": "Blanco",
    "Matte Beige": "Beige mate",
    "Orange": "Naranja",
    "Cocoa Brown": "Café cacao",
    "Sunflower Yellow": "Amarillo girasol",
    "Yellow": "Amarillo",
    "Green": "Verde",
    "Gray": "Gris",
    "Cyan": "Cian",
    "Blue": "Azul",
    "Red": "Rojo",
    "Purple": "Morado",
    "Gold": "Dorado",
    "Rosa (Pink)": "Rosa",
    "Teal": "Turquesa"
  };

  /* ---------- Funciones puras ---------- */

  function normalize(text) {
    return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  }

  function matchProducts(products, query, limit) {
    var words = normalize(query).split(/\s+/).filter(Boolean);
    var list = products.filter(function (product) {
      var haystack = normalize(product.nombre + " " + (product.categoria || ""));
      return words.every(function (word) { return haystack.indexOf(word) !== -1; });
    });
    return typeof limit === "number" ? list.slice(0, limit) : list;
  }

  /* Colores del inventario real, sin repetir el mismo nombre (aunque cambie la marca o el material). */
  function buildPalette(filaments) {
    var seen = {};
    var palette = [];
    (filaments || []).forEach(function (filament) {
      var name = filament.material === "PETG" && filament.nombre === "Rosa (Pink)" ? "Rosa fuerte" : (COLOR_NAMES[filament.nombre] || filament.nombre);
      if (seen[name] || !UI.validHex(filament.hex)) { return; }
      seen[name] = true;
      palette.push({ nombre: name, hex: filament.hex });
    });
    return palette;
  }

  function formatSize(bytes) {
    if (bytes >= 1024 * 1024) { return (bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "") + " MB"; }
    return Math.max(1, Math.round(bytes / 1024)) + " KB";
  }

  function extension(name) {
    var match = /\.([^.]+)$/.exec(String(name).toLowerCase());
    return match ? match[1] : "";
  }

  function validateModel(file) {
    var ok = ["stl", "obj"].indexOf(extension(file.name)) !== -1 && file.size > 0 && file.size <= MAX_MODEL;
    return ok ? "" : "Archivo no compatible. Sube un .STL u .OBJ de hasta 50 MB.";
  }

  function validateImage(file) {
    var ok = ["jpg", "jpeg", "png"].indexOf(extension(file.name)) !== -1 && file.size > 0 && file.size <= MAX_IMAGE;
    return ok ? "" : "Imagen no compatible. Sube JPG o PNG de hasta 5 MB.";
  }

  function parseQuantity(value) {
    var number = Number(value);
    return isFinite(number) && number >= 1 && Math.floor(number) === number ? number : null;
  }

  /* values: { tipoPedido, producto, categoria, colores[], otroActivo, colorOtro, tamano, descripcion, cantidad } */
  function validateForm(values) {
    var errors = {};
    var order = [];

    function fail(key, message) {
      errors[key] = message;
      order.push(key);
    }

    if (!values.tipoPedido) { fail("tipoPedido", "Elige qué quieres pedir"); }
    if (values.tipoPedido === "modificacion" && !values.producto) { fail("producto", "Elige un producto de la lista"); }
    if (!values.categoria) { fail("categoria", "Elige un tipo de producto"); }

    var hasColors = values.colores.length > 0;
    var other = String(values.colorOtro || "").trim();
    if (values.otroActivo && !other) {
      fail("colorOtro", "Cuéntanos qué color quieres");
    } else if (!hasColors && !values.otroActivo) {
      fail("colores", "Elige al menos un color");
    }

    if (!String(values.tamano || "").trim()) { fail("tamano", "Cuéntanos el tamaño aproximado"); }
    if (parseQuantity(values.cantidad) === null) { fail("cantidad", "La cantidad debe ser mayor a 0"); }
    if (!String(values.descripcion || "").trim()) { fail("descripcion", "Describe tu diseño"); }

    return { ok: order.length === 0, errors: errors, order: order };
  }

  window.MakkaPedidoLogic = {
    normalize: normalize,
    matchProducts: matchProducts,
    buildPalette: buildPalette,
    formatSize: formatSize,
    validateModel: validateModel,
    validateImage: validateImage,
    parseQuantity: parseQuantity,
    validateForm: validateForm
  };

  /* ---------- Interfaz ---------- */

  var form = document.getElementById("pedido-form");
  if (!form) {
    return;
  }

  var loading = document.getElementById("pedido-cargando");
  var content = document.getElementById("pedido-contenido");
  var successBox = document.getElementById("pedido-exito");
  var errorBox = document.getElementById("pedido-error");
  var retry = document.getElementById("error-reintentar");
  var summary = document.getElementById("pedido-resumen-error");
  var sessionNote = document.getElementById("pedido-nota-sesion");
  var gate = document.getElementById("pedido-sesion");

  var categorySelect = document.getElementById("pp-categoria");
  var materialSelect = document.getElementById("pp-material");
  var sizeInput = document.getElementById("pp-tamano");
  var descInput = document.getElementById("pp-descripcion");
  var descCount = document.getElementById("pp-descripcion-cuenta");
  var textInput = document.getElementById("pp-texto");
  var dateInput = document.getElementById("pp-fecha");
  var qtyInput = document.getElementById("pp-cantidad");
  var picker = document.getElementById("pp-colores");
  var otherCheck = document.getElementById("pp-otro-check");
  var otherGroup = document.getElementById("grupo-colorOtro");
  var otherInput = document.getElementById("pp-color-otro");
  var colorSummary = document.getElementById("pp-colores-elegidos");

  var productGroup = document.getElementById("grupo-producto");
  var comboInput = document.getElementById("pp-producto");
  var comboList = document.getElementById("pp-lista");
  var comboBox = document.getElementById("combo");
  var pickedBox = document.getElementById("pp-producto-elegido");
  var pickedImg = document.getElementById("pp-producto-img");
  var pickedName = document.getElementById("pp-producto-nombre");
  var pickedMeta = document.getElementById("pp-producto-meta");
  var pickedChange = document.getElementById("pp-producto-cambiar");
  var productHint = document.getElementById("ayuda-producto");

  var products = [];
  var categories = [];
  var palette = [];
  var state = { producto: null, modelo: null, refs: [] };
  var matches = [];
  var activeIndex = -1;
  var baseline = "";
  var drops = {};

  var CONTROLS = {
    tipoPedido: function () { return form.querySelector('input[name="tipoPedido"]'); },
    producto: function () { return state.producto ? pickedChange : comboInput; },
    categoria: function () { return categorySelect; },
    colores: function () { return picker.querySelector("input"); },
    colorOtro: function () { return otherInput; },
    tamano: function () { return sizeInput; },
    cantidad: function () { return qtyInput; },
    descripcion: function () { return descInput; }
  };

  function show(target) {
    [loading, content, successBox, errorBox].forEach(function (box) { box.hidden = box !== target; });
  }

  /* Opción final del selector para lo que no cabe en ninguna categoría del catálogo */
  var OTHER_CATEGORY = { slug: "otro", nombre: "Otro" };

  function categoryName(slug) {
    var found = categories.concat([OTHER_CATEGORY]).filter(function (category) { return category.slug === slug; })[0];
    return found ? found.nombre : "";
  }

  /* ---------- Errores ---------- */

  function setError(key, message) {
    var box = document.getElementById("err-" + key);
    var control = CONTROLS[key] && CONTROLS[key]();
    if (box) {
      box.hidden = !message;
      box.textContent = message || "";
    }
    if (control && control.tagName !== "BUTTON") {
      if (message) { control.setAttribute("aria-invalid", "true"); } else { control.removeAttribute("aria-invalid"); }
    }
  }

  function clearErrors() {
    Object.keys(CONTROLS).forEach(function (key) { setError(key, ""); });
    summary.hidden = true;
  }

  function showErrors(result) {
    Object.keys(CONTROLS).forEach(function (key) { setError(key, result.errors[key] || ""); });
    summary.hidden = result.ok;
    if (!result.ok) {
      summary.focus();
      var first = CONTROLS[result.order[0]]();
      if (first) { first.scrollIntoView({ block: "center", behavior: "smooth" }); }
    }
  }

  /* ---------- Colores ---------- */

  function renderPalette() {
    picker.innerHTML = palette.map(function (color) {
      return '<label class="color-pick" title="' + esc(color.nombre) + '"><input type="checkbox" name="color" value="' + esc(color.nombre) + '">' +
        '<span class="color-pick__dot" style="--swatch:' + color.hex + '"></span><span class="sr-only">' + esc(color.nombre) + "</span></label>";
    }).join("");
  }

  function chosenColors() {
    return Array.prototype.map.call(picker.querySelectorAll("input:checked"), function (input) { return input.value; });
  }

  function updateColorSummary() {
    var list = chosenColors();
    if (otherCheck.checked) { list.push("Otro"); }
    colorSummary.textContent = list.length ? "Elegiste: " + list.join(", ") : "Aún no eliges colores.";
  }

  /* ---------- Producto del catálogo (autocompletar) ---------- */

  function renderOptions() {
    if (!matches.length) {
      comboList.innerHTML = '<li class="combo__empty" role="presentation">No encontramos ese producto. Prueba con otra palabra o elige «Un diseño nuevo».</li>';
      return;
    }
    comboList.innerHTML = matches.map(function (product, index) {
      var image = product.imagen || {};
      return '<li class="combo__option" role="option" id="pp-op-' + index + '" data-index="' + index + '" aria-selected="false">' +
        '<img src="' + esc(image.src) + '" alt="" width="44" height="44" loading="lazy">' +
        '<span><span class="combo__name">' + esc(product.nombre) + '</span><span class="combo__cat">' + esc(categoryName(product.categoria)) + "</span></span></li>";
    }).join("");
  }

  function setActive(index) {
    var options = comboList.querySelectorAll('[role="option"]');
    activeIndex = index;
    Array.prototype.forEach.call(options, function (option, i) {
      var on = i === index;
      option.classList.toggle("is-active", on);
      option.setAttribute("aria-selected", String(on));
      if (on) { option.scrollIntoView({ block: "nearest" }); }
    });
    if (index >= 0 && options[index]) { comboInput.setAttribute("aria-activedescendant", options[index].id); } else { comboInput.removeAttribute("aria-activedescendant"); }
  }

  function openList() {
    matches = matchProducts(products, comboInput.value);
    renderOptions();
    comboList.hidden = false;
    comboInput.setAttribute("aria-expanded", "true");
    setActive(-1);
  }

  function closeList() {
    comboList.hidden = true;
    comboInput.setAttribute("aria-expanded", "false");
    comboInput.removeAttribute("aria-activedescendant");
    activeIndex = -1;
  }

  function chooseProduct(product) {
    state.producto = product;
    var image = product.imagen || {};
    pickedImg.src = image.src || "";
    pickedImg.alt = "";
    pickedName.textContent = product.nombre;
    pickedMeta.textContent = categoryName(product.categoria) + " · " + UI.formatPrice(product.precio, 0);
    comboBox.hidden = true;
    productHint.hidden = true;
    pickedBox.hidden = false;
    comboInput.value = "";
    closeList();
    setError("producto", "");
    if (!categorySelect.value && product.categoria) {
      categorySelect.value = product.categoria;
      setError("categoria", "");
    }
  }

  function clearProduct(focus) {
    state.producto = null;
    pickedBox.hidden = true;
    comboBox.hidden = false;
    productHint.hidden = false;
    if (focus) { comboInput.focus(); }
  }

  function currentType() {
    var checked = form.querySelector('input[name="tipoPedido"]:checked');
    return checked ? checked.value : "";
  }

  function applyType() {
    var modification = currentType() === "modificacion";
    productGroup.hidden = !modification;
    if (!modification) {
      clearProduct(false);
      comboInput.value = "";
      closeList();
      setError("producto", "");
    }
  }

  /* ---------- Zonas de carga ---------- */

  function setupDrop(name, options) {
    var root = document.getElementById("drop-" + name);
    var input = root.querySelector(".drop__input");
    var listEl = document.getElementById("lista-" + name);
    var errorEl = document.getElementById("err-" + name);
    function showError(message) {
      errorEl.hidden = !message;
      errorEl.textContent = message || "";
    }

    function render() {
      listEl.innerHTML = "";
      options.get().forEach(function (file, index) {
        var item = document.createElement("li");
        item.className = "file-item";

        var thumb = document.createElement("span");
        thumb.className = "file-item__icon";
        thumb.textContent = extension(file.name).toUpperCase();

        var info = document.createElement("div");
        info.className = "file-item__info";
        var fileName = document.createElement("p");
        fileName.className = "file-item__name";
        fileName.textContent = file.name;
        fileName.title = file.name;
        var fileSize = document.createElement("p");
        fileSize.className = "file-item__size";
        fileSize.textContent = formatSize(file.size);
        info.appendChild(fileName);
        info.appendChild(fileSize);

        var remove = document.createElement("button");
        remove.type = "button";
        remove.className = "file-item__remove";
        remove.setAttribute("aria-label", "Quitar " + file.name);
        remove.innerHTML = '<img src="assets/img/icons/trash.svg" alt="" width="20" height="20">';
        remove.addEventListener("click", function () {
          options.remove(index);
          showError("");
          render();
          input.focus();
        });

        item.appendChild(thumb);
        item.appendChild(info);
        item.appendChild(remove);
        listEl.appendChild(item);
      });
    }

    function add(files) {
      var message = "";
      Array.prototype.forEach.call(files, function (file) {
        var problem = options.validate(file);
        if (problem) {
          message = message || problem;
        } else if (!options.add(file)) {
          message = message || options.fullMessage;
        }
      });
      showError(message);
      render();
    }

    input.addEventListener("change", function () {
      add(input.files);
      input.value = "";
    });

    ["dragenter", "dragover"].forEach(function (type) {
      root.addEventListener(type, function (event) { event.preventDefault(); root.classList.add("is-dragover"); });
    });
    ["dragleave", "drop"].forEach(function (type) {
      root.addEventListener(type, function (event) { event.preventDefault(); root.classList.remove("is-dragover"); });
    });
    root.addEventListener("drop", function (event) {
      if (event.dataTransfer && event.dataTransfer.files) { add(event.dataTransfer.files); }
    });

    drops[name] = { render: render, showError: showError };
  }

  /* ---------- Lectura y envío ---------- */

  function collect() {
    return {
      tipoPedido: currentType(),
      producto: currentType() === "modificacion" ? state.producto : null,
      categoria: categorySelect.value,
      colores: chosenColors(),
      otroActivo: otherCheck.checked,
      colorOtro: otherInput.value,
      material: materialSelect.value,
      tamano: sizeInput.value,
      descripcion: descInput.value,
      texto: textInput.value,
      fecha: dateInput.value,
      cantidad: qtyInput.value
    };
  }

  function snapshot() {
    var values = collect();
    values.producto = values.producto ? values.producto.id : null;
    values.modelo = state.modelo ? state.modelo.name : "";
    values.refs = state.refs.map(function (file) { return file.name; });
    return JSON.stringify(values);
  }

  function isDirty() {
    return snapshot() !== baseline;
  }

  function saveDraft(values) {
    var draft = Object.assign({}, values, { producto: values.producto ? values.producto.id : null });
    try { window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (error) { /* sin almacenamiento */ }
  }

  function restoreDraft() {
    var draft;
    try {
      draft = JSON.parse(window.sessionStorage.getItem(DRAFT_KEY) || "null");
      window.sessionStorage.removeItem(DRAFT_KEY);
    } catch (error) {
      return false;
    }
    if (!draft) { return false; }

    var radio = form.querySelector('input[name="tipoPedido"][value="' + (draft.tipoPedido === "modificacion" ? "modificacion" : "nuevo") + '"]');
    if (draft.tipoPedido && radio) { radio.checked = true; }
    applyType();
    if (draft.producto) {
      var product = products.filter(function (item) { return String(item.id) === String(draft.producto); })[0];
      if (product) { chooseProduct(product); }
    }
    if (draft.categoria) { categorySelect.value = draft.categoria; }
    (draft.colores || []).forEach(function (name) {
      var input = Array.prototype.filter.call(picker.querySelectorAll("input"), function (item) { return item.value === name; })[0];
      if (input) { input.checked = true; }
    });
    otherCheck.checked = Boolean(draft.otroActivo);
    otherGroup.hidden = !otherCheck.checked;
    otherInput.value = draft.colorOtro || "";
    if (["PLA", "PETG", "No estoy seguro"].indexOf(draft.material) !== -1) { materialSelect.value = draft.material; }
    sizeInput.value = draft.tamano || "";
    descInput.value = draft.descripcion || "";
    textInput.value = draft.texto || "";
    dateInput.value = draft.fecha || "";
    qtyInput.value = parseQuantity(draft.cantidad) || 1;
    updateColorSummary();
    updateCount();
    return true;
  }

  function showGate() {
    gate.hidden = false;
    gate.focus();
    gate.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function send(values) {
    var request = {
      correo: (window.MakkaSession.user() || {}).email || "",
      tipoPedido: values.tipoPedido === "modificacion" ? "Modificación de un producto del catálogo" : "Diseño nuevo",
      producto: values.producto ? { id: values.producto.id, nombre: values.producto.nombre } : null,
      categoria: values.categoria,
      categoriaNombre: categoryName(values.categoria),
      colores: values.colores.concat(values.otroActivo ? ["Otro: " + values.colorOtro.trim()] : []),
      material: values.material,
      tamano: values.tamano.trim(),
      descripcion: values.descripcion.trim(),
      texto: values.texto.trim(),
      fechaNecesaria: values.fecha || null,
      cantidad: parseQuantity(values.cantidad),
      archivo3d: state.modelo ? { nombre: state.modelo.name, tamano: state.modelo.size } : null,
      imagenesReferencia: state.refs.map(function (file) { return { nombre: file.name, tamano: file.size }; })
    };
    window.MakkaSolicitudes.add(request);
    show(successBox);
    document.getElementById("pedido-exito-titulo").focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    form.reset();
    state.producto = null;
    state.modelo = null;
    state.refs = [];
    clearProduct(false);
    productGroup.hidden = true;
    otherGroup.hidden = true;
    gate.hidden = true;
    clearErrors();
    updateColorSummary();
    updateCount();
    Object.keys(drops).forEach(function (name) { drops[name].showError(""); drops[name].render(); });
    baseline = snapshot();
  }

  function updateCount() {
    descCount.textContent = descInput.value.length + " / 1000";
  }

  function setQuantity(value) {
    var quantity = parseQuantity(value);
    if (quantity === null) {
      setError("cantidad", "La cantidad debe ser mayor a 0");
      qtyInput.value = 1;
      return;
    }
    qtyInput.value = Math.min(MAX_QTY, quantity);
    setError("cantidad", "");
  }

  /* ---------- Eventos ---------- */

  form.addEventListener("change", function (event) {
    var target = event.target;
    if (target.name === "tipoPedido") { applyType(); setError("tipoPedido", ""); }
    if (target.name === "color") { updateColorSummary(); setError("colores", ""); }
    if (target === otherCheck) {
      otherGroup.hidden = !otherCheck.checked;
      updateColorSummary();
      setError("colores", "");
      if (otherCheck.checked) { otherInput.focus(); } else { setError("colorOtro", ""); }
    }
    if (target === categorySelect) { setError("categoria", ""); }
    if (target === qtyInput) { setQuantity(qtyInput.value); }
  });

  form.addEventListener("input", function (event) {
    var target = event.target;
    if (target === sizeInput) { setError("tamano", ""); }
    if (target === otherInput) { setError("colorOtro", ""); }
    if (target === descInput) { setError("descripcion", ""); updateCount(); }
    if (target === comboInput) { openList(); setError("producto", ""); }
  });

  form.addEventListener("click", function (event) {
    var step = event.target.closest("[data-step]");
    if (step) { setQuantity(Number(qtyInput.value) + Number(step.getAttribute("data-step"))); }
  });

  comboInput.addEventListener("focus", openList);
  comboInput.addEventListener("keydown", function (event) {
    var count = comboList.querySelectorAll('[role="option"]').length;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (comboList.hidden) { openList(); }
      if (count) { setActive(Math.min(activeIndex + 1, count - 1)); }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (count) { setActive(Math.max(activeIndex - 1, 0)); }
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (!comboList.hidden && activeIndex >= 0 && matches[activeIndex]) { chooseProduct(matches[activeIndex]); }
    } else if (event.key === "Escape") {
      if (!comboList.hidden) { event.preventDefault(); event.stopPropagation(); closeList(); }
    }
  });

  comboList.addEventListener("mousedown", function (event) {
    var option = event.target.closest('[role="option"]');
    if (option) {
      event.preventDefault();
      chooseProduct(matches[Number(option.getAttribute("data-index"))]);
    }
  });

  document.addEventListener("click", function (event) {
    if (!comboBox.contains(event.target)) { closeList(); }
  });

  pickedChange.addEventListener("click", function () { clearProduct(true); });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    gate.hidden = true;
    var values = collect();
    var result = validateForm(values);
    showErrors(result);
    if (!result.ok) { return; }

    if (!window.MakkaSession.isLoggedIn()) {
      saveDraft(values);
      showGate();
      return;
    }
    send(values);
  });

  document.getElementById("pedido-cancelar").addEventListener("click", function () {
    if (isDirty() && !window.confirm("¿Seguro que quieres cancelar? Perderás lo que escribiste.")) { return; }
    window.location.href = "catalogo.html";
  });

  document.getElementById("pedido-otra").addEventListener("click", function () {
    resetForm();
    show(content);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  /* ---------- Carga ---------- */

  function load() {
    var params = new URLSearchParams(window.location.search);

    show(loading);
    window.MakkaApi.getCatalogo()
      .then(function (data) {
        categories = data.categorias || [];
        products = data.productos || [];
        palette = buildPalette(window.MAKKA_FILAMENTOS);

        categorySelect.innerHTML = '<option value="">Elige una categoría</option>' + categories.concat([OTHER_CATEGORY]).map(function (category) {
          return '<option value="' + esc(category.slug) + '">' + esc(category.nombre) + "</option>";
        }).join("");
        renderPalette();
        updateColorSummary();
        updateCount();

        var today = new Date();
        dateInput.min = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");

        sessionNote.hidden = window.MakkaSession.isLoggedIn();

        var restored = restoreDraft();
        var wanted = params.get("producto");
        if (wanted) {
          var product = products.filter(function (item) { return String(item.id) === String(wanted); })[0];
          if (product) {
            var radio = form.querySelector('input[name="tipoPedido"][value="modificacion"]');
            radio.checked = true;
            applyType();
            chooseProduct(product);
            if (product.materiales && product.materiales.length === 1 && ["PLA", "PETG"].indexOf(product.materiales[0]) !== -1 && !restored) {
              materialSelect.value = product.materiales[0];
            }
          }
        }

        baseline = snapshot();
        show(content);
      })
      .catch(function () { show(errorBox); });
  }

  setupDrop("modelo", {
    validate: validateModel,
    get: function () { return state.modelo ? [state.modelo] : []; },
    add: function (file) { state.modelo = file; return true; },
    remove: function () { state.modelo = null; }
  });

  setupDrop("refs", {
    images: true,
    fullMessage: "Puedes subir hasta 5 imágenes.",
    validate: validateImage,
    get: function () { return state.refs; },
    add: function (file) {
      if (state.refs.length >= MAX_REFS) { return false; }
      state.refs.push(file);
      return true;
    },
    remove: function (index) { state.refs.splice(index, 1); }
  });

  retry.addEventListener("click", load);
  load();
})();
