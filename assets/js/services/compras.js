/*
 * Compras provisionales guardadas en el navegador (localStorage), mientras no exista el backend (RF-04).
 * Cada compra: { folio, fecha, correo, lineas, total, estatus, comprobante }.
 *   estatus: "pago-pendiente" (el administrador la cambiará al validar el pago).
 *   comprobante: solo guarda nombre y tamaño; el archivo real lo recibirá el servidor.
 * Cuando exista el backend, reemplaza create() y list() manteniendo lo que devuelven:
 *   create(compra) -> { ok: true, folio } o { ok: false }
 *   list() -> arreglo de compras
 *   cancel(folio, motivo) -> { ok: true } o { ok: false } (solo si aún no está en producción ni enviada)
 * Fecha estimada de entrega: el administrador agrega "entregaEstimada" ("AAAA-MM-DD") al validar el pago.
 * Estatus posibles: pago-pendiente, pago-validado, en-produccion, enviado, entregado, cancelado.
 * Funciones del administrador (el backend debe exigir rol administrador y aplicar las mismas reglas):
 *   validatePayment(folio, entregaEstimada?) -> { ok: true } o { ok: false, error: "estatus" | "sin-comprobante" | "fecha" }
 *   rejectPayment(folio, observacion?) -> { ok: true } o { ok: false, error: "estatus" } (sigue en pago-pendiente y el cliente ve la observación)
 *   setStatus(folio, nuevo) -> { ok: true } o { ok: false, error: "no-permitido" } (solo los pasos de NEXT; no se regresa)
 *   setDelivery(folio, "AAAA-MM-DD") -> { ok: true } o { ok: false, error: "fecha" | "estatus" }
 *   cancelByAdmin(folio, motivo?) -> { ok: true } o { ok: false, error: "no-permitido" } (solo los de ADMIN_CANCELABLES)
 *   archive(folio) -> { ok: true } o { ok: false, error: "no-permitido" } (solo entregado o cancelado; pasa al historial del panel)
 */
window.MakkaCompras = (function () {
  "use strict";

  var KEY = "makka_compras";

  function list() {
    try {
      var data = JSON.parse(window.localStorage.getItem(KEY) || "[]");
      return Array.isArray(data) ? data : [];
    } catch (error) {
      return [];
    }
  }

  /* Folio que tendrá la próxima compra: MK-0001, MK-0002, ... */
  function nextFolio() {
    var number = String(list().length + 1);
    while (number.length < 4) { number = "0" + number; }
    return "MK-" + number;
  }

  function create(purchase) {
    try {
      var all = list();
      var folio = nextFolio();
      all.push({
        folio: folio,
        fecha: new Date().toISOString(),
        correo: purchase.correo,
        lineas: purchase.lineas,
        total: purchase.total,
        estatus: "pago-pendiente",
        comprobante: purchase.comprobante
      });
      window.localStorage.setItem(KEY, JSON.stringify(all));
      return { ok: true, folio: folio };
    } catch (error) {
      return { ok: false };
    }
  }

  /* Estatus en los que todavía se puede cancelar */
  var CANCELABLES = ["pago-pendiente", "pago-validado"];

  function cancel(folio, reason) {
    try {
      var all = list();
      var found = all.filter(function (purchase) { return purchase.folio === folio; })[0];
      if (!found || CANCELABLES.indexOf(found.estatus) === -1) { return { ok: false }; }
      found.estatus = "cancelado";
      found.motivo = String(reason || "").trim();
      found.cancelada = new Date().toISOString();
      window.localStorage.setItem(KEY, JSON.stringify(all));
      return { ok: true };
    } catch (error) {
      return { ok: false };
    }
  }

  /* ---------- Administrador ---------- */

  /* Pasos permitidos (no se puede regresar, por ejemplo de entregado a en producción). El pago se valida con validatePayment. */
  var NEXT = { "pago-validado": ["en-produccion"], "en-produccion": ["enviado"], "enviado": ["entregado"] };
  var ADMIN_CANCELABLES = ["pago-pendiente", "pago-validado", "en-produccion"];

  function isDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) && !isNaN(new Date(value + "T00:00:00").getTime());
  }

  /* Busca la compra, aplica "change" y guarda. change recibe la compra y devuelve { ok: false, error } para rechazar el cambio. */
  function update(folio, change) {
    try {
      var all = list();
      var found = all.filter(function (purchase) { return purchase.folio === folio; })[0];
      if (!found) { return { ok: false, error: "no-existe" }; }
      var result = change(found);
      if (result && result.ok === false) { return result; }
      window.localStorage.setItem(KEY, JSON.stringify(all));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: "guardar" };
    }
  }

  function validatePayment(folio, delivery) {
    return update(folio, function (purchase) {
      if (purchase.estatus !== "pago-pendiente") { return { ok: false, error: "estatus" }; }
      if (!purchase.comprobante) { return { ok: false, error: "sin-comprobante" }; }
      if (delivery && !isDate(delivery)) { return { ok: false, error: "fecha" }; }
      purchase.estatus = "pago-validado";
      purchase.pagoValidado = new Date().toISOString();
      if (delivery) { purchase.entregaEstimada = delivery; }
      delete purchase.pagoRechazado;
      delete purchase.observacionPago;
    });
  }

  function rejectPayment(folio, note) {
    return update(folio, function (purchase) {
      if (purchase.estatus !== "pago-pendiente") { return { ok: false, error: "estatus" }; }
      purchase.pagoRechazado = new Date().toISOString();
      purchase.observacionPago = String(note || "").trim();
    });
  }

  function setStatus(folio, next) {
    return update(folio, function (purchase) {
      if ((NEXT[purchase.estatus] || []).indexOf(next) === -1) { return { ok: false, error: "no-permitido" }; }
      purchase.estatus = next;
    });
  }

  function setDelivery(folio, delivery) {
    return update(folio, function (purchase) {
      if (["pago-validado", "en-produccion", "enviado"].indexOf(purchase.estatus) === -1) { return { ok: false, error: "estatus" }; }
      if (!isDate(delivery)) { return { ok: false, error: "fecha" }; }
      purchase.entregaEstimada = delivery;
    });
  }

  function cancelByAdmin(folio, reason) {
    return update(folio, function (purchase) {
      if (ADMIN_CANCELABLES.indexOf(purchase.estatus) === -1) { return { ok: false, error: "no-permitido" }; }
      purchase.estatus = "cancelado";
      purchase.motivo = String(reason || "").trim();
      purchase.cancelada = new Date().toISOString();
    });
  }

  function archive(folio) {
    return update(folio, function (purchase) {
      if (purchase.estatus !== "entregado" && purchase.estatus !== "cancelado") { return { ok: false, error: "no-permitido" }; }
      purchase.archivada = true;
    });
  }

  return {
    list: list, nextFolio: nextFolio, create: create, cancel: cancel, CANCELABLES: CANCELABLES,
    NEXT: NEXT, ADMIN_CANCELABLES: ADMIN_CANCELABLES,
    validatePayment: validatePayment, rejectPayment: rejectPayment, setStatus: setStatus,
    setDelivery: setDelivery, cancelByAdmin: cancelByAdmin, archive: archive
  };
})();
