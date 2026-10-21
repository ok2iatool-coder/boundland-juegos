// El sonido del bosque, con GRABACIONES (web/sonidos/, preparadas y limpiadas por tools/sonidos.py; creditos en
// web/sonidos/CREDITOS.txt). El 20-10 el usuario descarto el sonido sintetizado por artificial y luego pidio que fuera
// "muy profesional y limpio, que de gusto escucharlo". Como se mezcla:
//
//   pasos ─┬──────────────┐
//          └─ envio ─┐    │
//   pajaros ─┬───────┼────┤
//            └─ envio┤    ├─ maestro ─ paso alto 40 Hz ─ compresor suave (pega) ─ limitador ─ -2 dB ─ salida
//   viento (aire + hojas) │
//                    reverb (exterior: suelo cerca, arboles lejos, cola de 1,6 s que se apaga primero en agudos)
//
// - Pasos: un clip del suelo que pisa cada pie, nunca el mismo dos veces seguidas; variacion pequena (+-35 cents,
//   +-1,5 dB, brillo segun lo deprisa que va), un pelo a su lado de la camara y menos cuanto mas lejos. Con la bota
//   mojada (al salir del charco) va una capa flojita de agua debajo. Aterrizar: el clip grave con un cuerpo por debajo.
// - Viento: el mismo bucle en dos capas desfasadas: AIRE (graves y medios, ancho) y HOJAS (agudos); cada racha sube
//   primero el aire y las hojas la siguen medio segundo despues, como en un bosque de verdad.
// - Pajaros: cantos SUELTOS (no un bucle que se reconoce) puestos alrededor en 3D (HRTF) a 10-45 m, con la absorcion
//   del aire (cuanto mas lejos, menos agudos y mas reverb) y a veces otro que contesta desde otro sitio.
// - Todo entra en fundido; con la pestana oculta se para. El navegador no deja sonar nada hasta un clic o una tecla:
//   `activar()` va en esos eventos.

const CLIPS = { hierba: 9, tierra: 6, piedra: 6, agua: 5 };
const N_PAJAROS = 28;
const azar = (a, b) => a + Math.random() * (b - a);
const db = (x) => Math.pow(10, x / 20);

// respuesta al impulso de un claro de bosque: dos rebotes del suelo, reflexiones sueltas de troncos y una cola difusa
// que se apaga antes en agudos (cada canal con su ruido: asi la reverb abre el estereo)
function respuestaBosque(ctx, dur = 1.6) {
  const sr = ctx.sampleRate, n = Math.floor(dur * sr);
  const ir = ctx.createBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const corte = 0.08 + 0.85 * Math.exp(-t * 3.2);                 // la cola se oscurece al apagarse
      lp += corte * ((Math.random() * 2 - 1) - lp);
      d[i] = lp * Math.exp(-t * 4.3) * Math.min(1, t / 0.02) * 0.5;   // sube en 20 ms y cae ~37 dB/s
    }
    // rebotes del suelo y de troncos cercanos (en cada canal a su tiempo)
    const ecos = c ? [[0.009, 0.5], [0.023, 0.28], [0.047, 0.2], [0.081, 0.13]] : [[0.007, 0.55], [0.019, 0.3], [0.039, 0.22], [0.068, 0.14]];
    for (const [t, g] of ecos) d[Math.floor(t * sr)] += g * (c ? -1 : 1);
  }
  return ir;
}

// `opciones.ctx`: un OfflineAudioContext para renderizar la mezcla sin altavoces (tools/mezcla.html la mide)
export function crearSonido(base = 'sonidos/', opciones = {}) {
  let ctx = null, maestro = null, encendido = true, cargado = false, medidor = null;
  let busPasos, busPajaros, busAmb, envio;
  const buf = {};                            // suelo -> [AudioBuffer]
  const ultimo = {};                         // suelo -> indice del ultimo clip (no repetir)
  let pajaros = [], recientes = [];
  let viento = null;
  const cuenta = { hierba: 0, tierra: 0, piedra: 0, agua: 0, caida: 0, pajaro: 0 };
  const estado = new Map(), ultimoPie = new Map();
  let caidaVista = null, tAhora = 0, proxRacha = 0, proxPajaro = 2;
  const oyente = { x: 0, y: 0, z: 0 };

  async function cargar() {
    const traer = async (n) => ctx.decodeAudioData(await (await fetch(base + n + '.ogg')).arrayBuffer());
    const tareas = [];
    for (const [s, n] of Object.entries(CLIPS)) {
      buf[s] = new Array(n);
      for (let k = 0; k < n; k++) tareas.push(traer(`paso_${s}_${k}`).then((b) => { buf[s][k] = b; }));
    }
    pajaros = new Array(N_PAJAROS);
    for (let k = 0; k < N_PAJAROS; k++) tareas.push(traer(`pajaro_${k}`).then((b) => { pajaros[k] = b; }).catch(() => {}));
    const [bv] = await Promise.all([traer('fondo_viento'), ...tareas]);
    pajaros = pajaros.filter(Boolean);
    montarViento(bv);
    cargado = true;
  }

  // el viento en dos capas del mismo bucle, desfasadas medio bucle (no suenan a lo mismo)
  function montarViento(b) {
    const capa = (tipo, f, q, g, desfase) => {
      const s = ctx.createBufferSource(); s.buffer = b; s.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = tipo; fl.frequency.value = f; fl.Q.value = q;
      const ga = ctx.createGain(); ga.gain.value = g;
      s.connect(fl).connect(ga).connect(busAmb);
      s.start(0, (desfase * b.duration) % b.duration);
      return { fl, ga };
    };
    viento = {
      aire: capa('lowpass', 1100, 0.5, 0.42, Math.random()),
      hojas: capa('highpass', 1900, 0.6, 0.2, Math.random() + 0.5),
    };
  }

  function activar() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    ctx = opciones.ctx || new (window.AudioContext || window.webkitAudioContext)();
    // la salida: paso alto (nada de subgraves que solo ensucian), compresor suave que pega la mezcla y limitador
    const pa = ctx.createBiquadFilter(); pa.type = 'highpass'; pa.frequency.value = 40; pa.Q.value = 0.6;
    const pega = ctx.createDynamicsCompressor();
    pega.threshold.value = -20; pega.knee.value = 10; pega.ratio.value = 2; pega.attack.value = 0.012; pega.release.value = 0.25;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -4.5; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
    maestro = ctx.createGain();
    maestro.gain.value = 0;
    maestro.gain.setTargetAtTime(encendido ? 1 : 0, ctx.currentTime + 0.1, 0.8);   // entra en fundido
    // el limitador del navegador no mira entre muestras: 2 dB de margen detras para no pasar de -1 dBTP
    const techo = ctx.createGain(); techo.gain.value = db(-2);
    maestro.connect(pa).connect(pega).connect(lim).connect(techo).connect(ctx.destination);
    // para medir la mezcla desde el panel (`__dbg.sonido.nivel()`): pico y RMS de la salida
    medidor = ctx.createAnalyser(); medidor.fftSize = 8192;
    techo.connect(medidor);
    // la reverb de exterior, con su paso alto (una reverb con graves embarra) y 12 ms de predelay
    const conv = ctx.createConvolver(); conv.buffer = respuestaBosque(ctx);
    const pre = ctx.createDelay(0.1); pre.delayTime.value = 0.012;
    const rpa = ctx.createBiquadFilter(); rpa.type = 'highpass'; rpa.frequency.value = 220;
    const rpb = ctx.createBiquadFilter(); rpb.type = 'lowpass'; rpb.frequency.value = 7000;
    const vuelta = ctx.createGain(); vuelta.gain.value = 0.55;
    envio = ctx.createGain();
    envio.connect(pre).connect(conv).connect(rpa).connect(rpb).connect(vuelta).connect(maestro);
    busPasos = ctx.createGain(); busPasos.gain.value = 1;
    busPasos.connect(maestro);
    busPajaros = ctx.createGain(); busPajaros.gain.value = 0.9;
    busPajaros.connect(maestro);
    busAmb = ctx.createGain(); busAmb.gain.value = 0.42;           // el fondo, ~12 dB por debajo de los pasos
    busAmb.connect(maestro);
    if (ctx.listener.positionX) ctx.listener.positionX.value = 0;
    if (!opciones.ctx) document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend(); else ctx.resume();
    });
    return cargar().catch((e) => console.warn('sonidos:', e.message));
  }

  // un clip del suelo: distinto del anterior
  function clip(suelo) {
    const lista = buf[suelo] || buf.hierba;
    if (!lista || !lista.length) return null;
    let k = Math.floor(Math.random() * lista.length);
    if (lista.length > 1 && k === ultimo[suelo]) k = (k + 1 + Math.floor(Math.random() * (lista.length - 1))) % lista.length;
    ultimo[suelo] = k;
    return lista[k];
  }
  // un paso: clip -> brillo -> volumen -> lado -> bus (y un poco a la reverb)
  function tocar(suelo, k, pan, o = {}) {
    if (!ctx || !cargado || !encendido) return;
    const b = clip(suelo);
    if (!b) return;
    const t = ctx.currentTime + 0.004 + (o.retraso || 0);
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner();
    s.buffer = b;
    s.detune.value = (o.cents || 0) + azar(-35, 35);
    f.type = 'lowpass'; f.frequency.value = o.brillo || 9000; f.Q.value = 0.5;
    g.gain.value = k * db(azar(-1.5, 1.5));
    p.pan.value = Math.max(-0.3, Math.min(0.3, pan));
    s.connect(f).connect(g).connect(p);
    p.connect(busPasos);
    const e = ctx.createGain(); e.gain.value = o.reverb ?? 0.14;
    p.connect(e).connect(envio);
    s.start(t);
    if (o.cuerpo) {                                // aterrizar: el mismo golpe, solo graves, debajo
      const s2 = ctx.createBufferSource(), f2 = ctx.createBiquadFilter(), g2 = ctx.createGain();
      s2.buffer = b; s2.detune.value = -700;
      f2.type = 'lowpass'; f2.frequency.value = 320;
      g2.gain.value = k * o.cuerpo;
      s2.connect(f2).connect(g2).connect(busPasos);
      s2.start(t);
    }
    cuenta[suelo] = (cuenta[suelo] || 0) + 1;
  }

  // un pajaro en algun sitio alrededor del oyente: HRTF, absorcion del aire y reverb segun la distancia
  function pajaro(desde = null, retraso = 0) {
    if (!pajaros.length) return null;
    let k;
    for (let i = 0; i < 8; i++) { k = Math.floor(Math.random() * pajaros.length); if (!recientes.includes(k)) break; }
    recientes.push(k); if (recientes.length > 8) recientes.shift();
    const ang = desde ? desde.ang + azar(1.2, 2.6) * (Math.random() < 0.5 ? -1 : 1) : azar(0, Math.PI * 2);
    const d = azar(10, 45), alto = azar(4, 14);
    const x = oyente.x + Math.cos(ang) * d, z = oyente.z + Math.sin(ang) * d, y = oyente.y + alto;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), pn = ctx.createPanner();
    s.buffer = pajaros[k];
    s.detune.value = azar(-60, 60);
    f.type = 'lowpass'; f.frequency.value = Math.max(3500, 14000 - d * 220);
    g.gain.value = db(azar(-3, 1));
    pn.panningModel = 'HRTF'; pn.distanceModel = 'inverse'; pn.refDistance = 9; pn.rolloffFactor = 1;
    if (pn.positionX) { pn.positionX.value = x; pn.positionY.value = y; pn.positionZ.value = z; } else pn.setPosition(x, y, z);
    s.connect(f).connect(g).connect(pn).connect(busPajaros);
    const e = ctx.createGain(); e.gain.value = 0.12 + d / 120;
    g.connect(e).connect(envio);
    s.start(ctx.currentTime + 0.01 + retraso);
    cuenta.pajaro++;
    return { ang };
  }

  function colocarOyente(cam) {
    if (!cam || !ctx) return;
    const m = cam.matrixWorld.elements, L = ctx.listener;
    oyente.x = m[12]; oyente.y = m[13]; oyente.z = m[14];
    const fx = -m[8], fy = -m[9], fz = -m[10], ux = m[4], uy = m[5], uz = m[6];
    const t = ctx.currentTime;
    if (L.positionX) {
      L.positionX.setTargetAtTime(oyente.x, t, 0.02); L.positionY.setTargetAtTime(oyente.y, t, 0.02); L.positionZ.setTargetAtTime(oyente.z, t, 0.02);
      L.forwardX.setTargetAtTime(fx, t, 0.02); L.forwardY.setTargetAtTime(fy, t, 0.02); L.forwardZ.setTargetAtTime(fz, t, 0.02);
      L.upX.setTargetAtTime(ux, t, 0.02); L.upY.setTargetAtTime(uy, t, 0.02); L.upZ.setTargetAtTime(uz, t, 0.02);
    } else {
      L.setPosition(oyente.x, oyente.y, oyente.z);
      L.setOrientation(fx, fy, fz, ux, uy, uz);
    }
  }

  const _c = [];
  // cada fotograma: los pies del 18, su caida, el oyente, las rachas y los pajaros
  function paso(dt, heroe, mundo, cam) {
    tAhora += dt;
    if (!ctx || !cargado) return;
    colocarOyente(cam);
    if (encendido) ambiente();
    if (!heroe || !heroe.listo || !heroe.contactos) return;
    const sup = (x, z) => (mundo.superficie ? mundo.superficie(x, z) : 'hierba');
    // la velocidad del 18 es un Vector2 (x, y = z del mundo): con .z salia NaN y los pasos no sonaban nunca
    const v = heroe.vel ? Math.hypot(heroe.vel.x, heroe.vel.y) : 0;
    const m = cam ? cam.matrixWorld.elements : null;
    const dx = m ? m[0] : 1, dz = m ? m[2] : 0;
    const dCam = m ? Math.hypot(heroe.pos.x - m[12], heroe.pos.y - m[13], heroe.pos.z - m[14]) : 4;
    const lejos = Math.min(1, 3.5 / Math.max(dCam, 1));             // a 3,5 m de la camara, tal cual
    const mojada = mundo.huellas ? mundo.huellas.botaMojada || 0 : 0;
    for (const c of heroe.contactos(_c)) {
      if (c.id !== 'foot_l' && c.id !== 'foot_r') continue;
      const antes = estado.get(c.id) || false;
      const ahora = antes ? c.pisa > 0.35 : c.pisa > 0.85;          // histeresis: un sonido por apoyo
      if (ahora && !antes && heroe.suelo !== false && v > 0.15 && tAhora - (ultimoPie.get(c.id) || -1) > 0.12) {
        ultimoPie.set(c.id, tAhora);
        const r = Math.min(1, v / 1.8);                               // 0 parado .. 1 corriendo (el 18 corre a 1,8 m/s)
        const k = (0.5 + 0.5 * r) * lejos;
        const pan = ((c.x - heroe.pos.x) * dx + (c.z - heroe.pos.z) * dz) * 1.5;
        const s = sup(c.x, c.z);
        tocar(s, k, pan, { brillo: 5500 + 7000 * r, cents: 25 * r });
        if (mojada > 0.05 && s !== 'agua') tocar('agua', k * 0.3 * Math.min(1, mojada), pan, { brillo: 4000, retraso: 0.012 });
      }
      estado.set(c.id, ahora);
    }
    // aterrizar: el suelo de debajo, dos golpes (talon y planta) y un cuerpo grave
    const nCaida = heroe.caida ? heroe.caida.n : 0;
    if (caidaVista !== null && nCaida !== caidaVista && encendido) {
      const s = sup(heroe.caida.x, heroe.caida.z), k = Math.min(1.3, 0.75 + 0.15 * heroe.caida.v) * lejos;
      tocar(s, k, -0.08, { cents: -250, brillo: 7000, cuerpo: 0.9, reverb: 0.2 });
      tocar(s, k * 0.7, 0.08, { cents: -120, brillo: 8000, retraso: 0.028 });
      cuenta.caida++;
    }
    caidaVista = nCaida;
  }

  // rachas: el aire primero, las hojas detras; pajaros sueltos, a veces uno que contesta
  function ambiente() {
    const t = ctx.currentTime;
    if (tAhora > proxRacha) {
      proxRacha = tAhora + azar(4, 9);
      const r = Math.random() ** 1.5;
      viento.aire.ga.gain.setTargetAtTime(0.3 + 0.35 * r, t, 1.8);
      viento.aire.fl.frequency.setTargetAtTime(700 + 900 * r, t, 1.8);
      viento.hojas.ga.gain.setTargetAtTime(0.1 + 0.32 * r, t + 0.6, 1.4);
      viento.hojas.fl.frequency.setTargetAtTime(2400 - 800 * r, t + 0.6, 1.4);
    }
    if (tAhora > proxPajaro) {
      const p = pajaro();
      proxPajaro = tAhora + (Math.random() < 0.25 ? azar(0.5, 1.4) : azar(2, 7));
      if (p && Math.random() < 0.35) pajaro(p, azar(0.4, 1.3));       // otro contesta desde otro sitio
    }
  }

  return {
    activar, paso, cuenta,
    get ctx() { return ctx; },
    get cargado() { return cargado; },
    get encendido() { return encendido; },
    // cuantos clips hay cargados de cada (para probar)
    get clips() { return { ...Object.fromEntries(Object.entries(buf).map(([s, l]) => [s, l.filter(Boolean).length])), pajaro: pajaros.length }; },
    // pico y RMS (dBFS) de la salida en los ultimos 186 ms
    nivel() {
      if (!medidor) return null;
      const d = new Float32Array(medidor.fftSize); medidor.getFloatTimeDomainData(d);
      let p = 0, e = 0;
      for (const x of d) { p = Math.max(p, Math.abs(x)); e += x * x; }
      return { pico: 20 * Math.log10(p + 1e-9), rms: 10 * Math.log10(e / d.length + 1e-12), estado: ctx.state };
    },
    alternar() { encendido = !encendido; if (maestro) maestro.gain.setTargetAtTime(encendido ? 1 : 0, ctx.currentTime, 0.15); return encendido; },
  };
}
