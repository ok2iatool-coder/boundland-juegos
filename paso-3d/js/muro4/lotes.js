// Geometria por LOTES (una malla por material, como mundo3d.js) con color por vertice: cada pieza puede llevar su tono
// (un bidon de otro color, un bloque de otra amasada) sin otro material. Las mismas ayudas que presta mundo3d.js a
// casetas.js (cajaE, barra, cilindro, senal), asi la caseta del puesto sale del mismo constructor que las garitas.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BLANCO = new THREE.Color(1, 1, 1);
const Y = new THREE.Vector3(0, 1, 0), UNO = new THREE.Vector3(1, 1, 1);

export function crearLotes() {
  const lotes = {};
  const m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // mete una geometria YA en el mundo en el lote k, con su color (lineal) si se da
  function meter(k, g, color) {
    if (g.index) g = g.toNonIndexed();
    for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(n)) g.deleteAttribute(n);
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    if (!g.attributes.color || color) {
      const c = color ? (color.isColor ? color : new THREE.Color(color)) : BLANCO, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    }
    g.clearGroups();
    (lotes[k] ||= []).push(g);
    return g;
  }
  function uvCaja(g, w, h, d, tile) {
    const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / tile, uv.getY(k) * dims[f][1] / tile); }
  }
  // caja centrada en c de w x h x d (o.q: giro; o.tinta: grueso de la linea; o.tile: UV en metros / tile; o.color)
  function caja(k, cx, cy, cz, w, h, d, o = {}) {
    m4.compose(V(cx, cy, cz), o.q || q0.identity(), UNO);
    const g = new THREE.BoxGeometry(w, h, d);
    if (o.tile) uvCaja(g, w, h, d, o.tile);
    meter(k, g.applyMatrix4(m4), o.color);
    const t = o.tinta ?? 0.012;
    if (t) meter('tinta', new THREE.BoxGeometry(w + 2 * t, h + 2 * t, d + 2 * t).applyMatrix4(m4));
  }
  const cajaE = (k, x0, x1, y0, y1, z0, z1, o) => caja(k, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, o);
  function barra(k, a, b, g, o = {}) {
    const d = new THREE.Vector3().subVectors(b, a), L = d.length();
    caja(k, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, g, L, g, { ...o, q: new THREE.Quaternion().setFromUnitVectors(Y, d.normalize()) });
  }
  function cilindro(k, a, b, r, n = 10, tinta = 0.01, color, r2) {
    const d = new THREE.Vector3().subVectors(b, a), L = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(Y, d.clone().normalize());
    m4.compose(a.clone().add(b).multiplyScalar(0.5), q, UNO);
    meter(k, new THREE.CylinderGeometry(r2 ?? r, r, L, n, 1, false).applyMatrix4(m4), color);
    if (tinta) meter('tinta', new THREE.CylinderGeometry((r2 ?? r) + tinta, r + tinta, L + tinta, n, 1, false).applyMatrix4(m4));
  }
  // una senal de la tira (ocho casillas): placa de w x h centrada en c mirando a n
  function senal(cas, c, n, w, h) {
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, (cas + 0.03 + 0.94 * uv.getX(i)) / 8);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n.clone().normalize()));
    g.translate(c.x, c.y, c.z);
    meter('senal', g);
  }
  // la linea de tinta de una geometria cualquiera: el casco hacia fuera por las normales suavizadas
  function tinta(g, e = 0.01) {
    if (g.index) g = g.toNonIndexed();                // (la soldadura de abajo lee los triangulos de tres en tres)
    const p = new THREE.BufferGeometry();
    p.setAttribute('position', g.attributes.position.clone());
    const m = mergeVerticesPos(p);
    m.computeVertexNormals();
    const pos = m.attributes.position, nor = m.attributes.normal;
    for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) + nor.getX(i) * e, pos.getY(i) + nor.getY(i) * e, pos.getZ(i) + nor.getZ(i) * e);
    meter('tinta', m);
  }
  // pinta los lotes: una malla por material
  function construir(scene, M, sinSombra = []) {
    const mallas = {};
    for (const [k, gs] of Object.entries(lotes)) {
      if (!M[k]) { console.warn('sin material', k); continue; }
      const m = new THREE.Mesh(mergeGeometries(gs), M[k]);
      m.castShadow = !sinSombra.includes(k) && k !== 'tinta';
      m.receiveShadow = k !== 'tinta';
      m.name = 'lote_' + k;
      mallas[k] = m;
      scene.add(m);
    }
    return mallas;
  }
  return { meter, caja, cajaE, barra, cilindro, senal, tinta, construir, lotes, V };
}

// soldar los vertices que coinciden (solo la posicion): para que las normales del casco de tinta sean continuas
function mergeVerticesPos(g, tol = 1e-4) {
  const p = g.attributes.position, mapa = new Map(), nuevos = [], indice = [];
  const f = 1 / tol;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const clave = `${Math.round(x * f)}_${Math.round(y * f)}_${Math.round(z * f)}`;
    let j = mapa.get(clave);
    if (j === undefined) { j = nuevos.length / 3; mapa.set(clave, j); nuevos.push(x, y, z); }
    indice.push(j);
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.Float32BufferAttribute(nuevos, 3));
  m.setIndex(indice);
  return m;
}
