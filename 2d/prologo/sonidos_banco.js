// EL BANCO DE SONIDOS DEL PROLOGO (2026-10-20, pedido: «los sonidos de la animacion, hazlos mas profesionales»).
// Antes cada golpe era un par de osciladores y un soplo de ruido al vuelo (`son.tono` / `son.soplo`); ahora cada
// sonido se SINTETIZA POR CAPAS en muestras, como se monta un efecto de cine, y se reproduce como una grabacion:
//   transitorio  el chasquido del primer milisegundo (lo que hace que un golpe "pegue")
//   cuerpo       el tono del objeto que suena (la chapa, la tierra, el cañon) con su caida de tono
//   grave        el subgrave que baja de tono, SATURADO para que tenga armonicos y se oiga en altavoces pequeños
//   cola         ruido marron filtrado que se apaga despacio (el retumbar)
//   cascotes     granos: clics de piedra, gravilla y cristales que caen despues, repartidos a izquierda y derecha
//   ecos         la calle devuelve el golpe: copias filtradas a 140-700 ms (rebote entre fachadas)
// Las voces de las bestias son una fuente (sierra con temblor + aliento) por tres FORMANTES que se deslizan, con
// carraspeo (modulacion de 30-60 Hz) y saturacion: chillidos y gruñidos de garganta, no pitidos.
// Puro: sin Web Audio ni DOM. Cada funcion devuelve { l, r } (estereo) o un Float32Array (mono). Lo calcula el hilo
// de `convoy_obrero.js` al empezar el prologo (unos 300 ms) y `sonido.js` lo reproduce con su paneo y su distancia.

const TAU = Math.PI * 2;

function azar(semilla) {
  let s = semilla >>> 0;
  const u = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { u, e: (a, b) => a + u() * (b - a), g: () => Math.sqrt(-2 * Math.log(u() + 1e-12)) * Math.cos(TAU * u()) };
}

// ---------------------------------------------------------------- utiles
// biquad RBJ de una pasada (lp, hp, bp de pico 1), con frecuencia fija
function filtro(x, tipo, f, q, sr) {
  const w = TAU * Math.min(f, sr * 0.45) / sr, c = Math.cos(w), al = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (tipo === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
  else if (tipo === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
  else { b0 = al; b1 = 0; b2 = -al; }
  const a0 = 1 + al, B0 = b0 / a0, B1 = b1 / a0, B2 = b2 / a0, A1 = (-2 * c) / a0, A2 = (1 - al) / a0;
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = x[i], o = B0 * v + B1 * x1 + B2 * x2 - A1 * y1 - A2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = o; y[i] = o; }
  return y;
}
// paso banda que se desliza: f(t) en Hz (para formantes y barridos), recalculado cada 32 muestras
function bandaMovil(x, fdet, q, sr) {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, B0 = 0, B2 = 0, A1 = 0, A2 = 0;
  for (let i = 0; i < x.length; i++) {
    if ((i & 31) === 0) {
      const w = TAU * Math.min(fdet(i / sr), sr * 0.45) / sr, c = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al;
      B0 = al / a0; B2 = -al / a0; A1 = (-2 * c) / a0; A2 = (1 - al) / a0;
    }
    const v = x[i], o = B0 * v + B2 * x2 - A1 * y1 - A2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = o; y[i] = o;
  }
  return y;
}
const ruido = (n, r) => { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = r.u() * 2 - 1; return a; };
const marron = (n, r) => { const a = new Float32Array(n); let v = 0; for (let i = 0; i < n; i++) { v = (v + 0.02 * (r.u() * 2 - 1)) * 0.998; a[i] = v * 3.5; } return a; };
// envolvente: ataque lineal a, caida exponencial tau (s), desde el instante t0
function env(n, sr, t0, a, tau) {
  const e = new Float32Array(n), i0 = Math.floor(t0 * sr);
  for (let i = Math.max(0, i0); i < n; i++) { const t = (i - i0) / sr; e[i] = t < a ? t / a : Math.exp(-(t - a) / tau); }
  return e;
}
const mul = (x, e) => { for (let i = 0; i < x.length; i++) x[i] *= e[i]; return x; };
function sumar(d, s, t0, g, sr) { const o = Math.floor(t0 * sr); for (let i = 0; i < s.length && o + i < d.length; i++) if (o + i >= 0) d[o + i] += s[i] * g; }
const sat = (x, k) => { const n = Math.tanh(k); for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * k) / n; return x; };
// un seno que cae de tono f0 -> f1 con constante tf
function seno(n, sr, f0, f1, tf, fase = 0) {
  const a = new Float32Array(n); let ph = fase;
  for (let i = 0; i < n; i++) { const t = i / sr, f = f1 + (f0 - f1) * Math.exp(-t / tf); ph += TAU * f / sr; a[i] = Math.sin(ph); }
  return a;
}
// normaliza al pico p (y a los dos canales por igual)
function normal(o, p = 0.9) {
  let m = 1e-9; for (const c of [o.l, o.r]) for (let i = 0; i < c.length; i++) m = Math.max(m, Math.abs(c[i]));
  for (const c of [o.l, o.r]) for (let i = 0; i < c.length; i++) c[i] *= p / m;
  // (un fundido de 5 ms al final: sin chasquido al cortar)
  for (const c of [o.l, o.r]) { const k = Math.min(c.length, 240); for (let i = 0; i < k; i++) c[c.length - 1 - i] *= i / k; }
  return o;
}
function normalMono(a, p = 0.9) { const o = normal({ l: a, r: new Float32Array(0) }, p); return o.l; }
// la calle devuelve el golpe: ecos filtrados, cada uno algo mas a un lado
function ecos(o, sr, lista) {
  const fuente = new Float32Array(o.l.length); for (let i = 0; i < fuente.length; i++) fuente[i] = (o.l[i] + o.r[i]) * 0.5;
  for (const [t, g, f, lado] of lista) {
    const e = filtro(filtro(fuente, 'lp', f, 0.7, sr), 'hp', 90, 0.7, sr);
    sumar(o.l, e, t, g * (1 - lado * 0.6), sr); sumar(o.r, e, t + (lado > 0 ? 0.004 : 0), g * (1 + lado * 0.6), sr);
  }
}
// granos de cascotes: clics de piedra (banda media) y de gravilla y cristal (agudos)
function cascotes(o, sr, r, n, t0, t1, vol, agudo = 1) {
  for (let k = 0; k < n; k++) {
    const t = t0 + (t1 - t0) * Math.pow(r.u(), 1.6), dur = r.e(0.006, 0.03), m = Math.floor(dur * sr * 6);
    const piedra = r.u() < 0.55;
    let g = filtro(ruido(m, r), 'bp', piedra ? r.e(500, 1600) : r.e(2200, 5200) * agudo, piedra ? 3 : 5, sr);
    mul(g, env(m, sr, 0, 0.0008, dur));
    const a = vol * r.e(0.3, 1) * (1 - 0.6 * (t - t0) / Math.max(0.01, t1 - t0)), lado = r.e(-1, 1);
    sumar(o.l, g, t, a * (1 - lado * 0.7), sr); sumar(o.r, g, t, a * (1 + lado * 0.7), sr);
  }
}
// cristal: parciales agudos inarmonicos que tintinean
function cristales(o, sr, r, n, t0, t1, vol) {
  for (let k = 0; k < n; k++) {
    const t = r.e(t0, t1), f = r.e(2800, 6200), m = Math.floor(0.35 * sr), a = new Float32Array(m);
    for (const [rf, tau, g] of [[1, 0.12, 1], [2.37, 0.07, 0.5], [3.91, 0.04, 0.3]]) for (let i = 0; i < m; i++) a[i] += Math.sin(TAU * f * rf * i / sr) * Math.exp(-i / sr / tau) * g;
    const lado = r.e(-1, 1), v = vol * r.e(0.4, 1);
    sumar(o.l, a, t, v * (1 - lado * 0.8), sr); sumar(o.r, a, t, v * (1 + lado * 0.8), sr);
  }
}
const nuevo = (s, sr) => { const n = Math.floor(s * sr); return { l: new Float32Array(n), r: new Float32Array(n) }; };
const ambos = (o, a, t, g, sr) => { sumar(o.l, a, t, g, sr); sumar(o.r, a, t, g, sr); };

// ---------------------------------------------------------------- la pisada del gigante
export function pisada(sr, sem = 1) {
  const r = azar(9100 + sem), o = nuevo(4.6, sr), n = o.l.length;
  // el subgrave que baja (60 -> 24 Hz) saturado: el cuerpo de la tierra
  const sub = sat(mul(seno(n, sr, 62, 24, 0.35), env(n, sr, 0, 0.012, 0.95)), 2.2);
  ambos(o, sub, 0, 1, sr);
  // el golpe en 90-120 Hz (lo que se oye en un portatil)
  ambos(o, sat(mul(seno(n, sr, 128, 70, 0.12), env(n, sr, 0, 0.004, 0.22)), 1.6), 0, 0.55, sr);
  // el impacto: ruido grave muy corto y un chasquido seco
  ambos(o, mul(filtro(ruido(n, r), 'lp', 380, 0.8, sr), env(n, sr, 0, 0.002, 0.11)), 0, 0.9, sr);
  ambos(o, mul(filtro(ruido(n, r), 'hp', 1600, 0.7, sr), env(n, sr, 0.004, 0.0006, 0.022)), 0, 0.35, sr);
  // la cola: el retumbar que se va
  const cola = mul(filtro(filtro(marron(n, r), 'lp', 130, 0.7, sr), 'hp', 22, 0.7, sr), env(n, sr, 0.02, 0.15, 1.5));
  sumar(o.l, cola, 0, 0.9, sr); sumar(o.r, filtro(cola, 'lp', 110, 0.7, sr), 0.006, 0.9, sr);
  // lo que tiembla: el crujido de las estructuras (resonancias graves que chirrian), la gravilla y los cristales
  const cruje = mul(bandaMovil(ruido(n, r), (t) => 210 + 60 * Math.sin(t * 3.1) - t * 30, 14, sr), env(n, sr, 0.25, 0.2, 0.7));
  sumar(o.l, cruje, 0, 0.16, sr); sumar(o.r, cruje, 0.03, 0.12, sr);
  cascotes(o, sr, r, 70, 0.12, 2.6, 0.11);
  cristales(o, sr, r, 7, 0.15, 1.2, 0.03);
  ecos(o, sr, [[0.14, 0.32, 1800, -0.7], [0.31, 0.22, 1200, 0.7], [0.52, 0.13, 800, -0.3], [0.8, 0.07, 600, 0.4]]);
  return normal(o, 0.95);
}

// ---------------------------------------------------------------- el cañonazo del tanque
export function canonazo(sr) {
  const r = azar(7301), o = nuevo(3.2, sr), n = o.l.length;
  ambos(o, mul(filtro(ruido(n, r), 'hp', 900, 0.7, sr), env(n, sr, 0, 0.0004, 0.006)), 0, 1, sr);           // el latigazo
  ambos(o, mul(filtro(ruido(n, r), 'bp', 520, 1.2, sr), env(n, sr, 0.001, 0.002, 0.06)), 0, 1.4, sr);       // la boca
  ambos(o, sat(mul(seno(n, sr, 88, 34, 0.18), env(n, sr, 0, 0.003, 0.5)), 2.6), 0, 0.9, sr);               // la onda
  const cola = mul(filtro(marron(n, r), 'lp', 240, 0.7, sr), env(n, sr, 0.03, 0.08, 1.1));
  sumar(o.l, cola, 0, 0.7, sr); sumar(o.r, cola, 0.01, 0.7, sr);
  cascotes(o, sr, r, 14, 0.2, 1.4, 0.05);
  ecos(o, sr, [[0.18, 0.5, 2200, 0.8], [0.39, 0.34, 1400, -0.8], [0.7, 0.2, 900, 0.5], [1.1, 0.1, 600, -0.4]]);
  return normal(o, 0.98);
}

// ---------------------------------------------------------------- la explosion del proyectil
export function explosion(sr) {
  const r = azar(6603), o = nuevo(4.4, sr), n = o.l.length;
  ambos(o, mul(filtro(ruido(n, r), 'hp', 700, 0.7, sr), env(n, sr, 0, 0.0005, 0.012)), 0, 0.9, sr);
  ambos(o, sat(mul(seno(n, sr, 72, 24, 0.3), env(n, sr, 0, 0.004, 0.8)), 3), 0, 1, sr);
  // el fuego: un rugido de ruido que se abre y se cierra
  const fuego = mul(bandaMovil(ruido(n, r), (t) => 900 * Math.exp(-t * 1.6) + 160, 0.9, sr), env(n, sr, 0.005, 0.05, 0.9));
  sumar(o.l, fuego, 0, 0.6, sr); sumar(o.r, fuego, 0.008, 0.6, sr);
  const cola = mul(filtro(marron(n, r), 'lp', 160, 0.7, sr), env(n, sr, 0.05, 0.2, 1.6));
  ambos(o, cola, 0, 0.9, sr);
  cascotes(o, sr, r, 110, 0.25, 3.2, 0.13);
  ecos(o, sr, [[0.16, 0.4, 1600, -0.6], [0.36, 0.25, 1000, 0.7], [0.62, 0.14, 700, -0.2]]);
  return normal(o, 0.98);
}

// ---------------------------------------------------------------- rafaga de ametralladora lejana (con los ecos)
export function rafaga(sr, disparos = 9) {
  const r = azar(5207), o = nuevo(0.1 * disparos + 1.4, sr), n = o.l.length;
  const tiro = (t, v) => {
    const m = Math.floor(0.3 * sr);
    const a = mul(filtro(ruido(m, r), 'bp', r.e(900, 1400), 1.1, sr), env(m, sr, 0, 0.0008, 0.018));
    const b = mul(filtro(ruido(m, r), 'lp', 300, 0.8, sr), env(m, sr, 0, 0.002, 0.05));
    ambos(o, a, t, v, sr); ambos(o, b, t, v * 1.4, sr);
  };
  for (let k = 0; k < disparos; k++) tiro(k * 0.094 + r.e(0, 0.012), r.e(0.7, 1));
  ecos(o, sr, [[0.21, 0.45, 1300, 0.6], [0.44, 0.25, 800, -0.6]]);
  const l = filtro(o.l, 'lp', 2600, 0.7, sr), rr = filtro(o.r, 'lp', 2600, 0.7, sr);
  return normal({ l, r: rr }, 0.9);
}

// ---------------------------------------------------------------- una bestia que cae sobre la chapa del tanque
export function golpeChapa(sr) {
  const r = azar(4411), o = nuevo(2.2, sr), n = o.l.length;
  // la chapa: parciales inarmonicos (una placa gruesa) con su caida
  const placa = new Float32Array(n);
  for (const [rf, tau, g] of [[1, 0.9, 1], [2.32, 0.55, 0.6], [4.25, 0.35, 0.45], [6.63, 0.2, 0.3], [9.38, 0.12, 0.2], [13.1, 0.07, 0.12]]) {
    const f = 172 * rf * r.e(0.99, 1.01); for (let i = 0; i < n; i++) placa[i] += Math.sin(TAU * f * i / sr) * Math.exp(-i / sr / tau) * g;
  }
  ambos(o, placa, 0, 0.5, sr);
  ambos(o, sat(mul(seno(n, sr, 110, 60, 0.08), env(n, sr, 0, 0.002, 0.18)), 2), 0, 0.8, sr);   // el peso
  ambos(o, mul(filtro(ruido(n, r), 'hp', 2000, 0.7, sr), env(n, sr, 0, 0.0005, 0.02)), 0, 0.5, sr);
  // las garras que rascan: tres arañazos de ruido agudo que tiembla
  for (const [t0, dur, lado] of [[0.08, 0.22, -0.4], [0.32, 0.3, 0.5], [0.62, 0.18, 0]]) {
    const m = Math.floor(dur * sr), a = bandaMovil(ruido(m, r), (t) => 3400 + 1500 * Math.sin(t * 40) + t * 2000, 6, sr);
    for (let i = 0; i < m; i++) a[i] *= Math.sin(Math.PI * i / m) * (0.6 + 0.4 * Math.sin(i / sr * TAU * 28));
    sumar(o.l, a, t0, 0.22 * (1 - lado), sr); sumar(o.r, a, t0, 0.22 * (1 + lado), sr);
  }
  return normal(o, 0.9);
}

// ---------------------------------------------------------------- la escotilla del tanque que se cierra de golpe
export function escotilla(sr) {
  const r = azar(3305), o = nuevo(0.9, sr), n = o.l.length;
  const placa = new Float32Array(n);
  for (const [f, tau, g] of [[340, 0.25, 1], [812, 0.12, 0.5], [1530, 0.06, 0.35], [2480, 0.03, 0.2]]) for (let i = 0; i < n; i++) placa[i] += Math.sin(TAU * f * i / sr) * Math.exp(-i / sr / tau) * g;
  ambos(o, placa, 0, 0.5, sr);
  ambos(o, mul(filtro(ruido(n, r), 'bp', 900, 1, sr), env(n, sr, 0, 0.001, 0.03)), 0, 0.8, sr);
  ambos(o, mul(filtro(ruido(n, r), 'hp', 3000, 0.7, sr), env(n, sr, 0.11, 0.0005, 0.008)), 0, 0.5, sr);   // el pestillo
  return normal(o, 0.8);
}

// ---------------------------------------------------------------- las voces de las bestias
// fuente: sierra con temblor + aliento, por tres formantes que se mueven; carraspeo y saturacion
function voz(sr, s, r, o) {
  const n = Math.floor(s * sr), src = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, f = o.tono(t) * (1 + 0.02 * Math.sin(TAU * o.vib * t) + 0.012 * r.g());
    ph += f / sr; ph -= Math.floor(ph);
    const saw = 2 * ph - 1, rasp = 1 + o.raspa * Math.sin(TAU * o.fr * t + Math.sin(TAU * 3.3 * t));
    src[i] = (saw * (1 - o.aliento) + (r.u() * 2 - 1) * o.aliento) * rasp;
  }
  const out = new Float32Array(n);
  for (const [fd, q, g] of o.formantes) { const b = bandaMovil(src, fd, q, sr); for (let i = 0; i < n; i++) out[i] += b[i] * g; }
  const e = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / sr; e[i] = Math.min(1, t / o.ataque) * Math.min(1, (s - t) / o.suelta) * (o.forma ? o.forma(t / s) : 1); }
  return sat(mul(out, e), o.sat);
}
export function chillido(sr, sem = 1) {
  const r = azar(2200 + sem * 17), s = r.e(0.75, 1.05), f0 = r.e(330, 520), sube = r.e(1.5, 2.1);
  const a = voz(sr, s, r, {
    tono: (t) => f0 * (1 + (sube - 1) * Math.sin(Math.min(1, t / s) * Math.PI * 0.85)), vib: r.e(7, 12), aliento: 0.28, raspa: 0.55, fr: r.e(38, 62),
    formantes: [[(t) => 760 + 300 * Math.sin(t * 5), 6, 1], [(t) => 1900 + 500 * t, 8, 0.7], [() => 3100, 9, 0.35]],
    ataque: 0.04, suelta: 0.25, sat: 2.2, forma: (u) => 0.7 + 0.3 * Math.sin(u * Math.PI),
  });
  // y la cavidad del pecho: la misma voz una octava abajo, filtrada
  const pecho = filtro(a, 'lp', 600, 0.9, sr);
  for (let i = 0; i < a.length; i++) a[i] = a[i] * 0.8 + pecho[i] * 0.5;
  return normalMono(a, 0.9);
}
export function grunido(sr, sem = 1) {
  const r = azar(1100 + sem * 31), s = r.e(0.9, 1.4), f0 = r.e(62, 88);
  const a = voz(sr, s, r, {
    tono: (t) => f0 * (1 + 0.15 * Math.sin(t * 2.2)), vib: 4, aliento: 0.35, raspa: 0.9, fr: r.e(24, 36),
    formantes: [[(t) => 420 + 80 * Math.sin(t * 3), 4, 1], [(t) => 980 - 120 * t, 6, 0.6], [() => 2300, 7, 0.2]],
    ataque: 0.12, suelta: 0.35, sat: 3, forma: (u) => Math.sin(Math.min(1, u * 1.4) * Math.PI * 0.9),
  });
  return normalMono(a, 0.9);
}

// ---------------------------------------------------------------- el gemido del gigante: una voz enorme que baja
export function gemido(sr, s = 5) {
  const r = azar(8808), o = nuevo(s + 1.2, sr);
  const a = voz(sr, s, r, {
    tono: (t) => 36 * (1 - 0.18 * t / s) * (1 + 0.04 * Math.sin(t * 1.3)), vib: 1.4, aliento: 0.25, raspa: 0.6, fr: 17,
    formantes: [[(t) => 260 + 140 * Math.sin(Math.PI * t / s), 3, 1], [(t) => 620 + 200 * Math.sin(Math.PI * t / s), 4, 0.6], [() => 1500, 5, 0.15]],
    ataque: s * 0.35, suelta: s * 0.45, sat: 1.8,
  });
  const sub = sat(mul(seno(a.length, sr, 30, 26, 2), env(a.length, sr, 0, s * 0.4, s * 0.5)), 1.5);
  for (let i = 0; i < a.length; i++) a[i] = a[i] + sub[i] * 0.6;
  sumar(o.l, a, 0, 1, sr); sumar(o.r, filtro(a, 'lp', 900, 0.7, sr), 0.012, 1, sr);
  ecos(o, sr, [[0.25, 0.35, 700, -0.5], [0.6, 0.2, 500, 0.5]]);
  return normal(o, 0.9);
}

// todo el banco (lo llama el hilo del convoy)
export function banco(sr) {
  return {
    pisada: [1, 2, 3].map((k) => pisada(sr, k)),
    canonazo: canonazo(sr), explosion: explosion(sr), rafaga: rafaga(sr), golpeChapa: golpeChapa(sr), escotilla: escotilla(sr),
    chillido: [1, 2, 3, 4].map((k) => chillido(sr, k)), grunido: [1, 2, 3].map((k) => grunido(sr, k)), gemido: gemido(sr),
  };
}
