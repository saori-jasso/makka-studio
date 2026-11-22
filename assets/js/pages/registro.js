(function () {
  "use strict";

  var Auth = window.MakkaAuth;

  var FIELDS = ["nombre", "apellido", "correo", "telefono", "clave", "clave2"];

  /* values: { nombre, apellido, correo, telefono, clave, clave2 } */
  function validate(values) {
    var errors = {};
    if (!String(values.nombre).trim()) { errors.nombre = "Ingresa tu nombre"; }
    if (!String(values.apellido).trim()) { errors.apellido = "Ingresa tu apellido"; }
    if (!Auth.isEmail(values.correo)) { errors.correo = "Ingresa un correo válido"; }
    if (!Auth.isPhone(values.telefono)) { errors.telefono = "Ingresa un teléfono de 10 dígitos"; }
    if (!Auth.isPassword(values.clave)) { errors.clave = "Mínimo 8 caracteres"; }
    if (!errors.clave && values.clave2 !== values.clave) { errors.clave2 = "Las contraseñas no coinciden"; }
    if (errors.clave && !values.clave2) { errors.clave2 = "Confirma tu contraseña"; }
    return { ok: Object.keys(errors).length === 0, errors: errors, order: FIELDS.filter(function (key) { return errors[key]; }) };
  }

  window.MakkaRegistroLogic = { validate: validate, FIELDS: FIELDS };

  var form = document.getElementById("registro-form");
  if (!form) {
    return;
  }

  var summary = document.getElementById("registro-resumen");
  var successBox = document.getElementById("registro-exito");
  var params = new URLSearchParams(window.location.search);
  var next = Auth.safeNext(params.get("siguiente"), "");
  var inputs = {
    nombre: document.getElementById("rg-nombre"),
    apellido: document.getElementById("rg-apellido"),
    correo: document.getElementById("rg-correo"),
    telefono: document.getElementById("rg-telefono"),
    clave: document.getElementById("rg-clave"),
    clave2: document.getElementById("rg-clave2")
  };

  [["clave", "rg-ojo"], ["clave2", "rg-ojo2"]].forEach(function (pair) {
    var input = inputs[pair[0]];
    var button = document.getElementById(pair[1]);
    var label = pair[0] === "clave" ? "contraseña" : "confirmación de contraseña";
    button.addEventListener("click", function () {
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      button.setAttribute("aria-pressed", String(show));
      button.setAttribute("aria-label", (show ? "Ocultar " : "Mostrar ") + label);
      button.querySelector("img").src = show ? "assets/img/icons/eye-off.svg" : "assets/img/icons/eye.svg";
      input.focus();
    });
  });

  if (next) {
    document.getElementById("registro-login").href = "login.html?siguiente=" + encodeURIComponent(next);
    document.getElementById("registro-ir-login").href = "login.html?siguiente=" + encodeURIComponent(next);
  }

  /* Solo números en el teléfono */
  inputs.telefono.addEventListener("input", function () {
    inputs.telefono.value = inputs.telefono.value.replace(/[^\d\s-]/g, "");
  });

  function setError(key, message) {
    var box = document.getElementById("err-" + key);
    box.hidden = !message;
    box.textContent = message || "";
    if (message) { inputs[key].setAttribute("aria-invalid", "true"); } else { inputs[key].removeAttribute("aria-invalid"); }
  }

  function values() {
    var data = {};
    FIELDS.forEach(function (key) { data[key] = inputs[key].value; });
    return data;
  }

  function showErrors(result) {
    FIELDS.forEach(function (key) { setError(key, result.errors[key]); });
    summary.hidden = result.ok;
    summary.textContent = "Revisa los campos marcados";
  }

  FIELDS.forEach(function (key) {
    inputs[key].addEventListener("input", function () { setError(key, ""); summary.hidden = true; });
  });

  /* Avisa al salir de la confirmación si no coincide, sin esperar al envío */
  inputs.clave2.addEventListener("blur", function () {
    if (inputs.clave2.value && inputs.clave2.value !== inputs.clave.value) { setError("clave2", "Las contraseñas no coinciden"); }
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var data = values();
    var result = validate(data);
    showErrors(result);

    if (!result.ok) {
      summary.focus();
      inputs[result.order[0]].focus();
      return;
    }

    var response = Auth.register({
      nombre: data.nombre,
      apellido: data.apellido,
      email: data.correo,
      telefono: data.telefono,
      password: data.clave
    });

    if (!response.ok) {
      setError("correo", "Este correo ya está registrado");
      summary.hidden = false;
      summary.textContent = "Este correo ya está registrado. Inicia sesión o usa otro.";
      inputs.correo.focus();
      return;
    }

    form.hidden = true;
    successBox.hidden = false;
    document.getElementById("registro-exito-titulo").focus();
    window.scrollTo(0, 0);
  });

  if (window.MakkaSession.isLoggedIn()) {
    /* Con sesión iniciada no hace falta crear otra cuenta: login.html lo avisa y deja cerrar sesión */
    window.location.replace("login.html" + (next ? "?siguiente=" + encodeURIComponent(next) : ""));
  } else {
    form.hidden = false;
  }
})();
