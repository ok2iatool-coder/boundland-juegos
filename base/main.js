// Prueba 2.5D de la base de refugiados de Boundland: el mismo 18 (sus sprites) dentro de un campamento 3D y
// cuatro camaras para comparar: plano 2D (como el juego), lateral con profundidad (Little Nightmares),
// diorama (Octopath / Cult of the Lamb) e isometrico (Hades). El Recorrido empieza fuera en 2D y, al cruzar
// el porton, la camara sube y se abre: el mundo gana profundidad justo donde el 18 deja de estar solo.
//
// Una sola camara en perspectiva para todo: el "2D" es un teleobjetivo de 3 grados muy lejos (casi
// ortografico) y pasar de un modo a otro es un travelling con zoom (fov y distancia a la vez), asi la
// profundidad aparece poco a poco en vez de saltar.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { crearMundo, MURO, contornos } from './mundo.js';
import { cargarSujeto } from './sujeto.js';

const MODOS = {
  //          giro    picado  fov   alto visible  altura del foco  desenfoque  lo que se ve delante del 18
  plano: { yaw: 0, pitch: 0.0, fov: 3, alto: 9, oy: 2.6, tilt: 0, cerca: 6.5 },
  lateral: { yaw: 0, pitch: 0.13, fov: 30, alto: 6.2, oy: 1.3, tilt: 0, cerca: 5 },
  diorama: { yaw: Math.PI, pitch: 0.68, fov: 24, alto: 9.5, oy: 0.5, tilt: 1, cerca: 80 },
  iso: { yaw: Math.PI - 0.785, pitch: 0.62, fov: 5, alto: 17, oy: 0.4, tilt: 0.55, cerca: 300 },
};
const VEL = { andar: 2.1, correr: 4.4 };
const FUERA_Z = 4;

// ---------------------------------------------------------------- render
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.prepend(renderer.domElement);

const escena = new THREE.Scene();
escena.background = new THREE.Color('#cfd2cd');
escena.fog = new THREE.Fog('#cfd2cd', 20, 80);
const camara = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.3, 600);

escena.add(new THREE.HemisphereLight('#e2e5e0', '#4a4440', 1.35));
const sol = new THREE.DirectionalLight('#fff6e6', 1.6);
sol.castShadow = true;
sol.shadow.mapSize.set(2048, 2048);
Object.assign(sol.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 120 });
sol.shadow.bias = -0.0006; sol.shadow.normalBias = 0.03;
escena.add(sol, sol.target);

// desenfoque de maqueta (tilt-shift): nitido en la franja del 18, borroso arriba y abajo
const TiltShift = {
  uniforms: { tDiffuse: { value: null }, fuerza: { value: 0 }, res: { value: new THREE.Vector2(1, 1) }, centro: { value: 0.46 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float fuerza; uniform vec2 res; uniform float centro; varying vec2 vUv;
    void main(){
      float d = max(0.0, abs(vUv.y - centro) - 0.16) / 0.34;
      float rad = fuerza * d * d * 9.0;
      vec4 c = texture2D(tDiffuse, vUv);
      if (rad > 0.05) {
        vec4 s = c; float n = 1.0;
        for (int i = 0; i < 12; i++) {
          float a = float(i) * 2.39996; float rr = sqrt(float(i) + 0.5) / 3.5;
          s += texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * rr * rad / res); n += 1.0;
        }
        c = s / n;
      }
      // viñeta suave
      float v = smoothstep(0.95, 0.35, length(vUv - 0.5));
      gl_FragColor = vec4(c.rgb * mix(0.82, 1.0, v), c.a);
    }`,
};
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(escena, camara));
const tilt = new ShaderPass(TiltShift);
composer.addPass(tilt);
composer.addPass(new OutputPass());

function redimensionar() {
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  camara.aspect = innerWidth / innerHeight;
  tilt.uniforms.res.value.set(innerWidth, innerHeight);
}
addEventListener('resize', redimensionar);
redimensionar();

// ---------------------------------------------------------------- mundo y 18
const mundo = crearMundo(escena);
const s18 = await cargarSujeto(escena);
const jug = { x: -24, z: FUERA_Z, cara: 1, az: 90, anim: 'reposo2' };

// ---------------------------------------------------------------- camara
const cam = { ...MODOS.plano, tx: jug.x, tz: jug.z, giroExtra: 0 };
let modo = 'plano', recorrido = true, estado = 'fuera';
let trans = null;                   // { de, a, t, dur }
const lerp = (a, b, k) => a + (b - a) * k;
const _c = new THREE.Vector3(), _o = new THREE.Vector3(), _q = new THREE.Quaternion();
const suave = (k) => k * k * (3 - 2 * k);
function mezclar(a, b, k) {
  const o = {};
  for (const n of ['yaw', 'pitch', 'alto', 'oy', 'tilt', 'cerca']) o[n] = lerp(a[n], b[n], k);
  o.fov = Math.exp(lerp(Math.log(a.fov), Math.log(b.fov), k));   // en logaritmo: el travelling con zoom no da tirones
  return o;
}
function ponerCamara(dt) {
  if (trans) {
    trans.t += dt;
    const k = Math.min(1, trans.t / trans.dur);
    // la camara empieza despacio (el 18 echa a andar) y se abre del todo al final
    Object.assign(cam, mezclar(trans.de, trans.a, suave(suave(k))));
    // al pasar por encima del muro la camara sube un poco mas (arco), para no rozarlo
    cam.pitch += Math.sin(Math.PI * suave(k)) * (trans.arco || 0);
    if (k >= 1) trans = null;
  } else {
    const obj = MODOS[modo], k = 1 - Math.exp(-dt * 4);
    const m = mezclar(cam, { ...obj, yaw: obj.yaw + cam.giroExtra }, k);
    Object.assign(cam, m);
  }
  // el foco sigue al 18 con algo de retraso
  const kf = 1 - Math.exp(-dt * 5);
  cam.tx = lerp(cam.tx, jug.x, kf); cam.tz = lerp(cam.tz, jug.z, kf);
  const d = (cam.alto / 2) / Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
  const dir = new THREE.Vector3(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
  const foco = new THREE.Vector3(cam.tx, cam.oy, cam.tz);
  camara.position.copy(foco).addScaledVector(dir, d);
  camara.lookAt(foco);
  camara.fov = cam.fov;
  camara.near = Math.max(0.3, d - cam.cerca);
  camara.far = d + 260;
  camara.updateProjectionMatrix();
  // la niebla cuenta desde el 18, no desde la camara (con el teleobjetivo la camara esta a 170 m)
  escena.fog.near = d + 14; escena.fog.far = d + 95;
  tilt.uniforms.fuerza.value = cam.tilt;
  // lo que el plano cercano corta se ve hueco; su casco de tinta, por dentro, saldria negro: se oculta
  const fwd = new THREE.Vector3().subVectors(foco, camara.position).normalize();
  for (const c of contornos) {
    c.getWorldPosition(_c);
    const rad = c.geometry.boundingSphere.radius * c.parent.scale.x * (c.parent.parent ? c.parent.parent.scale.x : 1);
    _c.add(_o.copy(c.geometry.boundingSphere.center).applyQuaternion(c.getWorldQuaternion(_q)));
    const prof = _o.subVectors(_c, camara.position).dot(fwd);
    c.visible = prof - rad > camara.near;
  }
  // la sombra del sol sigue al foco
  sol.position.set(cam.tx - 14, 40, cam.tz - 5); sol.target.position.set(cam.tx, 0, cam.tz);
}

// ---------------------------------------------------------------- entrada
const teclas = {};
let lectura = null;
addEventListener('keydown', (e) => {
  teclas[e.code] = true;
  if (e.code === 'KeyE') { if (lectura) cerrarLectura(); else if (cercano) abrirLectura(cercano); }
  if (e.code === 'Escape' && lectura) cerrarLectura();
  if (e.code === 'Digit1') elegir('plano');
  if (e.code === 'Digit2') elegir('lateral');
  if (e.code === 'Digit3') elegir('diorama');
  if (e.code === 'Digit4') elegir('iso');
  if (e.code === 'KeyT') elegir('recorrido');
});
addEventListener('keyup', (e) => { teclas[e.code] = false; });
for (const b of document.querySelectorAll('.modo')) b.addEventListener('click', () => { elegir(b.dataset.modo); b.blur(); });

function elegir(m) {
  cerrarLectura();
  if (m === 'recorrido') {
    recorrido = true; estado = 'fuera'; modo = 'plano'; trans = null; cam.giroExtra = 0;
    Object.assign(cam, MODOS.plano);
    jug.x = -24; jug.z = FUERA_Z; cam.tx = jug.x; cam.tz = jug.z;
  } else {
    recorrido = false; estado = 'libre'; modo = m; trans = null;
    if (m === 'plano' && jug.z > 0 && jug.z < FUERA_Z) jug.z = FUERA_Z;
  }
  marcarBotones();
}
function marcarBotones() {
  for (const b of document.querySelectorAll('.modo')) b.classList.toggle('activo', recorrido ? b.dataset.modo === 'recorrido' : b.dataset.modo === modo);
}
marcarBotones();

const aviso = document.getElementById('aviso'), panelLectura = document.getElementById('lectura');
let cercano = null;
function abrirLectura(h) { lectura = h; panelLectura.querySelector('b').textContent = h.titulo; panelLectura.querySelector('span').textContent = h.texto; panelLectura.style.display = 'block'; }
function cerrarLectura() { lectura = null; panelLectura.style.display = 'none'; }
const franjas = document.getElementById('franjas');

// ---------------------------------------------------------------- moverse
function chocar(x, z) {
  const R = 0.28;
  for (const s of mundo.solidos) {
    if (s.r !== undefined) {
      const dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz), m = s.r + R;
      if (d < m && d > 1e-6) { x = s.x + (dx / d) * m; z = s.z + (dz / d) * m; }
    } else if (x > s.x0 - R && x < s.x1 + R && z > s.z0 - R && z < s.z1 + R) {
      const opciones = [[s.x0 - R - x, 0], [s.x1 + R - x, 0], [0, s.z0 - R - z], [0, s.z1 + R - z]];
      const [mx, mz] = opciones.reduce((a, b) => (Math.hypot(...a) < Math.hypot(...b) ? a : b));
      x += mx; z += mz;
    }
  }
  return [Math.max(MURO.x0 + 1, Math.min(MURO.x1 - 1, x)), Math.max(-40, Math.min(14, z))];
}

let tCruce = 0;
function mover(dt) {
  if (lectura) { jug.anim = 'reposo2'; return; }
  let ix = (teclas.KeyD || teclas.ArrowRight ? 1 : 0) - (teclas.KeyA || teclas.ArrowLeft ? 1 : 0);
  let iy = (teclas.KeyW || teclas.ArrowUp ? 1 : 0) - (teclas.KeyS || teclas.ArrowDown ? 1 : 0);
  const corre = teclas.ShiftLeft || teclas.ShiftRight;

  // ---- el recorrido: fuera en 2D, el porton, dentro en 3D
  if (estado === 'fuera' && Math.abs(jug.x) < 2.4 && iy > 0) {
    estado = 'cruzando'; tCruce = 0;
    trans = { de: { ...cam }, a: MODOS.diorama, t: 0, dur: 4.2, arco: 0.45 };
    franjas.style.setProperty('--f', '7vh');
  }
  if (estado === 'dentro' && jug.z > -0.5 && Math.abs(jug.x) < 2.6) {
    estado = 'saliendo'; tCruce = 0;
    trans = { de: { ...cam }, a: MODOS.plano, t: 0, dur: 3.4, arco: 0.45 };
    franjas.style.setProperty('--f', '7vh');
  }
  if (estado === 'cruzando' || estado === 'saliendo') {
    tCruce += dt;
    const entra = estado === 'cruzando';
    // primero se centra en el porton y luego anda hacia dentro (o hacia fuera)
    const zObj = entra ? -6 : FUERA_Z;
    if (Math.abs(jug.x) > 0.05) { jug.x -= Math.sign(jug.x) * Math.min(Math.abs(jug.x), VEL.andar * dt); jug.cara = -Math.sign(jug.x) || jug.cara; }
    else if (Math.abs(jug.z - zObj) > 0.05) jug.z -= Math.sign(jug.z - zObj) * Math.min(Math.abs(jug.z - zObj), VEL.andar * 0.85 * dt);
    jug.anim = Math.abs(jug.z - zObj) > 0.05 || Math.abs(jug.x) > 0.05 ? 'andar' : 'reposo2';
    if (!trans && tCruce > 1) {
      estado = entra ? 'dentro' : 'fuera'; modo = entra ? 'diorama' : 'plano';
      franjas.style.setProperty('--f', '0px');
    }
    return;
  }

  // ---- andar normal; en el plano 2D solo de lado
  const plano2D = (recorrido && estado === 'fuera') || (!recorrido && modo === 'plano');
  if (plano2D) iy = 0;
  if (modo === 'diorama') { if (teclas.KeyQ) cam.giroExtra -= dt * 0.9; if (teclas.KeyR) cam.giroExtra += dt * 0.9; cam.giroExtra = Math.max(-0.7, Math.min(0.7, cam.giroExtra)); }
  const n = Math.hypot(ix, iy);
  if (n > 0) {
    ix /= n; iy /= n;
    const yaw = cam.yaw;
    const derecha = [Math.cos(yaw), -Math.sin(yaw)], frente = [-Math.sin(yaw), -Math.cos(yaw)];
    const v = (corre ? VEL.correr : VEL.andar) * dt;
    const [nx, nz] = chocar(jug.x + (derecha[0] * ix + frente[0] * iy) * v, jug.z + (derecha[1] * ix + frente[1] * iy) * v);
    jug.x = nx; jug.z = nz;
    if (Math.abs(ix) > 0.2) jug.cara = Math.sign(ix);
    jug.anim = corre ? 'correr' : 'andar';
  } else jug.anim = 'reposo2';
  if (plano2D && jug.z > 0) jug.z = FUERA_Z;
}

// ---------------------------------------------------------------- bucle
const reloj = new THREE.Clock();
let t = 0, congelado = false;
function actualizar(dt) {
  t += dt;
  const x0 = jug.x, z0 = jug.z;
  mover(dt);
  // hacia donde anda EN PANTALLA (0 hacia la camara, 90 a la derecha, 180 alejandose): elige la hoja
  const dx = jug.x - x0, dz = jug.z - z0;
  if (Math.hypot(dx, dz) > 1e-4) {
    const sx = dx * Math.cos(cam.yaw) - dz * Math.sin(cam.yaw), sy = dx * Math.sin(cam.yaw) + dz * Math.cos(cam.yaw);
    jug.az = (Math.atan2(sx, sy) * 180) / Math.PI;
  }
  mundo.porton.abrir(estado === 'fuera' ? 0.3 : 1.15, dt);
  for (const f of mundo.vivos) f(t, dt);
  ponerCamara(dt);
  s18.poner(jug.anim, jug.x, jug.z, cam.yaw, cam.pitch, jug.az, dt);
  for (const p of mundo.npcs) { p.m.rotation.y = cam.yaw; p.m.scale.x = p.cara * (Math.cos(cam.yaw) >= 0 ? 1 : -1); }
  mundo.actualizarMotas(t, jug.x, jug.z);
  // lo que hay cerca para hablar o leer
  cercano = null;
  let mejor = Infinity;
  for (const h of mundo.hablar) {
    const hx = h.npc ? h.npc.x : h.x, hz = h.npc ? h.npc.z : h.z;
    const d = Math.hypot(hx - jug.x, hz - jug.z);
    if (d < h.radio && d < mejor) { mejor = d; cercano = h; }
  }
  const mostrar = cercano && !lectura && estado !== 'cruzando' && estado !== 'saliendo';
  aviso.style.display = mostrar ? 'block' : 'none';
  if (mostrar) aviso.textContent = 'E · ' + (cercano.npc ? 'Hablar' : 'Leer') + ' — ' + cercano.titulo;
}
function bucle() {
  const dt = Math.min(0.05, reloj.getDelta());
  if (!congelado) actualizar(dt);
  if (innerWidth > 0 && innerHeight > 0) composer.render();
  requestAnimationFrame(bucle);
}
bucle();

// para probar sin teclado: __dbg.modo('diorama'), __dbg.ir(x, z), __dbg.pasos(n, teclas)
window.__dbg = {
  modo: elegir,
  ir(x, z) { jug.x = x; jug.z = z; cam.tx = x; cam.tz = z; },
  congelar(v) { congelado = v; },
  pasos(n, ks = []) { for (const k of ks) teclas[k] = true; for (let i = 0; i < n; i++) actualizar(1 / 60); for (const k of ks) teclas[k] = false; composer.render(); },
  get estado() { return { estado, modo, x: jug.x, z: jug.z, cam: { ...cam } }; },
  abrir(i) { abrirLectura(mundo.hablar[i]); },
};
