// EL BOSQUE FINAL en pantalla (bosque/main.js): lo pinta un hilo aparte (bosque/obrero2d.js, diseno propio en
// siluetas, sin nada de El Linde) y aqui se compone cada fotograma con su parallax, en el lienzo 2D que el pase final
// mezcla con el 3D. Metros: la x es la z del mundo, la y la altura. La camara 2D es { cx, cy } (el centro de la
// pantalla, en metros) con B.VISTA_H metros de alto.
//
// Lo que se mueve va aqui: bancos de bruma que pasan entre los planos, los HACES que bajan de los claros del dosel y su
// mancha en el camino, las motas frias en la luz, las luciernagas (lo unico calido con el 18), las hojas que caen y la
// luz del 18 en el suelo; y en el lienzo de DELANTE (que el pase final pone encima del 18) la hierba que se mece y se
// aparta a su paso, el primer plano negro y hojas que caen cerca. La vineta, el negro pizarra y el grano los pone el
// pase final sobre todo (el acabado del despertar del juego).
import { B } from './datos.js';
import { dibujarSprite } from '../sprites.js';

const lerp = (a, b, t) => a + (b - a) * t;
const h1 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function crearPlano2D(sprites) {
  let hecho = null, fallo = null, progreso = 0, W = 1, H = 1;
  const obrero = new Worker(new URL('./obrero2d.js', import.meta.url), { type: 'module' });
  const listo = new Promise((ok) => {
    obrero.onmessage = (e) => {
      const m = e.data;
      if (m.error) { fallo = m.error; console.error('el bosque 2D no se ha podido pintar:', m.error); ok(false); return; }
      if (m.progreso !== undefined) { progreso = m.progreso; return; }
      hecho = m; progreso = 1; console.log(`bosque 2D pintado en ${m.ms} ms`); ok(true);
    };
    obrero.onerror = (e) => { fallo = e.message || 'error en el hilo del bosque 2D'; console.error(fallo); ok(false); };
  });
  let Y0 = 0, msHierba = 0, nHierba = 0;
  function empezar(y0) { Y0 = y0; obrero.postMessage({ y0, z0: B.Z0 - 2, z1: B.MEZCLA1 + 8, alto: 4 }); }

  function redimensionar(w, h) { W = w; H = h; }
  function poner(c, im, cam, f, s) {
    const x = (im.x0 - cam.cx * f) * s + W / 2, y = H / 2 - (im.y1 - cam.cy) * s, w = im.w * s;
    if (x > W || x + w < 0) return;
    c.drawImage(im.bmp, x, y, w, im.h * s);
  }
  const pX = (z, f, cam, s) => (z - cam.cx * f) * s + W / 2;
  const pY = (y, cam, s) => H / 2 - (y - cam.cy) * s;

  // el HAZ: un trapecio de luz fria emborronado, mas fuerte arriba, con hebras de polvo dentro (una vez)
  const haz = (() => {
    const w = 200, h = 800, c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.filter = 'blur(12px)';
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(222,228,229,.9)'); g.addColorStop(0.4, 'rgba(222,228,229,.42)'); g.addColorStop(0.85, 'rgba(222,228,229,.12)'); g.addColorStop(1, 'rgba(222,228,229,0)');
    x.fillStyle = g; x.beginPath(); x.moveTo(w * 0.4, 0); x.lineTo(w * 0.6, 0); x.lineTo(w * 0.88, h); x.lineTo(w * 0.12, h); x.closePath(); x.fill();
    for (let k = 0; k < 3; k++) { const g2 = x.createLinearGradient(0, 0, 0, h * 0.8); g2.addColorStop(0, 'rgba(222,228,229,.45)'); g2.addColorStop(1, 'rgba(222,228,229,0)'); x.strokeStyle = g2; x.lineWidth = 5 + k * 3; x.beginPath(); x.moveTo(w * (0.45 + k * 0.05), 0); x.lineTo(w * (0.28 + k * 0.22), h * 0.8); x.stroke(); }
    return c;
  })();
  // los CLAROS del dosel (z): cada uno echa su haz y su mancha en el camino; el del claro de las setas, el mayor
  const claros = (cam, s) => {
    const L = [], paso = 6.5;
    for (let k = Math.floor((cam.cx - W / s) / paso); k * paso < cam.cx + W / s; k++) if (h1(k * 4.3) >= 0.42) L.push({ z: k * paso + h1(k) * 3, k, f: 0.6 + 0.4 * h1(k * 9.1) });
    if (Math.abs(-107 - cam.cx) < W / s) L.push({ z: -107, k: 99, f: 1.8 });      // el del claro de las setas, el mayor
    return L;
  };
  function haces(c, cam, s, t, fuerza) {
    const yT = pY(cam.cy + B.VISTA_H / 2 + 0.4, cam, s);
    c.save(); c.globalCompositeOperation = 'screen';
    for (const q of claros(cam, s)) {
      const vida = 0.72 + 0.28 * Math.sin(t * (0.25 + h1(q.k) * 0.2) + q.k * 2.1);
      const x1 = pX(q.z, 1, cam, s), y1 = pY(Y0, cam, s), x0 = x1 + 0.28 * (y1 - yT), L = Math.hypot(x1 - x0, y1 - yT);
      c.globalAlpha = Math.min(1, fuerza * vida * q.f);
      c.setTransform(1, 0, 0, 1, x0, yT); c.rotate(Math.atan2(-(x1 - x0), y1 - yT));
      const w = (1.6 + h1(q.k * 2.2) * 1.2) * s * (q.f > 1 ? 1.5 : 1);
      c.drawImage(haz, -w / 2, 0, w, L * 1.03);
    }
    c.restore();
  }
  // la luz en el suelo: la mancha de cada claro y la del 18 (la luz suave que lleva, la del GDD)
  function manchas(c, E, cam, s, t) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const mancha = (x, y, rx, ry, col, a) => { c.save(); c.translate(x, y); c.scale(1, ry / rx); const g = c.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(0.4, `rgba(${col},${a * 0.4})`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.fillRect(-rx, -rx, rx * 2, rx * 2); c.restore(); };
    for (const q of claros(cam, s)) {
      const vida = 0.72 + 0.28 * Math.sin(t * (0.25 + h1(q.k) * 0.2) + q.k * 2.1);
      mancha(pX(q.z + Math.sin(t * 0.9 + q.k) * 0.04, 1, cam, s), pY(Y0 + 0.02, cam, s), 1.6 * s * (q.f > 1 ? 1.4 : 1), 0.22 * s, '206,214,215', 0.16 * vida * q.f);
    }
    mancha(pX(E.z, 1, cam, s), pY(Math.min(E.y, Y0 + 0.4) + 0.02, cam, s), 1.3 * s, 0.25 * s, '255,241,220', 0.14);
    // el corro de setas del claro brilla
    if (Math.abs(-107 - cam.cx) < W / s) mancha(pX(-107, 1, cam, s), pY(Y0 + 0.05, cam, s), 1.8 * s, 0.35 * s, '191,227,210', 0.13 * (0.85 + 0.15 * Math.sin(t * 0.7)));
    c.restore();
  }
  // BANCOS DE BRUMA bajos que pasan despacio entre los planos
  function bruma(c, cam, s, t, f, a, alto, sem) {
    const paso = 7, z0 = cam.cx * f - (W / 2) / s - paso * 2, deriva = t * 0.22 * (1.2 - f);
    for (let k = Math.floor((z0 + deriva) / paso); k * paso - deriva < z0 + W / s + paso * 4; k++) {
      const z = k * paso - deriva + (h1(k + sem) - 0.5) * 4, y = Y0 + alto + (h1(k * 3.1 + sem) - 0.3) * 0.9;
      const x = pX(z, f, cam, s), yy = pY(y, cam, s), r = (3.2 + h1(k * 7.7 + sem) * 3.4) * s;
      c.save(); c.translate(x, yy); c.scale(1, 0.2);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, r), al = a * (0.5 + 0.5 * h1(k * 1.9 + sem)) * (0.75 + 0.25 * Math.sin(t * 0.25 + k));
      g.addColorStop(0, `rgba(130,138,139,${al})`); g.addColorStop(1, 'rgba(130,138,139,0)');
      c.fillStyle = g; c.fillRect(-r, -r, 2 * r, 2 * r); c.restore();
    }
  }
  // MOTAS frias que suben despacio y brillan al cruzar la luz
  function motas(c, cam, s, t, n, f0, f1, tam, sem) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const anchoM = W / s + 8;
    for (let i = 0; i < n; i++) {
      const f = f0 + (f1 - f0) * h1(i * 3.3 + sem), zc = cam.cx * f;
      const z = zc - anchoM / 2 + ((h1(i + sem) * anchoM + t * (0.1 + h1(i * 1.7) * 0.15)) % anchoM);
      const y = cam.cy - 4.6 + ((h1(i * 5.9 + sem) * 9.4 + t * (0.05 + h1(i * 2.3) * 0.08)) % 9.4) + Math.sin(t * 0.8 + i) * 0.1;
      const a = (0.1 + 0.32 * h1(i * 8.3)) * (0.5 + 0.5 * Math.sin(t * (1 + h1(i) * 2) + i * 5));
      const r = tam * (0.6 + f * 0.8);
      c.fillStyle = `rgba(220,226,227,${a})`; c.fillRect(pX(z, f, cam, s) - r / 2, pY(y, cam, s) - r / 2, r, r);
    }
    c.restore();
  }
  // LUCIERNAGAS: cada una en su sitio, con su vuelo en ochos, que se enciende y se apaga
  function luciernagas(c, cam, s, t) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let k = Math.floor((cam.cx - W / s) / 0.9); k * 0.9 < cam.cx + W / s; k++) {
      if (h1(k * 2.3) < 0.5) continue;
      const fa = 0.2 + h1(k * 3.1) * 0.4, ph = h1(k * 5.7) * 6.28, on = 0.5 + h1(k * 7.9) * 1.5, a = 0.16 + h1(k) * 0.45;
      const z = k * 0.9 + Math.sin(t * fa + ph) * a, y = Y0 + 0.22 + h1(k * 1.7) * 2.3 + Math.sin(t * fa * 2 + ph * 1.3) * a * 0.4;
      const brilla = Math.max(0, Math.sin(t * on + ph * 2)) ** 2;
      if (brilla < 0.02) continue;
      const x = pX(z, 1, cam, s), yy = pY(y, cam, s), r = 0.14 * s;
      const g = c.createRadialGradient(x, yy, 0, x, yy, r);
      g.addColorStop(0, `rgba(255,236,190,${0.9 * brilla})`); g.addColorStop(0.25, `rgba(255,203,143,${0.45 * brilla})`); g.addColorStop(1, 'rgba(255,203,143,0)');
      c.fillStyle = g; c.fillRect(x - r, yy - r, r * 2, r * 2);
    }
    c.restore();
  }
  // EL POLVO DE LOS HACES: motas que flotan dentro de cada haz y solo se ven en su luz
  function polvoHaces(c, cam, s, t) {
    const yT = pY(cam.cy + B.VISTA_H / 2 + 0.4, cam, s);
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const q of claros(cam, s)) {
      const x1 = pX(q.z, 1, cam, s), y1 = pY(Y0, cam, s), x0 = x1 + 0.28 * (y1 - yT), w = (1.6 + h1(q.k * 2.2) * 1.2) * s * (q.f > 1 ? 1.5 : 1);
      for (let i = 0; i < (q.f > 1 ? 40 : 22); i++) {
        const sem = q.k * 31 + i, u = ((h1(sem) + t * (0.012 + h1(sem * 1.3) * 0.02)) % 1), lat = (h1(sem * 2.7) - 0.5) * (0.3 + 0.7 * u) * 0.75;
        const x = lerp(x0, x1, u) + lat * w + Math.sin(t * 0.7 + sem) * 0.04 * s, y = lerp(yT, y1, u) + Math.cos(t * 0.5 + sem) * 0.05 * s;
        const a = (0.2 + 0.5 * h1(sem * 4.1)) * Math.sin(u * Math.PI) * (0.5 + 0.5 * Math.sin(t * (1.5 + h1(sem) * 2) + sem));
        if (a < 0.03) continue;
        const r = (0.008 + h1(sem * 5.3) * 0.012) * s;
        c.fillStyle = `rgba(226,232,233,${a})`; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
      }
    }
    c.restore();
  }
  // DOS POLILLAS que revolotean alrededor de la cabeza del 18 (atraidas por su luz)
  function polillas(c, E, cam, s, t, cuales) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const i of cuales) {
      const fa = t * (2.1 + i * 0.7) + i * 2, r = 0.32 + 0.1 * Math.sin(t * 1.3 + i);
      const z = E.z + 0.08 + Math.cos(fa) * r + Math.sin(t * 7.3 + i) * 0.03, y = E.y + 0.95 + Math.sin(fa * 1.4) * r * 0.55 + Math.sin(t * 9.1 + i) * 0.03;
      const x = pX(z, 1, cam, s), yy = pY(y, cam, s), ala = Math.abs(Math.sin(t * 38 + i * 3)), r2 = 0.02 * s;
      const g = c.createRadialGradient(x, yy, 0, x, yy, r2 * 4); g.addColorStop(0, 'rgba(240,236,224,.35)'); g.addColorStop(1, 'rgba(240,236,224,0)');
      c.fillStyle = g; c.fillRect(x - r2 * 4, yy - r2 * 4, r2 * 8, r2 * 8);
      c.fillStyle = 'rgba(232,228,214,.85)'; c.beginPath(); c.ellipse(x - r2 * 0.6, yy, r2 * (0.5 + ala), r2 * 0.7, -0.4, 0, 7); c.ellipse(x + r2 * 0.6, yy, r2 * (0.5 + ala), r2 * 0.7, 0.4, 0, 7); c.fill();
    }
    c.restore();
  }
  // UNA BANDADA de cuervos que cruza a lo lejos, por la bruma, de vez en cuando
  function bandada(c, cam, s, t) {
    const ciclo = 26, k = Math.floor(t / ciclo), u = (t % ciclo) / 9;
    if (u > 1 || h1(k * 3.3) < 0.25) return;
    const f = 0.2, anchoM = W / s, z0 = cam.cx * f + anchoM * 0.65, zA = z0 - u * anchoM * 1.4, yA = Y0 + 5 + h1(k) * 1.3 + Math.sin(u * 3) * 0.3;
    c.save(); c.fillStyle = '#3c4447'; c.strokeStyle = '#3c4447'; c.lineWidth = Math.max(1, s * 0.012);
    for (let i = 0; i < 6; i++) {
      const z = zA + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.35 + i * 0.25, y = yA - Math.ceil(i / 2) * 0.2 + Math.sin(t * 3 + i) * 0.05;
      const x = pX(z, f, cam, s), yy = pY(y, cam, s), ala = Math.sin(t * 9 + i * 1.7) * 0.06 * s, e = 0.09 * s;
      c.beginPath(); c.moveTo(x - e, yy - ala); c.quadraticCurveTo(x - e * 0.4, yy - Math.abs(ala) * 0.3, x, yy); c.quadraticCurveTo(x + e * 0.4, yy - Math.abs(ala) * 0.3, x + e, yy - ala); c.stroke();
    }
    c.restore();
  }
  // HOJAS QUE CAEN, en silueta
  function hojasCaen(c, cam, s, t, n, f0, f1, sem, col) {
    const anchoM = W / s + 6, altoV = B.VISTA_H + 2;
    for (let i = 0; i < n; i++) {
      const f = f0 + (f1 - f0) * h1(i * 2.1 + sem), vel = 0.35 + h1(i * 4.4 + sem) * 0.35, ph = h1(i + sem) * 100;
      const y = cam.cy + altoV / 2 - ((t * vel + ph) % altoV);
      const z = cam.cx * f - anchoM / 2 + ((h1(i * 6.6 + sem) * anchoM - t * 0.3) % anchoM + anchoM) % anchoM + Math.sin(t * 1.1 + ph) * 0.35;
      const r = (0.05 + h1(i * 3.9) * 0.04) * s * (0.6 + f * 0.6), giro = t * (1.5 + h1(i) * 2) + ph;
      c.save(); c.translate(pX(z, f, cam, s), pY(y, cam, s)); c.rotate(Math.sin(giro) * 1.2); c.scale(1, 0.35 + 0.65 * Math.abs(Math.cos(giro * 0.7)));
      c.beginPath(); c.ellipse(0, 0, r, r * 0.5, 0, 0, 7); c.fillStyle = col; c.fill(); c.restore();
    }
  }
  // LA HIERBA VIVA: una hilera DETRAS del 18 (en `c`, alta y espesa, un pelo mas clara que el plano) y tres DELANTE (en
  // el lienzo de encima del 18; cuanto mas abajo, mas cerca, mayor y mas negra). Cada hilera tiene 24 MATOJOS pintados
  // una vez en su lienzo (hojas curvas, canto frio en las de la luz, alguna espiga doblada) y cada fotograma solo se
  // ponen inclinados (skew): se mecen con la racha que corre por el camino y se apartan al paso del 18. Pintar las hojas
  // una a una cada fotograma costaba 47 ms.
  const FILAS = {
    detras: { aparta: 1.1, paso: 0.055, alto: [0.3, 0.95], n: [7, 14], ancho: 0.16, y: [0.0, 0.1], grueso: [0.012, 0.03], col: '#0e1517', canto: 'rgba(150,170,176,.3)', espiga: 0.3, sem: 0 },
    delante1: { aparta: 0.7, paso: 0.075, alto: [0.2, 0.62], n: [6, 12], ancho: 0.14, y: [0.03, 0.15], grueso: [0.012, 0.026], col: '#070b0d', canto: 'rgba(159,180,184,.2)', espiga: 0.2, sem: 50 },
    delante2: { aparta: 0.45, paso: 0.1, alto: [0.3, 0.85], n: [6, 12], ancho: 0.2, y: [0.3, 0.45], grueso: [0.016, 0.036], col: '#05080a', canto: 'rgba(159,180,184,.13)', espiga: 0.15, sem: 90 },
    delante3: { aparta: 0.3, paso: 0.13, alto: [0.4, 1.15], n: [5, 11], ancho: 0.26, y: [0.6, 0.8], grueso: [0.022, 0.048], col: '#030506', canto: null, espiga: 0.12, sem: 130 },
  };
  const VARIANTES = 24, matojos = {};
  function hacerMatojos(F, s) {
    const L = [];
    for (let v = 0; v < VARIANTES; v++) {
      const q = v * 7.13 + F.sem, alto = F.alto[1] * s, n = F.n[0] + Math.floor(h1(q * 3.7) * (F.n[1] - F.n[0] + 1));
      const w = Math.ceil(F.ancho * s + alto * 1.3 + 8), h = Math.ceil(alto * 1.35 + 6), cv = document.createElement('canvas');
      cv.width = w; cv.height = h; const c = cv.getContext('2d'), bx0 = w / 2, by = h - 2;
      c.fillStyle = F.col; if (F.canto) { c.strokeStyle = F.canto; c.lineWidth = Math.max(0.6, s * 0.0028); }
      for (let b = 0; b < n; b++) {
        const hb = h1(q * 11 + b * 3.1), L2 = alto * (0.42 + hb * 0.58), x = bx0 + (b / (n - 1 || 1) - 0.5) * F.ancho * s * (0.6 + hb * 0.5);
        const ang = (b / (n - 1 || 1) - 0.5) * 0.95 + (h1(q * 5 + b) - 0.5) * 0.4;
        const ex = x + Math.sin(ang) * L2, ey = by - Math.cos(ang) * L2 * (1 - 0.12 * Math.abs(ang));
        const mx = x + Math.sin(ang * 0.35) * L2 * 0.45, my = by - L2 * 0.58, ww = (F.grueso[0] + hb * (F.grueso[1] - F.grueso[0])) * s * 0.5;
        c.beginPath(); c.moveTo(x - ww, by); c.quadraticCurveTo(mx - ww * 0.6, my, ex, ey); c.quadraticCurveTo(mx + ww * 0.6, my, x + ww, by); c.closePath(); c.fill();
        if (F.canto && hb > 0.5 && ang > -0.2) { c.beginPath(); c.moveTo(mx + ww * 0.5, my); c.quadraticCurveTo((mx + ex) / 2 + ww * 0.3, (my + ey) / 2, ex, ey); c.stroke(); }
      }
      if (h1(q * 5.3) < F.espiga) {        // la espiga: un tallo fino mas alto, doblado por su peso, con granos
        const Le = alto * (1.0 + h1(q * 8.1) * 0.25), ae = 0.25 + (h1(q * 6.2) - 0.5) * 0.5, x = bx0 + (h1(q * 9.9) - 0.5) * F.ancho * s * 0.5;
        const tx = x + Math.sin(ae) * Le, ty = by - Math.cos(ae) * Le, cx = x + Math.sin(ae * 0.3) * Le * 0.5, cy = by - Le * 0.6, g = Math.max(0.7, s * 0.0035);
        c.beginPath(); c.moveTo(x - g, by); c.quadraticCurveTo(cx, cy, tx, ty); c.quadraticCurveTo(cx + g, cy, x + g, by); c.closePath(); c.fill();
        for (let j = 0; j < 8; j++) {
          const u = 0.7 + j * 0.04, ix = (1 - u) * (1 - u) * x + 2 * (1 - u) * u * cx + u * u * tx, iy = (1 - u) * (1 - u) * by + 2 * (1 - u) * u * cy + u * u * ty;
          const r = s * (0.012 - j * 0.0009), lado = j % 2 ? 1 : -1;
          c.beginPath(); c.ellipse(ix + lado * r * 0.8, iy, r * 0.9, r * 0.5, ae + lado * 0.6, 0, 7); c.fill();
        }
      }
      L.push({ cv, w, h, bx: bx0, by });
    }
    return L;
  }
  function hierba(c, E, cam, s, t, cual) {
    const F = FILAS[cual], z0 = cam.cx - W / s / 2 - 1.5, z1 = cam.cx + W / s / 2 + 1.5;
    const clave = cual + Math.round(s); if (!matojos[clave]) matojos[clave] = hacerMatojos(F, s);
    const M = matojos[clave], enSuelo = E.y - Y0 < 0.5 ? 1 : 0;
    for (let k = Math.floor(z0 / F.paso); k * F.paso < z1; k++) {
      const q = k + F.sem * 1000;
      if (h1(q * 1.37) < 0.06) continue;                                                     // algun hueco
      const zb = k * F.paso + (h1(q * 2.9) - 0.5) * F.paso * 0.9, yb = Y0 - F.y[0] - h1(q * 4.1) * (F.y[1] - F.y[0]);
      // el alto va por rodales: trozos altos y trozos mas ralos
      const rodal = 0.5 + 0.5 * Math.sin(zb * 0.9 + F.sem) * Math.sin(zb * 0.37 + 1.3 + F.sem);
      const esc = (F.alto[0] + (F.alto[1] - F.alto[0]) * Math.pow(h1(q * 7.3), 1.3) * (0.4 + 0.6 * rodal)) / F.alto[1];
      const m = M[Math.floor(h1(q * 3.3) * VARIANTES)];
      const racha = 0.5 + 0.5 * Math.sin(t * 0.8 - zb * 0.35), dz = zb - E.z;
      const cerca = Math.max(0, 1 - Math.abs(dz) / 0.6) * enSuelo;
      const k2 = 0.06 + 0.22 * racha + 0.05 * Math.sin(t * 1.9 + zb * 1.7) + Math.sign(dz || 1) * cerca * F.aparta;   // la inclinacion
      const espejo = h1(q * 6.7) < 0.5 ? -1 : 1, e = esc * (1 - 0.2 * cerca * F.aparta);
      // x' = espejo*e*x - k2*e*y + px ; y' = e*y + py   (el pie del matojo en (px, py), las hojas hacia y negativa)
      c.setTransform(espejo * e, 0, -k2 * e, e, pX(zb, 1, cam, s), pY(yb, cam, s));
      c.drawImage(m.cv, -m.bx, -m.by);
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
  }

  // el fotograma 2D en `c` (debajo del 18 en el pase final) y en `cf` (encima del 18)
  function dibujar(c, E, cam, cf) {
    const s = H / B.VISTA_H, t = E.t;
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.filter = 'none';
    if (cf) { cf.setTransform(1, 0, 0, 1, 0, 0); cf.globalCompositeOperation = 'source-over'; cf.globalAlpha = 1; cf.filter = 'none'; cf.clearRect(0, 0, W, H); }
    c.fillStyle = '#1f2a31'; c.fillRect(0, 0, W, H);
    if (!hecho) return;
    // los planos, con la bruma que pasa entre ellos
    for (const im of hecho.capas) {
      poner(c, im, cam, im.f, s);
      if (im.f === 0.14) { bruma(c, cam, s, t, 0.25, 0.3, 0.7, 1); bandada(c, cam, s, t); }
      if (im.f === 0.46) { bruma(c, cam, s, t, 0.55, 0.22, 0.35, 2); motas(c, cam, s, t, 40, 0.4, 0.6, 1.4, 3); }
      if (im.f === 0.62) haces(c, cam, s, t, 0.24);
      if (im.f === 0.8) bruma(c, cam, s, t, 0.85, 0.12, 0.15, 4);
    }
    // el plano del 18
    for (const im of hecho.piezas) if (im.nombre === 'fondo') poner(c, im, cam, 1, s);
    hojasCaen(c, cam, s, t, 8, 0.75, 0.95, 5, '#0d1316');
    for (const im of hecho.piezas) if (im.nombre === 'suelo') poner(c, im, cam, 1, s);
    manchas(c, E, cam, s, t);
    const th0 = performance.now(); hierba(c, E, cam, s, t, 'detras'); msHierba += performance.now() - th0;
    if (E.ver18) dibujarSprite(c, sprites, E.anim, E.i, (E.z - cam.cx) * s + W / 2, H / 2 - (E.y - cam.cy) * s, E.cara, s, 1, 1);
    for (const im of hecho.piezas) if (im.nombre === 'delante') poner(c, im, cam, 1, s);
    // la luz que cruza por delante del plano, las luciernagas y las motas
    haces(c, cam, s, t, 0.16);
    polvoHaces(c, cam, s, t);
    polillas(c, E, cam, s, t, [0]);
    luciernagas(c, cam, s, t);
    motas(c, cam, s, t, 60, 0.85, 1, 1.8, 6);
    // delante del 18
    const D = cf || c;
    const th = performance.now();
    hierba(D, E, cam, s, t, 'delante1'); hierba(D, E, cam, s, t, 'delante2'); hierba(D, E, cam, s, t, 'delante3');
    msHierba += performance.now() - th; nHierba++;
    for (const im of hecho.frente || []) poner(D, im, cam, im.f, s);
    hojasCaen(D, cam, s, t, 5, 1.1, 1.35, 7, '#030506');
    polillas(D, E, cam, s, t, [1]);
  }
  // el 18 solo, en el lienzo de su capa (el carton: bosque/main.js), con su borde de luz
  function pintar18(c, E, X, Y, s) {
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.clearRect(0, 0, c.canvas.width, c.canvas.height);
    dibujarSprite(c, sprites, E.anim, E.i, X(E.z), Y(E.y), E.cara, s, 1, 1);
  }
  return { empezar, listo, redimensionar, dibujar, pintar18, get progreso() { return progreso; }, hierbaMs() { const r = msHierba / (nHierba || 1); msHierba = 0; nHierba = 0; return r; }, get fallo() { return fallo; } };
}
