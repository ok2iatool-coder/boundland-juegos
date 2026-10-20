// El gancho del 18, con detalle: un garfio de hierro de tres unas con collar de laton y anilla, una cuerda
// trenzada (dos cabos que se retuercen, se comba cuando va floja y vibra cuando va tensa), el lanzamiento
// (el garfio vuela de la mano al ancla desenrollando la cuerda y muerde con chispas), la recogida al soltar,
// las anclas del mapa (una anilla colgada de su cable) y la mira del ancla a tiro.
// Solo dibujo: la simulacion engancha al instante (sim/jugador.js); esto pone el vuelo por encima.
import { TINTA, hash } from './tinta.js';
import { COLOR } from './paletas.js';
import { MACIZO } from '../sim/mapa.js';
import { T } from '../sim/constantes.js';

const HIERRO = '#5f676f', HIERRO_OSC = '#363c42', LUZ = 'rgba(205,220,235,.55)';
const T_VUELO = 0.13, T_VUELTA = 0.16;
const suave = (u) => u * u * (3 - 2 * u);

// la mano del 18 (desde donde sale la cuerda)
const mano = (p) => [p.x + p.w / 2 + p.cara * 3, p.y + 21];

// ---- el garfio: la punta (donde muerden las unas) en (x, y), mirando en la direccion ang (de la anilla a la punta)
export function dibujarGarfio(c, x, y, ang, k = 1, abierto = 1) {
  c.save();
  c.translate(x, y); c.rotate(ang); c.scale(k, k);
  c.lineCap = 'round'; c.lineJoin = 'round';
  // cana: de la anilla (-16) a la cruz (0)
  c.strokeStyle = TINTA; c.lineWidth = 4.2; c.beginPath(); c.moveTo(-15, 0); c.lineTo(0, 0); c.stroke();
  c.strokeStyle = HIERRO; c.lineWidth = 2.4; c.stroke();
  c.strokeStyle = LUZ; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-14, -0.7); c.lineTo(-1, -0.7); c.stroke();
  // anilla del cabo
  c.beginPath(); c.arc(-17.5, 0, 2.8, 0, 7); c.strokeStyle = TINTA; c.lineWidth = 3; c.stroke(); c.strokeStyle = HIERRO; c.lineWidth = 1.4; c.stroke();
  // collar de laton con su remache
  c.fillStyle = COLOR.laton; c.strokeStyle = TINTA; c.lineWidth = 1.2;
  c.beginPath(); c.roundRect(-6, -2.6, 4, 5.2, 1); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,240,200,.6)'; c.fillRect(-5.4, -2, 1, 4);
  // las tres unas: arriba, abajo y la del medio vista de frente (mas corta); se abren al morder
  const a = 0.55 + 0.45 * abierto;
  for (const [s, largo] of [[-1, 1], [1, 1], [0, 0.55]]) {
    const px = 1, py = 0;
    const ex = -3 * largo, ey = s * 9 * a * largo;           // la punta de la una vuelve hacia atras
    const qx = 7 * largo, qy = s * 7 * a * largo;
    c.beginPath(); c.moveTo(px, py); c.quadraticCurveTo(qx, qy, ex, ey);
    c.strokeStyle = TINTA; c.lineWidth = s === 0 ? 3.2 : 3.8; c.stroke();
    c.strokeStyle = s === 0 ? HIERRO_OSC : HIERRO; c.lineWidth = s === 0 ? 1.6 : 2; c.stroke();
    if (s !== 0) {
      // la lengueta de la punta
      c.beginPath(); c.moveTo(ex, ey); c.lineTo(ex - 2.4, ey - s * 0.6); c.lineTo(ex + 0.8, ey - s * 2.2); c.closePath();
      c.fillStyle = HIERRO; c.fill(); c.strokeStyle = TINTA; c.lineWidth = 1; c.stroke();
      c.strokeStyle = LUZ; c.lineWidth = 0.7; c.beginPath(); c.moveTo(px + 1, py + s * 0.6); c.quadraticCurveTo(qx * 0.9, qy * 0.8 - s * 0.8, ex + 1, ey - s * 1.2); c.stroke();
    }
  }
  c.restore();
}

// ---- la cuerda trenzada entre (x0, y0) y (x1, y1); holgura: cuanto se comba (u); vib: vibracion de tension
export function dibujarCuerda(c, x0, y0, x1, y1, holgura, t, vib = 0, ondas = 0) {
  const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1;
  const nx = -dy / d, ny = dx / d;                         // normal
  const n = Math.max(6, Math.ceil(d / 4));
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const u = k / n;
    let x = x0 + dx * u, y = y0 + dy * u;
    y += holgura * 4 * u * (1 - u);                        // la comba (parabola, hacia abajo)
    const w = Math.sin(u * Math.PI);
    if (vib) { const o = Math.sin(t * 70 + u * 9) * vib * w; x += nx * o; y += ny * o; }
    if (ondas) { const o = Math.sin(u * 22 - t * 60) * ondas * w * (1 - u * 0.5); x += nx * o; y += ny * o; }
    pts.push([x, y]);
  }
  const traza = () => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const q of pts) c.lineTo(q[0], q[1]); };
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  traza(); c.strokeStyle = TINTA; c.lineWidth = 3.6; c.stroke();
  traza(); c.strokeStyle = '#7d6040'; c.lineWidth = 2; c.stroke();
  // los dos cabos retorcidos: rayitas en diagonal alternando claro y oscuro
  let acc = 0;
  for (let k = 1; k < pts.length; k++) {
    const [ax, ay] = pts[k - 1], [bx, by] = pts[k];
    const sl = Math.hypot(bx - ax, by - ay) || 1, tx = (bx - ax) / sl, ty = (by - ay) / sl;
    for (let s = 0; s < sl; s += 2.6) {
      acc++;
      const x = ax + tx * s, y = ay + ty * s;
      c.strokeStyle = acc % 2 ? 'rgba(230,200,150,.55)' : 'rgba(30,20,12,.55)';
      c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(x - ty * 0.9 - tx * 0.7, y + tx * 0.9 - ty * 0.7); c.lineTo(x + ty * 0.9 + tx * 0.7, y - tx * 0.9 + ty * 0.7); c.stroke();
    }
  }
  c.restore();
}

// ---- un ancla del mapa: anilla de hierro colgada de su cable hasta el techo (si lo hay cerca)
export function dibujarAncla(c, a, E, t) {
  const x = a.x(), y = a.y();
  const m = E.m;
  let yt = null;
  const i = Math.floor(x / T);
  for (let j = Math.floor(y / T) - 1; j >= Math.max(0, Math.floor(y / T) - 8); j--) if (m.t[j * m.w + i] === MACIZO) { yt = (j + 1) * T; break; }
  c.save(); c.lineCap = 'round';
  if (yt !== null) {
    // cable con su placa en el techo
    c.strokeStyle = TINTA; c.lineWidth = 2.4; c.beginPath(); c.moveTo(x, yt); c.lineTo(x, y - 6); c.stroke();
    c.strokeStyle = '#6b7279'; c.lineWidth = 1; c.stroke();
    c.fillStyle = '#4b525a'; c.strokeStyle = TINTA; c.lineWidth = 1.4; c.beginPath(); c.roundRect(x - 6, yt - 1, 12, 4, 1); c.fill(); c.stroke();
  } else {
    // sin techo cerca: un perno con su escuadra
    c.fillStyle = '#4b525a'; c.strokeStyle = TINTA; c.lineWidth = 1.4; c.beginPath(); c.roundRect(x - 3, y - 12, 6, 6, 1); c.fill(); c.stroke();
  }
  // la anilla (gira un poco)
  const g = Math.sin(t * 0.8 + x * 0.05) * 0.25;
  c.translate(x, y); c.rotate(g);
  c.beginPath(); c.ellipse(0, 0, 5.2, 6, 0, 0, 7); c.strokeStyle = TINTA; c.lineWidth = 4; c.stroke();
  c.strokeStyle = HIERRO; c.lineWidth = 2.2; c.stroke();
  c.strokeStyle = LUZ; c.lineWidth = 0.8; c.beginPath(); c.ellipse(0, 0, 5.2, 6, 0, Math.PI * 1.05, Math.PI * 1.6); c.stroke();
  c.restore();
}

// ---- la mira del ancla a tiro: cuatro esquinas que se cierran y la tecla
export function dibujarMira(c, a, t, tecla = 'E') {
  const x = a.x(), y = a.y(), r = 13 + Math.sin(t * 6) * 1.6, l = 5;
  c.save(); c.globalCompositeOperation = 'lighter';
  c.strokeStyle = `rgba(255,236,190,${0.6 + 0.3 * Math.sin(t * 6)})`; c.lineWidth = 1.8; c.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    const an = t * 0.8 + k * Math.PI / 2;
    const ex = Math.cos(an), ey = Math.sin(an), qx = -ey, qy = ex;
    const px = x + ex * r, py = y + ey * r;
    c.beginPath(); c.moveTo(px + qx * l, py + qy * l); c.lineTo(px, py); c.lineTo(px - ex * l, py - ey * l); c.stroke();
  }
  c.fillStyle = 'rgba(255,236,190,.85)'; c.font = 'bold 11px Georgia'; c.textAlign = 'center';
  c.fillText(tecla, x, y - r - 7);
  c.restore();
}

// ---- el gancho en juego: vuelo de ida, enganchado y vuelta
export class Gancho {
  constructor() { this.vuelo = null; this.vuelta = null; this.ultimo = null; }

  emitir(e, p, fx) {
    if (e.t === 'engancha') { this.vuelo = { t: 0, ax: e.x, ay: e.y, fx }; this.vuelta = null; }
    if (e.t === 'suelta' && this.ultimo) { this.vuelta = { t: 0, ax: this.ultimo[0], ay: this.ultimo[1] }; this.vuelo = null; }
  }

  actualizar(dt) {
    if (this.vuelo) {
      this.vuelo.t += dt;
      if (this.vuelo.t >= T_VUELO && !this.vuelo.mordio) {
        this.vuelo.mordio = true;
        const f = this.vuelo.fx;
        if (f) f.chispa(this.vuelo.ax, this.vuelo.ay, 7, 'rgba(255,236,190,', 160, 0.25, 500, 1.4);
      }
      if (this.vuelo.t > T_VUELO + 0.25) this.vuelo = null;
    }
    if (this.vuelta) { this.vuelta.t += dt; if (this.vuelta.t > T_VUELTA) this.vuelta = null; }
  }

  dibujar(c, p, t) {
    const [hx, hy] = mano(p);
    if (p.cuerda) {
      const ax = p.cuerda.a.x(), ay = p.cuerda.a.y();
      this.ultimo = [ax, ay];
      const d = Math.hypot(ax - hx, ay - hy) || 1;
      const v = this.vuelo;
      if (v && v.t < T_VUELO) {
        // volando: el garfio va de la mano al ancla y la cuerda se desenrolla ondulando
        const u = suave(v.t / T_VUELO);
        const gx = hx + (ax - hx) * u, gy = hy + (ay - hy) * u;
        const ang = Math.atan2(ay - hy, ax - hx);
        dibujarCuerda(c, hx, hy, gx - Math.cos(ang) * 17, gy - Math.sin(ang) * 17, 0, t, 0, 3 * (1 - u));
        dibujarGarfio(c, gx, gy, ang + Math.sin(v.t * 60) * 0.25 * (1 - u), 0.95, 0.4);
        return;
      }
      // enganchado: tensa (vibra un poco recien mordida) o floja (se comba)
      const ang = Math.atan2(ay - hy, ax - hx);
      const floja = Math.max(0, p.cuerda.L - d);
      const holgura = Math.min(40, Math.sqrt(floja * p.cuerda.L) * 0.35);
      const vib = v ? Math.max(0, 1.6 * (1 - (v.t - T_VUELO) / 0.25)) : 0;
      const rx = ax - Math.cos(ang) * 17, ry = ay - Math.sin(ang) * 17;
      dibujarCuerda(c, hx, hy, rx, ry, holgura, t, vib);
      dibujarGarfio(c, ax, ay, ang, 1.15, 1);
      return;
    }
    const w = this.vuelta;
    if (w) {
      // recogiendo: el garfio vuelve a la mano, plegado
      const u = suave(w.t / T_VUELTA);
      const gx = w.ax + (hx - w.ax) * u, gy = w.ay + (hy - w.ay) * u;
      const ang = Math.atan2(w.ay - hy, w.ax - hx);
      dibujarCuerda(c, hx, hy, gx - Math.cos(ang) * 17 * (1 - u), gy - Math.sin(ang) * 17 * (1 - u), 6 * (1 - u), t, 0, 2 * (1 - u));
      dibujarGarfio(c, gx, gy, ang + u * 2.5, 0.95 - 0.3 * u, 0.2);
    }
  }
}
