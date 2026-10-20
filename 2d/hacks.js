// Los Hacks (GDD): las cerraduras del laboratorio piden el patron de dibujo de un sujeto. Varga enseno al
// 18 a dibujar circulos en el cristal del frasco, y ese gesto es su llave.
//   Hack 1: dibujar 3 circulos sobre la rejilla con el raton.
//   Hack 2: recorrer con el raton un laberinto circular sin tocar las paredes.
//   Hack 3 (el Linde): los anillos del tocon. Girarlos hasta que las cuatro marcas de luz casen con la muesca.
import { LETRA, SERIF } from './hud.js';

const TXT = {
  en: { h1: 'Draw three circles', h2: 'Reach the centre without touching the walls', h3: 'Turn the four lights up to the notch', h3b: 'Drag a ring to turn it · the ring inside turns with it', salir: 'Esc  step back', ok: 'Open' },
  es: { h1: 'Dibuja tres círculos', h2: 'Llega al centro sin tocar las paredes', h3: 'Sube las cuatro luces hasta la muesca', h3b: 'Arrastra un anillo para girarlo · el de dentro gira con él', salir: 'Esc  apartarse', ok: 'Abierta' },
};

// ---------------------------------------------------------------- Hack 1
export class Hack1 {
  constructor(sonido) { this.trazos = []; this.actual = null; this.circulos = []; this.fallos = []; this.fin = 0; this.resultado = null; this.son = sonido; }
  puntero(tipo, x, y) {
    if (this.fin) return;
    if (tipo === 'baja') this.actual = [[x, y]];
    else if (tipo === 'mueve' && this.actual) {
      const u = this.actual[this.actual.length - 1];
      if (Math.hypot(x - u[0], y - u[1]) > 2) { this.actual.push([x, y]); this.son?.('tiza'); }
    } else if (tipo === 'sube' && this.actual) {
      const c = circulo(this.actual, this.u);
      if (c && this.dentro(c)) {
        this.circulos.push({ ...c, pts: this.actual, t: 0 });
        this.son?.('circulo');
        if (this.circulos.length >= 3) { this.fin = 0.001; this.son?.('abre'); }
      } else { this.fallos.push({ pts: this.actual, t: 0 }); this.son?.('falla'); }
      this.actual = null;
    }
  }
  dentro(c) { const r = this.rejilla; return r && c.x > r.x && c.x < r.x + r.w && c.y > r.y && c.y < r.y + r.h; }
  actualizar(dt) {
    for (const f of this.fallos) f.t += dt;
    this.fallos = this.fallos.filter((f) => f.t < 0.8);
    for (const c of this.circulos) c.t += dt;
    if (this.fin) { this.fin += dt; if (this.fin > 1.3) this.resultado = true; }
  }
  dibujar(c, W, H, u, t, leng) {
    this.u = u;
    c.save();
    c.fillStyle = 'rgba(3,4,6,.82)'; c.fillRect(0, 0, W, H);
    const w = Math.min(W - 60 * u, 560 * u), h = 360 * u, x = (W - w) / 2, y = (H - h) / 2;
    this.rejilla = { x, y, w, h };
    // la rejilla de ventilacion, de cerca
    c.fillStyle = '#1d2329'; c.fillRect(x, y, w, h);
    c.strokeStyle = '#0b0a0c'; c.lineWidth = 5 * u; c.strokeRect(x, y, w, h);
    const ab = this.fin ? Math.min(1, this.fin / 1.0) : 0;
    for (let k = 1; k < 9; k++) {
      const yy = y + (h * k) / 9;
      c.strokeStyle = '#0b0a0c'; c.lineWidth = 6 * u;
      c.beginPath(); c.moveTo(x + 8 * u, yy - ab * 18 * u * (k % 2 ? 1 : -1)); c.lineTo(x + w - 8 * u, yy - ab * 18 * u * (k % 2 ? 1 : -1)); c.stroke();
      c.strokeStyle = 'rgba(140,160,180,.25)'; c.lineWidth = 1.5 * u;
      c.beginPath(); c.moveTo(x + 8 * u, yy - 3 * u); c.lineTo(x + w - 8 * u, yy - 3 * u); c.stroke();
    }
    // tornillos en las esquinas
    c.fillStyle = '#5a636c';
    for (const [a, b] of [[x + 12 * u, y + 12 * u], [x + w - 12 * u, y + 12 * u], [x + 12 * u, y + h - 12 * u], [x + w - 12 * u, y + h - 12 * u]]) { c.beginPath(); c.arc(a, b, 5 * u, 0, 7); c.fill(); }
    // lo que se dibuja: tiza; los circulos buenos brillan azul palido (el color de Varga)
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const f of this.fallos) traza(c, f.pts, `rgba(235,230,220,${0.7 * (1 - f.t / 0.8)})`, 3 * u);
    if (this.actual) traza(c, this.actual, 'rgba(240,236,226,.9)', 3.4 * u);
    for (const ci of this.circulos) {
      c.save(); c.shadowColor = 'rgba(169,205,230,.95)'; c.shadowBlur = (10 + 8 * Math.sin(t * 4)) * u;
      traza(c, ci.pts, 'rgba(200,228,245,.95)', 3.4 * u);
      c.restore();
    }
    // tres huecos que esperan
    for (let k = 0; k < 3; k++) {
      c.beginPath(); c.arc(W / 2 + (k - 1) * 30 * u, y + h + 28 * u, 8 * u, 0, 7);
      c.lineWidth = 1.5 * u; c.strokeStyle = 'rgba(200,228,245,.8)'; c.stroke();
      if (k < this.circulos.length) { c.fillStyle = 'rgba(200,228,245,.9)'; c.fill(); }
    }
    c.fillStyle = '#efe8da'; c.textAlign = 'center';
    c.font = `${20 * u}px ${LETRA}`; c.fillText(this.fin ? TXT[leng].ok : TXT[leng].h1, W / 2, y - 22 * u);
    c.font = `${11 * u}px ${SERIF}`; c.fillStyle = 'rgba(239,232,218,.5)'; c.fillText(TXT[leng].salir, W / 2, y + h + 62 * u);
    c.restore();
  }
}

function traza(c, pts, color, g) {
  if (pts.length < 2) return;
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length; k++) c.lineTo(pts[k][0], pts[k][1]);
  c.strokeStyle = color; c.lineWidth = g; c.stroke();
}

// Reconoce un circulo: cerrado, radio parecido en todo el trazo y que da la vuelta entera
export function circulo(pts, u = 1) {
  if (pts.length < 12) return null;
  let cx = 0, cy = 0;
  for (const [x, y] of pts) { cx += x; cy += y; }
  cx /= pts.length; cy /= pts.length;
  const rs = pts.map(([x, y]) => Math.hypot(x - cx, y - cy));
  const r = rs.reduce((a, b) => a + b, 0) / rs.length;
  if (r < 14 * u || r > 170 * u) return null;
  const desv = Math.sqrt(rs.reduce((a, b) => a + (b - r) ** 2, 0) / rs.length) / r;
  if (desv > 0.3) return null;
  let giro = 0;
  for (let k = 1; k < pts.length; k++) {
    let d = Math.atan2(pts[k][1] - cy, pts[k][0] - cx) - Math.atan2(pts[k - 1][1] - cy, pts[k - 1][0] - cx);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    giro += d;
  }
  if (Math.abs(giro) < Math.PI * 1.7) return null;
  const cierre = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
  if (cierre > r * 0.9) return null;
  return { x: cx, y: cy, r };
}

// ---------------------------------------------------------------- Hack 2
// Anillos (radio relativo) con su hueco, y paredes radiales en el pasillo de fuera de cada anillo.
const ANILLOS = [
  { r: 1.0, hueco: 0 },
  { r: 0.8, hueco: Math.PI, pared: -0.5 },        // pasillo 0.8-1.0: pared radial en -0,5: hay que ir por arriba
  { r: 0.6, hueco: 0.3, pared: Math.PI - 0.5 },
  { r: 0.4, hueco: -1.6, pared: 0.8 },
  { r: 0.2, hueco: -2.8, pared: -1.1 },
];
const ANCHO_HUECO = 0.34;

const difAng = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

export class Hack2 {
  constructor(sonido) { this.estado = 'espera'; this.camino = []; this.resultado = null; this.fin = 0; this.choque = 0; this.son = sonido; }
  geometria(W, H, u) {
    const R = Math.min(W, H) * 0.32;
    return { cx: W / 2, cy: H / 2 + 10 * u, R, ent: [W / 2 + R * 1.14, H / 2 + 10 * u], tol: 6 * u };
  }
  toca(x, y) {
    const g = this.g;
    const dx = x - g.cx, dy = y - g.cy, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    for (let k = 0; k < ANILLOS.length; k++) {
      const A = ANILLOS[k], r = A.r * g.R;
      if (Math.abs(d - r) < g.tol && Math.abs(difAng(a, A.hueco)) > ANCHO_HUECO / 2 / A.r * 0.9) return true;
      if (A.pared !== undefined) {
        const r1 = ANILLOS[k - 1].r * g.R;
        if (d > r - 2 && d < r1 + 2 && Math.abs(difAng(a, A.pared)) * d < g.tol) return true;
      }
    }
    return false;
  }
  puntero(tipo, x, y) {
    if (!this.g || this.fin) return;
    const g = this.g;
    if (tipo === 'baja') {
      if (Math.hypot(x - g.ent[0], y - g.ent[1]) < 22 * (g.R / 200)) { this.estado = 'dentro'; this.camino = [[x, y]]; this.son?.('tiza'); }
      return;
    }
    if (this.estado !== 'dentro') return;
    if (tipo === 'sube') { this.estado = 'espera'; this.camino = []; return; }
    const u = this.camino[this.camino.length - 1];
    const n = Math.ceil(Math.hypot(x - u[0], y - u[1]) / 2);
    for (let k = 1; k <= n; k++) {
      const px = u[0] + ((x - u[0]) * k) / n, py = u[1] + ((y - u[1]) * k) / n;
      if (this.toca(px, py)) { this.estado = 'espera'; this.choque = 0.5; this.chispa = [px, py]; this.camino = []; this.son?.('falla'); return; }
      if (Math.hypot(px - g.cx, py - g.cy) < ANILLOS[ANILLOS.length - 1].r * g.R - g.tol) { this.camino.push([px, py]); this.fin = 0.001; this.estado = 'hecho'; this.son?.('abre'); return; }
    }
    this.camino.push([x, y]);
    if (Math.random() < 0.3) this.son?.('tiza');
  }
  actualizar(dt) {
    this.choque = Math.max(0, this.choque - dt);
    if (this.fin) { this.fin += dt; if (this.fin > 1.4) this.resultado = true; }
  }
  dibujar(c, W, H, u, t, leng) {
    const g = this.g = this.geometria(W, H, u);
    c.save();
    c.fillStyle = 'rgba(3,3,5,.84)'; c.fillRect(0, 0, W, H);
    // la puerta: chapa redonda remachada
    c.beginPath(); c.arc(g.cx, g.cy, g.R * 1.26, 0, 7);
    const gr = c.createRadialGradient(g.cx - g.R * 0.3, g.cy - g.R * 0.4, 0, g.cx, g.cy, g.R * 1.3);
    gr.addColorStop(0, '#3b3636'); gr.addColorStop(1, '#1a1717'); c.fillStyle = gr; c.fill();
    c.lineWidth = 6 * u; c.strokeStyle = '#0b0a0c'; c.stroke();
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; c.fillStyle = '#5c5552'; c.beginPath(); c.arc(g.cx + Math.cos(a) * g.R * 1.18, g.cy + Math.sin(a) * g.R * 1.18, 3.2 * u, 0, 7); c.fill(); }
    // el laberinto, en azul palido
    const brillo = this.fin ? 1 : 0.75 + 0.15 * Math.sin(t * 2);
    c.save(); c.shadowColor = 'rgba(169,205,230,.9)'; c.shadowBlur = 8 * u;
    c.strokeStyle = `rgba(169,205,230,${brillo})`; c.lineWidth = 3 * u; c.lineCap = 'round';
    for (let k = 0; k < ANILLOS.length; k++) {
      const A = ANILLOS[k], r = A.r * g.R, m = ANCHO_HUECO / 2 / A.r;
      c.beginPath(); c.arc(g.cx, g.cy, r, A.hueco + m, A.hueco - m + Math.PI * 2); c.stroke();
      if (A.pared !== undefined) {
        const r1 = ANILLOS[k - 1].r * g.R;
        c.beginPath(); c.moveTo(g.cx + Math.cos(A.pared) * r, g.cy + Math.sin(A.pared) * r); c.lineTo(g.cx + Math.cos(A.pared) * r1, g.cy + Math.sin(A.pared) * r1); c.stroke();
      }
    }
    c.restore();
    // centro y entrada
    c.save(); c.globalCompositeOperation = 'lighter';
    const cen = c.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, g.R * 0.18);
    cen.addColorStop(0, `rgba(255,246,228,${0.3 + (this.fin ? 0.6 : 0.15 * Math.sin(t * 3))})`); cen.addColorStop(1, 'rgba(255,246,228,0)');
    c.fillStyle = cen; c.fillRect(g.cx - g.R, g.cy - g.R, g.R * 2, g.R * 2);
    c.restore();
    c.beginPath(); c.arc(g.ent[0], g.ent[1], 9 * u, 0, 7);
    c.fillStyle = this.estado === 'dentro' ? 'rgba(255,246,228,.4)' : `rgba(255,246,228,${0.6 + 0.3 * Math.sin(t * 5)})`; c.fill();
    // el camino del 18: blanco calido
    if (this.camino.length > 1) {
      c.save(); c.shadowColor = 'rgba(255,246,228,.9)'; c.shadowBlur = 8 * u;
      traza(c, this.camino, 'rgba(255,246,228,.95)', 3 * u);
      const u2 = this.camino[this.camino.length - 1];
      c.fillStyle = '#fff4e2'; c.beginPath(); c.arc(u2[0], u2[1], 5 * u, 0, 7); c.fill();
      c.restore();
    }
    if (this.choque > 0 && this.chispa) {
      c.save(); c.globalCompositeOperation = 'lighter';
      c.fillStyle = `rgba(255,255,255,${this.choque * 1.6})`;
      c.beginPath(); c.arc(this.chispa[0], this.chispa[1], 18 * u * (1.2 - this.choque), 0, 7); c.fill();
      c.restore();
    }
    c.fillStyle = '#efe8da'; c.textAlign = 'center';
    c.font = `${20 * u}px ${LETRA}`; c.fillText(this.fin ? TXT[leng].ok : TXT[leng].h2, W / 2, g.cy - g.R * 1.26 - 22 * u);
    c.font = `${11 * u}px ${SERIF}`; c.fillStyle = 'rgba(239,232,218,.5)'; c.fillText(TXT[leng].salir, W / 2, g.cy + g.R * 1.26 + 34 * u);
    c.restore();
  }
}

// ---------------------------------------------------------------- Hack 3 (el Linde)
// Los anillos del tocon, vistos desde arriba: cuatro anillos tallados (el de fuera es el 0), cada uno con una marca
// de luz azul palido (el color de Varga) en una de ocho posiciones. Clic en un anillo: gira un octavo hacia el lado
// por el que se pulsa y una clavija arrastra con el al de dentro. Se resuelve de fuera adentro, siempre.
export const ANILLOS_INICIO = [3, 6, 2, 5];
// gira el anillo k y el de dentro (k + 1) s octavos (s puede ser negativo o de varias vueltas); true si todas las
// marcas quedan en la muesca
export function girarAnillos(p, k, s) { for (const q of [k, k + 1]) if (q < p.length) p[q] = (((p[q] + s) % 8) + 8) % 8; return p.every((v) => v === 0); }
const OCTAVO = Math.PI / 4;
// Juego 1 del Linde, los anillos del tocon. Un anillo se ARRASTRA para girarlo (o un clic lo gira un octavo hacia
// donde apunta la flecha que sale bajo el raton) y el de dentro gira con el: al pasar el raton se encienden los dos.
// La columna de la muesca lleva un engaste por anillo que se enciende cuando su luz llega.
// Antes era solo "clic por su derecha lo gira a la derecha": en un circulo no se entendia (abajo, girar a la derecha
// lleva la luz hacia la izquierda) y no se veia que el de dentro se movia con el.
export class Hack3 {
  constructor(sonido) { this.p = ANILLOS_INICIO.slice(); this.vueltas = this.p.slice(); this.ang = this.p.slice(); this.fin = 0; this.resultado = null; this.son = sonido; this.g = null; this.pulso = [0, 0, 0, 0]; this.arr = null; this.sobre = null; }
  // el anillo bajo (x, y): 0 el de fuera ... 3 el de dentro; -1 si no hay
  anillo(x, y) {
    const { cx, cy, R } = this.g, d = Math.hypot(x - cx, y - cy) / R;
    return d < 0.2 || d > 1.04 ? -1 : Math.min(3, Math.floor((1 - Math.min(d, 0.999)) / 0.2));
  }
  // angulo desde arriba, en el sentido de las agujas del reloj
  angulo(x, y) { return Math.atan2(x - this.g.cx, this.g.cy - y); }
  mirar(x, y) { const k = this.anillo(x, y); this.sobre = k < 0 ? null : { k, s: x >= this.g.cx ? 1 : -1, a: this.angulo(x, y) }; }
  puntero(tipo, x, y) {
    if (this.fin || !this.g) { this.sobre = null; this.arr = null; return; }
    if (tipo === 'baja') {
      const k = this.anillo(x, y); if (k < 0) return;
      this.arr = { k, s: x >= this.g.cx ? 1 : -1, ult: this.angulo(x, y), d: 0, x0: x, y0: y, movido: false, pasos: 0 };
    } else if (tipo === 'mueve') {
      const A = this.arr;
      if (!A) { this.mirar(x, y); return; }
      const a = this.angulo(x, y); let da = a - A.ult; da -= Math.round(da / (2 * Math.PI)) * 2 * Math.PI;
      A.d += da; A.ult = a;
      if (Math.hypot(x - A.x0, y - A.y0) > 6 * this.g.u) A.movido = true;
      const n = Math.round(A.d / OCTAVO); if (A.movido && n !== A.pasos) { A.pasos = n; this.son?.('mover'); }
    } else if (tipo === 'sube' && this.arr) {
      const A = this.arr; this.arr = null;
      this.girar(A.k, A.movido ? Math.round(A.d / OCTAVO) : A.s);
      if (!this.fin) this.mirar(x, y);
    }
  }
  girar(k, n) {
    if (!n) return;
    const antes = this.p.slice();
    for (const q of [k, k + 1]) if (q < 4) { this.vueltas[q] += n; this.pulso[q] = 1; }
    if (girarAnillos(this.p, k, n)) { this.fin = 0.001; this.sobre = null; this.son?.('abre'); }
    else if (this.p.some((v, q) => v === 0 && antes[q] !== 0)) this.son?.('circulo');
    else this.son?.('mover');
  }
  actualizar(dt) {
    const A = this.arr;
    for (let k = 0; k < 4; k++) {
      const va = A && A.movido && (k === A.k || k === A.k + 1);
      this.ang[k] += (this.vueltas[k] + (va ? A.d / OCTAVO : 0) - this.ang[k]) * Math.min(1, dt * (va ? 30 : 14));
      this.pulso[k] = Math.max(0, this.pulso[k] - dt * 3);
    }
    if (this.fin) { this.fin += dt; if (this.fin > 1.5) this.resultado = true; }
  }
  // la luz del anillo k esta en la muesca (como se ve, tambien a medio arrastre)
  enSitio(k) { const v = ((this.ang[k] % 8) + 8) % 8; return Math.min(v, 8 - v) < 0.08; }
  dibujar(c, W, H, u, t, leng) {
    const R = Math.min(W, H) * 0.3, cx = W / 2, cy = H / 2 + 12 * u;
    this.g = { cx, cy, R, u };
    c.save();
    c.fillStyle = 'rgba(3,4,3,.84)'; c.fillRect(0, 0, W, H);
    // la cara del tocon: madera clara con la corteza oscura alrededor
    c.beginPath(); c.arc(cx, cy, R * 1.14, 0, 7); c.fillStyle = '#3a3122'; c.fill(); c.lineWidth = 6 * u; c.strokeStyle = '#0b0a0c'; c.stroke();
    c.beginPath(); c.arc(cx, cy, R, 0, 7);
    const gr = c.createRadialGradient(cx - R * 0.25, cy - R * 0.3, 0, cx, cy, R); gr.addColorStop(0, '#b49b70'); gr.addColorStop(1, '#8a7352');
    c.fillStyle = gr; c.fill(); c.lineWidth = 3 * u; c.strokeStyle = '#0b0a0c'; c.stroke();
    // la columna de la muesca: un surco tallado hasta el centro (ahi tienen que acabar las cuatro luces)
    c.beginPath(); c.moveTo(cx, cy - R); c.lineTo(cx, cy - R * 0.2); c.lineCap = 'round';
    c.lineWidth = 16 * u; c.strokeStyle = 'rgba(58,44,26,.32)'; c.stroke(); c.lineWidth = 2 * u; c.strokeStyle = 'rgba(40,30,18,.5)'; c.stroke();
    // el anillo bajo el raton (o el que se arrastra) y el de dentro, que gira con el
    const act = this.fin ? -1 : this.arr ? this.arr.k : this.sobre ? this.sobre.k : -1;
    for (let k = 0; k < 4; k++) {
      const r0 = R * (0.8 - k * 0.2), r1 = R * (1 - k * 0.2), a = (this.ang[k] / 8) * Math.PI * 2;
      if (act >= 0 && (k === act || k === act + 1)) {
        // (dos circulos enteros, con moveTo entre ellos: con arc(..., 0, 7) el segundo empieza en una linea y sale una cuña)
        const ra = r1 - 1.5 * u, rb = r0 + 1.5 * u, yo = k === act;
        c.beginPath(); c.arc(cx, cy, ra, 0, Math.PI * 2); c.moveTo(cx + rb, cy); c.arc(cx, cy, rb, 0, Math.PI * 2, true);
        c.fillStyle = yo ? 'rgba(255,246,222,.42)' : 'rgba(255,246,222,.2)'; c.fill();
        c.strokeStyle = yo ? 'rgba(255,248,230,.85)' : 'rgba(255,248,230,.4)'; c.lineWidth = (yo ? 2 : 1.4) * u;
        c.beginPath(); c.arc(cx, cy, ra, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(cx, cy, rb, 0, Math.PI * 2); c.stroke();
      }
      c.save(); c.translate(cx, cy); c.rotate(a);
      c.strokeStyle = 'rgba(60,44,26,.45)'; c.lineWidth = 1.2 * u;
      for (let q = 0; q < 10; q++) { const b = (q / 10) * Math.PI * 2 + k; c.beginPath(); c.arc(0, 0, r0 + (r1 - r0) * (0.25 + (q % 3) * 0.25), b, b + 0.5 + (q % 2) * 0.4); c.stroke(); }
      // la marca: un punto de luz azul palido arriba del anillo (en su sitio de reposo); en la muesca, quieta y fuerte
      const my = -(r0 + r1) / 2, on = this.fin || this.enSitio(k) ? 1 : 0.65 + 0.25 * Math.sin(t * 3 + k) + this.pulso[k] * 0.3;
      c.shadowColor = 'rgba(169,205,230,.95)'; c.shadowBlur = (12 + 6 * on) * u;
      c.fillStyle = `rgba(214,236,250,${Math.min(1, on)})`; c.beginPath(); c.arc(0, my, 6 * u, 0, 7); c.fill();
      c.restore();
      c.beginPath(); c.arc(cx, cy, r0, 0, 7); c.lineWidth = 2.6 * u; c.strokeStyle = '#2a2016'; c.stroke();
    }
    // un engaste por anillo en la columna: se enciende cuando su luz llega
    for (let k = 0; k < 4; k++) {
      const ym = cy - R * (0.9 - k * 0.2), ok = this.fin || this.enSitio(k);
      c.beginPath(); c.arc(cx, ym, 10.5 * u, 0, 7); c.lineWidth = (ok ? 2.4 : 1.8) * u;
      c.strokeStyle = ok ? 'rgba(190,222,242,.95)' : 'rgba(30,22,14,.6)'; c.stroke();
    }
    // la flecha bajo el raton: hacia donde lo gira un clic (por el canto de fuera del anillo: por el medio tapaba su luz)
    if (act >= 0 && !this.arr && this.sobre) {
      const { k, s, a } = this.sobre, rm = R * (0.96 - k * 0.2), th = a - Math.PI / 2, ab = 0.2 * (0.96 / (0.96 - k * 0.2)) ** 0.5;
      const t0 = th - ab * s, t1 = th + ab * s, hx = cx + rm * Math.cos(t1), hy = cy + rm * Math.sin(t1), tx = -Math.sin(t1) * s, ty = Math.cos(t1) * s;
      c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
      for (const [col, w] of [['rgba(11,10,12,.55)', 6.5], ['rgba(250,244,230,.95)', 3]]) {
        c.strokeStyle = col; c.fillStyle = col; c.lineWidth = w * u;
        c.beginPath(); c.arc(cx, cy, rm, t0, t1, s < 0); c.stroke();
        const L = (w > 4 ? 13 : 10) * u, N = (w > 4 ? 8 : 6) * u;
        c.beginPath(); c.moveTo(hx + tx * L * 0.6, hy + ty * L * 0.6); c.lineTo(hx - tx * L * 0.4 - ty * N, hy - ty * L * 0.4 + tx * N); c.lineTo(hx - tx * L * 0.4 + ty * N, hy - ty * L * 0.4 - tx * N); c.closePath(); c.fill();
      }
      c.restore();
    }
    // la muesca de arriba, tallada en la corteza
    c.fillStyle = '#0b0a0c'; c.beginPath(); c.moveTo(cx - 10 * u, cy - R * 1.16); c.lineTo(cx + 10 * u, cy - R * 1.16); c.lineTo(cx, cy - R * 1.02); c.closePath(); c.fill();
    if (this.fin) { c.save(); c.globalCompositeOperation = 'lighter'; const k = Math.min(1, this.fin); const g2 = c.createRadialGradient(cx, cy - R * 0.6, 0, cx, cy - R * 0.6, R * 0.9); g2.addColorStop(0, `rgba(190,220,240,${0.45 * k})`); g2.addColorStop(1, 'rgba(190,220,240,0)'); c.fillStyle = g2; c.fillRect(cx - R, cy - R * 1.6, R * 2, R * 2); c.restore(); }
    c.fillStyle = '#efe8da'; c.textAlign = 'center';
    c.font = `${20 * u}px ${LETRA}`; c.fillText(this.fin ? TXT[leng].ok : TXT[leng].h3, W / 2, cy - R * 1.16 - 26 * u);
    c.font = `${11 * u}px ${SERIF}`; c.fillStyle = 'rgba(239,232,218,.62)'; c.fillText(TXT[leng].h3b, W / 2, cy + R * 1.14 + 30 * u);
    c.fillStyle = 'rgba(239,232,218,.5)'; c.fillText(TXT[leng].salir, W / 2, cy + R * 1.14 + 50 * u);
    c.restore();
  }
}
