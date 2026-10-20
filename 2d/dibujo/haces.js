// El haz de los focos, renderizado en Blender (boundland/blender/haz/): aire volumetrico y motas de polvo
// reales que solo brillan dentro del cono. Llega como dos capas sobre negro y en luz blanca:
//   haz.webp    la neblina del haz (quieta)
//   polvo.webp  las motas, 16 fotogramas en bucle (ya NO se pinta: el polvo tiene fisica en polvo_luz.js
//               y se ilumina con el CAMPO de luz de esta neblina, `campo()`, asi brilla como en Blender)
// Aqui se suman sobre la escena: tenidas con el color de cada lampara, colocadas en su bombilla, del
// tamano de su tubo y su alcance, GIRADAS con la lampara cuando se balancea, RECORTADAS por su sombra (el
// poligono de visibilidad de luz.js) y con el parpadeo del tubo. Si las imagenes no han cargado aun, no
// pinta nada (la luz del mapa de luz sigue).
import { hash } from './tinta.js';

const RAIZ = 'img/haz/';
const RAIZ_LUCES = 'img/luces/';
const U_POR_M = 64;            // unidades del juego por metro (las luces de blender/luces/)

// La luz de las DEMAS lamparas, tambien de Blender (blender/luces/luces.py): farol, lampara de la casa,
// farola, luz de emergencia, ventana, rejilla, frasco y pilotos. Cada lampara lleva `L.spr = { id, dx, dy,
// ganancia, escala }`: que imagen, donde cae su ancla respecto a la luz (gira con la lampara) y cuanto
// suma. La imagen se tine y se recorta por la sombra UNA vez y se guarda en la lampara; solo se rehace si
// la lampara se mueve.
function luminancia(img, w, h) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const cc = cv.getContext('2d'); cc.drawImage(img, 0, 0);
  const d = cc.getImageData(0, 0, w, h).data, l = new Float32Array(w * h);
  for (let i = 0; i < l.length; i++) l[i] = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 765;
  return l;
}

export class Haces {
  constructor() {
    this.listo = false;
    this.spr = {};
    fetch(RAIZ_LUCES + 'luces.json').then((r) => r.json()).then((meta) => Promise.all(Object.entries(meta).map(([id, m]) =>
      cargar(RAIZ_LUCES + id + '.webp').then((img) => { this.spr[id] = { m, img, luz: luminancia(img, m.w, m.h) }; }))))
      .catch((e) => console.warn('luces: sin sprites', e));
    this.mascaraS = document.createElement('canvas'); this.mascaraSB = document.createElement('canvas');
    for (const cv of [this.mascaraS, this.mascaraSB]) { cv.width = 256; cv.height = 256; }
    this.tinte = document.createElement('canvas');
    Promise.all([
      fetch(RAIZ + 'haz.json').then((r) => r.json()),
      cargar(RAIZ + 'haz.webp'), cargar(RAIZ + 'polvo.webp'),
    ]).then(([m, haz, polvo]) => {
      this.m = m; this.haz = haz; this.polvo = polvo;
      this.tinte.width = m.w; this.tinte.height = m.h;
      // la luz del haz como numeros (0..1 por pixel del sprite), para iluminar el polvo con fisica
      const cv = document.createElement('canvas'); cv.width = m.w; cv.height = m.h;
      const cc = cv.getContext('2d'); cc.drawImage(haz, 0, 0);
      const d = cc.getImageData(0, 0, m.w, m.h).data;
      this.luzHaz = new Float32Array(m.w * m.h);
      for (let i = 0; i < this.luzHaz.length; i++) this.luzHaz[i] = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 765;
      this.mascara = document.createElement('canvas'); this.mascaraB = document.createElement('canvas');
      for (const cv of [this.mascara, this.mascaraB]) { cv.width = m.w / 2; cv.height = Math.ceil(m.h / 2); }
      this.listo = true;
    }).catch((e) => console.warn('haces: sin sprites', e));
  }

  // escala del sprite para la lampara q (unidades del mundo por pixel del sprite)
  escala(q) {
    const uPorPx = 76 / (this.m.tuboM * this.m.pxPorMetro);     // el tubo del sprite (1,12 m) = el del juego (76 u)
    const casa = q.foco && q.foco.tipo === 'lampara_casa';
    const largo = q.r / 300;
    return { ex: uPorPx * (casa ? 0.55 : Math.sqrt(largo)), ey: uPorPx * largo };
  }

  // cuanta luz del haz de q llega al punto (x, y) del mundo, 0..1, sin contar la sombra
  campo(q, x, y) {
    if (!this.listo) return 0;
    const m = this.m, { ex, ey } = this.escala(q);
    let dx = x - q.x, dy = y - q.y;
    if (q.ang) { const c = Math.cos(-q.ang), s = Math.sin(-q.ang); const ax = dx * c - dy * s; dy = dx * s + dy * c; dx = ax; }
    const sx = Math.round(dx / ex + m.tuboX), sy = Math.round(dy / ey + m.tuboY);
    if (sx < 0 || sy < 0 || sx >= m.w || sy >= m.h) return 0;
    return this.luzHaz[sy * m.w + sx];
  }

  // ---- las luces de blender/luces/
  escalaSpr(q) { return U_POR_M / this.spr[q.spr.id].m.pxPorMetro * (q.spr.escala || 1); }

  // donde cae en el mundo el ancla de la imagen de q (gira con la lampara)
  ancla(q) {
    let dx = q.spr.dx || 0, dy = q.spr.dy || 0;
    if (q.ang) { const c = Math.cos(q.ang), s = Math.sin(q.ang); const ax = dx * c - dy * s; dy = dx * s + dy * c; dx = ax; }
    return [q.x + dx, q.y + dy];
  }

  // cuanta luz de q llega al punto (x, y), 0..1, sin la sombra: para iluminar el polvo con fisica
  campoSpr(q, x, y) {
    const s = this.spr[q.spr.id];
    if (!s) return 0;
    const e = this.escalaSpr(q), [ax, ay] = this.ancla(q);
    let dx = x - ax, dy = y - ay;
    if (q.ang) { const c = Math.cos(-q.ang), sn = Math.sin(-q.ang); const u = dx * c - dy * sn; dy = dx * sn + dy * c; dx = u; }
    const sx = Math.round(dx / e + s.m.anclaX), sy = Math.round(dy / e + s.m.anclaY);
    if (sx < 0 || sy < 0 || sx >= s.m.w || sy >= s.m.h) return 0;
    return s.luz[sy * s.m.w + sx];
  }

  // tenir y recortar por la sombra la imagen de q, en un lienzo que se queda en la lampara
  preparar(q, s, e, ax, ay, luz, t) {
    const m = s.m;
    if (!q._lz) { q._lz = document.createElement('canvas'); q._lz.width = m.w; q._lz.height = m.h; }
    q._t = t;
    const tc = q._lz.getContext('2d');
    tc.globalCompositeOperation = 'copy'; tc.globalAlpha = 1;
    tc.drawImage(s.img, 0, 0);
    tc.globalCompositeOperation = 'multiply';
    tc.fillStyle = q.color; tc.fillRect(0, 0, m.w, m.h);
    if (q.spr.sinSombra) return;
    const poly = luz.sombraDe({ x: q.x, y: q.y, r: Math.max(q.r * 1.3, Math.hypot(m.w, m.h) * e * 0.55), mueve: q.mueve });
    if (!poly || poly.length <= 4) return;
    const mw = Math.ceil(m.w / 2), mh = Math.ceil(m.h / 2);
    const mc = this.mascaraS.getContext('2d'), mb = this.mascaraSB.getContext('2d');
    mc.setTransform(1, 0, 0, 1, 0, 0); mc.clearRect(0, 0, 256, 256);
    mc.scale(0.5, 0.5); mc.translate(m.anclaX, m.anclaY); mc.scale(1 / e, 1 / e);
    if (q.ang) mc.rotate(-q.ang);
    mc.translate(-ax, -ay);
    mc.beginPath(); mc.moveTo(poly[0], poly[1]); for (let i = 2; i < poly.length; i += 2) mc.lineTo(poly[i], poly[i + 1]); mc.closePath();
    mc.fillStyle = '#fff'; mc.fill();
    mb.setTransform(1, 0, 0, 1, 0, 0); mb.clearRect(0, 0, 256, 256);
    mb.filter = 'blur(4px)'; mb.drawImage(this.mascaraS, 0, 0); mb.filter = 'none';
    tc.globalCompositeOperation = 'destination-in';
    tc.drawImage(this.mascaraSB, 0, 0, mw, mh, 0, 0, m.w, m.h);
  }

  dibujarSprites(c, luces, t, cam, luz) {
    for (const q of luces) {
      if (!q.spr) continue;
      const s = this.spr[q.spr.id];
      if (!s) continue;
      const e = this.escalaSpr(q), m = s.m, [ax, ay] = this.ancla(q);
      const rx = Math.max(m.w, m.h) * e;
      if (ax + rx < cam.x || ax - rx > cam.x + cam.w || ay + rx < cam.y || ay - rx > cam.y + cam.h) continue;
      const f = q.fuerza(t);
      if (f < 0.03) continue;
      // quieta, la imagen preparada vale (se repasa cada 2 s por si el mapa cambia); moviendose, cada vez
      if (!q._lz || q.mueve || t - q._t > 2 || t < q._t) { this.preparar(q, s, e, ax, ay, luz, t); if (q.alfaLuz) q._lzA = alfaDeLuz(q._lz); }
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.translate(ax, ay);
      if (q.ang) c.rotate(q.ang);
      c.scale(e, e);
      for (let a = f * (q.spr.ganancia ?? 1); a > 0.02; a -= 1) {
        c.globalAlpha = Math.min(1, a);
        c.drawImage(q.alfaLuz ? q._lzA : q._lz, -m.anclaX, -m.anclaY);
      }
      c.restore();
    }
  }

  // una luz suelta que no es una lampara del nivel (el brillo del frasco del 18), sin sombra
  pintarSuelto(c, id, x, y, color, a, escala = 1) {
    if (!this.spr[id]) return false;
    this._sueltos = this._sueltos || {};
    const k = id + color + escala;
    // (alfaLuz: se pinta con lo de delante, que va sobre transparente a lo Hollow Knight: su negro no puede tapar)
    const q = this._sueltos[k] || (this._sueltos[k] = { spr: { id, escala, sinSombra: true }, color, r: 0, _t: 0, alfaLuz: true });
    q.x = x; q.y = y; q.fuerza = () => a;
    this.dibujarSprites(c, [q], 0, { x: -1e9, y: -1e9, w: 2e9, h: 2e9 }, null);
    return true;
  }

  dibujar(c, luces, t, cam, luz) {
    if (!this.listo) return;
    const m = this.m, tc = this.tinte.getContext('2d');
    for (const q of luces) {
      if (!q.cono || q.spr) continue;
      if (q.x < cam.x - q.r * 1.3 || q.x > cam.x + cam.w + q.r * 1.3 || q.y > cam.y + cam.h + 40 || q.y + q.r < cam.y) continue;
      const f = q.fuerza(t);
      if (f < 0.04) continue;
      // tamano: el ancho de la boca de la lampara y el alcance de su luz
      const { ex, ey } = this.escala(q);
      // tenir: la neblina en luz blanca, multiplicada por el color de la lampara (el polvo va aparte, con fisica)
      tc.globalCompositeOperation = 'source-over'; tc.globalAlpha = 1;
      tc.drawImage(this.haz, 0, 0);
      tc.globalCompositeOperation = 'multiply';
      tc.fillStyle = q.color; tc.fillRect(0, 0, m.w, m.h);
      // SOMBRA SUAVE: el poligono de lo que ve la lampara se pinta en una mascara en el espacio del sprite,
      // se difumina (un tubo largo da sombras de borde blando, no un corte en seco) y se aplica al haz
      const poly = luz.sombraDe({ x: q.x, y: q.y, r: q.r * 1.3, mueve: q.mueve });
      if (poly && poly.length > 4) {
        const mc = this.mascara.getContext('2d'), mb = this.mascaraB.getContext('2d');
        mc.setTransform(1, 0, 0, 1, 0, 0); mc.clearRect(0, 0, this.mascara.width, this.mascara.height);
        mc.scale(0.5, 0.5); mc.translate(m.tuboX, m.tuboY); mc.scale(1 / ex, 1 / ey);
        if (q.ang) mc.rotate(-q.ang);
        mc.translate(-q.x, -q.y);
        mc.beginPath(); mc.moveTo(poly[0], poly[1]); for (let i = 2; i < poly.length; i += 2) mc.lineTo(poly[i], poly[i + 1]); mc.closePath();
        mc.fillStyle = '#fff'; mc.fill();
        mb.setTransform(1, 0, 0, 1, 0, 0); mb.clearRect(0, 0, this.mascaraB.width, this.mascaraB.height);
        mb.filter = 'blur(5px)'; mb.drawImage(this.mascara, 0, 0); mb.filter = 'none';
        tc.globalCompositeOperation = 'destination-in';
        tc.drawImage(this.mascaraB, 0, 0, m.w, m.h);
      }
      // a la escena: en suma, girado con la lampara
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.translate(q.x, q.y);
      if (q.ang) c.rotate(q.ang);
      c.scale(ex, ey);
      // intensidad por encima de 1: se suma otra pasada con lo que sobra
      // (el calido iba a 1,7 y quemaba la lampara entera: no se veia el foco como tal; 2026-10-20)
      for (let a = f * (q.calida ? 1.12 : 1.25); a > 0.02; a -= 1) {
        c.globalAlpha = Math.min(1, a);
        c.drawImage(this.tinte, -m.tuboX, -m.tuboY);
      }
      c.restore();
    }
  }
}

function cargar(url) {
  return new Promise((ok, mal) => { const im = new Image(); im.onload = () => ok(im); im.onerror = mal; im.src = url; });
}

// la luz de un sprite (sobre negro) como transparencia: alfa = su brillo y el color dividido por el. Sumada ('lighter')
// sobre algo pintado da lo mismo que la imagen sobre negro, y sobre transparente no deja la caja negra del sprite
// (dibujo/hk.js pinta lo de delante sobre transparente)
function alfaDeLuz(cv) {
  const o = document.createElement('canvas'); o.width = cv.width; o.height = cv.height;
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height), p = d.data;
  for (let k = 0; k < p.length; k += 4) {
    const a = Math.max(p[k], p[k + 1], p[k + 2]);
    if (a === 0) { p[k + 3] = 0; continue; }
    p[k] = (p[k] * 255) / a; p[k + 1] = (p[k + 1] * 255) / a; p[k + 2] = (p[k + 2] * 255) / a; p[k + 3] = a;
  }
  o.getContext('2d').putImageData(d, 0, 0);
  return o;
}
