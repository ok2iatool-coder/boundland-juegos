// El fondo lejano va pintado, sin linea y desenfocado, en 3 o 4 capas de parallax (GDD). Cada capa se
// pinta una vez a media resolucion; al dibujar se desplaza segun su factor.
import { T } from '../sim/constantes.js';
import { azar, hash, rgba, mezclar } from './tinta.js';
import { COLOR, ZONAS } from './paletas.js';
import { silueta } from './escombros.js';
import { horizonte } from './ciudad.js';
const FLOTA = ['coche', 'banco', 'farola', 'losa', 'losa', 'viga', 'arbol', 'buzon'];

const RES = 0.5;     // resolucion de las capas respecto a la pantalla

export class Fondo {
  constructor(E, z) {
    this.E = E; this.z = z; this.zona = E.nivel.zona;
    this.capas = null; this.escala = 0; this.vw = 0;
  }

  preparar(s, vw, vh) {
    if (this.capas && s === this.escala && vw === this.vw) return;
    this.escala = s; this.vw = vw; this.vh = vh;
    const m = this.E.m;
    const defs = CAPAS[this.zona].slice();
    // a lo Silksong: detras de todo, una bruma que brilla con haces de luz (el nivel 1 ya trae la suya)
    if (this.zona !== 'laboratorio') defs.splice(1, 0, BRUMA);
    this.capas = defs.map((d, k) => {
      const f = d.f, fy = d.fy ?? d.f * 0.6;
      const W = vw + Math.max(0, m.ancho - vw) * f + 40;
      const H = vh + Math.max(0, m.alto - vh) * fy + 40;
      const k2 = s * RES;
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(W * k2); cv.height = Math.ceil(H * k2);
      const c = cv.getContext('2d');
      c.scale(k2, k2);
      const mundoX = (lx) => (lx - vw / 2) / Math.max(f, 0.001) + vw / 2;
      if (d.blur) c.filter = `blur(${d.blur * k2}px)`;
      d.pintar(c, W, H, this.z, azar(31 + k * 101 + (this.E.nivel.semilla ?? this.E.id) * 7), { mundoX, E: this.E, f, fy, vh });
      c.filter = 'none';
      return { cv, f, fy, k2 };
    });
  }

  // trasCapa: lo que se pone despues de cada capa (dibujo/hk.js: el velo de bruma)
  dibujar(ctx, cam, s, trasCapa = null) {
    for (const L of this.capas) {
      // por encima del mapa (cielo abierto) el fondo no sube: sus capas estan pintadas desde y = 0
      const x = -cam.x * L.f, y = -Math.max(0, cam.y) * L.fy;
      ctx.drawImage(L.cv, x * s, y * s, L.cv.width / L.k2 * s, L.cv.height / L.k2 * s);
      if (trasCapa) trasCapa(ctx, L.f);
    }
  }
}

// Bruma luminosa: tres o cuatro focos grandes y difusos del color de la luz de la zona y haces que
// bajan en diagonal. Va casi quieta (parallax 0,06) y muy emborronada.
const BRUMA = {
  f: 0.06, fy: 0.04, blur: 14, pintar(c, W, H, z, r) {
    c.globalCompositeOperation = 'lighter';
    const claro = mezclar(z.niebla, z.luz, 0.5);
    const fuerte = z.oscuro > 0.4 ? 0.22 : 0.09;
    for (let x = W * 0.12 + r() * 200; x < W; x += 560 + r() * 380) {
      const y = H * (0.15 + r() * 0.35), rr = 220 + r() * 200;
      const g = c.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, rgba(claro, fuerte)); g.addColorStop(0.5, rgba(z.niebla, fuerte * 0.4)); g.addColorStop(1, rgba(z.niebla, 0));
      c.fillStyle = g; c.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      // haces desde arriba, abriendose
      for (let q = 0; q < 3; q++) {
        const x0 = x - 60 + r() * 120, w0 = 14 + r() * 30, inc = 0.25 + r() * 0.2;
        const g2 = c.createLinearGradient(0, 0, 0, H * 0.9);
        g2.addColorStop(0, rgba(claro, fuerte * 0.55)); g2.addColorStop(1, rgba(claro, 0));
        c.fillStyle = g2; c.beginPath();
        c.moveTo(x0, 0); c.lineTo(x0 + w0, 0); c.lineTo(x0 + w0 * 3 + H * inc, H * 0.9); c.lineTo(x0 + H * inc, H * 0.9); c.fill();
      }
    }
    c.globalCompositeOperation = 'source-over';
  },
};

// ---------------------------------------------------------------- piezas
function degradado(c, W, H, a, b) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, a); g.addColorStop(1, b);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}
function niebla(c, W, H, color, y0, alto, a = 0.35) {
  const g = c.createLinearGradient(0, y0, 0, y0 + alto);
  g.addColorStop(0, rgba(color, 0)); g.addColorStop(0.5, rgba(color, a)); g.addColorStop(1, rgba(color, 0));
  c.fillStyle = g; c.fillRect(0, y0, W, alto);
}
function estanteria(c, x, yb, w, h, color, r) {
  c.fillStyle = color;
  c.fillRect(x, yb - h, 6, h); c.fillRect(x + w - 6, yb - h, 6, h);
  for (let y = yb - 10; y > yb - h; y -= 46) {
    c.fillRect(x, y, w, 5);
    for (let q = 0; q < w / 22 - 1; q++) {
      if (r() < 0.25) continue;
      const fx = x + 10 + q * 22, fh = 14 + r() * 22;
      c.fillRect(fx, y - fh, 10, fh);
      c.fillRect(fx + 3, y - fh - 5, 4, 5);
    }
  }
}
function tuberias(c, W, y, color, grosor, r) {
  c.strokeStyle = color; c.lineWidth = grosor;
  c.beginPath(); c.moveTo(0, y); c.lineTo(W, y + (r() - 0.5) * 10); c.stroke();
  for (let x = r() * 200; x < W; x += 140 + r() * 260) { c.fillStyle = color; c.fillRect(x, y - grosor, grosor * 1.6, grosor * 2.2); }
}
function vigas(c, W, H, color, r) {
  c.strokeStyle = color; c.lineWidth = 3;
  for (let k = 0; k < W / 300; k++) {
    const x = r() * W, y = r() * H * 0.5;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 160, y + 60 + r() * 120); c.stroke();
  }
}

// ---------------------------------------------------------------- capas por zona
const CAPAS = {
  lab: [
    { f: 0, fy: 0, pintar(c, W, H, z) { degradado(c, W, H, z.cielo[0], z.cielo[1]); } },
    {
      f: 0.12, blur: 7, pintar(c, W, H, z, r) {
        c.globalAlpha = 0.55;
        for (let x = -40; x < W; x += 220 + r() * 90) estanteria(c, x, H * 0.88, 170, H * 0.6, mezclar(z.lejos, '#000000', 0.1), r);
        tuberias(c, W, H * 0.16, z.lejos, 10, r); tuberias(c, W, H * 0.22, z.lejos, 6, r);
        c.globalAlpha = 1;
        niebla(c, W, H, z.niebla, H * 0.45, H * 0.5, 0.25);
      },
    },
    {
      f: 0.35, blur: 3, pintar(c, W, H, z, r) {
        for (let x = 0; x < W; x += 260 + r() * 160) {
          const tipo = r();
          if (tipo < 0.45) estanteria(c, x, H * 0.9, 130, H * 0.42, z.medio, r);
          else if (tipo < 0.7) { c.fillStyle = z.medio; c.fillRect(x, 0, 34, H); c.fillRect(x - 8, H * 0.2, 50, 12); }
          else {
            // cartel de riesgo biologico desvaido
            c.fillStyle = rgba('#c9b35a', 0.18); c.beginPath(); c.moveTo(x + 30, H * 0.4); c.lineTo(x + 60, H * 0.4 + 52); c.lineTo(x, H * 0.4 + 52); c.fill();
          }
        }
        tuberias(c, W, H * 0.08, z.medio, 14, r);
        niebla(c, W, H, z.niebla, H * 0.6, H * 0.4, 0.22);
      },
    },
    {
      f: 0.6, blur: 1.2, pintar(c, W, H, z, r) {
        c.strokeStyle = mezclar(z.medio, '#000000', 0.35); c.lineWidth = 2;
        for (let x = 0; x < W; x += 90 + r() * 260) {
          // cables que cuelgan
          const L = 60 + r() * 160;
          c.beginPath(); c.moveTo(x, 0); c.quadraticCurveTo(x + 20, L, x + 50 + r() * 40, L * 0.7); c.stroke();
        }
      },
    },
  ],
  ciudad: [
    {
      f: 0, fy: 0, pintar(c, W, H, z) {
        degradado(c, W, H, z.cielo[0], z.cielo[1]);
        const g = c.createRadialGradient(W * 0.3, H * 0.25, 0, W * 0.3, H * 0.25, H * 0.5);
        g.addColorStop(0, 'rgba(255,252,240,.55)'); g.addColorStop(1, 'rgba(255,252,240,0)');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
      },
    },
    {
      f: 0.08, blur: 4, pintar(c, W, H, z, r) {
        horizonte(c, W, H, z.lejos, r, 'lejos');
        niebla(c, W, H, z.niebla, H * 0.55, H * 0.45, 0.5);
      },
    },
    {
      f: 0.25, blur: 1.2, pintar(c, W, H, z, r) {
        horizonte(c, W, H, z.medio, r, 'medio', 1.2);
        // nidos de chapa y cristal de los Entomorficos colgados de las fachadas
        for (let k = 0; k < W / 260; k++) { c.fillStyle = rgba(COLOR.laton, 0.45); c.beginPath(); c.ellipse(r() * W, H * (0.45 + r() * 0.3), 14, 9, 0, 0, 7); c.fill(); }
        niebla(c, W, H, z.niebla, H * 0.7, H * 0.3, 0.45);
      },
    },
    {
      f: 0.5, blur: 1, pintar(c, W, H, z, r) {
        c.fillStyle = mezclar(z.medio, '#000000', 0.4);
        for (let x = 0; x < W; x += 200 + r() * 300) {
          // ruinas cercanas: muros partidos con varillas
          const w = 60 + r() * 120, h = 60 + r() * 140;
          c.beginPath(); c.moveTo(x, H); c.lineTo(x, H - h); c.lineTo(x + w * 0.4, H - h - 20 * r()); c.lineTo(x + w * 0.7, H - h * 0.6); c.lineTo(x + w, H - h * 0.75); c.lineTo(x + w, H); c.fill();
        }
      },
    },
  ],
  casa: [
    {
      f: 0, fy: 0, pintar(c, W, H, z) {
        degradado(c, W, H, z.cielo[0], z.cielo[1]);
      },
    },
    {
      f: 0.2, blur: 4, pintar(c, W, H, z, r) {
        // papel pintado a rayas, manchas de humedad
        c.fillStyle = rgba('#000000', 0.12);
        for (let x = 0; x < W; x += 26) c.fillRect(x, 0, 10, H);
        for (let k = 0; k < W / 120; k++) {
          const x = r() * W, y = r() * H, rr = 40 + r() * 90;
          const g = c.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, 'rgba(20,15,10,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = g; c.fillRect(x - rr, y - rr, rr * 2, rr * 2);
        }
      },
    },
    {
      f: 0.45, blur: 2, pintar(c, W, H, z, r) {
        c.fillStyle = mezclar(z.medio, '#000000', 0.25);
        for (let x = 0; x < W; x += 180 + r() * 200) {
          // marcos de puerta y escaleras
          if (r() < 0.5) { c.fillRect(x, H * 0.35, 8, H * 0.65); c.fillRect(x + 60, H * 0.35, 8, H * 0.65); c.fillRect(x, H * 0.35, 68, 8); }
          else { for (let k = 0; k < 8; k++) c.fillRect(x + k * 14, H - k * 16, 16, k * 16); }
        }
        vigas(c, W, H, mezclar(z.medio, '#000000', 0.4), r);
      },
    },
  ],
  plaza: [
    {
      f: 0, fy: 0, pintar(c, W, H, z) {
        degradado(c, W, H, z.cielo[0], z.cielo[1]);
        const g = c.createRadialGradient(W * 0.55, H * 0.4, 0, W * 0.55, H * 0.4, H * 0.8);
        g.addColorStop(0, 'rgba(235,245,255,.6)'); g.addColorStop(1, 'rgba(235,245,255,0)');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
      },
    },
    {
      f: 0.1, blur: 4, pintar(c, W, H, z, r) {
        horizonte(c, W, H, z.lejos, r, 'lejos', 1, { anomalia: true });
        // escombros que flotan a lo lejos
        c.fillStyle = c.strokeStyle = rgba(z.lejos, 0.9);
        for (let k = 0; k < W / 90; k++) { const x = r() * W, y = H * (0.1 + r() * 0.5); c.save(); c.translate(x, y); c.rotate((r() - 0.5) * 3); silueta(c, FLOTA[Math.floor(r() * FLOTA.length)], 0.35 + r() * 0.2, r); c.restore(); }
        niebla(c, W, H, z.niebla, H * 0.5, H * 0.5, 0.5);
      },
    },
    {
      f: 0.3, blur: 1.2, pintar(c, W, H, z, r) {
        horizonte(c, W, H, z.medio, r, 'medio', 1.1, { anomalia: true });
        c.fillStyle = c.strokeStyle = rgba(z.medio, 1);
        for (let k = 0; k < W / 160; k++) { const x = r() * W, y = H * (0.15 + r() * 0.4); c.save(); c.translate(x, y); c.rotate((r() - 0.5) * 3); silueta(c, FLOTA[Math.floor(r() * FLOTA.length)], 0.6 + r() * 0.35, r); c.restore(); }
      },
    },
  ],
  hospital: [
    {
      f: 0, fy: 0, pintar(c, W, H, z) { degradado(c, W, H, z.cielo[0], z.cielo[1]); },
    },
    {
      f: 0.18, blur: 5, pintar(c, W, H, z, r, o) {
        // pasillo de arcos dentro; cielo de tormenta sobre el patio
        for (let x = 0; x < W; x += 6) {
          const wx = o.mundoX(x);
          if (enPatio(o.E, wx)) { c.fillStyle = mezclar(z.patio[0], z.patio[1], x % 300 / 300 * 0.2); c.fillRect(x, 0, 6, H); }
        }
        c.fillStyle = z.lejos;
        for (let x = 0; x < W; x += 160) {
          if (enPatio(o.E, o.mundoX(x + 60))) continue;
          c.beginPath(); c.moveTo(x, H); c.lineTo(x, H * 0.35); c.quadraticCurveTo(x + 60, H * 0.12, x + 120, H * 0.35); c.lineTo(x + 120, H); c.lineTo(x + 160, H); c.lineTo(x + 160, 0); c.lineTo(x - 40, 0); c.lineTo(x - 40, H); c.fill();
        }
      },
    },
    {
      f: 0.42, blur: 2, pintar(c, W, H, z, r, o) {
        for (let x = 0; x < W; x += 120 + r() * 140) {
          const wx = o.mundoX(x);
          if (enPatio(o.E, wx)) {
            // tapias y ventanas del hospital alrededor del patio
            c.fillStyle = '#1b1c22'; c.fillRect(x, H * 0.3, 130, H * 0.7);
            c.fillStyle = '#2c3140'; for (let yy = H * 0.36; yy < H * 0.8; yy += 40) for (let xx = x + 10; xx < x + 120; xx += 30) c.fillRect(xx, yy, 14, 20);
          } else {
            // cortinas de las salas
            c.fillStyle = rgba('#8c8a80', 0.25);
            c.beginPath(); c.moveTo(x, H * 0.2); for (let k = 0; k <= 8; k++) c.lineTo(x + k * 8, H * 0.2 + (k % 2) * 6); c.lineTo(x + 64, H * 0.85); c.lineTo(x, H * 0.85); c.fill();
          }
        }
      },
    },
  ],
};

function enPatio(E, wx) {
  if (!E.ruedo) return false;
  return wx > E.ruedo.x0 - 2 * T && wx < E.ruedo.x1 + T;
}

// ---------------------------------------------------------------- nivel 1: laboratorio y anomalia
// A la izquierda de la brecha, la pared del laboratorio; a la derecha, la caverna de la anomalia. Cada
// capa decide que pinta segun la x del MUNDO que cae detras de cada punto (o.mundoX).
function enCaverna(o, lx) { return o.mundoX(lx) > o.E.nivel.brechaX; }
function frascoSil(c, x, yb, h, color, roto, luz) {
  const w = h * 0.42;
  c.fillStyle = color;
  c.fillRect(x - w * 0.6, yb - h * 0.12, w * 1.2, h * 0.12);
  if (roto) { c.beginPath(); c.moveTo(x - w / 2, yb - h * 0.12); c.lineTo(x - w / 2, yb - h * 0.5); c.lineTo(x - w * 0.1, yb - h * 0.35); c.lineTo(x + w * 0.2, yb - h * 0.62); c.lineTo(x + w / 2, yb - h * 0.4); c.lineTo(x + w / 2, yb - h * 0.12); c.fill(); }
  else {
    c.fillRect(x - w * 0.62, yb - h, w * 1.24, h * 0.1);
    c.globalAlpha *= 0.55; c.fillRect(x - w / 2, yb - h * 0.9, w, h * 0.78); c.globalAlpha /= 0.55;
    if (luz) { c.fillStyle = luz; c.globalAlpha *= 0.35; c.fillRect(x - w / 2 + 2, yb - h * 0.6, w - 4, h * 0.46); c.globalAlpha /= 0.35; }
  }
}
function torreRota(c, x, yb, w, h, color, r) {
  c.fillStyle = color;
  c.beginPath(); c.moveTo(x, yb); c.lineTo(x + w * 0.05, yb - h);
  for (let k = 1; k <= 5; k++) c.lineTo(x + (w * k) / 5, yb - h + (r() - 0.2) * h * 0.18);
  c.lineTo(x + w, yb); c.fill();
  // celosia
  c.strokeStyle = color; c.lineWidth = 2;
  for (let yy = yb - h * 0.9; yy < yb; yy += 26) { c.beginPath(); c.moveTo(x - 10, yy); c.lineTo(x + w + 10, yy + 6); c.stroke(); }
}
function andamio(c, x0, x1, y, color, r) {
  c.strokeStyle = color; c.lineWidth = 4;
  c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y + (r() - 0.5) * 20); c.stroke();
  c.lineWidth = 1.6;
  for (let x = x0; x < x1; x += 22) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 11, y + 14); c.lineTo(x + 22, y); c.stroke(); }
  c.beginPath(); c.moveTo(x0, y + 14); c.lineTo(x1, y + 14); c.stroke();
}
function cadenaSil(c, x, y0, y1, color) {
  c.strokeStyle = color; c.lineWidth = 2;
  for (let y = y0; y < y1; y += 7) { c.beginPath(); c.ellipse(x, y + 3, 2, 3.5, 0, 0, 7); c.stroke(); }
}
function rocaSil(c, x, y, s, color, r) {
  c.fillStyle = color; c.beginPath();
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2, rr = s * (0.6 + r() * 0.5); c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7); }
  c.fill();
}
function grano(c, W, H, a, r) {
  c.fillStyle = `rgba(0,0,0,${a})`;
  for (let k = 0; k < (W * H) / 900; k++) c.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2);
}

CAPAS.laboratorio = [
  {
    f: 0, fy: 0, pintar(c, W, H, z) {
      degradado(c, W, H, '#0b0f15', '#111820');
      const g = c.createRadialGradient(W * 0.5, H * 0.3, 0, W * 0.5, H * 0.3, H);
      g.addColorStop(0, 'rgba(60,80,105,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    },
  },
  {
    f: 0.14, blur: 6, pintar(c, W, H, z, r, o) {
      for (let x = 0; x < W; x += 4) {
        if (!enCaverna(o, x)) continue;
        // la caverna: luz fria que baja de la cascada, mas fuerte cerca de ella
        const d = Math.abs(o.mundoX(x) - o.E.nivel.cascadaX) / 900;
        const a = Math.max(0.06, 0.5 - d * 0.35);
        const g = c.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, `rgba(120,170,220,${a})`); g.addColorStop(0.6, `rgba(50,80,115,${a * 0.6})`); g.addColorStop(1, 'rgba(20,30,45,0)');
        c.fillStyle = g; c.fillRect(x, 0, 4, H);
      }
      for (let x = -40; x < W; x += 50 + r() * 70) {
        if (enCaverna(o, x)) torreRota(c, x, H, 40 + r() * 70, H * (0.4 + r() * 0.5), 'rgba(40,58,78,.9)', r);
        else { c.fillStyle = 'rgba(30,40,52,.85)'; c.fillRect(x, H * 0.15, 10, H * 0.85); for (let y = H * 0.3; y < H; y += 60) { c.fillStyle = 'rgba(30,40,52,.85)'; c.fillRect(x, y, 120, 5); for (let q = 0; q < 4; q++) frascoSil(c, x + 18 + q * 26, y, 34 + (q % 2) * 8, 'rgba(30,40,52,.85)', r() < 0.4); } }
      }
      for (let k = 0; k < W / 60; k++) { const x = r() * W; if (enCaverna(o, x)) rocaSil(c, x, H * (0.1 + r() * 0.5), 8 + r() * 26, 'rgba(36,52,70,.9)', r); }
      niebla(c, W, H, '#5d7a99', H * 0.45, H * 0.55, 0.3);
    },
  },
  {
    f: 0.32, blur: 2.6, pintar(c, W, H, z, r, o) {
      for (let x = -20; x < W; x += 140 + r() * 120) {
        if (enCaverna(o, x)) {
          andamio(c, x, x + 140 + r() * 120, H * (0.3 + r() * 0.35), 'rgba(28,38,50,.95)', r);
          cadenaSil(c, x + 30 + r() * 60, 0, H * (0.2 + r() * 0.3), 'rgba(28,38,50,.9)');
          // frasco o caja que flota
          if (r() < 0.6) frascoSil(c, x + 80, H * (0.25 + r() * 0.3), 46, 'rgba(40,58,78,.95)', r() < 0.3, '#a8d4ff');
          else { c.fillStyle = 'rgba(34,46,60,.95)'; c.save(); c.translate(x + 90, H * (0.3 + r() * 0.3)); c.rotate(r() - 0.5); c.fillRect(-18, -14, 36, 28); c.restore(); }
        } else {
          // estanterias del laboratorio con sus frascos
          c.fillStyle = 'rgba(20,26,34,.95)';
          c.fillRect(x, H * 0.2, 8, H * 0.8); c.fillRect(x + 150, H * 0.2, 8, H * 0.8);
          for (let y = H * 0.36; y < H; y += 72) {
            c.fillStyle = 'rgba(20,26,34,.95)';
            c.fillRect(x, y, 158, 6);
            for (let q = 0; q < 4; q++) frascoSil(c, x + 22 + q * 36, y, 52, 'rgba(26,34,44,.95)', r() < 0.45, r() < 0.15 ? '#ffcf8a' : null);
          }
        }
      }
      niebla(c, W, H, '#4c6782', H * 0.6, H * 0.4, 0.25);
      grano(c, W, H, 0.12, r);
    },
  },
  {
    f: 0.58, blur: 1.1, pintar(c, W, H, z, r, o) {
      for (let x = 0; x < W; x += 110 + r() * 200) {
        const col = 'rgba(14,18,24,.95)';
        if (enCaverna(o, x)) { c.fillStyle = col; c.fillRect(x, H * 0.55, 10, H * 0.45); c.fillRect(x + 70, H * 0.5, 10, H * 0.5); andamio(c, x - 20, x + 100, H * 0.55, col, r); }
        else { cadenaSil(c, x, 0, H * (0.15 + r() * 0.3), col); c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.moveTo(x + 40, 0); c.quadraticCurveTo(x + 70, H * 0.25, x + 120, H * 0.12); c.stroke(); }
      }
    },
  },
];

// ---------------------------------------------------------------- primer plano
// Siluetas casi negras que pasan por delante, mas deprisa que el mundo (parallax 1,35) y desenfocadas:
// taburetes, tuberias, cadenas y esquinas de caja en el laboratorio; vigas y cadenas en la caverna.
const cachePP = new Map();
function siluetaPP(tipo, s, filo = '#788caa') {
  const clave = tipo + '@' + s.toFixed(2) + filo;
  if (cachePP.has(clave)) return cachePP.get(clave);
  const W = 260, H = 300;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(W * s); cv.height = Math.ceil(H * s);
  const c = cv.getContext('2d');
  c.scale(s, s);
  c.filter = `blur(${2.2 * s}px)`;
  c.fillStyle = '#010102'; c.strokeStyle = '#010102';
  if (tipo === 'taburete') {
    c.beginPath(); c.ellipse(130, 170, 70, 18, 0, 0, 7); c.fill();
    c.lineWidth = 12; for (const [a, b] of [[80, 50], [180, 210], [110, 100], [150, 160]]) { c.beginPath(); c.moveTo(a, 175); c.lineTo(b, 300); c.stroke(); }
  } else if (tipo === 'tuberia') {
    c.lineWidth = 34; c.beginPath(); c.moveTo(0, 220); c.lineTo(180, 220); c.quadraticCurveTo(230, 220, 230, 300); c.stroke();
    c.fillRect(60, 196, 20, 48);
  } else if (tipo === 'cadena') {
    c.lineWidth = 7; for (let y = 0; y < 300; y += 22) { c.beginPath(); c.ellipse(130, y + 10, 8, 13, 0, 0, 7); c.stroke(); }
  } else if (tipo === 'caja') {
    c.fillRect(40, 170, 220, 130); c.fillStyle = '#0c0d12'; c.fillRect(40, 170, 220, 14);
  } else if (tipo === 'roca') {
    // piedras redondas apiladas, cada una con su canto, y hierba alta encima (como el primer plano de Silksong)
    const r = azar(77);
    const piedras = [];
    for (let k = 0; k < 9; k++) piedras.push({ x: 20 + k * 27 + r() * 12, y: 250 + r() * 30, rr: 24 + r() * 26 });
    for (let k = 0; k < 5; k++) piedras.push({ x: 40 + r() * 180, y: 215 + r() * 20, rr: 14 + r() * 16 });
    for (const p of piedras) { c.beginPath(); c.arc(p.x, p.y, p.rr, 0, 7); c.fill(); }
    c.filter = 'none';
    c.lineWidth = 2;
    for (const p of piedras) { c.beginPath(); c.arc(p.x, p.y, p.rr - 1, Math.PI * 1.1, Math.PI * 1.7); c.strokeStyle = 'rgba(70,74,80,.55)'; c.stroke(); }
    c.filter = `blur(${1.6 * s}px)`;
    c.lineCap = 'round';
    c.strokeStyle = '#010102';     // (la hierba heredaba el gris del canto de las piedras y salia clara)
    for (let k = 0; k < 40; k++) {
      const x = 10 + r() * 240, alto = 30 + r() * 70, inc = (r() - 0.5) * 50;
      c.lineWidth = 2 + r() * 3;
      c.beginPath(); c.moveTo(x, 240); c.quadraticCurveTo(x + inc * 0.2, 240 - alto * 0.6, x + inc, 240 - alto); c.stroke();
    }
  } else if (tipo === 'hierba') {
    const r = azar(91);
    c.lineCap = 'round';
    for (let k = 0; k < 34; k++) {
      const x = 20 + r() * 220, alto = 60 + r() * 150, inc = (r() - 0.5) * 70;
      c.lineWidth = 3 + r() * 5;
      c.beginPath(); c.moveTo(x, 300); c.quadraticCurveTo(x + inc * 0.2, 300 - alto * 0.6, x + inc, 300 - alto); c.stroke();
    }
    for (let k = 0; k < 5; k++) { const x = 40 + r() * 180, y = 120 + r() * 80; c.beginPath(); c.ellipse(x, y, 5, 14, r() - 0.5, 0, 7); c.fill(); }
  } else if (tipo === 'farola') {
    c.lineWidth = 12; c.beginPath(); c.moveTo(110, 300); c.lineTo(118, 60); c.quadraticCurveTo(122, 20, 170, 26); c.stroke();
    c.fillRect(160, 18, 40, 14);
  } else if (tipo === 'silla') {
    c.lineWidth = 10; c.beginPath(); c.moveTo(70, 300); c.lineTo(80, 180); c.lineTo(190, 190); c.lineTo(185, 300); c.moveTo(80, 180); c.lineTo(70, 70); c.stroke();
    c.fillRect(70, 172, 128, 18);
  } else if (tipo === 'camilla') {
    c.fillRect(10, 170, 240, 20); c.lineWidth = 8;
    for (const x of [30, 230]) { c.beginPath(); c.moveTo(x, 190); c.lineTo(x, 290); c.stroke(); c.beginPath(); c.arc(x, 290, 10, 0, 7); c.fill(); }
    c.beginPath(); c.moveTo(200, 170); c.quadraticCurveTo(170, 110, 120, 150); c.lineTo(110, 170); c.fill();
  } else if (tipo === 'viga') {
    c.save(); c.translate(130, 240); c.rotate(-0.35); c.fillRect(-150, -18, 300, 36); c.restore();
  }
  c.filter = 'none';
  if (tipo === 'cadena') {
    // la cadena se pierde por abajo en vez de cortarse
    c.globalCompositeOperation = 'destination-out';
    const f = c.createLinearGradient(0, 180, 0, 300); f.addColorStop(0, 'rgba(0,0,0,0)'); f.addColorStop(1, 'rgba(0,0,0,1)');
    c.fillStyle = f; c.fillRect(0, 180, W, 120);
    c.globalCompositeOperation = 'source-over';
  }
  // filo de luz arriba, muy tenue
  c.globalCompositeOperation = 'source-atop';
  const g = c.createLinearGradient(0, 150, 0, 200); g.addColorStop(0, rgba(filo, 0.14)); g.addColorStop(1, rgba(filo, 0));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  cachePP.set(clave, cv);
  return cv;
}

const PP = {
  lab: ['tuberia', 'roca', 'cadena', 'caja', 'taburete'],
  ciudad: ['roca', 'hierba', 'farola', 'viga', 'hierba'],
  casa: ['silla', 'caja', 'roca', 'cadena'],
  plaza: ['hierba', 'roca', 'viga', 'hierba', 'farola'],
  hospital: ['camilla', 'tuberia', 'roca', 'cadena', 'hierba'],
};
export function dibujarPrimerPlano(ctx, E, cam, s, t) {
  const bx = E.nivel.brechaX || 0;
  const centro = cam.x + cam.w / 2;
  // en los niveles pegados (sim/pasos.js) las siluetas van en el mundo comun: siguen sin salto al cambiar
  const ox = E.comun ? E.comun.ox : 0, fin = E.comun ? E.comun.ancho : E.m.ancho;
  for (let wm = 300; wm < fin; wm += 700) {
    const wx = wm - ox;
    if (wx < -400 || wx > E.m.ancho + 400) continue;
    const k = Math.floor(wm / 700);
    const tipos = PP[E.nivel.zona] ? PP[E.nivel.zona] : wx < bx ? ['taburete', 'tuberia', 'cadena', 'caja'] : ['viga', 'cadena', 'roca', 'viga'];
    const tipo = tipos[k % tipos.length];
    const x = wx + (wx - centro) * 0.35;               // por delante: se mueve mas que el mundo
    if (x < cam.x - 300 || x > cam.x + cam.w + 40) continue;
    const cv = siluetaPP(tipo, s, PP[E.nivel.zona] ? mezclar(ZONAS[E.nivel.zona].masaClara, ZONAS[E.nivel.zona].borde, 0.3) : undefined);
    const sy = tipo === 'cadena' ? -40 : tipo === 'roca' ? cam.h - 205 + (k % 3) * 14 : tipo === 'hierba' ? cam.h - 240 + (k % 3) * 18 : cam.h - 300 + 80 + (k % 3) * 20;
    ctx.drawImage(cv, (x - cam.x) * s, sy * s, 260 * s, 300 * s);
  }
}
