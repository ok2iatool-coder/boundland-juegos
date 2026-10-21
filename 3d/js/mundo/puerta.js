// LAS PUERTAS DE LA MURALLA (2026-10-21, "esta parte del muro mejoralo, que no sea liso, a tu manera"). Antes el dintel
// era una caja lisa de hormigon. Ahora el dintel son las dos caras del propio muro (el tramo 'p' de muralla.js, de la
// junta de 17 m para arriba) y aqui va lo de debajo, todo por codigo y en el marco de la puerta (x a lo ancho del muro,
// hacia fuera; y arriba; z a lo largo; el origen en el suelo, en medio del hueco):
//   - el TECHO del paso y los dos PILARES, de los mismos paneles de 3 m del muro (su atlas de cuatro caras), cada uno en
//     RELIEVE (4 cm sobre su junta oscura, con sus cantos) y con su tono; zocalo y capitel en los pilares;
//   - la JACENA: una viga de paneles que vuela 0,6 m de cada cara a la altura del dintel, con el rotulo PUERTA n a
//     plantilla;
//   - el PORTON levadizo de chapa nervada, subido y asomando 3,6 m bajo el techo, con su banda de aviso, y sus GUIAS de
//     acero en los pilares;
//   - cuatro FOCOS (dos por cara) y el UMBRAL de hormigon con la canaleta del porton.
import * as THREE from 'three';
import { TONO } from './tono.js';

export const PILAR = 1.6;            // ancho de cada pilar a lo largo del muro
const SALE = 0.9;                    // lo que el pilar sale de cada cara
const MEDIO = 4;                     // media anchura del muro (las caras de los paneles)

function azar(semilla) { let s = semilla >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

// geometria por material: quads con normal, UV y color (tambien la usa cimientos.js)
export class Lote {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; }
  quad(a, b, c, d, n, uv = [0, 0, 1, 0, 1, 1, 0, 1], col = [1, 1, 1]) {
    const base = this.p.length / 3;
    for (const [k, v] of [a, b, c, d].entries()) { this.p.push(v.x, v.y, v.z); this.n.push(n.x, n.y, n.z); this.uv.push(uv[k * 2], uv[k * 2 + 1]); this.c.push(...col); }
    // el sentido de giro, el que pida la normal (asi da igual en que orden vengan las esquinas)
    const e1x = b.x - a.x, e1y = b.y - a.y, e1z = b.z - a.z, e2x = c.x - a.x, e2y = c.y - a.y, e2z = c.z - a.z;
    const dir = (e1y * e2z - e1z * e2y) * n.x + (e1z * e2x - e1x * e2z) * n.y + (e1x * e2y - e1y * e2x) * n.z;
    if (dir >= 0) this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else this.i.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  tri(a, b, c, n, uv = [0, 0, 1, 0, 1, 1], col = [1, 1, 1]) {
    const base = this.p.length / 3;
    for (const [k, v] of [a, b, c].entries()) { this.p.push(v.x, v.y, v.z); this.n.push(n.x, n.y, n.z); this.uv.push(uv[k * 2], uv[k * 2 + 1]); this.c.push(...col); }
    const e1x = b.x - a.x, e1y = b.y - a.y, e1z = b.z - a.z, e2x = c.x - a.x, e2y = c.y - a.y, e2z = c.z - a.z;
    const dir = (e1y * e2z - e1z * e2y) * n.x + (e1z * e2x - e1x * e2z) * n.y + (e1x * e2y - e1y * e2x) * n.z;
    this.i.push(base, dir >= 0 ? base + 1 : base + 2, dir >= 0 ? base + 2 : base + 1);
  }
  // una caja alineada de min a max, con sus seis caras (o las que diga `caras`)
  caja(x0, y0, z0, x1, y1, z1, col, caras = 'xXyYzZ') {
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    if (caras.includes('X')) this.quad(V(x1, y0, z1), V(x1, y0, z0), V(x1, y1, z0), V(x1, y1, z1), V(1, 0, 0), undefined, col);
    if (caras.includes('x')) this.quad(V(x0, y0, z0), V(x0, y0, z1), V(x0, y1, z1), V(x0, y1, z0), V(-1, 0, 0), undefined, col);
    if (caras.includes('Y')) this.quad(V(x0, y1, z1), V(x1, y1, z1), V(x1, y1, z0), V(x0, y1, z0), V(0, 1, 0), undefined, col);
    if (caras.includes('y')) this.quad(V(x0, y0, z0), V(x1, y0, z0), V(x1, y0, z1), V(x0, y0, z1), V(0, -1, 0), undefined, col);
    if (caras.includes('Z')) this.quad(V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1), V(0, 0, 1), undefined, col);
    if (caras.includes('z')) this.quad(V(x1, y0, z0), V(x0, y0, z0), V(x0, y1, z0), V(x1, y1, z0), V(0, 0, -1), undefined, col);
  }
  geometria() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    return g;
  }
}

// PANELES de 3 m en relieve sobre una superficie: o = esquina, eu y ev = sus dos ejes (unitarios), lu y lv = sus largos,
// n = hacia donde mira. Debajo, la junta oscura; cada panel, 4 cm fuera con sus cuatro cantos, una de las cuatro caras del
// atlas y su tono
function paneles(L, o, eu, ev, lu, lv, n, r) {
  const JUNTA = 0.025, RELIEVE = 0.04;
  const nu = Math.max(1, Math.round(lu / 3)), nv = Math.max(1, Math.round(lv / 3));
  const tu = lu / nu, tv = lv / nv;
  const P = (u, v, h = 0) => o.clone().addScaledVector(eu, u).addScaledVector(ev, v).addScaledVector(n, h);
  const oscuro = [0.2, 0.21, 0.22];
  L.quad(P(0, 0), P(lu, 0), P(lu, lv), P(0, lv), n, [0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25], oscuro);
  for (let a = 0; a < nu; a++) for (let b = 0; b < nv; b++) {
    const u0 = a * tu + JUNTA, u1 = (a + 1) * tu - JUNTA, v0 = b * tv + JUNTA, v1 = (b + 1) * tv - JUNTA;
    const qu = r() < 0.5 ? 0 : 0.5, qv = r() < 0.5 ? 0 : 0.5;
    const su = Math.min(1, tu / 3), sv = Math.min(1, tv / 3);
    const uv = [qu + 0.004, qv + 0.004, qu + 0.004 + 0.492 * su, qv + 0.004, qu + 0.004 + 0.492 * su, qv + 0.004 + 0.492 * sv, qu + 0.004, qv + 0.004 + 0.492 * sv];
    const t = 0.84 + r() * 0.2, col = [t, t, t * 1.01];
    L.quad(P(u0, v0, RELIEVE), P(u1, v0, RELIEVE), P(u1, v1, RELIEVE), P(u0, v1, RELIEVE), n, uv, col);
    // los cantos (un poco mas oscuros)
    const cc = col.map((x) => x * 0.72), z = [0.1, 0.1, 0.12, 0.1, 0.12, 0.12, 0.1, 0.12];
    const nu1 = eu.clone(), nu0 = eu.clone().negate(), nv1 = ev.clone(), nv0 = ev.clone().negate();
    L.quad(P(u1, v0, 0), P(u1, v1, 0), P(u1, v1, RELIEVE), P(u1, v0, RELIEVE), nu1, z, cc);
    L.quad(P(u0, v1, 0), P(u0, v0, 0), P(u0, v0, RELIEVE), P(u0, v1, RELIEVE), nu0, z, cc);
    L.quad(P(u1, v1, 0), P(u0, v1, 0), P(u0, v1, RELIEVE), P(u1, v1, RELIEVE), nv1, z, cc);
    L.quad(P(u0, v0, 0), P(u1, v0, 0), P(u1, v0, RELIEVE), P(u0, v0, RELIEVE), nv0, z, cc);
  }
}

// la banda de aviso (amarillo y negro en diagonal) y el rotulo a plantilla
function texturaAviso() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#d8b13a'; g.fillRect(0, 0, 256, 32);
  g.fillStyle = '#17181a';
  for (let x = -32; x < 256; x += 32) { g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 16, 32); g.lineTo(x + 48, 0); g.lineTo(x + 32, 0); g.fill(); }
  // desgaste
  const r = azar(5);
  for (let k = 0; k < 400; k++) { g.fillStyle = `rgba(70,60,45,${r() * 0.35})`; g.fillRect(r() * 256, r() * 32, 1 + r() * 3, 1 + r() * 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function texturaRotulo(numero) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 1024, 128);
  g.fillStyle = 'rgba(222,214,182,0.92)';
  g.font = 'bold 84px Bahnschrift, "Arial Narrow", Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(`PUERTA ${numero}`, 512, 64);
  // los puentes de la plantilla y el desgaste: cortes verticales finos y poros
  g.globalCompositeOperation = 'destination-out';
  const r = azar(30 + numero);
  for (let x = 300; x < 740; x += 26 + r() * 30) g.fillRect(x, 20, 3, 88);
  for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(0,0,0,${0.3 + r() * 0.7})`; g.fillRect(r() * 1024, r() * 128, 1 + r() * 4, 1 + r() * 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function construirPuerta({ atlas, cuerda, grosor, luz, numero, semilla }) {
  const r = azar(semilla);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const X = V(1, 0, 0), Y = V(0, 1, 0), Z = V(0, 0, 1);
  const pan = new Lote(), acero = new Lote(), aviso = new Lote(), luces = new Lote(), rotulo = new Lote(), hormigon = new Lote();
  const zh = cuerda / 2 - PILAR;          // media luz del hueco
  const xs = MEDIO + SALE;                // cara de fuera de los pilares

  // ---- el techo del paso (mira abajo) y la jacena que vuela por las dos caras
  paneles(pan, V(-MEDIO, luz, zh), X, Z.clone().negate(), 2 * MEDIO, 2 * zh, Y.clone().negate(), r);
  const JY0 = luz - 1.1, JS = 0.6;        // la jacena: de 15,9 a 17 m, 0,6 m fuera de cada cara
  for (const s of [-1, 1]) {
    const xf = s * (MEDIO + JS);
    // frente de la jacena (paneles), su panza y su cabeza
    if (s > 0) paneles(pan, V(xf, JY0, zh + PILAR), Z.clone().negate(), Y, 2 * (zh + PILAR), luz - JY0, X, r);
    else paneles(pan, V(xf, JY0, -zh - PILAR), Z, Y, 2 * (zh + PILAR), luz - JY0, X.clone().negate(), r);
    const xa = Math.min(xf, s * MEDIO), xb = Math.max(xf, s * MEDIO);
    hormigon.caja(xa, JY0, -zh - PILAR, xb, luz, zh + PILAR, [0.62, 0.64, 0.66], s > 0 ? 'yYzZ' : 'yYzZ');
    // el goteron sobre la jacena
    hormigon.caja(Math.min(s * MEDIO, s * (MEDIO + JS + 0.12)), luz, -zh - PILAR - 0.1, Math.max(s * MEDIO, s * (MEDIO + JS + 0.12)), luz + 0.18, zh + PILAR + 0.1, [0.55, 0.57, 0.6]);
    // el rotulo, en la jacena por cada cara
    const xr = xf + s * 0.05;
    const a = V(xr, JY0 + 0.15, s * 5), b = V(xr, JY0 + 0.15, -s * 5), c = V(xr, luz - 0.15, -s * 5), d = V(xr, luz - 0.15, s * 5);
    rotulo.quad(a, b, c, d, X.clone().multiplyScalar(s));
  }

  // ---- los pilares: zocalo, fuste de paneles por sus tres caras vistas, capitel; con las guias del porton
  for (const sz of [-1, 1]) {
    const zi = sz * zh, ze = sz * (zh + PILAR);           // la cara que da al hueco y la de atras (dentro del muro)
    const z0 = Math.min(zi, ze), z1 = Math.max(zi, ze);
    // el cuerpo (detras de los paneles)
    hormigon.caja(-xs + 0.05, 0, z0, xs - 0.05, luz, z1, [0.5, 0.52, 0.55], 'xXZz');
    // paneles: la cara al hueco y las dos de fuera
    paneles(pan, V(-xs, 1.2, zi), X, Y, 2 * xs, luz - 1.2 - 1.1, Z.clone().multiplyScalar(-sz), r);
    for (const sx of [-1, 1]) {
      const xf = sx * xs;
      paneles(pan, V(xf, 1.2, sx > 0 ? z1 : z0), Z.clone().multiplyScalar(sx > 0 ? -1 : 1), Y, PILAR, luz - 1.2 - 1.1, X.clone().multiplyScalar(sx), r);
    }
    // zocalo (1,2 m, mas ancho) y capitel bajo la jacena
    hormigon.caja(-xs - 0.15, 0, Math.min(zi - sz * 0.15, ze), xs + 0.15, 1.2, Math.max(zi - sz * 0.15, ze), [0.42, 0.44, 0.46]);
    hormigon.caja(-xs - 0.25, JY0 - 0.45, Math.min(zi - sz * 0.25, ze), xs + 0.25, JY0, Math.max(zi - sz * 0.25, ze), [0.58, 0.6, 0.62]);
    // la guia del porton: perfil en U de acero a todo lo alto, en medio del muro
    const zg = zi - sz * 0.35;
    acero.caja(-0.4, 0.2, Math.min(zi, zg), -0.3, luz, Math.max(zi, zg), [0.34, 0.36, 0.35]);
    acero.caja(0.3, 0.2, Math.min(zi, zg), 0.4, luz, Math.max(zi, zg), [0.34, 0.36, 0.35]);
    acero.caja(-0.4, 0.2, Math.min(zi, zi - sz * 0.06), 0.4, luz, Math.max(zi, zi - sz * 0.06), [0.3, 0.32, 0.31]);
    // los pernos de la guia, cada 1,5 m
    for (let y = 1; y < luz; y += 1.5) for (const x of [-0.42, 0.42]) acero.caja(x - 0.03, y, Math.min(zg, zg + sz * 0.08) - 0.04, x + 0.03, y + 0.08, Math.max(zg, zg + sz * 0.08) + 0.04, [0.45, 0.4, 0.33]);
    // los focos, en lo alto de cada pilar por las dos caras (carcasa, visera y cristal encendido)
    for (const sx of [-1, 1]) {
      const xf = sx * (xs + 0.02), zc = sz * (zh + PILAR / 2), yc = JY0 - 1.2;
      acero.caja(Math.min(xf, xf + sx * 0.45), yc - 0.25, zc - 0.32, Math.max(xf, xf + sx * 0.45), yc + 0.25, zc + 0.32, [0.2, 0.21, 0.22]);
      acero.caja(Math.min(xf, xf + sx * 0.62), yc + 0.25, zc - 0.38, Math.max(xf, xf + sx * 0.62), yc + 0.31, zc + 0.38, [0.24, 0.25, 0.26]);
      const xl = xf + sx * 0.46;
      luces.quad(V(xl, yc - 0.18, zc - sx * 0.26), V(xl, yc - 0.18, zc + sx * 0.26), V(xl, yc + 0.18, zc + sx * 0.26), V(xl, yc + 0.18, zc - sx * 0.26), X.clone().multiplyScalar(sx));
    }
  }

  // ---- el porton levadizo: chapa nervada en medio del muro, subida (asoma 3,6 m), con su banda de aviso abajo
  const PB = luz - 3.6;
  acero.caja(-0.1, PB + 0.35, -zh + 0.05, 0.1, luz, zh - 0.05, [0.33, 0.36, 0.33]);
  for (let z = -zh + 0.35; z < zh - 0.3; z += 0.6) {
    const t = 0.9 + r() * 0.15, oxido = r() < 0.12;
    const col = oxido ? [0.42 * t, 0.3 * t, 0.22 * t] : [0.36 * t, 0.39 * t, 0.36 * t];
    for (const sx of [-1, 1]) acero.caja(Math.min(sx * 0.1, sx * 0.19), PB + 0.35, z - 0.07, Math.max(sx * 0.1, sx * 0.19), luz, z + 0.07, col, sx > 0 ? 'XzZ' : 'xzZ');
  }
  // la barra de abajo con la banda de aviso (un tramo de textura cada 2 m)
  const bz = 2 * zh - 0.1, rep = bz / 2;
  for (const sx of [-1, 1]) {
    const xb = sx * 0.2;
    const a = V(xb, PB, -sx * (zh - 0.05)), b = V(xb, PB, sx * (zh - 0.05)), c = V(xb, PB + 0.35, sx * (zh - 0.05)), d = V(xb, PB + 0.35, -sx * (zh - 0.05));
    aviso.quad(a, b, c, d, X.clone().multiplyScalar(sx), [0, 0, rep, 0, rep, 1, 0, 1]);
  }
  acero.caja(-0.2, PB - 0.04, -zh + 0.05, 0.2, PB, zh - 0.05, [0.12, 0.12, 0.12], 'y');   // la goma de abajo

  // ---- el umbral: losa de hormigon a lo ancho, con la canaleta del porton (rejilla) en medio
  hormigon.caja(-xs - 1.5, -0.3, -zh, xs + 1.5, 0.06, zh, [0.48, 0.49, 0.5], 'xXYzZ');
  for (let z = -zh; z < zh; z += 0.25) acero.caja(-0.25, 0.06, z, 0.25, 0.08, z + 0.12, [0.16, 0.17, 0.18], 'Y');

  // ---- mallas
  const g = new THREE.Group();
  g.name = 'puerta' + numero;
  const toon = (o) => new THREE.MeshToonMaterial({ gradientMap: TONO, vertexColors: true, ...o });
  const mallas = [
    [pan, toon({ map: atlas || null })],
    [hormigon, toon({ color: 0x8a9198 })],
    [acero, toon({})],
    [aviso, toon({ map: texturaAviso() })],
    [luces, new THREE.MeshBasicMaterial({ color: 0xffd8a8 })],
    [rotulo, new THREE.MeshToonMaterial({ gradientMap: TONO, map: texturaRotulo(numero), transparent: true, alphaTest: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })],
  ];
  for (const [L, mat] of mallas) {
    if (!L.i.length) continue;
    const m = new THREE.Mesh(L.geometria(), mat);
    m.castShadow = m.receiveShadow = mat.isMeshToonMaterial && !mat.transparent;
    g.add(m);
  }
  return g;
}
