// EL SONIDO DEL PROLOGO, sintetizado sobre el Sonido del juego (sus buses, su reverb y sus ruidos):
//   motores    dos bucles sintetizados por piezas en `tanque_sintesis.js` (en un hilo aparte, al empezar): el resto
//              del convoy (camion diesel y jeep) y el TANQUE (V12 diesel, orugas de acero eslabon a eslabon,
//              chirridos, carga y cascotes); su volumen, paneo y agudos siguen a los vehiculos que hay cerca
//   bestias    chillidos (sierra con vibrato y barrido) y gruñidos
//   armas      el cañonazo, la explosion con cascotes, rafagas de ametralladora lejanas
//   gigante    la PISADA (un golpe por debajo de lo que se oye bien, con el retumbar y la gravilla que cae), un
//              gemido grave y largo, el zumbido raro del ojo, y un acorde grave sostenido mientras pasa
// Bajo tierra (`sordo`) todo se apaga por arriba: el mismo golpe suena como a traves de la roca.
// Desde el 2026-10-20 los golpes y las voces son MUESTRAS sintetizadas por capas (sonidos_banco.js: transitorio,
// cuerpo, grave saturado, cola, cascotes y ecos de la calle) que se reproducen con su paneo, su distancia (filtro) y
// algo de variacion de tono; los de antes, al vuelo, solo si el banco aun no ha llegado del hilo.
import { tanque as sintTanque, convoy as sintConvoy } from './tanque_sintesis.js';

const az = (a, b) => a + Math.random() * (b - a);
const SR_CONVOY = 48000;

export class SonidoPrologo {
  constructor(son) {
    this.son = son; this.motor = null; this.acorde = null; this.sordo = 0; this.muestras = null;
    // el convoy se sintetiza en otro hilo mientras el prologo carga en negro (si no hay hilos, al arrancar)
    try {
      const w = new Worker(new URL('./convoy_obrero.js', import.meta.url), { type: 'module' });
      w.onmessage = (e) => { this.muestras = e.data; this.banco = e.data.banco; w.terminate(); };
      w.onerror = () => w.terminate();
      w.postMessage({ sr: SR_CONVOY });
    } catch { /* sin hilos */ }
  }
  get ctx() { return this.son.ctx; }

  // ---------------------------------------------------------------- capas continuas
  arrancarMotor() {
    const ctx = this.ctx; if (!ctx || this.motor) return;
    if (!this.muestras) this.muestras = { sr: SR_CONVOY, tanque: sintTanque(6, SR_CONVOY), convoy: sintConvoy(6, SR_CONVOY) };
    const t = ctx.currentTime, g = ctx.createGain(); g.gain.value = 0.0001;
    // lo lejano pierde los agudos: el filtro se abre al acercarse
    const pan = ctx.createStereoPanner(), fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 900; fl.Q.value = 0.5;
    const capa = (datos, vol) => {
      const b = ctx.createBuffer(1, datos.length, this.muestras.sr); b.copyToChannel(datos, 0);
      const s = this.son.fuente(b, true), ga = ctx.createGain(); ga.gain.value = vol;
      s.connect(ga).connect(fl); s.start(t, Math.random() * b.duration);
      return { s, ga };
    };
    const tq = capa(this.muestras.tanque, 0.0001), cv = capa(this.muestras.convoy, 1);
    fl.connect(g).connect(pan);
    pan.connect(this.son.efectos);
    const rv = ctx.createGain(); rv.gain.value = 0.22; pan.connect(rv).connect(this.son.reverb);
    this.motor = { g, pan, fl, tq, cv, os: [tq.s, cv.s] };
  }
  // v: 0-1 lo cerca que pasa el convoy; x: -1 izquierda, 1 derecha; tanque: 0-1 si lo que suena es un tanque
  motorEn(v, x, tanque) {
    if (!this.ctx) return;
    if (!this.motor && v > 0.01) this.arrancarMotor();
    if (!this.motor) return;
    const t = this.ctx.currentTime, m = this.motor;
    m.g.gain.setTargetAtTime(Math.max(0.0001, v * 0.42 * (1 - this.sordo * 0.8)), t, 0.15);
    m.tq.ga.gain.setTargetAtTime(Math.max(0.0001, tanque * 1.15), t, 0.25);
    m.cv.ga.gain.setTargetAtTime(Math.max(0.0001, 1 - 0.55 * tanque), t, 0.25);
    m.pan.pan.setTargetAtTime(Math.max(-0.9, Math.min(0.9, x)), t, 0.2);
    m.fl.frequency.setTargetAtTime(Math.max(300, 900 + v * v * 11000 - this.sordo * 9000), t, 0.2);
  }
  pararMotor() {
    if (!this.motor) return;
    const m = this.motor, t = this.ctx.currentTime;
    m.g.gain.setTargetAtTime(0.0001, t, 0.6);
    setTimeout(() => { for (const o of m.os) try { o.stop(); } catch { /* parada */ } }, 4000);
    this.motor = null;
  }
  // el acorde grave mientras pasa el gigante (re menor, muy abajo), con su hinchazon lenta
  arrancarAcorde() {
    const ctx = this.ctx; if (!ctx || this.acorde) return;
    const t = ctx.currentTime, g = ctx.createGain(); g.gain.value = 0.0001; g.gain.setTargetAtTime(0.09, t, 3);
    const os = [];
    for (const [f, v] of [[36.71, 0.6], [55, 0.4], [73.42, 0.35], [87.31, 0.18], [110, 0.12]]) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.05 + Math.random() * 0.08; lg.gain.value = 0.6; lfo.connect(lg).connect(o.frequency); lfo.start(t);
      const ga = ctx.createGain(); ga.gain.value = v; o.connect(ga).connect(g); o.start(t); os.push(o, lfo);
    }
    this.son.salida(g, 'musica', 0.9);
    this.acorde = { g, os };
  }
  pararAcorde(dur = 4) {
    if (!this.acorde) return;
    const a = this.acorde, t = this.ctx.currentTime;
    a.g.gain.setTargetAtTime(0.0001, t, dur / 3);
    setTimeout(() => { for (const o of a.os) try { o.stop(); } catch { /* parada */ } }, dur * 1500);
    this.acorde = null;
  }
  parar() { this.pararMotor(); this.pararAcorde(1); }

  // ---------------------------------------------------------------- las muestras del banco
  // datos: { l, r } o Float32Array; o: { vol, pan, rev, tono (playbackRate), lp (Hz, la distancia), retraso (s) }
  muestra(datos, o = {}) {
    const ctx = this.ctx; if (!ctx || !datos) return false;
    this.buffers = this.buffers || new Map();
    let b = this.buffers.get(datos);
    if (!b) {
      const est = !(datos instanceof Float32Array), n = est ? datos.l.length : datos.length;
      b = ctx.createBuffer(est ? 2 : 1, n, this.muestras.sr);
      if (est) { b.copyToChannel(datos.l, 0); b.copyToChannel(datos.r, 1); } else b.copyToChannel(datos, 0);
      this.buffers.set(datos, b);
    }
    const t = ctx.currentTime + (o.retraso || 0), src = this.son.fuente(b), g = ctx.createGain();
    src.playbackRate.value = o.tono || 1;
    g.gain.value = (o.vol ?? 1) * (1 - this.sordo * 0.35);
    let ult = src;
    const lp = Math.min(o.lp || 20000, 20000 - this.sordo * 18500);
    if (lp < 19000) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = Math.max(200, lp); f.Q.value = 0.6; ult.connect(f); ult = f; }
    ult.connect(g); this.son.salida(g, 'efectos', o.rev ?? 0.25, o.pan || 0);
    src.start(t);
    return true;
  }
  uno(lista) { return Array.isArray(lista) ? lista[Math.floor(Math.random() * lista.length)] : lista; }

  // ---------------------------------------------------------------- golpes sueltos
  chillido(x = 0, k = 1) {
    if (this.banco && this.muestra(this.uno(this.banco.chillido), { vol: 0.32, pan: x, rev: 0.35, tono: az(0.88, 1.12) * Math.min(1.25, k), lp: 9000 - Math.abs(x) * 4000 })) return;
    const s = this.son, f = az(380, 620) * k;
    s.tono(f, az(0.5, 0.9), 'sawtooth', 0.05, 0.5, x, f * az(1.6, 2.2));
    s.tono(f * 1.5, az(0.4, 0.7), 'square', 0.015, 0.5, x, f * az(0.8, 1.1));
    s.soplo(0.5, az(1800, 2600), 3, 0.05, 0.4, x, az(900, 1300));
  }
  // una bestia cae encima del tanque: golpe de chapa hueca y las garras que rascan
  golpeChapa(x = 0) {
    if (this.banco && this.muestra(this.banco.golpeChapa, { vol: 0.55, pan: x, rev: 0.3, tono: az(0.94, 1.06) })) return;
    const s = this.son;
    s.tono(150, 0.32, 'triangle', 0.22, 0.45, x, 88);
    s.tono(410, 0.5, 'sine', 0.05, 0.6, x, 380);                        // la chapa que resuena
    s.soplo(0.09, 2400, 1.4, 0.16, 0.3, x, 1300, 'highpass');
    for (let k = 0; k < 4; k++) setTimeout(() => s.soplo(0.07, az(3000, 5200), 6, 0.05, 0.3, x, az(2000, 3000)), 90 + k * az(50, 90));
  }
  // la escotilla del tanque que se cierra de golpe
  escotilla(x = 0) { if (this.banco && this.muestra(this.banco.escotilla, { vol: 0.42, pan: x, rev: 0.25 })) return; const s = this.son; s.tono(220, 0.18, 'square', 0.05, 0.4, x, 120); s.soplo(0.06, 1800, 2, 0.12, 0.3, x, 900); }
  grunido(x = 0) { if (this.banco && this.muestra(this.uno(this.banco.grunido), { vol: 0.38, pan: x, rev: 0.3, tono: az(0.85, 1.1), lp: 5000 })) return; this.son.tono(az(70, 95), az(0.6, 1), 'sawtooth', 0.06, 0.3, x, az(50, 60)); this.son.soplo(0.6, 300, 2, 0.05, 0.3, x, 150, 'bandpass', true); }
  canonazo(x = 0) {
    if (this.banco && this.muestra(this.banco.canonazo, { vol: 1, pan: x, rev: 0.35 })) { this.son.agachar(0.6, 1.2); return; }
    const s = this.son;
    s.soplo(0.07, 3200, 1, 0.5, 0.2, x, 1200);                       // el chasquido
    s.soplo(1.4, 220, 0.6, 1.0, 0.7, x, 40, 'lowpass', true);         // la onda
    s.tono(62, 1.2, 'sine', 0.85, 0.5, x, 26);
    s.agachar(0.6, 1.2);
  }
  explosion(x = 0) {
    if (this.banco && this.muestra(this.banco.explosion, { vol: 1, pan: x, rev: 0.4 })) { this.son.agachar(0.5, 1.4); return; }
    const s = this.son;
    s.soplo(2.2, 420, 0.5, 0.9, 0.8, x, 50, 'lowpass', true);
    s.tono(48, 1.6, 'sine', 0.7, 0.6, x, 22);
    s.soplo(0.4, 1800, 1, 0.3, 0.3, x, 400);
    // los cascotes que caen despues
    for (let k = 0; k < 9; k++) setTimeout(() => s.soplo(0.05, az(1500, 3500), 3, az(0.03, 0.08), 0.3, x + az(-0.3, 0.3)), 500 + k * az(70, 160));
  }
  rafaga(x = 0.8, n = 8) {
    if (this.banco && this.muestra(this.banco.rafaga, { vol: 0.38, pan: x, rev: 0.5, tono: az(0.94, 1.04), lp: 3500 })) return;
    const s = this.son;
    for (let k = 0; k < n; k++) setTimeout(() => { s.soplo(0.05, az(900, 1300), 1.5, 0.09, 0.6, x); s.tono(160, 0.05, 'square', 0.02, 0.5, x, 90); }, k * 95 + az(0, 20));
  }
  // la pisada del gigante; k 0-1 (lo cerca que esta), bajo tierra mas sorda
  pisada(k = 1) {
    // (lejos: mas baja, mas grave y sin los agudos de los cascotes)
    if (this.banco && this.muestra(this.uno(this.banco.pisada), { vol: Math.min(1, 0.95 * k), rev: 0.4, tono: az(0.93, 1.03) * (0.92 + 0.08 * Math.min(1, k)), lp: 2500 + 15000 * Math.min(1, k) ** 2 })) { this.son.agachar(0.5 * k, 0.8); return; }
    const s = this.son, sordo = this.sordo;
    // el cuerpo del golpe donde se oye tambien en altavoces pequenos (90-120 Hz) y el chasquido seco del impacto
    s.tono(118, 0.42, 'sine', 0.5 * k * (1 - sordo * 0.4), 0.45, 0, 46, 'efectos', 0.002);
    s.soplo(0.16, 320, 0.9, 0.55 * k * (1 - sordo * 0.5), 0.4, 0, 110, 'lowpass', true);
    if (sordo < 0.5) setTimeout(() => { for (let q = 0; q < 5; q++) s.tono(2600 + Math.random() * 2400, 0.05, 'triangle', 0.012 * k, 0.4, Math.random() * 1.6 - 0.8, 2200); }, 140);   // los cristales de las ventanas
    s.tono(36, 1.8, 'sine', 0.95 * k, 0.6, 0, 21);
    s.tono(54, 0.9, 'triangle', 0.35 * k * (1 - sordo * 0.6), 0.5, 0, 30);
    s.soplo(1.6, 140 - sordo * 60, 0.5, 0.8 * k, 0.8, 0, 32, 'lowpass', true);
    // lo que tiembla: cristales y gravilla (arriba) o tierra que cae (abajo)
    if (sordo < 0.5) for (let q = 0; q < 6; q++) setTimeout(() => s.soplo(0.04, az(2500, 4500), 5, 0.025 * k, 0.4, az(-0.8, 0.8)), 120 + q * az(40, 120));
    else s.soplo(1.2, 900, 1, 0.05 * k, 0.5, 0, 300, 'bandpass', true);
    s.agachar(0.5 * k, 0.8);
  }
  gemido(dur = 4.5) {
    const ctx = this.ctx; if (!ctx) return;
    if (this.banco && this.muestra(this.banco.gemido, { vol: 0.55, pan: -0.2, rev: 0.6, tono: 4.5 / Math.max(3, dur) * 0.95 + 0.05 })) return;
    const t = ctx.currentTime, g = ctx.createGain(); g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.16, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 160; fl.Q.value = 3;
    for (const [f0, f1] of [[31, 26], [46.5, 38], [62, 55]]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      o.connect(fl); o.start(t); o.stop(t + dur + 0.1);
    }
    fl.connect(g); this.son.salida(g, 'efectos', 0.9, -0.2);
  }
  // el ojo: dos notas que baten y bajan, y todo lo demas se calla
  ojo() {
    const s = this.son;
    s.agachar(0.85, 3.5);
    s.tono(233.1, 3.2, 'sine', 0.05, 0.95, 0, 207.7, 'efectos', 0.6);
    s.tono(236.2, 3.2, 'sine', 0.05, 0.95, 0, 207.7, 'efectos', 0.6);
    s.tono(466, 2.4, 'sine', 0.012, 0.95, 0, 415, 'efectos', 0.9);
    s.soplo(2.5, 600, 6, 0.02, 0.9, 0, 300, 'bandpass', true);
  }
}
