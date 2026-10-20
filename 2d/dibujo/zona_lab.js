// Lo que se ve de la zona conectada del laboratorio (sim/zona.js): los frascos de reserva (el banco), las motas de
// esencia, la luz que deja el 18 al morir, el fragmento de ampolla, la palanca y la esclusa del atajo, el suelo
// falso de la celda del 17, la anomalia que despierta el doble salto, los aranazos del 17 y la luz del corazon
// que sube por las grietas. Solo dibujo: el estado esta en E.zl.
import { T } from '../sim/constantes.js';
import { TINTA, caja, rgba, mezclar, hash } from './tinta.js';
import { dibujarAsset } from './decorado.js';
import * as A from './actores.js';

const BLANCO = '#fff4e2', FRIO = '#cfe6ff';

// detras del 18
export function dibujarDetras(c, E, t, S, s, zona) {
  const z = E.zl;
  for (const mk of E.marcas) {
    if (mk.tipo === 'aranazos') aranazos(c, mk.i * T + 16, (mk.j + 1) * T, mk.i * 7 + mk.j);
    else if (mk.tipo === 'grieta_luz') grietaLuz(c, mk.i * T + 16, (mk.j + 1) * T, t, mk.i);
  }
  for (const f of z.frascos) frasco(c, f, z, t);
  if (z.esclusa) esclusa(c, z.esclusa, t);
  if (z.palanca) palanca(c, z.palanca, t);
  for (const m of z.motas) if (!m.cogida) mota(c, m.x, m.y, t, m.fase);
  for (const f of z.fragmentos_) if (!f.cogido) fragmento(c, f.x, f.y, t);
  for (const it of E.items) if (it.tipo === 'doble' && !it.cogido) anomalia(c, it.x, it.pie, t);
  if (z.eco) eco(c, z.eco, t, S, s);
  for (const f of z.falsos) if (f.k < 1) falso(c, f, zona, 1 - f.k);
}

// delante del 18: el cristal y el liquido del frasco en el que descansa
export function dibujarDelante(c, E, t) {
  const z = E.zl;
  if (E.estado === 'banco' && z.enFrasco) {
    const f = z.enFrasco;
    dibujarAsset(c, 'frasco', f.x, f.pie + 28, 'suelo', 0, { n: nombre(f), estado: 'brilla' });
    // burbujas que suben
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,236,205,.55)';
    for (let k = 0; k < 7; k++) {
      const v = (t * (0.35 + hash(k, 3) * 0.3) + hash(k, 5)) % 1;
      c.beginPath(); c.arc(f.x - 14 + hash(k, 7) * 28, f.pie - 4 - v * 80, 1 + hash(k, 9) * 1.4, 0, 7); c.fill();
    }
    c.restore();
  }
}

// las luces que anade la zona al mapa de luz (main.js, penumbra)
export function luces(E, t) {
  const z = E.zl, L = [];
  for (const f of z.frascos) { const act = f.id === z.banco; L.push({ x: f.x, y: f.pie - 50, r: act ? 170 : 120, color: act ? '#ffd8a0' : '#bcd8e6', f: act ? 0.65 : 0.32 }); }
  for (const m of z.motas) if (!m.cogida) L.push({ x: m.x, y: m.y, r: 70, color: '#ffe9c8', f: 0.4 + 0.1 * Math.sin(t * 2 + m.fase) });
  for (const f of z.fragmentos_) if (!f.cogido) L.push({ x: f.x, y: f.y, r: 90, color: BLANCO, f: 0.5 });
  if (z.eco) L.push({ x: z.eco.x, y: z.eco.y, r: 170, color: '#fff1dc', f: 0.5 + 0.12 * Math.sin(t * 2.4) });
  if (z.esclusa) { const p = piloto(z.esclusa); L.push({ x: p.x, y: p.y, r: 70, color: z.esclusa.s.activo ? '#ff5a4a' : '#e8f4ff', f: 0.6 }); }
  return L;
}

const nombre = (f) => (f.id === 'pozo' ? 'R1' : 'R2');

// ---------------------------------------------------------------- frasco de reserva
function frasco(c, f, z, t) {
  const act = f.id === z.banco;
  dibujarAsset(c, 'frasco', f.x, f.pie + 28, 'suelo', 0, { n: nombre(f), estado: act ? 'brilla' : 'entero' });
  // el de reserva que aun no se ha usado respira frio; el que guarda la partida, calido
  c.save(); c.globalCompositeOperation = 'lighter';
  const k = 0.5 + 0.5 * Math.sin(t * 1.6 + f.x * 0.01);
  const g = c.createRadialGradient(f.x, f.pie - 50, 0, f.x, f.pie - 50, 70);
  g.addColorStop(0, act ? `rgba(255,214,160,${0.16 + 0.06 * k})` : `rgba(170,210,235,${0.06 + 0.04 * k})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(f.x - 70, f.pie - 120, 140, 140);
  c.restore();
}

// ---------------------------------------------------------------- mota de esencia: un punto de luz calida con dos que la rondan
function mota(c, x, y, t, fase) {
  const yy = y + Math.sin(t * 1.4 + fase) * 4;
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(x, yy, 0, x, yy, 18);
  g.addColorStop(0, 'rgba(255,240,215,.7)'); g.addColorStop(0.35, 'rgba(255,225,180,.22)'); g.addColorStop(1, 'rgba(255,225,180,0)');
  c.fillStyle = g; c.fillRect(x - 18, yy - 18, 36, 36);
  c.fillStyle = 'rgba(255,250,240,.95)'; c.beginPath(); c.arc(x, yy, 2.6, 0, 7); c.fill();
  for (let k = 0; k < 2; k++) {
    const a = t * (1.8 + k * 0.7) + fase + k * 3;
    c.fillStyle = 'rgba(255,240,215,.7)'; c.beginPath(); c.arc(x + Math.cos(a) * 9, yy + Math.sin(a) * 5, 1.1, 0, 7); c.fill();
  }
  c.restore();
}

// ---------------------------------------------------------------- fragmento de ampolla: una esquirla del cristal de la ampolla
function fragmento(c, x, y, t) {
  const yy = y + Math.sin(t * 1.2) * 3, a = Math.sin(t * 0.8) * 0.4;
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(x, yy, 0, x, yy, 30);
  g.addColorStop(0, 'rgba(255,246,228,.45)'); g.addColorStop(1, 'rgba(255,246,228,0)');
  c.fillStyle = g; c.fillRect(x - 30, yy - 30, 60, 60);
  c.restore();
  c.save(); c.translate(x, yy); c.rotate(a);
  c.beginPath(); c.moveTo(-5, 8); c.lineTo(-8, -2); c.lineTo(-2, -10); c.lineTo(6, -6); c.lineTo(8, 4); c.lineTo(2, 9); c.closePath();
  c.fillStyle = 'rgba(235,245,250,.35)'; c.fill();
  c.strokeStyle = TINTA; c.lineWidth = 1.6; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-5, -1); c.lineTo(-1, -7); c.stroke();
  // una gota del suero dentro
  c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(1, 2, 2, 0, 7); c.fill();
  c.restore();
}

// ---------------------------------------------------------------- la anomalia de la orilla (despierta el doble salto)
function anomalia(c, x, pie, t) {
  const yy = pie - 30 + Math.sin(t * 1.3) * 5;
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let k = 3; k > 0; k--) {
    const g = c.createRadialGradient(x, yy, 0, x, yy, 13 * k);
    g.addColorStop(0, `rgba(235,247,255,${0.45 / k})`); g.addColorStop(1, 'rgba(143,199,255,0)');
    c.fillStyle = g; c.fillRect(x - 45, yy - 45, 90, 90);
  }
  // dos alas de luz que laten (el cuerpo que pesa poco)
  c.strokeStyle = 'rgba(230,245,255,.75)'; c.lineWidth = 1.3;
  const ab = 0.5 + 0.5 * Math.sin(t * 3);
  for (const sx of [-1, 1]) {
    c.beginPath(); c.moveTo(x, yy);
    c.quadraticCurveTo(x + sx * 14, yy - 14 - ab * 4, x + sx * 22, yy - 4);
    c.quadraticCurveTo(x + sx * 12, yy - 2, x, yy + 2);
    c.stroke();
  }
  for (let k = 0; k < 6; k++) {
    const a = t * 0.9 + k * 1.05, r = 16 + Math.sin(t * 1.7 + k) * 4;
    c.fillStyle = 'rgba(220,240,255,.8)'; c.beginPath(); c.arc(x + Math.cos(a) * r, yy + Math.sin(a) * r * 0.6, 1, 0, 7); c.fill();
  }
  c.restore();
}

// ---------------------------------------------------------------- la luz que se queda donde murio: el 18 hecho de luz
function eco(c, e, t, S, s) {
  const pie = e.y + 25, x = e.x;
  c.save(); c.globalCompositeOperation = 'lighter';
  const late = 0.75 + 0.25 * Math.sin(t * 2.4);
  const g = c.createRadialGradient(x, e.y, 0, x, e.y, 60);
  g.addColorStop(0, `rgba(255,241,220,${0.32 * late})`); g.addColorStop(1, 'rgba(255,241,220,0)');
  c.fillStyle = g; c.fillRect(x - 60, e.y - 60, 120, 120);
  c.restore();
  if (S) {
    c.save(); c.globalCompositeOperation = 'lighter'; c.filter = 'brightness(1.6) blur(0.6px)';
    const f = A.fotograma(S, 'reposo', t, { vx: 0, vy: 0, enSuelo: true });
    A.dibujarSprite(c, S, f.anim, f.i, x, pie + Math.sin(t * 1.5) * 2, 1, s, 0.38 * late, false);
    c.restore();
  }
  // motas que se escapan hacia arriba
  c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,240,215,.75)';
  for (let k = 0; k < 7; k++) {
    const v = (t * (0.25 + hash(k, 1) * 0.2) + hash(k, 2)) % 1;
    c.globalAlpha = Math.sin(v * Math.PI);
    c.beginPath(); c.arc(x - 14 + hash(k, 3) * 28 + Math.sin(t + k) * 3, pie - 10 - v * 70, 1.2, 0, 7); c.fill();
  }
  c.restore();
}

// ---------------------------------------------------------------- la esclusa del atajo: compuerta de acero que sube
function piloto(es) { return { x: es.s.x - 12, y: es.s.y - 20 }; }
function esclusa(c, es, t) {
  const s = es.s, a = es.abre;
  // marco
  caja(c, s.x - 6, s.y - 10, s.w + 12, 10, '#4b525a', 3, 0.5, 2);
  // la hoja: sube dentro del techo
  c.save(); c.beginPath(); c.rect(s.x, s.y, s.w, s.h); c.clip();
  const y0 = s.y - s.h * a;
  caja(c, s.x + 2, y0, s.w - 4, s.h, '#58616a', 7, 0.4, 2.2);
  c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 1.2;
  for (let k = 1; k < 6; k++) { c.beginPath(); c.moveTo(s.x + 4, y0 + k * s.h / 6); c.lineTo(s.x + s.w - 4, y0 + k * s.h / 6); c.stroke(); }
  // franjas de peligro abajo (palidas: el naranja es solo de la Podredumbre)
  for (let k = 0; k < 6; k++) { c.fillStyle = k % 2 ? '#1a1a1c' : '#c9bf8a'; c.beginPath(); const x = s.x + 2 + k * (s.w - 4) / 6; c.moveTo(x, y0 + s.h - 10); c.lineTo(x + (s.w - 4) / 6, y0 + s.h - 10); c.lineTo(x + (s.w - 4) / 6 - 4, y0 + s.h - 2); c.lineTo(x - 4, y0 + s.h - 2); c.fill(); }
  // ojo de buey
  c.beginPath(); c.arc(s.x + s.w / 2, y0 + s.h * 0.32, 7, 0, 7); c.fillStyle = 'rgba(160,190,210,.25)'; c.fill(); c.strokeStyle = TINTA; c.lineWidth = 2; c.stroke();
  c.restore();
  // el piloto (del lado del pozo): rojo cerrada, blanco abierta
  const p = piloto(es);
  caja(c, p.x - 6, p.y - 6, 12, 12, '#3a4047', 4, 0.4, 1.6);
  c.save(); c.globalCompositeOperation = 'lighter';
  const col = s.activo ? [255, 90, 74] : [232, 244, 255];
  const parp = s.activo ? 0.7 + 0.3 * Math.sin(t * 4) : 1;
  const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 16);
  g.addColorStop(0, `rgba(${col},${0.9 * parp})`); g.addColorStop(1, `rgba(${col},0)`);
  c.fillStyle = g; c.fillRect(p.x - 16, p.y - 16, 32, 32);
  c.restore();
}

// ---------------------------------------------------------------- la palanca de la esclusa (en la camara fria)
function palanca(c, pa, t) {
  const x = pa.x, y = pa.pie - 40;
  caja(c, x - 9, y - 4, 18, 26, '#4b525a', 9, 0.4, 2);
  const ang = pa.tirada ? 0.9 : -0.9;
  c.save(); c.translate(x, y + 8); c.rotate(ang);
  c.strokeStyle = TINTA; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -22); c.stroke();
  c.strokeStyle = '#8a9096'; c.lineWidth = 2.6; c.stroke();
  c.fillStyle = pa.tirada ? '#e8f0f4' : '#b8443a'; c.beginPath(); c.arc(0, -23, 4.5, 0, 7); c.fill(); c.strokeStyle = TINTA; c.lineWidth = 1.6; c.stroke();
  c.restore();
}

// ---------------------------------------------------------------- el suelo falso: roca pintada que se desvanece al ceder
// las mismas piedras apiladas del borde del terreno (y su linea de tinta encima), para que no se distinga del suelo
function falso(c, f, zona, a) {
  c.save(); c.globalAlpha = a;
  c.fillStyle = zona.masa; c.fillRect(f.x - 2, f.y, f.w + 4, f.h);
  const claro = mezclar(zona.masaClara, zona.borde || '#9aa', 0.18), osc = mezclar(zona.masa, '#000', 0.3);
  for (let fila = 0; fila < 3; fila++) {
    const r = 9 - fila * 2, y = f.y + 6 + fila * 9;
    for (let x = f.x - 2 + (fila % 2) * r; x < f.x + f.w + 2; x += r * 2 + 1) {
      const rx = r + hash(x, y) * 2, ry = r * 0.62;
      c.beginPath(); c.ellipse(x + rx, y, rx, ry, (hash(y, x) - 0.5) * 0.4, 0, 7);
      c.fillStyle = fila === 0 ? claro : mezclar(claro, zona.masa, 0.3 + fila * 0.25); c.fill();
      c.strokeStyle = osc; c.lineWidth = 1.4; c.stroke();
    }
  }
  // la mata de grumos y la linea de tinta del suelo
  c.fillStyle = mezclar(zona.masaClara, '#5a606a', 0.5);
  for (let x = f.x; x < f.x + f.w; x += 7) { c.beginPath(); c.arc(x + 3, f.y - 1, 3 + hash(x, 9) * 2.5, Math.PI, 0); c.fill(); }
  c.strokeStyle = TINTA; c.lineWidth = 2.2; c.beginPath(); c.moveTo(f.x - 2, f.y); c.lineTo(f.x + f.w + 2, f.y); c.stroke();
  c.restore();
}

// ---------------------------------------------------------------- los aranazos del 17: palotes en la pared, como quien cuenta dias
function aranazos(c, x, pie, sem) {
  c.save();
  c.strokeStyle = 'rgba(220,226,232,.42)'; c.lineWidth = 1.1; c.lineCap = 'round';
  const y = pie - 46;
  for (let g = 0; g < 3; g++) {
    const gx = x - 18 + g * 15 + hash(g, sem) * 3, gy = y + hash(g, sem + 1) * 8;
    for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(gx + k * 2.6, gy); c.lineTo(gx + k * 2.6 + 1, gy + 13); c.stroke(); }
    c.beginPath(); c.moveTo(gx - 2, gy + 10); c.lineTo(gx + 11, gy + 3); c.stroke();
  }
  c.restore();
}

// ---------------------------------------------------------------- la luz del corazon que sube por las grietas del suelo
function grietaLuz(c, x, pie, t, sem) {
  c.save(); c.globalCompositeOperation = 'lighter';
  const k = 0.6 + 0.4 * Math.sin(t * 1.3 + sem);
  const g = c.createRadialGradient(x, pie, 0, x, pie, 70);
  g.addColorStop(0, `rgba(170,215,255,${0.28 * k})`); g.addColorStop(1, 'rgba(170,215,255,0)');
  c.fillStyle = g; c.fillRect(x - 70, pie - 70, 140, 70);
  c.strokeStyle = `rgba(225,242,255,${0.7 * k})`; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(x - 30, pie); c.lineTo(x - 12, pie - 2); c.lineTo(x - 4, pie + 1); c.lineTo(x + 10, pie - 3); c.lineTo(x + 28, pie); c.stroke();
  c.restore();
}

export { FRIO };
