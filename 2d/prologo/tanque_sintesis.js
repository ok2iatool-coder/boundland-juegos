// EL SONIDO DEL CONVOY, sintetizado por piezas como suena de verdad (es el de `escuela/obras/prologo_cine/
// tanque_audio.py`, el del video del prologo, pasado a JS). Puro: sin Web Audio ni DOM, devuelve muestras.
//   motor    un diesel de cuatro tiempos: un golpe de presion por explosion (rpm/60/2 x cilindros), cada cilindro
//            con su fuerza (ese desequilibrio de dos vueltas es el «chug»), pasado por las resonancias del escape y
//            el silencioso; el golpeteo del diesel, el bloque, la caja de cambios y el ventilador
//   orugas   un golpe de acero por eslabon (137 mm) que entra en la rueda motriz, en las dos orugas, mas el clonc
//            de la rueda y los chirridos de los pasadores secos
//   carga    bidones y herramientas que golpean con los baches; suelo: cascotes que crujen y el retumbar
// Todo sale en BUCLE SIN COSTURA: los ritmos dan un numero entero de golpes en el bucle, los golpes que se salen
// por el final vuelven por el principio y los filtros se pasan dos veces (la segunda ya en regimen).

const TAU = Math.PI * 2;

function azar(semilla) {
  let s = semilla >>> 0;
  const u = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const r = { u, entre: (a, b) => a + u() * (b - a), gauss: () => Math.sqrt(-2 * Math.log(u() + 1e-12)) * Math.cos(TAU * u()) };
  return r;
}

// ---------------------------------------------------------------- filtros (RBJ), en bucle
function biquad(tipo, f, q, sr) {
  const w = TAU * f / sr, c = Math.cos(w), al = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (tipo === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
  else if (tipo === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
  else { b0 = al; b1 = 0; b2 = -al; }                 // paso banda de pico 1 (resonador)
  const a0 = 1 + al;
  return [b0 / a0, b1 / a0, b2 / a0, (-2 * c) / a0, (1 - al) / a0];
}
// el filtro sobre la señal en bucle: dos pasadas y se queda la segunda (sin el arranque en frio)
function filtrar(x, coefs) {
  const n = x.length, y = new Float32Array(n);
  const [b0, b1, b2, a1, a2] = coefs;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let pasada = 0; pasada < 2; pasada++) {
    for (let i = 0; i < n; i++) {
      const v = x[i], o = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = v; y2 = y1; y1 = o;
      if (pasada) y[i] = o;
    }
  }
  return y;
}
const lp = (x, f, sr, orden = 4) => (orden >= 4 ? filtrar(filtrar(x, biquad('lp', f, 0.5412, sr)), biquad('lp', f, 1.3066, sr)) : filtrar(x, biquad('lp', f, 0.7071, sr)));
const hp = (x, f, sr) => filtrar(filtrar(x, biquad('hp', f, 0.5412, sr)), biquad('hp', f, 1.3066, sr));
const bp = (x, f1, f2, sr) => lp(hp(x, f1, sr), f2, sr);
const resonador = (x, f, q, sr) => filtrar(x, biquad('bp', f, q, sr));

function norm(x) {
  let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  const k = 1 / (Math.sqrt(s / x.length) + 1e-12);
  for (let i = 0; i < x.length; i++) x[i] *= k;
  return x;
}
function sumar(dst, src, w) { for (let i = 0; i < dst.length; i++) dst[i] += src[i] * w; return dst; }

// algo que varia despacio (gas, baches) y cierra el bucle: unas pocas ondas con un numero entero de vueltas
function lento(n, r, ondas = 4) {
  const y = new Float32Array(n), fs = [];
  for (let k = 1; k <= ondas; k++) fs.push([k, r.entre(0, TAU), 1 / k]);
  let m = 0;
  for (let i = 0; i < n; i++) { let v = 0; for (const [k, f, a] of fs) v += a * Math.sin(TAU * k * i / n + f); y[i] = v; m = Math.max(m, Math.abs(v)); }
  for (let i = 0; i < n; i++) y[i] /= m;
  return y;
}
function ruido(n, r) { const y = new Float32Array(n); for (let i = 0; i < n; i++) y[i] = r.gauss(); return y; }

// los instantes de un ritmo que varia (Hz por muestra) con un numero ENTERO de golpes en el bucle
function eventos(frec, sr, r, multiplo = 1, jitter = 0) {
  const n = frec.length;
  let total = 0; for (let i = 0; i < n; i++) total += frec[i] / sr;
  const golpes = Math.max(multiplo, Math.round(total / multiplo) * multiplo), k = golpes / total;
  // (empezando a media fase: en el bucle caben exactamente `golpes` cruces, sin uno doble en la costura)
  const idx = []; let fase = r.entre(0.2, 0.8), antes = 0;
  for (let i = 0; i < n; i++) {
    fase += frec[i] * k / sr;
    const c = Math.floor(fase);
    if (c > antes) {
      antes = c;
      const s = Math.round(i + (jitter ? r.gauss() * jitter * sr : 0));
      idx.push([((s % n) + n) % n, c]);
    }
  }
  return { idx, escala: k };
}
// un nucleo sumado en cada golpe, dando la vuelta al final del bucle
function estampar(y, i, nucleo, a) { const n = y.length; for (let j = 0; j < nucleo.length; j++) y[(i + j) % n] += nucleo[j] * a; }

function modal(r, modos, fmin, fmax, tau, largo, sr, caidaAgudos = 0.6) {
  const m = Math.floor(largo * sr), k = new Float32Array(m);
  for (let q = 0; q < modos; q++) {
    const f = Math.exp(r.entre(Math.log(fmin), Math.log(fmax)));
    const d = r.entre(tau[0], tau[1]) * Math.pow(fmin / f, 0.35 * caidaAgudos) * 2;
    const a = r.entre(0.3, 1) * Math.pow(fmin / f, 0.25), ph = r.entre(0, TAU);
    for (let i = 0; i < m; i++) { const t = i / sr; k[i] += a * Math.exp(-t / d) * Math.sin(TAU * f * t + ph); }
  }
  let mx = 0; for (let i = 0; i < m; i++) { k[i] *= Math.min(1, i / sr / 0.0004); mx = Math.max(mx, Math.abs(k[i])); }
  for (let i = 0; i < m; i++) k[i] /= mx;
  return k;
}

// ---------------------------------------------------------------- piezas
function motor(n, sr, r, { rpm, cilindros, diesel = true, escape, silencioso }) {
  const fEnc = new Float32Array(n);
  for (let i = 0; i < n; i++) fEnc[i] = rpm[i] / 60 / 2 * cilindros;
  // golpes por ciclo entero (multiplo de los cilindros): la vuelta y el ciclo de dos vueltas tambien cierran
  const { idx, escala } = eventos(fEnc, sr, r, cilindros, 0.00012);
  const fuerza = Array.from({ length: cilindros }, () => r.entre(0.72, 1.15));
  const imp = new Float32Array(n);
  for (const [i, k] of idx) imp[i] += fuerza[k % cilindros] * (1 + 0.07 * r.gauss());
  // el golpe de presion: sube en ~1 ms y cae en ~6
  const pulso = new Float32Array(Math.floor(0.03 * sr));
  for (let i = 0; i < pulso.length; i++) { const t = i / sr; pulso[i] = (1 - Math.exp(-t / 0.0009)) * Math.exp(-t / 0.006); }
  const presion = new Float32Array(n);
  for (let i = 0; i < n; i++) if (imp[i]) estampar(presion, i, pulso, imp[i]);
  const tubo = Float32Array.from(presion, (v) => v * 0.25);
  for (const [f, q, w] of escape) sumar(tubo, resonador(presion, f, q, sr), w);
  const piezas = { escape: norm(lp(tubo, silencioso, sr, 2)) };
  if (diesel) {
    const ch = new Float32Array(Math.floor(0.004 * sr));
    for (let i = 0; i < ch.length; i++) ch[i] = r.gauss() * Math.exp(-i / (0.0008 * sr));
    const g = new Float32Array(n);
    for (let i = 0; i < n; i++) if (imp[i]) estampar(g, i, ch, imp[i]);
    piezas.golpeteo = norm(bp(g, 1100, 5200, sr));
  }
  // la fase de las vueltas sale de la de los encendidos (cilindros/2 encendidos por vuelta)
  const vuelta = new Float32Array(n); let fase = 0;
  for (let i = 0; i < n; i++) { fase += fEnc[i] * escala / sr / (cilindros / 2); vuelta[i] = fase; }
  const bloque = new Float32Array(n), caja = new Float32Array(n), vent = ruido(n, r);
  const ventF = bp(vent, 250, 2600, sr);
  let rmax = 0; for (let i = 0; i < n; i++) rmax = Math.max(rmax, rpm[i]);
  for (let i = 0; i < n; i++) {
    const p = TAU * vuelta[i];
    bloque[i] = Math.sin(p) * 0.6 + Math.sin(p / 2 + 1.1) * 0.8 + 0.3 * Math.sin(2 * p + 0.4);
    caja[i] = Math.sin(p * 29) + 0.5 * Math.sin(p * 47);
    ventF[i] *= (1 + 0.25 * Math.sin(p * 48)) * (rpm[i] / rmax);
  }
  piezas.bloque = norm(bloque); piezas.caja = norm(caja); piezas.ventilador = norm(ventF);
  return piezas;
}

function orugas(n, sr, r, vel, paso = 0.137) {
  const eslabones = Array.from({ length: 5 }, () => modal(r, 12, 520, 5200, [0.006, 0.03], 0.09, sr));
  const rueda = Array.from({ length: 3 }, () => modal(r, 6, 110, 520, [0.02, 0.07], 0.2, sr, 0.3));
  const chapas = new Float32Array(n), clonc = new Float32Array(n), baches = lento(n, r, 6);
  for (let lado = 0; lado < 2; lado++) {
    const f = new Float32Array(n).fill(vel / paso * (1 + 0.013 * lado));
    const { idx } = eventos(f, sr, r, 1, 0.0006);
    for (const [i] of idx) {
      const b = 0.5 + 0.5 * baches[i];
      estampar(chapas, i, eslabones[Math.floor(r.u() * eslabones.length)], r.entre(0.45, 1) * (0.7 + 0.6 * b));
      estampar(clonc, i, rueda[Math.floor(r.u() * rueda.length)], r.entre(0.6, 1));
    }
  }
  // chirridos de friccion: tonos agudos que tiemblan y se cortan
  const chirrido = new Float32Array(n), ritmo = 1.2 + 0.5 * vel;
  let t = r.entre(0, 0.3);
  while (t < n / sr) {
    const i0 = Math.floor(t * sr), d = Math.floor(r.entre(0.07, 0.38) * sr), f0 = r.entre(1700, 4300);
    const vibA = r.entre(0.006, 0.02), vibF = r.entre(7, 16), deriva = r.entre(-0.04, 0.04), a = r.entre(0.3, 1);
    let ph1 = 0, ph2 = 0;
    for (let j = 0; j < d; j++) {
      const tt = j / sr, fr = f0 * (1 + vibA * Math.sin(TAU * vibF * tt) + deriva * j / d);
      ph1 += TAU * fr / sr; ph2 += TAU * 2.01 * fr / sr;
      const env = Math.min(1, tt / 0.012) * Math.min(1, (d - j) / sr / 0.03) * (0.6 + 0.4 * Math.sin(Math.PI * j / d));
      chirrido[(i0 + j) % n] += (Math.sin(ph1) + 0.35 * Math.sin(ph2)) * env * a;
    }
    t += -Math.log(1 - r.u() + 1e-12) / ritmo;
  }
  return { eslabones: norm(chapas), rueda: norm(clonc), chirrido: norm(chirrido) };
}

function carga(n, sr, r, ritmo = 3) {
  const golpes = Array.from({ length: 4 }, () => modal(r, 8, 180, 2400, [0.02, 0.12], 0.35, sr, 0.5));
  const y = new Float32Array(n), cuantos = Math.round(ritmo * n / sr);
  for (let q = 0; q < cuantos; q++) estampar(y, Math.floor(r.u() * n), golpes[Math.floor(r.u() * golpes.length)], r.entre(0.2, 1));
  return norm(y);
}

function suelo(n, sr, r, vel, peso = 1) {
  const granos = new Float32Array(n), cuantos = Math.round(260 * vel / 5.6 * n / sr);
  for (let q = 0; q < cuantos; q++) {
    const i0 = Math.floor(r.u() * n), d = Math.max(2, Math.floor(r.entre(0.0006, 0.004) * sr)), a = r.entre(0.1, 1);
    for (let j = 0; j < d; j++) granos[(i0 + j) % n] += r.gauss() * Math.exp(-j / (d / 3)) * a;
  }
  const ret = lp(ruido(n, r), 55, sr), mod = lento(n, r, 8);
  for (let i = 0; i < n; i++) ret[i] *= (0.6 + 0.4 * mod[i]) * peso;
  return { granos: norm(bp(granos, 700, 7000, sr)), retumbe: norm(ret) };
}

function rpmDe(n, r, base, var_ = 0.035) {
  const g = lento(n, r), y = new Float32Array(n);
  for (let i = 0; i < n; i++) y[i] = base * (1 + var_ * g[i]);
  return y;
}

// ---------------------------------------------------------------- los vehiculos (mono, como suenan a 5 m)
export function tanque(segundos = 6, sr = 48000, semilla = 47, vel = 5.6) {
  const n = Math.floor(segundos * sr), r = azar(semilla);
  const m = motor(n, sr, r, { rpm: rpmDe(n, r, 1550), cilindros: 12, escape: [[72, 2.5, 1], [165, 3, 0.7], [390, 4, 0.35]], silencioso: 950 });
  const o = orugas(n, sr, r, vel), s = suelo(n, sr, r, vel);
  const y = new Float32Array(n);
  sumar(y, m.escape, 0.95); sumar(y, m.golpeteo, 0.22); sumar(y, m.bloque, 0.35); sumar(y, m.caja, 0.05); sumar(y, m.ventilador, 0.22);
  sumar(y, o.eslabones, 1.0); sumar(y, o.rueda, 0.55); sumar(y, o.chirrido, 0.28);
  sumar(y, carga(n, sr, r), 0.28); sumar(y, s.granos, 0.3); sumar(y, s.retumbe, 0.7);
  return pico(y);
}

// el resto del convoy: el camion (diesel de seis) y el jeep (gasolina de cuatro), con sus ruedas
export function convoy(segundos = 6, sr = 48000, semilla = 52) {
  const n = Math.floor(segundos * sr), r = azar(semilla);
  const cam = motor(n, sr, r, { rpm: rpmDe(n, r, 1750, 0.04), cilindros: 6, escape: [[95, 2.5, 1], [230, 3, 0.6], [520, 4, 0.3]], silencioso: 1200 });
  const jeep = motor(n, sr, r, { rpm: rpmDe(n, r, 2600, 0.05), cilindros: 4, diesel: false, escape: [[110, 3, 1], [260, 3.5, 0.7], [640, 5, 0.3]], silencioso: 1600 });
  const rodar = norm(bp(ruido(n, r), 250, 2500, sr)), s = suelo(n, sr, r, 5.6, 0.4);
  const y = new Float32Array(n);
  sumar(y, cam.escape, 0.9); sumar(y, cam.golpeteo, 0.3); sumar(y, cam.bloque, 0.2); sumar(y, cam.caja, 0.05); sumar(y, cam.ventilador, 0.25);
  sumar(y, jeep.escape, 0.6); sumar(y, jeep.bloque, 0.15); sumar(y, jeep.ventilador, 0.12);
  sumar(y, rodar, 0.35); sumar(y, carga(n, sr, r, 2), 0.3); sumar(y, s.granos, 0.3);
  return pico(y);
}

function pico(y) { let m = 0; for (let i = 0; i < y.length; i++) m = Math.max(m, Math.abs(y[i])); for (let i = 0; i < y.length; i++) y[i] *= 0.9 / m; return y; }
