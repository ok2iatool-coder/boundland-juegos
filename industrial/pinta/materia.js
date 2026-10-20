// LA MATERIA de los muros grandes: HORMIGON pintado (la chapa del taller esta hecha para hierro de cerca y en un
// muro de diez metros sus desconchones se leian como granito). Como en la imagen: masa en penumbra con manchas
// anchas y blandas, juntas de encofrado con sus berenjenos, chorretones de agua (y de oxido bajo lo de hierro), la
// mugre que sube del suelo, alguna grieta, el grano del pigmento y la luz del horizonte, que solo LAME el canto de
// arriba y el que mira al sol. Todo en px del taller; las versiones en u del mundo van en juego.js.
import { TINTA, azar, mezclar, rgba } from '../taller/dibujo/tinta.js';
import { g } from '../taller/linde/base.js';
import { CP } from './comun.js';

const LUZ = '#d9a468';
function ruido(nx, ny, sem) {
  const c = new OffscreenCanvas(Math.max(2, nx), Math.max(2, ny)), t = c.getContext('2d'), id = t.createImageData(c.width, c.height), rr = azar(sem);
  for (let i = 0; i < c.width * c.height; i++) { const v = Math.floor(62 + rr() * 116); id.data[i * 4] = v; id.data[i * 4 + 1] = v; id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
  t.putImageData(id, 0, 0); return c;
}
let GRANO = null;
function grano() {
  if (GRANO) return GRANO;
  const n = 160, c = new OffscreenCanvas(n, n), t = c.getContext('2d'), id = t.createImageData(n, n), rr = azar(901);
  for (let i = 0; i < n * n; i++) { const v = rr() < 0.5 ? 40 : 215, a = rr() < 0.35 ? Math.floor(rr() * 150) : 0; id.data[i * 4] = v; id.data[i * 4 + 1] = v * 0.96; id.data[i * 4 + 2] = v * 0.9; id.data[i * 4 + 3] = a; }
  t.putImageData(id, 0, 0); GRANO = c; return c;
}
// manchas anchas y blandas: un ruido de pocos pixeles estirado (el suavizado del lienzo hace el resto)
function manchas(ax, ay, w, h, paso, sem, a, modo = 'soft-light') {
  const nx = Math.ceil(w / paso) + 2, ny = Math.ceil(h / paso) + 2, c = ruido(nx, ny, sem);
  g.save(); g.globalCompositeOperation = modo; g.globalAlpha = a; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(c, ax - paso, ay - paso, nx * paso, ny * paso); g.restore();
}

// o: col, juntas [ancho, alto] (u), berenjenos, oxido (0-1, chorretones pardos), grietas (cuantas), luz (1 = canto
// derecho, -1 = izquierdo, 0 = ninguno), arriba (canto de arriba encendido), tinta, sucio (mugre del pie, 0-1)
export function hormigon(ax, ay, w, h, sem, o = {}) {
  if (w < 1 || h < 1) return;
  const rr = azar(sem), col = o.col || '#2f2c2a';
  g.save(); g.beginPath(); g.rect(ax, ay, w, h); g.clip();
  const gr = g.createLinearGradient(0, ay, 0, ay + h);
  gr.addColorStop(0, mezclar(col, '#7a6c5c', 0.14)); gr.addColorStop(0.55, col); gr.addColorStop(1, mezclar(col, '#110e0b', 0.3));
  g.fillStyle = gr; g.fillRect(ax, ay, w, h);
  manchas(ax, ay, w, h, 0.55 * CP, sem + 1, 0.6);
  manchas(ax, ay, w, h, 0.13 * CP, sem + 2, 0.4);
  // juntas de encofrado (cada plancha con su tono) y berenjenos
  if (o.juntas) {
    const [pw, ph] = o.juntas.map((v) => v * CP), xs = [], ys = [];
    for (let x = ax + pw * (0.3 + rr() * 0.5); x < ax + w - 8; x += pw) xs.push(x);
    for (let y = ay + ph * (0.4 + rr() * 0.4); y < ay + h - 8; y += ph) ys.push(y);
    const bx = [ax, ...xs, ax + w], by = [ay, ...ys, ay + h];
    for (let i = 0; i < bx.length - 1; i++) for (let j = 0; j < by.length - 1; j++) {
      g.fillStyle = rr() < 0.5 ? 'rgba(255,240,220,1)' : 'rgba(0,0,0,1)'; g.globalAlpha = 0.02 + rr() * 0.05; g.fillRect(bx[i], by[j], bx[i + 1] - bx[i], by[j + 1] - by[j]);
      if (o.berenjenos !== false && bx[i + 1] - bx[i] > 0.5 * CP && by[j + 1] - by[j] > 0.5 * CP) { g.globalAlpha = 0.55; g.fillStyle = '#0d0b09'; for (const fx of [0.18, 0.82]) for (const fy of [0.22, 0.78]) { g.beginPath(); g.arc(bx[i] + (bx[i + 1] - bx[i]) * fx, by[j] + (by[j + 1] - by[j]) * fy, 2.2, 0, 7); g.fill(); } }
    }
    g.globalAlpha = 1;
    for (const y of ys) { g.fillStyle = 'rgba(8,6,5,.55)'; g.fillRect(ax, y - 1, w, 2); g.fillStyle = 'rgba(214,180,140,.1)'; g.fillRect(ax, y + 1, w, 1.4); }
    for (const x of xs) { g.fillStyle = 'rgba(8,6,5,.45)'; g.fillRect(x - 0.8, ay, 1.6, h); }
  }
  // chorretones: oscuros desde arriba y desde las juntas, alguno pardo (oxido), alguno claro (cal)
  const nC = Math.max(2, w / 26);
  for (let k = 0; k < nC; k++) {
    const x = ax + rr() * w, y = ay + (rr() < 0.6 ? 0 : rr() * h * 0.6), l = (0.3 + Math.pow(rr(), 1.5) * 2.6) * CP, an = 2 + rr() * 16, z = rr();
    const c = z < (o.oxido ?? 0.12) ? [86, 58, 36] : z > 0.9 ? [150, 140, 124] : [10, 8, 6], a = z > 0.9 ? 0.07 : 0.12 + rr() * 0.26;
    const lg = g.createLinearGradient(0, y, 0, y + l); lg.addColorStop(0, `rgba(${c},${a})`); lg.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = lg; g.beginPath(); g.moveTo(x - an / 2, y); g.lineTo(x + an / 2, y); g.lineTo(x + an * 0.15, y + l); g.lineTo(x - an * 0.2, y + l); g.closePath(); g.fill();
  }
  // la mugre del pie
  if ((o.sucio ?? 1) > 0) { const s = (o.sucio ?? 1), hp = Math.min(h * 0.5, 0.7 * CP), pg = g.createLinearGradient(0, ay + h - hp, 0, ay + h); pg.addColorStop(0, 'rgba(10,8,6,0)'); pg.addColorStop(1, `rgba(10,8,6,${0.5 * s})`); g.fillStyle = pg; g.fillRect(ax, ay + h - hp, w, hp); }
  // grietas: quebradas, con el labio de luz debajo
  for (let k = 0; k < (o.grietas ?? Math.floor(w * h / (2.4 * CP * CP))); k++) {
    let x = ax + rr() * w, y = ay + rr() * h * 0.8; const pts = [[x, y]]; const dir = rr() < 0.5 ? -1 : 1;
    for (let q = 0; q < 6 + rr() * 6; q++) { x += (rr() - 0.5) * 22 + dir * 4; y += 6 + rr() * 16; pts.push([x, y]); }
    g.lineJoin = 'miter'; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.strokeStyle = 'rgba(6,5,4,.8)'; g.lineWidth = 1.6; g.stroke();
    g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0] + 1.2, p[1] + 1.2) : g.moveTo(p[0] + 1.2, p[1] + 1.2))); g.strokeStyle = 'rgba(200,170,130,.12)'; g.lineWidth = 1; g.stroke();
  }
  // desconchones en las esquinas y el canto: se ve el arido, mas oscuro
  for (let k = 0; k < w / 60; k++) {
    const x = ax + rr() * w, y = rr() < 0.5 ? ay : ay + h, s = 4 + rr() * 12; g.fillStyle = 'rgba(14,11,9,.75)'; g.beginPath();
    g.moveTo(x - s, y); g.lineTo(x - s * 0.4, y + (y === ay ? s * 0.8 : -s * 0.8)); g.lineTo(x + s * 0.7, y + (y === ay ? s * 0.5 : -s * 0.5)); g.lineTo(x + s, y); g.fill();
  }
  // el grano del pigmento
  g.save(); g.globalAlpha = 0.5; g.globalCompositeOperation = 'overlay'; g.fillStyle = g.createPattern(grano(), 'repeat'); g.fillRect(ax, ay, w, h); g.restore();
  // la luz del horizonte en el canto
  const lado = o.luz ?? 1;
  if (lado) {
    const ex = lado > 0 ? ax + w : ax, ig = g.createLinearGradient(ex, 0, ex - lado * 0.16 * CP, 0); ig.addColorStop(0, 'rgba(217,164,104,.22)'); ig.addColorStop(1, 'rgba(217,164,104,0)');
    g.fillStyle = ig; g.fillRect(lado > 0 ? ex - 0.16 * CP : ex, ay, 0.16 * CP, h);
    g.fillStyle = LUZ; g.globalAlpha = 0.8; g.fillRect(lado > 0 ? ex - 2.6 : ex, ay, 2.6, h); g.globalAlpha = 1;
    // el oxido muerde el canto encendido
    g.fillStyle = 'rgba(40,28,20,.8)'; for (let y = ay + rr() * 40; y < ay + h; y += 20 + rr() * 70) g.fillRect(lado > 0 ? ex - 3 : ex, y, 3, 3 + rr() * 12);
  }
  if (o.arriba !== false) { g.fillStyle = LUZ; g.globalAlpha = 0.55; g.fillRect(ax, ay, w, 2); g.globalAlpha = 1; }
  g.restore();
  if (o.tinta !== false) { g.strokeStyle = TINTA; g.lineWidth = 2.2; g.strokeRect(ax, ay, w, h); }
}

// el telar de un hueco recortado: dintel y jamba derecha en sombra, la izquierda y el alfeizar lamidos por la luz
// que entra de detras (x, y, w, h en px del taller: esquina de ARRIBA a la izquierda)
export function telar(x, y, w, h) {
  const s = Math.min(0.08 * CP, h * 0.12), j = Math.min(0.05 * CP, w * 0.1);
  g.fillStyle = 'rgba(12,10,8,.92)'; g.fillRect(x, y, w, s); g.fillRect(x + w - j, y, j, h);
  const sg = g.createLinearGradient(0, y + s, 0, y + s + 0.18 * CP); sg.addColorStop(0, 'rgba(12,10,8,.45)'); sg.addColorStop(1, 'rgba(12,10,8,0)'); g.fillStyle = sg; g.fillRect(x, y + s, w - j, 0.18 * CP);
  g.fillStyle = 'rgba(176,128,82,.55)'; g.fillRect(x, y + s, 2.4, h - s); g.fillRect(x, y + h - 2.2, w - j, 2.2);
  g.strokeStyle = TINTA; g.lineWidth = 2; g.strokeRect(x, y, w, h);
}
