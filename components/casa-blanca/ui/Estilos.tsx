// ──────────────────────────────────────────────────────────────
// Estilos propios de la Casa Blanca (prefijo cb-). Viven aquí y no en
// globals.css porque solo los usa esta página. Todo lo que se mueve tiene su
// versión quieta para prefers-reduced-motion.
// ──────────────────────────────────────────────────────────────

const CSS = `
.cb-cond { font-family: var(--font-condensada), var(--font-grotesk), ui-sans-serif, system-ui, sans-serif; }
.cb-raiz { font-family: var(--font-manrope), ui-sans-serif, system-ui, sans-serif; letter-spacing: -0.005em; }
.cb-sombra { text-shadow: 0 1px 2px rgba(0,0,0,.85), 0 0 18px rgba(0,0,0,.45); }
.cb-dinero {
  color: #7fd67f;
  letter-spacing: .01em;
  text-shadow:
    -2px -2px 0 #050806, 2px -2px 0 #050806, -2px 2px 0 #050806, 2px 2px 0 #050806,
    0 -2px 0 #050806, 0 2px 0 #050806, -2px 0 0 #050806, 2px 0 0 #050806,
    0 6px 18px rgba(0,0,0,.55);
}
.cb-sub { text-shadow: 0 1px 2px #000, 0 0 3px #000, 0 2px 14px rgba(0,0,0,.7); }
.cb-titulo { text-shadow: 0 2px 30px rgba(0,0,0,.45); }
@media (min-width: 768px) { .cb-hoja { width: var(--cb-ancho, 420px); } }

@keyframes cbEntra { from { opacity: 0; transform: translateY(10px) scale(.985); } to { opacity: 1; transform: none; } }
@keyframes cbFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes cbBajar { from { opacity: 0; transform: translateY(-22px); } to { opacity: 1; transform: none; } }
@keyframes cbSubir { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: none; } }
@keyframes cbIzq { from { opacity: 0; transform: translateX(-26px); } to { opacity: 1; transform: none; } }
@keyframes cbDer { from { opacity: 0; transform: translateX(26px); } to { opacity: 1; transform: none; } }
@keyframes cbPop { 0% { opacity: 0; transform: translateY(6px) scale(.86); } 60% { opacity: 1; transform: translateY(-1px) scale(1.03); } 100% { opacity: 1; transform: none; } }
@keyframes cbPunto { 0%, 80%, 100% { opacity: .25; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }
@keyframes cbLatido { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
@keyframes cbBarra { from { transform: translateX(-110%); } to { transform: translateX(330%); } }
@keyframes cbFranjaA { from { transform: translateY(-100%); } to { transform: none; } }
@keyframes cbFranjaB { from { transform: translateY(100%); } to { transform: none; } }
@keyframes cbTitulo { from { opacity: 0; transform: translateY(22px); letter-spacing: .08em; filter: blur(6px); } to { opacity: 1; transform: none; filter: none; } }

.cb-entra { animation: cbEntra .32s cubic-bezier(.2,.7,.2,1) both; }
.cb-entra-suave { animation: cbFade .35s ease-out both; }
.cb-hud-arriba { animation: cbBajar .8s cubic-bezier(.2,.7,.2,1) both; }
.cb-hud-abajo { animation: cbSubir .8s cubic-bezier(.2,.7,.2,1) .12s both; }
.cb-hud-izq { animation: cbIzq .8s cubic-bezier(.2,.7,.2,1) .2s both; }
.cb-hud-der { animation: cbDer .8s cubic-bezier(.2,.7,.2,1) .28s both; }

.cb-intro .cb-franja-arriba { animation: cbFranjaA .9s cubic-bezier(.2,.7,.2,1) both; }
.cb-intro .cb-franja-abajo { animation: cbFranjaB .9s cubic-bezier(.2,.7,.2,1) both; }
.cb-intro-sale .cb-franja { transition: transform .7s cubic-bezier(.6,0,.4,1); }
.cb-intro-sale .cb-franja-arriba { transform: translateY(-100%); }
.cb-intro-sale .cb-franja-abajo { transform: translateY(100%); }
.cb-titulo-in { animation: cbTitulo 1.2s cubic-bezier(.2,.7,.2,1) both; }

/* Etiquetas sobre los personajes: el ancla es (x, y) sobre la cabeza. */
.cb-pj {
  position: absolute; left: 0; top: 0;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  pointer-events: none; will-change: transform; white-space: nowrap;
}
.cb-tag {
  pointer-events: auto; cursor: pointer;
  display: inline-flex; align-items: center; gap: 7px;
  max-width: 240px; padding: 4px 11px 4px 9px; border-radius: 999px;
  background: rgba(8,10,14,.72); border: 1px solid rgba(255,255,255,.13);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 6px 18px -8px rgba(0,0,0,.9);
  color: #fff; font: 700 11.5px/1.2 var(--font-manrope), system-ui, sans-serif;
}
.cb-tag:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.cb-tag b { display: inline-flex; align-items: center; gap: 6px; font-weight: 800; }
.cb-tag b::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--cb-color); box-shadow: 0 0 10px var(--cb-color); }
.cb-tag span { color: rgba(255,255,255,.62); font-weight: 600; overflow: hidden; text-overflow: ellipsis; max-width: 150px; }
.cb-tag span:empty { display: none; }
.cb-sel .cb-tag { border-color: var(--cb-color); box-shadow: 0 0 0 1px var(--cb-color), 0 0 22px -4px var(--cb-color); }

.cb-burbuja {
  position: relative; max-width: 240px; white-space: normal;
  padding: 7px 12px; border-radius: 14px;
  background: #fff; color: #0b0d10;
  font: 650 12.5px/1.35 var(--font-manrope), system-ui, sans-serif;
  box-shadow: 0 10px 26px -10px rgba(0,0,0,.75);
  text-align: left;
}
.cb-burbuja::after {
  content: ""; position: absolute; left: 50%; bottom: -5px; width: 11px; height: 11px;
  background: inherit; transform: translateX(-50%) rotate(45deg); border-radius: 2px;
}
.cb-burbuja.cb-piensa { background: rgba(255,255,255,.86); font-style: italic; font-weight: 600; color: #2a2f36; }
.cb-burbuja.cb-piensa::after { width: 8px; height: 8px; bottom: -11px; border-radius: 50%; transform: translateX(-50%); }
.cb-pop { animation: cbPop .34s cubic-bezier(.2,.7,.2,1) both; }

/* Etiqueta tipo reel de un puesto del subsuelo. */
.cb-reel {
  position: absolute; left: 0; top: 0; pointer-events: none; z-index: 5;
  min-width: 170px; padding: 7px 11px 8px; border-radius: 11px;
  background: rgba(8,10,14,.82); border: 1px solid rgba(255,255,255,.12);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  color: #fff; box-shadow: 0 10px 26px -10px rgba(0,0,0,.9);
}
.cb-reel-t { font: 800 12px/1.2 var(--font-manrope), system-ui, sans-serif; }
.cb-reel-s { margin-top: 2px; font: 600 10.5px/1.2 var(--font-manrope), system-ui, sans-serif; color: rgba(255,255,255,.55); }
.cb-reel-b { margin-top: 6px; height: 3px; border-radius: 3px; background: rgba(255,255,255,.12); overflow: hidden; }
.cb-reel-b i { display: block; height: 100%; width: 0; border-radius: 3px; background: var(--cb-color); }
.cb-reel[data-estado="entregado"] .cb-reel-b i { width: 100%; background: #6fd27c; }
.cb-reel[data-estado="trabajando"] .cb-reel-b i { width: 34%; animation: cbBarra 1.4s ease-in-out infinite; }

.cb-puntos { display: inline-flex; gap: 4px; align-items: center; }
.cb-puntos i { width: 5px; height: 5px; border-radius: 50%; background: rgba(255,255,255,.85); animation: cbPunto 1.1s infinite; }
.cb-puntos-negros i { background: #000; }
.cb-puntos i:nth-child(2) { animation-delay: .15s; }
.cb-puntos i:nth-child(3) { animation-delay: .3s; }
.cb-trabaja { animation: cbLatido 1.1s ease-in-out infinite; box-shadow: 0 0 8px currentColor; }
.cb-barra-viva { animation: cbBarra 1.4s ease-in-out infinite; }

.cb-escena canvas { display: block; width: 100%; height: 100%; touch-action: none; outline: none; }

@media (prefers-reduced-motion: reduce) {
  .cb-entra, .cb-entra-suave, .cb-hud-arriba, .cb-hud-abajo, .cb-hud-izq, .cb-hud-der, .cb-titulo-in, .cb-pop { animation: cbFade .25s ease-out both !important; }
  .cb-intro .cb-franja-arriba, .cb-intro .cb-franja-abajo { animation: none; }
  .cb-intro-sale .cb-franja { transition: opacity .3s; opacity: 0; transform: none; }
  .cb-trabaja, .cb-barra-viva, .cb-reel[data-estado="trabajando"] .cb-reel-b i, .cb-puntos i { animation: none; }
}
`

export function Estilos() {
  return <style>{CSS}</style>
}
