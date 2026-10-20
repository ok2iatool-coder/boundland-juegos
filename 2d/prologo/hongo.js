// PELO Y TALLOS DEL HONGO para las bestias y el gigante del prologo. Antes los tallos eran una raya de color con una
// bolita en la punta y de lejos parecian pelos sueltos; ahora:
//   mechon()      pelo APELMAZADO: una lengua curva que se afina hasta la punta. Se anade al camino en curso, para
//                 rellenar y entintar cien de una vez
//   talloHongo()  el tallo de la Podredumbre: sale de un bulto en la piel con hifas que se meten en la carne, se afina,
//                 se curva mas hacia la punta, lleva anillos y una raya de luz, y acaba en una bola translucida con
//                 el nucleo encendido y manchas. Devuelve la punta (donde pone su luz `emisivos`)
import { TINTA } from '../dibujo/tinta.js';
import { COLOR } from '../dibujo/paletas.js';

// (x, y) la raiz, ang hacia donde cae, largo, ancho en la raiz, curva: lo que gira hasta la punta; onda: lo que
// ondula (crece hacia la punta) y fase: por donde va la onda (moverla en el tiempo la hace correr pelo abajo)
export function mechon(c, x, y, ang, largo, ancho, curva = 0, n = 5, onda = 0, fase = 0) {
  const izq = [], der = [];
  let px = x, py = y;
  for (let i = 0; i <= n; i++) {
    const f = i / n, w = ancho * 0.5 * (1 - f) ** 0.75 * (i === 0 ? 0.8 : 1);
    const a = ang + curva * f + onda * f * Math.sin(f * Math.PI * 2 + fase);
    const nx = -Math.sin(a), ny = Math.cos(a);
    izq.push([px + nx * w, py + ny * w]); der.push([px - nx * w, py - ny * w]);
    px += Math.cos(a) * largo / n; py += Math.sin(a) * largo / n;
  }
  c.moveTo(der[0][0], der[0][1]); c.lineTo(izq[0][0], izq[0][1]);
  for (let i = 1; i <= n; i++) { const m = izq[i - 1], q = izq[i]; c.quadraticCurveTo(m[0], m[1], (m[0] + q[0]) / 2, (m[1] + q[1]) / 2); }
  c.lineTo(izq[n][0], izq[n][1]);
  for (let i = n - 1; i >= 0; i--) { const m = der[i + 1], q = der[i]; c.quadraticCurveTo(m[0], m[1], (m[0] + q[0]) / 2, (m[1] + q[1]) / 2); }
  c.closePath();
}

// o: { piel, tallo, bola, nucleo, tinta, hifas, luz }   (colores; tinta el grosor del contorno)
export function talloHongo(c, x, y, ang, largo, grosor, curva, o = {}) {
  const n = 8, izq = [], der = [], eje = [];
  let a = ang, px = x, py = y;
  for (let i = 0; i <= n; i++) {
    const f = i / n, w = grosor * (0.55 + 1.15 * (1 - f) ** 2.2) * 0.5;
    const nx = -Math.sin(a), ny = Math.cos(a);
    eje.push([px, py, a]); izq.push([px + nx * w, py + ny * w]); der.push([px - nx * w, py - ny * w]);
    px += Math.cos(a) * largo / n; py += Math.sin(a) * largo / n; a += curva * (0.4 + 1.6 * f) / n;   // se dobla mas arriba
  }
  const tin = o.tinta ?? 2;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  // las hifas: raicillas naranjas que se meten en la piel alrededor del bulto
  if (o.hifas !== false) {
    c.strokeStyle = o.hifas || 'rgba(226,121,43,.42)'; c.lineWidth = Math.max(0.8, grosor * 0.16);
    c.beginPath();
    for (let k = 0; k < 4; k++) {
      const b = ang + Math.PI + (k - 1.5) * 0.55, l = grosor * (1.6 + (k % 2) * 0.9);
      const x1 = x + Math.cos(b) * l, y1 = y + Math.sin(b) * l;
      c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(b + 0.4) * l * 0.5, y + Math.sin(b + 0.4) * l * 0.5, x1, y1);
      c.moveTo(x + (x1 - x) * 0.6, y + (y1 - y) * 0.6); c.lineTo(x1 + Math.cos(b - 0.7) * l * 0.35, y1 + Math.sin(b - 0.7) * l * 0.35);
    }
    c.stroke();
  }
  // el bulto de la raiz
  c.beginPath(); c.ellipse(x, y, grosor * 1.25, grosor * 0.8, ang + Math.PI / 2, 0, 7);
  c.fillStyle = o.piel || '#241e1a'; c.fill(); c.strokeStyle = TINTA; c.lineWidth = tin * 0.8; c.stroke();
  // el tallo
  c.beginPath(); c.moveTo(izq[0][0], izq[0][1]);
  for (let i = 1; i <= n; i++) c.lineTo(izq[i][0], izq[i][1]);
  for (let i = n; i >= 0; i--) c.lineTo(der[i][0], der[i][1]);
  c.closePath();
  c.fillStyle = o.tallo || COLOR.podreOsc; c.fill(); c.strokeStyle = TINTA; c.lineWidth = tin; c.stroke();
  // la raya de luz por un lado y los anillos
  c.beginPath(); c.moveTo((izq[1][0] + eje[1][0]) / 2, (izq[1][1] + eje[1][1]) / 2);
  for (let i = 2; i < n; i++) c.lineTo((izq[i][0] * 2 + eje[i][0]) / 3, (izq[i][1] * 2 + eje[i][1]) / 3);
  c.strokeStyle = o.luz || 'rgba(240,150,80,.55)'; c.lineWidth = Math.max(0.7, grosor * 0.18); c.stroke();
  c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = Math.max(0.6, grosor * 0.12); c.beginPath();
  for (const i of [2, 4, 6]) { c.moveTo(izq[i][0], izq[i][1]); c.quadraticCurveTo(eje[i][0] + Math.cos(eje[i][2]) * grosor * 0.25, eje[i][1] + Math.sin(eje[i][2]) * grosor * 0.25, der[i][0], der[i][1]); }
  c.stroke();
  // la bola de la punta: una cebolla translucida (ancha abajo, con piquito), el nucleo encendido y venas
  const [tx, ty, ta] = eje[n], R = grosor * 1.1, ux = Math.cos(ta), uy = Math.sin(ta), vx = -uy, vy = ux;
  const bx = tx + ux * R * 0.8, by = ty + uy * R * 0.8;
  const P = (u, v) => [bx + ux * u * R + vx * v * R, by + uy * u * R + vy * v * R];
  const forma = [P(-0.9, 0), P(-0.6, 0.85), P(0.25, 1.0), P(0.9, 0.45), P(1.45, 0), P(0.9, -0.45), P(0.25, -1.0), P(-0.6, -0.85)];
  c.beginPath(); c.moveTo((forma[0][0] + forma[1][0]) / 2, (forma[0][1] + forma[1][1]) / 2);
  for (let i = 1; i <= forma.length; i++) { const p = forma[i % forma.length], q = forma[(i + 1) % forma.length]; c.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
  c.closePath();
  const g = c.createRadialGradient(bx, by, 0, bx, by, R * 1.3);
  g.addColorStop(0, o.nucleo || '#ffd9a8'); g.addColorStop(0.4, o.bola || '#f0a467'); g.addColorStop(1, o.borde || '#9a4a1c');
  c.fillStyle = g; c.fill(); c.strokeStyle = TINTA; c.lineWidth = tin * 0.8; c.stroke();
  // las venas de la cebolla, del tallo a la punta
  c.strokeStyle = 'rgba(90,34,10,.5)'; c.lineWidth = Math.max(0.5, grosor * 0.1); c.beginPath();
  for (const v of [-0.5, 0, 0.5]) { const a0 = P(-0.75, v * 0.9), m = P(0.3, v * 1.15), a1 = P(1.25, v * 0.15); c.moveTo(a0[0], a0[1]); c.quadraticCurveTo(m[0], m[1], a1[0], a1[1]); }
  c.stroke();
  c.restore();
  return [bx, by, R];
}
