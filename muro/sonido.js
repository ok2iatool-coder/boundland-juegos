// Sonido sintetizado con WebAudio: viento, zumbido grave que crece con la revelacion, chasquido de los
// focos, zumbido electrico, chirrido de la letra colgando, el golpe de chapa y el polvo. Un eco largo
// (el muro devuelve el sonido) en una convolucion hecha con ruido.

let A = null, maestro, eco, viento, vientoG, vientoF, dron = [], dronG, zumbido = null;

function ruido(seg) {
  const b = A.createBuffer(1, A.sampleRate * seg, A.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

export function iniciarSonido() {
  if (A) { if (A.state === 'suspended') A.resume(); return; }
  A = new (window.AudioContext || window.webkitAudioContext)();
  const comp = A.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 4;
  comp.connect(A.destination);
  maestro = A.createGain();
  maestro.gain.value = 0.8;
  maestro.connect(comp);
  // eco: ruido que decae 4 s, con un rebote a los 0,3 s (el muro)
  const ir = A.createBuffer(2, A.sampleRate * 4, A.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < d.length; i++) {
      const t = i / A.sampleRate;
      d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 1.6) * (t < 0.02 ? t / 0.02 : 1) * (Math.abs(t - 0.32) < 0.03 ? 2.2 : 1);
    }
  }
  eco = A.createConvolver();
  eco.buffer = ir;
  const ecoG = A.createGain();
  ecoG.gain.value = 0.35;
  eco.connect(ecoG).connect(maestro);
  // viento continuo
  viento = A.createBufferSource();
  viento.buffer = ruido(4);
  viento.loop = true;
  vientoF = A.createBiquadFilter();
  vientoF.type = 'bandpass';
  vientoF.frequency.value = 420;
  vientoF.Q.value = 0.7;
  vientoG = A.createGain();
  vientoG.gain.value = 0.07;
  viento.connect(vientoF).connect(vientoG).connect(maestro);
  vientoG.connect(eco);
  viento.start();
  // dron grave (la menor sin tercera al principio)
  dronG = A.createGain();
  dronG.gain.value = 0;
  const lp = A.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 260;
  dronG.connect(lp).connect(maestro);
  lp.connect(eco);
  for (const [f, tipo, g] of [[55, 'sawtooth', 0.22], [55.35, 'sawtooth', 0.22], [82.4, 'triangle', 0.18], [110, 'sine', 0.12]]) {
    const o = A.createOscillator();
    o.type = tipo;
    o.frequency.value = f;
    const og = A.createGain();
    og.gain.value = g;
    o.connect(og).connect(dronG);
    o.start();
    dron.push(og);
  }
}

export const sonidoListo = () => !!A;
const ahora = () => A.currentTime;

// cada fotograma: el viento respira solo
export function vientoVivo(t, fuerza) {
  if (!A) return;
  const f = 380 + Math.sin(t * 0.31) * 120 + Math.sin(t * 0.83) * 60;
  vientoF.frequency.setTargetAtTime(f, ahora(), 0.3);
  vientoG.gain.setTargetAtTime((0.05 + 0.03 * (Math.sin(t * 0.47) * 0.5 + 0.5)) * fuerza, ahora(), 0.4);
}

export function dronA(nivel, seg = 2) {
  if (!A) return;
  dronG.gain.cancelScheduledValues(ahora());
  dronG.gain.setValueAtTime(dronG.gain.value, ahora());
  dronG.gain.linearRampToValueAtTime(nivel, ahora() + seg);
}

function envolvente(nodo, t0, ataque, pico, caida) {
  nodo.gain.setValueAtTime(0, t0);
  nodo.gain.linearRampToValueAtTime(pico, t0 + ataque);
  nodo.gain.exponentialRampToValueAtTime(0.0001, t0 + ataque + caida);
}

function golpeRuido(t0, frec, q, pico, caida, tipo = 'bandpass', conEco = 0.6) {
  const s = A.createBufferSource();
  s.buffer = ruido(Math.max(0.2, caida + 0.1));
  const f = A.createBiquadFilter();
  f.type = tipo;
  f.frequency.value = frec;
  f.Q.value = q;
  const g = A.createGain();
  envolvente(g, t0, 0.003, pico, caida);
  s.connect(f).connect(g).connect(maestro);
  if (conEco) { const e = A.createGain(); e.gain.value = conEco; g.connect(e).connect(eco); }
  s.start(t0);
  s.stop(t0 + caida + 0.2);
}

function tono(t0, frec, tipo, pico, caida, glide = 0, conEco = 0.5) {
  const o = A.createOscillator();
  o.type = tipo;
  o.frequency.setValueAtTime(frec, t0);
  if (glide) o.frequency.exponentialRampToValueAtTime(frec * glide, t0 + caida);
  const g = A.createGain();
  envolvente(g, t0, 0.004, pico, caida);
  o.connect(g).connect(maestro);
  if (conEco) { const e = A.createGain(); e.gain.value = conEco; g.connect(e).connect(eco); }
  o.start(t0);
  o.stop(t0 + caida + 0.1);
}

// paso: un roce corto sobre grava
export function paso(fuerte = 0.5) {
  if (!A) return;
  golpeRuido(ahora(), 900 + Math.random() * 500, 1.2, 0.05 * fuerte, 0.09, 'bandpass', 0.2);
}

// el rele del foco: clac seco + golpe grave, y el arco que tarda en estabilizarse
export function clac() {
  if (!A) return;
  const t = ahora();
  golpeRuido(t, 2600, 2, 0.35, 0.05, 'highpass', 0.9);
  tono(t, 80, 'sine', 0.35, 0.25, 0.6, 0.8);
  golpeRuido(t + 0.04, 160, 1, 0.12, 0.6, 'lowpass', 0.6);
}

// zumbido de un foco que falla (se queda sonando bajito y parpadea con la luz)
export function zumbidoFoco(nivel) {
  if (!A) return;
  if (!zumbido) {
    const o = A.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 100;
    const f = A.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 600;
    f.Q.value = 3;
    const g = A.createGain();
    g.gain.value = 0;
    o.connect(f).connect(g).connect(maestro);
    o.start();
    zumbido = g;
  }
  zumbido.gain.setTargetAtTime(nivel * 0.05, ahora(), 0.02);
}

// focos del cartel: tres golpes huecos
export function focosCartel(i) {
  if (!A) return;
  const t = ahora();
  golpeRuido(t, 1800, 3, 0.2, 0.04, 'bandpass', 0.8);
  tono(t, 120 + i * 9, 'triangle', 0.2, 0.3, 0.7, 0.8);
}

// pajaros que salen del muro
export function aleteo() {
  if (!A) return;
  const t = ahora();
  for (let i = 0; i < 26; i++) golpeRuido(t + i * 0.05 + Math.random() * 0.04, 700 + Math.random() * 900, 1.5, 0.05 + Math.random() * 0.04, 0.05, 'bandpass', 0.5);
}

// el tornillo que salta: chasquido metalico agudo
export function tornillo() {
  if (!A) return;
  const t = ahora();
  tono(t, 2400, 'sine', 0.22, 0.35, 0.9, 0.9);
  tono(t, 3710, 'sine', 0.12, 0.25, 0.95, 0.9);
  golpeRuido(t, 5000, 1, 0.15, 0.03, 'highpass', 0.6);
}

// la letra colgando de un tornillo: chirrido que sube y baja con el balanceo
let chirrido = null;
export function chirriar(v) {
  if (!A) return;
  if (!chirrido) {
    const o = A.createOscillator();
    o.type = 'square';
    o.frequency.value = 300;
    const f = A.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900;
    f.Q.value = 14;
    const g = A.createGain();
    g.gain.value = 0;
    o.connect(f).connect(g).connect(maestro);
    const e = A.createGain();
    e.gain.value = 0.7;
    g.connect(e).connect(eco);
    o.start();
    chirrido = { o, f, g };
  }
  const a = Math.min(1, Math.abs(v) / 1.8);
  chirrido.o.frequency.setTargetAtTime(220 + a * 160, ahora(), 0.03);
  chirrido.f.frequency.setTargetAtTime(700 + a * 600, ahora(), 0.03);
  chirrido.g.gain.setTargetAtTime(a * a * 0.09, ahora(), 0.04);
}

// zumbido del aire mientras cae
let caida = null;
export function silbidoCaida(nivel) {
  if (!A) return;
  if (!caida) {
    const s = A.createBufferSource();
    s.buffer = ruido(3);
    s.loop = true;
    const f = A.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 500;
    f.Q.value = 2;
    const g = A.createGain();
    g.gain.value = 0;
    s.connect(f).connect(g).connect(maestro);
    s.start();
    caida = { f, g };
  }
  caida.f.frequency.setTargetAtTime(400 + nivel * 900, ahora(), 0.05);
  caida.g.gain.setTargetAtTime(nivel * 0.06, ahora(), 0.05);
}

// el golpe contra el suelo: chapa (parciales que no casan) + golpe sordo + polvo y cascotes
export function golpeChapa() {
  if (!A) return;
  const t = ahora();
  tono(t, 52, 'sine', 0.9, 0.7, 0.55, 0.9);
  golpeRuido(t, 220, 0.8, 0.7, 0.5, 'lowpass', 1);
  for (const [f, g, d] of [[187, 0.18, 2.4], [301, 0.15, 2.0], [468, 0.12, 1.7], [693, 0.1, 1.4], [1021, 0.07, 1.1], [1497, 0.05, 0.8]]) tono(t + 0.005, f, 'sine', g, d, 0.985, 1.1);
  golpeRuido(t + 0.02, 1400, 0.6, 0.25, 1.4, 'bandpass', 0.8);
  for (let i = 0; i < 14; i++) golpeRuido(t + 0.15 + Math.random() * 1.2, 2000 + Math.random() * 2500, 4, 0.04 + Math.random() * 0.05, 0.06, 'bandpass', 0.6);
}

// suspiro de aire grave al final (el 18 lo asimila)
export function respiro() {
  if (!A) return;
  const t = ahora();
  const s = A.createBufferSource();
  s.buffer = ruido(2);
  const f = A.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(900, t);
  f.frequency.linearRampToValueAtTime(500, t + 1.2);
  f.Q.value = 1.5;
  const g = A.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.05, t + 0.35);
  g.gain.linearRampToValueAtTime(0, t + 1.3);
  s.connect(f).connect(g).connect(maestro);
  s.start(t);
  s.stop(t + 1.5);
}
