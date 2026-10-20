// Los tornillos que caen del techo y los dos gigantes de la trampa del nivel 4, con el pintor de metal de
// los assets (textura de hierro viejo, oxido, filo de luz) en vez de cuatro rectangulos: cabeza hexagonal con
// sus tres caras y el chaflan, arandela, cana con la ROSCA en el perfil (dientes de sierra en los dos cantos
// y las crestas en diagonal por delante) y la punta. Cada tornillo se pinta UNA vez en un lienzo y luego
// solo se gira y se coloca.
import { metal, P, tinta, rgba } from '../assets/pintura.js';

const cache = new Map();

// hexagono visto de lado: tres caras (la del centro mira a la camara) con chaflan arriba y abajo
function cabeza(c, x0, y0, w, h, semilla, oxido) {
  const q = w / 4, ch = Math.min(1.6, h * 0.22);
  const cara = (a, b, base, brillo) => metal(c, () => {
    c.beginPath(); c.moveTo(a + (a === x0 ? ch : 0), y0); c.lineTo(b - (b === x0 + w ? ch : 0), y0);
    c.lineTo(b, y0 + ch); c.lineTo(b, y0 + h - ch); c.lineTo(b - (b === x0 + w ? ch : 0), y0 + h);
    c.lineTo(a + (a === x0 ? ch : 0), y0 + h); c.lineTo(a, y0 + h - ch); c.lineTo(a, y0 + ch); c.closePath();
  }, [a, y0, b - a, h], { semilla, base, oxido, brilloBorde: brillo, tintaG: Math.min(2.6, Math.max(1, w * 0.07)) });
  cara(x0, x0 + q, '#4d555d', 0.15);
  cara(x0 + 3 * q, x0 + w, '#3c434a', 0.1);
  cara(x0 + q, x0 + 3 * q, '#6f7880', 0.45);
}

// la cana con la rosca: el perfil en dientes de sierra y las crestas por delante
function cana(c, x0, y0, w, h, paso, semilla, oxido, punta) {
  const diente = Math.max(0.6, paso * 0.32);
  const perfil = () => {
    c.beginPath();
    c.moveTo(x0, y0);
    for (let y = y0; y < y0 + h - punta; y += paso) { c.lineTo(x0 - diente, y + paso * 0.5); c.lineTo(x0, y + paso); }
    c.lineTo(x0 + w * 0.5, y0 + h);
    for (let y = y0 + h - punta; y > y0; y -= paso) { c.lineTo(x0 + w, y); c.lineTo(x0 + w + diente, y - paso * 0.5); }
    c.lineTo(x0 + w, y0); c.closePath();
  };
  metal(c, perfil, [x0 - diente, y0, w + 2 * diente, h], { semilla, oxido, cilindro: 'v', brilloBorde: 0.25, tintaG: Math.min(2.6, Math.max(1, w * 0.09)) });
  // crestas: una sombra y un brillo por cada vuelta, en diagonal (la helice vista de frente)
  c.save(); perfil(); c.clip();
  const sesgo = paso * 0.55;
  for (let y = y0 + paso * 0.4; y < y0 + h - punta * 0.4; y += paso) {
    c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = Math.max(0.5, paso * 0.28);
    c.beginPath(); c.moveTo(x0 - diente, y); c.lineTo(x0 + w + diente, y + sesgo); c.stroke();
    c.strokeStyle = 'rgba(205,220,235,.22)'; c.lineWidth = Math.max(0.35, paso * 0.14);
    c.beginPath(); c.moveTo(x0 + w * 0.1, y + paso * 0.35); c.lineTo(x0 + w * 0.62, y + paso * 0.35 + sesgo * 0.52); c.stroke();
  }
  c.restore();
}

function lienzo(clave, w, h, k, pinta) {
  let cv = cache.get(clave);
  if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = Math.ceil(w * k); cv.height = Math.ceil(h * k);
  const c = cv.getContext('2d');
  c.scale(k, k);
  pinta(c);
  cache.set(clave, cv);
  return cv;
}

// ---- el pequeno (14 x 24 u en la simulacion), pintado en un lienzo de 20 x 30 u con el centro en (10, 15)
function sprPequeno(var_) {
  return lienzo('p' + var_, 20, 30, 6, (c) => {
    c.translate(10, 15);
    const sem = 400 + var_ * 13, ox = 0.35 + var_ * 0.2;
    cana(c, -4, -6, 8, 19, 2.3, sem, ox, 2.4);
    metal(c, () => { c.beginPath(); c.roundRect(-7, -7.6, 14, 2.2, 0.8); }, [-7, -7.6, 14, 2.2], { semilla: sem + 1, base: '#59616a', oxido: ox, brilloBorde: 0.3, tintaG: 1 });
    cabeza(c, -8, -14, 16, 6.6, sem + 2, ox);
  });
}

export function dibujarTornilloBonito(c, b, t) {
  const cv = sprPequeno(Math.abs(Math.round(b.x * 0.37)) % 3);
  const cae = b.estado === 'cae';
  const ang = cae ? b.giro + t * 6 : b.giro * 0.2 + 1.4;
  const cxx = b.x + b.w / 2, cyy = b.y + b.h / 2;
  // cayendo deprisa deja un rastro (desenfoque de movimiento hacia arriba)
  const n = cae && b.vy > 300 ? 3 : 1;
  for (let k = n - 1; k >= 0; k--) {
    c.save();
    c.globalAlpha = k === 0 ? 1 : 0.18 / k;
    c.translate(cxx, cyy - k * b.vy * 0.012); c.rotate(ang - k * 0.08);
    c.drawImage(cv, -10, -15, 20, 30);
    c.restore();
  }
}

// ---- el gigante: s.w x s.h (unas casillas de ancho y muchas de alto)
function sprGigante(w, h) {
  return lienzo('g' + w + 'x' + h, w + 12, h + 4, 3, (c) => {
    c.translate(6, 2);
    const cab = Math.min(30, h * 0.16), aran = 6;
    const cw = w - 28, cx0 = 14;
    cana(c, cx0, cab + aran - 2, cw, h - cab - aran + 2, 13, 911, 0.8, cw * 0.55);
    // arandela gruesa
    metal(c, () => { c.beginPath(); c.roundRect(4, cab - 1, w - 8, aran + 1, 2); }, [4, cab - 1, w - 8, aran + 1], { semilla: 912, base: '#59616a', oxido: 0.7, brilloBorde: 0.35, tintaG: 2 });
    cabeza(c, -4, 0, w + 8, cab, 913, 0.7);
    // la marca de fabrica en la cabeza y los chorretones de oxido de la arandela
    c.fillStyle = 'rgba(20,18,16,.55)'; c.fillRect(w / 2 - 6, cab * 0.42, 12, 2.2);
    c.fillStyle = rgba(P.oxido, 0.35);
    for (let k = 0; k < 5; k++) { const x = cx0 + 6 + ((k * 37) % Math.max(8, cw - 12)); c.fillRect(x, cab + aran, 2.4, 18 + ((k * 23) % 40)); }
  });
}

export function dibujarGiganteBonito(c, g, t) {
  const s = g.s;
  if (s.y + s.h < -10) return;
  const cv = sprGigante(Math.round(s.w), Math.round(s.h));
  c.drawImage(cv, s.x - 6, s.y - 2, s.w + 12, s.h + 4);
}
