(function () {
  "use strict";

  var Auth = window.MakkaAuth;

  /* values: { correo } */
  function validate(values) {
    var errors = {};
    if (!Auth.isEmail(values.correo)) { errors.correo = "Ingresa un correo válido"; }
    return { ok: Object.keys(errors).length === 0, errors: errors };
  }

  window.MakkaRecuperarLogic = { validate: validate };

  var form = document.getElementById("rec-form");
  if (!form) {
    return;
  }

  var input = document.getElementById("rec-correo");
  var error = document.getElementById("err-correo");
  var done = document.getElementById("rec-exito");
  var already = document.getElementById("rec-ya");
  var intro = document.getElementById("rec-texto");
  var demo = document.getElementById("rec-demo");

  /* SOLO PRUEBA: con backend real, pon false (o quita el bloque "rec-demo" del HTML). */
  var SHOW_DEMO_LINK = true;

  /* WhatsApp de la tienda, con lada de país y sin espacios. */
  var WHATSAPP = "524444482898";

  function setError(message) {
    error.hidden = !message;
    error.textContent = message || "";
    if (message) { input.setAttribute("aria-invalid", "true"); } else { input.removeAttribute("aria-invalid"); }
  }

  input.addEventListener("input", function () { setError(""); });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var result = validate({ correo: input.value });
    setError(result.errors.correo);
    if (!result.ok) {
      input.focus();
      return;
    }

    /* Abre WhatsApp con el mensaje listo. La tienda verifica quién es y manda el enlace. */
    var message = "Hola, olvidé mi contraseña de Makka Studio. El correo de mi cuenta es: " + input.value.trim();
    window.open("https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(message), "_blank", "noopener");

    /* SOLO PRUEBA: simula el enlace que la tienda mandaría. */
    var response = Auth.createResetLink(input.value);
    demo.hidden = !(SHOW_DEMO_LINK && response.ok);
    if (!demo.hidden) {
      document.getElementById("rec-demo-enlace").href = "restablecer-contrasena.html?token=" + encodeURIComponent(response.token);
    }
    form.hidden = true;
    intro.hidden = true;
    done.hidden = false;
    document.getElementById("rec-exito-texto").focus();
  });

  document.getElementById("rec-otro").addEventListener("click", function () {
    done.hidden = true;
    demo.hidden = true;
    intro.hidden = false;
    form.hidden = false;
    input.value = "";
    input.focus();
  });

  if (window.MakkaSession && window.MakkaSession.isLoggedIn()) {
    already.hidden = false;
    intro.hidden = true;
  } else {
    form.hidden = false;
  }
})();
