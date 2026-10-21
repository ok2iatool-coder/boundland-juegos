// EL MACROEDIFICIO (2026-10-21, "agrega este edificio en la ciudad, el macroedificio"): la "Sentinel Tower" de Meshy
// que paso el usuario (Downloads/Meshy_AI_Sentinel_Tower_1021154517_texture.blend: una lamina brutalista gastada de
// 89 x 40 x 150 m, ya a escala; 50 plantas de 3 m) en el CIRCULO ROJO de su captura: El Panal sur, junto al extremo oeste
// de la fila de Bloques (plano (-310, -70), casado con la captura por la fila de Bloques, la plaza y la catedral), con
// el lado largo paralelo a los Bloques y una fachada a la ciudad.
//
// tools/sentinel_glb.py lo deja en dos .glb (web/modelo/sentinel/): CERCA con 259.000 triangulos y el color a 4096 y
// el relieve a 2048, y LEJOS con 41.000 (sin texturas: usa las de cerca). Un THREE.LOD cambia de uno a otro. Los
// materiales pasan a toon con los escalones del terreno. Debajo no hay cimientos de El Panal (`reservado`, que mira
// cimientos.js) ni hierba; choca como una caja de su huella.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as R from './relieve.js';
import { TONO } from './tono.js';
import { OBRA } from './sitios.js';

const YC = R.GEO.YC ?? 2400;
export const MACRO = { plano: [-310, -70], giro: 0, ancho: 88.6, fondo: 40.4, alto: 150, margen: 8, lejos: 650 };
MACRO.x = MACRO.plano[0];
MACRO.z = YC - MACRO.plano[1];

// lo que queda debajo y alrededor (cimientos.js no pone ahi modulos de El Panal)
export function reservado(x, z) {
  const c = Math.cos(MACRO.giro), s = Math.sin(MACRO.giro), dx = x - MACRO.x, dz = z - MACRO.z;
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  return Math.abs(lx) < MACRO.ancho / 2 + MACRO.margen && Math.abs(lz) < MACRO.fondo / 2 + MACRO.margen;
}

const URL_M = new URL('../../modelo/sentinel/', import.meta.url);

export function crearMacro(grupo, cajas) {
  const raiz = new THREE.Group();
  raiz.name = 'macroedificio';
  // la cota: lo mas bajo de su huella (el podio se entierra un poco donde el suelo sube)
  let y = Infinity;
  for (const [a, b] of [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1]]) {
    y = Math.min(y, R.altura(MACRO.x + (a * MACRO.ancho) / 2, MACRO.z + (b * MACRO.fondo) / 2));
  }
  raiz.position.set(MACRO.x, y - 0.15, MACRO.z);
  raiz.rotation.y = MACRO.giro;
  grupo.add(raiz);
  const lod = new THREE.LOD();
  raiz.add(lod);
  let tris = { cerca: 0, lejos: 0 }, listo = false;

  const aToon = (m) => new THREE.MeshToonMaterial({ name: 'macro', color: 0xffffff, map: m.map, normalMap: m.normalMap, gradientMap: TONO });
  const cargador = new GLTFLoader();
  (async () => {
    try {
      const cerca = await cargador.loadAsync(new URL('sentinel_cerca.glb', URL_M).href);
      let mat = null;
      cerca.scene.traverse((o) => {
        if (!o.isMesh) return;
        mat = mat || aToon(o.material);
        o.material.dispose();
        o.material = mat;
        o.castShadow = o.receiveShadow = true;
        tris.cerca += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3;
      });
      lod.addLevel(cerca.scene, 0);
      const lejos = await cargador.loadAsync(new URL('sentinel_lejos.glb', URL_M).href);
      lejos.scene.traverse((o) => {
        if (!o.isMesh) return;
        if (o.material && o.material.dispose) o.material.dispose();
        o.material = mat;
        o.castShadow = false; o.receiveShadow = true;
        tris.lejos += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3;
      });
      lod.addLevel(lejos.scene, MACRO.lejos);
      listo = true;
    } catch (e) {
      console.warn('macroedificio: falta web/modelo/sentinel (correr tools/sentinel_glb.py)', e);
    }
  })();

  // choca: la huella entera
  cajas.push({ x: MACRO.x, z: MACRO.z, hx: MACRO.ancho / 2, hz: MACRO.fondo / 2, ang: -MACRO.giro });
  // ni hierba debajo
  const antes = OBRA.ocupado;
  OBRA.ocupado = (x, z) => (antes && antes(x, z)) || reservado(x, z);

  return { raiz, info: () => ({ macro: { listo, tris, plano: MACRO.plano, cota: +raiz.position.y.toFixed(2) } }) };
}
