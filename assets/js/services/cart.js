/*
 * Carrito provisional guardado en localStorage del navegador.
 * Cuando exista el backend (RF-02), se reemplaza por las llamadas al servidor
 * manteniendo la misma interfaz: add(), items(), count(), setQuantity(), remove(), clear().
 * Cada elemento: { id, color, material, cantidad }.
 */
window.MakkaCart = (function () {
  "use strict";

  var KEY = "makka_carrito";
  var MAX_QTY = 99;
  var memory = [];

  function read() {
    try {
      var list = JSON.parse(window.localStorage.getItem(KEY) || "[]");
      return Array.isArray(list) ? list : [];
    } catch (error) {
      return memory;
    }
  }

  function write(list) {
    memory = list;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(list));
    } catch (error) {
      /* Sin almacenamiento disponible: el carrito vive solo mientras la página esté abierta. */
    }
  }

  function count() {
    return read().reduce(function (total, item) { return total + (Number(item.cantidad) || 0); }, 0);
  }

  function updateBadge() {
    var total = count();
    document.querySelectorAll(".cart-btn").forEach(function (button) {
      var badge = button.querySelector(".cart-btn__count");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "cart-btn__count";
        button.appendChild(badge);
      }
      badge.hidden = total === 0;
      badge.textContent = total > 99 ? "99+" : String(total);
      button.setAttribute("aria-label", total ? "Ver mi carrito (" + total + (total === 1 ? " producto)" : " productos)") : "Ver mi carrito");
    });
  }

  function add(item) {
    var list = read();
    if (window.MakkaSession && window.MakkaSession.isAdmin()) { return list; }
    var found = list.filter(function (entry) {
      return String(entry.id) === String(item.id) && entry.color === item.color && entry.material === item.material;
    })[0];

    if (found) {
      found.cantidad = Math.min(MAX_QTY, found.cantidad + item.cantidad);
    } else {
      list.push({ id: item.id, color: item.color, material: item.material, cantidad: Math.min(MAX_QTY, item.cantidad) });
    }

    write(list);
    updateBadge();
    return list;
  }

  function sameLine(entry, item) {
    return String(entry.id) === String(item.id) && (entry.color || "") === (item.color || "") && (entry.material || "") === (item.material || "");
  }

  function setQuantity(item, quantity) {
    var list = read();
    list.forEach(function (entry) {
      if (sameLine(entry, item)) { entry.cantidad = Math.max(1, Math.min(MAX_QTY, quantity)); }
    });
    write(list);
    updateBadge();
    return list;
  }

  function remove(item) {
    var list = read().filter(function (entry) { return !sameLine(entry, item); });
    write(list);
    updateBadge();
    return list;
  }

  function clear() {
    write([]);
    updateBadge();
  }

  updateBadge();

  return { add: add, items: read, count: count, update: updateBadge, setQuantity: setQuantity, remove: remove, clear: clear, MAX_QTY: MAX_QTY };
})();
