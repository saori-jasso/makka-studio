/*
 * Utilidades compartidas por las pantallas del panel (Productos, Personalizados, Usuarios y Reporte).
 * window.MakkaAdminUI:
 *   formatDate(valor) -> "12 de noviembre de 2026" ("" si no es fecha)       fileSize(bytes) -> "2.3 MB"
 *   isoDate(Date) -> "AAAA-MM-DD"                                             money(valor) -> "$1,250.00"
 *   icon(nombre, tamaño) -> <img> de assets/img/icons                         toast(mensaje)
 *   whatsapp(telefono, texto) -> enlace de WhatsApp o "" si el teléfono no tiene 10 dígitos
 *   confirm({ titulo, texto, boton, peligro }) -> Promise<true|false> con el diálogo #adm-confirm de la página
 *   openDialog(dialog) / closeDialog(dialog)
 */
window.MakkaAdminUI = (function () {
  "use strict";

  var MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  function formatDate(value) {
    var only = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
    var date = only ? new Date(Number(only[1]), Number(only[2]) - 1, Number(only[3])) : new Date(value);
    if (!value || isNaN(date.getTime())) { return ""; }
    return date.getDate() + " de " + MONTHS[date.getMonth()] + " de " + date.getFullYear();
  }

  function fileSize(bytes) {
    var size = Number(bytes) || 0;
    if (size >= 1048576) { return (size / 1048576).toFixed(1) + " MB"; }
    return Math.max(1, Math.round(size / 1024)) + " KB";
  }

  function isoDate(date) {
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  }

  function money(value) {
    return window.MakkaUI.formatPrice(value, 2);
  }

  function icon(file, size) {
    var px = size || 20;
    return '<img src="assets/img/icons/' + file + '.svg" alt="" width="' + px + '" height="' + px + '">';
  }

  function toast(message) {
    if (window.MakkaToast && window.MakkaToast.show) { window.MakkaToast.show({ mensaje: message }); }
  }

  function whatsapp(phone, text) {
    var digits = String(phone || "").replace(/\D/g, "");
    if (digits.length !== 10) { return ""; }
    return "https://wa.me/52" + digits + "?text=" + encodeURIComponent(text);
  }

  function openDialog(dialog) {
    if (dialog.showModal) { dialog.showModal(); } else { dialog.setAttribute("open", ""); }
  }

  function closeDialog(dialog) {
    if (dialog.close) { dialog.close(); } else { dialog.removeAttribute("open"); }
  }

  /* Diálogo de confirmación de la página (#adm-confirm). Resuelve true solo si se pulsa el botón principal. */
  function confirmDialog(options) {
    var dialog = document.getElementById("adm-confirm");
    var ok = document.getElementById("adm-confirm-ok");
    var cancel = document.getElementById("adm-confirm-cancel");
    document.getElementById("adm-confirm-title").textContent = options.titulo;
    document.getElementById("adm-confirm-text").textContent = options.texto || "";
    ok.textContent = options.boton || "Continuar";
    ok.className = "btn " + (options.peligro ? "btn--danger" : "btn--honey");

    return new Promise(function (resolve) {
      var answer = false;
      function finish(value) {
        answer = value;
        closeDialog(dialog);
      }
      function onOk() { finish(true); }
      function onCancel() { finish(false); }
      function onClose() {
        ok.removeEventListener("click", onOk);
        cancel.removeEventListener("click", onCancel);
        dialog.removeEventListener("close", onClose);
        resolve(answer);
      }
      ok.addEventListener("click", onOk);
      cancel.addEventListener("click", onCancel);
      dialog.addEventListener("close", onClose);
      openDialog(dialog);
    });
  }

  return { formatDate: formatDate, fileSize: fileSize, isoDate: isoDate, money: money, icon: icon, toast: toast, whatsapp: whatsapp, openDialog: openDialog, closeDialog: closeDialog, confirm: confirmDialog };
})();
