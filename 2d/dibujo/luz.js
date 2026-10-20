// Luz con sombras. En vez de una capa negra con agujeros, un MAPA DE LUZ a un cuarto de resolucion que se
// multiplica sobre la escena:
//   luz = (ambiente x cielo + suma de las lamparas, cada una recortada por lo que ve) x oclusion
// - cada lampara ilumina solo su POLIGONO DE VISIBILIDAD: rayos a las esquinas del terreno (las lamparas
//   fijas se calculan una vez; la del 18 en cada fotograma), asi los muros, techos y columnas dan sombra;
// - la oclusion ambiental oscurece rincones y huecos estrechos (cuanta roca hay alrededor de cada casilla);
// - en exteriores, lo que queda bajo techo recibe menos cielo.
// Las rejillas y las plataformas finas dejan pasar la luz.
import { T } from '../sim/constantes.js';
import { MACIZO, HUNDE, TALLO } from '../sim/mapa.js';
import { rgba, mezclar, hex } from './tinta.js';
import { despertar } from './despertar.js';

const K = 0.25;          // resolucion del mapa de luz respecto a la pantalla
const CELDA = 256;       // cubos del indice de segmentos
const tapa = (v) => v === MACIZO || v === HUNDE || v === TALLO;

export class Luz {
  constructor(E, zona, z) {
    this.E = E; this.zona = zona; this.z = z;
    this.cv = document.createElement('canvas');
    this.cv2 = document.createElement('canvas');
    this.cache = new Map();
    this.vivas = new Map();
    this.segmentos();
    this.prepararMascaras();
  }

  // ---------------------------------------------------------------- bordes del terreno como segmentos
  segmentos() {
    const m = this.E.m, w = m.w, h = m.h;
    const sol = (i, j) => (i < 0 || i >= w ? true : j < 0 ? tapa(m.t[i]) : j >= h ? false : tapa(m.t[j * w + i]));
    const segs = [];
    // horizontales: entre (i, j-1) y (i, j), juntando tramos seguidos del mismo tipo
    for (let j = 0; j <= h; j++) {
      let a = -1, tipo = 0;
      for (let i = 0; i <= w; i++) {
        const t = i < w ? (sol(i, j - 1) !== sol(i, j) ? (sol(i, j) ? 1 : 2) : 0) : 0;
        if (t !== tipo) { if (tipo) segs.push([a * T, j * T, i * T, j * T]); a = i; tipo = t; }
      }
    }
    for (let i = 0; i <= w; i++) {
      let a = -1, tipo = 0;
      for (let j = 0; j <= h; j++) {
        const t = j < h ? (sol(i - 1, j) !== sol(i, j) ? (sol(i, j) ? 1 : 2) : 0) : 0;
        if (t !== tipo) { if (tipo) segs.push([i * T, a * T, i * T, j * T]); a = j; tipo = t; }
      }
    }
    this.segs = segs;
    this.cubos = new Map();
    segs.forEach((s, k) => {
      const x0 = Math.floor(Math.min(s[0], s[2]) / CELDA), x1 = Math.floor(Math.max(s[0], s[2]) / CELDA);
      const y0 = Math.floor(Math.min(s[1], s[3]) / CELDA), y1 = Math.floor(Math.max(s[1], s[3]) / CELDA);
      for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
        const key = cx + ',' + cy;
        if (!this.cubos.has(key)) this.cubos.set(key, []);
        this.cubos.get(key).push(k);
      }
    });
  }

  // poligono de lo que ve una luz en (x, y) hasta r
  poligono(x, y, r) {
    const vistos = new Set(), S = [];
    for (let cx = Math.floor((x - r) / CELDA); cx <= Math.floor((x + r) / CELDA); cx++)
      for (let cy = Math.floor((y - r) / CELDA); cy <= Math.floor((y + r) / CELDA); cy++) {
        const l = this.cubos.get(cx + ',' + cy); if (!l) continue;
        for (const k of l) if (!vistos.has(k)) { vistos.add(k); S.push(this.segs[k]); }
      }
    S.push([x - r, y - r, x + r, y - r], [x + r, y - r, x + r, y + r], [x + r, y + r, x - r, y + r], [x - r, y + r, x - r, y - r]);
    const ang = [];
    const mirar = (px, py) => { const a = Math.atan2(py - y, px - x); ang.push(a - 0.0004, a, a + 0.0004); };
    for (const s of S) {
      for (const [px, py] of [[s[0], s[1]], [s[2], s[3]]]) if (Math.abs(px - x) <= r + 1 && Math.abs(py - y) <= r + 1) mirar(px, py);
      // y donde el segmento entra o sale de la caja de la luz: sin esto, un techo largo y plano (sin vertices
      // cerca) quedaba visto solo por los rayos de las esquinas y la luz salia en trapecio, como un cono
      // (2026-10-17: el farol parecia una lampara)
      const dx = s[2] - s[0], dy = s[3] - s[1];
      let t0 = 0, t1 = 1, vale = true;
      for (const [p, q] of [[-dx, s[0] - (x - r)], [dx, x + r - s[0]], [-dy, s[1] - (y - r)], [dy, y + r - s[1]]]) {
        if (Math.abs(p) < 1e-9) { if (q < 0) { vale = false; break; } continue; }
        const tt = q / p;
        if (p < 0) { if (tt > t1) { vale = false; break; } if (tt > t0) t0 = tt; } else { if (tt < t0) { vale = false; break; } if (tt < t1) t1 = tt; }
      }
      if (!vale) continue;
      if (t0 > 0) mirar(s[0] + dx * t0, s[1] + dy * t0);
      if (t1 < 1) mirar(s[0] + dx * t1, s[1] + dy * t1);
    }
    const pts = [];
    for (const a of ang) {
      const dx = Math.cos(a), dy = Math.sin(a);
      let best = Infinity;
      for (const s of S) {
        const ex = s[2] - s[0], ey = s[3] - s[1];
        const den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-9) continue;
        const qx = s[0] - x, qy = s[1] - y;
        const t = (qx * ey - qy * ex) / den, u = (qx * dy - qy * dx) / den;
        if (t > 0 && u >= -1e-6 && u <= 1 + 1e-6 && t < best) best = t;
      }
      if (best < Infinity) pts.push(a, x + dx * best, y + dy * best);
    }
    const idx = []; for (let k = 0; k < pts.length; k += 3) idx.push(k);
    idx.sort((p, q) => pts[p] - pts[q]);
    const out = new Float32Array(idx.length * 2);
    idx.forEach((k, n) => { out[n * 2] = pts[k + 1]; out[n * 2 + 1] = pts[k + 2]; });
    return out;
  }

  // una luz metida en la roca (lamparas pegadas al techo) se baja hasta el aire
  alAire(x, y) {
    const m = this.E.m;
    for (let k = 0; k < 6; k++) {
      const i = Math.floor(x / T), j = Math.floor(y / T);
      if (j < 0 || j >= m.h || i < 0 || i >= m.w || !tapa(m.t[j * m.w + i])) return y;
      y = (j + 1) * T + 2;
    }
    return y;
  }

  poligonoFijo(L) {
    const key = L.x + ',' + L.y + ',' + L.r;
    let p = this.cache.get(key);
    if (!p) {
      if (this.cache.size > 300) this.cache.clear();      // por si algo la llenase de posiciones sueltas
      p = this.poligono(L.x, this.alAire(L.x, L.y), L.r); this.cache.set(key, p);
    }
    return p;
  }

  // las luces que se mueven (focos que se balancean): una sombra nueva por fotograma, que se guarda solo
  // hasta el siguiente para que el haz de polvo la reutilice
  poligonoVivo(L) {
    const key = Math.round(L.x) + ',' + Math.round(L.y) + ',' + L.r;
    let p = this.vivas.get(key);
    if (!p) { p = this.poligono(L.x, this.alAire(L.x, L.y), L.r); this.vivas.set(key, p); }
    return p;
  }

  // ---------------------------------------------------------------- oclusion y cielo (una vez por nivel)
  prepararMascaras() {
    const m = this.E.m, w = m.w, h = m.h;
    const P = 4;                         // pixeles por casilla
    const ao = document.createElement('canvas'); ao.width = w * P; ao.height = h * P;
    const c = ao.getContext('2d');
    const img = c.createImageData(w, h);
    const sol = (i, j) => (i < 0 || i >= w ? 1 : j < 0 ? (tapa(m.t[i]) ? 1 : 0) : j >= h ? 0 : tapa(m.t[j * w + i]) ? 1 : 0);
    const exterior = this.z.exterior ?? this.z.oscuro < 0.4;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let occ = 0, n = 0;
      for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
        if (!di && !dj) continue;
        const peso = 1 / (Math.abs(di) + Math.abs(dj));
        occ += sol(i + di, j + dj) * peso; n += peso;
      }
      let v = 1 - 0.55 * Math.max(0, occ / n - 0.15) / 0.85;
      // en exteriores: bajo techo (roca encima a menos de 6 casillas) hay menos cielo
      if (exterior) { let techo = 0; for (let dj = 1; dj <= 6; dj++) if (sol(i, j - dj)) { techo = 1 - (dj - 1) / 6; break; } v *= 1 - 0.45 * techo; }
      const b = Math.round(Math.max(0, Math.min(1, v)) * 255);
      const o = (j * w + i) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = b; img.data[o + 3] = 255;
    }
    const chico = document.createElement('canvas'); chico.width = w; chico.height = h;
    chico.getContext('2d').putImageData(img, 0, 0);
    c.imageSmoothingEnabled = true; c.filter = `blur(${P * 0.9}px)`;
    c.drawImage(chico, 0, 0, w * P, h * P);
    this.ao = ao; this.aoP = P;
    // ambiente: lo que queda sin lamparas (la penumbra de antes era negro al `oscuro`)
    const claro = this.z.ambiente || mezclar('#ffffff', this.z.niebla, 0.35);
    this.ambiente = escalar(claro, 1 - this.z.oscuro + 0.05);
  }

  // ---------------------------------------------------------------- dibujo
  // lista: { x, y, r, color, f, sombra: 'fija'|'viva'|false, cono }
  dibujar(ctx, W, H, s, cx, cy, vw, vh, lista, hk = null) {
    const w = Math.ceil(W * K), h = Math.ceil(H * K);
    for (const cv of [this.cv, this.cv2]) if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const c = this.cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over'; c.filter = 'none';
    c.fillStyle = this.ambiente; c.fillRect(0, 0, w, h);
    this.vivas = new Map();
    c.setTransform(s * K, 0, 0, s * K, -cx * s * K, -cy * s * K);
    c.globalCompositeOperation = 'lighter';
    for (const L of lista) {
      if (L.f < 0.02 || L.x < cx - L.r || L.x > cx + vw + L.r || L.y < cy - L.r || L.y > cy + vh + L.r) continue;
      const poly = L.sombra === 'fija' ? this.poligonoFijo(L) : L.sombra === 'viva' ? this.poligonoVivo(L) : null;
      c.save();
      if (poly && poly.length > 4) { c.beginPath(); c.moveTo(poly[0], poly[1]); for (let k = 2; k < poly.length; k += 2) c.lineTo(poly[k], poly[k + 1]); c.closePath(); c.clip(); }
      const y0 = L.cono ? L.y + L.r * 0.18 : L.y;
      const g = c.createRadialGradient(L.x, y0, 0, L.x, y0, L.r);
      // caida parecida a la de una luz de verdad: muy fuerte cerca, larga cola suave
      g.addColorStop(0, rgba(L.color, L.f)); g.addColorStop(0.12, rgba(L.color, L.f * 0.72)); g.addColorStop(0.35, rgba(L.color, L.f * 0.32));
      g.addColorStop(0.65, rgba(L.color, L.f * 0.1)); g.addColorStop(1, rgba(L.color, 0));
      if (L.cono) {
        // el tubo alumbra hacia abajo: un cono que se abre, y un poco alrededor (el techo se ve). Si la
        // lampara se balancea, el cono gira con ella alrededor de la bombilla
        c.save();
        if (L.ang) { c.translate(L.x, L.y); c.rotate(L.ang); c.translate(-L.x, -L.y); }
        // sin trapecio (sus lados rectos se veian como un limite): un ovalo de luz que cuelga de la bombilla,
        // mas ancho abajo, que se apaga solo hacia todos los lados
        const oy = L.y + L.r * 0.32;
        c.translate(L.x, oy); c.scale(0.95, 1);
        const go = c.createRadialGradient(0, -L.r * 0.22, 0, 0, 0, L.r * 0.82);
        go.addColorStop(0, rgba(L.color, L.f)); go.addColorStop(0.18, rgba(L.color, L.f * 0.62)); go.addColorStop(0.45, rgba(L.color, L.f * 0.27));
        go.addColorStop(0.75, rgba(L.color, L.f * 0.08)); go.addColorStop(1, rgba(L.color, 0));
        c.fillStyle = go; c.fillRect(-L.r, -L.r * 1.2, L.r * 2, L.r * 2.2); c.restore();
        const g2 = c.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r * 0.45);
        g2.addColorStop(0, rgba(L.color, L.f * 0.45)); g2.addColorStop(1, rgba(L.color, 0));
        c.fillStyle = g2; c.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
      } else { c.fillStyle = g; c.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2); }
      c.restore();
      // luz rasante: el contorno del poligono es justo donde la luz toca la roca; trazarlo grueso (sin
      // recortar) enciende el canto de la roca que mira a la lampara
      if (poly && poly.length > 4) {
        const yr = L.cono ? L.y + L.r * 0.18 : L.y;
        const g3 = c.createRadialGradient(L.x, yr, 0, L.x, yr, L.r * 0.8);
        g3.addColorStop(0, rgba(L.color, L.f * 0.9)); g3.addColorStop(0.4, rgba(L.color, L.f * 0.35)); g3.addColorStop(1, rgba(L.color, 0));
        c.beginPath(); c.moveTo(poly[0], poly[1]); for (let k = 2; k < poly.length; k += 2) c.lineTo(poly[k], poly[k + 1]); c.closePath();
        c.lineWidth = 9; c.lineJoin = 'round'; c.strokeStyle = g3; c.stroke();
      }
    }
    // oclusion: rincones y huecos
    c.globalCompositeOperation = 'multiply';
    c.imageSmoothingEnabled = true;
    c.drawImage(this.ao, 0, 0, this.E.m.w * T, this.E.m.h * T);
    // a lo Hollow Knight (hk): el CANTO de la roca encendido por la bruma del fondo, mas en los suelos
    if (hk) this.canto(c, cx, cy, vw, vh, hk.p.halo);
    // el despertar (dibujo/despertar.js): la luz por escalones, como el toon de la imagen (el desenfoque de abajo los ablanda)
    despertar.escalonar(this.cv);
    // sombras blandas
    const c2 = this.cv2.getContext('2d');
    c2.setTransform(1, 0, 0, 1, 0, 0); c2.globalCompositeOperation = 'copy'; c2.filter = 'blur(2px)';
    c2.drawImage(this.cv, 0, 0); c2.filter = 'none';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    // (hk: a lo Hollow Knight, la luz solo cae sobre lo de delante, que va sobre transparente: dibujo/hk.js)
    if (hk) hk.componer(ctx, this.cv2);
    else { ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(this.cv2, 0, 0, W, H); }
    // un poco de la luz sumada: el aire alrededor de una lampara brilla (las lamparas pasan de 1)
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.1 * this.z.oscuro; ctx.drawImage(this.cv2, 0, 0, W, H);
    ctx.restore();
  }

  // el canto de lo macizo que da al aire, como lo enciende el contraluz en Hollow Knight: los suelos (donde se pisa)
  // mucho, las paredes menos y los techos apenas. Sobre los segmentos de los bordes (por casillas): el mapa de luz va
  // a un cuarto de resolucion y se emborrona, asi que la banda cubre el borde temblado del terreno
  canto(c, cx, cy, vw, vh, color) {
    const m = this.E.m, sol = (i, j) => i >= 0 && i < m.w && j >= 0 && j < m.h && tapa(m.t[j * m.w + i]);
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    for (const [x0, y0, x1, y1] of this.segs) {
      if (Math.max(x0, x1) < cx - 40 || Math.min(x0, x1) > cx + vw + 40 || Math.max(y0, y1) < cy - 40 || Math.min(y0, y1) > cy + vh + 40) continue;
      let a;
      if (y0 === y1) { const i = Math.floor((x0 + x1) / 2 / T), j = y0 / T; a = sol(i, j) && !sol(i, j - 1) ? 0.5 : 0.16; }
      else a = 0.3;
      c.strokeStyle = rgba(color, a); c.lineWidth = 12;
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    }
    c.restore();
  }

  // el poligono de visibilidad de una luz (para el haz y para el polvo que ilumina)
  sombraDe(L) { return L.mueve ? this.poligonoVivo(L) : this.poligonoFijo(L); }

  // recorta al poligono de una luz fija (para los haces de polvo)
  recortar(c, L) {
    const poly = L.mueve ? this.poligonoVivo(L) : this.poligonoFijo(L);
    if (!poly || poly.length < 6) return;
    c.beginPath(); c.moveTo(poly[0], poly[1]); for (let k = 2; k < poly.length; k += 2) c.lineTo(poly[k], poly[k + 1]); c.closePath(); c.clip();
  }
}

function escalar(color, k) {
  const p = hex(color);
  const f = (v) => Math.round(Math.max(0, Math.min(255, v * k)));
  return `rgb(${f(p[0])},${f(p[1])},${f(p[2])})`;
}
