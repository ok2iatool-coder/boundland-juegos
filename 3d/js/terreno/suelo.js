// EL SUELO del mapa de terreno: la rejilla de relieve.js en trozos de 40 m (asi la camara y la sombra solo dibujan los
// de cerca) con el COLOR por cara: pradera (verde en lo bajo, pajiza en lo alto y en la meseta), tierra en las cuestas,
// roca con estratos en el escarpe y las paredes de los cerros, grava en la rambla, barro claro cuarteado en la laguna
// seca; mas oscuro en las vaguadas y al pie de las rocas, mas claro en los lomos. Fuera, las afueras en grueso.
import * as THREE from 'three';
import { H, DIAG, N, PASO, EXT, forma, normalY, curvatura, fbm, suave, hash, radioBorde, pinturaEn, MATERIALES } from './relieve.js';
import { cubierta, calva, distRoca } from './sitios.js';

export const COLOR = {
  oscuro: new THREE.Color(0x51653a), claro: new THREE.Color(0x87995a), seco: new THREE.Color(0xa9a265), paja: new THREE.Color(0xb8aa6c),
  jugoso: new THREE.Color(0x48663a), tierra: new THREE.Color(0x7d6b53), tierraClara: new THREE.Color(0x978569), tierraRoja: new THREE.Color(0x8c6a52),
  roca: new THREE.Color(0x968f80), rocaOscura: new THREE.Color(0x6d675c), rocaClara: new THREE.Color(0xb7af9b), rocaOcre: new THREE.Color(0xa68b66),
  grava: new THREE.Color(0xa59c88), gravaOscura: new THREE.Color(0x857d6c), barro: new THREE.Color(0xc9b998), grieta: new THREE.Color(0x9a8a6c),
  flores: [new THREE.Color(0xf1ede0), new THREE.Color(0xe7c84e), new THREE.Color(0x9c88c4), new THREE.Color(0xd9a6b6)],
};
const _t = new THREE.Color(), _m = {}, _c = { mata: 0 };

// el verde de la hierba en (x, z) (tambien lo usa la hierba)
export function colorHierba(x, z, out, c = cubierta(x, z)) {
  out.copy(COLOR.oscuro).lerp(COLOR.claro, suave(0.3, 0.7, fbm(x / 38 + 11, z / 38 - 4, 3)));
  out.lerp(COLOR.seco, 0.8 * c.seco);
  out.lerp(COLOR.paja, 0.35 * c.seco * suave(0.5, 0.7, fbm(x / 11 - 3, z / 11 + 6, 2)));
  if (c.flor > 0.1) out.lerp(COLOR.flores[c.florTipo], 0.04 * c.flor);
  return out;
}
// la roca: estratos horizontales (vetas claras, ocres y oscuras), como un corte de tierra
function colorRoca(x, y, z, out) {
  const v = 0.5 + 0.5 * Math.sin(y * 2.6 + 2.5 * fbm(x / 16, z / 16, 2));
  out.copy(COLOR.rocaOscura).lerp(COLOR.roca, 0.4 + 0.45 * v).lerp(COLOR.rocaClara, 0.3 * suave(0.78, 1, v));
  out.lerp(COLOR.rocaOcre, 0.35 * suave(0.55, 0.75, fbm(x / 7 + 3, y / 1.4, 2)));
  return out;
}
// el color de una cara: su centro y lo vertical de su normal
export function colorCara(x, y, z, ny, out) {
  const m = _m;
  forma(x, z, m);
  const c = cubierta(x, z, _c, m);
  colorHierba(x, z, out, c);
  // la llanura baja, mas jugosa
  out.lerp(COLOR.jugoso, 0.45 * m.baja * (1 - c.seco));
  // tierra: cuestas, calvas, taludes, orillas de la rambla
  const tierra = Math.max(suave(0.92, 0.78, ny), 0.42 * calva(x, z) * (1 - m.baja), 0.85 * m.taludBancal, 0.7 * m.orillaRambla, 0.5 * m.derrubio, 0.55 * m.meseta * suave(0.62, 0.72, fbm(x / 9 + 12, z / 9 - 5, 2)));
  if (tierra > 0) {
    _t.copy(COLOR.tierra).lerp(COLOR.tierraClara, fbm(x / 4 + 9, z / 4, 2)).lerp(COLOR.tierraRoja, 0.2 * m.taludBancal * suave(0.4, 0.6, fbm(x / 20, y / 2, 2)));
    out.lerp(_t, tierra);
  }
  // roca: paredes (escarpe, cerros, el barranco de la rambla) y cuestas muy fuertes
  const roca = Math.max(suave(0.72, 0.45, ny), m.escarpe * suave(0.9, 0.6, ny), m.paredCerro * suave(0.92, 0.6, ny));
  if (roca > 0) out.lerp(colorRoca(x, y, z, _t), roca);
  // el lecho de la rambla: grava con cantos
  if (m.rambla > 0) { _t.copy(COLOR.grava).lerp(COLOR.gravaOscura, hash(Math.round(x * 3), Math.round(z * 3), 9)); out.lerp(_t, m.rambla); }
  // la laguna seca: barro claro con grietas en poligonos
  if (m.laguna > 0) {
    const g = Math.abs(Math.sin(x * 0.9 + 3 * fbm(x / 6, z / 6, 2)) * Math.sin(z * 0.9 - 3 * fbm(z / 6 + 4, x / 6, 2)));
    _t.copy(COLOR.barro).lerp(COLOR.grieta, suave(0.12, 0.02, g) * 0.8);
    out.lerp(_t, m.laguna);
  }
  // lo pintado a mano en el editor: su color con un poco de veta (y la roca, con sus estratos)
  const p = pinturaEn(x, z);
  if (p) {
    const M = MATERIALES[p];
    if (M.mata) colorHierba(x, z, out, c).lerp(_t.setHex(M.color), 0.55);
    else if (p === 6) colorRoca(x, y, z, out);
    else out.setHex(M.color).lerp(_t.copy(COLOR.gravaOscura), 0.25 * hash(Math.round(x * 3), Math.round(z * 3), 9));
    if (p === 8 && m.laguna < 0.5) {
      const g = Math.abs(Math.sin(x * 0.9 + 3 * fbm(x / 6, z / 6, 2)) * Math.sin(z * 0.9 - 3 * fbm(z / 6 + 4, x / 6, 2)));
      out.lerp(COLOR.grieta, suave(0.12, 0.02, g) * 0.8);
    }
  }
  // oclusion: vaguadas y pies de talud mas oscuros, lomos y cantos mas claros, y el pie de las rocas
  const cu = curvatura(x, z);
  let k = 1 - Math.min(0.22, Math.max(0, cu) * 1.2) + Math.min(0.08, Math.max(0, -cu) * 0.6);
  k *= 1 - 0.22 * suave(0.9, 0, distRoca(x, z));
  return out.multiplyScalar(k * (0.95 + 0.1 * hash(Math.round(x * 5), Math.round(z * 5), 5)));
}

const CH = 40;                                  // m por trozo
export function crearSuelo(grupo, tono) {
  const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: tono, flatShading: true });
  const porLado = Math.round((2 * EXT) / CH), celdas = Math.round(CH / PASO), f = N + 1;
  const c = new THREE.Color();
  const trozos = [];
  let tris = 0;
  const P = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const v = (q, i, j) => { q[0] = -EXT + i * PASO; q[1] = H[j * f + i]; q[2] = -EXT + j * PASO; return q; };
  // un triangulo en (pos, col) desde el vertice k: cara hacia arriba (normal +y) se mire como se mire el orden
  function tri(pos, col, k, a, b, d, conColor) {
    const ux = b[0] - a[0], uz = b[2] - a[2], wx = d[0] - a[0], wz = d[2] - a[2];
    if (uz * wx - ux * wz < 0) [b, d] = [d, b];
    pos.set(a, k * 3); pos.set(b, k * 3 + 3); pos.set(d, k * 3 + 6);
    if (!conColor) return;
    const cx = (a[0] + b[0] + d[0]) / 3, cy = (a[1] + b[1] + d[1]) / 3, cz = (a[2] + b[2] + d[2]) / 3;
    // lo vertical de la normal de ESTA cara
    const e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2], e2x = d[0] - a[0], e2y = d[1] - a[1], e2z = d[2] - a[2];
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    colorCara(cx, cy, cz, Math.abs(ny) / (Math.hypot(nx, ny, nz) || 1), c);
    for (let q = 0; q < 3; q++) { col[k * 3 + q * 3] = c.r; col[k * 3 + q * 3 + 1] = c.g; col[k * 3 + q * 3 + 2] = c.b; }
  }
  // la celda (i, j) de la rejilla: sus dos triangulos, en el sitio que le toca dentro de su trozo
  function celda(i, j, conColor = true) {
    const ti = Math.floor(i / celdas), tj = Math.floor(j / celdas), t = trozos[tj * porLado + ti];
    const pos = t.geometry.attributes.position.array, col = t.geometry.attributes.color.array;
    const k = ((j - tj * celdas) * celdas + (i - ti * celdas)) * 6;
    v(P[0], i, j); v(P[1], i + 1, j); v(P[2], i, j + 1); v(P[3], i + 1, j + 1);
    if (DIAG[j * N + i] === 0) { tri(pos, col, k, P[0], P[1], P[3], conColor); tri(pos, col, k + 3, P[0], P[3], P[2], conColor); }
    else { tri(pos, col, k, P[0], P[1], P[2], conColor); tri(pos, col, k + 3, P[1], P[3], P[2], conColor); }
  }
  for (let tj = 0; tj < porLado; tj++) {
    for (let ti = 0; ti < porLado; ti++) {
      const n = celdas * celdas * 6;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const m = new THREE.Mesh(g, mat);
      m.receiveShadow = true;
      // el suelo NO echa sombra: con el sol bajo, sus facetas casi llanas se sombreaban a si mismas en manchas de
      // triangulos (y cortaban en recto donde acaba el mapa de sombras). La sombra del escarpe y los cerros la echan
      // sus paredes (paredes.js) y las rocas
      m.castShadow = false;
      m.name = 'suelo';
      grupo.add(m);
      trozos.push(m);
      tris += n / 3;
    }
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) celda(i, j);
  for (const m of trozos) {
    // normales de cara: el sombreado va por derivadas (flatShading), pero la sombra con normalBias las lee y sin
    // ellas el suelo salia NEGRO entero
    m.geometry.computeVertexNormals();
    m.geometry.computeBoundingSphere();
  }
  // EL EDITOR: rehacer las celdas de un recuadro (i0..i1, j0..j1). La forma va al momento; el color, que es lo caro
  // (forma, cubierta, pendiente...), en `colorPendiente` y se pinta poco a poco con `pintarPendiente(ms)`
  const pendiente = new Set(), sucios = new Set();
  function rehacer(i0, j0, i1, j1, conColor = true) {
    i0 = Math.max(0, i0); j0 = Math.max(0, j0); i1 = Math.min(N - 1, i1); j1 = Math.min(N - 1, j1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      celda(i, j, false);
      if (conColor) pendiente.add(j * N + i);
      sucios.add(Math.floor(j / celdas) * porLado + Math.floor(i / celdas));
    }
    cerrar(false);
  }
  function pintarPendiente(ms = 6) {
    const t0 = performance.now();
    let n = 0;
    for (const k of pendiente) {
      pendiente.delete(k);
      const i = k % N, j = (k - i) / N;
      celda(i, j, true);
      sucios.add(Math.floor(j / celdas) * porLado + Math.floor(i / celdas));
      if ((++n & 31) === 0 && performance.now() - t0 > ms) break;
    }
    cerrar(true);
    return pendiente.size;
  }
  function cerrar(color) {
    for (const k of sucios) {
      const g = trozos[k].geometry;
      g.attributes.position.needsUpdate = true;
      if (color) g.attributes.color.needsUpdate = true;
      g.computeVertexNormals();
      g.computeBoundingSphere();
    }
    sucios.clear();
  }

  // ---------------- las afueras: anillo grueso hasta 1100 m (colinas en la bruma), sin sombras ----------------
  {
    const R0 = EXT, R1 = 1100, P = 10, pos = [], col = [];
    const h = (x, z) => {
      if (Math.abs(x) <= EXT && Math.abs(z) <= EXT) return forma(x, z);
      const e = radioBorde(x, z);
      return forma(Math.max(-EXT, Math.min(EXT, x)), Math.max(-EXT, Math.min(EXT, z))) + 60 * suave(EXT, 900, e) * (0.4 + fbm(x / 160 + 4, z / 160 - 8, 3));
    };
    const n = Math.round((2 * R1) / P);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x0 = -R1 + i * P, z0 = -R1 + j * P;
        // solo lo que cae fuera del terreno fino (con un metro de solape bajo el borde)
        if (x0 >= -R0 && x0 + P <= R0 && z0 >= -R0 && z0 + P <= R0) continue;
        const a = [x0, h(x0, z0) - 0.3, z0], b = [x0 + P, h(x0 + P, z0) - 0.3, z0], cc = [x0, h(x0, z0 + P) - 0.3, z0 + P], d = [x0 + P, h(x0 + P, z0 + P) - 0.3, z0 + P];
        for (const [p, q, r] of [[a, d, b], [a, cc, d]]) {
          const cx = (p[0] + q[0] + r[0]) / 3, cz = (p[2] + q[2] + r[2]) / 3, cy = (p[1] + q[1] + r[1]) / 3;
          c.copy(COLOR.oscuro).lerp(COLOR.seco, suave(0.4, 0.7, fbm(cx / 120, cz / 120, 2))).lerp(COLOR.tierra, 0.25 * suave(20, 70, cy));
          c.multiplyScalar(0.92 + 0.12 * hash(i, j, 3));
          for (const pt of [p, q, r]) { pos.push(...pt); col.push(c.r, c.g, c.b); }
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = false;
    m.name = 'afueras';
    grupo.add(m);
  }
  return { trozos, rehacer, pintarPendiente, get pendiente() { return pendiente.size; }, info: () => ({ triangulosSuelo: tris, trozosSuelo: trozos.length }) };
}
