// EL 2D: la sala dentro del muro donde acaba la caida y la boca del conducto, pintada en un lienzo 2D como el juego
// (boundland/web/dibujo: una sola tinta, masa oscura, fondo de hormigon en penumbra, luz con intencion, el 18 lo mas
// luminoso). Se dibuja en UNIDADES DEL JUEGO (64 u/m, y hacia abajo) para usar tinta.js tal cual.
//
// Lo quieto (fondo, masa, tinta, atrezo) se pinta UNA vez en un lienzo grande anclado al mundo y cada fotograma solo se
// recorta con la camara; lo que se mueve (cascotes, polvo, el 18, la luz) va encima.
import { D } from './datos.js';
import { TINTA, GROSOR, temblar, trazar, tinta, caja, linea, circulo, hash, azar, rgba } from './tinta.js';
import { dibujarSprite } from './sprites.js';

const U = 64;                                  // unidades por metro
const EX0 = -13, EX1 = 13, EY0 = -5, EY1 = 18;  // lo que cubre el lienzo quieto (m)
const COL = {
  masa: '#11151a', masaClara: '#262e37', fondo: '#29323c', fondoPozo: '#1f262e', fondoConducto: '#151b22',
  costilla: '#212932', borde: '#aebccb', tuberia: '#2e3843', cascote: '#3a434d', chapa: '#4b535c',
  calida: '#ffbf72', fria: '#bcd3e6', polvo: '#eadfca',
};

// el hueco donde se puede estar, en metros (y arriba)
const S = D.SALA, P = D.POZO, C = D.CONDUCTO;
const HUECO = [[S.x0, 0], [C.x1, 0], [C.x1, C.alto], [C.x0, C.alto], [S.x1, S.techo], [P.x1, S.techo], [P.x1, P.alto],
  [P.x0, P.alto], [P.x0, S.techo], [S.x0, S.techo]];
const u = (p) => [p[0] * U, -p[1] * U];        // metros (y arriba) -> unidades del juego (y abajo)

export function crearPlano(sprites) {
  let escena = null, escenaS = 0, sombra = null, haz = null;
  const L = { cascotes: [], polvo: [], motas: [] };

  // ------------------------------------------------------------- lo quieto
  function pintarEscena(s) {
    const k = s / U;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil((EX1 - EX0) * s); cv.height = Math.ceil((EY1 - EY0) * s);
    const c = cv.getContext('2d');
    c.setTransform(k, 0, 0, k, -EX0 * U * k, EY1 * U * k);
    // masa (todo lo que no es hueco)
    c.fillStyle = COL.masa;
    c.fillRect(EX0 * U, -EY1 * U, (EX1 - EX0) * U, (EY1 - EY0) * U);
    // textura de la masa: trazos pintados como la roca del juego, muy apagados
    const r = azar(11);
    c.globalAlpha = 0.5;
    for (let n = 0; n < 900; n++) {
      const x = (EX0 + r() * (EX1 - EX0)) * U, y = -(EY0 + r() * (EY1 - EY0)) * U;
      c.fillStyle = r() < 0.5 ? '#151a20' : '#0d1014';
      c.beginPath(); c.ellipse(x, y, 6 + r() * 26, 3 + r() * 10, r() * 3, 0, 7); c.fill();
    }
    c.globalAlpha = 1;
    const hueco = temblar(HUECO.map(u), 16, 1.3, 4);
    // canto mas claro de la masa junto al hueco (la luz que le llega al borde)
    c.save();
    c.beginPath(); c.rect(EX0 * U, -EY1 * U, (EX1 - EX0) * U, (EY1 - EY0) * U); trazar(c, hueco); c.clip('evenodd');
    trazar(c, hueco); c.lineWidth = 0.55 * U; c.strokeStyle = rgba(COL.masaClara, 0.55); c.stroke();
    trazar(c, hueco); c.lineWidth = 0.22 * U; c.strokeStyle = rgba(COL.masaClara, 0.6); c.stroke();
    c.restore();
    // el fondo dentro del hueco
    c.save();
    trazar(c, hueco); c.clip();
    pintarFondo(c);
    c.restore();
    // tinta del hueco y canto encendido del suelo (el borde de luz de luz.js del juego)
    trazar(c, hueco); tinta(c, GROSOR * 1.15);
    c.fillStyle = '#1b2128'; c.fillRect(S.x0 * U, 1.5, (C.x1 - S.x0) * U, 0.16 * U);
    linea(c, S.x0 * U + 4, 2.4, C.x1 * U, 2.4, 1.8, rgba(COL.borde, 0.5), 9, 0.6);
    atrezo(c);
    return cv;
  }

  function pintarFondo(c) {
    const r = azar(5);
    // hormigon de la sala: paneles prefabricados de 3 x 1,5 m
    c.fillStyle = COL.fondo; c.fillRect(S.x0 * U, -S.techo * U, (S.x1 - S.x0) * U, S.techo * U);
    c.fillStyle = COL.fondoPozo; c.fillRect(P.x0 * U, -P.alto * U, (P.x1 - P.x0) * U, (P.alto - S.techo) * U);
    // manchas y chorretones
    for (let n = 0; n < 70; n++) {
      const x = (S.x0 + r() * (S.x1 - S.x0 + 1)) * U, y = -(r() * (S.techo + 8)) * U;
      const g = c.createRadialGradient(x, y, 0, x, y, (0.3 + r() * 1.1) * U);
      g.addColorStop(0, `rgba(8,10,13,${0.10 + r() * 0.16})`); g.addColorStop(1, 'rgba(8,10,13,0)');
      c.fillStyle = g; c.fillRect(x - 80, y - 80, 160, 160);
    }
    for (let x = S.x0 + 0.4; x < S.x1; x += 0.35 + r() * 0.9) {
      const y0 = [1.5, 3, 4.5][Math.floor(r() * 3)];
      const g = c.createLinearGradient(0, -y0 * U, 0, -(y0 - 0.6 - r() * 1.2) * U);
      g.addColorStop(0, `rgba(10,12,15,${0.18 + r() * 0.2})`); g.addColorStop(1, 'rgba(10,12,15,0)');
      c.fillStyle = g; c.fillRect(x * U, -y0 * U, (0.04 + r() * 0.1) * U, 1.8 * U);
    }
    // juntas de los paneles
    c.lineWidth = 1.3;
    for (let y = 1.5; y < S.techo; y += 1.5) {
      linea(c, S.x0 * U, -y * U, S.x1 * U, -y * U, 1.3, 'rgba(8,10,13,.55)', 20 + y, 0.4);
      linea(c, S.x0 * U, -y * U + 1.6, S.x1 * U, -y * U + 1.6, 0.9, 'rgba(170,190,205,.05)', 30 + y, 0.4);
    }
    for (let x = S.x0 + 3; x < S.x1; x += 3) linea(c, x * U, 0, x * U, -S.techo * U, 1.3, 'rgba(8,10,13,.5)', 40 + x, 0.4);
    for (let y = S.techo + 1.5; y < P.alto; y += 1.5) linea(c, P.x0 * U, -y * U, P.x1 * U, -y * U, 1.2, 'rgba(8,10,13,.5)', 50 + y, 0.4);
    // grietas
    for (const g of [[-7.6, 3.9, 6], [-1.9, 4.6, 5], [-3.4, 0.9, 4]]) {
      const pts = [[g[0] * U, -g[1] * U]];
      const rr = azar(g[2] * 7);
      for (let i = 0; i < g[2]; i++) { const p = pts[pts.length - 1]; pts.push([p[0] + (rr() - 0.4) * 22, p[1] + 10 + rr() * 14]); }
      trazar(c, pts, false); c.lineWidth = 1.4; c.strokeStyle = 'rgba(6,8,10,.7)'; c.stroke();
    }
    // la escalerilla del pozo, rota: por ahi no ha bajado nadie en anos
    for (const x of [P.x0 + 0.35, P.x1 - 0.35]) linea(c, x * U, -(S.techo + 0.3) * U, x * U, -(P.alto) * U, 2.2, 'rgba(10,12,15,.8)', 60 + x, 0.3);
    for (let y = S.techo + 0.6; y < P.alto; y += 0.32) {
      if (hash(Math.round(y * 10), 3) < 0.18) continue;
      linea(c, (P.x0 + 0.35) * U, -y * U, (P.x1 - 0.35) * U, -y * U, 1.8, 'rgba(10,12,15,.75)', 70 + y, 0.3);
    }
    // el conducto por dentro: casi negro, con sus costillas cada metro
    c.fillStyle = COL.fondoConducto; c.fillRect(C.x0 * U, -C.alto * U, (C.x1 - C.x0) * U, C.alto * U);
    for (let x = C.x0 + 0.5; x < C.x1; x += 1) {
      c.fillStyle = COL.costilla; c.fillRect((x - 0.05) * U, -C.alto * U, 0.1 * U, C.alto * U);
      linea(c, (x - 0.05) * U, 0, (x - 0.05) * U, -C.alto * U, 1, 'rgba(0,0,0,.6)', 80 + x, 0.2);
    }
  }

  function atrezo(c) {
    // tuberia a lo largo de la pared, con sus abrazaderas, y su bajante
    const y = -4.35 * U, g = 0.18 * U;
    caja(c, S.x0 * U - 4, y - g / 2, (S.x1 - S.x0) * U - 8, g, COL.tuberia, 12, 0.6, GROSOR * 0.8);
    for (let x = S.x0 + 0.8; x < S.x1; x += 1.5) caja(c, x * U - 4, y - g / 2 - 3, 8, g + 6, '#242c35', 13 + x, 0.4, GROSOR * 0.6);
    caja(c, -8.55 * U, y, g, 4.35 * U, COL.tuberia, 14, 0.6, GROSOR * 0.8);
    // cuadro electrico con su tubo
    caja(c, -2.5 * U, -3.05 * U, 0.55 * U, 0.75 * U, '#333c46', 15, 0.8, GROSOR * 0.8);
    caja(c, -2.36 * U, -3.6 * U, 0.06 * U, 0.55 * U, '#242c35', 16, 0.3, GROSOR * 0.5);
    linea(c, -2.4 * U, -2.55 * U, -2.1 * U, -2.55 * U, 1.2, 'rgba(0,0,0,.5)', 17, 0.2);
    // rotulo de mantenimiento sobre la boca del conducto (pintura de plantilla)
    c.save();
    c.scale(1, 1);
    c.font = `700 ${0.34 * U}px Bahnschrift, "Segoe UI", sans-serif`;
    c.fillStyle = 'rgba(190,200,210,.30)';
    c.fillText('C-7', -1.75 * U, -2.95 * U);
    c.beginPath(); c.moveTo(-0.95 * U, -3.2 * U); c.lineTo(-0.62 * U, -3.07 * U); c.lineTo(-0.95 * U, -2.94 * U); c.closePath(); c.fill();
    c.restore();
    // la lampara de emergencia (enjaulada) junto a la boca: el cuerpo; la luz va encima, viva
    caja(c, -0.85 * U, -2.62 * U, 0.3 * U, 0.2 * U, '#2a3138', 18, 0.4, GROSOR * 0.7);
    // un cable que cuelga del techo
    const cab = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; cab.push([(-3.3 + t * 1.6) * U, -(S.techo - 0.05 - Math.sin(t * Math.PI) * 0.9) * U]); }
    trazar(c, cab, false); tinta(c, GROSOR * 0.7);
    // cascotes viejos en las esquinas
    const r = azar(31);
    for (let n = 0; n < 9; n++) {
      const x = (n < 5 ? S.x0 + 0.1 + r() * 1.2 : -1.9 + r() * 1.5) * U, w = (0.12 + r() * 0.25) * U, h = (0.08 + r() * 0.14) * U;
      caja(c, x, -h + 1, w, h, COL.cascote, 40 + n, 1.4, GROSOR * 0.7);
    }
  }

  // la mancha de luz del haz que baja del pozo, anclada al mundo (se recorta de la penumbra y luego suma color)
  function pintarHaz(s) {
    const cv = document.createElement('canvas');
    const w = 7 * s, h = 13 * s;
    cv.width = Math.ceil(w); cv.height = Math.ceil(h);
    const c = cv.getContext('2d');
    c.filter = `blur(${Math.round(0.35 * s)}px)`;
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.55, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0.5)');
    c.fillStyle = g;
    // de x -6.1..-4.3 arriba (y = 12) a -7.1..-3.3 en el suelo
    const X = (x) => (x + 8.7) * s, Y = (y) => (12.5 - y) * s;
    c.beginPath(); c.moveTo(X(-6.0), Y(12)); c.lineTo(X(-4.4), Y(12)); c.lineTo(X(-3.2), Y(-0.2)); c.lineTo(X(-7.2), Y(-0.2)); c.closePath(); c.fill();
    return { cv, x0: -8.7, y1: 12.5 };
  }

  function redimensionar(W, H) {
    const s = H / D.VISTA_H;
    if (Math.abs(s - escenaS) < 0.01 && escena) return;
    escenaS = s;
    escena = pintarEscena(s);
    haz = pintarHaz(s);
    sombra = document.createElement('canvas');
  }

  // ------------------------------------------------------------- lo que se mueve
  function reiniciar() {
    const r = azar(77);
    L.cascotes = [];
    // los trozos del suelo que ha cedido arriba caen con el (uno es la chapa mal puesta)
    for (let n = 0; n < 7; n++) {
      const w = 0.18 + r() * 0.34, h = 0.08 + r() * 0.12;
      L.cascotes.push({ x: D.CAE_X + (r() - 0.5) * 1.3, y: 15.5 + r() * 3.5, vx: (r() - 0.5) * 0.8, vy: -9 - r() * 3,
        a: r() * 6, va: (r() - 0.5) * 9, w, h, chapa: n === 2, semilla: 90 + n, quieto: false });
    }
    L.polvo = [];
    L.motas = [];
    for (let n = 0; n < 34; n++) L.motas.push({ x: -6.6 + r() * 3.0, y: r() * 8, f: r() * 6, v: 0.04 + r() * 0.08 });
  }

  function golpe(x) {
    const r = azar(123);
    for (let n = 0; n < 46; n++) {
      const lado = n % 2 ? 1 : -1;
      L.polvo.push({ x: x + lado * r() * 0.25, y: 0.03 + r() * 0.1, vx: lado * (0.8 + r() * 2.8), vy: 0.15 + r() * 0.6,
        r: 0.03 + r() * 0.06, vida: 0.7 + r() * 0.9, t: 0 });
    }
  }

  function paso(dt) {
    const g = 30;
    for (const k of L.cascotes) {
      if (k.quieto) continue;
      k.vy -= g * dt; k.x += k.vx * dt; k.y += k.vy * dt; k.a += k.va * dt;
      const yMin = k.h / 2;
      if (k.y < yMin) {
        k.y = yMin;
        if (Math.abs(k.vy) < 2.2) { k.vy = 0; k.vx *= 0.6; k.va = 0; k.a = Math.round(k.a / Math.PI) * Math.PI; if (Math.abs(k.vx) < 0.05) k.quieto = true; }
        else { k.vy = -k.vy * 0.28; k.vx = k.vx * 0.6 + (hash(k.semilla, Math.round(k.x * 9)) - 0.5) * 1.6; k.va *= -0.5; }
      }
      const x0 = k.y > S.techo ? P.x0 : S.x0, x1 = k.y > S.techo ? P.x1 : S.x1;
      if (k.x < x0 + k.w / 2) { k.x = x0 + k.w / 2; k.vx = Math.abs(k.vx) * 0.4; }
      if (k.x > x1 - k.w / 2) { k.x = x1 - k.w / 2; k.vx = -Math.abs(k.vx) * 0.4; }
    }
    for (const p of L.polvo) {
      p.t += dt; p.vx *= Math.exp(-2.4 * dt); p.vy *= Math.exp(-1.5 * dt); p.vy += 0.05 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += 0.1 * dt;
    }
    L.polvo = L.polvo.filter((p) => p.t < p.vida);
  }

  // ------------------------------------------------------------- un fotograma
  // E: estado del paso (x, y, cara, anim, i, oscuro, lampara...), cam: { cx, cy } en metros
  function dibujar(c, E, cam) {
    const W = c.canvas.width, H = c.canvas.height, s = H / D.VISTA_H;
    const X = (x) => (x - cam.cx) * s + W / 2, Y = (y) => H / 2 - (y - cam.cy) * s;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.fillStyle = COL.masa; c.fillRect(0, 0, W, H);
    // lo quieto, recortado con la camara
    c.drawImage(escena, (cam.cx - EX0) * s - W / 2, (EY1 - cam.cy) * s - H / 2, W, H, 0, 0, W, H);
    // cascotes
    for (const k of L.cascotes) {
      if (Y(k.y) < -60 || Y(k.y) > H + 60) continue;
      c.save(); c.translate(X(k.x), Y(k.y)); c.rotate(-k.a); c.scale(s / U, s / U);
      caja(c, -k.w * U / 2, -k.h * U / 2, k.w * U, k.h * U, k.chapa ? COL.chapa : COL.cascote, k.semilla, 1.1, GROSOR * 0.8);
      if (k.chapa) linea(c, -k.w * U * 0.4, -1, k.w * U * 0.4, -1, 1, 'rgba(255,255,255,.12)', 3, 0.2);
      c.restore();
    }
    // el 18
    if (E.ver18 !== false) dibujarSprite(c, sprites, E.anim, E.i, X(E.x), Y(E.y), E.cara, s, 1, 1 - 0.5 * E.oscuro);
    // polvo del golpe
    for (const p of L.polvo) {
      const a = 0.16 * (1 - p.t / p.vida) * (1 - p.t / p.vida);
      c.fillStyle = rgba(COL.polvo, a);
      c.beginPath(); c.arc(X(p.x), Y(p.y), p.r * s, 0, 7); c.fill();
    }
    // PENUMBRA: velo oscuro con huecos donde hay luz (haz del pozo, lampara, el 18) y luego el color de las luces
    if (sombra.width !== W || sombra.height !== H) { sombra.width = W; sombra.height = H; }
    const o = sombra.getContext('2d');
    const ok = E.oscuro;
    o.globalCompositeOperation = 'source-over';
    o.clearRect(0, 0, W, H);
    o.fillStyle = `rgba(3,5,8,${0.56 + 0.43 * ok})`;
    o.fillRect(0, 0, W, H);
    o.globalCompositeOperation = 'destination-out';
    o.globalAlpha = 0.85 * (1 - ok);
    o.drawImage(haz.cv, X(haz.x0), Y(haz.y1));
    o.globalAlpha = 1;
    const lamp = E.lampara * (1 - ok);
    agujero(o, X(-0.7), Y(2.52), 2.3 * s, 0.75 * lamp);
    const r18 = (2.1 - 0.9 * ok) * s;
    agujero(o, X(E.x), Y(E.y + 0.55), r18, 0.5 + 0.42 * ok);
    c.drawImage(sombra, 0, 0);
    // color de las luces
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.15 * (1 - ok);
    c.filter = 'none';
    c.drawImage(haz.cv, X(haz.x0), Y(haz.y1));
    c.globalAlpha = 1;
    brillo(c, X(-0.7), Y(2.52), 1.5 * s, `rgba(255,191,114,${0.28 * lamp})`);
    brillo(c, X(-0.7), Y(2.52), 0.18 * s, `rgba(255,226,180,${0.9 * lamp})`);
    brillo(c, X(E.x), Y(E.y + 0.55), 1.0 * s, `rgba(255,244,226,${0.07 + 0.05 * ok})`);
    // motas en el haz
    for (const m of L.motas) {
      const y = ((m.y + E.t * m.v) % 8.5), x = m.x + Math.sin(E.t * 0.6 + m.f) * 0.15;
      const a = (0.35 + 0.35 * Math.sin(E.t * 1.7 + m.f)) * (1 - ok);
      c.fillStyle = `rgba(234,240,248,${a * 0.6})`;
      c.fillRect(X(x), Y(y), Math.max(1, 0.025 * s), Math.max(1, 0.025 * s));
    }
    c.globalCompositeOperation = 'source-over';
    // primer plano en silueta (parallax 1,35): un cable que cuelga y ferralla abajo a la derecha
    const PX = (x) => (x - cam.cx) * s * 1.35 + W / 2, PY = (y) => H / 2 - (y - cam.cy) * s * 1.35;
    c.fillStyle = '#040506';
    c.beginPath();
    c.moveTo(PX(-7.9), PY(9)); c.quadraticCurveTo(PX(-7.6), PY(5), PX(-7.75), PY(2.9)); c.lineTo(PX(-7.68), PY(2.9));
    c.quadraticCurveTo(PX(-7.52), PY(5), PX(-7.82), PY(9)); c.fill();
    c.fillRect(PX(-7.83), PY(2.9), 0.06 * s * 1.35, 0.3 * s * 1.35);
    c.beginPath();
    c.moveTo(PX(4.0), PY(-2.2)); c.lineTo(PX(4.4), PY(-0.55)); c.lineTo(PX(5.3), PY(-0.95)); c.lineTo(PX(5.6), PY(-0.25));
    c.lineTo(PX(6.6), PY(-0.7)); c.lineTo(PX(7.4), PY(-2.2)); c.closePath(); c.fill();
    c.lineWidth = 0.035 * s * 1.35; c.strokeStyle = '#040506';
    for (const [a, b] of [[[4.5, -0.6], [4.2, 0.5]], [[5.4, -0.4], [5.9, 0.7]], [[6.3, -0.6], [6.1, 0.25]]]) {
      c.beginPath(); c.moveTo(PX(a[0]), PY(a[1])); c.lineTo(PX(b[0]), PY(b[1])); c.stroke();
    }
  }

  function agujero(o, x, y, r, a) {
    if (a <= 0) return;
    const g = o.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.5, `rgba(0,0,0,${a * 0.55})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    o.fillStyle = g; o.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  function brillo(c, x, y, r, col) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r);
  }

  // EL 18 SOLO, con la misma luz que le da dibujar() (el velo de la penumbra con sus huecos y lo que suman las luces):
  // es la CAPA DEL 18 de main.js, la textura del 18 de carton. Asi el 18 es UN plano de principio a fin: el 2D no lo
  // pinta (E.ver18 = false) y lo que se ve es siempre esta imagen, primero de frente y luego girando con la camara.
  // X, Y y s llevan del mundo al lienzo de la capa; fuera de la silueta y de su borde de luz queda transparente
  const velo18 = document.createElement('canvas'), mascara18 = document.createElement('canvas');
  function pintar18(c, E, X, Y, s) {
    const w = c.canvas.width, h = c.canvas.height;
    for (const cv of [velo18, mascara18]) if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.filter = 'none';
    c.clearRect(0, 0, w, h);
    dibujarSprite(c, sprites, E.anim, E.i, X(E.x), Y(E.y), E.cara, s, 1, 1 - 0.5 * E.oscuro);
    const m = mascara18.getContext('2d');
    m.globalCompositeOperation = 'copy'; m.drawImage(c.canvas, 0, 0); m.globalCompositeOperation = 'source-over';
    // el velo en este trozo, con los mismos huecos que en dibujar()
    const o = velo18.getContext('2d'), ok = E.oscuro, ks = s / escenaS;
    o.globalCompositeOperation = 'source-over'; o.globalAlpha = 1;
    o.clearRect(0, 0, w, h);
    o.fillStyle = `rgba(3,5,8,${0.56 + 0.43 * ok})`;
    o.fillRect(0, 0, w, h);
    o.globalCompositeOperation = 'destination-out';
    if (ok < 0.999) { o.globalAlpha = 0.85 * (1 - ok); o.drawImage(haz.cv, X(haz.x0), Y(haz.y1), haz.cv.width * ks, haz.cv.height * ks); o.globalAlpha = 1; }
    const lamp = E.lampara * (1 - ok);
    agujero(o, X(-0.7), Y(2.52), 2.3 * s, 0.75 * lamp);
    agujero(o, X(E.x), Y(E.y + 0.55), (2.1 - 0.9 * ok) * s, 0.5 + 0.42 * ok);
    c.globalCompositeOperation = 'source-atop';
    c.drawImage(velo18, 0, 0);
    // lo que suman las luces
    c.globalCompositeOperation = 'lighter';
    if (ok < 0.999) { c.globalAlpha = 0.15 * (1 - ok); c.drawImage(haz.cv, X(haz.x0), Y(haz.y1), haz.cv.width * ks, haz.cv.height * ks); c.globalAlpha = 1; }
    brillo(c, X(-0.7), Y(2.52), 1.5 * s, `rgba(255,191,114,${0.28 * lamp})`);
    brillo(c, X(-0.7), Y(2.52), 0.18 * s, `rgba(255,226,180,${0.9 * lamp})`);
    brillo(c, X(E.x), Y(E.y + 0.55), 1.0 * s, `rgba(255,244,226,${0.07 + 0.05 * ok})`);
    for (const mo of L.motas) {
      const y = ((mo.y + E.t * mo.v) % 8.5), x = mo.x + Math.sin(E.t * 0.6 + mo.f) * 0.15;
      const a = (0.35 + 0.35 * Math.sin(E.t * 1.7 + mo.f)) * (1 - ok);
      if (a <= 0) continue;
      c.fillStyle = `rgba(234,240,248,${a * 0.6})`;
      c.fillRect(X(x), Y(y), Math.max(1, 0.025 * s), Math.max(1, 0.025 * s));
    }
    // y solo donde hay 18 (lighter tambien suma alfa)
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(mascara18, 0, 0);
    c.globalCompositeOperation = 'source-over';
  }

  return { redimensionar, reiniciar, golpe, paso, dibujar, pintar18, L };
}
