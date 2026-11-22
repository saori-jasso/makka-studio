(function () {
  "use strict";

  var Auth = window.MakkaAuth;
  var Session = window.MakkaSession;

  var Avatar = window.MakkaAvatar;
  var AVATARS = Avatar.LIST.map(function (item) { return item.id; });
  var DATA_FIELDS = ["nombre", "apellido", "telefono"];
  var PASS_FIELDS = ["actual", "nueva", "confirmar"];

  /* values: { nombre, apellido, telefono } */
  function validateData(values) {
    var errors = {};
    if (!String(values.nombre).trim()) { errors.nombre = "Ingresa tu nombre"; }
    if (!String(values.apellido).trim()) { errors.apellido = "Ingresa tu apellido"; }
    if (!Auth.isPhone(values.telefono)) { errors.telefono = "Ingresa un teléfono de 10 dígitos"; }
    return { ok: Object.keys(errors).length === 0, errors: errors, order: DATA_FIELDS.filter(function (key) { return errors[key]; }) };
  }

  /* values: { actual, nueva, confirmar } */
  function validatePassword(values) {
    var errors = {};
    if (!values.actual) { errors.actual = "Ingresa tu contraseña actual"; }
    if (!Auth.isPassword(values.nueva)) { errors.nueva = "Mínimo 8 caracteres"; }
    if (!values.confirmar) { errors.confirmar = "Confirma tu contraseña nueva"; }
    else if (!errors.nueva && values.confirmar !== values.nueva) { errors.confirmar = "Las contraseñas no coinciden"; }
    if (!errors.nueva && !errors.actual && values.nueva === values.actual) { errors.nueva = "Usa una contraseña distinta a la actual"; }
    return { ok: Object.keys(errors).length === 0, errors: errors, order: PASS_FIELDS.filter(function (key) { return errors[key]; }) };
  }

  window.MakkaPerfilLogic = { validateData: validateData, validatePassword: validatePassword, AVATARS: AVATARS };

  var content = document.getElementById("perfil-contenido");
  var noSession = document.getElementById("estado-sesion");
  if (!content || !noSession || !Auth || !Session) {
    return;
  }

  var current = Session.user();
  var profile = current && current.email ? Auth.getProfile(current.email) : null;

  /* Sin sesión (o la cuenta ya no existe): invitación a iniciar sesión */
  if (!Session.isLoggedIn() || !profile) {
    noSession.hidden = false;
    return;
  }
  content.hidden = false;

  function byId(id) { return document.getElementById(id); }

  var avatarBox = byId("perfil-avatar");
  var greeting = byId("perfil-saludo");
  var avatarToggle = byId("avatar-cambiar");
  var avatarPanel = byId("avatar-panel");
  var avatarList = byId("avatar-lista");

  /* Un botón por animalito (la lista sale de components/avatar.js) */
  avatarList.innerHTML = Avatar.LIST.map(function (item) {
    return '<li><button class="avatar" type="button" data-avatar="' + item.id + '" aria-label="' + item.nombre + '" aria-pressed="false"><img src="' + Avatar.src(item.id) + '" alt="" width="96" height="96" loading="lazy"></button></li>';
  }).join("");
  var avatarButtons = Array.prototype.slice.call(avatarList.querySelectorAll("[data-avatar]"));
  var dataRead = byId("datos-lectura");
  var dataForm = byId("datos-form");
  var dataEdit = byId("datos-editar");
  var dataOk = byId("datos-ok");
  var dataSummary = byId("datos-resumen");
  var passForm = byId("clave-form");
  var passOk = byId("clave-ok");
  var dataInputs = { nombre: byId("pf-nombre"), apellido: byId("pf-apellido"), telefono: byId("pf-telefono") };
  var passInputs = { actual: byId("pf-actual"), nueva: byId("pf-nueva"), confirmar: byId("pf-confirmar") };

  function toast(message) {
    if (window.MakkaToast && window.MakkaToast.show) { window.MakkaToast.show({ mensaje: message }); }
  }

  /* Datos del perfil en pantalla */
  function render() {
    greeting.textContent = "Hola, " + profile.nombre;
    byId("perfil-correo").textContent = profile.email;
    Avatar.render(avatarBox, profile.avatar, String(profile.nombre || "").charAt(0).toUpperCase());
    byId("lee-nombre").textContent = profile.nombre;
    byId("lee-apellido").textContent = profile.apellido;
    byId("lee-correo").textContent = profile.email;
    byId("lee-telefono").textContent = profile.telefono;
    avatarButtons.forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-avatar") === profile.avatar));
    });
  }

  /* Mantiene la sesión (y el menú del encabezado) con los datos nuevos */
  function refreshSession() {
    Session.login({ nombre: profile.nombre, email: profile.email, rol: current.rol, avatar: profile.avatar });
    /* El menú del encabezado ya se pintó al cargar la página: se actualiza aquí para no esperar a recargar */
    var headAvatar = document.querySelector(".user-menu__avatar");
    if (headAvatar) { Avatar.render(headAvatar, profile.avatar, String(profile.nombre || "").charAt(0).toUpperCase()); }
    var headName = document.querySelector(".user-menu__name");
    if (headName) { headName.textContent = "Hola, " + profile.nombre; }
  }

  /* Primera vez (o avatar viejo que ya no existe): se asigna un animalito al azar y se queda guardado */
  if (!Avatar.isValid(profile.avatar)) {
    var saved = Auth.updateProfile(profile.email, { avatar: Avatar.random() });
    if (saved.ok) { profile.avatar = saved.usuario.avatar; refreshSession(); }
  }
  render();

  /* ---------- Avatar ---------- */
  avatarToggle.addEventListener("click", function () {
    var open = avatarPanel.hidden;
    avatarPanel.hidden = !open;
    avatarToggle.setAttribute("aria-expanded", String(open));
  });

  avatarButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      var saved = Auth.updateProfile(profile.email, { avatar: button.getAttribute("data-avatar") });
      if (!saved.ok) { return; }
      profile.avatar = saved.usuario.avatar;
      refreshSession();
      render();
      toast("Cambiamos tu avatar");
    });
  });

  /* ---------- Errores ---------- */
  function setError(inputs, key, message) {
    var box = byId("err-" + key);
    box.hidden = !message;
    box.textContent = message || "";
    if (message) { inputs[key].setAttribute("aria-invalid", "true"); } else { inputs[key].removeAttribute("aria-invalid"); }
  }

  function showErrors(inputs, keys, result) {
    keys.forEach(function (key) { setError(inputs, key, result.errors[key]); });
  }

  /* ---------- Mis datos ---------- */
  function setEditing(editing) {
    dataForm.hidden = !editing;
    dataRead.hidden = editing;
    dataEdit.hidden = editing;
    dataSummary.hidden = true;
    showErrors(dataInputs, DATA_FIELDS, { errors: {} });
    if (editing) {
      dataOk.hidden = true;
      dataInputs.nombre.value = profile.nombre;
      dataInputs.apellido.value = profile.apellido;
      byId("pf-correo").value = profile.email;
      dataInputs.telefono.value = profile.telefono;
      dataInputs.nombre.focus();
    }
  }

  dataEdit.addEventListener("click", function () { setEditing(true); });

  byId("datos-cancelar").addEventListener("click", function () {
    setEditing(false);
    dataEdit.focus();
  });

  /* Solo números en el teléfono */
  dataInputs.telefono.addEventListener("input", function () {
    dataInputs.telefono.value = dataInputs.telefono.value.replace(/[^\d\s-]/g, "");
  });

  DATA_FIELDS.forEach(function (key) {
    dataInputs[key].addEventListener("input", function () { setError(dataInputs, key, ""); dataSummary.hidden = true; });
  });

  dataForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var values = {};
    DATA_FIELDS.forEach(function (key) { values[key] = dataInputs[key].value; });
    var result = validateData(values);
    showErrors(dataInputs, DATA_FIELDS, result);
    dataSummary.hidden = result.ok;

    if (!result.ok) {
      dataSummary.focus();
      dataInputs[result.order[0]].focus();
      return;
    }

    var saved = Auth.updateProfile(profile.email, values);
    if (!saved.ok) {
      dataSummary.hidden = false;
      dataSummary.textContent = "No pudimos guardar tus datos. Intenta de nuevo.";
      return;
    }
    profile = Auth.getProfile(profile.email);
    refreshSession();
    render();
    setEditing(false);
    dataOk.hidden = false;
    dataOk.focus();
  });

  /* ---------- Contraseña ---------- */
  [["actual", "ojo-actual", "contraseña actual"], ["nueva", "ojo-nueva", "contraseña nueva"], ["confirmar", "ojo-confirmar", "confirmación de contraseña"]].forEach(function (item) {
    var input = passInputs[item[0]];
    var button = byId(item[1]);
    button.addEventListener("click", function () {
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      button.setAttribute("aria-pressed", String(show));
      button.setAttribute("aria-label", (show ? "Ocultar " : "Mostrar ") + item[2]);
      button.querySelector("img").src = show ? "assets/img/icons/eye-off.svg" : "assets/img/icons/eye.svg";
      input.focus();
    });
  });

  PASS_FIELDS.forEach(function (key) {
    passInputs[key].addEventListener("input", function () { setError(passInputs, key, ""); });
  });

  passForm.addEventListener("submit", function (event) {
    event.preventDefault();
    passOk.hidden = true;
    var values = {};
    PASS_FIELDS.forEach(function (key) { values[key] = passInputs[key].value; });
    var result = validatePassword(values);
    showErrors(passInputs, PASS_FIELDS, result);

    if (!result.ok) {
      passInputs[result.order[0]].focus();
      return;
    }

    var changed = Auth.changePassword(profile.email, values.actual, values.nueva);
    if (!changed.ok) {
      setError(passInputs, "actual", "La contraseña actual no es correcta");
      passInputs.actual.focus();
      return;
    }
    passForm.reset();
    passOk.hidden = false;
    passOk.focus();
  });

  /* ---------- Cerrar sesión ---------- */
  byId("perfil-salir").addEventListener("click", function () {
    Session.logout();
    window.location.href = "index.html";
  });
})();
