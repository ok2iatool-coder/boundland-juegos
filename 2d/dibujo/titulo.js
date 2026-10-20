// La escena del titulo: la sala de los frascos a oscuras con UNA LAMPARA POR OPCION del menu.
//
// Del carril del techo cuelgan los fluorescentes; debajo de cada uno, su sitio: la compuerta (continuar), el
// frasco reventado del 18 (partida nueva), la pizarra de Varga (niveles) y la consola (ajustes). El nombre de
// cada opcion va pintado en el suelo mojado. Solo esta encendida la lampara elegida: al elegir otra, la vieja
// se apaga, la nueva arranca a golpes como un tubo de verdad y el 18 anda (o corre) hasta quedarse bajo su luz.
// La sala se pinta dos veces (a oscuras y alumbrada) y cada fotograma se mezclan con un mapa de luz que sale de
// las lamparas, asi la luz va de verdad con la eleccion. El 18 sigue siendo lo mas luminoso.
//
// Lo quieto se pinta UNA vez por tamano de ventana y juego de opciones; lo vivo (lamparas, haz, polvo,
// niebla, goteo, el 18 y su reflejo) cada fotograma. Capas con parallax de raton.
import { ruido, metal, camino, rgba } from '../assets/pintura.js';
import { dibujarAsset, parpadeo } from './decorado.js';
import { hash, azar, caja, linea } from './tinta.js';
import { dibujarSprite, fotograma } from './actores.js';

const PROF = { fondo: 0.14, sala: 0.32, suelo: 0.5, frente: 1.25 };
const lienzo = (w, h) => { const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.ceil(w)); cv.height = Math.max(1, Math.ceil(h)); return cv; };
const NIEBLA = '#0d1620';
const LUZ = '#d6e9ff';          // la del fluorescente del laboratorio (paletas.js, zona lab)
const E18 = 2.2;                // el 18 va a 2,2 veces la escala del juego
const EL = 1.4;                 // y las lamparas a 1,4 (caben cuatro en la sala)
const SERIF = 'Georgia, "Times New Roman", serif';

// Cada opcion tiene su sitio bajo su lampara (desplazamientos en unidades de interfaz desde la lampara).
// en: 'base' (contra la pared, al fondo del suelo), 'suelo' (delante) o una altura de pared (fraccion de H)
const SITIOS = {
  seguir: { x18: 24, pose: 'reposo2', cosas: [['compuerta', -72, 'base', 1.05]] },
  nueva: { x18: 10, pose: 'reposo2', cosas: [['frasco', -84, 'suelo', 1.45, { n: 18, estado: 'roto' }], ['charco', 4, 'suelo', 1.35, {}, 6], ['cristales_rotos', 52, 'suelo', 0.95, {}, 5], ['cristales_rotos', -150, 'suelo', 0.7, { flip: true }, 7]] },
  niveles: { x18: -16, pose: 'leer', cosas: [['pizarra', 4, 0.565, 1.05], ['boceto_18', 96, 0.6, 0.78], ['papeles', 60, 'suelo', 1.1, {}, 9]] },
  ajustes: { x18: -34, pose: 'reposo2', cosas: [['consola_mandos', 64, 'base', 1.15], ['caja_fusibles', -84, 0.585, 0.9]], leds: [[52, -55], [68, -55], [84, -55]] },
};

// El haz de los focos del juego: el mismo render de Blender (img/haz/, ver haces.js), neblina + polvo
const HAZ = { listo: false };
(async () => {
  try {
    const carga = (url) => new Promise((ok, mal) => { const im = new Image(); im.onload = () => ok(im); im.onerror = mal; im.src = url; });
    const [m, haz, polvo] = await Promise.all([fetch('img/haz/haz.json').then((r) => r.json()), carga('img/haz/haz.webp'), carga('img/haz/polvo.webp')]);
    // la forma del haz (su neblina, normalizada) para encender el polvo fino solo dentro del cono
    const mc = lienzo(m.w, m.h).getContext('2d'); mc.drawImage(haz, 0, 0);
    const d = mc.getImageData(0, 0, m.w, m.h).data, mascara = new Float32Array(m.w * m.h);
    let max = 0;
    for (let i = 0; i < mascara.length; i++) { mascara[i] = d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]; if (mascara[i] > max) max = mascara[i]; }
    for (let i = 0; i < mascara.length; i++) mascara[i] /= max || 1;
    // a la escala del menu el polvo del render saldria gordo: motas finas propias, repartidas por el cono
    const motas = [];
    // (unas cuantas tambien fuera del cono, a oscuras: el aire que remueve el raton las mete en la luz)
    for (let k = 0; motas.length < 620 && k < 40000; k++) {
      const x = hash(k, 71) * m.w, y = m.tuboY + hash(k, 72) * (m.h - m.tuboY);
      const fuera = motas.length >= 460;
      if (fuera || mascara[(y | 0) * m.w + (x | 0)] > 0.04 + hash(k, 73) * 0.25) {
        const v = 0.3 + hash(k, 74);
        motas.push({ x, y, x0: x, v, vx: 0, vy: 6 * v, f: hash(k, 75) * 7, g: hash(k, 78) * 9, s: hash(k, 76) < 0.06 ? 2.2 : 0.7 + hash(k, 77) * 0.8 });
      }
    }
    Object.assign(HAZ, { m, haz, polvo, mascara, motas, tinte: lienzo(m.w, m.h), listo: true });
  } catch (e) { console.warn('titulo: sin el haz de Blender', e); }
})();

// Pinta un asset del catalogo en (x, y) de pixeles con su ancla, a `e` veces su tamano en el mundo
function pon(c, u, id, x, y, e, o = {}) {
  c.save(); c.translate(x, y); c.scale(u * e, u * e);
  dibujarAsset(c, id, 0, 0, o.ancla, 0, o);
  c.restore();
}

// Tine lo pintado (no el vacio) hacia un color: lejania, bruma, o la sala a oscuras
function tenir(cv, color, a) {
  const c = cv.getContext('2d');
  c.save(); c.globalCompositeOperation = 'source-atop'; c.fillStyle = rgba(color, a); c.fillRect(0, 0, cv.width, cv.height); c.restore();
}
const copia = (cv) => { const o = lienzo(cv.width, cv.height); o.getContext('2d').drawImage(cv, 0, 0); return o; };

// Silueta casi negra de un asset con un filo de luz fria (para el primer plano, desenfocado)
function silueta(u, id, e, o = {}) {
  const pad = 20 * u;
  const cv = lienzo((o.w || 200) * u * e + pad * 2, (o.h || 200) * u * e + pad * 2);
  const c = cv.getContext('2d');
  pon(c, u, id, cv.width / 2, o.ancla === 'techo' ? pad : cv.height - pad, e, o);
  tenir(cv, '#020304', 0.9);
  const filo = lienzo(cv.width, cv.height), f = filo.getContext('2d');
  f.drawImage(cv, -2 * u, 0); f.globalCompositeOperation = 'source-out'; f.drawImage(cv, 0, 0);
  tenir(filo, '#9fc4e6', 0.35);
  c.drawImage(filo, 0, 0);
  const out = lienzo(cv.width, cv.height), co = out.getContext('2d');
  co.filter = `blur(${(o.blur || 2.4) * u}px)`; co.drawImage(cv, 0, 0);
  return out;
}

// Un tubo de verdad no se enciende de golpe: arranca a golpes (0..~0,3 s) y luego tiembla de vez en cuando
function arranque(s) {
  if (s < 0.045) return 0.55;
  if (s < 0.1) return 0.04;
  if (s < 0.15) return 0.8;
  if (s < 0.21) return 0.12;
  if (s < 0.26) return 0.95;
  return 1;
}

export class EscenaTitulo {
  constructor() {
    this.clave = ''; this.mx = 0.5; this.my = 0.5; this.px = 0; this.py = 0; this.ultimo = 0;
    this.opciones = [];        // [{id, texto}] del titulo (las pone menu.js)
    this.sel = 0;              // la elegida: su lampara encendida y el 18 debajo
    this.lamparas = [];
    this.columnas = [];        // donde se elige cada opcion con el raton (pixeles de pantalla)
    this.p18 = null;
  }
  raton(x, y, W, H) { this.mx = x / W; this.my = y / H; }
  get motasHaz() { return HAZ.motas; }      // para __dbg: las motas con su velocidad
  // pulsar: la lampara da un fogonazo y el 18 da un respingo
  confirmar() { const l = this.lamparas[this.sel]; if (l) l.fogonazo = 1; if (this.p18) this.p18.respingo = 0.3; }

  // ------------------------------------------------------------ lo quieto
  preparar(W, H, u) {
    const ids = this.opciones.map((o) => o.id);
    const clave = W + 'x' + H + ':' + ids.join(',');
    if (this.clave === clave) return;
    const cambiaSala = !this.clave.startsWith(W + 'x' + H + ':') || this.lamparas.length !== ids.length;
    this.clave = clave;
    const M = this.M = 46 * u;
    const LW = W + M * 2, LH = H + M * 2;
    const g = this.g = { suelo: H * 0.84, horiz: H * 0.73, base: H * 0.795, techo: H * 0.085, riel: H * 0.35 };
    const r = azar(18);
    const N = ids.length, paso = W * (N >= 4 ? 0.2 : 0.21);
    const xs = ids.map((_, k) => W / 2 + (k - (N - 1) / 2) * paso);
    // las lamparas cuelgan a distinta altura, como montadas a mano
    const cuelga = [0.075, 0.095, 0.08, 0.1];
    const viejas = this.lamparas;
    this.lamparas = ids.map((id, k) => {
      const v = !cambiaSala && viejas[k];
      return { id, x: xs[k], y: g.riel + H * cuelga[k % 4], L: v ? v.L : 0, brasa: v ? v.brasa : 0, on: v ? v.on : false, t0: v ? v.t0 : -9, fogonazo: 0, fase: k * 1.7 };
    });
    this.columnas = xs.map((x) => ({ x: x - paso / 2, y: g.riel - 30 * u, w: paso, h: H - g.riel + 30 * u }));
    this.paso = paso;

    // ======================================================== fondo: la pared de la sala, ventanas altas
    const fondo = lienzo(LW, LH), cf = fondo.getContext('2d');
    cf.translate(M, M);
    let gr = cf.createLinearGradient(0, -M, 0, g.horiz);
    gr.addColorStop(0, '#05070a'); gr.addColorStop(0.55, '#0a1017'); gr.addColorStop(1, '#121b25');
    cf.fillStyle = gr; cf.fillRect(-M, -M, LW, g.horiz + M);
    // paneles de chapa con pilastras remachadas
    const pp = 236 * u;
    for (let x = -M - (W * 0.03); x < W + M; x += pp) {
      cf.fillStyle = 'rgba(0,0,0,.28)'; cf.fillRect(x, -M, 22 * u, g.horiz + M);
      cf.fillStyle = 'rgba(150,180,210,.05)'; cf.fillRect(x + 22 * u, -M, 1.5 * u, g.horiz + M);
      for (let y = H * 0.08; y < g.horiz; y += 26 * u) { cf.fillStyle = 'rgba(160,190,220,.07)'; cf.beginPath(); cf.arc(x + 11 * u, y, 1.6 * u, 0, 7); cf.fill(); }
      cf.strokeStyle = 'rgba(0,0,0,.35)'; cf.lineWidth = 2 * u; cf.strokeRect(x + 40 * u, H * 0.46, pp - 58 * u, g.horiz - H * 0.49);
      cf.strokeStyle = 'rgba(150,180,210,.04)'; cf.lineWidth = 1 * u; cf.strokeRect(x + 42 * u, H * 0.465, pp - 62 * u, g.horiz - H * 0.5);
    }
    cf.fillStyle = 'rgba(0,0,0,.35)'; cf.fillRect(-M, H * 0.43, LW, 6 * u);
    cf.fillStyle = 'rgba(150,180,210,.05)'; cf.fillRect(-M, H * 0.43 + 6 * u, LW, 1 * u);
    // ventanas altas de arco solo a los lados: el centro de arriba es del nombre del juego
    this.ventanas = [];
    for (const fxv of [0.085, 0.915]) {
      const vx = W * fxv, vw = 74 * u, vy = H * 0.05, vh = H * 0.25;
      this.ventanas.push({ x: vx, y: vy, w: vw, h: vh });
      cf.save();
      cf.beginPath(); cf.moveTo(vx - vw / 2, vy + vh); cf.lineTo(vx - vw / 2, vy + vw / 2); cf.arc(vx, vy + vw / 2, vw / 2, Math.PI, 0); cf.lineTo(vx + vw / 2, vy + vh); cf.closePath();
      const gv = cf.createLinearGradient(0, vy, 0, vy + vh);
      gv.addColorStop(0, '#2a3d52'); gv.addColorStop(1, '#16222f');
      cf.fillStyle = gv; cf.fill(); cf.clip();
      for (let q = 0; q < 6; q++) { cf.fillStyle = `rgba(190,215,240,${0.04 + r() * 0.05})`; cf.beginPath(); cf.ellipse(vx + (r() - 0.5) * vw, vy + r() * vh * 0.6, 20 * u + r() * 20 * u, 5 * u, 0, 0, 7); cf.fill(); }
      for (let q = 0; q < 2; q++) { const a = vx - vw / 2 + r() * vw, b = vy + vw / 2 + r() * vh * 0.6; cf.fillStyle = 'rgba(4,6,9,.85)'; cf.beginPath(); cf.moveTo(a, b); cf.lineTo(a + 14 * u, b + 4 * u); cf.lineTo(a + 5 * u, b + 18 * u); cf.fill(); }
      cf.restore();
      cf.strokeStyle = '#06080b'; cf.lineWidth = 3.2 * u;
      cf.beginPath(); cf.moveTo(vx - vw / 2, vy + vh); cf.lineTo(vx - vw / 2, vy + vw / 2); cf.arc(vx, vy + vw / 2, vw / 2, Math.PI, 0); cf.lineTo(vx + vw / 2, vy + vh); cf.closePath(); cf.stroke();
      cf.lineWidth = 1.6 * u; cf.beginPath();
      cf.moveTo(vx, vy); cf.lineTo(vx, vy + vh);
      for (let yy = vy + vw / 2; yy < vy + vh; yy += vh / 5) { cf.moveTo(vx - vw / 2, yy); cf.lineTo(vx + vw / 2, yy); }
      cf.stroke();
      cf.fillStyle = '#06080b'; cf.fillRect(vx - vw / 2 - 6 * u, vy + vh, vw + 12 * u, 5 * u);
    }
    // grieta de la anomalia en la pared del fondo, a la derecha del nombre
    this.grieta = { x: W * 0.785, y0: H * 0.1, y1: H * 0.3 };
    {
      const { x, y0, y1 } = this.grieta, ra = azar(7);
      const pts = []; let xx = x; for (let y = y0; y <= y1; y += 14 * u) { xx += (ra() - 0.5) * 16 * u; pts.push([xx, y]); }
      cf.save(); cf.lineCap = 'round'; cf.lineJoin = 'round';
      for (const [lw, col] of [[10 * u, 'rgba(110,160,210,.06)'], [5 * u, 'rgba(2,3,5,.95)'], [1.6 * u, 'rgba(120,170,215,.28)']]) {
        cf.strokeStyle = col; cf.lineWidth = lw; cf.beginPath(); pts.forEach(([a, b], i) => (i ? cf.lineTo(a, b) : cf.moveTo(a, b))); cf.stroke();
      }
      cf.restore();
    }
    // estanterias del fondo, borrosas y en bruma
    {
      const t = lienzo(LW, LH), ct = t.getContext('2d');
      ct.translate(M, M);
      for (let x = -M + 40 * u; x < W + M; x += 168 * u) pon(ct, u, 'estanteria_frascos', x, g.horiz, 0.95);
      tenir(t, NIEBLA, 0.66);
      cf.save(); cf.translate(-M, -M); cf.filter = `blur(${2.6 * u}px)`; cf.drawImage(t, 0, 0); cf.restore();
    }
    gr = cf.createLinearGradient(0, g.horiz, 0, g.suelo);
    gr.addColorStop(0, '#0e151d'); gr.addColorStop(1, '#090d12');
    cf.fillStyle = gr; cf.fillRect(-M, g.horiz, LW, H + M - g.horiz);
    gr = cf.createLinearGradient(0, g.horiz - 90 * u, 0, g.horiz + 30 * u);
    gr.addColorStop(0, 'rgba(40,58,76,0)'); gr.addColorStop(0.7, 'rgba(40,58,76,.28)'); gr.addColorStop(1, 'rgba(40,58,76,0)');
    cf.fillStyle = gr; cf.fillRect(-M, g.horiz - 90 * u, LW, 120 * u);
    this.fondo = fondo;

    // ======================================================== sala: techo, los sitios de cada opcion, lo de los lados
    const sala = lienzo(LW, LH), cs = sala.getContext('2d');
    cs.translate(M, M);
    for (let x = -M; x < W + M; x += 160 * u * 1.3) pon(cs, u, 'viga_doble_t', x + 104 * u, g.techo - 4 * u, 1.3, { ancla: 'libre' });
    {
      cs.save(); cs.translate(0, g.techo + 40 * u); cs.scale(u, u);
      const L = (W + M * 2) / u;
      metal(cs, () => camino(cs, [[-M / u, 0], [L, 0], [L, 14], [-M / u, 14]]), [-M / u, 0, L + M / u, 14], { semilla: 23, oxido: 0.7, base: '#4c5660', cilindro: 'h' });
      for (let x = 60; x < L; x += 210) metal(cs, () => camino(cs, [[x - 4, -3], [x + 4, -3], [x + 4, 17], [x - 4, 17]]), [x - 4, -3, 8, 20], { semilla: x, oxido: 0.5, cilindro: 'h' });
      cs.restore();
    }
    // lo que cuelga, solo a los lados (el centro de arriba es del nombre)
    pon(cs, u, 'tuberia_valvula', W * 0.92, g.techo + 46 * u, 1.05, { ancla: 'libre' });
    pon(cs, u, 'cadena_colgante', W * 0.05, g.techo + 8 * u, 1.15, { ancla: 'techo' });
    pon(cs, u, 'cables_colgando', W * 0.83, g.techo + 12 * u, 1.1, { ancla: 'techo' });
    pon(cs, u, 'cables_colgando', W * 0.17, g.techo + 12 * u, 1.0, { ancla: 'techo', flip: true });
    // a los lados, lo que queda del laboratorio
    pon(cs, u, 'tanque_vertical', W * 0.03, g.base, 1.2);
    pon(cs, u, 'frasco', W * 0.975, g.base, 1.25, { n: 17, estado: 'abierto' });
    // los sitios
    this.leds = [];
    const cosasCv = lienzo(LW, LH), co = cosasCv.getContext('2d');
    co.translate(M, M);
    this.sitios = this.lamparas.map((l) => {
      const S = SITIOS[l.id] || SITIOS.nueva;
      for (const [id, dx, en, e, o = {}, dy = 0] of S.cosas) {
        const x = l.x + dx * u;
        if (en === 'suelo') pon(co, u, id, x, g.suelo + dy * u, e, o);
        else if (en === 'base') pon(cs, u, id, x, g.base, e, o);
        else pon(cs, u, id, x, H * en, e, { ancla: 'libre', ...o });
      }
      for (const [dx, dy] of S.leds || []) this.leds.push([l.x + dx * u, g.base + dy * u]);
      return { x18: l.x + S.x18 * u, pose: S.pose };
    });
    // la sala se guarda dos veces: a oscuras y alumbrada; el mapa de luz de cada fotograma las mezcla
    this.salaLuz = copia(sala); tenir(this.salaLuz, NIEBLA, 0.16);
    this.salaOscura = copia(sala); tenir(this.salaOscura, '#05080c', 0.8); tenir(this.salaOscura, NIEBLA, 0.18);

    // ======================================================== suelo mojado
    const suelo = lienzo(LW, LH), cg = suelo.getContext('2d');
    cg.translate(M, M);
    gr = cg.createLinearGradient(0, g.suelo, 0, H + M);
    gr.addColorStop(0, '#0b1016'); gr.addColorStop(1, '#040507');
    cg.fillStyle = gr; cg.fillRect(-M, g.suelo, LW, H + M - g.suelo);
    cg.save(); cg.beginPath(); cg.rect(-M, g.suelo, LW, H + M - g.suelo); cg.clip();
    cg.translate(0, g.suelo * 2); cg.scale(1, -1);
    cg.globalAlpha = 0.2; cg.filter = `blur(${1.6 * u}px)`;
    cg.drawImage(fondo, -M, -M); cg.globalAlpha = 0.22; cg.drawImage(this.salaOscura, -M, -M);
    cg.restore();
    // juntas de las losas en perspectiva hacia el centro
    cg.save(); cg.beginPath(); cg.rect(-M, g.suelo, LW, H + M - g.suelo); cg.clip();
    cg.strokeStyle = 'rgba(0,0,0,.5)'; cg.lineWidth = 1.4 * u;
    for (let k = -16; k <= 16; k++) { cg.beginPath(); cg.moveTo(W / 2 + k * 60 * u, g.suelo); cg.lineTo(W / 2 + k * 60 * u * 3.2, H + M); cg.stroke(); }
    for (let k = 0, y = g.suelo + 8 * u; y < H + M; k++, y += (10 + k * 9) * u) { cg.beginPath(); cg.moveTo(-M, y); cg.lineTo(W + M, y); cg.stroke(); }
    for (let k = 0; k < 18; k++) {
      const y = g.suelo + 4 * u + r() * (H - g.suelo), x = r() * W, w = 60 * u + r() * 200 * u;
      const gw = cg.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
      gw.addColorStop(0, 'rgba(150,180,210,0)'); gw.addColorStop(0.5, 'rgba(150,180,210,.05)'); gw.addColorStop(1, 'rgba(150,180,210,0)');
      cg.fillStyle = gw; cg.fillRect(x - w / 2, y, w, 1.6 * u);
    }
    cg.restore();
    cg.fillStyle = 'rgba(127,151,173,.22)'; cg.fillRect(-M, g.suelo, LW, 1.2 * u);
    pon(cg, u, 'escombros', W * 0.035, g.suelo + 4 * u, 1.1);
    pon(cg, u, 'tornillos_sueltos', W * 0.965, g.suelo + 8 * u, 1.2);
    this.suelo = suelo;
    this.cosasLuz = copia(cosasCv); tenir(this.cosasLuz, NIEBLA, 0.08);
    this.cosasOscura = copia(cosasCv); tenir(this.cosasOscura, '#05080c', 0.8);

    // ======================================================== el carril del que cuelgan las lamparas
    const riel = lienzo(LW, 60 * u), cr = riel.getContext('2d');
    cr.translate(M, 20 * u); cr.scale(u, u);
    {
      const x0 = W * 0.06 / u, x1 = W * 0.94 / u;
      metal(cr, () => camino(cr, [[x0, 0], [x1, 0], [x1, 9], [x0, 9]]), [x0, 0, x1 - x0, 9], { semilla: 41, oxido: 0.6, base: '#3e4752', cilindro: 'h' });
      for (let x = x0 + 14; x < x1; x += 46) { cr.fillStyle = 'rgba(190,210,230,.18)'; cr.beginPath(); cr.arc(x, 4.5, 1.1, 0, 7); cr.fill(); }
    }
    this.riel = riel;
    // los tirantes del carril al techo, en los extremos
    this.tirantes = [W * 0.08, W * 0.92];

    // ======================================================== primer plano: siluetas (fuera de los rotulos)
    this.gancho = silueta(u, 'gancho_grua', 3.1, { ancla: 'techo', w: 48, h: 176 });
    this.cables = silueta(u, 'cables_colgando', 2.6, { ancla: 'techo', w: 72, h: 128, flip: true });
    this.escombro = silueta(u, 'escombros', 2.4, { w: 96, h: 36, blur: 3 });

    // ======================================================== los nombres pintados en el suelo
    this.rotulos = this.opciones.map((o, k) => this.rotulo(o.texto, u, k));

    // ======================================================== niebla, grano y lienzos de trabajo
    if (!this.niebla) {
      const n = ruido(31, 64, 4, 256), d = n.getContext('2d').getImageData(0, 0, 256, 256);
      const cv = lienzo(256, 256), c = cv.getContext('2d'), im = c.createImageData(256, 256);
      for (let i = 0; i < d.data.length; i += 4) { const v = d.data[i] / 255; im.data[i] = 150; im.data[i + 1] = 178; im.data[i + 2] = 205; im.data[i + 3] = Math.max(0, v - 0.38) * 2.6 * 255; }
      c.putImageData(im, 0, 0); this.niebla = cv;
      const gcv = lienzo(256, 256), gc = gcv.getContext('2d'), gi = gc.createImageData(256, 256);
      for (let i = 0; i < gi.data.length; i += 4) { const v = Math.random() * 255; gi.data[i] = gi.data[i + 1] = gi.data[i + 2] = v; gi.data[i + 3] = 255; }
      gc.putImageData(gi, 0, 0); this.grano = gcv;
    }
    this.capaNiebla = lienzo(Math.ceil(W / 4), Math.ceil(H / 4));
    this.mapaLuz = lienzo(Math.ceil(W / 4), Math.ceil(H / 4));
    this.trabajo = lienzo(W, H);
    this.motas = Array.from({ length: 90 }, (_, k) => ({ a: hash(k, 1), b: hash(k, 2), z: hash(k, 3), v: 0.5 + hash(k, 4) }));
  }

  // Un nombre pintado a plantilla en el suelo: letras espaciadas y la pintura gastada a trozos (pisada, mojada)
  rotulo(txt, u, k) {
    const fs = 23 * u, sp = 5 * u;
    const m = lienzo(10, 10).getContext('2d'); m.font = `${fs}px ${SERIF}`;
    const anchos = [...txt].map((ch) => m.measureText(ch).width);
    const w = anchos.reduce((s, a) => s + a + sp, -sp);
    const cv = lienzo(w + 40 * u, fs * 2.2), c = cv.getContext('2d');
    c.font = `${fs}px ${SERIF}`; c.fillStyle = '#e8e0cc'; c.textBaseline = 'alphabetic';
    let x = 20 * u; const base = fs * 1.15;
    [...txt].forEach((ch, i) => { c.fillText(ch, x, base); x += anchos[i] + sp; });
    // gastado: motas y rozaduras que se llevan la pintura
    const r = azar(90 + k);
    c.globalCompositeOperation = 'destination-out';
    for (let q = 0; q < 160; q++) { c.fillStyle = `rgba(0,0,0,${0.35 + r() * 0.6})`; c.beginPath(); c.arc(r() * cv.width, r() * cv.height, (0.4 + r() * 1.6) * u, 0, 7); c.fill(); }
    for (let q = 0; q < 4; q++) {
      c.strokeStyle = `rgba(0,0,0,${0.4 + r() * 0.4})`; c.lineWidth = (1 + r() * 2) * u;
      const y = r() * cv.height, x0 = r() * cv.width;
      c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + (30 + r() * 60) * u, y + (r() - 0.5) * 8 * u); c.stroke();
    }
    return cv;
  }

  // ------------------------------------------------------------ cada fotograma
  dibujar(c, W, H, u, t, S, cursor) {
    this.preparar(W, H, u);
    const g = this.g, M = this.M;
    const dt = Math.min(0.1, Math.max(0, t - this.ultimo)); this.ultimo = t;
    // el aire que mueve el raton: su posicion y su velocidad en pantalla (suavizada entre fotogramas)
    const a = this.aire || (this.aire = { x: 0, y: 0, vx: 0, vy: 0, activo: false });
    if (cursor && cursor.visible && dt > 0) {
      const vx = a.activo ? (cursor.x - a.x) / dt : 0, vy = a.activo ? (cursor.y - a.y) / dt : 0;
      const tope = 4000 * u, k = Math.hypot(vx, vy) > tope ? tope / Math.hypot(vx, vy) : 1;
      a.vx += (vx * k - a.vx) * 0.5; a.vy += (vy * k - a.vy) * 0.5;
      a.x = cursor.x; a.y = cursor.y; a.activo = true;
    } else if (!cursor || !cursor.visible) { a.activo = false; a.vx = a.vy = 0; }
    const k = 1 - Math.exp(-dt * 3);
    this.px += ((0.5 - this.mx) - this.px) * k; this.py += ((0.5 - this.my) - this.py) * k;
    const off = (p) => [this.px * p * 2 * M * 0.75, this.py * p * 2 * M * 0.35];
    const capa = (cv, p) => { const [ox, oy] = off(p); c.drawImage(cv, -M + ox, -M + oy); };

    this.vivir(t, dt, u);
    const [ox, oy] = off(PROF.suelo);
    // cada lampara con su sitio en pantalla (el pendulo de dos cables de focos.js, se mece despacio)
    const focos = this.lamparas.map((l, i) => {
      const th = 0.03 * Math.sin(t * 1.6 + l.fase) + 0.01 * Math.sin(t * 0.7 + 1 + l.fase);
      const largo = l.y - g.riel;
      return { l, px: l.x + ox, py: g.riel + oy, x: l.x + ox + Math.sin(th) * largo * 0.35, y: g.riel + oy + Math.cos(th) * largo, giro: th * 0.5, i };
    });
    const sy = g.suelo + oy;
    this.pintarMapaLuz(W, H, u, focos, sy);

    c.save();
    // fondo, rayos de las ventanas y la grieta
    capa(this.fondo, PROF.fondo);
    {
      const [fx, fy] = off(PROF.fondo);
      c.save(); c.globalCompositeOperation = 'lighter';
      this.ventanas.forEach((v, i) => {
        const al = 0.05 + 0.02 * Math.sin(t * 0.25 + i * 1.7);
        const x0 = v.x + fx, y0 = v.y + v.h * 0.4 + fy, dx = H * 0.3 * (i ? -1 : 1);
        const gr = c.createLinearGradient(x0, y0, x0 + dx, g.horiz + fy);
        gr.addColorStop(0, `rgba(170,200,235,${al})`); gr.addColorStop(1, 'rgba(170,200,235,0)');
        c.fillStyle = gr; c.beginPath();
        c.moveTo(x0 - v.w / 2, y0); c.lineTo(x0 + v.w / 2, y0); c.lineTo(x0 + v.w / 2 + dx + 30 * u, g.horiz + fy + 20 * u); c.lineTo(x0 - v.w / 2 + dx - 30 * u, g.horiz + fy + 20 * u); c.fill();
      });
      const { x, y0, y1 } = this.grieta, pulso = 0.5 + 0.5 * Math.sin(t * 1.3);
      const gg = c.createRadialGradient(x + fx, (y0 + y1) / 2 + fy, 0, x + fx, (y0 + y1) / 2 + fy, 110 * u);
      gg.addColorStop(0, `rgba(140,190,235,${0.05 + 0.04 * pulso})`); gg.addColorStop(1, 'rgba(140,190,235,0)');
      c.fillStyle = gg; c.fillRect(x + fx - 110 * u, y0 + fy - 60 * u, 220 * u, y1 - y0 + 120 * u);
      c.restore();
    }
    // la sala: a oscuras, y alumbrada solo donde llega la luz de las lamparas
    this.alumbrada(c, this.salaOscura, this.salaLuz, off(PROF.sala), W, H);
    {
      const [lx, ly] = off(PROF.sala);
      c.save(); c.globalCompositeOperation = 'lighter';
      this.leds.forEach(([x, y], i) => {
        if (Math.sin(t * (1.1 + i * 0.7) + i * 2) <= -0.2) return;
        const col = i % 3 === 1 ? '255,200,120' : '150,220,190';
        const gl = c.createRadialGradient(x + lx, y + ly, 0, x + lx, y + ly, 9 * u);
        gl.addColorStop(0, `rgba(${col},.7)`); gl.addColorStop(1, `rgba(${col},0)`);
        c.fillStyle = gl; c.fillRect(x + lx - 9 * u, y + ly - 9 * u, 18 * u, 18 * u);
      });
      c.restore();
    }
    this.nieblaBaja(c, W, H, u, t, g.horiz - 70 * u, g.suelo + 40 * u, 0.55, 1);
    // el suelo, lo que hay en el y los nombres pintados
    capa(this.suelo, PROF.suelo);
    this.alumbrada(c, this.cosasOscura, this.cosasLuz, off(PROF.suelo), W, H);
    for (const f of focos) this.luzSuave(c, W, H, u, f, sy, f.l.L);
    if (this.conRotulos !== false) this.pintarRotulos(c, W, H, u, t, focos, sy);
    const elegida = focos[this.sel] || focos[0];
    if (elegida && elegida.l.L > 0.2) this.goteo(c, u, t, elegida.x, sy, oy, elegida.l.L);
    // el 18
    if (S && this.p18) this.dibujar18(c, W, H, u, t, S, focos, ox, sy);
    // el carril, las lamparas, sus haces y el polvo
    {
      c.save(); c.globalAlpha = 0.95;
      c.drawImage(this.riel, -M + ox, g.riel - 20 * u + oy - 4 * u);
      c.strokeStyle = '#05070a'; c.lineWidth = 3 * u;
      for (const x of this.tirantes) { c.beginPath(); c.moveTo(x + ox, g.techo + 50 * u); c.lineTo(x + ox, g.riel + oy); c.stroke(); }
      c.restore();
    }
    for (const f of focos) this.lampara(c, u, f);
    for (const f of focos) if (f.l.L > 0.04) this.haz(c, W, H, u, t, f, sy, f.l.L, dt, f.i === this.sel);
    if (elegida) this.polvo(c, W, H, u, t, elegida.x, elegida.y, sy, elegida.l.L);
    // bruma delante, muy suave
    this.nieblaBaja(c, W, H, u, t * 1.4, g.suelo - 30 * u, H, 0.35, 2);
    // primer plano en silueta
    {
      const [ox2, oy2] = off(PROF.frente);
      const bal = Math.sin(t * 0.5) * 0.025;
      c.save(); c.translate(W * 0.025 + ox2, -10 * u + oy2); c.rotate(bal);
      c.drawImage(this.gancho, -this.gancho.width / 2, 0); c.restore();
      c.save(); c.translate(W * 0.99 + ox2, -16 * u + oy2); c.rotate(-bal * 0.6);
      c.drawImage(this.cables, -this.cables.width / 2, 0); c.restore();
      c.drawImage(this.escombro, -this.escombro.width * 0.45 + ox2, H - this.escombro.height + 40 * u + oy2);
      c.drawImage(this.escombro, W - this.escombro.width * 0.55 + ox2, H - this.escombro.height + 52 * u + oy2);
    }
    c.restore();
    this.acabado(c, W, H, u, t, elegida ? elegida.x : W / 2, sy, elegida ? Math.min(1, elegida.l.L) : 1);
  }

  // Las lamparas (encender a golpes, apagar con el tubo aun tibio) y el 18 (andar o correr hasta su luz)
  vivir(t, dt, u) {
    this.lamparas.forEach((l, i) => {
      const on = i === this.sel;
      if (on && !l.on) { l.on = true; l.t0 = t; }
      if (!on && l.on) l.on = false;
      let v = 0;
      if (l.on) { const s = t - l.t0; v = s < 0.3 ? arranque(s) : Math.min(1.02, parpadeo(t, 18 + i) / 0.92); }
      // un fluorescente se enciende de golpe y se apaga casi de golpe
      l.L = v > l.L ? v : l.L + (v - l.L) * (1 - Math.exp(-dt * 16));
      l.L += l.fogonazo * 0.9;
      l.fogonazo *= Math.exp(-dt * 6);
      l.brasa = Math.max(l.brasa * Math.exp(-dt * 2.2), Math.min(1, l.L));
    });
    const sitio = this.sitios[this.sel] || this.sitios[0];
    if (!sitio) return;
    let p = this.p18;
    if (!p) p = this.p18 = { x: sitio.x18, v: 0, cara: -1, anim: sitio.pose, tA: 0, parado: true, frena: 0, corre: false, respingo: 0 };
    const dx = sitio.x18 - p.x, d = Math.abs(dx);
    const ANDA = 135 * u, CORRE = 320 * u, ACEL = 900 * u;
    if (d > 2.5 * u || Math.abs(p.v) > 20 * u) {
      if (p.parado) { p.parado = false; p.corre = d > 250 * u; p.tA = 0; }
      const vmax = p.corre ? CORRE : ANDA;
      const quiere = Math.sign(dx) * Math.min(vmax, Math.sqrt(2 * ACEL * d));
      const cambio = Math.max(-ACEL * 1.6 * dt, Math.min(ACEL * 1.6 * dt, quiere - p.v));
      p.v += cambio;
      p.x += p.v * dt;
      if (Math.abs(p.v) > 5 * u) p.cara = Math.sign(p.v);
      p.anim = p.corre ? 'correr' : 'andar';
      p.tA += dt * Math.max(0.35, Math.abs(p.v) / vmax);
      if (d < 1.5 * u && Math.abs(p.v) < 30 * u) { p.x = sitio.x18; p.v = 0; }
    } else if (!p.parado) {
      p.parado = true; p.v = 0; p.x = sitio.x18; p.tA = 0;
      p.frena = p.corre ? 0.24 : 0.12;
    }
    if (p.parado) {
      if (p.frena > 0) { p.frena -= dt; p.anim = 'frenar'; } else { if (p.anim === 'frenar') p.tA = 0; p.anim = sitio.pose; }
      p.tA += dt;
    }
    p.respingo = Math.max(0, p.respingo - dt);
  }

  // Mapa de luz en pantalla (a un cuarto de resolucion), en el ALFA: una mancha por lampara que va del tubo
  // al suelo; 'lighter' suma tambien el alfa, asi que dos lamparas a medias se suman
  pintarMapaLuz(W, H, u, focos, sy) {
    const m = this.mapaLuz, c = m.getContext('2d'), k = m.width / W;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, m.width, m.height);
    c.globalCompositeOperation = 'lighter';
    for (const f of focos) {
      const L = Math.min(1.2, f.l.L);
      if (L < 0.01) continue;
      const cy = (f.y + sy) / 2, ry = (sy - f.y) * 0.95, rx = this.paso * 0.62;
      c.save(); c.scale(k, k); c.translate(f.x, cy); c.scale(rx / ry, 1);
      const gr = c.createRadialGradient(0, -ry * 0.15, 0, 0, 0, ry);
      gr.addColorStop(0, `rgba(255,255,255,${Math.min(1, L)})`); gr.addColorStop(0.45, `rgba(255,255,255,${0.6 * L})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr; c.fillRect(-ry, -ry, ry * 2, ry * 2);
      c.restore();
    }
  }

  // Una capa a oscuras y, encima, la misma alumbrada recortada por el mapa de luz
  alumbrada(c, oscura, luz, [ox, oy], W, H) {
    const M = this.M;
    c.drawImage(oscura, -M + ox, -M + oy);
    const tr = this.trabajo, ct = tr.getContext('2d');
    ct.globalCompositeOperation = 'source-over';
    ct.clearRect(0, 0, W, H);
    ct.drawImage(luz, -M + ox, -M + oy);
    ct.globalCompositeOperation = 'destination-in';
    ct.imageSmoothingEnabled = true;
    ct.drawImage(this.mapaLuz, 0, 0, W, H);
    c.drawImage(tr, 0, 0);
  }

  // Los nombres en el suelo: pintura que se ve poco a oscuras y se enciende con la luz de su lampara
  pintarRotulos(c, W, H, u, t, focos, sy) {
    focos.forEach((f, k) => {
      const cv = this.rotulos[k];
      if (!cv) return;
      const L = Math.min(1.3, f.l.L), x = f.l.x + (f.x - f.l.x) * 0.15, y = sy + (H - sy) * 0.48;
      const sesgo = ((x - W / 2) / W) * 0.3;    // perspectiva: las letras de los lados se tuercen hacia fuera
      c.save();
      c.translate(x, y); c.transform(1, 0, sesgo, 0.64, 0, 0);
      const w = cv.width, h = cv.height;
      c.globalAlpha = 0.4 + 0.5 * Math.min(1, L);
      c.drawImage(cv, -w / 2, -h / 2);
      if (L > 0.05) {
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = 0.45 * Math.min(1, L);
        c.filter = `blur(${2.2 * u}px)`; c.drawImage(cv, -w / 2, -h / 2);
        c.filter = 'none'; c.globalAlpha = 0.22 * Math.min(1, L); c.drawImage(cv, -w / 2, -h / 2);
      }
      c.restore();
    });
  }

  dibujar18(c, W, H, u, t, S, focos, ox, sy) {
    const p = this.p18, e = u * E18, x = p.x + ox;
    // luz que le llega: la de las lamparas segun lo lejos que este de cada una
    let luz = 0;
    for (const f of focos) { const d = (x - f.x) / (this.paso * 0.42); luz += Math.min(1, f.l.L) * Math.exp(-d * d); }
    luz = Math.min(1, luz);
    const brillo = 0.3 + 0.7 * luz;
    const f = fotograma(S, p.anim, p.tA, null);
    const salto = p.respingo > 0 ? Math.sin((p.respingo / 0.3) * Math.PI) * 9 * u : 0;
    c.save();
    c.filter = `brightness(${brillo.toFixed(3)})`;
    // reflejo en el agua
    c.save(); c.translate(x, sy + 2 * u); c.scale(e, -e * 0.92);
    dibujarSprite(c, S, f.anim, f.i, 0, 0, p.cara, e, 0.2 * (0.4 + 0.6 * luz), false);
    c.restore();
    // sombra de contacto
    const so = c.createRadialGradient(x, sy, 0, x, sy, 46 * u);
    so.addColorStop(0, `rgba(0,0,0,${0.3 + 0.3 * luz})`); so.addColorStop(1, 'rgba(0,0,0,0)');
    c.save(); c.translate(x, sy); c.scale(1, 0.2); c.translate(-x, -sy); c.fillStyle = so; c.fillRect(x - 46 * u, sy - 46 * u, 92 * u, 92 * u); c.restore();
    c.save(); c.translate(x, sy - salto); c.scale(e, e);
    dibujarSprite(c, S, f.anim, f.i, 0, 0, p.cara, e);
    c.restore();
    c.restore();
  }

  // El fluorescente de focos.js a la escala de las lamparas, colgado del carril por dos cables
  lampara(c, u, f) {
    const e = u * EL, l = f.l;
    const ca = Math.cos(f.giro), sa = Math.sin(f.giro);
    c.save();
    c.strokeStyle = 'rgba(8,9,11,.95)'; c.lineWidth = 1.3 * e;
    for (const s of [-1, 1]) {
      c.beginPath(); c.moveTo(f.px + s * 30 * e, f.py + 3 * u);
      c.lineTo(f.x + (s * 26 * ca + 12 * sa) * e, f.y + (s * 26 * sa - 12 * ca) * e); c.stroke();
    }
    c.translate(f.x, f.y); c.rotate(f.giro); c.scale(e, e);
    caja(c, -44, -14, 88, 10, '#3b4552', 18 + f.i);
    // el tubo: blanco encendido; apagado, gris, con el rescoldo de cuando estaba encendido
    const b = Math.min(1, l.L), r = l.brasa;
    c.fillStyle = b > 0.05 ? `rgba(235,245,255,${0.35 + b * 0.62})` : `rgba(${Math.round(90 + 120 * r)},${Math.round(98 + 120 * r)},${Math.round(110 + 115 * r)},${0.55 + 0.3 * r})`;
    c.fillRect(-38, -6, 76, 3);
    c.restore();
  }

  // la luz del mapa de luz del juego (luz.js): un cono ancho y blando hacia abajo, un poco alrededor del
  // tubo y el charco que deja en el suelo mojado
  luzSuave(c, W, H, u, f, sy, L) {
    const parp = Math.min(1.25, L);
    if (parp < 0.01) return;
    const r = sy - f.y + 60 * u, y0 = f.y + r * 0.18;
    c.save(); c.globalCompositeOperation = 'lighter';
    c.save(); c.beginPath(); c.rect(0, 0, W, sy); c.clip();
    c.translate(f.x, f.y); c.rotate(f.giro); c.translate(-f.x, -f.y);
    const g = c.createRadialGradient(f.x, y0, 0, f.x, y0, r);
    g.addColorStop(0, `rgba(214,233,255,${0.16 * parp})`); g.addColorStop(0.12, `rgba(214,233,255,${0.11 * parp})`);
    g.addColorStop(0.35, `rgba(214,233,255,${0.05 * parp})`); g.addColorStop(0.65, `rgba(214,233,255,${0.016 * parp})`); g.addColorStop(1, 'rgba(214,233,255,0)');
    c.save(); c.beginPath(); c.rect(0, f.y - 6 * u, W, H); c.clip();
    c.translate(f.x, y0); c.scale(0.62, 1); c.translate(-f.x, -y0);
    c.fillStyle = g; c.fillRect(f.x - r * 1.3, f.y - 6 * u, r * 2.6, r * 1.5);
    c.restore();
    const g2 = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, r * 0.42);
    g2.addColorStop(0, `rgba(214,233,255,${0.11 * parp})`); g2.addColorStop(1, 'rgba(214,233,255,0)');
    c.fillStyle = g2; c.fillRect(f.x - r, f.y - r, r * 2, r * 2);
    c.restore();
    const fx = f.x, rc = this.paso * 0.62;
    const ch = c.createRadialGradient(fx, sy, 0, fx, sy, rc);
    ch.addColorStop(0, `rgba(214,233,255,${0.22 * parp})`); ch.addColorStop(0.5, `rgba(214,233,255,${0.06 * parp})`); ch.addColorStop(1, 'rgba(214,233,255,0)');
    c.save(); c.translate(fx, sy); c.scale(1, 0.24); c.translate(-fx, -sy); c.fillStyle = ch; c.fillRect(fx - rc, sy - rc, rc * 2, rc * 2); c.restore();
    const re = c.createLinearGradient(0, sy, 0, sy + 90 * u);
    re.addColorStop(0, `rgba(214,233,255,${0.07 * parp})`); re.addColorStop(1, 'rgba(214,233,255,0)');
    c.fillStyle = re; c.beginPath(); c.moveTo(fx - rc * 0.85, sy); c.lineTo(fx + rc * 0.85, sy); c.lineTo(fx + rc * 0.45, sy + 90 * u); c.lineTo(fx - rc * 0.45, sy + 90 * u); c.fill();
    c.restore();
  }

  // el haz con su polvo: el sprite de Blender de los focos del juego, tenido con la luz del laboratorio,
  // del tamano del tubo, girado con la lampara, cortado en el suelo y con el parpadeo (como haces.js).
  // El polvo con fisica va solo en el de la lampara elegida (es uno: se mueve con la eleccion).
  haz(c, W, H, u, t, f, sy, fz, dt, conPolvo) {
    const e = u * EL;
    if (!HAZ.listo) {
      c.save(); c.globalCompositeOperation = 'lighter';
      const g = c.createLinearGradient(0, f.y, 0, sy);
      g.addColorStop(0, `rgba(214,233,255,${0.08 * fz})`); g.addColorStop(1, 'rgba(214,233,255,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(f.x - 36 * e, f.y); c.lineTo(f.x + 36 * e, f.y); c.lineTo(f.x + 120 * e, sy); c.lineTo(f.x - 120 * e, sy); c.fill();
      c.restore(); return;
    }
    const m = HAZ.m, tc = HAZ.tinte.getContext('2d');
    const pxU = (76 / (m.tuboM * m.pxPorMetro)) * e;
    const largo = ((sy - f.y) * 1.1) / (pxU * (m.h - m.tuboY));
    const ex = pxU * Math.pow(largo, 0.4), ey = pxU * largo;
    const k = Math.floor(t * m.fps + f.i * 7) % m.cuadros;
    const sx = (k % m.cols) * m.w, sy2 = Math.floor(k / m.cols) * m.h;
    tc.globalCompositeOperation = 'source-over'; tc.globalAlpha = 1; tc.clearRect(0, 0, m.w, m.h);
    tc.drawImage(HAZ.haz, 0, 0);
    tc.globalCompositeOperation = 'lighter'; tc.globalAlpha = 0.16; tc.drawImage(HAZ.polvo, sx, sy2, m.w, m.h, 0, 0, m.w, m.h); tc.globalAlpha = 1;
    tc.globalCompositeOperation = 'multiply'; tc.fillStyle = LUZ; tc.fillRect(0, 0, m.w, m.h);
    c.save();
    c.beginPath(); c.rect(0, 0, W, sy + 2 * u); c.clip();
    c.globalCompositeOperation = 'lighter';
    c.translate(f.x, f.y); c.rotate(f.giro); c.scale(ex, ey);
    for (let a = fz * 2.4; a > 0.02; a -= 1) { c.globalAlpha = Math.min(1, a); c.drawImage(HAZ.tinte, -m.tuboX, -m.tuboY); }
    c.restore();
    if (!conPolvo) return;
    // polvo fino CON FISICA: cada mota tiene posicion y velocidad (en pixeles del sprite). El aire quieto
    // la lleva hacia abajo muy despacio y la frena; el raton, al pasar, arrastra el aire con el (estela),
    // lo aparta y lo hace girar a su alrededor (remolino). Brilla segun la luz que le llega.
    const ca = Math.cos(f.giro), sa = Math.sin(f.giro), M = HAZ.mascara;
    const a = this.aire, R = 58 * u, R2 = (R * 2.4) ** 2;
    const calma = 1 - Math.exp(-dt * 0.8), arrastre = 1 - Math.exp(-dt * 7);
    const vel = a.activo ? Math.hypot(a.vx, a.vy) : 0;
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = '#eef6ff';
    for (const p of HAZ.motas) {
      p.vx += (Math.cos(t * 0.4 * p.v + p.f) * 2.4 * p.v - p.vx) * calma;
      p.vy += (6 * p.v - p.vy) * calma;
      let lx = (p.x - m.tuboX) * ex, ly = (p.y - m.tuboY) * ey;
      let X = f.x + lx * ca - ly * sa, Y = f.y + lx * sa + ly * ca;
      if (vel > 20 * u) {
        const dx = X - a.x, dy = Y - a.y, d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          const w = Math.exp(-d2 / (R * R)), d = Math.sqrt(d2) + 1e-3;
          p.vx += (a.vx * 0.8 / ex - p.vx) * arrastre * w;
          p.vy += (a.vy * 0.8 / ey - p.vy) * arrastre * w;
          const lado = Math.sign(a.vx * dy - a.vy * dx) || 1, imp = vel * w * dt * 3;
          p.vx += ((dx / d) * 0.45 - (dy / d) * 0.35 * lado) * imp / ex;
          p.vy += ((dy / d) * 0.45 + (dx / d) * 0.35 * lado) * imp / ey;
        }
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      const rapidez = Math.hypot(p.vx * ex, p.vy * ey);
      p.g += dt * (2.3 * p.v + rapidez * 0.025);
      if (p.y > m.h) { p.y = m.tuboY + Math.random() * 14; p.x = p.x0; p.vx = 0; p.vy = 6 * p.v; }
      else if (p.y < m.tuboY) { p.y = m.tuboY; p.vy = Math.abs(p.vy) * 0.3; }
      if (p.x < -80) p.x += m.w + 160; else if (p.x > m.w + 80) p.x -= m.w + 160;
      const l = p.x < 0 || p.x >= m.w ? 0 : M[(p.y | 0) * m.w + (p.x | 0)] || 0;
      const destello = Math.pow(0.5 + 0.5 * Math.sin(p.g + p.f * 3), 3);
      const brillo = l * Math.min(1, fz) * (0.25 + 0.75 * destello) * (1 + Math.min(0.6, rapidez / (400 * u)));
      if (brillo < 0.03) continue;
      lx = (p.x - m.tuboX) * ex; ly = (p.y - m.tuboY) * ey;
      X = f.x + lx * ca - ly * sa; Y = f.y + lx * sa + ly * ca;
      if (Y > sy) continue;
      const s = p.s * u;
      c.globalAlpha = Math.min(1, brillo * 1.4); c.fillRect(X - s / 2, Y - s / 2, s, s);
    }
    c.restore();
  }

  polvo(c, W, H, u, t, fx, ly, sy, parp) {
    if (parp < 0.05) return;
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const m of this.motas) {
      if (m.z <= 0.86) continue;
      const alto = sy - ly;
      const yy = ly + 10 * u + ((m.a * alto + t * 9 * u * m.v) % (alto - 10 * u));
      const ancho = 30 * u + (yy - ly) * 0.42;
      const xx = fx + (m.b - 0.5) * 2 * ancho * 0.8 + Math.sin(t * 0.3 * m.v + m.a * 9) * 12 * u;
      const borde = 1 - Math.min(1, Math.abs(xx - fx) / ancho);
      // motas desenfocadas, cerca de la camara (el polvo fino ya viene en el haz de Blender)
      const r = (4 + m.z * 6) * u, gb = c.createRadialGradient(xx, yy, 0, xx, yy, r);
      gb.addColorStop(0, `rgba(220,235,255,${0.09 * borde * Math.min(1, parp)})`); gb.addColorStop(1, 'rgba(220,235,255,0)');
      c.fillStyle = gb; c.fillRect(xx - r, yy - r, r * 2, r * 2);
    }
    c.restore();
  }

  goteo(c, u, t, fx, sy, oy, L) {
    // una gota cae del carril cada 3,4 s al charco y abre un anillo (solo se ve donde hay luz)
    const T = 3.4, f = (t % T) / T, x = fx - 34 * u, y0 = this.g.riel + 6 * u + oy;
    const caida = 0.5, a = Math.min(1, L);
    c.save();
    if (f < caida) {
      const k = f / caida, y = y0 + (sy - y0) * k * k;
      c.fillStyle = `rgba(200,225,245,${(0.5 + 0.3 * k) * a})`; c.beginPath(); c.ellipse(x, y, 1.4 * u, (2 + k * 3) * u, 0, 0, 7); c.fill();
    } else {
      const k = (f - caida) / (1 - caida);
      for (const d of [0, 0.25]) {
        const kk = k - d; if (kk <= 0) continue;
        c.strokeStyle = `rgba(200,225,245,${0.35 * (1 - kk) * a})`; c.lineWidth = 1 * u;
        c.beginPath(); c.ellipse(x, sy + 6 * u, kk * 46 * u, kk * 7 * u, 0, 0, 7); c.stroke();
      }
    }
    c.restore();
  }

  nieblaBaja(c, W, H, u, t, y0, y1, a, sem) {
    const n = this.capaNiebla, cn = n.getContext('2d');
    const w = n.width, h = n.height, esc = 1.6 * (sem === 2 ? 1.4 : 1);
    cn.setTransform(1, 0, 0, 1, 0, 0); cn.globalCompositeOperation = 'source-over'; cn.clearRect(0, 0, w, h);
    const tam = 256 * esc * (w / 320);
    for (const [vel, alfa, dy] of [[6, 1, 0], [-3.5, 0.7, tam * 0.37]]) {
      const ox = -(((t * vel * (w / 320) + sem * 97) % tam) + tam) % tam;
      cn.globalAlpha = alfa;
      for (let x = ox; x < w; x += tam) for (let y = -dy % tam - tam; y < h; y += tam) cn.drawImage(this.niebla, x, y, tam, tam);
    }
    cn.globalAlpha = 1; cn.globalCompositeOperation = 'destination-in';
    const gy = cn.createLinearGradient(0, (y0 / H) * h, 0, (y1 / H) * h);
    gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(0.5, 'rgba(0,0,0,1)'); gy.addColorStop(1, 'rgba(0,0,0,0)');
    cn.fillStyle = gy; cn.fillRect(0, 0, w, h);
    c.save(); c.globalAlpha = a * 0.22; c.globalCompositeOperation = 'screen';
    c.imageSmoothingEnabled = true; c.drawImage(n, 0, 0, W, H);
    c.restore();
  }

  acabado(c, W, H, u, t, fx, sy, parp) {
    // el nombre del juego necesita aire: arriba en el centro un punto mas oscuro
    const iz = c.createRadialGradient(W / 2, H * 0.2, 0, W / 2, H * 0.2, W * 0.32);
    iz.addColorStop(0, 'rgba(3,4,7,.45)'); iz.addColorStop(1, 'rgba(3,4,7,0)');
    c.save(); c.translate(W / 2, H * 0.2); c.scale(1, 0.5); c.translate(-W / 2, -H * 0.2); c.fillStyle = iz; c.fillRect(0, -H, W, H * 3); c.restore();
    // cuando el fluorescente elegido parpadea, la sala entera se apaga un poco
    if (parp < 0.9) { c.fillStyle = `rgba(0,0,0,${(0.9 - parp) * 0.25})`; c.fillRect(0, 0, W, H); }
    // viñeta centrada en la luz elegida, gradacion fria
    const vin = c.createRadialGradient(fx * 0.6 + W * 0.2, H * 0.55, H * 0.32, W / 2, H / 2, H * 1.05);
    vin.addColorStop(0, 'rgba(0,0,0,0)'); vin.addColorStop(1, 'rgba(0,0,0,.74)');
    c.fillStyle = vin; c.fillRect(0, 0, W, H);
    c.save(); c.globalCompositeOperation = 'soft-light'; c.fillStyle = 'rgba(40,70,110,.35)'; c.fillRect(0, 0, W, H); c.restore();
    // grano de pelicula
    c.save(); c.globalCompositeOperation = 'overlay'; c.globalAlpha = 0.07;
    const gx = -Math.floor(hash(Math.floor(t * 24), 3) * 256), gy = -Math.floor(hash(Math.floor(t * 24), 5) * 256);
    const e = Math.max(1, Math.round(u));
    for (let x = gx; x < W; x += 256 * e) for (let y = gy; y < H; y += 256 * e) c.drawImage(this.grano, x, y, 256 * e, 256 * e);
    c.restore();
  }
}
