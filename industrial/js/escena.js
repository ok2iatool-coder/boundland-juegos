// EL NIVEL ENTERO, capa a capa. Lo que se ve esta PINTADO (pinta/: el taller de El Linde y de la ciudad del juego,
// en baldosas que pintan unos hilos: baldosas.js); aqui solo va lo que se mueve o brilla de verdad: el cielo, los
// rayos y el resplandor del horizonte, la bruma que deriva, el humo de las chimeneas, el polvo y los halos de las
// luces (por encima del blanco: el bloom los enciende). Cada capa es un grupo con su paralaje f (main.js la mueve
// (1 - f) veces lo que se mueve la camara: en ortografica la profundidad no da paralaje sola) y su z, que solo
// ordena. El principio es la imagen de referencia en su sitio medido (pinta/comun.js: px, py).
import * as THREE from 'three';
import { cielo, rayos, polvo, resplandor, bruma, humo } from './atmosfera.js';
import { CAPAS, py } from '../pinta/comun.js';
import { disposicion, rango, CAM0 } from '../pinta/disposicion.js';
import { crearBaldosas } from './baldosas.js';

export { CAM0 };

// un halo de luz: nucleo por encima de 1 (lo coge el bloom) y una corona ancha que tine el aire
function halo(h, tiempo) {
  const c = new THREE.Color(h.color);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(h.r * 2, h.r * 2), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
    uniforms: { uTiempo: tiempo, uCol: { value: new THREE.Vector3(c.r, c.g, c.b) }, uF: { value: h.fuerza }, uRespira: { value: h.respira ? 1 : 0 }, uParpadea: { value: h.parpadea ? 1 : 0 }, uSem: { value: Math.random() * 10 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTiempo, uF, uRespira, uParpadea, uSem; uniform vec3 uCol; varying vec2 vUv;
      float h(float x) { return fract(sin(x * 91.7) * 43758.5); }
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float f = uF * (1.0 + uRespira * 0.08 * sin(uTiempo * 1.3 + uSem));
        float t = floor(uTiempo * 14.0 + uSem); f *= 1.0 - uParpadea * step(0.93, h(t)) * 0.7;
        float a = exp(-r * r * 9.0) * 1.6 + exp(-r * r * 2.2) * 0.35 * (1.0 - r);
        gl_FragColor = vec4(uCol * f * max(0.0, a), 1.0);
      }`,
  }));
  m.position.set(h.x, h.y, 0.4);
  return m;
}

export function crearEscena(escena, tiempo, renderer) {
  const capas = [], grupos = {}, animar = [];
  const capa = (nombre, z, f) => { const g = new THREE.Group(); g.name = nombre; g.position.z = z; escena.add(g); capas.push({ g, f, z }); grupos[nombre] = g; return g; };
  const D = disposicion();

  // ---- el cielo (casi quieto) y los rayos del sol (siguen al sol: casi no se mueven)
  { const g = capa('cielo', -900, 0.02), s = cielo(160, 60, tiempo); s.position.set(CAM0.x + 20, CAM0.y, 0); g.add(s); }
  capa('lejos', CAPAS.lejos.z, CAPAS.lejos.f);
  { const g = capa('rayos', -250, 0.04); const r = rayos(11, 77, 22, tiempo, { fuerza: 0.07, alto: 14 }); r.position.set(CAM0.x, CAM0.y, 0); g.add(r); const s = resplandor(36, 9, 0.32); s.position.x += CAM0.x; s.position.y += CAM0.y - 0.6; g.add(s); }
  capa('medioLejos', CAPAS.medioLejos.z, CAPAS.medioLejos.f);
  capa('medio', CAPAS.medio.z, CAPAS.medio.f);
  capa('juego', CAPAS.juego.z, CAPAS.juego.f);
  capa('frente', CAPAS.frente.z, CAPAS.frente.f);

  // ---- la bruma que deriva al pie de cada capa de fondo (la pintada esta quieta; esta se mueve encima)
  for (const [nombre, suelo, alto, col, dens, vel, sem] of [['lejos', py(620), 5, '#b9ab9a', 0.32, 0.012, 3], ['medioLejos', py(640), 4.5, '#a99d8f', 0.26, 0.016, 7], ['medio', py(760), 3.6, '#988d81', 0.22, 0.02, 11], ['juego', 0.5, 2.2, '#8a8075', 0.1, 0.024, 13]]) {
    const [a, b] = rango(CAPAS[nombre].f), br = bruma(b - a + 20, alto, col, dens, tiempo, vel, sem);
    br.position.set((a + b) / 2, suelo - 0.5 + alto / 2, nombre === 'juego' ? 0.6 : 2); grupos[nombre].add(br);
  }
  // ---- el humo de las chimeneas (y el vapor de la planta), en su capa
  D.efectos.humo.forEach((h, k) => {
    const o = h.vapor ? { vida: 7, sube: 7, viento: -1.2, tam: 0.22, color: '#b6ada2', luz: '#efe4d2' } : { vida: 28 + (k % 3) * 3, sube: 5.2, viento: -2.5, tam: h.grande ? 0.75 : 0.5, color: '#8f877e', luz: '#ead8bd' };
    const m = humo(h.x, h.y, h.vapor ? 18 : h.grande ? 110 : 55, tiempo, o); m.position.z = 1.5; grupos[h.capa].add(m);
  });
  // ---- los halos de las luces
  for (const h of D.efectos.halos) grupos[h.capa].add(halo(h, tiempo));

  // ---- el polvo (va con la camara: main.js lo mueve), que brilla cerca de las luces
  const gPolvo = new THREE.Group(); grupos.juego.add(gPolvo);
  const luces = D.efectos.luces.map((l) => ({ p: new THREE.Vector3(l.x, l.y, l.z), col: new THREE.Color(l.col), r: l.r }));
  gPolvo.add(polvo(1100, { x0: -14, x1: 16, y0: -0.5, y1: 9.5, z0: -2, z1: 2.5 }, luces.slice(0, 3), tiempo));

  const baldosas = crearBaldosas(grupos, renderer);
  return { capas, grupos, animar, luces, gPolvo, baldosas };
}
