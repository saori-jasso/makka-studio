/*
 * Productos del administrador, guardados en el navegador (localStorage) mientras no exista el backend.
 * La primera vez que se guarda algo, se copia el catálogo de ejemplo (data/productos.js) y desde entonces esta lista manda.
 * El catálogo de la tienda (services/api.js) muestra solo los productos con visible distinto de false.
 * Campos nuevos que agrega el panel a cada producto: visible (true/false) y disponible (true/false; false = "Agotado").
 * Interfaz que debe conservar el backend (todas exigen rol administrador):
 *   list() -> todos los productos, también los ocultos
 *   get(id) -> producto o null
 *   save(producto) -> { ok: true, producto } o { ok: false, error: "guardar" }   (sin id crea uno nuevo)
 *   setVisible(id, true | false) -> { ok: true } o { ok: false, error: "no-existe" | "guardar" }
 *   remove(id) -> { ok: true } o { ok: false, error: "no-existe" | "guardar" }
 *   categories() -> [{ slug, nombre }]
 * Las imágenes: aquí se reducen en el navegador y se guardan dentro del producto (data URL).
 * El backend debe validarlas (formato y tamaño), convertirlas a WebP, renombrarlas y guardar solo su ruta.
 */
window.MakkaProductos = (function () {
  "use strict";

  var KEY = "makka_productos";
  var VERSION_KEY = "makka_productos_version";

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  /* Si cambió el catálogo base (MAKKA_DATA.version), la copia vieja guardada en el navegador ya no sirve y se descarta. */
  function stored() {
    try {
      if (window.localStorage.getItem(VERSION_KEY) !== String(window.MAKKA_DATA.version || 1)) {
        window.localStorage.removeItem(KEY);
        return null;
      }
      var data = JSON.parse(window.localStorage.getItem(KEY) || "null");
      return Array.isArray(data) ? data : null;
    } catch (error) {
      return null;
    }
  }

  function list() {
    var data = stored();
    return data || clone(window.MAKKA_DATA.productos);
  }

  function write(products) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(products));
      window.localStorage.setItem(VERSION_KEY, String(window.MAKKA_DATA.version || 1));
      return true;
    } catch (error) {
      return false;
    }
  }

  function get(id) {
    return list().filter(function (product) { return String(product.id) === String(id); })[0] || null;
  }

  function nextId(products) {
    return products.reduce(function (max, product) { return Math.max(max, Number(product.id) || 0); }, 0) + 1;
  }

  function save(product) {
    var products = list();
    var saved = clone(product);
    var index = -1;
    products.forEach(function (item, position) { if (saved.id !== undefined && String(item.id) === String(saved.id)) { index = position; } });
    if (index === -1) {
      saved.id = nextId(products);
      products.push(saved);
    } else {
      products[index] = saved;
    }
    return write(products) ? { ok: true, producto: saved } : { ok: false, error: "guardar" };
  }

  function change(id, apply) {
    var products = list();
    var index = -1;
    products.forEach(function (item, position) { if (String(item.id) === String(id)) { index = position; } });
    if (index === -1) { return { ok: false, error: "no-existe" }; }
    products = apply(products, index);
    return write(products) ? { ok: true } : { ok: false, error: "guardar" };
  }

  function setVisible(id, visible) {
    return change(id, function (products, index) { products[index].visible = !!visible; return products; });
  }

  function remove(id) {
    return change(id, function (products, index) { products.splice(index, 1); return products; });
  }

  function categories() {
    return window.MAKKA_DATA.categorias.slice();
  }

  return { list: list, get: get, save: save, setVisible: setVisible, remove: remove, categories: categories };
})();
