// EL 2D: la sala dentro del muro donde acaba la caida y la boca del conducto, pintada en un lienzo 2D como el juego
// (boundland/web/dibujo: una sola tinta, masa oscura, fondo de hormigon en penumbra, luz con intencion, el 18 lo mas
// luminoso). Se dibuja en UNIDADES DEL JUEGO (64 u/m, y hacia abajo) para usar tinta.js tal cual.
//
// Lo quieto (fondo, masa, tinta, atrezo) se pinta UNA vez en un lienzo grande anclado al mundo y cada fotograma solo se
// recorta con la camara; lo que se mueve (cascotes, polvo, el 18, la luz) va encima.
//
// EL FONDO (pedido: «mejora el fondo del 2D al maximo»), como los fondos del juego (capas con bruma entre ellas, lo
// lejano mas claro y sin tinta gorda): la pared de la sala son paneles prefabricados con su bisel, poros, anclajes de
// izado que chorrean oxido, humedad que sube del suelo con moho, eflorescencia en las juntas, grietas con labio y un
// remiendo; un BOQUETE en la pared deja ver la GALERIA de dentro del muro en dos capas con paralaje (la nave lejana con
// pasarela, escalera, columnas, lamparas colgadas y una puerta encendida, y una tuberia grande mas cerca), con su bruma
// que pasa; el pozo es de anillos con la escalerilla, cables y musgo arriba; y lo vivo: una brida que GOTEA en un
// charco que refleja la luz, un VENTILADOR que gira detras de una rejilla con luz al otro lado, neblina a ras de suelo
// que solo se ve donde hay luz, la lampara que falla al fondo y mas primer plano en silueta.
import { D } from './datos.js';
import { TINTA, GROSOR, temblar, trazar, tinta, caja, linea, circulo, hash, azar, rgba, ruido1, hex } from './tinta.js';
import { dibujarSprite } from './sprites.js';

const U = 64;                                  // unidades por metro
const EX0 = -13, EX1 = 13, EY0 = -5, EY1 = 18;  // lo que cubre el lienzo quieto (m)
const COL = {
  masa: '#11151a', masaClara: '#262e37', fondo: '#29323c', fondoPozo: '#1f262e', fondoConducto: '#151b22',
  costilla: '#212932', borde: '#aebccb', tuberia: '#2e3843', cascote: '#3a434d', chapa: '#4b535c',
  calida: '#ffbf72', fria: '#bcd3e6', polvo: '#eadfca', corte: '#3c4651', acero: '#1f262e',
};
const tono = (h, k) => { const p = hex(h); return `rgb(${Math.min(255, p[0] * k) | 0},${Math.min(255, p[1] * k) | 0},${Math.min(255, p[2] * k) | 0})`; };

// el hueco donde se puede estar, en metros (y arriba)
const S = D.SALA, P = D.POZO, C = D.CONDUCTO;
const HUECO = [[S.x0, 0], [C.x1, 0], [C.x1, C.alto], [C.x0, C.alto], [S.x1, S.techo], [P.x1, S.techo], [P.x1, P.alto],
  [P.x0, P.alto], [P.x0, S.techo], [S.x0, S.techo]];
const u = (p) => [p[0] * U, -p[1] * U];        // metros (y arriba) -> unidades del juego (y abajo)

// el BOQUETE de la pared de la sala: por el se ve la galeria de dentro del muro (su caja, para recortar al pintarla)
const BOQUETE = [[-3.95, 0.62], [-3.6, 0.5], [-3.1, 0.58], [-2.75, 0.47], [-2.3, 0.55], [-2.02, 0.7], [-1.98, 1.25], [-2.08, 1.5],
  [-1.95, 2.05], [-2.05, 2.6], [-1.97, 3.0], [-2.15, 3.4], [-2.4, 3.62], [-2.7, 3.98], [-3.05, 4.1], [-3.4, 3.92], [-3.75, 4.02],
  [-3.98, 3.6], [-4.12, 3.05], [-4.02, 2.5], [-4.15, 1.95], [-4.05, 1.4], [-4.12, 0.95]];
const BQ = { x0: -4.2, x1: -1.9, y0: 0.42, y1: 4.15 };
// la rejilla de ventilacion, abajo a la izquierda, con el ventilador detras
const REJA = { x0: -8.62, x1: -7.92, y0: 0.2, y1: 0.82 };
// la brida que gotea y su charco
const GOTA = { x: -6.95, y: 4.26, T: 2.6 };
const CHARCO = { x0: -7.75, x1: -6.1 };
// las dos capas de detras del boquete: f es lo que se mueven con la camara (la nave lejana y la tuberia de en medio)
const LEJOS = { f: 0.58, x0: -11, x1: 4, y0: -3, y1: 7.5 };
const MEDIO = { f: 0.8, x0: -10.5, x1: 3.5, y0: -2.2, y1: 6.5 };
// las lamparas de la nave (en coordenadas de la capa lejana); la segunda falla
const LAMPARAS = [{ x: -5.8, y: 4.15, falla: false }, { x: -1.3, y: 3.95, falla: true }];
const PUERTA = { x0: -3.55, x1: -2.65, y0: -0.9, y1: 1.0 };

export function crearPlano(sprites) {
  let escena = null, escenaS = 0, sombra = null, haz = null, lejos = null, medio = null, bruma = null;
  const tmp = document.createElement('canvas');
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
    // el BOQUETE y la REJILLA se recortan: por ellos se ve lo de detras, que se pinta aparte con su paralaje
    const bq = temblar(BOQUETE.map(u), 9, 1.4, 8);
    c.save();
    c.globalCompositeOperation = 'destination-out';
    trazar(c, bq); c.fill();
    c.fillRect(REJA.x0 * U, -REJA.y1 * U, (REJA.x1 - REJA.x0) * U, (REJA.y1 - REJA.y0) * U);
    c.restore();
    bordeBoquete(c, bq);
    rejilla(c);
    // tinta del hueco y canto encendido del suelo (el borde de luz de luz.js del juego)
    trazar(c, hueco); tinta(c, GROSOR * 1.15);
    c.fillStyle = '#1b2128'; c.fillRect(S.x0 * U, 1.5, (C.x1 - S.x0) * U, 0.16 * U);
    linea(c, S.x0 * U + 4, 2.4, C.x1 * U, 2.4, 1.8, rgba(COL.borde, 0.5), 9, 0.6);
    atrezo(c);
    return cv;
  }

  // un panel prefabricado de la sala: tono propio, vetas del encofrado, poros, el bisel (luz arriba, sombra abajo y a
  // la derecha) y las dos cazoletas de izado, alguna con su chorreon de oxido (pardo)
  function panel(c, x0, y0, x1, y1, r) {
    const X0 = x0 * U, X1 = x1 * U, YA = -y1 * U, YB = -y0 * U;
    const k = 0.86 + r() * 0.22;
    const g = c.createLinearGradient(0, YA, 0, YB);
    g.addColorStop(0, tono(COL.fondo, k * 1.08)); g.addColorStop(1, tono(COL.fondo, k * 0.88));
    c.fillStyle = g; c.fillRect(X0, YA, X1 - X0, YB - YA);
    for (let n = 0; n < 12; n++) { c.fillStyle = `rgba(${r() < 0.55 ? '8,10,13' : '170,185,200'},${0.02 + r() * 0.035})`; c.fillRect(X0, YA + r() * (YB - YA), X1 - X0, 0.6 + r() * 1.6); }
    for (let n = 0; n < 26; n++) {
      const x = X0 + r() * (X1 - X0), y = YA + r() * (YB - YA), rr = (0.15 + r() * 0.5) * U;
      const gm = c.createRadialGradient(x, y, 0, x, y, rr);
      const v = r() < 0.6 ? '8,10,13' : '160,175,190';
      gm.addColorStop(0, `rgba(${v},${0.03 + r() * 0.06})`); gm.addColorStop(1, `rgba(${v},0)`);
      c.fillStyle = gm; c.fillRect(x - rr, y - rr, 2 * rr, 2 * rr);
    }
    for (let n = 0; n < 80; n++) {
      const px = X0 + r() * (X1 - X0), py = YA + r() * (YB - YA), rr = 0.35 + r() * r() * 2.2;
      c.fillStyle = 'rgba(5,7,9,.5)'; c.beginPath(); c.arc(px, py, rr, 0, 7); c.fill();
      if (rr > 1.3) { c.fillStyle = 'rgba(175,190,205,.08)'; c.beginPath(); c.arc(px + 0.3, py + rr * 0.55, rr * 0.75, 0, Math.PI); c.fill(); }
    }
    c.fillStyle = 'rgba(180,198,215,.10)'; c.fillRect(X0, YA, X1 - X0, 2.4);
    c.fillStyle = 'rgba(180,198,215,.05)'; c.fillRect(X0, YA, 2.4, YB - YA);
    c.fillStyle = 'rgba(3,5,7,.42)'; c.fillRect(X0, YB - 3.6, X1 - X0, 3.6);
    c.fillStyle = 'rgba(3,5,7,.3)'; c.fillRect(X1 - 3.6, YA, 3.6, YB - YA);
    for (const fx of [0.22, 0.78]) {
      const ax = X0 + (X1 - X0) * fx, ay = YA + 0.26 * U;
      if (ay > YB - 0.25 * U || X1 - X0 < 1.2 * U) continue;
      if (r() < 0.6) {
        const Lr = (0.25 + r() * 0.8) * U, gr = c.createLinearGradient(0, ay, 0, ay + Lr);
        gr.addColorStop(0, `rgba(66,52,42,${0.28 + r() * 0.25})`); gr.addColorStop(1, 'rgba(66,52,42,0)');
        c.fillStyle = gr; c.fillRect(ax - 1.5 - r() * 2, ay, 3 + r() * 4, Lr);
      }
      c.fillStyle = 'rgba(4,5,7,.85)'; c.beginPath(); c.arc(ax, ay, 0.042 * U, 0, 7); c.fill();
      c.strokeStyle = 'rgba(175,190,205,.14)'; c.lineWidth = 1.2; c.beginPath(); c.arc(ax, ay, 0.052 * U, 0.25, Math.PI - 0.25); c.stroke();
    }
  }
  // un anillo del pozo (1 m): sombreado de lado a lado como un tubo, bisel en la junta
  function anillo(c, y0, r) {
    const X0 = P.x0 * U, X1 = P.x1 * U, YA = -(y0 + 1) * U, YB = -y0 * U;
    const k = 0.85 + r() * 0.22, g = c.createLinearGradient(X0, 0, X1, 0);
    g.addColorStop(0, tono(COL.fondoPozo, k * 0.62)); g.addColorStop(0.45, tono(COL.fondoPozo, k * 1.12)); g.addColorStop(1, tono(COL.fondoPozo, k * 0.58));
    c.fillStyle = g; c.fillRect(X0, YA, X1 - X0, YB - YA);
    c.fillStyle = 'rgba(180,198,215,.08)'; c.fillRect(X0, YA, X1 - X0, 2.2);
    c.fillStyle = 'rgba(3,5,7,.45)'; c.fillRect(X0, YB - 3, X1 - X0, 3);
    for (let n = 0; n < 40; n++) { c.fillStyle = 'rgba(5,7,9,.45)'; c.beginPath(); c.arc(X0 + r() * (X1 - X0), YA + r() * (YB - YA), 0.4 + r() * r() * 1.8, 0, 7); c.fill(); }
  }

  function pintarFondo(c) {
    const r = azar(5);
    c.fillStyle = COL.fondo; c.fillRect(S.x0 * U, -S.techo * U, (S.x1 - S.x0) * U, S.techo * U);
    c.fillStyle = COL.fondoPozo; c.fillRect(P.x0 * U, -P.alto * U, (P.x1 - P.x0) * U, (P.alto - S.techo) * U);
    // los paneles (3 x 1,5) y los anillos del pozo (1 m)
    for (let y0 = 0; y0 < S.techo - 0.01; y0 += 1.5) for (let x0 = S.x0; x0 < S.x1 - 0.01; x0 += 3) panel(c, x0, y0, Math.min(S.x1, x0 + 3), Math.min(S.techo, y0 + 1.5), r);
    for (let y0 = S.techo; y0 < P.alto; y0 += 1) anillo(c, y0, r);
    // chorretones desde las juntas, y la eflorescencia (cal blanca) que sale de alguna
    for (let n = 0; n < 60; n++) {
      const x = S.x0 + 0.2 + r() * (S.x1 - S.x0 - 0.4), y0 = [1.5, 3, 4.5, S.techo][Math.floor(r() * 4)], blanca = r() < 0.25;
      const largo = 0.4 + r() * 1.3, g = c.createLinearGradient(0, -y0 * U, 0, -(y0 - largo) * U);
      const v = blanca ? '190,200,205' : '8,10,13', a = blanca ? 0.06 + r() * 0.06 : 0.14 + r() * 0.2;
      g.addColorStop(0, `rgba(${v},${a})`); g.addColorStop(1, `rgba(${v},0)`);
      c.fillStyle = g;
      const w = (0.025 + r() * 0.09) * U;
      c.beginPath(); c.moveTo(x * U, -y0 * U);
      for (let k = 0; k <= 6; k++) c.lineTo(x * U + Math.sin(k * 1.7 + x) * 1.2, -(y0 - largo * k / 6) * U);
      c.lineTo(x * U + w * 0.5, -(y0 - largo) * U); c.lineTo(x * U + w, -y0 * U); c.closePath(); c.fill();
    }
    // la HUMEDAD que sube del suelo, con su borde de cal y el moho de abajo; mas alta bajo la gotera
    c.beginPath(); c.moveTo(S.x0 * U, 0);
    const borde = [];
    for (let x = S.x0; x <= S.x1 + 0.001; x += 0.08) {
      const cerca = Math.max(0, 1 - Math.abs(x - GOTA.x) / 0.9);
      const h = 0.3 + 0.32 * ruido1(x * 1.1, 4) + 0.12 * ruido1(x * 4.6, 9) + 0.75 * cerca * cerca;
      borde.push([x * U, -h * U]); c.lineTo(x * U, -h * U);
    }
    c.lineTo(S.x1 * U, 0); c.closePath();
    const gh = c.createLinearGradient(0, 0, 0, -1.3 * U);
    gh.addColorStop(0, 'rgba(4,7,9,.6)'); gh.addColorStop(1, 'rgba(4,7,9,.12)');
    c.fillStyle = gh; c.fill();
    trazar(c, borde, false); c.lineWidth = 1.6; c.strokeStyle = 'rgba(190,200,205,.07)'; c.stroke();
    for (let n = 0; n < 320; n++) {
      const x = S.x0 + r() * (S.x1 - S.x0), y = r() * r() * 0.55, rr = 0.5 + r() * 2.6;
      c.fillStyle = `rgba(${44 + r() * 10 | 0},${58 + r() * 10 | 0},${50 + r() * 8 | 0},${0.25 + r() * 0.35})`;
      c.beginPath(); c.arc(x * U, -y * U, rr, 0, 7); c.fill();
    }
    // el rastro mojado de la gotera hasta el suelo y la costra de cal bajo la brida
    {
      const g = c.createLinearGradient(0, -GOTA.y * U, 0, 0);
      g.addColorStop(0, 'rgba(4,6,8,.45)'); g.addColorStop(1, 'rgba(4,6,8,.2)');
      c.fillStyle = g; c.fillRect((GOTA.x - 0.06) * U, -GOTA.y * U, 0.12 * U, GOTA.y * U);
      linea(c, (GOTA.x + 0.035) * U, -GOTA.y * U, (GOTA.x + 0.03) * U, 0, 1.1, 'rgba(190,212,228,.13)', 91, 0.5);
      const gc = c.createRadialGradient(GOTA.x * U, -(GOTA.y - 0.15) * U, 0, GOTA.x * U, -(GOTA.y - 0.15) * U, 0.3 * U);
      gc.addColorStop(0, 'rgba(195,205,208,.16)'); gc.addColorStop(1, 'rgba(195,205,208,0)');
      c.fillStyle = gc; c.fillRect((GOTA.x - 0.3) * U, -(GOTA.y + 0.15) * U, 0.6 * U, 0.6 * U);
    }
    // hollin sobre la lampara de la boca del conducto
    {
      const g = c.createRadialGradient(-0.7 * U, -3.1 * U, 0, -0.7 * U, -3.1 * U, 0.9 * U);
      g.addColorStop(0, 'rgba(3,4,6,.4)'); g.addColorStop(1, 'rgba(3,4,6,0)');
      c.fillStyle = g; c.fillRect(-1.6 * U, -4 * U, 1.8 * U, 1.8 * U);
    }
    // grietas: la raja (tinta) y su labio de luz
    for (const g of [[-7.6, 3.9, 6], [-0.9, 4.9, 5], [-5.0, 1.2, 4], [-8.4, 2.9, 5], [-4.6, 4.7, 4]]) {
      const pts = [[g[0] * U, -g[1] * U]];
      const rr = azar(g[2] * 7 + g[0] * 3 | 0);
      for (let i = 0; i < g[2]; i++) { const p = pts[pts.length - 1]; pts.push([p[0] + (rr() - 0.4) * 22, p[1] + 10 + rr() * 14]); }
      trazar(c, pts.map(([x, y]) => [x + 1.4, y + 1.4]), false); c.lineWidth = 1.2; c.strokeStyle = 'rgba(175,195,210,.10)'; c.stroke();
      trazar(c, pts, false); c.lineWidth = 1.6; c.strokeStyle = 'rgba(4,6,8,.75)'; c.stroke();
    }
    // un remiendo de mortero, mas claro, con las pasadas de la llana
    {
      const x0 = -8.05, y0 = 2.05, w = 0.85, h = 0.62;
      const pts = temblar([[x0 * U, -y0 * U], [(x0 + w) * U, -(y0 + 0.04) * U], [(x0 + w - 0.03) * U, -(y0 + h) * U], [(x0 + 0.02) * U, -(y0 + h - 0.03) * U]], 6, 1.6, 33);
      trazar(c, pts); c.fillStyle = tono(COL.fondo, 1.16); c.fill();
      c.save(); trazar(c, pts); c.clip();
      c.strokeStyle = 'rgba(8,10,13,.12)'; c.lineWidth = 1;
      for (let k = 0; k < 7; k++) { c.beginPath(); c.arc((x0 + 0.1 + k * 0.12) * U, -(y0 + 0.15 + (k % 3) * 0.17) * U, 0.22 * U, 3.6, 5.6); c.stroke(); }
      c.restore();
      trazar(c, pts); c.lineWidth = 1; c.strokeStyle = 'rgba(8,10,13,.4)'; c.stroke();
    }
    // codigos de panel estarcidos (sin palabras: el juego va en ingles)
    c.font = `700 ${0.13 * U}px Bahnschrift, "Segoe UI", sans-serif`;
    c.fillStyle = 'rgba(185,198,210,.16)';
    for (const [x, y, t] of [[-8.75, 1.62, 'C7-01'], [-5.75, 3.12, 'C7-06'], [-2.75, 4.62, 'C7-11'], [-8.75, 4.62, 'C7-09']]) c.fillText(t, x * U, -y * U);
    // la escalerilla del pozo, rota: por ahi no ha bajado nadie en anos; con sus soportes y el oxido que sueltan
    for (const x of [P.x0 + 0.35, P.x1 - 0.35]) linea(c, x * U, -(S.techo + 0.3) * U, x * U, -(P.alto) * U, 2.2, 'rgba(10,12,15,.8)', 60 + x, 0.3);
    for (let y = S.techo + 0.6; y < P.alto; y += 0.32) {
      if (hash(Math.round(y * 10), 3) < 0.18) continue;
      linea(c, (P.x0 + 0.35) * U, -y * U, (P.x1 - 0.35) * U, -y * U, 1.8, 'rgba(10,12,15,.75)', 70 + y, 0.3);
    }
    for (let y = S.techo + 1.0; y < P.alto; y += 1.2) for (const x of [P.x0 + 0.2, P.x1 - 0.5]) {
      c.fillStyle = 'rgba(10,12,15,.8)'; c.fillRect(x * U, -(y + 0.04) * U, 0.3 * U, 0.08 * U);
      const g = c.createLinearGradient(0, -y * U, 0, -(y - 0.6) * U); g.addColorStop(0, 'rgba(70,54,44,.35)'); g.addColorStop(1, 'rgba(70,54,44,0)');
      c.fillStyle = g; c.fillRect((x + 0.12) * U, -y * U, 0.05 * U, 0.6 * U);
    }
    // el mazo de cables que baja por el pozo, con sus grapas
    for (let k = 0; k < 3; k++) linea(c, (P.x1 - 0.13 - k * 0.035) * U, -(S.techo + 0.1) * U, (P.x1 - 0.12 - k * 0.035) * U, -P.alto * U, 1.6, 'rgba(6,8,10,.85)', 120 + k, 0.5);
    for (let y = S.techo + 0.5; y < P.alto; y += 0.9) { c.fillStyle = 'rgba(30,36,43,.9)'; c.fillRect((P.x1 - 0.24) * U, -y * U, 0.15 * U, 0.04 * U); }
    // agua y musgo que bajan de arriba (la luz y la lluvia entran por la boca del pozo)
    for (let n = 0; n < 22; n++) {
      const x = P.x0 + 0.1 + r() * (P.x1 - P.x0 - 0.2), y0 = S.techo + 3 + r() * (P.alto - S.techo - 3), largo = 1 + r() * 3;
      const g = c.createLinearGradient(0, -y0 * U, 0, -(y0 - largo) * U); g.addColorStop(0, 'rgba(4,6,8,.3)'); g.addColorStop(1, 'rgba(4,6,8,0)');
      c.fillStyle = g; c.fillRect(x * U, -y0 * U, (0.03 + r() * 0.06) * U, largo * U);
    }
    for (let n = 0; n < 200; n++) {
      const lado = r() < 0.5, y = 12 + r() * (P.alto - 12) * r(), x = lado ? P.x0 + r() * r() * 0.35 : P.x1 - r() * r() * 0.35;
      c.fillStyle = `rgba(${48 + r() * 12 | 0},${62 + r() * 12 | 0},${50 + r() * 8 | 0},${0.35 + r() * 0.35})`;
      c.beginPath(); c.ellipse(x * U, -y * U, 1 + r() * 4, 1 + r() * 3, 0, 0, 7); c.fill();
      if (r() < 0.12) linea(c, x * U, -y * U, (x + (lado ? 0.05 : -0.05)) * U, -(y - 0.3 - r() * 0.5) * U, 0.9, 'rgba(48,62,50,.5)', 140 + n, 0.6);
    }
    // el conducto por dentro: casi negro, con sus costillas cada metro (igual que su carton del 3D)
    c.fillStyle = COL.fondoConducto; c.fillRect(C.x0 * U, -C.alto * U, (C.x1 - C.x0) * U, C.alto * U);
    for (let x = C.x0 + 0.5; x < C.x1; x += 1) {
      c.fillStyle = COL.costilla; c.fillRect((x - 0.05) * U, -C.alto * U, 0.1 * U, C.alto * U);
      linea(c, (x - 0.05) * U, 0, (x - 0.05) * U, -C.alto * U, 1, 'rgba(0,0,0,.6)', 80 + x, 0.2);
    }
  }

  // el borde del boquete: la cara del corte (el grueso del muro, mas claro), trozos que aun cuelgan, la ferralla
  // doblada hacia fuera y la tinta
  function bordeBoquete(c, bq) {
    trazar(c, bq); c.lineWidth = 0.2 * U; c.strokeStyle = '#262d35'; c.stroke();
    trazar(c, bq.map(([x, y]) => [x + 2.2, y - 2.6])); c.lineWidth = 0.075 * U; c.strokeStyle = COL.corte; c.stroke();
    const r = azar(66);
    for (let i = 0; i < bq.length; i += 3) {
      if (r() < 0.4) continue;
      const [x, y] = bq[i], w = (0.06 + r() * 0.1) * U, h = (0.04 + r() * 0.08) * U;
      caja(c, x - w / 2, y - h / 2, w, h, r() < 0.5 ? COL.corte : '#2b333c', 300 + i, 1.2, GROSOR * 0.55);
    }
    trazar(c, bq); tinta(c, GROSOR * 0.95);
    // la ferralla: barras que salen del corte y se doblan
    for (const pts of [[[-4.13, 3.55], [-3.6, 3.6], [-3.3, 3.38]], [[-1.99, 3.2], [-2.45, 3.24], [-2.7, 3.02]], [[-3.25, 4.07], [-3.22, 3.62], [-3.42, 3.32]],
      [[-2.8, 0.5], [-2.76, 0.9], [-2.95, 1.18]], [[-4.08, 1.65], [-3.7, 1.7]], [[-2.0, 2.3], [-2.38, 2.28], [-2.5, 2.1]]]) {
      trazar(c, pts.map(u), false); tinta(c, 0.045 * U, '#1b1612');
      trazar(c, pts.map(([x, y]) => [x * U - 0.7, -y * U - 0.7]), false); c.lineWidth = 0.9; c.strokeStyle = 'rgba(120,98,82,.35)'; c.stroke();
    }
  }
  // la rejilla de ventilacion: marco atornillado y lamas finas (detras gira el ventilador)
  function rejilla(c) {
    const { x0, x1, y0, y1 } = REJA;
    for (let y = y0 + 0.05; y < y1 - 0.02; y += 0.075) {
      c.fillStyle = '#20272f'; c.fillRect(x0 * U, -(y + 0.022) * U, (x1 - x0) * U, 0.022 * U);
      c.fillStyle = 'rgba(175,195,210,.12)'; c.fillRect(x0 * U, -(y + 0.022) * U, (x1 - x0) * U, 1);
    }
    caja(c, (x0 - 0.05) * U, -(y1 + 0.05) * U, (x1 - x0 + 0.1) * U, 0.05 * U, '#2a323b', 501, 0.4, GROSOR * 0.6);
    caja(c, (x0 - 0.05) * U, -y0 * U, (x1 - x0 + 0.1) * U, 0.05 * U, '#2a323b', 502, 0.4, GROSOR * 0.6);
    caja(c, (x0 - 0.05) * U, -(y1 + 0.05) * U, 0.05 * U, (y1 - y0 + 0.1) * U, '#2a323b', 503, 0.4, GROSOR * 0.6);
    caja(c, x1 * U, -(y1 + 0.05) * U, 0.05 * U, (y1 - y0 + 0.1) * U, '#2a323b', 504, 0.4, GROSOR * 0.6);
    for (const [x, y] of [[x0 - 0.025, y1 + 0.025], [x1 + 0.025, y1 + 0.025], [x0 - 0.025, y0 - 0.025], [x1 + 0.025, y0 - 0.025]]) { c.fillStyle = '#556069'; c.beginPath(); c.arc(x * U, -y * U, 1.6, 0, 7); c.fill(); }
  }

  function atrezo(c) {
    const r = azar(31);
    // la bandeja de cables bajo el techo, con sus soportes y los cables que cuelgan entre ellos
    {
      const yb = 4.92;
      for (let x = S.x0 + 0.4; x < S.x1; x += 1.5) { linea(c, x * U, -S.techo * U, x * U, -yb * U, 1.6, 'rgba(10,12,15,.9)', 150 + x, 0.2); }
      caja(c, S.x0 * U, -(yb + 0.05) * U, (S.x1 - S.x0) * U, 0.05 * U, '#232b33', 151, 0.4, GROSOR * 0.55);
      for (let k = 0; k < 2; k++) for (let x = S.x0 + 0.4; x < S.x1 - 1.4; x += 1.5) {
        const pts = []; const sag = 0.08 + r() * 0.16;
        for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([(x + t * 1.5) * U, -(yb - 0.02 - 4 * sag * t * (1 - t) - k * 0.03) * U]); }
        trazar(c, pts, false); tinta(c, 1.3 + k * 0.4, 'rgba(6,8,10,.9)');
      }
      // un cable suelto que cuelga delante del boquete
      const pts = [];
      for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push([(-3.7 + t * 1.45) * U, -(yb - 0.05 - 1.25 * Math.sin(t * Math.PI) * (0.8 + 0.2 * t)) * U]); }
      trazar(c, pts, false); tinta(c, GROSOR * 0.7);
    }
    // tuberia a lo largo de la pared, con su sombra en la pared, abrazaderas, bridas, una valvula, un manometro y la brida
    // que gotea; y su bajante
    const y = -4.35 * U, g = 0.18 * U;
    {
      const gs = c.createLinearGradient(0, y + g / 2, 0, y + g / 2 + 0.16 * U);
      gs.addColorStop(0, 'rgba(2,3,5,.45)'); gs.addColorStop(1, 'rgba(2,3,5,0)');
      c.fillStyle = gs; c.fillRect(S.x0 * U, y + g / 2, (S.x1 - S.x0) * U, 0.16 * U);
    }
    caja(c, S.x0 * U - 4, y - g / 2, (S.x1 - S.x0) * U - 8, g, COL.tuberia, 12, 0.6, GROSOR * 0.8);
    c.fillStyle = 'rgba(175,195,212,.13)'; c.fillRect(S.x0 * U, y - g / 2 + 2, (S.x1 - S.x0) * U - 12, 2);
    for (let x = S.x0 + 0.8; x < S.x1; x += 1.5) caja(c, x * U - 4, y - g / 2 - 3, 8, g + 6, '#242c35', 13 + x, 0.4, GROSOR * 0.6);
    for (const x of [-7.4, -4.4, -1.4]) caja(c, x * U - 3, y - g / 2 - 6, 6, g + 12, '#2b343e', 20 + x, 0.3, GROSOR * 0.6);
    caja(c, GOTA.x * U - 3.5, y - g / 2 - 6, 7, g + 12, '#2b343e', 29, 0.3, GROSOR * 0.6);
    // la valvula de volante
    {
      const vx = -5.4 * U, vy = y - g / 2 - 0.12 * U;
      linea(c, vx, y - g / 2, vx, vy, 2.4, TINTA, 31, 0.2);
      circulo(c, vx, vy, 0.13 * U, null, GROSOR * 0.7, 32, 0.4);
      for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; linea(c, vx - Math.cos(a) * 0.13 * U, vy - Math.sin(a) * 0.13 * U, vx + Math.cos(a) * 0.13 * U, vy + Math.sin(a) * 0.13 * U, 1.3, TINTA, 33 + k, 0.2); }
    }
    // el manometro
    {
      const mx = -8.05 * U, my = y + g / 2 + 0.16 * U;
      linea(c, mx, y + g / 2, mx, my - 0.07 * U, 2.2, TINTA, 34, 0.2);
      circulo(c, mx, my, 0.085 * U, '#b9bfbf', GROSOR * 0.55, 35, 0.3);
      c.fillStyle = 'rgba(30,30,30,.55)'; c.beginPath(); c.arc(mx, my, 0.055 * U, Math.PI * 0.75, Math.PI * 2.25); c.lineTo(mx, my); c.fill();
      linea(c, mx, my, mx + 0.05 * U, my - 0.03 * U, 1.2, '#2a1a16', 36, 0);
    }
    caja(c, -8.55 * U, y, g, 4.35 * U, COL.tuberia, 14, 0.6, GROSOR * 0.8);
    for (const yy of [1.2, 2.6]) caja(c, -8.55 * U - 3, -yy * U, g + 6, 6, '#242c35', 15 + yy, 0.3, GROSOR * 0.5);
    // cuadro electrico con su tubo hasta la bandeja y su triangulo de peligro (pictograma, sin palabras)
    {
      const x0 = -5.95, x1 = -5.4, y0 = 2.3, y1 = 3.05;
      caja(c, x0 * U, -y1 * U, (x1 - x0) * U, (y1 - y0) * U, '#333c46', 15, 0.8, GROSOR * 0.8);
      linea(c, (x0 + 0.03) * U, -(y1 - 0.04) * U, (x0 + 0.03) * U, -(y0 + 0.04) * U, 1, 'rgba(0,0,0,.5)', 16, 0.2);
      caja(c, (x1 - 0.08) * U, -(y0 + 0.42) * U, 0.04 * U, 0.12 * U, '#1f262e', 17, 0.2, GROSOR * 0.4);
      caja(c, ((x0 + x1) / 2 - 0.03) * U, -4.92 * U, 0.06 * U, (4.92 - y1) * U, '#242c35', 18, 0.3, GROSOR * 0.5);
      c.beginPath(); c.moveTo(((x0 + x1) / 2) * U, -(y1 - 0.12) * U); c.lineTo(((x0 + x1) / 2 + 0.1) * U, -(y1 - 0.3) * U); c.lineTo(((x0 + x1) / 2 - 0.1) * U, -(y1 - 0.3) * U); c.closePath();
      c.fillStyle = 'rgba(200,184,110,.55)'; c.fill(); c.lineWidth = 1.2; c.strokeStyle = 'rgba(10,10,10,.7)'; c.stroke();
    }
    // el fluorescente muerto, colgado de una sola cadena (la otra se partio y cuelga)
    {
      const ax = -7.45, ay = S.techo, bx = -6.5;
      for (let k = 0; k < 8; k++) { c.strokeStyle = 'rgba(10,12,15,.9)'; c.lineWidth = 1.1; c.beginPath(); c.ellipse(ax * U, -(ay - 0.03 - k * 0.055) * U, 1.4, 2.4, 0, 0, 7); c.stroke(); }
      c.save(); c.translate(ax * U, -(ay - 0.47) * U); c.rotate(0.38);
      caja(c, -0.03 * U, -0.05 * U, 1.1 * U, 0.08 * U, '#2a323a', 160, 0.4, GROSOR * 0.7);
      c.fillStyle = 'rgba(160,172,180,.22)'; c.fillRect(0.02 * U, 0.02 * U, 1.0 * U, 0.025 * U);
      c.restore();
      for (let k = 0; k < 4; k++) { c.strokeStyle = 'rgba(10,12,15,.9)'; c.lineWidth = 1.1; c.beginPath(); c.ellipse(bx * U, -(ay - 0.03 - k * 0.055) * U, 1.4, 2.4, 0, 0, 7); c.stroke(); }
    }
    // rotulo de mantenimiento sobre la boca del conducto (pintura de plantilla)
    c.save();
    c.font = `700 ${0.34 * U}px Bahnschrift, "Segoe UI", sans-serif`;
    c.fillStyle = 'rgba(190,200,210,.30)';
    c.fillText('C-7', -1.75 * U, -2.95 * U);
    c.beginPath(); c.moveTo(-0.95 * U, -3.2 * U); c.lineTo(-0.62 * U, -3.07 * U); c.lineTo(-0.95 * U, -2.94 * U); c.closePath(); c.fill();
    c.restore();
    // la lampara de emergencia (enjaulada) junto a la boca, con su brazo y su tubo: el cuerpo; la luz va encima, viva
    caja(c, -0.75 * U, -2.78 * U, 0.1 * U, 0.16 * U, '#242c35', 19, 0.3, GROSOR * 0.5);
    caja(c, -0.85 * U, -2.62 * U, 0.3 * U, 0.2 * U, '#2a3138', 18, 0.4, GROSOR * 0.7);
    for (let k = 1; k < 4; k++) linea(c, (-0.85 + k * 0.075) * U, -2.64 * U, (-0.85 + k * 0.075) * U, -2.4 * U, 1, 'rgba(10,12,15,.85)', 190 + k, 0.1);
    caja(c, -0.6 * U, -4.92 * U, 0.04 * U, (4.92 - 2.62) * U, '#242c35', 191, 0.2, GROSOR * 0.4);
    // el marco de acero de la boca del conducto, con su dintel a franjas
    caja(c, -0.16 * U, -1.86 * U, 0.16 * U, 1.86 * U, COL.acero, 192, 0.3, GROSOR * 0.7);
    c.save();
    c.beginPath(); c.rect(-0.3 * U, -2.0 * U, 0.8 * U, 0.2 * U); c.clip();
    c.fillStyle = '#26221b'; c.fillRect(-0.3 * U, -2.0 * U, 0.8 * U, 0.2 * U);
    c.fillStyle = 'rgba(176,158,96,.55)';
    for (let x = -0.4; x < 1.4; x += 0.2) { c.beginPath(); c.moveTo(x * U, -1.8 * U); c.lineTo((x + 0.1) * U, -1.8 * U); c.lineTo((x + 0.2) * U, -2.0 * U); c.lineTo((x + 0.1) * U, -2.0 * U); c.closePath(); c.fill(); }
    c.restore();
    caja(c, -0.3 * U, -2.0 * U, 0.8 * U, 0.2 * U, null, 193, 0.4, GROSOR * 0.7);
    // el escombro del boquete en el suelo, y un trozo de panel apoyado en la pared
    for (let n = 0; n < 16; n++) {
      const x = -4.45 + r() * 2.8, w = (0.08 + r() * 0.3) * U, h = (0.05 + r() * 0.16) * U;
      caja(c, x * U, -h + 1 - (n > 11 ? 0.1 * U : 0), w, h, n % 3 ? COL.cascote : COL.corte, 200 + n, 1.3, GROSOR * 0.65);
    }
    c.save(); c.translate(-1.45 * U, 0); c.rotate(-0.22);
    caja(c, -0.24 * U, -0.95 * U, 0.48 * U, 0.95 * U, tono(COL.fondo, 1.05), 230, 1.6, GROSOR * 0.75);
    c.fillStyle = 'rgba(3,5,7,.35)'; c.fillRect(0.16 * U, -0.95 * U, 0.08 * U, 0.95 * U);
    linea(c, -0.22 * U, -0.6 * U, 0.1 * U, -0.75 * U, 1.2, 'rgba(4,6,8,.7)', 231, 0.8);
    c.restore();
    // cascotes viejos en las esquinas
    for (let n = 0; n < 9; n++) {
      const x = (n < 5 ? S.x0 + 0.1 + r() * 1.2 : -1.0 + r() * 0.7) * U, w = (0.12 + r() * 0.25) * U, h = (0.08 + r() * 0.14) * U;
      caja(c, x, -h + 1, w, h, COL.cascote, 40 + n, 1.4, GROSOR * 0.7);
    }
  }

  // ------------------------------------------------------------- las capas de detras del boquete
  function pintarCapa(s, Lc, pintor) {
    const sf = s * Lc.f, k = sf / U;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil((Lc.x1 - Lc.x0) * sf); cv.height = Math.ceil((Lc.y1 - Lc.y0) * sf);
    const c = cv.getContext('2d');
    c.setTransform(k, 0, 0, k, -Lc.x0 * U * k, Lc.y1 * U * k);
    pintor(c, Lc);
    return { cv, ...Lc };
  }
  // la NAVE de dentro del muro: pared del fondo, haces que entran por grietas de arriba, columnas, la viga, la pasarela
  // con su barandilla, la escalera, el suelo con charcos, una puerta con luz calida, las lamparas colgadas, cadenas y la
  // bruma (espesa abajo, una banda en medio); poca tinta y todo mas claro y mas azul cuanto mas lejos
  function pintarLejos(c, Lc) {
    const r = azar(404);
    const X0 = Lc.x0 * U, X1 = Lc.x1 * U, YT = -Lc.y1 * U, YB = -Lc.y0 * U;
    const g = c.createLinearGradient(0, YT, 0, YB);
    g.addColorStop(0, '#141b22'); g.addColorStop(0.55, '#1f2934'); g.addColorStop(1, '#2b3743');
    c.fillStyle = g; c.fillRect(X0, YT, X1 - X0, YB - YT);
    for (let x = Lc.x0; x < Lc.x1; x += 2.2) linea(c, x * U, YB, x * U, YT, 1.2, 'rgba(8,11,14,.35)', 200 + x, 0.3);
    for (let yy = -1; yy < Lc.y1; yy += 1.6) linea(c, X0, -yy * U, X1, -yy * U, 1.0, 'rgba(8,11,14,.25)', 220 + yy, 0.3);
    for (let n = 0; n < 40; n++) {
      const x = X0 + r() * (X1 - X0), y = YT + r() * (YB - YT), rr = (0.3 + r() * 1.2) * U, gm = c.createRadialGradient(x, y, 0, x, y, rr);
      gm.addColorStop(0, `rgba(8,11,14,${0.08 + r() * 0.12})`); gm.addColorStop(1, 'rgba(8,11,14,0)');
      c.fillStyle = gm; c.fillRect(x - rr, y - rr, 2 * rr, 2 * rr);
    }
    // haces de luz que entran por grietas del techo
    for (const [x, w, a] of [[-7.2, 0.45, 0.12], [-3.2, 0.3, 0.09], [0.6, 0.55, 0.08]]) {
      const gg = c.createLinearGradient(0, YT, 0, 0.9 * U);
      gg.addColorStop(0, `rgba(190,210,228,${a})`); gg.addColorStop(1, 'rgba(190,210,228,0)');
      c.fillStyle = gg; c.beginPath(); c.moveTo(x * U, YT); c.lineTo((x + w) * U, YT); c.lineTo((x + w + 1.7) * U, 0.9 * U); c.lineTo((x + 0.8) * U, 0.9 * U); c.closePath(); c.fill();
    }
    // columnas
    for (const x of [-9.4, -6.7, -0.55, 2.7]) {
      c.fillStyle = '#18212a'; c.fillRect((x - 0.26) * U, YT, 0.52 * U, 0.9 * U - YT);
      c.fillStyle = 'rgba(150,170,190,.07)'; c.fillRect((x - 0.26) * U, YT, 2, 0.9 * U - YT);
      c.fillStyle = 'rgba(4,6,8,.25)'; c.fillRect((x + 0.16) * U, YT, 0.1 * U, 0.9 * U - YT);
    }
    // la viga en I
    c.fillStyle = '#131a21';
    c.fillRect(X0, -5.0 * U, X1 - X0, 0.09 * U); c.fillRect(X0, -4.62 * U, X1 - X0, 0.09 * U); c.fillRect(X0, -4.95 * U, X1 - X0, 0.4 * U);
    for (let x = Lc.x0 + 0.3; x < Lc.x1; x += 0.9) { c.fillStyle = 'rgba(150,170,190,.06)'; c.fillRect(x * U, -4.92 * U, 2, 0.32 * U); }
    // la pasarela a 1,6: tablero, cercha de debajo, barandilla y colgadores hasta la viga
    c.fillStyle = '#10161c'; c.fillRect(X0, -1.66 * U, X1 - X0, 0.1 * U);
    c.strokeStyle = 'rgba(14,19,24,.95)'; c.lineWidth = 2.2;
    c.beginPath();
    for (let x = Lc.x0, k = 0; x < Lc.x1; x += 0.45, k++) { c.lineTo(x * U, -(k % 2 ? 1.28 : 1.56) * U); }
    c.stroke();
    c.fillRect(X0, -1.3 * U, X1 - X0, 0.04 * U);
    for (let x = Lc.x0; x < Lc.x1; x += 1.1) { c.fillRect(x * U - 1.2, -2.66 * U, 2.4, 1.0 * U); }
    c.fillRect(X0, -2.66 * U, X1 - X0, 0.035 * U); c.fillRect(X0, -2.16 * U, X1 - X0, 0.025 * U);
    for (let x = Lc.x0 + 0.5; x < Lc.x1; x += 3.3) { c.fillRect(x * U - 1, -4.6 * U, 2, (4.6 - 1.66) * U); }
    // la escalera, de abajo a la pasarela
    {
      const ax = -7.3, ay = -0.9, bx = -4.4, by = 1.6;
      c.strokeStyle = '#10161c'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(ax * U, -ay * U); c.lineTo(bx * U, -by * U); c.stroke();
      c.beginPath(); c.moveTo(ax * U, -(ay + 0.9) * U); c.lineTo(bx * U, -(by + 0.9) * U); c.stroke();
      const n = 14;
      for (let i = 0; i < n; i++) { const t = i / n, x = ax + (bx - ax) * t, yy = ay + (by - ay) * t; c.fillStyle = '#10161c'; c.fillRect(x * U, -(yy + 0.02) * U, ((bx - ax) / n) * U, 0.05 * U); }
      for (let i = 0; i <= 4; i++) { const t = i / 4, x = ax + (bx - ax) * t, yy = ay + (by - ay) * t; c.fillRect(x * U - 1, -(yy + 0.9) * U, 2, 0.9 * U); }
    }
    // el suelo de la nave, con charcos que reflejan
    c.fillStyle = '#0f141a'; c.fillRect(X0, 0.9 * U, X1 - X0, YB - 0.9 * U);
    for (let n = 0; n < 10; n++) { const x = Lc.x0 + r() * (Lc.x1 - Lc.x0); c.fillStyle = `rgba(120,140,160,${0.05 + r() * 0.07})`; c.beginPath(); c.ellipse(x * U, 0.95 * U, (0.3 + r() * 0.9) * U, 2 + r() * 2, 0, 0, 7); c.fill(); }
    // bidones y cajas en el suelo y en la pasarela (siluetas)
    for (const [x, yy, w, h] of [[-8.6, -0.9, 0.5, 0.75], [-8.0, -0.9, 0.45, 0.6], [-1.9, -0.9, 0.8, 0.5], [-5.6, 1.6, 0.6, 0.4], [0.9, 1.6, 0.45, 0.65]]) {
      c.fillStyle = '#121820'; c.fillRect(x * U, -(yy + h) * U, w * U, h * U);
      c.fillStyle = 'rgba(150,170,190,.06)'; c.fillRect(x * U, -(yy + h) * U, w * U, 2);
    }
    // la puerta del fondo, encendida (lo calido solo en lo que brilla)
    {
      const { x0, x1, y0, y1 } = PUERTA;
      const gp = c.createLinearGradient(0, -y1 * U, 0, -y0 * U);
      gp.addColorStop(0, '#6f5a43'); gp.addColorStop(1, '#a68660');
      c.fillStyle = gp; c.fillRect(x0 * U, -y1 * U, (x1 - x0) * U, (y1 - y0) * U);
      c.fillStyle = 'rgba(30,24,20,.55)'; c.fillRect((x0 + 0.08) * U, -(y1 - 0.25) * U, 0.18 * U, (y1 - y0 - 0.4) * U);
      c.strokeStyle = '#121820'; c.lineWidth = 0.08 * U; c.strokeRect(x0 * U, -y1 * U, (x1 - x0) * U, (y1 - y0) * U);
      const gl = c.createLinearGradient(0, 0.9 * U, 0, 0.9 * U + 0.4 * U);
      gl.addColorStop(0, 'rgba(200,160,110,.35)'); gl.addColorStop(1, 'rgba(200,160,110,0)');
      c.fillStyle = gl; c.beginPath(); c.moveTo(x0 * U, 0.9 * U); c.lineTo(x1 * U, 0.9 * U); c.lineTo((x1 + 0.6) * U, 1.3 * U); c.lineTo((x0 - 0.6) * U, 1.3 * U); c.closePath(); c.fill();
    }
    // las lamparas colgadas de la viga (el cuerpo; la luz va encima y una falla)
    for (const l of LAMPARAS) {
      c.fillStyle = '#10161c'; c.fillRect(l.x * U - 1, -4.6 * U, 2, (4.6 - l.y - 0.1) * U);
      c.beginPath(); c.moveTo((l.x - 0.08) * U, -(l.y + 0.1) * U); c.lineTo((l.x + 0.08) * U, -(l.y + 0.1) * U); c.lineTo((l.x + 0.22) * U, -(l.y - 0.06) * U); c.lineTo((l.x - 0.22) * U, -(l.y - 0.06) * U); c.closePath(); c.fill();
      // el cono de luz que baja (muy suave: lo fuerte lo pone la penumbra)
      const gc = c.createLinearGradient(0, -l.y * U, 0, 0.9 * U);
      gc.addColorStop(0, `rgba(200,220,236,${l.falla ? 0.05 : 0.09})`); gc.addColorStop(1, 'rgba(200,220,236,0)');
      c.fillStyle = gc; c.beginPath(); c.moveTo((l.x - 0.2) * U, -(l.y - 0.06) * U); c.lineTo((l.x + 0.2) * U, -(l.y - 0.06) * U); c.lineTo((l.x + 1.5) * U, 0.9 * U); c.lineTo((l.x - 1.5) * U, 0.9 * U); c.closePath(); c.fill();
    }
    // cadenas colgando de la viga
    for (const [x, y1] of [[-2.1, 2.5], [-4.6, 3.1], [1.6, 2.2]]) for (let yy = 4.55; yy > y1; yy -= 0.09) { c.strokeStyle = 'rgba(14,19,24,.9)'; c.lineWidth = 1.4; c.beginPath(); c.ellipse(x * U, -yy * U, 1.6, 2.8, 0, 0, 7); c.stroke(); }
    // la bruma: espesa a ras del suelo de la nave, una banda en medio y la del aire (lo lejano se aclara)
    const gb = c.createLinearGradient(0, -1.4 * U, 0, 1.2 * U);
    gb.addColorStop(0, 'rgba(58,74,90,0)'); gb.addColorStop(0.6, 'rgba(58,74,90,.42)'); gb.addColorStop(1, 'rgba(58,74,90,.6)');
    c.fillStyle = gb; c.fillRect(X0, -1.4 * U, X1 - X0, YB + 1.4 * U);
    const gm = c.createLinearGradient(0, -3.6 * U, 0, -2.2 * U);
    gm.addColorStop(0, 'rgba(58,74,90,0)'); gm.addColorStop(0.5, 'rgba(58,74,90,.16)'); gm.addColorStop(1, 'rgba(58,74,90,0)');
    c.fillStyle = gm; c.fillRect(X0, -3.6 * U, X1 - X0, 1.4 * U);
    c.fillStyle = 'rgba(52,66,80,.2)'; c.fillRect(X0, YT, X1 - X0, YB - YT);
  }
  // lo de EN MEDIO: una tuberia grande con bridas, su codo y su bajante con valvula, y un mazo de cables; bruma encima
  function pintarMedio(c, Lc) {
    const yc = 3.55, rr = 0.25;
    caja(c, Lc.x0 * U, -(yc + rr) * U, (Lc.x1 - Lc.x0) * U, 2 * rr * U, '#19212a', 600, 0.5, GROSOR * 0.65);
    c.fillStyle = 'rgba(160,180,200,.10)'; c.fillRect(Lc.x0 * U, -(yc + rr - 0.05) * U, (Lc.x1 - Lc.x0) * U, 0.05 * U);
    c.fillStyle = 'rgba(3,5,7,.35)'; c.fillRect(Lc.x0 * U, -(yc - rr + 0.08) * U, (Lc.x1 - Lc.x0) * U, 0.08 * U);
    for (let x = Lc.x0 + 0.6; x < Lc.x1; x += 2) caja(c, (x - 0.05) * U, -(yc + rr + 0.05) * U, 0.1 * U, (2 * rr + 0.1) * U, '#212a33', 601 + x, 0.3, GROSOR * 0.55);
    const xb = -3.3;
    caja(c, (xb - 0.15) * U, -(yc - rr) * U, 0.3 * U, (yc - rr - Lc.y0) * U, '#19212a', 620, 0.5, GROSOR * 0.65);
    c.fillStyle = 'rgba(160,180,200,.08)'; c.fillRect((xb - 0.12) * U, -(yc - rr) * U, 0.04 * U, (yc - rr - Lc.y0) * U);
    {
      const vx = (xb + 0.15) * U, vy = -1.2 * U;
      linea(c, vx, vy, vx + 0.16 * U, vy, 2.2, TINTA, 621, 0.2);
      circulo(c, vx + 0.2 * U, vy, 0.16 * U, null, GROSOR * 0.55, 622, 0.3);
      for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; linea(c, vx + 0.2 * U - Math.cos(a) * 0.16 * U, vy - Math.sin(a) * 0.16 * U, vx + 0.2 * U + Math.cos(a) * 0.16 * U, vy + Math.sin(a) * 0.16 * U, 1.2, TINTA, 623 + k, 0.2); }
    }
    for (let k = 0; k < 3; k++) {
      const pts = [];
      for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push([(-7.2 + t * 8.8) * U, -(4.75 - k * 0.05 - 4 * (0.45 + k * 0.08) * t * (1 - t)) * U]); }
      trazar(c, pts, false); tinta(c, 1.6 + k * 0.5, 'rgba(8,11,14,.95)');
    }
    c.fillStyle = 'rgba(46,58,70,.22)'; c.globalCompositeOperation = 'source-atop';
    c.fillRect(Lc.x0 * U, -Lc.y1 * U, (Lc.x1 - Lc.x0) * U, (Lc.y1 - Lc.y0) * U);
    c.globalCompositeOperation = 'source-over';
  }
  // la neblina: manchas blandas en una tira que se repite a lo ancho (8 m) y que se pinta pasando despacio
  function pintarBruma(s) {
    const w = Math.ceil(8 * s), h = Math.ceil(1.6 * s);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d'), r = azar(808);
    for (let n = 0; n < 70; n++) {
      const x = r() * w, y = h * (0.35 + r() * 0.6), rx = (0.4 + r() * 1.3) * s, ry = rx * (0.25 + r() * 0.2);
      for (const dx of [-w, 0, w]) {
        const g = c.createRadialGradient(x + dx, y, 0, x + dx, y, rx);
        g.addColorStop(0, `rgba(220,230,240,${0.12 + r() * 0.16})`); g.addColorStop(1, 'rgba(220,230,240,0)');
        c.save(); c.translate(x + dx, y); c.scale(1, ry / rx); c.translate(-(x + dx), -y);
        c.fillStyle = g; c.fillRect(x + dx - rx, y - rx, 2 * rx, 2 * rx);
        c.restore();
      }
    }
    return cv;
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
    lejos = pintarCapa(s, LEJOS, pintarLejos);
    medio = pintarCapa(s, MEDIO, pintarMedio);
    bruma = pintarBruma(s);
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

  // la luz de las lamparas de la nave (la segunda falla a golpes) y de la puerta
  const luzLampara = (l, t) => (l.falla ? (hash(Math.floor(t * 9), 7) < 0.72 ? 0.85 + 0.15 * hash(Math.floor(t * 31), 8) : 0.08) : 0.92 + 0.08 * Math.sin(t * 3.1));
  // el camino del boquete en la pantalla
  function caminoBoquete(X, Y) {
    const p = new Path2D();
    BOQUETE.forEach(([x, y], i) => (i ? p.lineTo(X(x), Y(y)) : p.moveTo(X(x), Y(y))));
    p.closePath();
    return p;
  }

  // ------------------------------------------------------------- un fotograma
  // E: estado del paso (x, y, cara, anim, i, oscuro, lampara...), cam: { cx, cy } en metros
  function dibujar(c, E, cam) {
    const W = c.canvas.width, H = c.canvas.height, s = H / D.VISTA_H;
    const X = (x) => (x - cam.cx) * s + W / 2, Y = (y) => H / 2 - (y - cam.cy) * s;
    const ok = E.oscuro, t = E.t || 0;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.fillStyle = COL.masa; c.fillRect(0, 0, W, H);
    // LO DE DETRAS DE LA PARED (se ve por el boquete y la rejilla), con su paralaje
    const bx0 = X(BQ.x0), bx1 = X(BQ.x1), by0 = Y(BQ.y1), by1 = Y(BQ.y0);
    const veBoquete = bx1 > 0 && bx0 < W && by1 > 0 && by0 < H;
    const capaX = (Lc) => (x) => (x - cam.cx) * s * Lc.f + W / 2, capaY = (Lc) => (y) => H / 2 - (y - cam.cy) * s * Lc.f;
    const XL = capaX(LEJOS), YL = capaY(LEJOS);
    let pathB = null;
    if (veBoquete) {
      pathB = caminoBoquete(X, Y);
      c.save();
      c.beginPath(); c.rect(bx0 - 4, by0 - 4, bx1 - bx0 + 8, by1 - by0 + 8); c.clip();
      c.drawImage(lejos.cv, XL(LEJOS.x0), YL(LEJOS.y1));
      // las lamparas encendidas y la bruma que pasa por la nave
      for (const l of LAMPARAS) {
        const k = luzLampara(l, t) * (1 - ok);
        c.fillStyle = `rgba(225,236,246,${0.85 * k})`;
        c.beginPath(); c.ellipse(XL(l.x), YL(l.y - 0.07), 0.16 * s * LEJOS.f, 0.05 * s * LEJOS.f, 0, 0, 7); c.fill();
      }
      const ob = ((t * 0.22) % 8);
      c.globalAlpha = 0.5;
      for (let k = -1; k < 3; k++) c.drawImage(bruma, XL(-8 + (k * 8) + ob), YL(0.2), 8 * s * LEJOS.f, 1.6 * s * LEJOS.f);
      c.globalAlpha = 0.28;
      for (let k = -1; k < 3; k++) c.drawImage(bruma, XL(-8 + (k * 8) - ob * 0.6), YL(3.0), 8 * s * LEJOS.f, 1.0 * s * LEJOS.f);
      c.globalAlpha = 1;
      const XM = capaX(MEDIO), YM = capaY(MEDIO);
      c.drawImage(medio.cv, XM(MEDIO.x0), YM(MEDIO.y1));
      // la sombra que hace el grueso del muro dentro del boquete (oclusion junto al corte)
      c.clip(pathB);
      c.lineJoin = 'round';
      for (const [w, a] of [[0.5, 0.22], [0.26, 0.3], [0.1, 0.35]]) { c.lineWidth = w * s; c.strokeStyle = `rgba(2,3,5,${a})`; c.stroke(pathB); }
      c.restore();
    }
    // detras de la rejilla: la luz del otro lado y el ventilador que la corta al girar
    const rx0 = X(REJA.x0), rx1 = X(REJA.x1), ry0 = Y(REJA.y1), ry1 = Y(REJA.y0);
    const veReja = rx1 > 0 && rx0 < W && ry1 > 0 && ry0 < H;
    if (veReja) {
      c.save();
      c.beginPath(); c.rect(rx0, ry0, rx1 - rx0, ry1 - ry0); c.clip();
      const cx = (rx0 + rx1) / 2, cy = (ry0 + ry1) / 2, R = Math.max(rx1 - rx0, ry1 - ry0) * 0.75;
      const gl = c.createRadialGradient(cx, cy, 0, cx, cy, R);
      gl.addColorStop(0, '#8ea6ba'); gl.addColorStop(0.6, '#3d4c5a'); gl.addColorStop(1, '#0d1116');
      c.fillStyle = gl; c.fillRect(rx0, ry0, rx1 - rx0, ry1 - ry0);
      c.translate(cx, cy); c.rotate(t * 4.2);
      c.fillStyle = '#080b0e';
      const Rb = Math.min(rx1 - rx0, ry1 - ry0) * 0.62;
      for (let k = 0; k < 5; k++) { c.rotate(Math.PI * 2 / 5); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(Rb * 0.5, -Rb * 0.38, Rb, -Rb * 0.16); c.lineTo(Rb * 0.95, Rb * 0.14); c.quadraticCurveTo(Rb * 0.45, Rb * 0.05, 0, 0); c.fill(); }
      c.beginPath(); c.arc(0, 0, Rb * 0.16, 0, 7); c.fill();
      c.restore();
    }
    // lo quieto, recortado con la camara
    c.drawImage(escena, (cam.cx - EX0) * s - W / 2, (EY1 - cam.cy) * s - H / 2, W, H, 0, 0, W, H);
    // el SUELO MOJADO: un reflejo aplastado de lo que hay encima (mas en el charco), antes de la penumbra
    reflejoSuelo(c, X, Y, s, W, H);
    // la GOTERA de la brida: la gota que se hincha, cae y salpica en el charco
    gotera(c, X, Y, s, t);
    // neblina a ras de suelo, que pasa despacio (la penumbra la deja ver solo donde hay luz)
    {
      // (recortada por el suelo y por la boca del conducto: sus bordes caen en la geometria y no se ven)
      const o = (t * 0.18) % 8, x0 = Math.max(0, X(S.x0)), x1 = Math.min(W, X(0));
      if (x1 > x0) {
        c.save(); c.beginPath(); c.rect(x0, Y(1.8), x1 - x0, Y(0) - Y(1.8)); c.clip();
        c.globalAlpha = 0.3;
        for (let k = -1; k < 3; k++) c.drawImage(bruma, X(S.x0 - 8 + k * 8 + o), Y(1.3), 8 * s, 1.6 * s);
        c.globalAlpha = 0.18;
        for (let k = -1; k < 3; k++) c.drawImage(bruma, X(S.x0 - 8 + k * 8 - o * 0.55 + 3.1), Y(0.9), 8 * s, 1.1 * s);
        c.globalAlpha = 1;
        c.restore();
      }
    }
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
    // PENUMBRA: velo oscuro con huecos donde hay luz (haz del pozo, lampara, el 18, la nave del boquete, la rejilla) y
    // luego el color de las luces
    if (sombra.width !== W || sombra.height !== H) { sombra.width = W; sombra.height = H; }
    const o = sombra.getContext('2d');
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
    if (veBoquete && ok < 0.999) {
      o.save(); o.clip(pathB);
      agujero(o, (bx0 + bx1) / 2, (by0 + by1) / 2, 2.6 * s, 0.32 * (1 - ok));
      for (const l of LAMPARAS) agujero(o, XL(l.x), YL(l.y - 0.4), 2.2 * s * LEJOS.f, 0.62 * luzLampara(l, t) * (1 - ok));
      agujero(o, XL((PUERTA.x0 + PUERTA.x1) / 2), YL(0.1), 1.8 * s * LEJOS.f, 0.55 * (1 - ok));
      o.restore();
    }
    if (veReja && ok < 0.999) {
      o.save(); o.beginPath(); o.rect(rx0, ry0, rx1 - rx0, ry1 - ry0); o.clip();
      agujero(o, (rx0 + rx1) / 2, (ry0 + ry1) / 2, 0.55 * s, 0.6 * (1 - ok));
      o.restore();
    }
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
    if (veBoquete && ok < 0.999) {
      c.save(); c.clip(pathB);
      for (const l of LAMPARAS) {
        const k = luzLampara(l, t) * (1 - ok);
        brillo(c, XL(l.x), YL(l.y - 0.07), 1.3 * s * LEJOS.f, `rgba(200,222,240,${0.2 * k})`);
        brillo(c, XL(l.x), YL(l.y - 0.07), 0.25 * s * LEJOS.f, `rgba(235,244,252,${0.7 * k})`);
      }
      brillo(c, XL((PUERTA.x0 + PUERTA.x1) / 2), YL(0.0), 1.4 * s * LEJOS.f, `rgba(255,200,140,${0.16 * (1 - ok)})`);
      c.restore();
    }
    if (veReja && ok < 0.999) {
      brillo(c, (rx0 + rx1) / 2, Y(0.02), 0.65 * s, `rgba(150,180,205,${0.05 * (1 - ok)})`);
    }
    // motas en el haz
    for (const m of L.motas) {
      const y = ((m.y + t * m.v) % 8.5), x = m.x + Math.sin(t * 0.6 + m.f) * 0.15;
      const a = (0.35 + 0.35 * Math.sin(t * 1.7 + m.f)) * (1 - ok);
      c.fillStyle = `rgba(234,240,248,${a * 0.6})`;
      c.fillRect(X(x), Y(y), Math.max(1, 0.025 * s), Math.max(1, 0.025 * s));
    }
    c.globalCompositeOperation = 'source-over';
    // primer plano en silueta (parallax 1,35): un cable que cuelga, una cadena, una tuberia en el borde y ferralla abajo
    const PX = (x) => (x - cam.cx) * s * 1.35 + W / 2, PY = (y) => H / 2 - (y - cam.cy) * s * 1.35;
    c.fillStyle = '#040506';
    c.beginPath();
    c.moveTo(PX(-7.9), PY(9)); c.quadraticCurveTo(PX(-7.6), PY(5), PX(-7.75), PY(2.9)); c.lineTo(PX(-7.68), PY(2.9));
    c.quadraticCurveTo(PX(-7.52), PY(5), PX(-7.82), PY(9)); c.fill();
    c.fillRect(PX(-7.83), PY(2.9), 0.06 * s * 1.35, 0.3 * s * 1.35);
    c.strokeStyle = '#040506'; c.lineWidth = Math.max(1.5, 0.018 * s * 1.35);
    for (let yy = 9; yy > 5.1; yy -= 0.1) { c.beginPath(); c.ellipse(PX(-2.6), PY(yy), 0.022 * s * 1.35, 0.045 * s * 1.35, 0, 0, 7); c.stroke(); }
    c.fillRect(PX(-2.64), PY(5.1), 0.08 * s * 1.35, 0.12 * s * 1.35);
    c.fillRect(PX(-12.4), PY(10), 0.42 * s * 1.35, 14 * s * 1.35);
    for (const yy of [6.2, 3.1, 0.2]) c.fillRect(PX(-12.5), PY(yy), 0.62 * s * 1.35, 0.1 * s * 1.35);
    c.beginPath();
    c.moveTo(PX(4.0), PY(-2.2)); c.lineTo(PX(4.4), PY(-0.55)); c.lineTo(PX(5.3), PY(-0.95)); c.lineTo(PX(5.6), PY(-0.25));
    c.lineTo(PX(6.6), PY(-0.7)); c.lineTo(PX(7.4), PY(-2.2)); c.closePath(); c.fill();
    c.lineWidth = 0.035 * s * 1.35; c.strokeStyle = '#040506';
    for (const [a, b] of [[[4.5, -0.6], [4.2, 0.5]], [[5.4, -0.4], [5.9, 0.7]], [[6.3, -0.6], [6.1, 0.25]]]) {
      c.beginPath(); c.moveTo(PX(a[0]), PY(a[1])); c.lineTo(PX(b[0]), PY(b[1])); c.stroke();
    }
  }

  // el reflejo del suelo mojado: la franja de encima del suelo, volteada y aplastada debajo de la linea del suelo; en el
  // charco mas fuerte y con su brillo
  function reflejoSuelo(c, X, Y, s, W, H) {
    const y0 = Y(0), alto = Math.round(0.9 * s), bajo = Math.round(0.16 * s);
    const xa = Math.max(0, Math.floor(X(S.x0))), xb = Math.min(W, Math.ceil(X(0)));
    if (xb - xa < 2 || y0 - alto > H || y0 < 0) return;
    if (tmp.width !== xb - xa || tmp.height !== alto) { tmp.width = xb - xa; tmp.height = alto; }
    const t = tmp.getContext('2d');
    t.setTransform(1, 0, 0, 1, 0, 0); t.globalCompositeOperation = 'copy';
    t.drawImage(c.canvas, xa, Math.round(y0 - alto), xb - xa, alto, 0, 0, xb - xa, alto);
    c.save();
    c.translate(0, y0 + 1); c.scale(1, -bajo / alto);
    c.globalAlpha = 0.16;
    c.drawImage(tmp, xa, -alto);
    const ca = Math.max(xa, X(CHARCO.x0)), cb = Math.min(xb, X(CHARCO.x1));
    if (cb > ca) { c.globalAlpha = 0.42; c.drawImage(tmp, ca - xa, 0, cb - ca, alto, ca, -alto, cb - ca, alto); }
    c.restore();
    // el canto del charco (el agua que asoma sobre el suelo) y su borde de luz
    if (cb > ca) {
      c.fillStyle = 'rgba(150,175,195,.14)'; c.fillRect(ca, y0 - 1, cb - ca, 2);
    }
  }
  // la gotera: se hincha en la brida, cae (g = 9,8) y salpica en el charco
  function gotera(c, X, Y, s, t) {
    const T = GOTA.T, p = (t + 0.37) % T, caer = Math.sqrt(2 * GOTA.y / 9.8);
    const col = 'rgba(205,222,236,';
    if (p < 1.4) {
      const r = 0.022 * Math.min(1, p / 1.4);
      c.fillStyle = col + '0.7)'; c.beginPath(); c.ellipse(X(GOTA.x), Y(GOTA.y - r * 1.1), r * s * 0.8, r * s * 1.1, 0, 0, 7); c.fill();
    } else if (p < 1.4 + caer) {
      const d = p - 1.4, y = GOTA.y - 0.5 * 9.8 * d * d, v = 9.8 * d;
      const largo = Math.min(0.09, 0.018 + v * 0.008);
      c.fillStyle = col + '0.8)'; c.beginPath(); c.ellipse(X(GOTA.x), Y(y), Math.max(1.5, 0.016 * s), largo * s * 0.5, 0, 0, 7); c.fill();
    } else {
      const d = p - 1.4 - caer;
      if (d < 0.45) {
        const a = 1 - d / 0.45;
        for (let k = 0; k < 5; k++) {
          const vx = (k - 2) * 0.32 + 0.05, vy = 0.9 + (k % 2) * 0.45;
          const x = GOTA.x + vx * d, y = vy * d - 4.9 * d * d;
          if (y < 0) continue;
          c.fillStyle = col + (0.6 * a) + ')'; c.fillRect(X(x), Y(y), Math.max(1, 0.012 * s), Math.max(1, 0.012 * s));
        }
        c.strokeStyle = col + (0.35 * a) + ')'; c.lineWidth = 1;
        c.beginPath(); c.ellipse(X(GOTA.x), Y(0.004), (0.05 + d * 0.5) * s, (0.008 + d * 0.03) * s, 0, Math.PI, Math.PI * 2); c.stroke();
      }
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
  // X, Y y s llevan del mundo al lienzo de la capa; fuera de la silueta y de su borde de luz queda transparente.
  // (Las luces de la nave del boquete y de la rejilla estan DETRAS de la pared: al 18 no le llegan)
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
