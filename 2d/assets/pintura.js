// Pinceles de los assets: el acabado del laboratorio en ruinas (hierro oxidado, chapa remachada, cristal,
// luz calida de las lamparas contra el azul frio de la anomalia). Todo procedural y determinista; las
// unidades son las del mundo (u, 32 por casilla). Se mantiene la linea de tinta del juego.
import { hash, azar } from '../dibujo/tinta.js';

export const TINTA = '#0a090b';
export const P = {
  hierro: '#3e454e', hierroOsc: '#22262c', hierroClaro: '#8a939c',
  oxido: '#4e3324', oxidoClaro: '#6e4a34', oxidoOsc: '#2a1a12',
  laton: '#a8843f', latonClaro: '#e0bd6e',
  madera: '#5a4330', maderaOsc: '#2f2218', maderaClara: '#8a6a48',
  hormigon: '#4b4f55', hormigonOsc: '#2a2d32',
  calida: '#ffcf8a', calidaFuerte: '#ffe2b0', fria: '#9fc4e6', friaFuerte: '#d8ecff',
  papel: '#d9cfb4', vidrio: 'rgba(170,205,220,', varga: '#a9cde6', podre: '#e2792b',
};

// ---------------------------------------------------------------- ruido
const cacheRuido = new Map();
export function ruido(semilla = 1, escala = 24, octavas = 4, tam = 256) {
  const k = semilla + ':' + escala + ':' + octavas;
  if (cacheRuido.has(k)) return cacheRuido.get(k);
  const cv = document.createElement('canvas');
  cv.width = cv.height = tam;
  const c = cv.getContext('2d');
  const im = c.createImageData(tam, tam);
  const vn = (x, y, s) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const per = Math.round(tam / s);
    const h = (a, b) => hash(((a % per) + per) % per, ((b % per) + per) % per, s * 31 + semilla);
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
  };
  for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) {
    let v = 0, a = 1, f = 1, suma = 0;
    for (let o = 0; o < octavas; o++) { const s = escala / f; v += vn(x / s, y / s, s) * a; suma += a; a *= 0.5; f *= 2; }
    v /= suma;
    const g = Math.max(0, Math.min(255, v * 255));
    const i = (y * tam + x) * 4;
    im.data[i] = im.data[i + 1] = im.data[i + 2] = g; im.data[i + 3] = 255;
  }
  c.putImageData(im, 0, 0);
  cacheRuido.set(k, cv);
  return cv;
}

// Pinta ruido encima de lo que haya (con el clip puesto): modo y fuerza
export function grano(c, x, y, w, h, fuerza = 0.25, modo = 'overlay', semilla = 1, escala = 22) {
  c.save();
  c.globalCompositeOperation = modo;
  c.globalAlpha = fuerza;
  const pat = c.createPattern(ruido(semilla, escala), 'repeat');
  c.fillStyle = pat;
  c.translate(x, y);
  c.fillRect(0, 0, w, h);
  c.restore();
}

// ---------------------------------------------------------------- formas
export function camino(c, pts, cerrado = true) {
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length; k++) c.lineTo(pts[k][0], pts[k][1]);
  if (cerrado) c.closePath();
}
export function tembloroso(pts, amp = 0.8, paso = 8, semilla = 1) {
  const out = [];
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k], b = pts[(k + 1) % pts.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / paso));
    const nx = -(b[1] - a[1]) / (L || 1), ny = (b[0] - a[0]) / (L || 1);
    for (let i = 0; i < n; i++) {
      const t = i / n, d = i ? (hash(k * 97 + i, semilla) - 0.5) * 2 * amp : 0;
      out.push([a[0] + (b[0] - a[0]) * t + nx * d, a[1] + (b[1] - a[1]) * t + ny * d]);
    }
  }
  return out;
}
export const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
export function rectRedondo(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }

export function tinta(c, g = 1.8, color = TINTA) { c.lineWidth = g; c.strokeStyle = color; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }

// ---------------------------------------------------------------- materiales por pixel
// Ruido de valor en coordenadas del mundo (u), determinista
function vn(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const h = (a, b) => hash(a, b, s);
  return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
}
function fbm(x, y, s, oct = 4) { let v = 0, a = 0.5, f = 1, t = 0; for (let o = 0; o < oct; o++) { v += vn(x * f, y * f, s + o * 7) * a; t += a; a *= 0.5; f *= 2.03; } return v / t; }
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Textura de hierro viejo: mugre a dos escalas, oxido por mascara de ruido, chorretones, grano, luz
// de arriba a la izquierda y (opcional) sombreado de cilindro. Se pinta a la resolucion real (k px/u).
const cacheTex = new Map();
export function texturaMetal(w, h, k, o) {
  const { base = P.hierro, oxido = 0.5, semilla = 1, cilindro = null, madera: esMadera = false } = o;
  const clave = [w, h, k, base, oxido, semilla, cilindro, esMadera].join('|');
  if (cacheTex.has(clave)) return cacheTex.get(clave);
  const W = Math.max(1, Math.ceil(w * k)), H = Math.max(1, Math.ceil(h * k));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const im = c.createImageData(W, H), d = im.data;
  const b = hexA(base);
  const ox1 = hexA(P.oxidoOsc), ox2 = hexA(P.oxido), ox3 = hexA(P.oxidoClaro);
  for (let py = 0; py < H; py++) {
    const y = py / k, vy = y / h;
    for (let px = 0; px < W; px++) {
      const x = px / k, vx = x / w;
      // luz: arriba a la izquierda, sombra abajo
      let L = 1.12 - vy * 0.7 - vx * 0.16;
      if (cilindro === 'v') { const t = vx; L = 0.42 + 0.78 * Math.max(0, Math.sin(Math.PI * Math.pow(t, 0.75))) - vy * 0.15 + (t > 0.18 && t < 0.3 ? 0.18 : 0); }
      if (cilindro === 'h') { const t = vy; L = 0.42 + 0.8 * Math.max(0, Math.sin(Math.PI * Math.pow(t, 0.7))) + (t > 0.15 && t < 0.28 ? 0.2 : 0); }
      const g1 = fbm(x / 26, y / 26, semilla);                     // mugre grande
      const g2 = fbm(x / 6, y / 6, semilla + 3, 3);                 // detalle
      const fino = hash(px, py, semilla) - 0.5;                     // grano de pixel
      let r = b[0], g = b[1], bl = b[2];
      if (esMadera) {
        const veta = fbm(x / 40, y / 1.6, semilla + 5, 3);
        const f = 0.75 + veta * 0.5;
        r *= f; g *= f; bl *= f;
      }
      // oxido: mascara de ruido mas chorretones verticales
      const chorro = fbm(x / 1.8, y / 30, semilla + 9, 3);
      const m = sstep(0.6 - oxido * 0.12, 0.78 - oxido * 0.12, g2 * 0.5 + g1 * 0.5) * 0.85 + sstep(0.68 - oxido * 0.08, 0.84, chorro) * 0.5 * oxido;
      const mm = Math.min(0.9, m * Math.min(1, oxido * 1.2));
      if (mm > 0) {
        const tono = g2;
        const oc = tono < 0.45 ? ox1 : tono < 0.6 ? ox2 : ox3;
        r = r + (oc[0] - r) * mm; g = g + (oc[1] - g) * mm; bl = bl + (oc[2] - bl) * mm;
      }
      const sucio = 1 + (g1 - 0.5) * 0.7 + (g2 - 0.5) * 0.25 + fino * 0.14;
      r *= L * sucio; g *= L * sucio; bl *= L * sucio;
      const i = (py * W + px) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = bl; d[i + 3] = 255;
    }
  }
  c.putImageData(im, 0, 0);
  cacheTex.set(clave, cv);
  return cv;
}

const escalaDe = (c) => { const m = c.getTransform(); return Math.hypot(m.a, m.b) || 1; };

// Metal: textura por pixel dentro de la forma, desgaste claro en el filo de arriba, sombra de contacto
export function metal(c, forma, bb, o = {}) {
  const { base = P.hierro, oxido = 0.5, semilla = 1, luz = 'fria', tintaG = 1.6, brilloBorde = 0.5, cilindro = null } = o;
  const [x, y, w, h] = bb;
  const k = Math.min(8, escalaDe(c));
  forma();
  c.save();
  c.clip();
  c.drawImage(texturaMetal(w + 2, h + 2, k, { base, oxido, semilla, cilindro }), x - 1, y - 1, w + 2, h + 2);
  aranazos(c, x, y, w, h, semilla, 3 + Math.floor(w * h / 1200));
  c.restore();
  // filo de luz
  if (brilloBorde > 0) {
    c.save(); forma(); c.clip();
    c.globalCompositeOperation = 'screen';
    c.strokeStyle = luz === 'calida' ? `rgba(255,207,138,${brilloBorde})` : `rgba(160,196,230,${brilloBorde})`;
    c.lineWidth = 2.4; c.translate(0.9, 1.4); forma(); c.stroke();
    c.restore();
  }
  forma(); tinta(c, tintaG);
}

export function manchasOxido(c, x, y, w, h, fuerza, semilla) {
  const r = azar(semilla * 131 + 7);
  const n = Math.round((w * h) / 260 * fuerza) + 2;
  for (let k = 0; k < n; k++) {
    const px = x + r() * w, py = y + r() * h, rr = 2 + r() * Math.min(w, h) * 0.22;
    const g = c.createRadialGradient(px, py, 0, px, py, rr);
    const col = r() < 0.6 ? P.oxido : P.oxidoClaro;
    g.addColorStop(0, rgba(col, 0.55 * fuerza + 0.15)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.fillRect(px - rr, py - rr, rr * 2, rr * 2);
  }
  // chorretones de oxido hacia abajo
  for (let k = 0; k < Math.round(n / 3); k++) {
    const px = x + r() * w, py = y + r() * h * 0.6, L = 6 + r() * h * 0.5;
    const g = c.createLinearGradient(0, py, 0, py + L);
    g.addColorStop(0, rgba(P.oxido, 0.45 * fuerza)); g.addColorStop(1, rgba(P.oxido, 0));
    c.fillStyle = g; c.fillRect(px, py, 1.2 + r() * 2, L);
  }
}

export function aranazos(c, x, y, w, h, semilla, n) {
  const r = azar(semilla * 17 + 3);
  c.save();
  c.lineWidth = 0.6;
  for (let k = 0; k < n; k++) {
    const px = x + r() * w, py = y + r() * h, a = (r() - 0.5) * 1.2, L = 3 + r() * Math.min(18, w * 0.4);
    c.strokeStyle = r() < 0.5 ? 'rgba(220,230,240,.11)' : 'rgba(0,0,0,.3)';
    c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.cos(a) * L, py + Math.sin(a) * L); c.stroke();
  }
  c.restore();
}

export function remache(c, x, y, r = 1.6, luz = 'fria') {
  const g = c.createRadialGradient(x - r * 0.4, y - r * 0.4, 0, x, y, r);
  g.addColorStop(0, luz === 'calida' ? '#f3d6a0' : '#c9d4de'); g.addColorStop(0.6, '#5a6068'); g.addColorStop(1, '#1d2024');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
}
export function remaches(c, x0, y0, x1, y1, paso, r, luz) {
  const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / paso));
  for (let k = 0; k <= n; k++) remache(c, x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, r, luz);
}

export function madera(c, forma, bb, o = {}) {
  const { base = P.madera, semilla = 1, vetas = true, tintaG = 1.6 } = o;
  const [x, y, w, h] = bb;
  const k = Math.min(8, escalaDe(c));
  forma(); c.save(); c.clip();
  c.drawImage(texturaMetal(w + 2, h + 2, k, { base, oxido: 0.12, semilla, madera: vetas }), x - 1, y - 1, w + 2, h + 2);
  // tablas: juntas horizontales cada poco
  if (vetas && h > 20) { c.strokeStyle = 'rgba(10,6,3,.6)'; c.lineWidth = 0.9; for (let yy = y + 12; yy < y + h - 4; yy += 12 + (hash(yy | 0, semilla) * 4 | 0)) { c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy); c.stroke(); } }
  c.restore();
  forma(); tinta(c, tintaG);
}

// el despertar (dibujo/despertar.js; ?estilo=hk lo apaga): el cristal de la imagen va SIN contorno de tinta y con los
// cantos encendidos (el borde de un cilindro de cristal se ve mas, fresnel) y una franja de brillo del lado de la luz
// fria. Se lee aqui y no de despertar.js porque esto tambien se pinta en los hilos de El Linde y de la ciudad
const CRISTAL_DESPERTAR = typeof location !== 'undefined' && new URLSearchParams(location.search).get('estilo') !== 'hk';

export function vidrio(c, forma, bb, o = {}) {
  const { tinte = 'rgba(160,200,215,', a = 0.16, semilla = 1, brillo = 0.5, tintaG = 1.6 } = o;
  if (CRISTAL_DESPERTAR) return vidrioDespertar(c, forma, bb, tinte, a, brillo);
  const [x, y, w, h] = bb;
  forma(); c.save(); c.clip();
  const g = c.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, tinte + (a * 1.8) + ')'); g.addColorStop(0.3, tinte + a * 0.6 + ')'); g.addColorStop(0.7, tinte + a * 0.5 + ')'); g.addColorStop(1, tinte + (a * 2.2) + ')');
  c.fillStyle = g; c.fillRect(x, y, w, h);
  // reflejos verticales
  c.globalCompositeOperation = 'screen';
  c.fillStyle = `rgba(235,245,255,${0.35 * brillo})`;
  c.fillRect(x + w * 0.12, y + h * 0.08, w * 0.06, h * 0.84);
  c.fillStyle = `rgba(235,245,255,${0.18 * brillo})`;
  c.fillRect(x + w * 0.22, y + h * 0.1, w * 0.025, h * 0.8);
  c.fillRect(x + w * 0.8, y + h * 0.15, w * 0.04, h * 0.6);
  // suciedad abajo
  c.globalCompositeOperation = 'source-over';
  const s = c.createLinearGradient(0, y + h * 0.7, 0, y + h);
  s.addColorStop(0, 'rgba(40,50,45,0)'); s.addColorStop(1, 'rgba(40,50,45,.35)');
  c.fillStyle = s; c.fillRect(x, y, w, h);
  c.restore();
  forma(); tinta(c, tintaG);
}

function vidrioDespertar(c, forma, bb, tinte, a, brillo) {
  const [x, y, w, h] = bb;
  forma(); c.save(); c.clip();
  // velo: casi transparente en el centro y mas opaco hacia los cantos
  const g = c.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, tinte + (a * 2.6) + ')'); g.addColorStop(0.18, tinte + a * 0.7 + ')'); g.addColorStop(0.5, tinte + a * 0.35 + ')');
  g.addColorStop(0.82, tinte + a * 0.7 + ')'); g.addColorStop(1, tinte + (a * 3) + ')');
  c.fillStyle = g; c.fillRect(x, y, w, h);
  c.globalCompositeOperation = 'screen';
  // la franja de brillo (la luz fria arriba a la izquierda) y una hebra fina al lado
  const f = c.createLinearGradient(x, y, x, y + h);
  f.addColorStop(0, `rgba(225,238,255,${0.62 * brillo})`); f.addColorStop(0.6, `rgba(225,238,255,${0.42 * brillo})`); f.addColorStop(1, `rgba(225,238,255,${0.08 * brillo})`);
  c.fillStyle = f;
  c.fillRect(x + w * 0.1, y + h * 0.04, Math.max(1, w * 0.07), h * 0.9);
  c.fillRect(x + w * 0.22, y + h * 0.06, Math.max(0.6, w * 0.022), h * 0.82);
  c.fillStyle = `rgba(225,238,255,${0.16 * brillo})`; c.fillRect(x + w * 0.8, y + h * 0.12, w * 0.035, h * 0.66);
  // suciedad abajo
  c.globalCompositeOperation = 'source-over';
  const s = c.createLinearGradient(0, y + h * 0.72, 0, y + h);
  s.addColorStop(0, 'rgba(30,38,46,0)'); s.addColorStop(1, 'rgba(30,38,46,.3)');
  c.fillStyle = s; c.fillRect(x, y, w, h);
  c.restore();
  // los cantos: un hilo de luz en vez de la tinta
  forma(); c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  c.strokeStyle = `rgba(214,230,246,${0.34 + 0.4 * brillo})`; c.lineWidth = 0.9; c.stroke();
  c.restore();
}

export function brillo(c, x, y, r, color, fuerza = 0.6) {
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, fuerza)); g.addColorStop(0.4, rgba(color, fuerza * 0.35)); g.addColorStop(1, rgba(color, 0));
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  c.restore();
}

export function sombraSuelo(c, x, y, w, a = 0.45) {
  const g = c.createRadialGradient(x, y, 0, x, y, w / 2);
  g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.save(); c.translate(x, y); c.scale(1, 0.18); c.translate(-x, -y);
  c.fillStyle = g; c.fillRect(x - w / 2, y - w / 2, w, w);
  c.restore();
}

export function cadena(c, x0, y0, x1, y1, eslabon = 6, grosor = 1.6, semilla = 1, comba = 0) {
  const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(L / (eslabon * 0.8)));
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n;
    const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * comba;
    const t2 = (k + 1.5) / n;
    const xb = x0 + (x1 - x0) * t2, yb = y0 + (y1 - y0) * t2 + Math.sin(t2 * Math.PI) * comba;
    const ang = Math.atan2(yb - y, xb - x);
    c.save(); c.translate(x, y); c.rotate(ang);
    const plano = k % 2;
    c.beginPath();
    if (plano) c.ellipse(0, 0, eslabon * 0.55, eslabon * 0.32, 0, 0, 7);
    else c.rect(-eslabon * 0.55, -grosor * 0.5, eslabon * 1.1, grosor);
    c.lineWidth = grosor + 1.6; c.strokeStyle = TINTA; c.stroke();
    c.lineWidth = grosor; c.strokeStyle = hash(k, semilla) < 0.4 ? P.oxido : '#6a6f76'; c.stroke();
    if (plano) { c.lineWidth = 0.5; c.strokeStyle = 'rgba(200,215,230,.5)'; c.beginPath(); c.ellipse(0, -0.5, eslabon * 0.45, eslabon * 0.22, 0, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
    c.restore();
  }
}

export function texto(c, s, x, y, tam, color = TINTA, peso = 'bold', fuente = 'Georgia, serif') {
  c.font = `${peso} ${tam}px ${fuente}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = color; c.fillText(s, x, y);
}

// ---------------------------------------------------------------- color
export function hexA(h) { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
export function rgba(h, a) { if (h.startsWith('rgba(')) return h + a + ')'; const p = hexA(h); return `rgba(${p[0]},${p[1]},${p[2]},${a})`; }
export function mezcla(a, b, t) { const p = hexA(a), q = hexA(b); return '#' + p.map((v, i) => Math.round(v + (q[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
