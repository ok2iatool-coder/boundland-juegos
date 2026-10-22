// EL SUELO del mapa del mundo: la rejilla de relieve.js (8 m) en trozos de 200 m con el COLOR por cara, como el del
// terreno: pradera (mas jugosa en el Linde y en lo bajo, pajiza al subir y en los Cerros), tierra en las cuestas, roca
// con estratos en los cortados, grava en las orillas, el fondo del agua y NIEVE por encima de la cota de nieve (no en
// las paredes: alli no agarra). Fuera del mundo, lomas en grueso que cierran la vista.
import * as THREE from 'three';
import { H, N, PASO, EXT, forma, curvatura, fbm, suave, hash, radioBorde, pinturaEn, MATERIALES, COTA_NIEVE, distAgua, norte, alturaVertice, diagFina, SUB, TROZO, CACHE } from './relieve.js';
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

// ---------------- el suelo POR TROZOS (v5, 15 km; 21-10: sobre la rejilla FINA) ----------------
// CERCA: trozos de 200 m, los que caen a menos de CERCA m del foco (el 18 o la camara del editor), sobre la rejilla FINA
// de relieve.js: celdas de 2 m hasta 380 m del foco, de 4 m hasta 760 y de 8 m mas alla (BANDAS). Cada vertice lleva su
// color (colorCara con la pendiente de alli) y cada cara la media de los suyos: sigue siendo low poly (una cara, un
// color), pero las franjas de color ya no cruzan una cara de 8 m de lado a lado. Los bordes de cada trozo van rectos
// entre los vertices de 8 m: casan con el de al lado sea del detalle que sea. Los de 2 m guardan sus cotas en R.CACHE.
// Se hacen unos pocos por fotograma (los mas cercanos primero) y se tiran al alejarse.
// LEJOS: UNA malla del mundo entero cada 40 m, metro y medio por debajo, que no se dibuja dentro del circulo que ya
// cubren los trozos de cerca (un `discard` en su sombreador). Asi se ve el mundo entero sin pintar 7 millones de caras.
const CEL = TROZO, CH = CEL * PASO;            // 200 m por trozo
const CERCA = 1100, TIRAR = 1450;              // m del foco al trozo
const BANDAS = [[380, SUB], [760, 2], [Infinity, 1]];
const subDe = (d) => BANDAS.find(([m]) => d < m)[1];
const LP = 5, LN = N / LP;                     // la malla de lejos: un vertice cada 5 (40 m)

// EL GRANO del suelo (2026-10-21, "como la parcela"): un vertice cada 2 m no lleva el detalle de la parcela (su color
// iba cada 20 cm), asi que lo pone el sombreador: manchas de tres tamanos (6 m, 1,5 m y 40 cm) que aclaran y oscurecen,
// y calvas de tierra en lo llano. Proyectadas por los TRES lados segun la normal (en una ladera, proyectadas desde
// arriba se estiraban en vetas). La textura es ruido que se repite sin costura.
function texturaGrano() {
  const N2 = 256, P = new Float32Array(N2 * N2), d = new Uint8Array(N2 * N2 * 4);
  let sem = 4242;
  const r = () => { sem = (Math.imul(sem, 1664525) + 1013904223) >>> 0; return sem / 4294967296; };
  const G = 16, rej = Array.from({ length: G * G }, r);
  const v = (i, j) => rej[((j % G + G) % G) * G + ((i % G + G) % G)];
  for (let y = 0; y < N2; y++) for (let x = 0; x < N2; x++) {
    let t = 0, a = 0.55, s = 0;
    for (let o = 0; o < 4; o++) {
      const per = G << o, fx = (x / N2) * per, fy = (y / N2) * per, i = Math.floor(fx), j = Math.floor(fy), u = fx - i, w = fy - j;
      const uu = u * u * (3 - 2 * u), ww = w * w * (3 - 2 * w);
      const vv = (ii, jj) => v((ii % per) + o * 5, (jj % per) + o * 7);
      t += a * ((vv(i, j) * (1 - uu) + vv(i + 1, j) * uu) * (1 - ww) + (vv(i, j + 1) * (1 - uu) + vv(i + 1, j + 1) * uu) * ww);
      s += a; a *= 0.5;
    }
    P[y * N2 + x] = t / s;
  }
  for (let k = 0; k < N2 * N2; k++) { const g = Math.round(P[k] * 255); d[k * 4] = d[k * 4 + 1] = d[k * 4 + 2] = g; d[k * 4 + 3] = 255; }
  const t = new THREE.DataTexture(d, N2, N2, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}
let GRANO = null;
export function granoSuelo(mat) {
  GRANO = GRANO || texturaGrano();
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uGrano = { value: GRANO };
    sh.vertexShader = 'varying vec3 vGranoW;\nvarying vec3 vGranoN;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
  vGranoW = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vGranoN = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = 'varying vec3 vGranoW;\nvarying vec3 vGranoN;\nuniform sampler2D uGrano;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  {
    vec3 bw = pow(abs(normalize(vGranoN)), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
    vec3 p = vGranoW;
    #define TRI(s) (texture2D(uGrano, p.zy * (s)).r * bw.x + texture2D(uGrano, p.xz * (s)).r * bw.y + texture2D(uGrano, p.xy * (s)).r * bw.z)
    float n1 = TRI(1.0 / 24.0), n2 = TRI(1.0 / 6.0), n3 = TRI(1.0 / 1.6);
    float lejos = smoothstep(60.0, 220.0, distance(cameraPosition, p));
    float d = (n1 - 0.5) * 0.26 + ((n2 - 0.5) * 0.2 + (n3 - 0.5) * 0.14) * (1.0 - 0.7 * lejos);
    diffuseColor.rgb *= 1.0 + d;
    // calvas de tierra seca en lo llano (donde hay hierba se notan entre las matas)
    float calva = smoothstep(0.64, 0.78, n2 * 0.55 + n1 * 0.45) * bw.y * (1.0 - lejos);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.18, 1.0, 0.72), 0.45 * calva);
  }`);
  };
  mat.customProgramCacheKey = () => 'suelo-grano';
}
export function crearSuelo(grupo, tono) {
  const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: tono });
  granoSuelo(mat);
  const porLado = N / CEL, f = N + 1;
  const c = new THREE.Color();
  const trozos = new Map();                      // clave tj * porLado + ti -> { m, s }
  let tris = 0;
  const msHacer = { 1: 0, 2: 0, 4: 0 };          // lo que tarda (en total) el trozo mas lento de cada detalle (info)
  // un trozo POR PASOS (un generador): cotas, bordes, colores y caras a tandas de filas, para repartirlo entre
  // fotogramas (uno fino de 2 m entero eran ~50 ms de golpe: un tiron cada vez que se acercaba uno). El de antes sigue
  // a la vista hasta que el nuevo esta.
  function* pasos(ti, tj, s) {
    let gasto = 0, t0 = performance.now();
    const corte = () => { gasto += performance.now() - t0; };
    const k = tj * porLado + ti;
    const n = CEL * s, nv = n + 1, paso = PASO / s;
    const x0 = -EXT + ti * CH, z0 = -EXT + tj * CH;
    const hv = new Float32Array(nv * nv), cv = new Float32Array(nv * nv * 3);
    const tanda = Math.max(4, Math.round(10 * 4 / s));
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nv; i++) hv[j * nv + i] = alturaVertice(x0 + i * paso, z0 + j * paso);
      if (j % tanda === tanda - 1) { corte(); yield; t0 = performance.now(); }
    }
    // los BORDES, rectos entre los vertices de 8 m: asi casan con el trozo de al lado tenga el detalle que tenga (con el
    // relieve de la roca, un trozo fino y uno grueso diferian metros en el borde y se veia el escalon)
    if (s > 1) {
      for (let t = 0; t < nv; t++) {
        const a8 = Math.floor(t / s) * s, b8 = Math.min(n, a8 + s), u = (t - a8) / s;
        if (t === a8) continue;
        for (const [jj, horiz] of [[0, true], [n, true], [0, false], [n, false]]) {
          const ka = horiz ? jj * nv + a8 : a8 * nv + jj, kb = horiz ? jj * nv + b8 : b8 * nv + jj, kt = horiz ? jj * nv + t : t * nv + jj;
          hv[kt] = hv[ka] + (hv[kb] - hv[ka]) * u;
        }
      }
    }
    // el color de cada vertice, con la pendiente de alli (en los bordes, hacia dentro)
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nv; i++) {
        const ia = Math.max(0, i - 1), ib = Math.min(n, i + 1), ja = Math.max(0, j - 1), jb = Math.min(n, j + 1);
        const gx = (hv[j * nv + ib] - hv[j * nv + ia]) / ((ib - ia) * paso), gz = (hv[jb * nv + i] - hv[ja * nv + i]) / ((jb - ja) * paso);
        colorCara(x0 + i * paso, hv[j * nv + i], z0 + j * paso, 1 / Math.hypot(gx, 1, gz), c);
        const q3 = (j * nv + i) * 3;
        cv[q3] = c.r; cv[q3 + 1] = c.g; cv[q3 + 2] = c.b;
      }
      if (j % tanda === tanda - 1) { corte(); yield; t0 = performance.now(); }
    }
    // las caras (2026-10-21, "como la parcela"): vertices COMPARTIDOS con su color y la normal de la pendiente de alli
    // (en los bordes, con la cota de fuera): el suelo se ve SUAVE, sin los triangulos; con una cara de un color cada una,
    // en las laderas salian astillas largas
    const nt = n * n * 2;
    const pos = new Float32Array(nv * nv * 3), nor = new Float32Array(nv * nv * 3);
    const cota = (i, j) => (i >= 0 && j >= 0 && i <= n && j <= n ? hv[j * nv + i] : alturaVertice(x0 + i * paso, z0 + j * paso));
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nv; i++) {
        const v = j * nv + i;
        pos[v * 3] = x0 + i * paso; pos[v * 3 + 1] = hv[v]; pos[v * 3 + 2] = z0 + j * paso;
        const gx = (cota(i + 1, j) - cota(i - 1, j)) / (2 * paso), gz = (cota(i, j + 1) - cota(i, j - 1)) / (2 * paso), l = Math.hypot(gx, 1, gz);
        nor[v * 3] = -gx / l; nor[v * 3 + 1] = 1 / l; nor[v * 3 + 2] = -gz / l;
      }
      if (j % (tanda * 2) === tanda * 2 - 1) { corte(); yield; t0 = performance.now(); }
    }
    const idx = new Uint32Array(nt * 3);
    let q = 0;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const A = j * nv + i, B = A + 1, C = A + nv, D = C + 1;
        // (el orden ya da la cara hacia arriba con z al sur)
        if (diagFina(hv[A], hv[B], hv[C], hv[D]) === 0) { idx[q++] = A; idx[q++] = D; idx[q++] = B; idx[q++] = A; idx[q++] = C; idx[q++] = D; }
        else { idx[q++] = A; idx[q++] = C; idx[q++] = B; idx[q++] = B; idx[q++] = C; idx[q++] = D; }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(cv, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    m.castShadow = false;                       // (como en el terreno: con el sol bajo se sombreaba a si mismo en manchas)
    m.name = 'suelo';
    if (trozos.has(k)) tirar(k);
    grupo.add(m);
    trozos.set(k, { m, s });
    if (s === SUB) CACHE.set(k, hv);
    tris += nt;
    corte();
    msHacer[s] = Math.max(msHacer[s], Math.round(gasto));
  }
  // de una vez (al llegar a un sitio de golpe y en el editor)
  function hacer(ti, tj, s) {
    obras.delete(tj * porLado + ti);
    const g = pasos(ti, tj, s);
    while (!g.next().done);
  }
  const obras = new Map();                       // los trozos a medio hacer: clave -> { g, s, d }
  function tirar(k) {
    const t = trozos.get(k);
    grupo.remove(t.m);
    tris -= t.m.geometry.index ? t.m.geometry.index.count / 3 : t.m.geometry.attributes.position.count / 3;
    t.m.geometry.dispose();
    trozos.delete(k);
    CACHE.delete(k);
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

  // ---------------- cada fotograma: hacer lo que falta cerca, afinar lo que se acerca y tirar lo lejano ----------------
  let radioHecho = 0;
  function actualizar(foco, todo = false) {
    const fi = Math.floor((foco.x + EXT) / CH), fj = Math.floor((foco.z + EXT) / CH), R = Math.ceil(CERCA / CH) + 1;
    const faltan = [];
    let hueco = Infinity;
    for (let tj = Math.max(0, fj - R); tj <= Math.min(porLado - 1, fj + R); tj++) {
      for (let ti = Math.max(0, fi - R); ti <= Math.min(porLado - 1, fi + R); ti++) {
        const d = dist(ti, tj, foco.x, foco.z);
        if (d > CERCA) continue;
        const t = trozos.get(tj * porLado + ti), quiere = subDe(d);
        if (!t) { faltan.push([d, ti, tj, quiere]); hueco = Math.min(hueco, d); continue; }
        // mas fino al acercarse; mas grueso solo bien pasado el limite (si no, en la raya se rehacia una y otra vez)
        if (quiere > t.s || subDe(Math.max(0, d - 60)) < t.s) faltan.push([d + 0.5, ti, tj, quiere]);
      }
    }
    faltan.sort((a, b) => a[0] - b[0]);
    let hechos = 0;
    if (todo) {
      // al llegar a un sitio de golpe: los de alrededor ya, enteros
      for (const [d, ti, tj, s] of faltan) { if (d > 450) break; hacer(ti, tj, s); hechos++; }
    } else {
      // si no, por pasos: los dos que mas faltan se empiezan y se avanza en ellos hasta ~5 ms por fotograma
      for (const [d, ti, tj, s] of faltan.slice(0, 2)) {
        const k = tj * porLado + ti, o = obras.get(k);
        if (!o || o.s !== s) obras.set(k, { g: pasos(ti, tj, s), s, d });
      }
      const t0 = performance.now();
      for (const [k, o] of [...obras].sort((a, b) => a[1].d - b[1].d)) {
        while (performance.now() - t0 < 5) { if (o.g.next().done) { obras.delete(k); hechos++; break; } }
        if (performance.now() - t0 >= 5) break;
      }
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

  // EL EDITOR: los trozos que tocan un recuadro (en celdas de 8 m) se rehacen enteros en pintarPendiente (forma y color a
  // la vez), y la malla de lejos
  const sucios = new Set(), lejosSucio = new Set();
  function rehacer(i0, j0, i1, j1) {
    i0 = Math.max(0, i0 - 1); j0 = Math.max(0, j0 - 1); i1 = Math.min(N - 1, i1 + 1); j1 = Math.min(N - 1, j1 + 1);
    for (let tj = Math.floor(j0 / CEL); tj <= Math.floor(j1 / CEL); tj++) for (let ti = Math.floor(i0 / CEL); ti <= Math.floor(i1 / CEL); ti++) {
      const k = tj * porLado + ti;
      if (trozos.has(k)) sucios.add(k); else CACHE.delete(k);
    }
    for (let J = Math.floor(j0 / LP); J <= Math.ceil((j1 + 1) / LP); J++) for (let I = Math.floor(i0 / LP); I <= Math.ceil((i1 + 1) / LP); I++) {
      if (I >= 0 && J >= 0 && I <= LN && J <= LN) lejosSucio.add(J * (LN + 1) + I);
    }
  }
  function pintarPendiente(ms = 6) {
    const t0 = performance.now();
    for (const k of sucios) {
      sucios.delete(k);
      const t = trozos.get(k);
      if (t) hacer(k % porLado, (k - (k % porLado)) / porLado, t.s);
      if (performance.now() - t0 > ms) break;
    }
    if (!sucios.size && lejosSucio.size) {
      for (const k of lejosSucio) verticeLejos(k % (LN + 1), Math.floor(k / (LN + 1)));
      lejosSucio.clear();
      const g = lejos.m.geometry;
      g.attributes.position.needsUpdate = g.attributes.color.needsUpdate = true;
      g.computeVertexNormals();
    }
    return sucios.size + (lejosSucio.size ? 1 : 0);
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
    actualizar, rehacer, pintarPendiente, get pendiente() { return sucios.size + (lejosSucio.size ? 1 : 0); },
    material: mat,                 // (el muro exterior le quita la banda del foso)
    info: () => ({ triangulosSuelo: tris, trozosSuelo: trozos.size, trozosFinos: [...trozos.values()].filter((t) => t.s === SUB).length, msTrozoSuelo: msHacer, triangulosLejos: LN * LN * 2, triangulosFuera: trisFuera, radioCerca: Math.round(radioHecho) }),
  };
}
export { radioBorde };
