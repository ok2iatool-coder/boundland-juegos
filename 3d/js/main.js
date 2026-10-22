// Boundland · el bosque: el 18 en 3D jugable en tercera persona.
// WASD / flechas corren (relativo a la camara), Mayus anda, Espacio salta, 1-4 gestos, raton gira la camara (arrastrar,
// o clic para bloquear el puntero en Chrome), rueda acerca. window.__dbg para probar sin teclado.
import * as THREE from 'three';
import { cargarHeroe } from './heroe.js';
import { crearSonido } from './sonido.js';

// el MAPA: el bosque por defecto, ?mapa=muro el del muro. Cada mapa es un modulo con la misma interfaz (altura, choques,
// salida, actualizar, puntoCamino, LADO); el 18, su capa y la IK de los pies son los mismos
const MAPAS = { bosque: './mundo.js', muro: './muro.js', parcela: './parcela.js', trozo: './trozo/mundo.js', terreno: './terreno/mundo.js', mundo: './mundo/mundo.js' };
const nombreMapa = new URLSearchParams(location.search).get('mapa') || 'bosque';
const { crearMundo } = await import(MAPAS[nombreMapa] || MAPAS.bosque);

const $ = (id) => document.getElementById(id);
const canvas = $('vista');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;   // PCFSoft esta obsoleto en three 0.185 (avisaba en consola)

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(50, 1, 0.05, 160);
const mundo = crearMundo(scene);
const altura = mundo.altura;
const heroe = cargarHeroe(scene, mundo);
if (mundo.titulo) { $('titulo').lastChild.textContent = mundo.titulo; document.title = 'Boundland · ' + mundo.titulo.toLowerCase(); }
if (mundo.lejos) cam.far = mundo.lejos;
if (mundo.cerca) cam.near = mundo.cerca;                // el plano cercano (en el mundo de 15 km, mas lejos para no perder precision)                 // el plano lejano del mapa (desde la Cuenca se ve el muro a 300 m)
if (mundo.ayuda) $('ayuda').innerHTML = mundo.ayuda;

function encajar() {
  renderer.setSize(innerWidth, innerHeight, false);
  cam.aspect = innerWidth / innerHeight;
  cam.updateProjectionMatrix();
}
addEventListener('resize', encajar);
encajar();

// ---------------- camara en tercera persona ----------------
const C = { yaw: mundo.salida.giro + Math.PI, pitch: 0.28, dist: 3.4, foco: new THREE.Vector3(), lista: false };
// los mapas con juego (el trozo) reciben al heroe y una forma de pedirle gestos (sus respuestas en las conversaciones)
if (mundo.conectar) mundo.conectar({ heroe, gesto: (n) => { gestoPedido = n; }, camara: C, cam, canvas, renderer });
function camara(dt) {
  const objetivo = heroe.pos.clone().add(new THREE.Vector3(0, 0.72, 0));
  if (!C.lista) { C.foco.copy(objetivo); C.lista = true; }
  C.foco.lerp(objetivo, Math.min(1, 9 * dt));
  const cp = Math.cos(C.pitch);
  const p = C.foco.clone().add(new THREE.Vector3(Math.sin(C.yaw) * cp * C.dist, Math.sin(C.pitch) * C.dist, Math.cos(C.yaw) * cp * C.dist));
  // que no se meta en troncos, columnas ni muros: se acerca hasta el primer choque entre el foco y la camara
  // (con el heroe pegado al tronco el choque esta a centimetros: en vez de cruzarlo, la camara se queda en su lado
  // y sube por encima del heroe, mirando hacia abajo)
  const k = obstaculoCamara(C.foco, p);
  if (k < 1) {
    const hx = p.x - C.foco.x, hz = p.z - C.foco.z, hl = Math.hypot(hx, hz) || 1;
    const hk = Math.max(0, hl * k - 0.08);
    const sube = Math.min(1.8, Math.sqrt(Math.max(0, C.dist * C.dist - hk * hk)) * 0.6);
    p.set(C.foco.x + hx / hl * hk, Math.max(p.y, C.foco.y + sube), C.foco.z + hz / hl * hk);
  }
  // ni en el suelo
  const suelo = altura(p.x, p.z) + 0.25;
  if (p.y < suelo) p.y = suelo;
  cam.position.copy(p);
  cam.lookAt(C.foco);
}
// fraccion (0..1) del segmento foco -> camara hasta el primer obstaculo en planta (circulos y cajas giradas del
// mapa, engordados lo que mide el plano cercano de la camara); 1 si no hay ninguno
const HOLGURA = 0.22;
function obstaculoCamara(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
  if (L2 < 1e-8) return 1;
  let t = 1;
  for (const c of mundo.choques.circulos) {
    const fx = a.x - c.x, fz = a.z - c.z, r = c.r + HOLGURA;
    if (fx * fx + fz * fz > (Math.sqrt(L2) + r) ** 2) continue;
    const B = fx * dx + fz * dz, Cc = fx * fx + fz * fz - r * r, D = B * B - L2 * Cc;
    if (D < 0) continue;
    const t0 = (-B - Math.sqrt(D)) / L2;
    if (Cc < 0) continue;                       // el foco dentro del circulo (pegado al tronco): no recorta
    if (t0 > 0 && t0 < t) t = t0;
  }
  for (const c of mundo.choques.cajas) {
    const ca = Math.cos(c.ang), sa = Math.sin(c.ang);
    const ax = (a.x - c.x) * ca + (a.z - c.z) * sa, az = -(a.x - c.x) * sa + (a.z - c.z) * ca;
    const ex = dx * ca + dz * sa, ez = -dx * sa + dz * ca;
    let t0 = 0, t1 = 1, ok = true;
    for (const [o, e, h] of [[ax, ex, c.hx + HOLGURA], [az, ez, c.hz + HOLGURA]]) {
      if (Math.abs(e) < 1e-9) { if (Math.abs(o) > h) ok = false; continue; }
      let u0 = (-h - o) / e, u1 = (h - o) / e;
      if (u0 > u1) [u0, u1] = [u1, u0];
      t0 = Math.max(t0, u0); t1 = Math.min(t1, u1);
    }
    if (ok && t0 <= t1 && t0 > 0 && t0 < t) t = t0;
  }
  return t;
}

// el sonido: el navegador no deja sonar nada hasta que se toca una tecla o se hace clic
const sonido = crearSonido();
addEventListener('pointerdown', () => sonido.activar(), { capture: true });
addEventListener('keydown', () => sonido.activar(), { capture: true });

// el raton pasa antes por el mapa (el editor del terreno lo usa entero: pincel, girar, mover y acercar su camara)
const ratonMapa = (tipo, e) => !!(mundo.raton && mundo.raton(tipo, e));
let arrastre = null;
canvas.addEventListener('pointerdown', (e) => {
  if (ratonMapa('abajo', e)) { e.preventDefault(); return; }
  arrastre = { x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
  if (e.button === 0 && !document.pointerLockElement && canvas.requestPointerLock) {
    try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch { /* en el panel no hay pointer lock */ }
  }
});
canvas.addEventListener('pointerup', (e) => { arrastre = null; ratonMapa('arriba', e); });
canvas.addEventListener('contextmenu', (e) => { if (ratonMapa('menu', e)) e.preventDefault(); });
addEventListener('pointermove', (e) => {
  if (ratonMapa('mueve', e)) return;
  let dx = 0, dy = 0;
  if (document.pointerLockElement === canvas) { dx = e.movementX; dy = e.movementY; }
  else if (arrastre) { dx = e.clientX - arrastre.x; dy = e.clientY - arrastre.y; arrastre = { x: e.clientX, y: e.clientY }; }
  C.yaw -= dx * 0.005;
  C.pitch = Math.max(-0.2, Math.min(1.25, C.pitch + dy * 0.004));
});
canvas.addEventListener('wheel', (e) => { if (ratonMapa('rueda', e)) { e.preventDefault(); return; } C.dist = Math.max(1.6, Math.min(9, C.dist * (1 + Math.sign(e.deltaY) * 0.1))); e.preventDefault(); }, { passive: false });

// ---------------- teclado ----------------
const teclas = new Set();
let saltoPedido = false, gestoPedido = 0;
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  // primero el mapa (conversaciones, paneles, E para usar): si la usa, no llega al 18
  if (mundo.tecla && mundo.tecla(e, true)) { e.preventDefault(); return; }
  teclas.add(e.code);
  if (e.code === 'Space') { saltoPedido = true; e.preventDefault(); }
  if (/^Digit[1-4]$/.test(e.code)) gestoPedido = Number(e.code.slice(5));
  if (e.code === 'KeyH') $('ayuda').classList.toggle('oculta');
  if (e.code === 'KeyP' && heroe.listo) { heroe.fisica = !heroe.fisica; $('fisica').textContent = heroe.fisica ? 'sí' : 'no'; }
  if (e.code === 'KeyN') sonido.alternar();
});
addEventListener('keyup', (e) => { teclas.delete(e.code); if (mundo.tecla) mundo.tecla(e, false); });
addEventListener('blur', () => teclas.clear());
function entrada() {
  const t = (...c) => c.some((k) => teclas.has(k) || DBG.teclas.has(k));
  const e = {
    x: (t('KeyD', 'ArrowRight') ? 1 : 0) - (t('KeyA', 'ArrowLeft') ? 1 : 0),
    z: (t('KeyW', 'ArrowUp') ? 1 : 0) - (t('KeyS', 'ArrowDown') ? 1 : 0),
    andar: t('ShiftLeft', 'ShiftRight'),
    saltar: saltoPedido, gesto: gestoPedido,
    saltoSostenido: t('Space'),   // soltarlo subiendo corta el salto (salto corto con un toque)
  };
  saltoPedido = false;
  gestoPedido = 0;
  // con una conversacion o un panel abiertos el 18 se queda quieto (los gestos si llegan: son sus respuestas)
  if (mundo.bloqueado && mundo.bloqueado()) { e.x = 0; e.z = 0; e.saltar = false; }
  return e;
}

// ---------------- bucle ----------------
const DBG = { teclas: new Set(), congelado: false };
const reloj = new THREE.Timer();   // Clock esta obsoleto en three 0.185
let t = 0;
// un mapa con su propio pase (el mundo: la neblina, mundo/neblina.js) pinta el solo
const pintar = () => (mundo.pintar ? mundo.pintar(renderer, scene, cam, t) : renderer.render(scene, cam));
function fotograma(dt) {
  t += dt;
  heroe.paso(dt, entrada(), C.yaw);
  camara(dt);
  mundo.actualizar(t, heroe.pos, heroe, dt);
  sonido.paso(dt, heroe, mundo, cam);
  pintar();
}
function bucle() {
  reloj.update();
  const dt = Math.min(0.05, reloj.getDelta());
  if (!DBG.congelado) fotograma(dt);
  requestAnimationFrame(bucle);
}
heroe.cargado.then(() => {
  $('carga').remove();
  bucle();
}).catch((e) => { $('carga').textContent = 'No se pudo abrir el modelo: ' + e.message; });

// ---------------- para probar desde el panel ----------------
window.__dbg = {
  heroe, mundo, cam, C, scene, renderer, DBG, sonido,
  pulsar(...c) { c.forEach((k) => DBG.teclas.add(k)); },
  soltar(...c) { (c.length ? c : [...DBG.teclas]).forEach((k) => DBG.teclas.delete(k)); },
  saltar() { saltoPedido = true; },
  gesto(n) { gestoPedido = n; },
  congelar(v = true) { DBG.congelado = v; },
  avanzar(s, n = 1) { for (let i = 0; i < n; i++) fotograma(s); },
  ir(x, z) { heroe.pos.set(x, altura(x, z), z); C.lista = false; },
  camara(yaw, pitch, dist) { if (yaw != null) C.yaw = yaw; if (pitch != null) C.pitch = pitch; if (dist != null) C.dist = dist; },
  async qa() { const m = await import('./qa.js'); return m.auditar(window.__dbg); },
  async snap(nombre) {
    pintar();
    const b = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.9));
    await fetch('/__snap/' + nombre, { method: 'PUT', body: b });
    return nombre;
  },
};
