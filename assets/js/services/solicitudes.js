/*
 * Solicitudes de pedidos personalizados, guardadas en localStorage mientras no exista el backend.
 * Interfaz que debe conservar el backend: add(solicitud) -> solicitud guardada, list().
 * Los archivos (.STL/.OBJ e imágenes) NO se guardan aquí: solo su nombre y tamaño.
 * Estatus posibles (brief): "En revisión", "Cotizado", "Aceptado", "Rechazado".
 * Cada solicitud lleva el correo de quien la envió; cuando el administrador cotiza, se agrega "cotizacion" (monto en MXN).
 * Funciones del administrador (el backend debe exigir rol administrador y aplicar las mismas reglas):
 *   approveFile(id) / rejectFile(id, nota) -> { ok: true } o { ok: false, error: "sin-archivo" | "estatus" | "no-existe" }
 *     (marca archivoEstado "aprobado" o "rechazado"; si se rechaza, el cliente debe mandar otro formato por WhatsApp)
 *   quote(id, precio, notas) -> { ok: true } o { ok: false, error: "precio" | "archivo-rechazado" | "estatus" | "no-existe" }
 *     (pasa a "Cotizado"; se puede volver a cotizar mientras siga "Cotizado")
 *   accept(id) -> { ok: true } o { ok: false, error: "estatus" }   (Cotizado -> Aceptado, cuando el cliente confirma)
 *   reject(id, motivo) -> { ok: true } o { ok: false, error: "estatus" }   (En revisión o Cotizado -> Rechazado)
 */
window.MakkaSolicitudes = (function () {
  "use strict";

  var KEY = "makka_solicitudes";
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
      /* Sin almacenamiento disponible: la solicitud solo vive mientras la página esté abierta. */
    }
  }

  function add(request) {
    var list = read();
    var number = String(list.length + 1);
    while (number.length < 4) { number = "0" + number; }
    var saved = Object.assign({ id: "PC-" + number, creada: new Date().toISOString(), estatus: "En revisión" }, request);
    list.push(saved);
    write(list);
    return saved;
  }

  /* ---------- Administrador ---------- */

  /* Busca la solicitud, aplica "change" y guarda. change devuelve { ok: false, error } para rechazar el cambio. */
  function update(id, change) {
    var all = read();
    var found = all.filter(function (request) { return request.id === id; })[0];
    if (!found) { return { ok: false, error: "no-existe" }; }
    var result = change(found);
    if (result && result.ok === false) { return result; }
    write(all);
    return { ok: true };
  }

  var REVIEWABLE = ["En revisión", "Cotizado"];

  function setFile(id, state, note) {
    return update(id, function (request) {
      if (!request.archivo3d) { return { ok: false, error: "sin-archivo" }; }
      if (request.estatus !== "En revisión") { return { ok: false, error: "estatus" }; }
      request.archivoEstado = state;
      request.archivoNota = state === "rechazado" ? String(note || "").trim() : "";
    });
  }

  function approveFile(id) { return setFile(id, "aprobado"); }
  function rejectFile(id, note) { return setFile(id, "rechazado", note); }

  function quote(id, price, notes) {
    var amount = Number(price);
    return update(id, function (request) {
      if (REVIEWABLE.indexOf(request.estatus) === -1) { return { ok: false, error: "estatus" }; }
      if (!isFinite(amount) || amount <= 0 || amount > 100000) { return { ok: false, error: "precio" }; }
      if (request.archivoEstado === "rechazado") { return { ok: false, error: "archivo-rechazado" }; }
      request.cotizacion = Math.round(amount * 100) / 100;
      request.notasCotizacion = String(notes || "").trim();
      request.cotizada = new Date().toISOString();
      request.estatus = "Cotizado";
    });
  }

  function accept(id) {
    return update(id, function (request) {
      if (request.estatus !== "Cotizado") { return { ok: false, error: "estatus" }; }
      request.estatus = "Aceptado";
      request.aceptada = new Date().toISOString();
    });
  }

  function reject(id, reason) {
    return update(id, function (request) {
      if (REVIEWABLE.indexOf(request.estatus) === -1) { return { ok: false, error: "estatus" }; }
      request.estatus = "Rechazado";
      request.motivoRechazo = String(reason || "").trim();
    });
  }

  return { add: add, list: read, approveFile: approveFile, rejectFile: rejectFile, quote: quote, accept: accept, reject: reject };
})();
