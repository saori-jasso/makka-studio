/*
 * Capa de datos del sitio. Hoy devuelve los datos de ejemplo de assets/js/data/productos.js
 * junto con los cambios que el administrador hace en Productos (guardados en el navegador, ver services/productos.js).
 * Cuando exista el backend, solo hay que cambiar el contenido de getCatalogo()
 * para que devuelva { categorias: [...], productos: [...] } con el mismo formato que MAKKA_DATA
 * (solo los productos visibles; los ocultos no se mandan al catálogo).
 * Las demás páginas no cambian: solo usan MakkaApi.getCatalogo().
 */
window.MakkaApi = (function () {
  "use strict";

  var KEY = "makka_productos";
  var VERSION_KEY = "makka_productos_version";

  /* Lista que dejó el administrador, o null si nunca ha cambiado nada o si es de una versión vieja del catálogo base */
  function stored() {
    try {
      if (window.localStorage.getItem(VERSION_KEY) !== String(window.MAKKA_DATA.version || 1)) { return null; }
      var data = JSON.parse(window.localStorage.getItem(KEY) || "null");
      return Array.isArray(data) ? data : null;
    } catch (error) {
      return null;
    }
  }

  return {
    getCatalogo: function () {
      var base = window.MAKKA_DATA;
      var edited = stored();
      var products = edited ? edited.filter(function (product) { return product.visible !== false; }) : base.productos;
      return Promise.resolve({ categorias: base.categorias, productos: products });
    }
  };
})();
