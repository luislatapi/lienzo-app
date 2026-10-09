/**
 * Sitio de prueba "difícil": HTML desordenado y construcciones que se ven en sitios reales
 * (mayúsculas, comillas simples, etiquetas sin cerrar, entidades, srcset, picture, fondos en CSS,
 * subcarpetas, scripts, JSON-LD, comentarios condicionales, tablas, formularios, componentes propios).
 */
const svg = (color: string, label: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240" width="400" height="240"><rect width="400" height="240" fill="${color}"/><text x="200" y="130" font-size="28" text-anchor="middle" fill="#fff" font-family="sans-serif">${label}</text></svg>\n`

const INDEX = `<!DOCTYPE html>
<HTML lang='es'>
<HEAD>
<META charset=utf-8>
<meta name=viewport content="width=device-width, initial-scale=1">
<TITLE>Taller Tlacuache &mdash; Cerámica</TITLE>
<meta name="description" content='Cerámica hecha a mano en Oaxaca'>
<link rel="stylesheet" href="./css/main.css">
<link rel=stylesheet href=css/print.css media=print>
<!--[if lt IE 9]><script src="js/html5shiv.js"></script><![endif]-->
<script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"Taller Tlacuache"}</script>
<style>
  :root { --barro: #b5532a; --crema: #fbf3e6; }
  .aviso { background: var(--barro); color: #fff; padding: 8px 16px; }
  @media (max-width: 700px) { .aviso { font-size: 13px; } }
</style>
</HEAD>
<BODY class=home>
<!-- keep me: encabezado -->
<div class="aviso">Envíos a todo México &amp; Estados Unidos</div>
<header class='cab'>
  <a class=logo href="index.html"><img src='img/logo.svg' alt='Logo' width=48 height=48></a>
  <nav>
    <a href="about/index.html">Nosotros</a>
    <a href="contacto.html#form">Contacto</a>
    <a href='mailto:hola@tlacuache.mx'>Escríbenos</a>
    <a href="tel:+525512345678">Llámanos</a>
  </nav>
</header>
<main id="contenido">
<section class="hero" style="background-image:url(img/fondo.svg)">
  <h1>Cerámica que cuenta historias</h1>
  <p>Piezas hechas a mano en <b>Oaxaca</b> con barro negro.&nbsp;Cada una es única.
  <p class="nota">Pedidos con 15 días de anticipación.
</section>
<section class="galeria">
  <h2>Galería</h2>
  <picture>
    <source srcset="img/jarra.svg 1x, img/jarra@2x.svg 2x" media="(min-width: 800px)">
    <img src="img/jarra.svg" alt="Jarra de barro">
  </picture>
  <img srcset="img/taza.svg 480w, img/jarra.svg 800w" sizes="(max-width: 600px) 480px, 800px" src="img/taza.svg" alt="Taza">
  <video poster="img/taza.svg" controls preload=none></video>
  <svg class="icono" viewBox="0 0 24 24" width="24" height="24"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" fill="currentColor"/></svg>
</section>
<section class="lista">
  <h2>Lo que hacemos</h2>
  <ul>
  <li>Vajillas por encargo
  <li>Macetas y floreros
  <li>Talleres de torno
  </ul>
  <table class=precios>
    <tr><th>Pieza<th>Precio
    <tr><td>Taza<td>$180 MXN
    <tr><td>Jarra<td>$420 MXN
  </table>
  <details><summary>¿Hacen envíos?</summary><p>Sí, con empaque especial.</p></details>
  <my-widget data-x="1">Contenido de componente propio</my-widget>
</section>
<form action="contacto.html" method=post class="suscribir">
  <label>Correo <input type=email name=correo required></label>
  <select name=interes><option value=a>Vajillas<option value=b>Talleres</select>
  <button type=submit>Suscribirme</button>
</form>
<div id="dyn">estático</div>
<noscript><img src="img/logo.svg" alt="sin scripts"></noscript>
<template id="plantilla"><p>No se ve</p></template>
</main>
<footer>&copy; 2026 Taller Tlacuache &middot; Oaxaca, México</footer>
<script src="js/app.js"></script>
<script>window.__listo = true;</script>
</BODY>
</HTML>
`

const ABOUT = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>Nosotros</title>
<link rel="stylesheet" href="../css/main.css">
</head>
<body>
<header class="cab"><a class="logo" href="../index.html"><img src="../img/logo.svg" alt="Logo" width="48" height="48"></a></header>
<main><section class="hero"><h1>Nosotros</h1><p>Somos una familia alfarera de tercera generación.</p></section>
<section><img src="../img/jarra.svg" alt="Jarra"></section></main>
</body></html>
`

const CONTACTO = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>Contacto</title><link rel="stylesheet" href="css/main.css"></head>
<body><main><section id="form"><h1>Contacto</h1><p>Escríbenos a hola@tlacuache.mx</p></section></main></body></html>
`

const MAIN_CSS = `@import url("fuentes.css");
:root { --tinta: #2b1d14; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Georgia, 'Times New Roman', serif; color: var(--tinta); background: var(--crema, #fbf3e6); }
.cab { display: flex; align-items: center; justify-content: space-between; padding: 12px 24px; }
.cab nav a { margin-left: 16px; color: var(--barro, #b5532a); }
.hero { padding: 72px 24px; background-color: #f1dcc3; background-size: cover; background-position: center; }
.hero h1 { font-size: clamp(32px, 5vw, 56px); margin: 0 0 12px; }
.galeria { padding: 32px 24px; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
.galeria img, .galeria video { width: 100%; height: auto; }
.lista { padding: 24px; }
.precios { border-collapse: collapse; }
.precios th, .precios td { border: 1px solid #d8c6ad; padding: 6px 12px; text-align: left; }
.suscribir { padding: 24px; display: flex; gap: 12px; }
footer { padding: 24px; background: #2b1d14; color: #fbf3e6; }
.icono { color: #b5532a; }
`

export const STRESS_FILES: Record<string, string> = {
  'index.html': INDEX.replace(/\n/g, '\r\n'), // finales de línea de Windows a propósito
  'about/index.html': ABOUT,
  'contacto.html': CONTACTO,
  'css/main.css': MAIN_CSS,
  'css/print.css': 'body { color: #000; }\n',
  'css/fuentes.css': ".nada { font-family: 'Georgia'; }\n",
  'js/app.js': "document.getElementById('dyn').textContent = 'generado por script'\n",
  'img/logo.svg': svg('#b5532a', 'logo'),
  'img/fondo.svg': svg('#e8c9a0', 'fondo'),
  'img/jarra.svg': svg('#7a3b1d', 'jarra'),
  'img/jarra@2x.svg': svg('#7a3b1d', 'jarra 2x'),
  'img/taza.svg': svg('#3d2314', 'taza'),
  'README.md': '# Taller Tlacuache\n',
}
