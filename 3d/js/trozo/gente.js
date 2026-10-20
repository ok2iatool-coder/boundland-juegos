// La GENTE del trozo: los seis con nombre (Ramiro, Elena, Nieves, Amparo, Tobias y Lia) y los vecinos de fondo.
// Cuerpos LOW POLY con tinta hechos de piezas (tronco, cabeza, brazos, piernas y lo de cada uno: casco y fusil,
// abrigo y carpeta, mandil y martillo, panuelo, sombrero, coletas...) pegadas a un ESQUELETO de 12 huesos con piel
// rigida: cada persona son dos mallas (cuerpo y tinta). Las poses son por codigo (andar, quieto, sentado, trabajar,
// agachado, hablar) y van a donde dice su horario (sim/datos.js) por el grafo de paso del plano (mapa.js).
// Los vecinos tienen horario propio: hacen cola en el pozo con su cubo (y en el segundo cuando esta), se sientan al
// fuego, trabajan las huertas y la obra; tras el pozo llegan cuatro mas.
import * as THREE from 'three';
import { FORMAS, tronco, cascoDe, col, azar, TONO, TINTA } from './geo.js';
import { SITIOS, COSAS, ruta } from './mapa.js';
import { PERSONAS } from './sim/datos.js';
import { dondeEsta, hora } from './sim/partida.js';

const HUESOS = ['raiz', 'cadera', 'torso', 'cabeza', 'brazoI', 'codoI', 'brazoD', 'codoD', 'musloI', 'rodillaI', 'musloD', 'rodillaD'];
const PADRE = { cadera: 'raiz', torso: 'cadera', cabeza: 'torso', brazoI: 'torso', codoI: 'brazoI', brazoD: 'torso', codoD: 'brazoD', musloI: 'cadera', rodillaI: 'musloI', musloD: 'cadera', rodillaD: 'musloD' };

// ---------------- como es cada uno ----------------
export const ASPECTOS = {
  ramiro: { alto: 1.8, ancho: 1.06, piel: 0xc69a78, ropa: 0x5e6648, pantalon: 0x3f3a33, botas: 0x2e2620, casco: 0x5d5f55, chaleco: 0x4a5040, fusil: true },
  elena: { alto: 1.7, ancho: 0.95, piel: 0xd8b08e, ropa: 0x55606e, pantalon: 0x3b3a3f, botas: 0x2e2620, pelo: 0x3a2a20, mono: true, abrigo: 0x55606e, bufanda: 0xa05a3c, carpeta: true },
  nieves: { alto: 1.74, ancho: 1.14, piel: 0xc9926e, ropa: 0x8b6a52, pantalon: 0x4a4339, botas: 0x2e2620, pelo: 0xa0482c, corto: true, mandil: 0x4a3828, martillo: true },
  amparo: { alto: 1.6, ancho: 1.0, piel: 0xb98a6a, ropa: 0x6e7a5a, pantalon: 0x5c5240, botas: 0x3a2e24, panuelo: 0xd8d0bd, falda: 0x6e7a5a, bolsa: 0x8a6a48 },
  tobias: { alto: 1.72, ancho: 1.16, piel: 0xd0a07c, ropa: 0xcfc3a5, pantalon: 0x5a4a3a, botas: 0x2e2620, sombrero: 0x5a4636, chaleco: 0xa88a4a, barriga: true },
  lia: { alto: 1.12, ancho: 0.64, piel: 0xe0b896, ropa: 0x8f6e4e, pantalon: 0x4f4a44, botas: 0x3a2e24, pelo: 0x4a3426, coletas: true, bufanda: 0x4f6d8f, nina: true },
};
const ROPAS = [0x6d6a5c, 0x7c6a52, 0x5f6a6c, 0x8a7458, 0x6e7458, 0x8c6a5a, 0x5a5f52, 0x9a8a6a, 0x6a5a6a, 0x7a7a6a].map((c) => c);
const PIELES = [0xd8b08e, 0xc69a78, 0xb98a6a, 0xe0b896, 0xa87a5a, 0xcfa07c];
const PELOS = [0x3a2a20, 0x4a3426, 0x2a2220, 0x6a5040, 0x8a8478, 0x5a4636];
function aspectoVecino(i) {
  const r = azar(900 + i * 17);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const nino = r() < 0.12;
  return {
    alto: nino ? 1.15 + r() * 0.2 : 1.6 + r() * 0.24, ancho: nino ? 0.66 : 0.95 + r() * 0.18, nina: nino,
    piel: pick(PIELES), ropa: pick(ROPAS), pantalon: pick([0x3f3a33, 0x4a4339, 0x50483e, 0x3b3a3f]), botas: 0x2e2620,
    pelo: r() < 0.7 ? pick(PELOS) : null, corto: r() < 0.6, panuelo: r() < 0.2 ? pick([0xd8d0bd, 0xa59c7e, 0x8d9474]) : null,
    gorro: r() < 0.25 ? pick([0x5a4636, 0x4a5040, 0x6a5a4a]) : null, abrigo: r() < 0.3 ? pick(ROPAS) : null, falda: r() < 0.25 ? pick(ROPAS) : null,
    cubo: true,
  };
}

// ---------------- el cuerpo: piezas + esqueleto ----------------
function crearCuerpo(A) {
  const k = A.alto / 1.75, w = A.ancho, cab = A.nina ? 1.35 : 1;          // los ninos, cabeza mas grande
  const piezas = [];
  const pon = (geo, hueso, m, color, tinta = 0.018) => piezas.push({ geo, hueso: HUESOS.indexOf(hueso), m, color: col(color), tinta });
  const T = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  // alturas de las articulaciones
  const yCad = 0.93 * k, yRod = 0.5 * k, yTob = 0.08 * k, yHom = 1.43 * k, yCodo = 1.13 * k, yCab = 1.5 * k;
  const xHom = 0.205 * k * w, xPie = 0.095 * k * w;
  // piernas (muslo y pierna con la bota)
  for (const [s, m, r] of [[1, 'musloI', 'rodillaI'], [-1, 'musloD', 'rodillaD']]) {
    const x = s * xPie;
    pon(tronco(0.065, 0.085, 6), m, T(x, yRod, 0, 0, 0, 0, k * w, yCad - yRod, k * w), A.pantalon);
    pon(tronco(0.05, 0.066, 6), r, T(x, yTob, 0, 0, 0, 0, k * w, yRod - yTob, k * w), A.pantalon);
    pon(FORMAS.cajaSuelo, r, T(x, 0, 0.035 * k, 0, 0, 0, 0.115 * k * w, 0.1 * k, 0.23 * k), A.botas);
  }
  // cadera y tronco (6 lados, aplastado de delante a atras); barriga si la hay
  pon(FORMAS.caja, 'cadera', T(0, yCad + 0.03 * k, 0, 0, 0, 0, 0.33 * k * w, 0.16 * k, 0.2 * k * w), A.pantalon);
  pon(tronco(0.15, 0.19, 6), 'torso', T(0, yCad + 0.06 * k, 0, 0, Math.PI / 6, 0, k * w, yHom - yCad + 0.02 * k, 0.68 * k * w), A.ropa);
  if (A.barriga) pon(FORMAS.bola, 'torso', T(0, yCad + 0.24 * k, 0.07 * k, 0, 0, 0, 0.32 * k, 0.3 * k, 0.24 * k), A.chaleco || A.ropa);
  if (A.chaleco) pon(tronco(0.16, 0.2, 6), 'torso', T(0, yCad + 0.14 * k, 0, 0, Math.PI / 6, 0, k * w * 1.04, (yHom - yCad) * 0.8, 0.72 * k * w), A.chaleco);
  if (A.mandil) pon(FORMAS.caja, 'torso', T(0, yCad + 0.06 * k, 0.11 * k * w, 0.04, 0, 0, 0.3 * k * w, 0.62 * k, 0.03 * k), A.mandil);
  if (A.abrigo) pon(tronco(0.22, 0.17, 6), 'cadera', T(0, yRod + 0.05 * k, 0, 0, Math.PI / 6, 0, k * w, yCad - yRod + 0.06 * k, 0.72 * k * w), A.abrigo);
  if (A.falda) pon(tronco(0.24, 0.16, 6), 'cadera', T(0, yRod - 0.02 * k, 0, 0, Math.PI / 6, 0, k * w, yCad - yRod + 0.12 * k, 0.75 * k * w), A.falda);
  if (A.bufanda) pon(tronco(0.1, 0.1, 6), 'torso', T(0, yHom - 0.04 * k, 0, 0, 0, 0, k * w * 1.1, 0.09 * k, k * w * 0.9), A.bufanda);
  if (A.bolsa) pon(FORMAS.caja, 'torso', T(-0.2 * k * w, yCad + 0.06 * k, 0, 0, 0, 0.1, 0.06 * k, 0.2 * k, 0.24 * k), A.bolsa);
  // cuello y cabeza (con dos ojos y lo de la cabeza)
  pon(tronco(0.05, 0.05, 6), 'cabeza', T(0, yHom - 0.02 * k, 0, 0, 0, 0, k, 0.08 * k, k), A.piel, 0.01);
  const hc = 0.25 * k * cab, yc = yCab + 0.1 * k + hc / 2 - 0.05 * k;
  pon(FORMAS.bola, 'cabeza', T(0, yc, 0, 0, 0, 0, 0.2 * k * cab, hc, 0.215 * k * cab), A.piel);
  for (const s of [-1, 1]) pon(FORMAS.caja, 'cabeza', T(s * 0.042 * k * cab, yc + 0.01 * k, 0.1 * k * cab, 0, 0, 0, 0.022 * k * cab, 0.03 * k * cab, 0.01 * k), 0x231d18, 0);
  if (A.pelo) {
    pon(FORMAS.bola, 'cabeza', T(0, yc + 0.045 * k * cab, -0.02 * k, 0, 0, 0, 0.215 * k * cab, hc * 0.8, 0.21 * k * cab), A.pelo, 0.012);
    if (A.mono) pon(FORMAS.bola, 'cabeza', T(0, yc + 0.06 * k, -0.12 * k, 0, 0, 0, 0.1 * k, 0.09 * k, 0.09 * k), A.pelo, 0.01);
    if (A.coletas) for (const s of [-1, 1]) pon(FORMAS.bola, 'cabeza', T(s * 0.13 * k * cab, yc - 0.02 * k, -0.04 * k, 0, 0, s * 0.4, 0.06 * k * cab, 0.13 * k * cab, 0.06 * k * cab), A.pelo, 0.008);
    if (!A.corto && !A.mono && !A.coletas) pon(FORMAS.caja, 'cabeza', T(0, yc - 0.06 * k, -0.08 * k, 0, 0, 0, 0.19 * k * cab, 0.2 * k, 0.07 * k), A.pelo, 0.01);
  }
  if (A.casco) pon(FORMAS.bola, 'cabeza', T(0, yc + 0.06 * k, 0, 0, 0, 0, 0.25 * k, 0.17 * k, 0.26 * k), A.casco, 0.012);
  if (A.panuelo) pon(FORMAS.bola, 'cabeza', T(0, yc + 0.04 * k * cab, -0.02 * k, 0.2, 0, 0, 0.225 * k * cab, hc * 0.86, 0.23 * k * cab), A.panuelo, 0.01);
  if (A.gorro) pon(tronco(0.11, 0.1, 6), 'cabeza', T(0, yc + 0.05 * k, -0.005, -0.1, 0, 0, k * cab, 0.1 * k, k * cab), A.gorro, 0.01);
  if (A.sombrero) {
    pon(FORMAS.cil8, 'cabeza', T(0, yc + 0.07 * k, 0, 0, 0, 0, 0.42 * k, 0.025 * k, 0.42 * k), A.sombrero, 0.01);
    pon(tronco(0.12, 0.1, 8), 'cabeza', T(0, yc + 0.09 * k, 0, 0, 0, 0, k, 0.11 * k, k), A.sombrero, 0.01);
  }
  // brazos (brazo y antebrazo con la mano)
  for (const [s, b, c] of [[1, 'brazoI', 'codoI'], [-1, 'brazoD', 'codoD']]) {
    const x = s * xHom;
    pon(tronco(0.05, 0.058, 6), b, T(x, yCodo, 0, 0, 0, 0, k * w, yHom - yCodo, k * w), A.abrigo || A.ropa);
    pon(tronco(0.04, 0.05, 6), c, T(x, yCodo - 0.25 * k, 0, 0, 0, 0, k * w, 0.25 * k, k * w), A.mandil ? A.piel : (A.abrigo || A.ropa));
    pon(FORMAS.caja, c, T(x, yCodo - 0.3 * k, 0.005, 0, 0, 0, 0.06 * k, 0.1 * k, 0.045 * k), A.piel, 0.008);
  }
  // lo que lleva en la mano o a la espalda
  if (A.fusil) pon(FORMAS.caja, 'torso', T(0.02 * k, yCad + 0.32 * k, -0.15 * k, 0, 0, 0.75, 0.04 * k, 0.95 * k, 0.05 * k), 0x2e2a26, 0.008);
  if (A.carpeta) pon(FORMAS.caja, 'codoD', T(-xHom, yCodo - 0.33 * k, 0.07 * k, 0.3, 0, 0, 0.03 * k, 0.28 * k, 0.21 * k), 0xc9b88f, 0.008);
  if (A.martillo) {
    pon(FORMAS.caja, 'codoD', T(-xHom, yCodo - 0.42 * k, 0.04 * k, 1.2, 0, 0, 0.03 * k, 0.3 * k, 0.03 * k), 0x6a4f36, 0.006);
    pon(FORMAS.caja, 'codoD', T(-xHom, yCodo - 0.36 * k, 0.2 * k, 1.2, 0, 0, 0.06 * k, 0.06 * k, 0.12 * k), 0x3d3d3d, 0.006);
  }
  if (A.cubo) {
    pon(tronco(0.1, 0.12, 8), 'codoD', T(-xHom, yCodo - 0.58 * k, 0.02, 0, 0, 0, k, 0.2 * k, k), 0x8a6a48, 0.008);
    pon(FORMAS.caja, 'codoD', T(-xHom, yCodo - 0.36 * k, 0.02, 0, 0, 0, 0.012, 0.03 * k, 0.012), 0x3a3530, 0);
  }
  if (A.farol) {
    pon(FORMAS.caja, 'codoI', T(xHom, yCodo - 0.42 * k, 0.05 * k, 0, 0, 0, 0.1 * k, 0.15 * k, 0.1 * k), 0x3a3631, 0.006);
  }
  return {
    piezas,
    articulaciones: {
      raiz: [0, 0, 0], cadera: [0, yCad, 0], torso: [0, yCad + 0.06 * k, 0], cabeza: [0, yHom, 0],
      brazoI: [xHom, yHom, 0], codoI: [xHom, yCodo, 0], brazoD: [-xHom, yHom, 0], codoD: [-xHom, yCodo, 0],
      musloI: [xPie, yCad, 0], rodillaI: [xPie, yRod, 0], musloD: [-xPie, yCad, 0], rodillaD: [-xPie, yRod, 0],
    },
    k,
  };
}

const matCuerpo = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: TONO, flatShading: true });
const matTinta = new THREE.MeshBasicMaterial({ color: TINTA, side: THREE.BackSide });
function montar(A) {
  const C = crearCuerpo(A), r = azar(Math.floor(A.alto * 1000));
  // geometria del cuerpo (caras planas, color por cara) y del casco de tinta, con su hueso por vertice
  const pos = [], colr = [], idx = [], cpos = [], cidx = [];
  for (const p of C.piezas) {
    const g = p.geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
    g.applyMatrix4(p.m);
    const plana = g.index ? g.toNonIndexed() : g;
    const P = plana.attributes.position;
    for (let i = 0; i < P.count; i += 3) {
      const t = 0.95 + r() * 0.1;
      for (let j = 0; j < 3; j++) { pos.push(P.getX(i + j), P.getY(i + j), P.getZ(i + j)); colr.push(p.color.r * t, p.color.g * t, p.color.b * t); idx.push(p.hueso); }
    }
    if (p.tinta > 0) {
      const h = cascoDe(g, p.tinta).attributes.position;
      for (let i = 0; i < h.count; i++) { cpos.push(h.getX(i), h.getY(i), h.getZ(i)); cidx.push(p.hueso); }
    }
  }
  const geom = (P, I, colores) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    if (colores) g.setAttribute('color', new THREE.Float32BufferAttribute(colores, 3));
    const si = new Uint16Array(I.length * 4), sw = new Float32Array(I.length * 4);
    I.forEach((h, i) => { si[i * 4] = h; sw[i * 4] = 1; });
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    g.computeVertexNormals();
    return g;
  };
  // los huesos en su sitio (relativos al padre)
  const huesos = HUESOS.map((n) => { const b = new THREE.Bone(); b.name = n; return b; });
  const H = Object.fromEntries(HUESOS.map((n, i) => [n, huesos[i]]));
  for (const n of HUESOS) {
    const a = C.articulaciones[n], p = PADRE[n] ? C.articulaciones[PADRE[n]] : [0, 0, 0];
    H[n].position.set(a[0] - p[0], a[1] - p[1], a[2] - p[2]);
    if (PADRE[n]) H[PADRE[n]].add(H[n]);
  }
  const raiz = new THREE.Group();
  const cuerpo = new THREE.SkinnedMesh(geom(pos, idx, colr), matCuerpo);
  cuerpo.add(H.raiz);
  cuerpo.updateMatrixWorld(true);
  const esq = new THREE.Skeleton(huesos);
  cuerpo.bind(esq);
  const tinta = new THREE.SkinnedMesh(geom(cpos, cidx, null), matTinta);
  tinta.bind(esq, cuerpo.bindMatrix);
  for (const m of [cuerpo, tinta]) m.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, A.alto / 2, 0), A.alto);
  cuerpo.castShadow = true;
  cuerpo.receiveShadow = true;
  raiz.add(cuerpo, tinta);
  // la pose de reposo (para volver a ella)
  const reposo = Object.fromEntries(HUESOS.map((n) => [n, H[n].position.clone()]));
  return { raiz, H, reposo, k: C.k, alto: A.alto };
}

// ---------------- las poses ----------------
const lerp = (a, b, t) => a + (b - a) * t;
function posar(f, pose, t, fase, mezcla) {
  const H = f.H, k = f.k;
  // valores por pose; luego se funden con lo que habia (mezcla 0..1 por fotograma)
  const v = { cadY: 0, torX: 0, torY: 0, cabX: 0, cabY: f.mirarY || 0, bI: 0, bD: 0, bIz: 0.08, bDz: -0.08, cI: 0, cD: 0, mI: 0, mD: 0, rI: 0, rD: 0 };
  const resp = Math.sin(t * 1.7 + f.semilla) * 0.025;
  if (pose === 'andar') {
    const s = Math.sin(fase), c = Math.cos(fase);
    v.mI = -0.5 * s; v.mD = 0.5 * s;
    v.rI = Math.max(0, Math.sin(fase - 1.2)) * 0.9 + 0.1; v.rD = Math.max(0, -Math.sin(fase - 1.2)) * 0.9 + 0.1;
    v.bI = 0.4 * s; v.bD = -0.4 * s; v.cI = -0.25; v.cD = -0.25;
    v.cadY = -Math.abs(c) * 0.03 * k; v.torX = 0.06; v.torY = 0.08 * s;
  } else if (pose === 'sentado') {
    v.mI = v.mD = -1.45; v.rI = v.rD = 1.45; v.cadY = -0.47 * k; v.torX = 0.12 + resp; v.bI = v.bD = -0.55; v.cI = v.cD = -0.6; v.bIz = 0.2; v.bDz = -0.2; v.cabX = 0.15;
  } else if (pose === 'trabajo') {
    // golpear / tirar: el brazo derecho sube y baja, el tronco acompana
    const g = Math.sin(t * 3.2 + f.semilla), u = Math.max(0, g);
    v.torX = 0.3 + 0.12 * u; v.bD = -1.4 * u - 0.4; v.cD = -0.9 * u - 0.3; v.bI = -0.6; v.cI = -0.7; v.mI = -0.15; v.mD = 0.1; v.rI = 0.2; v.rD = 0.15; v.cabX = 0.3;
  } else if (pose === 'agachado') {
    const g = Math.sin(t * 1.6 + f.semilla);
    v.mI = -1.1; v.mD = -0.5; v.rI = 2.0; v.rD = 1.4; v.cadY = -0.38 * k; v.torX = 0.65; v.bI = -0.9 + 0.2 * g; v.bD = -1.1 - 0.25 * g; v.cI = -0.4; v.cD = -0.3; v.cabX = 0.4;
  } else if (pose === 'hablar') {
    const g = Math.sin(t * 2.3 + f.semilla), h = Math.sin(t * 1.3);
    v.bD = -0.35 + 0.25 * g; v.cD = -0.9 + 0.3 * h; v.bI = -0.05; v.cI = -0.15; v.torX = resp; v.cabX = -0.05 + 0.05 * h; v.bDz = -0.25;
  } else if (pose === 'cubo') {
    v.bD = 0.05; v.cD = -0.05; v.bI = 0.0; v.cI = -0.2; v.torX = resp; v.cabX = 0.05 * Math.sin(t * 0.4 + f.semilla);
  } else if (pose === 'farol') {
    v.bI = -0.55; v.cI = -1.0; v.torX = resp;
  } else {          // quieto
    v.torX = resp; v.bI = 0.03 + resp; v.bD = 0.03 - resp; v.cI = v.cD = -0.12; v.cabY += 0.25 * Math.sin(t * 0.21 + f.semilla) * Math.max(0, Math.sin(t * 0.13 + f.semilla * 2));
  }
  const P = f.pose ||= { ...v };
  for (const key in v) P[key] = lerp(P[key], v[key], mezcla);
  H.cadera.position.y = f.reposo.cadera.y + P.cadY;
  H.torso.rotation.set(P.torX, P.torY, 0);
  H.cabeza.rotation.set(P.cabX, P.cabY, 0);
  H.brazoI.rotation.set(P.bI, 0, P.bIz); H.brazoD.rotation.set(P.bD, 0, P.bDz);
  H.codoI.rotation.set(P.cI, 0, 0); H.codoD.rotation.set(P.cD, 0, 0);
  H.musloI.rotation.set(P.mI, 0, 0); H.musloD.rotation.set(P.mD, 0, 0);
  H.rodillaI.rotation.set(P.rI, 0, 0); H.rodillaD.rotation.set(P.rD, 0, 0);
}

// ---------------- los vecinos: horarios sobre sitios con nombre ----------------
const P1 = COSAS.pozo1, P2 = COSAS.obra, HG = COSAS.hogueraDentro, FF = COSAS.fuegoFuera, HU = COSAS.huertas;
// asientos de los bancos de tronco de cada fuego
const asientos = (c, R, angulos) => angulos.flatMap((a) => [a - 0.22, a + 0.22]).map((a) => ({ x: c.x + Math.cos(a) * R, z: c.z + Math.sin(a) * R, mira: Math.atan2(c.x - (c.x + Math.cos(a) * R), c.z - (c.z + Math.sin(a) * R)), pose: 'sentado' }));
const ASIENTOS = {
  hoguera: asientos(HG, 3.3, [0, 1, 2, 3].map((k) => k * Math.PI / 2 + 0.4)),
  fuego_fuera: asientos(FF, 2.6, [0, 1, 2].map((k) => k * 2.1 + 0.3)),
};
const cola = (c, dx, dz, n) => Array.from({ length: n }, (_, i) => ({ x: c.x + dx * (2.2 + i * 1.0), z: c.z + dz * (2.2 + i * 1.0), mira: Math.atan2(-dx, -dz), pose: i === 0 ? 'trabajo' : 'cubo' }));
const COLAS = { cola1: cola(P1, 0.9, 0.44, 7), cola2: cola(P2, 0.88, 0.48, 5) };
const PUNTOS = {
  charla: [{ x: 7.5, z: -43, mira: 1.2 }, { x: 9.2, z: -42.4, mira: -1.9 }, { x: -18, z: -73, mira: 0.9 }, { x: -16.6, z: -72.4, mira: -2.2 }, { x: 24, z: -72, mira: -2.6 }, { x: 23.3, z: -73.6, mira: 0.4 }],
  huerta: [{ x: -55, z: 47.5 }, { x: -48, z: 50.6 }, { x: -36, z: 53.7 }, { x: -52, z: 56.8 }, { x: -33, z: 59.9 }].map((p) => ({ ...p, mira: Math.PI / 2, pose: 'agachado' })),
  obra: [0, 1, 2].map((k) => { const a = k * 2.1 + 0.5; return { x: P2.x + Math.cos(a) * 2.0, z: P2.z + Math.sin(a) * 2.0, mira: Math.atan2(-Math.cos(a), -Math.sin(a)), pose: 'trabajo' }; }),
  taller: [{ x: 31.5, z: -36, mira: -2.0, pose: 'trabajo' }, { x: 28.6, z: -33.2, mira: 2.2, pose: 'trabajo' }],
  fuera: [{ x: -34, z: 14, mira: 0.3 }, { x: 26, z: 13, mira: -0.4 }, { x: 52, z: 9, mira: 0.2 }, { x: -60, z: 10, mira: 0.6 }],
};
// el horario de cada vecino: [desde, hasta, sitio]; los sitios 'cola1', 'cola2', 'hoguera', etc. reparten plazas
const OFICIOS = {
  aguador: [[7, 12, 'cola'], [12, 14, 'charla'], [14, 19, 'cola'], [19, 22, 'hoguera'], [22, 31, 'casa']],
  hortelano: [[7, 13, 'huerta'], [13, 14, 'fuego_fuera'], [14, 19, 'huerta'], [19, 22, 'fuego_fuera'], [22, 31, 'casaFuera']],
  charla: [[9, 13, 'charla'], [13, 18, 'fuera'], [18, 22, 'hoguera'], [22, 33, 'casa']],
  obrero: [[8, 19, 'obra'], [19, 22, 'hoguera'], [22, 32, 'casa']],
};
const VECINOS = [
  ...Array.from({ length: 6 }, (_, i) => ({ oficio: 'aguador', i })),
  ...Array.from({ length: 4 }, (_, i) => ({ oficio: 'hortelano', i })),
  ...Array.from({ length: 3 }, (_, i) => ({ oficio: 'charla', i })),
  ...Array.from({ length: 3 }, (_, i) => ({ oficio: 'obrero', i })),
  // los que llegan tras el segundo pozo
  ...Array.from({ length: 4 }, (_, i) => ({ oficio: i < 2 ? 'aguador' : 'hortelano', i: 10 + i, llegado: true })),
];
const CASAS = [{ x: -60, z: -40 }, { x: 60, z: -30 }, { x: -50, z: -110 }, { x: 55, z: -110 }, { x: -25, z: -112 }, { x: 70, z: -70 }];
const CASAS_FUERA = [{ x: -40, z: 8 }, { x: 40, z: 9 }, { x: -70, z: 12 }, { x: 70, z: 12 }];

export function crearGente(grupo, { altura, choques }) {
  const personas = [];
  function nueva(id, A, extra = {}) {
    const f = montar(A);
    f.id = id; f.A = A; f.semilla = personas.length * 1.37;
    f.x = 0; f.z = 0; f.giro = 0; f.camino = []; f.fase = 0; f.visible = false; f.destino = null; f.posePuesta = 'quieto'; f.hablando = false;
    f.choque = { x: 1e5, z: 1e5, r: A.nina ? 0.2 : 0.28, persona: id };
    choques.circulos.push(f.choque);
    f.raiz.visible = false;
    f.raiz.name = 'persona_' + id;
    grupo.add(f.raiz);
    Object.assign(f, extra);
    personas.push(f);
    return f;
  }
  for (const id of Object.keys(PERSONAS)) nueva(id, { ...ASPECTOS[id], farol: id === 'ramiro' }, { principal: true });
  VECINOS.forEach((v, n) => nueva('vecino' + n, aspectoVecino(n), { oficio: v.oficio, idx: v.i, llegado: !!v.llegado }));

  // a donde tiene que estar cada uno ahora mismo: { x, z, mira, pose } o null (en casa: no se ve)
  const ocupados = new Map();
  function plaza(lista, quien, pref) {
    // la plaza libre de una lista, empezando por la preferida; ocupados se rehace cada vez que se reparte
    for (let k = 0; k < lista.length; k++) {
      const i = (pref + k) % lista.length, clave = lista === COLAS.cola1 ? 'c1' + i : lista === COLAS.cola2 ? 'c2' + i : lista[i].x + ',' + lista[i].z;
      const o = ocupados.get(clave);
      if (!o || o === quien) { ocupados.set(clave, quien); return lista[i]; }
    }
    return null;
  }
  function sitioDe(f, p) {
    const h = hora(p);
    if (f.principal) {
      const s = dondeEsta(p, f.id);
      if (!s) return null;
      const S = SITIOS[s];
      if (!S || S.oculto) return { ...(S || SITIOS.puerta), oculto: true };
      if (S.asientos) return plaza(ASIENTOS[s], f.id, f.id.length * 3);
      const pose = f.id === 'nieves' && s === 'herreria' ? 'trabajo' : f.id === 'lia' && s === 'huerta' ? 'agachado' : f.id === 'tobias' && s === 'puesto' ? 'quieto'
        : f.id === 'ramiro' && s === 'puerta_noche' ? 'farol' : 'quieto';
      return { ...S, pose };
    }
    if (f.llegado && p.ciudad.poblacion <= 120) return null;
    const oficio = OFICIOS[f.oficio];
    let s = null;
    for (const [a, b, sitio] of oficio) if ((h >= a && h < b) || (h + 24 >= a && h + 24 < b)) { s = sitio; break; }
    if (!s) return null;
    if (s === 'casa') return { ...CASAS[f.idx % CASAS.length], oculto: true };
    if (s === 'casaFuera') return { ...CASAS_FUERA[f.idx % CASAS_FUERA.length], oculto: true };
    if (s === 'cola') {
      // con el segundo pozo terminado, la mitad va al nuevo: las dos colas, mas cortas
      const dos = p.obra.terminada !== null, usa = dos && (f.idx % 2) ? COLAS.cola2 : COLAS.cola1;
      return plaza(usa, f.id, dos ? Math.floor(f.idx / 2) : f.idx);
    }
    if (s === 'obra') {
      if (p.obra.empezada !== null && p.obra.terminada === null) return plaza(PUNTOS.obra, f.id, f.idx);
      return plaza(PUNTOS.taller, f.id, f.idx) || plaza(ASIENTOS.hoguera, f.id, f.idx);
    }
    if (ASIENTOS[s]) return plaza(ASIENTOS[s], f.id, f.idx * 3 + 1);
    if (PUNTOS[s]) return plaza(PUNTOS[s], f.id, f.idx * 2);
    return null;
  }

  // reparto de destinos cada medio segundo (no hace falta mas); cada uno se va andando por el grafo
  let reparto = 0;
  function repartir(p, puertaAbierta) {
    ocupados.clear();
    // los que ya estan sentados o en cola conservan su sitio: se reparten primero
    const orden = [...personas].sort((a, b) => (b.llego ? 1 : 0) - (a.llego ? 1 : 0));
    for (const f of orden) {
      const s = sitioDe(f, p);
      const clave = s ? `${s.x.toFixed(2)},${s.z.toFixed(2)},${s.oculto ? 1 : 0}` : 'nada';
      if (clave === f.claveDestino) continue;
      f.claveDestino = clave;
      f.destino = s;
      f.llego = false;
      if (!s) { f.visible = false; continue; }
      if (!f.visible && !s.oculto) {
        // aparece: sale de su casa (o, si ya es de dia al cargar, directamente en su sitio)
        f.visible = true;
        if (f.primera === undefined) { f.x = s.x; f.z = s.z; f.giro = s.mira || 0; f.camino = []; f.primera = false; f.llego = true; continue; }
      }
      if (f.primera === undefined) { f.primera = false; f.x = s.x; f.z = s.z; f.visible = !s.oculto; f.camino = []; continue; }
      f.camino = ruta([f.x, f.z], [s.x, s.z]).slice(1);
      f.puertaCerrada = !puertaAbierta;
    }
  }

  const _v = new THREE.Vector3();
  function actualizar(t, dt, p, { puertaAbierta, heroe }) {
    reparto -= dt;
    if (reparto <= 0) { reparto = 0.5; repartir(p, puertaAbierta); }
    for (const f of personas) {
      let pose = 'quieto', mezcla = Math.min(1, dt * 6);
      if (f.visible && f.camino.length && !f.hablando) {
        const v = (f.A.nina ? 1.0 : 1.25) * dt;
        let [tx, tz] = f.camino[0];
        let dx = tx - f.x, dz = tz - f.z, d = Math.hypot(dx, dz);
        // con la puerta cerrada, cruzar el muro es pasar por el portillo: se salta el tramo dentro del muro
        if (f.puertaCerrada && Math.abs(f.z) < 2 && (tz > 0) !== (f.z > 0)) { f.z = tz > 0 ? 2.2 : -2.2; d = Math.hypot(tx - f.x, tz - f.z); }
        if (d <= v) { f.x = tx; f.z = tz; f.camino.shift(); }
        else { f.x += dx / d * v; f.z += dz / d * v; }
        const g = Math.atan2(dx, dz);
        let dg = Math.atan2(Math.sin(g - f.giro), Math.cos(g - f.giro));
        f.giro += dg * Math.min(1, dt * 8);
        f.fase += v / (0.62 * f.k);
        pose = 'andar';
        if (!f.camino.length) {
          f.llego = true;
          if (f.destino && f.destino.oculto) f.visible = false;
        }
      } else if (f.visible) {
        const s = f.destino;
        if (f.hablando && heroe) {
          // mira al 18
          const g = Math.atan2(heroe.pos.x - f.x, heroe.pos.z - f.z);
          f.giro += Math.atan2(Math.sin(g - f.giro), Math.cos(g - f.giro)) * Math.min(1, dt * 6);
          pose = s && s.pose === 'sentado' ? 'sentado' : 'hablar';
        } else if (s) {
          if (s.mira !== undefined) f.giro += Math.atan2(Math.sin(s.mira - f.giro), Math.cos(s.mira - f.giro)) * Math.min(1, dt * 4);
          pose = s.pose || 'quieto';
        }
      }
      // la cabeza sigue al 18 si pasa cerca (y no esta trabajando)
      f.mirarY = 0;
      if (f.visible && heroe && pose !== 'trabajo' && pose !== 'agachado') {
        const dx = heroe.pos.x - f.x, dz = heroe.pos.z - f.z, d = Math.hypot(dx, dz);
        if (d < 6) {
          let a = Math.atan2(dx, dz) - f.giro;
          a = Math.atan2(Math.sin(a), Math.cos(a));
          if (Math.abs(a) < 1.6) f.mirarY = Math.max(-1, Math.min(1, a)) * (1 - d / 6) * 1.2;
        }
      }
      f.raiz.visible = f.visible;
      f.choque.x = f.visible ? f.x : 1e5; f.choque.z = f.visible ? f.z : 1e5;
      if (!f.visible) continue;
      // distancia a la camara: lejos no se anima (ni se mira)
      f.raiz.position.set(f.x, altura(f.x, f.z), f.z);
      f.raiz.rotation.y = f.giro;
      if (heroe) { _v.set(f.x - heroe.pos.x, 0, f.z - heroe.pos.z); if (_v.lengthSq() > 120 * 120) continue; }
      posar(f, pose, t, f.fase, mezcla);
    }
  }
  // la persona con nombre mas cercana a un punto (para hablar), visible y despierta
  function cercana(x, z, rmax = 2.4) {
    let mejor = null;
    for (const f of personas) {
      if (!f.principal || !f.visible) continue;
      const d = Math.hypot(f.x - x, f.z - z);
      if (d < rmax && (!mejor || d < mejor.d)) mejor = { f, d };
    }
    return mejor && mejor.f;
  }
  // colocar a todos en su sitio de golpe (al cargar una partida o al despertar)
  function colocar(p) {
    for (const f of personas) { f.primera = undefined; f.claveDestino = null; f.camino = []; f.visible = false; }
    repartir(p, true);
  }
  return { personas, actualizar, cercana, colocar, sitioDe };
}
