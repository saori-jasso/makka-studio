(function () {
  "use strict";

  var Auth = window.MakkaAuth;

  var MESSAGES = {
    correo: "Ingresa un correo válido",
    clave: "Ingresa tu contraseña",
    credenciales: "Correo o contraseña incorrectos",
    bloqueado: "Demasiados intentos fallidos. Intenta de nuevo en unos minutos"
  };

  function validate(values) {
    var errors = {};
    if (!Auth.isEmail(values.correo)) { errors.correo = MESSAGES.correo; }
    if (!values.clave) { errors.clave = MESSAGES.clave; }
    return { ok: Object.keys(errors).length === 0, errors: errors };
  }

  window.MakkaLoginLogic = { validate: validate, MESSAGES: MESSAGES };

  var form = document.getElementById("login-form");
  if (!form) {
    return;
  }

  var emailInput = document.getElementById("login-correo");
  var passwordInput = document.getElementById("login-clave");
  var eyeButton = document.getElementById("login-ojo");
  var alertBox = document.getElementById("login-error");
  var notice = document.getElementById("login-aviso");
  var already = document.getElementById("login-ya");
  var params = new URLSearchParams(window.location.search);
  var next = Auth.safeNext(params.get("siguiente"), "");

  /* Conserva el destino al ir a Crear cuenta */
  if (next) {
    document.getElementById("login-registro").href = "registro.html?siguiente=" + encodeURIComponent(next);
  }

  function setError(key, message) {
    var box = document.getElementById("err-" + key);
    var input = key === "correo" ? emailInput : passwordInput;
    box.hidden = !message;
    box.textContent = message || "";
    if (message) { input.setAttribute("aria-invalid", "true"); } else { input.removeAttribute("aria-invalid"); }
  }

  function showAlert(message) {
    alertBox.hidden = !message;
    alertBox.textContent = message || "";
    if (message) { alertBox.focus(); }
  }

  function toggleEye() {
    var show = passwordInput.type === "password";
    passwordInput.type = show ? "text" : "password";
    eyeButton.setAttribute("aria-pressed", String(show));
    eyeButton.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
    eyeButton.querySelector("img").src = show ? "assets/img/icons/eye-off.svg" : "assets/img/icons/eye.svg";
    passwordInput.focus();
  }

  function destination(user) {
    if (user.rol === "administrador") { return "dashboard.html"; }
    return next || "index.html";
  }

  emailInput.addEventListener("input", function () { setError("correo", ""); showAlert(""); });
  passwordInput.addEventListener("input", function () { setError("clave", ""); showAlert(""); });
  eyeButton.addEventListener("click", toggleEye);

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    showAlert("");

    var result = validate({ correo: emailInput.value, clave: passwordInput.value });
    setError("correo", result.errors.correo);
    setError("clave", result.errors.clave);
    if (!result.ok) {
      (result.errors.correo ? emailInput : passwordInput).focus();
      return;
    }

    var response = Auth.login(emailInput.value, passwordInput.value);

    if (!response.ok) {
      showAlert(MESSAGES[response.error] || MESSAGES.credenciales);
      passwordInput.value = "";
      return;
    }

    window.MakkaSession.login(response.usuario);
    window.location.href = destination(response.usuario);
  });

  function start() {
    if (params.get("aviso") === "expiro") { notice.hidden = false; }

    if (window.MakkaSession.isLoggedIn()) {
      document.getElementById("login-ir").href = next || "index.html";
      already.hidden = false;
      return;
    }
    form.hidden = false;
  }

  document.getElementById("login-salir").addEventListener("click", function () {
    window.MakkaSession.logout();
    already.hidden = true;
    form.hidden = false;
    emailInput.focus();
  });

  start();
})();
