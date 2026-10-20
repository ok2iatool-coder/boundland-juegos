// LO QUE CRECE EN CADA SITIO del mapa del mundo (puro, sin three) y las rocas que pone el editor. Solo geografia: el
// mundo empieza sin rocas sueltas (las del terreno eran adorno de sus explanadas); las que se pongan a mano van aqui.
// `cubierta`: cuanta hierba, de que alto, flores y de que clase, segun la cota, la cuesta, la nieve y el agua.
import { forma, altura, normalY, curvatura, fbm, suave, EXT, pinturaEn, MATERIALES, COTA_NIEVE, nivelAgua, distAgua, SIN_AGUA, norte } from './relieve.js';

// ---------------- las rocas (las del editor) ----------------
// { x, z, r (radio de la huella), alto, y (la base), giro, tipo, cat, inclina }
export const N_TIPOS_ROCA = 10;
export const ROCAS = [];
export const N_ROCAS_ORIG = 0;

// la distancia al borde de la roca mas cercana: un indice por celdas de 16 m (el mundo es grande para una rejilla fina)
const C = 16, INDICE = new Map(), clave = (i, j) => i * 100003 + j;
function indexar(o) {
  const k = clave(Math.floor(o.x / C), Math.floor(o.z / C));
  if (!INDICE.has(k)) INDICE.set(k, []);
  INDICE.get(k).push(o);
}
export function distRoca(x, z) {
  const ci = Math.floor(x / C), cj = Math.floor(z / C);
  let d = 9;
  for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
    const l = INDICE.get(clave(i, j));
    if (!l) continue;
    for (const o of l) if (!o.quitada) d = Math.min(d, Math.hypot(o.x - x, o.z - z) - o.r * 0.9);
  }
  return d;
}
export function recalcularDistRoca() {
  INDICE.clear();
  for (const o of ROCAS) indexar(o);
}

// los choques: las rocas que estorban al 18 (la lista es la que leen el 18 y su capa cada vez: se cambia en su sitio)
const estorba = (o) => o.r >= 0.33 && o.alto >= 0.28;
export const CHOQUES_ROCAS = [];

// ---------------- lo que hace el editor con las rocas ----------------
export function asentar(o) {
  let hmin = altura(o.x, o.z);
  for (let k = 0; k < 8; k++) { const a = (k / 8) * 6.2832; hmin = Math.min(hmin, altura(o.x + Math.cos(a) * o.r * 0.85, o.z + Math.sin(a) * o.r * 0.85)); }
  o.y = hmin - o.bajo;
  return o;
}
export function activarRoca(o, si) {
  if (!o.quitada === si) return;
  o.quitada = !si;
  if (o.choque) {
    const k = CHOQUES_ROCAS.indexOf(o.choque);
    if (!si && k >= 0) CHOQUES_ROCAS.splice(k, 1);
    if (si && k < 0) CHOQUES_ROCAS.push(o.choque);
  }
}
export function nuevaRoca(d) {
  const o = {
    x: d.x, z: d.z, r: d.r, alto: d.alto ?? d.r * (0.55 + Math.random() * 0.5), giro: d.giro ?? Math.random() * 6.2832,
    tipo: d.tipo ?? Math.floor(Math.random() * N_TIPOS_ROCA), cat: 'editor',
    inclina: d.inclina ?? [(Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.25], id: ROCAS.length,
  };
  o.bajo = o.alto * 0.3;
  asentar(o);
  if (estorba(o)) { o.choque = { x: o.x, z: o.z, r: o.r * 0.86 }; CHOQUES_ROCAS.push(o.choque); }
  ROCAS.push(o);
  indexar(o);
  return o;
}

// ---------------- que crece en cada sitio ----------------
export const calva = (x, z) => suave(0.78, 0.85, fbm(x / 9 + 100, z / 9 - 50, 2));
// las zonas (indices de geo.json): Los Cerros 15, El Cortado 16, El farallon 6, La muela 5, El Linde 3
const _m = {}, _cub = { mata: 0, alto: 1, flor: 0, florTipo: 0, seco: 0 };
export function cubierta(x, z, out = _cub, m = null) {
  if (!m) { m = _m; forma(x, z, m); }
  const y = altura(x, z), ny = normalY(x, z), dr = distRoca(x, z);
  let mata = 1;
  if (dr < 0.05) mata = 0;
  mata *= 1 - suave(0.86, 0.7, ny);                            // en las cuestas fuertes, tierra y roca
  mata *= 1 - 0.85 * calva(x, z);
  mata *= 1 - suave(COTA_NIEVE - 70, COTA_NIEVE - 15, y);       // arriba, la nieve
  mata *= 1 - 0.5 * suave(330, 470, y);                          // y antes, la hierba rala de lo alto
  // el agua: dentro nada, y en la orilla la grava
  const nivel = nivelAgua(x, z);
  if (nivel > SIN_AGUA && nivel > y - 0.05) mata = 0;
  mata *= suave(3, 9, distAgua(x, z));
  // lo seco: lo alto, los Cerros y la muela; lo jugoso: el Linde y lo bajo de la Cuenca
  const z_ = m.zona;
  const seco = Math.min(1, 0.75 * suave(140, 420, y) + (z_ === 15 ? 0.45 : 0) + (z_ === 5 ? 0.35 : 0)
    + 0.25 * suave(0.55, 0.72, fbm(x / 40 - 40, z / 40 + 8, 3)) - (z_ === 3 ? 0.3 : 0));
  let alto = 0.75 + 0.5 * suave(0.3, 0.75, fbm(x / 13 + 5, z / 13 + 1, 3));
  alto *= 1 - 0.4 * suave(0.6, 0.72, fbm(x / 30 - 11, z / 30 + 40, 2));
  alto *= 1 + 0.3 * suave(1.4, 0.1, dr) + (z_ === 3 ? 0.3 : 0) + 0.25 * suave(14, 4, distAgua(x, z)) * (y < 300 ? 1 : 0);
  alto *= 1 - 0.3 * Math.max(0, seco) - 0.3 * suave(250, 450, y);
  // v8: EL NORTE, frio y ex industrial: menos hierba, mas baja, seca y casi sin flores
  const n = norte(x, z);
  if (n > 0) {
    mata *= 1 - 0.5 * n * (0.6 + 0.4 * suave(0.45, 0.6, fbm(x / 35 + 3, z / 35 - 9, 2)));
    alto *= 1 - 0.35 * n;
  }
  out.mata = Math.max(0, mata);
  out.alto = alto;
  out.seco = Math.min(1, Math.max(0, seco) + 0.2 * n);
  out.flor = mata > 0.3 ? Math.max(0.02, suave(0.6, 0.74, fbm(x / 19 - 70, z / 19 + 30, 3))) * mata * (1 - 0.6 * out.seco) * (1 - 0.9 * n) : 0;
  out.florTipo = Math.max(0, Math.min(3, Math.floor((fbm(x / 50 + 5, z / 50 + 9, 2) - 0.5) * 9 + 2)));
  const p = pinturaEn(x, z);
  if (p) {
    const M = MATERIALES[p];
    out.mata = dr < 0.05 ? 0 : M.mata;
    out.alto = (0.75 + 0.5 * suave(0.3, 0.75, fbm(x / 13 + 5, z / 13 + 1, 3))) * (M.alto || 1);
    out.seco = M.seco || 0;
    out.flor = M.flor ? 1 : (M.mata ? 0.03 : 0);
  }
  if (HUELLAS.length && enHuella(x, z)) { out.mata = 0; out.flor = 0; }
  return out;
}

// las HUELLAS de los modelos solidos que pone el editor (modelos.js): { x, z, hx, hz, ang, r }
export const HUELLAS = [];
export function enHuella(x, z) {
  for (const h of HUELLAS) {
    const dx = x - h.x, dz = z - h.z;
    if (Math.abs(dx) > h.r || Math.abs(dz) > h.r) continue;
    const ca = Math.cos(h.ang), sa = Math.sin(h.ang);
    if (Math.abs(dx * ca + dz * sa) < h.hx && Math.abs(-dx * sa + dz * ca) < h.hz) return true;
  }
  return false;
}
export { curvatura, EXT };
