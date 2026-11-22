# Makka Studio

Sitio web de Makka Studio, emprendimiento de diseño e impresión 3D en San Luis Potosí: tienda en línea (catálogo, carrito, compra por transferencia, pedidos personalizados) y panel del administrador.

**Estado:** el diseño y toda la interfaz están terminados. Hoy los datos viven en el `localStorage` del navegador (solo para probar). **Lo que falta es conectarlo a un hosting con PHP y una base de datos MySQL, sin API:** las páginas pasan a `.php`, PHP lee y escribe en la base directamente y los cambios se mandan con formularios normales. Este archivo explica cómo hacerlo.

Stack del front: HTML5, CSS3 y JavaScript sin dependencias ni paso de compilación. Las páginas se renombran a `.php` y se parten en `include`; el HTML, el CSS y casi todo el JavaScript se quedan igual.

## Contenido

1. [Guía para el equipo de backend](#guía-para-el-equipo-de-backend) (empieza aquí)
2. [Cómo está armado el front](#cómo-está-armado-el-front): estructura, cómo verlo y convenciones
3. [Documentación por pantalla](#documentación-por-pantalla): cada página, sus reglas y su punto de conexión
4. [Apéndices](#apéndices): recuperar cuenta por WhatsApp, fotos por color y precios

---

# Guía para el equipo de backend

## 0. En un minuto

* **Decisión de arquitectura: sin API.** No hay archivos que respondan JSON ni el sitio usa `fetch`. Solo hay **páginas PHP** (que consultan la base y escriben los datos dentro de la propia página) y **scripts PHP de acción** (que reciben un formulario, guardan en la base y redirigen). Es PHP clásico: PHP + MySQL/MariaDB.
* **Cómo se lee:** cada `.php` abre la base con PDO, consulta y deja los datos en `window.MAKKA` (un `<script>` que PHP escribe). El JavaScript de la página los lee igual que hoy leía `localStorage`; **no hay nada asíncrono**. El JS del navegador **nunca** se conecta a la base (se vería el usuario y la contraseña).
* **Cómo se escribe:** con formularios HTML (`<form method="post">`) que van a `acciones/*.php`. El script valida, ejecuta el SQL, deja un aviso en la sesión y redirige a la pantalla de origen (patrón POST -> redirección -> GET). Cada acción **recarga la página**; así funciona PHP sin API.
* **Dónde se conecta:** el acceso a datos está concentrado en `assets/js/services/` (7 archivos). Las funciones de **lectura** (`list()`, `get()`, `user()`) pasan a leer `window.MAKKA`; las de **escritura** (`validatePayment()`, `setRole()`, ...) se reemplazan por un formulario hacia `acciones/`. Ver secciones 6 y 8.
* **Qué NO hay que construir:** envío de correos (no hay: los avisos van por WhatsApp con enlaces `wa.me` que arma el front) ni pasarela de pago (el pago es por transferencia y el administrador valida el comprobante a mano).
* **Lo más delicado:** permisos por rol, validación de cada cambio de estatus, cálculo de totales en el servidor, subida de archivos y contraseñas con hash. Hoy la pantalla "cuida" esas reglas por comodidad, pero **PHP debe volver a comprobarlas siempre** (secciones 6, 7 y 9).

## 1. Qué hay hecho y qué falta

| Parte | Estado |
|---|---|
| Páginas, estilos y comportamiento (tienda y panel) | Terminado |
| Datos de ejemplo (catálogo de 20 productos, categorías, colores) | En `assets/js/data/productos.js` y `filamentos.js`; pasan a la base |
| Cuentas, sesión, carrito, compras, solicitudes, productos | Provisionales en `localStorage`; **se reemplazan por el backend** |
| Subir comprobantes, archivos 3D e imágenes de producto | Hoy solo se guarda nombre y tamaño (o la imagen como texto); **el servidor debe recibir y guardar los archivos** |
| Correos | No se usan |
| Pagos en línea | No se usan (transferencia + comprobante) |
| Permisos del empleado | Sin definir: hoy solo `administrador` entra al panel |

## 2. Arquitectura propuesta

```
Navegador  --pide una página .php-->  PHP (hosting)  --SQL con PDO-->  MySQL / MariaDB
   ^                                     |   
   |   HTML + <script>window.MAKKA=...   |
   +-------------------------------------+
Navegador  --formulario POST (+ archivos)-->  acciones/*.php  --SQL-->  MySQL
   ^                                              |
   +-------------- redirección (Location) -------+      archivos subidos --> carpeta /storage (fuera de la raíz pública)
```

* El sitio completo vive en **un solo dominio** (por ejemplo `https://makkastudio.mx/`). Las cookies de sesión de PHP funcionan solas, sin CORS.
* **HTTPS obligatorio.** Sesión de PHP con cookie `HttpOnly; Secure; SameSite=Lax`.
* **Las acciones no devuelven JSON ni HTML:** solo redirigen (`header('Location: ...')`). El resultado viaja en `$_SESSION['flash']`, que la página siguiente entrega al JS en `window.MAKKA.flash` (sección 6).
* Los **códigos de error** (`credenciales`, `ultimo-admin`, `estatus`, ...) son **exactamente** los que ya espera la interfaz (están en la sección 6); si PHP usa otros, los mensajes en pantalla no salen bien.

### Requisitos del hosting

* PHP 8.1 o superior (o el lenguaje que prefieran) con `pdo_mysql`, `fileinfo` y `gd` o `imagick` (para convertir imágenes a WebP).
* MySQL 8 o MariaDB 10.4+, con juego de caracteres `utf8mb4`.
* HTTPS (certificado), y poder subir archivos de hasta 50 MB (`upload_max_filesize` y `post_max_size`).
* Una carpeta para archivos subidos **fuera del directorio público**, o dentro con `.htaccess` que impida ejecutarlos y listarlos.

### Estructura sugerida en el hosting

```
/ (raíz pública)
  index.php, catalogo.php, producto.php, carrito.php, ...        <- las .html del proyecto, renombradas a .php
  dashboard.php, admin-pedidos.php, admin-productos.php, ...
  assets/                                                        <- tal cual
  acciones/                 Un archivo por acción; solo aceptan POST y siempre terminan en redirección
    registro.php  login.php  logout.php  perfil-guardar.php  perfil-clave.php
    enlace-contrasena.php  restablecer.php  usuario-rol.php
    producto-guardar.php  producto-visible.php  producto-eliminar.php
    compra-crear.php  compra-cancelar.php  admin-compra.php
    solicitud-crear.php  admin-solicitud.php
  descargar.php             Entrega comprobantes y modelos 3D solo a quien tenga permiso
/includes/ (fuera de la raíz pública, o con .htaccess "Require all denied")
  config.php   datos de la base (nunca en el repositorio)
  db.php       conexión PDO
  sesion.php   session_start, usuario actual, token CSRF, flash
  roles.php    requiere_rol('administrador') y similares
  catalogo.php, compras.php, ...   funciones que consultan la base y devuelven arreglos
/storage/ (fuera de la raíz pública)
  comprobantes/  modelos3d/  referencias/
```

## 3. Base de datos

Es una **sugerencia** (los nombres de columnas salen de los campos que ya usa el código, así cada fila se parece al objeto que hoy guardan los servicios). Si cambian nombres, solo hay que traducirlos al armar los datos que PHP escribe en `window.MAKKA` (sección 6).

```sql
CREATE DATABASE makka CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE makka;

CREATE TABLE usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(60) NOT NULL,
  apellido VARCHAR(60) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,            -- siempre en minúsculas
  telefono CHAR(10) NOT NULL,                    -- 10 dígitos, sin lada
  clave_hash VARCHAR(255) NOT NULL,              -- password_hash(); nunca texto plano
  rol ENUM('cliente','empleado','administrador') NOT NULL DEFAULT 'cliente',
  avatar VARCHAR(30) NOT NULL DEFAULT '',        -- solo el id: zorro, gato, ... (ver components/avatar.js)
  intentos_fallidos TINYINT NOT NULL DEFAULT 0,
  bloqueado_hasta DATETIME NULL,
  alta DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE enlaces_contrasena (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,           -- hash del token; el token en claro nunca se guarda
  vence DATETIME NOT NULL,                       -- 24 horas
  usado DATETIME NULL,
  creado_por INT NOT NULL,                       -- administrador que lo generó
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE TABLE categorias (
  slug VARCHAR(40) PRIMARY KEY,                  -- llaveros, clickers, aretes, separadores, figuras, cuadros-en-relieve, articulos-de-temporada, decoracion
  nombre VARCHAR(60) NOT NULL,
  orden TINYINT NOT NULL DEFAULT 0
);

CREATE TABLE productos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  categoria VARCHAR(40) NOT NULL,
  descripcion VARCHAR(300) NOT NULL DEFAULT '',
  precio DECIMAL(10,2) NOT NULL,                 -- MXN
  precio_unidad VARCHAR(20) NULL,                -- "c/u", "el par"
  medidas VARCHAR(40) NULL,                      -- "22 x 26 cm"
  calificacion DECIMAL(2,1) NOT NULL DEFAULT 5,
  personalizable TINYINT(1) NOT NULL DEFAULT 1,
  visible TINYINT(1) NOT NULL DEFAULT 1,         -- 0 = no sale en el catálogo
  disponible TINYINT(1) NOT NULL DEFAULT 1,      -- 0 = sale como "Agotado"
  destacado TINYINT(1) NOT NULL DEFAULT 0,       -- "Lo más querido" del inicio
  orden INT NOT NULL DEFAULT 0,
  FOREIGN KEY (categoria) REFERENCES categorias(slug)
);

CREATE TABLE producto_materiales (
  producto_id INT NOT NULL,
  material ENUM('PLA','PETG') NOT NULL,
  PRIMARY KEY (producto_id, material),
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
);

CREATE TABLE producto_colores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT NOT NULL,
  nombre VARCHAR(40) NOT NULL,
  hex CHAR(7) NOT NULL,                          -- #RRGGBB
  filamento VARCHAR(80) NULL,
  disponible TINYINT(1) NOT NULL DEFAULT 1,
  orden TINYINT NOT NULL DEFAULT 0,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
);

CREATE TABLE producto_imagenes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT NOT NULL,
  color_id INT NULL,                             -- NULL = foto general del producto
  ruta VARCHAR(200) NOT NULL,                    -- assets/img/productos/... o /uploads/...
  ruta_grande VARCHAR(200) NULL,
  alt VARCHAR(160) NOT NULL DEFAULT '',
  ancho SMALLINT NOT NULL, alto SMALLINT NOT NULL,
  orden TINYINT NOT NULL DEFAULT 0,              -- la primera sin color es la imagen principal
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
  FOREIGN KEY (color_id) REFERENCES producto_colores(id) ON DELETE CASCADE
);

CREATE TABLE compras (
  numero INT AUTO_INCREMENT PRIMARY KEY,         -- el folio es 'MK-' + LPAD(numero, 4, '0'): MK-0001
  usuario_id INT NOT NULL,
  correo VARCHAR(120) NOT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total DECIMAL(10,2) NOT NULL,                  -- lo calcula el servidor
  estatus ENUM('pago-pendiente','pago-validado','en-produccion','enviado','entregado','cancelado') NOT NULL DEFAULT 'pago-pendiente',
  comprobante_ruta VARCHAR(200) NULL,
  comprobante_nombre VARCHAR(120) NULL,
  comprobante_tamano INT NULL,
  entrega_estimada DATE NULL,
  pago_validado DATETIME NULL,
  validado_por INT NULL,                         -- administrador que validó
  pago_rechazado DATETIME NULL,
  observacion_pago VARCHAR(300) NULL,            -- motivo cuando se rechaza el comprobante
  cancelada DATETIME NULL,
  motivo VARCHAR(300) NULL,                      -- motivo de cancelación
  archivada TINYINT(1) NOT NULL DEFAULT 0,       -- pasó al "Historial" del panel
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE compra_lineas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  compra_numero INT NOT NULL,
  producto_id INT NULL,                          -- SET NULL si luego se borra el producto
  nombre VARCHAR(80) NOT NULL,                   -- copia del nombre al momento de la compra
  color VARCHAR(40) NOT NULL DEFAULT '',
  material VARCHAR(10) NOT NULL DEFAULT 'PLA',
  cantidad SMALLINT NOT NULL,
  precio DECIMAL(10,2) NOT NULL,                 -- precio unitario al momento de la compra
  FOREIGN KEY (compra_numero) REFERENCES compras(numero) ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE SET NULL
);

CREATE TABLE solicitudes (
  numero INT AUTO_INCREMENT PRIMARY KEY,         -- el id es 'PC-' + LPAD(numero, 4, '0'): PC-0001
  usuario_id INT NOT NULL,
  correo VARCHAR(120) NOT NULL,
  creada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estatus ENUM('En revisión','Cotizado','Aceptado','Rechazado') NOT NULL DEFAULT 'En revisión',
  tipo_pedido VARCHAR(60) NOT NULL,              -- "Modificación de un producto del catálogo" | "Diseño nuevo"
  producto_id INT NULL, producto_nombre VARCHAR(80) NULL,
  categoria VARCHAR(40) NOT NULL,                -- slug o "otro"
  categoria_nombre VARCHAR(60) NOT NULL,
  colores JSON NOT NULL,                         -- ["Rojo","Otro: verde militar"]
  material VARCHAR(10) NOT NULL,
  tamano VARCHAR(60) NOT NULL,
  descripcion VARCHAR(1000) NOT NULL,
  texto VARCHAR(200) NOT NULL DEFAULT '',
  fecha_necesaria DATE NULL,
  cantidad SMALLINT NOT NULL,
  archivo3d_ruta VARCHAR(200) NULL, archivo3d_nombre VARCHAR(120) NULL, archivo3d_tamano INT NULL,
  archivo_estado ENUM('aprobado','rechazado') NULL,
  archivo_nota VARCHAR(300) NULL,
  cotizacion DECIMAL(10,2) NULL, notas_cotizacion VARCHAR(500) NULL, cotizada DATETIME NULL,
  aceptada DATETIME NULL,
  motivo_rechazo VARCHAR(300) NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE solicitud_referencias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  solicitud_numero INT NOT NULL,
  ruta VARCHAR(200) NOT NULL, nombre VARCHAR(120) NOT NULL, tamano INT NOT NULL,
  FOREIGN KEY (solicitud_numero) REFERENCES solicitudes(numero) ON DELETE CASCADE
);
```

Notas:

* **Folios:** la llave es el número autoincremental; el folio que ve la gente es `MK-` o `PC-` más ese número con 4 dígitos (`CONCAT('MK-', LPAD(numero, 4, '0')) AS folio`). Hoy el front los arma contando registros; el servidor debe usar el autoincremental (así dos compras al mismo tiempo no repiten folio). Los formularios y los enlaces usan el folio (`MK-0007`) y PHP lo convierte al número antes de consultar.
* **Carrito:** se recomienda **dejarlo en el navegador** (`makka_carrito`): es público (no pide sesión hasta "Continuar con mi compra") y solo guarda `{ id, color, material, cantidad }`. El servidor nunca confía en él: al crear la compra vuelve a leer precios y disponibilidad de la base.
* **Sesión:** va en la sesión del hosting (cookie), no en una tabla de datos.
* **Datos iniciales (seed):** las 8 categorías y los 20 productos de `assets/js/data/productos.js` (campo por campo: `precio`, `precioUnidad`, `medidas`, `materiales`, `colores[].imagenes`, etc.) más el primer administrador. Las fotos de producto ya están en `assets/img/productos/` y `.../colores/`: en la base solo se guarda la ruta.
* **Orden de los productos:** el front muestra "destacados" en el orden recibido; guarden `orden` o devuelvan los productos en el orden de `productos.js`.

## 4. Roles y permisos

| Rol | Puede |
|---|---|
| Sin sesión | Ver catálogo y producto, usar el carrito, registrarse, iniciar sesión, pedir enlace de contraseña (por WhatsApp) |
| `cliente` | Lo anterior + comprar, ver y cancelar **sus** compras, enviar y ver **sus** solicitudes personalizadas, editar su perfil |
| `empleado` | Hoy igual que cliente (puede comprar). Sus permisos del panel están **por definir** |
| `administrador` | Todo el panel (`dashboard.html` y `admin-*.html`). **No compra**: carrito, compras y solicitudes se rechazan (403) para este rol |

Reglas:

* Cada página `admin-*.php`, `dashboard.php` y cada `acciones/admin-*.php` revisa en el servidor que el rol sea `administrador` **antes de mostrar o hacer nada** (la pantalla solo oculta botones). Las páginas redirigen a `login.php`; las acciones responden 403.
* Un cliente solo puede leer o cambiar **sus** compras y solicitudes (comparar con el usuario de `$_SESSION`, nunca con un correo o id que mande el formulario).
* Siempre debe quedar **al menos un administrador** (error `ultimo-admin` al cambiar roles).
* El primer administrador se crea directo en la base de datos (ver sección 10).

## 5. Qué guarda hoy el navegador y a dónde va

| Clave en `localStorage` | Archivo | Qué es | En el backend |
|---|---|---|---|
| `makka_usuarios` | `services/auth.js` | Cuentas, con contraseña **sin cifrar** | Tabla `usuarios` |
| `makka_sesion` | `services/session.js` | Quién inició sesión | Sesión de PHP (`$_SESSION`) |
| `makka_reset` | `services/auth.js` | Enlaces para cambiar contraseña | Tabla `enlaces_contrasena` |
| `makka_carrito` | `services/cart.js` | Carrito | Se queda en el navegador; al comprar viaja en el formulario y PHP recalcula todo |
| `makka_compras` | `services/compras.js` | Pedidos y su estatus | `compras` + `compra_lineas` |
| `makka_solicitudes` | `services/solicitudes.js` | Pedidos personalizados | `solicitudes` + `solicitud_referencias` |
| `makka_productos` y `makka_productos_version` | `services/productos.js`, `services/api.js` | Cambios del administrador a los productos | `productos`, `producto_materiales`, `producto_colores`, `producto_imagenes` |
| `makka_pedido_borrador` (`sessionStorage`) | `pages/pedidos.js` | Borrador del formulario personalizado | Se queda igual (solo comodidad) |

## 6. Qué hace PHP en cada pantalla (sin API)

Hay solo dos mecanismos, y los dos son PHP normal:

**Leer.** Cada `.php` consulta la base con PDO y escribe el resultado dentro de la página. Con `JSON_HEX_*` para que ningún texto de la base pueda cerrar el `<script>`:

```php
<?php
require __DIR__ . '/includes/sesion.php';          // session_start() + $usuario + token CSRF + flash
requiere_rol('administrador');                      // si no cumple: header('Location: login.php'); exit;
$datos = ['compras' => compras_todas($pdo)];        // función propia que hace el SELECT
?>
<!-- ...HTML de la página... -->
<script>
  window.MAKKA = <?= json_encode(
      $datos + ['sesion' => sesion_publica(), 'csrf' => csrf_token(), 'flash' => flash_tomar()],
      JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
  ) ?>;
</script>
```

**Escribir.** Un formulario HTML normal apunta a `acciones/<algo>.php`. Cada acción hace siempre lo mismo, en este orden:

1. `session_start()`; aceptar solo `POST` (si no, 405); comprobar el token `csrf`.
2. Comprobar rol y dueño con `$_SESSION` (nunca con lo que mande el formulario).
3. Validar todos los campos (la pantalla ya valida por comodidad; PHP lo repite).
4. Ejecutar el SQL con PDO preparado, en una transacción si toca varias tablas.
5. Guardar el resultado en `$_SESSION['flash'] = ['ok' => true|false, 'error' => 'codigo']`.
6. `header('Location: <pantalla de origen>'); exit;`

El JavaScript de la página siguiente lee `window.MAKKA.flash` y muestra el aviso (toast) o el mensaje de error de ese código. Los códigos son los de las tablas de abajo.

### 6.1 Lo que PHP escribe en cada pantalla (`window.MAKKA`)

| Pantalla | Claves de `MAKKA` | Quién entra |
|---|---|---|
| Todas | `sesion` (`{ nombre, email, rol, avatar }` o `null`), `csrf`, `flash` | todos |
| `index`, `catalogo`, `producto`, `carrito`, `pedidos-personalizados` | `catalogo` = `{ categorias, productos }` solo con `visible = 1` (reemplaza a `data/productos.js`) | público |
| `confirmar-compra` | `catalogo` (para recalcular las líneas del carrito en pantalla) | cliente |
| `perfil` | `perfil` = `{ nombre, apellido, email, telefono, avatar }` | sesión |
| `restablecer-contrasena` | `tokenValido` (PHP revisa `?token=` al cargar) | público |
| `mis-compras` | `compras` y `solicitudes` **del usuario de la sesión** (`WHERE usuario_id = ?`) | cliente |
| `dashboard`, `admin-reporte` | `compras` y `solicitudes` (todas) o un resumen ya calculado (6.6) | administrador |
| `admin-pedidos` | `compras` (todas) | administrador |
| `admin-productos` | `productos` (todos, también los ocultos) y `categorias` | administrador |
| `admin-personalizados` | `solicitudes` (todas) | administrador |
| `admin-usuarios` | `usuarios` = `[{ nombre, apellido, email, telefono, rol, alta }]` (nunca la contraseña) | administrador |

### 6.2 Cuentas y sesión (`services/auth.js`, `services/session.js`)

| Acción (formulario) | Archivo en `acciones/` | Campos POST | Rol | Resultado y errores |
|---|---|---|---|---|
| Crear cuenta | `registro.php` | `nombre, apellido, email, telefono, password` (el rol siempre es `cliente`) | público | Crea la cuenta y manda a `login.php`; `correo-registrado` |
| Iniciar sesión | `login.php` | `email, password` | público | `session_regenerate_id(true)`; cliente a `index.php`, administrador a `dashboard.php`; `credenciales` o `bloqueado` |
| Cerrar sesión | `logout.php` | (solo `csrf`) | sesión | Destruye la sesión y manda a `index.php` |
| Guardar perfil | `perfil-guardar.php` | `nombre, apellido, telefono, avatar` (el correo **no** se edita) | sesión | Actualiza al usuario de la sesión |
| Cambiar contraseña | `perfil-clave.php` | `actual, nueva` (mínimo 8) | sesión | `clave-actual` |
| Generar enlace de contraseña | `enlace-contrasena.php` | `email` | **admin** | Invalida el enlace anterior de esa cuenta y deja el enlace en el aviso para que el administrador lo copie; `sin-cuenta` |
| Crear contraseña nueva | `restablecer.php` | `token, nueva` | público | Marca el enlace como usado; `token-invalido` |
| Cambiar rol | `usuario-rol.php` | `email, rol` | **admin** | `rol`, `sin-cuenta` o `ultimo-admin` |

Reglas de cuentas: correo único y en minúsculas, teléfono de 10 dígitos, contraseña mínimo 8, `password_hash()`/`password_verify()`, bloqueo por intentos fallidos (la pantalla de login ya muestra "Demasiados intentos fallidos. Intenta de nuevo en unos minutos" con `bloqueado`), mensaje igual para correo inexistente y contraseña mala. El token del enlace es aleatorio criptográfico (32+ caracteres), se guarda **con hash**, vence a las 24 horas y es de un solo uso; **nunca** se muestra a un cliente, solo al administrador que lo genera. Al restablecer conviene cerrar las demás sesiones de esa cuenta. El enlace que manda la tienda lleva el dominio real del sitio.

### 6.3 Catálogo y productos (`services/api.js`, `services/productos.js`)

Lectura: `MAKKA.catalogo` en las pantallas públicas y `MAKKA.productos` en `admin-productos`. `MakkaApi.getCatalogo()` sigue devolviendo una Promesa, ahora ya resuelta con lo que PHP escribió (`Promise.resolve(window.MAKKA.catalogo)`), así que las páginas públicas no cambian.

| Acción (formulario) | Archivo en `acciones/` | Campos POST | Rol | Resultado y errores |
|---|---|---|---|---|
| Guardar producto (nuevo o editar) | `producto-guardar.php` (`enctype="multipart/form-data"`) | `id` (vacío si es nuevo), `nombre, categoria, descripcion, precio, precioUnidad, visible, disponible, destacado`, `materiales[]`, `colores` (texto JSON que arma el JS del formulario), `imagenes[]` (archivos nuevos) y `imagenes_orden` (cuáles se conservan y en qué orden) | **admin** | `guardar` |
| Mostrar u ocultar | `producto-visible.php` | `id, visible` | **admin** | `no-existe` |
| Eliminar | `producto-eliminar.php` | `id` | **admin** | `no-existe` |

Formato de los datos (el mismo de `data/productos.js`; los campos opcionales se omiten si no aplican):

```json
{
  "categorias": [{ "slug": "llaveros", "nombre": "Llaveros" }],
  "productos": [{
    "id": 1, "nombre": "Llavero Dino", "categoria": "llaveros",
    "descripcion": "...", "precio": 50, "precioUnidad": "c/u",
    "calificacion": 4.5, "materiales": ["PLA"], "personalizable": true,
    "visible": true, "disponible": true, "destacado": false,
    "imagen": { "src": "assets/img/productos/llavero-dino.webp", "alt": "Llavero de dinosaurio amarillo", "ancho": 550, "alto": 592, "grande": "assets/img/productos/grandes/llavero-dino.webp" },
    "colores": [{
      "nombre": "Amarillo", "hex": "#F2D836", "filamento": "Bambu Lab PLA Lite Yellow", "disponible": true,
      "imagenes": [{ "src": "assets/img/productos/colores/llavero-dino-amarillo.webp", "alt": "Llavero de dinosaurio color amarillo", "ancho": 550, "alto": 592 }]
    }]
  }]
}
```

* `imagen` es la principal; `imagenes` (lista para el carrusel de la ficha), `colores` y `medidas` (texto como "22 x 26 cm", hoy en los cuatro cuadros) son opcionales. Solo los productos cuyos colores traen `imagenes` muestran el selector de color y son obligatorios al comprar.
* `disponible: false` se ve como "Agotado" (no se puede comprar); un color con `disponible: false` sale tachado.
* Un producto oculto o eliminado que esté en un carrito aparece como "ya no está disponible".
* Al **subir imágenes** desde el panel: validar tipo real (JPG, PNG o WebP) y tamaño (5 MB, máximo 6 por producto), convertir a WebP, renombrar con nombre único y guardar solo la ruta. Hoy el navegador las reduce a 800 px y las guarda como texto dentro del producto; eso se **quita** con PHP.
* Una **versión** del catálogo base (`MAKKA_DATA.version`) hace que el navegador descarte copias viejas; con la base de datos ya no se usa.
* La **calificación** es un número fijo (5 en productos nuevos); no hay tabla de reseñas.

### 6.4 Compras (`services/compras.js`)

Estatus: `pago-pendiente` -> `pago-validado` -> `en-produccion` -> `enviado` -> `entregado`, y `cancelado`. Detalle de transiciones en la sección 7.

| Acción (formulario) | Archivo en `acciones/` | Campos POST | Rol | Resultado y errores |
|---|---|---|---|---|
| Confirmar compra | `compra-crear.php` (multipart) | `lineas` (texto JSON `[{ id, color, material, cantidad }]` que el JS arma desde el carrito) y `comprobante` (archivo JPG/PNG, 5 MB) | cliente | Crea la compra y manda a `mis-compras.php?nueva=MK-0007`; ahí el JS vacía el carrito del navegador. **El total y los precios los calcula PHP** |
| Cancelar pedido | `compra-cancelar.php` | `folio, motivo` | cliente (dueño) | Solo en `pago-pendiente` o `pago-validado` |
| Validar pago | `admin-compra.php` | `accion=validar, folio, entrega` (fecha `AAAA-MM-DD`, opcional) | **admin** | `estatus`, `sin-comprobante`, `fecha`. Guarda quién y cuándo |
| Rechazar comprobante | `admin-compra.php` | `accion=rechazar, folio, observacion` | **admin** | `estatus`. Sigue en `pago-pendiente`; el cliente ve la observación |
| Cambiar estatus | `admin-compra.php` | `accion=estatus, folio, nuevo` | **admin** | `no-permitido` |
| Fecha de entrega | `admin-compra.php` | `accion=entrega, folio, fecha` | **admin** | `fecha`, `estatus` |
| Cancelar (administrador) | `admin-compra.php` | `accion=cancelar, folio, motivo` | **admin** | `no-permitido` |
| Archivar | `admin-compra.php` | `accion=archivar, folio` | **admin** | `no-permitido` |
| Ver comprobante | `descargar.php?tipo=comprobante&folio=MK-0007` | (enlace, no formulario) | **admin** o dueño | Entrega el archivo con su `Content-Type`; nunca hay una URL pública adivinable |

Cada compra llega a la pantalla con esta forma (los campos con `?` solo existen si ya pasó ese paso):

```json
{ "folio": "MK-0007", "fecha": "2026-11-02T18:30:00Z", "correo": "sofia@ejemplo.mx",
  "lineas": [{ "id": 1, "nombre": "Llavero Dino", "color": "Rosa", "material": "PLA", "cantidad": 2, "precio": 50 }],
  "total": 100, "estatus": "pago-validado", "comprobante": { "nombre": "comprobante.png", "tamano": 184320 },
  "entregaEstimada?": "2026-12-05", "pagoValidado?": "2026-11-03T10:00:00Z", "pagoRechazado?": "...", "observacionPago?": "...",
  "motivo?": "...", "cancelada?": "...", "archivada?": true }
```

### 6.5 Pedidos personalizados (`services/solicitudes.js`)

| Acción (formulario) | Archivo en `acciones/` | Campos POST | Rol | Resultado y errores |
|---|---|---|---|---|
| Enviar solicitud | `solicitud-crear.php` (multipart) | Los campos del formulario + `archivo3d` (`.stl`/`.obj`, 50 MB) + `referencias[]` (hasta 5 imágenes JPG/PNG, 5 MB) | cliente | Guarda con `id` "PC-0001" y `estatus` "En revisión" y manda a `mis-compras.php` |
| Aprobar archivo 3D | `admin-solicitud.php` | `accion=archivo-aprobar, id` | **admin** | `sin-archivo`, `estatus`, `no-existe` |
| Rechazar archivo 3D | `admin-solicitud.php` | `accion=archivo-rechazar, id, nota` | **admin** | igual que arriba |
| Enviar cotización | `admin-solicitud.php` | `accion=cotizar, id, precio, notas` | **admin** | `precio`, `archivo-rechazado`, `estatus`, `no-existe` |
| Marcar aceptada | `admin-solicitud.php` | `accion=aceptar, id` | **admin** | `estatus` |
| Rechazar solicitud | `admin-solicitud.php` | `accion=rechazar, id, motivo` | **admin** | `estatus` |
| Descargar archivo 3D | `descargar.php?tipo=modelo3d&id=PC-0004` | (enlace) | **admin** o dueño | Hoy el panel solo muestra nombre y tamaño; este enlace es nuevo |

Campos de una solicitud: `id`, `creada`, `estatus`, `correo`, `tipoPedido`, `producto { id, nombre }`, `categoria`, `categoriaNombre`, `colores[]`, `material`, `tamano`, `descripcion`, `texto`, `fechaNecesaria`, `cantidad`, `archivo3d { nombre, tamano }`, `imagenesReferencia [{ nombre, tamano }]`, y los que agrega el administrador: `archivoEstado` (`aprobado`/`rechazado`), `archivoNota`, `cotizacion`, `notasCotizacion`, `cotizada`, `aceptada`, `motivoRechazo`.

### 6.6 Panel: indicadores y reporte (`dashboard.js`, `admin-reporte.js`)

Hoy se calculan en el navegador con la lista completa de compras y solicitudes. Dos opciones, ambas sin API:

* **Simple:** PHP escribe las listas completas en `MAKKA.compras` y `MAKKA.solicitudes` y el JS sigue calculando y dibujando. Funciona con pocas ventas.
* **Recomendada a futuro:** `dashboard.php` calcula con SQL (`COUNT`/`SUM`) los cuatro indicadores y los escribe en `MAKKA.resumen`. En `admin-reporte.php` el formulario de filtros pasa a ser un `<form method="get">` (`?desde=AAAA-MM-DD&hasta=AAAA-MM-DD&categoria=slug`); PHP agrupa con SQL (totales, ventas por día o mes, por categoría y top 10) y escribe `MAKKA.reporte`; el JS solo dibuja las gráficas.

En ambos casos una **venta** es una compra con pago ya validado (`pago-validado`, `en-produccion`, `enviado`, `entregado`) y se fecha por `pago_validado`, no por la fecha de creación. Con una categoría elegida solo se cuentan las líneas de esa categoría (sin envío: es gratis).

## 7. Reglas de negocio que debe aplicar el servidor

**Compras**

| Acción | Se permite si el estatus es | Resultado |
|---|---|---|
| Crear compra | - | `pago-pendiente`; exige comprobante |
| Validar pago | `pago-pendiente` con comprobante | `pago-validado` (guarda fecha y administrador; fecha de entrega opcional `AAAA-MM-DD`) |
| Rechazar comprobante | `pago-pendiente` | Sigue `pago-pendiente`, con observación |
| Avanzar | `pago-validado` -> `en-produccion` -> `enviado` -> `entregado` | Nunca se regresa |
| Cancelar (cliente) | `pago-pendiente` o `pago-validado` | `cancelado` |
| Cancelar (administrador) | `pago-pendiente`, `pago-validado` o `en-produccion` | `cancelado` |
| Archivar | `entregado` o `cancelado` | `archivada = 1` (va a "Historial") |

Al **crear** la compra el servidor debe: leer precio, `visible`, `disponible` y colores de la base (ignorar `precio` y `total` del navegador), comprobar cantidad de 1 a 99, que el material exista en el producto, que haya color si el producto tiene colores con fotos y que ese color esté disponible, y guardar en `compra_lineas` el **nombre y precio de ese momento**. Un cambio de precio posterior no debe alterar compras viejas.

**Solicitudes**

* Estatus: `En revisión` -> `Cotizado` (se puede volver a cotizar mientras siga en `Cotizado`) -> `Aceptado`; y `En revisión` o `Cotizado` -> `Rechazado` con motivo.
* Aprobar o rechazar el archivo 3D solo en `En revisión` y si hay archivo. No se cotiza con el archivo rechazado. La cotización va de 0.01 a 100,000 MXN.
* "Aceptado" lo marca el administrador cuando el cliente confirma por WhatsApp (el botón "Aceptar cotización" en la cuenta del cliente está pendiente).

**Usuarios:** siempre al menos un administrador; el administrador no compra ni envía solicitudes.

## 8. Cómo conectar el front

### Paso a paso (en este orden)

1. **Base y datos iniciales:** crear el esquema (sección 3), cargar categorías y productos, crear el primer administrador (sección 10).
2. **`includes/`:** `config.php`, `db.php` (PDO con `PDO::ERRMODE_EXCEPTION`, `utf8mb4` y `ATTR_EMULATE_PREPARES => false`), `sesion.php` (inicia la sesión con las cookies seguras, expone el usuario, el token CSRF y el `flash`) y `roles.php` (`requiere_rol()`).
3. **Renombrar a `.php`:** cada `.html` pasa a `.php` y se cambian los enlaces (`rg "\.html"` encuentra los `href` del HTML y las cadenas del JS como `window.location.href = "login.html"`). Se puede sacar el encabezado, el pie y el menú del panel a `include`, pero no es obligatorio.
4. **Permisos reales:** las páginas del cliente y del panel empiezan con `requiere_rol(...)` **antes de imprimir cualquier HTML**. Así un visitante sin permiso ni siquiera recibe la pantalla; `role-guard.js` y `admin-shell.js` quedan solo para dibujar el menú.
5. **Catálogo (solo lectura):** escribir `MAKKA.catalogo` en las cinco pantallas públicas (6.1) y quitar `data/productos.js` de los HTML. Con eso ya funcionan Inicio, Catálogo, Detalle, Carrito y Pedidos personalizados.
6. **Cuentas y sesión:** `registro.php`, `login.php`, `logout.php`, perfil y contraseña (6.2). Ya con esto funcionan Login, Crear cuenta, Perfil y el menú de usuario.
7. **Compras:** `compra-crear.php`, `compra-cancelar.php` y luego `admin-compra.php`; después `descargar.php` para los comprobantes.
8. **Solicitudes personalizadas:** primero la del cliente, luego las del administrador.
9. **Panel de Productos, Usuarios y enlaces de contraseña.**
10. **Dashboard y Reporte** (6.6).
11. **Limpieza** (sección 11) y pruebas de aceptación (sección 12).

### Cómo cambian los servicios del front (y por qué no hay `async`)

Como los datos llegan **dentro de la página**, las funciones de lectura siguen devolviendo el resultado al instante, y las páginas **no necesitan `await`**. Lo único que cambia es de dónde leen y cómo escriben:

| Servicio | Lecturas (quedan síncronas) | Escrituras (se reemplazan por un formulario) |
|---|---|---|
| `MakkaSession` | `user()`, `isLoggedIn()`, `isAdmin()` leen `MAKKA.sesion` | `login()` y `logout()` -> `acciones/login.php` y `logout.php` |
| `MakkaAuth` | `getProfile()` -> `MAKKA.perfil`; `listUsers()` -> `MAKKA.usuarios`; `checkResetToken()` -> `MAKKA.tokenValido` | `register`, `updateProfile`, `changePassword`, `createResetLink`, `resetPassword`, `setRole` |
| `MakkaCompras` | `list()` -> `MAKKA.compras` | `create`, `cancel`, `validatePayment`, `rejectPayment`, `setStatus`, `setDelivery`, `cancelByAdmin`, `archive` |
| `MakkaSolicitudes` | `list()` -> `MAKKA.solicitudes` | `add`, `approveFile`, `rejectFile`, `quote`, `accept`, `reject` |
| `MakkaProductos` | `list()`, `get(id)` -> `MAKKA.productos` | `save`, `setVisible`, `remove` |
| `MakkaApi` | `getCatalogo()` sigue devolviendo una Promesa, ya resuelta con `MAKKA.catalogo` | - |
| `MakkaCart` | Sin cambios: el carrito se queda en el navegador | - |

Las escrituras que hoy están dentro de un `if (r.ok) { ... }` se cambian por un envío de formulario. Para no repetir código se recomienda un archivo pequeño `assets/js/services/form.js` (es un formulario oculto normal, no una llamada `fetch`):

```js
window.MakkaForm = {
  post: function (accion, campos) {
    var f = document.createElement("form");
    f.method = "post"; f.action = accion;
    campos = Object.assign({ csrf: window.MAKKA.csrf }, campos);
    Object.keys(campos).forEach(function (k) {
      var i = document.createElement("input");
      i.type = "hidden"; i.name = k; i.value = campos[k]; f.appendChild(i);
    });
    document.body.appendChild(f);
    f.submit();
  }
};
```

Ejemplo, "Validar pago" en `pages/admin-pedidos.js`:

```js
// Antes (localStorage): se ejecuta y se repinta al instante
var r = window.MakkaCompras.validatePayment(folio, fecha);
if (r.ok) { render(); } else { mostrarError(r.error); }

// Después (PHP): se manda el formulario; PHP guarda y regresa a la pantalla
MakkaForm.post("acciones/admin-compra.php", { accion: "validar", folio: folio, entrega: fecha });
// PHP termina con: header('Location: admin-pedidos.php?abrir=MK-0007');
```

Y al cargar la página (una sola vez, en el script de la pantalla) se muestra el resultado de la acción anterior:

```js
var flash = window.MAKKA.flash;           // { ok: false, error: "estatus" } o null
if (flash) { flash.ok ? toast("Listo") : mostrarError(MENSAJES[flash.error]); }
// ?abrir=MK-0007 en la URL: el JS abre el detalle de esa compra, como hoy tras guardar
```

Lo que cambia respecto a hoy: (1) el texto de cada código de error ya está escrito junto a cada llamada; pasa a un solo objeto `MENSAJES` que se usa al cargar la página; (2) el formulario que lleva **archivos** (comprobante, modelo 3D, imágenes de producto) es un `<form method="post" enctype="multipart/form-data">` real con `<input type="hidden" name="csrf" value="<?= csrf_token() ?>">`, no `MakkaForm`. Todo lo demás (filtros, carrito, carruseles, validaciones en pantalla, gráficas del reporte, enlaces `wa.me`) se queda igual.

**Dónde tocar:**

| Servicio | Páginas y componentes que lo usan |
|---|---|
| `MakkaAuth` | `login.js`, `registro.js`, `perfil.js`, `recuperar.js`, `restablecer.js`, `dashboard.js`, `admin-pedidos.js`, `admin-personalizados.js`, `admin-usuarios.js` |
| `MakkaSession` | `role-guard.js`, `user-menu.js`, `admin-shell.js`, `cart.js`, `login.js`, `registro.js`, `recuperar.js`, `perfil.js`, `carrito.js`, `producto.js`, `pedidos.js`, `confirmar.js`, `mis-compras.js`, `admin-usuarios.js` |
| `MakkaCompras` | `confirmar.js`, `mis-compras.js`, `admin-pedidos.js`, `admin-reporte.js`, `dashboard.js`, `admin-shell.js` (insignias del menú) |
| `MakkaSolicitudes` | `pedidos.js`, `mis-compras.js`, `admin-personalizados.js`, `dashboard.js`, `admin-shell.js` |
| `MakkaProductos` | `admin-productos.js`, `admin-reporte.js` |

Pruebas manuales más fáciles: iniciar sesión con cada rol, hacer una compra completa y validar el pago desde el panel.

### Sesión en el front

`MakkaSession` hoy guarda `{ nombre, email, rol, avatar }` en `localStorage`. Con PHP la fuente de verdad es `$_SESSION`: cada página escribe `MAKKA.sesion` y el resto del sitio lo lee al instante (menú, redirecciones). **No se debe confiar en `MAKKA.sesion` para permisos**: es solo para dibujar la pantalla; los permisos los decide PHP en cada página y cada acción.

## 9. Seguridad (checklist)

* [ ] HTTPS en todo el sitio y cookie de sesión `HttpOnly`, `Secure`, `SameSite=Lax`; regenerar el id de sesión al iniciar sesión.
* [ ] Contraseñas con `password_hash()` (bcrypt/argon2); nunca texto plano ni en logs.
* [ ] Bloqueo temporal por intentos fallidos de login y mensajes que no revelen si el correo existe.
* [ ] Todas las consultas SQL con parámetros (PDO preparado); nunca pegar texto del usuario dentro del SQL.
* [ ] Revisar **rol y dueño** en cada página y cada acción de PHP, no solo en la pantalla (administrador, cliente dueño de la compra o solicitud).
* [ ] Protección CSRF: todo formulario lleva el campo oculto `csrf` y cada acción lo compara con `hash_equals()`. Las acciones solo aceptan `POST`.
* [ ] Al escribir datos dentro de la página (`window.MAKKA`) usar `json_encode` con `JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT`, para que un nombre o descripción con `</script>` no rompa la página.
* [ ] Redirigir siempre después de un POST (nunca mostrar HTML directo) para evitar reenvíos del formulario.
* [ ] Validar en el servidor todo lo que ya valida la pantalla (correo, teléfono de 10 dígitos, contraseña, cantidades 1 a 99, precio positivo, fechas `AAAA-MM-DD`, longitudes máximas).
* [ ] Archivos subidos: validar tipo real (no solo la extensión), tamaño, renombrar, guardar fuera de la raíz pública y servirlos solo con permiso (comprobantes y modelos 3D son privados).
* [ ] El token de recuperación se guarda con hash, es de un solo uso y vence a las 24 horas.
* [ ] Limitar intentos por IP en login, registro y enlaces de contraseña.
* [ ] Credenciales de la base en un archivo fuera de la raíz pública, **nunca** en el repositorio ni en el JavaScript.
* [ ] Sin detalles internos en pantalla: `display_errors = Off`, los errores de PHP y SQL van a un log.
* [ ] Copias de seguridad de la base y de la carpeta de archivos.

El front ya escapa todo texto antes de pintarlo en pantalla; el servidor igual debe tratar cualquier campo como no confiable.

## 10. Primer administrador

Se crea directo en la base (el sitio no tiene registro de administradores):

```sql
INSERT INTO usuarios (nombre, apellido, email, telefono, clave_hash, rol, avatar)
VALUES ('Nombre', 'Apellido', 'correo@makkastudio.mx', '4440000000', '<password_hash de una contraseña segura>', 'administrador', 'zorro');
```

Los demás administradores se asignan desde el panel (Usuarios y roles). Mientras tanto, en las pruebas locales se usa la cuenta `admin@makka.studio` / `Admin1234` (solo existe porque `CREATE_DEMO_ADMIN` está en `true`).

## 11. Qué borrar antes de publicar (es solo para pruebas)

* `assets/js/services/demo-data.js` y su `<script>` en `dashboard.html` y en las cinco pantallas `admin-*.html`.
* Los botones "Cargar datos de ejemplo" (`id="demo-cargar"`) en `dashboard.html`, `admin-pedidos.html`, `admin-personalizados.html`, `admin-usuarios.html` y `admin-reporte.html`, y su código en los `.js` de cada página (`SHOW_DEMO_TOOLS` en `dashboard.js`).
* El botón "Restaurar catálogo de ejemplo" (`id="prod-reset"`) de `admin-productos.html` y su código en `admin-productos.js`.
* El bloque "Modo de prueba" de `recuperar-contrasena.html` (`rec-demo`) y `SHOW_DEMO_LINK` en `recuperar.js`.
* `CREATE_DEMO_ADMIN` y `ensureDemoAdmin()` en `auth.js` (ponerlo en `false` y luego borrarlo).
* `assets/js/data/productos.js` y su `<script>` en las páginas que lo cargan, cuando el catálogo ya venga de la base.
* Las cuentas de ejemplo con contraseña `Demo1234` (vienen de `demo-data.js`) y cualquier dato de prueba en la base.
* Todo lo que sea `localStorage` de datos (`makka_usuarios`, `makka_compras`, ...) en los servicios, excepto el carrito; las funciones de escritura de los servicios (se reemplazan por `MakkaForm` o formularios, sección 8).
* Los comentarios "provisional" y las menciones a `localStorage` en `services/` (se actualizan al reemplazar cada función).

**Para el cliente:** también deben confirmarse antes de publicar los datos reales: cuenta bancaria (`confirmar-compra.html`, bloque `<dl class="bank">`), número de WhatsApp (`WHATSAPP` en `recuperar.js` y los pies de página) y teléfono, correo e Instagram del pie.

## 12. Pruebas de aceptación (para dar por buena la conexión)

1. Registrarse, iniciar sesión, cerrar sesión; correo repetido muestra "correo ya registrado"; varios intentos fallidos seguidos bloquean un rato.
2. Cambiar nombre, teléfono y avatar en Perfil; cambiar contraseña con la actual.
3. Catálogo: oculto no aparece; "Agotado" no se puede comprar; el carrito conserva color y material.
4. Compra completa con comprobante: aparece en Mis compras como "Pago pendiente" y en Pedidos y pagos del panel; el total lo calcula el servidor (probar mandando un total falso: debe ignorarse).
5. Administrador: validar pago con fecha, avanzar hasta "Entregado", archivar. Intentar saltarse un paso o regresar debe fallar.
6. Cancelar como cliente en `pago-pendiente`; en `en-produccion` debe negarse.
7. Un cliente **no** puede ver ni cambiar compras o solicitudes de otro (probar cambiando el folio en la URL o en el formulario).
8. Un cliente **no** puede abrir `admin-*.php` (lo manda al login) ni mandar POST a `acciones/admin-*.php` (403); el administrador **no** puede comprar (403). Un `GET` a cualquier archivo de `acciones/` responde 405.
9. Solicitud personalizada con archivo `.stl` de 50 MB: aprobar, cotizar, aceptar; el cliente ve la cotización en Mis compras. Cotizar con el archivo rechazado debe fallar.
10. Cambiar el rol de un cliente a administrador y de vuelta; quitar al último administrador debe fallar.
11. Generar un enlace de contraseña (administrador), usarlo una vez, intentar usarlo otra vez y con uno vencido.
12. Reporte de ventas: los totales coinciden con la suma de las compras con pago validado del rango.

## 13. Decisiones abiertas (las define Makka Studio)

* Qué puede hacer el rol `empleado` en el panel.
* Si habrá reseñas (hoy `calificacion` es un número fijo; los productos nuevos llevan 5 estrellas).
* Si algún día los avisos al cliente se mandan solos (hoy son enlaces `wa.me` que manda una persona; automatizarlo requeriría la API de WhatsApp Business) y el botón "Aceptar cotización" desde la cuenta del cliente.
* **Licencia de los avatares:** las 16 ilustraciones salen de una hoja de stickers de terceros (autoría "无糖大列巴 / No Pirates"; ver `assets/img/avatars/CREDITOS.txt`). Antes de publicar hay que confirmar que se pueden usar comercialmente; si no, se reemplazan los 16 `.webp` conservando los nombres.
* Entrega: hoy es gratis en cinco puntos de San Luis Potosí (lista en `carrito.html`); si cambia, ajustar el texto y el resumen.

---

# Cómo está armado el front

## Estructura

```
index.html                  Inicio
catalogo.html               Catálogo
producto.html               Detalle de producto (producto.html?id=1)
carrito.html                Carrito
pedidos-personalizados.html Pedidos personalizados (formulario del cliente)
confirmar-compra.html       Confirmar compra (pago por transferencia y comprobante)
mis-compras.html            Mis compras (pedidos del cliente y su estatus)
perfil.html                 Mi perfil (datos personales, avatar y contraseña)
login.html                  Iniciar sesión
registro.html               Crear cuenta
recuperar-contrasena.html   Recuperar contraseña (pide el correo)
restablecer-contrasena.html Crear contraseña nueva (enlace que manda la tienda)
dashboard.html              Panel del administrador (Dashboard)
admin-pedidos.html          Panel: Pedidos y pagos
admin-productos.html        Panel: Productos
admin-personalizados.html   Panel: Solicitudes personalizadas
admin-usuarios.html         Panel: Usuarios y roles
admin-reporte.html          Panel: Reporte de ventas
assets/
  css/
    main.css                Importa base y componentes (se carga en todas las páginas)
    base/                   Variables, reset, tipografía y layout
    components/             Un archivo por componente reutilizable
    pages/                  Un archivo por página (inicio.css, catalogo.css, admin.css, ...)
  js/
    components/             Scripts compartidos: nav, toast, product-card, user-menu, avatar,
                            role-guard, admin-shell (menú y permiso del panel), admin-utils
    pages/                  Un archivo por página (inicio.js, catalogo.js, admin-pedidos.js, ...)
    data/                   Datos de ejemplo (productos.js, filamentos.js); se reemplazan por la base de datos
    services/               Acceso a datos, hoy provisional en localStorage (con PHP: lecturas de window.MAKKA, escrituras por formulario): api.js (catálogo), auth.js (cuentas),
                            session.js (sesión), cart.js (carrito), compras.js, solicitudes.js, productos.js (panel)
                            y demo-data.js (solo pruebas, se borra)
  img/
    brand/                  Logo, abeja y favicon
    icons/                  Íconos SVG de interfaz y de categorías
    avatars/                16 avatares de animalitos (WebP)
    patterns/               Fondos decorativos SVG
    productos/              Fotos de producto en WebP con fondo transparente (colores/ y grandes/)
```

## Cómo verlo

Abre `index.html` en el navegador. Mientras no exista el backend no necesita servidor ni instalar nada (todo se guarda en el navegador). Las fuentes (Fredoka y Poppins) se cargan desde Google Fonts: sin internet el sitio funciona igual, solo con otra letra.

## Convenciones

* Nombres de clase tipo BEM: `bloque`, `bloque__elemento`, `bloque--variante`.
* Colores, tipografías, radios y sombras viven en `assets/css/base/tokens.css`. No se escriben valores sueltos en otros archivos.
* Cada página nueva suma un `pages/<nombre>.css` y, si lo necesita, un `pages/<nombre>.js`.
* Las páginas de la raíz se enlazan entre sí con rutas relativas: `catalogo.html`, `login.html`, `registro.html`, `carrito.html`, `producto.html`, `pedidos-personalizados.html`.

## Puntos de enlace para backend

> **Importante:** la guía completa para conectar el hosting y la base de datos está al inicio de este archivo, en [Guía para el equipo de backend](#guía-para-el-equipo-de-backend). **No hay API.** En el resto del README, donde diga "servidor", "backend" o "reemplaza `función()`", léelo así: las **lecturas** vienen en `window.MAKKA` (PHP las escribe en la página) y las **escrituras** son formularios hacia `acciones/*.php` (secciones 6 y 8).

* Encabezado: bloque `.site-header__auth` (botones de sesión) y `.cart-btn` (el contador va en `.cart-btn__count`). Con sesión iniciada se reemplazan por el menú de perfil.
* Tarjeta de producto: `<article class="product-card">`, lista para repetirse con un ciclo. La calificación se pasa con la variable CSS `--rating` (de 0 a 5, admite decimales) en el atributo `style` de `.stars`.
* Categorías: se filtran con `catalogo.html?categoria=<slug>`. Slugs: `llaveros`, `clickers`, `aretes`, `separadores`, `figuras`, `cuadros-en-relieve`, `articulos-de-temporada`, `decoracion`.
* Contacto del pie de página: enlaces normales `tel:` y `mailto:` (en celular abren la llamada o el correo).
* "Lo más querido" de `index.html` se arma con `MakkaApi.getCatalogo()` (ver Productos), igual que el catálogo: al conectar la base solo hay que cambiar `getCatalogo()`.

# Documentación por pantalla

## Catálogo (`catalogo.html`)

* Cumple RF-03 del SRS: categorías, tarjetas con foto, descripción corta, precio base, colores disponibles y etiqueta "Personalizable", todo responsivo (4 columnas en escritorio, 3 en tableta, 2 en celular).
* Filtros: categoría, búsqueda por texto (sin acentos ni mayúsculas), rango de precio (botón "Aplicar"), material (PLA/PETG) y orden. Al abrir `catalogo.html?categoria=aretes` (por ejemplo desde el inicio) se aplica la categoría.
* "Cargar más" muestra 8 productos a la vez (`PAGE_SIZE` en `catalogo.js`).
* Estados: cargando (esqueletos), vacío y error con "Reintentar".
* Rendimiento (meta del SRS: 1.5 s): imágenes WebP con `width`/`height`, carga diferida desde la quinta tarjeta y solo se pintan las tarjetas visibles.
* Entradas del usuario validadas (precio numérico, mínimo menor o igual al máximo, búsqueda de máximo 80 caracteres) y todo texto se escapa antes de pintarse.

### Conectar el backend

PHP escribe `{ categorias, productos }` en `window.MAKKA.catalogo` (**solo productos visibles**, mismo formato de `assets/js/data/productos.js`) y `MakkaApi.getCatalogo()` (`services/api.js`) devuelve ese objeto. El formato completo, con ejemplo, está en la sección 6.3 de la [guía de backend](#guía-para-el-equipo-de-backend). Después se quita `data/productos.js` de los HTML.

### Imágenes de producto y base de datos

* Hoy están en `assets/img/productos/` (WebP, lado mayor de 560 px, fondo transparente) y cada producto las referencia en `imagen.src`.
* Según la arquitectura (IEEE 1471, capa Multimedia), las imágenes **no se guardan dentro de MySQL**: el servidor las guarda como archivos y la tabla de productos solo guarda la ruta o referencia (`imagen.src`), más `alt`, `ancho` y `alto`.
* Al subirlas desde el panel de administración: validar formato y tamaño, convertirlas a WebP, renombrarlas con un nombre único para no sobrescribir y guardar solo la ruta en la base (PHP la incluye en `MAKKA.catalogo`).
* `precioUnidad` es opcional: `"c/u"` para piezas que se venden por separado y `"el par"` para aretes. Se muestra junto al precio.

## Detalle de producto (`producto.html?id=<id>`)

* Cumple RF-03 y RF-02 (agregar al carrito): ruta de navegación, galería con miniaturas y flechas (deslizar en celular), nombre, estrellas, precio, descripción completa, material, selector de color, cantidad, disponibilidad, "Agregar al carrito", "Me gusta, lo quiero más personalizado" y "También te puede gustar".
* Mensajes: "Elige un color", "La cantidad debe ser mayor a 0", producto agotado y producto no encontrado.
* "Agregar al carrito" guarda en `localStorage` mediante `MakkaCart` (`services/cart.js`) y actualiza el globo del carrito en el encabezado. Cuando exista el backend, solo se cambian las funciones de `cart.js`.
* "Pedido personalizado" va a `pedidos-personalizados.html?producto=<id>` para precargar el producto.
* Colores: solo los productos con `colores` que traen `imagenes` (hoy Llavero Dino, Llavero Game Boy, Figura Nerds y Aretes Stanley) muestran el selector "Elige un color" y son obligatorios. Las demás piezas se venden en los colores de la foto: no llevan `colores`, no muestran círculos y la página ofrece "Pídela personalizada" para otros colores.
* Campos opcionales del producto en el JSON: `disponible` (false = agotado), `imagenes` (lista para el carrusel) y, por color, `disponible` (false = tachado) e `imagenes` (fotos de ese color; al elegirlo cambia la galería).
* `producto.php?id=1`: PHP puede escribir solo ese producto o todo el catálogo; hoy `producto.js` lo busca dentro del catálogo y no necesita cambios.

## Colores y fotos por color

* `assets/js/data/filamentos.js` es el inventario completo de filamentos (30 colores, 4 marcas). Lo usan Pedidos personalizados (selector de colores) y el formulario de Productos del panel. Con backend puede quedarse como archivo o pasar a una tabla.
* Los llaveros **Dino** (10 colores) y **Game Boy** (8), la **Figura Nerds** (6) y los **Aretes Stanley** (9) tienen una foto por color en `assets/img/productos/colores/`. Esas fotos se generaron recoloreando la foto original con el HEX del filamento (solo cambia la pieza impresa; argollas y detalles se quedan igual). Son una vista previa: cuando haya fotos reales de cada color, solo se reemplaza el archivo.
* En `productos.js`, cada color lleva `filamento` (marca, material y nombre del filamento) y `imagenes` (la foto que se muestra al elegirlo).
* Las fotos de los colores se precargan cuando el usuario se acerca a los círculos de color, para que el cambio sea inmediato.

## Carrito (`carrito.html`)

* Cumple RF-02 (ver carrito, cambiar cantidad, quitar y ver el total). Cada fila muestra foto (de su color), nombre, material, color, cantidad (− / +), precio, subtotal y bote de basura.
* El resumen muestra Subtotal, Envío "Gratis" y Total. La entrega es gratis en cinco puntos de San Luis Potosí (Universidad Politécnica, HEB de Carretera 57, Plaza The Park, Plaza San Luis y Walmart San Remo). Makka Studio escribe al cliente para confirmar el pedido y acordar horario y punto. Los puntos están en `carrito.html` (lista `.delivery__list`).
* El carrito es público: pedir sesión sucede en "Continuar con mi compra". Sin sesión lleva a `login.html?siguiente=confirmar-compra.html`; con sesión, a `confirmar-compra.html`. La sesión es provisional: `isLoggedIn()` en `carrito.js` revisa `localStorage.makka_sesion` y se cambia cuando exista el login real.
* Los precios no se guardan en el carrito: se leen del catálogo (`MakkaApi.getCatalogo()`), así que siempre están actualizados. Si un producto ya no existe o `disponible === false`, la fila dice "Este producto ya no está disponible", no suma al total y bloquea "Continuar" hasta quitarla.
* Mensajes: "La cantidad debe ser mayor a 0", carrito vacío, error de carga.
* `cart.js` ahora incluye `setQuantity()`, `remove()` y `clear()`. Los estilos de la cantidad (`.qty`) pasaron a `components/qty.css` porque los comparten Detalle y Carrito.

## Pedidos personalizados (`pedidos-personalizados.html`)

* Cumple RF-04 (solicitud de pedido personalizado). Formulario en 3 bloques: Tu idea, Cómo lo quieres y Cuéntanos más. Campos obligatorios (SRS): tipo de producto, color, tamaño, diseño y cantidad; el resto es opcional.
* "¿Qué quieres pedir?": modificación de un producto del catálogo (con buscador que autocompleta; teclado y lector de pantalla incluidos) o diseño nuevo. Si vienes de "Me gusta, lo quiero más personalizado" llega con `?producto=<id>`: el producto, su categoría y su material ya vienen precargados.
* Los colores salen del inventario real (`data/filamentos.js`, 26 colores sin repetir nombre) y se pueden elegir varios, más "Otro color" con texto libre.
* Archivo 3D: `.STL` u `.OBJ`, máx. 50 MB. Imágenes de referencia: JPG o PNG, hasta 5 de máx. 5 MB (los límites están en las constantes `MAX_MODEL`, `MAX_IMAGE`, `MAX_REFS` de `pages/pedidos.js`). Se puede arrastrar y soltar. Sobre el campo hay un aviso: si el cliente no tiene el modelo 3D, Makka Studio lo realiza con un costo extra (texto en `#aviso-modelo`).
* Mensajes: "Completa los campos obligatorios", un mensaje bajo cada campo, "Archivo no compatible. Sube un .STL u .OBJ de hasta 50 MB." y éxito "¡Solicitud enviada! ... Estatus: En revisión".
* Sin sesión el cliente puede llenar el formulario, pero al enviar se le pide iniciar sesión (el borrador de texto se guarda en `sessionStorage`; los archivos no). La sesión es provisional (`services/session.js`, `MakkaSession.isLoggedIn()`); al conectar RF-01 solo se cambia ese archivo.
* El selector "Tipo de producto" lista las categorías del catálogo y al final la opción **Otro** (`OTHER_CATEGORY` en `pedidos.js`, slug `otro`) para lo que no encaja en ninguna; la solicitud guarda `categoria` (slug) y `categoriaNombre` (texto legible, que es lo que ve el cliente en Mis compras).
* La solicitud se guarda en `localStorage` con `services/solicitudes.js` (`add()`, `list()`); el backend debe conservar esa interfaz. Los archivos NO se guardan: solo su nombre y tamaño. Estatus: En revisión, Cotizado, Aceptado, Rechazado.
* Se creó `components/form.css` (campos de formulario compartidos) y `components/color-pick.css` (selector de color, antes dentro de `producto.css`) para reutilizarlos en Login y Crear cuenta.

## Iniciar sesión y Crear cuenta (`login.html`, `registro.html`)

Ambas páginas comparten `assets/css/pages/auth.css` y el servicio `services/auth.js`. Fondo de cuadros crema y amarillo suave, el mismo del inicio (solo CSS, sin imágenes) y la abeja de la marca con un vaivén suave (se desactiva con `prefers-reduced-motion`).

* **Login.** Correo y contraseña (mensajes: "Ingresa un correo válido", "Ingresa tu contraseña", "Correo o contraseña incorrectos", "Demasiados intentos fallidos..."). Con sesión ya iniciada muestra "Ya tienes la sesión iniciada" y permite cerrar sesión. Acepta `?siguiente=<pagina>.html` (solo páginas internas) para volver ahí después; si el rol es `administrador` va a `dashboard.html`. `?aviso=expiro` muestra "Tu sesión expiró".
* **Crear cuenta.** Nombre, apellido, correo, teléfono (10 dígitos), contraseña (mínimo 8) y confirmación. No se pide dirección; esa información se pedirá solo cuando se necesite (por ejemplo, al confirmar una compra). Al terminar muestra "¡Tu cuenta se creó con éxito!" y lleva a iniciar sesión, conservando `?siguiente`.
* **Menú de usuario.** `user-menu.js` reemplaza los botones del encabezado (`.site-header__auth`) por "Hola, " con Mi perfil, Mis compras y Cerrar sesión cuando hay sesión.

### Conectar el backend (RF-01)

`services/auth.js` guarda las cuentas en `localStorage` **solo para diseño y pruebas** (la contraseña se guarda sin cifrar: no uses contraseñas reales). Reemplaza estas funciones manteniendo la forma de la respuesta:

* `MakkaAuth.register(datos)` → `{ ok: true }` o `{ ok: false, error: "correo-registrado" }`.
* `MakkaAuth.login(correo, contraseña)` → `{ ok: true, usuario: { nombre, email, rol } }` o `{ ok: false, error: "credenciales" | "bloqueado" }`. Son funciones normales (no promesas) para mantenerlo simple.
* `MakkaAuth.getProfile(correo)` → `{ nombre, apellido, email, telefono, avatar }`; `updateProfile(correo, { nombre, apellido, telefono, avatar })` → `{ ok, usuario }`; `changePassword(correo, actual, nueva)` → `{ ok: true }` o `{ ok: false, error: "clave-actual" }`.
* `services/session.js`: `isLoggedIn()` y `user()` deben consultar la sesión real (cookie o token).
* El backend debe aplicar sus propias validaciones, el bloqueo por intentos fallidos y guardar la contraseña con `password_hash` (bcrypt/argon2).

## Confirmar compra (`confirmar-compra.html`)

* Se llega desde "Continuar con mi compra" del carrito. Sin sesión pide iniciar sesión o crear cuenta; con el carrito vacío lo avisa.
* Muestra tres pasos (informativos): Resumen, Transfiere y Sube tu comprobante. El resumen es de solo lectura y los precios se leen del catálogo, igual que en el carrito.
* **Datos de la cuenta bancaria:** están en `confirmar-compra.html`, bloque `<dl class="bank">` (banco, titular y CLABE). Para cambiar de cuenta, edita solo esos tres textos.
* **Cómo verla sin backend:** crea una cuenta de prueba en `registro.html` (se guarda solo en tu navegador), inicia sesión, agrega un producto al carrito y pulsa "Continuar con mi compra".
* Comprobante: una imagen JPG o PNG de máximo 5 MB (`MAX_BYTES` en `confirmar.js`). "Enviar comprobante" se activa solo cuando hay un archivo válido.
* Al enviar, `services/compras.js` guarda la compra en `localStorage` con folio `MK-0001`, estatus `pago-pendiente` y solo el nombre y tamaño del comprobante (el archivo real lo recibirá el servidor). Después vacía el carrito y muestra "¡Recibimos tu comprobante!".
* Backend (RF-04): reemplaza `create()` y `list()` de `compras.js` manteniendo lo que devuelven. Esas compras se ven en `mis-compras.html`.
* Estilos: `assets/css/pages/confirmar.css`. La zona de carga de archivos es un componente reutilizable (`components/drop.css`), compartido con Pedidos personalizados.

## Mis compras (`mis-compras.html`)

* Requiere sesión (sin ella ofrece iniciar sesión o crear cuenta). Muestra solo los pedidos del correo con sesión iniciada.
* Pestañas **Actuales** e **Historial** (entregados, cancelados y rechazados). Cada tarjeta trae folio, fecha, piezas, total, estatus de color y un "Ver detalle" desplegable (HTML nativo `<details>`, sin JavaScript).
* Junta dos listas: las compras (`services/compras.js`) y las solicitudes de pedidos personalizados (`services/solicitudes.js`, que ahora guardan el `correo` de quien las envía). Una solicitud cotizada muestra "Cotización lista" si trae el campo `cotizacion` (lo agregará el administrador).
* **Entrega estimada:** cada tarjeta la muestra. Con el pago pendiente dice "te confirmaremos la fecha cuando validemos tu pago". El administrador/backend agrega `entregaEstimada` (formato `AAAA-MM-DD`) a la compra al validar el pago; entonces se muestra la fecha. Si ya se validó el pago pero aún no hay fecha, dice "por confirmar". No se muestra en pedidos entregados ni cancelados. No se inventan días de entrega: la fecha la define Makka Studio.
* **Cancelar pedido:** solo si el estatus es `pago-pendiente` o `pago-validado` (lista `CANCELABLES` en `compras.js`). En `en-produccion` o `enviado` el botón sale deshabilitado con el aviso. Abre un cuadro de confirmación (`<dialog>` nativo) con motivo opcional; el servidor debe validar la misma regla.
* Estatus y colores: textos en `STATUS` de `mis-compras.js` y colores en los bloques `.status--...` de `mis-compras.css`.
* Pendiente (necesita backend o administrador): "Subir comprobante" desde esta pantalla y "Aceptar / Rechazar cotización".
* **Cómo ver otros estatus sin administrador:** en el navegador abre F12, Console, y ejecuta (cambia el estatus por `pago-validado`, `en-produccion`, `enviado` o `entregado`):
  `var c = JSON.parse(localStorage.makka_compras); c[0].estatus = "pago-validado"; c[0].entregaEstimada = "2026-12-05"; localStorage.makka_compras = JSON.stringify(c);`
  y recarga la página.

## Mi perfil (`perfil.html`)

* Requiere sesión (sin ella ofrece iniciar sesión o crear cuenta). Se llega desde "Mi perfil" del menú del encabezado.
* **Avatar:** 16 animalitos (imágenes en `assets/img/avatars/`, lista en `components/avatar.js`). La primera vez se asigna uno al azar y se guarda; también se reasigna si la cuenta tenía un avatar viejo (emoji) que ya no existe. "Cambiar avatar" abre el selector y guarda al elegir. El avatar aparece en el menú del encabezado, en Perfil y en el panel del administrador. **En la cuenta solo se guarda el id** (por ejemplo `zorro`, columna `avatar` de la tabla de usuarios); la imagen sale siempre de `MakkaAvatar.src(id)`, así que en la base de datos no se guardan rutas ni imágenes. Si el valor guardado no es válido (vacío o de otra versión), se muestra la inicial del nombre. Para agregar uno: sube su imagen a `assets/img/avatars/` y súmalo a `LIST`. Las ilustraciones salen de una hoja de stickers que nos pasaron (autoría "无糖大列巴 / No Pirates", acreditada en Perfil y en `assets/img/avatars/CREDITOS.txt`; dar crédito no sustituye el permiso): antes de publicar el sitio hay que confirmar que podemos usarlas comercialmente; si no, basta reemplazar los 16 `.webp` conservando los nombres.
* **Mis datos:** se ve en modo lectura; "Editar datos" muestra el formulario de nombre, apellido y teléfono (10 dígitos). "Cancelar" descarta los cambios. Mensajes: "Tus datos se actualizaron correctamente" y "Revisa el formato de los datos ingresados".
* **El correo no se edita:** identifica la cuenta y sus pedidos (compras y solicitudes se filtran por correo). Cuando exista backend con ID de usuario se podrá habilitar: quita `readonly` del campo `pf-correo`, agrégalo a `updateProfile` y pide la confirmación del nuevo correo.
* **No se pide dirección:** no se recolecta en ninguna otra pantalla (el envío se acuerda con la tienda).
* **Seguridad:** contraseña actual, nueva (mínimo 8) y confirmación, cada una con ojo para mostrar u ocultar. La nueva debe ser distinta a la actual.
* **Cerrar sesión:** borra la sesión y regresa a `index.html`.
* Backend: reemplaza `getProfile`, `updateProfile` y `changePassword` de `auth.js` (el servidor debe validar todo y pedir la contraseña actual). Estilos: `assets/css/pages/perfil.css`. Los estilos del campo de contraseña pasaron a `components/password.css`.

## Recuperar contraseña (`recuperar-contrasena.html`)

* **No se envían correos.** Se llega desde "¿Olvidaste tu contraseña?" del login. El cliente escribe el correo de su cuenta y el botón "Pedir enlace por WhatsApp" abre WhatsApp con el mensaje ya escrito (número en `WHATSAPP` de `recuperar.js`, formato `524444482898`). Después muestra cómo contactar a la tienda por teléfono o Instagram si no se abrió.
* La tienda verifica quién es la persona (teléfono registrado o folio de un pedido), genera el enlace y lo manda por WhatsApp. El enlace de un solo uso vence a las 24 horas.
* `MakkaAuth.createResetLink(correo)` crea el enlace. El backend debe permitirlo **solo al administrador**, guardar el token con hash y no devolverlo nunca a un cliente.
* Si ya hay sesión, la página ofrece ir a Mi perfil (ahí se cambia la contraseña con la actual).
* El recuadro "Modo de prueba" simula el enlace que mandaría la tienda, para poder probar sin Dashboard. Lo controla `SHOW_DEMO_LINK` en `recuperar.js`; con backend ponlo en `false` y quita el bloque `rec-demo` del HTML.
* La tienda genera el enlace desde el Dashboard, en la tarjeta "Ayuda con contraseñas".
* Los avisos al cliente (pago validado, fecha de entrega, cotización) también son por WhatsApp, no por correo.

## Restablecer contraseña (`restablecer-contrasena.html`)

* Es la pantalla a la que lleva el enlace que manda la tienda por WhatsApp. Valida el token con `MakkaAuth.checkResetToken(token)`; si no existe, ya se usó o venció, muestra "Este enlace no es válido o ya venció" y un botón para pedir otro.
* Con enlace válido pide contraseña nueva y confirmación (mínimo 8, con ojo). Al guardar usa `MakkaAuth.resetPassword(token, nueva)`, invalida el token y muestra "Tu contraseña se actualizó correctamente" con botón a iniciar sesión.
* Generar un enlace nuevo invalida el anterior.
* Cómo probarlo: `registro.html` (crea una cuenta), `recuperar-contrasena.html` (escribe ese correo y pulsa "Pedir enlace por WhatsApp"), "Abrir enlace de prueba", cambia la contraseña e inicia sesión con la nueva.

## Panel del administrador (`dashboard.html`)

* **Cómo entrar sin backend:** en `login.html` usa la cuenta de prueba `admin@makka.studio` / `Admin1234`. El login manda a `dashboard.html` cuando el rol es `administrador`. Esa cuenta la crea `ensureDemoAdmin()` en `auth.js`; con backend pon `CREATE_DEMO_ADMIN` en `false`.
* **Permiso:** sin sesión muestra "Inicia sesión para entrar al panel"; con una cuenta de cliente, "No tienes permiso para ver esta página". Esto solo cuida la pantalla (`components/admin-shell.js`): el backend debe comprobar el rol administrador en cada petición.
* **Estructura reutilizable:** `admin-shell.js` (permiso, menú lateral, menú de la persona) y `assets/css/pages/admin.css`. Las pantallas del panel (`admin-*.html`) comparten `components/admin-utils.js` (fechas, dinero, WhatsApp, diálogo de confirmación). Una pantalla nueva copia `admin-pedidos.html`: cambian `data-admin`, `data-page-file` y el contenido de `<main>`.
* **Barra lateral:** se arma sola desde la lista `ITEMS` de `admin-shell.js` (ícono SVG de `assets/img/icons/`, nombre y destino). Las seis pantallas ya están activas (si agregas otra, ponle su `href`; con `null` se ve apagada con un reloj). "Pedidos y pagos" y "Pedidos personalizados" muestran una insignia con lo que está por atender. Los íconos son SVG, sin emojis.
* **Avatar:** el del perfil del administrador sale arriba a la derecha y en el saludo (imagen de `assets/img/avatars/`); sin avatar válido se muestra la inicial. Los íconos del panel son SVG.
* **Ancho:** el contenido ocupa todo el ancho disponible (tope de 120rem en pantallas enormes).
* **Indicadores** (calculados con `compras.js` y `solicitudes.js`, funciones en `dashboard.js`): Pagos por validar = compras `pago-pendiente`; Pedidos en producción = `en-produccion`; Solicitudes nuevas = solicitudes "En revisión"; Ventas del mes = suma de compras del mes en estatus `pago-validado`, `en-produccion`, `enviado` o `entregado` (lista `SOLD`). El backend debe calcularlos con la fecha de validación del pago.
* **Últimos pedidos:** las 5 compras más recientes (folio, cliente, total, estatus). El nombre sale de `MakkaAuth.listUsers()`; si no hay cuenta, muestra el correo. En celular la tabla se convierte en tarjetas.
* **Datos de ejemplo:** con el panel vacío aparece "Cargar datos de ejemplo" (`SHOW_DEMO_TOOLS` en `dashboard.js`; con backend ponlo en `false` y quita el botón). Para borrarlos: F12, Console, `localStorage.removeItem("makka_compras"); localStorage.removeItem("makka_solicitudes");` y recarga.
* **Ayuda con contraseñas:** escribe el correo del cliente y "Generar enlace" crea el enlace de `restablecer-contrasena.html` (24 horas, un solo uso, con `MakkaAuth.createResetLink`). Se puede copiar o mandar por WhatsApp al teléfono de la cuenta. Antes de mandarlo, confirma que es la persona.
* **Cambios compartidos:** estilos de estatus ahora en `components/status.css`, avatar en `components/avatar.css`, y `MakkaAuth.listUsers()` (sin contraseñas). También se corrigió el aviso de "Cambiamos tu avatar" en Perfil, que no mostraba el texto.

## Pedidos y pagos (`admin-pedidos.html`)

* **Pestañas** (brief): Todos, Validar pago, En producción (incluye `pago-validado`), Enviados, Entregados e Historial (archivados y cancelados). "Todos" no incluye lo archivado. Se puede abrir una pestaña con `?tab=pagos`, `produccion`, `enviados`, `entregados` o `historial`. Buscador por folio, nombre o correo.
* **Lista + detalle:** la tabla está a la izquierda y el detalle del pedido a la derecha (debajo en celular): cliente, piezas, total, comprobante, avance (Pago, Producción, Enviado, Entregado) y acciones según el estatus.
* **Acciones** (`compras.js`): validar pago con fecha estimada de entrega (`validatePayment`), rechazar con observación (`rejectPayment`; el pedido sigue en pago pendiente y el cliente ve la observación en Mis compras), avanzar estatus (`setStatus`: pago validado -> en producción -> enviado -> entregado, sin regresar), cambiar la fecha estimada (`setDelivery`), cancelar (`cancelByAdmin`, hasta en producción) y mover al historial (`archive`, solo entregados o cancelados).
* **Avisos al cliente:** por WhatsApp (botón "Avisar por WhatsApp" con mensaje según el estatus), solo si la cuenta tiene teléfono de 10 dígitos. No se manda correo.
* **Comprobante:** hoy solo se guarda nombre y tamaño; cuando exista el backend, aquí debe verse la imagen o PDF real.
* **Backend:** las reglas de `compras.js` y los permisos de esta pantalla son comodidad de la interfaz. El servidor debe exigir rol administrador y validar cada transición, y registrar quién validó el pago y cuándo.
* **Datos de ejemplo:** `services/demo-data.js` (20 pedidos de los últimos 70 días en todos los estatus, 6 solicitudes y 5 cuentas) se carga con "Cargar datos de ejemplo" cuando la pantalla no tiene datos; nunca borra lo que ya exista. Las cuentas de ejemplo usan la contraseña `Demo1234`. Con backend, quita ese archivo y los botones.

## Productos (`admin-productos.html`)

* **Tabla:** imagen, nombre, categoría, precio, colores, material, estado (Visible/Oculto, y "Agotado" si no está disponible) y acciones Editar, Ocultar o Mostrar, Eliminar. Buscador, filtro de categoría, filtro de estado y "Mostrar más" (10 por vez).
* **Formulario** (ventana "Agregar producto" / "Editar producto"): nombre, categoría, mini descripción, material (PLA y/o PETG), precio, unidad del precio (opcional, "el par", "c/u"), imágenes (carga múltiple, vista previa, orden con flechas, máximo 6; la primera es la principal), colores del inventario de filamentos (`data/filamentos.js`, con nombre editable e imagen por color), interruptores "Disponible" y "Visible en catálogo".
* **Mensajes del brief:** "Completa los campos obligatorios", "Formato no compatible", "La imagen supera el tamaño permitido" (JPG, PNG o WebP de hasta 5 MB), "Este producto dejará de verse en el catálogo. ¿Continuar?" y "Producto actualizado. Ya se ve en el catálogo."
* **Destacados del inicio:** "Lo más querido" ya no está escrito a mano en `index.html`: `pages/inicio.js` lo arma con `MakkaApi.getCatalogo()`. Muestra primero los productos con `destacado: true` (interruptor "Destacado en el inicio" del formulario) y completa hasta 4 con los siguientes visibles. Ocultar un producto lo quita también del inicio. Con backend: el catálogo devuelve solo productos visibles y el inicio pide los 4 destacados.
* **Cómo llega al catálogo:** `services/productos.js` guarda la lista en `localStorage` (`makka_productos`); `services/api.js` la usa y solo manda al catálogo los productos con `visible` distinto de `false`. Un producto oculto o eliminado que esté en un carrito aparece como "ya no está disponible". `disponible: false` muestra "Agotado".
* **Imágenes:** en el navegador se reducen a 800 px y se guardan dentro del producto (se llena el almacenamiento rápido). El backend debe validar formato y tamaño, convertir a WebP, renombrar y guardar solo la ruta. El botón "Restaurar catálogo de ejemplo" borra los cambios (solo pruebas).
* **Calificación:** los productos nuevos llevan 5 estrellas (ningún documento define si habrá reseñas).
* Desde el Dashboard, "Agregar producto" abre esta pantalla con el formulario listo (`?nuevo=1`).

## Solicitudes personalizadas (`admin-personalizados.html`)

* **Pestañas:** Todas, En revisión, Cotizadas, Aceptadas y Rechazadas (`?tab=revision`, `cotizadas`, `aceptadas`, `rechazadas`). Tabla: número, cliente, tipo de producto, fecha, archivo y estatus; buscador por número, nombre o correo.
* **Detalle:** todo lo que llenó el cliente, archivo 3D con "Aprobar archivo" y "Rechazar archivo" (mensaje "El archivo no se puede abrir. Pídele al cliente otro formato."), cotización con "Precio cotizado (MXN)", "Notas para el cliente" y "Enviar cotización".
* **Reglas** (`services/solicitudes.js`): En revisión -> Cotizado (se puede volver a cotizar), Cotizado -> Aceptado ("El cliente aceptó", cuando confirma por WhatsApp), y En revisión o Cotizado -> Rechazado con motivo. No se cotiza con el archivo rechazado.
* **Cliente:** en Mis compras ve el monto y las notas de la cotización, y si el archivo se rechazó o la solicitud se descartó, el motivo. Aviso por WhatsApp con mensaje según el estatus. No se manda correo.
* **Archivo 3D:** solo se guarda su nombre y tamaño; la descarga estará disponible cuando exista el servidor. "Aceptar cotización" desde la cuenta del cliente sigue pendiente (hoy lo marca el administrador).

## Usuarios y roles (`admin-usuarios.html`)

* **Tabla:** nombre, correo, teléfono, rol (Cliente, Empleado, Administrador), fecha de alta y "Cambiar rol". Buscador por nombre o correo, filtro por rol y resumen de cuentas.
* **Cambiar rol:** ventana "Cambiar rol de [Nombre]" con "Guardar" y "Cancelar" y la advertencia "No puedes quitarte tus propios permisos sin asignar antes a otro administrador." Éxito: "Los permisos se actualizaron."
* **Regla** (`MakkaAuth.setRole`): siempre debe quedar al menos un administrador. Si el administrador se quita su propio rol (habiendo otro), se le pide confirmar y sale del panel.
* **Empleado:** por ahora solo el rol `administrador` entra al panel; qué puede hacer un empleado se define después. El backend debe permitir cambiar roles solo a administradores y registrar quién lo hizo.

## Reporte de ventas (`admin-reporte.html`)

* **Filtros:** rango de fechas (por defecto, últimos 30 días) y categoría; botón "Aplicar".
* **Indicadores:** Ventas totales, Pedidos completados (entregados), Ticket promedio y Producto más vendido (por piezas). Cuentan como venta las compras con pago ya validado; con una categoría elegida solo se cuentan las piezas de esa categoría.
* **Gráficas** (SVG propio, sin internet): ventas por día (o por mes si el rango pasa de 62 días) y ventas por categoría con barras y porcentaje. Tabla "Productos más vendidos" (top 10).
* **Vacío:** tarjeta "Sin ventas en estas fechas" con el botón "Ver últimos 30 días".
* **Exportar PDF:** abre la impresión del navegador con una vista limpia (Guardar como PDF). Con backend se puede generar un PDF real en el servidor.
* **Backend:** debe calcular el reporte con la fecha de validación del pago.

## Administrador dentro de la tienda

* **Regla:** el rol `administrador` no compra. No tiene carrito, "Mis compras", pedidos personalizados ni confirmar compra. Para probar compras usa una cuenta de cliente (con los datos de ejemplo: `sofia@ejemplo.mx` / `Demo1234`).
* **Cómo regresar al panel:** en toda página de la tienda el administrador ve una barra "Estás viendo la tienda como administrador" con el botón "Volver al panel", y su menú de usuario trae "Ir al panel" (sin "Mis compras"). El panel también trae "Ver tienda".
* **Qué cambia en la tienda:** se oculta el botón del carrito; `carrito.html`, `confirmar-compra.html`, `mis-compras.html` y `pedidos-personalizados.html` (marcadas con `<body data-buyers-only>`) lo mandan de vuelta a `dashboard.html`; en la ficha de producto no hay "Agregar al carrito" y aparece "Editar este producto" (`admin-productos.html?editar=ID`).
* **Dónde está:** `services/session.js` (`MakkaSession.isAdmin()`), `components/role-guard.js` y `components/user-menu.js`. Se carga en todas las páginas de la tienda justo después de `user-menu.js`.
* **Backend:** la misma regla va en el servidor: carrito, compras y solicitudes personalizadas solo aceptan el rol `cliente` (responder 403 a otros). Lo que se ve en pantalla es solo comodidad, no seguridad. El rol `empleado` puede comprar por ahora.

# Apéndices

## Recuperar cuenta por WhatsApp: cómo funciona de principio a fin

**Idea:** el sitio no manda correos ni usa la API de WhatsApp. Un enlace `https://wa.me/NUMERO?text=MENSAJE` solo abre WhatsApp (app o web) con el mensaje ya escrito; la persona tiene que pulsar "Enviar". La página no sabe si se envió ni si lo leyeron. Las personas de la tienda hacen la verificación y mandan la respuesta a mano.

**Paso a paso:**

1. **Cliente:** en `login.html` pulsa "¿Olvidaste tu contraseña?", va a `recuperar-contrasena.html`, escribe el correo de su cuenta y pulsa "Pedir enlace por WhatsApp". `recuperar.js` valida el correo y abre `wa.me/524444482898` con el texto "Hola, olvidé mi contraseña de Makka Studio. El correo de mi cuenta es: ...". Después la página muestra "Abrimos WhatsApp con tu mensaje listo" y los datos de contacto por si no se abrió.
2. **Tienda (WhatsApp de Makka):** recibe el mensaje. Confirma por su cuenta que es la persona (teléfono registrado o folio de un pedido). Esa verificación es manual; el sitio no la hace.
3. **Administrador:** en `dashboard.html`, tarjeta "Ayuda con contraseñas", escribe el correo del cliente y pulsa "Generar enlace". `MakkaAuth.createResetLink(correo)` crea un token de 32 caracteres, de un solo uso y con vigencia de 24 horas. Si ya había un enlace para esa cuenta, el anterior deja de servir. El enlace queda así: `restablecer-contrasena.html?token=...`.
4. **Administrador manda el enlace:** con "Copiar" lo pega donde quiera, o con el botón de WhatsApp abre `wa.me/52<teléfono de la cuenta>` con el enlace en el mensaje (`whatsappUrl()` de `dashboard.js`). Ese botón solo aparece si la cuenta tiene teléfono de 10 dígitos; si no, se copia el enlace y se manda por otro medio.
5. **Cliente:** abre el enlace. `restablecer-contrasena.html` revisa el token con `checkResetToken`. Si es válido, pide la contraseña nueva (mínimo 8) y la guarda con `resetPassword(token, nueva)`, que además borra el token. Si no existe, ya se usó o venció, muestra "Este enlace no es válido o ya venció".

**Importante mientras sea solo local:**

* Todo se guarda en el `localStorage` del navegador de cada computadora (cuentas en `makka_usuarios`, enlaces en `makka_reset`). El navegador del administrador y el del cliente **no comparten nada**: un enlace generado en una máquina no funciona en otra. Para probarlo completo hay que usar el mismo navegador.
* Si se borran los datos del navegador, se pierden cuentas, enlaces y todo lo demás. Abrir el sitio desde `file://` o desde otra dirección también cuenta como un navegador con datos distintos.
* El recuadro "Modo de prueba" de `recuperar-contrasena.html` existe solo para poder probar sin panel: genera el enlace en ese momento y lo muestra. En el sitio real no debe aparecer, porque el cliente nunca debe poder generar su propio enlace.

**Qué cambia con la base de datos:**

* `createResetLink` guarda una fila en una tabla de enlaces: cuenta, token (guardado con hash), fecha de vencimiento y si ya se usó. Solo lo puede pedir un administrador, y el token nunca se le regresa a un cliente.
* `checkResetToken` busca esa fila (que exista, no haya vencido y no esté usada). `resetPassword` cambia la contraseña de la cuenta (guardando el hash, no el texto), marca el enlace como usado y de preferencia cierra las sesiones abiertas de esa cuenta.
* Los enlaces `wa.me` siguen siendo solo del front y no necesitan base de datos. El enlace que se manda debe llevar el dominio real del sitio (hoy se arma con la dirección de la página abierta).
* Quita `SHOW_DEMO_LINK` y el bloque `rec-demo` de `recuperar-contrasena.html` / `recuperar.js`.
* Si quieren cambiar el número de WhatsApp: está en `WHATSAPP` de `recuperar.js` (formato `524444482898`) y como texto/`tel:` en el pie de cada página HTML.

## Catálogo: fotos deslizables por color

* En las tarjetas del catálogo (y en "Te puede gustar" del detalle), los productos con **dos o más colores con foto** (hoy: Llavero Dino, Llavero Game Boy, Figura Nerds y Aretes Stanley) se pueden deslizar: con el dedo en el celular, arrastrando con el mouse, con las flechas, o tocando un punto de color. Se ve el nombre del color y el punto activo lleva un aro.
* La foto principal va primero; si su texto alternativo menciona un color ("...rosa"), esa foto cuenta como ese color y no se repite. Los colores con `disponible === false` o sin imagen no entran al deslizador (el punto se ve sin acción).
* Tocar una foto abre el producto con ese color ya elegido (`producto.html?id=1&color=Naranja`). El nombre del producto sigue siendo el enlace de toda la tarjeta; fotos, flechas y puntos quedan por encima. Con `prefers-reduced-motion` el cambio de foto es inmediato.
* Código: `components/product-card.js` (`slidesFor`, `cardHtml` y el control de deslizado) y `components/product-card.css`. No necesita backend: usa los `colores[].imagenes` que ya manda el catálogo.

## Precios y medidas del catálogo

* Datos en `data/productos.js` (`version: 2`). Solo para las pruebas sin backend: si cambias los datos base, sube `version` y el navegador descarta su copia vieja del catálogo (`makka_productos`). Con la base de datos esto ya no se usa.
* Nuevo campo opcional `medidas` (por ejemplo "22 x 26 cm"): se muestra en el detalle del producto y se edita en el panel de Productos. Hoy lo llevan los cuatro cuadros en relieve.
* La Casita de Jengibre ahora son cuatro productos (Chica, M, L y XL), con la misma foto por ahora.
