/*
 * Productos (administrador). Lee y guarda con window.MakkaProductos; cuando exista el backend, solo cambia ese servicio.
 * Las revisiones de esta pantalla son comodidad: el backend debe validar rol, campos e imágenes.
 */
(function () {
  "use strict";

  var UI = window.MakkaUI;
  var esc = UI.escapeHtml;

  var MATERIALS = ["PLA", "PETG"];
  var MAX_IMAGES = 6;
  var MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  var IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
  var PAGE_SIZE = 10;

  var MSG = {
    required: "Completa los campos obligatorios",
    size: "La imagen supera el tamaño permitido",
    format: "Formato no compatible",
    storage: "No se pudo guardar. Libera espacio del navegador (quita imágenes) e intenta de nuevo."
  };

  /* ---------- Funciones puras ---------- */

  /* "" si la imagen sirve; si no, el mensaje de error */
  function imageError(file) {
    if (IMAGE_TYPES.indexOf(String(file.type).toLowerCase()) === -1) { return MSG.format; }
    if (Number(file.size) > MAX_IMAGE_BYTES) { return MSG.size; }
    return "";
  }

  /* Devuelve { ok, errors: { campo: mensaje } } */
  function validate(values, categories) {
    var errors = {};
    var name = String(values.nombre || "").trim();
    var description = String(values.descripcion || "").trim();
    var price = Number(values.precio);
    if (!name) { errors.nombre = MSG.required; }
    if (!categories.some(function (category) { return category.slug === values.categoria; })) { errors.categoria = "Elige una categoría"; }
    if (!description) { errors.descripcion = MSG.required; }
    if (!(values.materiales || []).length) { errors.material = "Elige al menos un material"; }
    if (values.precio === "" || values.precio === null || !isFinite(price) || price <= 0) {
      errors.precio = "Escribe un precio mayor a 0";
    } else if (price > 99999 || Math.abs(price * 100 - Math.round(price * 100)) > 1e-6) {
      errors.precio = "Usa hasta 2 decimales y menos de $100,000";
    }
    if (!(values.imagenes || []).length) { errors.imagenes = "Agrega al menos una imagen"; }
    (values.colores || []).forEach(function (color) {
      if (!String(color.nombre || "").trim()) { errors.colores = "Cada color necesita un nombre"; }
    });
    return { ok: Object.keys(errors).length === 0, errors: errors };
  }

  /* Arma el producto que se guarda: conserva lo que el formulario no toca (calificación, personalizable, etc.) */
  function buildProduct(values, existing) {
    var product = Object.assign({}, existing || {});
    var name = String(values.nombre).trim();
    product.nombre = name;
    product.categoria = values.categoria;
    product.descripcion = String(values.descripcion).trim();
    product.precio = Math.round(Number(values.precio) * 100) / 100;
    product.materiales = MATERIALS.filter(function (material) { return values.materiales.indexOf(material) !== -1; });
    product.visible = !!values.visible;
    product.disponible = !!values.disponible;
    if (values.destacado) { product.destacado = true; } else { delete product.destacado; }
    if (product.calificacion === undefined) { product.calificacion = 5; }
    if (product.personalizable === undefined) { product.personalizable = true; }

    var unit = String(values.precioUnidad || "").trim();
    if (unit) { product.precioUnidad = unit; } else { delete product.precioUnidad; }
    var size = String(values.medidas || "").trim();
    if (size) { product.medidas = size; } else { delete product.medidas; }

    var images = values.imagenes.map(function (image) {
      return { src: image.src, alt: image.alt || name, ancho: image.ancho, alto: image.alto, grande: image.grande || image.src };
    });
    product.imagen = images[0];
    if (images.length > 1) { product.imagenes = images; } else { delete product.imagenes; }

    var colors = (values.colores || []).map(function (color) {
      var label = String(color.nombre).trim();
      var item = { nombre: label, hex: color.hex, filamento: color.filamento || "", imagenes: [] };
      if (color.disponible === false) { item.disponible = false; }
      item.imagenes = (color.imagenes || []).map(function (image) {
        return { src: image.src, alt: image.alt || name + " color " + label.toLowerCase(), ancho: image.ancho, alto: image.alto, grande: image.grande || image.src };
      });
      return item;
    });
    if (colors.length) { product.colores = colors; } else { delete product.colores; }
    return product;
  }

  function filterProducts(products, filters) {
    var query = String(filters.query || "").trim().toLowerCase();
    return products.filter(function (product) {
      if (filters.category && product.categoria !== filters.category) { return false; }
      var hidden = product.visible === false;
      if (filters.state === "visible" && hidden) { return false; }
      if (filters.state === "oculto" && !hidden) { return false; }
      return !query || String(product.nombre).toLowerCase().indexOf(query) !== -1;
    });
  }

  /* Las imágenes de un producto en orden: galería (imagenes) o la imagen principal */
  function galleryOf(product) {
    if (product.imagenes && product.imagenes.length) { return product.imagenes.slice(); }
    return product.imagen ? [product.imagen] : [];
  }

  window.MakkaProductosLogic = { validate: validate, buildProduct: buildProduct, filterProducts: filterProducts, imageError: imageError, galleryOf: galleryOf, MSG: MSG, MAX_IMAGES: MAX_IMAGES };

  /* ---------- Pantalla ---------- */

  var admin = window.MakkaAdmin;
  if (!admin || !admin.allowed) {
    return;
  }

  var Store = window.MakkaProductos;
  var Utils = window.MakkaAdminUI;
  var categories = Store.categories();
  var filaments = window.MAKKA_FILAMENTOS || [];

  function byId(id) { return document.getElementById(id); }

  var state = { query: "", category: "", state: "", shown: PAGE_SIZE, editing: null, images: [], colors: [] };

  function categoryName(slug) {
    var found = categories.filter(function (category) { return category.slug === slug; })[0];
    return found ? found.nombre : slug;
  }

  /* ----- Imágenes: se reducen en el navegador (el backend las convertirá a WebP) ----- */
  function readImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("lectura")); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error("formato")); };
        img.onload = function () {
          var scale = Math.min(1, 800 / Math.max(img.width, img.height));
          var canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          var src = canvas.toDataURL("image/webp", 0.82);
          if (src.indexOf("data:image/webp") !== 0) { src = canvas.toDataURL("image/jpeg", 0.85); }
          resolve({ src: src, ancho: canvas.width, alto: canvas.height });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* Lee varios archivos: devuelve { images, error } con el primer error encontrado */
  function readImages(files, room) {
    var list = Array.prototype.slice.call(files);
    var error = "";
    var valid = [];
    list.forEach(function (file) {
      var problem = imageError(file);
      if (problem) { error = error || problem; } else { valid.push(file); }
    });
    if (valid.length > room) { error = error || "Máximo " + MAX_IMAGES + " imágenes por producto"; valid = valid.slice(0, room); }
    return Promise.all(valid.map(function (file) {
      return readImage(file).catch(function () { error = error || MSG.format; return null; });
    })).then(function (images) {
      return { images: images.filter(Boolean), error: error };
    });
  }

  /* ----- Tabla ----- */
  function colorsHtml(product) {
    var colors = (product.colores || []).filter(function (color) { return UI.validHex(color.hex); });
    if (!colors.length) { return '<span class="dash-note">-</span>'; }
    var dots = colors.slice(0, 6).map(function (color) {
      return '<li class="swatch" style="--swatch:' + color.hex + '" title="' + esc(color.nombre) + '"><span class="sr-only">' + esc(color.nombre) + "</span></li>";
    }).join("");
    return '<ul class="adm-swatches">' + dots + "</ul>" + (colors.length > 6 ? '<span class="adm-swatches__more">+' + (colors.length - 6) + "</span>" : "");
  }

  function renderTable() {
    var all = Store.list();
    var rows = filterProducts(all, state);
    var visibleRows = rows.slice(0, state.shown);

    byId("prod-vacio").hidden = rows.length > 0;
    byId("prod-tabla").hidden = rows.length === 0;
    byId("prod-vacio-texto").textContent = all.length ? "No encontramos productos con esos filtros." : "Todavía no hay productos. Agrega el primero.";
    byId("prod-contador").textContent = rows.length ? "Mostrando " + visibleRows.length + " de " + rows.length + (rows.length === 1 ? " producto" : " productos") : "";
    byId("prod-mas").hidden = rows.length <= visibleRows.length;
    byId("prod-reset").hidden = !window.localStorage.getItem("makka_productos");

    byId("prod-cuerpo").innerHTML = visibleRows.map(function (product) {
      var image = galleryOf(product)[0];
      var hidden = product.visible === false;
      var id = esc(product.id);
      return '<tr data-id="' + id + '">' +
        '<td data-label="Imagen">' + (image ? '<img class="adm-thumb" src="' + esc(image.src) + '" alt="" width="56" height="56" loading="lazy">' : "") + "</td>" +
        '<td data-label="Nombre"><span class="dash-table__folio">' + esc(product.nombre) + "</span></td>" +
        '<td data-label="Categoría">' + esc(categoryName(product.categoria)) + "</td>" +
        '<td data-label="Precio"><span class="dash-table__money">' + Utils.money(product.precio) + "</span>" + (product.precioUnidad ? ' <small class="dash-note">' + esc(product.precioUnidad) + "</small>" : "") + "</td>" +
        '<td data-label="Colores">' + colorsHtml(product) + "</td>" +
        '<td data-label="Material">' + esc((product.materiales || []).join(" / ")) + "</td>" +
        '<td data-label="Estado"><span class="chip status ' + (hidden ? "status--cancelado" : "status--pago-validado") + '">' + (hidden ? "Oculto" : "Visible") + "</span>" +
        (product.disponible === false ? ' <span class="chip status status--pago-pendiente">Agotado</span>' : "") + "</td>" +
        '<td data-label="Acciones"><div class="adm-actions">' +
        '<button class="adm-act" type="button" data-act="editar" data-id="' + id + '">' + Utils.icon("edit", 18) + "Editar</button>" +
        '<button class="adm-act" type="button" data-act="visibilidad" data-id="' + id + '">' + Utils.icon(hidden ? "eye" : "eye-off", 18) + (hidden ? "Mostrar" : "Ocultar") + "</button>" +
        '<button class="adm-act adm-act--danger" type="button" data-act="eliminar" data-id="' + id + '">' + Utils.icon("trash", 18) + "Eliminar</button>" +
        "</div></td></tr>";
    }).join("");
  }

  /* ----- Formulario ----- */
  var dialog = byId("prod-dialogo");
  var fieldIds = ["nombre", "categoria", "precio", "descripcion", "material", "imagenes", "colores"];

  function setFieldError(field, message) {
    var box = byId("err-pf-" + field);
    if (box) { box.hidden = !message; box.textContent = message || ""; }
    var input = byId("pf-" + field);
    if (input) { if (message) { input.setAttribute("aria-invalid", "true"); } else { input.removeAttribute("aria-invalid"); } }
  }

  function clearErrors() {
    fieldIds.forEach(function (field) { setFieldError(field, ""); });
    byId("pf-error").hidden = true;
  }

  function renderImages() {
    byId("pf-imagenes").innerHTML = state.images.map(function (image, index) {
      return '<li class="adm-image"><img src="' + esc(image.src) + '" alt="Imagen ' + (index + 1) + '" width="72" height="72">' +
        '<span class="adm-image__tag">' + (index === 0 ? "Principal" : "Imagen " + (index + 1)) + "</span>" +
        '<span class="adm-image__btns">' +
        '<button type="button" class="adm-mini" data-img="up" data-index="' + index + '" aria-label="Mover imagen ' + (index + 1) + ' antes"' + (index === 0 ? " disabled" : "") + ">" + Utils.icon("arrow-up", 16) + "</button>" +
        '<button type="button" class="adm-mini" data-img="down" data-index="' + index + '" aria-label="Mover imagen ' + (index + 1) + ' después"' + (index === state.images.length - 1 ? " disabled" : "") + ">" + Utils.icon("arrow-down", 16) + "</button>" +
        '<button type="button" class="adm-mini" data-img="del" data-index="' + index + '" aria-label="Quitar imagen ' + (index + 1) + '">' + Utils.icon("close", 16) + "</button>" +
        "</span></li>";
    }).join("");
  }

  function renderColors() {
    byId("pf-colores").innerHTML = state.colors.map(function (color, index) {
      var image = (color.imagenes || [])[0];
      return '<li class="adm-color"><span class="swatch" style="--swatch:' + esc(color.hex) + '"></span>' +
        '<div class="adm-color__main"><label class="sr-only" for="pf-cn-' + index + '">Nombre del color</label>' +
        '<input class="field__input adm-color__name" id="pf-cn-' + index + '" type="text" maxlength="40" value="' + esc(color.nombre) + '" data-color-name="' + index + '">' +
        (color.filamento ? '<small class="dash-note">' + esc(color.filamento) + "</small>" : "") + "</div>" +
        (image ? '<img class="adm-thumb adm-thumb--sm" src="' + esc(image.src) + '" alt="" width="40" height="40">' : "") +
        '<label class="btn btn--white btn--sm adm-color__img" for="pf-ci-' + index + '">' + (image ? "Cambiar imagen" : "Agregar imagen") + "</label>" +
        '<input class="sr-only" id="pf-ci-' + index + '" type="file" accept="image/jpeg,image/png,image/webp" data-color-img="' + index + '">' +
        '<button type="button" class="adm-mini" data-color-del="' + index + '" aria-label="Quitar color ' + esc(color.nombre) + '">' + Utils.icon("close", 16) + "</button></li>";
    }).join("");
  }

  function fillColorSelect() {
    byId("pf-color-nuevo").innerHTML = filaments.map(function (item, index) {
      return '<option value="' + index + '">' + esc(item.marca + " " + item.material + " " + item.nombre) + "</option>";
    }).join("");
  }

  function openForm(product) {
    clearErrors();
    state.editing = product ? product.id : null;
    byId("prod-form-titulo").textContent = product ? "Editar producto" : "Agregar producto";
    byId("pf-nombre").value = product ? product.nombre : "";
    byId("pf-categoria").value = product ? product.categoria : categories[0].slug;
    byId("pf-precio").value = product ? product.precio : "";
    byId("pf-descripcion").value = product ? product.descripcion || "" : "";
    byId("pf-unidad").value = product ? product.precioUnidad || "" : "";
    byId("pf-medidas").value = product ? product.medidas || "" : "";
    Array.prototype.forEach.call(document.getElementsByName("material"), function (input) {
      input.checked = product ? (product.materiales || []).indexOf(input.value) !== -1 : input.value === "PLA";
    });
    byId("pf-disponible").checked = product ? product.disponible !== false : true;
    byId("pf-visible").checked = product ? product.visible !== false : true;
    byId("pf-destacado").checked = product ? product.destacado === true : false;
    state.images = product ? galleryOf(product) : [];
    state.colors = product ? JSON.parse(JSON.stringify(product.colores || [])) : [];
    byId("pf-archivos").value = "";
    renderImages();
    renderColors();
    Utils.openDialog(dialog);
    byId("pf-nombre").focus();
  }

  function readValues() {
    return {
      nombre: byId("pf-nombre").value,
      categoria: byId("pf-categoria").value,
      precio: byId("pf-precio").value,
      descripcion: byId("pf-descripcion").value,
      precioUnidad: byId("pf-unidad").value,
      medidas: byId("pf-medidas").value,
      materiales: Array.prototype.filter.call(document.getElementsByName("material"), function (input) { return input.checked; }).map(function (input) { return input.value; }),
      imagenes: state.images,
      colores: state.colors,
      disponible: byId("pf-disponible").checked,
      visible: byId("pf-visible").checked,
      destacado: byId("pf-destacado").checked
    };
  }

  /* ----- Eventos ----- */
  function fillFilters() {
    var options = categories.map(function (category) { return '<option value="' + esc(category.slug) + '">' + esc(category.nombre) + "</option>"; }).join("");
    byId("prod-categoria").insertAdjacentHTML("beforeend", options);
    byId("pf-categoria").innerHTML = options;
    fillColorSelect();
  }

  function refilter() { state.shown = PAGE_SIZE; renderTable(); }

  byId("prod-buscar").addEventListener("input", function (event) { state.query = event.target.value; refilter(); });
  byId("prod-categoria").addEventListener("change", function (event) { state.category = event.target.value; refilter(); });
  byId("prod-estado").addEventListener("change", function (event) { state.state = event.target.value; refilter(); });
  byId("prod-mas").addEventListener("click", function () { state.shown += PAGE_SIZE; renderTable(); });
  byId("prod-nuevo").addEventListener("click", function () { openForm(null); });
  byId("pf-cancelar").addEventListener("click", function () { Utils.closeDialog(dialog); });

  byId("prod-reset").addEventListener("click", function () {
    Utils.confirm({ titulo: "¿Restaurar el catálogo de ejemplo?", texto: "Se borran los cambios hechos en Productos y el catálogo vuelve a como venía.", boton: "Restaurar", peligro: true }).then(function (yes) {
      if (!yes) { return; }
      window.localStorage.removeItem("makka_productos");
      renderTable();
      Utils.toast("Catálogo restaurado");
    });
  });

  byId("prod-cuerpo").addEventListener("click", function (event) {
    var button = event.target.closest("[data-act]");
    if (!button) { return; }
    var id = button.getAttribute("data-id");
    var product = Store.get(id);
    if (!product) { return; }
    var act = button.getAttribute("data-act");

    if (act === "editar") {
      openForm(product);
    } else if (act === "visibilidad") {
      if (product.visible === false) {
        Store.setVisible(id, true);
        renderTable();
        Utils.toast("Producto visible. Ya se ve en el catálogo.");
      } else {
        Utils.confirm({ titulo: "¿Ocultar " + product.nombre + "?", texto: "Este producto dejará de verse en el catálogo. ¿Continuar?", boton: "Ocultar" }).then(function (yes) {
          if (!yes) { return; }
          Store.setVisible(id, false);
          renderTable();
          Utils.toast("Producto oculto");
        });
      }
    } else if (act === "eliminar") {
      Utils.confirm({ titulo: "¿Eliminar " + product.nombre + "?", texto: "Se quita del catálogo y de esta lista. No se puede deshacer. Si solo quieres que no se vea, mejor ocúltalo.", boton: "Sí, eliminar", peligro: true }).then(function (yes) {
        if (!yes) { return; }
        Store.remove(id);
        renderTable();
        Utils.toast("Producto eliminado");
      });
    }
  });

  /* Imágenes del producto */
  byId("pf-archivos").addEventListener("change", function (event) {
    var input = event.target;
    setFieldError("imagenes", "");
    readImages(input.files, MAX_IMAGES - state.images.length).then(function (result) {
      state.images = state.images.concat(result.images);
      input.value = "";
      renderImages();
      if (result.error) { setFieldError("imagenes", result.error); }
    });
  });

  byId("pf-imagenes").addEventListener("click", function (event) {
    var button = event.target.closest("[data-img]");
    if (!button) { return; }
    var index = Number(button.getAttribute("data-index"));
    var kind = button.getAttribute("data-img");
    if (kind === "del") { state.images.splice(index, 1); }
    if (kind === "up" && index > 0) { state.images.splice(index - 1, 0, state.images.splice(index, 1)[0]); }
    if (kind === "down" && index < state.images.length - 1) { state.images.splice(index + 1, 0, state.images.splice(index, 1)[0]); }
    renderImages();
  });

  /* Colores */
  byId("pf-color-agregar").addEventListener("click", function () {
    var item = filaments[Number(byId("pf-color-nuevo").value)];
    if (!item) { return; }
    var already = state.colors.some(function (color) { return color.hex.toLowerCase() === item.hex.toLowerCase() && color.nombre === item.nombre; });
    setFieldError("colores", "");
    if (already) { setFieldError("colores", "Ese color ya está en la lista"); return; }
    state.colors.push({ nombre: item.nombre, hex: item.hex, filamento: item.marca + " " + item.material + " " + item.nombre, imagenes: [] });
    renderColors();
  });

  byId("pf-colores").addEventListener("input", function (event) {
    var index = event.target.getAttribute("data-color-name");
    if (index !== null) { state.colors[Number(index)].nombre = event.target.value; }
  });

  byId("pf-colores").addEventListener("click", function (event) {
    var button = event.target.closest("[data-color-del]");
    if (button) { state.colors.splice(Number(button.getAttribute("data-color-del")), 1); renderColors(); }
  });

  byId("pf-colores").addEventListener("change", function (event) {
    var index = event.target.getAttribute("data-color-img");
    if (index === null) { return; }
    setFieldError("colores", "");
    readImages(event.target.files, 1).then(function (result) {
      if (result.images.length) { state.colors[Number(index)].imagenes = result.images; }
      renderColors();
      if (result.error) { setFieldError("colores", result.error); }
    });
  });

  byId("prod-form").addEventListener("submit", function (event) {
    event.preventDefault();
    clearErrors();
    var values = readValues();
    var result = validate(values, categories);
    if (!result.ok) {
      Object.keys(result.errors).forEach(function (field) { setFieldError(field, result.errors[field]); });
      var first = fieldIds.filter(function (field) { return result.errors[field]; })[0];
      var target = byId("pf-" + first);
      if (target) { target.focus(); }
      var box = byId("pf-error");
      box.textContent = MSG.required;
      box.hidden = false;
      return;
    }

    var creating = state.editing === null;
    var saved = Store.save(buildProduct(values, creating ? null : Store.get(state.editing)));
    if (!saved.ok) {
      var failure = byId("pf-error");
      failure.textContent = MSG.storage;
      failure.hidden = false;
      return;
    }
    Utils.closeDialog(dialog);
    renderTable();
    Utils.toast(!values.visible ? "Producto guardado. Está oculto en el catálogo." : creating ? "Producto agregado. Ya se ve en el catálogo." : "Producto actualizado. Ya se ve en el catálogo.");
  });

  fillFilters();
  renderTable();
  var query = new URLSearchParams(window.location.search);
  if (query.get("nuevo") === "1") { openForm(null); }
  if (query.get("editar")) {
    var toEdit = Store.get(query.get("editar"));
    if (toEdit) { openForm(toEdit); }
  }
})();
