window.MakkaToast = (function () {
  "use strict";

  var timer;

  function show(options) {
    var toast = document.getElementById("toast");

    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toast";
      toast.className = "toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }

    toast.textContent = "";

    var text = document.createElement("span");
    text.className = "toast__text";
    text.textContent = options.mensaje;
    toast.appendChild(text);

    if (options.enlace) {
      var link = document.createElement("a");
      link.className = "toast__link";
      link.href = options.enlace.href;
      link.textContent = options.enlace.texto;
      toast.appendChild(link);
    }

    var close = document.createElement("button");
    close.type = "button";
    close.className = "toast__close";
    close.setAttribute("aria-label", "Cerrar aviso");
    close.textContent = "×";
    close.addEventListener("click", hide);
    toast.appendChild(close);

    toast.classList.add("is-visible");
    clearTimeout(timer);
    timer = setTimeout(hide, 6000);
  }

  function hide() {
    var toast = document.getElementById("toast");
    if (toast) { toast.classList.remove("is-visible"); }
  }

  return { show: show, hide: hide };
})();
