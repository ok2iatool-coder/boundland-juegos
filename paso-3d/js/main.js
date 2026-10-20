// Boundland · prueba del PASO DE 2D A 3D. Acaba la caida dentro del muro (2D, lienzo como el juego), la vista se raya,
// el 18 entra en un conducto completamente oscuro y en la oscuridad la camara se va haciendo 3D (three.js) mientras
// avanza; sale por el otro lado del muro a una base colgada en altura. Delante, una pared de relleno: la ciudad.
//
// UN SOLO lienzo en pantalla (WebGL). El 2D se pinta como en el juego en un lienzo 2D aparte y se sube como textura;
// el 3D se pinta en un render target; un pase final los mezcla (rayas de la vista, bandas del otro mundo, vineta,
// grano). Asi el cambio no es cambiar de lienzo: es un numero (uMezcla) en un sombreador.
import * as THREE from 'three';
import { D } from './datos.js';
import { cargarSprites, fotograma } from './sprites.js';
import { crearPlano } from './plano.js';
import { crearMundo3D } from './mundo3d.js';
import { cargarHeroe } from './heroe.js';
import { crearSonido } from './sonido.js';
import { crearCarton18, CAPA18 } from './carton18.js';
import { hash } from './tinta.js';

const qs = new URLSearchParams(location.search);
// Por defecto el 3D se carga y se calienta DETRAS de la pantalla de carga (?segundoplano: mientras ya se juega el 2D,
// que es lo que da tirones: ver README). ?tex=srgb sube el 2D a una textura sRGB (15 ms de GPU por fotograma aqui).
const MODO = { precarga: !qs.has('segundoplano'), sinCalentar: qs.has('sincalentar'), tarde: qs.has('tarde'), auto: qs.has('auto'),
  texLineal: qs.get('tex') !== 'srgb', sinSubir: qs.has('sinsubir'), sinPintar: qs.has('sinpintar'), mitad: qs.has('mitad'), solo2D: qs.has('solo2d'),
  despierto: qs.has('despierto') };              // ?despierto: sin el despertar (se levanta al momento, como antes)
const $ = (id) => document.getElementById(id);
const memoria = () => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576 * 10) / 10 : null);
const MED = { marcas: { modulos: performance.now() }, mem: { modulos: memoria() }, fotos: [], eventos: [] };
const marca = (n) => { MED.marcas[n] = Math.round(performance.now()); MED.mem[n] = memoria(); };
const suave = (e) => e * e * (3 - 2 * e);
const paso01 = (a, b, x) => suave(Math.max(0, Math.min(1, (x - a) / (b - a))));
const mezclaN = (a, b, k) => a + (b - a) * k;

// ------------------------------------------------------------------ render
const canvas = $('vista');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const gl = renderer.getContext();
const relojGPU = gl.getExtension('EXT_disjoint_timer_query_webgl2');

const lienzo = document.createElement('canvas');
const ctx = lienzo.getContext('2d');
const tex2D = new THREE.CanvasTexture(lienzo);
tex2D.colorSpace = MODO.texLineal ? THREE.NoColorSpace : THREE.SRGBColorSpace;
tex2D.generateMipmaps = false;
tex2D.minFilter = tex2D.magFilter = THREE.LinearFilter;

const escena3 = new THREE.Scene();
const cam3 = new THREE.PerspectiveCamera(D.FOV0, 16 / 9, 0.05, 1500);
const rt = new THREE.WebGLRenderTarget(16, 16, { samples: 4, type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(16, 16) });
const rtPeque = new THREE.WebGLRenderTarget(32, 32, { type: THREE.HalfFloatType });
// LA CAPA DEL 18: el 18 (de carton, y el .glb mientras dura la vista rayada) se pinta aparte, con fondo transparente, y
// el pase final lo pone encima de la raya y las bandas: el 18 no se corta nunca (carton18.js)
// y con su profundidad, como el mundo: en el 3D el pase final lo pone solo donde esta delante (el bidon lo tapa)
const rt18 = new THREE.WebGLRenderTarget(16, 16, { samples: 4, type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(16, 16) });

// el pase final: mezcla, rayas, bandas, vineta fria centrada en el 18 y grano (estilo del despertar del juego)
const comp = new THREE.ShaderMaterial({
  uniforms: {
    t2D: { value: tex2D }, t3D: { value: rt.texture }, t18: { value: rt18.texture }, uUsa18: { value: 0 }, tProf3: { value: rt.depthTexture }, tProf18: { value: rt18.depthTexture }, uProf: { value: 0 }, uLineal: { value: MODO.texLineal ? 1 : 0 }, uUsa2D: { value: 1 }, uUsa3D: { value: 0 },
    uMezcla: { value: 0 }, uRaya: { value: 0 }, uBandas: { value: 0 }, uTiempo: { value: 0 }, uNegro: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) }, uCentro: { value: new THREE.Vector2(0.5, 0.5) }, uVineta: { value: 1 }, uGrano: { value: 0.035 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D t2D, t3D, t18, tProf3, tProf18; uniform float uUsa18, uProf, uLineal, uUsa2D, uUsa3D, uMezcla, uRaya, uBandas, uTiempo, uNegro, uVineta, uGrano;
    uniform vec2 uRes, uCentro;
    varying vec2 vUv;
    float h1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
    float h2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec3 leer(vec2 uv, float capa) {
      uv = clamp(uv, vec2(0.0005), vec2(0.9995));
      vec3 a = uUsa2D > 0.5 ? texture2D(t2D, uv).rgb : vec3(0.0);
      // el lienzo 2D se sube tal cual (RGBA8) y se pasa a lineal aqui: subirlo a una textura sRGB costaba 15 ms de GPU
      if (uLineal > 0.5) a = mix(a / 12.92, pow((a + 0.055) / 1.055, vec3(2.4)), step(0.04045, a));
      vec3 b = uUsa3D > 0.5 ? texture2D(t3D, uv).rgb : vec3(0.0);
      return mix(a, b, capa);
    }
    void main() {
      vec2 uv = vUv;
      float g = uRaya;
      float tq = floor(uTiempo * 30.0);                       // la raya va a saltos, no se desliza
      float nb = mix(12.0, 44.0, h1(tq * 1.7 + 3.0));
      float banda = floor(uv.y * nb);
      float rb = h1(banda * 13.1 + tq * 7.3);
      float desplaza = rb < g * 0.55 ? (h1(banda + tq * 1.3) - 0.5) * 0.11 * g : 0.0;
      float tiron = step(0.9, h1(tq * 3.1)) * g * (h1(tq + 9.0) - 0.5) * 0.035;
      uv.x += desplaza + tiron;
      // la capa de la banda: la que toca por la mezcla y, en algunas bandas, la otra (el otro mundo que asoma)
      float otra = step(1.0 - uBandas, h1(banda * 5.7 + tq * 3.3 + 1.0));
      float capa = clamp(uMezcla + otra * (uMezcla < 0.5 ? 1.0 : -1.0), 0.0, 1.0);
      float sep = 0.0042 * g + 0.0016 * otra;
      vec3 c = vec3(leer(uv + vec2(sep, 0.0), capa).r, leer(uv, capa).g, leer(uv - vec2(sep, 0.0), capa).b);
      // rayas: hilos claros horizontales y alguna vertical de pelicula
      c += step(0.993, h2(vec2(floor(vUv.y * uRes.y * 0.5), tq))) * g * 0.3;
      c = mix(c, vec3(0.62, 0.66, 0.7), step(0.9978, h2(vec2(floor(vUv.x * uRes.x * 0.33), floor(tq / 3.0)))) * g * 0.6);
      c *= 1.0 - 0.16 * g * (0.5 + 0.5 * sin(vUv.y * uRes.y * 3.14159));
      // el 18 encima (premultiplicado): ni la raya, ni las bandas, ni la mezcla lo tocan; la vineta y el grano si
      if (uUsa18 > 0.5) {
        vec4 p18 = texture2D(t18, vUv);
        float k = 1.0 - uProf * step(texture2D(tProf3, vUv).r, texture2D(tProf18, vUv).r - 1e-5);   // lo que el mundo tapa
        c = c * (1.0 - p18.a * k) + p18.rgb * k;
      }
      // vineta fria centrada en el 18 y grano
      float dv = length((vUv - uCentro) * vec2(uRes.x / uRes.y, 1.0));
      float vin = smoothstep(0.38, 1.3, dv) * uVineta;
      c = mix(c, c * vec3(0.6, 0.66, 0.76), vin) * (1.0 - 0.32 * vin);
      c *= 1.0 - uNegro;
      // el grano va DESPUES de pasar a sRGB: en lineal se multiplicaba en los negros y la penumbra hervia
      vec4 o = linearToOutputTexel(vec4(max(c, vec3(0.0)), 1.0));
      o.rgb += (h2(vUv * uRes + fract(uTiempo * 7.13) * 91.0) - 0.5) * uGrano * (1.0 - uNegro);
      gl_FragColor = o;
    }`,
  depthTest: false, depthWrite: false,
});
const compEscena = new THREE.Scene();
const compCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), comp);
quad.frustumCulled = false;
compEscena.add(quad);

let W = 1, H = 1;
function encajar() {
  // resolucion interna con tope de 1080 de alto (el 2D se sube entero como textura cada fotograma)
  const pr = Math.min(devicePixelRatio || 1, 1080 / innerHeight);
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight, false);
  const v = renderer.getDrawingBufferSize(new THREE.Vector2());
  W = v.x; H = v.y;
  lienzo.width = W; lienzo.height = H;
  tex2D.dispose();                          // nuevo tamano: la textura se vuelve a crear
  rt.setSize(W, H); rt18.setSize(W, H);
  cam3.aspect = W / H; cam3.updateProjectionMatrix();
  comp.uniforms.uRes.value.set(W, H);
  if (plano) plano.redimensionar(W, H);
}

// ------------------------------------------------------------------ mundo
const sonido = crearSonido();
let sprites = null, plano = null, heroe = null, carton = null, tresListo = false, calentando = false;
const mundo = crearMundo3D(escena3);
const C = { yaw: 0, pitch: 0, dist: 3.4, fov: D.FOV0, foco: new THREE.Vector3(), libre: false, tLibre: 0 };

function empezarHeroe() {
  marca('glbInicio');
  heroe = cargarHeroe(escena3, mundo);
  return heroe.cargado.then(async () => {
    marca('glbFin');
    if (MODO.mitad) await mitadTexturas();
    await pSprites;
    carton = crearCarton18(escena3);
    // las luces alumbran tambien la capa del 18 (three solo cuenta las luces de las capas que ve la camara)
    escena3.traverse((o) => { if (o.isLight) o.layers.enable(CAPA18); });
    heroe.raiz.visible = true;
    if (!MODO.sinCalentar) await calentar();
    tresListo = true;
    marca('tresListo');
  });
}

// ?mitad: las texturas del 18 (4096 x 4096, 85 MB de GPU cada una con sus mipmaps) bajadas a 2048 antes de subirlas,
// fuera del hilo principal (createImageBitmap)
async function mitadTexturas() {
  const ts = new Set();
  heroe.raiz.traverse((o) => { for (const m of [].concat(o.material || [])) for (const k of ['map', 'emissiveMap']) if (m[k]) ts.add(m[k]); });
  for (const t of ts) {
    if (!t.image || t.image.width <= 2048) continue;
    const im = await createImageBitmap(t.image, { resizeWidth: 2048, resizeHeight: 2048, resizeQuality: 'high' });
    t.image = im; t.needsUpdate = true;
  }
  marca('mitad');
}

// CALENTAR el 3D sin que el 2D lo note: compilar los sombreadores en paralelo (KHR_parallel_shader_compile), subir
// las texturas una por fotograma y pintar la escena por trozos en un render target de 32 px (sube la geometria y
// la sombra). Lo que no se haga aqui se hace en el primer fotograma 3D: el tiron.
async function calentar() {
  calentando = true;
  const fotogramaSig = () => new Promise((r) => requestAnimationFrame(() => r()));
  ponerCamara3(0);
  let tc = performance.now();
  await renderer.compileAsync(escena3, cam3, escena3);
  MED.eventos.push({ n: 'compilar', ms: Math.round(performance.now() - tc) });
  marca('compilado');
  const texs = new Set();
  escena3.traverse((o) => {
    for (const m of [].concat(o.material || [])) for (const k of ['map', 'emissiveMap', 'alphaMap', 'gradientMap']) if (m[k]) texs.add(m[k]);
  });
  for (const t of texs) {
    tc = performance.now(); renderer.initTexture(t);
    MED.eventos.push({ n: 'subirTextura', px: t.image ? [t.image.width, t.image.height] : null, ms: +(performance.now() - tc).toFixed(1) });
    await fotogramaSig();
  }
  marca('texturas');
  for (const t of [mundo.tPintura, ...mundo.objetos.texturas]) { renderer.initTexture(t); await fotogramaSig(); }
  const mallas = [];
  escena3.traverse((o) => { if (o.isMesh || o.isPoints) mallas.push(o); });
  const vis = mallas.map((m) => m.visible), recorte = mallas.map((m) => m.frustumCulled);
  mallas.forEach((m) => { m.frustumCulled = false; });
  const grupos = [];
  escena3.traverse((o) => { if (o.isGroup && !o.visible) { grupos.push(o); o.visible = true; } });
  for (let i = 0; i < mallas.length; i += 10) {
    mallas.forEach((m, k) => { m.visible = vis[k] && k >= i && k < i + 10; });
    tc = performance.now();
    renderer.setRenderTarget(rtPeque); renderer.render(escena3, cam3); renderer.setRenderTarget(null);
    MED.eventos.push({ n: 'pintarTrozo', i, ms: +(performance.now() - tc).toFixed(1) });
    await fotogramaSig();
  }
  mallas.forEach((m, k) => { m.visible = vis[k]; m.frustumCulled = recorte[k]; });
  grupos.forEach((g) => { g.visible = false; });
  tc = performance.now();
  renderer.setRenderTarget(rt); renderer.render(escena3, cam3); renderer.setRenderTarget(null);
  MED.eventos.push({ n: 'pintarRT', ms: +(performance.now() - tc).toFixed(1) });
  cam3.layers.set(CAPA18); renderer.setRenderTarget(rt18); renderer.render(escena3, cam3); renderer.setRenderTarget(null); cam3.layers.set(0);
  await fotogramaSig();
  // ?gc (con Chrome --js-flags=--expose-gc): recoger la basura de construir el mundo aqui, tras la pantalla de carga,
  // para saber si el tiron de despues era el recolector
  if (qs.has('gc') && window.gc) { tc = performance.now(); window.gc(); MED.eventos.push({ n: 'gc', ms: +(performance.now() - tc).toFixed(1) }); }
  // dejar que la tarjeta acabe lo que tiene en cola (tras el muro de 40 m el tercer fotograma del juego esperaba 39 ms
  // con la CPU parada): unos fotogramas mas tras la pantalla de carga, midiendo cuanto tarda cada uno
  const asentar = [];
  for (let i = 0, t0 = performance.now(); i < 12; i++) { await fotogramaSig(); const t1 = performance.now(); asentar.push(+(t1 - t0).toFixed(1)); t0 = t1; }
  MED.eventos.push({ n: 'asentar', ms: asentar });
  marca('calentado');
  calentando = false;
}

// ------------------------------------------------------------------ estado
const E = {};
let rayas = [];
function reiniciar() {
  Object.assign(E, {
    t: 0, fase: 'caida', x: D.CAE_X, y: 16, vx: 0, vy: -10, suelo: false, cara: 1, pose: 'caer2', tAnim: 0, anim: 'caer2', i: 0,
    tGolpe: -1, tAterriza: -1, control: false, oscuro: 0, lampara: 1, exterior: 0, niebla: 0, enBase: false, tBase: -1,
    tCambio: -1, mezcla: 0, giro: 0, giroS: 0, vista: 0, raya: 0, bandas: 0, sac: 0, tPaso: 0, rayaSonada: -1, pop18: -1, s18: 0,
    cam2: { cx: D.CAE_X + 1, cy: 15.4 },
  });
  rayas = [];
  MED.eventos = MED.eventos.filter((e) => !['golpe', 'cambio', 'base'].includes(e.n));
  C.libre = false; C.tLibre = 0; C.yaw = 0; C.pitch = 0;
  mundo.PISO[0].x0 = -1;
  if (plano) plano.reiniciar();
  mundo.reiniciar();
  if (heroe && heroe.listo) heroe.reiniciar(-0.5, 0, 0, Math.PI / 2);
}

// rafagas de la vista rayada: la fuerte del golpe y luego cortas cada 1-2 s, cada vez mas seguidas hacia el conducto
function programarRayas(t0) {
  rayas = [{ t: t0 + 0.12, d: 0.55, a: 1 }];
  let t = t0 + 1.3, s = 9;
  for (let n = 0; n < 40; n++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const r = s / 4294967296;
    rayas.push({ t, d: 0.07 + 0.16 * r, a: 0.2 + 0.32 * ((s >>> 8) % 100) / 100 });
    t += 0.8 + 1.4 * r;
  }
}
function rayaEn(t) {
  let g = 0, activa = null;
  for (const r of rayas) {
    if (t < r.t || t > r.t + r.d) continue;
    const k = (t - r.t) / r.d;
    const parpadeo = hash(Math.floor(t * 30), 17) < 0.75 ? 1 : 0.3;
    const v = r.a * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85 * 0.6) * parpadeo;
    if (v > g) { g = v; activa = r; }
  }
  return { g, activa };
}

// ------------------------------------------------------------------ entrada
const teclas = new Set(), dbgTeclas = new Set();
let saltoPedido = false;
addEventListener('keydown', (e) => {
  sonido.iniciar();
  if (e.repeat) return;
  teclas.add(e.code);
  if (e.code === 'Space') { saltoPedido = true; e.preventDefault(); }
  if (e.code === 'KeyR') reiniciar();
  if (e.code === 'KeyM') $('medidor').classList.toggle('oculto');
  if (e.code === 'KeyH') $('ayuda').classList.toggle('oculto');
});
addEventListener('keyup', (e) => teclas.delete(e.code));
addEventListener('blur', () => teclas.clear());
let arrastre = null;
canvas.addEventListener('pointerdown', (e) => { sonido.iniciar(); arrastre = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointerup', () => { arrastre = null; });
addEventListener('pointermove', (e) => {
  if (!arrastre) return;
  const dx = e.clientX - arrastre.x, dy = e.clientY - arrastre.y;
  arrastre = { x: e.clientX, y: e.clientY };
  if (!C.libre) return;
  C.yaw -= dx * 0.005;
  C.pitch = Math.max(-0.15, Math.min(1.1, C.pitch + dy * 0.004));
});
const pulsada = (...c) => c.some((k) => teclas.has(k) || dbgTeclas.has(k));

// el piloto automatico (?auto y __dbg.ir): anda hasta el conducto, lo cruza y recorre la base hasta la plataforma
const RUTA = [[21.0, 0], [33.6, 0], [35.6, 1.4]];
function piloto() {
  const p = { izq: false, der: false, arriba: false, abajo: false, correr: false, andar: false, saltar: false, x: 0, z: 0 };
  if (E.fase !== 'tres') { p.der = E.control; return p; }
  const hp = heroe.pos;
  if (hp.x < D.MURO_X + 0.4) { p.arriba = true; return p; }
  let obj = RUTA.find(([x, z]) => Math.hypot(x - hp.x, z - hp.z) > 0.45 && x >= hp.x - 0.5);
  if (!obj) return p;
  let dx = obj[0] - hp.x, dz = obj[1] - hp.z; const L = Math.hypot(dx, dz); dx /= L; dz /= L;
  const s = Math.sin(C.yaw), c = Math.cos(C.yaw);
  p.z = dx * -s + dz * -c;          // adelante de la camara: (-sin yaw, -cos yaw)
  p.x = dx * c + dz * -s;           // derecha: (cos yaw, -sin yaw)
  return p;
}
function leerEntrada() {
  if (MODO.auto || DBG.auto) return piloto();
  const p = {
    izq: pulsada('KeyA', 'ArrowLeft'), der: pulsada('KeyD', 'ArrowRight'), arriba: pulsada('KeyW', 'ArrowUp'), abajo: pulsada('KeyS', 'ArrowDown'),
    correr: pulsada('ShiftLeft', 'ShiftRight'), andar: pulsada('ShiftLeft', 'ShiftRight'), saltar: saltoPedido,
  };
  saltoPedido = false;
  p.x = (p.der ? 1 : 0) - (p.izq ? 1 : 0);
  p.z = (p.arriba ? 1 : 0) - (p.abajo ? 1 : 0);
  return p;
}

// ------------------------------------------------------------------ simulacion (60 Hz fijos)
const DT = 1 / 60;
// EL DESPERTAR (pedido: «cuando se caiga al principio, que se quede en el suelo un rato y luego se levante extranado»):
// tras el golpe, el aterrizaje fuerte y luego la hoja `despertar` (los fotogramas del despertar del juego, copiados con
// tools/hoja_despertar.py): se va de bruces, se queda tendido respirando, se rebulle, se incorpora y, ya de pie, mira
// arriba sin entender; luego mira atras, otra vez adelante, y vuelve el control. Cada paso: [fotograma, segundos]
const DESPIERTA = (() => {
  const t = [], tramo = (a, b, d) => { for (let i = a; i <= b; i++) t.push([i, d]); };
  tramo(1, 6, 1 / 12);                                         // de bruces, y se asienta
  for (let k = 0; k < 2; k++) { tramo(7, 12, 0.14); for (let i = 11; i >= 8; i--) t.push([i, 0.14]); }   // tendido
  t.push([7, 0.5]);                                            // quieto del todo
  tramo(13, 16, 1 / 8);                                        // se rebulle
  tramo(17, 23, 1 / 11);                                       // se incorpora
  tramo(24, 28, 1 / 6);                                        // de pie, la cabeza hacia arriba
  t.push([28, 0.7]);                                           // ... extranado
  tramo(29, 30, 1 / 8);
  let s = 0; for (const p of t) { p.push(s); s += p[1]; }
  return { pasos: t, hoja: s };
})();
const D_ATERRIZA = 3 / 16;                     // los tres primeros fotogramas del aterrizaje fuerte
const D_MIRA = [0.35, 0.8, 0.35];              // de pie: quieto, mira atras, otra vez adelante
const FIN_DESPERTAR = D_ATERRIZA + DESPIERTA.hoja + D_MIRA[0] + D_MIRA[1] + D_MIRA[2];
// la pose del despertar a tg segundos del golpe: { anim, i (fotograma fijo o null), cara }
function despertarEn(tg) {
  if (tg < D_ATERRIZA) return { anim: 'aterriza_fuerte', i: null, cara: 1 };
  let t = tg - D_ATERRIZA;
  if (t < DESPIERTA.hoja) {
    let p = DESPIERTA.pasos[0];
    for (const q of DESPIERTA.pasos) { if (q[2] > t) break; p = q; }
    return { anim: 'despertar', i: p[0], cara: 1 };
  }
  t -= DESPIERTA.hoja;
  return { anim: 'reposo2', i: null, cara: t > D_MIRA[0] && t < D_MIRA[0] + D_MIRA[1] ? -1 : 1 };
}
const S2 = D.SALA;
function poner2(p) { if (E.pose !== p) { E.pose = p; E.tAnim = 0; } }

function paso(dt, inp) {
  E.t += dt;
  if (E.fase !== 'tres') paso2D(dt, inp); else paso3D(dt, inp);
  // la vista rayada y el otro mundo que asoma
  const r = rayaEn(E.t);
  if (r.activa && E.rayaSonada !== r.activa.t) { E.rayaSonada = r.activa.t; sonido.raya(r.activa.a); }
  const xr = E.fase === 'tres' ? heroe.pos.x : E.x;
  const base = (E.fase === 'sala' || E.fase === 'tres') ? 0.1 * paso01(-1.2, D.PASO.x, xr) * (hash(Math.floor(E.t * 24), 5) < 0.3 ? 1 : 0.2) : 0;
  if (E.fase !== 'tres') {
    E.raya = Math.max(r.g, base);
    E.bandas = tresListo ? paso01(D.PASO.flashes, D.PASO.x, E.x) * (r.g > 0.05 ? 0.55 : hash(Math.floor(E.t * 20), 9) < 0.12 ? 0.3 : 0) : 0;
  } else {
    const queda = 1 - paso01(0, 0.55, E.giroS);
    E.raya = Math.max(r.g * queda, (0.55 * (1 - paso01(0, 0.4, E.t - E.tCambio)) + base) * queda);
    E.bandas = 0;
  }
  E.sac *= Math.exp(-6 * dt);
  plano.paso(dt);
  sonido.ambiente(paso01(-1.5, 2, xr), E.exterior);
}

function paso2D(dt, inp) {
  const g = E.fase === 'caida' ? 30 : 26;
  if (E.fase === 'sala' && !E.control && E.t - E.tGolpe > (MODO.despierto ? 1.05 : FIN_DESPERTAR)) E.control = true;
  // la velocidad baja al meterse en el conducto (a tientas, a la del 18 en 3D)
  let dir = 0, v = 0;
  if (E.control) {
    dir = (inp.der ? 1 : 0) - (inp.izq ? 1 : 0);
    v = mezclaN(inp.correr ? D.V2D_CORRE : D.V2D, D.V_CONDUCTO, paso01(-1.6, 0.4, E.x));
  }
  E.vx += (dir * v - E.vx) * Math.min(1, (dir ? 14 : 20) * dt);
  if (Math.abs(E.vx) < 0.02 && !dir) E.vx = 0;
  if (E.control && inp.saltar && E.suelo) { E.vy = 7.6; E.suelo = false; }
  if (!E.suelo) E.vy -= g * dt;
  let nx = E.x + E.vx * dt, ny = E.y + E.vy * dt;
  // paredes y techos: la sala, la boca del conducto (no se entra en el aire) y el techo del conducto
  if (nx < S2.x0 + 0.3) { nx = S2.x0 + 0.3; E.vx = 0; }
  const techo = nx > -0.25 ? D.CONDUCTO.alto : S2.techo;
  if (ny + 1.0 > techo && E.fase !== 'caida') {
    if (nx > -0.25 && E.x <= -0.25) { nx = -0.25; E.vx = 0; } else { ny = techo - 1.0; E.vy = Math.min(0, E.vy); }
  }
  // sin el 3D listo el 18 se queda en lo oscuro esperandolo (no deberia pasar: se carga mientras cae)
  if (!tresListo && nx > D.PASO.x - 0.01) { nx = D.PASO.x - 0.01; E.vx = 0; }
  if (ny <= 0 && E.vy <= 0) {
    if (!E.suelo) {
      if (E.fase === 'caida') {
        E.fase = 'sala'; E.tGolpe = E.t; E.sac = 1; programarRayas(E.t);
        plano.golpe(nx); sonido.golpe(1);
        MED.eventos.push({ n: 'golpe', t: E.t });
      } else { E.tAterriza = E.t; sonido.paso(false); }
    }
    ny = 0; E.vy = 0; E.suelo = true;
  }
  E.x = nx; E.y = ny;
  if (Math.abs(E.vx) > 0.1) E.cara = Math.sign(E.vx);
  // la pose (como jugador.js del juego, en pequeno)
  const lento = E.x > -1.2, tg = E.tGolpe >= 0 ? E.t - E.tGolpe : -1;
  E.iFijo = null;
  if (!E.suelo) poner2(E.vy > 0 ? 'salto' : 'caer2');
  else if (!MODO.despierto && tg >= 0 && !E.control) {
    const d = despertarEn(tg);
    poner2(d.anim); E.iFijo = d.i; E.cara = d.cara;
    // el roce de la ropa al incorporarse y los pies al quedar de pie
    if (d.anim === 'despertar' && d.i !== E.iAntes && (d.i === 13 || d.i === 18 || d.i === 23)) sonido.paso(false);
    E.iAntes = d.i;
  }
  else if (MODO.despierto && tg >= 0 && tg < 0.95) poner2('aterriza_fuerte');
  else if (E.tAterriza >= 0 && E.t - E.tAterriza < 0.16) poner2('aterriza');
  else if (Math.abs(E.vx) > 0.25) poner2(lento ? 'andar' : 'correr');
  else poner2('reposo2');
  E.tAnim += dt;
  if (E.suelo && Math.abs(E.vx) > 0.25) {
    E.tPaso += dt;
    if (E.tPaso > (lento ? 0.34 : 0.24)) { E.tPaso = 0; sonido.paso(false); }
  }
  E.oscuro = paso01(D.PASO.oscuro0, D.PASO.oscuro1, E.x);
  E.lampara = 0.75 + 0.25 * (hash(Math.floor(E.t * 12), 2) < 0.85 ? 1 : 0.2);
  camara2(dt);
  // el 18 en 3D va ya a la vez (para que asome en las rayas y para que el cambio no tenga salto)
  if (tresListo && E.x > -0.6) {
    heroe.pos.x = E.x; heroe.pos.z = 0;
    heroe.vel.set(E.vx, 0);
    heroe.paso(dt, { x: 0, z: E.vx / D.V_CONDUCTO, andar: false, saltar: false }, -Math.PI / 2);
    heroe.pos.x = E.x; heroe.pos.z = 0; heroe.raiz.position.x = E.x; heroe.raiz.position.z = 0;
    heroe.brillo.value = 0.3; heroe.exterior.value = 0;
    mundo.pasoVision(E.t, E.x, 0, false);
    ponerCamara3(0);
  }
  if (tresListo && E.x >= D.PASO.x) {
    E.fase = 'tres'; E.tCambio = E.t;
    mundo.PISO[0].x0 = D.PASO.x - 0.4;
    MED.eventos.push({ n: 'cambio', t: E.t });
  }
}

function camara2(dt) {
  const enAire = E.fase === 'caida';
  const cx = Math.max(-4.6, E.x + 1.0);
  const cy = enAire ? Math.max(2.9, E.y + 0.4) : mezclaN(2.9, 0.9, paso01(-1.5, 1.5, E.x));
  const k = enAire ? 1 : Math.min(1, 5 * dt);
  E.cam2.cx += (cx - E.cam2.cx) * Math.min(1, 6 * dt);
  E.cam2.cy += (cy - E.cam2.cy) * k;
}

function paso3D(dt, inp) {
  const hp = heroe.pos;
  const enConducto = hp.x < D.MURO_X + 0.3;
  let ent;
  if (enConducto) ent = { x: 0, z: (inp.arriba || inp.der ? 1 : 0) - (inp.abajo || inp.izq ? 1 : 0), andar: inp.andar, saltar: inp.saltar };
  else ent = { x: inp.x, z: inp.z, andar: inp.andar, saltar: inp.saltar };
  if (inp.x === undefined) ent.x = 0;
  heroe.paso(dt, ent, enConducto ? -Math.PI / 2 : C.yaw);
  E.x = hp.x; E.y = hp.y; E.vx = heroe.vel.x;
  if (Math.abs(E.vx) > 0.1) E.cara = Math.sign(E.vx);
  E.pose = Math.abs(E.vx) > 0.25 ? 'andar' : 'reposo2'; E.tAnim += dt;
  E.mezcla = paso01(0, 0.45, E.t - E.tCambio);
  E.giro = Math.max(E.giro, Math.max(0, Math.min(1, (hp.x - D.PASO.x) / (D.PASO.giro1 - D.PASO.x))));
  E.giroS += (E.giro - E.giroS) * Math.min(1, 3.2 * dt);
  if (E.giro >= 1 && E.giroS > 0.995) E.giroS = 1;
  // LA VISTA 3D, pieza a pieza: los tramos del conducto saltan de carton a 3D alrededor del 18 segun gira la camara, y
  // el 18 se infla de su sprite al .glb a mitad del giro
  const e = suave(E.giroS);
  E.vista = e;
  if (mundo.pasoVision(E.t, hp.x, e, true) > 0) sonido.pieza();
  if (E.pop18 < 0 && e >= 0.42) { E.pop18 = E.t; sonido.pieza(true); }
  const k18 = E.pop18 < 0 ? 0 : Math.min(1, (E.t - E.pop18) / 0.4);
  E.s18 = k18 <= 0 ? 0 : k18 >= 1 ? 1 : 1 + 2.70158 * (k18 - 1) ** 3 + 1.70158 * (k18 - 1) ** 2;
  heroe.fisica = E.s18 >= 1;
  E.exterior = paso01(D.MURO_X - 4, D.MURO_X + 1.2, hp.x);
  E.niebla = paso01(0.6, 1, E.giroS);
  heroe.exterior.value = paso01(D.MURO_X - 2.6, D.MURO_X + 0.8, hp.x);
  heroe.brillo.value = mezclaN(0.3, 0.035, E.exterior);
  if (!E.enBase && mundo.enBase(hp.x)) { E.enBase = true; E.tBase = E.t; MED.eventos.push({ n: 'base', t: E.t }); }
  if (heroe.suelo && heroe.vel.length() > 0.3) {
    E.tPaso += dt;
    if (E.tPaso > 0.26) { E.tPaso = 0; sonido.paso(hp.x > D.MURO_X); }
  }
  E.cam2.cx += (hp.x + 1 - E.cam2.cx) * Math.min(1, 6 * dt);
  E.cam2.cy += (0.9 - E.cam2.cy) * Math.min(1, 5 * dt);
  camara3(dt);
}

// ------------------------------------------------------------------ la camara 3D
// e = 0: el teleobjetivo de 2 grados a 258 m que ve lo mismo que el 2D (9 m de alto, de lado, centrado donde la camara
// 2D); e = 1: tercera persona detras del 18. Entre medias, travelling con zoom: el fov y el alto visible en
// logaritmo y la distancia la que los casa; el giro de lado a detras empieza un poco despues que el zoom.
function ponerCamara3(e) {
  const hp = heroe ? heroe.pos : new THREE.Vector3(E.x, 0, 0);
  const T = new THREE.Vector3(mezclaN(E.cam2.cx, hp.x, e), mezclaN(E.cam2.cy, hp.y + 0.72, e), hp.z * e);
  C.fov = Math.exp(mezclaN(Math.log(D.FOV0), Math.log(D.FOV1), e));
  const alto = Math.exp(mezclaN(Math.log(D.VISTA_H), Math.log(D.H1), e));
  C.dist = alto / 2 / Math.tan(THREE.MathUtils.degToRad(C.fov) / 2);
  C.yaw = mezclaN(0, -Math.PI / 2, paso01(0.12, 1, e));
  C.pitch = mezclaN(0, D.PITCH1, e);
  C.foco.copy(T);
  colocar();
}
function colocar() {
  const cp = Math.cos(C.pitch);
  cam3.position.set(C.foco.x + Math.sin(C.yaw) * cp * C.dist, C.foco.y + Math.sin(C.pitch) * C.dist, C.foco.z + Math.cos(C.yaw) * cp * C.dist);
  // fuera, que no se meta en el muro (salvo por el hueco del conducto) ni bajo las pasarelas
  if (C.libre && cam3.position.x < D.MURO_X + 0.25) {
    const p = cam3.position, dentro = Math.abs(p.z) < D.CONDUCTO.ancho / 2 - 0.18 && p.y > 0.15 && p.y < D.CONDUCTO.alto - 0.18;
    if (!dentro) p.x = D.MURO_X + 0.25;
  }
  cam3.lookAt(C.foco);
  cam3.fov = C.fov;
  cam3.near = Math.max(0.05, C.dist - 18);
  cam3.far = C.dist + 1200;
  cam3.updateProjectionMatrix();
}
// la camara 3D casada con la del 2D (e = 0) en (cx, cy): la de la capa del 18 en el 2D, con el mismo temblor del golpe
function camaraPlano(cam) {
  C.fov = D.FOV0; C.dist = D.VISTA_H / 2 / Math.tan(THREE.MathUtils.degToRad(D.FOV0) / 2);
  C.yaw = 0; C.pitch = 0; C.foco.set(cam.cx, cam.cy, 0);
  colocar();
}
// LA CAPA DEL 18: plano.pintar18 en el lienzo del carton y el carton en su sitio. Con la camara casada con el 2D va a la
// resolucion de la pantalla y pegada a su reticula de pixeles (cae pixel a pixel donde lo pintaria el 2D); cuando la
// camara se acerca, a mas resolucion, por saltos de 1,25 para no rehacer la textura cada fotograma
function pintarCapa18(camJ) {
  const tres = E.fase === 'tres';
  const k = Math.max(0, Math.min(1, E.s18 / 0.6));
  const alfa = tres ? 1 - k * k * (3 - 2 * k) : 1;
  if (alfa <= 0.001) { carton.poner(0, 0, 1, 1, 0, 0); return; }
  const s0 = H / D.VISTA_H, e = tres ? suave(E.giroS) : 0;
  const altoV = Math.exp(mezclaN(Math.log(D.VISTA_H), Math.log(D.H1), e));
  const nivel = Math.min(4, Math.pow(1.25, Math.max(0, Math.floor(Math.log(D.VISTA_H / altoV) / Math.log(1.25) + 1e-6))));
  const s = s0 * nivel;
  const X0 = -0.8, X1 = 0.8, Y0 = -0.4, Y1 = 1.5;               // la caja del 18 respecto a sus pies (m)
  let x0, y1;
  if (nivel === 1) {
    const px0 = Math.floor((E.x + X0 - camJ.cx) * s0 + W / 2), py0 = Math.floor(H / 2 - (E.y + Y1 - camJ.cy) * s0);
    x0 = camJ.cx + (px0 - W / 2) / s0; y1 = camJ.cy + (H / 2 - py0) / s0;
  } else { x0 = E.x + X0; y1 = E.y + Y1; }
  const w = Math.ceil((X1 - X0) * s) + 2, h = Math.ceil((Y1 - Y0) * s) + 2;
  const c = carton.lienzoDe(w, h).getContext('2d');
  plano.pintar18(c, E, (x) => (x - x0) * s, (y) => (y1 - y) * s, s);
  carton.poner(x0, y1, w / s, h / s, tres && heroe ? heroe.pos.z : 0, alfa);
}
function camara3(dt) {
  const hp = heroe.pos;
  if (E.giroS < 1) { ponerCamara3(suave(E.giroS)); return; }
  const foco = new THREE.Vector3(hp.x, hp.y + 0.72, hp.z);
  if (!C.libre && hp.x > D.MURO_X + 0.4) { C.libre = true; C.tLibre = E.t; }
  if (C.libre) {
    // al salir se abre un poco: mas lejos y mas alta, y el raton manda
    const k = Math.min(1, (E.t - C.tLibre) / 1.6);
    C.dist += (mezclaN(C.dist, 3.6, k) - C.dist) * Math.min(1, 3 * dt);
    C.fov += (50 - C.fov) * Math.min(1, 2 * dt);
    if (!arrastre) C.pitch += (0.26 - C.pitch) * Math.min(1, 0.8 * dt) * (E.t - C.tLibre < 3 ? 1 : 0);
  } else {
    C.yaw = -Math.PI / 2; C.pitch = D.PITCH1;
  }
  C.foco.lerp(foco, Math.min(1, 9 * dt));
  colocar();
}

// ------------------------------------------------------------------ dibujar
let gpuPend = [];
function dibujar(ultimo) {
  const f = { c2: 0, c3: 0, cc: 0 };
  let t0 = performance.now();
  let q = null;
  if (relojGPU && !ultimo) { q = gl.createQuery(); gl.beginQuery(relojGPU.TIME_ELAPSED_EXT, q); }
  const usa2D = E.fase !== 'tres' || E.mezcla < 1 || E.bandas > 0.001;
  const usa3D = tresListo && (E.fase === 'tres' || E.bandas > 0.001);
  // la pose del 18 (la pintan el 2D o la capa del 18)
  {
    const fr = E.pose, a = sprites.datos.anims[fr];
    let fps = null;
    if (fr === 'correr') fps = Math.max(10, 22 * Math.abs(E.vx) / 5.8);
    if (fr === 'andar') fps = Math.max(8, Math.min(16, 14 * Math.abs(E.vx) / 1.8));
    E.anim = fr; E.i = fr === 'salto' ? (E.vy > 4 ? 2 : 3) : E.iFijo != null ? E.iFijo : fotograma(sprites, fr, E.tAnim, fps);
    if (!a) { E.anim = 'reposo2'; E.i = 0; }
  }
  // desde que hay 3D el 18 es siempre el de la capa (un plano de principio a fin) y el 2D ya no lo pinta
  const capa18 = !!carton && tresListo;
  E.ver18 = !capa18;
  const sac = E.sac * 0.14;
  const camJ = { cx: E.cam2.cx + (hash(Math.floor(E.t * 60), 1) - 0.5) * sac, cy: E.cam2.cy + (hash(Math.floor(E.t * 60), 2) - 0.5) * sac };
  if (usa2D) {
    if (!MODO.sinPintar || primero) plano.dibujar(ctx, E, camJ);
    if (!MODO.sinSubir || primero) tex2D.needsUpdate = true;
    f.c2 = performance.now() - t0;
  }
  let t1 = performance.now();
  if (heroe) {
    heroe.raiz.visible = E.s18 > 0.001;
    heroe.raiz.scale.x = Math.max(0.02, E.s18);
    // el .glb va en la capa del 18 mientras dura la vista rayada (dentro del conducto, con la camara detras: nada se le
    // pone delante); luego vuelve al mundo
    const enCapa = capa18 && E.fase === 'tres' && E.giroS < 0.6;
    if (enCapa !== heroe.enCapa) { heroe.enCapa = enCapa; heroe.raiz.traverse((o) => o.layers.set(enCapa ? CAPA18 : 0)); }
  }
  if (usa3D) {
    mundo.actualizar(E.t, 1 / 60, heroe, cam3, E);
    mundo.muro.actualizar(E.t);
    cam3.layers.set(0);
    renderer.setRenderTarget(rt);
    renderer.render(escena3, cam3);
    renderer.setRenderTarget(null);
    f.c3 = performance.now() - t1;
  }
  if (capa18) {
    pintarCapa18(camJ);
    if (E.fase !== 'tres') camaraPlano(camJ);
    const auto = renderer.shadowMap.autoUpdate, colorFondo = renderer.getClearColor(new THREE.Color()), alfaFondo = renderer.getClearAlpha();
    renderer.shadowMap.autoUpdate = false;                       // la sombra ya la pinto el mundo
    renderer.setClearColor(0x000000, 0);
    cam3.layers.set(CAPA18);
    renderer.setRenderTarget(rt18);
    renderer.render(escena3, cam3);
    renderer.setRenderTarget(null);
    cam3.layers.set(0);
    renderer.setClearColor(colorFondo, alfaFondo);
    renderer.shadowMap.autoUpdate = auto;
  }
  t1 = performance.now();
  const u = comp.uniforms;
  u.uUsa2D.value = usa2D ? 1 : 0; u.uUsa3D.value = usa3D ? 1 : 0; u.uUsa18.value = capa18 ? 1 : 0; u.uProf.value = E.fase === 'tres' && usa3D ? 1 : 0;
  u.uMezcla.value = E.fase === 'tres' ? E.mezcla : 0;
  u.uRaya.value = E.raya; u.uBandas.value = E.bandas; u.uTiempo.value = E.t;
  u.uNegro.value = E.fase === 'caida' ? Math.max(0, 1 - E.t / 0.35) : 0;
  // la vineta va centrada en el 18 (en el 2D por su sitio en la pantalla; en el 3D, proyectado)
  if (E.fase === 'tres' && heroe) {
    const p = heroe.pos.clone().setY(heroe.pos.y + 0.5).project(cam3);
    u.uCentro.value.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5);
  } else {
    const s = H / D.VISTA_H;
    u.uCentro.value.set(((E.x - E.cam2.cx) * s + W / 2) / W, 1 - (H / 2 - (E.y + 0.5 - E.cam2.cy) * s) / H);
  }
  u.uVineta.value = mezclaN(1, 0.75, E.exterior);
  renderer.render(compEscena, compCam);
  f.cc = performance.now() - t1;
  if (q) { gl.endQuery(relojGPU.TIME_ELAPSED_EXT); gpuPend.push({ q, foto: null }); }
  return { ...f, q };
}
function leerGPU() {
  if (!relojGPU) return;
  const quedan = [];
  for (const p of gpuPend) {
    if (!p.foto) { quedan.push(p); continue; }
    if (gl.getQueryParameter(p.q, gl.QUERY_RESULT_AVAILABLE)) {
      if (!gl.getParameter(relojGPU.GPU_DISJOINT_EXT)) p.foto.gpu = gl.getQueryParameter(p.q, gl.QUERY_RESULT) / 1e6;
      gl.deleteQuery(p.q);
    } else quedan.push(p);
  }
  gpuPend = quedan;
}

// ------------------------------------------------------------------ bucle
const DBG = { congelado: false, auto: false };
let acumulado = 0, tAnterior = null, primero = true;
function etiqueta() {
  if (calentando) return E.fase === 'caida' ? 'caida+calentar' : 'sala+calentar';
  if (E.tCambio >= 0 && Math.abs(E.t - E.tCambio) < 1) return 'cambio';
  if (E.fase === 'caida') return 'caida';
  if (E.fase === 'sala') return E.x > D.PASO.oscuro0 ? 'oscuro' : 'sala';
  return E.enBase ? 'base' : 'conducto';
}
function bucle(ahora) {
  requestAnimationFrame(bucle);
  if (DBG.congelado) { tAnterior = ahora; return; }
  const dtr = tAnterior === null ? 16.7 : ahora - tAnterior;
  tAnterior = ahora;
  const t0 = performance.now();
  acumulado += Math.min(0.1, dtr / 1000);
  let n = 0;
  while (acumulado >= DT && n < 5) { paso(DT, leerEntrada()); acumulado -= DT; n++; }
  if (n === 5) acumulado = 0;
  const f = dibujar();
  const foto = { t: Math.round(E.t * 1000) / 1000, dt: Math.round(dtr * 100) / 100, cpu: Math.round((performance.now() - t0) * 100) / 100,
    c2: Math.round(f.c2 * 100) / 100, c3: Math.round(f.c3 * 100) / 100, cc: Math.round(f.cc * 100) / 100, fase: etiqueta(), gpu: null };
  if (f.q) gpuPend[gpuPend.length - 1].foto = foto;
  MED.fotos.push(foto);
  if (MED.fotos.length > 8000) MED.fotos.shift();
  leerGPU();
  if (primero) { primero = false; marca('primer2D'); }
  hud();
}

function hud() {
  let txt = '';
  if (E.fase === 'sala' && E.control) txt = '<kbd>A</kbd><kbd>D</kbd> moverse &nbsp; <kbd>Mayús</kbd> correr &nbsp; <kbd>Espacio</kbd> saltar';
  else if (E.fase === 'tres' && !E.enBase) txt = '<kbd>W</kbd> o <kbd>D</kbd> avanzar';
  else if (E.enBase) txt = '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> moverse &nbsp; <kbd>Mayús</kbd> andar &nbsp; <kbd>Espacio</kbd> saltar &nbsp; arrastrar: cámara';
  if (hud.txt !== txt) { hud.txt = txt; $('teclas').innerHTML = txt; }
  $('relleno').classList.toggle('visible', E.enBase && E.t - E.tBase > 2.5);
  pintarMedidor();
}
const med = $('medidor'), mc = med.getContext('2d');
function pintarMedidor() {
  if (med.classList.contains('oculto')) return;
  const w = med.width, h = med.height, fs = MED.fotos.slice(-240);
  mc.clearRect(0, 0, w, h);
  mc.fillStyle = 'rgba(8,10,14,.7)'; mc.fillRect(0, 0, w, h);
  const y = (ms) => h - 14 - ms / 40 * (h - 24);
  mc.strokeStyle = 'rgba(255,255,255,.18)'; mc.beginPath(); mc.moveTo(0, y(16.7)); mc.lineTo(w, y(16.7)); mc.moveTo(0, y(33.3)); mc.lineTo(w, y(33.3)); mc.stroke();
  fs.forEach((f, i) => {
    const x = i * (w / 240);
    mc.fillStyle = f.fase === 'cambio' ? '#ffd9a0' : '#9fb6cc'; mc.fillRect(x, y(f.dt), 1.5, h - 14 - y(f.dt));
    mc.fillStyle = '#ffffff'; mc.fillRect(x, y(f.cpu), 1.5, 1.5);
  });
  const ul = fs[fs.length - 1] || {};
  mc.fillStyle = '#e8eef4'; mc.font = '11px Bahnschrift, sans-serif';
  mc.fillText(`fotograma ${ul.dt?.toFixed(1)} ms · cpu ${ul.cpu?.toFixed(1)} (2D ${ul.c2?.toFixed(1)} 3D ${ul.c3?.toFixed(1)}) · ${ul.fase}`, 6, h - 3);
}

// ------------------------------------------------------------------ medidas
function cuantil(a, q) { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.min(s.length - 1, Math.floor(q * s.length))] * 100) / 100; }
function resumen(fs) {
  const dt = fs.map((f) => f.dt), cpu = fs.map((f) => f.cpu), gpu = fs.map((f) => f.gpu).filter((v) => v != null);
  return {
    n: fs.length, dt: { mediana: cuantil(dt, 0.5), p95: cuantil(dt, 0.95), p99: cuantil(dt, 0.99), max: cuantil(dt, 1) },
    cpu: { mediana: cuantil(cpu, 0.5), p95: cuantil(cpu, 0.95), max: cuantil(cpu, 1) },
    c2: cuantil(fs.map((f) => f.c2), 0.5), c3: cuantil(fs.map((f) => f.c3), 0.5),
    gpu: gpu.length ? { mediana: cuantil(gpu, 0.5), max: cuantil(gpu, 1) } : null,
    sobre25ms: dt.filter((v) => v > 25).length,
  };
}
function memoriaGPU() {
  let tex = 0, geo = 0;
  const vistos = new Set();
  escena3.traverse((o) => {
    if (o.geometry && !vistos.has(o.geometry)) {
      vistos.add(o.geometry);
      for (const a of Object.values(o.geometry.attributes)) geo += a.array.byteLength;
      if (o.geometry.index) geo += o.geometry.index.array.byteLength;
    }
    for (const m of [].concat(o.material || [])) for (const k of ['map', 'emissiveMap', 'alphaMap']) {
      const t = m[k]; if (!t || vistos.has(t) || !t.image) continue; vistos.add(t);
      const w = t.image.width || 0, h = t.image.height || 0;
      tex += w * h * 4 * (t.generateMipmaps !== false ? 4 / 3 : 1);
    }
  });
  const rtB = W * H * 8 * 4 + W * H * 4 * 4 + W * H * 8;   // MSAA x4 color y profundidad + la resuelta
  return { texturasMB: +(tex / 1048576).toFixed(1), geometriaMB: +(geo / 1048576).toFixed(1), renderTargetMB: +(rtB / 1048576).toFixed(1),
    sombraMB: +(2048 * 2048 * 4 / 1048576).toFixed(1), lienzo2DMB: +(W * H * 4 / 1048576).toFixed(1), info: { ...renderer.info.memory } };
}
function medidas() {
  const fs = MED.fotos;
  const porFase = {};
  for (const f of fs) (porFase[f.fase] ||= []).push(f);
  const r = {};
  for (const [k, v] of Object.entries(porFase)) r[k] = resumen(v);
  const ev = MED.eventos.find((e) => e.n === 'cambio');
  let alrededor = null;
  if (ev) alrededor = fs.filter((f) => Math.abs(f.t - ev.t) < 0.6).map((f) => ({ t: +(f.t - ev.t).toFixed(3), dt: f.dt, cpu: f.cpu, c2: f.c2, c3: f.c3, gpu: f.gpu }));
  return { modo: MODO, musgo: { tris: mundo.musgo.tris, trisCapa: mundo.musgo.trisCapa, MB: mundo.musgo.MB, mechones: mundo.musgo.mechones, gotas: mundo.musgo.gotas, hojas: mundo.musgo.hojas, almohadillas: mundo.musgo.almohadillas, colgantes: mundo.musgo.colgantes, reparto: mundo.musgo.reparto }, dano: mundo.muro.dano, resolucion: [W, H], gpuReloj: !!relojGPU, marcas: MED.marcas, memoriaJS: MED.mem, memoriaGPU: memoriaGPU(), porFase: r, alrededorDelCambio: alrededor, eventos: MED.eventos,
    inicio: MED.fotos.slice(0, 60), picos: fs.filter((f) => f.dt > 25 || f.cpu > 20 || (f.gpu || 0) > 20),
    lentos: fs.filter((f) => f.dt > 9 || f.cpu > 6).map((f) => ({ t: f.t, fase: f.fase, dt: f.dt, cpu: f.cpu, c2: f.c2, c3: f.c3, gpu: f.gpu })) };
}

// ------------------------------------------------------------------ arranque
encajar();
addEventListener('resize', encajar);
reiniciar();
const pSprites = cargarSprites().then((s) => { sprites = s; plano = crearPlano(s); plano.redimensionar(W, H); plano.reiniciar(); marca('sprites'); });
let p3 = null;
if (!MODO.tarde && !MODO.solo2D) p3 = empezarHeroe();
renderer.compile(compEscena, compCam);
await pSprites;
if (MODO.precarga) await p3;
// el 2D tambien se calienta: la PRIMERA vez que el lienzo pinta cada hoja de sprites la sube a la GPU y ese fotograma
// costaba 25-55 ms de CPU (al levantarse, al echar a andar, al pasar de correr a andar). Se pinta todo una vez tras la
// pantalla de carga, que nadie lo ve
for (const im of Object.values(sprites.hojas)) ctx.drawImage(im, 0, 0);
primero = false;
dibujar(true);
// y ESPERAR a que la tarjeta lo digiera: el lienzo 2D sube las hojas en diferido (el raster de Chrome las vacia en el
// GPU cuando three lee el lienzo) y, sin esperar, el tercer fotograma del juego se paraba 40-60 ms con la CPU libre
// (traza: RasterDecoderImpl::DoEndRasterCHROMIUM::Flush de 64 ms en el hilo del GPU)
for (let i = 0; i < 6; i++) { await new Promise((r) => requestAnimationFrame(r)); dibujar(true); }
primero = true;
$('carga').remove();
if (MODO.tarde) setTimeout(() => { p3 = empezarHeroe(); }, 2500);
requestAnimationFrame(bucle);

// ------------------------------------------------------------------ para probar desde fuera
window.__dbg = {
  E, C, MED, D, mundo, escena3, cam3, renderer, get heroe() { return heroe; }, get listo() { return tresListo; },
  medidas,
  congelar(v = true) { DBG.congelado = v; },
  auto(v = true) { DBG.auto = v; },
  pulsar(...c) { c.forEach((k) => dbgTeclas.add(k)); },
  soltar(...c) { (c.length ? c : [...dbgTeclas]).forEach((k) => dbgTeclas.delete(k)); },
  // salta al segundo s con el piloto automatico (simula en pasos de 1/60 s sin pintar) y pinta ese fotograma
  async ir(s) {
    if (s > 3 && !tresListo) await p3;
    while (!tresListo) await new Promise((r) => setTimeout(r, 50));
    reiniciar();
    const antes = DBG.auto; DBG.auto = true;
    const n = Math.round(s / DT);
    for (let i = 0; i < n; i++) paso(DT, piloto());
    DBG.auto = antes;
    acumulado = 0;
    dibujar(true);
    return { t: +E.t.toFixed(2), fase: E.fase, x: +E.x.toFixed(2), giro: +E.giroS.toFixed(3), base: E.enBase };
  },
  avanzar(s) { const n = Math.round(s / DT); for (let i = 0; i < n; i++) paso(DT, leerEntrada()); dibujar(true); return { t: +E.t.toFixed(2), fase: E.fase }; },
  // la camara en un sitio cualquiera (para fotografiar un detalle): mira a (x, y, z) desde yaw, pitch y dist, sin simular
  vista(x, y, z, yaw, pitch, dist, fov = 50) { C.foco.set(x, y, z); C.yaw = yaw; C.pitch = pitch; C.dist = dist; C.fov = fov; colocar(); dibujar(true); return cam3.position.toArray().map((v) => +v.toFixed(2)); },
  async guardar(nombre) { await fetch('/__medidas/' + nombre, { method: 'PUT', body: JSON.stringify(medidas(), null, 1) }); return nombre; },
};
