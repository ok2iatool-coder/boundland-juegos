// EL MAPA A CARBONCILLO (zona conectada del laboratorio, tecla M). El 18 se sienta y dibuja en una hoja: solo lo
// que ha visto (sim/zona.js, E.zl.visto, celdas de 2 x 2 casillas), con el trazo tembloroso y el sombreado de un
// carboncillo. El dibujo entero de la zona se pinta UNA vez en un lienzo (los bordes de la roca, rayado por dentro,
// el difuminado) y luego cada vez se recorta con una mascara de lo visto, de bordes blandos.
// Marcas: los frascos de reserva (el que guarda, encendido), la luz perdida, las notas leidas y el 18.
import { T } from '../sim/constantes.js';
import { SALAS, AREAS, ANCHO, ALTO } from '../sim/zona_lab.js';
import { CELDA, VW, VH, vistoDeSala } from '../sim/zona.js';
import { hash } from './tinta.js';
import { LETRA, SERIF } from '../hud.js';

const K = 4;                        // px por casilla en el lienzo del dibujo
const PAPEL = '#e7dcc4', CARBON = '#2a2622';

export class MapaCarbon {
  constructor() { this.dibujo = null; this.mascara = null; this.vistoSig = ''; }

  // el dibujo de toda la zona, una vez
  preparar(E) {
    if (this.dibujo && this.dibujo.E === E.nivel) return;
    const m = E.m, W = ANCHO * K, H = ALTO * K;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    const duro = (i, j) => { if (i < 0 || j < 0 || i >= m.w || j >= m.h) return true; const v = m.t[j * m.w + i]; return v === 1 || v === 6; };
    // rayado del carboncillo dentro de la roca, solo cerca de los bordes (lo hondo queda en blanco)
    c.lineCap = 'round';
    for (let j = 0; j < m.h; j++) for (let i = 0; i < m.w; i++) {
      if (!duro(i, j)) continue;
      let cerca = false;
      for (let dj = -2; dj <= 2 && !cerca; dj++) for (let di = -2; di <= 2; di++) if (!duro(i + di, j + dj)) { cerca = true; break; }
      if (!cerca) continue;
      c.strokeStyle = `rgba(42,38,34,${0.3 + hash(i, j) * 0.18})`; c.lineWidth = 1.1;
      const x = i * K, y = j * K;
      c.beginPath(); c.moveTo(x, y + K); c.lineTo(x + K, y); c.moveTo(x + K * 0.5, y + K); c.lineTo(x + K, y + K * 0.5); c.stroke();
    }
    // los bordes roca/aire, temblando, en dos pasadas
    for (let pas = 0; pas < 2; pas++) {
      c.strokeStyle = pas ? 'rgba(42,38,34,.6)' : 'rgba(30,27,24,.95)'; c.lineWidth = pas ? 1.2 : 2.3;
      c.beginPath();
      for (let j = 0; j <= m.h; j++) for (let i = 0; i <= m.w; i++) {
        const tb = (k) => (hash(i * 3 + pas, j * 5 + k) - 0.5) * 1.3;
        if (i < m.w && duro(i, j - 1) !== duro(i, j)) { c.moveTo(i * K + tb(1), j * K + tb(2)); c.lineTo((i + 1) * K + tb(3), j * K + tb(4)); }
        if (j < m.h && duro(i - 1, j) !== duro(i, j)) { c.moveTo(i * K + tb(5), j * K + tb(6)); c.lineTo(i * K + tb(7), (j + 1) * K + tb(8)); }
      }
      c.stroke();
    }
    // plataformas de paso, cuerdas, barrotes y cristal: rayas finas
    for (let j = 0; j < m.h; j++) for (let i = 0; i < m.w; i++) {
      const v = m.t[j * m.w + i], x = i * K, y = j * K;
      if (v === 2) { c.strokeStyle = 'rgba(42,38,34,.7)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y + 0.5); c.lineTo(x + K, y + 0.5); c.stroke(); }
      else if (v === 4) { c.strokeStyle = 'rgba(42,38,34,.5)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x + K / 2, y); c.lineTo(x + K / 2, y + K); c.stroke(); }
      else if (v === 3) { c.fillStyle = 'rgba(42,38,34,.6)'; c.beginPath(); c.moveTo(x, y + K); c.lineTo(x + K / 2, y + 1); c.lineTo(x + K, y + K); c.fill(); }
    }
    // difuminado: el dedo que pasa por encima
    const d2 = document.createElement('canvas'); d2.width = W; d2.height = H;
    const c2 = d2.getContext('2d');
    c2.filter = 'blur(1.2px)'; c2.globalAlpha = 0.5; c2.drawImage(cv, 0, 0);
    c2.filter = 'none'; c2.globalAlpha = 1; c2.drawImage(cv, 0, 0);
    this.dibujo = { cv: d2, E: E.nivel };
    this.mascara = document.createElement('canvas'); this.mascara.width = W; this.mascara.height = H;
    this.vistoSig = '';
  }

  // la mascara de lo visto, rehecha solo si ha cambiado
  rehacerMascara(z) {
    let n = 0; for (let k = 0; k < z.visto.length; k++) n += z.visto[k];
    const sig = n + ':' + z.visto.length;
    if (sig === this.vistoSig) return;
    this.vistoSig = sig;
    const c = this.mascara.getContext('2d');
    c.clearRect(0, 0, this.mascara.width, this.mascara.height);
    c.filter = `blur(${K * 0.9}px)`;
    c.fillStyle = '#000';
    const L = CELDA * K;
    for (let j = 0; j < VH; j++) for (let i = 0; i < VW; i++) if (z.visto[j * VW + i]) c.fillRect(i * L - 1, j * L - 1, L + 2, L + 2);
    c.filter = 'none';
  }

  // k: 0..1 (abriendose)
  dibujar(c, W, H, u, E, t, leng, k, S, notasLeidas) {
    this.preparar(E);
    const z = E.zl;
    this.rehacerMascara(z);
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = `rgba(4,5,8,${0.72 * k})`; c.fillRect(0, 0, W, H);
    // la hoja del cuaderno
    const hw = Math.min(W - 60 * u, H * 1.9), hh = hw * 0.56;
    const hx = (W - hw) / 2, hy = (H - hh) / 2 + (1 - k) * 40 * u;
    c.globalAlpha = k;
    c.save(); c.translate(hx + hw / 2, hy + hh / 2); c.rotate(-0.008); c.translate(-hx - hw / 2, -hy - hh / 2);
    c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 24 * u;
    c.fillStyle = PAPEL; c.fillRect(hx, hy, hw, hh);
    c.shadowBlur = 0;
    // grano del papel y el borde azul palido de Varga
    for (let q = 0; q < 220; q++) { c.fillStyle = `rgba(90,70,40,${0.04 + hash(q, 1) * 0.05})`; c.fillRect(hx + hash(q, 2) * hw, hy + hash(q, 3) * hh, 1.5 * u, 1.5 * u); }
    c.strokeStyle = 'rgba(169,205,230,.75)'; c.lineWidth = 2 * u; c.strokeRect(hx + 8 * u, hy + 8 * u, hw - 16 * u, hh - 16 * u);
    // el dibujo, recortado por lo visto
    const m = 30 * u, ex = hx + m, ey = hy + m + 18 * u, ew = hw - 2 * m, eh = hh - 2 * m - 26 * u;
    const esc = Math.min(ew / (ANCHO * K), eh / (ALTO * K));
    const dw = ANCHO * K * esc, dh = ALTO * K * esc, dx = ex + (ew - dw) / 2, dy = ey + (eh - dh) / 2;
    const tmp = this.tmp || (this.tmp = document.createElement('canvas'));
    if (tmp.width !== this.mascara.width) { tmp.width = this.mascara.width; tmp.height = this.mascara.height; }
    const ct = tmp.getContext('2d');
    ct.globalCompositeOperation = 'source-over'; ct.clearRect(0, 0, tmp.width, tmp.height);
    ct.drawImage(this.mascara, 0, 0);
    ct.globalCompositeOperation = 'source-in'; ct.drawImage(this.dibujo.cv, 0, 0);
    ct.globalCompositeOperation = 'source-over';
    c.drawImage(tmp, dx, dy, dw, dh);
    const X = (wx) => dx + (wx / T) * K * esc, Y = (wy) => dy + (wy / T) * K * esc;
    // los nombres de las salas que ya ha visto bastante, a mano
    c.fillStyle = 'rgba(42,38,34,.75)'; c.textAlign = 'center';
    c.font = `${Math.max(9, 10.5 * u)}px ${LETRA}`;
    for (const s of SALAS) {
      if (vistoDeSala(z, s) < 0.35) continue;
      c.fillText(leng === 'es' ? s.es : s.en, X((s.x + s.w / 2) * T), Y((s.y + 1.4) * T) + 9 * u);
    }
    // los frascos de reserva (y el que guarda, con su luz), la luz perdida y el 18
    const visto = (x, y) => { const i = Math.floor(x / T / CELDA), j = Math.floor(y / T / CELDA); return z.visto[j * VW + i]; };
    for (const f of z.frascos) {
      if (!visto(f.x, f.pie - 20)) continue;
      const x = X(f.x), y = Y(f.pie);
      if (f.id === z.banco) { const g = c.createRadialGradient(x, y - 6 * u, 0, x, y - 6 * u, 16 * u); g.addColorStop(0, 'rgba(255,200,120,.55)'); g.addColorStop(1, 'rgba(255,200,120,0)'); c.fillStyle = g; c.fillRect(x - 16 * u, y - 22 * u, 32 * u, 32 * u); }
      c.strokeStyle = CARBON; c.lineWidth = 1.4 * u; c.strokeRect(x - 3.5 * u, y - 12 * u, 7 * u, 11 * u);
      c.beginPath(); c.moveTo(x - 5 * u, y - 12 * u); c.lineTo(x + 5 * u, y - 12 * u); c.stroke();
    }
    if (z.eco) {
      const x = X(z.eco.x), y = Y(z.eco.y), late = 0.6 + 0.4 * Math.sin(t * 3);
      const g = c.createRadialGradient(x, y, 0, x, y, 14 * u); g.addColorStop(0, `rgba(255,236,200,${0.9 * late})`); g.addColorStop(1, 'rgba(255,236,200,0)');
      c.fillStyle = g; c.fillRect(x - 14 * u, y - 14 * u, 28 * u, 28 * u);
      c.strokeStyle = CARBON; c.lineWidth = 1 * u; c.beginPath(); c.arc(x, y, 5 * u, 0, 7); c.stroke();
    }
    for (const n of E.notas) {
      if (!notasLeidas.has(n.n) || !visto(n.x, n.pie - 20)) continue;
      const x = X(n.x), y = Y(n.pie);
      c.save(); c.translate(x, y - 6 * u); c.rotate(-0.15);
      c.fillStyle = '#f4ecda'; c.fillRect(-4 * u, -5 * u, 8 * u, 10 * u); c.strokeStyle = 'rgba(169,205,230,.95)'; c.lineWidth = 1 * u; c.strokeRect(-4 * u, -5 * u, 8 * u, 10 * u);
      c.restore();
    }
    // el 18: un circulo dibujado a mano (el gesto de Varga), con el punto dentro
    const p = E.p, px = X(p.x + p.w / 2), py = Y(p.y + p.h / 2);
    c.strokeStyle = CARBON; c.lineWidth = 1.6 * u;
    c.beginPath(); c.arc(px, py, (7 + Math.sin(t * 3) * 0.8) * u, 0.4, Math.PI * 2 + 0.1); c.stroke();
    c.fillStyle = CARBON; c.beginPath(); c.arc(px, py, 2 * u, 0, 7); c.fill();
    // titulo y leyenda, con la letra de las notas
    c.fillStyle = 'rgba(42,38,34,.85)'; c.textAlign = 'left';
    c.font = `${Math.max(12, 18 * u)}px ${LETRA}`;
    const area = z.area ? AREAS[z.area][leng === 'es' ? 'es' : 'en'] : '';
    c.fillText((leng === 'es' ? 'Laboratorio Ceniza' : 'Ceniza Laboratory') + (area ? ' · ' + area : ''), hx + 26 * u, hy + 36 * u);
    c.textAlign = 'right'; c.font = `${Math.max(9, 11 * u)}px ${SERIF}`; c.fillStyle = 'rgba(42,38,34,.6)';
    c.fillText(leng === 'es' ? 'M / Esc  cerrar' : 'M / Esc  close', hx + hw - 26 * u, hy + hh - 18 * u);
    c.restore();
    c.restore();
  }
}
