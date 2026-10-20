// EL SUELO del mapa del mundo: la rejilla de relieve.js (8 m) en trozos de 200 m con el COLOR por cara, como el del
// terreno: pradera (mas jugosa en el Linde y en lo bajo, pajiza al subir y en los Cerros), tierra en las cuestas, roca
// con estratos en los cortados, grava en las orillas, el fondo del agua y NIEVE por encima de la cota de nieve (no en
// las paredes: alli no agarra). Fuera del mundo, lomas en grueso que cierran la vista.
import * as THREE from 'three';
import { H, DIAG, N, PASO, EXT, forma, curvatura, fbm, suave, hash, radioBorde, pinturaEn, MATERIALES, COTA_NIEVE, distAgua, norte } from './relieve.js';
import { cubierta, calva, distRoca } from './sitios.js';

export const COLOR = {
  oscuro: new THREE.Color(0x51653a), claro: new THREE.Color(0x87995a), seco: new THREE.Color(0xa9a265), paja: new THREE.Color(0xb8aa6c),
  jugoso: new THREE.Color(0x48663a), tierra: new THREE.Color(0x7d6b53), tierraClara: new THREE.Color(0x978569), tierraRoja: new THREE.Color(0x8c6a52),
  roca: new THREE.Color(0x968f80), rocaOscura: new THREE.Color(0x6d675c), rocaClara: new THREE.Color(0xb7af9b), rocaOcre: new THREE.Color(0xa68b66),
  grava: new THREE.Color(0xa59c88), gravaOscura: new THREE.Color(0x857d6c), barro: new THREE.Color(0xc9b998), grieta: new THREE.Color(0x9a8a6c),
  fondo: new THREE.Color(0x5f6a58), nieve: new THREE.Color(0xeef2f3), nieveSombra: new THREE.Color(0xc9d3d9),
  norte: new THREE.Color(0x848b80), norteFrio: new THREE.Color(0x7a8790), escoria: new THREE.Color(0x6e6a63),     // v8
  flores: [new THREE.Color(0xf1ede0), new THREE.Color(0xe7c84e), new THREE.Color(0x9c88c4), new THREE.Color(0xd9a6b6)],
};
const _t = new THREE.Color(), _n = new THREE.Color(), _m = {}, _c = { mata: 0 };

// el verde de la hierba en (x, z) (tambien lo usa la hierba)
export function colorHierba(x, z, out, c = cubierta(x, z)) {
  out.copy(COLOR.oscuro).lerp(COLOR.claro, suave(0.3, 0.7, fbm(x / 60 + 11, z / 60 - 4, 3)));
  out.lerp(COLOR.seco, 0.8 * c.seco);
  out.lerp(COLOR.paja, 0.35 * c.seco * suave(0.5, 0.7, fbm(x / 11 - 3, z / 11 + 6, 2)));
  if (c.flor > 0.1) out.lerp(COLOR.flores[c.florTipo], 0.04 * c.flor);
  // v8: el norte, frio: el verde se apaga hacia el gris oliva y, a manchas, hacia el gris azulado
  const n = norte(x, z);
  if (n > 0) out.lerp(_n.copy(COLOR.norte).lerp(COLOR.norteFrio, suave(0.4, 0.65, fbm(x / 80 + 21, z / 80 - 3, 3))), 0.68 * n);
  return out;
}
// la roca: estratos horizontales (vetas claras, ocres y oscuras)
function colorRoca(x, y, z, out) {
  const v = 0.5 + 0.5 * Math.sin(y * 0.9 + 2.5 * fbm(x / 40, z / 40, 2));
  out.copy(COLOR.rocaOscura).lerp(COLOR.roca, 0.4 + 0.45 * v).lerp(COLOR.rocaClara, 0.3 * suave(0.78, 1, v));
  out.lerp(COLOR.rocaOcre, 0.3 * suave(0.55, 0.75, fbm(x / 18 + 3, y / 5, 2)));
  return out;
}
// el color de una cara: su centro y lo vertical de su normal
export function colorCara(x, y, z, ny, out) {
  const m = _m;
  forma(x, z, m);
  const zn = m.zona;
  const c = cubierta(x, z, _c, m);
  colorHierba(x, z, out, c);
  if (zn === 3) out.lerp(COLOR.jugoso, 0.45);                                 // el Linde
  // tierra: cuestas y calvas; en los Cerros y lo alto, mas
  const nn = norte(x, z);
  const tierra = Math.max(suave(0.92, 0.76, ny), 0.4 * calva(x, z), 0.3 * suave(450, 620, y), zn === 15 ? 0.25 : 0,
    0.45 * nn * suave(0.55, 0.7, fbm(x / 26 - 4, z / 26 + 13, 3)));                      // v8: en el norte, calvas grandes
  if (tierra > 0) {
    _t.copy(COLOR.tierra).lerp(COLOR.tierraClara, fbm(x / 6 + 9, z / 6, 2)).lerp(COLOR.tierraRoja, 0.2 * suave(0.4, 0.6, fbm(x / 30, y / 4, 2)));
    if (nn > 0) _t.lerp(COLOR.escoria, 0.6 * nn);                                         // tierra con ceniza y escoria
    out.lerp(_t, tierra);
  }
  // roca: las paredes (el farallon, el Cortado, las cumbres) y lo muy empinado
  const roca = Math.max(suave(0.74, 0.5, ny), (zn === 6 || zn === 16) ? suave(0.95, 0.7, ny) : 0);
  if (roca > 0) out.lerp(colorRoca(x, y, z, _t), roca);
  // las orillas: grava; y bajo el agua, el fondo
  const da = distAgua(x, z);
  if (da < 12) { _t.copy(COLOR.grava).lerp(COLOR.gravaOscura, hash(Math.round(x), Math.round(z), 9)); out.lerp(_t, 0.85 * suave(12, 3, da)); }
  if (m.agua > -9000 && y < m.agua + 0.2) out.lerp(COLOR.fondo, 0.7);
  // la nieve: por encima de su cota, salvo en las paredes (en lo empinado no agarra)
  const cn = COTA_NIEVE - 160 * nn;                                                      // v8: en el norte nieva mas abajo
  const nieve = suave(cn - 25, cn + 30, y + 30 * (fbm(x / 70, z / 70, 2) - 0.5)) * suave(0.55, 0.78, ny);
  if (nieve > 0) out.lerp(_t.copy(COLOR.nieve).lerp(COLOR.nieveSombra, 0.35 * suave(0.85, 0.6, ny)), nieve);
  // lo pintado a mano en el editor
  const p = pinturaEn(x, z);
  if (p) {
    const M = MATERIALES[p];
    if (M.mata) colorHierba(x, z, out, c).lerp(_t.setHex(M.color), 0.55);
    else if (p === 6) colorRoca(x, y, z, out);
    else out.setHex(M.color).lerp(_t.copy(COLOR.gravaOscura), (p === 9 ? 0.06 : 0.25) * hash(Math.round(x), Math.round(z), 9));
  }
  // oclusion: vaguadas mas oscuras, lomos mas claros, y el pie de las rocas
  const cu = curvatura(x, z) / 4;
  let k = 1 - Math.min(0.2, Math.max(0, cu) * 1.2) + Math.min(0.08, Math.max(0, -cu) * 0.6);
  k *= 1 - 0.22 * suave(0.9, 0, distRoca(x, z));
  return out.multiplyScalar(k * (0.95 + 0.1 * hash(Math.round(x / 2), Math.round(z / 2), 5)));
}

// ---------------- el suelo POR TROZOS (v5, 15 km) ----------------
// CERCA: trozos de 200 m (25 celdas de 8 m) con el color por cara, los que caen a menos de CERCA m del foco (el 18 o la
// camara del editor); se hacen unos pocos por fotograma (los mas cercanos primero) y se tiran al alejarse.
// LEJOS: UNA malla del mundo entero cada 40 m, metro y medio por debajo, que no se dibuja dentro del circulo que ya
// cubren los trozos de cerca (un `discard` en su sombreador). Asi se ve el mundo entero sin pintar 7 millones de caras.
const CEL = 25, CH = CEL * PASO;               // 200 m por trozo
const CERCA = 1100, TIRAR = 1450;              // m del foco al trozo
const LP = 5, LN = N / LP;                     // la malla de lejos: un vertice cada 5 (40 m)
export function crearSuelo(grupo, tono) {
  const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: tono, flatShading: true });
  const porLado = N / CEL, f = N + 1;
  const c = new THREE.Color();
  const trozos = new Map();                      // clave tj * porLado + ti -> malla
  let tris = 0;
  const P = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const v = (q, i, j) => { q[0] = -EXT + i * PASO; q[1] = H[j * f + i]; q[2] = -EXT + j * PASO; return q; };
  // el color se toma a la cota MEDIA de la celda (y, en las paredes, en su centro): con la de cada triangulo, en una
  // pared de 8 m de lado los dos triangulos de cada celda caian en estratos distintos y el Cortado salia en dientes
  const centro = [0, 0, 0];
  function tri(pos, col, k, a, b, d, conColor) {
    const ux = b[0] - a[0], uz = b[2] - a[2], wx = d[0] - a[0], wz = d[2] - a[2];
    if (uz * wx - ux * wz < 0) [b, d] = [d, b];
    pos.set(a, k * 3); pos.set(b, k * 3 + 3); pos.set(d, k * 3 + 6);
    if (!conColor) return;
    const e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2], e2x = d[0] - a[0], e2y = d[1] - a[1], e2z = d[2] - a[2];
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    const nyN = Math.abs(ny) / (Math.hypot(nx, ny, nz) || 1), pared = nyN < 0.6;
    const cx = pared ? centro[0] : (a[0] + b[0] + d[0]) / 3, cz = pared ? centro[2] : (a[2] + b[2] + d[2]) / 3;
    colorCara(cx, centro[1], cz, nyN, c);
    for (let q = 0; q < 3; q++) { col[k * 3 + q * 3] = c.r; col[k * 3 + q * 3 + 1] = c.g; col[k * 3 + q * 3 + 2] = c.b; }
  }
  // la celda (i, j) en su trozo (si el trozo esta hecho)
  function celda(i, j, conColor = true, t = trozos.get(Math.floor(j / CEL) * porLado + Math.floor(i / CEL))) {
    if (!t) return false;
    const ti = Math.floor(i / CEL), tj = Math.floor(j / CEL);
    const pos = t.geometry.attributes.position.array, col = t.geometry.attributes.color.array;
    const k = ((j - tj * CEL) * CEL + (i - ti * CEL)) * 6;
    v(P[0], i, j); v(P[1], i + 1, j); v(P[2], i, j + 1); v(P[3], i + 1, j + 1);
    centro[0] = P[0][0] + PASO / 2; centro[2] = P[0][2] + PASO / 2;
    centro[1] = (P[0][1] + P[1][1] + P[2][1] + P[3][1]) / 4;
    if (DIAG[j * N + i] === 0) { tri(pos, col, k, P[0], P[1], P[3], conColor); tri(pos, col, k + 3, P[0], P[3], P[2], conColor); }
    else { tri(pos, col, k, P[0], P[1], P[2], conColor); tri(pos, col, k + 3, P[1], P[3], P[2], conColor); }
    return true;
  }
  function hacer(ti, tj) {
    const n = CEL * CEL * 6;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    m.castShadow = false;                       // (como en el terreno: con el sol bajo se sombreaba a si mismo en manchas)
    m.name = 'suelo';
    for (let j = tj * CEL; j < (tj + 1) * CEL; j++) for (let i = ti * CEL; i < (ti + 1) * CEL; i++) celda(i, j, true, m);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    grupo.add(m);
    trozos.set(tj * porLado + ti, m);
    tris += n / 3;
  }
  function tirar(k) {
    const m = trozos.get(k);
    grupo.remove(m);
    m.geometry.dispose();
    trozos.delete(k);
    tris -= CEL * CEL * 2;
  }
  // distancia del foco al trozo (a su punto mas cercano)
  const dist = (ti, tj, x, z) => {
    const x0 = -EXT + ti * CH, z0 = -EXT + tj * CH;
    return Math.hypot(Math.max(x0 - x, 0, x - x0 - CH), Math.max(z0 - z, 0, z - z0 - CH));
  };

  // ---------------- la malla de lejos ----------------
  const lejos = (() => {
    const n = LN + 1, pos = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3), idx = [];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    for (let J = 0; J < LN; J++) for (let I = 0; I < LN; I++) {
      const a = J * n + I, b = a + 1, cc = a + n, d = cc + 1;
      idx.push(a, cc, d, a, d, b);
    }
    g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: tono, flatShading: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 4 }));
    const U = { uFoco: { value: new THREE.Vector2(1e9, 1e9) }, uRadio: { value: 0 } };
    m.material.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = 'varying vec3 vMundo;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vMundo = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'varying vec3 vMundo;\nuniform vec2 uFoco;\nuniform float uRadio;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n  if (distance(vMundo.xz, uFoco) < uRadio) discard;');
    };
    m.receiveShadow = false;
    m.name = 'suelo_lejos';
    grupo.add(m);
    return { m, U, pos, col, n };
  })();
  // un vertice de la malla de lejos: su cota (metro y medio por debajo) y su color
  function verticeLejos(I, J) {
    const n = lejos.n, k = (J * n + I) * 3, i = I * LP, j = J * LP;
    const x = -EXT + i * PASO, z = -EXT + j * PASO, y = H[j * f + i];
    lejos.pos[k] = x; lejos.pos[k + 1] = y - 1.5; lejos.pos[k + 2] = z;
    const iz = Math.max(0, i - LP), de = Math.min(N, i + LP), ar = Math.max(0, j - LP), ab = Math.min(N, j + LP);
    const gx = (H[j * f + de] - H[j * f + iz]) / ((de - iz) * PASO), gz = (H[ab * f + i] - H[ar * f + i]) / ((ab - ar) * PASO);
    colorCara(x, y, z, 1 / Math.hypot(gx, 1, gz), c);
    lejos.col[k] = c.r; lejos.col[k + 1] = c.g; lejos.col[k + 2] = c.b;
  }
  for (let J = 0; J <= LN; J++) for (let I = 0; I <= LN; I++) verticeLejos(I, J);
  lejos.m.geometry.computeVertexNormals();
  lejos.m.geometry.computeBoundingSphere();

  // ---------------- cada fotograma: hacer lo que falta cerca y tirar lo lejano ----------------
  let radioHecho = 0;
  function actualizar(foco, todo = false) {
    const fi = Math.floor((foco.x + EXT) / CH), fj = Math.floor((foco.z + EXT) / CH), R = Math.ceil(CERCA / CH) + 1;
    const faltan = [];
    let hueco = Infinity;
    for (let tj = Math.max(0, fj - R); tj <= Math.min(porLado - 1, fj + R); tj++) {
      for (let ti = Math.max(0, fi - R); ti <= Math.min(porLado - 1, fi + R); ti++) {
        const d = dist(ti, tj, foco.x, foco.z);
        if (d > CERCA || trozos.has(tj * porLado + ti)) continue;
        faltan.push([d, ti, tj]);
        hueco = Math.min(hueco, d);
      }
    }
    faltan.sort((a, b) => a[0] - b[0]);
    // con `todo` (al llegar a un sitio de golpe) los de alrededor ya; si no, hasta ~8 ms por fotograma
    const t0 = performance.now();
    let hechos = 0;
    for (const [d, ti, tj] of faltan) {
      if (todo ? d > 450 : (hechos >= 1 && performance.now() - t0 > 8)) break;
      hacer(ti, tj);
      hechos++;
      if (d <= hueco) hueco = Infinity;
    }
    if (hechos) { hueco = Infinity; for (const [d, ti, tj] of faltan) if (!trozos.has(tj * porLado + ti)) hueco = Math.min(hueco, d); }
    for (const k of [...trozos.keys()]) {
      const ti = k % porLado, tj = (k - ti) / porLado;
      if (dist(ti, tj, foco.x, foco.z) > TIRAR) tirar(k);
    }
    // la de lejos se calla dentro de lo que ya esta hecho entero alrededor del foco
    radioHecho = Math.min(CERCA, hueco) - 30;
    lejos.U.uFoco.value.set(foco.x, foco.z);
    lejos.U.uRadio.value = Math.max(0, radioHecho);
  }

  // EL EDITOR: rehacer las celdas de un recuadro; la forma al momento, el color poco a poco (y la malla de lejos)
  const pendiente = new Set(), sucios = new Set(), lejosSucio = new Set();
  function rehacer(i0, j0, i1, j1, conColor = true) {
    i0 = Math.max(0, i0); j0 = Math.max(0, j0); i1 = Math.min(N - 1, i1); j1 = Math.min(N - 1, j1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (celda(i, j, false)) {
        if (conColor) pendiente.add(j * N + i);
        sucios.add(Math.floor(j / CEL) * porLado + Math.floor(i / CEL));
      }
    }
    for (let J = Math.floor(j0 / LP); J <= Math.ceil((j1 + 1) / LP); J++) for (let I = Math.floor(i0 / LP); I <= Math.ceil((i1 + 1) / LP); I++) {
      if (I >= 0 && J >= 0 && I <= LN && J <= LN) lejosSucio.add(J * (LN + 1) + I);
    }
    cerrar(false);
  }
  function pintarPendiente(ms = 6) {
    const t0 = performance.now();
    let n = 0;
    for (const k of pendiente) {
      pendiente.delete(k);
      const i = k % N, j = (k - i) / N;
      if (celda(i, j, true)) sucios.add(Math.floor(j / CEL) * porLado + Math.floor(i / CEL));
      if ((++n & 31) === 0 && performance.now() - t0 > ms) break;
    }
    cerrar(true);
    if (!pendiente.size && lejosSucio.size) {
      for (const k of lejosSucio) verticeLejos(k % (LN + 1), Math.floor(k / (LN + 1)));
      lejosSucio.clear();
      const g = lejos.m.geometry;
      g.attributes.position.needsUpdate = g.attributes.color.needsUpdate = true;
      g.computeVertexNormals();
    }
    return pendiente.size;
  }
  function cerrar(color) {
    for (const k of sucios) {
      const m = trozos.get(k);
      if (!m) continue;
      const g = m.geometry;
      g.attributes.position.needsUpdate = true;
      if (color) g.attributes.color.needsUpdate = true;
      g.computeVertexNormals();
      g.computeBoundingSphere();
    }
    sucios.clear();
  }

  // ---------------- fuera del mundo: lomas en grueso hasta 2,5 km mas alla del borde, sin sombras ----------------
  let trisFuera = 0;
  {
    const R1 = EXT + 2500, Q = 125, pos = [], col = [];
    const h = (x, z) => forma(x, z) - 1.5;
    const n = Math.round((2 * R1) / Q);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x0 = -R1 + i * Q, z0 = -R1 + j * Q;
        if (x0 >= -EXT && x0 + Q <= EXT && z0 >= -EXT && z0 + Q <= EXT) continue;
        const a = [x0, h(x0, z0), z0], b = [x0 + Q, h(x0 + Q, z0), z0], cc = [x0, h(x0, z0 + Q), z0 + Q], d = [x0 + Q, h(x0 + Q, z0 + Q), z0 + Q];
        for (const [p, q, r] of [[a, d, b], [a, cc, d]]) {
          const cx = (p[0] + q[0] + r[0]) / 3, cz = (p[2] + q[2] + r[2]) / 3, cy = (p[1] + q[1] + r[1]) / 3;
          c.copy(COLOR.oscuro).lerp(COLOR.seco, suave(0.4, 0.7, fbm(cx / 600, cz / 600, 2))).lerp(COLOR.tierra, 0.2 * suave(150, 700, cy));
          c.lerp(COLOR.norte, 0.5 * norte(cx, cz));
          c.lerp(COLOR.nieve, suave(COTA_NIEVE - 20 - 160 * norte(cx, cz), COTA_NIEVE + 80, cy));
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
    trisFuera = pos.length / 9;
  }
  return {
    actualizar, rehacer, pintarPendiente, get pendiente() { return pendiente.size; },
    info: () => ({ triangulosSuelo: tris, trozosSuelo: trozos.size, triangulosLejos: LN * LN * 2, triangulosFuera: trisFuera, radioCerca: Math.round(radioHecho) }),
  };
}
export { radioBorde };
