// BOUNDLAND · LA CIUDAD INDUSTRIAL: la imagen de referencia como escenario 2.5D. Todo lo que se ve esta PINTADO
// (pinta/, con el taller de El Linde y de la ciudad del juego: tinta, hormigon en cel, oxido pardo, contraluz que
// lame los cantos) en capas de baldosas; three.js solo pone el paralaje, el cielo, la bruma que deriva, el humo,
// el polvo, los rayos y el brillo de las luces. Camara ORTOGRAFICA lateral; el paralaje lo hace cada capa moviendose
// (1 - f) veces lo que la camara (escena.js). El 18 anda con A/D o las flechas (Mayus corre) y la camara le sigue;
// el raton la asoma un poco hacia los lados. ?quieto deja la vista de la imagen.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { prepararNiebla, CAM_Z } from './atmosfera.js';
import { crearEscena, CAM0 } from './escena.js';
import { cargarSujeto } from './sujeto.js';
import { PAL } from './base.js';
import { NIVEL } from './nivel.js';

prepararNiebla();
const QS = new URLSearchParams(location.search);
const VISTA = 10.5;                                                // alto de la vista en u (como la imagen)

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: QS.has('test') });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;                       // lo pintado ya tiene su valor: no se toca
document.body.appendChild(renderer.domElement);

const escena = new THREE.Scene();
escena.background = new THREE.Color(PAL.bruma);
const tiempo = { value: 0 };

// ---------------------------------------------------------------- camara
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 3000);
cam.position.set(CAM0.x, CAM0.y, CAM_Z);
function encuadre() {
  const a = innerWidth / innerHeight;
  cam.left = (-VISTA * a) / 2; cam.right = (VISTA * a) / 2; cam.top = VISTA / 2; cam.bottom = -VISTA / 2; cam.updateProjectionMatrix();
}
encuadre();

// ---------------------------------------------------------------- la escena
const { capas, luces, gPolvo, baldosas } = crearEscena(escena, tiempo, renderer);
const matPolvo = gPolvo.children[0].material;
const sujeto = await cargarSujeto();
const p = { x: 0, vx: 0, cara: 1 };
sujeto.grupo.position.set(0, 0, 1.0);
capas.find((c) => c.f === 1).g.add(sujeto.grupo);

// ---------------------------------------------------------------- posproceso
const composer = new EffectComposer(renderer);
composer.setPixelRatio(renderer.getPixelRatio());
composer.addPass(new RenderPass(escena, cam));
// solo lo que pasa del blanco (los halos, el 18) florece: lo pintado se queda nitido
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.55, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());
// etalonaje de la imagen: negros algo calidos, saturacion apenas contenida, vineta y grano
const grado = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTiempo: tiempo, uRes: { value: new THREE.Vector2(innerWidth, innerHeight) } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTiempo; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, 0.92);
      c = c * 0.97 + vec3(0.018, 0.014, 0.01) * (1.0 - l);
      vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y;
      c *= mix(1.0, 0.66, smoothstep(0.4, 1.05, length(q)));
      c += (h(vUv * uRes + fract(uTiempo) * 91.7) - 0.5) * 0.022;
      gl_FragColor = vec4(c, 1.0);
    }`,
});
composer.addPass(grado);

// ---------------------------------------------------------------- mandos
const teclas = {};
addEventListener('keydown', (e) => { teclas[e.code] = true; });
addEventListener('keyup', (e) => { teclas[e.code] = false; });
let raton = 0; addEventListener('pointermove', (e) => { raton = (e.clientX / innerWidth - 0.5) * 2; });
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); grado.uniforms.uRes.value.set(innerWidth, innerHeight); encuadre(); });

// ---------------------------------------------------------------- el bucle
const reloj = new THREE.Clock();
let congelado = false, camX = CAM0.x, mira = 0;
function paso(dt) {
  tiempo.value += dt;
  if (!QS.has('quieto')) {
    const dir = (teclas.KeyD || teclas.ArrowRight ? 1 : 0) - (teclas.KeyA || teclas.ArrowLeft ? 1 : 0), corre = teclas.ShiftLeft || teclas.ShiftRight;
    const v = dir * (corre ? 3.4 : 1.55);
    p.vx += (v - p.vx) * Math.min(1, dt * 10); p.x = Math.max(NIVEL.x0, Math.min(NIVEL.x1, p.x + p.vx * dt));
    if (dir) p.cara = dir;
    sujeto.poner(Math.abs(p.vx) < 0.15 ? 'reposo2' : Math.abs(p.vx) > 2.4 ? 'correr' : 'andar', dt, p.cara);
    sujeto.grupo.position.x = p.x;
    mira += (raton * 1.6 - mira) * Math.min(1, dt * 2);
    const meta = p.x + CAM0.x + mira + p.vx * 0.35;
    camX += (meta - camX) * Math.min(1, dt * 2.2);
  } else sujeto.poner('reposo2', dt, 1);
  cam.position.x = camX;
  baldosas.seguir(camX + p.vx * 1.5);
  for (const c of capas) c.g.position.x = (camX - CAM0.x) * (1 - c.f);
  gPolvo.position.x = camX - CAM0.x;
  const lp = luces.slice().sort((a, b) => Math.abs(a.p.x - camX) - Math.abs(b.p.x - camX));
  for (let k = 0; k < 3; k++) { const q = lp[k]; if (!q) continue; matPolvo.uniforms.uLuz.value[k].copy(q.p); matPolvo.uniforms.uLuzCol.value[k].copy(q.col); matPolvo.uniforms.uLuzR.value[k] = q.r; }
}
function bucle() {
  requestAnimationFrame(bucle);
  const dt = Math.min(0.05, reloj.getDelta());
  if (!congelado) paso(dt);
  composer.render();
}

// ---------------------------------------------------------------- para probar sin mirar la pantalla
window.__dbg = {
  escena, cam, capas, renderer, composer, p, baldosas,
  ir(x) { p.x = x; camX = x + CAM0.x; paso(0); composer.render(); },
  congelar(v = true) { congelado = v; },
  avanzar(s, n = 1) { for (let k = 0; k < n; k++) paso(s / n); composer.render(); },
  camara(x) { camX = x; paso(0); composer.render(); },
  // espera a que esten pintadas las baldosas que se ven (o todas)
  async listo(todas = false) { await (todas ? baldosas.todas() : baldosas.visibles()); composer.render(); return baldosas.hechas.length + '/' + baldosas.total; },
  async snap(nombre = 'vista') {
    composer.render();
    const b = await new Promise((r) => renderer.domElement.toBlob(r, 'image/jpeg', 0.92));
    await fetch('/__snap/' + nombre, { method: 'PUT', body: b });
    return nombre;
  },
};
// la pantalla de carga se va cuando esta pintado lo que se ve al empezar (lo demas se pinta mientras se juega)
const cartel = document.getElementById('cargando');
const avance = setInterval(() => { if (cartel) cartel.textContent = 'PINTANDO · ' + Math.round(baldosas.progreso() * 100) + ' %'; }, 200);
await baldosas.visibles();
clearInterval(avance); cartel?.remove();
bucle();
