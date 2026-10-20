// LOS MODELOS 3D que pone el editor (herramienta 8): cualquier .glb de la biblioteca (web/modelos/, a la que se
// suben desde la pagina con "Importar .glb" o arrastrandolos a la ventana; serve.mjs los guarda). Cada uno se puede
// poner varias veces: una INSTANCIA es { archivo, x, z, y, giro, escala, solido }. El punto de cada modelo es el centro
// de su huella a ras de su base, y su base va al punto MAS BAJO del suelo bajo la huella (en una cuesta se entierra
// por el lado alto en vez de flotar por el bajo); `y` lo sube o lo baja a partir de ahi.
// Los materiales pasan a toon con los mismos colores y texturas (con el metal de PBR y sin entorno salian negros; asi
// casan con el resto del mapa). Un modelo SOLIDO es una caja de choque del 18 (su huella girada) y no deja crecer
// hierba debajo; uno que no lo es (un arbol con copa, algo que se pisa) se atraviesa.
// Los DATOS (MODELOS) los guarda y los lee edicion.js; esto los carga y los dibuja.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as clonar } from 'three/addons/utils/SkeletonUtils.js';
import { altura } from './relieve.js';
import { HUELLAS } from './sitios.js';
import { TONO } from './tono.js';

export const MODELOS = [];
let siguiente = 1;
export function nuevoModelo(d) {
  const m = { id: siguiente++, archivo: d.archivo, x: d.x, z: d.z, y: d.y ?? 0, giro: d.giro ?? 0, escala: d.escala ?? 1, solido: d.solido ?? true, quitado: false };
  MODELOS.push(m);
  return m;
}
// lo que se puede cambiar de una instancia (para deshacer)
export const foto = (m) => ({ x: m.x, z: m.z, y: m.y, giro: m.giro, escala: m.escala, solido: m.solido, vivo: !m.quitado });
export function aplicarFoto(m, f) { Object.assign(m, { x: f.x, z: f.z, y: f.y, giro: f.giro, escala: f.escala, solido: f.solido }); m.quitado = !f.vivo; }

// ---------------- la biblioteca: un .glb se carga una vez y cada instancia es un clon ----------------
const cargador = new GLTFLoader();
const plantillas = new Map();      // archivo -> promesa de { raiz, tam, tris } o { error }
const listas = new Map();          // archivo -> lo mismo, ya cargado
function aToon(m) {
  if (!m || m.isMeshToonMaterial) return m;
  const t = new THREE.MeshToonMaterial({
    color: m.color ? m.color.clone() : new THREE.Color(0xffffff), map: m.map || null, gradientMap: TONO,
    vertexColors: !!m.vertexColors, transparent: !!m.transparent, opacity: m.opacity ?? 1, alphaTest: m.alphaTest || 0,
    side: m.side ?? THREE.FrontSide, normalMap: m.normalMap || null, aoMap: m.aoMap || null,
    emissive: m.emissive ? m.emissive.clone() : new THREE.Color(0), emissiveMap: m.emissiveMap || null, emissiveIntensity: m.emissiveIntensity ?? 1,
  });
  t.name = m.name;
  return t;
}
function preparar(escena) {
  let tris = 0;
  escena.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = true;
    o.material = Array.isArray(o.material) ? o.material.map(aToon) : aToon(o.material);
    const g = o.geometry;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  escena.updateMatrixWorld(true);
  const caja = new THREE.Box3().setFromObject(escena), tam = caja.getSize(new THREE.Vector3()), c = caja.getCenter(new THREE.Vector3());
  // el punto del modelo: el centro de su huella, a ras de su base
  const raiz = new THREE.Group();
  raiz.add(escena);
  escena.position.sub(new THREE.Vector3(c.x, caja.min.y, c.z));
  return { raiz, tam, tris: Math.round(tris) };
}
export function plantilla(archivo) {
  if (!plantillas.has(archivo)) {
    plantillas.set(archivo, new Promise((ok) => {
      cargador.load('modelos/' + encodeURIComponent(archivo) + '?v=' + Date.now(), (g) => ok(preparar(g.scene)), undefined, (e) => {
        const txt = String(e && e.message || e);
        ok({ error: /draco|meshopt|basisu|ktx/i.test(txt) ? 'viene comprimido (Draco, meshopt o KTX2): expórtalo sin compresión' : txt });
      });
    }).then((p) => { listas.set(archivo, p); return p; }));
  }
  return plantillas.get(archivo);
}
export const yaCargado = (archivo) => listas.get(archivo);
// tras volver a subir un archivo con el mismo nombre
export function olvidar(archivo) { plantillas.delete(archivo); listas.delete(archivo); }

// las esquinas de la huella de una instancia (para la cota de la base, la caja de choque y la hierba)
export function huella(m, tam) {
  const hx = (tam.x * m.escala) / 2, hz = (tam.z * m.escala) / 2;
  // three gira y en sentido antihorario visto desde arriba: el eje x del modelo queda en (cos g, -sen g)
  return { x: m.x, z: m.z, hx, hz, ang: -m.giro, r: Math.hypot(hx, hz) };
}
function base(h) {
  const ca = Math.cos(h.ang), sa = Math.sin(h.ang);
  let y = altura(h.x, h.z);
  for (const fx of [-1, -0.5, 0, 0.5, 1]) for (const fz of [-1, -0.5, 0, 0.5, 1]) {
    const lx = fx * h.hx * 0.95, lz = fz * h.hz * 0.95;
    y = Math.min(y, altura(h.x + lx * ca - lz * sa, h.z + lx * sa + lz * ca));
  }
  return y;
}

// ---------------- en la escena ----------------
// alCambiar(x0, z0, x1, z1): lo de alrededor que hay que rehacer (la hierba bajo la huella, el mapa)
export function crearModelos({ grupo, cajas, alCambiar }) {
  const hechos = new Map();          // instancia -> { obj, caja, huella } (obj null mientras se carga)
  function avisar(h) { if (h && alCambiar) alCambiar(h.x - h.r - 1, h.z - h.r - 1, h.x + h.r + 1, h.z + h.r + 1); }
  // donde va (posicion, giro, escala) y su caja de choque y su huella
  // (avisa = rehacer la hierba y el mapa; mientras se arrastra no, solo al soltar)
  function colocar(m, avisa = true) {
    const H = hechos.get(m), P = listas.get(m.archivo);
    if (!H || !H.obj || !P || P.error) return;
    const viejo = H.huella;
    const h = huella(m, P.tam);
    H.obj.position.set(m.x, base(h) + m.y, m.z);
    H.obj.rotation.set(0, m.giro, 0);
    H.obj.scale.setScalar(m.escala);
    H.obj.updateMatrixWorld(true);
    // la caja de choque y la huella, solo si es solido y mide algo de alto
    const solido = m.solido && P.tam.y * m.escala > 0.25;
    quitarDe(cajas, H.caja); quitarDe(HUELLAS, H.huella);
    H.caja = solido ? { x: h.x, z: h.z, hx: h.hx, hz: h.hz, ang: h.ang } : null;
    H.huella = solido ? { ...h, hx: h.hx * 0.92, hz: h.hz * 0.92 } : null;
    if (H.caja) cajas.push(H.caja);
    if (H.huella) HUELLAS.push(H.huella);
    if (avisa) { avisar(viejo); avisar(h); }
  }
  const quitarDe = (lista, o) => { if (!o) return; const k = lista.indexOf(o); if (k >= 0) lista.splice(k, 1); };
  function poner(m) {
    const H = { obj: null, caja: null, huella: null };
    hechos.set(m, H);
    plantilla(m.archivo).then((P) => {
      if (hechos.get(m) !== H || P.error) return;            // quitado mientras cargaba, o no se pudo leer
      H.obj = clonar(P.raiz);
      H.obj.name = 'modelo:' + m.archivo;
      H.obj.userData.instancia = m;
      grupo.add(H.obj);
      colocar(m);
    });
  }
  function tirar(m) {
    const H = hechos.get(m);
    if (!H) return;
    if (H.obj) grupo.remove(H.obj);
    quitarDe(cajas, H.caja); quitarDe(HUELLAS, H.huella);
    avisar(H.huella || (listas.get(m.archivo) && !listas.get(m.archivo).error ? huella(m, listas.get(m.archivo).tam) : null));
    hechos.delete(m);
  }
  // que la escena tenga las instancias de MODELOS que no estan quitadas, y ninguna mas
  function sincronizar() {
    for (const m of [...hechos.keys()]) if (m.quitado || !MODELOS.includes(m)) tirar(m);
    for (const m of MODELOS) if (!m.quitado && !hechos.has(m)) poner(m);
  }
  // tras cambiar el suelo: las que tocan el recuadro, otra vez a su cota
  function asentar(x0, z0, x1, z1) {
    for (const [m, H] of hechos) {
      if (!H.obj || m.x + 50 < x0 || m.x - 50 > x1 || m.z + 50 < z0 || m.z - 50 > z1) continue;
      colocar(m);
    }
  }
  // un archivo que se ha vuelto a subir: todas sus instancias, de nuevo
  function recargar(archivo) {
    olvidar(archivo);
    for (const m of [...hechos.keys()]) if (m.archivo === archivo) tirar(m);
    sincronizar();
  }

  // ---------------- elegir con el raton: el rayo contra la caja de cada instancia, en su marco ----------------
  const _inv = new THREE.Matrix4(), _r = new THREE.Ray(), _b = new THREE.Box3(), _p = new THREE.Vector3();
  function elegir(rayo) {
    let mejor = null, dm = Infinity;
    for (const [m, H] of hechos) {
      const P = listas.get(m.archivo);
      if (!H.obj || !P || P.error) continue;
      _inv.copy(H.obj.matrixWorld).invert();
      _r.copy(rayo).applyMatrix4(_inv);
      _b.min.set(-P.tam.x / 2, 0, -P.tam.z / 2);
      _b.max.set(P.tam.x / 2, P.tam.y, P.tam.z / 2);
      if (!_r.intersectBox(_b, _p)) continue;
      const d = _p.applyMatrix4(H.obj.matrixWorld).distanceTo(rayo.origin);
      if (d < dm) { dm = d; mejor = m; }
    }
    return mejor;
  }
  // el marco de lo elegido: una caja de alambre ambar encima de todo
  const marco = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)),
    new THREE.LineBasicMaterial({ color: 0xffd36a, depthTest: false, transparent: true }));
  marco.renderOrder = 11;
  marco.visible = false;
  grupo.add(marco);
  function marcar(m) {
    const H = m && hechos.get(m), P = m && listas.get(m.archivo);
    marco.visible = !!(H && H.obj && P && !P.error);
    if (!marco.visible) return;
    marco.position.copy(H.obj.position);
    marco.rotation.copy(H.obj.rotation);
    marco.scale.set(P.tam.x * m.escala, P.tam.y * m.escala, P.tam.z * m.escala);
  }

  // ---------------- el fantasma: el modelo que se va a poner, transparente, donde esta el raton ----------------
  let fantasma = null, deQuien = null;
  function fantasmaDe(archivo) {
    if (deQuien === archivo) return fantasma;
    if (fantasma) grupo.remove(fantasma);
    fantasma = null; deQuien = archivo;
    const P = archivo && listas.get(archivo);
    if (!P || P.error) { deQuien = null; return null; }
    fantasma = clonar(P.raiz);
    fantasma.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = false;
      const t = (mt) => Object.assign(mt.clone(), { transparent: true, opacity: 0.5, depthWrite: false });
      o.material = Array.isArray(o.material) ? o.material.map(t) : t(o.material);
    });
    fantasma.visible = false;
    grupo.add(fantasma);
    return fantasma;
  }
  // donde ira (o nada): { archivo, x, z, giro, escala }
  function mostrarFantasma(d) {
    const F = d && fantasmaDe(d.archivo);
    if (fantasma) fantasma.visible = !!F;
    if (!F) return;
    const P = listas.get(d.archivo);
    F.position.set(d.x, base(huella(d, P.tam)), d.z);
    F.rotation.set(0, d.giro, 0);
    F.scale.setScalar(d.escala);
  }

  sincronizar();
  return {
    sincronizar, colocar, asentar, recargar, elegir, marcar, mostrarFantasma,
    objeto: (m) => hechos.get(m)?.obj || null,
    info: () => ({ modelos: hechos.size, triangulosModelos: [...hechos.keys()].reduce((s, m) => s + (listas.get(m.archivo)?.tris || 0), 0) }),
  };
}
