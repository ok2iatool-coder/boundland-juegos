// El polvo de los focos, con FISICA, iluminado con la luz que calculo Blender.
// Cada mota es una particula de verdad en el aire de su lampara:
//   - pesa casi nada: el aire la frena (rozamiento), cae muy despacio y tiembla (movimiento browniano);
//   - dentro del haz el aire esta caliente y SUBE (conveccion), mas en las lamparas calidas;
//   - el 18 desplaza el aire al moverse (las motas se apartan de su cuerpo y le siguen en su estela),
//     el tajo sopla hacia donde va, la estocada y el Sunikel abren un pasillo, una caida o un golpe levantan
//     un remolino, y la lampara al balancearse empuja el aire que tiene alrededor;
//   - choca con el terreno: no entra en la roca, rebota y pierde velocidad.
// Su BRILLO es la luz del haz renderizado en Blender en ese punto (`haces.campo`), por el color de la
// lampara y su parpadeo, y nada en la sombra (poligono de visibilidad de luz.js): por eso se ven como en el
// render. Las motas no siguen a la lampara: cuando se balancea, el haz enciende motas distintas.
// Las luces sin cono (faroles) llevan una nube pequena con la misma fisica y caida redonda.
// Solo dibujo; se actualiza en el paso del juego.
import { T } from '../sim/constantes.js';
import { MACIZO, HUNDE, TALLO } from '../sim/mapa.js';

const R = Math.random;
const duro = (v) => v === MACIZO || v === HUNDE || v === TALLO;

// motas por lampara con luz de Blender (blender/luces/): las que llenan mas aire, mas
const POR_SPR = { casa: 1000, farola: 900, farol: 500, ventana: 700, emergencia: 300, rejilla: 350, piloto: 0, frasco: 0 };

export class PolvoLuz {
  constructor(luces, E, haces) {
    this.E = E; this.haces = haces;
    this.grupos = [];
    for (const L of luces) {
      const n = L.spr ? (POR_SPR[L.spr.id] ?? 0) : L.cono ? (L.calida ? 2000 : L.r > 260 ? 1500 : 1000) : L.r >= 180 ? 220 : 0;
      if (!n) continue;
      const g = { L, motas: [], region: this.region(L) };
      for (let k = 0; k < n; k++) g.motas.push(this.nueva(g, true));
      this.grupos.push(g);
    }
    this.remolinos = [];     // { x, y, r, f, t, dx?, dy? }: aire empujado que se apaga en 0,4 s
  }

  // el aire de la lampara: la caja que su haz puede alumbrar, tambien cuando se balancea
  region(L) {
    const px = L.foco ? L.foco.px : L.x, y0 = L.foco ? L.foco.py + L.foco.luzDy : L.y;
    if (L.spr && !L.cono) return { x0: px - L.r * 0.8, x1: px + L.r * 0.8, y0: L.y - L.r * 0.7, y1: L.y + L.r * 0.9 };
    if (!L.cono) return { x0: px - L.r * 0.7, x1: px + L.r * 0.7, y0: L.y - L.r * 0.6, y1: L.y + L.r * 0.7 };
    return { x0: px - L.r * 0.9, x1: px + L.r * 0.9, y0: y0 - 8, y1: y0 + L.r * 1.02 };
  }

  solido(x, y) {
    const m = this.E.m, i = Math.floor(x / T), j = Math.floor(y / T);
    if (i < 0 || i >= m.w || j < 0 || j >= m.h) return false;
    return duro(m.t[j * m.w + i]);
  }

  nueva(g, inicio) {
    const r = g.region;
    let x, y, k = 0;
    do { x = r.x0 + R() * (r.x1 - r.x0); y = r.y0 + R() * (r.y1 - r.y0); } while (this.solido(x, y) && ++k < 6);
    const grande = R() < 0.03;
    return {
      x, y, vx: (R() - 0.5) * 4, vy: (R() - 0.5) * 4,
      tam: grande ? 1.8 + R() * 1.6 : R() < 0.8 ? 0.55 + R() * 0.35 : 0.9 + R() * 0.5,
      grande, fase: R() * 6.28, giro: 0.6 + R() * 2.4,
      vida: inicio ? R() * 20 : 0, dura: 14 + R() * 20,
    };
  }

  emitir(e, E) {
    const p = E.p, pc = p.x + p.w / 2, pm = p.y + p.h / 2;
    // aire que empujan los golpes y los aterrizajes: r radio, f fuerza (u/s), dx/dy para los soplidos
    let w = null;
    switch (e.t) {
      case 'tajo': w = { x: pc + p.cara * 30, y: e.dir === 'arriba' ? p.y - 20 : e.dir === 'abajo' ? p.y + p.h + 10 : pm, r: 80, f: 90, dx: e.dir === 'lado' ? p.cara : 0, dy: e.dir === 'arriba' ? -1 : e.dir === 'abajo' ? 1 : 0 }; break;
      case 'estocada': case 'sunikel': w = { x: pc + p.cara * 40, y: pm, r: 110, f: 170, dx: p.cara, dy: 0 }; break;
      case 'impacto': w = { x: e.x, y: e.y, r: 70, f: e.fuerte ? 140 : 90 }; break;
      case 'choque': w = { x: e.x, y: e.y, r: 100, f: 180 }; break;
      case 'aterriza': w = { x: e.x ?? pc, y: p.y + p.h, r: e.fuerte ? 110 : 60, f: e.fuerte ? 150 : 60 }; break;
      case 'salto': case 'doble': w = { x: pc, y: p.y + p.h, r: 50, f: 60, dx: 0, dy: 1 }; break;
      case 'foco_golpe': w = { x: e.x, y: e.y, r: 70, f: 90 }; break;
      case 'gigante_cae': case 'jefe_aterriza': w = { x: e.x, y: e.y, r: 220, f: 220 }; break;
      case 'muere': w = { x: e.x, y: e.y, r: 90, f: 120 }; break;
    }
    if (w && w.x !== undefined) { w.t = 0; this.remolinos.push(w); }
  }

  actualizar(dt, t, cam, E) {
    const p = E.p, pc = p.x + p.w / 2, pm = p.y + p.h / 2;
    for (const w of this.remolinos) w.t += dt;
    this.remolinos = this.remolinos.filter((w) => w.t < 0.4);
    const campo = this.haces && this.haces.listo;
    for (const g of this.grupos) {
      const L = g.L, r = g.region;
      if (r.x1 < cam.x - 60 || r.x0 > cam.x + cam.w + 60 || r.y1 < cam.y - 60 || r.y0 > cam.y + cam.h + 60) continue;
      const calor = L.cono ? (L.calida ? 9 : 4) : 3;
      const f = L.foco, lv = f ? f.w * f.largo : 0;           // la lampara al balancearse empuja el aire
      for (let k = 0; k < g.motas.length; k++) {
        const m = g.motas[k];
        m.vida += dt;
        if (m.vida > m.dura || m.x < r.x0 - 40 || m.x > r.x1 + 40 || m.y < r.y0 - 40 || m.y > r.y1 + 30) { g.motas[k] = this.nueva(g, false); continue; }
        let ax = (R() - 0.5) * 70, ay = (R() - 0.5) * 70 + 2.5;            // browniano y una caida lentisima
        // conveccion: dentro del haz el aire caliente sube
        if (L.spr || (L.cono && campo)) { const luz = this.luzEn(L, m.x, m.y); if (luz > 0.05) ay -= calor * luz * 2.2; }
        else if (!L.cono) { const d = Math.hypot(m.x - L.x, m.y - L.y); if (d < L.r * 0.5) ay -= calor * (1 - d / (L.r * 0.5)); }
        // el 18: aparta las motas de su cuerpo y las arrastra en su estela
        const dx = m.x - pc, dy = m.y - pm, d2 = dx * dx + dy * dy;
        if (d2 < 3600) {
          // quieto apenas aparta (un cuerpo parado no hace hueco en el polvo); corriendo abre paso y arrastra
          const k2 = 1 - d2 / 3600, d = Math.sqrt(d2) + 0.01, abre = k2 * (8 + Math.hypot(p.vx, p.vy) * 0.35);
          ax += p.vx * k2 * 4.5 + (dx / d) * abre;
          ay += p.vy * k2 * 3.5 + (dy / d) * abre;
        }
        // remolinos y soplidos
        for (const w of this.remolinos) {
          const ex = m.x - w.x, ey = m.y - w.y, d = Math.hypot(ex, ey);
          if (d >= w.r || d < 0.1) continue;
          const k3 = (1 - d / w.r) * w.f * (1 - w.t / 0.4) * 12;
          if (w.dx || w.dy) { ax += w.dx * k3 + (ex / d) * k3 * 0.25; ay += w.dy * k3 + (ey / d) * k3 * 0.25; }
          else { ax += (ex / d) * k3 - (ey / d) * k3 * 0.4; ay += (ey / d) * k3 + (ex / d) * k3 * 0.4; }   // remolino: hacia fuera y girando
        }
        // la lampara que se mece mueve el aire de cerca
        if (f && Math.abs(lv) > 5) { const ex = m.x - f.x, ey = m.y - f.y; const d = ex * ex + ey * ey; if (d < 4900) ax += lv * (1 - d / 4900) * 3; }
        // integrar con rozamiento del aire
        m.vx += ax * dt; m.vy += ay * dt;
        const roce = Math.exp(-2.2 * dt);
        m.vx *= roce; m.vy *= roce;
        const nx = m.x + m.vx * dt, ny = m.y + m.vy * dt;
        // el terreno: no entra en la roca, rebota perdiendo velocidad
        if (this.solido(nx, m.y)) m.vx *= -0.3; else m.x = nx;
        if (this.solido(m.x, ny)) m.vy *= -0.3; else m.y = ny;
      }
    }
  }

  // la luz que le llega a una mota en (x, y): la imagen de Blender de su lampara si la tiene
  luzEn(L, x, y) {
    const h = this.haces;
    if (L.spr) return h && h.spr[L.spr.id] ? h.campoSpr(L, x, y) : 0;
    if (L.cono) return h && h.listo ? h.campo(L, x, y) : 0;
    return this.brilloRedondo(L, x, y);
  }

  // luz de una lampara sin cono en un punto (caida redonda)
  brilloRedondo(L, x, y) {
    const d = Math.hypot(x - L.x, y - L.y) / (L.r * 0.9);
    return d >= 1 ? 0 : (1 - d) * (1 - d);
  }

  dibujar(c, t, cam, luz) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const TANDAS = 12;
    for (const g of this.grupos) {
      const L = g.L, r = g.region;
      if (r.x1 < cam.x || r.x0 > cam.x + cam.w || r.y1 < cam.y || r.y0 > cam.y + cam.h) continue;
      const f = L.fuerza(t);
      if (f < 0.04) continue;
      if (L.spr ? !(this.haces && this.haces.spr[L.spr.id]) : L.cono && !(this.haces && this.haces.listo)) continue;
      // la sombra: el poligono de visibilidad de esta luz (el mismo que usa el mapa de luz)
      const poly = luz.sombraDe({ x: L.x, y: L.y, r: L.r * 1.3, mueve: L.mueve });
      const col = color(L.color);
      const k0 = L.spr ? 2.4 : L.cono ? (L.calida ? 3.0 : 2.6) : 0.9;
      const tandas = Array.from({ length: TANDAS }, () => []);
      const bokeh = [];
      for (const m of g.motas) {
        if (m.x < cam.x - 4 || m.x > cam.x + cam.w + 4 || m.y < cam.y - 4 || m.y > cam.y + cam.h + 4) continue;
        const b = this.luzEn(L, m.x, m.y);
        if (b < 0.02) continue;
        if (poly && !dentro(poly, m.x, m.y)) continue;
        // destello: la mota gira y su cara plana refleja de golpe
        const s = Math.sin(t * m.giro + m.fase);
        const destello = s > 0.93 ? 1 + (s - 0.93) * 30 : 0.45 + 0.35 * (s * 0.5 + 0.5);
        const vida = Math.min(1, m.vida / 1.5, (m.dura - m.vida) / 1.5);
        const a = Math.min(1, b * f * destello * vida * k0 * (m.grande ? 0.25 : 1));
        if (a < 0.03) continue;
        if (m.grande) bokeh.push(m, a);
        else tandas[Math.min(TANDAS - 1, Math.floor(a * TANDAS))].push(m);
      }
      for (let k = 0; k < TANDAS; k++) {
        if (!tandas[k].length) continue;
        c.fillStyle = `rgba(${col},${((k + 0.5) / TANDAS).toFixed(3)})`;
        for (const m of tandas[k]) c.fillRect(m.x - m.tam / 2, m.y - m.tam / 2, m.tam, m.tam);
      }
      for (let k = 0; k < bokeh.length; k += 2) {
        const m = bokeh[k];
        c.fillStyle = `rgba(${col},${bokeh[k + 1].toFixed(3)})`;
        c.beginPath(); c.arc(m.x, m.y, m.tam, 0, 6.283); c.fill();
      }
    }
    c.restore();
  }
}

const cache = new Map();
function color(hex) {
  if (cache.has(hex)) return cache.get(hex);
  const n = parseInt(hex.slice(1), 16);
  // el polvo brilla algo mas blanco que la luz que lo toca
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const v = `${Math.round(r + (255 - r) * 0.35)},${Math.round(g + (255 - g) * 0.35)},${Math.round(b + (255 - b) * 0.35)}`;
  cache.set(hex, v);
  return v;
}

// punto dentro de un poligono (pares x,y en un Float32Array)
function dentro(p, x, y) {
  let d = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}
