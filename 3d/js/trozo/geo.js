// Piezas LOW POLY del trozo con el acabado del 18: tono plano en cuatro escalones, color horneado por cara y una
// linea de TINTA (casco invertido, en el mundo: el mismo grosor aunque la pieza vaya escalada). Un `Lote` junta muchas
// piezas en dos mallas (cuerpo y tinta): un edificio, una calle de tiendas o un monton de cajas son dos llamadas.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const col = (h) => new THREE.Color(h);
export const TINTA = new THREE.Color().setRGB(30 / 255, 24 / 255, 20 / 255, THREE.SRGBColorSpace);

export function escalones(niveles = [120, 175, 222, 255]) {
  const t = new THREE.DataTexture(new Uint8Array(niveles.flatMap((v) => [v, v, v, 255])), niveles.length, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}
export const TONO = escalones();
export const matToon = (extra = {}) => new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: TONO, flatShading: true, ...extra });
export const matTinta = () => new THREE.MeshBasicMaterial({ color: TINTA, side: THREE.BackSide });

// ---------------- formas base (geometria unidad, se escalan con la matriz) ----------------
export const FORMAS = {
  caja: new THREE.BoxGeometry(1, 1, 1),                                       // centrada
  cajaSuelo: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),           // apoyada en y = 0
  cil6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6).translate(0, 0.5, 0),
  cil8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8).translate(0, 0.5, 0),
  cono6: new THREE.ConeGeometry(0.5, 1, 6).translate(0, 0.5, 0),
  cono4: new THREE.ConeGeometry(0.5, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0),   // tejado a cuatro aguas
  bola: new THREE.IcosahedronGeometry(0.5, 0),
  bola1: new THREE.IcosahedronGeometry(0.5, 1),
};
// prisma triangular apoyado (tejado a dos aguas: cumbrera a lo largo de X)
FORMAS.dosAguas = (() => {
  const g = new THREE.BufferGeometry();
  const v = [[-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 0, 0.5], [-0.5, 0, 0.5], [-0.5, 1, 0], [0.5, 1, 0]];
  // (en sentido antihorario visto desde fuera: con el orden al reves se veia el casco de tinta por dentro, en negro)
  const caras = [[0, 5, 1], [0, 4, 5], [3, 5, 4], [3, 2, 5], [0, 3, 4], [1, 5, 2], [0, 2, 3], [0, 1, 2]];
  const p = [];
  for (const c of caras) for (const k of c) p.push(...v[k]);
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  return g;
})();
// cono truncado / tronco con radios distintos
const _troncos = new Map();
export function tronco(rAbajo, rArriba, lados = 6) {
  const k = `${rAbajo}|${rArriba}|${lados}`;
  if (!_troncos.has(k)) _troncos.set(k, new THREE.CylinderGeometry(rArriba, rAbajo, 1, lados).translate(0, 0.5, 0));
  return _troncos.get(k);
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
// matriz de una pieza: posicion, giro (y, o [x, y, z]) y escala ([sx, sy, sz] o numero)
export function M(x, y, z, giro = 0, esc = 1) {
  if (Array.isArray(giro)) _e.set(giro[0], giro[1], giro[2]); else _e.set(0, giro, 0);
  const s = Array.isArray(esc) ? esc : [esc, esc, esc];
  return _m.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(s[0], s[1], s[2])).clone();
}

// azar con semilla (el de texturas.js, sin importar el lienzo)
export function azar(semilla = 1) {
  let s = semilla >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// la geometria de una pieza en el MUNDO (solo posicion)
function enMundo(geo, matriz) {
  const g = geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  g.applyMatrix4(matriz);
  return g;
}
// casco de tinta: normales suaves (vertices soldados) y empujado hacia fuera `grosor` m
export function cascoDe(g, grosor) {
  const solo = new THREE.BufferGeometry();
  solo.setAttribute('position', g.attributes.position.clone());
  if (g.index) solo.setIndex(g.index.clone());
  const s = mergeVertices(solo, 1e-4);
  s.computeVertexNormals();
  const p = s.attributes.position, n = s.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * grosor, p.getY(i) + n.getY(i) * grosor, p.getZ(i) + n.getZ(i) * grosor);
  s.deleteAttribute('normal');
  return s.index ? s.toNonIndexed() : s;
}

export class Lote {
  constructor(nombre = 'lote', semilla = 1) { this.nombre = nombre; this.cuerpo = []; this.cascos = []; this.r = azar(semilla); }
  // tinta: grosor de la linea (0 = sin linea); varia: cuanto cambia el tono de cara a cara
  poner(geo, matriz, color, { tinta = 0.025, varia = 0.06 } = {}) {
    const g = enMundo(geo, matriz);
    const c = color.isColor ? color : col(color);
    const plana = g.index ? g.toNonIndexed() : g;
    const n = plana.attributes.position.count, cc = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 3) {
      const k = 1 + (this.r() - 0.5) * 2 * varia;
      for (let t = 0; t < 3; t++) cc.set([c.r * k, c.g * k, c.b * k], (i + t) * 3);
    }
    plana.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    this.cuerpo.push(plana);
    if (tinta > 0) this.cascos.push(cascoDe(g, tinta));
    return this;
  }
  // geometria ya hecha en el mundo con su color por vertice (sin tinta o con ella)
  ponerHecha(geo, tinta = 0) {
    this.cuerpo.push(geo.index ? geo.toNonIndexed() : geo);
    if (tinta > 0) this.cascos.push(cascoDe(geo, tinta));
    return this;
  }
  get vacio() { return this.cuerpo.length === 0; }
  hacer(mat = null, matT = null) {
    const grupo = new THREE.Group();
    grupo.name = this.nombre;
    if (this.cuerpo.length) {
      const m = new THREE.Mesh(juntar(this.cuerpo, true), mat || matToon());
      m.castShadow = m.receiveShadow = true;
      m.name = this.nombre + '_cuerpo';
      grupo.add(m);
    }
    if (this.cascos.length) {
      const t = new THREE.Mesh(juntar(this.cascos, false), matT || matTinta());
      t.name = this.nombre + '_tinta';
      grupo.add(t);
    }
    return grupo;
  }
}

// junta geometrias sin indice (posicion y, si se pide, color) en una; normales de cara
export function juntar(geos, conColor) {
  let n = 0;
  for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), colr = conColor ? new Float32Array(n * 3) : null;
  let o = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, o * 3);
    if (colr) {
      const c = g.attributes.color;
      if (c) colr.set(c.array, o * 3); else colr.fill(1, o * 3, (o + g.attributes.position.count) * 3);
    }
    o += g.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (colr) g.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// un rotulo pintado en un lienzo (letras nitidas sobre una tabla): textura sRGB
export function rotulo(texto, { ancho = 512, alto = 128, fondo = '#d8cfb4', tinta = '#2a2118', letra = 'bold 76px Bahnschrift, "Arial Narrow", sans-serif', borde = true } = {}) {
  const c = document.createElement('canvas');
  c.width = ancho; c.height = alto;
  const g = c.getContext('2d');
  if (fondo) { g.fillStyle = fondo; g.fillRect(0, 0, ancho, alto); }
  if (borde && fondo) { g.strokeStyle = tinta; g.lineWidth = 8; g.strokeRect(4, 4, ancho - 8, alto - 8); }
  g.fillStyle = tinta; g.font = letra; g.textAlign = 'center'; g.textBaseline = 'middle';
  const lineas = String(texto).split('\n'), h = alto / (lineas.length + 0.2);
  lineas.forEach((l, i) => g.fillText(l, ancho / 2, h * (i + 0.6)));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
