// EL MUSGO del muro, por codigo, con el reparto que pidio el usuario (2026-10-20), medido en SUPERFICIE (los m2 de muro
// que tapa cada tipo, vistos de frente):
//   70 % CAPA PLANA: una lamina de 0,4 a 1,8 cm pegada al hormigon, de borde irregular, que se extiende por las paredes
//        donde el agua lo deja: bajo la coronacion y los cinturones, al pie del muro, junto a bajantes, contrafuertes y
//        la salida del conducto, por las juntas de los paneles y en manchas sueltas;
//   20 % ALMOHADILLAS: cojines pequenos de mechones que salen de lo mas espeso de la capa;
//   10 % COLGANTE: goterones de musgo y tallos de hiedra que cuelgan sobre todo de las esquinas y de lo de arriba
//        (coronacion, garitas, cinturones, gargolas, bandeja de cables, escotillas, balcon, visera, tirantes).
// Se hace primero la capa; almohadillas y colgante se ponen hasta su parte y `reparto` dice lo que ha salido. Lo que una
// almohadilla tapa de la capa no cuenta como capa.
//
// La capa sale de un campo de HUMEDAD sobre la cara del muro (ruido estirado en vertical, porque el agua baja, mas las
// fuentes de agua) cortado por un umbral con cuadrados que marchan: el borde cae entre vertices, asi que es irregular
// sin hacer falta una malla fina; el grosor sube hacia dentro y el borde se oscurece como la tinta del resto. Va por
// baldosas de 1,5 m con su propio tamano de celda: 3 cm junto a la base y hasta 30 cm a 35 m (lo mismo los mechones de
// las almohadillas y los goterones: lejos, menos pero mas gordos).
//
// Piezas: MECHONES (elipsoides aplastados contra la superficie, que se solapan y hacen el cojin), GOTERONES (cadenas de
// bolitas que cuelgan), TALLOS de hiedra con HOJAS de cinco lobulos (con su ribete oscuro), la CAPA y las MANCHAS de
// humedad. Todo en cinco mallas para todo el muro y, dentro del conducto junto a la salida, un poco mas con el sombreado
// del conducto colgado de sus tramos (sale con ellos al hacerse 3D).
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { D } from './datos.js';

const MX = D.MURO_X;
const W2 = D.CONDUCTO.ancho / 2, HC = D.CONDUCTO.alto;

function azar(semilla) { let s = semilla >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
function hash(i, s) { let h = Math.imul((i | 0) + 374761393 * s, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function ruido(x, s = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i, s) + (hash(i + 1, s) - hash(i, s)) * u; }

// colores en sRGB (three los pasa a lineal): verdes de oliva apagados y frios; la hiedra algo mas clara
const MUSGOS = ['#5e6c42', '#56653d', '#65724a', '#506039', '#5a6943'];
const HOJA = '#5f6c46', HOJA_CLARA = '#76825a', TALLO = '#3b3a2c', SOMBRA = 0.55;

// ejes de la superficie: n = normal, a y b = las dos direcciones sobre ella
const SUP = {
  muro: { n: new THREE.Vector3(1, 0, 0), a: new THREE.Vector3(0, 0, 1), b: new THREE.Vector3(0, 1, 0) },
  arriba: { n: new THREE.Vector3(0, 1, 0), a: new THREE.Vector3(0, 0, 1), b: new THREE.Vector3(1, 0, 0) },
  fondo: { n: new THREE.Vector3(0, 0, 1), a: new THREE.Vector3(1, 0, 0), b: new THREE.Vector3(0, 1, 0) },   // pared z = -0,8 del conducto
  delante: { n: new THREE.Vector3(0, 0, -1), a: new THREE.Vector3(1, 0, 0), b: new THREE.Vector3(0, 1, 0) }, // pared z = +0,8
};

// un buffer de Float32 (o Uint32) que crece al doble: se escribe pieza a pieza sin dejar un objeto por numero
class Crece {
  constructor(n, Tipo = Float32Array) { this.a = new Tipo(n); this.n = 0; this.Tipo = Tipo; }
  hueco(k) { if (this.n + k > this.a.length) { const b = new this.Tipo(Math.max(this.a.length * 2, this.n + k)); b.set(this.a); this.a = b; } }
  final() { return this.a.slice(0, this.n); }
}
// un LOTE: los vertices de muchas piezas en buffers que acaban en UNA geometria indexada. Antes cada mechon era una
// BufferGeometry clonada (y otra su tinta), sin indices: 8.600 mechones dejaban 60 MB de geometria en la tarjeta y tanta
// basura que el recolector paraba el juego 20 ms cada segundo y pico
class Lote {
  constructor(color, normal) {
    this.p = new Crece(1 << 16); this.n = normal ? new Crece(1 << 16) : null; this.c = color ? new Crece(1 << 16) : null;
    this.i = new Crece(1 << 16, Uint32Array);
  }
  get vacio() { return this.p.n === 0; }
  // T: plantilla { pos, nor, idx, nv }; M: Matrix4; col: Color; luz(nx, ny, nz): factor del color con la normal ya girada;
  // forma + peso: la normal se dobla hacia `forma` (la de la mata entera) despues de calcular el color
  meter(T, M, nm, col = null, luz = null, forma = null, peso = 0) {
    const e = M.elements, ne = nm.getNormalMatrix(M).elements, base = this.p.n / 3, nv = T.nv;
    const P = this.p, N = this.n, C = this.c;
    P.hueco(nv * 3); if (N) N.hueco(nv * 3); if (C) C.hueco(nv * 3);
    for (let k = 0; k < nv; k++) {
      const x = T.pos[k * 3], y = T.pos[k * 3 + 1], z = T.pos[k * 3 + 2];
      P.a[P.n++] = e[0] * x + e[4] * y + e[8] * z + e[12];
      P.a[P.n++] = e[1] * x + e[5] * y + e[9] * z + e[13];
      P.a[P.n++] = e[2] * x + e[6] * y + e[10] * z + e[14];
      if (!N && !C) continue;
      const a = T.nor[k * 3], b = T.nor[k * 3 + 1], c = T.nor[k * 3 + 2];
      let nx = ne[0] * a + ne[3] * b + ne[6] * c, ny = ne[1] * a + ne[4] * b + ne[7] * c, nz = ne[2] * a + ne[5] * b + ne[8] * c;
      let l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      if (C) {
        const f = luz ? luz(nx, ny, nz) : 1;
        C.a[C.n++] = (col ? col.r : 1) * f; C.a[C.n++] = (col ? col.g : 1) * f; C.a[C.n++] = (col ? col.b : 1) * f;
      }
      if (N) {
        if (forma && peso > 0) {
          nx = nx * (1 - peso) + forma.x * peso; ny = ny * (1 - peso) + forma.y * peso; nz = nz * (1 - peso) + forma.z * peso;
          l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        }
        N.a[N.n++] = nx; N.a[N.n++] = ny; N.a[N.n++] = nz;
      }
    }
    const I = this.i; I.hueco(T.idx.length);
    for (let j = 0; j < T.idx.length; j++) I.a[I.n++] = base + T.idx[j];
  }
  geometria() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p.final(), 3));
    if (this.n) g.setAttribute('normal', new THREE.BufferAttribute(this.n.final(), 3));
    if (this.c) g.setAttribute('color', new THREE.BufferAttribute(this.c.final(), 3));
    g.setIndex(new THREE.BufferAttribute(this.i.final(), 1));
    g.computeBoundingSphere();
    this.p = this.n = this.c = this.i = null;
    return g;
  }
}
// plantilla indexada: las esferas sin normales (en la esfera unidad la normal es la posicion), lo demas con las suyas
function plantilla(g, esfera = false) {
  g.deleteAttribute('uv');
  if (esfera) { g.deleteAttribute('normal'); g = mergeVertices(g); }
  else if (!g.index) g = mergeVertices(g);
  const pos = g.attributes.position.array;
  return { pos, nor: esfera ? pos : g.attributes.normal.array, idx: g.index.array, nv: g.attributes.position.count };
}
// la hoja de hiedra de cinco lobulos (contorno de lobulos redondos, como las del dibujo del usuario)
const FORMA_HOJA = (() => {
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2, lob = Math.abs(Math.cos(a * 2.5));
    const rr = 0.6 + 0.4 * Math.pow(lob, 0.45) - (Math.sin(a) < -0.6 ? 0.25 : 0);
    pts.push(new THREE.Vector2(Math.cos(a) * rr, Math.sin(a) * rr + 0.15));
  }
  return new THREE.Shape(pts);
})();

// ruido de valor en 2D y su fbm (para la humedad de la cara del muro)
function hash2(i, j, s) { let h = Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul(s | 0, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function ruido2(x, y, s = 0) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(i, j, s), b = hash2(i + 1, j, s), c = hash2(i, j + 1, s), d = hash2(i + 1, j + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm2(x, y, s, oct = 4) { let t = 0, amp = 0.5, f = 1, norma = 0; for (let o = 0; o < oct; o++) { t += amp * ruido2(x * f, y * f, s + o * 17); norma += amp; amp *= 0.5; f *= 2.03; } return t / norma; }
const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// la capa: verdes algo mas grises y amarillentos que los cojines (es lo que tiene menos luz y mas polvo)
const PLANOS = ['#55643a', '#5f6b40', '#687145', '#5a673e', '#636943'];
const G = D.SUELO_Y, COR0 = D.TOPE_Y - 0.8;
const BAJANTES = [6.4, -8.8, 15.5];
const UMBRAL = 0.71;

// lo lejos que queda un punto de la cara del muro de donde puede estar la camara (la base: z -16..3,4, y -3,4..2,6), y
// de ahi el tamano de la celda de la capa y la escala de mechones y goterones
function lejos(z, y) { return Math.hypot(Math.max(0, z - 3.4, -16 - z), Math.max(0, y - 2.6, -3.4 - y)); }
const celda = (d) => Math.min(0.3, 0.03 + 0.0085 * d);
const escalaLOD = (d) => Math.min(5, 1 + d / 6);

export function crearMusgo(scene, { gradiente, materialConducto, tramos, sitios, huecos }) {
  const r = azar(41);
  const ESF1 = plantilla(new THREE.IcosahedronGeometry(1, 1), true), ESF0 = plantilla(new THREE.IcosahedronGeometry(1, 0), true);
  const HOJA_P = plantilla(new THREE.ShapeGeometry(FORMA_HOJA, 1)), CIL = plantilla(new THREE.CylinderGeometry(1, 1, 1, 5, 1, true));
  const L = { musgo: new Lote(true, true), tinta: new Lote(false, false), ribete: new Lote(false, false), manchas: [] };
  const dentro = new Map();                        // tramo del conducto -> sus lotes (el sombreado del conducto pide normales)
  const M4 = new THREE.Matrix4(), nm = new THREE.Matrix3(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion();
  const V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), E1 = new THREE.Vector3(), UNO = new THREE.Vector3(1, 1, 1);
  const Z = new THREE.Vector3(0, 0, 1), Yv = new THREE.Vector3(0, 1, 0);
  const cTallo = new THREE.Color(TALLO);
  const cuenta = { mechones: 0, gotas: 0, hojas: 0, almohadillas: 0, colgantes: 0 };
  // m2 de cada tipo: capa (entera), la parte de la capa que tapan las almohadillas, almohadillas y colgante
  const area = { capa: 0, tapada: 0, voluminoso: 0, colgante: 0 };
  const CF = sitios.contrafuertes, GARG = sitios.gargolas;
  const colorAzar = (k = 1) => new THREE.Color(MUSGOS[Math.floor(r() * MUSGOS.length)]).multiplyScalar(k);
  const colorHoja = () => new THREE.Color(r() < 0.5 ? HOJA : HOJA_CLARA);

  function destino(x) {
    if (x >= MX - 0.01) return L;
    const k = Math.floor(x - D.CONDUCTO.x0);
    if (!dentro.has(k)) dentro.set(k, { musgo: new Lote(true, true), tinta: new Lote(false, true), ribete: new Lote(false, true) });
    return dentro.get(k);
  }
  // un mechon: elipsoide de radio rad sobre la superficie s en el punto c, aplastado k veces en la normal. Con `forma` (la
  // normal de la mata entera en ese punto) sus normales se doblan hacia ella: el sombreado de tres escalones cae sobre la
  // mata y no sobre cada bolita (si no, cada una sacaba su media luna oscura: un racimo de uvas). `basto`: de lejos, la
  // esfera de 20 triangulos aunque sea grande
  function mechon(c, rad, s, k, col, tinta = 0.007, forma = null, basto = false) {
    const D2 = destino(c.x);
    const T = rad > 0.05 && !basto ? ESF1 : ESF0;
    V1.copy(c).addScaledVector(s.n, rad * k * 0.3);
    E1.copy(UNO).addScaledVector(V2.set(Math.abs(s.n.x), Math.abs(s.n.y), Math.abs(s.n.z)), k - 1).multiplyScalar(rad);
    Q.setFromAxisAngle(s.n, r() * Math.PI);
    const ruidoM = 0.88 + 0.24 * r(), sn = s.n;
    D2.musgo.meter(T, M4.compose(V1, Q, E1), nm, col, (nx, ny, nz) => {
      const fuera = nx * sn.x + ny * sn.y + nz * sn.z;              // 1 de cara, 0 de canto, -1 contra la pared
      return ruidoM * (0.76 + 0.26 * Math.max(0, ny) - 0.08 * Math.max(0, -ny) + 0.12 * Math.max(0, fuera)) * (fuera < 0 ? SOMBRA : 1);
    }, forma || sn, forma ? 0.78 : 0.6);
    if (tinta) D2.tinta.meter(T, M4.compose(V1, Q, E1.addScalar(tinta)), nm);
    cuenta.mechones++;
  }
  // el NUCLEO de una mata: elipsoide muy aplastado contra la pared (semiejes az en z, ay en y), oscuro, que tapa el hormigon
  // entre mechones y lleva la raya de tinta de la silueta (con tinta en cada mechon la mata parecia un racimo de uvas)
  function nucleo(c, az, ay, col, tinta = 0.008) {
    const D2 = destino(c.x);
    V1.copy(c).add(V2.set(0.006, 0, 0));
    E1.set(0.022, ay, az);
    D2.musgo.meter(ESF1, M4.compose(V1, Q.identity(), E1), nm, col, (nx, ny) => 0.62 + 0.12 * ny);
    D2.tinta.meter(ESF1, M4.compose(V1, Q, E1.addScalar(tinta)), nm);
  }
  // un GOTERON de musgo que cuelga desde p: una MATA que se descuelga de un canto, ancha arriba (de 3 a 6 bolitas de
  // lado a lado) y cada vez mas estrecha, corta (de 5 a 17 cm, mas de lejos), con las bolitas muy solapadas y una gota
  // redonda abajo. Antes eran collares largos que se afinaban hasta la punta (el usuario: «picos raros»), y luego hebras
  // y pepinos de una sola columna. Lo largo que cuelga es la hiedra (tallo)
  function gota(p, largo, r0, s, col, fino = false) {
    const D2 = destino(p.x), T = fino ? ESF1 : ESF0;           // fino: las de la salida, que se ven de cerca y a contraluz
    const esc = Math.max(1, r0 / 0.02), ti = 0.005 * esc;
    largo = Math.min(largo, (0.05 + 0.12 * r()) * esc);
    const sem = r() * 100, ancho = r0 * (1.4 + 1.3 * r()), tuerce = (r() - 0.5) * 0.6 * r0;
    Q.identity();
    const bolita = (y, u, rad, t) => {
      V1.copy(p).addScaledVector(s.a, u).add(V2.set(0, -y, 0)).addScaledVector(s.n, rad * 0.45 + 0.015 * t * esc);
      E1.set(rad - rad * 0.3 * Math.abs(s.n.x), rad * 1.05, rad - rad * 0.3 * Math.abs(s.n.z));
      D2.musgo.meter(T, M4.compose(V1, Q, E1), nm, col, (nx, ny) => 0.84 - 0.1 * t + 0.1 * ny);
      D2.tinta.meter(T, M4.compose(V1, Q, E1.set(E1.x + ti, E1.y + ti, E1.z + ti)), nm);
    };
    let y = 0, centro = 0;
    while (y < largo) {
      const t = y / largo, mitad = ancho * (1 - 0.72 * t), n = Math.max(1, Math.round(mitad / r0 * 1.3));
      for (let k = 0; k < n; k++) {
        const u = centro + (n === 1 ? 0 : (k / (n - 1) - 0.5) * 2 * mitad) + (r() - 0.5) * r0 * 0.5;
        const rad = r0 * (0.75 + 0.45 * ruido(y * 23 + k * 3.1 + sem, 3)) * (1 - 0.3 * t);
        bolita(y + rad * 0.6 + (r() - 0.5) * rad * 0.5, u, rad, t);
      }
      area.colgante += 2 * mitad * r0 * 0.85;
      centro += tuerce * 0.3;
      y += r0 * 0.85;
    }
    const rf = r0 * 0.68;
    bolita(y + rf * 0.4, centro + tuerce * 0.5, rf, 1);
    area.colgante += Math.PI * rf * rf;
    cuenta.gotas++;
  }
  // una hoja de hiedra con su ribete oscuro detras; devuelve lo que tapa (la forma de cinco lobulos mide ~2 tam^2)
  function hoja(p, tam, s, col) {
    const D2 = destino(p.x);
    // mira hacia fuera, algo caida y girada
    V2.copy(s.n).addScaledVector(s.b, -0.35 - 0.3 * r()).addScaledVector(s.a, (r() - 0.5) * 0.9).normalize();
    Q2.setFromUnitVectors(Z, V2);
    Q.setFromAxisAngle(V2, (r() - 0.5) * 1.4).multiply(Q2);
    const kk = 0.88 + 0.14 * r();
    D2.musgo.meter(HOJA_P, M4.compose(V1.copy(p).addScaledVector(s.n, 0.012), Q, E1.set(tam, tam, tam)), nm, col, () => kk);
    D2.ribete.meter(HOJA_P, M4.compose(V1.copy(p).addScaledVector(s.n, 0.009), Q, E1.set(tam * 1.14, tam * 1.14, tam)), nm);
    cuenta.hojas++;
    return 2 * tam * tam;
  }
  // un tallo de hiedra que cuelga desde p con hojas alternas (colgante); esc agranda hojas y tallo de lejos
  function tallo(p, largo, s, esc = 1) {
    const a = p.clone(), b = new THREE.Vector3(), d = new THREE.Vector3();
    const D2 = destino(p.x);
    let lado = 0;
    const nT = Math.max(4, Math.round(largo / (0.08 * esc)));
    for (let i = 0; i < nT; i++) {
      lado += (r() - 0.5) * 0.03 * esc;
      b.copy(a).add(V2.set(0, -largo / nT, 0)).addScaledVector(s.a, lado * 0.4).addScaledVector(s.n, 0.002);
      d.subVectors(b, a);
      const L2 = d.length();
      Q.setFromUnitVectors(Yv, d.normalize());
      D2.musgo.meter(CIL, M4.compose(V1.copy(a).add(b).multiplyScalar(0.5), Q, E1.set(0.0065 * esc, L2, 0.0065 * esc)), nm, cTallo);
      area.colgante += 0.013 * esc * L2;
      if (i % 2 === 1 || r() < 0.3) area.colgante += hoja(b.clone().addScaledVector(s.a, (i % 4 < 2 ? 1 : -1) * 0.03 * esc), (0.028 + 0.02 * r()) * esc, s, colorHoja());
      a.copy(b);
    }
  }
  // la mancha de humedad: un rectangulo en el muro (z0..z1, y0..y1) con la textura de mancha y chorreones
  const hueco = huecos.find((h) => Math.abs(h[0] + h[1]) < 0.01 && h[2] < 0 && h[2] > -0.5);   // el de la salida del conducto
  function mancha(z0, z1, y0, y1) {
    L.manchas.push(...planosMancha(MX + 0.003, z0, z1, y0, y1, hueco ? [hueco] : []));
  }

  // ------------------------------------------------------------- la humedad de la cara del muro
  // fondo de ruido estirado en vertical y deformado (manchas que no salen redondas) mas las fuentes de agua. La capa
  // crece donde pasa de UMBRAL; las almohadillas, donde pasa de largo
  function humedad(z, y) {
    const wz = z + 1.4 * (fbm2(z * 0.31 + 3.1, y * 0.19, 1, 2) - 0.5), wy = y + 1.0 * (fbm2(z * 0.27, y * 0.23 + 7.7, 2, 2) - 0.5);
    const f = 0.5 * fbm2(wz * 0.62, wy * 0.36, 3, 4);
    let s = 0.22 * suave(0.58, 0.82, fbm2(z * 0.11 + 40, y * 0.13, 4, 3));           // manchas sueltas por cualquier parte
    const dc = COR0 - y;                                                             // bajo la coronacion
    if (dc > 0 && dc < 9) s += 0.62 * Math.exp(-dc / 2.6) * (0.35 + 0.8 * ruido(z * 1.3, 11));
    for (const yc of [-9.27, -21.27]) {                                              // bajo los cinturones
      const d = yc - y;
      if (d > 0 && d < 8) s += 0.42 * Math.exp(-d / 1.4) * (0.35 + 0.8 * ruido(z * 1.1 - yc, 12));
    }
    for (const g of GARG) {                                                          // el chorreon de cada gargola
      const dz = Math.abs(z - g.z), d = g.y - y;
      if (dz < 0.7 && d > 0 && d < 11) s += 0.45 * (1 - dz / 0.7) * Math.exp(-d / 5);
    }
    const dt = -5.75 - y;                                                            // bajo la tuberia general (gotea)
    if (dt > 0 && dt < 6 && z > -19.4 && z < 9.4) s += 0.4 * Math.exp(-dt / 1.8) * (0.3 + 0.9 * ruido(z * 1.7, 16));
    const ds = y - (G + 3);                                                          // el pie: la humedad sube del suelo
    if (ds < 10) s += 0.55 * Math.exp(-Math.max(0, ds) / 2.8);
    for (const bz of BAJANTES) {                                                     // bajantes: mas bajo cada abrazadera
      const dz = Math.abs(z - bz);
      if (dz < 1.1) s += (1 - dz / 1.1) * (0.16 + 0.3 * Math.exp(-(Math.ceil(y / 4) * 4 - y) / 1.2)) * (0.4 + 0.8 * ruido(y * 0.9 + bz, 13));
    }
    for (const c of CF) {                                                            // los rincones de los contrafuertes
      const dz = Math.abs(Math.abs(z - c) - 0.7);
      if (dz < 0.9) s += 0.3 * (1 - dz / 0.9) * (0.5 + 0.6 * ruido(y * 0.7 + c, 14));
    }
    if (Math.abs(z) < 5 && y < 2.6 && y > -9) s += 0.55 * Math.exp(-(z * z) / 5) * (y < 0 ? Math.exp(y / 3.2) : 0.6);   // la salida
    const my = ((y % 3) + 3) % 3, mz = (((z - 1.5) % 3) + 3) % 3;                   // las juntas de los paneles, a ratos
    const dj = Math.min(my, 3 - my, mz, 3 - mz);
    if (dj < 0.1) s += 0.3 * (1 - dj / 0.1) * suave(0.38, 0.66, ruido2(z * 0.9, y * 0.9, 15));
    return f + s;
  }
  // las caras donde crece (todas miran a +x): el muro, los dos escalones del zocalo y la cara de los contrafuertes
  const HZ = 40;
  const CARAS = [
    { x: MX, z0: -HZ, z1: HZ, y0: G + 3, y1: COR0 - 0.01, extra: 0, huecos },
    { x: MX + 0.95, z0: -HZ, z1: HZ, y0: G + 0.03, y1: G + 2, extra: 0.12, huecos: [] },
    { x: MX + 0.5, z0: -HZ, z1: HZ, y0: G + 2, y1: G + 3, extra: 0.08, huecos: CF.map((c) => [c - 0.87, c + 0.87, G + 1.9, G + 3.1]) },
    ...CF.filter((c) => Math.abs(c) < HZ).map((c) => ({ x: MX + 0.9, z0: c - 0.7, z1: c + 0.7, y0: G + 3, y1: COR0 - 0.01, extra: 0.04, huecos: [] })),
  ];
  const fuera = (hs, z, y) => { for (const h of hs) if (z > h[0] && z < h[1] && y > h[2] && y < h[3]) return true; return false; };
  const valorCara = (cara, z, y) => (fuera(cara.huecos, z, y) ? -0.5 : humedad(z, y) + cara.extra - UMBRAL);

  // ------------------------------------------------------------- la CAPA PLANA
  // cuadrados que marchan sobre una reticula por baldosa; los vertices de nodos y aristas se comparten dentro de la baldosa
  const CP = new Crece(1 << 18), CN = new Crece(1 << 18), CC = new Crece(1 << 18), CI = new Crece(1 << 18, Uint32Array);
  const PAL = PLANOS.map((c) => new THREE.Color(c)), cTmp = new THREE.Color();
  function capa(cara) {
    const TT = 1.5;
    for (let z0 = cara.z0; z0 < cara.z1 - 1e-6; z0 += TT) for (let y0 = cara.y0; y0 < cara.y1 - 1e-6; y0 += TT) {
      const z1 = Math.min(cara.z1, z0 + TT), y1 = Math.min(cara.y1, y0 + TT);
      const hs = cara.huecos.filter((h) => h[1] > z0 - 0.1 && h[0] < z1 + 0.1 && h[3] > y0 - 0.1 && h[2] < y1 + 0.1);
      const valor = (z, y) => (fuera(hs, z, y) ? -0.5 : humedad(z, y) + cara.extra - UMBRAL);
      let max = -9;
      for (let a = 0; a <= 5; a++) for (let b = 0; b <= 5; b++) max = Math.max(max, valor(z0 + (z1 - z0) * a / 5, y0 + (y1 - y0) * b / 5));
      if (max < -0.1) continue;
      const c = celda(lejos((z0 + z1) / 2, (y0 + y1) / 2));
      const nz = Math.max(1, Math.round((z1 - z0) / c)), ny = Math.max(1, Math.round((y1 - y0) / c));
      const dz = (z1 - z0) / nz, dy = (y1 - y0) / ny, W = nz + 1;
      const Vv = new Float32Array(W * (ny + 1)), Hh = new Float32Array(W * (ny + 1));
      for (let j = 0; j <= ny; j++) for (let i = 0; i <= nz; i++) {
        const z = z0 + i * dz, y = y0 + j * dy, v = valor(z, y);
        Vv[j * W + i] = v;
        Hh[j * W + i] = v > 0 ? 0.004 + 0.014 * suave(0, 0.3, v) + 0.004 * ruido2(z * 21, y * 21, 21) : 0.004;
      }
      const iN = new Int32Array(W * (ny + 1)).fill(-1), iH = new Int32Array(nz * (ny + 1)).fill(-1), iV = new Int32Array(W * ny).fill(-1);
      const grad = (i, j) => {
        const i0 = Math.max(0, i - 1), i1 = Math.min(nz, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(ny, j + 1);
        return [(Hh[j * W + i1] - Hh[j * W + i0]) / (dz * (i1 - i0)), (Hh[j1 * W + i] - Hh[j0 * W + i]) / (dy * (j1 - j0))];
      };
      // un vertice: posicion sobre la cara, normal por la pendiente del grosor, color por el sitio y oscuro en el borde
      const nuevo = (z, y, h, gz, gy, v) => {
        const k = CP.n / 3;
        CP.hueco(3); CN.hueco(3); CC.hueco(3);
        CP.a[CP.n++] = cara.x + h; CP.a[CP.n++] = y; CP.a[CP.n++] = z;
        let nx = 1, ny2 = -0.6 * gy, nz2 = -0.6 * gz; const l = Math.hypot(nx, ny2, nz2); nx /= l; ny2 /= l; nz2 /= l;
        CN.a[CN.n++] = nx; CN.a[CN.n++] = ny2; CN.a[CN.n++] = nz2;
        const t = ruido2(z * 0.3, y * 0.3, 31) * (PAL.length - 1), q = Math.min(PAL.length - 2, Math.floor(t));
        cTmp.copy(PAL[q]).lerp(PAL[q + 1], t - q);
        const brillo = (0.78 + 0.3 * suave(0, 0.3, v)) * (0.9 + 0.2 * ruido2(z * 37, y * 37, 32)) * (0.5 + 0.5 * suave(0, 0.06, v));
        CC.a[CC.n++] = cTmp.r * brillo; CC.a[CC.n++] = cTmp.g * brillo; CC.a[CC.n++] = cTmp.b * brillo;
        return k;
      };
      const nodo = (i, j) => {
        const k = j * W + i;
        if (iN[k] < 0) { const g = grad(i, j); iN[k] = nuevo(z0 + i * dz, y0 + j * dy, Hh[k], g[0], g[1], Vv[k]); }
        return iN[k];
      };
      const arista = (i0, j0, i1, j1, tab, k) => {
        if (tab[k] < 0) {
          const va = Vv[j0 * W + i0], vb = Vv[j1 * W + i1], t = va / (va - vb);
          const ga = grad(i0, j0), gb = grad(i1, j1);
          tab[k] = nuevo(z0 + (i0 + (i1 - i0) * t) * dz, y0 + (j0 + (j1 - j0) * t) * dy, 0.004, ga[0] + (gb[0] - ga[0]) * t, ga[1] + (gb[1] - ga[1]) * t, 0);
        }
        return tab[k];
      };
      const pol = [];
      for (let j = 0; j < ny; j++) for (let i = 0; i < nz; i++) {
        const v4 = [Vv[j * W + i], Vv[j * W + i + 1], Vv[(j + 1) * W + i + 1], Vv[(j + 1) * W + i]];
        if (v4[0] <= 0 && v4[1] <= 0 && v4[2] <= 0 && v4[3] <= 0) continue;
        pol.length = 0;
        // a (i,j) -> b (i+1,j) -> c (i+1,j+1) -> d (i,j+1): las aristas con sus extremos en orden fijo, para compartirlas
        const esq = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
        const ar = [() => arista(i, j, i + 1, j, iH, j * nz + i), () => arista(i + 1, j, i + 1, j + 1, iV, j * W + i + 1),
          () => arista(i, j + 1, i + 1, j + 1, iH, (j + 1) * nz + i), () => arista(i, j, i, j + 1, iV, j * W + i)];
        for (let q = 0; q < 4; q++) {
          if (v4[q] > 0) pol.push(nodo(esq[q][0], esq[q][1]));
          if ((v4[q] > 0) !== (v4[(q + 1) % 4] > 0)) pol.push(ar[q]());
        }
        // abanico con la vuelta al reves (asi la cara mira a +x) y su area en el plano de la cara
        CI.hueco(3 * (pol.length - 2));
        let s2 = 0;
        for (let m = 0; m < pol.length; m++) {
          const A = pol[m], B = pol[(m + 1) % pol.length];
          s2 += CP.a[A * 3 + 2] * CP.a[B * 3 + 1] - CP.a[B * 3 + 2] * CP.a[A * 3 + 1];
          if (m >= 1 && m < pol.length - 1) { CI.a[CI.n++] = pol[0]; CI.a[CI.n++] = pol[m + 1]; CI.a[CI.n++] = pol[m]; }
        }
        area.capa += Math.abs(s2) / 2;
      }
    }
  }

  // ------------------------------------------------------------- las formas con volumen
  // una ALMOHADILLA en una cara: los mechones rellenan una mancha de borde irregular; centro (z, y), semiejes (az, ay);
  // opc.x = cara - MX, opc.esc = escala de lejos. Cuenta lo que tapa (las celdas de mechon que entran)
  function colchon(z, y, az, ay, opc = {}) {
    const s = SUP.muro, col = colorAzar(), esc = opc.esc || 1, x = MX + (opc.x || 0);
    const paso = (opc.paso || 0.055) * esc, semilla = Math.floor(r() * 1000);
    let celdas = 0;
    nucleo(new THREE.Vector3(x, y, z), az * 0.78, ay * 0.78, col, 0.008 * esc);
    for (let v = -ay; v <= ay; v += paso * 0.82) {
      for (let u = -az; u <= az; u += paso) {
        const uu = u + (r() - 0.5) * paso * 0.8, vv = v + (r() - 0.5) * paso * 0.8;
        const ang = Math.atan2(vv / ay, uu / az), borde = 0.72 + 0.4 * ruido(ang * 2.2 + 7, semilla);
        const d = Math.hypot(uu / az, vv / ay);
        if (d > borde) continue;
        const rad = (0.03 + 0.05 * r() * r()) * (1.35 - 0.75 * d / borde) * (opc.escala || 1) * esc;
        const cup = new THREE.Vector3(1, 0.75 * vv / ay, 0.75 * uu / az).normalize();
        mechon(new THREE.Vector3(x, y + vv, z + uu), rad, s, 0.62 + 0.15 * (1 - d / borde), col, d / borde > 0.78 ? 0.006 * esc : 0, cup, esc > 1.8);
        celdas++;
      }
    }
    const a = celdas * paso * paso * 0.82;
    area.voluminoso += a;
    if (opc.sobreCapa ?? valorCara(CARAS[0], z, y) > 0) area.tapada += a;
    cuenta.almohadillas++;
    if (opc.gotas) for (let i = 0; i < opc.gotas; i++) gota(new THREE.Vector3(x + 0.02, y - ay * (0.55 + 0.3 * r()), z + (r() - 0.5) * az * 1.5), (0.15 + 0.45 * r()) * Math.sqrt(esc), 0.024 * esc, s, col);
    if (opc.hojas) for (let i = 0; i < opc.hojas; i++) {
      const an = r() * Math.PI * 2, dd = Math.sqrt(r()) * 0.8;
      hoja(new THREE.Vector3(x + 0.03, y + Math.sin(an) * ay * dd, z + Math.cos(an) * az * dd), (0.03 + 0.025 * r()) * esc, s, colorHoja());
    }
    if (opc.tallos) for (let i = 0; i < opc.tallos; i++) tallo(new THREE.Vector3(x + 0.02, y - ay * 0.6, z + (r() - 0.5) * az * 1.4), 0.3 + 0.6 * r(), s, esc);
    if (opc.mancha) mancha(z - az * 1.5, z + az * 1.5, y - ay - (opc.chorreo ?? 0.9), y + ay * 1.3);
  }
  // un FLECO bajo una cornisa (cara de abajo en yTecho): banda de alto variable, goterones donde baja y tallos de hiedra.
  // Es colgante: cuenta su banda y lo que cuelga de ella
  function fleco(z0, z1, yTecho, alto, factor = () => 1, labio = 0.55) {
    const s = SUP.muro, col = colorAzar();
    const semilla = Math.floor(r() * 1000);
    for (let z = z0 + 0.25; z <= z1 - 0.2; z += 0.4) {
      const t = (z - z0) / (z1 - z0), env = Math.pow(Math.sin(Math.PI * t), 0.45), h = alto * 0.55 * env * factor(z);
      if (h > 0.03) nucleo(new THREE.Vector3(MX, yTecho - 0.02 - h * 0.5, z), 0.26, h * 0.55, col);
    }
    for (let z = z0; z <= z1; z += 0.05) {
      const t = (z - z0) / (z1 - z0), env = Math.pow(Math.sin(Math.PI * t), 0.45);
      const h = alto * (0.3 + 0.7 * ruido(z * 1.9, semilla)) * env * factor(z);
      area.colgante += h * 0.05;
      for (let v = 0; v < h; v += 0.045) mechon(new THREE.Vector3(MX, yTecho - 0.02 - v, z + (r() - 0.5) * 0.04), (0.026 + 0.03 * r()) * (1.1 - 0.4 * v / Math.max(h, 0.01)), s, 0.6, col, v + 0.07 > h ? 0.006 : 0,
        new THREE.Vector3(1, -0.9 * v / Math.max(h, 0.01), 0).normalize());
      if (h > alto * 0.55 && factor(z) > 0.5 && r() < 0.16) gota(new THREE.Vector3(MX + 0.02, yTecho - h - 0.01, z), 0.2 + 0.7 * r() * (h / alto), 0.022, s, col);
      if (factor(z) > 0.5 && r() < 0.035) tallo(new THREE.Vector3(MX + 0.02, yTecho - h * 0.6, z), 0.35 + 0.8 * r(), s);
      if (r() < 0.22) hoja(new THREE.Vector3(MX + 0.03, yTecho - 0.02 - r() * h, z), 0.03 + 0.02 * r(), s, colorHoja());
      // y por el canto de delante de la cornisa asoma un poco
      if (env > 0.5 && r() < 0.25) mechon(new THREE.Vector3(MX + labio, yTecho + 0.02 + r() * 0.08, z), 0.025 + 0.02 * r(), s, 0.6, col, 0.006);
    }
  }
  // un COJIN encima de una cornisa (de x 18 a 18 + fondo, a la altura y): lo que crece donde se queda el agua (almohadilla)
  function encima(z0, z1, y, fondo = 0.42) {
    const s = SUP.arriba, col = colorAzar(1.08);
    for (let z = z0; z <= z1; z += 0.06) {
      const t = (z - z0) / (z1 - z0), ancho = fondo * Math.pow(Math.sin(Math.PI * t), 0.6);
      for (let x = 0; x < ancho; x += 0.06) {
        mechon(new THREE.Vector3(MX + 0.03 + x, y, z + (r() - 0.5) * 0.05), 0.03 + 0.03 * r(), s, 0.45, col, x + 0.07 > ancho ? 0.006 : 0,
          new THREE.Vector3(0.6 * x / Math.max(ancho, 0.01), 1, 0).normalize());
        area.voluminoso += 0.06 * 0.06;
      }
    }
  }
  // una CORTINA colgante: n goterones y algun tallo de hiedra que bajan de un canto (x, y) a lo ancho de z +- ancho/2
  function cortina(x, y, z, ancho, n, esquina, esc) {
    const col = colorAzar();
    for (let k = 0; k < n; k++) {
      const p = new THREE.Vector3(x, y - 0.005, z + (r() - 0.5) * ancho);
      const largo = (0.18 + 0.7 * r() * r()) * (esquina ? 1.5 : 1) * Math.sqrt(esc);
      if (r() < (esc < 2 ? 0.45 : 0.25)) tallo(p, largo * 1.3, SUP.muro, esc);
      else gota(p, largo, (0.016 + 0.01 * r()) * esc, SUP.muro, col);
    }
    cuenta.colgantes++;
  }

  // ------------------------------------------------------------- 1. la capa plana
  for (const cara of CARAS) capa(cara);
  const plano = () => area.capa - area.tapada;           // lo que se ve de la capa
  const caraMuro = CARAS.reduce((s, c) => s + (c.z1 - c.z0) * (c.y1 - c.y0), 0);

  // ------------------------------------------------------------- 2. lo puesto a mano junto a la salida y la base
  // (la salida del conducto: el agua sale por ella, asi que el musgo sube por los lados del marco, cuelga de las esquinas
  // de arriba y escurre por debajo del rellano)
  colchon(-1.12, 0.55, 0.2, 0.55, { hojas: 5 });
  colchon(-1.35, 1.25, 0.16, 0.3, { hojas: 3, escala: 0.85 });
  colchon(1.1, 0.4, 0.16, 0.42, { hojas: 3 });
  mancha(-1.9, 1.9, -1.6, 2.4);
  // las matas que cuelgan del dintel de la salida (la caja de arriba del marco: x 18 a 18,12, y 1,8 a 1,92) y se ven a
  // contraluz desde el conducto. Van COSIDAS al resto: el musgo baja de la visera por la pared hasta el dintel, lo
  // abraza por encima, por delante y por debajo, y de ahi cuelga la mata. Antes salian de debajo del dintel con cuatro
  // mechones encima que desde abajo no se veian: parecian flotar (el usuario: «conectalo mejor»)
  const SUP_abajo = { n: new THREE.Vector3(0, -1, 0), a: new THREE.Vector3(0, 0, 1), b: new THREE.Vector3(1, 0, 0) };
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  for (const [z, l] of [[-0.66, 0.42], [0.58, 0.3], [-0.2, 0.12]]) {
    const col = new THREE.Color(MUSGOS[0]), ancho = 0.08 + 0.05 * r(), yd = HC + 0.12;
    // la tira por la pared, de la visera al dintel: mas ancha arriba, donde gotea la visera, y abajo, donde se junta
    for (let y = yd; y < 2.26; y += 0.028) {
      const t = (y - yd) / (2.26 - yd), w = ancho * (0.5 + 0.5 * Math.abs(2 * t - 1)), zc = z + 0.02 * Math.sin(y * 21 + z * 7);
      for (let u = -w; u <= w + 1e-6; u += 0.034) mechon(V3(MX, y, zc + u + (r() - 0.5) * 0.015), 0.021 + 0.013 * r(), SUP.muro, 0.6, col, Math.abs(u) > w - 0.035 ? 0.005 : 0);
      area.voluminoso += 2 * w * 0.028;
    }
    // por la cara de delante del dintel, una almohadilla de borde irregular que se desborda un poco por arriba y por
    // abajo (en filas parecia un cordon); encima y por debajo, mechones sueltos, de donde cuelga la mata
    colchon(z, HC + 0.06, ancho, 0.075, { x: 0.12, escala: 0.8, paso: 0.042, sobreCapa: false });
    for (let k = 0; k < 7; k++) mechon(V3(MX + 0.02 + 0.08 * r(), yd, z + (r() * 2 - 1) * ancho), 0.022 + 0.014 * r(), SUP.arriba, 0.55, col, 0.005);
    for (let k = 0; k < 5; k++) mechon(V3(MX + 0.02 + 0.08 * r(), HC, z + (r() * 2 - 1) * ancho * 0.6), 0.02 + 0.012 * r(), SUP_abajo, 0.55, col, 0.005);
    area.voluminoso += 2 * ancho * 0.2;
    gota(V3(MX + 0.06, HC - 0.012, z), l, 0.022, SUP.muro, col, true);
  }
  // la visera de la salida: fleco con goterones en las esquinas, cojin encima y dos tallos
  fleco(-1.48, 1.48, 2.25, 0.2, (z) => Math.abs(z) < 0.55 ? 0.35 : 1, 0.38);
  encima(-1.45, 1.45, 2.45, 0.34);
  for (const z of [-1.4, -1.25, 1.2, 1.4]) gota(new THREE.Vector3(MX + 0.03, 2.05, z), 0.35 + 0.35 * r(), 0.024, SUP.muro, new THREE.Color(MUSGOS[1]), true);
  for (const z of [-1.1, 1.05]) tallo(new THREE.Vector3(MX + 0.03, 2.1, z), 0.7 + 0.4 * r(), SUP.muro);
  mancha(-2.1, 2.1, 0.2, 2.25);
  colchon(0, -0.35, 0.7, 0.22, { gotas: 5 });
  mancha(-1.2, 1.2, -2.6, 0);
  // las abrazaderas de las bajantes junto a la base y donde los tirantes de rellano y pasarela tocan el muro
  for (const [z, y] of [[-8.8, 0.06], [-8.8, 4.06], [6.4, 4.06], [6.4, 0.06], [-8.8, -3.94]]) colchon(z, y, 0.26, 0.12, { hojas: 2, gotas: 1 });
  for (const [z, y] of [[-2.4, -3.6], [2.4, -3.6], [0, -3.6], [-6.5, -2.2], [-12.5, -2.2]]) colchon(z, y, 0.22, 0.13, { gotas: 1 });
  // encima del cinturon de -9 bajo la base (se ve mirando abajo)
  for (const [z0, z1] of [[-2.5, 0.5], [3.2, 5.6]]) encima(z0, z1, -8.75);

  // ------------------------------------------------------------- 3. almohadillas hasta su parte (20 frente a 70)
  // salen de lo mas espeso de la capa: candidatos en una reticula con temblor, menos (y mas gordos) cuanto mas lejos, y en
  // orden al azar pesado por la humedad que sobra
  const cand = [];
  for (const cara of CARAS) {
    for (let z = cara.z0 + 0.2; z < cara.z1 - 0.2; z += 0.3) for (let y = cara.y0 + 0.15; y < cara.y1 - 0.15; y += 0.3) {
      const zz = z + (r() - 0.5) * 0.28, yy = y + (r() - 0.5) * 0.28, e = escalaLOD(lejos(zz, yy));
      if (r() > 1 / Math.sqrt(e)) continue;
      const v = valorCara(cara, zz, yy);
      if (v < 0.12) continue;
      cand.push({ cara, z: zz, y: yy, e, k: Math.pow(r(), 1 / v) });
    }
  }
  cand.sort((a, b) => b.k - a.k);
  const puestos = new Map();                                  // rejilla de 1 m -> almohadillas (para que no se pisen)
  const clave = (x, z, y) => `${x.toFixed(2)}|${Math.floor(z)}|${Math.floor(y)}`;
  for (const c of cand) {
    if (area.voluminoso >= plano() * 2 / 7) break;
    const az = (0.07 + 0.16 * Math.pow(r(), 1.6)) * c.e, ay = az * (0.55 + 0.4 * r());
    let pisa = false;
    for (let dz = -1; dz <= 1 && !pisa; dz++) for (let dy = -1; dy <= 1 && !pisa; dy++) {
      for (const p of puestos.get(clave(c.cara.x, c.z + dz, c.y + dy)) || []) if (Math.abs(p.z - c.z) < (p.az + az) * 1.25 && Math.abs(p.y - c.y) < (p.ay + ay) * 1.4) { pisa = true; break; }
    }
    if (pisa) continue;
    // entera dentro de la capa, que no asome por su borde
    if ([[az, 0], [-az, 0], [0, ay], [0, -ay]].some(([a, b]) => valorCara(c.cara, c.z + a * 0.8, c.y + b * 0.8) < 0.02)) continue;
    const k = clave(c.cara.x, c.z, c.y);
    if (!puestos.has(k)) puestos.set(k, []);
    puestos.get(k).push({ z: c.z, y: c.y, az, ay });
    colchon(c.z, c.y, az, ay, { x: c.cara.x - MX, esc: c.e, sobreCapa: true, hojas: c.e < 1.6 && r() < 0.5 ? 1 + Math.floor(r() * 3) : 0 });
  }

  // ------------------------------------------------------------- 4. colgante hasta su parte (10 frente a 70)
  // de las esquinas y de lo de arriba; las esquinas pesan mas en el orden y llevan cortinas mas largas y tupidas
  const A = [];
  const EZ = sitios.escalaZ;
  for (let z = -HZ; z <= HZ; z += 0.9) if (Math.abs(z - EZ) > 0.65) A.push({ x: MX + 1.0, y: COR0 - 0.03, z, ancho: 0.5, peso: 1 });      // labio de la coronacion
  for (const zz of [EZ - 0.62, EZ + 0.62]) A.push({ x: MX + 1.0, y: COR0 - 0.03, z: zz, ancho: 0.2, peso: 5 });                         // el hueco de la escala
  for (const c of CF) if (Math.abs(c) < HZ) for (const sg of [-1, 1]) A.push({ x: MX + 0.9, y: COR0, z: c + sg * 0.76, ancho: 0.25, peso: 3 });   // rincones de los contrafuertes
  for (const g of sitios.garitas) for (const sg of [-1, 1]) {
    A.push({ x: MX + 2.45, y: D.TOPE_Y - 0.16, z: g + sg * 1.25, ancho: 0.3, peso: 4 });                                              // esquinas del suelo de la garita
    A.push({ x: MX + 0.06, y: D.TOPE_Y - 2.6, z: g + sg * 1.1, ancho: 0.2, peso: 3 });                                                // donde su tornapunta toca el muro
  }
  for (const yc of [-9.27, -21.27]) {
    for (let z = -HZ; z <= HZ; z += 1.1) A.push({ x: MX + 0.45, y: yc, z, ancho: 0.5, peso: 0.8 });                                     // goteron del cinturon
    for (const c of CF) if (Math.abs(c) < HZ) for (const sg of [-1, 1]) A.push({ x: MX + 0.5, y: yc, z: c + sg * 0.78, ancho: 0.25, peso: 3 });
  }
  for (const g of GARG) A.push({ x: MX + 1.18, y: g.y, z: g.z, ancho: 0.1, peso: 3 });
  for (const [a, b] of sitios.bandeja) {                                                                                               // la bandeja de cables
    if (b < -HZ || a > HZ) continue;
    for (let z = a + 0.3; z < b - 0.3; z += 0.8) A.push({ x: MX + 0.45, y: 3.55, z, ancho: 0.4, peso: 1 });
    A.push({ x: MX + 0.45, y: 3.55, z: a + 0.08, ancho: 0.12, peso: 4 }, { x: MX + 0.45, y: 3.55, z: b - 0.08, ancho: 0.12, peso: 4 });
  }
  for (const e of sitios.escotillas) for (const sg of [-1, 1]) A.push({ x: MX + 0.12, y: e.y - 0.12, z: e.z + sg * 0.86, ancho: 0.12, peso: 3 });
  if (sitios.balcon) {
    const b = sitios.balcon;
    for (const sg of [-1, 1]) A.push({ x: b.x - 0.02, y: b.y, z: b.z + sg * (b.ancho - 0.03), ancho: 0.15, peso: 4 });
    A.push({ x: b.x - 0.02, y: b.y, z: b.z, ancho: 0.8, peso: 1.5 });
  }
  for (const rj of sitios.rejillas) for (const sg of [-1, 1]) A.push({ x: MX + 0.09, y: rj.y0, z: rj.z + sg * (rj.w / 2 - 0.04), ancho: 0.08, peso: 2 });
  for (const z of [-1.2, 1.2]) A.push({ x: MX + 1.1, y: D.TOPE_Y - 1.0, z, ancho: 0.1, peso: 3 });                                  // tirantes de la pasarela
  for (const a of A) a.k = Math.pow(r(), 1 / a.peso);
  A.sort((p, q) => q.k - p.k);
  for (const a of A) {
    if (area.colgante >= plano() / 7) break;
    const e = escalaLOD(lejos(a.z, a.y)), esquina = a.peso >= 3;
    cortina(a.x, a.y, a.z, a.ancho, esquina ? 2 + Math.floor(r() * 3) : 1 + Math.floor(r() * 2), esquina, e);
  }

  // ------------------------------------------------------------- dentro del conducto, junto a la salida
  // en el suelo pegado a las paredes y al pie de ellas, donde llega la luz de fuera
  for (let x = D.CONDUCTO.x1 - 1.8; x < MX - 0.05; x += 0.06) {
    const k = (x - (MX - 1.8)) / 1.8;
    for (const [z, s] of [[-W2 + 0.04, SUP.fondo], [W2 - 0.04, SUP.delante]]) {
      if (ruido(x * 3 + z, 9) < 0.55 - 0.35 * k) continue;
      mechon(new THREE.Vector3(x, 0.01, z - Math.sign(z) * r() * 0.08), 0.025 + 0.03 * r() * k, SUP.arriba, 0.5, new THREE.Color(MUSGOS[3]), 0.005);
      if (r() < 0.4 * k) mechon(new THREE.Vector3(x, 0.05 + r() * 0.2 * k, z + Math.sign(z) * 0.0), 0.022 + 0.02 * r(), s, 0.55, new THREE.Color(MUSGOS[3]), 0.005);
    }
  }

  // ------------------------------------------------------------- mallas
  const mMusgo = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradiente, side: THREE.DoubleSide });
  const mCapa = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradiente, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  const mTinta = new THREE.MeshBasicMaterial({ color: '#0b0a0c', side: THREE.BackSide });
  const mRibete = new THREE.MeshBasicMaterial({ color: '#1b1d14', side: THREE.DoubleSide });
  const grupo = new THREE.Group();
  grupo.name = 'musgo';
  let tris = 0, bytes = 0;
  const contar = (g) => { tris += g.index.count / 3; for (const a of Object.values(g.attributes)) bytes += a.array.byteLength; bytes += g.index.array.byteLength; };
  const malla = (lote, mat, sombra) => {
    if (lote.vacio) return null;
    const g = lote.geometria();
    contar(g);
    const m = new THREE.Mesh(g, mat);
    m.castShadow = sombra; m.receiveShadow = sombra;
    return m;
  };
  for (const m of [malla(L.musgo, mMusgo, true), malla(L.tinta, mTinta, false), malla(L.ribete, mRibete, false)]) if (m) grupo.add(m);
  // la capa: recibe sombra (las torres la cruzan como al hormigon) pero no la echa (es una lamina)
  const gCapa = new THREE.BufferGeometry();
  gCapa.setAttribute('position', new THREE.BufferAttribute(CP.final(), 3));
  gCapa.setAttribute('normal', new THREE.BufferAttribute(CN.final(), 3));
  gCapa.setAttribute('color', new THREE.BufferAttribute(CC.final(), 3));
  gCapa.setIndex(new THREE.BufferAttribute(CI.final(), 1));
  gCapa.computeBoundingSphere();
  contar(gCapa);
  const trisCapa = gCapa.index.count / 3;
  const capaM = new THREE.Mesh(gCapa, mCapa);
  capaM.receiveShadow = true;
  grupo.add(capaM);
  // las manchas de humedad: oscurecen el hormigon (se pintan antes que el musgo y sin escribir profundidad)
  const tMancha = texturaMancha();
  const manchas = new THREE.Mesh(mergeGeometries(L.manchas), new THREE.MeshBasicMaterial({ color: '#161b20', alphaMap: tMancha, transparent: true, opacity: 0.62, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  manchas.renderOrder = -1;
  grupo.add(manchas);
  scene.add(grupo);
  // dentro del conducto: con el sombreado del conducto (solo los alumbra el 18 y la salida) y colgados de su tramo
  const mDentro = materialConducto('#ffffff', true, false, true), mDentroT = materialConducto('#000000', true, true);
  for (const [k, d] of dentro) {
    const tr = tramos[k];
    if (!tr) continue;
    for (const [lote, mat] of [[d.musgo, mDentro], [d.tinta, mDentroT]]) {
      const m = malla(lote, mat, false);
      if (!m) continue;
      m.position.z = W2;                 // el grupo del tramo tiene el pivote en la pared del fondo (z = -0,8)
      tr.grupo.add(m);
    }
  }
  // el reparto medido: lo que se ve de la capa, las almohadillas y lo colgante, en m2 y en %
  const total = plano() + area.voluminoso + area.colgante;
  const pc = (v) => +(100 * v / total).toFixed(1);
  const reparto = {
    plano: pc(plano()), voluminoso: pc(area.voluminoso), colgante: pc(area.colgante),
    m2: { capa: +area.capa.toFixed(1), capaVista: +plano().toFixed(1), voluminoso: +area.voluminoso.toFixed(1), colgante: +area.colgante.toFixed(1) },
    cubre: +(100 * area.capa / caraMuro).toFixed(1),            // % de las caras del muro (z -40..40) que tapa la capa
  };
  return { grupo, tris: Math.round(tris), trisCapa, MB: +(bytes / 1048576).toFixed(1), ...cuenta, reparto, texturas: [tMancha] };
}

// una MANCHA (rectangulo en un plano x = cte que mira a +x, de z0 a z1 y de y0 a y1) partida para que no pase por
// delante de los huecos: era un plano oscuro semitransparente que, sobre el negro del conducto, lo aclaraba como un velo.
// Cada trozo conserva las UV del rectangulo entero, asi la textura no se corta en las juntas
export function planosMancha(x, z0, z1, y0, y1, huecos = []) {
  let trozos = [[z0, z1, y0, y1]];
  for (const [a0, a1, b0, b1] of huecos) {
    const nuevos = [];
    for (const [p0, p1, q0, q1] of trozos) {
      if (a1 <= p0 || a0 >= p1 || b1 <= q0 || b0 >= q1) { nuevos.push([p0, p1, q0, q1]); continue; }
      if (q1 > b1) nuevos.push([p0, p1, b1, q1]);                                    // encima del hueco
      if (q0 < b0) nuevos.push([p0, p1, q0, b0]);                                    // debajo
      const m0 = Math.max(q0, b0), m1 = Math.min(q1, b1);
      if (p0 < a0) nuevos.push([p0, a0, m0, m1]);                                    // a los lados
      if (p1 > a1) nuevos.push([a1, p1, m0, m1]);
    }
    trozos = nuevos;
  }
  return trozos.filter(([p0, p1, q0, q1]) => p1 - p0 > 1e-3 && q1 - q0 > 1e-3).map(([p0, p1, q0, q1]) => {
    const g = new THREE.PlaneGeometry(p1 - p0, q1 - q0).rotateY(Math.PI / 2).translate(x, (q0 + q1) / 2, (p0 + p1) / 2);
    const pos = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (z1 - pos.getZ(i)) / (z1 - z0), (pos.getY(i) - y0) / (y1 - y0));
    return g;
  });
}

// la textura de la mancha de humedad: oscuro arriba con borde a manchurrones y chorreones que bajan (en el canal alfa)
export function texturaMancha() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512;
  const c = cv.getContext('2d');
  const r = azar(77);
  c.fillStyle = '#000'; c.fillRect(0, 0, 256, 512);
  for (let n = 0; n < 26; n++) {
    const x = 50 + r() * 156, y = 60 + r() * 130, rr = 30 + r() * 55;
    const g = c.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, `rgba(255,255,255,${0.25 + r() * 0.25})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  for (let n = 0; n < 22; n++) {
    const x = 40 + r() * 176, y0 = 120 + r() * 100, h = 120 + r() * 260, w = 2 + r() * 7;
    const g = c.createLinearGradient(0, y0, 0, y0 + h);
    g.addColorStop(0, `rgba(255,255,255,${0.35 + r() * 0.3})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(x, y0, w, h);
  }
  const t = new THREE.CanvasTexture(cv);
  return t;
}
