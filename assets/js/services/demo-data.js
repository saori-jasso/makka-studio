/*
 * SOLO PRUEBA: datos de ejemplo para ver el panel del administrador sin información real.
 * build(now) -> { compras, solicitudes, usuarios }
 * load(parte?) guarda en localStorage lo que esté vacío: parte = "compras", "solicitudes" o "usuarios" (sin parte, las tres).
 *   Nunca borra datos que ya existan. Devuelve true si pudo guardar.
 * Con backend, quita este archivo y los botones "Cargar datos de ejemplo".
 */
window.MakkaDemo = (function () {
  "use strict";

  /* Productos reales del catálogo de ejemplo: id -> [nombre, precio] */
  var PRODUCTS = {
    1: ["Llavero Dino", 50], 2: ["Aretes Huevo", 35], 3: ["Florero con 4 tulipanes", 150], 4: ["Separador Faro", 30],
    5: ["Clicker Queso", 50], 6: ["Aretes Cono", 35], 7: ["Llavero Game Boy", 40], 8: ["Portalabiales Termo", 80],
    9: ["Figura Nerds", 90], 10: ["Casita de Jengibre Chica", 40], 11: ["Cuadro Hogwarts", 90], 12: ["Cuadro One Piece", 100],
    13: ["Cuadro Pikachu", 350], 14: ["Cuadro Tomioka", 100], 15: ["Portalápices Mickey", 120], 17: ["Figura Blastoise", 190],
    18: ["Aretes Stanley", 35]
  };

  /* [folio, días atrás, correo, [[id, cantidad, color]], estatus, extras] */
  var ORDERS = [
    ["MK-0001", 70, "sofia@ejemplo.mx", [[1, 2, "Rosa"]], "entregado", { archivada: true }],
    ["MK-0002", 62, "diego@ejemplo.mx", [[7, 1, "Rojo"]], "entregado", { archivada: true }],
    ["MK-0003", 55, "valeria@ejemplo.mx", [[2, 1, ""], [4, 2, ""]], "entregado", { archivada: true }],
    ["MK-0004", 48, "mateo@ejemplo.mx", [[11, 1, ""]], "entregado", {}],
    ["MK-0005", 41, "sofia@ejemplo.mx", [[9, 1, "Azul"]], "entregado", {}],
    ["MK-0006", 35, "diego@ejemplo.mx", [[18, 1, "Rosa"], [5, 2, ""]], "entregado", {}],
    ["MK-0007", 29, "valeria@ejemplo.mx", [[13, 1, ""]], "entregado", {}],
    ["MK-0008", 24, "mateo@ejemplo.mx", [[3, 1, ""]], "entregado", {}],
    ["MK-0009", 20, "sofia@ejemplo.mx", [[1, 3, "Naranja"]], "entregado", {}],
    ["MK-0010", 16, "diego@ejemplo.mx", [[12, 1, ""]], "entregado", {}],
    ["MK-0011", 12, "valeria@ejemplo.mx", [[8, 2, ""]], "enviado", { eta: 1 }],
    ["MK-0012", 9, "mateo@ejemplo.mx", [[17, 1, ""]], "en-produccion", { eta: 3 }],
    ["MK-0013", 8, "sofia@ejemplo.mx", [[6, 1, ""], [4, 1, ""]], "en-produccion", { eta: 4 }],
    ["MK-0014", 6, "diego@ejemplo.mx", [[10, 1, ""]], "pago-validado", { eta: 6 }],
    ["MK-0015", 4, "valeria@ejemplo.mx", [[7, 2, "Amarillo"]], "pago-validado", { eta: 7 }],
    ["MK-0016", 3, "sofia@ejemplo.mx", [[1, 2, "Verde"]], "pago-pendiente", {}],
    ["MK-0017", 2, "mateo@ejemplo.mx", [[14, 1, ""]], "pago-pendiente", { rechazado: "La imagen del comprobante se ve cortada." }],
    ["MK-0018", 1, "diego@ejemplo.mx", [[5, 1, ""], [2, 1, ""]], "pago-pendiente", {}],
    ["MK-0019", 11, "mateo@ejemplo.mx", [[15, 1, ""]], "cancelado", { motivo: "Cambió de opinión." }],
    ["MK-0020", 0, "valeria@ejemplo.mx", [[18, 2, "Azul"]], "pago-pendiente", {}]
  ];

  function build(now) {
    function ago(days) { return new Date(now.getTime() - days * 86400000).toISOString(); }
    function ahead(days) {
      var date = new Date(now.getTime() + days * 86400000);
      return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
    }
    var file = { nombre: "comprobante.png", tamano: 184320 };

    var compras = ORDERS.map(function (row) {
      var lines = row[3].map(function (item) {
        var product = PRODUCTS[item[0]];
        return { id: item[0], nombre: product[0], color: item[2], material: "PLA", cantidad: item[1], precio: product[1] };
      });
      var extra = row[5];
      var purchase = {
        folio: row[0], fecha: ago(row[1]), correo: row[2], lineas: lines, estatus: row[4], comprobante: file,
        total: lines.reduce(function (sum, line) { return sum + line.precio * line.cantidad; }, 0)
      };
      if (["pago-validado", "en-produccion", "enviado", "entregado"].indexOf(row[4]) !== -1) { purchase.pagoValidado = ago(Math.max(row[1] - 0.5, 0)); }
      if (extra.eta !== undefined) { purchase.entregaEstimada = ahead(extra.eta); }
      if (extra.archivada) { purchase.archivada = true; }
      if (extra.rechazado) { purchase.pagoRechazado = ago(1); purchase.observacionPago = extra.rechazado; }
      if (extra.motivo) { purchase.motivo = extra.motivo; purchase.cancelada = ago(row[1] - 1); }
      return purchase;
    });

    function request(id, days, email, status, extra) {
      return Object.assign({
        id: id, creada: ago(days), estatus: status, correo: email,
        tipoPedido: "Diseño nuevo", producto: null, categoria: "figuras", categoriaNombre: "Figuras",
        colores: ["Rosa"], material: "PLA", tamano: "5 cm × 5 cm", descripcion: "Quiero una figura de mi gatito.",
        texto: "", fechaNecesaria: null, cantidad: 1, archivo3d: null, imagenesReferencia: []
      }, extra);
    }

    var solicitudes = [
      request("PC-0001", 14, "sofia@ejemplo.mx", "Aceptado", { categoria: "llaveros", categoriaNombre: "Llaveros", descripcion: "Llavero con las iniciales S y D.", texto: "S + D", cantidad: 4, cotizacion: 240, notasCotizacion: "Incluye argollas.", cotizada: ago(12), aceptada: ago(11), archivoEstado: "aprobado" , archivo3d: { nombre: "iniciales.stl", tamano: 2411520 } }),
      request("PC-0002", 9, "diego@ejemplo.mx", "Cotizado", { tipoPedido: "Modificación de un producto del catálogo", producto: { id: 7, nombre: "Llavero Game Boy" }, categoria: "llaveros", categoriaNombre: "Llaveros", colores: ["Azul", "Otro: Verde menta"], descripcion: "El Game Boy en azul con mi nombre en la pantalla.", texto: "Diego", cantidad: 2, cotizacion: 190, notasCotizacion: "Entrega en 8 días hábiles.", cotizada: ago(7) }),
      request("PC-0003", 5, "valeria@ejemplo.mx", "Rechazado", { categoria: "decoracion", categoriaNombre: "Decoración", descripcion: "Una lámpara de 40 cm de alto.", tamano: "40 cm × 20 cm", motivoRechazo: "Excede el tamaño máximo de impresión." }),
      request("PC-0004", 3, "mateo@ejemplo.mx", "En revisión", { descripcion: "Figura de mi perro corgi sentado.", cantidad: 1, archivo3d: { nombre: "corgi.stl", tamano: 8388608 }, imagenesReferencia: [{ nombre: "corgi-1.jpg", tamano: 524288 }], fechaNecesaria: ahead(25) }),
      request("PC-0005", 2, "valeria@ejemplo.mx", "En revisión", { categoria: "aretes", categoriaNombre: "Aretes", colores: ["Rosa", "Blanco"], descripcion: "Aretes de florecitas pequeños.", tamano: "2 cm × 2 cm", cantidad: 3, archivo3d: { nombre: "flores.obj", tamano: 1048576 }, archivoEstado: "rechazado", archivoNota: "El archivo viene dañado." }),
      request("PC-0006", 1, "sofia@ejemplo.mx", "En revisión", { categoria: "cuadros-en-relieve", categoriaNombre: "Cuadros en relieve", colores: ["Negro", "Blanco"], descripcion: "Cuadro en relieve de nuestro gato Michi.", tamano: "20 cm × 25 cm", imagenesReferencia: [{ nombre: "michi.jpg", tamano: 912384 }] })
    ];

    function user(name, last, email, phone, role, days) {
      return { nombre: name, apellido: last, email: email, telefono: phone, clave: "Demo1234", rol: role, alta: ago(days) };
    }
    var usuarios = [
      user("Sofía", "Ramírez", "sofia@ejemplo.mx", "4441112233", "cliente", 80),
      user("Diego", "Torres", "diego@ejemplo.mx", "4442223344", "cliente", 75),
      user("Valeria", "Núñez", "valeria@ejemplo.mx", "4443334455", "cliente", 60),
      user("Mateo", "Salazar", "mateo@ejemplo.mx", "4444445566", "cliente", 50),
      user("Lupita", "Hernández", "lupita@makka.studio", "4445556677", "empleado", 40)
    ];

    return { compras: compras, solicitudes: solicitudes, usuarios: usuarios };
  }

  function readList(key) {
    try {
      var data = JSON.parse(window.localStorage.getItem(key) || "[]");
      return Array.isArray(data) ? data : [];
    } catch (error) {
      return [];
    }
  }

  function load(part) {
    var data = build(new Date());
    var keys = { compras: "makka_compras", solicitudes: "makka_solicitudes", usuarios: "makka_usuarios" };
    try {
      Object.keys(keys).forEach(function (name) {
        if (part && part !== name) { return; }
        var current = readList(keys[name]);
        if (name === "usuarios") {
          /* Se agregan a las cuentas que ya existen (como la del administrador) sin repetir correos */
          var emails = current.map(function (user) { return user.email; });
          var merged = current.concat(data.usuarios.filter(function (user) { return emails.indexOf(user.email) === -1; }));
          window.localStorage.setItem(keys[name], JSON.stringify(merged));
        } else if (!current.length) {
          window.localStorage.setItem(keys[name], JSON.stringify(data[name]));
        }
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  return { build: build, load: load };
})();
