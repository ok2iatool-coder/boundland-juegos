// LAS TORRES DE REFUGIO (2026-10-21): torres del MODULO DE REFUGIO (escuela/obras/modulo_refugio, hecho por codigo a
// peticion del usuario: hexagono blanco y gastado de 13 m entre caras y 3,4 m por planta, pilares con pivote, puertas,
// ventanas con contraventanas, balcon, maquinas del aire, y por la cara de la puerta la pasarela y la escalera exterior
// en zigzag), apiladas por plantas por todo El Panal.
//
// EL REPARTO (desde el 21-10, «alrededor del edificio central, y cuanto mas se aleje, menos torres altas... una silueta
// fluida; rellena todos los huecos; salvo alguna alta dispersa»): web/datos/mundo/torres.json, que escribe
// tools/torres_panal.py (red hexagonal de 34 m sobre El Panal, altura por la distancia al macroedificio con una curva
// suave y alguna alta suelta lejos): ~200 torres y ~2.600 plantas. Antes eran listas a mano (4, 12, 27, 47).
//
// EL DIBUJO: con 200 torres un objeto por torre eran mas de 2.000 llamadas de dibujo, asi que van en INSTANCIAS
// GLOBALES, una InstancedMesh por pieza para todas las torres: las de menos de CERCA m del 18 con la planta entera
// (modulo_A / modulo_B, los tramos de escalera, la azotea; con sombra) y las demas con la planta en cajas
// (modulo_lejos) y su azotea. El reparto entre cerca y lejos se rehace cuando el 18 se mueve 6 m.
// web/modelo/torre/modulo_refugio.glb (copia de salida/modulo_refugio.glb de la obra) trae las piezas en metros, todas
// con el eje del modulo en el origen.
//
// SE SUBEN: la pasarela, los rellanos y cada peldano se PISAN y las barandillas paran, con las cajas de
// web/modelo/torre/pisables.json (de pisables.py de la obra, de las mismas cotas que la malla). Cada caja lleva su tapa
// (`ytop`) y su fondo (`ybot`): por debajo de la pasarela de encima se pasa. Se calculan solo para la torre que tiene el
// 18 al lado (y se guardan); `altura` da lo mas alto que se puede pisar por debajo de los pies del 18 (+ un escalon).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as R from './relieve.js';
import { TONO } from './tono.js';
import { OBRA } from './sitios.js';
import { crearVariantes, enEdificios } from './panal_variantes.js';

// el reparto (si falta el .json, las cuatro primeras, las de los circulos verdes de la captura)
const RESERVA_LISTA = [
  { x: 20, z: 2528.56, plantas: 20, giro: 0.35 }, { x: -160, z: 2563.21, plantas: 15, giro: 2.1 },
  { x: -120, z: 2424.64, plantas: 10, giro: -0.6 }, { x: -240, z: 2424.64, plantas: 30, giro: 1.2 },
];
const DATOS = await (async () => {
  try {
    const j = await fetch(new URL('../../datos/mundo/torres.json', import.meta.url), { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null));
    if (j && j.torres && j.torres.length) return j;
  } catch (e) { /* sin el reparto: la lista de reserva */ }
  return { torres: RESERVA_LISTA, edificios: [] };
})();
export const TORRES = DATOS.torres;
// las tres variantes (colmena, espiga, racimo): panal_variantes.js
export const EDIFICIOS = DATOS.edificios || [];
const PLANTA = 3.4;                       // m de forjado a forjado (cotas.py de la obra)
const APOTEMA = 6.5, LADO = 7.506;        // el hexagono: 13 m entre caras, 15 entre vertices
const RESERVA = 14;                       // m: el racimo entero de El Panal queda libre
const CERCA = 100;                        // m: hasta aqui, la planta entera; mas lejos, en cajas

// rejilla de 32 m con las torres de cada celda: las preguntas de "hay una torre aqui" (cimientos, hierba) no recorren 200
const CELDA = 32, REJ = new Map();
TORRES.forEach((t, k) => {
  const i = Math.floor(t.x / CELDA), j = Math.floor(t.z / CELDA);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const c = `${i + a},${j + b}`;
    if (!REJ.has(c)) REJ.set(c, []);
    REJ.get(c).push(k);
  }
});
const cercanas = (x, z) => REJ.get(`${Math.floor(x / CELDA)},${Math.floor(z / CELDA)}`) || [];
const hayTorre = (x, z, r) => cercanas(x, z).some((k) => (x - TORRES[k].x) ** 2 + (z - TORRES[k].z) ** 2 < r * r);
export const reservadoTorres = (x, z) => hayTorre(x, z, RESERVA) || enEdificios(EDIFICIOS, x, z, 4);
// la planta i de la torre t: A o B (sin que se repita la misma cara en filas largas)
const variante = (t, i) => (Math.sin(i * 12.9898 + t.x * 0.0781) * 43758.5453 % 1 + 1) % 1 < 0.5 ? 'modulo_A' : 'modulo_B';

// ---- EL ASPECTO DE CADA TORRE (22-10, «que no parezcan copia pega»): el mismo modulo, pero cada torre con su pintura,
// sus escaleras, sus contraventanas, sus luces de noche y lo que han subido a la azotea. Sale de la posicion de la torre
// (siempre igual) y va por instancia: tres tintes que multiplican el color de los materiales (PANEL la chapa, METAL la
// escalera y las barandillas, ACENTO puertas, contraventanas y toldos) y LUZ, cuanto se enciende cada planta de noche.
const PINTURAS = [                                              // [peso, tinte] sobre la chapa blanca gastada
  [5, [1, 1, 1]], [3, [1.04, 1.0, 0.9]], [2, [1.07, 0.98, 0.82]], [2, [0.9, 0.94, 0.98]], [2, [0.92, 1.01, 0.88]],
  [2, [1.06, 0.95, 0.8]], [1, [0.86, 0.92, 1.04]], [1, [1.09, 0.93, 0.84]], [1, [0.97, 0.88, 0.86]],
];
const METALES = [                                               // sobre el acero gris oscuro de la escalera
  [4, [1, 1, 1]], [2, [1.9, 0.95, 0.75]], [2, [0.8, 1.35, 0.95]], [1, [0.8, 1.0, 1.6]], [1, [2.0, 1.7, 0.7]], [2, [0.62, 0.62, 0.62]],
];
const ACENTOS = [                                               // contraventanas, puertas y toldos
  [3, [1, 1, 1]], [2, [1.7, 0.95, 0.7]], [2, [0.8, 1.05, 1.5]], [2, [0.85, 1.3, 0.85]], [2, [1.6, 1.35, 0.7]], [1, [1.3, 0.62, 0.62]], [1, [1.5, 1.45, 1.4]],
];
function azar(t) {                                              // mulberry32 sembrado con el sitio de la torre
  let a = (Math.round(t.x * 10) * 73856093) ^ (Math.round(t.z * 10) * 19349663);
  return () => { a = (a + 0x6d2b79f5) | 0; let r = Math.imul(a ^ (a >>> 15), 1 | a); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
const elegir = (lista, r) => { let s = lista.reduce((a, [p]) => a + p, 0) * r(); for (const [p, v] of lista) if ((s -= p) < 0) return v; return lista[0][1]; };
// lo que se sube a la azotea: sitios libres del deposito, la maquina, la escotilla y la antena de la obra (en el marco
// del modulo, x y z de three) y cuantas torres llevan cada cosa
const SITIOS_AZOTEA = [[-3.5, 2.6], [1.5, 4.2], [4.3, 0.8], [0.6, -3.8], [-4.6, -0.6]];
const EXTRAS = [['caseta', 0.35], ['placas', 0.35], ['deposito', 0.25], ['huerto', 0.25], ['mastil', 0.15]];
function aspecto(t) {
  const r = azar(t), n = t.plantas;
  const pintura = elegir(PINTURAS, r), metal = elegir(METALES, r), acento = elegir(ACENTOS, r);
  const sucioAbajo = r() < 0.25 ? 2 + Math.floor(r() * 3) : 0;   // las de abajo, mas sucias
  const panel = [], acc = [], luz = [];
  for (let i = 0; i < n; i++) {
    let p = pintura;
    const q = r();
    if (q < 0.1) p = elegir(PINTURAS, r);                                // un modulo de repuesto, de otra pintura
    else if (q < 0.14) p = [0.8, 0.82, 0.82];                             // uno sin pintar
    const k = (0.95 + r() * 0.08) * (i < sucioAbajo ? 0.84 + i * 0.04 : 1);
    panel.push(p.map((c) => c * k));
    acc.push(r() < 0.25 ? elegir(ACENTOS, r) : acento);                  // cada vecino pinta sus contraventanas
    luz.push(r() < 0.35 ? 0 : 0.5 + r() * 0.8);
  }
  const libres = SITIOS_AZOTEA.slice(), extras = [];
  for (const [nombre, prob] of EXTRAS) {
    if (!libres.length || r() >= prob) continue;
    const s = libres.splice(Math.floor(r() * libres.length), 1)[0];
    extras.push({ nombre, x: s[0], z: s[1], giro: Math.floor(r() * 4) * Math.PI / 2 });
  }
  return { panel, metal, acc, luz, extras };
}
// los tintes en el sombreador: cada material coge el suyo (tres atributos por instancia; LUZ va en la cuarta del acento)
const TINTE_DE = (nombre) => (/panel/i.test(nombre) ? 'tPanel' : /acero de escalera|peldano|oxido/i.test(nombre) ? 'tMetal' : /contraventana|puerta|toldo/i.test(nombre) ? 'tAcento.rgb' : 'vec3(1.0)');
function tenir(m) {
  const expr = TINTE_DE(m.name || '');
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute vec3 tPanel;\nattribute vec3 tMetal;\nattribute vec4 tAcento;\nvarying vec3 vTinte;\nvarying float vLuz;\n'
      + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n  vTinte = ${expr};\n  vLuz = tAcento.a;`);
    sh.fragmentShader = 'varying vec3 vTinte;\nvarying float vLuz;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= vTinte;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= vLuz;');
  };
  m.customProgramCacheKey = () => 'torre:' + expr;
  return m;
}

export function crearTorres(grupo, cajas) {
  const raiz = new THREE.Group();
  raiz.name = 'torres';
  grupo.add(raiz);
  let listo = false, fallo = null;
  const tris = { cerca: 0, lejos: 0 };
  // la cota: lo mas bajo de la huella (el forjado de la planta baja se entierra un poco donde el suelo sube)
  const yBase = TORRES.map((t) => {
    let y = R.altura(t.x, t.z);
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; y = Math.min(y, R.altura(t.x + Math.cos(a) * LADO, t.z + Math.sin(a) * LADO)); }
    return y - 0.05;
  });
  // choques: el hexagono de cada torre como una caja girada con el (la escalera, con los pisables)
  TORRES.forEach((t) => cajas.push({ x: t.x, z: t.z, hx: APOTEMA, hz: LADO * 0.9, ang: -t.giro }));
  // (las variantes no chocan desde aqui: sus cajas, con su altura, las pone panal_variantes.js junto al 18)
  // ni hierba
  const antes = OBRA.ocupado;
  OBRA.ocupado = (x, z) => (antes && antes(x, z)) || hayTorre(x, z, 12.5) || enEdificios(EDIFICIOS, x, z, 1.5);

  // ---- lo que se pisa y lo que para (pisables.json), en el mundo, solo de la torre de al lado (y se guarda)
  let PJ = null;
  fetch(new URL('../../modelo/torre/pisables.json', import.meta.url)).then((r) => r.json()).then((j) => { PJ = j; }).catch((e) => { fallo = 'pisables: ' + e; });
  const pisables = new Map();
  function dePisables(k) {
    if (pisables.has(k) || !PJ) return pisables.get(k) || null;
    const t = TORRES[k], c = Math.cos(t.giro), s = Math.sin(t.giro), T = { suelos: [], todas: [] };
    // [x0, x1, y0, y1, z0, z1] de Blender (z arriba) -> caja del juego (y arriba, z = -y), girada con la torre
    const poner = ([x0, x1, y0, y1, z0, z1], dz, suelo) => {
      const lx = (x0 + x1) / 2, lz = -(y0 + y1) / 2;
      const b = { x: t.x + lx * c + lz * s, z: t.z - lx * s + lz * c, hx: (x1 - x0) / 2, hz: (y1 - y0) / 2, ang: -t.giro, ytop: yBase[k] + dz + z1, ybot: yBase[k] + dz + z0 };
      T.todas.push(b);
      if (suelo) T.suelos.push(b);
    };
    const grupoP = (g, dz) => { g.suelos.forEach((q) => poner(q, dz, true)); g.barandas.forEach((q) => poner(q, dz, false)); };
    for (let i = 0; i < t.plantas; i++) {
      grupoP(PJ.planta, i * PLANTA);
      if (i < t.plantas - 1) grupoP(i % 2 ? PJ.tramo_impar : PJ.tramo_par, i * PLANTA);
    }
    grupoP(PJ.peldanos_suelo, 0);
    pisables.set(k, T);
    return T;
  }
  const dentro = (b, x, z) => {
    const ca = Math.cos(b.ang), sa = Math.sin(b.ang), lx = (x - b.x) * ca + (z - b.z) * sa, lz = -(x - b.x) * sa + (z - b.z) * ca;
    return Math.abs(lx) <= b.hx && Math.abs(lz) <= b.hz;
  };
  let yPies = -1e9, cerca = -1;
  // lo mas alto que se puede pisar en (x, z) que no pase de los pies del 18 mas un escalon (h: el suelo de debajo)
  function altura(x, z, h) {
    h = variantes.altura(x, z, h);                // las escaleras, puentes y terrazas de las variantes
    if (cerca < 0) return h;
    const t = TORRES[cerca];
    if ((x - t.x) ** 2 + (z - t.z) ** 2 > 16 * 16) return h;
    const P = dePisables(cerca);
    if (!P) return h;
    let y = h;
    for (const b of P.suelos) if (b.ytop > y && b.ytop <= yPies + 0.4 && dentro(b, x, z)) y = b.ytop;
    return y;
  }

  // ---- el dibujo: instancias globales
  const mallas = {};                          // nombre -> InstancedMesh
  const plantasDe = [];                       // por torre: matrices de cada planta
  const ASP = TORRES.map(aspecto);            // por torre: su pintura, sus luces y su azotea
  const extrasDe = [];                        // por torre: [nombre, matriz] de lo de la azotea
  let ultimo = null;
  function repartir(foco) {
    if (!listo) return;
    const n = Object.fromEntries(Object.keys(mallas).map((k) => [k, 0]));
    // una instancia con sus tintes: panel y acento/luz de la planta i, metal de la torre
    const poner = (nombre, M, a, i) => {
      const im = mallas[nombre], j = n[nombre]++, A = im.geometry.attributes;
      im.setMatrixAt(j, M);
      A.tPanel.array.set(a.panel[i], j * 3);
      A.tMetal.array.set(a.metal, j * 3);
      A.tAcento.array.set(a.acc[i], j * 4);
      A.tAcento.array[j * 4 + 3] = a.luz[i];
    };
    TORRES.forEach((t, k) => {
      const M = plantasDe[k], a = ASP[k], cercaT = (t.x - foco.x) ** 2 + (t.z - foco.z) ** 2 < CERCA * CERCA, ult = t.plantas - 1;
      for (let i = 0; i < t.plantas; i++) {
        if (cercaT) {
          poner(variante(t, i), M[i], a, i);
          if (i < ult) poner(i % 2 ? 'tramo_impar' : 'tramo_par', M[i], a, i);
        } else poner('modulo_lejos', M[i], a, i);
      }
      poner(cercaT ? 'azotea' : 'azotea_lejos', M[ult], a, ult);
      poner('peldanos_suelo', M[0], a, 0);
      for (const [nombre, X] of extrasDe[k]) poner(nombre, X, a, ult);
    });
    tris.cerca = tris.lejos = 0;
    for (const [nombre, im] of Object.entries(mallas)) {
      im.count = n[nombre];
      im.instanceMatrix.needsUpdate = true;
      for (const at of ['tPanel', 'tMetal', 'tAcento']) im.geometry.attributes[at].needsUpdate = true;
      const t = (im.geometry.index ? im.geometry.index.count : im.geometry.attributes.position.count) / 3 * im.count;
      if (/lejos/.test(nombre)) tris.lejos += t; else tris.cerca += t;
    }
    ultimo = foco.clone();
  }
  // cada fotograma: el reparto de cerca y lejos (si el 18 se ha movido 6 m), y las cajas pisables de la torre de al lado
  const mias = new Set();
  function actualizar(heroe, foco) {
    const f = foco || (heroe && heroe.pos);
    if (f && listo && (!ultimo || ultimo.distanceToSquared(f) > 36)) repartir(f);
    if (f) variantes.actualizar(f);
    variantes.delHeroe(heroe, cajas);
    for (let i = cajas.length - 1; i >= 0; i--) if (mias.has(cajas[i])) cajas.splice(i, 1);
    mias.clear();
    cerca = -1;
    if (!heroe || !heroe.pos) return;
    const p = heroe.pos;
    yPies = p.y;
    cerca = cercanas(p.x, p.z).find((k) => (p.x - TORRES[k].x) ** 2 + (p.z - TORRES[k].z) ** 2 < 20 * 20) ?? -1;
    if (cerca < 0) return;
    const P = dePisables(cerca);
    if (!P) return;
    for (const b of P.todas) if (b.ybot < p.y + 2.5 && b.ytop > p.y - 1.5) { cajas.push(b); mias.add(b); }
  }

  const variantes = crearVariantes(raiz, EDIFICIOS, { tenir, aspecto });
  (async () => {
    try {
      const gl = await new GLTFLoader().loadAsync(new URL('../../modelo/torre/modulo_refugio.glb', import.meta.url).href);
      gl.scene.updateMatrixWorld(true);
      const NOMBRES = ['modulo_A', 'modulo_B', 'modulo_lejos', 'tramo_par', 'tramo_impar', 'peldanos_suelo', 'azotea'];
      const mats = new Map();
      // a toon con los escalones del terreno; la chapa con su textura, lo demas su color (la escalera por las dos caras)
      const aToon = (m) => {
        if (!mats.has(m)) mats.set(m, tenir(new THREE.MeshToonMaterial({ name: m.name, color: m.color ? m.color.clone() : 0xffffff, map: m.map || null, gradientMap: TONO, side: m.map ? THREE.FrontSide : THREE.DoubleSide })));
        return mats.get(m);
      };
      const deObra = (nombre) => { let r = null; gl.scene.traverse((o) => { if (!r && o.isMesh && o.material.name === nombre) r = o.material; }); return aToon(r); };
      // cada pieza es un nodo: una malla, o un grupo de mallas (una por material): se juntan en una con grupos
      const pieza = (n) => {
        const ms = [];
        gl.scene.getObjectByName(n).traverse((o) => { if (o.isMesh) ms.push(o); });
        const gs = ms.map((o) => {
          const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
          for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a);
          if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
          return g;
        });
        if (gs.length === 1) return { g: gs[0], m: aToon(ms[0].material) };
        return { g: mergeGeometries(gs, true), m: ms.map((o) => aToon(o.material)) };
      };
      const P = Object.fromEntries(NOMBRES.map((n) => [n, pieza(n)]));
      // ---- lo que se sube a la azotea (por codigo, con los materiales de la obra: tambien se tinen)
      const MAT = { panel: deObra('Panel blanco gastado'), toldo: deObra('Toldo de chapa'), aparato: deObra('Aparato'), marco: deObra('Marco gris'),
        acero: deObra('Acero de escalera'), banda: deObra('Banda de forjado'),
        placa: tenir(new THREE.MeshToonMaterial({ name: 'Placa solar', color: 0x16223a, gradientMap: TONO })),
        hojas: tenir(new THREE.MeshToonMaterial({ name: 'Hojas', color: 0x4c6b32, gradientMap: TONO })) };
      // una pieza de cajas y cilindros: [forma, material, ...] -> geometria con grupos (las uv de las cajas en metros)
      const montar = (partes) => {
        const gs = [], ms = [];
        for (const [f, mat, ...v] of partes) {
          let g;
          if (f === 'caja') {
            const [x, y, z, sx, sy, sz, inc = 0] = v;
            g = new THREE.BoxGeometry(sx, sy, sz);
            const uv = g.attributes.uv;
            for (let i = 0; i < uv.count; i++) { const cara = Math.floor(i / 4), d = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]][cara]; uv.setXY(i, uv.getX(i) * d[0], uv.getY(i) * d[1]); }
            if (inc) g.rotateX(inc);
            g.translate(x, y, z);
          } else if (f === 'cil') {
            const [x, z, r, y0, y1, lados = 14] = v;
            g = new THREE.CylinderGeometry(r, r, y1 - y0, lados).translate(x, (y0 + y1) / 2, z);
          } else {                                                          // 'tumbado': un cilindro a lo largo de x
            const [x, y, z, r, largo, lados = 16] = v;
            g = new THREE.CylinderGeometry(r, r, largo, lados).rotateZ(Math.PI / 2).translate(x, y, z);
          }
          gs.push(g); ms.push(MAT[mat]);
        }
        return { g: mergeGeometries(gs, true), m: ms };
      };
      const ext = {
        // una chabola: paredes de chapa, tejado a un agua de toldo, puerta y ventanuco
        caseta: montar([['caja', 'panel', 0, 1.15, 0, 3.0, 2.3, 2.4], ['caja', 'toldo', 0, 2.42, 0.05, 3.4, 0.08, 2.9, -0.12],
          ['caja', 'toldo', 0.6, 0.95, 1.21, 0.8, 1.9, 0.04], ['caja', 'marco', -0.8, 1.45, 1.21, 0.7, 0.55, 0.04]]),
        // tres placas solares inclinadas en su bastidor
        placas: montar([['caja', 'acero', -1.1, 0.35, 0, 0.06, 0.7, 2.0], ['caja', 'acero', 1.1, 0.35, 0, 0.06, 0.7, 2.0],
          ...[-1, 0, 1].map((s) => ['caja', 'placa', s * 0.95, 0.85, 0, 0.9, 0.05, 1.7, 0.45])]),
        // un segundo deposito, tumbado en sus cunas
        deposito: montar([['caja', 'acero', -0.7, 0.2, 0, 0.12, 0.4, 1.3], ['caja', 'acero', 0.7, 0.2, 0, 0.12, 0.4, 1.3],
          ['tumbado', 'aparato', 0, 0.9, 0, 0.55, 2.0]]),
        // jardineras con matas
        huerto: montar([['caja', 'banda', -0.7, 0.25, 0, 0.9, 0.5, 2.4], ['caja', 'banda', 0.7, 0.25, 0, 0.9, 0.5, 2.4],
          ['caja', 'hojas', -0.7, 0.62, 0, 0.8, 0.25, 2.2], ['caja', 'hojas', 0.7, 0.68, 0, 0.8, 0.35, 2.2],
          ['cil', 'hojas', -0.7, 0.6, 0.35, 0.5, 1.0, 7], ['cil', 'hojas', 0.7, -0.5, 0.3, 0.6, 1.1, 7]]),
        // un mastil alto con travesanos y una parabola
        mastil: montar([['cil', 'acero', 0, 0, 0.07, 0, 9.0, 6], ...[3, 5, 6.5, 7.8].map((h) => ['caja', 'acero', 0, h, 0, 1.6 - h * 0.15, 0.04, 0.04]),
          ['caja', 'acero', 0, 4.2, 0, 0.04, 0.04, 1.0], ['cil', 'aparato', 0.15, 0.4, 0.45, 5.6, 5.66, 14]]),
      };
      const total = TORRES.reduce((a, t) => a + t.plantas, 0);
      const crear = (nombre, p, cap, sombra) => {
        const g = p.g.clone();
        g.setAttribute('tPanel', new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3));
        g.setAttribute('tMetal', new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3));
        g.setAttribute('tAcento', new THREE.InstancedBufferAttribute(new Float32Array(cap * 4).fill(1), 4));
        const im = new THREE.InstancedMesh(g, p.m, cap);
        im.count = 0; im.frustumCulled = false; im.castShadow = sombra; im.receiveShadow = true; im.name = 'torres_' + nombre;
        raiz.add(im);
        mallas[nombre] = im;
      };
      crear('modulo_A', P.modulo_A, total, true);
      crear('modulo_B', P.modulo_B, total, true);
      crear('tramo_par', P.tramo_par, total, true);
      crear('tramo_impar', P.tramo_impar, total, true);
      crear('azotea', P.azotea, TORRES.length, true);
      crear('modulo_lejos', P.modulo_lejos, total, false);
      crear('azotea_lejos', P.azotea, TORRES.length, false);
      crear('peldanos_suelo', P.peldanos_suelo, TORRES.length, false);
      for (const [nombre, p] of Object.entries(ext)) crear('x_' + nombre, p, TORRES.length, true);
      // la matriz de cada planta: la torre en su sitio, girada, y la planta a su altura; y las de lo de la azotea
      const q = new THREE.Quaternion(), e = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
      TORRES.forEach((t, k) => {
        q.setFromAxisAngle(up, t.giro);
        plantasDe[k] = Array.from({ length: t.plantas }, (_, i) => new THREE.Matrix4().compose(new THREE.Vector3(t.x, yBase[k] + i * PLANTA, t.z), q, e));
        const arriba = plantasDe[k][t.plantas - 1];
        extrasDe[k] = ASP[k].extras.map((x) => ['x_' + x.nombre, arriba.clone().multiply(new THREE.Matrix4().makeRotationY(x.giro).setPosition(x.x, PLANTA, x.z))]);
      });
      listo = true;
    } catch (e) {
      fallo = String(e && e.stack || e).slice(0, 300);
      console.warn('torres: falta web/modelo/torre/modulo_refugio.glb (obra escuela/obras/modulo_refugio)', e);
    }
  })();
  return {
    raiz, altura, actualizar,
    info: () => ({ torres: { listo, n: TORRES.length, plantas: TORRES.reduce((a, t) => a + t.plantas, 0), tris, fallo, pisablesHechas: pisables.size, cajasCerca: mias.size }, variantes: variantes.info() }),
  };
}
