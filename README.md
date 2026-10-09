# Lienzo

**Editor visual (tipo Wix) para sitios web que ya viven en GitHub y se publican con Vercel.**

Abres tu repositorio, haces clic sobre la página para cambiar textos, fotos, colores y secciones, y con un botón
**Publicar** Lienzo guarda el cambio en GitHub. Vercel detecta el cambio y actualiza tu sitio solo.

- No necesita servidor ni base de datos: es una página estática que habla directo con GitHub desde tu navegador.
- **Respeta tu código.** Al publicar solo cambia las líneas que editaste; no reformatea ni “limpia” el resto del archivo
  (mayúsculas, comillas, sangría y saltos de línea quedan como estaban).
- Tu sitio sigue siendo HTML y CSS normales en tu repositorio. Si un día dejas Lienzo, no pierdes nada.

> **Importante:** Lienzo edita sitios **estáticos** (archivos `.html` + CSS + imágenes). No sirve para sitios hechos con
> Next.js, React, Astro, WordPress, etc. Más detalles en [Lo que sí y lo que no hace](#lo-que-sí-y-lo-que-no-hace).

---

## 1. Poner Lienzo en línea (una sola vez, ~10 minutos)

Lienzo mismo es un sitio que se publica en Vercel. Necesitas una cuenta gratuita de [GitHub](https://github.com) y otra de
[Vercel](https://vercel.com) (puedes entrar a Vercel con tu cuenta de GitHub).

1. **Descomprime** el `.zip` en tu computadora.
2. En GitHub crea un repositorio nuevo (botón **New**), por ejemplo con el nombre `lienzo`. Déjalo vacío y, en la página
   que aparece, elige **uploading an existing file**.
3. **Arrastra todo el contenido** de la carpeta `lienzo` (las carpetas `api`, `src`, `tests` y los archivos sueltos) a la
   ventana y presiona **Commit changes**.
   - ¿Prefieres no arrastrar? Con [GitHub Desktop](https://desktop.github.com) puedes crear el repositorio desde la
     carpeta y presionar **Publish repository**.
4. En Vercel presiona **Add New… → Project**, elige el repositorio `lienzo` y presiona **Deploy**. No cambies nada:
   Vercel reconoce el proyecto (Vite) solo.
5. Al terminar te da una dirección parecida a `lienzo-tunombre.vercel.app`. **Esa es tu plataforma.** Guárdala en favoritos.

## 2. Conectar tu cuenta de GitHub

Al abrir Lienzo te pide un **token de acceso**: una “llave” que le permite leer y guardar cambios en tus repositorios.

**Opción rápida (token clásico):**

1. En la pantalla de inicio de Lienzo abre **¿Cómo obtengo mi token?** y sigue el enlace (o ve a
   *GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token*).
2. Elige cuánto dura, deja marcada la casilla **repo** y presiona **Generate token**.
3. Copia el código que empieza con `ghp_`, pégalo en Lienzo y presiona **Conectar**. GitHub solo lo muestra una vez.

**Opción más segura (token limitado a ciertos repositorios):** en *Fine-grained tokens* elige **Only select repositories**
y estos permisos:

| Permiso | Nivel | Para qué |
|---|---|---|
| Contents | Read and write | leer y guardar tus archivos |
| Pull requests | Read and write | crear pull requests desde un borrador |
| Commit statuses | Read | ver si Vercel ya terminó |
| Deployments | Read | ver la dirección del sitio publicado |
| Metadata | Read | (se agrega solo) |

Si tu repositorio pertenece a una organización con inicio de sesión único (SSO), después de crear un token clásico
presiona **Configure SSO → Authorize** junto al token.

El token se guarda **solo en tu navegador** (en este equipo). Para quitarlo, presiona **Salir** en la pantalla donde ves tus
sitios, o borra los datos del sitio en tu navegador.

**Opcional: botón “Iniciar sesión con GitHub”.** Si no quieres pegar un token cada vez en cada equipo:

1. En GitHub: *Settings → Developer settings → OAuth Apps → New OAuth App*. En **Homepage URL** pon la dirección de tu
   Lienzo y en **Authorization callback URL** pon `https://TU-DIRECCION/api/auth/callback`.
2. Copia el *Client ID* y genera un *Client secret*.
3. En Vercel: *Project → Settings → Environment Variables* y agrega `GITHUB_CLIENT_ID` y `GITHUB_CLIENT_SECRET`
   (opcional: `GITHUB_SCOPE`, por defecto `repo`). Luego **Redeploy**.
4. El botón aparece en la pantalla de inicio. El secreto vive solo en el servidor de Vercel; nunca llega al navegador.

## 3. Editar un sitio

Después de conectar verás tus repositorios. Elige el que tiene tu sitio y se abre el editor.

| Zona | Qué hace |
|---|---|
| **Barra superior** | volver a tus sitios · rama de trabajo · selector de página · tamaño de pantalla (escritorio / tablet / móvil) · zoom · deshacer y rehacer · estado de Vercel · **Vista previa** · **Código** · **Publicar** |
| **Panel izquierdo** | **Añadir** (títulos, párrafos, botones, imágenes, video de YouTube, mapa, portadas, precios, preguntas frecuentes, galería, formulario de contacto, pie de página…) · **Capas** (arrastra para reordenar) · **Páginas** (nueva, duplicar, renombrar, eliminar) · **Medios** (imágenes del repositorio y subir nuevas) · **Sitio** (colores y tipografías del sitio, título y descripción de la página) · **Archivos** (ver y editar cualquier archivo del repo) |
| **Panel derecho** | **Estilo** (texto, fondo, tamaño, espaciado, disposición, borde y sombra) · **Contenido** (texto, enlaces, imagen y su descripción, formularios) · **Avanzado** (identificador, atributos, CSS propio) |

Lo básico:

- **Doble clic** en un texto para escribirlo directamente; aparece una barra con negrita, cursiva, enlace y color.
- **Doble clic** en una imagen para cambiarla (subir una nueva o elegir una del repositorio).
- **Clic derecho** sobre cualquier elemento para duplicar, mover, agrupar o eliminar.
- Cambia a **Tablet** o **Móvil** en la barra superior para ajustar el diseño solo en esa pantalla; escritorio no se toca.
- En **Sitio** cambias un color o una tipografía una vez y se actualiza en todo el sitio (si tu CSS usa variables o colores
  repetidos, Lienzo los encuentra).
- **Vista previa** ejecuta los scripts de tu página y permite navegar entre páginas (en ese modo no se edita).
- **Código** muestra el HTML de la página, de un elemento o de cualquier archivo, por si quieres retocar algo a mano.
- Atajos: `Ctrl+S` publicar · `Ctrl+Z` deshacer · `Ctrl+D` duplicar · `Ctrl+C/X/V` copiar, cortar y pegar (también entre
  páginas) · `Supr` eliminar · `Alt+↑/↓` mover · `?` ver todos.

Los cambios **no se guardan en GitHub hasta que presionas Publicar**. Si cierras la pestaña con cambios sin publicar,
Lienzo te avisa.

## 4. Publicar

Al presionar **Publicar** ves exactamente qué archivos cambian y escribes (o dejas) el mensaje del cambio. Hay dos caminos:

- **Publicar en el sitio:** guarda el cambio en la rama principal. Vercel lo detecta y despliega; en la barra superior ves
  *Desplegando en Vercel…* y luego *Publicado*, con enlace a tu sitio.
- **Guardar como borrador:** crea una rama aparte (`lienzo/borrador-…`). Tu sitio en vivo no cambia; Vercel prepara una
  vista previa de esa rama. Cuando estés conforme, presiona **Publicar ahora** o **Crear Pull Request**.

Si la rama principal está protegida en GitHub, usa el borrador y publica con un Pull Request.

**Si otra persona cambió el mismo archivo mientras editabas**, Lienzo no pisa su trabajo: muestra el aviso *“Alguien cambió
estos archivos en GitHub”* y te deja elegir entre **Guardar mis cambios en una rama aparte** (lo más seguro),
**Usar mi versión de esos archivos** o **Quedarme con la versión de GitHub**. Si esa persona cambió otros archivos
distintos a los tuyos, tu publicación se monta encima sin problema.

## 5. Probar sin conectar nada

En la pantalla de inicio, **Probar con un sitio de ejemplo** abre una panadería de muestra en memoria: puedes editar, ver
el flujo de publicación y el estado de Vercel simulado, sin tocar ningún repositorio.

---

## Lo que sí y lo que no hace

**Sí:** edita páginas `.html` de un repositorio (en la raíz o en subcarpetas, también sitios dentro de una carpeta como
`docs/`), con sus hojas de estilo, imágenes, fondos en CSS, `srcset`, `<picture>`, SVG, fuentes y videos. Maneja HTML
“real”: mayúsculas, etiquetas sin cerrar, comillas simples, finales de línea de Windows, comentarios condicionales,
JSON-LD, etc.

**No (o con límites):**

- **Solo sitios estáticos.** Si tu sitio se genera con un framework (Next.js, Astro, Gatsby, Hugo…), el HTML final no está
  en el repositorio y Lienzo no lo puede editar visualmente.
- **Los scripts de tu sitio no corren mientras editas** (así nada se mueve ni se rompe al hacer clic). Se ven en **Vista
  previa**. Consecuencia: si la página arma su diseño con JavaScript (por ejemplo, Tailwind por CDN) o inserta contenido
  con scripts, mientras editas se verá sin esos estilos o sin ese contenido, aunque al publicar funciona igual.
- El contenido que crea JavaScript (carruseles, listas que se llenan solas) no se puede editar con clics.
- **Formularios:** un sitio estático necesita un servicio que reciba los datos (Formspree, Getform…). Lienzo te deja
  poner su dirección en el campo *A dónde se envía*.
- Las imágenes que subes pueden pesar hasta 12 MB y **no se optimizan solas**: redúcelas antes para que tu sitio cargue rápido.
- Los archivos deben estar en **UTF-8** (lo normal hoy). Si alguno es antiguo (ISO-8859-1), Lienzo no lo abre y te avisa,
  en vez de convertir los acentos en “�” sin que te des cuenta.
- En repositorios gigantes (GitHub entrega la lista de archivos incompleta) algunas páginas podrían no aparecer.
- Los videos de YouTube y mapas se ven como un recuadro en el editor; se muestran de verdad al publicar y en Vista previa.

**Cómo se probó.** Esta versión se probó a fondo con un GitHub simulado que habla el mismo protocolo que el real
(commits, ramas, conflictos, pull requests, estado de Vercel) y con navegador real: 62 pruebas unitarias y 45
comprobaciones de punta a punta, incluyendo un sitio con HTML muy desordenado. **No se pudo probar contra GitHub y Vercel
reales** desde donde se construyó, así que la primera vez conviene practicar con un repositorio de prueba. Si algo falla,
Lienzo muestra el mensaje exacto que devolvió GitHub.

## Solución de problemas

| Problema | Qué hacer |
|---|---|
| “El token no es válido o venció” | Genera uno nuevo (sección 2) y pégalo de nuevo. |
| No veo mi repositorio | Con un token limitado, confirma que lo marcaste en *Repository access*. Si es de una organización, autoriza el token con SSO o pide acceso al dueño. |
| “No tienes permiso para guardar” | El token no tiene *Contents: Read and write* (o la casilla `repo`). |
| El sitio se ve sin estilos al editar | Probablemente usa JavaScript para aplicarlos (ver límites). Revisa **Vista previa**; al publicar se ve bien. |
| Publiqué pero el sitio no cambia | Confirma que el repositorio esté conectado a un proyecto de Vercel y que el despliegue no haya fallado en vercel.com. Lienzo solo avisa lo que GitHub le informa de Vercel. |
| “Alguien cambió estos archivos en GitHub” | Elige cómo resolverlo en el aviso (ver sección 4). |
| Se acabó el límite de GitHub | Espera unos minutos; GitHub limita las peticiones por hora. |

---

## Para quien quiera tocar el código

Requiere Node 20 o superior.

```bash
npm install
npm run dev          # editor en http://localhost:5173
npm run verify       # tipos + 62 pruebas unitarias + compilación
npm test             # solo pruebas unitarias
npm run build && npm run test:e2e   # pruebas de punta a punta en un navegador real (Playwright)
```

Para las pruebas en navegador instala Chromium una vez (`npx playwright install chromium`) o define `CHROMIUM_PATH`.
`npx vite-node tests/mock/serve.ts` levanta el GitHub simulado en `http://127.0.0.1:4010` (`SITE=stress` para el sitio
de HTML desordenado); abre Lienzo con `?api=http://127.0.0.1:4010` para usarlo (token `ghp_testtoken`).

```
api/                 funciones de Vercel para el inicio de sesión opcional con GitHub (OAuth)
src/lib/git/         conexión con GitHub (API de Git: blobs → árbol → commit → rama), modo demo
src/lib/site/        leer y guardar HTML/CSS: normalización, guardado fiel al formato, recursos, temas, rutas
src/lib/editor/      motor del editor: selección, edición de texto, operaciones con deshacer, estilos por pantalla
src/lib/project.ts   copia de trabajo del repositorio (cambios sin publicar, ramas, conflictos)
src/ui/              pantallas, paneles, inspector y diálogos (React)
tests/               unitarias (vitest), GitHub simulado, sitios de prueba y pruebas de punta a punta
```

Cómo funciona el guardado fiel: el navegador lee tu HTML, lo normaliza y lo muestra; cada edición se hace sobre ese
documento vivo. Al publicar se calcula la diferencia entre el HTML normalizado original y el editado, y esa diferencia se
traslada por posición al archivo **original**, de modo que lo que no tocaste queda byte por byte igual. Si por cualquier
motivo no se puede garantizar que el resultado equivale a lo editado, se guarda el HTML completo ya editado en lugar de
arriesgar un archivo incorrecto.

Variables de entorno (solo para el inicio de sesión con GitHub): ver `.env.example`.
