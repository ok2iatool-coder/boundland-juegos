// Sonido sintetizado (WebAudio, sin ficheros), como el del juego: el golpe de la caida, el chisporroteo de la vista que
// se raya, el zumbido del conducto y el viento de fuera. Arranca con la primera tecla o clic (el navegador lo exige).
export function crearSonido() {
  let A = null, ruido = null, zumbido = null, viento = null;
  function iniciar() {
    if (A) { if (A.state === 'suspended') A.resume(); return; }
    try { A = new AudioContext(); } catch { return; }
    const n = A.sampleRate * 2, b = A.createBuffer(1, n, A.sampleRate), d = b.getChannelData(0);
    let m = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; m = (m + 0.02 * w) / 1.02; d[i] = i % 2 ? w : m * 3.5; }
    ruido = b;
    const bucle = (f, q, tipo = 'lowpass') => {
      const s = A.createBufferSource(); s.buffer = ruido; s.loop = true;
      const fl = A.createBiquadFilter(); fl.type = tipo; fl.frequency.value = f; fl.Q.value = q;
      const g = A.createGain(); g.gain.value = 0;
      s.connect(fl).connect(g).connect(A.destination); s.start();
      return { g, fl };
    };
    zumbido = bucle(90, 6);
    viento = bucle(420, 0.6);
  }
  function golpe(fuerza = 1) {
    if (!A) return;
    const t = A.currentTime;
    const o = A.createOscillator(), g = A.createGain();
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.35);
    g.gain.setValueAtTime(0.7 * fuerza, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.connect(g).connect(A.destination); o.start(t); o.stop(t + 0.65);
    const s = A.createBufferSource(); s.buffer = ruido;
    const f = A.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g2 = A.createGain(); g2.gain.setValueAtTime(0.5 * fuerza, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    s.connect(f).connect(g2).connect(A.destination); s.start(t, Math.random()); s.stop(t + 1);
  }
  // chisporroteo de la vista rayada: rafagas cortas de ruido agudo y un pitido que se corta
  function raya(fuerza) {
    if (!A || fuerza < 0.05) return;
    const t = A.currentTime;
    const s = A.createBufferSource(); s.buffer = ruido;
    const f = A.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400 + Math.random() * 3000; f.Q.value = 1.4;
    const g = A.createGain(); g.gain.setValueAtTime(0.16 * fuerza, t); g.gain.linearRampToValueAtTime(0, t + 0.08 + 0.1 * fuerza);
    s.connect(f).connect(g).connect(A.destination); s.start(t, Math.random()); s.stop(t + 0.25);
    if (fuerza > 0.4) {
      const o = A.createOscillator(); o.type = 'square'; o.frequency.value = 3800 + Math.random() * 1500;
      const g3 = A.createGain(); g3.gain.setValueAtTime(0.02 * fuerza, t); g3.gain.linearRampToValueAtTime(0, t + 0.12);
      o.connect(g3).connect(A.destination); o.start(t); o.stop(t + 0.13);
    }
  }
  function paso(metal) {
    if (!A) return;
    const t = A.currentTime;
    const s = A.createBufferSource(); s.buffer = ruido;
    const f = A.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = metal ? 1900 : 700; f.Q.value = metal ? 6 : 1.2;
    const g = A.createGain(); g.gain.setValueAtTime(metal ? 0.07 : 0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + (metal ? 0.12 : 0.07));
    s.connect(f).connect(g).connect(A.destination); s.start(t, Math.random()); s.stop(t + 0.15);
  }
  // una pieza que pasa de carton a 3D: un "toc" hueco y corto (el 18, mas grave y con un barrido)
  function pieza(grande = false) {
    if (!A) return;
    const t = A.currentTime;
    const o = A.createOscillator(), g = A.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(grande ? 180 : 420 + Math.random() * 160, t);
    o.frequency.exponentialRampToValueAtTime(grande ? 520 : 260, t + (grande ? 0.35 : 0.09));
    g.gain.setValueAtTime(grande ? 0.12 : 0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + (grande ? 0.5 : 0.14));
    o.connect(g).connect(A.destination); o.start(t); o.stop(t + 0.55);
  }
  // fondo: zumbido dentro (sube en el conducto) y viento fuera
  function ambiente(dentro, fuera) {
    if (!A) return;
    const t = A.currentTime;
    zumbido.g.gain.setTargetAtTime(0.05 + 0.1 * dentro * (1 - fuera), t, 0.3);
    viento.g.gain.setTargetAtTime(0.16 * fuera, t, 0.5);
    viento.fl.frequency.setTargetAtTime(380 + 160 * Math.sin(t * 0.3), t, 0.5);
  }
  // algo grande que pasa muy cerca (el tronco de la cortina del paso por el bosque): un soplo de ruido grave que crece y se va
  function pasa(d = 1.4) {
    if (!A) return;
    const t = A.currentTime;
    const s = A.createBufferSource(); s.buffer = ruido;
    const f = A.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.7;
    f.frequency.setValueAtTime(260, t); f.frequency.linearRampToValueAtTime(520, t + d * 0.5); f.frequency.linearRampToValueAtTime(220, t + d);
    const g = A.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + d * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f).connect(g).connect(A.destination); s.start(t, Math.random()); s.stop(t + d + 0.05);
  }
  return { iniciar, golpe, raya, paso, pieza, ambiente, pasa };
}
