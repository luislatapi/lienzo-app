// Archivos de ejemplo (CSS, JS e ilustraciones SVG) del sitio demo "Casa Nopal".

export const DEMO_CSS = `:root {
  --cafe: #3b2218;
  --cafe-suave: #6b4a3b;
  --rosa: #e8577e;
  --rosa-oscuro: #c63d64;
  --masa: #f6d9a8;
  --fondo: #fff9f2;
  --verde: #2f6b4f;
  --blanco: #ffffff;
  --radio: 18px;
  --fuente-titulo: 'Fraunces', Georgia, 'Times New Roman', serif;
  --fuente-texto: 'DM Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  font-family: var(--fuente-texto);
  color: var(--cafe);
  background: var(--fondo);
  line-height: 1.6;
}
img { max-width: 100%; display: block; }
a { color: inherit; }

.barra {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 14px 6vw;
  background: rgba(255, 249, 242, 0.94);
  border-bottom: 1px solid #f0e2d0;
}
.marca { display: flex; align-items: center; gap: 10px; text-decoration: none; font-family: var(--fuente-titulo); font-weight: 700; font-size: 22px; }
.menu { display: flex; gap: 28px; }
.menu a { text-decoration: none; font-weight: 500; color: var(--cafe-suave); }
.menu a:hover { color: var(--rosa-oscuro); }

.boton {
  display: inline-block;
  padding: 14px 26px;
  border-radius: 999px;
  background: var(--rosa);
  color: var(--blanco);
  font-weight: 700;
  text-decoration: none;
  box-shadow: 0 6px 0 var(--rosa-oscuro);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.boton:hover { transform: translateY(2px); box-shadow: 0 4px 0 var(--rosa-oscuro); }
.boton-chico { padding: 10px 20px; font-size: 15px; box-shadow: 0 4px 0 var(--rosa-oscuro); }
.boton-claro { background: var(--blanco); color: var(--cafe); box-shadow: 0 6px 0 var(--masa); }
.boton-claro:hover { box-shadow: 0 4px 0 var(--masa); }

.portada {
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  align-items: center;
  gap: 5vw;
  padding: 7vw 6vw 5vw;
}
.etiqueta { display: inline-block; margin: 0 0 18px; padding: 6px 14px; border-radius: 999px; background: var(--masa); font-weight: 700; font-size: 14px; }
.portada h1 { font-family: var(--fuente-titulo); font-size: clamp(38px, 5.4vw, 70px); line-height: 1.04; margin: 0 0 20px; letter-spacing: -0.02em; }
.bajada { font-size: 19px; max-width: 34em; color: var(--cafe-suave); margin: 0 0 30px; }
.acciones { display: flex; flex-wrap: wrap; gap: 16px; }
.portada-imagen { width: 100%; border-radius: 32px; }

.franja { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; padding: 28px 6vw; background: var(--verde); color: var(--blanco); }
.franja div { display: flex; flex-direction: column; gap: 4px; }
.franja strong { font-family: var(--fuente-titulo); font-size: 22px; }
.franja span { opacity: 0.85; }

.seccion { padding: 88px 6vw; }
.seccion > h2, .titulo-seccion { font-family: var(--fuente-titulo); font-size: clamp(30px, 3.6vw, 46px); line-height: 1.1; margin: 0 0 12px; letter-spacing: -0.01em; }
.subtitulo { margin: 0 0 40px; max-width: 40em; color: var(--cafe-suave); font-size: 18px; }

.tarjetas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
.tarjeta { background: var(--blanco); border-radius: var(--radio); padding: 24px; border: 1px solid #f0e2d0; }
.tarjeta img { width: 100%; height: 190px; object-fit: contain; margin-bottom: 14px; }
.tarjeta h3 { font-family: var(--fuente-titulo); font-size: 24px; margin: 0 0 6px; }
.tarjeta p { margin: 0 0 14px; color: var(--cafe-suave); }
.precio { font-weight: 700; font-size: 20px; color: var(--rosa-oscuro); }

.historia { display: grid; grid-template-columns: 1fr 1fr; gap: 6vw; align-items: center; background: var(--masa); }
.historia p { font-size: 18px; }
.historia img { border-radius: 28px; }

.opiniones { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
.opinion { background: var(--blanco); border-radius: var(--radio); padding: 28px; border: 1px solid #f0e2d0; }
.opinion p { margin: 0 0 18px; font-size: 18px; }
.opinion cite { font-style: normal; font-weight: 700; color: var(--verde); }

.preguntas { max-width: 820px; }
.preguntas details { border-bottom: 1px solid #ecd9c3; padding: 18px 0; }
.preguntas summary { cursor: pointer; font-weight: 700; font-size: 19px; }
.preguntas details p { margin: 12px 0 0; color: var(--cafe-suave); }

.llamado {
  text-align: center;
  padding: 96px 6vw;
  background-color: var(--cafe);
  background-image: url('../img/patron.svg');
  color: var(--blanco);
}
.llamado h2 { font-family: var(--fuente-titulo); font-size: clamp(32px, 4vw, 52px); margin: 0 0 14px; }
.llamado p { margin: 0 auto 30px; max-width: 34em; opacity: 0.9; font-size: 19px; }

.pie { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 18px; padding: 36px 6vw; font-size: 15px; color: var(--cafe-suave); }

.revelar { opacity: 0; transform: translateY(18px); transition: opacity 0.6s ease, transform 0.6s ease; }
.revelar.visible { opacity: 1; transform: none; }

@media (max-width: 900px) {
  .portada, .historia { grid-template-columns: 1fr; }
  .tarjetas, .opiniones, .franja { grid-template-columns: 1fr; }
  .menu { display: none; }
  .seccion { padding: 56px 6vw; }
}
`

export const DEMO_JS = `// Efecto de aparición al hacer scroll
(function () {
  var items = document.querySelectorAll('.revelar');
  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('visible'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
    });
  }, { threshold: 0.15 });
  items.forEach(function (el) { io.observe(el); });
})();
`

export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" rx="16" fill="#2f6b4f"/>
  <ellipse cx="32" cy="38" rx="15" ry="19" fill="#8fd18a" transform="rotate(-12 32 38)"/>
  <ellipse cx="32" cy="38" rx="15" ry="19" fill="none" stroke="#1d4a36" stroke-width="2" transform="rotate(-12 32 38)"/>
  <circle cx="28" cy="34" r="1.6" fill="#1d4a36"/><circle cx="36" cy="40" r="1.6" fill="#1d4a36"/><circle cx="29" cy="46" r="1.6" fill="#1d4a36"/>
  <circle cx="40" cy="18" r="6" fill="#e8577e"/><circle cx="40" cy="18" r="2.4" fill="#f6d9a8"/>
</svg>
`

export const HERO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 520" width="640" height="520">
  <rect width="640" height="520" rx="40" fill="#f7c9d4"/>
  <circle cx="520" cy="96" r="70" fill="#f6d9a8"/>
  <rect x="60" y="330" width="520" height="40" rx="20" fill="#6b4a3b"/>
  <rect x="80" y="365" width="480" height="70" rx="16" fill="#3b2218"/>
  <g>
    <ellipse cx="170" cy="300" rx="92" ry="64" fill="#e9b872"/>
    <path d="M90 292c10-52 60-76 100-72 44 4 76 32 82 72z" fill="#e8577e"/>
    <path d="M120 236l22 58M160 224l8 70M202 224l-8 70M244 238l-24 56" stroke="#fff" stroke-opacity=".55" stroke-width="5" stroke-linecap="round"/>
  </g>
  <g>
    <ellipse cx="350" cy="300" rx="92" ry="64" fill="#e9b872"/>
    <path d="M270 292c10-52 60-76 100-72 44 4 76 32 82 72z" fill="#f6d9a8"/>
    <path d="M300 236l22 58M340 224l8 70M382 224l-8 70M424 238l-24 56" stroke="#c98a45" stroke-opacity=".6" stroke-width="5" stroke-linecap="round"/>
  </g>
  <g>
    <ellipse cx="505" cy="300" rx="80" ry="58" fill="#e9b872"/>
    <path d="M435 292c8-46 52-66 88-62 38 4 66 28 72 62z" fill="#7a4a30"/>
    <path d="M462 242l18 50M498 232l6 60M534 236l-14 56" stroke="#fff" stroke-opacity=".35" stroke-width="5" stroke-linecap="round"/>
  </g>
  <path d="M150 120c0-20 16-34 34-34s34 14 34 34" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="6" stroke-linecap="round"/>
  <path d="M236 96c0-14 12-24 24-24s24 10 24 24" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="6" stroke-linecap="round"/>
</svg>
`

export const CONCHA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" width="240" height="200">
  <ellipse cx="120" cy="124" rx="100" ry="58" fill="#e9b872"/>
  <path d="M30 116c10-56 58-84 92-82 40 2 78 30 90 82z" fill="#e8577e"/>
  <path d="M62 56l22 62M104 42l8 76M148 44l-8 74M190 62l-26 56" stroke="#fff" stroke-opacity=".55" stroke-width="6" stroke-linecap="round"/>
</svg>
`

export const CUERNO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" width="240" height="200">
  <path d="M24 130c4-56 44-92 96-92s92 36 96 92c-18-10-30-16-40-14-12-30-30-44-56-44s-44 14-56 44c-10-2-22 4-40 14z" fill="#d99a4e"/>
  <path d="M76 84c8-10 18-16 30-18M120 74c0-6 0-8 0-12M164 84c-8-10-18-16-30-18" stroke="#9a5f25" stroke-width="5" stroke-linecap="round" fill="none"/>
  <path d="M30 128c14-8 24-12 34-10 8 10 12 22 12 34-20 0-34-8-46-24z" fill="#c98a45"/>
  <path d="M210 128c-14-8-24-12-34-10-8 10-12 22-12 34 20 0 34-8 46-24z" fill="#c98a45"/>
</svg>
`

export const BOLILLO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" width="240" height="200">
  <ellipse cx="120" cy="108" rx="104" ry="52" fill="#e0a85c" transform="rotate(-14 120 108)"/>
  <path d="M52 112c10-8 22-10 30-4M92 98c10-8 22-10 30-4M132 86c10-8 22-10 30-4M170 74c8-6 18-8 26-2" stroke="#fbe4b8" stroke-width="9" stroke-linecap="round" fill="none"/>
</svg>
`

export const HISTORIA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 440" width="560" height="440">
  <rect width="560" height="440" rx="36" fill="#2f6b4f"/>
  <rect x="70" y="250" width="420" height="120" rx="20" fill="#1d4a36"/>
  <rect x="100" y="160" width="360" height="110" rx="55" fill="#f6d9a8"/>
  <rect x="130" y="182" width="300" height="66" rx="33" fill="#e8577e"/>
  <circle cx="140" cy="110" r="46" fill="#f6d9a8" opacity=".9"/>
  <path d="M110 330h340" stroke="#f6d9a8" stroke-width="6" stroke-linecap="round" stroke-dasharray="2 16"/>
</svg>
`

export const PATRON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
  <path d="M40 8l10 22 22 10-22 10-10 22-10-22-22-10 22-10z" fill="#ffffff" fill-opacity=".07"/>
</svg>
`
