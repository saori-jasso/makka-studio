(function () {
  "use strict";

  var Auth = window.MakkaAuth;

  /* values: { nueva, confirmar } */
  function validate(values) {
    var errors = {};
    if (!Auth.isPassword(values.nueva)) { errors.nueva = "Mínimo 8 caracteres"; }
    if (!values.confirmar) { errors.confirmar = "Confirma tu contraseña nueva"; }
    else if (!errors.nueva && values.confirmar !== values.nueva) { errors.confirmar = "Las contraseñas no coinciden"; }
    return { ok: Object.keys(errors).length === 0, errors: errors, order: ["nueva", "confirmar"].filter(function (key) { return errors[key]; }) };
  }

  window.MakkaRestablecerLogic = { validate: validate };

  var form = document.getElementById("res-form");
  if (!form) {
    return;
  }

  var token = new URLSearchParams(window.location.search).get("token") || "";
  var inputs = { nueva: document.getElementById("res-nueva"), confirmar: document.getElementById("res-confirmar") };
  var alertBox = document.getElementById("res-error");
  var intro = document.getElementById("res-texto");
  var invalid = document.getElementById("res-invalido");
  var done = document.getElementById("res-exito");

  function showInvalid() {
    form.hidden = true;
    intro.hidden = true;
    invalid.hidden = false;
    document.getElementById("res-invalido-texto").focus();
  }

  function setError(key, message) {
    var box = document.getElementById("err-" + key);
    box.hidden = !message;
    box.textContent = message || "";
    if (message) { inputs[key].setAttribute("aria-invalid", "true"); } else { inputs[key].removeAttribute("aria-invalid"); }
  }

  [["nueva", "res-ojo1", "contraseña nueva"], ["confirmar", "res-ojo2", "confirmación de contraseña"]].forEach(function (item) {
    var input = inputs[item[0]];
    var button = document.getElementById(item[1]);
    button.addEventListener("click", function () {
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      button.setAttribute("aria-pressed", String(show));
      button.setAttribute("aria-label", (show ? "Ocultar " : "Mostrar ") + item[2]);
      button.querySelector("img").src = show ? "assets/img/icons/eye-off.svg" : "assets/img/icons/eye.svg";
      input.focus();
    });
    input.addEventListener("input", function () { setError(item[0], ""); alertBox.hidden = true; });
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var values = { nueva: inputs.nueva.value, confirmar: inputs.confirmar.value };
    var result = validate(values);
    setError("nueva", result.errors.nueva);
    setError("confirmar", result.errors.confirmar);
    if (!result.ok) {
      inputs[result.order[0]].focus();
      return;
    }

    var response = Auth.resetPassword(token, values.nueva);
    if (!response.ok) {
      showInvalid();
      return;
    }
    form.hidden = true;
    intro.hidden = true;
    done.hidden = false;
    document.getElementById("res-exito-texto").focus();
  });

  /* Sin enlace válido no se muestra el formulario */
  if (Auth.checkResetToken(token).ok) {
    form.hidden = false;
  } else {
    showInvalid();
  }
})();
