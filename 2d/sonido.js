// Sonido de Boundland, todo sintetizado con Web Audio (sin ficheros). Buses: general -> musica, efectos.
// Ambiente por zona (GDD): laboratorio = drones graves, goteo, chirridos lejanos; ciudad = viento y metal
// que cruje; gravedad cero = el sonido se apaga y entra una nota sostenida; hospital = zumbido.
const az = (a, b) => a + Math.random() * (b - a);
const RE_MENOR = [146.83, 174.61, 196.0, 220.0, 261.63, 293.66, 349.23, 392.0, 440.0];

export class Sonido {
  constructor() { this.ctx = null; this.niveles = { general: 0.8, musica: 0.8, efectos: 0.8 }; this.zona = null; this.capas = []; this.relojes = []; this.ultimo = {}; }

  arrancar() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    const ctx = this.ctx = new C();
    this.general = ctx.createGain(); this.musica = ctx.createGain(); this.efectos = ctx.createGain();
    this.musica.connect(this.general); this.efectos.connect(this.general); this.general.connect(ctx.destination);
    this.reverb = ctx.createConvolver(); this.reverb.buffer = this.respuesta(3.4, 2.4);
    this.rg = ctx.createGain(); this.rg.gain.value = 0.5; this.reverb.connect(this.rg).connect(this.general);
    this.blanco = this.ruido(2, false); this.marron = this.ruido(4, true);
    this.aplicar();
    if (this.zonaPendiente) this.ambiente(this.zonaPendiente);
  }
  curva(v) { return v * v; }
  poner(bus, v) { this.niveles[bus] = v; if (this.ctx) this.aplicar(); }
  aplicar() {
    const t = this.ctx.currentTime;
    this.general.gain.setTargetAtTime(this.curva(this.niveles.general), t, 0.05);
    this.musica.gain.setTargetAtTime(this.curva(this.niveles.musica), t, 0.05);
    this.efectos.gain.setTargetAtTime(this.curva(this.niveles.efectos), t, 0.05);
  }
  respuesta(s, caida) {
    const n = Math.floor(this.ctx.sampleRate * s), b = this.ctx.createBuffer(2, n, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, caida); }
    return b;
  }
  ruido(s, marron) {
    const n = Math.floor(this.ctx.sampleRate * s), b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = b.getChannelData(0);
    let u = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (marron) { u = (u + 0.02 * w) / 1.02; d[i] = u * 3.5; } else d[i] = w; }
    return b;
  }
  fuente(buf, bucle = false) { const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = bucle; return s; }
  salida(nodo, bus = 'efectos', rev = 0.25, pan = 0) {
    const p = this.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
    nodo.connect(p); p.connect(bus === 'musica' ? this.musica : this.efectos);
    if (rev > 0) { const g = this.ctx.createGain(); g.gain.value = rev; p.connect(g); g.connect(this.reverb); }
  }
  // envolvente rapida
  env(g, t, a, d, pico = 1) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(pico, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }

  tono(f, dur, tipo = 'sine', vol = 0.2, rev = 0.3, pan = 0, f2 = null, bus = 'efectos', ataque = 0.005) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = tipo; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    this.env(g, t, ataque, dur, vol);
    o.connect(g); this.salida(g, bus, rev, pan);
    o.start(t); o.stop(t + ataque + dur + 0.05);
  }
  soplo(dur, f, q, vol, rev = 0.2, pan = 0, f2 = null, tipo = 'bandpass', marron = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, s = this.fuente(marron ? this.marron : this.blanco), fl = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    fl.type = tipo; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    this.env(g, t, 0.004, dur, vol);
    s.connect(fl).connect(g); this.salida(g, 'efectos', rev, pan);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  // ---------------------------------------------------------------- ambiente
  ambiente(zona) {
    if (!this.ctx) { this.zonaPendiente = zona; return; }
    if (this.zona === zona) return;
    this.zona = zona;
    const t = this.ctx.currentTime;
    for (const c of this.capas) { c.g.gain.setTargetAtTime(0.0001, t, 0.8); setTimeout(() => { try { c.s.stop(); } catch { /* ya parada */ } }, 4000); }
    this.capas = [];
    for (const r of this.relojes) clearTimeout(r);
    this.relojes = [];
    const capa = (crear, vol) => {
      const g = this.ctx.createGain(); g.gain.value = 0.0001; g.gain.setTargetAtTime(vol, t, 1.2);
      const s = crear(g); this.capas.push({ g, s });
    };
    const zumbido = (f, vol) => capa((g) => { const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const fl = this.ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = f * 3; o.connect(fl).connect(g); this.salida(g, 'musica', 0.2); o.start(); return o; }, vol);
    const viento = (f, vol) => capa((g) => {
      const s = this.fuente(this.marron, true), fl = this.ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = 0.7;
      const lfo = this.ctx.createOscillator(), lg = this.ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = f * 0.5; lfo.connect(lg).connect(fl.frequency); lfo.start();
      s.connect(fl).connect(g); this.salida(g, 'musica', 0.3); s.start(); return s;
    }, vol);
    if (zona === 'lab' || zona === 'laboratorio') { zumbido(55, 0.05); zumbido(82.4, 0.025); viento(220, 0.06); this.repetir(() => this.gota(), 2, 6); this.repetir(() => this.chirrido(), 7, 16); this.repetir(() => this.nota(0.06), 6, 12); }
    else if (zona === 'ciudad') { viento(400, 0.12); viento(900, 0.04); this.repetir(() => this.cruje(), 5, 12); this.repetir(() => this.nota(0.05), 8, 15); }
    else if (zona === 'linde') { viento(520, 0.07); viento(1300, 0.025); this.repetir(() => this.gota(), 3, 8); this.repetir(() => this.nota(0.045), 8, 16); }
    else if (zona === 'casa') { zumbido(49, 0.03); viento(300, 0.05); this.repetir(() => this.cruje(), 4, 9); this.repetir(() => this.gota(), 4, 9); this.repetir(() => this.nota(0.06), 6, 11); }
    else if (zona === 'plaza') {
      viento(500, 0.04);
      // la nota sostenida de la gravedad cero
      for (const [f, v] of [[293.66, 0.035], [440, 0.022], [587.3, 0.012]]) capa((g) => { const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; const lfo = this.ctx.createOscillator(), lg = this.ctx.createGain(); lfo.frequency.value = 0.2 + Math.random() * 0.2; lg.gain.value = 1.5; lfo.connect(lg).connect(o.frequency); lfo.start(); o.connect(g); this.salida(g, 'musica', 0.8); o.start(); return o; }, v);
      this.repetir(() => this.campanilla(), 2, 5);
    } else if (zona === 'hospital') { zumbido(60, 0.035); zumbido(120, 0.012); viento(260, 0.05); this.repetir(() => this.gota(), 3, 7); this.repetir(() => this.chirrido(), 8, 14); this.repetir(() => this.nota(0.05), 7, 13); }
  }
  // La anomalia del nivel 1: nota sostenida y rumor de la cascada, mas fuerte cuanto mas cerca (v 0-1)
  anomalia(v) {
    if (!this.ctx) return;
    if (!this.capaAnomalia) {
      const t = this.ctx.currentTime;
      const g = this.ctx.createGain(); g.gain.value = 0;
      for (const [f, a] of [[293.66, 0.5], [440, 0.32], [587.3, 0.18], [880, 0.08]]) {
        const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const lfo = this.ctx.createOscillator(), lg = this.ctx.createGain(); lfo.frequency.value = 0.15 + Math.random() * 0.2; lg.gain.value = 1.2; lfo.connect(lg).connect(o.frequency); lfo.start(t);
        const ga = this.ctx.createGain(); ga.gain.value = a; o.connect(ga).connect(g); o.start(t);
      }
      const agua = this.fuente(this.blanco, true), fl = this.ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 1400; fl.Q.value = 0.6;
      const ga = this.ctx.createGain(); ga.gain.value = 0.5; agua.connect(fl).connect(ga).connect(g); agua.start(t);
      this.salida(g, 'musica', 0.8);
      this.capaAnomalia = g;
    }
    this.capaAnomalia.gain.setTargetAtTime(Math.max(0, Math.min(1, v)) * 0.06, this.ctx.currentTime, 0.4);
  }
  // la musica (y el ambiente, que va por su bus) se agacha `prof` un momento y vuelve: el golpe fuerte
  // suena por encima de todo
  agachar(prof, dur) {
    if (!this.ctx) return;
    const g = this.musica.gain, t = this.ctx.currentTime, v = this.curva(this.niveles.musica);
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(Math.max(0.0001, v * (1 - prof)), t + 0.02);
    g.setTargetAtTime(v, t + 0.02 + dur * 0.3, dur * 0.4);
  }
  repetir(fn, a, b) { const r = setTimeout(() => { fn(); this.repetir(fn, a, b); }, az(a, b) * 1000); this.relojes.push(r); }
  gota() { this.tono(az(1400, 2200), 0.08, 'sine', 0.06, 0.7, az(-0.8, 0.8), az(500, 800)); }
  chirrido() { this.tono(az(300, 600), az(0.6, 1.4), 'triangle', 0.012, 0.9, az(-1, 1), az(250, 700)); }
  cruje() { this.soplo(az(0.3, 0.7), az(200, 500), 6, 0.05, 0.6, az(-1, 1), az(150, 300)); }
  campanilla() { this.tono(RE_MENOR[Math.floor(az(4, 9))] * 2, 2.5, 'sine', 0.025, 0.9, az(-0.7, 0.7), null, 'musica', 0.02); }
  nota(vol = 0.06) {
    // notas sueltas en re menor, como de un piano lejano
    const f = RE_MENOR[Math.floor(az(0, RE_MENOR.length))];
    this.tono(f, 3.2, 'triangle', vol, 0.85, az(-0.4, 0.4), null, 'musica', 0.01);
    if (Math.random() < 0.4) setTimeout(() => this.tono(f * 1.5, 2.6, 'sine', vol * 0.6, 0.9, az(-0.4, 0.4), null, 'musica', 0.01), 700);
  }

  // ---------------------------------------------------------------- efectos del juego
  ev(e, x = 0) {
    if (!this.ctx) return;
    const pan = Math.max(-0.8, Math.min(0.8, x));
    const ahora = this.ctx.currentTime;
    const una = (k, s) => { if ((this.ultimo[k] || 0) > ahora - s) return false; this.ultimo[k] = ahora; return true; };
    switch (e.t) {
      // focos que se balancean
      case 'foco_golpe':
        if (e.tipo === 'fluorescente') { this.tono(az(1900, 2300), 0.25, 'triangle', 0.05, 0.4, pan, az(1500, 1800)); this.tono(100, 0.35, 'sawtooth', 0.02, 0.2, pan, 120); }
        else this.tono(az(900, 1200), 0.6, 'triangle', 0.06, 0.6, pan, az(860, 1150));
        break;
      case 'foco_toca': if (una('foco_toca', 0.2)) this.tono(az(1300, 1600), 0.12, 'sine', 0.025, 0.3, pan); break;
      case 'foco_tope': if (una('foco_tope', 0.3)) this.soplo(0.12, 900, 2, 0.04, 0.2, pan); break;
      // combate mejorado
      case 'choque': this.tono(az(1500, 1800), 0.5, 'triangle', 0.12, 0.6, pan, az(1150, 1300)); this.tono(az(3100, 3500), 0.3, 'sine', 0.05, 0.5, pan); this.soplo(0.18, 4000, 2, 0.12, 0.2, pan, 1500); this.tono(90, 0.2, 'sine', 0.12, 0.1, pan, 50); break;
      case 'desvio': this.tono(az(2100, 2500), 0.22, 'triangle', 0.07, 0.5, pan, az(2600, 3000)); this.soplo(0.1, 5000, 3, 0.06, 0.2, pan, 2500); break;
      case 'aturdido': this.tono(e.jefe ? 330 : 520, 0.6, 'sine', 0.05, 0.6, pan, e.jefe ? 220 : 380); this.tono(e.jefe ? 495 : 780, 0.6, 'sine', 0.03, 0.6, pan, e.jefe ? 330 : 570); break;
      case 'estocada': this.soplo(0.28, 2600, 2.5, 0.12, 0.25, pan, 700); this.tono(260, 0.2, 'sawtooth', 0.025, 0.2, pan, 130); break;
      case 'cura_empieza': this.tono(RE_MENOR[0] * 2, 0.9, 'sine', 0.03, 0.9, 0, RE_MENOR[0] * 3, 'musica'); break;
      case 'cura_esencia': [0, 2, 4].forEach((k, i) => setTimeout(() => this.tono(RE_MENOR[k] * 2, 1.2, 'sine', 0.045, 0.9, 0, null, 'musica'), i * 70)); break;
      case 'aviso_golpe': this.tono(az(2800, 3200), 0.12, 'sine', 0.035, 0.5, pan, az(3600, 4000)); break;
      case 'zarpazo': this.soplo(0.14, 1800, 2, 0.09, 0.2, pan, 600); break;
      case 'tallo_aviso': this.soplo(0.3, 300, 4, 0.05, 0.4, pan, 600, 'bandpass'); break;
      case 'espora_hincha': this.tono(140, 0.45, 'sine', 0.04, 0.5, pan, 260); break;
      case 'espora_lanza': this.soplo(0.25, 900, 2, 0.06, 0.2, pan, 2000); break;
      case 'gota': if (una('gota', 0.08)) this.tono(az(1700, 2500), 0.09, 'sine', 0.012, 0.12, pan, az(800, 1200)); break;
      // las puertas de los niveles (dibujo/puertas.js), cada una con su ruido
      // el montacargas: motor que arranca y frena, y el golpe al pararse
      case 'jaula_arranca': this.tono(55, 1.2, 'sawtooth', 0.05, 0.6, pan, 95); this.soplo(1.1, 300, 2, 0.05, 0.5, pan, 600, 'lowpass'); break;
      case 'jaula_para': this.tono(95, 0.5, 'sawtooth', 0.04, 0.3, pan, 50); this.tono(70, 0.15, 'sine', 0.12, 0.1, pan, 45); break;
      case 'puerta_abre':
        if (e.tipo === 'escalera' || e.tipo === 'trampilla') { this.tono(az(140, 170), 0.12, 'square', 0.03, 0.1, pan, 90); this.tono(az(900, 1100), 0.25, 'triangle', 0.03, 0.4, pan); }
        else if (e.tipo === 'ascensor') { this.soplo(0.35, 2600, 6, 0.05, 0.2, pan, 1800); this.tono(az(900, 1000), 0.3, 'square', 0.012, 0.3, pan, 700); }
        else if (e.tipo === 'esclusa') { this.soplo(0.55, 2800, 2, 0.07, 0.3, pan, 1100); this.tono(85, 0.5, 'sawtooth', 0.025, 0.3, pan, 120); }
        else if (e.tipo === 'conducto') { this.soplo(0.25, 1800, 4, 0.05, 0.15, pan, 900); this.tono(az(520, 640), 0.15, 'triangle', 0.025, 0.3, pan, 400); }
        else if (e.tipo === 'portal') { this.soplo(0.6, 420, 3, 0.08, 0.3, pan, 700, 'bandpass'); this.tono(150, 0.55, 'sawtooth', 0.02, 0.3, pan, 190); }
        else if (e.tipo === 'casa') this.tono(az(300, 340), 0.45, 'sawtooth', 0.025, 0.4, pan, az(200, 230));
        else this.tono(az(680, 740), 0.55, 'triangle', 0.03, 0.5, pan, az(480, 540));
        break;
      case 'puerta_cierra':
        if (e.tipo === 'ascensor') { this.soplo(0.3, 2600, 6, 0.05, 0.2, pan, 1600); this.tono(az(1300, 1400), 0.25, 'triangle', 0.03, 0.4, pan); }
        else if (e.tipo === 'esclusa') { this.soplo(0.3, 2000, 2, 0.05, 0.2, pan, 700); this.tono(70, 0.18, 'sine', 0.13, 0.1, pan, 42); this.tono(az(850, 950), 0.3, 'triangle', 0.025, 0.5, pan); }
        else if (e.tipo === 'casa') this.tono(120, 0.15, 'sine', 0.12, 0.1, pan, 65);
        else if (e.tipo === 'verja') { this.tono(az(1150, 1250), 0.4, 'triangle', 0.05, 0.6, pan, az(1000, 1100)); this.tono(95, 0.12, 'sine', 0.08, 0.1, pan, 60); }
        else { this.tono(90, 0.14, 'sine', 0.1, 0.1, pan, 50); this.soplo(0.15, 800, 2, 0.05, 0.1, pan); }
        break;
      case 'paso': this.soplo(0.05, az(700, 1100), 2, 0.035, 0.05, pan, 300); this.tono(az(110, 140), 0.04, 'sine', 0.03, 0, pan, 70); break;
      case 'salto': this.soplo(0.14, 900, 1.2, 0.05, 0.1, pan, 2000); break;
      case 'doble': this.soplo(0.18, 1400, 2, 0.06, 0.2, pan, 3000); this.tono(880, 0.12, 'sine', 0.03, 0.3, pan, 1320); break;
      case 'aterriza': this.soplo(0.08, 300, 1, e.fuerte ? 0.18 : 0.09, 0.05, pan); this.tono(90, 0.08, 'sine', e.fuerte ? 0.15 : 0.07, 0, pan, 50); break;
      case 'tajo': {
        // cada tajo del combo silba distinto; el remate es mas grave y lleva un golpe de aire
        const f = (e.zorro ? 2600 : [3200, 3700, 2500][(e.combo || 1) - 1]) * az(0.95, 1.05);
        this.soplo(e.remata ? 0.18 : 0.12, f, 3, e.remata ? 0.12 : 0.09, 0.15, pan, e.remata ? 600 : 900);
        if (e.remata) this.tono(220, 0.16, 'sine', 0.05, 0.1, pan, 90);
        break;
      }
      case 'remate_prepara':
        // el remate coge aire: un soplo que sube y un tono grave que se tensa (4 fotogramas antes del corte)
        this.soplo(0.08, 600, 1.5, 0.05, 0.1, pan, 2400); this.tono(196, 0.08, 'sine', 0.03, 0.1, pan, 294);
        break;
      case 'impacto': {
        // EL GOLPE POR CAPAS (2026-10-18); el material va en el evento 'golpe', que llega en el mismo paso:
        // 1) chasquido del contacto, 2) cuerpo grave que cae de tono (mas cuanto mas fuerte), 3) la nota de la
        // racha (la escalera de la pentatonica de re menor), 4) la cola: el que mata, un grave largo con eco,
        // y la musica se agacha un momento para que el golpe salga por encima
        const fuerza = e.mata ? 1 : e.embiste || e.fuerte ? 0.7 : 0.45;
        this.soplo(0.03, 7500, 1.2, 0.06 + 0.06 * fuerza, 0.02, pan, 4000, 'highpass');
        this.tono(150 + 60 * fuerza, 0.08 + 0.1 * fuerza, 'sine', 0.07 + 0.13 * fuerza, 0.05, pan, 46);
        this.soplo(0.06 + 0.08 * fuerza, 1100, 1, 0.04 + 0.08 * fuerza, 0.1, pan, 250, 'lowpass');
        const grados = [0, 3, 5, 7, 10], n = Math.min(e.racha || 1, 15) - 1;
        const f = 587.33 * Math.pow(2, (grados[n % 5] + 12 * Math.floor(n / 5)) / 12);
        this.tono(f, 0.22, 'triangle', 0.03, 0.5, pan);
        this.tono(f * 2, 0.12, 'sine', 0.012, 0.5, pan);
        if (e.mata) { this.tono(f * 1.5, 0.7, 'sine', 0.035, 0.85, pan); this.tono(62, 0.5, 'sine', 0.16, 0.3, pan, 32); this.agachar(0.6, 0.4); }
        else if (e.fuerte || e.embiste) this.agachar(0.35, 0.22);
        break;
      }
      case 'pogo': this.soplo(0.025, 7000, 1.2, 0.06, 0.02, pan, 4000, 'highpass'); this.tono(520, 0.14, 'sine', 0.05, 0.3, pan, 1040); this.soplo(0.08, 2500, 2, 0.06, 0.1, pan, 5000); break;
      case 'derrape': this.soplo(0.2, 1500, 1.5, 0.05, 0.1, pan, 500); break;
      case 'sunikel': this.soplo(0.3, 3000, 2, 0.14, 0.3, pan, 500); this.tono(220, 0.25, 'sawtooth', 0.04, 0.2, pan, 110); break;
      case 'cargado': this.tono(660, 0.25, 'sine', 0.04, 0.4, pan, 990); break;
      case 'golpe':
        // la capa del MATERIAL de cada golpe: el escarabajo es cristal y quitina (un tañido inarmonico y un
        // grave cuadrado), la hormiga quitina y chapa de laton (un toc seco y un ping corto), la espora
        // revienta como una vejiga, el soldado es chapa sobre carne
        if (e.tipo === 'jefe') { this.tono(az(2300, 2500), 0.25, 'triangle', 0.035, 0.5, pan, az(2100, 2200)); this.tono(3610, 0.18, 'sine', 0.015, 0.5, pan); this.tono(180, 0.18, 'square', 0.05, 0.2, pan, 90); }
        else if (e.tipo === 'hormiga') { this.soplo(0.04, az(2400, 2900), 6, 0.08, 0.05, pan); this.tono(az(1050, 1200), 0.06, 'square', 0.035, 0.1, pan, 700); this.tono(az(1850, 2000), 0.12, 'triangle', 0.025, 0.3, pan); }
        else if (e.tipo === 'espora') { this.tono(300, 0.07, 'sine', 0.08, 0.2, pan, 900); this.soplo(0.12, 1800, 1, 0.07, 0.2, pan, 600); }
        else { this.soplo(0.12, 500, 1.5, 0.12, 0.15, pan, 200); this.tono(az(680, 760), 0.1, 'triangle', 0.03, 0.3, pan, 600); }
        break;
      case 'muere': this.soplo(0.6, 700, 1, 0.12, 0.5, pan, 150, 'lowpass'); this.tono(110, 0.5, 'sine', 0.08, 0.4, pan, 40); this.soplo(0.9, 3000, 1, 0.025, 0.6, pan, 6500, 'highpass'); break;
      // un cuerpo que da contra el suelo (efectos.js, restos)
      case 'resto_cae': { const f = e.fuerza ?? 0.6; this.tono(95, 0.18, 'sine', 0.06 + 0.1 * f, 0.1, pan, 42); this.soplo(0.16, 320, 1, 0.05 + 0.08 * f, 0.15, pan, 120, 'lowpass'); break; }
      case 'hormiga_huye': this.soplo(0.3, 3000, 6, 0.04, 0.2, pan, 5000); this.tono(az(900, 1000), 0.25, 'triangle', 0.03, 0.4, pan, 1500); break;
      case 'soldado_aviso': if (una('aviso', 0.4)) { this.tono(70, 0.5, 'sawtooth', 0.04, 0.3, pan, 60); this.soplo(0.4, 400, 3, 0.05, 0.3, pan, 900); } break;
      case 'dano': this.tono(660, 0.4, 'triangle', 0.08, 0.5, pan, 220); this.soplo(0.25, 5000, 1, 0.12, 0.4, pan); break;
      case 'peligro': this.soplo(0.4, 6000, 2, 0.08, 0.5, pan, 2500); break;
      case 'muere_18': this.tono(440, 1.6, 'triangle', 0.1, 0.9, 0, 110); this.soplo(1.2, 3000, 1, 0.08, 0.8, 0, 300); break;
      case 'aviso_tornillo': this.soplo(0.6, 2500, 4, 0.03, 0.3, pan, 1200); break;
      case 'tornillo_golpe': if (una('tg', 0.05)) { this.tono(az(900, 1400), 0.35, 'triangle', 0.08, 0.5, pan, az(700, 1100)); this.tono(az(2500, 3200), 0.2, 'sine', 0.03, 0.5, pan); } break;
      case 'derrumbe': if (una('der', 0.3)) this.soplo(0.5, 150, 1, 0.08, 0.4, pan, 80, 'lowpass', true); break;
      case 'persecucion': this.soplo(2.4, 120, 1, 0.25, 0.6, 0, 60, 'lowpass', true); this.tono(41, 2.5, 'sawtooth', 0.06, 0.4, 0); break;
      case 'trampa': this.soplo(1.0, 600, 2, 0.06, 0.6, 0, 2000); break;
      case 'gigante_cae': this.tono(48, 1.2, 'sine', 0.3, 0.6, pan, 30); this.soplo(1.0, 200, 1, 0.3, 0.6, pan, 60, 'lowpass', true); this.tono(320, 1.5, 'triangle', 0.05, 0.8, pan, 300); break;
      case 'cruje': this.soplo(0.25, 1200, 5, 0.05, 0.3, pan); break;
      case 'hunde': this.soplo(0.5, 400, 1, 0.12, 0.4, pan, 120, 'lowpass', true); break;
      case 'engancha': this.tono(1600, 0.06, 'square', 0.04, 0.2, pan, 1200); this.soplo(0.15, 2000, 3, 0.05, 0.2, pan); break;
      case 'suelta': this.soplo(0.1, 1500, 2, 0.04, 0.2, pan); break;
      case 'sube': this.soplo(0.15, 700, 1, 0.06, 0.2, pan); break;
      case 'agarra': this.soplo(0.08, 1800, 3, 0.04, 0.1, pan); break;
      case 'tele': this.tono(1760, 0.25, 'sine', 0.06, 0.6, pan, 440); this.soplo(0.25, 6000, 2, 0.05, 0.6, pan, 1500); break;
      case 'empuje': this.tono(587, 0.6, 'sine', 0.04, 0.9, pan, 880); this.soplo(0.45, 900, 1.2, 0.05, 0.7, pan, 300); break;
      case 'choca_gz': if (una('cgz', 0.15)) { const f = Math.min(1, e.v / 400); this.tono(196, 0.5, 'sine', 0.05 * f, 0.9, pan, 147); this.soplo(0.2, 500, 1, 0.04 * f, 0.6, pan, 200, 'lowpass', true); } break;
      case 'toca_gz': this.tono(1174, 0.4, 'sine', 0.02, 0.9, pan); break;
      case 'coge': this.tono(1300, 0.06, 'square', 0.03, 0.1, pan, 1500); break;
      case 'lanza': this.soplo(0.2, 1200, 1.4, 0.07, 0.2, pan, 500); break;
      case 'objeto_cae': this.tono(az(1100, 1500), 0.2, 'triangle', 0.05, 0.3, pan, 900); break;
      case 'objeto_rompe': this.tono(1700, 0.15, 'triangle', 0.06, 0.3, pan, 1000); break;
      case 'escupe': this.soplo(0.2, 300, 2, 0.08, 0.3, pan, 900); break;
      case 'tallos_caen': this.soplo(1.2, 500, 1, 0.12, 0.6, pan, 120); break;
      case 'bus_arrastra': this.soplo(0.4, 180, 2, 0.14, 0.3, pan, 120, 'bandpass', true); this.tono(az(140, 200), 0.4, 'sawtooth', 0.025, 0.3, pan, az(110, 160)); break;
      case 'bus_libre': this.tono(55, 1.4, 'sine', 0.25, 0.6, pan, 35); this.soplo(1.2, 400, 1, 0.25, 0.6, pan, 80, 'lowpass', true); break;
      case 'nota': this.soplo(0.3, 3500, 1, 0.05, 0.2, 0, 2000); this.tono(RE_MENOR[4], 2, 'sine', 0.04, 0.9, 0, null, 'musica', 0.05); break;
      case 'control': [0, 3, 5].forEach((k, i) => setTimeout(() => this.tono(RE_MENOR[k] * 2, 1.8, 'sine', 0.05, 0.9, 0, null, 'musica', 0.01), i * 160)); break;
      case 'cura': this.tono(RE_MENOR[5] * 2, 1, 'sine', 0.04, 0.9, 0); break;
      case 'dosis': this.tono(RE_MENOR[6] * 2, 0.6, 'sine', 0.05, 0.6, pan, null); this.tono(RE_MENOR[8] * 2, 0.6, 'sine', 0.03, 0.6, pan); break;
      case 'habilidad': [0, 2, 4, 7].forEach((k, i) => setTimeout(() => this.tono(RE_MENOR[k % 9] * 2, 2.4, 'triangle', 0.06, 0.9, 0, null, 'musica', 0.01), i * 120)); break;
      case 'rejilla_abre': this.soplo(0.8, 900, 2, 0.12, 0.5, pan, 300); this.tono(196, 1.2, 'triangle', 0.06, 0.8, pan); break;
      case 'ruedo_cierra': this.tono(41, 2, 'sawtooth', 0.1, 0.6, 0); this.soplo(0.8, 200, 1, 0.2, 0.5, 0, 80, 'lowpass', true); break;
      case 'ruedo_abre': this.soplo(0.8, 300, 1, 0.12, 0.5, 0, 120, 'lowpass', true); break;
      case 'jefe_tajo_prepara': this.tono(1200, 0.5, 'sine', 0.03, 0.6, pan, 2400); break;
      case 'jefe_tajo': this.soplo(0.3, 4000, 2, 0.14, 0.4, pan, 800); this.tono(1800, 0.4, 'triangle', 0.04, 0.6, pan, 900); break;
      case 'jefe_salta': this.soplo(0.4, 600, 1, 0.1, 0.3, pan, 1500); break;
      case 'jefe_aterriza': this.tono(55, 0.8, 'sine', 0.3, 0.6, pan, 35); this.soplo(0.6, 250, 1, 0.22, 0.5, pan, 80, 'lowpass', true); break;
      case 'jefe_carga': this.soplo(0.8, 300, 2, 0.12, 0.4, pan, 900); break;
      case 'jefe_choca': this.tono(70, 0.7, 'sine', 0.25, 0.6, pan, 40); this.soplo(0.5, 2000, 1, 0.12, 0.5, pan); break;
      case 'jefe_clava': this.tono(2200, 0.6, 'triangle', 0.05, 0.8, pan, 1100); break;
      case 'cristal_sale': if (una('cs', 0.06)) this.tono(az(2400, 3200), 0.3, 'triangle', 0.05, 0.6, pan, az(1800, 2400)); break;
      // la daga contra el cristal: chasquido, tañido de cristal con dos parciales inarmonicos y un golpe sordo
      case 'jefe_rebota':
        this.soplo(0.025, 8000, 1, 0.08, 0.02, pan, 5000, 'highpass');
        this.tono(az(2550, 2650), 0.3, 'triangle', 0.06, 0.55, pan, 2300); this.tono(3900, 0.22, 'sine', 0.03, 0.55, pan); this.tono(5230, 0.14, 'sine', 0.015, 0.5, pan);
        this.tono(150, 0.08, 'sine', 0.09, 0.05, pan, 70);
        break;
      case 'jefe_vencido': this.tono(146.8, 3, 'triangle', 0.1, 0.9, 0, 110); break;
      case 'despierta_zorro': this.tono(110, 2, 'sawtooth', 0.08, 0.8, 0, 220); [0, 4, 7, 9].forEach((k, i) => setTimeout(() => this.tono(RE_MENOR[k % 9] * 2, 2.5, 'triangle', 0.07, 0.9, 0, null, 'musica', 0.01), 300 + i * 140)); this.soplo(1.2, 5000, 1, 0.1, 0.8, 0, 600); break;
      case 'zorro': case 'humano': this.tono(e.t === 'zorro' ? 880 : 660, 0.4, 'sine', 0.04, 0.6, pan, e.t === 'zorro' ? 1320 : 440); break;
      case 'salida': this.tono(RE_MENOR[3], 1.6, 'sine', 0.05, 0.9, 0, null, 'musica', 0.05); break;
    }
  }

  ui(tipo) {
    if (!this.ctx) return;
    if (tipo === 'mover') this.tono(1200, 0.05, 'sine', 0.03, 0.2);
    else if (tipo === 'elegir') { this.tono(660, 0.12, 'triangle', 0.05, 0.4); this.tono(990, 0.18, 'sine', 0.03, 0.5); }
    else if (tipo === 'tiza') this.soplo(0.03, az(3000, 5000), 6, 0.015, 0.05);
    else if (tipo === 'circulo') this.tono(RE_MENOR[Math.floor(az(4, 9))] * 2, 1.2, 'sine', 0.05, 0.8, 0, null, 'musica', 0.01);
    else if (tipo === 'falla') this.soplo(0.2, 600, 2, 0.06, 0.2);
    else if (tipo === 'abre') [0, 2, 4].forEach((k, i) => setTimeout(() => this.tono(RE_MENOR[k + 3] * 2, 1.6, 'sine', 0.05, 0.9, 0, null, 'musica', 0.01), i * 150));
  }
}
