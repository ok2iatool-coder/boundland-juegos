// EL DETALLE DEL SUELO (2026-10-21, "todo el terreno mejorado, como el mapa de 15 m2"): lo menudo de la PARCELA
// (../parcela.js) alrededor del 18: PIEDRAS facetadas con musgo y su TINTA (el mismo `piedra` de la parcela: icosaedro
// cortado por planos, color por vertice con grietas, vetas y musgo arriba y al pie), CHINAS, HOJAS SECAS y RAMITAS.
// Mas en lo pelado (tierra, calvas, cuestas, la orilla) y casi nada en la hierba alta; nada en el agua, la obra ni los
// muros (`cubierta`). En trozos de 8 m hasta RADIO m del foco, que se hacen al acercarse (uno por fotograma).
// Son diez piedras y doce chinas distintas (cada una con su giro, tamano y tono), horneadas en tres mallas por trozo.
import * as THREE from 'three';
import { mergeVertices, toCreasedNormals, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { altura, azar, fbm, suave, normalY, EXT } from './relieve.js';
import { cubierta } from './sitios.js';

const RADIO = 24, CH = 12, HACER = RADIO + 4, TIRAR = RADIO + 16;   // (trozos de 12 m: con 8 eran 220 llamadas de dibujo)
const TINTA = new THREE.Color().setRGB(30 / 255, 24 / 255, 20 / 255, THREE.SRGBColorSpace);

// ---------------- la piedra de la parcela ----------------
function piedra(semilla, detalle, musgo, rugoso = 0) {
  const q = azar(semilla);
  let g = new THREE.IcosahedronGeometry(1, detalle);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position, v = new THREE.Vector3(), u = new THREE.Vector3();
  const planos = [];
  for (let k = 0, n = 4 + Math.floor(q() * 6); k < n; k++) planos.push([new THREE.Vector3(q() * 2 - 1, q() * 1.7 - 0.35, q() * 2 - 1).normalize(), 0.6 + q() * 0.3]);
  const ondas = [];
  if (rugoso > 0) {
    for (let k = 0, n = 5 + Math.floor(q() * 7); k < n; k++) planos.push([new THREE.Vector3(q() * 2 - 1, q() * 1.6 - 0.3, q() * 2 - 1).normalize(), 0.78 + q() * 0.17]);
    for (let k = 0; k < 6; k++) ondas.push([new THREE.Vector3(q() * 2 - 1, q() * 2 - 1, q() * 2 - 1).normalize(), 2.6 * Math.pow(1.85, k), rugoso * 0.17 / Math.pow(1.55, k), q() * 6.2832]);
  }
  const salto = detalle > 2 ? 0.04 : 0.2, hondo = new Float32Array(p.count);
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
    v.y = Math.max(v.y, -0.45);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  // a 1 x 1 x 1 con la base en y = 0 (cada instancia la escala)
  g.computeBoundingBox();
  const bb = g.boundingBox, sx = Math.max(-bb.min.x, bb.max.x), sz = Math.max(-bb.min.z, bb.max.z), sy = bb.max.y - bb.min.y;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) / sx, (p.getY(i) - bb.min.y) / sy, p.getZ(i) / sz);
  g.computeVertexNormals();
  const P = g.attributes.position, Nv = g.attributes.normal, cc = new Float32Array(P.count * 3), s0 = semilla * 3.7, rango = rugoso * 0.12;
  const fbm3 = (x, y, z, f) => fbm(x * f + y * f * 0.61 + s0, z * f - y * f * 0.47 - s0, 3);
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), ny = Nv.getY(i);
    const grieta = rugoso > 0 ? suave(-rango, rango, hondo[i]) : 0.5;
    let k = (0.8 + 0.22 * fbm3(x, y, z, 2.2) + 0.14 * (fbm3(x, y, z, 30) - 0.5)) * (ny < -0.2 ? 0.74 : 1) * (rugoso > 0 ? 0.74 + 0.46 * grieta : 1);
    const arriba = suave(0.25, 0.75, ny) * suave(0.2, 0.6, y);
    const parche = suave(0.42, 0.56, fbm3(x, y, z, 5) + 0.14 * (1 - grieta));
    const pie = suave(0.52, 0.3, y);
    k *= 1 - 0.22 * pie;
    const m = Math.min(1, musgo * Math.max(arriba * parche, 0.55 * pie * suave(0.38, 0.6, fbm3(x, y, z, 7))) * (0.75 + 0.5 * fbm3(x, y, z, 20)));
    const vivo = fbm3(x, y, z, 12), mr = 0.34 + 0.16 * vivo, mg = 0.5 + 0.14 * vivo, mb = 0.2 + 0.05 * vivo;
    cc[i * 3] = k * (1 - m) + k * mr * m; cc[i * 3 + 1] = k * 0.985 * (1 - m) + k * mg * m; cc[i * 3 + 2] = k * 0.95 * (1 - m) + k * mb * m;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cc, 3));
  const plana = toCreasedNormals(g, 50 * Math.PI / 180);
  // la tinta: el casco hacia fuera por las normales suaves (el grosor va en la escala de cada instancia: un poco gordo)
  const casco = g.clone(), cp = casco.attributes.position, cn = casco.attributes.normal;
  for (let i = 0; i < cp.count; i++) cp.setXYZ(i, cp.getX(i) + cn.getX(i) * 0.035, cp.getY(i) + cn.getY(i) * 0.035, cp.getZ(i) + cn.getZ(i) * 0.035);
  casco.deleteAttribute('color');
  return { plana, casco: casco.toNonIndexed() };
}
// una hoja seca (dos mitades onduladas) y una ramita (prisma de cuatro lados), de 1 m: cada instancia las escala
function geoHoja() {
  const pos = [], col = [], parda = new THREE.Color(0x9a6f3c), oscura = new THREE.Color(0x7a5530);
  const P = (t, w, dy = 0) => [(t - 0.5), dy, w];
  const tri = (a, b, c, ca, cb, cc) => { pos.push(...a, ...b, ...c); for (const k of [ca, cb, cc]) col.push(k.r, k.g, k.b); };
  for (const ld of [-1, 1]) {
    let prev = P(0, 0);
    for (const [t, w] of [[0.1, 0.18], [0.35, 0.3], [0.6, 0.28], [0.85, 0.14]]) { const q2 = P(t, w * ld, 0.09); tri(prev, q2, P(t, 0, 0.03), parda, parda, oscura); prev = q2; }
    tri(prev, P(1, 0, 0.04), P(0.85, 0, 0.03), parda, oscura, oscura);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const n = new Float32Array(pos.length); for (let i = 1; i < n.length; i += 3) n[i] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  return g;
}
function geoRamita() {
  const g = new THREE.CylinderGeometry(0.5, 0.6, 1, 5, 1).rotateZ(Math.PI / 2).translate(0, 0.5, 0);
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const k = i % 2 ? 0.55 : 0.64; c[i * 3] = k; c[i * 3 + 1] = k * 0.82; c[i * 3 + 2] = k * 0.62; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

export function crearDetalleSuelo({ grupo, tono }) {
  const toon = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: tono });
  const hojaMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: tono, side: THREE.DoubleSide });
  const tinta = new THREE.MeshBasicMaterial({ color: TINTA, side: THREE.BackSide });
  const geos = {
    piedra: Array.from({ length: 10 }, (_, k) => piedra(300 + k, 3, 0.9, 1)),
    china: Array.from({ length: 12 }, (_, k) => piedra(700 + k, 0, 0, 0)),
    hoja: geoHoja(), ramita: geoRamita(),
  };
  const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v3 = new THREE.Vector3(), sv = new THREE.Vector3(), cc = new THREE.Color();
  const cub = { mata: 0, alto: 1, flor: 0, florTipo: 0, seco: 0 };
  const nT = Math.round((2 * EXT) / CH), trozos = new Map();
  let cuenta = 0, msMax = 0;
  function hacer(i, j) {
    const t0 = performance.now();
    const x0 = -EXT + i * CH, z0 = -EXT + j * CH, r = azar(9100 + j * 6151 + i * 37);
    // lo pelado de cada metro: sin hierba, en cuesta o en la orilla (la cubierta en una rejilla de 2 m)
    const n2 = CH / 2 + 1, Pel = [];
    for (let b = 0; b < n2; b++) for (let a = 0; a < n2; a++) {
      const x = x0 + a * 2, z = z0 + b * 2, c = cubierta(x, z, cub), ny = normalY(x, z);
      Pel.push({ pelado: Math.max(0, 1 - c.mata), cuesta: suave(0.92, 0.7, ny) });
    }
    const en = (x, z) => Pel[Math.min(n2 - 1, Math.round((z - z0) / 2)) * n2 + Math.min(n2 - 1, Math.round((x - x0) / 2))];
    const L = { piedra: Array.from({ length: 10 }, () => []), china: Array.from({ length: 12 }, () => []), hoja: [], ramita: [] };
    // (al sol de media tarde, con los tonos de la parcela salian casi blancas)
    const tonoRoca = () => cc.setRGB(0.42, 0.4, 0.35).lerp(new THREE.Color(0.38, 0.34, 0.28), r() * 0.6).multiplyScalar(0.9 + 0.2 * r()).clone();
    // piedras (8-60 cm): pocas en la hierba, mas en lo pelado y sobre todo en las cuestas
    for (let k = 0; k < 40; k++) {
      const x = x0 + r() * CH, z = z0 + r() * CH, p = en(x, z);
      if (r() > 0.05 + 0.35 * p.pelado + 0.6 * p.cuesta) continue;
      const s = 0.08 + Math.pow(r(), 2.2) * (0.3 + 0.35 * p.cuesta), alto = s * (0.45 + 0.4 * r());
      L.piedra[Math.floor(r() * 10)].push({ x, y: altura(x, z) - alto * 0.3, z, giro: r() * 6.28, sx: s, sy: alto, sz: s * (0.7 + 0.3 * r()), c: tonoRoca() });
    }
    // chinas (1-5 cm), en racimos
    for (let k = 0; k < 90; k++) {
      const x = x0 + r() * CH, z = z0 + r() * CH, p = en(x, z);
      if (r() > 0.03 + 0.7 * p.pelado + 0.4 * p.cuesta) continue;
      for (let m = 0, n = 1 + Math.floor(r() * 5); m < n; m++) {
        const xx = x + (r() - 0.5) * 0.5, zz = z + (r() - 0.5) * 0.5, s = 0.012 + Math.pow(r(), 2.2) * 0.04;
        L.china[Math.floor(r() * 12)].push({ x: xx, y: altura(xx, zz) - s * 0.15, z: zz, giro: r() * 6.28, sx: s, sy: s * (0.45 + 0.3 * r()), sz: s * (0.75 + 0.3 * r()), c: cc.setRGB(0.46, 0.43, 0.38).lerp(new THREE.Color(0.38, 0.34, 0.3), r()).clone() });
      }
    }
    // hojas secas y ramitas (pocas: el mundo aun no tiene arboles)
    for (let k = 0; k < 14; k++) {
      const x = x0 + r() * CH, z = z0 + r() * CH, p = en(x, z);
      if (r() > 0.25 + 0.4 * p.pelado) continue;
      const Lh = 0.045 + r() * 0.03, tinte = 0.85 + 0.3 * r();
      L.hoja.push({ x, y: altura(x, z) + 0.003, z, giro: r() * 6.28, rx: (r() - 0.5) * 0.3, sx: Lh, sy: Lh * 0.6, sz: Lh, c: cc.setRGB(tinte, tinte, tinte).clone() });
    }
    for (let k = 0; k < 2; k++) {
      if (r() > 0.55) continue;
      const x = x0 + r() * CH, z = z0 + r() * CH, Lr = 0.12 + r() * 0.2, rad = 0.008 + r() * 0.008;
      L.ramita.push({ x, y: altura(x, z), z, giro: r() * 6.28, rz: (r() - 0.5) * 0.08, sx: Lr, sy: rad, sz: rad * 1.1, c: cc.setRGB(1, 1, 1).clone() });
    }
    // todo el trozo en TRES mallas (lo de toon, la tinta y las hojas): con una instanciada por variante eran 30 llamadas
    // de dibujo por trozo y 900 en total
    const t = { cx: x0 + CH / 2, cz: z0 + CH / 2, grupo: new THREE.Group(), n: 0 };
    const toonG = [], tintaG = [], hojaG = [];
    const hornear = (geo, lista, destino, conColor = true) => {
      for (const o of lista) {
        const g = geo.clone().applyMatrix4(mt.compose(v3.set(o.x, o.y, o.z), q.setFromEuler(e.set(o.rx || 0, o.giro, o.rz || 0)), sv.set(o.sx, o.sy, o.sz)));
        for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(n)) g.deleteAttribute(n);
        if (conColor) { const C = g.attributes.color; for (let i = 0; i < C.count; i++) C.setXYZ(i, C.getX(i) * o.c.r, C.getY(i) * o.c.g, C.getZ(i) * o.c.b); }
        else g.deleteAttribute('color');
        destino.push(g.index ? g.toNonIndexed() : g);
        t.n++;
      }
    };
    L.piedra.forEach((l, k) => { hornear(geos.piedra[k].plana, l, toonG); hornear(geos.piedra[k].casco, l, tintaG, false); });
    L.china.forEach((l, k) => hornear(geos.china[k].plana, l, toonG));
    hornear(geos.ramita, L.ramita, toonG);
    hornear(geos.hoja, L.hoja, hojaG);
    for (const [gs, mat, nombre, sombra] of [[toonG, toon, 'piedras', true], [tintaG, tinta, 'piedras_tinta', false], [hojaG, hojaMat, 'hojas_secas', false]]) {
      if (!gs.length) continue;
      const m = new THREE.Mesh(mergeGeometries(gs), mat);
      m.castShadow = sombra; m.receiveShadow = mat !== tinta; m.name = nombre;
      t.grupo.add(m);
    }
    t.grupo.name = 'detalle_suelo';
    grupo.add(t.grupo);
    cuenta += t.n;
    msMax = Math.max(msMax, Math.round(performance.now() - t0));
    return t;
  }
  function tirar(k) {
    const t = trozos.get(k);
    t.grupo.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    grupo.remove(t.grupo);
    cuenta -= t.n;
    trozos.delete(k);
  }
  const dT = (cx, cz, x, z) => Math.hypot(Math.max(Math.abs(cx - x) - CH / 2, 0), Math.max(Math.abs(cz - z) - CH / 2, 0));
  function actualizar(foco, forzar = false) {
    const fi = Math.floor((foco.x + EXT) / CH), fj = Math.floor((foco.z + EXT) / CH), R = Math.ceil(HACER / CH);
    const faltan = [];
    for (let j = Math.max(0, fj - R); j <= Math.min(nT - 1, fj + R); j++) {
      for (let i = Math.max(0, fi - R); i <= Math.min(nT - 1, fi + R); i++) {
        const k = j * 10000 + i;
        if (trozos.has(k)) continue;
        const d = dT(-EXT + i * CH + CH / 2, -EXT + j * CH + CH / 2, foco.x, foco.z);
        if (d <= HACER) faltan.push([d, i, j, k]);
      }
    }
    faltan.sort((a, b) => a[0] - b[0]);
    for (const [, i, j, k] of forzar ? faltan : faltan.slice(0, 1)) trozos.set(k, hacer(i, j));
    for (const [k, t] of trozos) {
      const d = dT(t.cx, t.cz, foco.x, foco.z);
      if (d > TIRAR) { tirar(k); continue; }
      t.grupo.visible = d < RADIO;
    }
  }
  function tirarZona(x0, z0, x1, z1) {
    for (const [k, t] of trozos) if (!(t.cx + CH / 2 < x0 || t.cx - CH / 2 > x1 || t.cz + CH / 2 < z0 || t.cz - CH / 2 > z1)) tirar(k);
  }
  return { actualizar, tirarZona, info: () => ({ trozosDetalle: trozos.size, piezasDetalle: cuenta, msTrozoDetalle: msMax }) };
}
