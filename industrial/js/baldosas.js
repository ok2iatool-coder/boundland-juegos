// LAS BALDOSAS PINTADAS en la escena: cada capa del nivel (comun.js, CAPAS) se parte en baldosas que pintan unos
// hilos (pinta/obrero.js) y llegan como ImageBitmap; aqui cada una se pone en un plano de su grupo. Se piden primero
// las que caen cerca de la camara (la del juego antes que las de fondo) y, mientras la camara se mueve, se va
// reordenando la cola: lo que el 18 tiene delante sale antes.
import * as THREE from 'three';
import { CAPAS, BALDOSA, YTOP, YBAJO, baldosas } from '../pinta/comun.js';
import { rango, CAM0 } from '../pinta/disposicion.js';

const PESO = { juego: 0, frente: 0.4, medio: 0.6, medioLejos: 0.9, lejos: 1.1 };   // a igual distancia, antes lo de delante

export function crearBaldosas(grupos, renderer) {
  const cola = [], hechas = [], esperando = new Map();
  for (const nombre of Object.keys(CAPAS)) { const [a, b] = rango(CAPAS[nombre].f); for (const t of baldosas(nombre, a, b)) cola.push({ capa: nombre, ...t }); }
  const total = cola.length;
  const n = Math.max(2, Math.min(6, (navigator.hardwareConcurrency || 4) - 2));
  const hilos = Array.from({ length: n }, () => { const w = new Worker(new URL('../pinta/obrero.js', import.meta.url), { type: 'module' }); w.libre = true; w.onmessage = (e) => llega(w, e.data); w.onerror = (e) => console.error('obrero', e.message); return w; });
  let camX = CAM0.x, idSig = 1, avisos = [];
  const centro = (t) => (t.x0 + t.x1) / 2;
  // donde mira la camara EN la capa (el grupo esta corrido (camX - CAM0.x) (1 - f))
  const mira = (capa) => camX * CAPAS[capa].f + CAM0.x * (1 - CAPAS[capa].f);
  const prioridad = (t) => Math.abs(centro(t) - mira(t.capa)) / (BALDOSA / CAPAS[t.capa].res) + PESO[t.capa];
  function repartir() {
    for (const w of hilos) {
      if (!w.libre || !cola.length) continue;
      let k = 0; for (let i = 1; i < cola.length; i++) if (prioridad(cola[i]) < prioridad(cola[k])) k = i;
      const t = cola.splice(k, 1)[0], id = idSig++;
      w.libre = false; esperando.set(id, t); w.postMessage({ id, capa: t.capa, i: t.i, x0: t.x0, x1: t.x1 });
    }
  }
  function llega(w, m) {
    w.libre = true;
    const t = esperando.get(m.id); esperando.delete(m.id);
    if (m.error) console.error('baldosa', t.capa, t.i, m.error);
    else {
      const tex = new THREE.Texture(m.bmp);
      tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false; tex.generateMipmaps = false;
      tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = 1; tex.needsUpdate = true;
      const alto = YTOP - YBAJO, mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, toneMapped: false });
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(t.x1 - t.x0, alto), mat);
      pl.position.set(centro(t), (YTOP + YBAJO) / 2, 0); pl.renderOrder = 0;
      grupos[t.capa].add(pl); renderer?.initTexture?.(tex);
      hechas.push({ ...t, ms: m.ms });
    }
    repartir();
    for (const a of avisos.splice(0)) if (!a.f()) avisos.push(a); else a.r();
  }
  repartir();
  const visibles = () => { const mitad = 12.5; return Object.keys(CAPAS).every((c) => !cola.concat([...esperando.values()]).some((t) => t.capa === c && t.x1 > mira(c) - mitad && t.x0 < mira(c) + mitad)); };
  const cuando = (f) => (f() ? Promise.resolve() : new Promise((r) => avisos.push({ f, r })));
  return {
    total, hechas,
    seguir(x) { camX = x; },
    // listas las que se ven desde donde esta la camara / todas
    visibles: () => cuando(visibles),
    todas: () => cuando(() => !cola.length && !esperando.size),
    progreso: () => hechas.length / total,
  };
}
