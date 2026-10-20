// Lo que se SIENTE de cada golpe, en un sitio y sin DOM (lo usan efectos.js y main.js, y lo mide
// tools/medir_combate.mjs): el paron (hitstop) en fotogramas segun la fuerza, la sacudida por TRAUMA,
// el empujon de la camara en la direccion del golpe con su rebote, el zoom de un instante, la camara
// lenta al matar; y la reaccion del cuerpo golpeado (aplastado con muelle y temblor durante el paron).
import { DT } from '../sim/constantes.js';

const F = (n) => n * DT;          // fotogramas a 60 Hz

// La tabla. paron en fotogramas; trauma 0-1 (la sacudida va con su cuadrado); empujon en u (1 u = 1,25 px
// a 720p) hacia donde va el golpe; zoom en tanto por uno; lento = segundos de camara lenta.
// Medido con tools/medir_combate.mjs (README): de 4 fotogramas el tajo a 9 el que mata, y la camara de
// 7 px el tajo a 15 el que mata.
const FUERZA = {
  tajo:    { paron: 4, trauma: 0.30, empujon: 5,  zoom: 0.012, aplasta: 0.16 },
  remate:  { paron: 6, trauma: 0.44, empujon: 8,  zoom: 0.03,  aplasta: 0.24 },
  embiste: { paron: 6, trauma: 0.44, empujon: 8,  zoom: 0.025, aplasta: 0.24 },
  mata:    { paron: 9, trauma: 0.58, empujon: 10, zoom: 0.055, aplasta: 0.3, lento: 0.25 },
};

// la fuerza de un impacto: lo que mata manda; luego estocada/Sunikel, el remate y el tajo
export const fuerzaDe = (e) => (e.mata ? 'mata' : e.embiste ? 'embiste' : e.fuerte ? 'remate' : 'tajo');

// direccion del golpe (unitaria) segun el evento
function direccion(e) {
  if (e.dir === 'arriba') return { x: 0, y: -1 };
  if (e.dir === 'abajo') return { x: 0, y: 1 };
  return { x: e.cara || 1, y: 0 };
}

export function sentir(e) {
  switch (e.t) {
    case 'impacto': {
      const f = FUERZA[fuerzaDe(e)];
      const jefe = e.tipo === 'jefe';            // lo grande pesa: un fotograma mas y algo mas de sacudida
      return { paron: F(f.paron + (jefe ? 1 : 0)), trauma: f.trauma + (jefe ? 0.06 : 0), empujon: f.empujon, dir: direccion(e), zoom: f.zoom, lento: f.lento || 0, aplasta: f.aplasta };
    }
    // el golpe de un objeto lanzado (sin impacto del 18): material y poco mas
    case 'golpe': return { paron: F(3), trauma: 0.2 };
    // el tajo para el golpe enemigo: lo mas fuerte que hace el 18; la camara retrocede con el
    case 'choque': return { paron: F(9), trauma: 0.6, empujon: 10, dir: { x: -(e.cara || 1), y: 0 }, zoom: 0.05, destello: 0.3 };
    case 'desvio': return { paron: F(5), trauma: 0.34, empujon: 5, dir: { x: e.cara || 1, y: 0 }, zoom: 0.02 };
    // la daga contra el cristal del escarabajo (fase 1): no le hace nada, pero se nota que ha chocado
    case 'jefe_rebota': return { paron: F(3), trauma: 0.26, empujon: 5, dir: { x: -(e.cara || 1), y: 0 } };
    case 'pogo': return { paron: F(2), trauma: 0.16, empujon: 4, dir: { x: 0, y: 1 } };
    case 'aturdido': return e.jefe ? { paron: F(12), trauma: 0.5, zoom: 0.04 } : { paron: F(3), trauma: 0.22 };
    case 'muere': return { trauma: 0.34 };
    case 'hormiga_huye': return { trauma: 0.3 };
    case 'dano': return { paron: F(8), trauma: 0.62, destello: 0.25 };
    case 'muere_18': return { paron: 0.4, destello: 0.8 };
    case 'jefe_vencido': return { paron: 0.6, trauma: 0.8, destello: 0.7, lento: 0.5, zoom: 0.07 };
    case 'despierta_zorro': return { paron: 0.5, trauma: 0.9, destello: 1 };
  }
  return null;
}

// ---- la camara del golpe. Tres cosas que se suman al sitio de la camara:
// - EMPUJON: salta de golpe hacia donde va el golpe y vuelve con un muelle que se pasa un poco (4,5 Hz,
//   amortiguado 0,55): un tiron seco, no un deslizar. (A 7 Hz volvia a la mitad en un fotograma y no se veia.)
// - SACUDIDA por trauma (Eiserloh): la amplitud es MAX * trauma^2 y el trauma baja 1,6 por segundo, asi que
//   un golpe flojo apenas tiembla y uno fuerte se nota sin marear; golpes seguidos lo acumulan algo (el
//   combo va subiendo). El ruido es suave (suma de senos), no al azar por fotograma.
// - ZOOM de un instante que vuelve solo.
// Durante el paron el empujon se queda donde esta (la imagen congelada con la camara empujada) y la
// sacudida sigue temblando.
const MAX_SACUDIDA = 10;                 // u
const W = 2 * Math.PI * 4.5, ZETA = 0.55;

export class Camara {
  constructor() { this.x = 0; this.y = 0; this.zoom = 0; this.trauma = 0; this.ex = 0; this.ey = 0; this.vx = 0; this.vy = 0; this.t = 0; this.fase = Math.random() * 100; }
  temblar(v) { this.trauma = Math.min(0.9, Math.max(this.trauma, v) + 0.18 * Math.min(this.trauma, v)); }
  golpe(s) {
    if (!s) return;
    if (s.trauma) this.temblar(s.trauma);
    if (s.empujon) { const d = s.dir || { x: 0, y: 0 }; this.ex += d.x * s.empujon; this.ey += d.y * s.empujon; this.vx = 0; this.vy = 0; }
    if (s.zoom) this.zoom = Math.max(this.zoom, s.zoom);
  }
  actualizar(dt, congelado = false) {
    this.t += dt;
    if (!congelado) {
      // muelle amortiguado (semi-implicito: estable a 60 Hz)
      this.vx += (-W * W * this.ex - 2 * ZETA * W * this.vx) * dt; this.ex += this.vx * dt;
      this.vy += (-W * W * this.ey - 2 * ZETA * W * this.vy) * dt; this.ey += this.vy * dt;
      this.zoom *= Math.exp(-10 * dt);
    }
    this.trauma = Math.max(0, this.trauma - 1.6 * dt);
    const a = MAX_SACUDIDA * this.trauma * this.trauma, t = this.t + this.fase;
    const nx = Math.sin(t * 2 * Math.PI * 23) * 0.6 + Math.sin(t * 2 * Math.PI * 37 + 1.3) * 0.4;
    const ny = Math.sin(t * 2 * Math.PI * 29 + 2.1) * 0.6 + Math.sin(t * 2 * Math.PI * 41 + 0.4) * 0.4;
    this.x = this.ex + a * nx; this.y = this.ey + a * ny;
  }
}

// ---- la reaccion del cuerpo golpeado (enemigo o escarabajo), solo dibujo. Va en `o.rx`:
// est: aplastado a lo largo del golpe (negativo = encogido) con su muelle, que al soltarse se pasa
// (estira) y vuelve; inc: se inclina apartandose; temblor: lo que dura el paron, tiembla a +-amp en
// fotogramas alternos (el cuerpo vibra mientras la imagen esta parada).
export function golpeCuerpo(o, s, e) {
  if (!o) return;
  const r = o.rx || (o.rx = { est: 0, vest: 0, inc: 0, vinc: 0, temblor: 0, amp: 0, eje: 'x', n: 0 });
  // el escarabajo pesa: se aplasta menos de la mitad (con lo mismo una hormiga parece de goma y el, no)
  const a = ((s && s.aplasta) || 0.12) * (o.tipo === 'jefe' ? 0.4 : 1);
  r.eje = e.dir === 'arriba' || e.dir === 'abajo' ? 'y' : 'x';
  r.est = -a; r.vest = 0;
  r.inc = (r.eje === 'x' ? (e.cara || 1) : 0) * a * 0.9; r.vinc = 0;
  r.temblor = (s && s.paron) || F(3); r.amp = 1.2 + a * 9;
}

export function animarCuerpo(o, dt, congelado) {
  const r = o.rx;
  if (!r) return;
  r.n++;
  if (congelado) { r.temblor = Math.max(0, r.temblor - dt); return; }
  r.temblor = 0;
  const w = 2 * Math.PI * 6;
  r.vest += (-w * w * r.est - 2 * 0.32 * w * r.vest) * dt; r.est += r.vest * dt;
  r.vinc += (-w * w * r.inc - 2 * 0.45 * w * r.vinc) * dt; r.inc += r.vinc * dt;
}

// la transformacion que resulta (para dibujarEnemigo / dibujarJefe): desplazamiento, escalas y giro
export function poseCuerpo(o) {
  const r = o.rx;
  if (!r) return null;
  const tiembla = r.temblor > 0 ? (r.n % 2 ? 1 : -1) * r.amp * Math.min(1, r.temblor / F(2) + 0.35) : 0;
  if (!tiembla && Math.abs(r.est) < 0.004 && Math.abs(r.inc) < 0.004) return null;
  const sx = r.eje === 'x' ? 1 + r.est : 1 - r.est * 0.6, sy = r.eje === 'x' ? 1 - r.est * 0.6 : 1 + r.est;
  return { dx: tiembla, sx, sy, rot: r.inc };
}
