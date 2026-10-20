// MUESTRA: un metro cuadrado del suelo del mapa del muro, como un BLOQUE de terreno cortado (se ven las capas de tierra
// en los lados), con el detalle que se busca para el mapa: hierba fina en matas (12-28 cm, por debajo de la rodilla del
// 18) con su cesped corto debajo, un caminito de tierra pisada con chinas hundidas, una roca con musgo, trebol,
// margaritas, botones de oro, una hoja seca y una ramita. Low poly como el 18: caras planas, tono en escalones y la
// TINTA (30, 24, 20) en el contorno de las piedras y del bloque. Todo por codigo y con semilla fija.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { azar } from '../texturas.js';

const ANCHO = 1600, ALTO = 1000;
const TINTA = new THREE.Color().setRGB(30 / 255, 24 / 255, 20 / 255, THREE.SRGBColorSpace);
const FONDO_Y = -0.28;                          // el bloque tiene 28 cm de tierra
const r = azar(2026);

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

// ---------------- el sitio de cada cosa ----------------
// el caminito entra por la izquierda y sale por delante
const CAMINO = [];
for (let i = 0; i <= 48; i++) { const t = i / 48; CAMINO.push([-0.62 + 0.78 * t + 0.06 * Math.sin(t * 3.2), -0.06 + 0.64 * t + 0.06 * t * t]); }
function distCamino(x, z) {
  let d = 9;
  for (let i = 0; i < CAMINO.length - 1; i++) {
    const [ax, az] = CAMINO[i], [bx, bz] = CAMINO[i + 1];
    const dx = bx - ax, dz = bz - az, k = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    d = Math.min(d, Math.hypot(ax + dx * k - x, az + dz * k - z));
  }
  return d;
}
const MEDIO_CAMINO = 0.15;
const ROCA = { x: 0.19, z: -0.2, r: 0.17, alto: 0.17 };
const TREBOL = { x: 0.27, z: 0.22, r: 0.17 };
// lo que se queda CORTO: el pradillo del trebol y lo que hay delante de la roca (asi se ven)
function corto(x, z) {
  return Math.max(suave(0.26, 0.1, Math.hypot(x - TREBOL.x, z - TREBOL.z)), suave(0.15, 0.05, Math.hypot(x - (ROCA.x + 0.15), z - (ROCA.z + 0.17))));
}
function relieve(x, z) {
  let h = 0.024 * (fbm(x * 3 + 1, z * 3 - 2) - 0.5);
  h += 0.032 * Math.exp(-(((x + 0.22) ** 2 + (z + 0.27) ** 2) / 0.035));          // un monton de tierra
  const d = distCamino(x, z);
  h -= 0.014 * (1 - suave(MEDIO_CAMINO - 0.05, MEDIO_CAMINO + 0.04, d));         // el camino, hundido de tanto pisar
  h += 0.005 * Math.exp(-(((d - MEDIO_CAMINO - 0.05) / 0.04) ** 2));             // y su reborde
  return h;
}

// ---------------- la superficie: rejilla de 4 cm con temblor ----------------
const N = 25, D = 1 / N;
const HT = new Float32Array((N + 1) * (N + 1));
const DIAG = new Uint8Array(N * N);
for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) HT[j * (N + 1) + i] = relieve(-0.5 + i * D, -0.5 + j * D) + (r() - 0.5) * 0.004;
for (let k = 0; k < N * N; k++) DIAG[k] = r() < 0.5 ? 0 : 1;
// la altura de la CARA (no del ruido): lo que se planta, se planta en ella
function altura(x, z) {
  const gx = Math.max(0, Math.min(N - 1e-6, (x + 0.5) / D)), gz = Math.max(0, Math.min(N - 1e-6, (z + 0.5) / D));
  const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j, f = N + 1;
  const h00 = HT[j * f + i], h10 = HT[j * f + i + 1], h01 = HT[(j + 1) * f + i], h11 = HT[(j + 1) * f + i + 1];
  if (DIAG[j * N + i] === 0) return fx >= fz ? h00 + (h10 - h00) * fx + (h11 - h10) * fz : h00 + (h01 - h00) * fz + (h11 - h01) * fx;
  return fx + fz <= 1 ? h00 + (h10 - h00) * fx + (h01 - h00) * fz : h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
}

// ---------------- geometria a mano ----------------
function malla() { return { pos: [], col: [], nor: [] }; }
// un triangulo con su color (y la normal que se quiera: arriba para la hierba); `fuera` orienta la cara
function tri(g, a, b, c, ca, cb = ca, cc = ca, fuera = null, normal = null) {
  if (fuera) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * fuera[0] + ny * fuera[1] + nz * fuera[2] < 0) { [b, c] = [c, b]; [cb, cc] = [cc, cb]; }
  }
  g.pos.push(...a, ...b, ...c);
  for (const k of [ca, cb, cc]) g.col.push(k.r, k.g, k.b);
  if (normal) for (let i = 0; i < 3; i++) g.nor.push(...normal);
}
function geometria(g) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(g.col, 3));
  // la normal dada solo si la llevan TODAS las caras (la ramita no la lleva y la hoja seca si: medio atributo la pintaba negra)
  if (g.nor.length === g.pos.length) geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.nor, 3));
  else geo.computeVertexNormals();
  return geo;
}

// ---------------- el bloque de tierra ----------------
// la capa vegetal arriba, tierra parda, subsuelo claro; las lineas entre capas onduladas
const CAPA = { cesped: col(0x433b25), humus: col(0x3b3024), tierra: col(0x6b4f36), subsuelo: col(0x8d7152), fondo: col(0x2c241b) };
function colorArriba(x, z, out) {
  const d = distCamino(x, z);
  out.copy(col(0x4a4b2d)).lerp(col(0x5b6b35), suave(0.4, 0.62, fbm(x * 6 + 4, z * 6)));        // humus y musgo
  if (d < MEDIO_CAMINO + 0.06) {
    const tierra = col(0x96805f).lerp(col(0x857055), fbm(x * 14, z * 14 + 3)).lerp(col(0xa48d69), 0.6 * suave(0.55, 0.75, fbm(x * 25 - 7, z * 25)));
    out.lerp(tierra, 1 - suave(MEDIO_CAMINO - 0.03, MEDIO_CAMINO + 0.06, d));
    out.lerp(col(0x8d865a), 0.5 * Math.exp(-(((d - MEDIO_CAMINO) / 0.035) ** 2)));          // hierba pisada en el canto
  }
  const dr = Math.hypot(x - ROCA.x, z - ROCA.z) - ROCA.r;
  if (dr < 0.05) out.multiplyScalar(0.75 + 0.25 * suave(-0.01, 0.05, dr));                   // el pie de la roca, en sombra
  return out.multiplyScalar(0.93 + 0.12 * r());
}
// `o`: lo que se engorda (el casco de tinta usa la misma forma, un poco mas grande)
function bloque(oArriba = 0, oLado = 0, oAbajo = 0, conColor = true) {
  const g = malla(), f = N + 1, c = new THREE.Color();
  const p = (i, j) => {
    let x = -0.5 + i * D, z = -0.5 + j * D;
    if (i === 0) x -= oLado; if (i === N) x += oLado; if (j === 0) z -= oLado; if (j === N) z += oLado;
    return [x, HT[j * f + i] + oArriba, z];
  };
  const ARRIBA = [0, 1, 0];
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = p(i, j), b = p(i + 1, j), cc = p(i, j + 1), d = p(i + 1, j + 1);
      const caras = DIAG[j * N + i] === 0 ? [[a, b, d], [a, d, cc]] : [[a, b, cc], [b, d, cc]];
      for (const [u, v, w] of caras) {
        if (conColor) colorArriba((u[0] + v[0] + w[0]) / 3, (u[2] + v[2] + w[2]) / 3, c);
        tri(g, u, v, w, c, c, c, ARRIBA);
      }
    }
  }
  // los cuatro cortes: columnas cada 4 cm, filas en los limites de las capas (ondulados) y caras con su temblor
  const lados = [
    { borde: (k) => [k, 0], fuera: [0, 0, -1] }, { borde: (k) => [k, N], fuera: [0, 0, 1] },
    { borde: (k) => [0, k], fuera: [-1, 0, 0] }, { borde: (k) => [N, k], fuera: [1, 0, 0] },
  ];
  const azarLado = azar(77);
  for (const L of lados) {
    const filas = [];
    for (let k = 0; k <= N; k++) {
      const [i, j] = L.borde(k);
      const top = p(i, j);
      const s = (k / N) * 7 + L.fuera[0] * 3 + L.fuera[2] * 5;
      const ys = [top[1],
        Math.min(top[1] - 0.008, -0.03 + 0.006 * Math.sin(s * 2.1)),
        Math.min(top[1] - 0.02, -0.058 + 0.012 * Math.sin(s * 1.3) + 0.008 * (fbm(s, 1) - 0.5)),
        -0.105 + 0.01 * Math.sin(s * 0.9 + 1),
        -0.16 + 0.016 * Math.sin(s * 1.1 + 2) + 0.01 * (fbm(s, 4) - 0.5),
        -0.22 + 0.01 * Math.sin(s * 1.7),
        FONDO_Y - oAbajo];
      // temblor en las filas de dentro: el corte no es un plano perfecto
      filas.push(ys.map((y, m) => [top[0], y + (m > 0 && m < ys.length - 1 ? (azarLado() - 0.5) * 0.006 : 0), top[2]]));
    }
    const banda = [CAPA.cesped, CAPA.humus, CAPA.humus, CAPA.tierra, CAPA.tierra, CAPA.subsuelo];
    for (let k = 0; k < N; k++) {
      for (let m = 0; m < 6; m++) {
        const a = filas[k][m], b = filas[k + 1][m], cc = filas[k][m + 1], d = filas[k + 1][m + 1];
        for (const [u, v, w] of [[a, b, d], [a, d, cc]]) {
          if (conColor) c.copy(banda[m]).multiplyScalar(0.9 + 0.18 * azarLado()).lerp(m === 5 ? CAPA.tierra : banda[m], 0);
          tri(g, u, v, w, c, c, c, L.fuera);
        }
      }
    }
  }
  // el fondo
  const e = 0.5 + oLado, y = FONDO_Y - oAbajo;
  c.copy(CAPA.fondo);
  tri(g, [-e, y, -e], [e, y, -e], [e, y, e], c, c, c, [0, -1, 0]);
  tri(g, [-e, y, -e], [e, y, e], [-e, y, e], c, c, c, [0, -1, 0]);
  return geometria(g);
}

// ---------------- piedras: icosaedro cortado por planos (como las rocas del mapa) ----------------
function piedra(semilla, rx, alto, rz, detalle, musgo) {
  const q = azar(semilla);
  let g = new THREE.IcosahedronGeometry(1, detalle);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position, v = new THREE.Vector3();
  const planos = [];
  for (let k = 0, n = 4 + Math.floor(q() * 6); k < n; k++) planos.push([new THREE.Vector3(q() * 2 - 1, q() * 1.7 - 0.35, q() * 2 - 1).normalize(), 0.6 + q() * 0.3]);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).multiplyScalar(0.9 + q() * 0.2);
    for (const [n, c] of planos) { const d = v.dot(n) - c; if (d > 0) v.addScaledVector(n, -d); }
    v.y = Math.max(v.y, -0.45);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeBoundingBox();
  const bb = g.boundingBox, sx = Math.max(-bb.min.x, bb.max.x), sz = Math.max(-bb.min.z, bb.max.z), sy = bb.max.y - bb.min.y;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) / sx * rx, (p.getY(i) - bb.min.y) / sy * alto, p.getZ(i) / sz * rz);
  g.computeVertexNormals();
  const plana = g.toNonIndexed();
  plana.computeVertexNormals();
  const pp = plana.attributes.position, nn = plana.attributes.normal, cc = new Float32Array(pp.count * 3);
  for (let i = 0; i < pp.count; i += 3) {
    const ny = (nn.getY(i) + nn.getY(i + 1) + nn.getY(i + 2)) / 3;
    const cx = (pp.getX(i) + pp.getX(i + 1) + pp.getX(i + 2)) / 3, cz = (pp.getZ(i) + pp.getZ(i + 1) + pp.getZ(i + 2)) / 3;
    const m = musgo * suave(0.4, 0.8, ny) * suave(0.35, 0.62, fbm(cx * 9 + semilla, cz * 9));
    const k = (0.9 + 0.16 * q()) * (ny < -0.2 ? 0.72 : 1);
    for (let t = 0; t < 3; t++) { cc[(i + t) * 3] = k * (1 - m) + 0.6 * k * m; cc[(i + t) * 3 + 1] = k * 0.985 * (1 - m) + 0.78 * k * m; cc[(i + t) * 3 + 2] = k * 0.95 * (1 - m) + 0.42 * k * m; }
  }
  plana.setAttribute('color', new THREE.BufferAttribute(cc, 3));
  return { plana, casco: g };
}
// el casco de tinta de una geometria con indice y normales suaves: cada vertice sale `grosor` m por su normal
function casco(g, grosor) {
  const c = g.clone(), p = c.attributes.position, n = c.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * grosor, p.getY(i) + n.getY(i) * grosor, p.getZ(i) + n.getZ(i) * grosor);
  return c;
}

// ---------------- hierba, trebol y flores ----------------
// una hoja de hierba en tres tramos que se estrechan y se curvan; colores de la base oscura a la punta clara
function hoja(g, x0, z0, ang, alto, ancho, inclina, tonos) {
  const cx = Math.cos(ang), cz = Math.sin(ang), px = -cz, pz = cx;
  const y0 = altura(x0, z0) - 0.003;
  const P = (t, w) => { const o = inclina * Math.pow(t, 1.8); return [x0 + cx * o + px * w, y0 + alto * t * (1 - 0.25 * (inclina / alto) * t), z0 + cz * o + pz * w]; };
  const T = [0, 0.38, 0.72], Wd = [1, 0.72, 0.42];
  const fila = T.map((t, k) => [P(t, -ancho * Wd[k]), P(t, ancho * Wd[k])]);
  const punta = P(1, 0);
  const ARR = [0, 1, 0];
  for (let k = 0; k < 2; k++) {
    const [a, b] = fila[k], [c, d] = fila[k + 1];
    tri(g, a, b, d, tonos[k], tonos[k], tonos[k + 1], null, ARR);
    tri(g, a, d, c, tonos[k], tonos[k + 1], tonos[k + 1], null, ARR);
  }
  tri(g, fila[2][0], fila[2][1], punta, tonos[2], tonos[2], tonos[3], null, ARR);
}
const VERDES = [
  [0x2f3d1c, 0x4f6a2c, 0x7b9644, 0xa9bd66],      // verde
  [0x34421f, 0x587330, 0x8aa04c, 0xb9c474],      // verde claro
  [0x2b3a20, 0x46603a, 0x6b8a4c, 0x93ab6c],      // azulado
  [0x4a4a26, 0x75703c, 0xa59a5c, 0xcfc18a],      // seca
].map((t) => t.map(col));
function tonosHoja() {
  const u = r();
  const base = u < 0.5 ? VERDES[0] : u < 0.75 ? VERDES[1] : u < 0.9 ? VERDES[2] : VERDES[3];
  const k = 0.92 + r() * 0.16;
  return base.map((c) => c.clone().multiplyScalar(k));
}
function densidad(x, z) {
  const d = distCamino(x, z);
  let m = suave(MEDIO_CAMINO - 0.02, MEDIO_CAMINO + 0.07, d);
  const dr = Math.hypot(x - ROCA.x, z - ROCA.z) - ROCA.r;
  if (dr < 0.01) m = 0;
  m *= 1 - 0.55 * suave(TREBOL.r, TREBOL.r * 0.5, Math.hypot(x - TREBOL.x, z - TREBOL.z));     // el trebol tapa la hierba
  return m;
}
function altoEn(x, z) {
  const dr = Math.hypot(x - ROCA.x, z - ROCA.z) - ROCA.r;
  const detras = (x - ROCA.x) * -0.6 + (z - ROCA.z) * -0.7 > 0 ? 1 : 0;             // detras de la roca (desde la camara), mas alta
  return (0.75 + 0.55 * fbm(x * 4 + 9, z * 4 - 2)) * (1 + 0.35 * detras * suave(0.14, 0.01, dr)) * (0.6 + 0.4 * suave(MEDIO_CAMINO, MEDIO_CAMINO + 0.15, distCamino(x, z)))
    * (1 - 0.7 * corto(x, z));
}

function hierba() {
  const g = malla();
  // matas: muchas hojas de una misma raiz que se abren en abanico
  const matas = [];
  for (let k = 0; k < 900 && matas.length < 175; k++) {
    const x = (r() - 0.5) * 0.98, z = (r() - 0.5) * 0.98;
    if (r() > densidad(x, z)) continue;
    if (matas.some((m) => Math.hypot(m.x - x, m.z - z) < 0.045)) continue;
    matas.push({ x, z });
  }
  for (const m of matas) {
    const H = (0.12 + 0.14 * r()) * altoEn(m.x, m.z), n = 9 + Math.floor(r() * 12);
    for (let h = 0; h < n; h++) {
      const a = r() * 6.2832, rad = 0.014 * Math.sqrt(r());
      const alto = H * (0.55 + 0.6 * r());
      hoja(g, m.x + Math.cos(a) * rad, m.z + Math.sin(a) * rad, a + (r() - 0.5) * 0.9, alto, 0.0028 + r() * 0.0025, alto * (0.15 + 0.5 * r()), tonosHoja());
    }
  }
  // cesped corto suelto entre las matas (lo que hace que no se vea la tierra)
  for (let k = 0; k < 2600; k++) {
    const x = (r() - 0.5) * 0.99, z = (r() - 0.5) * 0.99;
    if (r() > densidad(x, z) * 0.95) continue;
    const alto = 0.03 + 0.06 * r();
    hoja(g, x, z, r() * 6.2832, alto, 0.0022 + r() * 0.0018, alto * (0.1 + 0.5 * r()), tonosHoja());
  }
  // alguna hoja del borde que se tumba sobre el camino
  for (let k = 0; k < 40; k++) {
    const t = r(), i = Math.floor(t * (CAMINO.length - 2)), [ax, az] = CAMINO[i], [bx, bz] = CAMINO[i + 1];
    const l = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / l, nz = (bx - ax) / l, s = r() < 0.5 ? -1 : 1;
    const x = ax + nx * s * (MEDIO_CAMINO + 0.03), z = az + nz * s * (MEDIO_CAMINO + 0.03);
    if (Math.abs(x) > 0.49 || Math.abs(z) > 0.49) continue;
    const alto = 0.05 + 0.1 * r();
    hoja(g, x, z, Math.atan2(-nz * s, -nx * s) + (r() - 0.5) * 0.6, alto, 0.003, alto * (0.6 + 0.4 * r()), tonosHoja());
  }
  return geometria(g);
}

// trebol: tres foliolos redondeados (abanicos de tres caras) sobre un tallito, y alguna cabezuela blanca
function trebol() {
  const g = malla(), ARR = [0, 1, 0];
  const verde = col(0x557434), claro = col(0x7d9a4d), tallo = col(0x5b7038);
  for (let k = 0; k < 90; k++) {
    const a0 = r() * 6.2832, rad = TREBOL.r * Math.sqrt(r());
    const x = TREBOL.x + Math.cos(a0) * rad, z = TREBOL.z + Math.sin(a0) * rad;
    if (Math.abs(x) > 0.48 || Math.abs(z) > 0.48 || distCamino(x, z) < MEDIO_CAMINO + 0.02) continue;
    const y = altura(x, z) + 0.025 + r() * 0.04, s = 0.012 + r() * 0.008, giro = r() * 6.2832;
    tri(g, [x - 0.0015, altura(x, z), z], [x + 0.0015, altura(x, z), z], [x, y, z], tallo, tallo, tallo, null, ARR);
    for (let f = 0; f < 3; f++) {
      const a = giro + f * 2.094, ax = Math.cos(a), az = Math.sin(a);
      // el foliolo: un corazon chato en tres caras, algo levantado por fuera
      const pts = [-0.75, -0.25, 0.25, 0.75].map((w) => { const b = a + w * 0.9; return [x + Math.cos(b) * s * (w * w < 0.1 ? 1.05 : 0.9), y + s * 0.25, z + Math.sin(b) * s * (w * w < 0.1 ? 1.05 : 0.9)]; });
      const o = [x + ax * s * 0.08, y, z + az * s * 0.08];
      for (let t = 0; t < 3; t++) tri(g, o, pts[t], pts[t + 1], verde, t === 1 ? claro : verde, verde, null, ARR);
    }
  }
  return geometria(g);
}
function cabezuelas(lista, color, radio) {
  const geos = lista.map(([x, z, h]) => {
    const b = new THREE.IcosahedronGeometry(radio, 0);
    b.scale(1, 0.85, 1);
    b.translate(x, altura(x, z) + h, z);
    return b.toNonIndexed();
  });
  const g = malla();
  const c = col(color);
  for (const b of geos) {
    const p = b.attributes.position;
    for (let i = 0; i < p.count; i += 3) {
      const k = 0.88 + 0.2 * r();
      const cc = c.clone().multiplyScalar(k);
      tri(g, [p.getX(i), p.getY(i), p.getZ(i)], [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)], [p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)], cc);
    }
  }
  return geometria(g);
}
// una flor: tallo curvo, y petalos en corona alrededor de un boton (margarita) o en copa (boton de oro)
function flor(g, x, z, alto, tipo) {
  const ARR = [0, 1, 0];
  const y0 = altura(x, z), inc = alto * (0.08 + 0.12 * r()), ang = r() * 6.2832;
  const tallo = col(0x55703a);
  const hx = x + Math.cos(ang) * inc, hz = z + Math.sin(ang) * inc, hy = y0 + alto;
  const mx = x + Math.cos(ang) * inc * 0.3, mz = z + Math.sin(ang) * inc * 0.3, my = y0 + alto * 0.55;
  const w = 0.0016;
  tri(g, [x - w, y0, z], [x + w, y0, z], [mx + w * 0.7, my, mz], tallo, tallo, tallo, null, ARR);
  tri(g, [x - w, y0, z], [mx + w * 0.7, my, mz], [mx - w * 0.7, my, mz], tallo, tallo, tallo, null, ARR);
  tri(g, [mx - w * 0.7, my, mz], [mx + w * 0.7, my, mz], [hx, hy, hz], tallo, tallo, tallo, null, ARR);
  // la cabeza mira un poco al sol
  const nx = -0.35, nz = 0.3;
  const eje = new THREE.Vector3(nx, 1, nz).normalize(), u = new THREE.Vector3(1, 0, 0).cross(eje).normalize(), v = eje.clone().cross(u);
  const en = (rad, a, alt = 0) => [hx + (u.x * Math.cos(a) + v.x * Math.sin(a)) * rad + eje.x * alt, hy + (u.y * Math.cos(a) + v.y * Math.sin(a)) * rad + eje.y * alt, hz + (u.z * Math.cos(a) + v.z * Math.sin(a)) * rad + eje.z * alt];
  if (tipo === 'margarita') {
    // blanco algo frio: con el sol calido a pleno el blanco puro se iba a amarillo
    const blanco = col(0xe4e9ee), punta = col(0xdcd0dc), amarillo = col(0xe9be3a), centro = col(0xc0902a);
    const n = 12, R = 0.027;
    for (let p = 0; p < n; p++) {
      const a = (p / n) * 6.2832 + r() * 0.12, rp = R * (0.88 + 0.2 * r());
      const b1 = en(0.007, a - 0.0024 / 0.007), b2 = en(0.007, a + 0.0024 / 0.007);
      const m1 = en(0.017, a - 0.0042 / 0.017, -0.001), m2 = en(0.017, a + 0.0042 / 0.017, -0.001), t = en(rp, a, -0.003);
      tri(g, b1, b2, m2, blanco, blanco, blanco, null, ARR);
      tri(g, b1, m2, m1, blanco, blanco, blanco, null, ARR);
      tri(g, m1, m2, t, blanco, blanco, punta, null, ARR);
    }
    for (let p = 0; p < 7; p++) {
      const a = (p / 7) * 6.2832, b = ((p + 1) / 7) * 6.2832;
      tri(g, en(0, 0, 0.0055), en(0.0085, a, 0.0012), en(0.0085, b, 0.0012), amarillo, centro, centro, null, ARR);
    }
  } else {
    const am = col(0xedc53a), osc = col(0xc8952a);
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * 6.2832 + r() * 0.2;
      // petalo en copa: sale inclinado hacia arriba
      tri(g, en(0.002, a - 0.5), en(0.002, a + 0.5), en(0.015, a + 0.3, 0.008), osc, osc, am, null, ARR);
      tri(g, en(0.002, a - 0.5), en(0.015, a + 0.3, 0.008), en(0.015, a - 0.3, 0.008), osc, am, am, null, ARR);
    }
  }
}
function flores() {
  const g = malla();
  for (const [x, z, h] of [[0.2, 0.33, 0.1], [0.38, 0.19, 0.12], [0.3, 0.06, 0.09], [0.36, 0.0, 0.13], [0.15, 0.43, 0.08], [-0.3, -0.42, 0.24], [0.02, -0.08, 0.23]]) flor(g, x, z, h, 'margarita');
  for (const [x, z, h] of [[0.43, 0.37, 0.14], [0.13, 0.2, 0.12], [-0.42, -0.2, 0.2], [0.45, -0.38, 0.24], [0.28, 0.42, 0.11]]) flor(g, x, z, h, 'boton');
  return geometria(g);
}

// ---------------- una hoja seca y una ramita, sobre el camino ----------------
function restos() {
  const g = malla(), ARR = [0, 1, 0];
  // la hoja: dos mitades a cada lado del nervio, un poco plegadas
  const hx = -0.2, hz = 0.12, a = 0.7, L = 0.058;
  const ca = Math.cos(a), sa = Math.sin(a), y = altura(hx, hz) + 0.003;
  const P = (t, w, dy = 0) => [hx + ca * (t - 0.5) * L - sa * w * L, y + dy, hz + sa * (t - 0.5) * L + ca * w * L];
  const parda = col(0x9a6f3c), oscura = col(0x7a5530);
  const borde = [[0.1, 0.18], [0.35, 0.3], [0.6, 0.28], [0.85, 0.14]];
  for (const lado of [-1, 1]) {
    let prev = P(0, 0);
    for (const [t, w] of borde) { const q = P(t, w * lado, 0.004); tri(g, prev, q, P(t, 0, 0.0015), parda, parda, oscura, null, ARR); prev = q; }
    tri(g, prev, P(1, 0, 0.002), P(0.85, 0, 0.0015), parda, oscura, oscura, null, ARR);
    let anterior = P(0, 0);
    for (const [t] of borde) { const q = P(t, 0, 0.0015); tri(g, anterior, prev, q, oscura, parda, oscura, null, ARR); anterior = q; }
  }
  // la ramita: un prisma de cuatro caras en dos tramos, con un brote
  const rama = col(0x8b7558), rClara = col(0xa38d6c);
  const tramo = (a0, a1, rad) => {
    for (let k = 0; k < 4; k++) {
      const t0 = (k / 4) * 6.2832, t1 = ((k + 1) / 4) * 6.2832;
      const o = (p, t) => [p[0], p[1] + Math.sin(t) * rad, p[2] + Math.cos(t) * rad];
      const c = k % 2 ? rama : rClara;
      tri(g, o(a0, t0), o(a1, t0), o(a1, t1), c, c, c, [0, Math.sin((t0 + t1) / 2), Math.cos((t0 + t1) / 2)]);
      tri(g, o(a0, t0), o(a1, t1), o(a0, t1), c, c, c, [0, Math.sin((t0 + t1) / 2), Math.cos((t0 + t1) / 2)]);
    }
  };
  const p0 = [-0.42, altura(-0.42, 0.02) + 0.007, 0.02], p1 = [-0.3, altura(-0.3, 0.07) + 0.007, 0.07], p2 = [-0.2, altura(-0.2, 0.05) + 0.006, 0.04];
  tramo(p0, p1, 0.0065);
  tramo(p1, p2, 0.005);
  const geo = geometria(g);
  return geo;
}

// ---------------- la escena ----------------
export function montar(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(ANCHO, ALTO, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = col(0xc9c7ad);
  const cam = new THREE.PerspectiveCamera(30, ANCHO / ALTO, 0.01, 50);

  // la luz del mapa: cielo salvia, sol calido desde el oeste-sur
  const tono = new THREE.DataTexture(new Uint8Array([120, 175, 222, 255].flatMap((v) => [v, v, v, 255])), 4, 1, THREE.RGBAFormat);
  tono.minFilter = tono.magFilter = THREE.NearestFilter;
  tono.needsUpdate = true;
  scene.add(new THREE.HemisphereLight(0xf3efd6, 0x55603a, 1.55));
  const sol = new THREE.DirectionalLight(0xffe3b2, 2.7);
  const DIR = new THREE.Vector3(-0.5, 0.68, 0.53).normalize();
  sol.position.copy(DIR).multiplyScalar(3);
  sol.castShadow = true;
  sol.shadow.mapSize.set(4096, 4096);
  Object.assign(sol.shadow.camera, { near: 0.5, far: 6, left: -1.1, right: 1.1, top: 1.1, bottom: -1.1 });
  sol.shadow.bias = -0.0002;
  sol.shadow.normalBias = 0.0015;
  scene.add(sol, sol.target);

  const toon = (extra = {}) => {
    const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: tono, flatShading: true, ...extra });
    // las hojas de dos caras llevan la normal hacia ARRIBA por las dos: three la daba la vuelta por detras y las hojas
    // vistas de espaldas salian negras
    if (extra.side === THREE.DoubleSide) {
      m.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>',
          THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0'));
      };
    }
    return m;
  };
  const tinta = new THREE.MeshBasicMaterial({ color: TINTA, side: THREE.BackSide });
  const poner = (geo, mat, sombra = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = sombra; m.receiveShadow = true; scene.add(m); return m; };

  // la mesa: un plano claro bajo el bloque, para su sombra
  const mesa = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ color: 0x3a3424, opacity: 0.28 }));
  mesa.rotation.x = -Math.PI / 2;
  mesa.position.y = FONDO_Y - 0.0005;
  mesa.receiveShadow = true;
  scene.add(mesa);

  poner(bloque(), toon());
  poner(bloque(0.0025, 0.0035, 0.003, false), tinta, false);

  // la roca y sus piedras, y las chinas del camino
  const piedras = [];
  const roca = piedra(31, ROCA.r, ROCA.alto, ROCA.r * 0.82, 1, 1);
  piedras.push({ ...roca, x: ROCA.x, z: ROCA.z, hundir: 0.32 * ROCA.alto, giro: 0.6, tono: col(0x9a9383), linea: 0.0028 });
  piedras.push({ ...piedra(47, 0.045, 0.04, 0.038, 1, 0.6), x: 0.37, z: -0.06, hundir: 0.012, giro: 2.1, tono: col(0x8f8778), linea: 0.002 });
  piedras.push({ ...piedra(59, 0.028, 0.022, 0.024, 0, 0), x: 0.06, z: -0.33, hundir: 0.006, giro: 0.3, tono: col(0xa59c89), linea: 0.0016 });
  for (let k = 0; k < 26; k++) {
    const t = r(), i = Math.floor(t * (CAMINO.length - 2)), [ax, az] = CAMINO[i];
    const x = ax + (r() - 0.5) * MEDIO_CAMINO * 1.7, z = az + (r() - 0.5) * MEDIO_CAMINO * 1.7;
    if (Math.abs(x) > 0.47 || Math.abs(z) > 0.47 || distCamino(x, z) > MEDIO_CAMINO) continue;
    const s = 0.006 + Math.pow(r(), 2) * 0.02;
    if (piedras.some((p) => Math.hypot(p.x - x, p.z - z) < 0.035)) continue;
    piedras.push({ ...piedra(100 + k, s, s * (0.45 + 0.3 * r()), s * (0.75 + 0.3 * r()), 0, 0), x, z, hundir: s * 0.25, giro: r() * 6.28,
      tono: col(0xa49b88).lerp(col(0x8a7f70), r()).multiplyScalar(0.95 + 0.1 * r()), linea: 0.0012 });
  }
  for (const p of piedras) {
    const y = altura(p.x, p.z) - p.hundir;
    for (const [geo, mat] of [[p.plana, toon({ color: p.tono })], [casco(p.casco, p.linea), tinta]]) {
      const m = poner(geo, mat, mat !== tinta);
      m.position.set(p.x, y, p.z);
      m.rotation.y = p.giro;
    }
  }

  poner(hierba(), toon({ side: THREE.DoubleSide, flatShading: false }));
  poner(trebol(), toon({ side: THREE.DoubleSide, flatShading: false }));
  poner(cabezuelas([[0.21, 0.31, 0.075], [0.3, 0.2, 0.06], [0.16, 0.22, 0.055]], 0xeee2e0, 0.0085), toon());
  poner(flores(), toon({ side: THREE.DoubleSide, flatShading: false }));
  poner(restos(), toon({ side: THREE.DoubleSide }));

  // ---------------- fotos con cotas ----------------
  const lienzo = document.createElement('canvas');
  lienzo.width = ANCHO; lienzo.height = ALTO;
  const g2 = lienzo.getContext('2d');
  const enPantalla = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(cam); return [(v.x + 1) / 2 * ANCHO, (1 - v.y) / 2 * ALTO]; };
  function cota(a, b, texto) {
    const [ax, ay] = enPantalla(...a), [bx, by] = enPantalla(...b);
    const l = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / l, ny = (bx - ax) / l;
    g2.strokeStyle = 'rgba(30,24,20,0.85)'; g2.lineWidth = 2;
    g2.beginPath(); g2.moveTo(ax, ay); g2.lineTo(bx, by);
    for (const [px, py] of [[ax, ay], [bx, by]]) { g2.moveTo(px - nx * 9, py - ny * 9); g2.lineTo(px + nx * 9, py + ny * 9); }
    g2.stroke();
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    g2.save(); g2.translate(mx, my);
    let ang = Math.atan2(by - ay, bx - ax); if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
    g2.rotate(ang);
    g2.font = '600 26px Bahnschrift, "Segoe UI", sans-serif'; g2.textAlign = 'center';
    g2.fillStyle = '#c9c7ad'; g2.fillRect(-34, -18, 68, 36);
    g2.fillStyle = '#1e1814'; g2.fillText(texto, 0, 9);
    g2.restore();
  }
  async function foto(nombre, pos, mira, fov, cotas) {
    cam.fov = fov;
    cam.position.set(...pos);
    cam.lookAt(...mira);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    renderer.render(scene, cam);
    g2.drawImage(canvas, 0, 0);
    if (cotas) {
      const y = FONDO_Y;
      cota([-0.5, y, 0.6], [0.5, y, 0.6], '1 m');
      cota([0.6, y, 0.5], [0.6, y, -0.5], '1 m');
      g2.font = '600 30px Bahnschrift, "Segoe UI", sans-serif'; g2.fillStyle = '#1e1814'; g2.textAlign = 'left';
      g2.fillText('SUELO DEL MURO · 1 m²', 48, 66);
      g2.font = '22px Bahnschrift, "Segoe UI", sans-serif'; g2.fillStyle = 'rgba(30,24,20,0.7)';
      g2.fillText('hierba 3-28 cm · caminito pisado · roca con musgo · trébol, margaritas y botones de oro', 48, 100);
    }
    const blob = await new Promise((ok) => lienzo.toBlob(ok, 'image/jpeg', 0.93));
    await fetch('/__snap/' + nombre, { method: 'PUT', body: blob });
    return nombre;
  }
  return {
    renderer, scene, cam,
    async fotos() {
      const hechas = [];
      hechas.push(await foto('suelo1m_conjunto', [1.62, 1.36, 1.86], [0.03, -0.12, 0.03], 30, true));
      hechas.push(await foto('suelo1m_cerca', [0.78, 0.22, 0.86], [0.12, 0.04, -0.02], 36, false));
      hechas.push(await foto('suelo1m_arriba', [0.02, 1.95, 0.35], [0, 0, 0], 32, false));
      return hechas;
    },
    info: () => ({ triangulos: renderer.info.render.triangles, llamadas: renderer.info.render.calls }),
  };
}
