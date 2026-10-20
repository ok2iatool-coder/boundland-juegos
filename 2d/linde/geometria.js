// EL LINDE · la GEOMETRIA comun a la pintura del concepto y al nivel 6 del juego. Sin dibujo ni DOM (la importan
// tambien los modulos que usa la simulacion).
//
// La pintura esta en px del concepto y el juego en u (32 u por casilla). La escala sale del 18: el concepto lo
// pinta a 0,52 de su hoja de sprites y el juego a 64 / px_por_metro (336,4) de ella, asi que un u son 2,73 px.
// El nivel del juego (sim/niveles.js) pinta sus piezas a esa escala (linde/obrero.js).
import { azar } from '../dibujo/tinta.js';

export const PXU = (0.52 * 336.4) / 64;             // px del concepto por u del juego
const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const suave = (t) => { t = cl(t); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------- el terreno
// el del concepto: la ladera del conducto, una ondulacion suave, el arroyo y la ciudad algo mas baja
export function sueloConcepto(x) {
  let y = 1185;
  if (x < 700) y = lerp(1105, 1185, suave(x / 700));
  y += Math.sin(x * 0.0045) * 10 * (x < 3300 ? 1 : 0.4);
  if (x > 2420 && x < 3220) y += 250 * suave((x - 2420) / 140) * (1 - suave((x - 3080) / 140));
  if (x > 6900) y = lerp(y, 1190, suave((x - 6900) / 200));
  return y;
}
export const ARROYO_CONCEPTO = { x0: 2440, x1: 3200 };

// ---------------------------------------------------------------- la forma de un tronco
// centro curvo (curva * sin(2.4 t)) + inclinacion opcional sobre un pivote, ancho que se estrecha al subir y
// contrafuertes que abren el pie a 1,6-2 veces en los 130 px de abajo. troncos.js la usa para pintar y aqui
// sirve para saber donde nacen las ramas sin pintar nada (gasta del azar del tronco lo mismo que el).
export function forma(x, base, top, an, curva, incl, piv, f0, f1) {
  const alto = base - top, t = (y) => cl((base - y) / alto, 0, 1);
  const cx = (y) => x + curva * Math.sin(t(y) * 2.4) + incl * (piv - y);
  const w = (y) => an * (1 - t(y) * 0.38);
  const fl = (y) => Math.pow(cl(1 - (base - y) / 130, 0, 1), 2.2);
  const bordes = (y) => { const c = cx(y), h = w(y) / 2, f = fl(y); return [c - h * (1 + f * f0), c + h * (1 + f * f1)]; };
  return { x, base, top, an, alto, t, cx, w, bordes };
}
export function formaTronco(rr, x, base, top, an, o = {}) {
  const sg = rr() < 0.5 ? -1 : 1, curva = o.recto ? 0 : sg * (0.3 + rr() * 0.25) * an;
  const incl = o.inclina || 0, piv = o.pivote ?? base;
  const f0 = 0.55 + rr() * 0.45, f1 = 0.55 + rr() * 0.45;
  return { F: forma(x, base, top, an, curva, incl, piv, f0, f1), curva, incl, piv };
}

// ---------------------------------------------------------------- los planos
// Las cotas de lo que se pisa o marca el paso en la tira del concepto (escena.js las lee del plano).
const TRONCOS = [[860, 210], [1400, 170], [2300, 240]];
export const PLANO_CONCEPTO = {
  suelo: sueloConcepto, arroyo: ARROYO_CONCEPTO, y0: 0, y1: 1600,
  troncos: TRONCOS.map(([x, an]) => ({ x, an, base: sueloConcepto(x), top: -120, o: { raices: true, colgajos: 10 } })),
  ramas: [[860, 620, 260, 1], [1400, 520, 230, -1], [2300, 700, 280, 1], [1400, 840, 180, 1]],
  tocon: { x: 1760, y: sueloConcepto(1760) - 70 },
  pasarela: { x0: 2360, x1: 3260, y: 1150 },
  reflejo: { x0: 2440, x1: 3220 },
  capsula: { cx: 5690, cy: 700, x0: 5550, x1: 5830, y: 790, escX: 5570, escY: 790, escB: sueloConcepto(5680) },
  bus: { x: 6520, y: sueloConcepto(6700), w: 400, h: 160 },
  rejilla: true, persiana: true,
};
