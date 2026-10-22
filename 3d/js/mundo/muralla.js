// LA MURALLA (2026-10-21, "tengo el muro hecho, metelo al mapa, asi redondo, que rodee"): el muro de 40 m de la prueba
// del paso a 3D (boundland-paso3d: paneles, danos, musgo, contrafuertes, cinturones, coronacion con alambrada y
// concertina) en CIRCULO alrededor de la Base, donde lo ponen los planos (diseno/planos/mapa.py: centro en el origen del
// plano, radio del eje R_MURO = 450 m, 8 m de grueso; en el juego z = YC - y del plano, asi que el centro es (0, 2400)).
//
// El muro no se rehace aqui: tools/exportar_muro.py saca de esa prueba dos TRAMOS TIPO de 36 m (12 paneles cortados por
// las juntas, con un contrafuerte a 0,5 m de cada corte, asi que se repiten sin costura) a web/modelo/muralla/. El
// circulo son 79 tramos rectos (cuerda de 35,8 m: el tramo se encoge un 0,6 %), cada uno con su cara de dentro y su cara
// de fuera (el mismo tramo girado) y un NUCLEO de hormigon de 8 m entre las dos con la coronacion encima. Cada tramo
// apoya en el punto MAS BAJO del suelo bajo su planta (nunca flota; donde el suelo sube se entierra el pie).
//
// Detalle por distancia: las caras a menos de CERCA del 18 van con todas sus mallas (InstancedMesh por malla del tramo);
// las demas son una FOTO de su tramo (un plano con la cara pintada en ortografica al empezar, con su alambrada recortada
// por alfa). Tres PUERTAS donde los caminos de los planos cruzan el muro (35, 90 y 150 grados del plano): falta el tramo,
// queda un dintel de hormigon de 16 m arriba y el 18 pasa por debajo. El resto del circulo no se cruza (`limitar`).
import * as THREE from 'three';
import * as R from './relieve.js';
import { TONO } from './tono.js';
import { construirPuerta, PILAR } from './puerta.js';

export const MURALLA = {
  cx: 0, cz: R.GEO.YC ?? 2400, r: 450, grosor: 8, alto: 40,
  puertas: [35, 90, 150],          // grados del plano (de este hacia el norte), donde los caminos cruzan el muro
  luzPuerta: 17,                   // alto libre bajo el dintel (la junta de paneles de 17 m: el dintel es el muro de ahi arriba)
};
const LARGO = 36;                   // el tramo tipo
const N = Math.round(2 * Math.PI * MURALLA.r / LARGO);   // 79
const PASO_A = 2 * Math.PI / N;
const CUERDA = 2 * MURALLA.r * Math.sin(PASO_A / 2);
const R_CUERDA = MURALLA.r * Math.cos(PASO_A / 2);
const CERCA = 120;                  // m: a menos, la cara con todo su detalle
const MAX_CERCA = 14;               // caras con detalle a la vez como mucho (cada una, 130-170 mil triangulos)
const ALTO_FOTO = 44;               // la foto llega hasta lo alto de la concertina

const URL_MURO = new URL('../../modelo/muralla/', import.meta.url);
let MAN = null, BIN = null;
if (typeof window !== 'undefined') {
  try {
    [MAN, BIN] = await Promise.all([
      fetch(new URL('tramos.json', URL_MURO)).then((r) => (r.ok ? r.json() : null)),
      fetch(new URL('tramos.bin', URL_MURO)).then((r) => (r.ok ? r.arrayBuffer() : null)),
    ]);
  } catch (e) { MAN = BIN = null; }
}

// la posicion de un angulo del PLANO (de este hacia el norte) en el juego, a radio r
const enPlano = (a, r) => ({ x: MURALLA.cx + r * Math.cos(a), z: MURALLA.cz - r * Math.sin(a) });
const esPuerta = (k) => MURALLA.puertas.some((g) => { const a = (g * Math.PI) / 180; return a >= k * PASO_A && a < (k + 1) * PASO_A; });

export function crearMuralla(grupo) {
  const raiz = new THREE.Group();
  raiz.name = 'muralla';
  grupo.add(raiz);
  if (!MAN || !BIN) {
    console.warn('muralla: falta web/modelo/muralla (correr tools/exportar_muro.py)');
    return { actualizar() {}, limitar() {}, conectar() {}, info: () => ({ muralla: 'sin datos' }) };
  }

  // ---- los tramos: geometria y material de cada malla
  const texturas = {};
  // la FOTO de lejos se pinta cuando esten las texturas Y el renderer (pintada antes, salia negra)
  let renderer = null, texturasListas = false;
  const gestor = new THREE.LoadingManager(() => { texturasListas = true; if (renderer) pintarFotos(renderer); });
  const cargador = new THREE.TextureLoader(gestor);
  for (const [uid, t] of Object.entries(MAN.texturas)) {
    const tx = cargador.load(new URL(t.archivo, URL_MURO).href);
    tx.flipY = t.flipY; tx.wrapS = t.wrapS; tx.wrapT = t.wrapT;
    tx.repeat.set(t.repeat[0], t.repeat[1]); tx.offset.set(t.offset[0], t.offset[1]);
    tx.colorSpace = t.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tx.anisotropy = 4;
    texturas[uid] = tx;
  }
  const f32 = (o, n) => new Float32Array(BIN, o, n);
  function material(m) {
    const comun = {
      color: new THREE.Color(m.color), map: m.mapa ? texturas[m.mapa] : null, vertexColors: m.vc, side: m.lado,
      transparent: m.transparente, opacity: m.opacidad, alphaTest: m.alphaTest, depthWrite: m.depthWrite,
      polygonOffset: m.polyOff, polygonOffsetFactor: m.pofF, polygonOffsetUnits: m.pofU,
    };
    // lo que en la prueba era basico (la tinta, el fondo de las grietas, las manchas) sigue basico; lo demas, al toon de
    // cuatro escalones del mapa del mundo, con los mismos colores y texturas
    return m.tipo === 'MeshBasicMaterial' ? new THREE.MeshBasicMaterial(comun) : new THREE.MeshToonMaterial({ ...comun, gradientMap: TONO });
  }
  const tramos = {};
  for (const T of MAN.tramos) tramos[T.id] = { id: T.id, mallas: [] };
  let trisTramo = {};
  for (const m of MAN.mallas) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(f32(m.pos, m.verts * 3), 3));
    if (m.nor >= 0) g.setAttribute('normal', new THREE.BufferAttribute(f32(m.nor, m.verts * 3), 3));
    if (m.uv >= 0) g.setAttribute('uv', new THREE.BufferAttribute(f32(m.uv, m.verts * 2), 2));
    if (m.col >= 0) g.setAttribute('color', new THREE.BufferAttribute(f32(m.col, m.verts * m.colN), m.colN));
    g.setIndex(new THREE.BufferAttribute(m.idx32 ? new Uint32Array(BIN, m.idx, m.tris * 3) : new Uint16Array(BIN, m.idx, m.tris * 3), 1));
    if (m.nor < 0) g.computeVertexNormals();
    const mat = material(m.mat);
    tramos[m.tramo].mallas.push({ g, mat, tinta: m.mat.tipo === 'MeshBasicMaterial' && m.mat.lado === THREE.BackSide });
    trisTramo[m.tramo] = (trisTramo[m.tramo] || 0) + m.tris;
  }
  const ids = Object.keys(tramos);
  const idsMuro = ids.filter((id) => id !== 'p');          // 'p' es el dintel de las puertas

  // ---- el circulo: por cada tramo k, su altura de pie y las dos caras
  const caras = [];                      // { k, tramo, matriz, centro }
  const nucleo = [], dinteles = [];
  const _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0), _z = new THREE.Vector3();
  const _s = new THREE.Matrix4().makeScale(1, 1, CUERDA / LARGO);
  const g2 = MURALLA.grosor / 2;
  for (let k = 0; k < N; k++) {
    const am = (k + 0.5) * PASO_A;
    const u = { x: Math.cos(am), z: -Math.sin(am) };        // hacia fuera, en el juego
    const t = { x: -Math.sin(am), z: -Math.cos(am) };       // a lo largo
    // el pie: lo mas bajo del suelo bajo la planta (las dos caras, el eje y lo que sobresalen contrafuertes y musgo)
    let y0 = Infinity;
    const c0 = enPlano(am, R_CUERDA);
    for (let s = -0.5; s <= 0.5001; s += 2 / CUERDA) {
      for (const d of [-g2 - 2.6, -g2, 0, g2, g2 + 2.6]) {
        const x = c0.x + t.x * s * CUERDA + u.x * d, z = c0.z + t.z * s * CUERDA + u.z * d;
        y0 = Math.min(y0, R.altura(x, z));
      }
    }
    const puerta = esPuerta(k);
    nucleo.push({ x: c0.x, z: c0.z, am, y0, puerta });
    if (puerta) dinteles.push({ x: c0.x, z: c0.z, am, y0 });
    // los dos tramos repartidos sin un patron seguido; en las puertas, el DINTEL: el mismo muro de 17 m para arriba
    const id = puerta ? (tramos.p ? 'p' : null) : idsMuro[(k * 7 + 3) % idsMuro.length];
    if (!id) continue;
    for (const lado of [-1, 1]) {                            // -1: la cara de dentro (mira a la Base); 1: la de fuera
      _x.set(lado * u.x, 0, lado * u.z);                      // x' del tramo: hacia donde mira la cara
      _z.crossVectors(_x, _y);
      const cx = c0.x + u.x * g2 * lado, cz = c0.z + u.z * g2 * lado;
      const mtx = new THREE.Matrix4().makeBasis(_x, _y, _z).multiply(_s).setPosition(cx, y0, cz);
      caras.push({ k, tramo: id, matriz: mtx, centro: new THREE.Vector3(cx, y0 + 20, cz), lado });
    }
  }

  // ---- el nucleo y la coronacion (un prisma por tramo), y los dinteles de las puertas
  const matNucleo = new THREE.MeshToonMaterial({ color: 0x6a7178, gradientMap: TONO });
  const gNucleo = new THREE.BoxGeometry(MURALLA.grosor - 0.12, MURALLA.alto + 3, CUERDA + 0.6).translate(0, (MURALLA.alto + 3) / 2 - 3, 0);
  const imNucleo = new THREE.InstancedMesh(gNucleo, matNucleo, nucleo.filter((n) => !n.puerta).length);
  const gDintel = new THREE.BoxGeometry(MURALLA.grosor - 0.12, MURALLA.alto - MURALLA.luzPuerta, CUERDA + 0.6).translate(0, (MURALLA.alto + MURALLA.luzPuerta) / 2, 0);
  const imDintel = new THREE.InstancedMesh(gDintel, matNucleo, Math.max(1, dinteles.length));
  let i = 0;
  // la caja va con su x a lo ancho del muro (hacia fuera) y su z a lo largo
  const giro = (n) => {
    _x.set(Math.cos(n.am), 0, -Math.sin(n.am));
    _z.crossVectors(_x, _y);
    return new THREE.Matrix4().makeBasis(_x, _y, _z);
  };
  for (const n of nucleo) {
    if (n.puerta) continue;
    imNucleo.setMatrixAt(i++, giro(n).setPosition(n.x, n.y0, n.z));
  }
  dinteles.forEach((n, j) => imDintel.setMatrixAt(j, giro(n).setPosition(n.x, n.y0, n.z)));
  imDintel.count = dinteles.length;
  for (const im of [imNucleo, imDintel]) { im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; raiz.add(im); }
  // lo de cada puerta: el techo del paso, los pilares, el porton, sus guias y los focos (puerta.js)
  const atlasM = MAN.mallas.filter((m) => m.tramo === 'a' && m.mat.mapa && m.mat.vc).sort((x, y) => y.tris - x.tris)[0];
  const puertas = dinteles.map((n, j) => {
    const g = construirPuerta({ atlas: atlasM ? texturas[atlasM.mat.mapa] : null, cuerda: CUERDA, grosor: MURALLA.grosor, luz: MURALLA.luzPuerta, numero: j + 1, semilla: 11 + j });
    g.matrixAutoUpdate = false;
    g.matrix.copy(giro(n).setPosition(n.x, n.y0, n.z));
    raiz.add(g);
    return g;
  });

  // ---- el detalle: una InstancedMesh por malla de cada tramo, con sitio para MAX_CERCA caras
  const detalle = {};
  for (const id of ids) {
    detalle[id] = tramos[id].mallas.map(({ g, mat, tinta }) => {
      const im = new THREE.InstancedMesh(g, mat, MAX_CERCA);
      im.count = 0; im.frustumCulled = false; im.castShadow = false; im.receiveShadow = !tinta;
      raiz.add(im);
      return im;
    });
  }

  // ---- la FOTO de cada tramo (para lejos): se pinta al conectar el renderer
  const fotos = {};
  for (const id of ids) {
    const g = new THREE.PlaneGeometry(LARGO, ALTO_FOTO).rotateY(Math.PI / 2).translate(0.06, ALTO_FOTO / 2, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, alphaTest: 0.5, side: THREE.FrontSide });
    mat.userData.foto = true;          // la luz va horneada en la foto: horas.js la tine segun la hora
    const im = new THREE.InstancedMesh(g, mat, caras.length);
    im.count = 0; im.frustumCulled = false; im.visible = false;
    raiz.add(im);
    fotos[id] = im;
  }
  function pintarFotos(renderer) {
    const esc = new THREE.Scene();
    esc.add(new THREE.HemisphereLight(0xf3efd6, 0x55603a, 1.55));
    const sol = new THREE.DirectionalLight(0xffe3b2, 2.7);
    sol.position.set(40, 60, 25);
    esc.add(sol);
    // mirando a la cara desde +x' (su derecha es -z': la foto va de z' = +18 a -18, como las UV del plano girado)
    const cam = new THREE.OrthographicCamera(-LARGO / 2, LARGO / 2, ALTO_FOTO, 0, 0.1, 200);
    cam.position.set(60, 0, 0);
    cam.lookAt(0, 0, 0);
    const ANCHO = 1024, ALTO = Math.round(ANCHO * ALTO_FOTO / LARGO);
    const antes = renderer.getRenderTarget(), color = new THREE.Color(), alfa = renderer.getClearAlpha();
    renderer.getClearColor(color);
    for (const id of ids) {
      const rt = new THREE.WebGLRenderTarget(ANCHO, ALTO, { samples: 4, colorSpace: THREE.SRGBColorSpace });
      const g = new THREE.Group();
      for (const { g: geo, mat, tinta } of tramos[id].mallas) if (!tinta) g.add(new THREE.Mesh(geo, mat));
      esc.add(g);
      renderer.setRenderTarget(rt);
      renderer.setClearColor(0x6a7178, 0);
      renderer.clear();
      renderer.render(esc, cam);
      esc.remove(g);
      fotos[id].material.map = rt.texture;
      fotos[id].material.needsUpdate = true;
      fotos[id].visible = true;
    }
    renderer.setRenderTarget(antes);
    renderer.setClearColor(color, alfa);
  }

  // ---- cada fotograma (o al moverse 4 m): que caras van con detalle y cuales en foto
  const ultimo = new THREE.Vector3(1e9, 0, 0);
  let nDetalle = 0;
  function repartir(foco) {
    const orden = caras.map((c, j) => ({ j, d: Math.hypot(c.centro.x - foco.x, c.centro.z - foco.z) })).sort((a, b) => a.d - b.d);
    const cerca = new Set(orden.filter((o) => o.d < CERCA).slice(0, MAX_CERCA).map((o) => o.j));
    const nD = {}, nF = {};
    for (const id of ids) { nD[id] = 0; nF[id] = 0; }
    caras.forEach((c, j) => {
      if (cerca.has(j)) { for (const im of detalle[c.tramo]) im.setMatrixAt(nD[c.tramo], c.matriz); nD[c.tramo]++; }
      else { fotos[c.tramo].setMatrixAt(nF[c.tramo]++, c.matriz); }
    });
    for (const id of ids) {
      for (const im of detalle[id]) { im.count = nD[id]; im.instanceMatrix.needsUpdate = true; }
      fotos[id].count = nF[id]; fotos[id].instanceMatrix.needsUpdate = true;
    }
    nDetalle = cerca.size;
  }
  function actualizar(foco) {
    if (Math.hypot(foco.x - ultimo.x, foco.z - ultimo.z) < 4) return;
    ultimo.copy(foco);
    repartir(foco);
  }

  // ---- que no se cruce salvo por las puertas: el circulo del 18 contra la corona del muro
  const MEDIO = MURALLA.grosor / 2 + 0.3, RADIO18 = 0.24;
  const puertasRad = MURALLA.puertas.map((g) => (g * Math.PI) / 180);
  const mediaPuerta = (CUERDA / 2 - PILAR - 0.3) / MURALLA.r;    // entre los dos pilares
  function limitar(p) {
    const dx = p.x - MURALLA.cx, dz = MURALLA.cz - p.z, d = Math.hypot(dx, dz);
    const hueco = MEDIO + RADIO18;
    if (Math.abs(d - MURALLA.r) >= hueco || d < 1) return;
    const a = (Math.atan2(dz, dx) + 2 * Math.PI) % (2 * Math.PI);
    if (puertasRad.some((pa) => Math.abs(Math.atan2(Math.sin(a - pa), Math.cos(a - pa))) < mediaPuerta)) return;
    const r = d < MURALLA.r ? MURALLA.r - hueco : MURALLA.r + hueco;
    p.x = MURALLA.cx + (dx / d) * r;
    p.z = MURALLA.cz - (dz / d) * r;
  }

  return {
    raiz, actualizar, limitar,
    conectar(r) { renderer = r; if (renderer && texturasListas) pintarFotos(renderer); },
    info: () => ({ muralla: { tramos: N, cuerda: +CUERDA.toFixed(2), caras: caras.length, detalle: nDetalle, trisTramo, puertas: dinteles.length } }),
    MURALLA, caras, nucleo,
  };
}
