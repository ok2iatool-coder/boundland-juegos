// EL MURO EXTERIOR (2026-10-21, "pon el segundo muro que ya esta hecho"): el muro de 4 m de la escena muro4.html de
// boundland-paso3d (bloques en T, foso, caballon, concertina, puestos de control y saltaderos), llevado al mapa del mundo
// donde lo ponen los planos (diseno/planos/mapa.py, `MURO_EXTERIOR`): a 300 m del muro grande, en un ARCO de radio
// 750 m por la mitad norte (de 0 a 180 grados del plano; por el sur cierran los Cerros), 2,36 km de bloques.
//
// Las piezas no se rehacen: exterior/ son copias de muro4 (bloque.js, lotes.js, piezas.js, texturas.js) y de casetas.js.
// Lo de aqui las reparte:
//   - los BLOQUES: diez bloques distintos (mismo constructor, otra semilla) instanciados a lo largo del arco; a menos de
//     CERCA del 18 con todo su detalle (chaflanes, agujeros, cantos rotos, tinta, pintadas), los demas como una T de cajas.
//     Cada bloque apoya en el suelo de su centro hundido lo que pide la cuesta (nunca flota).
//   - el FOSO (3 x 1,5 m) y el CABALLON de tierra: una banda que sustituye al suelo (el suelo no se dibuja debajo: un
//     `discard` en su sombreador) con el perfil de muro4; agua en el fondo. Se cruza por el TERRAPLEN de cada puesto y
//     del portillo, y por RELLENOS donde se ha venido abajo; sus taludes (56 grados) no se suben.
//   - la CONCERTINA por el borde de fuera del foso: tramos de 6 m instanciados, solo cerca.
//   - lo que se arma a mano (PUESTOS de control donde cruzan la carretera y los caminos, PORTILLO de la senda del lago,
//     SALTADEROS con su chabola): el codigo de muro4 en el marco de su sitio del arco y pegado al suelo.
//   - los CHOQUES: cajas con `ytop` (el pie de la T se pisa a 0,5 y la tapa a 4 m; los trastos de los saltaderos son
//     escalones), en una rejilla; a `cajas` de mundo.js solo van las de alrededor del 18.
//
// Ejes: el plano mide los angulos de este hacia el norte; en el juego z = YC - y. En el marco de un sitio del arco,
// x va a lo largo del muro (hacia angulos menores), z hacia DENTRO (hacia la ciudad) e y arriba, como en muro4.
import * as THREE from 'three';
import * as R from './relieve.js';
import { TONO } from './tono.js';
import { OBRA } from './sitios.js';
import { colorCara } from './suelo.js';
import { T, bloqueT, uvMundo, texturaHormigonT, medioGrueso } from './exterior/bloque.js';
import * as TX from './exterior/texturas.js';
import { crearLotes } from './exterior/lotes.js';
import { caseta } from './exterior/casetas.js';
import { azar, bidon, pale, cajaMadera, nevera, sacos, muroSacos, gavion, erizo, concertina, chapaGrecada, cuerda, cable, coche } from './exterior/piezas.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const RAD = Math.PI / 180;
// de mapa.py: R_EXTERIOR = R_MURO + 300; PUESTOS = donde los CAMINOS cruzan ese radio (carretera, Varga, Linde: puesto;
// la senda del lago: portillo); saltaderos de MURO_EXTERIOR
export const EXTERIOR = {
  cx: 0, cz: R.GEO.YC ?? 2400, r: 750, desde: 0, hasta: 180,
  puestos: [{ ang: 32.95, camino: 'carretera' }, { ang: 91.74, camino: 'varga' }, { ang: 149.9, camino: 'linde' }],
  portillo: 3.28,
  saltaderos: [24, 70, 112, 141, 165],
  rellenos: [12, 21, 47, 58, 68, 80, 101, 115, 126, 138, 158, 174],   // donde el foso se ha venido abajo (y se sale de el)
};
const RE = EXTERIOR.r, CX = EXTERIOR.cx, CZ = EXTERIOR.cz;
const A0 = EXTERIOR.desde * RAD, A1 = EXTERIOR.hasta * RAD;
const HUECO = 2.4;                  // el hueco del puesto: x en [-2,4, 2,4] (muro4)
const PORTILLO = 0.6;               // medio hueco del portillo
const CERCA = 130;                  // m: bloques con todo su detalle
const CERCA_CONC = 140;             // m: concertina
const LEJOS_SITIOS = 450;           // m: puestos y saltaderos se dejan de dibujar (de 68 a 91 mil triangulos cada puesto)
const FOSO = { t0: 1.3, t3: 4.3, hondo: 1.5, agua: -1.22 };
const BANDA = [0.8, 8.55];          // lo que cubre la banda del foso (u: m hacia fuera del eje del muro)
const SIN_SUELO = [0.85, 8.5];      // y donde el suelo no se dibuja

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lisa = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const col = (h) => new THREE.Color(h);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// ---------------------------------------------------------------- geometria del arco
export const enArco = (a, r = RE) => ({ x: CX + r * Math.cos(a), z: CZ - r * Math.sin(a) });
// (r, a) de un punto del juego; a en radianes del plano
function polar(x, z) { const dx = x - CX, dy = CZ - z; return { r: Math.hypot(dx, dy), a: Math.atan2(dy, dx) }; }
// el marco de un sitio del arco: origen en el eje del muro, X a lo largo, Z hacia dentro
function marco(a) { const s = Math.sin(a), c = Math.cos(a), o = enArco(a); return { a, o, X: { x: s, z: c }, Z: { x: -c, z: s } }; }
const aMundo = (m, lx, lz) => ({ x: m.o.x + m.X.x * lx + m.Z.x * lz, z: m.o.z + m.X.z * lx + m.Z.z * lz });
const aLocal = (m, x, z) => { const dx = x - m.o.x, dz = z - m.o.z; return { x: dx * m.X.x + dz * m.X.z, z: dx * m.Z.x + dz * m.Z.z }; };
const angX = (m) => Math.atan2(m.X.z, m.X.x);            // el `ang` de las cajas de heroe.js cuyo x local es X

// ruido de valor (el de muro4)
function h2(i, j) { let h = (i * 374761393 + j * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function ruido(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return (h2(i, j) * (1 - u) + h2(i + 1, j) * u) * (1 - v) + (h2(i, j + 1) * (1 - u) + h2(i + 1, j + 1) * u) * v;
}

// ---------------------------------------------------------------- el foso
// 1 = el foso entero; 0 = terraplen (puestos y portillo) o relleno (donde se vino abajo); a los extremos del arco se acaba
function fosoK(a) {
  let k = lisa(1, 7, Math.min(a - A0, A1 - a) * RE);
  for (const p of EXTERIOR.puestos) k = Math.min(k, clamp01((Math.abs(a - p.ang * RAD) * RE - 3.4) / 1.9));
  k = Math.min(k, clamp01((Math.abs(a - EXTERIOR.portillo * RAD) * RE - 1.1) / 1.4));
  for (const d of EXTERIOR.rellenos) k = Math.min(k, 1 - 0.72 * Math.exp(-(((a - d * RAD) * RE / 3.4) ** 2)));
  return k;
}
// la cota del foso y el caballon a u m del eje del muro, hacia fuera (lo que se suma al suelo)
function perfilU(u, a, x, z) {
  if (u < 0.8 || u > 8.5 || a < A0 || a > A1) return 0;
  const s = a * RE;
  const come = 0.25 * (ruido(s * 0.4, 9.1) - 0.5);
  let d;
  if (u <= FOSO.t0 || u >= FOSO.t3) d = 0;
  else if (u < FOSO.t0 + 1 + come) d = (u - FOSO.t0) / (1 + come);
  else if (u < FOSO.t3 - 1 - come) d = 1;
  else d = (FOSO.t3 - u) / (1 + come);
  const hf = -FOSO.hondo * clamp01(d) * fosoK(a);
  const n1 = ruido(x * 0.31 + 11, z * 0.31 - 4);
  const he = 0.55 * Math.exp(-(((u - 5.8) / 1.15) ** 2)) * (0.7 + 0.6 * n1) * lisa(4.3, 4.9, u) * lisa(0, 0.6, fosoK(a) + 0.4);
  return hf + he;
}
export function perfil(x, z) {
  if (z > CZ + 1) return 0;
  const p = polar(x, z);
  return perfilU(p.r - RE, p.a, x, z);
}

// ---------------------------------------------------------------- materiales
function materiales() {
  const tono = TONO;
  const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: tono, vertexColors: true, ...extra });
  const tRuido = TX.texturaRuido();
  const tHorm = texturaHormigonT(), tSuelo = TX.texturaSuelo(), tMadera = TX.texturaMadera();
  const tPicto = TX.texturaPictogramas(), tBidon = TX.texturaBidon(), tSaco = TX.texturaSaco(), tGavion = TX.texturaGavion();
  const tLona = TX.texturaLona(), tChapa = TX.texturaChapa(), tPintadas = TX.texturaPintadas(), tSen = texturaSenales4();
  tSuelo.repeat.set(1 / 2.2, 1 / 2.2); tChapa.repeat.set(1, 1);
  const U = { uRuido: { value: tRuido } };
  // el hormigon de los bloques (instanciado): la textura + el barro que salpica abajo, la humedad que sube por la cara de
  // fuera y la tapa mas oscura, en los ejes del BLOQUE (y desde su pie, z < 0 fuera)
  const hormigon = new THREE.MeshToonMaterial({ color: '#c3c6c4', gradientMap: tono, map: tHorm });
  hormigon.onBeforeCompile = (sh) => {
    sh.uniforms.uRuido = U.uRuido;
    sh.vertexShader = 'varying vec3 vLoc;\nvarying vec3 vW;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vLoc = transformed;
      #ifdef USE_INSTANCING
        vW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
      #else
        vW = (modelMatrix * vec4(transformed, 1.0)).xyz;
      #endif`);
    sh.fragmentShader = 'varying vec3 vLoc;\nvarying vec3 vW;\nuniform sampler2D uRuido;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float nA = texture2D(uRuido, vec2(vW.x + vW.z, vLoc.y) * vec2(0.21, 0.37)).r;
      float nB = texture2D(uRuido, vec2(vW.x - vW.z, vLoc.y) * vec2(1.3, 0.9)).r;
      float barro = 1.0 - smoothstep(0.02, 0.38 + 0.5 * nA + 0.12 * nB, vLoc.y);
      diffuseColor.rgb *= mix(vec3(1.0), vec3(0.5, 0.47, 0.42), barro * 0.9);
      float fuera = smoothstep(0.02, -0.2, vLoc.z);
      float humedad = (1.0 - smoothstep(0.4, 1.2 + 1.1 * nA, vLoc.y)) * fuera * smoothstep(0.35, 0.65, nB * 0.6 + nA * 0.6);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.235, 0.19), humedad * 0.55);
      float tapa = smoothstep(3.92, 3.99, vLoc.y);
      diffuseColor.rgb *= 1.0 - 0.18 * tapa;`);
  };
  hormigon.customProgramCacheKey = () => 'exterior-hormigon';
  const M = {
    hormigon,
    tinta: new THREE.MeshBasicMaterial({ color: '#0b0a0c', side: THREE.BackSide }),
    pintadasBloque: new THREE.MeshToonMaterial({ map: tPintadas, gradientMap: tono, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    madera: toon('#ffffff', { map: tMadera }), picto: new THREE.MeshToonMaterial({ map: tPicto, gradientMap: tono, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    bidon: toon('#ffffff', { map: tBidon }), gavion: toon('#ffffff', { map: tGavion }), tierra: toon('#5a5247', { map: tSuelo }),
    oxido: toon('#5b4436'), alambre: toon('#8b9297'), lona: toon('#ffffff', { map: tLona, side: THREE.DoubleSide }), chapaOx: toon('#ffffff', { map: tChapa, side: THREE.DoubleSide }),
    tronco: toon('#3b3732'), celosia: toon('#4a4f54'), aislador: toon('#7c8288'), cuerda: toon('#6b6250'), goma: toon('#1e1e1f'),
    carroceria: toon('#ffffff', { map: TX.texturaCarroceria() }), quemado: toon('#2e2a27', { map: tChapa }), luna: toon('#1a2026', { side: THREE.DoubleSide }), faro: toon('#a9acab'),
    esmalte: toon('#b9b5a6'), ferralla: toon('#4e3628'), tela: toon('#ffffff', { side: THREE.DoubleSide, map: TX.texturaColchon() }),
    acero: toon('#5a6168'), aceroOsc: toon('#373c42'), chapa: toon('#7f878f'), puerta: toon('#4d555d'),
    vidrio: new THREE.MeshToonMaterial({ color: '#243039', gradientMap: tono, transparent: true, opacity: 0.42, depthWrite: false }),
    ventana: new THREE.MeshBasicMaterial({ color: '#ffd9a0' }), ambar: new THREE.MeshBasicMaterial({ color: '#ffd8a8' }),
    negro: new THREE.MeshBasicMaterial({ color: '#07090b', side: THREE.DoubleSide }), focoLuz: new THREE.MeshBasicMaterial({ color: '#f1f5f9' }),
    interiorPared: new THREE.MeshBasicMaterial({ color: '#8b7e6b' }), interiorBajo: new THREE.MeshBasicMaterial({ color: '#5e564b' }),
    interiorTecho: new THREE.MeshBasicMaterial({ color: '#a8997c' }), mueble: new THREE.MeshBasicMaterial({ color: '#3f3a34' }),
    pantalla: new THREE.MeshBasicMaterial({ color: '#d6b883' }), pantallaApagada: new THREE.MeshBasicMaterial({ color: '#2b2a28' }),
    plano: new THREE.MeshBasicMaterial({ color: '#b9ae93' }), senal: new THREE.MeshToonMaterial({ map: tSen, gradientMap: tono }),
    rejilla: toon('#7c8389', { map: texturaMalla(), alphaTest: 0.5, side: THREE.DoubleSide }),
    fuego: toon('#ffffff', { map: tBidon, emissive: '#ffffff', emissiveMap: texturaAgujerosFuego(), emissiveIntensity: 1 }),
    pintura: toon('#c9ccc8'), alfombra: toon('#ffffff', { map: texturaAlfombra(), side: THREE.DoubleSide }),
    saco: new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: tono, map: tSaco }),
    banda: new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: tono, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
    agua: new THREE.MeshPhongMaterial({ color: '#33434c', specular: '#8fa3ad', shininess: 90 }),
  };
  M.picto.vertexColors = false;
  return M;
}
const SIN_SOMBRA = ['tinta', 'picto', 'ventana', 'ambar', 'negro', 'focoLuz', 'vidrio', 'interiorPared', 'interiorBajo', 'interiorTecho', 'mueble', 'pantalla', 'pantallaApagada', 'plano', 'senal', 'alambre'];

// ================================================================ el muro
export function crearExterior(grupo, cajasMundo) {
  const t0 = performance.now();
  const raiz = new THREE.Group();
  raiz.name = 'muroExterior';
  grupo.add(raiz);
  const M = materiales();
  const suelo = (x, z) => R.altura(x, z);

  // ---------------- los choques: una rejilla de 16 m con todas las cajas (en el mundo)
  const CEL = 16, rejilla = new Map(), todas = [];
  const claveR = (i, j) => i * 100003 + j;
  function meterCaja(b) {
    todas.push(b);
    const e = Math.hypot(b.hx, b.hz);
    for (let i = Math.floor((b.x - e) / CEL); i <= Math.floor((b.x + e) / CEL); i++) {
      for (let j = Math.floor((b.z - e) / CEL); j <= Math.floor((b.z + e) / CEL); j++) {
        const k = claveR(i, j);
        if (!rejilla.has(k)) rejilla.set(k, []);
        rejilla.get(k).push(b);
      }
    }
  }
  const enCelda = (x, z) => rejilla.get(claveR(Math.floor(x / CEL), Math.floor(z / CEL))) || [];
  const dentroCaja = (b, x, z) => {
    const ca = Math.cos(b.ang), sa = Math.sin(b.ang);
    const lx = (x - b.x) * ca + (z - b.z) * sa, lz = -(x - b.x) * sa + (z - b.z) * ca;
    return Math.abs(lx) <= b.hx && Math.abs(lz) <= b.hz;
  };

  // ================================================================ LOS BLOQUES
  // los huecos: los puestos y el portillo
  const huecos = [
    ...EXTERIOR.puestos.map((p) => [p.ang * RAD - HUECO / RE, p.ang * RAD + HUECO / RE]),
    [EXTERIOR.portillo * RAD - PORTILLO / RE, EXTERIOR.portillo * RAD + PORTILLO / RE],
  ].sort((a, b) => a[0] - b[0]);
  const tramos = [];
  let a = A0;
  for (const [h0, h1] of huecos) { tramos.push([a, h0]); a = h1; }
  tramos.push([a, A1]);
  const bloques = [];
  for (const [ta, tb] of tramos) {
    const largo = (tb - ta) * RE, n = Math.max(1, Math.round(largo / T.LARGO)), lb = largo / n;
    for (let k = 0; k < n; k++) bloques.push({ a: ta + ((k + 0.5) * lb) / RE, largo: lb });
  }
  const VAR = 10;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
  bloques.forEach((b, i) => {
    const rb = azar(77 + i * 31);
    const m = marco(b.a);
    b.i = i; b.v = Math.floor(rb() * VAR); b.m = m;
    // el punto mas bajo de la huella del pie (asi el pie queda a 0,5 o menos del suelo por los dos lados: se salta)
    let ym = Infinity;
    for (const [lx, lz] of [[0, 0], [-0.55, -0.75], [0.55, -0.75], [-0.55, 0.75], [0.55, 0.75]]) { const w = aMundo(m, lx * b.largo / T.LARGO, lz); ym = Math.min(ym, suelo(w.x, w.z)); }
    b.y0 = ym - 0.02 - rb() * 0.02;
    const tono = 0.9 + rb() * 0.16;
    b.color = new THREE.Color().setRGB(tono, tono * (0.99 + rb() * 0.02), tono * (0.97 + rb() * 0.04));
    // los ejes del bloque en el mundo (x a lo largo, z hacia dentro), con su pizca de desplome
    const base = new THREE.Matrix4().makeBasis(V(m.X.x, 0, m.X.z), V(0, 1, 0), V(m.Z.x, 0, m.Z.z));
    _e.set((rb() - 0.5) * 0.012, (rb() - 0.5) * 0.012, (rb() - 0.5) * 0.004, 'YXZ');
    _m.makeRotationFromEuler(_e);
    const dz = (rb() - 0.5) * 0.03;
    b.mat = new THREE.Matrix4().compose(V(m.o.x + m.Z.x * dz, b.y0, m.o.z + m.Z.z * dz), _q.setFromRotationMatrix(base.multiply(_m)), V(b.largo / T.LARGO, 1, 1));
    // los choques: el pie se pisa (0,5) y el alma por arriba (4 m)
    const ang = angX(m);
    meterCaja({ x: m.o.x, z: m.o.z, hx: b.largo / 2, hz: 0.8, ang, ytop: b.y0 + T.ALTO_PIE, muro: true });
    meterCaja({ x: m.o.x, z: m.o.z, hx: b.largo / 2, hz: 0.15, ang, ytop: b.y0 + T.ALTO, muro: true });
  });
  // la cota del pie de los bloques en un angulo (null en los huecos): lo que pisa lo que se arrima al muro
  function yBloque(a) {
    let lo = 0, hi = bloques.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (bloques[mid].a < a) lo = mid + 1; else hi = mid; }
    let best = null;
    for (const k of [lo - 1, lo]) {
      const b = bloques[k];
      if (b && Math.abs(b.a - a) * RE <= b.largo / 2 + 0.05 && (!best || Math.abs(b.a - a) < Math.abs(best.a - a))) best = b;
    }
    return best ? best.y0 : null;
  }
  // el SUELO de lo que se arma a mano: el del terreno y, pegado al muro, la cota de su bloque (lo que va sobre el pie
  // va sobre el pie)
  function base(x, z) {
    const t = suelo(x, z), p = polar(x, z), u = Math.abs(p.r - RE);
    if (u > 1.7) return t;
    const yb = yBloque(p.a);
    if (yb === null) return t;
    const k = lisa(0.95, 1.7, u);
    return yb * (1 - k) + t * k;
  }

  // ---- las diez variantes: hormigon, tinta y pintadas (en los ejes del bloque)
  const variantes = [];
  const cas = (i) => ({ u0: (i % 4) / 4, v0: 1 - (Math.floor(i / 4) + 1) / 2 });
  for (let v = 0; v < VAR; v++) {
    const rb = azar(1000 + v * 17);
    const b = bloqueT(rb);
    const Lv = crearLotes();
    for (const g of b.piezas) { uvMundo(g, rb() * 9, rb() * 9); Lv.meter('hormigon', g); Lv.tinta(g, 0.011); }
    for (const [u, y] of b.ferralla) for (const d of [-0.05, 0.05]) Lv.cilindro('tinta', V(u + d, y - 0.05, 0.02 * Math.sign(d)), V(u + d * 1.3 + 0.01, y + 0.05 + rb() * 0.06, 0.03 * Math.sign(d)), 0.006, 5, 0);
    // pintadas: dentro (marcas, flechas, firmas) y el oxido que chorrea de los agujeros de izado
    const quads = [];
    const pintada = (i, u, y, w, h, lado, giro = 0) => {
      const c = cas(i), pts = [];
      for (const [a, bb] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const ca = Math.cos(giro), sa = Math.sin(giro);
        const x = u + (a * w / 2) * ca - (bb * h / 2) * sa, yy = y + (a * w / 2) * sa + (bb * h / 2) * ca;
        pts.push([x * lado, yy, lado * (medioGrueso(yy) + 0.0025), c.u0 + (a + 1) / 2 / 4, c.v0 + (bb + 1) / 2 / 2]);
      }
      quads.push(pts);
    };
    // (con diez bloques repetidos, una marca en cada uno hacia filas iguales: solo en tres, y una pintada grande en dos)
    if (v === 1 || v === 6) pintada(5 + (v === 6 ? 1 : 0), (rb() - 0.5) * 0.3, 1.05 + rb() * 0.25, 0.5, 0.5, 1);
    if (v === 8) pintada(5, (rb() - 0.5) * 0.3, 1.15, 0.45, 0.45, -1);
    if (v === 3 || v === 9) pintada(v === 3 ? 2 : 4, (rb() - 0.5) * 0.25, 1.7 + rb() * 0.9, 0.85 + rb() * 0.2, 0.85 + rb() * 0.2, 1, (rb() - 0.5) * 0.12);
    for (const ua of [-0.3, 0.3]) for (const lado of [1, -1]) {
      if (rb() < 0.25) continue;
      const largo = 0.5 + rb() * 0.9;
      pintada(7, ua * lado, 3.72 - largo / 2 + 0.08, 0.26, largo, lado);
    }
    let gp = null;
    if (quads.length) {
      const pos = [], uv = [];
      for (const q of quads) for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(q[k][0], q[k][1], q[k][2]); uv.push(q[k][3], q[k][4]); }
      gp = new THREE.BufferGeometry();
      gp.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      gp.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      gp.computeVertexNormals();
    }
    const solo = (k) => { const g = mergeGeometries(Lv.lotes[k]); g.deleteAttribute('color'); return g; };
    variantes.push({ hormigon: solo('hormigon'), tinta: solo('tinta'), pintadas: gp });
  }
  // la de lejos: la T en cajas (pie, cartelas en rampa y alma que se estrecha) con su tinta
  const lejos = (() => {
    const Lv = crearLotes();
    const pie = new THREE.BoxGeometry(T.LARGO - 0.035, T.ALTO_PIE, T.PIE).translate(0, T.ALTO_PIE / 2, 0);
    const alma = new THREE.BoxGeometry(T.LARGO - 0.035, T.ALTO - 0.5, T.GRUESO).translate(0, 0.5 + (T.ALTO - 0.5) / 2, 0);
    const p = alma.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sign(p.getZ(i)) * medioGrueso(p.getY(i)));
    alma.computeVertexNormals();
    for (const g of [pie, alma]) { uvMundo(g, 0, 0); Lv.meter('hormigon', g); Lv.tinta(g, 0.02); }
    const solo = (k) => { const g = mergeGeometries(Lv.lotes[k]); g.deleteAttribute('color'); return g; };
    return { hormigon: solo('hormigon'), tinta: solo('tinta') };
  })();

  // las mallas instanciadas: por variante (cerca) y la de lejos
  const capCerca = 520;
  const inst = (g, mat, n, sombra) => {
    const m = new THREE.InstancedMesh(g, mat, n);
    m.count = 0; m.frustumCulled = false; m.castShadow = sombra; m.receiveShadow = mat !== M.tinta;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    raiz.add(m);
    return m;
  };
  const cerca = variantes.map((vv, v) => {
    const o = { h: inst(vv.hormigon, M.hormigon, capCerca, true), t: inst(vv.tinta, M.tinta, capCerca, false), p: vv.pintadas ? inst(vv.pintadas, M.pintadasBloque, capCerca, false) : null };
    o.h.name = `bloques_${v}`;
    if (o.p) o.p.renderOrder = 2;
    return o;
  });
  const lejosH = inst(lejos.hormigon, M.hormigon, bloques.length, false), lejosT = inst(lejos.tinta, M.tinta, bloques.length, false);
  lejosH.name = 'bloques_lejos';
  for (const o of cerca) o.h.setColorAt(0, new THREE.Color(1, 1, 1));
  lejosH.setColorAt(0, new THREE.Color(1, 1, 1));

  // ================================================================ EL FOSO Y EL CABALLON: la banda que sustituye al suelo
  const banda = (() => {
    const US = [BANDA[0], 1.0, 1.3, 1.55, 1.8, 2.05, 2.3, 2.6, 2.8, 3.0, 3.3, 3.55, 3.8, 4.05, 4.3, 4.6, 5.0, 5.4, 5.8, 6.2, 6.6, 7.1, 7.7, BANDA[1]];
    const n = Math.ceil(((A1 - A0) * RE) / 1.2), nu = US.length;
    const pos = new Float32Array((n + 1) * nu * 3), cl = new Float32Array((n + 1) * nu * 3), idx = [];
    const c = new THREE.Color(), cm = new THREE.Color();
    const C = { pie: col('#4a463f'), foso: col('#3e3a34'), fondo: col('#2f2c27'), caballon: col('#5b5244'), campo: col('#6b6450') };
    for (let j = 0; j <= n; j++) {
      const aj = A0 + ((A1 - A0) * j) / n;
      for (let i = 0; i < nu; i++) {
        const u = US[i], p = enArco(aj, RE + u), t = suelo(p.x, p.z), h = perfilU(u, aj, p.x, p.z);
        const k = (j * nu + i) * 3;
        pos[k] = p.x; pos[k + 1] = t + h; pos[k + 2] = p.z;
        colorCara(p.x, t, p.z, R.normalY(p.x, p.z), c);
        const nn = ruido(p.x * 0.23 - 3, p.z * 0.23 + 5);
        cm.copy(C.campo).lerp(C.caballon, Math.exp(-(((u - 5.8) / 1.4) ** 2)));
        cm.lerp(C.pie, 1 - lisa(0.9, 1.5, u));
        cm.lerp(C.foso, Math.min(1, (-h / FOSO.hondo) * 2.2));
        cm.lerp(C.fondo, Math.max(0, -h / FOSO.hondo - 0.5) * 2);
        cm.multiplyScalar(0.9 + 0.2 * nn);
        c.lerp(cm, 0.85 * lisa(BANDA[0], 1.3, u) * (1 - lisa(6.6, BANDA[1], u)));
        cl[k] = c.r; cl[k + 1] = c.g; cl[k + 2] = c.b;
      }
    }
    for (let j = 0; j < n; j++) for (let i = 0; i < nu - 1; i++) {
      const a = j * nu + i, b = a + 1, cc = a + nu, d = cc + 1;
      idx.push(a, b, cc, b, d, cc);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(cl, 3));
    g.setIndex(idx);
    // la cara tiene que mirar arriba
    g.computeVertexNormals();
    if (g.attributes.normal.getY(nu + 1) < 0) { for (let q = 0; q < idx.length; q += 3) { const t = idx[q + 1]; idx[q + 1] = idx[q + 2]; idx[q + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, M.banda);
    m.name = 'foso'; m.receiveShadow = true;
    raiz.add(m);
    // el AGUA del fondo: donde el foso es entero
    const pa = [], ia = [];
    for (let j = 0; j <= n; j++) {
      const aj = A0 + ((A1 - A0) * j) / n;
      for (const u of [2.12, 3.48]) { const p = enArco(aj, RE + u); pa.push(p.x, suelo(p.x, p.z) + FOSO.agua, p.z); }
    }
    for (let j = 0; j < n; j++) {
      const aj = A0 + ((A1 - A0) * (j + 0.5)) / n;
      if (fosoK(aj) < 0.97) continue;
      const a = j * 2;
      ia.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const ga = new THREE.BufferGeometry();
    ga.setAttribute('position', new THREE.Float32BufferAttribute(pa, 3));
    ga.setIndex(ia);
    ga.computeVertexNormals();
    if (ga.attributes.normal.getY(0) < 0) { for (let q = 0; q < ia.length; q += 3) { const t = ia[q + 1]; ia[q + 1] = ia[q + 2]; ia[q + 2] = t; } ga.setIndex(ia); ga.computeVertexNormals(); }
    const w = new THREE.Mesh(ga, M.agua);
    w.name = 'aguaFoso'; w.receiveShadow = true;
    raiz.add(w);
    return { tris: idx.length / 3 + ia.length / 3 };
  })();

  // ================================================================ LA CONCERTINA (por el borde de fuera del foso)
  const conc = (() => {
    const Lc = crearLotes();
    concertina(Lc, V(0, 0, 0), V(6, 0, 0), 0.44);
    for (const x of [0, 3]) Lc.barra('oxido', V(x, -0.1, -0.05), V(x, 1.0, -0.05), 0.03, { tinta: 0.004 });
    const solo = (k) => { const g = mergeGeometries(Lc.lotes[k]); g.deleteAttribute('color'); return g; };
    const partes = [['alambre', M.alambre], ['oxido', M.oxido], ['tinta', M.tinta]].filter(([k]) => Lc.lotes[k]);
    // los tramos: cortados en los puestos, el portillo y donde los saltaderos tienden tablones
    const libre = (a) => {
      for (const p of EXTERIOR.puestos) if (Math.abs(a - p.ang * RAD) * RE < 5.4) return false;
      if (Math.abs(a - EXTERIOR.portillo * RAD) * RE < 2.2) return false;
      // los tablones del saltadero del coche (x = -11,45 de muro4, el sitio en x = -18)
      for (const [k, s] of EXTERIOR.saltaderos.entries()) if (k % 2 === 0 && Math.abs(a - (s * RAD - (18 - 11.45) / RE)) * RE < 1.4) return false;
      return true;
    };
    const tramos6 = [];
    const n = Math.floor(((A1 - A0) * RE) / 6);
    const RC = RE + 5.0;
    for (let k = 0; k < n; k++) {
      const a0 = A0 + (k * 6) / RE + 0.6 / RE, a1 = a0 + 6 / RE;
      if (!libre(a0) || !libre(a1) || !libre((a0 + a1) / 2)) continue;
      const pa = enArco(a0, RC), pb = enArco(a1, RC);
      const ya = suelo(pa.x, pa.z) + perfil(pa.x, pa.z), yb = suelo(pb.x, pb.z) + perfil(pb.x, pb.z);
      const A = V(pa.x, ya, pa.z), B = V(pb.x, yb, pb.z), d = B.clone().sub(A), L = d.length();
      const xd = d.clone().normalize(), zd = new THREE.Vector3().crossVectors(xd, V(0, 1, 0)).normalize(), yd = new THREE.Vector3().crossVectors(zd, xd);
      const mat = new THREE.Matrix4().makeBasis(xd, yd, zd).scale(V(L / 6, 1, 1)).setPosition(A);
      tramos6.push({ mat, x: (pa.x + pb.x) / 2, z: (pa.z + pb.z) / 2 });
      meterCaja({ x: (pa.x + pb.x) / 2, z: (pa.z + pb.z) / 2, hx: L / 2, hz: 0.48, ang: Math.atan2(xd.z, xd.x) });
    }
    const mallas = partes.map(([k, mat]) => inst(solo(k), mat, 160, k !== 'tinta'));
    return { tramos: tramos6, mallas };
  })();

  // ================================================================ LO QUE SE ARMA A MANO
  const sitios = [];
  const tablas = [];
  const sinHierba = [];
  // arma `fn(L, s)` en el marco del angulo a (la x de muro4 ox queda en el angulo) y lo pega al suelo
  function sitio(nombre, a, ox, fn, radioHierba = 6) {
    const m = marco(a);
    const L = crearLotes();
    const loc = { cajas: [], sacos: [], tablas: [] };
    const s = {
      r: azar(Math.round(a * 1e5) + 7),
      caja2: (x0, x1, z0, z1, ytop) => loc.cajas.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, ytop }),
      circulo: (x, z, r) => loc.cajas.push({ x, z, hx: r, hz: r }),
      // el foso en los ejes de muro4 (lo que se suma al suelo)
      perfil: (x, z) => { const w = aMundo(m, x - ox, z); return perfil(w.x, w.z); },
      sacos: (lista) => loc.sacos.push(...lista),
      tabla: (t) => loc.tablas.push(t),
    };
    fn(L, s);
    const g = new THREE.Group();
    g.name = nombre;
    const mallas = L.construir(g, M, SIN_SOMBRA);
    // al mundo: girar y llevar al sitio (en planta) y subir cada vertice al suelo de donde cae
    const mat = new THREE.Matrix4().makeBasis(V(m.X.x, 0, m.X.z), V(0, 1, 0), V(m.Z.x, 0, m.Z.z)).multiply(new THREE.Matrix4().makeTranslation(-ox, 0, 0));
    mat.setPosition(V(m.o.x - m.X.x * ox, 0, m.o.z - m.X.z * ox));
    let tris = 0;
    for (const malla of Object.values(mallas)) {
      const geo = malla.geometry;
      geo.applyMatrix4(mat);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + base(p.getX(i), p.getZ(i)));
      geo.computeBoundingSphere();
      tris += (geo.index ? geo.index.count : p.count) / 3;
    }
    if (loc.sacos.length) {
      const ms = sacos(loc.sacos, M.saco);
      ms.name = 'sacos';
      const mi = new THREE.Matrix4(), pp = new THREE.Vector3();
      for (let i = 0; i < ms.count; i++) {
        ms.getMatrixAt(i, mi);
        mi.premultiply(mat);
        pp.setFromMatrixPosition(mi);
        mi.elements[13] += base(pp.x, pp.z);
        ms.setMatrixAt(i, mi);
      }
      ms.instanceMatrix.needsUpdate = true;
      ms.castShadow = true; ms.receiveShadow = true;
      ms.frustumCulled = false;
      g.add(ms);
      tris += ms.count * (ms.geometry.index ? ms.geometry.index.count : ms.geometry.attributes.position.count) / 3;
    }
    const ang = angX(m);
    for (const b of loc.cajas) {
      const w = aMundo(m, b.x - ox, b.z);
      meterCaja({ x: w.x, z: w.z, hx: b.hx, hz: b.hz, ang, ytop: b.ytop != null ? b.ytop + base(w.x, w.z) : undefined });
    }
    for (const t of loc.tablas) tablas.push({ ...t, m, ox });
    raiz.add(g);
    const c = aMundo(m, 0, 2);
    sinHierba.push({ x: c.x, z: c.z, r: radioHierba });
    sitios.push({ nombre, g, x: m.o.x, z: m.o.z, tris });
    return { m, mat };
  }
  // el angulo del centro del bloque mas cercano (los saltaderos con cuerda la pasan por un agujero de izado)
  const aBloque = (a) => bloques.reduce((b, x) => (Math.abs(x.a - a) < Math.abs(b.a - a) ? x : b)).a;

  // ---------------- PUESTO DE CONTROL (x en [-2,4, 2,4]): porton, pluma, caseta, nido de sacos, chicane, mastil, generador
  EXTERIOR.puestos.forEach((pu, n) => sitio(`puesto_${pu.camino}`, pu.ang * RAD, 0, (L, s) => {
    const { cajaE, barra, cilindro, caja } = L;
    const r = s.r, P = HUECO;
    for (const [x0, x1, z] of [[-P, 0.05, -0.035], [-0.05, P, 0.035]]) {
      const h = 2.35, y0 = 0.08;
      for (const xx of [x0, x1]) cajaE('aceroOsc', xx - 0.03, xx + 0.03, y0, y0 + h, z - 0.03, z + 0.03, { tinta: 0.006 });
      for (const yy of [y0, y0 + h / 2, y0 + h - 0.06]) cajaE('aceroOsc', x0, x1, yy, yy + 0.06, z - 0.03, z + 0.03, { tinta: 0.006 });
      barra('aceroOsc', V(x0 + 0.03, y0 + 0.06, z), V(x1 - 0.03, y0 + h / 2, z), 0.04, { tinta: 0.004 });
      const malla = new THREE.PlaneGeometry(x1 - x0 - 0.06, h - 0.1);
      const uv = malla.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / 0.15, uv.getY(i) * h / 0.15);
      malla.translate((x0 + x1) / 2, y0 + h / 2, z);
      L.meter('rejilla', malla);
      for (const xx of [x0 + 0.3, x1 - 0.3]) cilindro('aceroOsc', V(xx, 0.08, z - 0.06), V(xx, 0.08, z + 0.06), 0.07, 12, 0.005);
      concertina(L, V(x0, y0 + h + 0.02, z), V(x1, y0 + h + 0.02, z), 0.26);
    }
    cajaE('aceroOsc', -P - 1.5, P, 0, 0.03, -0.09, 0.09, { tinta: 0.004 });
    for (let k = 0; k < 7; k++) cilindro('aceroOsc', V(0.02, 1.22 - k * 0.055, 0.0), V(0.02 + (k % 2) * 0.006, 1.22 - (k + 1) * 0.055, 0.0), 0.012, 5, 0);
    cajaE('acero', -0.04, 0.08, 0.82, 0.92, -0.06, 0.06, { tinta: 0.004 });
    s.caja2(-P, P, -0.1, 0.1);
    L.senal(3, V(-1.2, 1.55, 0.0), V(0, 0, 1), 0.42, 0.42);
    L.senal(5, V(1.2, 1.55, 0.072), V(0, 0, 1), 0.42, 0.42);
    L.senal(5, V(-1.2, 1.55, -0.072), V(0, 0, -1), 0.42, 0.42);
    // la pluma
    const zp = 3.2;
    cajaE('aceroOsc', -3.65, -3.35, 0, 1.0, zp - 0.15, zp + 0.15, { tinta: 0.01 });
    cajaE('aceroOsc', -3.9, -3.55, 0.82, 1.18, zp - 0.12, zp + 0.12, { tinta: 0.008 });
    for (let k = 0; k < 16; k++) {
      const x0 = -3.45 + k * 0.42, x1 = Math.min(3.05, x0 + 0.42);
      if (x0 >= 3.05) break;
      cajaE(k % 2 ? 'aceroOsc' : 'pintura', x0, x1, 1.08, 1.16, zp - 0.04, zp + 0.04, { tinta: k === 0 ? 0.006 : 0 });
    }
    L.tinta(new THREE.BoxGeometry(6.5, 0.08, 0.08).translate(-0.2, 1.12, zp), 0.006);
    cajaE('aceroOsc', 3.1, 3.18, 0, 1.08, zp - 0.04, zp + 0.04, { tinta: 0.006 });
    for (const dz of [-0.07, 0.07]) cajaE('aceroOsc', 3.06, 3.22, 1.08, 1.2, zp + dz - 0.015, zp + dz + 0.015, { tinta: 0 });
    s.circulo(-3.6, zp, 0.28); s.circulo(3.14, zp, 0.1);
    // la caseta (casetas.js)
    const K = { x0: 3.7, x1: 5.9, z0: 1.9, z1: 4.1, alto: 2.4 };
    caseta({ cajaE: (...q) => cajaE(...q), barra: (...q) => barra(...q), cilindro: (...q) => cilindro(...q), senal: L.senal }, {
      x0: K.x0, x1: K.x1, z0: K.z0, z1: K.z1, y0: 0, alto: K.alto, codigo: n, rejas: true,
      puerta: { lado: '-x', u: 1.5, mano: 'izq' },
      ventanas: [{ lado: '-z', u: 1.1, ancho: 1.3, v0: 1.0, v1: 1.75 }, { lado: '-x', u: 0.5, ancho: 0.6, v0: 1.05, v1: 1.7 }, { lado: '+z', u: 1.2, ancho: 1.0, v0: 1.0, v1: 1.7 }],
      camara: ['-z', true], cuadro: ['+x', 0.6], aire: [5.3, 3.6], canalon: '+x', foco: [K.x0 + 0.35, K.z0 + 0.35, 0, -1],
    });
    s.caja2(K.x0 - 0.15, K.x1 + 0.15, K.z0 - 0.15, K.z1 + 0.15);
    // el nido de sacos
    const lista = [];
    muroSacos(lista, V(-7.7, 0, 1.75), V(-4.9, 0, 1.75), 0, 7, 2);
    muroSacos(lista, V(-7.55, 0, 2.05), V(-7.55, 0, 3.9), 0, 7, 2);
    muroSacos(lista, V(-5.05, 0, 2.05), V(-5.05, 0, 3.4), 0, 7, 2);
    s.sacos(lista);
    s.caja2(-7.9, -4.7, 1.5, 2.0, 0.92); s.caja2(-7.8, -7.3, 2.0, 4.05, 0.92); s.caja2(-5.3, -4.8, 2.0, 3.55, 0.92);
    // la chicane de gaviones
    for (const [x0, z] of [[-3.15, 12.2], [0.95, 15.6]]) {
      for (let k = 0; k < 2; k++) gavion(L, x0 + 0.55 + k * 1.1, 0, z, 1.06, 1.37, 1.06, (r() - 0.5) * 0.04);
      s.caja2(x0, x0 + 2.2, z - 0.55, z + 0.55);
    }
    // el mastil de los focos (6,8 m)
    const mx = -4.25, mz = 1.45;
    cilindro('aceroOsc', V(mx, 0, mz), V(mx, 6.8, mz), 0.11, 12, 0.012, null, 0.075);
    cajaE('aceroOsc', mx - 0.3, mx + 0.3, 0, 0.05, mz - 0.3, mz + 0.3, { tinta: 0.006 });
    for (let y = 0.6; y < 6.3; y += 0.32) barra('acero', V(mx - 0.14, y, mz + 0.12), V(mx + 0.14, y, mz + 0.12), 0.022, { tinta: 0 });
    barra('aceroOsc', V(mx - 0.8, 6.65, mz), V(mx + 0.8, 6.65, mz), 0.08, { tinta: 0.006 });
    for (const dx of [-0.65, 0.65]) {
      const a = V(mx + dx, 6.55, mz - 0.05), dir = V(dx * 0.6, -0.45, -1).normalize();
      cajaE('aceroOsc', a.x - 0.03, a.x + 0.03, 6.55, 6.65, a.z - 0.03, a.z + 0.03, { tinta: 0 });
      const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), dir);
      caja('aceroOsc', a.x + dir.x * 0.12, a.y + dir.y * 0.12, a.z + dir.z * 0.12, 0.46, 0.34, 0.2, { q, tinta: 0.008 });
      caja('focoLuz', a.x + dir.x * 0.225, a.y + dir.y * 0.225, a.z + dir.z * 0.225, 0.4, 0.28, 0.01, { q, tinta: 0 });
      for (let k = 0; k < 5; k++) caja('aceroOsc', a.x + dir.x * 0.04, a.y + dir.y * 0.04 - 0.12 + k * 0.06, a.z + dir.z * 0.04, 0.5, 0.02, 0.06, { q, tinta: 0 });
    }
    cajaE('aceroOsc', mx + 0.1, mx + 0.4, 1.1, 1.55, mz - 0.1, mz + 0.12, { tinta: 0.006 });
    // el generador y el bidon de gasoil
    cajaE('aceroOsc', -6.45, -5.25, 0.12, 0.2, 4.55, 5.35, { tinta: 0.006 });
    for (const [x, z] of [[-6.3, 4.6], [-6.3, 5.3], [-5.4, 4.6], [-5.4, 5.3]]) cilindro('goma', V(x, 0.11, z - 0.04), V(x, 0.11, z + 0.04), 0.11, 12, 0.005);
    cajaE('pintura', -6.4, -5.3, 0.2, 0.78, 4.6, 5.3, { tinta: 0.01, color: col('#7d8a6c') });
    for (let k = 0; k < 7; k++) cajaE('aceroOsc', -6.38 + k * 0.05, -6.36 + k * 0.05, 0.3, 0.68, 4.585, 4.6, { tinta: 0 });
    for (let k = 0; k < 7; k++) cajaE('aceroOsc', -5.75 + k * 0.05, -5.73 + k * 0.05, 0.3, 0.68, 5.3, 5.315, { tinta: 0 });
    cajaE('aceroOsc', -5.3, -5.27, 0.32, 0.66, 4.75, 5.15, { tinta: 0.004 });
    cajaE('negro', -5.27, -5.265, 0.4, 0.5, 4.8, 4.9, { tinta: 0 });
    cajaE('ambar', -5.27, -5.262, 0.56, 0.58, 4.82, 4.85, { tinta: 0 });
    cilindro('aceroOsc', V(-6.25, 0.78, 4.75), V(-6.25, 1.25, 4.75), 0.035, 8, 0.005);
    cilindro('aceroOsc', V(-6.25, 1.25, 4.75), V(-6.3, 1.32, 4.75), 0.035, 8, 0.004);
    bidon(L, -6.9, 0, 5.0, { fila: 2, semilla: 21 });
    s.circulo(-6.9, 5.0, 0.3);
    s.caja2(-6.5, -5.2, 4.5, 5.4, 0.78);
    cuerda(L, [V(-5.4, 0.3, 4.6), V(-5.0, 0.02, 3.6), V(-4.6, 0.02, 2.5), V(mx + 0.2, 0.02, mz + 0.4), V(mx + 0.2, 1.1, mz + 0.13)], 0.018, 'goma');
    s.circulo(mx, mz, 0.18);
    for (const [x, z, f] of [[6.3, 1.7, 1], [6.35, 2.35, 1], [3.2, 4.9, 0]]) { bidon(L, x, 0, z, { fila: f, semilla: (x * 10) | 0 }); s.circulo(x, z, 0.3); }
    // FUERA: el caballo de frisa en el camino y erizos checos
    {
      const z = -9.2, y = s.perfil(0, z);
      for (const x of [-2.8, -1.4, 0, 1.4, 2.8]) for (const sg of [-1, 1]) barra('oxido', V(x - 0.1, y + 0.02, z - sg * 0.55), V(x + 0.1, y + 1.15, z + sg * 0.55), 0.06, { tinta: 0.006 });
      barra('oxido', V(-3.0, y + 0.6, z), V(3.0, y + 0.6, z), 0.07, { tinta: 0.006 });
      concertina(L, V(-3.0, y + 0.18, z), V(3.0, y + 0.18, z), 0.42);
      cilindro('goma', V(3.1, y + 0.25, z - 0.05), V(3.1, y + 0.25, z + 0.05), 0.25, 14, 0.006);
      s.caja2(-3.2, 3.2, z - 0.6, z + 0.6);
    }
    for (const [x, z, gg] of [[-5.6, -11.5, 0.3], [5.2, -12.6, 1.1], [-7.4, -17.8, 2.0], [7.8, -19.2, 0.7], [-1.2, -21.5, 1.6]]) {
      erizo(L, x, s.perfil(x, z), z, gg + n);
      s.circulo(x, z, 0.62);
    }
    // la concertina de los dos lados del camino, hasta el corte de la general
    for (const [x0, x1] of [[-5.4, -3.6], [3.6, 5.4]]) concertina(L, V(x0, 0, -5.0), V(x1, 0, -5.0), 0.44, (x, zz) => s.perfil(x, zz));
    for (const x0 of [-5.4, 3.6]) s.caja2(x0, x0 + 1.8, -5.48, -4.52);
    if (pu.camino === 'carretera') coche(L, -0.6, s.perfil(0, -27), -28.6, { quemado: true, ancho: 1.6 });
    if (pu.camino === 'carretera') s.caja2(-0.65, 3.35, -29.45, -27.75);
  }, 12));

  // ---------------- EL PORTILLO de la senda del lago: un hueco de 1,2 m con su puerta de tubo abierta
  sitio('portillo', EXTERIOR.portillo * RAD, 0, (L, s) => {
    const { cajaE, barra, cilindro } = L, P = PORTILLO;
    for (const x of [-P + 0.06, P - 0.06]) cajaE('aceroOsc', x - 0.06, x + 0.06, 0, 2.6, -0.06, 0.06, { tinta: 0.008 });
    cajaE('aceroOsc', -P, P, 2.5, 2.62, -0.06, 0.06, { tinta: 0.008 });
    for (const x of [-P + 0.06, P - 0.06]) s.circulo(x, 0, 0.07);
    concertina(L, V(-P - 0.4, 2.66, 0), V(P + 0.4, 2.66, 0), 0.24);
    // la hoja, abierta hacia dentro y con la cadena colgando
    const h = 2.1, x0 = P - 0.12, ang = 1.9;
    const q = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), ang);
    const hoja = (lx0, lx1, y0, y1) => {
      const g = new THREE.BoxGeometry(lx1 - lx0, y1 - y0, 0.05).translate((lx0 + lx1) / 2, (y0 + y1) / 2, 0).applyQuaternion(q).translate(x0, 0, 0.06);
      L.meter('aceroOsc', g); L.tinta(g, 0.005);
    };
    hoja(-1.15, -1.1, 0.1, 0.1 + h); hoja(-0.05, 0, 0.1, 0.1 + h);
    for (const y of [0.12, 1.1, 2.12]) hoja(-1.15, 0, y, y + 0.05);
    {
      const malla = new THREE.PlaneGeometry(1.05, h - 0.1);
      const uv = malla.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.05 / 0.15, uv.getY(i) * h / 0.15);
      malla.translate(-0.575, 0.1 + h / 2, 0).applyQuaternion(q).translate(x0, 0, 0.06);
      L.meter('rejilla', malla);
    }
    for (let k = 0; k < 9; k++) cilindro('aceroOsc', V(-P + 0.14, 1.25 - k * 0.055, 0.1), V(-P + 0.14 + (k % 2) * 0.006, 1.25 - (k + 1) * 0.055, 0.1), 0.012, 5, 0);
    const pq = V(-0.6, 0, 0).applyQuaternion(q).add(V(x0, 0, 0.06));
    s.circulo(pq.x, pq.z, 0.12);
    L.senal(5, V(-P - 0.75, 1.55, -0.16), V(0, 0, -1), 0.42, 0.42);
    // sacos a los dos lados, por dentro, y unas tablas en el barro del terraplen
    const lista = [];
    muroSacos(lista, V(-P - 1.9, 0, 1.0), V(-P - 0.25, 0, 1.0), 0, 3, 1);
    muroSacos(lista, V(P + 0.25, 0, 1.0), V(P + 1.9, 0, 1.0), 0, 3, 1);
    s.sacos(lista);
    s.caja2(-P - 1.9, -P - 0.25, 0.8, 1.2, 0.45); s.caja2(P + 0.25, P + 1.9, 0.8, 1.2, 0.45);
    for (const [z, dx] of [[-1.4, 0.04], [-2.4, -0.06], [-3.4, 0.02]]) cajaE('madera', -0.45 + dx, 0.45 + dx, s.perfil(0, z) + 0.02, s.perfil(0, z) + 0.05, z - 0.13, z + 0.13, { tinta: 0.005, color: col('#8a7b66') });
    barra('madera', V(-P - 2.3, 0, -0.5), V(-P - 2.3, 1.2, -0.5), 0.05, { tinta: 0.004, color: col('#6b5e4e') });
  }, 5);

  // ---------------- SALTADEROS: el del coche con su chabola (impares) y el de los bidones con la cuerda (pares)
  EXTERIOR.saltaderos.forEach((g, k) => {
    if (k % 2 === 0) sitio(`saltadero_coche_${g}`, g * RAD, -18, saltaderoCoche, 9);
    else sitio(`saltadero_cuerda_${g}`, aBloque(g * RAD), 19.8, saltaderoCuerda, 4);
  });

  function saltaderoCoche(L, s) {
    const { cajaE, barra, cilindro, caja } = L, r = s.r;
    // dos ruedas apiladas delante del morro
    for (let k = 0; k < 2; k++) {
      const g = new THREE.TorusGeometry(0.24, 0.1, 10, 20).rotateX(Math.PI / 2).scale(1, 1.05, 1).translate(-17.42, 0.105 + k * 0.205, 1.75);
      L.meter('goma', g); L.tinta(g, 0.008);
    }
    const ESC = [[-17.78, -17.06, 1.4, 2.1, 0.41]];
    coche(L, -17.0, 0, 0.86, { color: col('#7c868c'), pinchada: 1 });
    ESC.push([-17.0, -15.75, 0.86, 2.46, 0.84], [-15.75, -15.4, 0.86, 2.46, 1.1], [-15.4, -13.85, 0.86, 2.46, 1.37], [-13.85, -13.1, 0.86, 2.46, 0.95]);
    // la escalera de trastos sobre el pie, a lo largo del muro, hasta 3,56
    const Z0 = 0.17, Z1 = 0.84;
    const pila = [
      { x0: -15.35, x1: -13.9, top: 1.8, cosas: [['caja', 0.62, '#7d6b55'], ['caja', 0.53, '#6a5b49'], ['pale', 0.144]] },
      { x0: -13.9, x1: -13.2, top: 2.24, cosas: [['nevera', 1.59], ['pale', 0.144]] },
      { x0: -13.2, x1: -12.5, top: 2.68, cosas: [['bidon', 0.88, 0], ['bidon', 0.88, 2], ['caja', 0.42, '#86745c']] },
      { x0: -12.5, x1: -11.8, top: 3.12, cosas: [['sacos', 0.6], ['bidon', 0.88, 1], ['caja', 0.62, '#6f5f4c'], ['caja', 0.52, '#7b6a55']] },
      { x0: -11.8, x1: -11.1, top: 3.56, cosas: [['bidon', 0.88, 3], ['bidon', 0.88, 0], ['caja', 0.62, '#806e58'], ['caja', 0.53, '#6d5d4b'], ['pale', 0.144]] },
    ];
    const listaS = [];
    for (const p of pila) {
      let y = T.ALTO_PIE;
      const cx = (p.x0 + p.x1) / 2, cz = (Z0 + Z1) / 2 + 0.03;
      for (const [tipo, h, extra] of p.cosas) {
        const dx = (r() - 0.5) * 0.06, dz = (r() - 0.5) * 0.05;
        if (tipo === 'caja') cajaMadera(L, p.x0 + 0.03 + dx, p.x1 - 0.03 + dx, y, y + h, Z0 + 0.04 + dz, Z1 - 0.02 + dz, { color: col(extra), picto: r() < 0.6 ? Math.floor(r() * 3) : null });
        else if (tipo === 'pale' && p.x1 - p.x0 > 1.1) pale(L, cx, y, cz, (r() - 0.5) * 0.06, col('#9a8a72'));
        else if (tipo === 'pale') cajaMadera(L, p.x0 + 0.02, p.x1 - 0.02, y, y + h, Z0 + 0.03, Z1 - 0.01, { color: col('#958670') });
        else if (tipo === 'bidon') bidon(L, cx + dx, y, cz + dz, { fila: extra, semilla: (y * 100) | 0 });
        else if (tipo === 'nevera') nevera(L, p.x0 + 0.04, p.x1 - 0.04, y, y + h, Z0 + 0.04, Z1 - 0.02, 1);
        else if (tipo === 'sacos') for (let l = 0; l < 4; l++) for (const sg of [-1, 1]) listaS.push(l % 2 ? { x: cx, y: y + 0.075 + l * 0.15, z: cz + sg * 0.17, giro: 0 } : { x: cx + sg * 0.17, y: y + 0.075 + l * 0.15, z: cz, giro: Math.PI / 2 });
        y += h;
      }
      ESC.push([p.x0, p.x1, Z0, Z1, p.top]);
    }
    for (let l = 0; l < 3; l++) for (let x = -16.95 + (l % 2) * 0.3; x < -15.45; x += 0.56) listaS.push({ x: x + 0.28, y: T.ALTO_PIE + 0.075 + l * 0.15, z: 0.52, giro: 0 });
    ESC.push([-17.0, -15.35, 0.17, 0.84, T.ALTO_PIE + 0.45]);
    s.sacos(listaS);
    cuerda(L, [V(-11.7, 3.7, 0.12), V(-11.9, 3.3, 0.85), V(-12.8, 2.9, 0.88), V(-13.7, 2.1, 0.88), V(-14.5, 1.85, 0.6), V(-14.75, 3.65, 0.12)], 0.012);
    barra('madera', V(-13.0, 0.03, 1.15), V(-11.4, 3.1, 0.9), 0.1, { tinta: 0.008, color: col('#8b7a62') });
    // la alfombra doblada sobre la tapa del muro, donde se pasa
    {
      const pts = [[0.155, 3.05], [0.13, 3.6], [0.125, 3.97], [0.07, 4.035], [-0.07, 4.035], [-0.125, 3.97], [-0.135, 3.5], [-0.16, 2.95]];
      const pos = [], uv = [];
      const x0 = -11.85, x1 = -10.85, nx = 10;
      for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < nx; k++) {
        const xa = x0 + (x1 - x0) * k / nx, xb = x0 + (x1 - x0) * (k + 1) / nx;
        const ola = (xx, j) => (pts[j][1] < 3.9 ? 0.012 * Math.sin(xx * 9 + j) : 0);
        const A = [xa, pts[i][1], pts[i][0] + ola(xa, i)], B = [xb, pts[i][1], pts[i][0] + ola(xb, i)], C = [xb, pts[i + 1][1], pts[i + 1][0] + ola(xb, i + 1)], D = [xa, pts[i + 1][1], pts[i + 1][0] + ola(xa, i + 1)];
        pos.push(...A, ...B, ...C, ...A, ...C, ...D);
        const va = i / (pts.length - 1), vb = (i + 1) / (pts.length - 1), ua = k / nx, ub = (k + 1) / nx;
        uv.push(ua, va, ub, va, ub, vb, ua, va, ub, vb, ua, vb);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.computeVertexNormals();
      L.meter('alfombra', g);
    }
    // FUERA: tres tablones de andamio por encima del foso
    const xt = -11.45;
    const za = -1.05, zb = -4.95, ya = s.perfil(xt, za) + 0.04, yb = s.perfil(xt, zb) + 0.04;
    for (const dx of [-0.21, 0, 0.21]) {
      const a = V(xt + dx, ya, za), b = V(xt + dx + (r() - 0.5) * 0.06, yb, zb);
      const d = b.clone().sub(a), q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, -1), d.clone().normalize());
      caja('madera', (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, 0.2, 0.04, d.length(), { q, tinta: 0.006, color: col('#958670') });
    }
    s.tabla({ x0: xt - 0.33, x1: xt + 0.33, z0: zb, z1: za, h: (z) => ya + 0.02 + (yb - ya) * (z - za) / (zb - za) });
    for (const [x0, x1, z0, z1, top] of ESC) s.caja2(x0, x1, z0, z1, top);

    // ---- la CHABOLA contra el muro y la hoguera en un bidon
    const hoguera = V(-19.6, 0, 4.1);
    {
      const x0 = -25.6, x1 = -21.6;
      for (let k = 0; k < 5; k++) {
        const xa = x0 + 0.1 + k * 0.82;
        const p0 = V(xa + 0.45, 0.02, 2.95 + (r() - 0.5) * 0.1), p1 = V(xa + 0.45 + (r() - 0.5) * 0.05, 2.65 + (r() - 0.5) * 0.08, 0.2);
        chapaGrecada(L, p0, p1, 0.95, V(0, 1, 0.6), col('#ffffff').setScalar(0.85 + r() * 0.25));
      }
      barra('madera', V(x0, 2.5, 0.35), V(x1, 2.52, 0.35), 0.1, { tinta: 0.008, color: col('#7a6b58') });
      for (const [x, z] of [[-24.6, 1.4], [-22.8, 1.9]]) { const g = new THREE.TorusGeometry(0.26, 0.1, 8, 16).rotateX(Math.PI / 2 + 0.85).translate(x, 2.0 - (z - 1.4) * 0.8, z); L.meter('goma', g); L.tinta(g, 0.008); }
      cajaE('madera', x0 - 0.05, x0 + 0.05, 0, 1.2, 0.85, 2.85, { tinta: 0.008, color: col('#8a7a63') });
      for (let k = 0; k < 6; k++) cajaE('madera', x0 - 0.07, x0 + 0.07, 0.1 + k * 0.2, 0.18 + k * 0.2, 0.85, 2.85, { tinta: 0, color: col('#7b6c57') });
      {
        const g = new THREE.PlaneGeometry(2.0, 2.3, 12, 8);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) { const u = p.getX(i), v = p.getY(i); p.setZ(i, 0.06 * Math.sin(u * 5 + v) * (1.15 - v / 2.3)); }
        g.computeVertexNormals();
        g.rotateY(Math.PI / 2).translate(x1 + 0.08, 1.12, 1.85);
        L.meter('lona', g);
      }
      {
        const f = new THREE.Shape([new THREE.Vector2(0.85, 0.01), new THREE.Vector2(2.75, 0.01), new THREE.Vector2(0.85, 1.96)]);
        const g = new THREE.ExtrudeGeometry(f, { depth: x1 - x0 - 0.2, bevelEnabled: false });
        g.rotateY(-Math.PI / 2).translate(x1 - 0.02, 0, 0);
        L.meter('negro', g);
      }
      s.caja2(x0 - 0.1, x1 + 0.1, 0.8, 3.0);
      bidon(L, hoguera.x, 0, hoguera.z, { fila: 3, mat: 'fuego', tapa: false, semilla: 9 });
      for (let k = 0; k < 7; k++) barra('aceroOsc', V(hoguera.x - 0.3, 0.9, hoguera.z - 0.27 + k * 0.09), V(hoguera.x + 0.3, 0.9, hoguera.z - 0.27 + k * 0.09), 0.012, { tinta: 0 });
      cilindro('aceroOsc', V(hoguera.x + 0.08, 0.91, hoguera.z), V(hoguera.x + 0.08, 1.04, hoguera.z), 0.11, 14, 0.006);
      barra('aceroOsc', V(hoguera.x + 0.19, 1.0, hoguera.z), V(hoguera.x + 0.42, 1.03, hoguera.z + 0.05), 0.02, { tinta: 0 });
      s.circulo(hoguera.x, hoguera.z, 0.32);
      cajaMadera(L, hoguera.x - 1.5, hoguera.x - 1.0, 0, 0.42, hoguera.z - 0.3, hoguera.z + 0.22, { color: col('#7a6852'), picto: 1 });
      bidon(L, hoguera.x + 0.9, 0, hoguera.z + 1.0, { fila: 0, semilla: 11 });
      const neu = new THREE.TorusGeometry(0.26, 0.1, 8, 16).rotateX(Math.PI / 2).translate(hoguera.x + 0.3, 0.1, hoguera.z - 1.25); L.meter('goma', neu); L.tinta(neu, 0.008);
      s.circulo(hoguera.x - 1.25, hoguera.z - 0.04, 0.3); s.circulo(hoguera.x + 0.9, hoguera.z + 1.0, 0.3);
      // la cuerda de tender, de la chabola a un palo
      cilindro('madera', V(-17.4, 0, 6.6), V(-17.4, 1.95, 6.6), 0.035, 6, 0.006, col('#6b5e4e'));
      cilindro('madera', V(-21.35, 0, 3.15), V(-21.35, 2.0, 3.15), 0.04, 6, 0.006, col('#6b5e4e'));
      s.circulo(-17.4, 6.6, 0.06); s.circulo(-21.35, 3.15, 0.06);
      cable(L, V(-21.35, 1.95, 3.15), V(-17.4, 1.9, 6.6), 0.16, 0.007);
      for (const [t, w, h, c] of [[0.2, 0.42, 0.55, '#7d8790'], [0.38, 0.5, 0.4, '#6b5a4e'], [0.58, 0.38, 0.62, '#8f8b80'], [0.78, 0.55, 0.35, '#4e5966']]) {
        const a = V(-21.35, 1.95, 3.15).lerp(V(-17.4, 1.9, 6.6), t); a.y -= 4 * 0.16 * t * (1 - t);
        const g = new THREE.PlaneGeometry(w, h, 2, 2).translate(0, -h / 2, 0).rotateY(-0.72).translate(a.x, a.y, a.z);
        L.meter('lona', g, col(c));
      }
      caja('tela', -27.4, 0.95, 0.55, 0.9, 1.85, 0.16, { q: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.18, 0.06, 0)), tinta: 0.01, color: col('#8c8370') });
      for (const [x, z, sz] of [[-26.6, 1.3, 0.34], [-26.2, 1.05, 0.3], [-20.8, 1.2, 0.36], [-16.4, 3.6, 0.28]]) {
        const g = new THREE.SphereGeometry(sz, 10, 7);
        const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setY(i, Math.max(y, -sz * 0.55)); p.setX(i, p.getX(i) * (1 + 0.15 * Math.sin(i))); }
        g.computeVertexNormals(); g.translate(x, sz * 0.55, z);
        L.meter('negro', g); L.tinta(g, 0.008);
      }
      for (const [x, z, a] of [[-23.9, 3.4, 0.3], [-18.3, 2.9, -0.6]]) cajaE('pintura', x - 0.12, x + 0.12, 0, 0.32, z - 0.08, z + 0.08, { tinta: 0.006, color: col(a > 0 ? '#5f6d5b' : '#8a8f8a') });
      pale(L, -23.0, 0, 5.4, 0.5, col('#8a7a63'));
      s.caja2(-23.6, -22.4, 4.9, 5.9, 0.15);
    }
  }

  function saltaderoCuerda(L, s) {
    const x = 19.8;
    bidon(L, x - 0.6, 0, 1.25, { fila: 1, semilla: 3 }); bidon(L, x + 0.05, 0, 1.15, { fila: 3, semilla: 4 }); bidon(L, x - 0.3, 0.88, 1.2, { fila: 2, semilla: 5 });
    pale(L, x + 0.9, 0, 1.6, 0.2); pale(L, x + 0.9, 0.144, 1.62, 0.15);
    s.circulo(x - 0.6, 1.25, 0.3); s.circulo(x + 0.05, 1.15, 0.3);
    s.caja2(x + 0.3, x + 1.5, 1.15, 2.05, 0.29);
    // la cuerda: pasa por el agujero de izado, vuelve por encima de la tapa y cuelga hasta el suelo con nudos
    const xa = x + 0.3;
    cuerda(L, [V(xa, 3.7, 0.14), V(xa, 3.7, -0.14), V(xa + 0.02, 3.85, -0.13), V(xa + 0.02, 4.03, -0.05), V(xa + 0.01, 4.03, 0.06), V(xa, 3.85, 0.13), V(xa, 3.7, 0.15)], 0.014);
    const c = cuerda(L, [V(xa, 3.68, 0.15), V(xa + 0.01, 2.5, 0.152), V(xa + 0.02, 1.2, 0.16), V(xa + 0.03, 0.53, 0.2), V(xa + 0.05, 0.52, 0.75), V(xa + 0.1, 0.05, 0.95), V(xa + 0.4, 0.02, 1.25), V(xa + 0.1, 0.02, 1.4)], 0.014);
    for (let t = 0.05; t < 0.6; t += 0.07) { const p = c.getPointAt(t); const g = new THREE.SphereGeometry(0.03, 8, 6).scale(1, 1.3, 1).translate(p.x, p.y, p.z); L.meter('cuerda', g); }
  }

  // ================================================================ la hierba: no crece en el muro, el foso ni los sitios
  const antes = OBRA.ocupado;
  OBRA.ocupado = (x, z) => {
    if (antes && antes(x, z)) return true;
    if (z < CZ + 1) {
      const p = polar(x, z);
      if (p.a >= A0 && p.a <= A1 && p.r > RE - 1.0 && p.r < RE + 4.6) return true;
    }
    for (const c of sinHierba) if ((x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r) return true;
    return false;
  };

  // ================================================================ el suelo no se dibuja donde esta la banda del foso
  function recortarSuelo(mat) {
    if (!mat) return;
    const previo = mat.onBeforeCompile;
    mat.onBeforeCompile = (sh, r) => {
      if (previo) previo(sh, r);
      if (!/varying vec3 vExt;/.test(sh.vertexShader)) {
        sh.vertexShader = 'varying vec3 vExt;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vExt = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = 'varying vec3 vExt;\n' + sh.fragmentShader.replace('void main() {', `void main() {
  { vec2 d = vec2(vExt.x - ${CX.toFixed(1)}, ${CZ.toFixed(1)} - vExt.z); float rr = length(d);
    if (d.y > 0.0 && rr > ${(RE + SIN_SUELO[0]).toFixed(2)} && rr < ${(RE + SIN_SUELO[1]).toFixed(2)}) discard; }`);
      }
    };
    mat.customProgramCacheKey = () => 'suelo-sin-foso';
    mat.needsUpdate = true;
  }

  // ================================================================ lo que se pisa, por donde se va y cada fotograma
  let yHeroe = 0;
  // la cota del mundo en (x, z) con el foso y lo que se pisa por encima (h: la del terreno y la obra)
  function altura(x, z, h) {
    let y = h + perfil(x, z);
    for (const b of enCelda(x, z)) if (b.ytop != null && b.ytop > y && dentroCaja(b, x, z)) y = b.ytop;
    for (const t of tablas) {
      const l = aLocal(t.m, x, z), lx = l.x + t.ox;
      if (lx < t.x0 || lx > t.x1 || l.z < Math.min(t.z0, t.z1) || l.z > Math.max(t.z0, t.z1)) continue;
      const ht = t.h(l.z) + base(x, z);
      if (ht > y && yHeroe >= ht - 0.25) y = ht;
    }
    return y;
  }
  // los taludes del foso no se suben (mas de 42 grados de perfil); si cae dentro, sale por un terraplen o un relleno
  function limitar(p, desde, enSuelo) {
    if (!desde || !enSuelo) return;
    const pd = perfil(desde.x, desde.z);
    const ok = (x, z) => {
      const d = Math.hypot(x - desde.x, z - desde.z);
      if (d < 1e-5) return true;
      const dy = perfil(x, z) - pd;
      if (!(dy > 0.004 && dy / d > 0.9)) return true;
      // si encima hay algo que se pisa (los tablones), si
      const t = suelo(x, z);
      return altura(x, z, t) - (t + perfil(x, z)) > 0.01;
    };
    if (ok(p.x, p.z)) return;
    if (ok(p.x, desde.z)) { p.z = desde.z; return; }
    if (ok(desde.x, p.z)) { p.x = desde.x; return; }
    p.x = desde.x; p.z = desde.z;
  }

  // lo que se reparte al moverse: los bloques de cerca y de lejos, la concertina, los sitios y las cajas del 18
  const ultimo = { x: 1e9, z: 1e9 }, ultimoChoque = { x: 1e9, z: 1e9 };
  const mias = new Set();
  let nCerca = 0, nConc = 0;
  function repartir(f) {
    const n = new Array(VAR).fill(0);
    let nl = 0;
    const c2 = CERCA * CERCA;
    for (const b of bloques) {
      const dx = b.m.o.x - f.x, dz = b.m.o.z - f.z;
      if (dx * dx + dz * dz < c2 && n[b.v] < capCerca) {
        const o = cerca[b.v], k = n[b.v]++;
        o.h.setMatrixAt(k, b.mat); o.h.setColorAt(k, b.color); o.t.setMatrixAt(k, b.mat);
        if (o.p) o.p.setMatrixAt(k, b.mat);
      } else {
        lejosH.setMatrixAt(nl, b.mat); lejosH.setColorAt(nl, b.color); lejosT.setMatrixAt(nl, b.mat);
        nl++;
      }
    }
    nCerca = 0;
    cerca.forEach((o, v) => {
      for (const m of [o.h, o.t, o.p]) if (m) { m.count = n[v]; m.instanceMatrix.needsUpdate = true; }
      if (o.h.instanceColor) o.h.instanceColor.needsUpdate = true;
      nCerca += n[v];
    });
    for (const m of [lejosH, lejosT]) { m.count = nl; m.instanceMatrix.needsUpdate = true; }
    if (lejosH.instanceColor) lejosH.instanceColor.needsUpdate = true;
    // la concertina
    let k = 0;
    const cc = CERCA_CONC * CERCA_CONC;
    for (const t of conc.tramos) {
      if ((t.x - f.x) ** 2 + (t.z - f.z) ** 2 > cc || k >= 160) continue;
      for (const m of conc.mallas) m.setMatrixAt(k, t.mat);
      k++;
    }
    nConc = k;
    for (const m of conc.mallas) { m.count = k; m.instanceMatrix.needsUpdate = true; }
    for (const s of sitios) s.g.visible = Math.hypot(s.x - f.x, s.z - f.z) < LEJOS_SITIOS;
  }
  function choquesCerca(p) {
    if (!cajasMundo) return;
    for (let i = cajasMundo.length - 1; i >= 0; i--) if (mias.has(cajasMundo[i])) cajasMundo.splice(i, 1);
    mias.clear();
    const R2 = 24;
    const vistas = new Set();
    for (let i = Math.floor((p.x - R2) / CEL); i <= Math.floor((p.x + R2) / CEL); i++) {
      for (let j = Math.floor((p.z - R2) / CEL); j <= Math.floor((p.z + R2) / CEL); j++) {
        for (const b of rejilla.get(claveR(i, j)) || []) if (!vistas.has(b)) { vistas.add(b); cajasMundo.push(b); mias.add(b); }
      }
    }
  }
  function actualizar(foco, heroe) {
    if (heroe) yHeroe = heroe.pos.y;
    if (Math.hypot(foco.x - ultimo.x, foco.z - ultimo.z) > 6) { ultimo.x = foco.x; ultimo.z = foco.z; repartir(foco); }
    const p = heroe ? heroe.pos : foco;
    if (Math.hypot(p.x - ultimoChoque.x, p.z - ultimoChoque.z) > 3) { ultimoChoque.x = p.x; ultimoChoque.z = p.z; choquesCerca(p); }
  }

  const ms = Math.round(performance.now() - t0);
  const trisVar = variantes.map((v) => (v.hormigon.attributes.position.count + v.tinta.attributes.position.count) / 3);
  return {
    altura, limitar, actualizar, recortarSuelo, perfil, raiz, bloques, sitios,
    info: () => ({
      exteriorMs: ms, exteriorBloques: bloques.length, exteriorBloquesCerca: nCerca, exteriorTrisBloque: Math.round(trisVar.reduce((a, b) => a + b, 0) / VAR),
      exteriorConcertina: nConc, exteriorSitios: sitios.length, exteriorTrisSitios: sitios.reduce((a, s) => a + s.tris, 0), exteriorTrisFoso: banda.tris,
      exteriorCajas: todas.length, exteriorCajasCerca: mias.size,
    }),
  };
}

// ---------------------------------------------------------------- texturas pequenas (las de muro4)
function texturaMalla() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, 64, 64); c.fillStyle = '#fff';
  c.fillRect(0, 0, 64, 5); c.fillRect(0, 0, 5, 64);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function texturaAgujerosFuego() {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 512;
  const c = cv.getContext('2d'); c.fillStyle = '#000'; c.fillRect(0, 0, 512, 512);
  const r = azar(9);
  for (let k = 0; k < 70; k++) {
    const x = r() * 512, y = 384 + 16 + r() * 100;
    const g = c.createRadialGradient(x, y, 0, x, y, 6);
    g.addColorStop(0, 'rgba(255,190,110,1)'); g.addColorStop(0.5, 'rgba(255,120,40,.8)'); g.addColorStop(1, 'rgba(120,40,10,0)');
    c.fillStyle = g; c.fillRect(x - 6, y - 6, 12, 12);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function texturaAlfombra() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const c = cv.getContext('2d');
  c.fillStyle = '#6c4a43'; c.fillRect(0, 0, 256, 256);
  c.fillStyle = '#3e4652'; c.fillRect(0, 0, 256, 26); c.fillRect(0, 230, 256, 26);
  c.strokeStyle = '#a99a7c'; c.lineWidth = 6;
  for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(32 + k * 64, 60); c.lineTo(64 + k * 64, 128); c.lineTo(32 + k * 64, 196); c.lineTo(k * 64, 128); c.closePath(); c.stroke(); }
  const r = azar(12);
  for (let n = 0; n < 2400; n++) { c.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.05 + r() * 0.12})`; c.fillRect(r() * 256, r() * 256, 2, 2); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// la tira de senales del puesto (ocho casillas, sin palabras): 0-2 el codigo X-n, 3 peligro, 4 rayo, 5 alto, 6 franjas, 7 camara
function texturaSenales4() {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 128;
  const c = cv.getContext('2d');
  const placa = (i, fondo) => { c.fillStyle = fondo; c.fillRect(i * 128 + 4, 4, 120, 120); c.strokeStyle = '#1b1d20'; c.lineWidth = 5; c.strokeRect(i * 128 + 9, 9, 110, 110); };
  const texto = (i, t, tam, y = 64) => { c.fillStyle = '#16181b'; c.font = `bold ${tam}px Bahnschrift, Arial Narrow, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, i * 128 + 64, y); };
  const triangulo = (i) => { c.fillStyle = '#cdb766'; c.beginPath(); c.moveTo(i * 128 + 64, 16); c.lineTo(i * 128 + 116, 108); c.lineTo(i * 128 + 12, 108); c.closePath(); c.fill(); c.lineWidth = 7; c.strokeStyle = '#16181b'; c.stroke(); };
  ['X-1', 'X-2', 'X-3'].forEach((t, i) => { placa(i, '#c3c6c2'); texto(i, t, 50); });
  c.fillStyle = '#c3c6c2'; c.fillRect(3 * 128, 0, 128, 128); triangulo(3); texto(3, '!', 58, 76);
  c.fillStyle = '#c3c6c2'; c.fillRect(4 * 128, 0, 128, 128); triangulo(4);
  c.fillStyle = '#16181b'; c.beginPath(); c.moveTo(4 * 128 + 70, 40); c.lineTo(4 * 128 + 52, 74); c.lineTo(4 * 128 + 64, 74); c.lineTo(4 * 128 + 56, 100); c.lineTo(4 * 128 + 78, 64); c.lineTo(4 * 128 + 66, 64); c.closePath(); c.fill();
  c.fillStyle = '#c3c6c2'; c.fillRect(5 * 128, 0, 128, 128);
  c.fillStyle = '#7d3a33'; c.beginPath(); c.arc(5 * 128 + 64, 64, 56, 0, 7); c.fill();
  c.fillStyle = '#e8e4da';
  c.beginPath(); c.ellipse(5 * 128 + 64, 76, 22, 24, 0, 0, 7); c.fill();
  for (const [dx, h] of [[-16, 34], [-5, 42], [6, 42], [17, 34]]) c.fillRect(5 * 128 + 64 + dx - 4, 70 - h, 9, h);
  c.save(); c.translate(5 * 128 + 40, 70); c.rotate(-0.6); c.fillRect(-4, -26, 9, 28); c.restore();
  c.save(); c.beginPath(); c.rect(6 * 128, 0, 128, 128); c.clip(); c.fillStyle = '#cdb766'; c.fillRect(6 * 128, 0, 128, 128); c.fillStyle = '#16181b';
  for (let k = -2; k < 6; k++) { c.beginPath(); c.moveTo(6 * 128 + k * 40, 128); c.lineTo(6 * 128 + k * 40 + 20, 128); c.lineTo(6 * 128 + k * 40 + 148, 0); c.lineTo(6 * 128 + k * 40 + 128, 0); c.closePath(); c.fill(); }
  c.restore();
  placa(7, '#c3c6c2');
  c.fillStyle = '#16181b'; c.fillRect(7 * 128 + 30, 50, 56, 30); c.fillRect(7 * 128 + 86, 56, 14, 18); c.fillRect(7 * 128 + 50, 80, 8, 24); c.fillRect(7 * 128 + 38, 100, 32, 6);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
