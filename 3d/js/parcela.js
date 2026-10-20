// La PARCELA: 20 x 20 m del suelo del mapa del muro con el acabado de la muestra de 1 m2 (suelo1m.html), JUGABLE con
// el 18 dentro (?mapa=parcela). Un bloque de terreno cortado que flota sobre un fondo liso (se ven las capas de tierra en
// los cuatro cortes): relieve con un otero, un caminito de tierra pisada que la cruza de sur a norte con su charco,
// rocas facetadas con musgo y TINTA (como el 18), chinas, hojas secas y ramitas, y hierba FINA en matas (10-30 cm) con
// cesped corto debajo, praditos de trebol, margaritas y botones de oro. La hierba lleva viento y la FISICA de
// hierba_fisica.js (la apartan pies, cuerpo y capa; queda tumbada donde se pisa). Misma interfaz que los otros mapas.
import * as THREE from 'three';
import { mergeVertices, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { azar } from './texturas.js';
import { crearCampo } from './hierba_fisica.js';
import { crearAgua } from './agua_fisica.js';

export const LADO = 10;                          // la parcela va de -10 a 10 en X y Z
const BORDE = 9.4;                               // el 18 no pasa de aqui (no se cae por el corte)
const PASO = 0.2, N = Math.round((2 * LADO) / PASO);
const FONDO = -2;                                // dos metros de tierra
const TINTA = new THREE.Color().setRGB(30 / 255, 24 / 255, 20 / 255, THREE.SRGBColorSpace);
const r = azar(2027);

// ---------------- ruido ----------------
function crearRuido(semilla) {
  const q = azar(semilla), P = new Float32Array(256 * 256);
  for (let i = 0; i < P.length; i++) P[i] = q();
  const v = (x, z) => P[((x & 255) << 8) | (z & 255)];
  return (x, z) => {
    const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi;
    const u = fx * fx * (3 - 2 * fx), w = fz * fz * (3 - 2 * fz);
    const a = v(xi, zi), b = v(xi + 1, zi), c = v(xi, zi + 1), d = v(xi + 1, zi + 1);
    return a + (b - a) * u + ((c + (d - c) * u) - (a + (b - a) * u)) * w;
  };
}
const ruido = crearRuido(13);
const fbm = (x, z, o = 3) => { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * ruido(x * f + i * 17.3, z * f - i * 9.1); n += a; a *= 0.5; f *= 2; } return s / n; };
const suave = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const col = (h) => new THREE.Color(h);

// ---------------- el caminito y el charco ----------------
const ANCHO = 0.48;                              // medio ancho del camino (m)
const curva = new THREE.CatmullRomCurve3([[1.6, 10.8], [0.6, 6.5], [-1.6, 2.4], [-1.2, -1.8], [1.4, -5.6], [0.9, -10.8]]
  .map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
const CAMINO = curva.getSpacedPoints(260).map((p) => [p.x, p.z]);
// distancia al eje del camino en una rejilla de 10 cm (se pide muchas veces)
const DC = 0.1, NC = Math.round((2 * LADO) / DC) + 1;
const DCAM = new Float32Array(NC * NC).fill(9);
for (let i = 0; i < CAMINO.length - 1; i++) {
  const [ax, az] = CAMINO[i], [bx, bz] = CAMINO[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-9;
  const R = 3;
  const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - R + LADO) / DC)), i1 = Math.min(NC - 1, Math.ceil((Math.max(ax, bx) + R + LADO) / DC));
  const j0 = Math.max(0, Math.floor((Math.min(az, bz) - R + LADO) / DC)), j1 = Math.min(NC - 1, Math.ceil((Math.max(az, bz) + R + LADO) / DC));
  for (let j = j0; j <= j1; j++) {
    for (let k = i0; k <= i1; k++) {
      const x = k * DC - LADO, z = j * DC - LADO;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
      const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
      if (d < DCAM[j * NC + k]) DCAM[j * NC + k] = d;
    }
  }
}
function distCamino(x, z) {
  const gx = Math.max(0, Math.min(NC - 1.001, (x + LADO) / DC)), gz = Math.max(0, Math.min(NC - 1.001, (z + LADO) / DC));
  const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
  const a = DCAM[j * NC + i], b = DCAM[j * NC + i + 1], c = DCAM[(j + 1) * NC + i], d = DCAM[(j + 1) * NC + i + 1];
  return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
}
// el charco: en el camino, en un bache alargado
const CHARCO = { x: -1.45, z: 2.9, rx: 0.75, rz: 0.45, giro: 0.5 };
function eCharco(x, z) {           // 0 en el centro, 1 en la orilla
  const c = Math.cos(CHARCO.giro), s = Math.sin(CHARCO.giro), dx = x - CHARCO.x, dz = z - CHARCO.z;
  return Math.hypot((dx * c + dz * s) / CHARCO.rx, (-dx * s + dz * c) / CHARCO.rz);
}

// ---------------- las rocas (donde) ----------------
// el otero con la roca grande, un canto a media ladera y piedras sueltas por la pradera
const OTERO = { x: -4.6, z: -4.4, r: 3.4, h: 0.95 };
const ROCAS = [
  { x: -4.2, z: -4.7, r: 1.05, alto: 0.95, sem: 31, musgo: 1 },
  { x: -3.15, z: -3.85, r: 0.38, alto: 0.3, sem: 47, musgo: 0.7 },
  { x: -5.3, z: -3.7, r: 0.26, alto: 0.22, sem: 53, musgo: 0.5 },
  { x: 5.2, z: 3.9, r: 0.62, alto: 0.48, sem: 61, musgo: 0.9 },
  { x: 5.9, z: 4.6, r: 0.2, alto: 0.16, sem: 67, musgo: 0.3 },
  { x: 4.6, z: -6.8, r: 0.45, alto: 0.32, sem: 71, musgo: 0.6 },
  { x: -6.6, z: 6.2, r: 0.5, alto: 0.38, sem: 79, musgo: 0.8 },
];
for (let k = 0; k < 40; k++) {
  const x = (r() - 0.5) * 18.6, z = (r() - 0.5) * 18.6;
  if (distCamino(x, z) < ANCHO + 0.4) continue;
  const rad = 0.07 + Math.pow(r(), 2) * 0.18;
  if (ROCAS.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + rad + 0.3)) continue;
  ROCAS.push({ x, z, r: rad, alto: rad * (0.55 + 0.4 * r()), sem: 200 + k, musgo: r() * 0.6 });
}
// distancia al borde de la roca mas cercana. Mientras no estan hechas, cada roca es un circulo de radio r; en cuanto
// se construye, `o.perfil` guarda su huella REAL a ras de suelo (72 angulos): con el circulo quedaba un anillo pelado
// entre la hierba y la piedra (la roca es eliptica, irregular, girada y enterrada) y parecia pegada encima
const PERFIL_N = 72;
function radioRoca(o, dx, dz) {
  if (!o.perfil) return o.r;
  const t = ((Math.atan2(dz, dx) / 6.283185307 + 1) % 1) * PERFIL_N, i = Math.floor(t), f = t - i;
  return o.perfil[i % PERFIL_N] * (1 - f) + o.perfil[(i + 1) % PERFIL_N] * f;
}
function distRoca(x, z) {
  let d = 9;
  for (const o of ROCAS) {
    const dx = x - o.x, dz = z - o.z, h = Math.hypot(dx, dz);
    if (h - 1.45 * o.r > d) continue;
    d = Math.min(d, h - radioRoca(o, dx, dz));
  }
  return d;
}

// ---------------- el relieve ----------------
function relieve(x, z) {
  let h = 0.55 * (fbm(x / 7 + 3, z / 7 - 1) - 0.5) + 0.14 * (fbm(x / 1.7, z / 1.7) - 0.5);
  h += OTERO.h * Math.exp(-(((x - OTERO.x) ** 2 + (z - OTERO.z) ** 2) / (OTERO.r * OTERO.r)));
  // montones (matas de tierra) de 0,6-1,4 m
  const C = 2.2, ci = Math.floor(x / C), cj = Math.floor(z / C);
  for (let j = cj - 1; j <= cj + 1; j++) {
    for (let i = ci - 1; i <= ci + 1; i++) {
      const q = azar(((i * 7919) ^ (j * 104729)) >>> 0);
      if (q() > 0.4) continue;
      const mx = (i + q()) * C, mz = (j + q()) * C, rad = 0.6 + 0.8 * q(), alto = 0.04 + 0.08 * q();
      const d2 = ((x - mx) ** 2 + (z - mz) ** 2) / (rad * rad);
      if (d2 < 1) h += alto * (1 - d2) * (1 - d2) * suave(ANCHO, ANCHO + 0.6, distCamino(x, z));
    }
  }
  // el camino, hundido de tanto pisar, con su reborde; y el bache del charco
  const d = distCamino(x, z);
  h -= 0.05 * (1 - suave(ANCHO - 0.15, ANCHO + 0.08, d));
  h += 0.018 * Math.exp(-(((d - ANCHO - 0.12) / 0.13) ** 2));
  const e = eCharco(x, z);
  if (e < 1.4) h -= 0.07 * (1 - suave(0.0, 1.15, e)) ** 1.3;
  return h;
}
const NIVEL_CHARCO = relieve(CHARCO.x, CHARCO.z) + 0.05;

// la rejilla: 20 cm con temblor (las facetas), menos en el camino y nada en el charco
const H = new Float32Array((N + 1) * (N + 1));
const DIAG = new Uint8Array(N * N);
for (let j = 0; j <= N; j++) {
  for (let i = 0; i <= N; i++) {
    const x = -LADO + i * PASO, z = -LADO + j * PASO;
    const amp = 0.022 * (0.35 + 0.65 * suave(ANCHO - 0.2, ANCHO + 0.3, distCamino(x, z))) * suave(1.0, 1.4, eCharco(x, z));
    H[j * (N + 1) + i] = relieve(x, z) + (r() - 0.5) * amp;
  }
}
for (let k = 0; k < N * N; k++) DIAG[k] = r() < 0.5 ? 0 : 1;
// 20-10: las celdas del camino (y un margen) no van en la malla gruesa: las cubre una malla FINA de 2 cm que se hunde
// con las huellas (ver «las huellas» en crearMundo)
const EN_CAMINO = new Uint8Array(N * N);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++)
  EN_CAMINO[j * N + i] = distCamino(-LADO + (i + 0.5) * PASO, -LADO + (j + 0.5) * PASO) < ANCHO + 0.16 ? 1 : 0;
// la normal suave del relieve en un vertice de la rejilla gruesa (la misma que usa el suelo)
function normalRejilla(i, j) {
  const f = N + 1, i0 = Math.max(i - 1, 0), i1 = Math.min(i + 1, N), j0 = Math.max(j - 1, 0), j1 = Math.min(j + 1, N);
  const hx = (H[j * f + i1] - H[j * f + i0]) / ((i1 - i0) * PASO), hz = (H[j1 * f + i] - H[j0 * f + i]) / ((j1 - j0) * PASO);
  const l = Math.hypot(hx, 1, hz);
  return [-hx / l, 1 / l, -hz / l];
}
// la altura EXACTA de la cara pintada (pies, IK y tela pisan la faceta)
export function altura(x, z) {
  const gx = Math.max(0, Math.min(N - 1e-6, (x + LADO) / PASO)), gz = Math.max(0, Math.min(N - 1e-6, (z + LADO) / PASO));
  const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j, f = N + 1;
  const h00 = H[j * f + i], h10 = H[j * f + i + 1], h01 = H[(j + 1) * f + i], h11 = H[(j + 1) * f + i + 1];
  if (DIAG[j * N + i] === 0) return fx >= fz ? h00 + (h10 - h00) * fx + (h11 - h10) * fz : h00 + (h01 - h00) * fz + (h11 - h01) * fx;
  return fx + fz <= 1 ? h00 + (h10 - h00) * fx + (h01 - h00) * fz : h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
}
export function puntoCamino(t) {
  const u = Math.max(0, Math.min(1, t)), p = curva.getPointAt(u), tg = curva.getTangentAt(u);
  return { x: p.x, z: p.z, tx: tg.x, tz: tg.z };
}

// ---------------- que crece en cada sitio ----------------
const corto = (x, z) => suave(0.58, 0.68, fbm(x / 3.6 - 11, z / 3.6 + 40));          // praditos de hierba corta
const trebol = (x, z) => corto(x, z) * suave(0.5, 0.6, fbm(x / 1.6 + 3, z / 1.6 - 8));
const flor = (x, z) => suave(0.57, 0.68, fbm(x / 2.6 + 70, z / 2.6 - 30));
const calva = (x, z) => suave(0.77, 0.85, fbm(x / 1.3 + 100, z / 1.3 - 50, 2));
function densidad(x, z) {
  let m = suave(ANCHO - 0.06, ANCHO + 0.16, distCamino(x, z));
  if (distRoca(x, z) < 0.02) return 0;
  m *= suave(1.0, 1.3, eCharco(x, z));
  m *= 1 - 0.6 * calva(x, z);
  return m;
}
function altoEn(x, z) {
  return (0.62 + 0.75 * suave(0.36, 0.66, fbm(x / 2.4 + 9, z / 2.4 - 2))) * (1 - 0.6 * corto(x, z)) * (1 + 0.3 * suave(0.6, 0.02, distRoca(x, z)))
    * (0.55 + 0.45 * suave(ANCHO, ANCHO + 0.5, distCamino(x, z)));
}
const _t = new THREE.Color();
const VERDE = { oscuro: col(0x4a4b2d), musgo: col(0x5b6b35), seco: col(0x6d6a3e) };
// el tono de cada mata segun la zona: mas pajizo en los altos, mas verde en lo hondo
// (20-10, mirando fotos de rocas en prado: el prado de verdad no es un cesped de un verde: lleva manchas PAJIZAS,
// zonas de verde mas hondo y matas sueltas de hierba seca entre la verde)
function tintaZona(x, z, out) {
  const seco = suave(0.44, 0.66, fbm(x / 5 - 40, z / 5 + 8));
  const hondo = suave(0.52, 0.68, fbm(x / 3.1 + 21, z / 3.1 - 17)) * (1 - seco);
  out.setRGB(1, 1, 1).lerp(_t.setRGB(1.38, 1.16, 0.6), 0.8 * seco).lerp(_t.setRGB(0.74, 0.9, 0.66), 0.6 * hondo);
  // alguna mata seca suelta (por la posicion: la misma mata sale siempre igual), mas en lo pajizo
  const h = Math.abs(Math.sin(x * 127.1 + z * 311.7) * 43758.5453) % 1;
  if (h < 0.1 + 0.22 * seco) out.lerp(_t.setRGB(1.55, 1.22, 0.58), 0.6 + 0.35 * ((h * 17.3) % 1));
  return out.multiplyScalar(0.9 + 0.18 * fbm(x / 1.2, z / 1.2, 2));
}

// ---------------- geometria a mano ----------------
function malla() { return { pos: [], col: [], nor: [], raiz: [] }; }
function tri(g, a, b, c, ca, cb = ca, cc = ca, fuera = null, normal = null, raiz = null) {
  if (fuera) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * fuera[0] + ny * fuera[1] + nz * fuera[2] < 0) { [b, c] = [c, b]; [cb, cc] = [cc, cb]; }
  }
  g.pos.push(...a, ...b, ...c);
  for (const k of [ca, cb, cc]) g.col.push(k.r, k.g, k.b);
  if (normal) for (let i = 0; i < 3; i++) g.nor.push(...normal);
  if (raiz) for (let i = 0; i < 3; i++) g.raiz.push(...raiz);
}
function geometria(g) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(g.col, 3));
  if (g.nor.length === g.pos.length) geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.nor, 3));
  else geo.computeVertexNormals();
  if (g.raiz.length) geo.setAttribute('raiz', new THREE.Float32BufferAttribute(g.raiz, 2));
  return geo;
}
const ARRIBA = [0, 1, 0];

// ---------------- el bloque de tierra ----------------
const CAPA = { cesped: col(0x433b25), humus: col(0x3b3024), tierra: col(0x6b4f36), subsuelo: col(0x8d7152), fondo: col(0x2c241b) };
function colorArriba(x, z, out) {
  const d = distCamino(x, z);
  out.copy(VERDE.oscuro).lerp(VERDE.musgo, suave(0.4, 0.62, fbm(x * 0.8 + 4, z * 0.8)));
  out.lerp(VERDE.seco, 0.6 * suave(0.5, 0.7, fbm(x / 5 - 40, z / 5 + 8)));                   // la tierra de lo pajizo
  if (d < ANCHO + 0.25) {
    const tierra = _t.copy(col(0x96805f)).lerp(col(0x857055), fbm(x * 2.2, z * 2.2 + 3)).lerp(col(0xa48d69), 0.6 * suave(0.55, 0.75, fbm(x * 4 - 7, z * 4)));
    out.lerp(tierra, 1 - suave(ANCHO - 0.12, ANCHO + 0.14, d));
    out.lerp(col(0x8d865a), 0.45 * Math.exp(-(((d - ANCHO) / 0.12) ** 2)));          // hierba pisada en el canto
  }
  const c = calva(x, z);
  if (c > 0) out.lerp(_t.copy(col(0x8a6f4c)).lerp(col(0x9c8058), fbm(x * 3, z * 3)), 0.5 * c);
  const e = eCharco(x, z);
  if (e < 1.5) out.lerp(col(0x5d4b37), 0.85 * (1 - suave(0.9, 1.5, e)));                 // barro mojado
  return out.multiplyScalar(0.93 + 0.12 * fbm(x * 6 + 3, z * 6 - 9));
}
function bloque(oArriba = 0, oLado = 0, oAbajo = 0, conColor = true) {
  const g = malla(), f = N + 1, c = new THREE.Color();
  const p = (i, j) => {
    let x = -LADO + i * PASO, z = -LADO + j * PASO;
    if (i === 0) x -= oLado; if (i === N) x += oLado; if (j === 0) z -= oLado; if (j === N) z += oLado;
    return [x, H[j * f + i] + oArriba, z];
  };
  // 20-10 (el usuario no quiere ver los triangulos): el suelo de arriba va SUAVE: el color se calcula en cada
  // vertice (no por cara) y la normal sale de la pendiente del relieve. La forma no cambia (los pies pisan lo mismo).
  const vc = [], vn = [];
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const [x, , z] = p(i, j);
      vc.push(conColor ? colorArriba(x, z, new THREE.Color()) : c);
      const hx = (H[j * f + Math.min(i + 1, N)] - H[j * f + Math.max(i - 1, 0)]) / ((Math.min(i + 1, N) - Math.max(i - 1, 0)) * PASO);
      const hz = (H[Math.min(j + 1, N) * f + i] - H[Math.max(j - 1, 0) * f + i]) / ((Math.min(j + 1, N) - Math.max(j - 1, 0)) * PASO);
      const l = Math.hypot(hx, 1, hz);
      vn.push([-hx / l, 1 / l, -hz / l]);
    }
  }
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = j * f + i, b = a + 1, cc = a + f, d = a + f + 1;
      const caras = DIAG[j * N + i] === 0 ? [[a, b, d], [a, d, cc]] : [[a, b, cc], [b, d, cc]];
      for (let [u, v, w] of caras) {
        if (conColor) r();                     // el azar de antes: sin el, cambiaria donde caen la hierba y las flores
        if (conColor && EN_CAMINO[j * N + i]) continue;                         // el camino lo pone la malla fina
        const U = p(u % f, Math.floor(u / f)), V = p(v % f, Math.floor(v / f)), W = p(w % f, Math.floor(w / f));
        // de cara arriba (el mismo giro que hacia tri con ARRIBA)
        const ny = (V[2] - U[2]) * (W[0] - U[0]) - (V[0] - U[0]) * (W[2] - U[2]);
        const [P, Q, R] = ny < 0 ? [[U, u], [W, w], [V, v]] : [[U, u], [V, v], [W, w]];
        for (const [pos, k] of [P, Q, R]) { g.pos.push(...pos); g.col.push(vc[k].r, vc[k].g, vc[k].b); g.nor.push(...vn[k]); }
      }
    }
  }
  // los cuatro cortes: capas onduladas (cesped con raices, humus, tierra parda, subsuelo claro)
  const lados = [
    { borde: (k) => [k, 0], fuera: [0, 0, -1] }, { borde: (k) => [k, N], fuera: [0, 0, 1] },
    { borde: (k) => [0, k], fuera: [-1, 0, 0] }, { borde: (k) => [N, k], fuera: [1, 0, 0] },
  ];
  const q = azar(77);
  for (const L of lados) {
    const filas = [];
    for (let k = 0; k <= N; k++) {
      const [i, j] = L.borde(k), top = p(i, j);
      const s = (k / N) * 20 + L.fuera[0] * 7 + L.fuera[2] * 13;
      const ys = [top[1],
        Math.min(top[1] - 0.04, -0.13 + 0.03 * Math.sin(s * 1.9)),
        Math.min(top[1] - 0.12, -0.36 + 0.06 * Math.sin(s * 0.8) + 0.05 * (fbm(s, 1) - 0.5)),
        -0.78 + 0.07 * Math.sin(s * 0.5 + 1),
        -1.18 + 0.1 * Math.sin(s * 0.37 + 2) + 0.06 * (fbm(s * 0.5, 4) - 0.5),
        -1.6 + 0.06 * Math.sin(s * 0.7),
        FONDO - oAbajo];
      filas.push(ys.map((y, m) => [top[0], y + (m > 0 && m < ys.length - 1 ? (q() - 0.5) * 0.05 : 0), top[2]]));
    }
    const banda = [CAPA.cesped, CAPA.humus, CAPA.humus, CAPA.tierra, CAPA.tierra, CAPA.subsuelo];
    for (let k = 0; k < N; k++) {
      for (let m = 0; m < 6; m++) {
        const a = filas[k][m], b = filas[k + 1][m], cc = filas[k][m + 1], d = filas[k + 1][m + 1];
        for (const [u, v, w] of [[a, b, d], [a, d, cc]]) {
          if (conColor) c.copy(banda[m]).multiplyScalar(0.9 + 0.18 * q());
          tri(g, u, v, w, c, c, c, L.fuera, L.fuera);
        }
      }
    }
  }
  const e = LADO + oLado, y = FONDO - oAbajo;
  c.copy(CAPA.fondo);
  tri(g, [-e, y, -e], [e, y, -e], [e, y, e], c, c, c, [0, -1, 0], [0, -1, 0]);
  tri(g, [-e, y, -e], [e, y, e], [-e, y, e], c, c, c, [0, -1, 0], [0, -1, 0]);
  return geometria(g);
}

// ---------------- piedras: icosaedro cortado por planos ----------------
// rugoso > 0 (las rocas de verdad): mas poligonos, una superficie con crestas (ondas plegadas en varias escalas) y
// lascas pequenas; los planos de corte van DESPUES, asi las caras de fractura quedan lisas y el resto, aspero
function piedra(semilla, rx, alto, rz, detalle, musgo, rugoso = 0) {
  const q = azar(semilla);
  let g = new THREE.IcosahedronGeometry(1, detalle);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position, v = new THREE.Vector3(), u = new THREE.Vector3();
  const planos = [];
  for (let k = 0, n = 4 + Math.floor(q() * 6); k < n; k++) planos.push([new THREE.Vector3(q() * 2 - 1, q() * 1.7 - 0.35, q() * 2 - 1).normalize(), 0.6 + q() * 0.3]);
  const ondas = [];
  if (rugoso > 0) {
    for (let k = 0, n = 5 + Math.floor(q() * 7); k < n; k++)             // lascas: cortes pequenos cerca del borde
      planos.push([new THREE.Vector3(q() * 2 - 1, q() * 1.6 - 0.3, q() * 2 - 1).normalize(), 0.78 + q() * 0.17]);
    for (let k = 0; k < 7; k++)                                          // crestas en siete escalas, de grandes a finas
      ondas.push([new THREE.Vector3(q() * 2 - 1, q() * 2 - 1, q() * 2 - 1).normalize(), 2.6 * Math.pow(1.85, k), rugoso * 0.17 / Math.pow(1.55, k), q() * 6.2832]);
  }
  const salto = detalle > 2 ? 0.04 : 0.2;                               // con muchos vertices, el temblor de cada uno, pequeno
  const hondo = new Float32Array(p.count);                               // cuanto se hunde cada vertice: las grietas, mas oscuras
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).multiplyScalar(1 - salto / 2 + q() * salto);
    if (ondas.length) {
      u.copy(v).normalize();
      let d = 0;
      for (const [n, f, a, fase] of ondas) d += a * (Math.abs(Math.sin(f * u.dot(n) + fase)) - 0.5);
      v.multiplyScalar(1 + d);
      hondo[i] = d;
    }
    for (const [n, c] of planos) { const d = v.dot(n) - c; if (d > 0) v.addScaledVector(n, -d); }
    if (ondas.length) {
      // encima de los cortes, las escalas finas otra vez: la cara de fractura no queda como un plano de plastico
      let d = 0;
      for (let k = 2; k < ondas.length; k++) { const [n, f, a, fase] = ondas[k]; d += 0.7 * a * (Math.abs(Math.sin(f * u.dot(n) + fase)) - 0.5); }
      v.addScaledVector(u, d);
      hondo[i] += d;
    }
    v.y = Math.max(v.y, -0.45);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeBoundingBox();
  const bb = g.boundingBox, sx = Math.max(-bb.min.x, bb.max.x), sz = Math.max(-bb.min.z, bb.max.z), sy = bb.max.y - bb.min.y;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) / sx * rx, (p.getY(i) - bb.min.y) / sy * alto, p.getZ(i) / sz * rz);
  g.computeVertexNormals();
  // el color va POR VERTICE (antes iba por cara, con un tono al azar en cada una: era lo que dibujaba los
  // triangulitos) y sale de la posicion: grietas mas oscuras, crestas mas claras, manchas grandes y el MUSGO
  const P = g.attributes.position, Nv = g.attributes.normal, cc = new Float32Array(P.count * 3);
  const escala = 2.2 / Math.max(rx, 0.05), rango = rugoso * 0.12, s0 = semilla * 3.7;
  const fbm3 = (x, y, z, f) => fbm(x * f + y * f * 0.61 + s0, z * f - y * f * 0.47 - s0);
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), ny = Nv.getY(i);
    const h = rugoso > 0 ? hondo[i] : 0;
    const grieta = rugoso > 0 ? suave(-rango, rango, h) : 0.5;                 // 0 en lo hundido, 1 en la cresta
    const mancha = fbm3(x, y, z, escala);                                      // vetas grandes de la piedra
    const grano = fbm3(x, y, z, escala * 14);                                // grano fino: que no parezca plastilina
    let k = (0.8 + 0.22 * mancha + 0.14 * (grano - 0.5)) * (ny < -0.2 ? 0.74 : 1) * (rugoso > 0 ? 0.74 + 0.46 * grieta : 1);
    // el musgo: un poco, arriba (donde cae el agua) y metido en las grietas; borde roto por ruido fino
    const arriba = suave(0.25, 0.75, ny) * suave(0.2, 0.6, y / alto);
    const parche = suave(0.42, 0.56, fbm3(x, y, z, escala * 2.3) + 0.14 * (1 - grieta));
    // el pie (lo que asoma justo sobre la tierra; la roca va enterrada un 30 %): humedo, mas oscuro y con musgo
    const pie = suave(0.52, 0.3, y / alto);
    k *= 1 - 0.22 * pie;
    const m = Math.min(1, musgo * Math.max(arriba * parche, 0.55 * pie * suave(0.38, 0.6, fbm3(x, y, z, escala * 3.1)))
      * (0.75 + 0.5 * fbm3(x, y, z, escala * 9)));
    const vivo = fbm3(x, y, z, escala * 5.5);                                  // musgo mas verde o mas pardo
    const mr = 0.34 + 0.16 * vivo, mg = 0.5 + 0.14 * vivo, mb = 0.2 + 0.05 * vivo;
    cc[i * 3] = k * (1 - m) + k * mr * m;
    cc[i * 3 + 1] = k * 0.985 * (1 - m) + k * mg * m;
    cc[i * 3 + 2] = k * 0.95 * (1 - m) + k * mb * m;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cc, 3));
  // normales SUAVES salvo en las aristas vivas de los cortes (de mas de 50 grados): la piedra sigue partida
  const plana = toCreasedNormals(g, 50 * Math.PI / 180);
  g.deleteAttribute('color');
  return { plana, casco: g };
}
// juntar geometrias sueltas (con posicion, color y normal) en una, con su sitio y su tono horneados
function juntar(piezas) {
  let n = 0;
  for (const p of piezas) n += p.geo.attributes.position.count;
  const pos = new Float32Array(n * 3), colr = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  const v = new THREE.Vector3(), m3 = new THREE.Matrix3();
  for (const p of piezas) {
    const g = p.geo, P = g.attributes.position, C = g.attributes.color, Nn = g.attributes.normal;
    m3.getNormalMatrix(p.matriz);
    for (let i = 0; i < P.count; i++, o++) {
      v.fromBufferAttribute(P, i).applyMatrix4(p.matriz); pos.set([v.x, v.y, v.z], o * 3);
      v.fromBufferAttribute(Nn, i).applyMatrix3(m3).normalize(); nor.set([v.x, v.y, v.z], o * 3);
      const t = p.tono || { r: 1, g: 1, b: 1 };
      if (C) colr.set([C.getX(i) * t.r, C.getY(i) * t.g, C.getZ(i) * t.b], o * 3); else colr.set([t.r, t.g, t.b], o * 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}
function casco(g, grosor) {
  const c = g.clone(), p = c.attributes.position, n = c.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * grosor, p.getY(i) + n.getY(i) * grosor, p.getZ(i) + n.getZ(i) * grosor);
  return c.toNonIndexed();
}

// ---------------- hierba, flores y trebol (cada hoja con su raiz para el viento y la fisica) ----------------
function hoja(g, x0, z0, ang, alto, ancho, inclina, tonos, tramos = 3) {
  const cx = Math.cos(ang), cz = Math.sin(ang), px = -cz, pz = cx, R = [x0, z0];
  const P = (t, w) => { const o = inclina * Math.pow(t, 1.8); return [x0 + cx * o + px * w, alto * t * (1 - 0.25 * (inclina / alto) * t), z0 + cz * o + pz * w]; };
  if (tramos === 1) { tri(g, P(0, -ancho), P(0, ancho), P(1, 0), tonos[0], tonos[0], tonos[3], null, ARRIBA, R); return; }
  const T = [0, 0.38, 0.72], Wd = [1, 0.72, 0.42];
  const fila = T.map((t, k) => [P(t, -ancho * Wd[k]), P(t, ancho * Wd[k])]);
  for (let k = 0; k < 2; k++) {
    const [a, b] = fila[k], [c, d] = fila[k + 1];
    tri(g, a, b, d, tonos[k], tonos[k], tonos[k + 1], null, ARRIBA, R);
    tri(g, a, d, c, tonos[k], tonos[k + 1], tonos[k + 1], null, ARRIBA, R);
  }
  tri(g, fila[2][0], fila[2][1], P(1, 0), tonos[2], tonos[2], tonos[3], null, ARRIBA, R);
}
const VERDES = [
  [0x2f3d1c, 0x4f6a2c, 0x7b9644, 0xa9bd66], [0x34421f, 0x587330, 0x8aa04c, 0xb9c474],
  [0x2b3a20, 0x46603a, 0x6b8a4c, 0x93ab6c], [0x4a4a26, 0x75703c, 0xa59a5c, 0xcfc18a],
].map((t) => t.map(col));
function tonosHoja(q) {
  const u = q(), base = u < 0.5 ? VERDES[0] : u < 0.75 ? VERDES[1] : u < 0.9 ? VERDES[2] : VERDES[3];
  const k = 0.92 + q() * 0.16;
  return base.map((c) => c.clone().multiplyScalar(k));
}
// una mata (de 20 cm de alto de media; cada instancia la escala) y un trozo de cesped corto
function geoMata(sem, tramos = 3) {
  const q = azar(sem), g = malla(), n = 10 + Math.floor(q() * 12);
  for (let h = 0; h < n; h++) {
    const a = q() * 6.2832, rad = 0.024 * Math.sqrt(q()), alto = 0.2 * (0.55 + 0.6 * q());
    hoja(g, Math.cos(a) * rad, Math.sin(a) * rad, a + (q() - 0.5) * 0.9, alto, 0.0028 + q() * 0.0025, alto * (0.15 + 0.5 * q()), tonosHoja(q), tramos);
  }
  return geometria(g);
}
function geoCesped(sem) {
  const q = azar(sem), g = malla();
  for (let h = 0; h < 30; h++) {
    const a = q() * 6.2832, rad = 0.11 * Math.sqrt(q()), alto = 0.03 + 0.065 * q();
    hoja(g, Math.cos(a) * rad, Math.sin(a) * rad, q() * 6.2832, alto, 0.0024 + q() * 0.0016, alto * (0.1 + 0.5 * q()), tonosHoja(q), 1);
  }
  return geometria(g);
}
// la cabeza de una flor, en el plano que mira hacia `eje` desde (hx, hy, hz)
function cabeza(hx, hy, hz) {
  const eje = new THREE.Vector3(-0.35, 1, 0.3).normalize(), u = new THREE.Vector3(1, 0, 0).cross(eje).normalize(), v = eje.clone().cross(u);
  return (rad, a, alt = 0) => [hx + (u.x * Math.cos(a) + v.x * Math.sin(a)) * rad + eje.x * alt, hy + (u.y * Math.cos(a) + v.y * Math.sin(a)) * rad + eje.y * alt, hz + (u.z * Math.cos(a) + v.z * Math.sin(a)) * rad + eje.z * alt];
}
function tallo(g, alto, inc, ang, R) {
  const verde = col(0x55703a), w = 0.0016;
  const hx = Math.cos(ang) * inc, hz = Math.sin(ang) * inc, mx = hx * 0.3, mz = hz * 0.3, my = alto * 0.55;
  tri(g, [-w, 0, 0], [w, 0, 0], [mx + w * 0.7, my, mz], verde, verde, verde, null, ARRIBA, R);
  tri(g, [-w, 0, 0], [mx + w * 0.7, my, mz], [mx - w * 0.7, my, mz], verde, verde, verde, null, ARRIBA, R);
  tri(g, [mx - w * 0.7, my, mz], [mx + w * 0.7, my, mz], [hx, alto, hz], verde, verde, verde, null, ARRIBA, R);
  return [hx, alto, hz];
}
function geoMargarita(sem) {
  const q = azar(sem), g = malla(), R = [0, 0], alto = 0.14, ang = q() * 6.28;
  const en = cabeza(...tallo(g, alto, alto * (0.1 + 0.12 * q()), ang, R));
  const blanco = col(0xe4e9ee), punta = col(0xdcd0dc), amarillo = col(0xe9be3a), centro = col(0xc0902a);
  for (let p = 0; p < 12; p++) {
    const a = (p / 12) * 6.2832 + q() * 0.12, rp = 0.027 * (0.88 + 0.2 * q());
    const b1 = en(0.007, a - 0.0024 / 0.007), b2 = en(0.007, a + 0.0024 / 0.007), m1 = en(0.017, a - 0.0042 / 0.017, -0.001), m2 = en(0.017, a + 0.0042 / 0.017, -0.001), t = en(rp, a, -0.003);
    tri(g, b1, b2, m2, blanco, blanco, blanco, null, ARRIBA, R);
    tri(g, b1, m2, m1, blanco, blanco, blanco, null, ARRIBA, R);
    tri(g, m1, m2, t, blanco, blanco, punta, null, ARRIBA, R);
  }
  for (let p = 0; p < 7; p++) tri(g, en(0, 0, 0.0055), en(0.0085, (p / 7) * 6.2832, 0.0012), en(0.0085, ((p + 1) / 7) * 6.2832, 0.0012), amarillo, centro, centro, null, ARRIBA, R);
  return geometria(g);
}
function geoBoton(sem) {
  const q = azar(sem), g = malla(), R = [0, 0], alto = 0.17;
  const en = cabeza(...tallo(g, alto, alto * (0.1 + 0.12 * q()), q() * 6.28, R));
  const am = col(0xedc53a), osc = col(0xc8952a);
  for (let p = 0; p < 5; p++) {
    const a = (p / 5) * 6.2832 + q() * 0.2;
    tri(g, en(0.002, a - 0.5), en(0.002, a + 0.5), en(0.015, a + 0.3, 0.008), osc, osc, am, null, ARRIBA, R);
    tri(g, en(0.002, a - 0.5), en(0.015, a + 0.3, 0.008), en(0.015, a - 0.3, 0.008), osc, am, am, null, ARRIBA, R);
  }
  return geometria(g);
}
// una mancha de trebol: hojas de tres foliolos sobre tallitos, en 20 cm
function geoTrebol(sem) {
  const q = azar(sem), g = malla(), verde = col(0x557434), claro = col(0x7d9a4d), tal = col(0x5b7038);
  for (let k = 0; k < 9; k++) {
    const a0 = q() * 6.2832, rad = 0.1 * Math.sqrt(q()), x = Math.cos(a0) * rad, z = Math.sin(a0) * rad;
    const y = 0.025 + q() * 0.04, s = 0.012 + q() * 0.008, giro = q() * 6.2832, R = [x, z];
    tri(g, [x - 0.0015, 0, z], [x + 0.0015, 0, z], [x, y, z], tal, tal, tal, null, ARRIBA, R);
    for (let f = 0; f < 3; f++) {
      const a = giro + f * 2.094, ax = Math.cos(a), az = Math.sin(a);
      const pts = [-0.75, -0.25, 0.25, 0.75].map((w) => { const b = a + w * 0.9, l = w * w < 0.1 ? 1.05 : 0.9; return [x + Math.cos(b) * s * l, y + s * 0.25, z + Math.sin(b) * s * l]; });
      const o = [x + ax * s * 0.08, y, z + az * s * 0.08];
      for (let t = 0; t < 3; t++) tri(g, o, pts[t], pts[t + 1], verde, t === 1 ? claro : verde, verde, null, ARRIBA, R);
    }
  }
  return geometria(g);
}

// ---------------- sombreador de todo lo que crece: viento + fisica, por hoja ----------------
const H_REF = 0.25;
function materialHierba(tono, comunes, funde) {
  const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: tono, side: THREE.DoubleSide });
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, comunes, { uFunde: { value: new THREE.Vector2(...funde) } });
    s.vertexShader = `attribute vec2 raiz;
uniform float uTiempo;
uniform sampler2D uCampo;
uniform vec2 uCampoOrigen;
uniform float uCampoLado;
uniform vec2 uFunde;
uniform sampler2D uMoja;
uniform vec4 uMojaRect;
uniform float uMojaSeca;
varying float vMojaH;
varying vec3 vPosM;
` + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        vec3 base = (instanceMatrix * vec4(raiz.x, 0.0, raiz.y, 1.0)).xyz;
        vec3 ex = instanceMatrix[0].xyz, ey = instanceMatrix[1].xyz, ez = instanceMatrix[2].xyz;
        float hy = max(0.0, position.y) * length(ey);
        float k = hy / ${H_REF.toFixed(2)};
        float doblez = k < 1.0 ? k * k : 1.0 + 0.55 * (k - 1.0);
        // viento: rachas que cruzan la parcela y un temblor
        float fase = dot(base.xz, vec2(0.11, 0.04)) - uTiempo * 0.45;
        float racha = pow(0.5 + 0.5 * sin(fase * 6.2832), 3.0);
        float temblor = sin(uTiempo * 2.6 + base.x * 3.7 + base.z * 2.3) * 0.5 + sin(uTiempo * 4.3 + base.z * 5.9) * 0.25;
        vec3 d = vec3(0.92, 0.0, 0.38) * (0.012 + 0.05 * racha + 0.012 * temblor) * doblez;
        // la fisica (pies, cuerpo, capa, caidas): desplazamiento de la punta a ${H_REF} m y lo aplastada
        vec2 uv = (base.xz - uCampoOrigen) / uCampoLado;
        if (uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0) {
          vec4 c = texture2D(uCampo, uv);
          d.xz += c.xy * doblez;
          d.y -= hy * 0.55 * c.z;
          // la pisada se LEE: la hoja tumbada ensena su haz al cielo y brilla mas (sin esto el rastro apenas se veia)
          vColor.rgb *= mix(vec3(1.0), vec3(1.3, 1.24, 1.02), c.z);
        }
        // mojada por las gotas del charco: mas oscura y un poco vencida por el peso del agua; se seca sola
        vec2 um = (base.xz - uMojaRect.xy) / uMojaRect.zw;
        vMojaH = 0.0;
        vPosM = (instanceMatrix * vec4(position, 1.0)).xyz;
        if (um.x > 0.0 && um.y > 0.0 && um.x < 1.0 && um.y < 1.0) {
          vec4 m = texture2D(uMoja, um);
          float moja = m.g > 0.0 ? m.r * clamp(1.0 - (uTiempo - m.g) / uMojaSeca, 0.0, 1.0) : 0.0;
          vColor.rgb *= mix(vec3(1.0), vec3(0.5, 0.62, 0.46), moja);    // mojada: mas oscura y mas verde
          d.y -= hy * 0.15 * moja;                                       // y vencida por el peso del agua
          vMojaH = moja;
        }
        float h = max(hy, 1e-3);
        float l = min(length(d.xz), 0.95 * h);
        d.y -= h - sqrt(h * h - l * l);
        float queda = 1.0 - smoothstep(uFunde.x, uFunde.y, distance(instanceMatrix[3].xz, cameraPosition.xz));
        vec3 loc = vec3(dot(ex, d) / dot(ex, ex), dot(ey, d) / dot(ey, ey), dot(ez, d) / dot(ez, ez));
        transformed = (transformed + loc) * queda;
      }`);
    // la normal hacia ARRIBA por las dos caras (three le daba la vuelta por detras: hojas de espaldas, negras)
    s.fragmentShader = s.fragmentShader.replace('#include <normal_fragment_begin>',
      THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0'))
      .replace('#include <common>', '#include <common>\nvarying float vMojaH;\nvarying vec3 vPosM;')
      // las gotitas que se quedan en las hojas mojadas: puntos que brillan, quietos sobre la hoja
      .replace('#include <opaque_fragment>', `if (vMojaH > 0.01) {
        vec3 celda = floor(vPosM * 140.0);
        float n = fract(sin(dot(celda, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        outgoingLight += vMojaH * step(0.94, n) * vec3(0.75, 0.8, 0.7);
      }
      #include <opaque_fragment>`);
  };
  return mat;
}

// ---------------- el charco: agua con fisica (agua_fisica.js) ----------------
// La superficie es la rejilla de la simulacion: cada vertice sube y baja con su celda, y la normal sale de las vecinas.
// Refleja el cielo y la pradera (mas cuanto mas rasante se mira: Fresnel), brilla donde el sol se refleja y deja ver el
// barro del fondo, mas cuanto menos hondo; en la orilla se desvanece con la profundidad.
function materialAgua(tex, nx, ny, celda, giro, dirSol) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uAgua: { value: tex }, uTexel: { value: new THREE.Vector2(1 / nx, 1 / ny) }, uCelda: { value: celda },
      uCos: { value: Math.cos(giro) }, uSin: { value: Math.sin(giro) }, uTiempo: { value: 0 },
      uSol: { value: dirSol.clone() }, uCielo: { value: col(0xd9d8c2) }, uHorizonte: { value: col(0x6d7444) },
      uFondo: { value: col(0x3e3122) }, uTurbia: { value: col(0x4c4532) },
    },
    vertexShader: `uniform sampler2D uAgua; varying vec2 vUv; varying vec3 vMundo;
void main() {
  vUv = uv;
  vec4 m = modelMatrix * vec4(position, 1.0);
  m.y += texture2D(uAgua, uv).r;
  vMundo = m.xyz;
  gl_Position = projectionMatrix * viewMatrix * m;
}`,
    fragmentShader: `uniform sampler2D uAgua; uniform vec2 uTexel; uniform float uCelda, uCos, uSin, uTiempo;
uniform vec3 uSol, uCielo, uHorizonte, uFondo, uTurbia;
varying vec2 vUv; varying vec3 vMundo;
#include <common>
void main() {
  vec4 a = texture2D(uAgua, vUv);
  float hondo = a.g;
  if (hondo <= 0.0005) discard;
  float hl = texture2D(uAgua, vUv - vec2(uTexel.x, 0.0)).r, hr = texture2D(uAgua, vUv + vec2(uTexel.x, 0.0)).r;
  float hd = texture2D(uAgua, vUv - vec2(0.0, uTexel.y)).r, hu = texture2D(uAgua, vUv + vec2(0.0, uTexel.y)).r;
  vec2 g = vec2(hr - hl, hu - hd) / (2.0 * uCelda);
  // el aire riza la superficie un poco aunque nadie la toque
  vec2 p = vMundo.xz;
  g += 0.014 * vec2(sin(p.x * 23.0 + p.y * 9.0 + uTiempo * 1.9), sin(p.y * 27.0 - p.x * 7.0 + uTiempo * 2.4))
     + 0.008 * vec2(sin(p.x * 61.0 - p.y * 33.0 - uTiempo * 3.1), sin(p.y * 57.0 + p.x * 29.0 + uTiempo * 2.7));
  vec3 nl = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 N = normalize(vec3(nl.x * uCos - nl.z * uSin, nl.y, nl.x * uSin + nl.z * uCos));
  vec3 V = normalize(cameraPosition - vMundo);
  vec3 R = reflect(-V, N);
  float fres = 0.08 + 0.92 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 refl = mix(uHorizonte, uCielo, smoothstep(-0.02, 0.35, R.y));
  float brillo = pow(max(dot(R, uSol), 0.0), 220.0) * 2.4 + pow(max(dot(R, uSol), 0.0), 24.0) * 0.05;
  // el fondo de barro se ve a traves; cuanto mas hondo, mas turbia y oscura
  vec3 fondo = mix(uFondo, uTurbia, smoothstep(0.0, 0.05, hondo));
  vec3 c = mix(fondo, refl, fres) + brillo * vec3(1.0, 0.94, 0.8);
  float alfa = mix(0.18, 0.6, smoothstep(0.0, 0.04, hondo));
  alfa = max(alfa, min(fres * 1.4, 1.0)) * smoothstep(0.0005, 0.006, hondo);
  gl_FragColor = vec4(c, clamp(alfa + brillo, 0.0, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    transparent: true, depthWrite: false,
  });
}
// LA SUELA de la bota del 18, como campo de distancias (64 x 128, la punta arriba): cuanto le falta a cada punto para
// llegar al borde de la suela (en pixeles, negativo dentro) y donde van las rayas de la suela. De aqui sale la forma
// de cada huella que se hunde en la tierra (ver «las huellas» en crearMundo)
const SUELA = (() => {
  const W = 64, Hh = 128, dentro = new Uint8Array(W * Hh);
  const en = (u, v) => {
    const talon = ((u - 0.5) / 0.3) ** 2 + ((v - 0.2) / 0.17) ** 2 < 1;
    const planta = ((u - 0.5) / 0.4) ** 2 + ((v - 0.66) / 0.29) ** 2 < 1;
    const puente = v > 0.2 && v < 0.66 && Math.abs(u - 0.53) < 0.27 + 0.1 * Math.abs(v - 0.43) / 0.23;  // el arco, hacia dentro
    return talon || planta || puente;
  };
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) dentro[j * W + i] = en((i + 0.5) / W, 0.04 + 0.92 * (j + 0.5) / Hh) ? 1 : 0;
  // la distancia al borde a lo bruto: es pequena y se hace una vez
  const borde = [];
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i;
    if ((i > 0 && dentro[k - 1] !== dentro[k]) || (j > 0 && dentro[k - W] !== dentro[k])) borde.push([i, j]);
  }
  const dist = new Float32Array(W * Hh), raya = new Uint8Array(W * Hh);
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    let m = 1e9;
    for (const [bi, bj] of borde) m = Math.min(m, (bi - i) ** 2 + (bj - j) ** 2);
    const k = j * W + i;
    dist[k] = Math.sqrt(m) * (dentro[k] ? -1 : 1);
    raya[k] = j > 14 && j % 9 < 3 ? 1 : 0;
  }
  // distancia (px) y raya en (u, v) de 0 a 1, interpolada; fuera del cuadro, lejos
  function en_uv(u, v) {
    const x = u * W - 0.5, y = v * Hh - 0.5;
    if (x < 0 || y < 0 || x >= W - 1 || y >= Hh - 1) return [99, 0];
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, k = j * W + i;
    const d = (dist[k] * (1 - fx) + dist[k + 1] * fx) * (1 - fy) + (dist[k + W] * (1 - fx) + dist[k + W + 1] * fx) * fy;
    return [d, raya[k]];
  }
  return { W, Hh, en_uv };
})();

// ---------------- el mundo ----------------
export function crearMundo(scene) {
  const grupo = new THREE.Group();
  scene.add(grupo);
  const tono = new THREE.DataTexture(new Uint8Array([120, 175, 222, 255].flatMap((v) => [v, v, v, 255])), 4, 1, THREE.RGBAFormat);
  tono.minFilter = tono.magFilter = THREE.NearestFilter;
  tono.needsUpdate = true;

  // fondo liso (como la muestra) y la sombra del bloque abajo
  scene.background = col(0xc9c7ad);
  scene.fog = null;
  const cielo = new THREE.HemisphereLight(0xf3efd6, 0x55603a, 1.55);
  const sol = new THREE.DirectionalLight(0xffe3b2, 2.7);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { near: 0.5, far: 40, left: -9, right: 9, top: 9, bottom: -9 });
  sol.shadow.bias = -0.0004;
  sol.shadow.normalBias = 0.01;
  scene.add(cielo, sol, sol.target);
  const DIR_SOL = new THREE.Vector3(-0.5, 0.68, 0.53).normalize();
  const _ejeU = new THREE.Vector3().crossVectors(DIR_SOL, new THREE.Vector3(0, 1, 0)).normalize();
  const _ejeV = new THREE.Vector3().crossVectors(_ejeU, DIR_SOL).normalize();
  const _foco = new THREE.Vector3();
  const mesa = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ color: 0x3a3424, opacity: 0.28 }));
  mesa.rotation.x = -Math.PI / 2;
  mesa.position.y = FONDO - 0.01;
  mesa.receiveShadow = true;
  grupo.add(mesa);

  // (MeshToonMaterial no tiene flatShading en three 0.185; las rocas van suaves con aristas vivas: toCreasedNormals)
  const toon = (extra = {}) => new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: tono, ...extra });
  const tinta = new THREE.MeshBasicMaterial({ color: TINTA, side: THREE.BackSide });

  // el bloque y su linea de tinta
  const suelo = new THREE.Mesh(bloque(), toon());
  suelo.receiveShadow = true;
  suelo.name = 'suelo';
  grupo.add(suelo);
  const sueloTinta = new THREE.Mesh(bloque(0.006, 0.012, 0.012, false), tinta);
  sueloTinta.name = 'suelo_tinta';
  grupo.add(sueloTinta);

  // ---------------- rocas, piedras en los cortes y chinas del camino (en dos mallas: la roca y su tinta) ----------------
  {
    const cuerpos = [], cascos = [];
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const poner = (pz, x, y, z, giro, tonoC, grosor) => {
      mt.compose(new THREE.Vector3(x, y, z), q.setFromEuler(e.set(0, giro, 0)), new THREE.Vector3(1, 1, 1));
      cuerpos.push({ geo: pz.plana, matriz: mt.clone(), tono: tonoC });
      cascos.push({ geo: casco(pz.casco, grosor), matriz: mt.clone() });
    };
    // la huella de la roca: para cada angulo, lo mas lejos que llega la piedra hasta 15 cm sobre el suelo (lo que
    // tocaria la hierba); los angulos sin vertice toman el de al lado y se alisa un poco
    const _w = new THREE.Vector3();
    function medirHuella(o, geo, matriz) {
      const P = geo.attributes.position, per = new Float32Array(PERFIL_N);
      for (let i = 0; i < P.count; i++) {
        _w.fromBufferAttribute(P, i).applyMatrix4(matriz);
        if (_w.y > altura(_w.x, _w.z) + 0.15) continue;
        const dx = _w.x - o.x, dz = _w.z - o.z, k = Math.floor(((Math.atan2(dz, dx) / 6.283185307 + 1) % 1) * PERFIL_N) % PERFIL_N;
        per[k] = Math.max(per[k], Math.hypot(dx, dz));
      }
      for (let pasada = 0; pasada < PERFIL_N; pasada++) {
        let falta = false;
        for (let k = 0; k < PERFIL_N; k++) if (!per[k]) { per[k] = Math.max(per[(k + 1) % PERFIL_N], per[(k + PERFIL_N - 1) % PERFIL_N]); falta ||= !per[k]; }
        if (!falta) break;
      }
      o.perfil = per.map((v, k) => (per[(k + PERFIL_N - 1) % PERFIL_N] + 2 * v + per[(k + 1) % PERFIL_N]) / 4);
    }
    for (const o of ROCAS) {
      // la base: lo mas bajo bajo la huella, y enterrada un tercio (en cuesta no asoma la panza)
      let hmin = altura(o.x, o.z);
      for (let k = 0; k < 10; k++) { const a = (k / 10) * 6.2832; hmin = Math.min(hmin, altura(o.x + Math.cos(a) * o.r * 0.85, o.z + Math.sin(a) * o.r * 0.85)); }
      // poligonos segun el tamano: la grande 4.500 triangulos, las sueltas 180-500
      const det = o.r > 0.9 ? 14 : o.r > 0.55 ? 10 : o.r > 0.3 ? 7 : o.r > 0.15 ? 4 : 2;
      const pz = piedra(o.sem, o.r, o.alto, o.r * (0.78 + 0.2 * r()), det, o.musgo, 1);
      poner(pz, o.x, hmin - o.alto * 0.3, o.z, r() * 6.28, col(0x9a9383).lerp(col(0x8b7d68), r() * 0.6).multiplyScalar(0.9 + 0.18 * r()), Math.min(0.012, 0.002 + 0.008 * o.r));
      medirHuella(o, pz.casco, mt);
      // piedrecillas sueltas al pie de las grandes (con su propio azar: la hierba y las flores no se mueven)
      if (o.r > 0.3) {
        const rp = azar(o.sem * 13 + 5);
        for (let k = 0, n = 4 + Math.floor(rp() * 7); k < n; k++) {
          const a = rp() * 6.2832, s = 0.012 + Math.pow(rp(), 2) * 0.05;
          const rad = radioRoca(o, Math.cos(a), Math.sin(a)) + 0.01 + rp() * 0.22;
          const x = o.x + Math.cos(a) * rad, z = o.z + Math.sin(a) * rad;
          const pc = piedra(o.sem * 31 + k, s, s * (0.5 + 0.35 * rp()), s * (0.7 + 0.3 * rp()), s > 0.035 ? 1 : 0, 0);
          poner(pc, x, altura(x, z) - s * 0.25, z, rp() * 6.28, col(0x958d7d).lerp(col(0x7f7466), rp()).multiplyScalar(0.85 + 0.15 * rp()), 0.0015 + 0.02 * s);
        }
      }
    }
    // chinas medio hundidas en el camino
    let n = 0;
    for (let k = 0; k < 900 && n < 230; k++) {
      const [ax, az] = CAMINO[Math.floor(r() * CAMINO.length)];
      const x = ax + (r() - 0.5) * ANCHO * 2.1, z = az + (r() - 0.5) * ANCHO * 2.1;
      if (Math.abs(x) > 9.85 || Math.abs(z) > 9.85 || distCamino(x, z) > ANCHO + 0.05 || eCharco(x, z) < 1.05) continue;
      const s = 0.008 + Math.pow(r(), 2.2) * 0.045;
      const pz = piedra(500 + k, s, s * (0.45 + 0.3 * r()), s * (0.75 + 0.3 * r()), 0, 0);
      poner(pz, x, altura(x, z) - s * 0.15, z, r() * 6.28, col(0xa49b88).lerp(col(0x8a7f70), r()).multiplyScalar(0.95 + 0.1 * r()), 0.0015 + 0.02 * s);
      n++;
    }
    // piedras que asoman en los cortes del bloque
    for (let k = 0; k < 70; k++) {
      const lado = Math.floor(r() * 4), t = (r() - 0.5) * 19.4, y = -0.5 - r() * 1.4, s = 0.05 + Math.pow(r(), 2) * 0.16;
      const [x, z] = lado === 0 ? [t, -LADO] : lado === 1 ? [t, LADO] : lado === 2 ? [-LADO, t] : [LADO, t];
      const pz = piedra(900 + k, s, s * 1.4, s, 2, 0, 0.7);
      poner(pz, x, y - s * 0.7, z, r() * 6.28, col(0x958d7d).multiplyScalar(0.85 + 0.2 * r()), 0.004);
    }
    const roca = new THREE.Mesh(juntar(cuerpos), toon());
    roca.castShadow = roca.receiveShadow = true;
    roca.name = 'rocas';
    grupo.add(roca);
    const rt = new THREE.Mesh(juntar(cascos), tinta);
    rt.name = 'rocas_tinta';
    grupo.add(rt);
    // la sombra de contacto (donde la piedra entra en la tierra no llega luz): una banda fina sobre el suelo que
    // sigue la huella medida, de un 60 % de oscuridad en la piedra a nada a 8-20 cm
    const sp = [], sc = [], si = [];
    for (const o of ROCAS) {
      if (!o.perfil || o.r < 0.1) continue;
      const ancho = 0.07 + 0.13 * Math.min(1, o.r), base = sp.length / 3;
      for (let k = 0; k <= PERFIL_N; k++) {
        const a = (k / PERFIL_N) * 6.2832, ca = Math.cos(a), sa = Math.sin(a), rr = o.perfil[k % PERFIL_N];
        for (const [d, al] of [[-0.03, 0.6], [ancho * 0.35, 0.3], [ancho, 0]]) {
          const x = o.x + ca * (rr + d), z = o.z + sa * (rr + d);
          sp.push(x, altura(x, z) + 0.004, z);
          sc.push(0.13, 0.11, 0.07, al);
        }
      }
      for (let k = 0; k < PERFIL_N; k++) for (let t = 0; t < 2; t++) {
        const a = base + k * 3 + t, b = a + 3;
        si.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const gs = new THREE.BufferGeometry();
    gs.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    gs.setAttribute('color', new THREE.Float32BufferAttribute(sc, 4));
    gs.setIndex(si);
    const sombraContacto = new THREE.Mesh(gs, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
    sombraContacto.name = 'rocas_contacto';
    sombraContacto.renderOrder = 1;
    grupo.add(sombraContacto);
  }

  // ---------------- hojas secas y ramitas ----------------
  {
    const g = malla(), parda = col(0x9a6f3c), oscura = col(0x7a5530), rama = col(0x8b7558), rClara = col(0xa38d6c);
    for (let k = 0; k < 70; k++) {
      const enCamino = k < 30;
      let x, z;
      if (enCamino) { const [ax, az] = CAMINO[Math.floor(r() * CAMINO.length)]; x = ax + (r() - 0.5) * ANCHO * 1.6; z = az + (r() - 0.5) * ANCHO * 1.6; }
      else { x = (r() - 0.5) * 19.4; z = (r() - 0.5) * 19.4; }
      if (Math.abs(x) > 9.8 || Math.abs(z) > 9.8 || distRoca(x, z) < 0.05 || eCharco(x, z) < 1.1) continue;
      const a = r() * 6.28, L = 0.045 + r() * 0.03, ca = Math.cos(a), sa = Math.sin(a), y = altura(x, z) + 0.004;
      const P = (t, w, dy = 0) => [x + ca * (t - 0.5) * L - sa * w * L, y + dy, z + sa * (t - 0.5) * L + ca * w * L];
      const tinte = 0.85 + 0.3 * r();
      const pa = parda.clone().multiplyScalar(tinte), os = oscura.clone().multiplyScalar(tinte);
      for (const ld of [-1, 1]) {
        let prev = P(0, 0);
        for (const [t, w] of [[0.1, 0.18], [0.35, 0.3], [0.6, 0.28], [0.85, 0.14]]) { const q2 = P(t, w * ld, 0.004); tri(g, prev, q2, P(t, 0, 0.0015), pa, pa, os, null, ARRIBA); prev = q2; }
        tri(g, prev, P(1, 0, 0.002), P(0.85, 0, 0.0015), pa, os, os, null, ARRIBA);
      }
    }
    for (let k = 0; k < 14; k++) {
      const x = (r() - 0.5) * 18, z = (r() - 0.5) * 18;
      if (distRoca(x, z) < 0.3) continue;
      const a = r() * 6.28, L = 0.12 + r() * 0.16, rad = 0.004 + r() * 0.004;
      const p0 = [x, altura(x, z) + rad + 0.002, z], p1 = [x + Math.cos(a) * L, 0, z + Math.sin(a) * L];
      p1[1] = altura(p1[0], p1[2]) + rad + 0.002;
      const dx = p1[0] - p0[0], dz = p1[2] - p0[2], l = Math.hypot(dx, dz), nx = -dz / l, nz = dx / l;
      for (let s = 0; s < 4; s++) {
        const t0 = (s / 4) * 6.2832, t1 = ((s + 1) / 4) * 6.2832;
        const o = (p, t) => [p[0] + nx * Math.cos(t) * rad, p[1] + Math.sin(t) * rad, p[2] + nz * Math.cos(t) * rad];
        const c = s % 2 ? rama : rClara, fu = [nx * Math.cos((t0 + t1) / 2), Math.sin((t0 + t1) / 2), nz * Math.cos((t0 + t1) / 2)];
        tri(g, o(p0, t0), o(p1, t0), o(p1, t1), c, c, c, fu, fu);
        tri(g, o(p0, t0), o(p1, t1), o(p0, t1), c, c, c, fu, fu);
      }
    }
    const m = new THREE.Mesh(geometria(g), toon({ side: THREE.DoubleSide }));
    m.receiveShadow = true;
    m.name = 'hojas_secas';
    grupo.add(m);
  }

  // ---------------- el charco ----------------
  const comunes = {
    uTiempo: { value: 0 }, uCampo: { value: null }, uCampoOrigen: { value: new THREE.Vector2(1e5, 1e5) }, uCampoLado: { value: 22 },
  };
  // la rejilla del agua va en los ejes del charco (u a lo largo, v a lo ancho), con un 10 % de margen
  const CC = Math.cos(CHARCO.giro), CS = Math.sin(CHARCO.giro);
  const AW = CHARCO.rx * 2.2, AH = CHARCO.rz * 2.2, ACELDA = 0.015;
  const aMundo = (xs, ys) => { const lu = xs - AW / 2, lv = ys - AH / 2; return [CHARCO.x + lu * CC - lv * CS, CHARCO.z + lu * CS + lv * CC]; };
  const aRejilla = (x, z) => { const dx = x - CHARCO.x, dz = z - CHARCO.z; return [dx * CC + dz * CS + AW / 2, -dx * CS + dz * CC + AH / 2]; };
  const agua = crearAgua({ ancho: AW, alto: AH, celda: ACELDA, hondo: (xs, ys) => { const [x, z] = aMundo(xs, ys); return NIVEL_CHARCO - altura(x, z); } });
  const aguaDatos = new Uint16Array(agua.nx * agua.ny * 4);
  const aguaTex = new THREE.DataTexture(aguaDatos, agua.nx, agua.ny, THREE.RGBAFormat, THREE.HalfFloatType);
  aguaTex.minFilter = aguaTex.magFilter = THREE.LinearFilter;
  for (let k = 0; k < agua.prof.length; k++) aguaDatos[k * 4 + 1] = THREE.DataUtils.toHalfFloat(agua.agua[k] ? agua.prof[k] : 0);
  aguaTex.needsUpdate = true;
  const matAgua = materialAgua(aguaTex, agua.nx, agua.ny, ACELDA, CHARCO.giro, DIR_SOL);
  {
    const pos = [], uv = [], idx = [], nx = agua.nx, ny = agua.ny;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const [x, z] = aMundo((i + 0.5) * ACELDA, (j + 0.5) * ACELDA);
      pos.push(x, NIVEL_CHARCO, z); uv.push((i + 0.5) / nx, (j + 0.5) / ny);
    }
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i; idx.push(a, a + nx, a + 1, a + 1, a + nx, a + nx + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    const charco = new THREE.Mesh(g, matAgua);
    charco.renderOrder = 1;
    charco.name = 'charco';
    grupo.add(charco);
  }
  // las salpicaduras: GOTAS de agua de verdad, esferitas de 1,2 a 6 mm (muchas pequenas y pocas grandes). El aire frena
  // mas a las pequenas; se estiran en la direccion en que van (asi se ve una gota rapida) y son casi transparentes, con
  // el borde claro (Fresnel) y el brillo del sol. Al caer al charco dejan su onda; en la tierra del camino, una MANCHA
  // mojada con sus salpicaduras pequenas alrededor, que se seca (`mancha`, en las huellas).
  const GOTAS = 360, VER = 1.35;                                    // VER: un poco mas grandes de lo real, para leerse
  const gP = new Float32Array(GOTAS * 3).fill(-50), gV = new Float32Array(GOTAS * 3), gR = new Float32Array(GOTAS), gVivas = new Uint8Array(GOTAS);
  const matGota = new THREE.ShaderMaterial({
    uniforms: { uSol: { value: DIR_SOL.clone() }, uCielo: { value: col(0xeceadb) }, uDentro: { value: col(0x7d8466) } },
    vertexShader: `varying vec3 vN; varying vec3 vW;
void main() {
  mat4 m = modelMatrix * instanceMatrix;
  vec4 w = m * vec4(position, 1.0);
  vW = w.xyz; vN = normalize(mat3(m) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: `uniform vec3 uSol, uCielo, uDentro; varying vec3 vN; varying vec3 vW;
#include <common>
void main() {
  vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
  float f = pow(1.0 - abs(dot(N, V)), 2.2);
  float brillo = pow(max(dot(reflect(-V, N), uSol), 0.0), 90.0);
  // por dentro se ve lo de detras (la pradera, del reves y oscura); por el borde, el cielo; y el punto del sol
  // (macizas: con el centro vacio parecian burbujas)
  vec3 c = mix(uDentro, uCielo, 0.25 + 0.6 * f) + brillo * vec3(1.6, 1.55, 1.4);
  gl_FragColor = vec4(c, clamp(0.6 + 0.35 * f + brillo, 0.0, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    transparent: true, depthWrite: false,
  });
  const gotas = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), matGota, GOTAS);
  const _gm = new THREE.Matrix4(), _gq = new THREE.Quaternion(), _gv = new THREE.Vector3(), _gs = new THREE.Vector3(), _gp = new THREE.Vector3(), _gY = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < GOTAS; i++) gotas.setMatrixAt(i, _gm.makeScale(0, 0, 0));
  gotas.frustumCulled = false;
  gotas.name = 'gotas';
  grupo.add(gotas);
  let gSig = 0, gotasCaidas = 0;
  // n gotas desde (x, y, z): fuerza = lo rapidas que salen; (bx, bz) = hacia donde las empuja el pie (m/s); abanico =
  // 1 corona entera, menos = solo hacia delante
  function salpicar(x, z, n, fuerza, bx = 0, bz = 0, y = NIVEL_CHARCO + 0.005, abanico = 1) {
    for (let k = 0; k < n; k++) {
      const i = gSig; gSig = (gSig + 1) % GOTAS;
      const rr = 0.0012 + Math.pow(r(), 2.6) * 0.0048;            // muchas pequenas, pocas grandes
      const lenta = 1 - 0.45 * (rr - 0.0012) / 0.0048;              // las grandes salen mas despacio
      const hay = bx || bz, base = Math.atan2(bz, bx), a = hay ? base + (r() - 0.5) * 6.2832 * abanico : r() * 6.2832;
      const h = (0.2 + 0.7 * r()) * fuerza * lenta, sube = (0.5 + 1.1 * r()) * fuerza * lenta;
      const d0 = 0.02 + 0.03 * r();
      gP.set([x + Math.cos(a) * d0, y, z + Math.sin(a) * d0], i * 3);
      gV.set([Math.cos(a) * h + bx * 0.5, sube, Math.sin(a) * h + bz * 0.5], i * 3);
      gR[i] = rr;
      gVivas[i] = 1;
    }
  }
  function moverGotas(dt) {
    for (let i = 0; i < GOTAS; i++) {
      if (!gVivas[i]) continue;
      const k = i * 3, freno = Math.exp(-dt * 0.0006 / gR[i]);      // el aire: 0,5/s a la pequena, 0,1/s a la grande
      gV[k] *= freno; gV[k + 2] *= freno; gV[k + 1] = gV[k + 1] * freno - 9.8 * dt;
      gP[k] += gV[k] * dt; gP[k + 1] += gV[k + 1] * dt; gP[k + 2] += gV[k + 2] * dt;
      const x = gP[k], y = gP[k + 1], z = gP[k + 2];
      let muere = false;
      if (gV[k + 1] < 0) {
        const [xs, ys] = aRejilla(x, z);
        if (agua.hondo(xs, ys) > 0 && y <= NIVEL_CHARCO) { agua.empujar(xs, ys, 0.008 + gR[i] * 2, 0.25 * gR[i]); gotasCaidas++; muere = true; }
        else if (y <= altura(x, z) + hundido(x, z)) {
          if (distRoca(x, z) <= 0.02) { /* en la piedra, nada */ }
          else if (distCamino(x, z) < ANCHO + 0.02) mancha(x, z, gR[i], Math.hypot(gV[k], gV[k + 2]));
          else mojarHierba(x, z, gR[i]);                                       // en la hierba: la moja
          muere = true;
        }
      }
      if (muere) { gVivas[i] = 0; gP[k + 1] = -50; gotas.setMatrixAt(i, _gm.makeScale(0, 0, 0)); continue; }
      // estirada en la direccion en que va
      _gv.set(gV[k], gV[k + 1], gV[k + 2]);
      const vel = _gv.length();
      _gq.setFromUnitVectors(_gY, vel > 1e-4 ? _gv.divideScalar(vel) : _gY);
      const rad = gR[i] * VER;
      _gm.compose(_gp.set(x, y, z), _gq, _gs.set(rad * 0.92, rad * (1 + Math.min(2.2, vel * 0.45)), rad * 0.92));
      gotas.setMatrixAt(i, _gm);
    }
    gotas.instanceMatrix.needsUpdate = true;
  }
  // ---------------- las huellas: la tierra del camino se HUNDE donde se apoya cada pie ----------------
  // El camino es una malla fina (2 cm) que lee un MAPA DE HUELLAS de 1 cm (R: cuanto se hunde o se levanta, G: lo mojada
  // que quedo, B: cuando se piso). Cada pisada estampa la suela en ese mapa (lo mas hondo gana) con su reborde de
  // tierra levantada, y solo se sube a la tarjeta el trozo estampado. El sombreador hunde los vertices, saca la normal
  // del mapa (las paredes y las rayas de la suela se ven con la luz) y oscurece lo apretado y lo mojado. El pie del 18
  // se apoya DENTRO de su huella (`altura` del mapa la cuenta). En la hierba y en la piedra no hay huella.
  // Duran 100 s y se allanan en 30; mojadas (al salir del charco), se secan en 25 s, cada vez menos (unos 8 pasos).
  const HRES = 0.006, H_VIDA = 100, H_BORRA = 30, H_SECA = 25, H_LARGO = 0.1, H_ANCHO = 0.056;
  let cx0 = 1e9, cz0 = 1e9, cx1 = -1e9, cz1 = -1e9;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (EN_CAMINO[j * N + i]) {
    cx0 = Math.min(cx0, -LADO + i * PASO); cx1 = Math.max(cx1, -LADO + (i + 1) * PASO);
    cz0 = Math.min(cz0, -LADO + j * PASO); cz1 = Math.max(cz1, -LADO + (j + 1) * PASO);
  }
  const HW = Math.ceil((cx1 - cx0) / HRES), HH = Math.ceil((cz1 - cz0) / HRES);
  // el mapa, en medio flotante: es lo que se sube y tambien la copia buena (a 6 mm son 2,5 M de texeles: en flotante
  // entero serian 40 MB solo en la CPU)
  const hMedio = new Uint16Array(HW * HH * 4);
  const h16 = THREE.DataUtils.toHalfFloat, h32 = THREE.DataUtils.fromHalfFloat;
  const hTex = new THREE.DataTexture(hMedio, HW, HH, THREE.RGBAFormat, THREE.HalfFloatType);
  hTex.minFilter = hTex.magFilter = THREE.LinearFilter;
  hTex.needsUpdate = true;
  const SELLO = Math.ceil(0.15 / HRES) + 2, selloDatos = new Uint16Array(SELLO * SELLO * 4);
  const selloTex = new THREE.DataTexture(selloDatos, SELLO, SELLO, THREE.RGBAFormat, THREE.HalfFloatType);
  let renderer = null, tAhora = 0, nHuellas = 0, botaMojada = 0;
  const huellaTiempo = { value: 0 };
  const vidaDe = (b) => 1 - suave(H_VIDA, H_VIDA + H_BORRA, tAhora - b);
  // lo que esta hundido ahora en (x, z) (con la huella que se allana)
  function hundido(x, z) {
    const px = Math.floor((x - cx0) / HRES), pz = Math.floor((z - cz0) / HRES);
    if (px < 0 || pz < 0 || px >= HW || pz >= HH) return 0;
    const k = (pz * HW + px) * 4, b = h32(hMedio[k + 2]);
    return b > 0 ? h32(hMedio[k]) * vidaDe(b) : 0;
  }
  // sube a la tarjeta solo el trozo del mapa que ha cambiado (como mucho SELLO x SELLO)
  function subir(px0, pz0, px1, pz1) {
    selloDatos.fill(0);
    for (let pz = pz0; pz <= pz1; pz++) for (let px = px0; px <= px1; px++) {
      const k = (pz * HW + px) * 4, s = ((pz - pz0) * SELLO + (px - px0)) * 4;
      for (let c = 0; c < 3; c++) selloDatos[s + c] = hMedio[k + c];
    }
    if (renderer && renderer.copyTextureToTexture) {
      renderer.copyTextureToTexture(selloTex, hTex, new THREE.Box2(new THREE.Vector2(0, 0), new THREE.Vector2(px1 - px0 + 1, pz1 - pz0 + 1)), new THREE.Vector2(px0, pz0));
    } else hTex.needsUpdate = true;                                  // sin el renderer (pruebas): todo de una vez
  }
  // una gota que cae en la tierra: su MANCHA mojada (de borde irregular, mayor cuanto mas deprisa llega) y unas
  // salpicaduras diminutas alrededor; las gordas hunden un pelo la tierra. Se secan como las huellas mojadas.
  let nManchas = 0;
  function mancha(x, z, rr, vh = 0) {
    const R = rr * (3 + 1.2 * Math.min(vh, 1.5));                 // la mancha: unas 3-5 veces la gota
    const puntos = [[x, z, R, 1]];
    for (let k = 0, n = 2 + Math.floor(r() * 4); k < n; k++) {
      const a = r() * 6.2832, dd = R * (1.4 + 1.6 * r());
      puntos.push([x + Math.cos(a) * dd, z + Math.sin(a) * dd, R * (0.18 + 0.25 * r()), 0.8]);
    }
    const alcance = R * 3.2 + 0.004;
    const px0 = Math.max(0, Math.floor((x - alcance - cx0) / HRES)), pz0 = Math.max(0, Math.floor((z - alcance - cz0) / HRES));
    const px1 = Math.min(HW - 1, Math.ceil((x + alcance - cx0) / HRES), px0 + SELLO - 1), pz1 = Math.min(HH - 1, Math.ceil((z + alcance - cz0) / HRES), pz0 + SELLO - 1);
    if (px1 < px0 || pz1 < pz0) return;
    const fase = r() * 6.2832;
    for (let pz = pz0; pz <= pz1; pz++) for (let px = px0; px <= px1; px++) {
      const wx = cx0 + (px + 0.5) * HRES, wz = cz0 + (pz + 0.5) * HRES;
      let m = 0;
      for (const [sx, sz, sr, f] of puntos) {
        const dx = wx - sx, dz = wz - sz, a = Math.atan2(dz, dx);
        const borde = sr * (1 + 0.22 * Math.sin(3 * a + fase) + 0.12 * Math.sin(7 * a - fase));   // borde irregular
        m = Math.max(m, f * (1 - suave(borde * 0.6, borde + HRES * 0.7, Math.hypot(dx, dz))));
      }
      if (m <= 0) continue;
      const k = (pz * HW + px) * 4, bAntes = h32(hMedio[k + 2]);
      const antes = bAntes > 0 ? h32(hMedio[k]) * vidaDe(bAntes) : 0;
      const mojaAntes = bAntes > 0 ? h32(hMedio[k + 1]) * Math.max(0, 1 - (tAhora - bAntes) / H_SECA) : 0;
      hMedio[k] = h16(antes - 0.0006 * m * Math.min(1, rr / 0.004));
      hMedio[k + 1] = h16(Math.min(1, Math.max(mojaAntes, 0.85 * m)));
      hMedio[k + 2] = h16(tAhora);
    }
    subir(px0, pz0, px1, pz1);
    nManchas++;
  }
  // estampar la suela en (x, z), apuntando a (dx, dz); fondo = cuanto se hunde (m); moja = de 0 a 1
  function estampar(x, z, dx, dz, izquierda, fondo, moja) {
    const ex = H_ANCHO * 1.35, ez = H_LARGO * 1.25, R = 0.075;     // el cuadro de la suela y lo que alcanza (m)
    const px0 = Math.max(0, Math.floor((x - R - cx0) / HRES)), pz0 = Math.max(0, Math.floor((z - R - cz0) / HRES));
    const px1 = Math.min(HW - 1, px0 + SELLO - 1), pz1 = Math.min(HH - 1, pz0 + SELLO - 1);
    const pxx = dz, pxz = -dx;                                       // la derecha del pie
    const mmPx = (ex / SUELA.W + ez / SUELA.Hh) / 2;                 // metros por pixel de la suela
    for (let pz = pz0; pz <= pz1; pz++) for (let px = px0; px <= px1; px++) {
      const wx = cx0 + (px + 0.5) * HRES - x, wz = cz0 + (pz + 0.5) * HRES - z;
      const largo = wx * dx + wz * dz, ancho = (wx * pxx + wz * pxz) * (izquierda ? -1 : 1);
      const [dpx, raya] = SUELA.en_uv(ancho / ex + 0.5, largo / ez + 0.5);
      const d = dpx * mmPx;                                          // metros al borde de la suela (negativo dentro)
      if (d > 0.014) continue;
      const k = (pz * HW + px) * 4, bAntes = h32(hMedio[k + 2]);
      const antes = bAntes > 0 ? h32(hMedio[k]) * vidaDe(bAntes) : 0;
      let h;
      if (d < 0) h = Math.min(antes, -fondo * suave(0, 0.008, -d) * (raya ? 0.7 : 1));   // el fondo, con las rayas de la suela
      else h = antes < 0 ? antes : Math.max(antes, 0.32 * fondo * (1 - d / 0.014) ** 2); // el reborde
      const mojaAntes = bAntes > 0 ? h32(hMedio[k + 1]) * Math.max(0, 1 - (tAhora - bAntes) / H_SECA) : 0;
      hMedio[k] = h16(h); hMedio[k + 1] = h16(Math.max(mojaAntes, d < 0.004 ? moja : 0)); hMedio[k + 2] = h16(tAhora);
    }
    subir(px0, pz0, px1, pz1);
    nHuellas++;
  }
  // la malla fina del camino: 2 cm, sobre las celdas que el suelo grueso deja libres; misma superficie (altura exacta),
  // mismo color y la normal suave de la rejilla gruesa, asi que no se nota la costura
  {
    const S = 10, f = N * S + 1, idx = new Map(), pos = [], colr = [], nor = [], tris = [], c = new THREE.Color();
    const vert = (I, J) => {
      const key = J * f + I;
      let k = idx.get(key);
      if (k !== undefined) return k;
      const x = -LADO + I * PASO / S, z = -LADO + J * PASO / S;
      k = pos.length / 3;
      pos.push(x, altura(x, z), z);
      colorArriba(x, z, c); colr.push(c.r, c.g, c.b);
      // la normal: la de la rejilla gruesa interpolada
      const gi = Math.min(N - 1, Math.floor(I / S)), gj = Math.min(N - 1, Math.floor(J / S)), fx = I / S - gi, fz = J / S - gj;
      const a = normalRejilla(gi, gj), b = normalRejilla(gi + 1, gj), cc = normalRejilla(gi, gj + 1), d = normalRejilla(gi + 1, gj + 1);
      const n = [0, 1, 2].map((t) => (a[t] * (1 - fx) + b[t] * fx) * (1 - fz) + (cc[t] * (1 - fx) + d[t] * fx) * fz);
      const l = Math.hypot(...n);
      nor.push(n[0] / l, n[1] / l, n[2] / l);
      idx.set(key, k);
      return k;
    };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (!EN_CAMINO[j * N + i]) continue;
      for (let b = 0; b < S; b++) for (let a = 0; a < S; a++) {
        const I = i * S + a, J = j * S + b;
        const p00 = vert(I, J), p10 = vert(I + 1, J), p01 = vert(I, J + 1), p11 = vert(I + 1, J + 1);
        tris.push(p00, p01, p10, p10, p01, p11);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(tris);
    const m = toon();
    m.onBeforeCompile = (s) => {
      s.uniforms.uHuellas = { value: hTex };
      s.uniforms.uHRect = { value: new THREE.Vector4(cx0, cz0, HW * HRES, HH * HRES) };
      s.uniforms.uHTexel = { value: new THREE.Vector2(1 / HW, 1 / HH) };
      s.uniforms.uHTiempo = huellaTiempo;
      const comun = `uniform sampler2D uHuellas; uniform vec4 uHRect; uniform vec2 uHTexel; uniform float uHTiempo;
float hVida(float b) { return b > 0.0 ? 1.0 - smoothstep(${H_VIDA.toFixed(1)}, ${(H_VIDA + H_BORRA).toFixed(1)}, uHTiempo - b) : 0.0; }
float hAltura(vec2 uv) { vec4 h = texture2D(uHuellas, uv); return h.r * hVida(h.b); }`;
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\n' + comun + '\nvarying vec2 vHuv;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHuv = (position.xz - uHRect.xy) / uHRect.zw;\ntransformed.y += hAltura(vHuv);');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\n' + comun + '\nvarying vec2 vHuv;')
        .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
  {
    // la pendiente del mapa de huellas tuerce la normal: las paredes de la huella y las rayas se ven con la luz
    float hl = hAltura(vHuv - vec2(uHTexel.x, 0.0)), hr = hAltura(vHuv + vec2(uHTexel.x, 0.0));
    float hd = hAltura(vHuv - vec2(0.0, uHTexel.y)), hu = hAltura(vHuv + vec2(0.0, uHTexel.y));
    vec2 gr = vec2(hr - hl, hu - hd) / (2.0 * ${HRES.toFixed(3)});
    normal = normalize(normal + (viewMatrix * vec4(-gr.x, 0.0, -gr.y, 0.0)).xyz);
  }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
  {
    vec4 h = texture2D(uHuellas, vHuv);
    float prof = h.r * hVida(h.b);
    float moja = h.g * clamp(1.0 - (uHTiempo - h.b) / ${H_SECA.toFixed(1)}, 0.0, 1.0) * hVida(h.b);
    diffuseColor.rgb *= 1.0 - 0.16 * clamp(-prof / 0.01, 0.0, 1.0);   // la tierra apretada, mas oscura
    // junto a las paredes de la huella llega menos luz (oclusion): lo que mas la dibuja
    float hl2 = hAltura(vHuv - vec2(uHTexel.x, 0.0)), hr2 = hAltura(vHuv + vec2(uHTexel.x, 0.0));
    float hd2 = hAltura(vHuv - vec2(0.0, uHTexel.y)), hu2 = hAltura(vHuv + vec2(0.0, uHTexel.y));
    float pared = clamp(length(vec2(hr2 - hl2, hu2 - hd2)) / (2.0 * ${HRES.toFixed(3)}) * 0.45, 0.0, 1.0);
    diffuseColor.rgb *= 1.0 - 0.3 * pared * step(prof, 0.0);
    diffuseColor.rgb *= 1.0 + 0.1 * clamp(prof / 0.003, 0.0, 1.0);    // el reborde suelto, mas claro
    diffuseColor.rgb *= 1.0 - 0.42 * moja;                           // mojada
  }`);
    };
    const camino = new THREE.Mesh(g, m);
    camino.receiveShadow = true;
    camino.name = 'camino_fino';
    grupo.add(camino);
  }
  // cada pie que se apoya (con histeresis: baja del todo para pisar y se levanta para el siguiente) deja su huella
  const apoyo = new Map();
  function pisadas(contactos, heroe) {
    const pos = {};
    for (const c of contactos) pos[c.id] = c;
    for (const lado of ['l', 'r']) {
      const f = pos['foot_' + lado], b = pos['ball_' + lado];
      if (!f) { apoyo.set(lado, false); continue; }
      const antes = apoyo.get(lado) || false, ahora = antes ? f.pisa > 0.35 : f.pisa > 0.85;
      if (ahora && !antes && heroe && heroe.suelo !== false) {
        const [xs, ys] = aRejilla(f.x, f.z);
        if (agua.hondo(xs, ys) > 0) botaMojada = 1;                                  // pisa el charco: la bota se moja
        else if (distCamino(f.x, f.z) < ANCHO - 0.03 && distRoca(f.x, f.z) > 0.03) {
          // hacia donde apunta: del tobillo a la planta; si la planta no toca, hacia donde mira el 18
          let dx = b ? b.x - f.x : Math.sin(heroe.giro || 0), dz = b ? b.z - f.z : Math.cos(heroe.giro || 0);
          const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
          // mas honda en el barro de junto al charco y corriendo (mas peso por paso)
          const v = heroe.vel ? heroe.vel.length() : 1;
          const fondo = (eCharco(f.x, f.z) < 1.7 ? 0.02 : 0.011) * (0.85 + 0.12 * Math.min(v, 2));
          estampar(f.x + dx * 0.022, f.z + dz * 0.022, dx, dz, lado === 'l', fondo, botaMojada);
          botaMojada = Math.max(0, botaMojada - 0.13);
        } else botaMojada = Math.max(0, botaMojada - 0.13);                        // en la hierba tambien se seca
      }
      apoyo.set(lado, ahora);
    }
  }

  // ---------------- la hierba mojada: alrededor del charco (7 x 7 m, 2 cm) ----------------
  // Cada gota que cae en la hierba moja una mancha de 2-4 cm (R: cuanto, G: cuando); la hierba de ahi se oscurece y se
  // vence un poco, y se seca en 40 s (en el sombreador: no hay que tocar el mapa para que se seque).
  const MRES = 0.02, MLADO = 7, MN = Math.round(MLADO / MRES), M_SECA = 40;
  const mx0 = CHARCO.x - MLADO / 2, mz0 = CHARCO.z - MLADO / 2;
  const mDatos = new Uint16Array(MN * MN * 4);
  const mTex = new THREE.DataTexture(mDatos, MN, MN, THREE.RGBAFormat, THREE.HalfFloatType);
  mTex.minFilter = mTex.magFilter = THREE.LinearFilter;
  mTex.needsUpdate = true;
  const MSELLO = 8, mSello = new Uint16Array(MSELLO * MSELLO * 4);
  const mSelloTex = new THREE.DataTexture(mSello, MSELLO, MSELLO, THREE.RGBAFormat, THREE.HalfFloatType);
  Object.assign(comunes, { uMoja: { value: mTex }, uMojaRect: { value: new THREE.Vector4(mx0, mz0, MLADO, MLADO) }, uMojaSeca: { value: M_SECA } });
  let nHierbaMojada = 0;
  function mojarHierba(x, z, rr) {
    const R = rr * 6 + 0.008;
    const px0 = Math.max(0, Math.floor((x - R - mx0) / MRES)), pz0 = Math.max(0, Math.floor((z - R - mz0) / MRES));
    const px1 = Math.min(MN - 1, px0 + MSELLO - 1, Math.ceil((x + R - mx0) / MRES)), pz1 = Math.min(MN - 1, pz0 + MSELLO - 1, Math.ceil((z + R - mz0) / MRES));
    if (px1 < px0 || pz1 < pz0) return;
    for (let pz = pz0; pz <= pz1; pz++) for (let px = px0; px <= px1; px++) {
      const d = Math.hypot(mx0 + (px + 0.5) * MRES - x, mz0 + (pz + 0.5) * MRES - z);
      const m = 1 - suave(R * 0.4, R, d);
      if (m <= 0) continue;
      const k = (pz * MN + px) * 4, b = h32(mDatos[k + 1]);
      const antes = b > 0 ? h32(mDatos[k]) * Math.max(0, 1 - (tAhora - b) / M_SECA) : 0;
      mDatos[k] = h16(Math.min(1, Math.max(antes, 0.9 * m) + 0.15 * m * antes));   // las gotas que se suman, mas mojada
      mDatos[k + 1] = h16(tAhora);
    }
    mSello.fill(0);
    for (let pz = pz0; pz <= pz1; pz++) for (let px = px0; px <= px1; px++) {
      const k = (pz * MN + px) * 4, q = ((pz - pz0) * MSELLO + (px - px0)) * 4;
      mSello[q] = mDatos[k]; mSello[q + 1] = mDatos[k + 1];
    }
    if (renderer && renderer.copyTextureToTexture) {
      renderer.copyTextureToTexture(mSelloTex, mTex, new THREE.Box2(new THREE.Vector2(0, 0), new THREE.Vector2(px1 - px0 + 1, pz1 - pz0 + 1)), new THREE.Vector2(px0, pz0));
    } else mTex.needsUpdate = true;
    nHierbaMojada++;
  }

  // lo que pisa el agua: cada pie hunde donde esta y, al entrar, salpica
  const enAgua = new Map();
  let caidaVista = 0;
  function moverAgua(t, dt, contactos, caida) {
    for (const c of contactos) {
      const [xs, ys] = aRejilla(c.x, c.z);
      const dentro = agua.hondo(xs, ys) > 0 && (c.pisa > 0.3 || c.id.startsWith('capa_'));
      const antes = enAgua.get(c.id);
      const v = antes ? Math.min(2.5, Math.hypot(c.x - antes.x, c.z - antes.z) / Math.max(dt, 1e-3)) : 0;
      const pie = c.id.startsWith('foot_');
      const dir = antes && v > 0.05 ? 1 / (v * Math.max(dt, 1e-3)) : 0;
      const bx = (antes ? c.x - antes.x : 0) * dir * v, bz = (antes ? c.z - antes.z : 0) * dir * v;   // velocidad del pie
      if (dentro) {
        if (c.id.startsWith('capa_')) agua.empujar(xs, ys, 0.03, 0.0005 * v);                          // el bajo de la capa arrastra
        else if (!antes || !antes.dentro) {
          agua.empujar(xs, ys, 0.05, 0.004 + 0.003 * v);
          // al pisar: una corona de gotas, mas hacia delante cuanto mas deprisa (una por pie, no la punta y el talon)
          if (pie) salpicar(c.x, c.z, 10 + Math.round(12 * v), 0.55 + 0.4 * v, bx, bz, NIVEL_CHARCO + 0.005, v > 0.6 ? 0.55 : 1);
        } else {
          agua.empujar(xs, ys, 0.04, 0.0012 * v * dt * 60);
          // andando dentro, el pie va levantando agua por delante
          if (pie && v > 0.3 && r() < v * dt * 9) salpicar(c.x, c.z, 1 + Math.round(2 * r() * v), 0.35 + 0.3 * v, bx, bz, NIVEL_CHARCO + 0.008, 0.35);
        }
      } else if (antes && antes.dentro && !c.id.startsWith('capa_')) {
        agua.empujar(xs, ys, 0.04, -0.002);                                                           // el pie sale y el agua vuelve
        if (pie) salpicar(c.x, c.z, 3 + Math.round(3 * r()), 0.18, bx * 0.5, bz * 0.5, NIVEL_CHARCO + 0.03, 1);   // y la bota gotea
      }
      enAgua.set(c.id, { x: c.x, z: c.z, dentro });
    }
    if (caida && caida.n !== caidaVista) {
      caidaVista = caida.n;
      const [xs, ys] = aRejilla(caida.x, caida.z);
      if (agua.hondo(xs, ys) > 0) { agua.empujar(xs, ys, 0.12, Math.min(0.016, 0.004 * caida.v)); salpicar(caida.x, caida.z, 70, 0.9 + 0.25 * Math.min(caida.v, 4)); }
    }
    moverGotas(dt);
    agua.paso(dt);
    const h = THREE.DataUtils.toHalfFloat;
    for (let k = 0, n = agua.h.length; k < n; k++) aguaDatos[k * 4] = h(agua.h[k]);
    aguaTex.needsUpdate = true;
    matAgua.uniforms.uTiempo.value = t;
  }

  // ---------------- la hierba: por trozos de 4 m, matas al tresbolillo + cesped + flores ----------------
  const campo = crearCampo({ lado: 22, celda: 0.2 });
  const datos = new Uint16Array(campo.n * campo.n * 4);
  const tex = new THREE.DataTexture(datos, campo.n, campo.n, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  comunes.uCampo.value = tex;
  comunes.uCampoLado.value = campo.lado;
  const mats = {
    mataA: materialHierba(tono, comunes, [998, 999]), mataB: materialHierba(tono, comunes, [13, 19]),
    cesped: materialHierba(tono, comunes, [11, 17]), flor: materialHierba(tono, comunes, [14, 20]),
  };
  // pocas variantes (cada una es una llamada de dibujo por trozo); el giro y la escala de cada instancia ya las distinguen
  const geos = {
    matas: [0, 1, 2].map((i) => [geoMata(40 + i), geoMata(40 + i, 1)]), cesped: [geoCesped(80), geoCesped(81)],
    margarita: [geoMargarita(101)], boton: [geoBoton(111)], trebol: [geoTrebol(121)],
  };
  const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), v3 = new THREE.Vector3(), sv = new THREE.Vector3(), cc = new THREE.Color();
  function instancias(geo, mat, lista, nombre) {
    const im = new THREE.InstancedMesh(geo, mat, lista.length);
    lista.forEach((m, i) => {
      mt.compose(v3.set(m.x, m.y, m.z), q.setFromAxisAngle(Y, m.giro), sv.set(m.s, m.sy, m.s));
      im.setMatrixAt(i, mt);
      im.setColorAt(i, cc.copy(m.c));
    });
    im.receiveShadow = true;
    im.computeBoundingSphere();
    im.name = nombre;
    return im;
  }
  const CH = 5, porLado = Math.round((2 * LADO) / CH), trozos = [];
  let cuenta = { matas: 0, cesped: 0, flores: 0, trebol: 0, hojas: 0 };
  const hojasDe = (geo) => geo.attributes.position.count / 3;
  for (let tj = 0; tj < porLado; tj++) {
    for (let ti = 0; ti < porLado; ti++) {
      const x0 = -LADO + ti * CH, z0 = -LADO + tj * CH;
      const listas = {}, poner = (k, var_, o) => { const key = k + var_; (listas[key] ||= { k, var_, l: [] }).l.push(o); };
      // matas: rejilla de 13 cm con temblor, al tresbolillo (A siempre, B se encoge lejos)
      const SM = 0.13, nm = Math.round(CH / SM);
      for (let gz = 0; gz < nm; gz++) {
        for (let gx = 0; gx < nm; gx++) {
          const x = x0 + (gx + 0.15 + r() * 0.7) * SM, z = z0 + (gz + 0.15 + r() * 0.7) * SM;
          const dens = densidad(x, z) * (1 - 0.55 * trebol(x, z));
          if (r() > dens) continue;
          // alguna mata suelta mas alta que las de alrededor (la textura de la pradera)
          const alto = Math.min(1.55, altoEn(x, z) * (0.75 + 0.5 * r()) * (r() < 0.06 ? 1.45 : 1));
          const s = 0.85 + 0.3 * r();
          tintaZona(x, z, cc);
          poner(((gx + gz) & 1) ? 'mataB' : 'mataA', Math.floor(r() * 3), { x, y: altura(x, z) - 0.004, z, giro: r() * 6.28, s, sy: alto * 1.1, c: cc.clone() });
        }
      }
      // al pie de las rocas, una corona de matas mas verdes y densas pegada a la piedra, alguna montando 2 cm sobre
      // su base (en las fotos la hierba TAPA el pie de la roca: por eso no parece puesta encima)
      for (const o of ROCAS) {
        if (!o.perfil || o.r < 0.12 || o.x + 1.45 * o.r < x0 || o.x - 1.45 * o.r > x0 + CH || o.z + 1.45 * o.r < z0 || o.z - 1.45 * o.r > z0 + CH) continue;
        const rp = azar(o.sem * 7 + ti * 101 + tj * 13);
        const n = Math.round(o.r * 2 * Math.PI / 0.045);
        for (let k = 0; k < n; k++) {
          const a = ((k + rp() * 0.8) / n) * 6.2832, ca = Math.cos(a), sa = Math.sin(a);
          const rad = radioRoca(o, ca, sa) - 0.02 + Math.pow(rp(), 1.6) * 0.16;
          const x = o.x + ca * rad, z = o.z + sa * rad;
          if (x < x0 || x >= x0 + CH || z < z0 || z >= z0 + CH || eCharco(x, z) < 1.05 || distCamino(x, z) < ANCHO + 0.05) continue;
          const alto = Math.min(1.6, altoEn(x, z) * (0.95 + 0.45 * rp()));
          tintaZona(x, z, cc);
          cc.multiplyScalar(0.9).lerp(_t.setRGB(0.82, 0.98, 0.72), 0.35);              // a la sombra de la piedra: mas verde
          poner(((k & 1) ? 'mataB' : 'mataA'), Math.floor(rp() * 3), { x, y: altura(x, z) - 0.004, z, giro: rp() * 6.28, s: 0.9 + 0.35 * rp(), sy: alto * 1.1, c: cc.clone() });
          if (rp() < 0.6) poner('cesped', Math.floor(rp() * 2), { x: x + (rp() - 0.5) * 0.06, y: altura(x, z) - 0.003, z: z + (rp() - 0.5) * 0.06, giro: rp() * 6.28, s: 0.9 + 0.25 * rp(), sy: 0.9 + 0.5 * rp(), c: cc.clone() });
        }
      }
      // cesped corto: rejilla de 17 cm
      const SC = 0.17, ncs = Math.round(CH / SC);
      for (let gz = 0; gz < ncs; gz++) {
        for (let gx = 0; gx < ncs; gx++) {
          const x = x0 + (gx + 0.1 + r() * 0.8) * SC, z = z0 + (gz + 0.1 + r() * 0.8) * SC;
          if (r() > densidad(x, z) * 0.95) continue;
          tintaZona(x, z, cc);
          poner('cesped', Math.floor(r() * 2), { x, y: altura(x, z) - 0.003, z, giro: r() * 6.28, s: 0.9 + 0.25 * r(), sy: 0.8 + 0.5 * r(), c: cc.clone() });
        }
      }
      // flores en corros y trebol en los praditos
      const SF = 0.26, nf = Math.round(CH / SF);
      for (let gz = 0; gz < nf; gz++) {
        for (let gx = 0; gx < nf; gx++) {
          const x = x0 + (gx + r()) * SF, z = z0 + (gz + r()) * SF;
          const dens = densidad(x, z);
          if (dens < 0.5) continue;
          const tr = trebol(x, z);
          if (r() < tr * 0.9) poner('trebol', 0, { x, y: altura(x, z) - 0.002, z, giro: r() * 6.28, s: 0.9 + 0.4 * r(), sy: 0.9 + 0.3 * r(), c: cc.setRGB(1, 1, 1).multiplyScalar(0.9 + 0.2 * r()).clone() });
          const fl = flor(x, z);
          if (r() < fl * 0.85 + 0.015) {
            const marg = fbm(x / 4.5, z / 4.5) > 0.5;
            // en la hierba corta, la flor algo mas baja; en la alta, asoma por encima
            const alto = (0.6 + 0.5 * r()) * (0.55 + 0.75 * altoEn(x, z));
            poner(marg ? 'margarita' : 'boton', 0, { x, y: altura(x, z) - 0.002, z, giro: r() * 6.28, s: Math.sqrt(alto), sy: alto, c: cc.setRGB(1, 1, 1).clone() });
          }
        }
      }
      const t = { x0, z0, cx: x0 + CH / 2, cz: z0 + CH / 2, grupo: new THREE.Group(), matas: [] };
      for (const { k, var_, l } of Object.values(listas)) {
        let geo, mat;
        if (k === 'mataA' || k === 'mataB') { geo = geos.matas[var_][0]; mat = mats[k]; cuenta.matas += l.length; }
        else if (k === 'cesped') { geo = geos.cesped[var_]; mat = mats.cesped; cuenta.cesped += l.length; }
        else if (k === 'trebol') { geo = geos.trebol[var_]; mat = mats.flor; cuenta.trebol += l.length; }
        else { geo = geos[k][var_]; mat = mats.flor; cuenta.flores += l.length; }
        cuenta.hojas += l.length * hojasDe(geo);
        const im = instancias(geo, mat, l, k);
        if (k === 'mataA' || k === 'mataB') { im.userData.lod = geos.matas[var_]; t.matas.push(im); }
        t.grupo.add(im);
      }
      t.grupo.name = 'hierba_trozo';
      grupo.add(t.grupo);
      trozos.push(t);
    }
  }

  const contactos = [];
  function actualizar(t, foco, heroe = null, dt = 0) {
    // el sol y su sombra siguen al heroe, ajustados a la rejilla de texeles
    const texel = (sol.shadow.camera.right - sol.shadow.camera.left) / sol.shadow.mapSize.x;
    const u = _ejeU.dot(foco), w = _ejeV.dot(foco);
    _foco.copy(foco).addScaledVector(_ejeU, Math.round(u / texel) * texel - u).addScaledVector(_ejeV, Math.round(w / texel) * texel - w);
    sol.position.copy(_foco).addScaledVector(DIR_SOL, 20);
    sol.target.position.copy(_foco);
    comunes.uTiempo.value = t;
    // las matas cercanas al 18 echan sombra (las demas no: no caben en el mapa de sombras y no se verian); y lejos de
    // el, cada hoja de un solo triangulo (las mismas hojas: no salta nada, solo pierden la curva)
    for (const tr of trozos) {
      const d = Math.hypot(Math.max(Math.abs(tr.cx - foco.x) - CH / 2, 0), Math.max(Math.abs(tr.cz - foco.z) - CH / 2, 0));
      for (const m of tr.matas) { m.castShadow = d < 3; m.geometry = m.userData.lod[d < 7 ? 0 : 1]; }
    }
    if (dt > 0) {
      campo.centrar(foco.x, foco.z);
      campo.paso(dt, heroe && heroe.contactos ? heroe.contactos(contactos) : [], heroe ? heroe.caida : null);
      const [ox, oz] = campo.origen();
      comunes.uCampoOrigen.value.set(ox - campo.celda / 2, oz - campo.celda / 2);
      const h = THREE.DataUtils.toHalfFloat;
      for (let k = 0, n = campo.bx.length; k < n; k++) {
        datos[k * 4] = h(campo.bx[k]);
        datos[k * 4 + 1] = h(campo.bz[k]);
        datos[k * 4 + 2] = h(campo.ap[k]);
      }
      tex.needsUpdate = true;
      moverAgua(t, dt, contactos, heroe ? heroe.caida : null);
      tAhora = t; huellaTiempo.value = t;
      pisadas(contactos, heroe);
    }
  }

  const p0 = puntoCamino(0.12);
  return {
    LADO, borde: BORDE, actualizar,
    // el 18 pisa dentro de sus huellas
    altura: (x, z) => altura(x, z) + hundido(x, z), sol, puntoCamino,
    choques: { circulos: ROCAS.filter((o) => o.r >= 0.3).map((o) => ({ x: o.x, z: o.z, r: o.r * 0.85 })), cajas: [] },
    salida: { x: p0.x, z: p0.z, giro: Math.atan2(p0.tx, p0.tz) },
    titulo: 'PARCELA 20 × 20 m',
    hierba: { campo, uniformes: comunes, trozos },
    agua: { sim: agua, salpicar, aRejilla, nivel: NIVEL_CHARCO, get caidas() { return gotasCaidas; } },
    huellas: { estampar, mancha, mojarHierba, hundido, get cuantas() { return nHuellas; }, get manchas() { return nManchas; }, get hierbaMojada() { return nHierbaMojada; }, get botaMojada() { return botaMojada; } },
    // main.js le pasa el renderer: con el se sube solo el trozo estampado del mapa de huellas
    conectar(o) { if (o && o.renderer) renderer = o.renderer; },
    // lo que se pisa en (x, z), para el sonido de los pasos
    superficie(x, z) {
      const [xs, ys] = aRejilla(x, z);
      if (agua.hondo(xs, ys) > 0) return 'agua';
      if (distRoca(x, z) < 0.02) return 'piedra';
      if (distCamino(x, z) < ANCHO - 0.05) return 'tierra';
      return 'hierba';
    },
    get info() { return { ...cuenta, trozos: trozos.length, rocas: ROCAS.length, triangulosSuelo: N * N * 2 }; },
  };
}
