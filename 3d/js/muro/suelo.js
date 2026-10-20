// El SUELO del mapa del muro: relieve, arroyo con su charca, caminitos, donde van las rocas y que crece en cada sitio.
// Solo datos y funciones (no dibuja nada): de aqui leen el terreno, el agua, las rocas, la hierba, los pies y la tela.
// Todo con semilla fija: el mapa sale igual en cada carga.
//
// La pradera es una CUENCA de 300 x 300 m: lomas, crestas con rocas que asoman, bancales en algunas laderas, montones,
// un arroyo que nace al pie del acantilado del oeste, cruza la pradera (tres vados donde lo cruzan los caminos) y acaba
// en una charca al este; acantilados con estratos al sur, este y oeste (con una boca al sur por la que entra el camino)
// y el norte llano, donde ira el muro. Fuera, una meseta y colinas que se pierden en la bruma.
import * as THREE from 'three';
import { azar } from '../texturas.js';

export const LADO = 150;                        // el 18 no pasa de +-148
export const EXT = 200;                         // hasta aqui el terreno fino; mas alla las afueras, en grueso
export const PASO = 1.25;                       // m entre vertices: caras de low poly que todavia se leen
export const N = Math.round((2 * EXT) / PASO);  // 320 celdas por lado

// ---------------- ruido con semilla ----------------
function crearRuido(semilla) {
  const r = azar(semilla), P = new Float32Array(256 * 256);
  for (let i = 0; i < P.length; i++) P[i] = r();
  const v = (x, z) => P[((x & 255) << 8) | (z & 255)];
  return (x, z) => {
    const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi;
    const u = fx * fx * (3 - 2 * fx), w = fz * fz * (3 - 2 * fz);
    const a = v(xi, zi), b = v(xi + 1, zi), c = v(xi, zi + 1), d = v(xi + 1, zi + 1);
    const ab = a + (b - a) * u, cd = c + (d - c) * u;
    return ab + (cd - ab) * w;                   // 0..1
  };
}
const ruido = crearRuido(7);
export function fbm(x, z, octavas = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < octavas; i++) { s += a * ruido(x * f + i * 17.3, z * f - i * 9.1); n += a; a *= 0.5; f *= 2; }
  return s / n;
}
// azar fijo por celda o vertice
export function hash(i, j, k = 0) {
  let h = Math.imul(i * 73856093 ^ j * 19349663 ^ k * 83492791, 0x27d4eb2d);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
  return ((h >>> 0) % 100000) / 100000;
}
// rampa suave de a a b (si a > b, baja)
export const suave = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mezcla = (a, b, t) => a + (b - a) * t;
// el "radio" del cuadrado redondeado (superelipse): la forma de la cuenca
export const radioCuenca = (x, z) => Math.pow(Math.abs(x) ** 6 + Math.abs(z) ** 6, 1 / 6);

// ---------------- lineas: caminos y arroyo ----------------
function linea(puntos, paso = 0.8) {
  const curva = new THREE.CatmullRomCurve3(puntos.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const largo = curva.getLength();
  const pts = curva.getSpacedPoints(Math.ceil(largo / paso));
  const s = pts.map((_, i) => (i / (pts.length - 1)) * largo);
  return { curva, largo, pts, s };
}

// todos los caminos acaban en el NORTE (z -150), donde ira el muro: el principal entra por la boca del sur, un lazo
// por el oeste, un ramal al este que se parte y dos sendas finas. El ultimo es el trozo del principal que sale por la
// boca (aparte, para que el 18 empiece dentro)
export const CAMINOS = [
  { ancho: 1.05, puntos: [[6, 142], [2, 118], [-10, 96], [-6, 72], [8, 50], [12, 26], [0, 4], [-14, -18], [-10, -44], [4, -66], [6, -92], [-2, -116], [0, -146]] },
  { ancho: 0.75, puntos: [[-6, 72], [-26, 66], [-48, 70], [-70, 58], [-88, 34], [-96, 6], [-84, -22], [-60, -34], [-36, -28], [-14, -18]] },
  { ancho: 0.75, puntos: [[12, 26], [34, 30], [58, 22], [80, 32], [104, 48], [124, 72]] },
  { ancho: 0.65, puntos: [[58, 22], [66, -4], [62, -34], [74, -62], [94, -86], [104, -112], [100, -146]] },
  { ancho: 0.6, puntos: [[4, -66], [-22, -78], [-48, -96], [-60, -122], [-58, -146]] },
  { ancho: 1.05, puntos: [[6, 142], [8, 166], [10, 205]], fuera: true },
].map((c) => ({ ...c, ...linea(c.puntos) }));

// el arroyo: nace al pie del acantilado del oeste y acaba en la charca del este
export const ARROYO = linea([[-141, 27], [-128, 21], [-112, 15], [-96, 16], [-80, 8], [-60, 0], [-40, 4], [-22, 9], [-6, 13],
  [8, 15], [26, 11], [44, 6], [62, 7], [80, 2], [96, -6], [109, -12]]);
export const MANANTIAL = { x: -143.5, z: 28 };
export const CHARCA = { x: 117, z: -14, r: 8.5 };
export const radioCharca = (a) => CHARCA.r * (1 + 0.16 * Math.sin(3 * a + 1.2) + 0.09 * Math.sin(5 * a - 0.4));
export function dnCharca(x, z) {
  const dx = x - CHARCA.x, dz = z - CHARCA.z;
  return Math.hypot(dx, dz) / radioCharca(Math.atan2(dz, dx));
}

// ---------------- rejillas de distancia (0,5 m) ----------------
const DC = 0.5, NC = Math.round((2 * EXT) / DC) + 1;
function rejilla(lineas, rango, conParam) {
  const dist = new Float32Array(NC * NC).fill(rango);
  const param = conParam ? new Float32Array(NC * NC) : null;
  for (const L of lineas) {
    const media = (L.ancho || 0) / 2, R = rango + media;
    for (let s = 0; s < L.pts.length - 1; s++) {
      const a = L.pts[s], b = L.pts[s + 1];
      const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1e-9;
      const i0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - R + EXT) / DC)), i1 = Math.min(NC - 1, Math.ceil((Math.max(a.x, b.x) + R + EXT) / DC));
      const j0 = Math.max(0, Math.floor((Math.min(a.z, b.z) - R + EXT) / DC)), j1 = Math.min(NC - 1, Math.ceil((Math.max(a.z, b.z) + R + EXT) / DC));
      for (let j = j0; j <= j1; j++) {
        const z = j * DC - EXT;
        for (let i = i0; i <= i1; i++) {
          const x = i * DC - EXT;
          const k = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
          const d = Math.hypot(a.x + dx * k - x, a.z + dz * k - z) - media;
          const q = j * NC + i;
          if (d < dist[q]) { dist[q] = d; if (param) param[q] = L.s[s] + (L.s[s + 1] - L.s[s]) * k; }
        }
      }
    }
  }
  return { dist, param };
}
function bilineal(arr, x, z, fuera) {
  const gx = (x + EXT) / DC, gz = (z + EXT) / DC;
  if (gx < 0 || gz < 0 || gx > NC - 1.001 || gz > NC - 1.001) return fuera;
  const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
  const a = arr[j * NC + i], b = arr[j * NC + i + 1], c = arr[(j + 1) * NC + i], d = arr[(j + 1) * NC + i + 1];
  return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
}
const RANGO_CAMINO = 8, RANGO_ARROYO = 26;
const GC = rejilla(CAMINOS, RANGO_CAMINO, false);
const GA = rejilla([ARROYO], RANGO_ARROYO, true);
// distancia al BORDE del camino mas cercano (negativa dentro)
export const bordeCamino = (x, z) => bilineal(GC.dist, x, z, RANGO_CAMINO);
// distancia al EJE del arroyo y el punto del arroyo (m desde el manantial) que cae mas cerca
export const distArroyo = (x, z) => bilineal(GA.dist, x, z, RANGO_ARROYO);
const paramArroyo = (x, z) => bilineal(GA.param, x, z, 0);

// los VADOS: donde un camino cruza el arroyo, el cauce se abre y baja (se cruza mojandose los pies)
function cruce(a, b, c, d) {
  const r1x = b.x - a.x, r1z = b.z - a.z, r2x = d.x - c.x, r2z = d.z - c.z;
  const den = r1x * r2z - r1z * r2x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * r2z - (c.z - a.z) * r2x) / den, u = ((c.x - a.x) * r1z - (c.z - a.z) * r1x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}
export const VADOS = [];
for (const c of CAMINOS) {
  for (let i = 0; i < c.pts.length - 1; i++) {
    for (let k = 0; k < ARROYO.pts.length - 1; k++) {
      const t = cruce(ARROYO.pts[k], ARROYO.pts[k + 1], c.pts[i], c.pts[i + 1]);
      if (t === null) continue;
      const s = ARROYO.s[k] + (ARROYO.s[k + 1] - ARROYO.s[k]) * t;
      if (VADOS.some((v) => Math.abs(v.s - s) < 4)) continue;
      const p = ARROYO.pts[k];
      VADOS.push({ s, x: p.x + (ARROYO.pts[k + 1].x - p.x) * t, z: p.z + (ARROYO.pts[k + 1].z - p.z) * t });
    }
  }
}
const vado = (s) => { let f = 0; for (const v of VADOS) f = Math.max(f, Math.exp(-(((s - v.s) / 2.8) ** 2))); return f; };

// ---------------- el relieve ----------------
// lomas grandes y medianas, crestas en algunas zonas (donde asoman las rocas), el valle del arroyo y la subida al norte
function crestaEn(x, z) {
  const m = suave(0.56, 0.7, fbm(x / 130 + 20, z / 130 - 7, 2));
  if (m <= 0) return 0;
  const c = 1 - Math.abs(2 * fbm(x / 46 + 2, z / 46 - 9, 3) - 1);
  return m * c * c * c;
}
function alturaLisa(x, z) {
  let h = 7 * (fbm(x / 95 + 3.1, z / 95 - 1.7, 4) - 0.5) + 2.4 * (fbm(x / 34 + 8, z / 34 - 5, 3) - 0.5);
  h += 3.5 * suave(-30, -150, z);
  h += 3.4 * crestaEn(x, z);
  h -= 1.7 * Math.exp(-((distArroyo(x, z) / 22) ** 2));
  return h;
}

// el nivel del agua a lo largo del arroyo: por debajo del terreno y bajando siempre (aunque el terreno suba: ahi el
// arroyo se encaja y deja ver la tierra de las orillas)
const NIVEL = new Float32Array(ARROYO.pts.length);
{
  let w = Infinity;
  const paso = ARROYO.largo / (ARROYO.pts.length - 1);
  ARROYO.pts.forEach((p, i) => {
    let hb = Infinity;
    for (const [ox, oz] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]]) hb = Math.min(hb, alturaLisa(p.x + ox, p.z + oz));
    w = Math.min(w - 0.004 * paso, hb - 0.7);
    NIVEL[i] = w;
  });
}
export const NIVEL_CHARCA = NIVEL[NIVEL.length - 1] - 0.02;
function nivel(s) {
  const g = Math.max(0, Math.min(NIVEL.length - 1.001, (s / ARROYO.largo) * (NIVEL.length - 1)));
  const i = Math.floor(g);
  return NIVEL[i] + (NIVEL[i + 1] - NIVEL[i]) * (g - i);
}
// el cauce en el punto s: cota del agua, medio ancho de la lamina, hondo y alto de la orilla
const _cauce = { W: 0, ancho: 1, prof: 0.4, banco: 0.6, vado: 0 };
export function cauce(s, out = _cauce) {
  const tap = suave(-1, 10, s), fv = vado(s);
  out.W = nivel(s);
  out.ancho = (0.5 + 1.25 * tap) * (0.85 + 0.3 * fbm(s / 11 + 4.4, 7.7, 2)) * (1 + 0.35 * fv);
  out.prof = 0.42 * tap * (1 - 0.8 * fv);
  out.banco = 0.6 * (1 - 0.7 * fv);
  out.vado = fv;
  return out;
}

function arroyoForma(x, z, h) {
  const d = distArroyo(x, z);
  if (d >= RANGO_ARROYO - 1) return h;
  const c = cauce(paramArroyo(x, z));
  const p = d < c.ancho ? -c.prof * (1 - (d / c.ancho) ** 2)
    : c.banco * (1 - Math.exp(-(d - c.ancho) / 0.9)) + 0.05 * (d - c.ancho);
  return mezcla(h, c.W + p, 1 - suave(c.ancho + 1.4, c.ancho + 16, d));
}
function charcaForma(x, z, h) {
  const dx = x - CHARCA.x, dz = z - CHARCA.z, dist = Math.hypot(dx, dz);
  if (dist > CHARCA.r * 3) return h;
  const R = radioCharca(Math.atan2(dz, dx)), dn = dist / R;
  const p = dn < 1 ? -1.05 * (1 - dn * dn) ** 0.7 : 0.5 * (1 - Math.exp(-((dn - 1) * R) / 1.0)) + 0.05 * (dn - 1) * R;
  return mezcla(h, NIVEL_CHARCA + p, 1 - suave(1.15, 2.4, dn));
}

// los ACANTILADOS: sur, este y oeste (el norte es del muro), con estratos y una boca al sur para el camino
export function acantiladoPeso(x, z) {
  const boca = 1 - Math.exp(-(((x - 8) / 11) ** 2)) * suave(110, 140, z);
  return suave(-128, -100, z) * boca;
}
function acantilado(x, z) {
  const k = acantiladoPeso(x, z);
  if (k <= 0) return 0;
  const e = radioCuenca(x, z) + 9 * (fbm(x / 40 + 50, z / 40 - 20, 3) - 0.5);
  if (e < 140) return 0;
  const t = (e - 154) / 15;
  const alto = 14 + 10 * fbm(x / 60 - 7, z / 60 + 3, 2);
  const f = 0.16 * suave(-0.4, 0.25, t) + 0.84 * Math.pow(suave(0.15, 0.85, t), 1.25);
  let h = f * alto;
  // estratos: repisas cada 2,4 m en la cara
  if (f > 0.12 && f < 0.97) { const u = h / 2.4, fl = Math.floor(u); h = mezcla(h, (fl + suave(0.45, 1, u - fl)) * 2.4, 0.6); }
  return h * k;
}
// cuanto esta (x, z) en la pared del acantilado (0 en la pradera, 1 en la cara)
export const enAcantilado = (x, z) => acantiladoPeso(x, z) * suave(145, 158, radioCuenca(x, z) + 9 * (fbm(x / 40 + 50, z / 40 - 20, 3) - 0.5));

// montones de tierra con hierba (1,4-3 m de ancho, hasta 40 cm)
function montones(x, z) {
  const C = 7, ci = Math.floor(x / C), cj = Math.floor(z / C);
  let s = 0;
  for (let j = cj - 1; j <= cj + 1; j++) {
    for (let i = ci - 1; i <= ci + 1; i++) {
      if (hash(i, j, 21) > 0.42) continue;
      const mx = (i + hash(i, j, 22)) * C, mz = (j + hash(i, j, 23)) * C;
      const r = 1.4 + 1.6 * hash(i, j, 24), alto = 0.12 + 0.28 * hash(i, j, 25);
      const d2 = ((x - mx) ** 2 + (z - mz) ** 2) / (r * r);
      if (d2 < 1) s += alto * (1 - d2) * (1 - d2);
    }
  }
  return s;
}

// lo que se deja tocar por bancales, montones y temblor: lejos de caminos, agua, acantilado y del sitio del muro
function libreEn(x, z) {
  return suave(1.0, 4.0, bordeCamino(x, z)) * suave(2.6, 7, distArroyo(x, z) - 1.7) * suave(1.3, 2.1, dnCharca(x, z))
    * (1 - suave(-134, -146, z)) * (1 - suave(143, 152, radioCuenca(x, z)));
}

// la altura del relieve en cualquier punto (sin el temblor por vertice del low poly)
export function alturaTotal(x, z) {
  let h = alturaLisa(x, z);
  const libre = libreEn(x, z);
  if (libre > 0) {
    // bancales: en algunas laderas el suelo se escalona y asoma la tierra en cada escalon
    const mt = suave(0.6, 0.7, fbm(x / 70 - 30, z / 70 + 12, 3)) * libre;
    if (mt > 0) {
      const desf = 0.6 * fbm(x / 18 + 3, z / 18, 2), u = h / 0.85 + desf, f = Math.floor(u);
      h = mezcla(h, (f + suave(0.68, 1, u - f) - desf) * 0.85, mt);
    }
    h += montones(x, z) * libre;
  }
  h = arroyoForma(x, z, h);
  h = charcaForma(x, z, h);
  h += acantilado(x, z);
  // las afueras: colinas que suben hasta perderse en la bruma
  const e = radioCuenca(x, z);
  if (e > 205) h += 34 * suave(205, 480, e) * (0.45 + fbm(x / 140 + 9, z / 140 - 4, 3));
  return h;
}

// ---------------- la rejilla del terreno fino ----------------
export const H = new Float32Array((N + 1) * (N + 1));
export const DIAG = new Uint8Array(N * N);
{
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const x = -EXT + i * PASO, z = -EXT + j * PASO;
      // el temblor de cada vertice (las facetas del low poly): poco en la pradera, mas en la roca; nada en el agua
      const roca = enAcantilado(x, z);
      const amp = (0.16 * libreEn(x, z) + 0.55 * roca) * (Math.abs(x) < EXT - 6 && Math.abs(z) < EXT - 6 ? 1 : 0);
      H[j * (N + 1) + i] = alturaTotal(x, z) + (hash(i, j) - 0.5) * amp;
    }
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) DIAG[j * N + i] = hash(i, j, 1) < 0.5 ? 0 : 1;
}

// la altura EXACTA de la cara pintada (el triangulo de la celda): los pies, la IK y la tela pisan la faceta
export function altura(x, z) {
  const gx = (x + EXT) / PASO, gz = (z + EXT) / PASO;
  if (gx < 0 || gz < 0 || gx > N || gz > N) return alturaTotal(x, z);
  const i = Math.min(N - 1, Math.floor(gx)), j = Math.min(N - 1, Math.floor(gz)), fx = gx - i, fz = gz - j;
  const f = N + 1;
  const h00 = H[j * f + i], h10 = H[j * f + i + 1], h01 = H[(j + 1) * f + i], h11 = H[(j + 1) * f + i + 1];
  if (DIAG[j * N + i] === 0) {                 // corte 00-11
    return fx >= fz ? h00 + (h10 - h00) * fx + (h11 - h10) * fz : h00 + (h01 - h00) * fz + (h11 - h01) * fx;
  }
  return fx + fz <= 1 ? h00 + (h10 - h00) * fx + (h01 - h00) * fz : h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
}

// la normal (su componente vertical) de la cara en (x, z): 1 llano, 0 pared
export function normalY(x, z) {
  const e = 0.3;
  const dx = altura(x + e, z) - altura(x - e, z), dz = altura(x, z + e) - altura(x, z - e);
  return (2 * e) / Math.hypot(dx, 2 * e, dz);
}

// la curvatura en cada vertice (positiva en lo hondo): oscurece las vaguadas y aclara los lomos
export const CURVA = new Float32Array((N + 1) * (N + 1));
{
  const f = N + 1;
  for (let j = 1; j < N; j++) {
    for (let i = 1; i < N; i++) {
      const k = j * f + i;
      CURVA[k] = (H[k - 1] + H[k + 1] + H[k - f] + H[k + f]) / 4 - H[k];
    }
  }
}
export function curvatura(x, z) {
  const i = Math.max(0, Math.min(N, Math.round((x + EXT) / PASO))), j = Math.max(0, Math.min(N, Math.round((z + EXT) / PASO)));
  return CURVA[j * (N + 1) + i];
}

// ---------------- el agua ----------------
// la cota del agua en (x, z) si cae en el arroyo o la charca (o en su orilla), si no null
export function nivelAgua(x, z) {
  if (dnCharca(x, z) < 1.12) return NIVEL_CHARCA;
  const d = distArroyo(x, z);
  if (d > 4) return null;
  const c = cauce(paramArroyo(x, z));
  return d < c.ancho + 0.6 ? c.W : null;
}
// lo que hay de la orilla a (x, z): negativo dentro del agua
export function distOrilla(x, z) {
  const dx = x - CHARCA.x, dz = z - CHARCA.z;
  const R = radioCharca(Math.atan2(dz, dx));
  const dc = Math.hypot(dx, dz) - R;
  const d = distArroyo(x, z);
  const da = d < RANGO_ARROYO - 1 ? d - cauce(paramArroyo(x, z)).ancho : 99;
  return Math.min(dc, da);
}

// ---------------- donde van las rocas ----------------
// { x, z, r (radio de la huella), alto, y (la base), giro, tipo, cat, inclina }
export const N_TIPOS_ROCA = 10;
export const ROCAS = [];
{
  const r = azar(77);
  const celda = new Map(), C = 6;
  const clave = (i, j) => i * 10007 + j;
  const libre = (x, z, rad) => {
    const ci = Math.floor(x / C), cj = Math.floor(z / C);
    for (let j = cj - 2; j <= cj + 2; j++) for (let i = ci - 2; i <= ci + 2; i++) {
      for (const o of celda.get(clave(i, j)) || []) if (Math.hypot(o.x - x, o.z - z) < (o.r + rad) * 0.72) return false;
    }
    return true;
  };
  const poner = (x, z, rad, alto, cat, enterrar = 0.3) => {
    if (Math.abs(x) > EXT - 3 || Math.abs(z) > EXT - 3) return false;
    if (bordeCamino(x, z) < rad + 0.35) return false;
    if (cat !== 'agua' && cat !== 'manantial' && distOrilla(x, z) < rad * 0.6) return false;
    if (cat === 'agua' && VADOS.some((v) => Math.hypot(v.x - x, v.z - z) < 3.5)) return false;
    if (!libre(x, z, rad)) return false;
    // la base: lo mas bajo del terreno bajo la huella, y enterrada un poco (en cuesta no asoma la panza)
    let hmin = altura(x, z);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * 6.2832;
      hmin = Math.min(hmin, altura(x + Math.cos(a) * rad * 0.85, z + Math.sin(a) * rad * 0.85));
    }
    const o = { x, z, r: rad, alto, y: hmin - alto * enterrar, giro: r() * 6.2832, tipo: Math.floor(r() * N_TIPOS_ROCA), cat,
      inclina: [(r() - 0.5) * 0.25, (r() - 0.5) * 0.25] };
    ROCAS.push(o);
    const k = clave(Math.floor(x / C), Math.floor(z / C));
    if (!celda.has(k)) celda.set(k, []);
    celda.get(k).push(o);
    return true;
  };

  // el manantial: un monton de rocas grandes de las que sale el agua (abierto hacia el este, por donde va el arroyo)
  for (let k = 0; k < 14; k++) {
    const a = Math.PI * 0.35 + (k / 14) * Math.PI * 1.3 + (r() - 0.5) * 0.3;
    const d = 1.6 + r() * 3.4, rad = 0.8 + r() * 1.7;
    poner(MANANTIAL.x + Math.cos(a) * d, MANANTIAL.z + Math.sin(a) * d, rad, rad * (0.8 + r() * 0.5), 'manantial', 0.25);
  }
  // el pie y la cara de los acantilados: canchal al pie, bloques grandes en la pared
  for (let k = 0; k < 5200; k++) {
    const x = (r() * 2 - 1) * (EXT - 4), z = (r() * 2 - 1) * (EXT - 4);
    const e = radioCuenca(x, z);
    if (e < 146 || e > 182 || acantiladoPeso(x, z) < 0.4) continue;
    const pie = e < 157;
    if (pie && r() > 0.5) continue;
    const rad = pie ? 0.5 + Math.pow(r(), 1.6) * 1.6 : 1.4 + r() * 3.2;
    poner(x, z, rad, rad * (0.55 + r() * 0.6), 'acantilado', pie ? 0.3 : 0.45);
  }
  // crestas: grupos de rocas que asoman en lo alto de las lomas
  for (let gz = -140; gz <= 140; gz += 8) {
    for (let gx = -140; gx <= 140; gx += 8) {
      const x = gx + (r() - 0.5) * 6, z = gz + (r() - 0.5) * 6;
      if (crestaEn(x, z) < 0.42 || r() > 0.7) continue;
      const n = 2 + Math.floor(r() * 4);
      for (let m = 0; m < n; m++) {
        const rad = 0.45 + Math.pow(r(), 1.5) * 1.7;
        poner(x + (r() - 0.5) * 5, z + (r() - 0.5) * 5, rad, rad * (0.5 + r() * 0.7), 'cresta', 0.35);
      }
    }
  }
  // cantos sueltos en la pradera, alguno con su piedra al lado
  for (let k = 0; k < 140; k++) {
    const x = (r() * 2 - 1) * 140, z = (r() * 2 - 1) * 140;
    const rad = 0.3 + Math.pow(r(), 2.2) * 1.1;
    if (poner(x, z, rad, rad * (0.55 + r() * 0.5), 'pradera') && r() < 0.35) {
      const a = r() * 6.28, s = rad * (0.3 + r() * 0.3);
      poner(x + Math.cos(a) * (rad + s) * 0.9, z + Math.sin(a) * (rad + s) * 0.9, s, s * 0.7, 'pradera');
    }
  }
  // el arroyo: piedras en las orillas y alguna en el agua
  const cc = { W: 0, ancho: 1, prof: 0, banco: 0, vado: 0 };
  for (let k = 4; k < ARROYO.pts.length - 2; k += 3) {
    const p = ARROYO.pts[k], q = ARROYO.pts[k + 1];
    const tx = q.x - p.x, tz = q.z - p.z, l = Math.hypot(tx, tz) || 1, nx = -tz / l, nz = tx / l;
    cauce(ARROYO.s[k], cc);
    if (cc.vado > 0.3) continue;
    if (r() < 0.55) {
      const lado = r() < 0.5 ? -1 : 1, rad = 0.18 + Math.pow(r(), 1.5) * 0.5, d = cc.ancho + 0.05 + r() * 1.1;
      poner(p.x + nx * lado * d, p.z + nz * lado * d, rad, rad * (0.5 + r() * 0.4), 'agua', 0.3);
    }
    if (r() < 0.12) {
      const rad = 0.22 + r() * 0.25, d = (r() - 0.5) * cc.ancho * 1.1;
      poner(p.x + nx * d, p.z + nz * d, rad, rad * 0.8, 'agua', 0.25);
    }
  }
  // la charca: piedras en parte de la orilla (no donde entra el arroyo)
  for (let k = 0; k < 60; k++) {
    const a = r() * 6.2832;
    if (Math.cos(a - Math.PI * 0.93) > 0.8 || fbm(Math.cos(a) * 3 + 40, Math.sin(a) * 3, 2) < 0.45) continue;
    const R = radioCharca(a), dn = 0.97 + r() * 0.35, rad = 0.25 + Math.pow(r(), 1.6) * 0.9;
    poner(CHARCA.x + Math.cos(a) * R * dn, CHARCA.z + Math.sin(a) * R * dn, rad, rad * (0.55 + r() * 0.4), 'agua', 0.3);
  }
}

// distancia al borde de la roca mas cercana (rejilla de 0,5 m): la hierba no crece dentro y crece mas alta al lado
const DR = new Float32Array(NC * NC).fill(9);
for (const o of ROCAS) {
  const R = o.r + 3;
  const i0 = Math.max(0, Math.floor((o.x - R + EXT) / DC)), i1 = Math.min(NC - 1, Math.ceil((o.x + R + EXT) / DC));
  const j0 = Math.max(0, Math.floor((o.z - R + EXT) / DC)), j1 = Math.min(NC - 1, Math.ceil((o.z + R + EXT) / DC));
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const d = Math.hypot(i * DC - EXT - o.x, j * DC - EXT - o.z) - o.r * 0.9;
      if (d < DR[j * NC + i]) DR[j * NC + i] = d;
    }
  }
}
export const distRoca = (x, z) => bilineal(DR, x, z, 9);

// el borde de la cuenca: al pie de los acantilados el 18 no sigue (en las esquinas el cuadrado de +-148 se metia en
// la pared). Lo llama el heroe tras sus choques
export function limitar(p) {
  if (acantiladoPeso(p.x, p.z) < 0.3) return;
  const e = radioCuenca(p.x, p.z), MAX = 150.5;
  if (e > MAX) { p.x *= MAX / e; p.z *= MAX / e; }
}

// los choques: las rocas que estorban al 18 dentro del mapa
export const CHOQUES_ROCAS = ROCAS.filter((o) => o.r >= 0.33 && o.alto >= 0.28 && Math.abs(o.x) < LADO + o.r && Math.abs(o.z) < LADO + o.r)
  .map((o) => ({ x: o.x, z: o.z, r: o.r * 0.86 }));

// ---------------- que crece en cada sitio ----------------
// calvas: manchas pequenas de tierra gastada
export const calva = (x, z) => suave(0.77, 0.84, fbm(x / 6 + 100, z / 6 - 50, 2)) * suave(1.5, 5, distOrilla(x, z));
const _cub = { mata: 0, alto: 1, flor: 0, florTipo: 0, junco: 0 };
// mata: 0..1 lo que crece la hierba (densidad); alto: su altura relativa; flor: 0..1; florTipo: 0..3; junco: 0..1
export function cubierta(x, z, out = _cub) {
  const b = bordeCamino(x, z), ny = normalY(x, z), orilla = distOrilla(x, z), dr = distRoca(x, z);
  let mata = 1;
  if (b < 0.1 || orilla < 0.05 || dr < 0.05) mata = 0;
  mata *= 1 - suave(0.86, 0.7, ny);
  mata *= 1 - 0.85 * calva(x, z);
  mata *= 1 - 0.8 * enAcantilado(x, z) * suave(0.95, 0.8, ny);
  let alto = 0.75 + 0.5 * suave(0.3, 0.75, fbm(x / 13 + 5, z / 13 + 1, 3));
  alto *= 1 - 0.35 * suave(0.62, 0.72, fbm(x / 30 - 11, z / 30 + 40, 2));            // pradillos cortos
  alto *= 1 + 0.28 * suave(1.4, 0.1, dr) + 0.22 * suave(2.5, 0.2, orilla);           // mas alta junto a rocas y agua
  alto *= 0.55 + 0.45 * suave(0.1, 0.6, b);
  alto *= 1 - 0.3 * suave(0.92, 0.75, ny);
  out.mata = mata;
  out.alto = alto;
  // flores: en corros, cada corro de una clase
  out.flor = mata > 0.3 && b > 0.35 ? Math.max(0.03, suave(0.6, 0.74, fbm(x / 17 - 70, z / 17 + 30, 3))) * mata : 0;
  out.florTipo = Math.max(0, Math.min(3, Math.floor((fbm(x / 45 + 5, z / 45 + 9, 2) - 0.5) * 9 + 2)));
  // juncos: en la orilla (y un poco dentro, donde cubre poco)
  out.junco = orilla > -0.35 && orilla < 1.6 ? suave(1.6, 0.2, orilla) * suave(0.35, 0.6, fbm(x / 5 + 60, z / 5 - 3, 2)) * (b > 0.6 ? 1 : 0) : 0;
  return out;
}

// ---------------- colores ----------------
// verdes apagados que casan con el crema y el pardo del 18; tierra parda; roca gris calida
export const COLOR = {
  oscuro: new THREE.Color(0x51653a), claro: new THREE.Color(0x87995a), seco: new THREE.Color(0xa9a265),
  jugoso: new THREE.Color(0x48663a), tierra: new THREE.Color(0x8a6f4c), tierraClara: new THREE.Color(0xa58a62),
  tierraMojada: new THREE.Color(0x5d4b37), pisado: new THREE.Color(0x8f875a), roca: new THREE.Color(0x968f80),
  rocaOscura: new THREE.Color(0x6d675c), rocaClara: new THREE.Color(0xb7af9b), lecho: new THREE.Color(0x7a7262),
  musgo: new THREE.Color(0x6e7c45),
  flores: [new THREE.Color(0xf1ede0), new THREE.Color(0xe7c84e), new THREE.Color(0x9c88c4), new THREE.Color(0xd9a6b6)],
};
const _t = new THREE.Color();
// el verde de la hierba en (x, z)
export function colorHierba(x, z, out, c = cubierta(x, z)) {
  out.copy(COLOR.oscuro).lerp(COLOR.claro, suave(0.3, 0.7, fbm(x / 38 + 11, z / 38 - 4, 3)));
  out.lerp(COLOR.seco, 0.75 * suave(0.6, 0.72, fbm(x / 26 - 40, z / 26 + 8, 3)));
  out.lerp(COLOR.jugoso, 0.6 * suave(5, 0.5, distOrilla(x, z)));
  // en los corros de flores, la pradera toma algo de su color (de lejos se ven las manchas)
  if (c.flor > 0.1) out.lerp(COLOR.flores[c.florTipo], 0.12 * c.flor);
  return out;
}
// la roca: estratos por altura y vetas
export function colorRoca(x, y, z, out) {
  const v = 0.5 + 0.5 * Math.sin(y * 2.3 + 3 * fbm(x / 14, z / 14, 2));
  out.copy(COLOR.rocaOscura).lerp(COLOR.roca, 0.45 + 0.4 * v).lerp(COLOR.rocaClara, 0.25 * suave(0.75, 1, v));
  return out;
}
// el color de una cara del terreno: su centro (x, y, z) y lo vertical de su normal (ny). Devuelve tambien cuanto la
// cubre la hierba (lo usa el sombreador del suelo para oscurecerlo cerca, entre las hojas)
export function colorTerreno(x, y, z, ny, out) {
  const c = cubierta(x, z);
  colorHierba(x, z, out, c);
  const orilla = distOrilla(x, z), agua = nivelAgua(x, z);
  // tierra donde no crece la hierba: calvas, laderas de los bancales, orillas
  let tierra = Math.max(suave(0.9, 0.76, ny), 0.85 * calva(x, z), suave(0.7, 0.1, orilla) * 0.9);
  if (tierra > 0) {
    _t.copy(COLOR.tierra).lerp(COLOR.tierraClara, fbm(x / 4 + 9, z / 4, 2));
    if (orilla < 1.4) _t.lerp(COLOR.tierraMojada, suave(1.4, 0.1, orilla));
    out.lerp(_t, tierra);
  }
  // roca en las paredes
  const roca = Math.max(suave(0.74, 0.5, ny), enAcantilado(x, z) * suave(0.9, 0.72, ny));
  if (roca > 0) out.lerp(colorRoca(x, y, z, _t), roca);
  // el lecho bajo el agua: cantos, mas oscuro cuanto mas hondo
  if (agua !== null && y < agua - 0.01) {
    _t.copy(COLOR.lecho).multiplyScalar(1 - 0.35 * suave(0, 0.8, agua - y));
    out.lerp(_t, suave(-0.01, 0.06, agua - y));
    tierra = 1;
  }
  // oclusion: vaguadas y pie de las rocas mas oscuros, lomos mas claros
  const cu = curvatura(x, z);
  let m = 1 - Math.min(0.2, Math.max(0, cu) * 1.4) + Math.min(0.07, Math.max(0, -cu) * 0.7);
  m *= 1 - 0.22 * suave(0.9, 0, distRoca(x, z));
  out.multiplyScalar(m);
  return c.mata * (1 - Math.max(tierra, roca));
}

export const info = () => ({ rocas: ROCAS.length, choquesRocas: CHOQUES_ROCAS.length, vados: VADOS.length,
  nivelManantial: +NIVEL[0].toFixed(2), nivelCharca: +NIVEL_CHARCA.toFixed(2), largoArroyo: Math.round(ARROYO.largo) });
