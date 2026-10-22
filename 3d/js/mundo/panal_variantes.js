// LAS TRES VARIANTES DE EDIFICIO DE EL PANAL (2026-10-22, «haz 3 variedades de edificios panal con diferente
// diseno»): la COLMENA (tubos hexagonales tumbados, de la Wabenhaus de Haimerl), la ESPIGA (nucleo con capsulas, de la
// Nakagin de Kurokawa) y el RACIMO (modulos escalonados, de Habitat 67 de Safdie). La obra es
// escuela/obras/panal_variantes: construir.py hace las piezas (web/modelo/panal/panal_variantes.glb) y reparto.py como
// se juntan; tools/torres_panal.py los reparte por El Panal y los escribe en "edificios" de datos/mundo/torres.json, cada
// uno con sus piezas en los ejes de la obra (Blender: x, y en planta, z arriba) y sus cajas de choque.
//
// Se dibujan como las torres: una InstancedMesh por pieza para todos los edificios, con la pieza de cerca a menos de
// CERCA m del 18 (del borde del edificio) y la de lejos mas alla, y los mismos tintes por instancia (pintura, metal,
// acentos y luces de noche) que salen de aspecto() de torres.js. No se suben: chocan en planta.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as R from './relieve.js';
import { TONO } from './tono.js';

const CERCA = 150;
// las casas son muchas y pequenas: su pieza de cerca (contraventanas con lamas, toldos, balcon) solo a 60 m
const CERCA_TIPO = { casas: 60 };

// de los ejes de la obra al juego: (x, y) en planta -> (x, -y), y girado `giro` sobre Y como las torres
function aMundo(e, lx, ly) {
  const lz = -ly, c = Math.cos(e.giro), s = Math.sin(e.giro);
  return [e.x + lx * c + lz * s, e.z - lx * s + lz * c];
}
// las cajas de choque de un edificio en el mundo (hx a lo largo de su x, hz de su y)
export function cajasMundo(e) {
  return e.cajas.map(([x, y, hx, hy, g]) => { const [wx, wz] = aMundo(e, x, y); return { x: wx, z: wz, hx, hz: hy, ang: -(e.giro + g) }; });
}
// si (x, z) cae en la huella de algun edificio (con un margen)
export function enEdificios(EDIF, x, z, margen) {
  for (const e of EDIF) {
    if ((x - e.x) ** 2 + (z - e.z) ** 2 > (e.radio + margen) ** 2) continue;
    for (const b of e._cajas || (e._cajas = cajasMundo(e))) {
      const ca = Math.cos(b.ang), sa = Math.sin(b.ang), lx = (x - b.x) * ca + (z - b.z) * sa, lz = -(x - b.x) * sa + (z - b.z) * ca;
      if (Math.abs(lx) <= b.hx + margen && Math.abs(lz) <= b.hz + margen) return true;
    }
  }
  return false;
}

export function crearVariantes(raiz, EDIF, { tenir, aspecto }) {
  let listo = false, fallo = null, ultimo = null;
  const tris = { cerca: 0, lejos: 0 };
  const mallas = {};
  // la cota de cada edificio: lo mas bajo del suelo bajo sus cajas
  const yBase = EDIF.map((e) => {
    let y = Infinity;
    for (const b of e._cajas || (e._cajas = cajasMundo(e))) {
      const ca = Math.cos(-b.ang), sa = Math.sin(-b.ang);
      for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]]) {
        const lx = u * b.hx, lz = v * b.hz;
        y = Math.min(y, R.altura(b.x + lx * ca + lz * sa, b.z - lx * sa + lz * ca));
      }
    }
    return y - 0.05;
  });
  const ASP = EDIF.map((e) => aspecto({ x: e.x, z: e.z, plantas: e.piezas.length }));
  const matrices = [];                                    // por edificio: la matriz de cada pieza

  function repartir(foco) {
    if (!listo) return;
    const n = Object.fromEntries(Object.keys(mallas).map((k) => [k, 0]));
    EDIF.forEach((e, k) => {
      const cerca = Math.hypot(e.x - foco.x, e.z - foco.z) - e.radio < (CERCA_TIPO[e.tipo] ?? CERCA), a = ASP[k], M = matrices[k];
      e.piezas.forEach((p, i) => {
        const nombre = cerca ? p[0] : p[1];
        if (!nombre || !mallas[nombre]) return;
        const im = mallas[nombre], j = n[nombre]++, A = im.geometry.attributes;
        im.setMatrixAt(j, M[i]);
        A.tPanel.array.set(a.panel[i], j * 3);
        A.tMetal.array.set(a.metal, j * 3);
        A.tAcento.array.set(a.acc[i], j * 4);
        A.tAcento.array[j * 4 + 3] = a.luz[i];
      });
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

  (async () => {
    try {
      const gl = await new GLTFLoader().loadAsync(new URL('../../modelo/panal/panal_variantes.glb', import.meta.url).href);
      gl.scene.updateMatrixWorld(true);
      const mats = new Map();
      const aToon = (m) => {
        if (!mats.has(m)) mats.set(m, tenir(new THREE.MeshToonMaterial({ name: m.name, color: m.color ? m.color.clone() : 0xffffff, map: m.map || null, gradientMap: TONO, side: m.map ? THREE.FrontSide : THREE.DoubleSide })));
        return mats.get(m);
      };
      const pieza = (nombre) => {
        const ms = [];
        const nodo = gl.scene.getObjectByName(nombre);
        if (!nodo) return null;
        nodo.traverse((o) => { if (o.isMesh) ms.push(o); });
        const gs = ms.map((o) => {
          const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
          for (const at of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(at)) g.deleteAttribute(at);
          if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
          return g;
        });
        return gs.length === 1 ? { g: gs[0], m: aToon(ms[0].material) } : { g: mergeGeometries(gs, true), m: ms.map((o) => aToon(o.material)) };
      };
      // cuantas instancias puede llegar a tener cada pieza (de cerca o de lejos)
      const cap = {};
      for (const e of EDIF) for (const p of e.piezas) for (const nm of new Set([p[0], p[1]])) if (nm) cap[nm] = (cap[nm] || 0) + 1;
      for (const [nombre, c] of Object.entries(cap)) {
        const p = pieza(nombre);
        if (!p) { fallo = 'falta la pieza ' + nombre; continue; }
        const g = p.g;
        g.setAttribute('tPanel', new THREE.InstancedBufferAttribute(new Float32Array(c * 3).fill(1), 3));
        g.setAttribute('tMetal', new THREE.InstancedBufferAttribute(new Float32Array(c * 3).fill(1), 3));
        g.setAttribute('tAcento', new THREE.InstancedBufferAttribute(new Float32Array(c * 4).fill(1), 4));
        const im = new THREE.InstancedMesh(g, p.m, c);
        im.count = 0; im.frustumCulled = false; im.castShadow = !/lejos/.test(nombre); im.receiveShadow = true; im.name = 'panal_' + nombre;
        raiz.add(im);
        mallas[nombre] = im;
      }
      // la matriz de cada pieza: el edificio en su sitio y girado, y la pieza en sus ejes de la obra (z = -y)
      const up = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4(), q = new THREE.Quaternion();
      EDIF.forEach((e, k) => {
        const E = new THREE.Matrix4().compose(new THREE.Vector3(e.x, yBase[k], e.z), q.clone().setFromAxisAngle(up, e.giro), new THREE.Vector3(1, 1, 1));
        matrices[k] = e.piezas.map(([, , x, y, z, g, est]) => E.clone().multiply(m.compose(new THREE.Vector3(x, z, -y), q.setFromAxisAngle(up, g), new THREE.Vector3(est, 1, 1))));
      });
      listo = true;
    } catch (e) {
      fallo = String(e && e.stack || e).slice(0, 300);
      console.warn('panal: falta web/modelo/panal/panal_variantes.glb (obra escuela/obras/panal_variantes)', e);
    }
  })();

  // ---- LO QUE SE PISA (22-10, «que se puedan subir las escaleras, pasarelas y terrazas»): web/modelo/panal/pisables.json
  // (pisables.py de la obra, de las mismas cotas que las piezas) trae por pieza cajas [cx, cy, mx, my, giro, z0, z1, suelo]
  // en sus ejes; aqui se ponen en el mundo SOLO para el edificio que tiene el 18 al lado (y se guardan). Todas paran (a
  // `cajas`, las de la altura del 18) y las de `suelo` se pisan por arriba (`altura`).
  let PJ = null;
  fetch(new URL('../../modelo/panal/pisables.json', import.meta.url)).then((r) => r.json()).then((j) => { PJ = j.piezas; }).catch((e) => { fallo = 'pisables: ' + e; });
  const hechos = new Map();
  function dePisables(k) {
    if (hechos.has(k) || !PJ) return hechos.get(k) || null;
    const e = EDIF[k], T = { suelos: [], todas: [] };
    for (const [nombre, , px, py, pz, g, est] of e.piezas) {
      const lista = PJ[nombre];
      if (!lista) continue;
      const cg = Math.cos(g), sg = Math.sin(g);
      for (const [cx, cy, mx, my, gb, z0, z1, suelo] of lista) {
        const ax = cx * est, x = px + ax * cg - cy * sg, y = py + ax * sg + cy * cg;      // la caja en los ejes del edificio
        const [wx, wz] = aMundo(e, x, y);
        const b = { x: wx, z: wz, hx: mx * (gb ? 1 : est), hz: my, ang: -(e.giro + g + gb), ytop: yBase[k] + pz + z1, ybot: yBase[k] + pz + z0 };
        T.todas.push(b);
        if (suelo) T.suelos.push(b);
      }
    }
    hechos.set(k, T);
    return T;
  }
  const dentro = (b, x, z) => {
    const ca = Math.cos(b.ang), sa = Math.sin(b.ang), lx = (x - b.x) * ca + (z - b.z) * sa, lz = -(x - b.x) * sa + (z - b.z) * ca;
    return Math.abs(lx) <= b.hx && Math.abs(lz) <= b.hz;
  };
  let cerca = -1, yPies = -1e9;
  const mias = new Set();
  // cada fotograma: quitar de `cajas` las de antes y poner las del edificio de al lado que estan a la altura del 18
  function delHeroe(heroe, cajas) {
    for (let i = cajas.length - 1; i >= 0; i--) if (mias.has(cajas[i])) cajas.splice(i, 1);
    mias.clear();
    cerca = -1;
    if (!heroe || !heroe.pos) return;
    const p = heroe.pos;
    yPies = p.y;
    cerca = EDIF.findIndex((e) => (p.x - e.x) ** 2 + (p.z - e.z) ** 2 < (e.radio + 8) ** 2);
    if (cerca < 0) return;
    const T = dePisables(cerca);
    if (!T) return;
    for (const b of T.todas) if (b.ybot < p.y + 2.5 && b.ytop > p.y - 1.5) { cajas.push(b); mias.add(b); }
  }
  // lo mas alto que se pisa en (x, z) sin pasar de los pies del 18 mas un escalon (h: el suelo de debajo)
  function altura(x, z, h) {
    if (cerca < 0) return h;
    const T = dePisables(cerca);
    if (!T) return h;
    let y = h;
    for (const b of T.suelos) if (b.ytop > y && b.ytop <= yPies + 0.4 && dentro(b, x, z)) y = b.ytop;
    return y;
  }

  return {
    actualizar(foco) { if (listo && foco && (!ultimo || ultimo.distanceToSquared(foco) > 36)) repartir(foco); },
    delHeroe, altura,
    info: () => ({ listo, n: EDIF.length, tipos: EDIF.reduce((a, e) => ((a[e.tipo] = (a[e.tipo] || 0) + 1), a), {}), tris, fallo, cerca, cajasCerca: mias.size, pisablesHechos: hechos.size }),
  };
}
