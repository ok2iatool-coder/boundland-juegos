// EL RELIEVE del mapa del mundo (?mapa=mundo): la GEOGRAFIA de los planos del mundo abierto, sin nada encima (pedido el
// 19-10: "empieza por hacer el mapa, solo la zona de geografia"). Las cotas NO se escriben aqui: salen de
// diseno/planos/mapa.py por exportar_juego.py a web/datos/mundo/ (relieve, agua, el sitio de cada vertice y geo.json).
// Puro (sin three); de aqui leen el suelo, el agua, la hierba, el editor, los pies y la tela.
//
// 6 x 6 km (de -3000 a 3000; x al este, z al SUR; v6 de los planos). La Base queda al sur (z = 2400), la Sierra al
// norte (z = -3000), los Picos de Levante al este y el Linde al oeste. Rejilla de 8 m (751 x 751 vertices): caras de
// low poly grandes, que de lejos se leen como montes y de cerca como el suelo del 18. El suelo se pinta por trozos
// (suelo.js): fino cerca del 18 y grueso lejos.
//
// Misma interfaz que terreno/relieve.js (el editor y la hierba son copias de los del terreno).
const URL_DATOS = new URL('../../datos/mundo/', import.meta.url);
async function leer(nombre) {
  if (typeof window !== 'undefined') {
    const r = await fetch(new URL(nombre, URL_DATOS), { cache: 'no-store' });
    if (!r.ok) throw new Error(`no se pudo leer datos/mundo/${nombre} (${r.status}): falta correr diseno/planos/exportar_juego.py`);
    return nombre.endsWith('.json') ? r.json() : r.arrayBuffer();
  }
  const { readFile } = await import('node:fs/promises');
  const b = await readFile(new URL(nombre, URL_DATOS));
  return nombre.endsWith('.json') ? JSON.parse(b.toString('utf8')) : b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}
const [GEO_, BUF_F, BUF_A, BUF_Z] = await Promise.all(['geo.json', 'relieve.bin', 'agua.bin', 'zonas.bin'].map(leer));
export const GEO = GEO_;

export const EXT = GEO.EXT;                      // 3000: el mundo de -3000 a 3000
export const PASO = GEO.PASO;                    // 8 m entre vertices
export const N = GEO.N;                          // 1875 celdas por lado
export const LADO = EXT - 10;                    // jugable
export const COTA_NIEVE = GEO.cotaNieve;
export const ZONAS = GEO.zonas;
export const SIN_AGUA = -9999;
const f = N + 1;
// la forma de los planos (con cauces y fondos de lagos): Uint16 en pasos de 2,5 cm
const F = new Float32Array(f * f);
{
  const u = new Uint16Array(BUF_F), { base, paso } = GEO.relieve;
  for (let k = 0; k < F.length; k++) F[k] = base + u[k] * paso;
}
// la cota del agua en cada vertice (SIN_AGUA donde no hay): en el fichero, solo los vertices con agua
export const AGUA = new Float32Array(f * f).fill(SIN_AGUA);
{
  const n = new Uint32Array(BUF_A, 0, 1)[0], idx = new Uint32Array(BUF_A, 4, n), cota = new Float32Array(BUF_A, 4 + 4 * n, n);
  for (let k = 0; k < n; k++) AGUA[idx[k]] = cota[k];
}
export const ZN = new Uint8Array(BUF_Z);         // el sitio de cada vertice (indice de ZONAS)

// ---------------- ruido con semilla (el de terreno/relieve.js) ----------------
function azar(semilla) {
  let s = semilla >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export { azar };
const P = (() => { const r = azar(29), a = new Float32Array(256 * 256); for (let i = 0; i < a.length; i++) a[i] = r(); return a; })();
function ruido(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), w = fz * fz * (3 - 2 * fz);
  const v = (i, j) => P[((i & 255) << 8) | (j & 255)];
  const a = v(xi, zi), b = v(xi + 1, zi), c = v(xi, zi + 1), d = v(xi + 1, zi + 1);
  const ab = a + (b - a) * u, cd = c + (d - c) * u;
  return ab + (cd - ab) * w;
}
export function fbm(x, z, octavas = 4) {
  let s = 0, a = 0.5, fr = 1, n = 0;
  for (let i = 0; i < octavas; i++) { s += a * ruido(x * fr + i * 17.3, z * fr - i * 9.1); n += a; a *= 0.5; fr *= 2; }
  return s / n;
}
export function hash(i, j, k = 0) {
  let h = Math.imul(i * 73856093 ^ j * 19349663 ^ k * 83492791, 0x27d4eb2d);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
  return ((h >>> 0) % 100000) / 100000;
}
export const suave = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// el borde del mundo es un cuadrado
export const radioBorde = (x, z) => Math.max(Math.abs(x), Math.abs(z));

// ---------------- la forma (sin el temblor de los vertices) ----------------
// fuera de la rejilla: lo que hay en el borde sigue, en montes que bajan un poco y crestas (sin ellas, detras de la
// Sierra y de los Picos quedaba una meseta nevada y plana como una mesa)
const cresta = (x, z) => 1 - Math.abs(2 * fbm(x, z, 4) - 1);
function fuera(x, z) {
  const cx = Math.max(-EXT, Math.min(EXT, x)), cz = Math.max(-EXT, Math.min(EXT, z));
  const borde = bilinealF(cx, cz), e = radioBorde(x, z) - EXT;
  return borde * (1 - 0.35 * suave(0, 3000, e)) + (80 + 0.5 * Math.max(0, borde)) * (cresta(x / 900 + 3, z / 900 - 7) - 0.45) * suave(0, 900, e);
}
function bilinealF(x, z) {
  const gx = Math.max(0, Math.min(N - 1e-6, (x + EXT) / PASO)), gz = Math.max(0, Math.min(N - 1e-6, (z + EXT) / PASO));
  const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
  const a = F[j * f + i], b = F[j * f + i + 1], c = F[(j + 1) * f + i], d = F[(j + 1) * f + i + 1];
  return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
}
// el vertice mas cercano (para el sitio y el agua)
export const vertice = (x, z) => Math.max(0, Math.min(N, Math.round((z + EXT) / PASO))) * f + Math.max(0, Math.min(N, Math.round((x + EXT) / PASO)));
export const dentroRejilla = (x, z) => Math.abs(x) <= EXT && Math.abs(z) <= EXT;
const _m = {};
// la cota de los planos en (x, z); `m` (opcional) recibe el sitio (`zona`, indice de ZONAS) y el agua de alli
export function forma(x, z, m = _m) {
  if (!dentroRejilla(x, z)) { m.zona = -1; m.agua = SIN_AGUA; return fuera(x, z); }
  const k = vertice(x, z);
  m.zona = ZN[k];
  m.agua = AGUA[k];
  return bilinealF(x, z);
}

// ---------------- la rejilla que se pinta ----------------
// el temblor de cada vertice (las facetas del low poly): casi nada en los llanos y en el agua, mas en cuestas y montes
export const H = new Float32Array(f * f);
export const DIAG = new Uint8Array(N * N);
{
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const k = j * f + i, h = F[k];
      const dx = F[j * f + Math.min(N, i + 1)] - F[j * f + Math.max(0, i - 1)], dz = F[Math.min(N, j + 1) * f + i] - F[Math.max(0, j - 1) * f + i];
      const pend = Math.hypot(dx, dz) / (2 * PASO);
      // (en las paredes casi nada: con un metro de temblor en una cara casi vertical, cada triangulo miraba a un lado y
      // el Cortado salia en dientes de sierra)
      let amp = (0.12 + 0.45 * Math.min(1, pend) + 0.5 * suave(250, 650, h)) * (1 - suave(0.7, 1.4, pend));
      // el agua y lo que la rodea, liso (si no, el suelo asoma por encima de la lamina)
      let cerca = AGUA[k] > SIN_AGUA;
      for (const o of [-1, 1, -f, f]) if (k + o >= 0 && k + o < f * f && AGUA[k + o] > SIN_AGUA) cerca = true;
      if (cerca) amp = 0.02;
      H[k] = h + (hash(i, j) - 0.5) * amp;
    }
  }
  // la diagonal de cada celda: al azar en lo llano (el low poly), y en las paredes la que sigue la curva de nivel (la
  // de menos desnivel): al azar, el Cortado salia en dientes de sierra
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = H[j * f + i], b = H[j * f + i + 1], c = H[(j + 1) * f + i], d = H[(j + 1) * f + i + 1];
      const salto = Math.max(a, b, c, d) - Math.min(a, b, c, d);
      DIAG[j * N + i] = salto > 5 ? (Math.abs(a - d) <= Math.abs(b - c) ? 0 : 1) : (hash(i, j, 1) < 0.5 ? 0 : 1);
    }
  }
}
// la altura EXACTA de la cara pintada (pies, IK y tela pisan la faceta)
export function altura(x, z) {
  const gx = (x + EXT) / PASO, gz = (z + EXT) / PASO;
  if (gx < 0 || gz < 0 || gx > N || gz > N) return fuera(x, z);
  const i = Math.min(N - 1, Math.floor(gx)), j = Math.min(N - 1, Math.floor(gz)), fx = gx - i, fz = gz - j;
  const h00 = H[j * f + i], h10 = H[j * f + i + 1], h01 = H[(j + 1) * f + i], h11 = H[(j + 1) * f + i + 1];
  if (DIAG[j * N + i] === 0) return fx >= fz ? h00 + (h10 - h00) * fx + (h11 - h10) * fz : h00 + (h01 - h00) * fz + (h11 - h01) * fx;
  return fx + fz <= 1 ? h00 + (h10 - h00) * fx + (h01 - h00) * fz : h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
}
export function normalY(x, z, e = 1.5) {
  const dx = altura(x + e, z) - altura(x - e, z), dz = altura(x, z + e) - altura(x, z - e);
  return (2 * e) / Math.hypot(dx, 2 * e, dz);
}
export function gradiente(x, z, e = 1.5) {
  return [(altura(x + e, z) - altura(x - e, z)) / (2 * e), (altura(x, z + e) - altura(x, z - e)) / (2 * e)];
}
// la curvatura en cada vertice (positiva en lo hondo): oscurece vaguadas, aclara lomos
export const CURVA = new Float32Array(f * f);
export function recalcularCurva(i0, j0, i1, j1) {
  for (let j = Math.max(1, j0 - 1); j <= Math.min(N - 1, j1 + 1); j++) {
    for (let i = Math.max(1, i0 - 1); i <= Math.min(N - 1, i1 + 1); i++) { const k = j * f + i; CURVA[k] = (H[k - 1] + H[k + 1] + H[k - f] + H[k + f]) / 4 - H[k]; }
  }
}
recalcularCurva(0, 0, N, N);
export function curvatura(x, z) {
  return CURVA[vertice(x, z)];
}

// ---------------- el agua ----------------
// la cota del agua en (x, z): la de los vertices de alrededor que tienen agua (la mas alta), o SIN_AGUA
export function nivelAgua(x, z) {
  if (!dentroRejilla(x, z)) return SIN_AGUA;
  const gx = (x + EXT) / PASO, gz = (z + EXT) / PASO, i = Math.min(N - 1, Math.floor(gx)), j = Math.min(N - 1, Math.floor(gz));
  return Math.max(AGUA[j * f + i], AGUA[j * f + i + 1], AGUA[(j + 1) * f + i], AGUA[(j + 1) * f + i + 1]);
}
// a cuantas celdas esta el agua (0 = en el agua; hasta 12): la grava de las orillas y donde no crece la hierba
export const DIST_AGUA = new Uint8Array(f * f).fill(12);
{
  for (let k = 0; k < f * f; k++) if (AGUA[k] > SIN_AGUA) DIST_AGUA[k] = 0;
  // dos pasadas (ida y vuelta) de distancia en rejilla
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const k = j * f + i;
    if (i > 0) DIST_AGUA[k] = Math.min(DIST_AGUA[k], DIST_AGUA[k - 1] + 1);
    if (j > 0) DIST_AGUA[k] = Math.min(DIST_AGUA[k], DIST_AGUA[k - f] + 1);
  }
  for (let j = N; j >= 0; j--) for (let i = N; i >= 0; i--) {
    const k = j * f + i;
    if (i < N) DIST_AGUA[k] = Math.min(DIST_AGUA[k], DIST_AGUA[k + 1] + 1);
    if (j < N) DIST_AGUA[k] = Math.min(DIST_AGUA[k], DIST_AGUA[k + f] + 1);
  }
}
export const distAgua = (x, z) => (dentroRejilla(x, z) ? DIST_AGUA[vertice(x, z)] * PASO : 99);

// ---------------- lo EDITADO a mano (editor.js; se guarda en datos/mundo_edicion.json) ----------------
export const BASE = H.slice();
export const PINTURA = new Uint8Array(N * N);
export const MATERIALES = [
  { id: 0, nombre: 'Como era', color: null },
  { id: 1, nombre: 'Hierba', color: 0x6f8448, mata: 1, alto: 1 },
  { id: 2, nombre: 'Hierba alta', color: 0x55693a, mata: 1, alto: 1.6 },
  { id: 3, nombre: 'Hierba seca', color: 0xa9a265, mata: 0.85, alto: 0.8, seco: 1 },
  { id: 4, nombre: 'Flores', color: 0x7f9150, mata: 1, alto: 0.9, flor: 1 },
  { id: 5, nombre: 'Tierra', color: 0x7d6b53, mata: 0 },
  { id: 6, nombre: 'Roca', color: 0x968f80, mata: 0 },
  { id: 7, nombre: 'Grava', color: 0xa59c88, mata: 0 },
  { id: 8, nombre: 'Barro claro', color: 0xc9b998, mata: 0 },
  { id: 9, nombre: 'Nieve', color: 0xeef2f3, mata: 0 },
];
export function celda(x, z) {
  const i = Math.floor((x + EXT) / PASO), j = Math.floor((z + EXT) / PASO);
  return i < 0 || j < 0 || i >= N || j >= N ? -1 : j * N + i;
}
export function pinturaEn(x, z) { const c = celda(x, z); return c < 0 ? 0 : PINTURA[c]; }
export function deltaEn(x, z) {
  const gx = (x + EXT) / PASO, gz = (z + EXT) / PASO;
  if (gx < 0 || gz < 0 || gx > N || gz > N) return 0;
  const i = Math.min(N - 1, Math.floor(gx)), j = Math.min(N - 1, Math.floor(gz)), fx = gx - i, fz = gz - j;
  const a = j * f + i, b = a + 1, c = a + f, d = c + 1;
  const h00 = H[a] - BASE[a], h10 = H[b] - BASE[b], h01 = H[c] - BASE[c], h11 = H[d] - BASE[d];
  if (DIAG[j * N + i] === 0) return fx >= fz ? h00 + (h10 - h00) * fx + (h11 - h10) * fz : h00 + (h01 - h00) * fz + (h11 - h01) * fx;
  return fx + fz <= 1 ? h00 + (h10 - h00) * fx + (h01 - h00) * fz : h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
}
export const formaEditada = (x, z) => forma(x, z) + deltaEn(x, z);

// ---------------- el sitio (el nombre que se ensena arriba a la izquierda) ----------------
export function zona(x, z) {
  if (!dentroRejilla(x, z)) return 'Fuera del mapa';
  return ZONAS[ZN[vertice(x, z)]] || 'El llano';
}

// ---------------- el 18 no sube paredes ni se mete en el agua honda ----------------
export const PENDIENTE_MAX = Math.tan(35 * Math.PI / 180);
export const HONDO = 0.9;                       // con mas agua que esto encima, no se entra (aun no nada)
export function pasoPermitido(desde, p) {
  const nivel = nivelAgua(p.x, p.z);
  if (nivel > SIN_AGUA && nivel - altura(p.x, p.z) > HONDO && !(nivelAgua(desde.x, desde.z) - altura(desde.x, desde.z) > HONDO)) { p.x = desde.x; p.z = desde.z; return; }
  const dx = p.x - desde.x, dz = p.z - desde.z, L = Math.hypot(dx, dz);
  if (L < 1e-6) return;
  const sube = (altura(p.x, p.z) - altura(desde.x, desde.z)) / L;
  if (sube <= PENDIENTE_MAX) return;
  const [gx, gz] = gradiente(p.x, p.z), g = Math.hypot(gx, gz) || 1, ux = gx / g, uz = gz / g;
  const contra = dx * ux + dz * uz;
  if (contra > 0) { p.x = desde.x + dx - ux * contra; p.z = desde.z + dz - uz * contra; }
  const L2 = Math.hypot(p.x - desde.x, p.z - desde.z);
  if (L2 > 1e-6 && (altura(p.x, p.z) - altura(desde.x, desde.z)) / L2 > PENDIENTE_MAX) { p.x = desde.x; p.z = desde.z; }
}
export function limitar(p) {
  p.x = Math.max(-LADO, Math.min(LADO, p.x));
  p.z = Math.max(-LADO, Math.min(LADO, p.z));
}
export const SALIDA = GEO.salida;

// v8: EL NORTE y EL SUR. La frontera (el Barranco y el control de la Carretera) va siempre hacia el este: una z por cada
// x. norte(x, z) da 0 en el sur y 1 en el norte, con un paso de `ancho` m a cada lado.
const FRONT = GEO.frontera || { puntos: [[-1e9, -1e9], [1e9, -1e9]], ancho: 150 };
export function norte(x, z) {
  const P = FRONT.puntos;
  let fz = P[P.length - 1][1];
  if (x <= P[0][0]) fz = P[0][1];
  else for (let k = 1; k < P.length; k++) {
    if (x <= P[k][0]) { const t = (x - P[k - 1][0]) / (P[k][0] - P[k - 1][0]); fz = P[k - 1][1] + (P[k][1] - P[k - 1][1]) * t; break; }
  }
  return suave(-FRONT.ancho, FRONT.ancho, fz - z);          // el norte es -z
}
