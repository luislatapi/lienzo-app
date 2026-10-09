import {
  BOLILLO_SVG,
  CONCHA_SVG,
  CUERNO_SVG,
  DEMO_CSS,
  DEMO_JS,
  HERO_SVG,
  HISTORIA_SVG,
  LOGO_SVG,
  PATRON_SVG,
} from './demo-assets'

const WA = 'https://wa.me/525512345678?text=Hola%2C%20quiero%20hacer%20un%20pedido'

const INDEX_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Casa Nopal · Panadería en la Roma Norte</title>
  <meta name="description" content="Pan dulce y de sal horneado cada madrugada en la Roma Norte, CDMX. Pide por WhatsApp y recoge caliente.">
  <link rel="icon" href="img/logo.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Fraunces:opsz,wght@9..144,600;9..144,800&display=swap">
  <link rel="stylesheet" href="css/estilos.css">
</head>
<body>
  <header class="barra">
    <a class="marca" href="#inicio">
      <img src="img/logo.svg" alt="Casa Nopal" width="36" height="36">
      <span>Casa Nopal</span>
    </a>
    <nav class="menu">
      <a href="#pan">Nuestro pan</a>
      <a href="#historia">Historia</a>
      <a href="#opiniones">Opiniones</a>
      <a href="#preguntas">Preguntas</a>
    </nav>
    <a class="boton boton-chico" href="${WA}">Pedir por WhatsApp</a>
  </header>

  <main>
    <section class="portada" id="inicio">
      <div class="portada-texto">
        <p class="etiqueta">Horneamos desde las 4 a. m.</p>
        <h1>El pan de la esquina, recién salido del horno</h1>
        <p class="bajada">Conchas, cuernos y bolillo de masa madre en la colonia Roma Norte. Haz tu pedido hoy y recógelo caliente mañana.</p>
        <div class="acciones">
          <a class="boton" href="${WA}">Hacer mi pedido</a>
          <a class="boton boton-claro" href="#pan">Ver el pan del día</a>
        </div>
      </div>
      <img class="portada-imagen" src="img/hero.svg" alt="Charola de conchas recién horneadas" width="640" height="520">
    </section>

    <section class="franja">
      <div><strong>Masa madre de 48 horas</strong><span>Sabor profundo y miga suave</span></div>
      <div><strong>Horno de piedra</strong><span>Corteza dorada todos los días</span></div>
      <div><strong>Entrega en la colonia</strong><span>Roma, Condesa y Juárez</span></div>
    </section>

    <section class="seccion" id="pan">
      <h2>El pan del día</h2>
      <p class="subtitulo">Sacamos tres charolas distintas cada mañana. Lo que ves aquí es lo que más se va.</p>
      <div class="tarjetas">
        <article class="tarjeta revelar">
          <img src="img/concha.svg" alt="Concha rosa">
          <h3>Concha clásica</h3>
          <p>Cubierta crujiente de azúcar y vainilla sobre pan de yema.</p>
          <span class="precio">$22 MXN</span>
        </article>
        <article class="tarjeta revelar">
          <img src="img/cuerno.svg" alt="Cuerno de mantequilla">
          <h3>Cuerno de mantequilla</h3>
          <p>Hojaldrado, ligero y con mantequilla real.</p>
          <span class="precio">$28 MXN</span>
        </article>
        <article class="tarjeta revelar">
          <img src="img/bolillo.svg" alt="Bolillo de masa madre">
          <h3>Bolillo de masa madre</h3>
          <p>Fermentado dos días. Perfecto para tortas y para la mesa.</p>
          <span class="precio">$9 MXN</span>
        </article>
      </div>
    </section>

    <section class="seccion historia" id="historia">
      <div>
        <h2 class="titulo-seccion">Una panadería de barrio, hecha a mano</h2>
        <p>Abrimos en 2019 con un horno prestado y una receta de la abuela de Mariana. Hoy seguimos amasando a mano y horneando de madrugada para que el pan llegue tibio a tu puerta.</p>
        <p>Compramos harina a molinos de Puebla y Tlaxcala, y todo el empaque es compostable.</p>
        <a class="boton" href="${WA}">Conócenos por WhatsApp</a>
      </div>
      <img src="img/historia.svg" alt="Mostrador de la panadería" width="560" height="440">
    </section>

    <section class="seccion" id="opiniones">
      <h2>Lo que dicen los vecinos</h2>
      <p class="subtitulo">Más de 400 pedidos entregados este año.</p>
      <div class="opiniones">
        <blockquote class="opinion revelar">
          <p>“Las conchas más suaves de la Roma. Ya no compro en otro lado.”</p>
          <cite>Daniela R.</cite>
        </blockquote>
        <blockquote class="opinion revelar">
          <p>“Pedí 30 piezas para una junta y llegaron calientitas y a tiempo.”</p>
          <cite>Jorge M.</cite>
        </blockquote>
        <blockquote class="opinion revelar">
          <p>“El bolillo de masa madre cambió mis desayunos.”</p>
          <cite>Fernanda L.</cite>
        </blockquote>
      </div>
    </section>

    <section class="seccion" id="preguntas">
      <h2>Preguntas frecuentes</h2>
      <div class="preguntas">
        <details open>
          <summary>¿Con cuánta anticipación debo pedir?</summary>
          <p>Con un día de anticipación. Pedidos grandes de más de 50 piezas, con tres días.</p>
        </details>
        <details>
          <summary>¿Hacen entregas a domicilio?</summary>
          <p>Sí, en Roma Norte, Roma Sur, Condesa y Juárez. El envío cuesta $35 MXN y es gratis desde $400.</p>
        </details>
        <details>
          <summary>¿Tienen opciones sin lácteos?</summary>
          <p>Hacemos bolillo y pan de caja sin lácteos y sin huevo todos los días.</p>
        </details>
      </div>
    </section>

    <section class="llamado">
      <h2>Mañana a las 8 tu pan sale del horno</h2>
      <p>Escríbenos hoy antes de las 8 p. m. y te lo apartamos.</p>
      <a class="boton" href="${WA}">Pedir ahora</a>
    </section>
  </main>

  <footer class="pie">
    <span>© 2026 Casa Nopal · Calle Durango 118, Roma Norte, CDMX</span>
    <span>Lunes a sábado de 7:00 a 19:00</span>
  </footer>
  <script src="js/menu.js"></script>
</body>
</html>
`

const GRACIAS_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>¡Gracias! · Casa Nopal</title>
  <link rel="icon" href="img/logo.svg" type="image/svg+xml">
  <link rel="stylesheet" href="css/estilos.css">
</head>
<body>
  <main class="seccion" style="text-align:center;min-height:70vh;display:flex;flex-direction:column;align-items:center;justify-content:center">
    <img src="img/logo.svg" alt="Casa Nopal" width="72" height="72">
    <h1 class="titulo-seccion">¡Gracias por tu pedido!</h1>
    <p class="subtitulo">Te confirmamos por WhatsApp en unos minutos.</p>
    <a class="boton" href="index.html">Volver al inicio</a>
  </main>
</body>
</html>
`

export const DEMO_REPO_FILES: Record<string, string> = {
  'index.html': INDEX_HTML,
  'gracias.html': GRACIAS_HTML,
  'css/estilos.css': DEMO_CSS,
  'js/menu.js': DEMO_JS,
  'img/logo.svg': LOGO_SVG,
  'img/hero.svg': HERO_SVG,
  'img/concha.svg': CONCHA_SVG,
  'img/cuerno.svg': CUERNO_SVG,
  'img/bolillo.svg': BOLILLO_SVG,
  'img/historia.svg': HISTORIA_SVG,
  'img/patron.svg': PATRON_SVG,
  'vercel.json': '{\n  "cleanUrls": true\n}\n',
  'README.md': '# Casa Nopal\n\nSitio de ejemplo del modo demo de Lienzo.\n',
}
