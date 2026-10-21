// Boundland · EL MURO EXTERIOR (escena aparte de la prueba del paso de 2D a 3D): el muro bajo de 4 m que se salta, de
// bloques en T, con el 18 en tercera persona. Mismo render que la base de la prueba: el 3D en un render target, la
// NEBLINA integrada por rayo a media resolucion (niebla4.js) y un pase final con la vineta y el grano.
import * as THREE from 'three';
import { crearMuro4, M4 } from './mundo.js';
import { cargarHeroe } from '../heroe.js';
import { crearNiebla4 } from './niebla4.js';

const qs = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------------ render
const canvas = $('vista');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const escena = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 2600);
const rt = new THREE.WebGLRenderTarget(16, 16, { samples: 4, type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(16, 16) });
const rtNiebla = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, depthBuffer: false });

const comp = new THREE.ShaderMaterial({
  uniforms: {
    t3D: { value: rt.texture }, tProf: { value: rt.depthTexture }, tNiebla: { value: rtNiebla.texture }, uNieb: { value: 1 },
    uResN: { value: new THREE.Vector2(1, 1) }, uNear: { value: 0.05 }, uFar: { value: 2600 }, uRes: { value: new THREE.Vector2(1, 1) },
    uTiempo: { value: 0 }, uVineta: { value: 1 }, uGrano: { value: 0.03 }, uExpo: { value: 1 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D t3D, tProf, tNiebla; uniform float uNieb, uNear, uFar, uTiempo, uVineta, uGrano, uExpo; uniform vec2 uResN, uRes;
    varying vec2 vUv;
    float h2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float linZ(float d) { float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
    // la neblina de media resolucion a la entera mirando la profundidad (que no se corra la de detras sobre lo de delante)
    vec4 nieblaEn(vec2 uv) {
      vec2 p = uv * uResN - 0.5, f = fract(p), b = (floor(p) + 0.5) / uResN;
      float z0 = linZ(texture2D(tProf, uv).r);
      vec4 s = vec4(0.0); float ws = 0.0;
      for (int k = 0; k < 4; k++) {
        vec2 o = vec2(float(k - (k / 2) * 2), float(k / 2)), uvk = b + o / uResN;
        float zk = linZ(texture2D(tProf, uvk).r);
        float w = (o.x > 0.5 ? f.x : 1.0 - f.x) * (o.y > 0.5 ? f.y : 1.0 - f.y) / (0.002 + abs(zk - z0) / max(z0, 0.1));
        s += texture2D(tNiebla, uvk) * w; ws += w;
      }
      return s / max(ws, 1e-6);
    }
    void main() {
      vec3 c = texture2D(t3D, vUv).rgb;
      if (uNieb > 0.5) { vec4 nb = nieblaEn(vUv); c = c * nb.a + nb.rgb; }
      c *= uExpo;
      // el etalonaje del despertar: algo de color fuera de lo calido, sombras frias
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      float calido = smoothstep(0.015, 0.12, c.r - c.b);
      c = mix(mix(vec3(l), c, 0.82) * vec3(0.97, 1.0, 1.05), c, calido);
      float dv = length((vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0));
      float vin = smoothstep(0.42, 1.25, dv) * uVineta;
      c = mix(c, c * vec3(0.62, 0.68, 0.78), vin) * (1.0 - 0.3 * vin);
      vec4 o = linearToOutputTexel(vec4(max(c, vec3(0.0)), 1.0));
      o.rgb += (h2(vUv * uRes + fract(uTiempo * 7.13) * 91.0) - 0.5) * uGrano;
      gl_FragColor = o;
    }`,
  depthTest: false, depthWrite: false,
});
const compEscena = new THREE.Scene(), compCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), comp); quad.frustumCulled = false; compEscena.add(quad);

let W = 1, H = 1;
function encajar() {
  const pr = Math.min(devicePixelRatio || 1, 1080 / innerHeight);
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight, false);
  const v = renderer.getDrawingBufferSize(new THREE.Vector2());
  W = v.x; H = v.y;
  rt.setSize(W, H); rtNiebla.setSize(Math.ceil(W / 2), Math.ceil(H / 2));
  comp.uniforms.uResN.value.set(Math.ceil(W / 2), Math.ceil(H / 2));
  comp.uniforms.uRes.value.set(W, H);
  cam.aspect = W / H; cam.updateProjectionMatrix();
}
encajar();
addEventListener('resize', encajar);

// ------------------------------------------------------------------ mundo, 18 y neblina
const mundo = crearMuro4(escena);
const niebla = crearNiebla4({ ambiente: new THREE.Color('#6c7884'), luces: mundo.lucesNiebla, focos: mundo.focosNiebla });
const heroe = cargarHeroe(escena, mundo);
const iFuego = mundo.lucesNiebla.findIndex((l) => l.tiembla);

// ------------------------------------------------------------------ camara (tercera persona; arrastrar la gira, rueda acerca)
const C = { yaw: 0.42, pitch: 0.2, dist: 3.8, foco: new THREE.Vector3(), fov: 50, libre: false };
const _p = new THREE.Vector3();
function colocar() {
  const cp = Math.cos(C.pitch);
  _p.set(C.foco.x + Math.sin(C.yaw) * cp * C.dist, C.foco.y + Math.sin(C.pitch) * C.dist, C.foco.z + Math.cos(C.yaw) * cp * C.dist);
  // la camara no se mete en el muro: se queda del lado del 18 (salvo si va por encima de la tapa)
  if (_p.y < 4.25 && C.foco.y < 3.9) {
    const lado = C.foco.z >= 0 ? 1 : -1;
    if (_p.z * lado < 0.35) _p.z = lado * 0.35;
  }
  // ni bajo el suelo
  _p.y = Math.max(_p.y, mundo.altura(_p.x, _p.z) + 0.25);
  cam.position.copy(_p);
  cam.lookAt(C.foco);
  if (cam.fov !== C.fov) { cam.fov = C.fov; cam.updateProjectionMatrix(); }
}

// ------------------------------------------------------------------ entrada
const teclas = new Set(), dbgTeclas = new Set();
let saltoPedido = false;
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  teclas.add(e.code);
  if (e.code === 'Space') { saltoPedido = true; e.preventDefault(); }
  if (e.code === 'KeyR') reiniciar();
  if (e.code === 'KeyH') $('ayuda').classList.toggle('oculto');
  if (e.code === 'KeyN') comp.uniforms.uNieb.value = 1 - comp.uniforms.uNieb.value;
});
addEventListener('keyup', (e) => teclas.delete(e.code));
addEventListener('blur', () => teclas.clear());
let arrastre = null;
canvas.addEventListener('pointerdown', (e) => { arrastre = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointerup', () => { arrastre = null; });
addEventListener('pointermove', (e) => {
  if (!arrastre) return;
  const dx = e.clientX - arrastre.x, dy = e.clientY - arrastre.y;
  arrastre = { x: e.clientX, y: e.clientY };
  C.yaw -= dx * 0.005;
  C.pitch = Math.max(-0.2, Math.min(1.2, C.pitch + dy * 0.004));
});
canvas.addEventListener('wheel', (e) => { C.dist = Math.max(1.8, Math.min(12, C.dist * (1 + Math.sign(e.deltaY) * 0.1))); e.preventDefault(); }, { passive: false });
const pulsada = (...c) => c.some((k) => teclas.has(k) || dbgTeclas.has(k));
function leerEntrada() {
  const p = { andar: pulsada('ShiftLeft', 'ShiftRight'), saltar: saltoPedido };
  saltoPedido = false;
  p.x = (pulsada('KeyD', 'ArrowRight') ? 1 : 0) - (pulsada('KeyA', 'ArrowLeft') ? 1 : 0);
  p.z = (pulsada('KeyW', 'ArrowUp') ? 1 : 0) - (pulsada('KeyS', 'ArrowDown') ? 1 : 0);
  return p;
}

// ------------------------------------------------------------------ simulacion (60 Hz fijos)
const DT = 1 / 60;
const E = { t: 0 };
function paso(dt, inp) {
  E.t += dt;
  if (heroe.listo) {
    const est = mundo.estado;
    est.x = heroe.pos.x; est.z = heroe.pos.z; est.y = heroe.pos.y; est.suelo = heroe.suelo;
    heroe.paso(dt, inp, C.yaw);
    heroe.brillo.value = 0.035; heroe.exterior.value = 1;
  }
  mundo.actualizar(E.t, dt, heroe, cam);
  const hp = heroe.pos;
  C.foco.lerp(_p.set(hp.x, hp.y + 0.72, hp.z), Math.min(1, 9 * dt));
  colocar();
}
function reiniciar() {
  const s = mundo.salida;
  heroe.reiniciar(s.x, mundo.altura(s.x, s.z), s.z, s.giro);
  C.yaw = 0.42; C.pitch = 0.2; C.dist = 3.8;
  C.foco.set(s.x, mundo.altura(s.x, s.z) + 0.72, s.z);
}

// ------------------------------------------------------------------ dibujar
function dibujar() {
  renderer.setRenderTarget(rt);
  renderer.render(escena, cam);
  renderer.setRenderTarget(null);
  if (comp.uniforms.uNieb.value > 0.5) {
    niebla.actualizar(E.t, cam, 1);
    if (iFuego >= 0) niebla.luz(iFuego, 0.5 * mundo.luces.fuego.intensity / 9);
    niebla.pintar(renderer, rtNiebla, rt.depthTexture);
  }
  comp.uniforms.uNear.value = cam.near; comp.uniforms.uFar.value = cam.far;
  comp.uniforms.uTiempo.value = E.t;
  renderer.render(compEscena, compCam);
}

let tAnterior = null, acumulado = 0;
const DBG = { congelado: false };
function bucle(ahora) {
  requestAnimationFrame(bucle);
  if (DBG.congelado) { tAnterior = ahora; return; }
  const dtr = tAnterior === null ? 16.7 : ahora - tAnterior;
  tAnterior = ahora;
  acumulado += Math.min(0.1, dtr / 1000);
  let n = 0;
  while (acumulado >= DT && n < 5) { paso(DT, leerEntrada()); acumulado -= DT; n++; }
  if (n === 5) acumulado = 0;
  dibujar();
  hud();
}
function hud() {
  const hp = heroe.pos;
  let txt = '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> moverse &nbsp; <kbd>Mayús</kbd> andar &nbsp; <kbd>Espacio</kbd> saltar &nbsp; arrastrar: cámara &nbsp; rueda: distancia';
  if (hp.z < -0.2) txt += ' &nbsp; <span class="dato">FUERA</span>';
  else if (hp.y > 3.8) txt += ' &nbsp; <span class="dato">EN LO ALTO DEL MURO</span>';
  if (hud.txt !== txt) { hud.txt = txt; $('teclas').innerHTML = txt; }
}

// ------------------------------------------------------------------ arranque
window.__dbg = {
  listo: false, heroe, mundo, C, E, cam, renderer, M4,
  pulsar(c) { dbgTeclas.add(c); }, soltar() { dbgTeclas.clear(); },
  saltar() { saltoPedido = true; },
  congelar(v = true) { DBG.congelado = v; },
  // avanza la simulacion s segundos sin pantalla (con la entrada que haya) y pinta
  avanzar(s) { for (let i = 0; i < Math.round(s * 60); i++) paso(DT, leerEntrada()); dibujar(); return heroe.pos.toArray().map((v) => +v.toFixed(2)); },
  ir(x, z, giro = Math.PI) { heroe.reiniciar(x, mundo.altura(x, z), z, giro); C.foco.set(x, heroe.pos.y + 0.72, z); colocar(); dibujar(); return heroe.pos.toArray().map((v) => +v.toFixed(2)); },
  // la camara en un sitio cualquiera (para fotografiar un detalle)
  vista(x, y, z, yaw, pitch, dist, fov = 50) { C.foco.set(x, y, z); C.yaw = yaw; C.pitch = pitch; C.dist = dist; C.fov = fov; DBG.congelado = true; colocar(); dibujar(); return cam.position.toArray().map((v) => +v.toFixed(2)); },
  niebla(v) { comp.uniforms.uNieb.value = v ? 1 : 0; dibujar(); },
  dibujar,
  info() { const i = renderer.info; return { llamadas: i.render.calls, tris: i.render.triangles, geos: i.memory.geometries, tex: i.memory.textures }; },
};

reiniciar();
await heroe.cargado;
reiniciar();
// calentar: compilar y pintar unas veces detras de la pantalla de carga (con el panel oculto no corre el rAF: plazo)
renderer.compile(escena, cam);
const fotogramaSig = () => new Promise((r) => { requestAnimationFrame(r); setTimeout(r, 60); });
for (let i = 0; i < 3; i++) { paso(DT, { x: 0, z: 0 }); dibujar(); await fotogramaSig(); }
$('carga').classList.add('oculto');
__dbg.listo = true;
requestAnimationFrame(bucle);
