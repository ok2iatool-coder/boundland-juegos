// EL RELIEVE del mapa de terreno (?mapa=terreno): solo el suelo, sin nada encima. Puro (sin three): de aqui leen la
// malla, el color, las rocas, la hierba, los pies y la tela, y `node boundland-bosque3d/test_terreno.mjs` lo mide.
//
// 600 x 600 m jugables (de -300 a 300; x al este, z al sur). Formas, de lo llano a lo abrupto:
//   - LA EXPLANADA: un llano grande en el centro (cota 0), casi sin ondulacion, donde empieza el 18
//   - los BANCALES del norte: tres escalones de tierra (+4,5, +10 y +16,5 m) separados por taludes empinados que no se
//     suben; cada talud tiene sus RAMPAS (carcavas suaves) por donde si
//   - LA MESETA del este: una explanada alta (+18 m, sube un poco hacia el norte) cortada por un ESCARPE de roca con
//     estratos; por una rampa de derrubios se sube
//   - las LOMAS del oeste: colinas redondas con crestas de roca
//   - LA RAMBLA: un cauce seco de grava que baja de norte a sur entre las lomas y la explanada; al cruzar los bancales
//     se encaja en un barranco
//   - LA LLANURA BAJA al sur (-3,2 m), con TRES CERROS TESTIGO (mesas de cima plana y laderas de roca) y una LAGUNA
//     SECA de barro cuarteado
//   - fuera, colinas que cierran el horizonte
export const LADO = 300;                        // jugable
export const EXT = 320;                         // hasta aqui el terreno fino
export const PASO = 1.6;                        // m entre vertices: caras de low poly que se leen
export const N = Math.round((2 * EXT) / PASO);  // 400 celdas por lado

// ---------------- ruido con semilla ----------------
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
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < octavas; i++) { s += a * ruido(x * f + i * 17.3, z * f - i * 9.1); n += a; a *= 0.5; f *= 2; }
  return s / n;
}
export function hash(i, j, k = 0) {
  let h = Math.imul(i * 73856093 ^ j * 19349663 ^ k * 83492791, 0x27d4eb2d);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
  return ((h >>> 0) % 100000) / 100000;
}
export const suave = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mezcla = (a, b, t) => a + (b - a) * t;
export const radioBorde = (x, z) => Math.pow(Math.abs(x) ** 6 + Math.abs(z) ** 6, 1 / 6);

// ---------------- las piezas del relieve ----------------
// los bancales: el borde de cada escalon es una linea que ondula; `u` crece hacia el norte
export const BANCALES = [
  { borde: 55, sube: 4.5, talud: 7, rampas: [-28, 96], nombre: 'Primer bancal' },
  { borde: 146, sube: 5.5, talud: 6, rampas: [18, -150], nombre: 'Segundo bancal' },
  { borde: 234, sube: 6.5, talud: 6, rampas: [52], nombre: 'Tercer bancal' },
];
const uBancal = (x, z) => -z + 14 * (fbm(x / 48 + 7, 3.3, 3) - 0.5) + 5 * (fbm(x / 13 + 2, 9.1, 2) - 0.5);
// la meseta: el borde del escarpe, la rampa de derrubios y la cota de arriba
export const MESETA = { borde: 152, rampaZ: 68, cota: 18, nombre: 'La meseta' };
const bordeMeseta = (z) => MESETA.borde + 20 * (fbm(z / 64 + 2, 5.5, 3) - 0.5) + 6 * (fbm(z / 12 + 1, 1.7, 2) - 0.5);
// los cerros testigo de la llanura baja: centro, radio de la cima, alto sobre la llanura
export const CERROS = [
  { x: -92, z: 214, r: 20, alto: 9, f: 0.7 },
  { x: 38, z: 262, r: 14, alto: 7, f: 2.1 },
  { x: 182, z: 196, r: 11, alto: 12, f: 4.4 },
];
export const LAGUNA = { x: 105, z: 218, rx: 32, rz: 19, giro: 0.35, cota: -4.0, nombre: 'La laguna seca' };
// la rambla: de norte a sur, entre las lomas y la explanada
const RAMBLA_PTS = [[-150, -330], [-128, -262], [-112, -196], [-98, -130], [-86, -66], [-80, -4], [-74, 58], [-58, 118], [-34, 172], [-6, 226], [30, 282], [62, 334]];

// ---------------- lineas ----------------
function polilinea(pts, paso = 1) {
  const out = [], P2 = [pts[0], ...pts, pts[pts.length - 1]];
  for (let i = 1; i < P2.length - 2; i++) {
    const [p0, p1, p2, p3] = [P2[i - 1], P2[i], P2[i + 1], P2[i + 2]];
    const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), n = Math.max(1, Math.ceil(L / paso));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
export const RAMBLA = polilinea(RAMBLA_PTS, 1.5);
const RAMBLA_S = [0];
for (let i = 1; i < RAMBLA.length; i++) RAMBLA_S.push(RAMBLA_S[i - 1] + Math.hypot(RAMBLA[i][0] - RAMBLA[i - 1][0], RAMBLA[i][1] - RAMBLA[i - 1][1]));
// rejilla de distancia al eje de la rambla y su parametro (1 m)
const DC = 1, NC = Math.round((2 * EXT) / DC) + 1, R_RAMBLA = 30;
const GD = new Float32Array(NC * NC).fill(R_RAMBLA), GS = new Float32Array(NC * NC);
for (let s = 0; s < RAMBLA.length - 1; s++) {
  const [ax, az] = RAMBLA[s], [bx, bz] = RAMBLA[s + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-9;
  const i0 = Math.max(0, Math.floor(Math.min(ax, bx) - R_RAMBLA + EXT)), i1 = Math.min(NC - 1, Math.ceil(Math.max(ax, bx) + R_RAMBLA + EXT));
  const j0 = Math.max(0, Math.floor(Math.min(az, bz) - R_RAMBLA + EXT)), j1 = Math.min(NC - 1, Math.ceil(Math.max(az, bz) + R_RAMBLA + EXT));
  for (let j = j0; j <= j1; j++) {
    const z = j - EXT;
    for (let i = i0; i <= i1; i++) {
      const x = i - EXT, k = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
      const d = Math.hypot(ax + dx * k - x, az + dz * k - z), q = j * NC + i;
      if (d < GD[q]) { GD[q] = d; GS[q] = RAMBLA_S[s] + (RAMBLA_S[s + 1] - RAMBLA_S[s]) * k; }
    }
  }
}
function bilineal(arr, x, z, fuera) {
  const gx = (x + EXT) / DC, gz = (z + EXT) / DC;
  if (gx < 0 || gz < 0 || gx > NC - 1.001 || gz > NC - 1.001) return fuera;
  const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
  const a = arr[j * NC + i], b = arr[j * NC + i + 1], c = arr[(j + 1) * NC + i], d = arr[(j + 1) * NC + i + 1];
  return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
}
export const distRambla = (x, z) => bilineal(GD, x, z, R_RAMBLA);
const paramRambla = (x, z) => bilineal(GS, x, z, 0);
// el ancho de la lamina de grava (medio) a lo largo
const anchoRambla = (s) => 3.2 + 2.2 * fbm(s / 40 + 3, 1.1, 2);

// ---------------- la forma, por capas ----------------
// devuelve la cota SIN la rambla ni el temblor; `z_` guarda las mascaras de cada zona (para el color y la hierba)
function lomasOeste(x, z) { return suave(-118, -160, x + 26 * (fbm(z / 80 + 4, 2.2, 2) - 0.5)); }
function crestaLoma(x, z) { const c = 1 - Math.abs(2 * fbm(x / 38 + 2, z / 38 - 9, 3) - 1); return c * c * c; }
function rampa(x, lista, ancho = 10) { let f = 0; for (const xr of lista) f = Math.max(f, Math.exp(-(((x - xr) / ancho) ** 2))); return f; }
function base(x, z, m) {
  // el suelo de fondo: casi llano, ondulacion larga de medio metro
  let h = 0.55 * (fbm(x / 75 + 3.1, z / 75 - 1.7, 3) - 0.5);
  // las lomas del oeste
  const wl = lomasOeste(x, z);
  h += wl * (10 * (fbm(x / 58 + 3, z / 58 - 2, 4) - 0.3) + 3.5 * crestaLoma(x, z));
  // la llanura baja al sur (con la orilla irregular): una cuesta corta y clara, no una rampa que se coma la explanada
  const sb = suave(128, 154, z + 22 * (fbm(x / 90 + 6, 0.4, 3) - 0.5));
  h -= 3.2 * sb;
  // los bancales del norte (se apagan bajo las lomas, que van por encima)
  const u = uBancal(x, z);
  let escalon = 0, talud = 0;
  BANCALES.forEach((B, k) => {
    const w = B.talud * (1 + 4.2 * rampa(x, B.rampas));
    const t = suave(B.borde - w / 2, B.borde + w / 2, u);
    escalon += B.sube * t;
    talud = Math.max(talud, Math.sin(Math.PI * t) * (1 - 0.8 * rampa(x, B.rampas)));
    if (t > 0.5) m.bancal = k + 1;
  });
  h += escalon * (1 - 0.6 * wl);
  // la meseta del este: un escarpe casi vertical, con su rampa de derrubios
  // (acaba al sur en otro escarpe: el tercer cerro testigo es un trozo que se quedo suelto)
  const xe = bordeMeseta(z), rp = Math.exp(-(((z - MESETA.rampaZ) / 18) ** 2));
  const we = 3.2 + 46 * rp, zs = 142 + 16 * (fbm(x / 50 + 31, 7.7, 3) - 0.5);
  const me = suave(xe - we / 2, xe + we / 2, x) * (1 - suave(zs - 1.8, zs + 1.8, z));
  if (me > 0) {
    const cima = MESETA.cota + 0.022 * Math.max(0, -z) + 0.7 * (fbm(x / 40 + 9, z / 40, 3) - 0.5);
    let hm = mezcla(h, cima, me);
    // estratos: repisas cada 2,2 m en la cara (no en la rampa)
    if (me > 0.04 && me < 0.97 && rp < 0.5) { const q = (hm - h) / 2.2, fl = Math.floor(q); hm = mezcla(hm, h + (fl + suave(0.5, 1, q - fl)) * 2.2, 0.55 * (1 - 2 * rp)); }
    h = hm;
  }
  m.meseta = me; m.escarpe = Math.sin(Math.PI * me) * (1 - rp); m.rampa = rp * Math.sin(Math.PI * me);
  // los cerros testigo
  for (const C of CERROS) {
    const dx = x - C.x, dz = z - C.z, d = Math.hypot(dx, dz);
    if (d > C.r * 2.2) continue;
    const a = Math.atan2(dz, dx), R = C.r * (1 + 0.16 * Math.sin(3 * a + C.f) + 0.09 * Math.sin(5 * a - C.f)), dn = d / R;
    const pie = h;
    let p;
    if (dn < 0.86) p = 1 - 0.02 * dn;                                          // la cima, plana
    else if (dn < 1.02) p = mezcla(0.98, 0.32, suave(0.86, 1.02, dn));         // la pared
    else p = 0.32 * Math.pow(1 - suave(1.02, 1.85, dn), 1.6);                  // el derrubio, concavo
    let hc = pie + C.alto * p;
    if (dn > 0.84 && dn < 1.04) { const q = (hc - pie) / 1.8, fl = Math.floor(q); hc = mezcla(hc, pie + (fl + suave(0.5, 1, q - fl)) * 1.8, 0.5); }
    h = Math.max(h, hc);
    m.cerro = Math.max(m.cerro, dn < 0.86 ? 1 : 0);
    m.paredCerro = Math.max(m.paredCerro, dn >= 0.84 && dn < 1.06 ? 1 : 0);
    m.derrubio = Math.max(m.derrubio, dn >= 1.02 && dn < 1.85 ? 1 - suave(1.02, 1.85, dn) : 0);
  }
  // la laguna seca: un fondo plano y liso en la llanura baja
  {
    const c = Math.cos(LAGUNA.giro), s = Math.sin(LAGUNA.giro), dx = x - LAGUNA.x, dz = z - LAGUNA.z;
    const e = Math.hypot((dx * c + dz * s) / LAGUNA.rx, (-dx * s + dz * c) / LAGUNA.rz) * (1 + 0.12 * (fbm(x / 9, z / 9, 2) - 0.5));
    const k = 1 - suave(0.85, 1.35, e);
    if (k > 0) h = mezcla(h, LAGUNA.cota + 0.03 * (fbm(x / 4, z / 4, 2) - 0.5), k);
    m.laguna = 1 - suave(0.9, 1.08, e);
  }
  m.lomas = wl; m.baja = sb; m.taludBancal = talud * (1 - wl);
  return h;
}
// el nivel del cauce a lo largo de la rambla: por debajo del suelo y bajando siempre (en los bancales se encaja)
const NIVEL = new Float32Array(RAMBLA.length);
{
  const m = {};
  let w = Infinity;
  for (let i = 0; i < RAMBLA.length; i++) {
    const [x, z] = RAMBLA[i];
    let hb = Infinity;
    for (const [ox, oz] of [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]]) hb = Math.min(hb, base(x + ox, z + oz, nueva(m)));
    w = Math.min(w - 0.012 * (i ? RAMBLA_S[i] - RAMBLA_S[i - 1] : 0), hb - 1.6);
    NIVEL[i] = w;
  }
}
function nivelRambla(s) {
  const g = Math.max(0, Math.min(NIVEL.length - 1.001, (s / RAMBLA_S[RAMBLA_S.length - 1]) * (NIVEL.length - 1)));
  const i = Math.floor(g);
  return NIVEL[i] + (NIVEL[i + 1] - NIVEL[i]) * (g - i);
}
function nueva(m) { m.bancal = 0; m.meseta = 0; m.escarpe = 0; m.rampa = 0; m.cerro = 0; m.paredCerro = 0; m.derrubio = 0; m.laguna = 0; m.lomas = 0; m.baja = 0; m.taludBancal = 0; m.rambla = 0; m.orillaRambla = 0; m.borde = 0; return m; }

// la cota del relieve en (x, z), sin el temblor por vertice. `m` (opcional) recibe las mascaras de zona
const _m = nueva({});
export function forma(x, z, m = _m) {
  nueva(m);
  let h = base(x, z, m);
  // la rambla: lecho de grava plano, orillas de 1-1,5 m y, en lo alto, barranco
  const d = distRambla(x, z);
  if (d < R_RAMBLA - 1) {
    const s = paramRambla(x, z), W = nivelRambla(s), b = anchoRambla(s);
    const lecho = W + 0.12 * (fbm(x / 3, z / 3, 2) - 0.5);
    const orilla = d < b ? lecho : lecho + (h - lecho) * suave(b, b + 2.5 + 0.35 * Math.max(0, h - W), d);
    h = mezcla(h, orilla, 1 - suave(b + 4 + 0.5 * Math.max(0, h - W), b + 12 + 0.8 * Math.max(0, h - W), d));
    m.rambla = 1 - suave(b - 0.4, b + 0.5, d);
    m.orillaRambla = d < b + 6 ? Math.sin(Math.PI * suave(b - 0.5, b + 4, d)) : 0;
  }
  // el borde del mapa: colinas que suben y cierran la vista
  const e = radioBorde(x, z) + 14 * (fbm(x / 50 + 50, z / 50 - 20, 2) - 0.5);
  if (e > 284) { h += 26 * suave(284, 360, e) * (0.5 + fbm(x / 70 + 9, z / 70 - 4, 3)); m.borde = suave(284, 300, e); }
  return h;
}

// ---------------- la rejilla del terreno fino ----------------
// el temblor de cada vertice (las facetas del low poly): casi nada en las explanadas (que se lean llanas), mas en
// taludes, lomas y roca
export const H = new Float32Array((N + 1) * (N + 1));
export const DIAG = new Uint8Array(N * N);
{
  const m = {};
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const x = -EXT + i * PASO, z = -EXT + j * PASO;
      const h = forma(x, z, m);
      const amp = 0.05 + 0.22 * m.lomas + 0.25 * m.taludBancal + 0.5 * m.escarpe + 0.45 * m.paredCerro + 0.2 * m.derrubio + 0.15 * m.orillaRambla
        - 0.04 * m.laguna;
      H[j * (N + 1) + i] = h + (hash(i, j) - 0.5) * amp;
    }
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) DIAG[j * N + i] = hash(i, j, 1) < 0.5 ? 0 : 1;
}
// la altura EXACTA de la cara pintada (pies, IK y tela pisan la faceta)
export function altura(x, z) {
  const gx = (x + EXT) / PASO, gz = (z + EXT) / PASO;
  if (gx < 0 || gz < 0 || gx > N || gz > N) return forma(x, z);
  const i = Math.min(N - 1, Math.floor(gx)), j = Math.min(N - 1, Math.floor(gz)), fx = gx - i, fz = gz - j, f = N + 1;
  const h00 = H[j * f + i], h10 = H[j * f + i + 1], h01 = H[(j + 1) * f + i], h11 = H[(j + 1) * f + i + 1];
  if (DIAG[j * N + i] === 0) return fx >= fz ? h00 + (h10 - h00) * fx + (h11 - h10) * fz : h00 + (h01 - h00) * fz + (h11 - h01) * fx;
  return fx + fz <= 1 ? h00 + (h10 - h00) * fx + (h01 - h00) * fz : h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
}
// la pendiente: lo vertical de la normal (1 llano, 0 pared) y el gradiente
export function normalY(x, z, e = 0.8) {
  const dx = altura(x + e, z) - altura(x - e, z), dz = altura(x, z + e) - altura(x, z - e);
  return (2 * e) / Math.hypot(dx, 2 * e, dz);
}
export function gradiente(x, z, e = 0.8) {
  return [(altura(x + e, z) - altura(x - e, z)) / (2 * e), (altura(x, z + e) - altura(x, z - e)) / (2 * e)];
}
// la curvatura en cada vertice (positiva en lo hondo): oscurece vaguadas y pies de talud, aclara lomos y cantos
export const CURVA = new Float32Array((N + 1) * (N + 1));
{
  const f = N + 1;
  for (let j = 1; j < N; j++) for (let i = 1; i < N; i++) { const k = j * f + i; CURVA[k] = (H[k - 1] + H[k + 1] + H[k - f] + H[k + f]) / 4 - H[k]; }
}
export function curvatura(x, z) {
  const i = Math.max(0, Math.min(N, Math.round((x + EXT) / PASO))), j = Math.max(0, Math.min(N, Math.round((z + EXT) / PASO)));
  return CURVA[j * (N + 1) + i];
}
// la curvatura de un recuadro de vertices otra vez (tras editar las alturas)
export function recalcularCurva(i0, j0, i1, j1) {
  const f = N + 1;
  for (let j = Math.max(1, j0 - 1); j <= Math.min(N - 1, j1 + 1); j++) {
    for (let i = Math.max(1, i0 - 1); i <= Math.min(N - 1, i1 + 1); i++) { const k = j * f + i; CURVA[k] = (H[k - 1] + H[k + 1] + H[k - f] + H[k + f]) / 4 - H[k]; }
  }
}

// ---------------- lo EDITADO a mano (editor.js; se guarda en datos/terreno_edicion.json) ----------------
// alturas: H es el relieve + lo editado (el original queda en BASE); PINTURA: el suelo forzado de cada celda de la
// rejilla (0 = el de siempre; los numeros, MATERIALES)
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
];
export function celda(x, z) {
  const i = Math.floor((x + EXT) / PASO), j = Math.floor((z + EXT) / PASO);
  return i < 0 || j < 0 || i >= N || j >= N ? -1 : j * N + i;
}
export function pinturaEn(x, z) { const c = celda(x, z); return c < 0 ? 0 : PINTURA[c]; }
// cuanto se ha subido o bajado a mano en (x, z), por la misma cara que `altura`; y la forma con eso sumado (la usan
// las paredes del escarpe, que no van por la rejilla)
export function deltaEn(x, z) {
  const gx = (x + EXT) / PASO, gz = (z + EXT) / PASO;
  if (gx < 0 || gz < 0 || gx > N || gz > N) return 0;
  const i = Math.min(N - 1, Math.floor(gx)), j = Math.min(N - 1, Math.floor(gz)), fx = gx - i, fz = gz - j, f = N + 1;
  const a = j * f + i, b = a + 1, c = a + f, d = c + 1;
  const h00 = H[a] - BASE[a], h10 = H[b] - BASE[b], h01 = H[c] - BASE[c], h11 = H[d] - BASE[d];
  if (DIAG[j * N + i] === 0) return fx >= fz ? h00 + (h10 - h00) * fx + (h11 - h10) * fz : h00 + (h01 - h00) * fz + (h11 - h01) * fx;
  return fx + fz <= 1 ? h00 + (h10 - h00) * fx + (h01 - h00) * fz : h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
}
export const formaEditada = (x, z) => forma(x, z) + deltaEn(x, z);

// ---------------- la zona (para el nombre que se ensena y el color) ----------------
export function zona(x, z) {
  const m = {};
  forma(x, z, m);
  if (m.borde > 0.5) return 'Los cerros del borde';
  if (m.rambla > 0.5 || m.orillaRambla > 0.6) return 'La rambla';
  if (m.cerro > 0.5) return 'Cima de cerro testigo';
  if (m.paredCerro > 0.5 || m.derrubio > 0.5) return 'Ladera de cerro';
  if (m.laguna > 0.5) return LAGUNA.nombre;
  if (m.meseta > 0.9) return MESETA.nombre;
  if (m.escarpe > 0.3) return 'El escarpe';
  if (m.rampa > 0.3) return 'Rampa de la meseta';
  if (m.lomas > 0.4) return 'Las lomas';
  if (m.taludBancal > 0.4) return 'Talud';
  // lo que une dos explanadas: la cuesta (ni una ni otra)
  if (normalY(x, z) < Math.cos(9 * Math.PI / 180)) return 'Cuesta';
  if (m.bancal) return BANCALES[m.bancal - 1].nombre;
  if (m.baja > 0.5) return 'La llanura baja';
  return 'La explanada';
}

// ---------------- el 18 no sube paredes ----------------
// pendiente maxima que se sube andando (35 grados); por encima, el paso cuesta arriba se tuerce a lo largo de la
// curva de nivel, y si aun sube, no se da. Cuesta abajo se baja (y por un escarpe se cae)
export const PENDIENTE_MAX = Math.tan(35 * Math.PI / 180);
export function pasoPermitido(desde, p) {
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
  const e = radioBorde(p.x, p.z), MAX = 282;
  if (e > MAX) { p.x *= MAX / e; p.z *= MAX / e; }
}
export const SALIDA = { x: 4, z: 36, giro: Math.PI };
