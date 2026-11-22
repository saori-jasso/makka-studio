/*
 * Avatares de las personas (16 animalitos en assets/img/avatars/<id>.webp).
 * En la cuenta SOLO se guarda el id (por ejemplo "zorro"): es el texto de la columna "avatar" de la tabla de usuarios.
 * La imagen sale siempre de aquí (src()); no se guarda la ruta ni la imagen en la base de datos.
 * Si el valor guardado no es un id de esta lista (cuentas viejas con emoji o vacío), se muestra la inicial del nombre.
 * Para agregar un avatar: pon su imagen en assets/img/avatars/ y súmalo a LIST.
 */
window.MakkaAvatar = (function () {
  "use strict";

  var LIST = [
    { id: "gato", nombre: "Gatito" },
    { id: "mono", nombre: "Monito" },
    { id: "raton", nombre: "Ratoncito" },
    { id: "pollito", nombre: "Pollito" },
    { id: "conejo", nombre: "Conejito" },
    { id: "panda-rojo", nombre: "Panda rojo" },
    { id: "ganso", nombre: "Gansito" },
    { id: "pinguino", nombre: "Pingüino" },
    { id: "cocodrilo", nombre: "Cocodrilo" },
    { id: "zorro", nombre: "Zorrito" },
    { id: "borrego", nombre: "Borreguito" },
    { id: "tigre", nombre: "Tigre" },
    { id: "perrito", nombre: "Perrito" },
    { id: "elefante", nombre: "Elefantito" },
    { id: "cerdito", nombre: "Cerdito" },
    { id: "vaca", nombre: "Vaquita" }
  ];

  function isValid(id) {
    return LIST.some(function (item) { return item.id === id; });
  }

  function src(id) {
    return "assets/img/avatars/" + id + ".webp";
  }

  function random() {
    return LIST[Math.floor(Math.random() * LIST.length)].id;
  }

  /* Pinta el avatar dentro de "element": la imagen si el id es válido o, si no, el texto de respaldo (la inicial). */
  function render(element, id, fallback) {
    element.textContent = "";
    if (!isValid(id)) {
      element.textContent = fallback || "";
      return;
    }
    var image = document.createElement("img");
    image.src = src(id);
    image.alt = "";
    image.width = 96;
    image.height = 96;
    element.appendChild(image);
  }

  return { LIST: LIST, isValid: isValid, src: src, random: random, render: render };
})();
