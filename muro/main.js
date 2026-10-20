// La base de refugiados: el 18 camina hacia la derecha y, al entrar en la zona, la camara se aleja y
// sube y el muro sale de la niebla con su cartel. Es 2D (sprites y planos pintados) pero con
// profundidad de verdad: una camara estenopeica (x, y, z, campo de vision y desplazamiento de lente)
// proyecta cada plano a su z, asi la parallaje, los costados de los contrafuertes y el suelo que se aleja
// salen de la misma geometria. La cinematica acaba cuando el 18 baja la cabeza y lo asimila.
import * as T from './texturas.js';
import * as S from './sonido.js';

const q = new URLSearchParams(location.search);
const LANG = q.get('lang') === 'en' ? 'en' : 'es';
const lienzo = document.getElementById('lienzo');
const ctx = lienzo.getContext('2d');
let W = 0, H = 0, DPR = 1;

function medir() {
  DPR = Math.min(1.5, window.devicePixelRatio || 1);
  W = Math.round(innerWidth * DPR);
  H = Math.round(innerHeight * DPR);
  lienzo.width = W;
  lienzo.height = H;
  vineta = null;
}
addEventListener('resize', medir);

// ------------------------------------------------------------------ recursos
const R = {};
async function cargar() {
  const base = 'img/';
  const datos = await (await fetch(base + 'sujeto.json')).json();
  const hojas = {};
  await Promise.all(Object.keys(datos.anims).map((n) => new Promise((ok, mal) => {
    const im = new Image();
    im.onload = () => { hojas[n] = im; ok(); };
    im.onerror = mal;
    im.src = base + n + '.webp';
  })));
  R.sujeto = { datos, hojas };
  R.muro = T.hacerMuro(LANG);
  R.porton = T.hacerPorton();
  R.fondoBocados = T.hacerFondoBocados(R.muro.bocados);
  R.contrafuertes = T.CONTRAFUERTES.map((_, i) => T.hacerContrafuerte(i));
  R.cartel = T.hacerLetras(LANG);
  R.celosia = T.hacerCelosia(R.cartel.x0, R.cartel.x1);
  R.suelo = T.hacerSuelo();
  R.atrezo = T.hacerAtrezo();
  R.fogAtrezo = {};
  for (const k in R.atrezo) R.fogAtrezo[k] = T.silueta(R.atrezo[k]);
  R.primer = T.hacerPrimerPlano();
  R.nubes = [T.hacerNubes(11, true), T.hacerNubes(23, false)];
  R.grua = T.hacerGrua();
  R.mancha = manchaSuave();
  R.grano = granoPantalla();
}

function manchaSuave() {
  const c = T.lienzo(256, 128);
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 64, 0, 128, 64, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.save();
  x.scale(1, 0.5);
  x.fillRect(0, 0, 256, 256);
  x.restore();
  return c;
}
function granoPantalla() {
  const c = T.lienzo(256, 256);
  const x = c.getContext('2d');
  const d = x.createImageData(256, 256);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = Math.random() * 255;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  return c;
}

// ------------------------------------------------------------------ camara
// cb = cabeceo en radianes (positivo mira hacia abajo); k = desplazamiento de lente
const JUEGO = (p) => ({ x: p.x + 1.6, y: 1.6, z: p.z - 11, fov: 40, k: 0.16, cb: 0 });
// plano general contrapicado: el 18 diminuto abajo y el canto del muro con cielo encima
const ANCHO = { x: 36, y: 4.0, z: -30, fov: 60, k: 0.41, cb: 0 };
// detras de el, bajo, mientras anda hacia el muro
const SEGUIR = (p) => ({ x: p.x - 0.8, y: 2.5, z: p.z - 7.5, fov: 52, k: 0.06, cb: 0.1 });
// desde arriba y detras: el 18 abajo, el suelo por delante y el cartel arriba del todo
const PICADO = (p) => ({ x: p.x + 1.2, y: 18, z: p.z - 16, fov: 64, k: 0, cb: 0.384 });
const cam = { x: 0, y: 1.6, z: -11, fov: 40, k: 0.16, cb: 0 };
let F = 1, SH = 0, sx0 = 0, sy0 = 0, CS = 1, SN = 0; // focal, lente, temblor en px y cabeceo

const suave = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const mezcla = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, fov: a.fov + (b.fov - a.fov) * k, k: a.k + (b.k - a.k) * k, cb: a.cb + (b.cb - a.cb) * k });
const tramo = (t, a, b) => suave((t - a) / (b - a));

function prepararCamara() {
  F = (H / 2) / Math.tan((cam.fov * Math.PI) / 360);
  SH = cam.k * H / 2;
  CS = Math.cos(cam.cb);
  SN = Math.sin(cam.cb);
}
// camara que solo cabecea: profundidad y altura en pantalla salen de girar (y, z) alrededor de x
function proy(x, y, z) {
  const ry = y - cam.y, rz = z - cam.z;
  const d = rz * CS - ry * SN;
  const v = ry * CS + rz * SN;
  const s = F / d;
  return [W / 2 + (x - cam.x) * s + sx0, H / 2 + SH - v * s + sy0, s, d];
}
const horizonte = () => H / 2 + SH + sy0 - F * Math.tan(cam.cb);
const niebla = (d) => 1 - Math.exp(-E.densidad * Math.max(0, d));

// Un plano de frente. Con la camara recta solo se escala y se desplaza. Al cabecear, cada FILA del plano
// sigue a una profundidad unica (la profundidad no depende de x), asi que se dibuja por franjas
// horizontales, cada una con su escala: la convergencia vertical sale exacta.
function plano(img, fog, x0, y0, wm, hm, z, alfa = 1) {
  let n = 1;
  if (Math.abs(cam.cb) > 0.002) {
    const a = proy(x0, y0, z), b = proy(x0, y0 + hm, z);
    if (a[3] < 0.3 && b[3] < 0.3) return;
    n = Math.max(1, Math.min(140, Math.round(Math.abs(a[1] - b[1]) / (5 * DPR))));
  }
  const cuant = img.height / n;
  for (let k = 0; k < n; k++) {
    const ya = y0 + (hm * k) / n, yb = y0 + (hm * (k + 1)) / n;
    const pm = proy(x0, (ya + yb) / 2, z);
    if (pm[3] < 0.3) continue;
    const s = pm[2];
    const sx = pm[0], sw = wm * s;
    const syT = n === 1 ? pm[1] - (hm / 2) * s : proy(x0, yb, z)[1];
    const syB = n === 1 ? pm[1] + (hm / 2) * s : proy(x0, ya, z)[1] + 0.6;
    const sh = syB - syT;
    if (sh <= 0) continue;
    const ix0 = Math.max(sx, 0), iy0 = Math.max(syT, 0), ix1 = Math.min(sx + sw, W), iy1 = Math.min(syB, H);
    if (ix1 <= ix0 || iy1 <= iy0) continue;
    const kx = img.width / sw, ky = cuant / sh;
    const fy = img.height - cuant * (k + 1);
    const a = [(ix0 - sx) * kx, fy + (iy0 - syT) * ky, (ix1 - ix0) * kx, Math.min(cuant, (iy1 - iy0) * ky), ix0, iy0, ix1 - ix0, iy1 - iy0];
    ctx.globalAlpha = alfa;
    ctx.drawImage(img, ...a);
    const nb = niebla(pm[3]);
    if (fog && nb > 0.01) {
      ctx.globalAlpha = alfa * nb;
      ctx.drawImage(fog, ...a);
    }
  }
  ctx.globalAlpha = 1;
}
const pieza = (p, z = p.z, alfa = 1) => plano(p.img, p.fog, p.x0, p.y0, p.w, p.h, z, alfa);

function colorNiebla(rgb, d) {
  const n = niebla(d);
  const f = [0x56, 0x61, 0x6b];
  return `rgb(${Math.round(rgb[0] + (f[0] - rgb[0]) * n)},${Math.round(rgb[1] + (f[1] - rgb[1]) * n)},${Math.round(rgb[2] + (f[2] - rgb[2]) * n)})`;
}
function poligono(pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

// ------------------------------------------------------------------ estado
const ZONA = 28;
const E = {};
const FOCOS = T.CONTRAFUERTES.map((x, i) => ({ x, enciende: [5.1, 3.1, 3.45, 3.8, 4.15, 4.5, 5.4, 5.7][i], falla: x === 86, luz: 0, z: 26.6, y: 39.4 }));
const FOCOS_CARTEL = [0.1, 0.37, 0.63, 0.9];

function reiniciar() {
  Object.assign(E, {
    t: 0, modo: 'juego', tc: 0, impacto: null, eventos: new Set(), silencio: false,
    p: { x: 6, z: 0, vx: 0, vz: 0, cara: 1, vista: 'perfil', andar: 0, anim: 'reposo2', tAnim: 0, frenando: false, ultimoPaso: -1 },
    densidad: 0.04, bruma: 0.75, barras: 0, luzCartel: 0, temblor: 0, movido: false, fin: 0,
    letra: null, parts: [], pajaros: [], humo: [],
  });
  for (const f of FOCOS) f.luz = 0;
  const L = R.cartel.letras.find((l) => l.cae);
  E.letra = { L, estado: 'fija', th: 0, w: 0, x: L.x, y: L.y, z: L.z, vx: 0, vy: 0, vz: 0, ox: 0, oy: 0, rebotes: 0, objetivo: 0 };
  // cuervos posados en la albardilla
  for (let i = 0; i < 18; i++) E.pajaros.push({ x: 16 + Math.random() * 56, y: 34.95, z: 29.75, vx: 0, vy: 0, vz: 0, vuela: false, fase: Math.random() * 6, lado: Math.random() < 0.5 ? 1 : -1, salida: 0 });
  // humo de las hogueras de dentro: precalentado
  for (let i = 0; i < 1800; i++) humoPaso(1 / 30);
  Object.assign(cam, JUEGO(E.p));
}

// bancos de bruma (no se reinician)
const BRUMA = [];
for (let i = 0; i < 14; i++) BRUMA.push({ x: -20 + Math.random() * 110, y: 0.8 + Math.random() * 5, z: 4 + Math.random() * 25, rx: 8 + Math.random() * 16, ry: 1.6 + Math.random() * 3.5, v: 0.25 + Math.random() * 0.5 });
const MOTAS = [];
for (let i = 0; i < 90; i++) MOTAS.push({ x: Math.random() * 60, y: Math.random() * 10, z: -3 + Math.random() * 30, f: Math.random() * 6 });
const MATAS = [];
for (let i = 0; i < 170; i++) { const z = 0.8 + Math.pow(Math.random(), 1.4) * 28; const x = -10 + Math.random() * 100; if (z > 20 && x > 34 && x < 46) continue; MATAS.push({ x, z, h: 0.18 + Math.random() * 0.45, n: 3 + Math.floor(Math.random() * 4), s: Math.random() * 100 }); }
const ATREZO = [
  ['barrera', 30.5, 24], ['barrera', 49, 23.4], ['barrera', 54.5, 25.6], ['barrera', 13, 21],
  ['erizo', 8, 15], ['erizo', 22, 12.5], ['erizo', 57, 14], ['erizo', 67, 18.5], ['erizo', -6, 19],
  ['coche', 61, 9.5], ['sacos', 32.6, 27.6], ['sacos', 47.4, 27.6],
  ['escombro', 43, 29.1], ['escombro', 58, 29.2], ['escombro', 21, 29.3], ['escombro', -12, 29.3], ['escombro', 73.5, 29.1], ['escombro', 97, 29.3],
  ['maletas', 37.2, 27.2], ['arbol', -3, 6.5], ['arbol', 76, 13], ['farola', 25, 4.6],
];
const CHARCOS = [[39, 14, 2.2, 1.4], [42.5, 22, 1.6, 1.1], [33, 8, 1.2, 0.7], [16, 5, 1.8, 0.9], [55, 18, 2.4, 1.2]];

function humoPaso(dt) {
  if (Math.random() < dt * 9) {
    const fuentes = [[24, 74], [31, 88], [57, 70], [66, 92], [8, 82]];
    const [x, z] = fuentes[Math.floor(Math.random() * fuentes.length)];
    E.humo.push({ x: x + (Math.random() - 0.5) * 2, y: 22, z: z + (Math.random() - 0.5) * 3, r: 1.2, vida: 0, max: 14 + Math.random() * 8 });
  }
  for (const h of E.humo) { h.vida += dt; h.y += dt * (1.6 - h.vida * 0.03); h.x += dt * (0.7 + h.vida * 0.06); h.r += dt * 0.55; }
  E.humo = E.humo.filter((h) => h.vida < h.max);
}

// ------------------------------------------------------------------ entrada
const teclas = new Set();
addEventListener('keydown', (e) => {
  S.iniciarSonido();
  teclas.add(e.code);
  if (e.code === 'KeyR') { reiniciar(); }
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => teclas.delete(e.code));
const dedos = new Map();
function tactil() {
  teclas.delete('ArrowLeft'); teclas.delete('ArrowRight'); teclas.delete('ShiftLeft');
  for (const x of dedos.values()) teclas.add(x < innerWidth / 2 ? 'ArrowLeft' : 'ArrowRight');
  if (dedos.size > 1) teclas.add('ShiftLeft');
}
addEventListener('pointerdown', (e) => { S.iniciarSonido(); if (e.pointerType === 'touch') { dedos.set(e.pointerId, e.clientX); tactil(); } });
addEventListener('pointermove', (e) => { if (dedos.has(e.pointerId)) { dedos.set(e.pointerId, e.clientX); tactil(); } });
for (const ev of ['pointerup', 'pointercancel']) addEventListener(ev, (e) => { if (dedos.delete(e.pointerId)) tactil(); });
const izq = () => teclas.has('ArrowLeft') || teclas.has('KeyA');
const der = () => teclas.has('ArrowRight') || teclas.has('KeyD');
const corre = () => teclas.has('ShiftLeft') || teclas.has('ShiftRight');

// ------------------------------------------------------------------ el 18
const sonar = (nombre, f) => { if (!E.eventos.has(nombre)) { E.eventos.add(nombre); if (!E.silencio) f(); } };

function ponerAnim(p, a) { if (p.anim !== a) { p.anim = a; p.tAnim = 0; } }

// La hoja que toca: de perfil (las del juego) o, si va hacia el fondo o hacia la camara, la de espaldas o de
// frente renderizada aposta (tools/sprites_espalda.py). De espaldas hay dos alturas: la de seguirle (15
// grados) y la de picado (40), segun desde donde le mire la camara.
function hoja(p) {
  const A = R.sujeto.datos.anims;
  if (p.vista === 'perfil') return A[p.anim] ? p.anim : 'reposo2';
  const base = p.anim === 'correr' ? 'andar' : p.anim;
  let alt = 'frente';
  if (p.vista === 'espalda') alt = Math.atan2(cam.y - 0.5, p.z - cam.z) > 0.55 ? 'picado' : 'espalda';
  for (const n of [`${base}_${alt}`, `reposo2_${alt}`, `${base}_espalda`]) if (A[n]) return n;
  return A[p.anim] ? p.anim : 'reposo2';
}

function fotograma(p) {
  const n = hoja(p);
  const a = R.sujeto.datos.anims[n];
  // corriendo hacia el fondo no hay hoja propia: la de andar, mas deprisa
  const t = p.tAnim * (p.anim === 'correr' && n !== 'correr' ? 1.8 : 1);
  const i = a.bucle ? Math.floor(t * a.fps) % a.fotogramas : Math.min(a.fotogramas - 1, Math.floor(t * a.fps));
  return [a, i, n];
}

const arriba = () => teclas.has('ArrowUp') || teclas.has('KeyW');
const abajo = () => teclas.has('ArrowDown') || teclas.has('KeyS');
const FONDO = [0, 21.5]; // por donde se puede andar en profundidad (detras, barreras y sacos)

function moverJugador(dt) {
  const p = E.p;
  const qx = (der() ? 1 : 0) - (izq() ? 1 : 0), qz = (arriba() ? 1 : 0) - (abajo() ? 1 : 0);
  const q = Math.hypot(qx, qz);
  const vmax = corre() ? 4.2 : 1.7;
  const ox = q ? (qx / q) * vmax : 0, oz = q ? (qz / q) * vmax * 0.85 : 0;
  const k = 1 - Math.exp(-dt * (q ? 7 : 9));
  p.vx += (ox - p.vx) * k;
  p.vz += (oz - p.vz) * k;
  if (q) E.movido = true;
  if (qx) p.cara = qx;
  p.x = Math.max(-1, Math.min(90, p.x + p.vx * dt));
  p.z = Math.max(FONDO[0], Math.min(FONDO[1], p.z + p.vz * dt));
  const v = Math.hypot(p.vx, p.vz);
  if (v > 0.25) p.vista = Math.abs(p.vx) >= Math.abs(p.vz) * 0.8 ? 'perfil' : p.vz > 0 ? 'espalda' : 'frente';
  if (p.frenando) {
    if (p.tAnim > 0.24 || q) p.frenando = false;
  } else if (!q && p.anim === 'correr' && v > 2.6 && p.vista === 'perfil') { ponerAnim(p, 'frenar'); p.frenando = true; }
  if (!p.frenando) ponerAnim(p, v > 2.6 ? 'correr' : v > 0.25 ? 'andar' : 'reposo2');
  pasos(p);
}

function pasos(p) {
  if (p.anim !== 'andar' && p.anim !== 'correr') return;
  const [, i] = fotograma(p);
  if (i === p.ultimoPaso) return;
  p.ultimoPaso = i;
  if ((i === 0 || i === 6) && !E.silencio) S.paso(p.anim === 'correr' ? 0.9 : 0.5);
}

// ------------------------------------------------------------------ la cinematica
// Se para, mira arriba y echa a andar hacia el muro (hacia el fondo). La camara se aleja y sube para el
// plano general, baja detras de el mientras anda y sube a un picado unos metros antes de que caiga la F,
// que se estrella por delante de el.
const T_ANDAR = 2.6, T_TORNILLO = 13.4, T_CAE = 15.1;
const DESTINO = { x: 37.2, z: 20.5 };
const VEL_ANDAR = 2.1;

// el picado baja un poco mientras la letra cuelga y cae
function picado(p, tc) {
  const c = PICADO(p);
  c.y -= 1.2 * tramo(Math.min(tc, E.impacto ?? 99), 14.2, 17.5);
  return c;
}

function cinematica(dt) {
  const p = E.p, tc = (E.tc += dt);
  if (tc < 0.8) {
    // frenar en seco
    p.vx *= Math.exp(-dt * 6);
    p.vz *= Math.exp(-dt * 6);
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    const v = Math.hypot(p.vx, p.vz);
    if (p.anim === 'correr' && v > 2.4 && p.vista === 'perfil') { ponerAnim(p, 'frenar'); p.frenando = true; }
    else if (p.anim === 'frenar' && p.tAnim > 0.24) ponerAnim(p, 'reposo2');
    else if ((p.anim === 'andar' || p.anim === 'correr') && v < 0.35) ponerAnim(p, 'reposo2');
    pasos(p);
  } else if (tc < T_ANDAR) {
    // de perfil: alza la vista hacia el muro que sale de la niebla
    p.vx = p.vz = 0;
    p.vista = 'perfil';
    p.cara = 1;
    if (p.anim !== 'alzar' && p.anim !== 'mirar_arriba') ponerAnim(p, 'alzar');
    if (p.anim === 'alzar' && p.tAnim >= 0.8) ponerAnim(p, 'mirar_arriba');
  } else if (tc < T_TORNILLO) {
    // echa a andar hacia la puerta: de espaldas, hacia el fondo
    p.vista = 'espalda';
    const dx = DESTINO.x - p.x, dz = DESTINO.z - p.z, dist = Math.hypot(dx, dz);
    p.andar = Math.min(VEL_ANDAR, (p.andar || 0) + dt * 2.2, dist * 2);
    if (dist > 0.05) { p.x += (dx / dist) * p.andar * dt; p.z += (dz / dist) * p.andar * dt; }
    ponerAnim(p, p.andar > 0.3 ? 'andar' : 'reposo2');
    pasos(p);
  } else if (E.impacto === null || tc < E.impacto) {
    // el chasquido del tornillo le para: frena y mira arriba (sigue de espaldas)
    const dx = DESTINO.x - p.x, dz = DESTINO.z - p.z, dist = Math.hypot(dx, dz) || 1;
    p.andar = (p.andar || 0) * Math.exp(-dt * 5);
    p.x += (dx / dist) * p.andar * dt;
    p.z += (dz / dist) * p.andar * dt;
    if (p.andar > 0.3) { ponerAnim(p, 'andar'); pasos(p); }
    else {
      if (p.anim !== 'alzar' && p.anim !== 'mirar_arriba') ponerAnim(p, 'alzar');
      if (p.anim === 'alzar' && p.tAnim >= 0.8) ponerAnim(p, 'mirar_arriba');
    }
  } else {
    const ti = tc - E.impacto;
    if (ti < 0.32) ponerAnim(p, 'respingo');
    else if (ti < 0.9) { if (p.anim !== 'mirar_arriba') { p.anim = 'mirar_arriba'; p.tAnim = 0; } }
    else if (ti < 0.9 + 12 / 9) { ponerAnim(p, 'bajar'); sonar('respiro', S.respiro); }
    else ponerAnim(p, 'reposo2');
  }

  E.barras = Math.min(1, E.barras + dt / 0.7);
  // camara
  const base = JUEGO(p);
  const encuadre = (P) => {
    const f = (H / 2) / Math.tan((P.fov * Math.PI) / 360);
    return { ...P, x: Math.min(P.x, p.x + (0.72 * (W / 2) * (p.z - P.z)) / f) };
  };
  const ANCHO_ = encuadre(ANCHO);
  let c;
  if (tc < 0.8) c = base;
  else if (tc < 6.2) c = mezcla(base, ANCHO_, tramo(tc, 0.8, 6.2));
  else if (tc < 12.3) c = mezcla(ANCHO_, SEGUIR(p), tramo(tc, 6.2, 10.4));
  else if (E.impacto === null || tc < E.impacto + 1.1) {
    c = mezcla(SEGUIR(p), picado(p, tc), tramo(tc, 12.3, 14.2));
  } else c = mezcla(picado(p, tc), base, tramo(tc, E.impacto + 1.1, E.impacto + 3.9));
  const pulso = Math.min(1, tc / 2) * (E.impacto === null ? 1 : Math.max(0, 1 - (tc - E.impacto - 1.1) / 2.8));
  c.x += Math.sin(tc * 0.7) * 0.06 * pulso;
  c.y += Math.sin(tc * 0.53 + 1) * 0.05 * pulso;
  Object.assign(cam, c);

  // niebla y bruma que se levantan
  const k = tramo(tc, 1.2, 8.5);
  E.densidad = 0.04 + (0.007 - 0.04) * k;
  E.bruma = 0.75 + (0.22 - 0.75) * k;
  if (E.impacto !== null) {
    const kv = tramo(tc, E.impacto + 1.1, E.impacto + 3.9);
    E.densidad = 0.007 + (0.017 - 0.007) * kv;
    E.bruma = 0.22 + (0.38 - 0.22) * kv;
  }
  sonar('dron', () => S.dronA(0.55, 5));

  // focos del muro, uno tras otro; los cuervos se espantan con el primero
  for (const f of FOCOS) {
    if (tc >= f.enciende) {
      sonar('foco' + f.x, S.clac);
      const t = tc - f.enciende;
      let luz = t < 0.25 ? (Math.random() < 0.5 ? 1 : 0.15) : Math.min(1, 0.6 + t * 0.8);
      if (f.falla) luz = t < 0.6 ? (Math.random() < 0.4 ? 0.9 : 0) : (Math.sin(E.t * 37) > 0.55 || Math.random() < 0.06 ? 0.75 : 0.06);
      f.luz = luz;
    }
  }
  if (tc >= 3.15) sonar('pajaros', () => { espantar(); S.aleteo(); });
  if (tc >= 4.15) { const fa = FOCOS.find((f) => f.falla); if (!E.silencio) S.zumbidoFoco(fa.luz > 0.5 ? 1 : 0.3); }
  // focos del cartel
  FOCOS_CARTEL.forEach((_, i) => { if (tc >= 5.9 + i * 0.13) sonar('cartel' + i, () => S.focosCartel(i)); });
  E.luzCartel = tc < 5.9 ? 0 : Math.min(1, (tc - 5.9) * 2.2) * (0.92 + 0.08 * Math.sin(E.t * 23));

  letraPaso(dt, tc);

  // fin: cuando ha bajado la cabeza y la camara ha vuelto
  if (E.impacto !== null && tc > E.impacto + 3.9) {
    E.modo = 'despues';
    E.fin = 0;
    if (!E.silencio) { S.dronA(0.14, 6); S.zumbidoFoco(0.25); }
  }
}

function letraPaso(dt, tc) {
  const l = E.letra, L = l.L;
  const g = 9.8;
  if (l.estado === 'fija' && tc >= T_TORNILLO) {
    l.estado = 'colgando';
    sonar('tornillo1', S.tornillo);
    chispas(L.x + L.w, L.y + L.h * 0.92, L.z, 16);
    grava(L.x + L.w * 0.5, L.y, L.z, 34);
  }
  if (l.estado === 'colgando') {
    // pendulo de un rectangulo colgado de su esquina de arriba a la izquierda
    const a0 = Math.atan2(L.w / 2, L.h / 2);
    const Leff = (2 / 3) * Math.hypot(L.w, L.h);
    l.w += ((g / Leff) * Math.sin(a0 - l.th) - 0.55 * l.w) * dt;
    l.th += l.w * dt;
    if (!E.silencio) S.chirriar(l.w);
    if (tc >= T_CAE) {
      l.estado = 'cae';
      if (!E.silencio) S.chirriar(0);
      sonar('tornillo2', S.tornillo);
      // del pivote al centro de masas, y su velocidad
      const px = L.x, py = L.y + L.h;
      const rx = L.w / 2, ry = -L.h / 2;
      const c = Math.cos(-l.th), s = Math.sin(-l.th);
      const ex = rx * c - ry * s, ey = rx * s + ry * c;
      l.x = px + ex; l.y = py + ey;
      l.vx = l.w * ey; l.vy = -l.w * ex;
      l.vz = -0.9;
      chispas(px, py, L.z, 10);
    }
  } else if (l.estado === 'cae' || l.estado === 'rebota') {
    l.vy -= g * dt;
    l.x += l.vx * dt; l.y += l.vy * dt; l.z = Math.max(26.6, l.z + l.vz * dt);
    l.th += l.w * dt;
    if (!E.silencio) S.silbidoCaida(l.estado === 'cae' ? Math.min(1, -l.vy / 18) : 0);
    // punto mas bajo del rectangulo girado
    const c = Math.cos(l.th), s = Math.sin(l.th);
    const bajo = Math.max(...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => -(a * L.w / 2 * -s + b * -L.h / 2 * c)));
    if (l.y - bajo <= 0 && l.vy < 0) {
      l.y = bajo;
      if (l.estado === 'cae') {
        E.impacto = tc;
        sonar('golpe', S.golpeChapa);
        E.temblor = 1;
        polvo(l.x, 0, l.z, 80);
        cascotes(l.x, l.z, 16);
        if (!E.silencio) S.silbidoCaida(0);
        l.estado = 'rebota';
        l.vy = -l.vy * 0.22;
        l.vx *= 0.4;
        l.vz = -0.3;
        l.w = l.w * 0.3 + (l.w >= 0 ? 1.4 : -1.4);
        // se queda tumbada sobre un costado (cara a la camara): el multiplo impar de 90 grados mas cercano
        l.objetivo = Math.PI / 2 + Math.round((l.th + Math.sign(l.w) * 0.4 - Math.PI / 2) / Math.PI) * Math.PI;
      } else {
        l.estado = 'quieta';
        l.y0 = l.y;
        l.th0 = l.th;
        l.tq = 0;
        polvo(l.x, 0, l.z, 26);
      }
    }
  } else if (l.estado === 'quieta') {
    l.tq += dt;
    const k = Math.min(1, l.tq / 0.45);
    const e = 1 - Math.pow(1 - k, 3);
    l.th = l.th0 + (l.objetivo - l.th0) * e;
    const c = Math.cos(l.th), s = Math.sin(l.th);
    const bajo = Math.max(...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => -(a * L.w / 2 * -s + b * -L.h / 2 * c)));
    l.y = bajo - 0.12;
  }
}

function chispas(x, y, z, n) {
  for (let i = 0; i < n; i++) E.parts.push({ t: 'chispa', x, y, z, vx: (Math.random() - 0.5) * 5, vy: Math.random() * 4, vz: (Math.random() - 0.5) * 2, vida: 0, max: 0.4 + Math.random() * 0.5 });
}
function grava(x, y, z, n) {
  for (let i = 0; i < n; i++) E.parts.push({ t: 'grava', x: x + (Math.random() - 0.5) * 2, y, z: z - Math.random() * 0.4, vx: (Math.random() - 0.5) * 0.6, vy: -Math.random() * 1, vz: -Math.random() * 0.4, vida: 0, max: 3, r: 0.03 + Math.random() * 0.05 });
}
function polvo(x, y, z, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 5;
    E.parts.push({ t: 'polvo', x: x + (Math.random() - 0.5) * 1.5, y: y + Math.random() * 0.6, z: z + (Math.random() - 0.5) * 1.5, vx: Math.cos(a) * v, vy: 0.4 + Math.random() * 2.2, vz: Math.sin(a) * v * 0.6, vida: 0, max: 2 + Math.random() * 2.5, r: 0.4 + Math.random() * 0.8 });
  }
}
function cascotes(x, z, n) {
  for (let i = 0; i < n; i++) E.parts.push({ t: 'cascote', x, y: 0.3, z, vx: (Math.random() - 0.5) * 7, vy: 2 + Math.random() * 5, vz: -Math.random() * 3, vida: 0, max: 4, r: 0.06 + Math.random() * 0.14, rot: Math.random() * 6, suelo: false });
}
function espantar() {
  E.pajaros.forEach((b, i) => { b.salida = i * 0.06 + Math.random() * 0.25; });
}

function particulas(dt) {
  for (const p of E.parts) {
    p.vida += dt;
    if (p.t === 'polvo') {
      p.vx *= Math.exp(-dt * 2.2); p.vz *= Math.exp(-dt * 2.2); p.vy = p.vy * Math.exp(-dt * 1.5) + 0.15 * dt;
      p.r += dt * 0.9;
    } else if (p.t === 'cascote') {
      if (!p.suelo) { p.vy -= 9.8 * dt; if (p.y <= 0.02 && p.vy < 0) { p.vy *= -0.3; p.vx *= 0.5; p.vz *= 0.5; if (Math.abs(p.vy) < 0.6) p.suelo = true; } }
      else { p.vx = p.vy = p.vz = 0; }
      p.rot += p.vx * dt * 2;
    } else {
      p.vy -= 9.8 * dt;
    }
    p.x += p.vx * dt; p.y = Math.max(0.02, p.y + p.vy * dt); p.z += p.vz * dt;
  }
  E.parts = E.parts.filter((p) => p.vida < p.max || (p.t === 'cascote'));
  for (const b of E.pajaros) {
    if (!b.vuela && b.salida > 0 && E.eventos.has('pajaros')) {
      b.salida -= dt;
      if (b.salida <= 0) { b.vuela = true; b.vx = b.lado * (1 + Math.random() * 3); b.vy = 3 + Math.random() * 2.5; b.vz = 4 + Math.random() * 5; }
    }
    if (b.vuela) { b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.vy *= Math.exp(-dt * 0.3); b.fase += dt * 15; }
  }
}

// ------------------------------------------------------------------ bucle
function paso(dt) {
  E.t += dt;
  const p = E.p;
  p.tAnim += dt;
  if (E.modo === 'juego') {
    moverJugador(dt);
    Object.assign(cam, mezcla(cam, JUEGO(p), 1 - Math.exp(-dt * 3)));
    if (p.x >= ZONA) { E.modo = 'cine'; E.tc = 0; }
  } else if (E.modo === 'cine') {
    cinematica(dt);
  } else {
    // despues: se vuelve a mandar; la letra se queda en el suelo, los focos siguen
    E.barras = Math.max(0, E.barras - dt / 0.6);
    E.fin += dt;
    moverJugador(dt);
    Object.assign(cam, mezcla(cam, JUEGO(p), 1 - Math.exp(-dt * 3)));
    for (const f of FOCOS) if (f.falla) f.luz = Math.sin(E.t * 37) > 0.6 || Math.random() < 0.05 ? 0.75 : 0.06;
    E.luzCartel = 0.92 + 0.08 * Math.sin(E.t * 23);
    letraPaso(dt, 99);
  }
  humoPaso(dt);
  particulas(dt);
  for (const b of BRUMA) { b.x += b.v * dt * (E.modo === 'cine' ? 2.2 : 1); if (b.x > 110) b.x -= 140; }
  E.temblor = Math.max(0, E.temblor - dt * 1.7);
  if (!E.silencio) S.vientoVivo(E.t, E.modo === 'cine' && E.tc > 1 && E.tc < 9 ? 1.8 : 1);
}

// ------------------------------------------------------------------ dibujo
function dibujarCielo() {
  const hy = horizonte();
  const g = ctx.createLinearGradient(0, hy - H * 1.1, 0, hy);
  g.addColorStop(0, '#0b0f14');
  g.addColorStop(0.55, '#1d252e');
  g.addColorStop(0.85, '#3a444e');
  g.addColorStop(1, T.NIEBLA);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, Math.max(0, hy + 2));
  // luna tapada
  const mx = W * 0.74 - cam.x * 0.8 * DPR, my = hy - H * 0.62;
  const lg = ctx.createRadialGradient(mx, my, 0, mx, my, H * 0.45);
  lg.addColorStop(0, 'rgba(200,210,218,.38)');
  lg.addColorStop(0.08, 'rgba(170,184,196,.16)');
  lg.addColorStop(1, 'rgba(120,136,150,0)');
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, W, hy);
  // nubes: dos capas casi en el infinito
  R.nubes.forEach((im, i) => {
    const esc = (H / 720) * (1.6 + i * 0.4);
    const w = im.width * esc, h = im.height * esc;
    const desp = ((E.t * (4 + i * 3) + cam.x * (2 + i * 2)) * esc) % w;
    const y = hy - H * (0.95 - i * 0.22) - (cam.y - 1.6) * 2 * DPR;
    ctx.globalAlpha = i ? 0.55 : 0.9;
    for (let x = -desp - w; x < W; x += w) ctx.drawImage(im, x, y, w, h);
  });
  ctx.globalAlpha = 1;
}

function dibujarSuelo() {
  const hy = horizonte();
  const pat = R.patSuelo || (R.patSuelo = ctx.createPattern(R.suelo.img, 'repeat'));
  const N = R.suelo.img.width, Pt = R.suelo.P;
  const banda = Math.max(1, Math.round(1.5 * DPR));
  ctx.fillStyle = pat;
  for (let sy = Math.ceil(hy + 1); sy < H; sy += banda) {
    // rayo de esta fila contra el suelo (y = 0)
    const a = (H / 2 + SH + sy0 - (sy + banda / 2)) / F;
    const den = SN - a * CS;
    if (den <= 1e-5) continue;
    const d = cam.y / den;
    const z = cam.z + d * (CS + a * SN);
    if (z > 31.8) continue;
    const s = F / d;
    const a = s / Pt;
    const e = W / 2 - cam.x * s + sx0;
    const v = (((z * Pt) % N) + N) % N;
    ctx.setTransform(a, 0, 0, 1, e, sy - v);
    ctx.fillStyle = pat;
    ctx.fillRect(-e / a, v, W / a, banda);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const X = (x) => W / 2 + (x - cam.x) * s + sx0;
    // el camino hasta la puerta: asfalto roto, raya central borrada, charcos que reflejan el cielo
    if (z > 1.5) {
      const ancho = 5.2 + Math.sin(z * 0.9) * 0.25;
      ctx.fillStyle = colorNiebla([27, 28, 29], d);
      ctx.fillRect(X(40 - ancho), sy, (2 * ancho) * s, banda);
      if (Math.floor(z / 2.4) % 2 === 0 && z < 26) { ctx.fillStyle = colorNiebla([110, 108, 98], d); ctx.fillRect(X(39.85), sy, 0.3 * s, banda); }
    }
    for (const [cx, cz, rx, rz] of CHARCOS) {
      const u = (z - cz) / rz;
      if (u * u < 1) {
        const hw = rx * Math.sqrt(1 - u * u);
        ctx.fillStyle = colorNiebla([44, 52, 60], d);
        ctx.fillRect(X(cx - hw), sy, 2 * hw * s, banda);
      }
    }
    // al pie del muro: mugre y sombra
    if (z > 27) { ctx.fillStyle = `rgba(6,7,7,${Math.min(0.55, (z - 27) * 0.2)})`; ctx.fillRect(0, sy, W, banda); }
    const n = niebla(d);
    if (n > 0.01) { ctx.fillStyle = `rgba(86,97,107,${n})`; ctx.fillRect(0, sy, W, banda); }
  }
  // charpas de luz: los focos del muro y el propio 18
  ctx.globalCompositeOperation = 'lighter';
  for (const f of FOCOS) if (f.luz > 0.02) charco(f.x, 19, 8, f.luz * 0.32, [230, 236, 238]);
  charco(E.p.x, 0.1, 1.6, 0.16, [255, 244, 226]);
  // reflejo de los focos en los charcos
  for (const [cx, cz, rx] of CHARCOS) for (const f of FOCOS) if (f.luz > 0.1 && Math.abs(f.x - cx) < 14) charco(cx + (f.x - cx) * 0.15, cz, rx * 0.5, f.luz * 0.2, [220, 230, 240]);
  ctx.globalCompositeOperation = 'source-over';
}

function charco(x, z, r, a, rgb) {
  const [px, py, s, d] = proy(x, 0, z);
  if (d < 0.5) return;
  const [, pyN] = proy(x, 0, z - r), [, pyF] = proy(x, 0, z + r);
  const rx = r * s, ry = Math.max(1, (pyN - pyF) / 2);
  const k = a * (1 - niebla(d) * 0.7);
  ctx.save();
  ctx.translate(px, (pyN + pyF) / 2);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(${rgb},${k})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// costado de un prisma (cara perpendicular a la pantalla en x fija, de z0 a z1)
function costado(x, z0, z1, y0, y1, rgb, juntas = 2.5) {
  const a = proy(x, y0, z0), b = proy(x, y0, z1), c = proy(x, y1, z1), d = proy(x, y1, z0);
  ctx.fillStyle = colorNiebla(rgb, (a[3] + b[3]) / 2);
  poligono([a, b, c, d]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(15,16,16,.35)';
  ctx.lineWidth = Math.max(1, DPR);
  ctx.beginPath();
  for (let y = juntas; y < y1; y += juntas) { const p = proy(x, y, z0), q2 = proy(x, y, z1); ctx.moveTo(p[0], p[1]); ctx.lineTo(q2[0], q2[1]); }
  ctx.stroke();
  ctx.strokeStyle = `rgba(11,10,12,${1 - niebla((a[3] + b[3]) / 2)})`;
  ctx.lineWidth = 2 * DPR;
  poligono([a, b, c, d]);
  ctx.stroke();
}

function dibujarMuro() {
  const M = T.MURO;
  // el resplandor del campamento por encima del muro y la grua de dentro
  {
    const [px, py, s] = proy(40, 30, 95);
    const g = ctx.createRadialGradient(px, py, 0, px, py, 60 * s);
    g.addColorStop(0, 'rgba(232,218,190,.13)');
    g.addColorStop(1, 'rgba(232,218,190,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  pieza(R.grua);
  {
    const [lx, ly, s] = proy(R.grua.luz[0], R.grua.luz[1], R.grua.z);
    if (Math.sin(E.t * 2.4) > 0.7) {
      ctx.fillStyle = 'rgba(210,60,50,.9)';
      ctx.beginPath(); ctx.arc(lx, ly, Math.max(1.5, 0.35 * s), 0, Math.PI * 2); ctx.fill();
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 3 * s);
      g.addColorStop(0, 'rgba(210,60,50,.35)'); g.addColorStop(1, 'rgba(210,60,50,0)');
      ctx.fillStyle = g; ctx.fillRect(lx - 3 * s, ly - 3 * s, 6 * s, 6 * s);
    }
  }
  // humo
  for (const h of [...E.humo].sort((a, b) => b.z - a.z)) {
    const [px, py, s, d] = proy(h.x, h.y, h.z);
    const a = Math.min(1, h.vida / 2) * (1 - h.vida / h.max) * 0.35;
    ctx.globalAlpha = a * (1 - niebla(d) * 0.5);
    ctx.drawImage(R.mancha, px - h.r * s * 1.3, py - h.r * s * 0.65, h.r * s * 2.6, h.r * s * 1.3);
  }
  ctx.globalAlpha = 1;
}

function dibujarPortonYMuro() {
  const M = T.MURO;
  const [pa, pb, ph] = M.PUERTA;
  for (const f of R.fondoBocados) pieza(f);
  pieza(R.porton);
  // jambas del hueco (se ve la de la izquierda si la camara esta a la derecha y al reves)
  if (cam.x > pa) costado(pa, M.Z, M.Z + 1.6, 0, ph, [52, 55, 53], 1);
  if (cam.x < pb) costado(pb, M.Z, M.Z + 1.6, 0, ph, [52, 55, 53], 1);
  // panza del dintel si la camara esta por debajo
  if (cam.y < ph) {
    const a = proy(pa, ph, M.Z), b = proy(pb, ph, M.Z), c = proy(pb, ph, M.Z + 1.6), d = proy(pa, ph, M.Z + 1.6);
    ctx.fillStyle = colorNiebla([30, 32, 31], a[3]);
    poligono([a, b, c, d]);
    ctx.fill();
  }
  pieza(R.muro, M.Z);
  // penumbra del muro junto a cada contrafuerte (el rincon recibe menos cielo)
  for (const c of R.contrafuertes) {
    for (const lado of [-1, 1]) {
      const xe = lado < 0 ? c.x0 : c.x0 + c.w;
      const a = proy(xe, M.ALTO, M.Z), b = proy(xe + lado * 3.5, 0, M.Z);
      const g = ctx.createLinearGradient(a[0], 0, b[0], 0);
      const k = 0.4 * (1 - niebla(a[3]));
      g.addColorStop(0, `rgba(5,6,6,${k})`);
      g.addColorStop(1, 'rgba(5,6,6,0)');
      ctx.fillStyle = g;
      ctx.fillRect(Math.min(a[0], b[0]), a[1], Math.abs(b[0] - a[0]), b[1] - a[1]);
    }
  }
  // luz de los focos lavando el muro
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const f of FOCOS) {
    if (f.luz < 0.02) continue;
    const [px, py, s, d] = proy(f.x, 31, M.Z);
    const k = f.luz * (1 - niebla(d) * 0.6);
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(1, 1.6);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 8 * s);
    g.addColorStop(0, `rgba(220,228,232,${0.2 * k})`);
    g.addColorStop(1, 'rgba(220,228,232,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 8 * s, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // abanicos de los focos del cartel sobre el muro
  if (E.luzCartel > 0.01) {
    const { x0, x1 } = R.cartel;
    for (const u of FOCOS_CARTEL) {
      const x = x0 + (x1 - x0) * u;
      const a = proy(x, 18.4, 28.8), b = proy(x - 4.5, 25.5, M.Z), c = proy(x + 4.5, 25.5, M.Z);
      const g = ctx.createLinearGradient(a[0], a[1], a[0], b[1]);
      g.addColorStop(0, `rgba(255,244,226,${0.22 * E.luzCartel})`);
      g.addColorStop(1, 'rgba(255,244,226,0)');
      ctx.fillStyle = g;
      poligono([a, b, c]);
      ctx.fill();
    }
  }
  ctx.restore();
}

function dibujarCartel() {
  const { letras } = R.cartel;
  // tirantes de la celosia al muro
  ctx.strokeStyle = '#1c1a18';
  ctx.lineWidth = Math.max(1, 0.12 * F / (28.8 - cam.z));
  ctx.beginPath();
  for (let x = R.celosia.x0 + 1; x < R.celosia.x0 + R.celosia.w; x += 3.2) {
    for (const y of [18.1, 19.1]) { const a = proy(x, y, 28.8), b = proy(x, y, T.MURO.Z); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
  }
  ctx.stroke();
  // letras: dorso a capas (el canto de la chapa) y la cara, encendida por los focos
  for (const L of letras) {
    if (L.cae && E.letra.estado !== 'fija') continue;
    for (const dz of [0.24, 0.16, 0.08]) pieza(L.dorso, L.z + dz);
    pieza(L.cara, L.z);
    if (E.luzCartel > 0.01) plano(L.luz, null, L.x, L.y, L.w, L.h, L.z, E.luzCartel * (1 - niebla(L.z - cam.z) * 0.6));
    // postes que las sujetan
  }
  pieza(R.celosia);
  // focos del cartel en la celosia
  const { x0, x1 } = R.cartel;
  for (const u of FOCOS_CARTEL) {
    const [px, py, s] = proy(x0 + (x1 - x0) * u, 18.6, 28.7);
    ctx.fillStyle = '#141312';
    ctx.fillRect(px - 0.3 * s, py - 0.25 * s, 0.6 * s, 0.4 * s);
    if (E.luzCartel > 0.05) {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(px, py - 0.3 * s, 0, px, py - 0.3 * s, 1.6 * s);
      g.addColorStop(0, `rgba(255,246,226,${0.8 * E.luzCartel})`);
      g.addColorStop(1, 'rgba(255,246,226,0)');
      ctx.fillStyle = g;
      ctx.fillRect(px - 2 * s, py - 2 * s, 4 * s, 4 * s);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}

function dibujarLetraSuelta() {
  const l = E.letra;
  if (l.estado === 'fija') return;
  const L = l.L;
  const dibujar = (img, fog, z, alfa) => {
    let cx, cy;
    if (l.estado === 'colgando') {
      const c = Math.cos(-l.th), s = Math.sin(-l.th);
      const rx = L.w / 2, ry = -L.h / 2;
      cx = L.x + rx * c - ry * s; cy = L.y + L.h + rx * s + ry * c;
    } else { cx = l.x; cy = l.y; }
    const [px, py, s, d] = proy(cx, cy, z);
    if (d < 0.3) return;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(l.th);
    ctx.globalAlpha = alfa;
    ctx.drawImage(img, -L.w * s / 2, -L.h * s / 2, L.w * s, L.h * s);
    const n = niebla(d);
    if (fog && n > 0.01) { ctx.globalAlpha = alfa * n; ctx.drawImage(fog, -L.w * s / 2, -L.h * s / 2, L.w * s, L.h * s); }
    ctx.restore();
  };
  const z = l.estado === 'colgando' ? L.z : l.z;
  for (const dz of [0.24, 0.16, 0.08]) dibujar(L.dorso.img, L.dorso.fog, z + dz, 1);
  dibujar(L.cara.img, L.cara.fog, z, 1);
  if (E.luzCartel > 0.01 && l.estado === 'colgando') dibujar(L.luz, null, z, E.luzCartel * 0.8);
  // el tornillo del que cuelga
  if (l.estado === 'colgando') {
    const [px, py, s] = proy(L.x, L.y + L.h, L.z - 0.02);
    ctx.fillStyle = '#0d0c0b';
    ctx.beginPath(); ctx.arc(px, py, Math.max(1.5, 0.09 * s), 0, Math.PI * 2); ctx.fill();
  }
}

function dibujarContrafuerte(c) {
  const M = T.MURO;
  const x0 = c.x0, x1 = c.x0 + c.w;
  // costado que da hacia la camara
  if (cam.x < x0) costado(x0, c.z, M.Z, 0, c.alto, [72, 78, 75]);
  if (cam.x > x1) costado(x1, c.z, M.Z, 0, c.alto, [34, 37, 36]);
  // tapa de arriba si la camara la ve (no pasa: queda por debajo), sombra en el muro al lado
  pieza(c);
}

function dibujarFoco(f) {
  const [px, py, s, d] = proy(f.x, f.y, f.z);
  // brazo y carcasa
  ctx.fillStyle = '#121314';
  ctx.fillRect(px - 0.5 * s, py - 0.25 * s, 1.0 * s, 0.5 * s);
  const brazo = proy(f.x, f.y - 0.6, f.z + 0.4);
  ctx.strokeStyle = '#121314';
  ctx.lineWidth = Math.max(1, 0.12 * s);
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(brazo[0], brazo[1]); ctx.stroke();
  if (f.luz < 0.02) return;
  const k = f.luz * (1 - niebla(d) * 0.5);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // cono de luz hasta el suelo: con la niebla es lo que se ve
  const a = proy(f.x - 0.4, f.y - 0.2, f.z), b = proy(f.x + 0.4, f.y - 0.2, f.z), c = proy(f.x + 8, 0, 19), e = proy(f.x - 8, 0, 19);
  const g = ctx.createLinearGradient(px, py, px, c[1]);
  const vol = 0.1 + E.densidad * 3;
  g.addColorStop(0, `rgba(226,232,236,${vol * k})`);
  g.addColorStop(1, `rgba(226,232,236,${vol * k * 0.15})`);
  ctx.fillStyle = g;
  poligono([a, b, c, e]);
  ctx.fill();
  const h = ctx.createRadialGradient(px, py + 0.2 * s, 0, px, py + 0.2 * s, 3.5 * s);
  h.addColorStop(0, `rgba(255,255,250,${0.95 * k})`);
  h.addColorStop(0.15, `rgba(230,238,240,${0.4 * k})`);
  h.addColorStop(1, 'rgba(230,238,240,0)');
  ctx.fillStyle = h;
  ctx.fillRect(px - 4 * s, py - 4 * s, 8 * s, 8 * s);
  ctx.restore();
}

function dibujarTarjeta(nombre, x, z) {
  const im = R.atrezo[nombre];
  const P = 40;
  const w = im.width / P, h = im.height / P;
  sombraSuelo(x, z, w * 0.55, 0.45);
  plano(im, R.fogAtrezo[nombre], x - w / 2, -0.06, w, h, z);
}

function sombraSuelo(x, z, r, a) {
  const [px, py, s, d] = proy(x, 0, z);
  if (d < 0.3) return;
  const [, pyN] = proy(x, 0, z - r * 0.4), [, pyF] = proy(x, 0, z + r * 0.4);
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(1, Math.max(0.05, (pyN - pyF) / (2 * r * s)));
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * s);
  g.addColorStop(0, `rgba(4,5,6,${a * (1 - niebla(d))})`);
  g.addColorStop(1, 'rgba(4,5,6,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r * s, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function dibujarMata(m) {
  const [px, py, s, d] = proy(m.x, 0, m.z);
  if (px < -50 || px > W + 50) return;
  ctx.strokeStyle = colorNiebla([22, 26, 22], d);
  ctx.lineWidth = Math.max(1, 0.035 * s);
  ctx.beginPath();
  for (let i = 0; i < m.n; i++) {
    const a = Math.sin(m.s + i * 2.1) * 0.6 + Math.sin(E.t * 1.3 + m.x) * 0.08;
    const h = m.h * (0.6 + 0.4 * Math.abs(Math.sin(m.s * 3 + i)));
    ctx.moveTo(px + (i - m.n / 2) * 0.04 * s, py);
    ctx.quadraticCurveTo(px + a * h * 0.3 * s, py - h * 0.6 * s, px + a * h * s, py - h * s);
  }
  ctx.stroke();
}

function dibujarBruma(b) {
  const [px, py, s, d] = proy(b.x, b.y, b.z);
  if (d < 1) return;
  ctx.globalAlpha = E.bruma * 0.5 * (1 - niebla(d) * 0.4);
  ctx.drawImage(R.brumaTinta || (R.brumaTinta = tintar(R.mancha, '#6a7680')), px - b.rx * s, py - b.ry * s, b.rx * 2 * s, b.ry * 2 * s);
  ctx.globalAlpha = 1;
}
function tintar(img, color) {
  const c = T.lienzo(img.width, img.height);
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

function dibujarPajaro(b) {
  const [px, py, s, d] = proy(b.x, b.y, b.z);
  if (d > 260 || py < -20) return;
  const t = Math.max(1.5, 0.45 * s);
  ctx.strokeStyle = colorNiebla([10, 11, 12], d);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = Math.max(1, t * 0.18);
  if (!b.vuela) {
    ctx.beginPath(); ctx.ellipse(px, py - t * 0.35, t * 0.32, t * 0.38, 0.3 * b.lado, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(px + b.lado * t * 0.2, py - t * 0.8, t * 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(px - b.lado * t * 0.2, py - t * 0.2); ctx.lineTo(px - b.lado * t * 0.6, py + t * 0.1); ctx.stroke();
    return;
  }
  const ala = Math.sin(b.fase) * 0.7;
  ctx.beginPath();
  ctx.moveTo(px - t, py - ala * t);
  ctx.quadraticCurveTo(px - t * 0.4, py - t * 0.3, px, py);
  ctx.quadraticCurveTo(px + t * 0.4, py - t * 0.3, px + t, py - ala * t);
  ctx.stroke();
}

function dibujarParticula(p) {
  const [px, py, s, d] = proy(p.x, p.y, p.z);
  if (d < 0.3) return;
  const k = p.vida / p.max;
  if (p.t === 'chispa') {
    ctx.fillStyle = `rgba(255,244,214,${1 - k})`;
    ctx.fillRect(px - 1, py - 1, Math.max(2, 0.06 * s), Math.max(2, 0.06 * s));
  } else if (p.t === 'polvo') {
    ctx.globalAlpha = Math.min(1, p.vida * 4) * (1 - k) * 0.45;
    ctx.drawImage(R.polvoTinta || (R.polvoTinta = tintar(R.mancha, '#7d7a70')), px - p.r * s, py - p.r * s * 0.6, p.r * 2 * s, p.r * 1.2 * s);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = colorNiebla([30, 31, 30], d);
    const r = Math.max(1, p.r * s);
    ctx.save(); ctx.translate(px, py); ctx.rotate(p.rot || 0); ctx.fillRect(-r, -r * 0.7, r * 2, r * 1.4); ctx.restore();
  }
}

function dibujarMotas() {
  ctx.fillStyle = 'rgba(214,220,222,.5)';
  for (const m of MOTAS) {
    const x = cam.x - 30 + ((m.x + E.t * 0.3 - cam.x + 3000) % 60);
    const y = m.y + Math.sin(E.t * 0.7 + m.f) * 0.3;
    const [px, py, s, d] = proy(x, y, m.z);
    if (d < 0.5) continue;
    const r = Math.max(0.6, 0.025 * s);
    ctx.globalAlpha = 0.5 * (1 - niebla(d));
    ctx.fillRect(px, py, r, r);
  }
  ctx.globalAlpha = 1;
}

function dibujarSujeto() {
  const p = E.p;
  const [a, i, nombre] = fotograma(p);
  const im = R.sujeto.hojas[nombre];
  const [fw, fh] = a.fotograma;
  const [px, py, s, d] = proy(p.x, 0, p.z);
  if (d < 0.5) return;
  const k = s / R.sujeto.datos.px_por_metro;
  sombraSuelo(p.x, p.z, 0.45, 0.6);
  if (s < 60 * DPR) {
    // de lejos: un halo que lo despega del suelo, lo mas luminoso del plano
    const r = Math.max(14 * DPR, 0.9 * s);
    const g = ctx.createRadialGradient(px, py - 0.45 * s, 0, px, py - 0.45 * s, r);
    g.addColorStop(0, 'rgba(255,244,226,.32)');
    g.addColorStop(1, 'rgba(255,244,226,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.fillRect(px - r, py - 0.45 * s - r, r * 2, r * 2);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.save();
  ctx.translate(px, py);
  if (p.cara < 0 && p.vista === 'perfil') ctx.scale(-1, 1);
  // GDD: lo mas luminoso de la pantalla, con un borde de luz calida suave
  ctx.shadowColor = 'rgba(255,246,228,.85)';
  ctx.shadowBlur = Math.max(6 * DPR, 0.12 * s);
  ctx.drawImage(im, (i % a.cols) * fw, Math.floor(i / a.cols) * fh, fw, fh, -a.pies[0] * k, -a.pies[1] * k, fw * k, fh * k);
  ctx.restore();
}

function dibujarPrimerPlano() {
  for (const f of R.primer) {
    const [px, py, s, dd] = proy(f.x, 0, f.z);
    if (dd < 0.5) continue;
    const w = f.w * s, h = f.h * s;
    if (px + w < 0 || px > W) continue;
    const d = f.z - cam.z;
    const borroso = Math.max(0, Math.min(1, (14 - d) / 6));
    if (borroso < 1) ctx.drawImage(f.nitida, px, py - h + f.pad * s * 0.2, w, h);
    if (borroso > 0) { ctx.globalAlpha = borroso; ctx.drawImage(f.img, px, py - h + f.pad * s * 0.2, w, h); ctx.globalAlpha = 1; }
  }
}

let vineta = null;
function dibujarPantalla() {
  if (!vineta) {
    vineta = T.lienzo(W, H);
    const v = vineta.getContext('2d');
    const g = v.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, Math.hypot(W, H) * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.62)');
    v.fillStyle = g;
    v.fillRect(0, 0, W, H);
  }
  ctx.drawImage(vineta, 0, 0);
  // grano de pelicula
  ctx.globalAlpha = 0.06;
  ctx.globalCompositeOperation = 'overlay';
  const ox = Math.floor(Math.random() * 256), oy = Math.floor(Math.random() * 256);
  for (let x = -ox; x < W; x += 256 * DPR) for (let y = -oy; y < H; y += 256 * DPR) ctx.drawImage(R.grano, x, y, 256 * DPR, 256 * DPR);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  // franjas de cine
  if (E.barras > 0) {
    const h = H * 0.11 * suave(E.barras);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, h);
    ctx.fillRect(0, H - h, W, h);
  }
  // ayudas
  ctx.font = `${Math.round(13 * DPR)}px Bahnschrift, "Segoe UI", sans-serif`;
  ctx.textBaseline = 'bottom';
  if (E.modo === 'juego') {
    const a = E.movido ? Math.max(0, 1 - E.t / 12) * 0.7 : 0.7;
    if (a > 0.01) {
      ctx.fillStyle = `rgba(236,230,216,${a})`;
      ctx.fillText(LANG === 'en' ? '← → ↑ ↓  walk     Shift  run' : '← → ↑ ↓  caminar     Mayús  correr', 24 * DPR, H - 22 * DPR);
    }
  } else if (E.modo === 'despues' && E.fin > 1.5) {
    ctx.fillStyle = `rgba(236,230,216,${Math.min(0.55, (E.fin - 1.5) * 0.4)})`;
    ctx.fillText(LANG === 'en' ? 'R  replay' : 'R  repetir', 24 * DPR, H - 22 * DPR);
  }
}

function dibujar() {
  prepararCamara();
  const tm = E.temblor * E.temblor;
  sx0 = (Math.sin(E.t * 61) + Math.sin(E.t * 37)) * tm * H * 0.006;
  sy0 = (Math.sin(E.t * 53) + Math.sin(E.t * 29)) * tm * H * 0.008;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  dibujarCielo();
  dibujarMuro();
  dibujarSuelo();
  // lo que esta de pie, de lejos a cerca
  const cosas = [];
  cosas.push({ z: T.MURO.Z + 1.7, f: dibujarPortonYMuro });
  cosas.push({ z: 28.9, f: dibujarCartel });
  for (const c of R.contrafuertes) cosas.push({ z: c.z, f: () => dibujarContrafuerte(c) });
  for (const f of FOCOS) cosas.push({ z: f.z - 0.01, f: () => dibujarFoco(f) });
  for (const [n, x, z] of ATREZO) cosas.push({ z, f: () => dibujarTarjeta(n, x, z) });
  for (const m of MATAS) cosas.push({ z: m.z, f: () => dibujarMata(m) });
  for (const b of BRUMA) cosas.push({ z: b.z, f: () => dibujarBruma(b) });
  for (const b of E.pajaros) cosas.push({ z: b.z - 0.05, f: () => dibujarPajaro(b) });
  for (const p of E.parts) cosas.push({ z: p.z, f: () => dibujarParticula(p) });
  const l = E.letra;
  cosas.push({ z: (l.estado === 'fija' || l.estado === 'colgando' ? l.L.z : l.z) - 0.3, f: dibujarLetraSuelta });
  cosas.push({ z: E.p.z, f: dibujarSujeto });
  cosas.push({ z: 2, f: dibujarMotas });
  cosas.sort((a, b) => b.z - a.z);
  for (const c of cosas) if (c.z > cam.z + 0.5) c.f();
  dibujarPrimerPlano();
  dibujarPantalla();
}

// ------------------------------------------------------------------ arranque
let congelado = false, ultimo = 0;
function bucle(t) {
  const dt = Math.min(0.05, (t - (ultimo || t)) / 1000);
  ultimo = t;
  if (!congelado) {
    let r = dt;
    while (r > 1e-6) { const h = Math.min(r, 1 / 60); paso(h); r -= h; }
    dibujar();
  }
  requestAnimationFrame(bucle);
}

window.__dbg = {
  congelar(b = true) { congelado = b; },
  avanzar(seg, dt = 1 / 60) { for (let t = 0; t < seg; t += dt) paso(dt); dibujar(); return this.estado(); },
  // salta a un instante de la cinematica (o a -s segundos antes de la zona, andando)
  ir(tc) {
    reiniciar();
    E.silencio = true;
    E.p.x = ZONA - 0.01;
    E.p.z = 0;
    E.p.vx = 1.7;
    E.p.anim = 'andar';
    Object.assign(cam, JUEGO(E.p));
    paso(1 / 60);
    for (let t = 0; t < tc; t += 1 / 60) paso(1 / 60);
    E.silencio = false;
    dibujar();
    return this.estado();
  },
  andarHasta(x, z = 0) { reiniciar(); E.silencio = true; E.p.x = x; E.p.z = z; Object.assign(cam, JUEGO(E.p)); paso(1 / 60); E.silencio = false; dibujar(); return this.estado(); },
  // milisegundos por fotograma dibujado (media de n)
  medir(n = 60) { const t0 = performance.now(); for (let i = 0; i < n; i++) dibujar(); return +((performance.now() - t0) / n).toFixed(2); },
  estado() { return { modo: E.modo, tc: +E.tc.toFixed(2), x: +E.p.x.toFixed(2), z: +E.p.z.toFixed(2), anim: E.p.anim, hoja: hoja(E.p), letra: E.letra.estado, impacto: E.impacto && +E.impacto.toFixed(2), cam: { ...cam } }; },
  teclas,
};

(async () => {
  medir();
  await cargar();
  reiniciar();
  document.getElementById('cargando').remove();
  requestAnimationFrame(bucle);
})();
