// EL HILO QUE PINTA: recibe { id, capa, x0, x1 } (una baldosa de una capa, en u del mundo) y devuelve su
// ImageBitmap (volteada para WebGL). Pinta las piezas de disposicion.js cuya caja la pisa, con la bruma de su capa
// (tono() del taller: lo lejano se aclara hacia el color de la niebla), y al final enciende las luces (ventanas,
// farolillos) y, si la capa lo pide, la desenfoca. Lo de fuera de la baldosa se recorta solo.
import './entorno.js';
import { ponerG, ponerNiebla, luces, brillos, brillo } from '../taller/linde/base.js';
import { mezclar, rgba, azar } from '../taller/dibujo/tinta.js';
import { CAPAS, CP, X, Y, YTOP, YBAJO, BALDOSA, py } from './comun.js';
import { disposicion } from './disposicion.js';
import { pintarFondo } from './fondos.js';
import { pintarJuego } from './juego.js';
import { pintarFrente } from './frente.js';

// la raya del suelo de cada capa de fondo (la de disposicion.js) y cuanta bruma le sube desde abajo
const SUELO = { lejos: [py(620), 2.6, 0.55, '#b5a898'], medioLejos: [py(640), 2.4, 0.5, '#a3988b'], medio: [py(760), 2.2, 0.42, '#8f857b'] };

function encender(G) {
  G.save(); G.globalCompositeOperation = 'lighter';
  for (const [x, y, r0, a] of luces) { brillo(x, y, r0 * 5, '#ffcf7a', 0.32 * a, G); brillo(x, y, r0 * 1.4, '#fff0c4', 0.55 * a, G); }
  for (const [x, y, r0, col, a] of brillos) brillo(x, y, r0, col, a, G);
  G.restore(); luces.length = 0; brillos.length = 0;
}

async function pintar({ capa, x0, x1 }) {
  const C = CAPAS[capa], k = C.res / CP, H = Math.ceil((YTOP - YBAJO) * C.res);
  const M = C.desenfoque ? Math.ceil(C.desenfoque * 4) : 0;                       // margen para que el desenfoque no deje costura
  const lienzo = new OffscreenCanvas(BALDOSA + M * 2, H + M * 2), G = lienzo.getContext('2d');
  G.setTransform(k, 0, 0, k, -X(x0) * k + M, M);
  ponerG(G); ponerNiebla([[-1e9, C.niebla], [1e9, C.niebla]], 1e9);
  luces.length = 0; brillos.length = 0;
  const D = disposicion(), m = 0.3 + M / C.res, xa = x0 - m, xb = x1 + m;
  const suelo = SUELO[capa];
  // la tierra de las capas de fondo, bajo su raya del suelo, del color de su bruma
  if (suelo) { const gr = G.createLinearGradient(0, Y(suelo[0]), 0, Y(YBAJO)); gr.addColorStop(0, mezclar('#3b3833', C.niebla, Math.min(0.92, C.d * 1.05))); gr.addColorStop(1, mezclar('#151413', C.niebla, Math.min(0.9, C.d * 0.75))); G.fillStyle = gr; G.fillRect(X(xa), Y(suelo[0] + 0.05), X(xb) - X(xa), Y(YBAJO) - Y(suelo[0] + 0.05)); }
  for (const p of D.capas[capa]) {
    if (p.caja[2] < xa || p.caja[0] > xb) continue;
    ponerG(G);
    if (capa === 'juego') pintarJuego(p, D.efectos);
    else if (capa === 'frente') pintarFrente(p);
    else pintarFondo(p, C.d);
  }
  ponerG(G);
  encender(G);
  // la bruma que sube del suelo (la de la imagen: el pie de la ciudad se pierde en ella), algo irregular
  if (suelo) {
    const [y, alto, a, col] = suelo, rr = azar(Math.round(x0 * 7) + 3);
    const gr = G.createLinearGradient(0, Y(y + alto), 0, Y(y - 0.6)); gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(0.6, rgba(col, a * 0.75)); gr.addColorStop(1, rgba(col, a));
    G.fillStyle = gr; G.fillRect(X(xa), Y(y + alto), X(xb) - X(xa), Y(y - 0.6) - Y(y + alto));
    for (let x = xa; x < xb; x += 0.8 + rr() * 1.6) { const w = 1.2 + rr() * 2.6, h = 0.3 + rr() * 0.9; G.fillStyle = rgba(col, a * (0.2 + rr() * 0.25)); G.beginPath(); G.ellipse(X(x), Y(y + h * 0.4), w * CP * 0.5, h * CP * 0.5, 0, 0, 7); G.fill(); }
  }
  let final = lienzo;
  if (M) { final = new OffscreenCanvas(BALDOSA, H); const F = final.getContext('2d'); F.filter = `blur(${C.desenfoque}px)`; F.drawImage(lienzo, -M, -M); }
  return createImageBitmap(final, { imageOrientation: 'flipY', premultiplyAlpha: 'none' });
}

onmessage = async (e) => {
  const t0 = performance.now();
  try { const bmp = await pintar(e.data); postMessage({ id: e.data.id, bmp, ms: performance.now() - t0 }, [bmp]); }
  catch (err) { postMessage({ id: e.data.id, error: String(err && err.stack || err) }); }
};
