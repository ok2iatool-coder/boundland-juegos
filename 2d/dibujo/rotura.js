// LA ROTURA DEL FRASCO DEL 18 (la intro del nivel 1, despues del prologo): la piedra cae sobre la tapa y se queda
// encima APRETANDO; las grietas corren por el cristal y la presion lo revienta (el 18 no hace nada: duerme). Como
// el empuje viene de arriba, el cristal sale hacia los lados mas que hacia arriba, y la tapa abollada cae al suelo.
//   grietas()  una red de grietas que nace en el golpe de la tapa y baja ramificandose; con brillo en los cantos y,
//              al final, la luz del liquido que se cuela por ellas
//   Rotura     el estallido: destello, un instante a camara lenta, esquirlas que giran (se ven de canto y de plano,
//              y destellan al ponerse de cara), rebotan y se quedan en el suelo brillando; el liquido de estasis que
//              salpica en gotas, chorrea por el borde roto y hace un charco que brilla y se apaga; vapor frio; y su
//              sonido (crujido, estallido, cristales que caen, el liquido)
// Medidas del frasco (el asset, con la base en pie + 28): cristal de x +-20, de pie - 88 a pie + 4; liquido hasta
// pie - 66; la tapa en pie - 102.
import { T } from '../sim/constantes.js';
import { celda, PLAT } from '../sim/mapa.js';
import { esSolida } from '../sim/fisica.js';

const G = 1500;
const CRISTAL = { r: 20, y0: -88, y1: 4, liq: -66 };

function azar(semilla) {
  let s = semilla >>> 0;
  const u = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { u, e: (a, b) => a + u() * (b - a) };
}

// ---------------------------------------------------------------- las grietas (k: 0 el golpe, 1 a punto de estallar)
let ARBOL = null;
function arbol() {
  if (ARBOL) return ARBOL;
  const r = azar(1818), ramas = [], X = CRISTAL.r - 4;
  // fracturas RADIALES desde el golpe: casi rectas (el cristal se raja en lineas, con un temblor pequeno), en
  // abanico hacia abajo; de cada una salen ramitas cortas en angulo agudo. La que llega al canto se para ahi.
  const crecer = (x, y, ang, largo, nivel, t0) => {
    const pts = [[x, y]];
    let a = ang, px = x, py = y;
    const n = 6 + Math.floor(r.u() * 3), paso = largo / n;
    for (let i = 0; i < n; i++) {
      a += r.e(-0.14, 0.14);
      px += Math.cos(a) * paso; py += Math.sin(a) * paso;
      if (Math.abs(px) > X || py > CRISTAL.y1 - 14) break;
      pts.push([px, py]);
    }
    if (pts.length < 2) return;
    const t1 = t0 + 0.28 + nivel * 0.1;
    ramas.push({ pts, t0, t1, n: nivel });
    if (nivel < 2) for (let i = 2; i < pts.length - 1; i++) if (r.u() < 0.3) {
      crecer(pts[i][0], pts[i][1], a + (r.u() < 0.5 ? -1 : 1) * r.e(0.35, 0.7), largo * r.e(0.2, 0.4), nivel + 1, t0 + (t1 - t0) * i / pts.length);
    }
  };
  // la estrella del golpe y un anillo roto alrededor
  const cx = 2, cy = CRISTAL.y0 + 4;
  for (let q = 0; q < 9; q++) { const a = 0.15 + q * 0.35 + r.e(-0.1, 0.1), l = r.e(3, 7); ramas.push({ pts: [[cx, cy], [cx + Math.cos(a) * l, cy + Math.sin(a) * l * 0.8]], t0: 0, t1: 0.05, n: 2 }); }
  for (let q = 0; q < 6; q++) { const a0 = 0.2 + q * 0.48, a1 = a0 + 0.32; ramas.push({ pts: [[cx + Math.cos(a0) * 6, cy + Math.sin(a0) * 5], [cx + Math.cos(a1) * 6.5, cy + Math.sin(a1) * 5.4]], t0: 0.04, t1: 0.1, n: 2 }); }
  const fan = [0.95, 1.25, 1.5, 1.8, 2.15];
  fan.forEach((a, q) => crecer(cx, cy, a + r.e(-0.08, 0.08), r.e(45, 85) * (q === 2 ? 1 : 0.85), 0, 0.03 + q * 0.04 + r.e(0, 0.08)));
  // y alguna que nace mas abajo, donde el cristal ya esta tenso
  crecer(-9, -48, 0.6, 24, 1, 0.55); crecer(10, -40, 2.4, 20, 1, 0.65);
  return (ARBOL = ramas);
}

export function grietas(ctx, x, pie, k, t) {
  const ramas = arbol();
  ctx.save(); ctx.translate(x, pie); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const trazo = (an, color) => {
    ctx.beginPath();
    for (const b of ramas) {
      const f = Math.max(0, Math.min(1, (k - b.t0) / (b.t1 - b.t0)));
      if (f <= 0) continue;
      const L = (b.pts.length - 1) * f, n = Math.floor(L);
      ctx.moveTo(b.pts[0][0], b.pts[0][1]);
      for (let i = 1; i <= n; i++) ctx.lineTo(b.pts[i][0], b.pts[i][1]);
      if (n < b.pts.length - 1) { const g = L - n, a = b.pts[n], c = b.pts[n + 1]; ctx.lineTo(a[0] + (c[0] - a[0]) * g, a[1] + (c[1] - a[1]) * g); }
    }
    ctx.strokeStyle = color; ctx.lineWidth = an; ctx.stroke();
  };
  // (un trazo oscuro debajo del blanco: contra el brillo del frasco el blanco solo no se veia)
  trazo(2, 'rgba(26,32,44,.38)');
  trazo(0.75, 'rgba(240,248,255,.62)');
  // al final la luz del liquido se cuela por las grietas y el cristal tiembla
  if (k > 0.55) {
    const a = (k - 0.55) / 0.45;
    ctx.globalCompositeOperation = 'lighter';
    trazo(2.5 + a * 2, `rgba(255,214,150,${(0.14 * a * (0.8 + 0.2 * Math.sin(t * 60))).toFixed(3)})`);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- el estallido
export class Rotura {
  // m: el mapa del nivel. Cada trozo, gota y la tapa caen hasta el suelo que tienen DEBAJO (antes todos se
  // posaban a la altura del frasco y los que salian del borde se quedaban flotando en un suelo invisible) y
  // rebotan en las paredes; el charco no pasa del borde del suelo.
  constructor(x, pie, son, m = null) {
    this.x = x; this.pie = pie; this.t = 0; this.tl = 0; this.m = m;
    this.borde = [x - 1e4, x + 1e4];
    if (m) {
      const j = Math.round(pie / T), duro = (i) => esSolida(celda(m, i, j)) && !esSolida(celda(m, i, j - 1));
      let a = Math.floor(x / T), b = a;
      while (a > 0 && duro(a - 1)) a--;
      while (b < m.w - 1 && duro(b + 1)) b++;
      this.borde = [a * T, (b + 1) * T];
    }
    const r = azar(4718);
    this.trozos = [];
    for (let i = 0; i < 84; i++) {
      const s = r.u() < 0.5 ? -1 : 1, alto = r.e(0, 1) ** 0.7;             // mas trozos de arriba (donde golpeo)
      const tam = r.e(2.2, 10) * (r.u() < 0.12 ? 1.6 : 1);
      const n = 3 + Math.floor(r.u() * 2), pts = [];
      for (let q = 0; q < n; q++) { const a = (q / n) * Math.PI * 2 + r.e(-0.5, 0.5); pts.push([Math.cos(a) * tam * r.e(0.5, 1.2), Math.sin(a) * tam * r.e(0.4, 1)]); }
      this.trozos.push({
        x: x + s * r.e(4, CRISTAL.r), y: pie + CRISTAL.y0 + (1 - alto) * 58,
        vx: s * r.e(60, 300) * (0.6 + 0.6 * alto), vy: -r.e(20, 240) * alto - 10,      // aplastado: sale de lado
        ang: r.e(0, 6.3), w: r.e(-16, 16), giro: r.e(0, 6.3), vgiro: r.e(5, 26), pts, tam,
        delante: r.u() < 0.55, quieto: false, brilla: r.e(0, 6.3), suelo: r.e(0, 6.3),
      });
    }
    this.gotas = [];
    for (let i = 0; i < 60; i++) {
      const s = r.u() < 0.5 ? -1 : 1;
      this.gotas.push({ x: x + s * r.e(6, 18), y: pie + r.e(CRISTAL.liq, CRISTAL.liq + 30), vx: s * r.e(20, 240), vy: -r.e(20, 260), r: r.e(0.8, 2.4), suelo: false, mancha: 0 });
    }
    // la tapa: cede hacia la izquierda con la piedra encima y cae al suelo dando vueltas
    this.tapa = { x, y: pie - 94, vx: -55, vy: -30, ang: 0, w: -3.2, quieta: false };
    this.vapor = [];
    for (let i = 0; i < 16; i++) this.vapor.push({ x: x + r.e(-14, 14), y: pie + CRISTAL.y0 + r.e(-6, 20), vx: r.e(-24, 24), vy: -r.e(18, 60), r0: r.e(6, 12), t0: r.e(0, 0.5), vida: r.e(1.6, 2.8) });
    this.sonar(son);
  }

  // un momento a camara lenta justo al estallar, y vuelve
  escala() { return this.t < 0.05 ? 0.12 : Math.min(1, 0.22 + (this.t - 0.05) * 1.6); }

  // el primer suelo por debajo de y en la columna de x (lo macizo, o una plataforma si se viene de encima)
  sueloEn(x, y) {
    const m = this.m;
    if (!m) return this.pie;
    const i = Math.floor(x / T);
    for (let j = Math.max(0, Math.floor(y / T)); j < m.h; j++) {
      const v = celda(m, i, j);
      if ((esSolida(v) || v === PLAT) && j * T >= y - 0.5) return j * T;
    }
    return Infinity;
  }
  pared(x, y) { return !!this.m && esSolida(celda(this.m, Math.floor(x / T), Math.floor(y / T))); }

  // un cuerpo que cae (trozo, tapa o gota): choca de lado con las paredes y se para en el suelo que tiene debajo.
  // Devuelve el suelo si lo ha tocado en este paso.
  caer(q, d, alto) {
    const x0 = q.x, y0 = q.y;
    q.vy += G * d; q.x += q.vx * d; q.y += q.vy * d;
    if (this.pared(q.x, y0)) { q.x = x0; q.vx *= -0.3; }
    const s = this.sueloEn(q.x, y0 + alto);
    if (q.y + alto > s) { q.y = s - alto; return s; }
    if (q.y > this.pie + 3000) q.fuera = true;        // cayo al vacio
    return null;
  }

  paso(dt) {
    this.t += dt;
    const d = dt * this.escala();
    this.tl += d;
    for (const q of this.trozos) {
      if (q.quieto || q.fuera) continue;
      q.ang += q.w * d; q.giro += q.vgiro * d;
      if (this.caer(q, d, 1) !== null) {
        if (Math.abs(q.vy) < 70) q.quieto = true;      // tumbado en el suelo (se dibuja aplastado)
        q.vy *= -0.28; q.vx *= 0.5; q.w *= 0.5; q.vgiro *= 0.4;
      }
    }
    const tp = this.tapa;
    if (!tp.quieta && !tp.fuera) {
      tp.ang += tp.w * d;
      if (this.caer(tp, d, 6) !== null) {
        tp.vy *= -0.25; tp.vx *= 0.45; tp.w *= 0.3;
        if (Math.abs(tp.vy) < 50) { tp.quieta = true; tp.ang = Math.round(tp.ang / Math.PI) * Math.PI + 0.06; }   // plana
      }
    }
    for (const g of this.gotas) {
      if (g.suelo) { g.mancha = Math.max(0, g.mancha - dt * 0.12); continue; }
      if (g.fuera) continue;
      if (this.caer(g, d, 0) !== null) { g.suelo = true; g.mancha = 1; }
    }
  }

  // la fuerza de la luz del frasco: estalla, parpadea y se queda baja; y la del charco
  luzFrasco() {
    const t = this.t;
    if (t < 0.25) return 1.15 - t * 1.6;
    if (t < 1.2) return 0.5 + 0.35 * Math.abs(Math.sin(t * 31)) * (1.2 - t);
    return 0.4;
  }
  destello() { return this.t < 0.35 ? (1 - this.t / 0.35) ** 2 : 0; }
  charco() { const a = Math.min(1, this.t / 2.6); return { r: 78 * (1 - (1 - a) ** 3), luz: Math.max(0.12, 0.6 - this.t * 0.03) }; }

  dibujar(ctx, t, delante) {
    const x = this.x, pie = this.pie;
    ctx.save();
    if (!delante) {
      // ---- el charco: liquido ambar que se extiende y brilla, con un filo que refleja
      const ch = this.charco();
      if (ch.r > 1) {
        ctx.save(); ctx.beginPath(); ctx.rect(this.borde[0], pie - 30, this.borde[1] - this.borde[0], 60); ctx.clip();
        ctx.translate(x + 6, pie + 1.5); ctx.scale(1, 0.16);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, ch.r);
        g.addColorStop(0, `rgba(255,214,150,${(0.55 * ch.luz).toFixed(3)})`); g.addColorStop(0.75, `rgba(240,180,110,${(0.35 * ch.luz).toFixed(3)})`); g.addColorStop(1, 'rgba(240,180,110,0)');
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, ch.r, 0, 7); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = `rgba(255,236,200,${(0.35 * ch.luz).toFixed(3)})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(0, 0, ch.r * 0.92, ch.r * 0.92, 0, Math.PI * 1.08, Math.PI * 1.9); ctx.stroke();
        ctx.restore();
      }
      // ---- la tapa (metal oxidado con sus cuatro tornillos, abollada en el centro por la piedra)
      const tp = this.tapa;
      ctx.save(); ctx.translate(tp.x, tp.y); ctx.rotate(tp.ang);
      ctx.beginPath(); ctx.moveTo(-24, -6); ctx.lineTo(-6, -6); ctx.lineTo(0, -2); ctx.lineTo(6, -6); ctx.lineTo(24, -6); ctx.lineTo(24, 6); ctx.lineTo(6, 6); ctx.lineTo(0, 9); ctx.lineTo(-6, 6); ctx.lineTo(-24, 6); ctx.closePath();
      ctx.fillStyle = '#4a5160'; ctx.fill();
      ctx.fillStyle = 'rgba(160,170,185,.35)'; ctx.fillRect(-23, -5, 46, 3);
      ctx.strokeStyle = '#141318'; ctx.lineWidth = 2; ctx.stroke();
      for (let k = 0; k < 4; k++) { if (k === 1) continue; ctx.fillStyle = '#3a404c'; ctx.fillRect(-21 + k * 13, -15, 3, 9); ctx.strokeRect(-21 + k * 13, -15, 3, 9); }   // (uno se partio)
      ctx.restore();
      // ---- los chorros que caen por el borde roto hasta el suelo (al principio)
      if (this.t < 2.2) {
        const a = Math.min(1, this.t / 0.2) * Math.max(0, 1 - this.t / 2.2);
        ctx.globalCompositeOperation = 'lighter';
        for (const s of [-1, 1]) {
          const x0 = x + s * (CRISTAL.r - 1), y0 = pie - 44;
          ctx.strokeStyle = `rgba(255,212,150,${(0.5 * a).toFixed(3)})`; ctx.lineWidth = 3.5 * a + 1;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.bezierCurveTo(x0 + s * 5, y0 + 10, x0 + s * 3, pie - 20, x0 + s * (4 + Math.sin(t * 9 + s) * 1.5), pie); ctx.stroke();
          ctx.strokeStyle = `rgba(255,246,226,${(0.6 * a).toFixed(3)})`; ctx.lineWidth = 1; ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      // ---- manchas de las gotas en el suelo
      ctx.globalCompositeOperation = 'lighter';
      for (const g of this.gotas) if (g.suelo && g.mancha > 0.02) { ctx.fillStyle = `rgba(255,206,140,${(0.4 * g.mancha).toFixed(3)})`; ctx.beginPath(); ctx.ellipse(g.x, g.y + 1, g.r * 2.4, g.r * 0.6, 0, 0, 7); ctx.fill(); }
      ctx.globalCompositeOperation = 'source-over';
    }
    // ---- las esquirlas: poligonos que giran en el plano y se dan la vuelta (se ven de canto o de plano); en el suelo,
    // tumbadas: aplastadas en una raya fina que brilla a ratos
    ctx.lineJoin = 'round';
    for (const q of this.trozos) {
      if (q.quieto ? delante : q.delante !== !!delante) continue;
      const c = Math.cos(q.giro), cara = Math.max(0.1, Math.abs(c));
      const ca = Math.cos(q.quieto ? q.suelo : q.ang), sa = Math.sin(q.quieto ? q.suelo : q.ang);
      const sx = q.quieto ? 0.8 : cara, sy = q.quieto ? 0.2 : 1, dy = q.quieto ? -q.tam * 0.12 : 0;
      ctx.beginPath();
      q.pts.forEach((p, i) => { const px = p[0] * sx, py = p[1]; const X = q.x + px * ca - py * sa, Y = q.y + dy + (px * sa + py * ca) * sy; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
      ctx.closePath();
      ctx.fillStyle = `rgba(196,224,240,${(q.quieto ? 0.22 : 0.12 + 0.2 * cara).toFixed(3)})`; ctx.fill();
      ctx.strokeStyle = `rgba(232,246,255,${(q.quieto ? 0.45 : 0.4 + 0.35 * (1 - cara)).toFixed(3)})`; ctx.lineWidth = 0.7; ctx.stroke();
      // el destello cuando se pone de cara a la luz (en el aire) o cuando la luz parpadea (en el suelo): una
      // chispa pequena, no una cruz que tapa el plano
      const chispa = q.quieto ? Math.max(0, Math.sin(t * 1.7 + q.brilla) - 0.97) * 30 : Math.max(0, cara - 0.985) * 60;
      if (chispa > 0.05) {
        ctx.globalCompositeOperation = 'lighter';
        const L = 2 + chispa * 3, X = q.x, Y = q.y + dy;
        ctx.strokeStyle = `rgba(255,250,236,${Math.min(0.9, chispa).toFixed(3)})`; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(X - L, Y); ctx.lineTo(X + L, Y); ctx.moveTo(X, Y - L * 0.6); ctx.lineTo(X, Y + L * 0.6); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    if (delante) {
      // ---- las gotas en el aire, con su brillo
      ctx.globalCompositeOperation = 'lighter';
      for (const g of this.gotas) {
        if (g.suelo) continue;
        const R = g.r * 2.4, gr = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, R);
        gr.addColorStop(0, 'rgba(255,236,196,.7)'); gr.addColorStop(0.35, 'rgba(255,200,130,.28)'); gr.addColorStop(1, 'rgba(255,200,130,0)');
        ctx.fillStyle = gr; ctx.fillRect(g.x - R, g.y - R, R * 2, R * 2);
      }
      // ---- el vapor frio que sube del liquido
      ctx.globalCompositeOperation = 'source-over';
      for (const v of this.vapor) {
        const e = this.t - v.t0; if (e < 0 || e > v.vida) continue;
        const f = e / v.vida, rr = v.r0 + e * 26, a = 0.16 * Math.sin(Math.PI * f);
        const gv = ctx.createRadialGradient(v.x + v.vx * e, v.y + v.vy * e, 0, v.x + v.vx * e, v.y + v.vy * e, rr);
        gv.addColorStop(0, `rgba(220,232,240,${a.toFixed(3)})`); gv.addColorStop(1, 'rgba(220,232,240,0)');
        ctx.fillStyle = gv; ctx.fillRect(v.x + v.vx * e - rr, v.y + v.vy * e - rr, rr * 2, rr * 2);
      }
      // ---- el destello del estallido
      const d = this.destello();
      if (d > 0.01) {
        ctx.globalCompositeOperation = 'lighter';
        const gd = ctx.createRadialGradient(x, pie - 50, 0, x, pie - 50, 200);
        gd.addColorStop(0, `rgba(255,240,215,${(0.42 * d).toFixed(3)})`); gd.addColorStop(0.3, `rgba(255,220,170,${(0.16 * d).toFixed(3)})`); gd.addColorStop(1, 'rgba(255,220,170,0)');
        ctx.fillStyle = gd; ctx.fillRect(x - 200, pie - 250, 400, 400);
      }
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- el sonido
  sonar(son) {
    if (!son || !son.ctx) return;
    const r = azar(77), e = r.e;
    // el estallido: un crack seco y agudo y el cuerpo del cristal grueso
    son.soplo(0.06, 4200, 0.7, 0.55, 0.3, 0, 2600, 'highpass');
    son.soplo(0.35, 1400, 1.2, 0.25, 0.5, 0, 700, 'bandpass');
    son.tono(e(1700, 2100), 0.9, 'sine', 0.05, 0.7, 0, null);
    // cristales que caen y rebotan: muchas notas agudas cortas repartidas en el primer segundo y medio
    for (let k = 0; k < 46; k++) {
      const ms = (k < 8 ? e(0, 80) : e(80, 1500)) * (k < 8 ? 1 : 1), f = e(2600, 8800), pan = e(-0.6, 0.6), vol = e(0.012, 0.045) * (k < 8 ? 1.4 : 1);
      setTimeout(() => son.tono(f, e(0.05, 0.3), 'sine', vol, 0.5, pan, f * e(0.97, 1.01)), ms);
    }
    // el liquido: chapoteo y unos gorgoteos
    setTimeout(() => son.soplo(0.9, 900, 0.8, 0.12, 0.5, 0, 400, 'bandpass', true), 60);
    for (let k = 0; k < 7; k++) setTimeout(() => son.tono(e(220, 420), 0.08, 'sine', 0.025, 0.4, e(-0.3, 0.3), e(500, 800)), e(200, 1400));
  }
}
