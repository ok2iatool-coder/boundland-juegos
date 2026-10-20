// EL LINDE · lo compartido por todos los modulos del concepto (web/concepto_linde.html).
// g es el contexto donde se pinta AHORA: la pagina lo cambia con ponerG() al empezar cada capa y los modulos,
// que lo importan, ven siempre el bueno (enlace vivo de ES).
import { mezclar, rgba } from '../dibujo/tinta.js';
import { sueloConcepto, ARROYO_CONCEPTO } from './geometria.js';

export const W = 8400, H = 1600, SOL = { x: 5650, y: 60 };
export const AGUA = 1268;
export let g;
export function ponerG(c) { g = c; }

export const lerp = (a, b, t) => a + (b - a) * t;
export const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const suave = (t) => { t = cl(t); return t * t * (3 - 2 * t); };
export const gauss = (rr) => (rr() + rr() + rr() - 1.5) / 1.5;

// ---------------------------------------------------------------- la bruma manda el color de lo lejano
export const NIEBLA_CONCEPTO = [[0, '#a3ad80'], [2300, '#c0c28e'], [3500, '#e2d8a4'], [5600, '#f4e8b8'], [7000, '#ddd6b8'], [8400, '#cfcbbb']];
export let NIEBLA = NIEBLA_CONCEPTO;
// el nivel del juego pone las suyas (las mismas paradas en sus secciones) y mueve el sol a su aldea
export function ponerNiebla(paradas, solX) { NIEBLA = paradas; if (solX !== undefined) SOL.x = solX; }
export function haze(x) {
  for (let i = 1; i < NIEBLA.length; i++) if (x <= NIEBLA[i][0]) { const [x0, c0] = NIEBLA[i - 1], [x1, c1] = NIEBLA[i]; return mezclar(c0, c1, suave((x - x0) / (x1 - x0))); }
  return NIEBLA[NIEBLA.length - 1][1];
}
export const tono = (col, d, x) => mezclar(col, haze(x), cl(Math.pow(Math.max(0, d), 1.25) * 0.9));
// las luces (ventanas, farolillos) se apuntan aqui y la pagina las enciende DESPUES de la bruma de su capa
export const luces = [];
// y los BRILLOS de color propio (setas: crema verdoso), igual: se encienden despues de la bruma de su capa
// [x, y, radio, color, alfa]
export const brillos = [];
export const ladoLuz = (x) => (x < SOL.x ? 1 : -1);
// RELIEVE: el juego lo enciende (linde/obrero.js) y entonces troncos, copas y matas llevan su volumen (sombreado de
// cilindro, de bola y sombra debajo); el concepto en papel lo deja apagado y sigue igual
export let RELIEVE = false;
export function ponerRelieve(v) { RELIEVE = !!v; }

// ---------------------------------------------------------------- el terreno
// el del concepto por defecto; el nivel del juego pone el suyo (llano, en las casillas) con ponerTerreno.
// Son enlaces vivos: los modulos que los importan ven siempre el que hay puesto (geometria.js)
export let sueloY = sueloConcepto;
export let ARROYO = ARROYO_CONCEPTO;
export function ponerTerreno(suelo, arroyo) { sueloY = suelo; ARROYO = arroyo; }

export function brillo(cx, cy, rad, col, a, ctx = g) {
  const gl = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
  gl.addColorStop(0, rgba(col, a)); gl.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = gl; ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
}
