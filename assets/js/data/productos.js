/*
 * Datos del catálogo. Los precios, materiales y medidas ya son los reales de Makka Studio
 * (revisión de noviembre de 2026); las descripciones siguen siendo provisionales.
 * "version" sube cada vez que cambian estos datos para que el panel descarte copias viejas guardadas en el navegador.
 *
 * Colores: solo los productos con `colores` (cada uno con su `imagenes`) dejan
 * elegir color. Si un producto no tiene `colores`, se vende en los colores de la
 * foto y la página ofrece el pedido personalizado para otros colores.
 * El backend debe devolver este mismo formato en JSON (ver README).
 */
window.MAKKA_DATA = {
  version: 2,
  categorias: [
    { slug: "llaveros", nombre: "Llaveros" },
    { slug: "clickers", nombre: "Clickers" },
    { slug: "aretes", nombre: "Aretes" },
    { slug: "separadores", nombre: "Separadores" },
    { slug: "figuras", nombre: "Figuras" },
    { slug: "cuadros-en-relieve", nombre: "Cuadros en relieve" },
    { slug: "articulos-de-temporada", nombre: "Artículos de temporada" },
    { slug: "decoracion", nombre: "Decoración" }
  ],
  productos: [
    {
      id: 1,
      nombre: "Llavero Dino",
      categoria: "llaveros",
      descripcion: "Dinosaurio articulado que se mueve con todo y argolla para tus llaves.",
      precio: 50,
      calificacion: 4.5,
      materiales: ["PLA"],
      colores: [
        { nombre: "Amarillo", hex: "#F2D836", filamento: "Bambu Lab PLA Lite Yellow", imagenes: [{ src: "assets/img/productos/colores/llavero-dino-amarillo.webp", alt: "Llavero de dinosaurio color amarillo", ancho: 550, alto: 592 }] },
        { nombre: "Naranja", hex: "#F37B26", filamento: "Bambu Lab PLA Lite Orange", imagenes: [{ src: "assets/img/productos/colores/llavero-dino-naranja.webp", alt: "Llavero de dinosaurio color naranja", ancho: 550, alto: 592 }] },
        { nombre: "Rojo", hex: "#CC3030", filamento: "Bambu Lab PLA Lite Red", imagenes: [{ src: "assets/img/productos/colores/llavero-dino-rojo.webp", alt: "Llavero de dinosaurio color rojo", ancho: 550, alto: 592 }] },
        { nombre: "Rosa", hex: "#F9A6B0", filamento: "SUNLU PLA Rosa (Pink)", imagenes: [{ src: "assets/img/productos/colores/llavero-dino-rosa.webp", alt: "Llavero de dinosaurio color rosa", ancho: 550, alto: 592 }] },
        { nombre: "Morado", hex: "#8887C5", filamento: "SUNLU PLA Purple", imagenes: [{ src: "assets/img/productos/colores/llavero-dino-morado.webp", alt: "Llavero de dinosaurio color morado", ancho: 550, alto: 592 }] },
        { nombre: "Azul", hex: "#1767B4", filamento: "Bambu Lab PLA Lite Blue", imagenes: [{ src: "assets/img/productos/colores/llavero-dino-azul.webp", alt: "Llavero de dinosaurio color azul", ancho: 550, alto: 592 }] },
        { nombre: "Cian", hex: "#00A4C9", filamento: "Bambu Lab PLA Lite Cyan", imagenes: [{ src: "assets/img/productos/colores/llavero-dino-cian.webp", alt: "Llavero de dinosaurio color cian", ancho: 550, alto: 592 }] },
        { nombre: "Verde", hex: "#32A852", filamento: "Bambu Lab PLA Lite Green", imagenes: [{ src: "assets/img/productos/colores/llavero-dino-verde.webp", alt: "Llavero de dinosaurio color verde", ancho: 550, alto: 592 }] },
        { nombre: "Negro", hex: "#000000", filamento: "Bambu Lab PLA Lite Black", imagenes: [{ src: "assets/img/productos/colores/llavero-dino-negro.webp", alt: "Llavero de dinosaurio color negro", ancho: 550, alto: 592 }] },
        { nombre: "Blanco", hex: "#FFFEF7", filamento: "Bambu Lab PLA Lite White", imagenes: [{ src: "assets/img/productos/colores/llavero-dino-blanco.webp", alt: "Llavero de dinosaurio color blanco", ancho: 550, alto: 592 }] }
      ],
      personalizable: true,
      imagen: { src: "assets/img/productos/llavero-dino.webp", alt: "Llavero de dinosaurio amarillo", ancho: 550, alto: 592, grande: "assets/img/productos/grandes/llavero-dino.webp" }
    },
    {
      id: 2,
      nombre: "Aretes Huevo",
      categoria: "aretes",
      descripcion: "Aretes ligeros en forma de huevito con patitas naranjas.",
      precio: 35,
      calificacion: 5,
      materiales: ["PLA"],
      precioUnidad: "el par",
      personalizable: true,
      imagen: { src: "assets/img/productos/aretes-huevo.webp", alt: "Aretes en forma de huevo", ancho: 518, alto: 480, grande: "assets/img/productos/grandes/aretes-huevo.webp" }
    },
    {
      id: 3,
      nombre: "Florero con 4 tulipanes",
      categoria: "decoracion",
      descripcion: "Florero acanalado con tulipanes de colores que nunca se marchitan.",
      precio: 150,
      calificacion: 4,
      materiales: ["PLA"],
      personalizable: true,
      imagen: { src: "assets/img/productos/florero-tulipanes.webp", alt: "Florero blanco con tulipanes de colores", ancho: 306, alto: 640, grande: "assets/img/productos/grandes/florero-tulipanes.webp" }
    },
    {
      id: 4,
      nombre: "Separador Faro",
      categoria: "separadores",
      descripcion: "Separador de libros con ilustración de un faro junto al mar.",
      precio: 30,
      calificacion: 4.5,
      materiales: ["PLA"],
      personalizable: true,
      imagen: { src: "assets/img/productos/separador-faro.webp", alt: "Separador de libros con un faro", ancho: 171, alto: 640, grande: "assets/img/productos/grandes/separador-faro.webp" }
    },
    {
      id: 5,
      nombre: "Clicker Queso",
      categoria: "clickers",
      descripcion: "Quesito con cordón para colgar y hacer clic cuando quieras.",
      precio: 50,
      calificacion: 4.5,
      materiales: ["PLA"],
      personalizable: true,
      imagen: { src: "assets/img/productos/clicker-queso.webp", alt: "Clicker en forma de queso con cordón amarillo", ancho: 210, alto: 640, grande: "assets/img/productos/grandes/clicker-queso.webp" }
    },
    {
      id: 6,
      nombre: "Aretes Cono",
      categoria: "aretes",
      descripcion: "Conitos de obra naranja con rayas blancas, divertidos y livianos.",
      precio: 35,
      calificacion: 4,
      materiales: ["PLA"],
      precioUnidad: "el par",
      personalizable: true,
      imagen: { src: "assets/img/productos/aretes-cono.webp", alt: "Aretes en forma de cono de tránsito", ancho: 640, alto: 546, grande: "assets/img/productos/grandes/aretes-cono.webp" }
    },
    {
      id: 7,
      nombre: "Llavero Game Boy",
      categoria: "llaveros",
      descripcion: "Mini consola retro con argolla y mosquetón. El precio es por cada llavero.",
      precio: 40,
      calificacion: 5,
      materiales: ["PLA"],
      colores: [
        { nombre: "Rojo", hex: "#CC3030", filamento: "Bambu Lab PLA Lite Red", imagenes: [{ src: "assets/img/productos/grandes/llaveros-gameboy.webp", alt: "Llavero Game Boy color rojo", ancho: 834, alto: 609 }] },
        { nombre: "Naranja", hex: "#F37B26", filamento: "Bambu Lab PLA Lite Orange", imagenes: [{ src: "assets/img/productos/colores/llavero-gameboy-naranja.webp", alt: "Llavero Game Boy color naranja", ancho: 834, alto: 609 }] },
        { nombre: "Amarillo", hex: "#F2D836", filamento: "Bambu Lab PLA Lite Yellow", imagenes: [{ src: "assets/img/productos/colores/llavero-gameboy-amarillo.webp", alt: "Llavero Game Boy color amarillo", ancho: 834, alto: 609 }] },
        { nombre: "Verde", hex: "#32A852", filamento: "Bambu Lab PLA Lite Green", imagenes: [{ src: "assets/img/productos/colores/llavero-gameboy-verde.webp", alt: "Llavero Game Boy color verde", ancho: 834, alto: 609 }] },
        { nombre: "Cian", hex: "#00A4C9", filamento: "Bambu Lab PLA Lite Cyan", imagenes: [{ src: "assets/img/productos/colores/llavero-gameboy-cian.webp", alt: "Llavero Game Boy color cian", ancho: 834, alto: 609 }] },
        { nombre: "Azul", hex: "#1767B4", filamento: "Bambu Lab PLA Lite Blue", imagenes: [{ src: "assets/img/productos/colores/llavero-gameboy-azul.webp", alt: "Llavero Game Boy color azul", ancho: 834, alto: 609 }] },
        { nombre: "Morado", hex: "#8887C5", filamento: "SUNLU PLA Purple", imagenes: [{ src: "assets/img/productos/colores/llavero-gameboy-morado.webp", alt: "Llavero Game Boy color morado", ancho: 834, alto: 609 }] },
        { nombre: "Rosa", hex: "#F9A6B0", filamento: "SUNLU PLA Rosa (Pink)", imagenes: [{ src: "assets/img/productos/colores/llavero-gameboy-rosa.webp", alt: "Llavero Game Boy color rosa", ancho: 834, alto: 609 }] }
      ],
      precioUnidad: "c/u",
      personalizable: true,
      imagen: { src: "assets/img/productos/llaveros-gameboy.webp", alt: "Llaveros de consola Game Boy roja", ancho: 640, alto: 467, grande: "assets/img/productos/grandes/llaveros-gameboy.webp" }
    },
    {
      id: 8,
      nombre: "Portalabiales Termo",
      categoria: "llaveros",
      descripcion: "Portalabiales en forma de termo con cordón para llevarlo a todos lados. El precio es por cada portalabiales.",
      precio: 80,
      calificacion: 4.5,
      materiales: ["PLA"],
      precioUnidad: "c/u",
      personalizable: true,
      imagen: { src: "assets/img/productos/portalabiales-varios.webp", alt: "Portalabiales en forma de termo con cordón", ancho: 421, alto: 640, grande: "assets/img/productos/grandes/portalabiales-varios.webp" }
    },
    {
      id: 9,
      nombre: "Figura Nerds",
      categoria: "figuras",
      descripcion: "Figura suavecita inspirada en los dulces Nerds, con ojos saltones y patitas redondas.",
      precio: 90,
      calificacion: 5,
      materiales: ["PLA"],
      colores: [
        { nombre: "Azul", hex: "#1767B4", filamento: "Bambu Lab PLA Lite Blue", imagenes: [{ src: "assets/img/productos/colores/figura-nerds-azul.webp", alt: "Figura Nerds color azul", ancho: 794, alto: 846 }] },
        { nombre: "Amarillo", hex: "#F2D836", filamento: "Bambu Lab PLA Lite Yellow", imagenes: [{ src: "assets/img/productos/colores/figura-nerds-amarillo.webp", alt: "Figura Nerds color amarillo", ancho: 794, alto: 846 }] },
        { nombre: "Morado", hex: "#8887C5", filamento: "SUNLU PLA Purple", imagenes: [{ src: "assets/img/productos/colores/figura-nerds-morado.webp", alt: "Figura Nerds color morado", ancho: 794, alto: 846 }] },
        { nombre: "Rosa", hex: "#F9A6B0", filamento: "SUNLU PLA Rosa (Pink)", imagenes: [{ src: "assets/img/productos/colores/figura-nerds-rosa.webp", alt: "Figura Nerds color rosa", ancho: 794, alto: 846 }] },
        { nombre: "Naranja", hex: "#F37B26", filamento: "Bambu Lab PLA Lite Orange", imagenes: [{ src: "assets/img/productos/colores/figura-nerds-naranja.webp", alt: "Figura Nerds color naranja", ancho: 794, alto: 846 }] },
        { nombre: "Verde", hex: "#32A852", filamento: "Bambu Lab PLA Lite Green", imagenes: [{ src: "assets/img/productos/colores/figura-nerds-verde.webp", alt: "Figura Nerds color verde", ancho: 794, alto: 846 }] }
      ],
      personalizable: true,
      imagen: { src: "assets/img/productos/figura-nerds.webp", alt: "Figura inspirada en los dulces Nerds, impresa en 3D", ancho: 601, alto: 640, grande: "assets/img/productos/grandes/figura-nerds.webp" }
    },
    {
      id: 10,
      nombre: "Casita de Jengibre Chica",
      categoria: "articulos-de-temporada",
      descripcion: "Casita armable de jengibre con arbolitos y galletita incluidos. Tamaño chica. Se vende completa.",
      precio: 40,
      calificacion: 4.5,
      materiales: ["PLA"],
      personalizable: true,
      imagen: { src: "assets/img/productos/casita-navidad.webp", alt: "Casita navideña de jengibre con arbolitos", ancho: 640, alto: 315, grande: "assets/img/productos/grandes/casita-navidad.webp" }
    },
    {
      id: 19,
      nombre: "Casita de Jengibre M",
      categoria: "articulos-de-temporada",
      descripcion: "Casita armable de jengibre con arbolitos y galletita incluidos. Tamaño M. Se vende completa.",
      precio: 60,
      calificacion: 4.5,
      materiales: ["PLA"],
      personalizable: true,
      imagen: { src: "assets/img/productos/casita-navidad.webp", alt: "Casita navideña de jengibre con arbolitos", ancho: 640, alto: 315, grande: "assets/img/productos/grandes/casita-navidad.webp" }
    },
    {
      id: 20,
      nombre: "Casita de Jengibre L",
      categoria: "articulos-de-temporada",
      descripcion: "Casita armable de jengibre con arbolitos y galletita incluidos. Tamaño L. Se vende completa.",
      precio: 80,
      calificacion: 4.5,
      materiales: ["PLA"],
      personalizable: true,
      imagen: { src: "assets/img/productos/casita-navidad.webp", alt: "Casita navideña de jengibre con arbolitos", ancho: 640, alto: 315, grande: "assets/img/productos/grandes/casita-navidad.webp" }
    },
    {
      id: 21,
      nombre: "Casita de Jengibre XL",
      categoria: "articulos-de-temporada",
      descripcion: "Casita armable de jengibre con arbolitos y galletita incluidos. Tamaño XL. Se vende completa.",
      precio: 130,
      calificacion: 4.5,
      materiales: ["PLA"],
      personalizable: true,
      imagen: { src: "assets/img/productos/casita-navidad.webp", alt: "Casita navideña de jengibre con arbolitos", ancho: 640, alto: 315, grande: "assets/img/productos/grandes/casita-navidad.webp" }
    },
    {
      id: 11,
      nombre: "Cuadro Hogwarts",
      categoria: "cuadros-en-relieve",
      descripcion: "Cuadro en relieve del castillo de Hogwarts, de Harry Potter, bajo un cielo estrellado.",
      precio: 90,
      calificacion: 5,
      materiales: ["PLA"],
      medidas: "22 x 26 cm",
      personalizable: true,
      imagen: { src: "assets/img/productos/cuadro-hogwarts.webp", alt: "Cuadro en relieve del castillo de Hogwarts bajo un cielo estrellado", ancho: 640, alto: 520, grande: "assets/img/productos/grandes/cuadro-hogwarts.webp" }
    },
    {
      id: 12,
      nombre: "Cuadro One Piece",
      categoria: "cuadros-en-relieve",
      descripcion: "Cuadro en relieve del cartel de recompensa de Luffy, de One Piece, en blanco y negro.",
      precio: 100,
      calificacion: 4.5,
      materiales: ["PLA"],
      medidas: "16 x 24 cm",
      personalizable: true,
      imagen: { src: "assets/img/productos/cuadro-one-piece.webp", alt: "Cuadro en relieve del cartel de recompensa de Luffy, de One Piece", ancho: 419, alto: 640, grande: "assets/img/productos/grandes/cuadro-one-piece.webp" }
    },
    {
      id: 13,
      nombre: "Cuadro Pikachu",
      categoria: "cuadros-en-relieve",
      descripcion: "Cuadro enmarcado de Pikachu con sol rojo y textura de mosaico.",
      precio: 350,
      calificacion: 5,
      materiales: ["PLA"],
      medidas: "20 x 40 cm",
      personalizable: true,
      imagen: { src: "assets/img/productos/cuadro-pikachu.webp", alt: "Cuadro enmarcado de Pikachu con un sol rojo", ancho: 377, alto: 640, grande: "assets/img/productos/grandes/cuadro-pikachu.webp" }
    },
    {
      id: 14,
      nombre: "Cuadro Tomioka",
      categoria: "cuadros-en-relieve",
      descripcion: "Ilustración de samurái con círculo rojo, impresa en relieve sobre fondo blanco.",
      precio: 100,
      calificacion: 4.5,
      materiales: ["PLA"],
      medidas: "25.5 x 19 cm",
      personalizable: true,
      imagen: { src: "assets/img/productos/cuadro-tomioka.webp", alt: "Cuadro de un samurái con un círculo rojo", ancho: 458, alto: 640, grande: "assets/img/productos/grandes/cuadro-tomioka.webp" }
    },
    {
      id: 15,
      nombre: "Portalápices Mickey",
      categoria: "decoracion",
      descripcion: "Portalápices con orejas y manos para guardar tus plumas y colores favoritos.",
      precio: 120,
      calificacion: 5,
      materiales: ["PLA"],
      personalizable: true,
      imagen: { src: "assets/img/productos/portalapices-mickey.webp", alt: "Portalápices de ratón con orejas, manos y zapatos amarillos", ancho: 457, alto: 640, grande: "assets/img/productos/grandes/portalapices-mickey.webp" }
    },
    {
      id: 17,
      nombre: "Figura Blastoise",
      categoria: "figuras",
      descripcion: "Figura articulada de tortuga azul con cañones, lista para exhibir.",
      precio: 190,
      calificacion: 5,
      materiales: ["PLA"],
      personalizable: true,
      imagen: { src: "assets/img/productos/figura-blastoise.webp", alt: "Figura de una tortuga azul con cañones en el caparazón", ancho: 591, alto: 640, grande: "assets/img/productos/grandes/figura-blastoise.webp" }
    },
    {
      id: 18,
      nombre: "Aretes Stanley",
      categoria: "aretes",
      descripcion: "Aretes en forma de vaso Stanley con tapa y popote, ligeros y muy coquetos.",
      precio: 35,
      calificacion: 5,
      materiales: ["PLA"],
      precioUnidad: "el par",
      colores: [
        { nombre: "Rosa", hex: "#F9A6B0", filamento: "SUNLU PLA Rosa (Pink)", imagenes: [{ src: "assets/img/productos/colores/aretes-stanley-rosa.webp", alt: "Aretes Stanley color rosa", ancho: 652, alto: 510 }] },
        { nombre: "Rojo", hex: "#CC3030", filamento: "Bambu Lab PLA Lite Red", imagenes: [{ src: "assets/img/productos/colores/aretes-stanley-rojo.webp", alt: "Aretes Stanley color rojo", ancho: 652, alto: 510 }] },
        { nombre: "Naranja", hex: "#F37B26", filamento: "Bambu Lab PLA Lite Orange", imagenes: [{ src: "assets/img/productos/colores/aretes-stanley-naranja.webp", alt: "Aretes Stanley color naranja", ancho: 652, alto: 510 }] },
        { nombre: "Amarillo", hex: "#F2D836", filamento: "Bambu Lab PLA Lite Yellow", imagenes: [{ src: "assets/img/productos/colores/aretes-stanley-amarillo.webp", alt: "Aretes Stanley color amarillo", ancho: 652, alto: 510 }] },
        { nombre: "Verde", hex: "#32A852", filamento: "Bambu Lab PLA Lite Green", imagenes: [{ src: "assets/img/productos/colores/aretes-stanley-verde.webp", alt: "Aretes Stanley color verde", ancho: 652, alto: 510 }] },
        { nombre: "Turquesa", hex: "#52BBB1", filamento: "Polymaker PLA Teal", imagenes: [{ src: "assets/img/productos/colores/aretes-stanley-turquesa.webp", alt: "Aretes Stanley color turquesa", ancho: 652, alto: 510 }] },
        { nombre: "Azul", hex: "#1767B4", filamento: "Bambu Lab PLA Lite Blue", imagenes: [{ src: "assets/img/productos/colores/aretes-stanley-azul.webp", alt: "Aretes Stanley color azul", ancho: 652, alto: 510 }] },
        { nombre: "Morado", hex: "#8887C5", filamento: "SUNLU PLA Purple", imagenes: [{ src: "assets/img/productos/colores/aretes-stanley-morado.webp", alt: "Aretes Stanley color morado", ancho: 652, alto: 510 }] },
        { nombre: "Negro", hex: "#000000", filamento: "Bambu Lab PLA Lite Black", imagenes: [{ src: "assets/img/productos/colores/aretes-stanley-negro.webp", alt: "Aretes Stanley color negro", ancho: 652, alto: 510 }] }
      ],
      personalizable: true,
      imagen: { src: "assets/img/productos/aretes-stanley.webp", alt: "Aretes en forma de vaso Stanley rosa", ancho: 640, alto: 501, grande: "assets/img/productos/grandes/aretes-stanley.webp" }
    }
  ]
};
