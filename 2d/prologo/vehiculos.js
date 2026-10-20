// EL CONVOY DEL PROLOGO: los vehiculos militares de Boltbound que cruzan la calle de la capital huyendo de lo que
// viene detras. Todo a la escala del juego (1 m = 64 u; el 18 mide 50 u) y con la misma linea de tinta:
//   jeep      4,2 m: abierto, arco antivuelco, rueda de repuesto, un foco que barre la niebla y dos soldados
//   camion    7,5 m: cabina, caja con lona sobre arcos (la lona remangada deja ver los cascos de la tropa), tres ejes
//   blindado  7,6 m: casco inclinado de ocho ruedas, torrecilla con cañon automatico
//   tanque    7 m de casco y 4 de cañon: orugas con eslabones que corren, ruedas de rodaje, faldones de chapa,
//             torre que gira (vista de lado: el cañon se acorta con el coseno) y retrocede al disparar
// Origen: en el suelo, en el centro del vehiculo; el morro mira a +x. `v.dist` es lo recorrido (gira las ruedas y
// mueve la oruga). Gris oliva del ejercito, sin naranja (GDD: el naranja es solo la Podredumbre).
import { TINTA, temblar, trazar, tinta, circulo, hash } from '../dibujo/tinta.js';

export const OLIVA = '#4a4f44', OLIVA_C = '#646a5a', OLIVA_O = '#2f322b', OLIVA_OO = '#1e201b';
const LONA = '#4e4a3b', LONA_C = '#625d4a', LONA_O = '#37342a', GOMA = '#141416', LLANTA = '#3f423b', PALIDO = '#b7b29e';

// las medidas que necesita el director (prologo.js): largo, donde estan los faros y el foco, donde dispara
export const MEDIDAS = {
  jeep: { largo: 270, alto: 130, faros: [[132, -64]], foco: [-52, -136] },
  camion: { largo: 480, alto: 210, faros: [[238, -96]] },
  blindado: { largo: 486, alto: 196, faros: [[236, -104]] },
  tanque: { largo: 470, alto: 176, faros: [[222, -98]], torre: [-26, -132], canon: 262 },
};

// ---------------------------------------------------------------- utilidades
const forma = (c, pts, relleno, grosor = 2.2, sem = 1, amp = 0.45) => {
  trazar(c, temblar(pts, 18, amp, sem));
  if (relleno) { c.fillStyle = relleno; c.fill(); }
  if (grosor) tinta(c, grosor);
};
const arco = (cx, cy, r, a0, a1, n = 10) => { const p = []; for (let k = 0; k <= n; k++) { const a = a0 + (a1 - a0) * (k / n); p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return p; };
const raya = (c, x0, y0, x1, y1, a = 0.35, w = 1.2) => { c.strokeStyle = `rgba(0,0,0,${a})`; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
const luzBorde = (c, x0, y0, x1, y1, a = 0.22, w = 1.6) => { c.strokeStyle = `rgba(235,232,215,${a})`; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
const remaches = (c, pts, r = 1.4) => { c.fillStyle = 'rgba(0,0,0,.45)'; for (const [x, y] of pts) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); } c.fillStyle = 'rgba(230,225,205,.18)'; for (const [x, y] of pts) { c.beginPath(); c.arc(x - 0.5, y - 0.6, r * 0.5, 0, 7); c.fill(); } };
// la insignia de Boltbound: el rombo de las banderolas de la ciudad, pintado con plantilla y gastado
function insignia(c, x, y, r) {
  c.save(); c.globalAlpha = 0.55; c.strokeStyle = PALIDO; c.lineWidth = 2;
  c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r * 0.75, y); c.lineTo(x, y + r); c.lineTo(x - r * 0.75, y); c.closePath(); c.stroke();
  c.fillStyle = PALIDO; c.beginPath(); c.moveTo(x, y - r * 0.4); c.lineTo(x + r * 0.3, y); c.lineTo(x, y + r * 0.4); c.lineTo(x - r * 0.3, y); c.closePath(); c.fill();
  c.restore();
}
// salpicaduras de barro en los bajos (dentro del recorte del casco): manchas y gotas que suben
function barro(c, x0, x1, y, alto, sem) {
  for (let k = 0; k < 18; k++) {
    const x = x0 + hash(k, sem) * (x1 - x0), h = alto * (0.3 + hash(k, sem + 1) * 0.7);
    c.fillStyle = `rgba(36,32,26,${(0.35 + hash(k, sem + 2) * 0.3).toFixed(2)})`;
    c.beginPath(); c.ellipse(x, y - h * 0.4, 4 + hash(k, sem + 3) * 10, h * 0.5, 0, 0, 7); c.fill();
    c.beginPath(); c.arc(x + hash(k, sem + 4) * 8, y - h - 3 - hash(k, sem + 5) * 6, 1 + hash(k, sem + 6) * 1.6, 0, 7); c.fill();
  }
}
// la marca de descontaminacion: triangulo de plantilla con la raya (el convoy viene de la zona contaminada)
function marcaNBQ(c, x, y, r) {
  c.save(); c.globalAlpha = 0.5; c.strokeStyle = PALIDO; c.lineWidth = 1.8;
  c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r * 0.95, y + r * 0.7); c.lineTo(x - r * 0.95, y + r * 0.7); c.closePath(); c.stroke();
  c.fillStyle = PALIDO; c.font = `bold ${(r * 0.62).toFixed(1)}px "Courier New", monospace`; c.textAlign = 'center'; c.fillText('NBQ', x, y + r * 0.45);
  c.restore();
}
// un bidon de chapa de 20 l, de lado: asa de tres barras, la X estampada y la cincha que lo sujeta
function bidon(c, x, y, w, h, sem) {
  forma(c, [[x, y], [x + w, y], [x + w, y - h], [x + w * 0.35, y - h], [x, y - h + 4]], OLIVA_O, 1.6, sem);
  raya(c, x + 2, y - 2, x + w - 2, y - h + 3, 0.45, 1.2); raya(c, x + w - 2, y - 2, x + 2, y - h + 5, 0.45, 1.2);
  c.fillStyle = 'rgba(0,0,0,.5)'; for (let q = 0; q < 3; q++) c.fillRect(x + w * 0.42 + q * 3, y - h - 4, 1.6, 4);
  c.fillStyle = '#26271f'; c.fillRect(x - 1, y - h * 0.55, w + 2, 2.6);
}
// rotulo de plantilla (numero de unidad)
function rotulo(c, txt, x, y, tam) { c.save(); c.globalAlpha = 0.5; c.fillStyle = PALIDO; c.font = `bold ${tam}px "Courier New", monospace`; c.textAlign = 'center'; c.fillText(txt, x, y); c.restore(); }

// rueda con taco: neumatico, llanta con tornillos, gira con lo recorrido
function rueda(c, x, y, r, ang, sem = 0) {
  c.save(); c.translate(x, y);
  circulo(c, 0, 0, r, GOMA, 2.2, 31 + sem, 0.7);
  // tacos de la banda de rodadura
  c.strokeStyle = 'rgba(70,70,74,.85)'; c.lineWidth = 2.6;
  for (let k = 0; k < 14; k++) { const a = ang + k * (Math.PI * 2 / 14); c.beginPath(); c.moveTo(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86); c.lineTo(Math.cos(a) * r * 1.0, Math.sin(a) * r * 1.0); c.stroke(); }
  circulo(c, 0, 0, r * 0.58, LLANTA, 1.6, 33 + sem, 0.3);
  c.fillStyle = OLIVA_O; c.beginPath(); c.arc(0, 0, r * 0.26, 0, 7); c.fill();
  c.fillStyle = 'rgba(0,0,0,.6)';
  for (let k = 0; k < 6; k++) { const a = ang + k * 1.0472; c.beginPath(); c.arc(Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4, 1.6, 0, 7); c.fill(); }
  c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, r * 0.5, Math.PI * 1.1, Math.PI * 1.55); c.stroke();
  c.restore();
}
// un soldado asomado CON TRAJE ANTICONTAMINACION (NBQ; pedido el 2026-10-20: la Podredumbre se contagia): mono de
// goma holgado con las costuras encintadas, capucha, mascara de cara entera con dos visores redondos que cogen la
// luz, boquilla, filtro en la mejilla y la manguera al pecho, el correaje con su bolsa y, casi todos, el casco
// encima de la capucha. Va asomado: se ve de la cintura para arriba. Mira a +x.
const TRAJE = '#565c4c', TRAJE_O = '#3a3e33', TRAJE_C = '#6f7563', GOMA_M = '#1b1c1a';
export function soldado(c, x, y, o = {}) {
  const k = o.k || 1, mira = o.mira ?? 0.15, sem = o.sem ?? 41;
  c.save(); c.translate(x, y); c.scale(k, k);
  // el mono: hombros caidos y holgado (bolsas de tela en los costados)
  const torso = [[-12, 0], [-14, -12], [-12, -21], [-7, -27], [7, -27], [12, -21], [14, -12], [12, 0]];
  forma(c, torso, TRAJE, 1.8, sem);
  c.save(); trazar(c, torso); c.clip();
  c.fillStyle = TRAJE_C; c.fillRect(-14, -28, 28, 3);                                   // la luz en los hombros
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1;                                     // pliegues de la goma
  for (const [a, b] of [[-9, -18], [-4, -6], [6, -16], [9, -4]]) { c.beginPath(); c.moveTo(a, b); c.quadraticCurveTo(a + 3, b + 4, a + 1, b + 8); c.stroke(); }
  c.fillStyle = 'rgba(205,200,180,.32)'; c.fillRect(-13, -22, 4, 2.2); c.fillRect(9, -22, 4, 2.2);   // la cinta de las costuras
  // el correaje: tirante en diagonal y la bolsa de la mascara
  c.strokeStyle = '#25271f'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(-9, -25); c.lineTo(9, -3); c.stroke();
  c.restore();
  forma(c, [[-13, -10], [-5, -10], [-5, -1], [-13, -1]], TRAJE_O, 1.3, sem + 2);
  c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(-12.5, -10, 7, 2);
  c.save(); c.rotate(mira);
  // la capucha de goma
  const capucha = [[-11, -26], [-13, -35], [-10, -44], [-3, -48], [5, -47], [11, -42], [12, -33], [10, -26]];
  forma(c, capucha, TRAJE_O, 1.8, sem + 4);
  c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-9, -30); c.quadraticCurveTo(-6, -38, -8, -44); c.stroke();
  // la mascara: cara de goma, dos visores (uno de perfil, el otro asomando), la boquilla y el filtro en la mejilla
  forma(c, [[-2, -44], [8, -45], [13, -40], [14, -32], [11, -27], [2, -27], [-1, -34]], GOMA_M, 1.6, sem + 6);
  for (const [lx, ly, lr] of [[5, -38, 4.2], [11.5, -38.5, 3]]) {
    c.beginPath(); c.ellipse(lx, ly, lr * (lx > 10 ? 0.6 : 1), lr, 0, 0, 7); c.fillStyle = '#2b3640'; c.fill();
    c.lineWidth = 1.4; c.strokeStyle = '#4d5246'; c.stroke();
    c.strokeStyle = 'rgba(200,220,235,.55)'; c.lineWidth = 1; c.beginPath(); c.arc(lx - 0.6, ly - 0.6, lr * 0.55, Math.PI * 1.1, Math.PI * 1.6); c.stroke();
  }
  c.beginPath(); c.arc(12, -30.5, 2.4, 0, 7); c.fillStyle = '#2d302a'; c.fill(); tinta(c, 1.1);           // la boquilla
  // el filtro: un bote con aros, en la mejilla
  c.save(); c.translate(9, -28); c.rotate(0.5);
  forma(c, [[-3.5, 0], [3.5, 0], [3.5, 7], [-3.5, 7]], '#43483c', 1.2, sem + 8, 0.2);
  c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 0.8; for (const yy of [2.2, 4.6]) { c.beginPath(); c.moveTo(-3.3, yy); c.lineTo(3.3, yy); c.stroke(); }
  c.restore();
  // la manguera anillada que baja al pecho
  c.strokeStyle = GOMA_M; c.lineWidth = 3; c.beginPath(); c.moveTo(11, -26); c.quadraticCurveTo(14, -16, 6, -12); c.stroke();
  c.strokeStyle = 'rgba(120,125,110,.6)'; c.lineWidth = 0.8;
  for (let q = 0.15; q < 1; q += 0.17) { const xx = (1 - q) ** 2 * 11 + 2 * (1 - q) * q * 14 + q * q * 6, yy = (1 - q) ** 2 * -26 + 2 * (1 - q) * q * -16 + q * q * -12; c.beginPath(); c.moveTo(xx - 1.5, yy); c.lineTo(xx + 1.5, yy); c.stroke(); }
  // el casco encima de la capucha (alguno va sin el)
  if (o.casco !== false) {
    trazar(c, temblar([[-12, -40], [-10, -47], [-4, -52], [5, -52], [11, -47], [12, -40]], 8, 0.4, sem + 10)); c.fillStyle = '#353a2f'; c.fill(); tinta(c, 1.8);
    c.beginPath(); c.moveTo(-13, -40); c.lineTo(13, -40); tinta(c, 2.4);
    c.strokeStyle = 'rgba(230,225,205,.2)'; c.lineWidth = 1.2; c.beginPath(); c.arc(0, -44, 7, Math.PI * 1.15, Math.PI * 1.6); c.stroke();
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(-3, -50, 5, 3);                       // la funda de las gafas
  }
  c.restore();
  if (o.fusil) {
    c.strokeStyle = TINTA; c.lineWidth = 3.4; c.beginPath(); c.moveTo(4, -12); c.lineTo(32, -27); c.stroke();
    c.strokeStyle = '#2a2b26'; c.lineWidth = 1.8; c.stroke();
    forma(c, [[13, -15], [17, -17], [19, -11], [15, -9]], '#24251f', 1.1, sem + 12, 0.2);      // el cargador
  }
  c.restore();
}

// ---------------------------------------------------------------- jeep
export function jeep(c, v, t) {
  const r = 27, giro = v.dist / r, bote = Math.sin(v.dist * 0.045 + v.sem) * 1.6;
  rueda(c, -82, -27, r, giro, 1); rueda(c, 88, -27, r, giro + 1, 2);
  c.save(); c.translate(0, bote);
  // rueda de repuesto atras y bidon
  rueda(c, -146, -64, 21, 0.4, 3);
  bidon(c, -125, -78, 19, 27, 5);
  // la carroceria abierta con los pasos de rueda
  const cuerpo = [[-138, -34], [-138, -74], [-130, -79], [-42, -79], [-36, -70], [22, -64], [30, -72], [44, -81], [122, -83], [136, -75], [141, -52], [139, -34],
    ...arco(88, -29, 34, 0, -Math.PI, 9).slice(1, -1), [54, -34], [-48, -34], ...arco(-82, -29, 34, 0, -Math.PI, 9).slice(1, -1), [-116, -34]];
  forma(c, cuerpo, OLIVA, 2.4, 7);
  c.save(); trazar(c, cuerpo); c.clip();
  c.fillStyle = OLIVA_C; c.fillRect(-140, -84, 290, 9);                // el canto de arriba, a la luz
  c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(-140, -46, 290, 14);       // los bajos en sombra
  raya(c, 44, -81, 46, -40); raya(c, -36, -70, -34, -40);              // juntas de la puerta abierta y del capo
  for (let k = 0; k < 4; k++) raya(c, 70 + k * 12, -78, 70 + k * 12, -66, 0.4, 2);    // rejilla del capo
  barro(c, -138, 140, -34, 16, v.sem);
  c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(60, -80); c.lineTo(60, -70); c.moveTo(118, -82); c.lineTo(118, -72); c.stroke();   // las cinchas del capo
  c.restore();
  marcaNBQ(c, -118, -58, 9);
  // la defensa con el gancho de remolque y la rejilla del faro
  forma(c, [[136, -48], [152, -48], [152, -38], [136, -38]], OLIVA_OO, 1.6, 12);
  c.strokeStyle = TINTA; c.lineWidth = 2.4; c.beginPath(); c.arc(148, -34, 4, Math.PI * 1.2, Math.PI * 2.6); c.stroke();
  // la radio en la caja de atras, con el cordon en espiral del auricular, y una caja de municion
  forma(c, [[-100, -79], [-74, -79], [-74, -101], [-100, -101]], '#2e322a', 1.6, 14);
  c.fillStyle = 'rgba(220,215,190,.35)'; for (const [dx, dy] of [[-95, -96], [-88, -96], [-81, -96]]) { c.beginPath(); c.arc(dx, dy, 1.6, 0, 7); c.fill(); }
  c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(-96, -91, 18, 6);
  c.strokeStyle = TINTA; c.lineWidth = 1.2; c.beginPath();
  for (let q = 0; q <= 14; q++) { const xx = -74 + q * 1.6, yy = -92 + Math.sin(q * 1.4) * 2.2 + q * 0.9; q ? c.lineTo(xx, yy) : c.moveTo(xx, yy); }
  c.stroke();
  forma(c, [[-66, -79], [-46, -79], [-46, -91], [-66, -91]], OLIVA_O, 1.5, 16);
  rotulo(c, '7.62', -56, -82, 7);
  insignia(c, 96, -58, 9);
  rotulo(c, '7-21', -90, -48, 11);
  remaches(c, [[-128, -72], [-60, -72], [130, -70], [60, -76]]);
  // pala y hacha sujetas al costado
  c.strokeStyle = TINTA; c.lineWidth = 3; c.beginPath(); c.moveTo(-30, -50); c.lineTo(28, -54); c.stroke();
  c.strokeStyle = '#3b3427'; c.lineWidth = 1.6; c.stroke();
  // el parabrisas levantado, con su espejo
  forma(c, [[42, -81], [26, -122], [33, -124], [49, -83]], OLIVA_O, 1.8, 9);
  c.strokeStyle = TINTA; c.lineWidth = 1.6; c.beginPath(); c.moveTo(31, -112); c.lineTo(46, -116); c.stroke();
  forma(c, [[44, -122], [52, -122], [52, -112], [44, -112]], '#2a2f33', 1.3, 10, 0.2);
  forma(c, [[38, -86], [28, -114], [31, -115], [41, -87]], 'rgba(120,135,150,.35)', 0, 9);
  // arco antivuelco
  c.strokeStyle = TINTA; c.lineWidth = 5.5; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(-34, -79); c.lineTo(-40, -126); c.lineTo(-104, -122); c.lineTo(-110, -79); c.stroke();
  c.strokeStyle = OLIVA_C; c.lineWidth = 2.6; c.stroke();
  // conductor y el que lleva el foco
  soldado(c, 6, -64, { mira: 0.05, sem: 101 });
  soldado(c, -78, -76, { k: 1.05, mira: -0.25, sem: 103, fusil: true });
  // el foco: tambor en un poste, apunta adonde barre (v.focoAng, angulo en pantalla)
  const [fx, fy] = MEDIDAS.jeep.foco;
  c.strokeStyle = TINTA; c.lineWidth = 4; c.beginPath(); c.moveTo(fx, -79); c.lineTo(fx, fy + 6); c.stroke();
  c.save(); c.translate(fx, fy); c.rotate(v.focoAng ?? -1.2);
  forma(c, [[-10, -9], [14, -11], [14, 11], [-10, 9]], OLIVA_O, 2, 11);
  c.fillStyle = '#efe6cc'; c.fillRect(12, -9, 3, 18);
  c.restore();
  // la antena de latigo, que se cimbrea
  const cim = Math.sin(t * 3.1 + v.sem) * 10 + Math.sin(v.dist * 0.02) * 6;
  c.strokeStyle = TINTA; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-128, -79); c.quadraticCurveTo(-136 + cim * 0.3, -150, -150 + cim, -214); c.stroke();
  // faro con su rejilla
  circulo(c, 133, -64, 5.5, '#d9d2b8', 1.6, 13, 0.2);
  c.strokeStyle = TINTA; c.lineWidth = 1.2; c.beginPath(); c.moveTo(135.5, -70); c.lineTo(135.5, -58); c.moveTo(139, -69); c.lineTo(139, -59); c.stroke();
  c.restore();
}

// ---------------------------------------------------------------- camion de tropa
export function camion(c, v, t) {
  const r = 31, giro = v.dist / r, bote = Math.sin(v.dist * 0.04 + v.sem) * 1.8;
  // bastidor y ruedas (las ruedas por delante del bastidor, debajo de la caja)
  c.save(); c.translate(0, bote * 0.4);
  forma(c, [[-236, -54], [230, -54], [230, -44], [-236, -44]], OLIVA_OO, 1.8, 15);
  c.restore();
  for (const [x, k] of [[-176, 0], [-104, 1], [168, 2]]) rueda(c, x, -31, r, giro + k, 4 + k);
  c.save(); c.translate(0, bote);
  // bajo la caja: la rueda de repuesto en su soporte y la caja de herramientas con su cierre
  c.strokeStyle = TINTA; c.lineWidth = 3; c.beginPath(); c.moveTo(18, -52); c.lineTo(30, -40); c.moveTo(62, -52); c.lineTo(50, -40); c.stroke();
  rueda(c, 40, -34, 19, 0.3, 9);
  forma(c, [[72, -54], [104, -54], [104, -32], [72, -32]], OLIVA_O, 1.6, 11);
  c.fillStyle = 'rgba(220,215,190,.3)'; c.fillRect(86, -46, 4, 5);
  // los guardabarros de goma detras de cada eje
  for (const x of [-209, -137, 133]) forma(c, [[x - 4, -52], [x + 3, -52], [x + 4, -12], [x - 4, -12]], GOMA, 1.4, 13 + x, 0.3);
  // guardabarros
  for (const x of [-140, 168]) forma(c, [...arco(x, -31, x < 0 ? 72 : 38, Math.PI, Math.PI * 2, 8).map(([a, b]) => [a, Math.min(b, -52)]), [x + (x < 0 ? 72 : 38), -50], [x - (x < 0 ? 72 : 38), -50]], OLIVA_O, 1.8, 17);
  // la caja: tablas laterales
  forma(c, [[-242, -60], [112, -60], [112, -100], [-242, -100]], OLIVA, 2.2, 19);
  for (let k = 1; k < 3; k++) raya(c, -240, -60 - k * 13, 110, -60 - k * 13, 0.4);
  for (let x = -200; x < 110; x += 58) raya(c, x, -60, x, -100, 0.5, 2);
  // los arcos de la lona, que se ven por debajo del rollo
  for (let x = -230; x <= 100; x += 66) { c.strokeStyle = TINTA; c.lineWidth = 3; c.beginPath(); c.moveTo(x, -98); c.lineTo(x, -150); c.stroke(); }
  // la tropa sentada (la lona va remangada hasta la mitad), con el traje NBQ: alguno sin casco, alguno con el fusil
  for (let k = 0; k < 6; k++) soldado(c, -212 + k * 52, -100, { k: 0.95, mira: 0.1 + hash(k, v.sem) * 0.2 - (k === 2 ? 0.45 : 0), sem: 120 + k * 7 + v.sem, casco: hash(k, v.sem + 3) > 0.25, fusil: k === 1 || k === 4 });
  // las argollas de amarre del borde de la caja
  c.fillStyle = TINTA; for (let x = -226; x < 110; x += 48) { c.beginPath(); c.arc(x, -97, 2.2, 0, 7); c.fill(); }
  // la lona sobre los arcos, con el canto remangado
  const lona = [[-242, -150], [-240, -196], [-226, -210], [96, -210], [110, -196], [112, -150]];
  forma(c, lona, LONA, 2.4, 21, 0.8);
  c.save(); trazar(c, lona); c.clip();
  c.fillStyle = LONA_C; c.fillRect(-250, -212, 370, 12);
  // los arcos que asoman y la lona que cuelga entre ellos
  for (let x = -230; x <= 100; x += 66) {
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, -206); c.lineTo(x, -150); c.stroke();
    c.strokeStyle = 'rgba(255,250,230,.08)'; c.lineWidth = 6; c.beginPath(); c.moveTo(x + 6, -200); c.quadraticCurveTo(x + 33, -180, x + 60, -200); c.stroke();
  }
  // arrugas
  c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = 1.2;
  for (let k = 0; k < 14; k++) { const x = -236 + hash(k, 3) * 340, y = -198 + hash(k, 4) * 30; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 8, y + 10, x + 3, y + 22); c.stroke(); }
  c.restore();
  // el rollo de la lona remangada
  forma(c, [[-244, -146], [114, -146], [114, -157], [-244, -157]], LONA_O, 2.2, 23, 0.6);
  for (let x = -230; x < 110; x += 33) raya(c, x, -146, x + 6, -157, 0.35, 1.4);
  insignia(c, -140, -80, 10);
  rotulo(c, 'BB 4471', 0, -74, 12);
  barro(c, -242, 110, -60, 12, v.sem + 40);
  // la cadena de la trampilla, colgando en la trasera
  c.strokeStyle = 'rgba(20,20,22,.9)'; c.lineWidth = 1.4;
  for (let q = 0; q < 6; q++) { c.beginPath(); c.ellipse(-244, -98 + q * 5, 1.6, 2.6, 0, 0, 7); c.stroke(); }
  // tubo de escape tras la cabina, con su rejilla protectora
  forma(c, [[110, -60], [118, -60], [118, -214], [110, -214]], OLIVA_OO, 1.6, 25);
  for (let y = -200; y < -160; y += 6) raya(c, 109, y, 119, y + 3, 0.55, 1);
  // la cabina
  const cab = [[118, -58], [118, -182], [132, -188], [194, -188], [205, -178], [213, -122], [236, -116], [245, -98], [246, -60]];
  forma(c, cab, OLIVA, 2.4, 27);
  c.save(); trazar(c, cab); c.clip();
  c.fillStyle = OLIVA_C; c.fillRect(110, -192, 140, 9); c.fillRect(205, -124, 50, 6);
  c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(110, -76, 140, 20);
  for (let k = 0; k < 5; k++) raya(c, 222 + k * 4.5, -110, 222 + k * 4.5, -70, 0.45, 2);   // rejilla del radiador
  raya(c, 186, -182, 192, -64, 0.45, 1.4); raya(c, 124, -64, 186, -64, 0.35);           // la puerta
  c.restore();
  // ventanilla con el conductor dentro
  forma(c, [[134, -174], [186, -174], [194, -136], [134, -136]], '#20252b', 1.8, 29);
  soldado(c, 162, -136, { k: 0.9, mira: 0.05, sem: 160 + v.sem, casco: false });
  c.save(); trazar(c, [[134, -174], [186, -174], [194, -136], [134, -136]]); c.clip();
  c.strokeStyle = 'rgba(200,215,230,.18)'; c.lineWidth = 7; c.beginPath(); c.moveTo(140, -140); c.lineTo(166, -176); c.stroke();
  c.restore();
  c.fillStyle = TINTA; c.fillRect(176, -122, 10, 3);                     // tirador
  forma(c, [[150, -62], [182, -62], [182, -54], [150, -54]], OLIVA_O, 1.6, 31);   // estribo
  marcaNBQ(c, 160, -96, 10);
  rotulo(c, '14', 196, -150, 12);
  // la defensa con el cabrestante, el espejo en su brazo y el aro del techo con la ametralladora
  forma(c, [[236, -66], [258, -66], [258, -50], [236, -50]], OLIVA_OO, 1.8, 37);
  circulo(c, 247, -58, 5, '#2a2c27', 1.4, 38, 0.2);
  c.strokeStyle = TINTA; c.lineWidth = 2; c.beginPath(); c.moveTo(205, -170); c.lineTo(226, -166); c.lineTo(226, -150); c.stroke();
  forma(c, [[222, -164], [232, -164], [232, -146], [222, -146]], '#2a2f33', 1.4, 39, 0.2);
  c.strokeStyle = TINTA; c.lineWidth = 3.4; c.beginPath(); c.ellipse(158, -190, 26, 4, 0, Math.PI, Math.PI * 2); c.stroke();
  c.lineWidth = 2.6; c.beginPath(); c.moveTo(150, -196); c.lineTo(166, -200); c.lineTo(204, -204); c.stroke();
  forma(c, [[146, -200], [160, -202], [160, -192], [146, -192]], OLIVA_OO, 1.3, 40, 0.2);
  // la antena de la cabina
  const cimC = Math.sin(t * 2.9 + v.sem) * 8;
  c.strokeStyle = TINTA; c.lineWidth = 1.5; c.beginPath(); c.moveTo(124, -186); c.quadraticCurveTo(120 + cimC * 0.3, -250, 108 + cimC, -320); c.stroke();
  // bidones en el costado de la caja
  for (const x of [-30, -6]) forma(c, [[x, -62], [x + 20, -62], [x + 20, -94], [x, -94]], OLIVA_O, 1.6, 33 + x);
  circulo(c, 240, -96, 6, '#d9d2b8', 1.6, 35, 0.2);
  c.strokeStyle = TINTA; c.lineWidth = 1.2; c.beginPath(); c.moveTo(243, -103); c.lineTo(243, -89); c.moveTo(247, -102); c.lineTo(247, -90); c.stroke();
  remaches(c, [[124, -170], [124, -80], [206, -168], [-236, -66], [106, -66]]);
  c.restore();
}

// ---------------------------------------------------------------- blindado de ocho ruedas
export function blindado(c, v, t) {
  const r = 30, giro = v.dist / r, bote = Math.sin(v.dist * 0.035 + v.sem) * 1.4;
  for (const [x, k] of [[-170, 0], [-62, 1], [60, 2], [168, 3]]) rueda(c, x, -30, r, giro + k * 0.7, 7 + k);
  c.save(); c.translate(0, bote);
  // casco: bajos inclinados hacia dentro, costado, techo y frente en cuña
  const casco = [[-236, -44], [-246, -66], [-246, -150], [-226, -160], [130, -160], [244, -104], [246, -70], [226, -44]];
  forma(c, casco, OLIVA, 2.6, 41);
  c.save(); trazar(c, casco); c.clip();
  c.fillStyle = OLIVA_C; c.beginPath(); c.moveTo(130, -160); c.lineTo(244, -104); c.lineTo(244, -94); c.lineTo(126, -150); c.fill();
  c.fillStyle = OLIVA_C; c.fillRect(-250, -164, 384, 8);
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.moveTo(-250, -66); c.lineTo(250, -66); c.lineTo(250, -40); c.lineTo(-250, -40); c.fill();
  raya(c, -246, -66, 246, -70, 0.5, 1.6);                              // la arista del casco
  raya(c, -10, -150, -10, -70, 0.45, 1.4); raya(c, -80, -150, -80, -70, 0.45, 1.4); raya(c, -80, -150, -10, -150, 0.45, 1.4);   // la puerta lateral
  for (const y of [-140, -84]) { c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(-14, y, 6, 8); }                                        // las bisagras
  // las soldaduras de las planchas y el barro de los bajos
  c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 1; c.setLineDash([2, 2]);
  c.beginPath(); c.moveTo(-246, -110); c.lineTo(126, -110); c.moveTo(60, -158); c.lineTo(60, -70); c.stroke(); c.setLineDash([]);
  barro(c, -246, 240, -44, 18, v.sem + 60);
  c.restore();
  marcaNBQ(c, -45, -110, 11);
  // el pasamanos del techo, con sus patas
  c.strokeStyle = TINTA; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-200, -170); c.lineTo(100, -170); c.stroke();
  for (let x = -200; x <= 100; x += 50) { c.beginPath(); c.moveTo(x, -170); c.lineTo(x, -161); c.stroke(); }
  // las herramientas sujetas al costado: la pala y el pico con sus abrazaderas
  c.strokeStyle = TINTA; c.lineWidth = 3; c.beginPath(); c.moveTo(-220, -100); c.lineTo(-120, -102); c.moveTo(-205, -92); c.lineTo(-110, -94); c.stroke();
  c.strokeStyle = '#4b4434'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-220, -100); c.lineTo(-120, -102); c.moveTo(-205, -92); c.lineTo(-110, -94); c.stroke();
  forma(c, [[-120, -108], [-98, -106], [-98, -96], [-120, -96]], OLIVA_OO, 1.3, 52, 0.2);
  forma(c, [[-112, -98], [-104, -86], [-100, -88], [-106, -100]], OLIVA_OO, 1.2, 53, 0.2);
  c.fillStyle = TINTA; for (const x of [-190, -150]) c.fillRect(x, -106, 4, 16);
  // los bidones colgados en la trasera y los ganchos de remolque
  bidon(c, -264, -74, 16, 24, 54); bidon(c, -264, -104, 16, 24, 55);
  c.strokeStyle = TINTA; c.lineWidth = 2.6;
  c.beginPath(); c.arc(-250, -56, 4, Math.PI * 0.4, Math.PI * 1.8); c.moveTo(249, -60); c.arc(252, -56, 4, Math.PI * 1.2, Math.PI * 2.6); c.stroke();
  // los periscopios del conductor, delante en el techo
  for (const x of [104, 122]) forma(c, [[x, -158], [x + 12, -158], [x + 10, -166], [x + 2, -166]], '#1d2226', 1.2, 56 + x, 0.2);
  // escotillas de vision, ganchos, extintor
  for (const x of [-200, -150, 40, 90]) forma(c, [[x, -138], [x + 22, -138], [x + 22, -128], [x, -128]], '#1d2226', 1.4, 43 + x);
  c.fillStyle = 'rgba(160,190,210,.25)'; for (const x of [-200, -150, 40, 90]) c.fillRect(x + 3, -136, 16, 2);
  remaches(c, [[-236, -150], [-236, -76], [-120, -154], [0, -154], [120, -154], [-40, -76], [80, -76], [200, -80]]);
  insignia(c, 150, -122, 11);
  rotulo(c, '22', -200, -84, 16);
  // torrecilla con cañon automatico y lanzabotes de humo
  forma(c, [[-60, -158], [-66, -182], [-48, -192], [30, -192], [52, -176], [48, -158]], OLIVA_O, 2.2, 45);
  c.strokeStyle = TINTA; c.lineWidth = 7; c.beginPath(); c.moveTo(50, -176); c.lineTo(196, -178); c.stroke();
  c.strokeStyle = OLIVA_C; c.lineWidth = 3; c.stroke();
  forma(c, [[192, -183], [204, -183], [204, -173], [192, -173]], OLIVA_OO, 1.6, 47);
  for (let k = 0; k < 3; k++) forma(c, [[-58 + k * 9, -188], [-50 + k * 9, -188], [-50 + k * 9, -200], [-58 + k * 9, -200]], OLIVA_OO, 1.2, 49 + k);
  soldado(c, -8, -190, { k: 0.95, mira: -0.15, sem: 180 + v.sem });
  // la red de camuflaje enrollada en la trasera de la torrecilla, con sus nudos
  forma(c, [[-72, -186], [-64, -198], [-30, -200], [-24, -190], [-40, -184]], '#3b3f32', 1.4, 58, 1.2);
  c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 0.9;
  for (let x = -66; x < -28; x += 5) { c.beginPath(); c.moveTo(x, -197); c.lineTo(x + 4, -187); c.stroke(); }
  const cim = Math.sin(t * 2.7 + v.sem) * 9;
  c.strokeStyle = TINTA; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-230, -160); c.quadraticCurveTo(-236 + cim * 0.3, -230, -250 + cim, -300); c.stroke();
  circulo(c, 236, -104, 5.5, '#d9d2b8', 1.6, 51, 0.2);
  c.restore();
}

// ---------------------------------------------------------------- tanque
// el recorrido de la oruga (para los eslabones): una vuelta cerrada de abajo a la rueda motriz y por arriba
const ORUGA = (() => {
  const p = [];
  const add = (q) => { for (const x of q) p.push(x); };
  add([[-176, 0], [176, 0]]);
  add(arco(206, -36, 36, Math.PI * 0.5, -Math.PI * 0.5, 10).slice(1));
  add([[-206, -72]]);
  add(arco(-212, -38, 34, -Math.PI * 0.5, -Math.PI * 1.5, 10).slice(1));
  add([[-176, 0]]);
  // longitudes acumuladas
  const L = [0];
  for (let k = 1; k < p.length; k++) L.push(L[k - 1] + Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1]));
  return { p, L, total: L[L.length - 1] };
})();
function enOruga(s) {
  const { p, L, total } = ORUGA;
  s = ((s % total) + total) % total;
  let k = 1; while (k < L.length - 1 && L[k] < s) k++;
  const f = (s - L[k - 1]) / (L[k] - L[k - 1] || 1);
  return [p[k - 1][0] + (p[k][0] - p[k - 1][0]) * f, p[k - 1][1] + (p[k][1] - p[k - 1][1]) * f, Math.atan2(p[k][1] - p[k - 1][1], p[k][0] - p[k - 1][0])];
}

export function tanque(c, v, t) {
  const giro = v.dist / 22, bote = Math.sin(v.dist * 0.03 + v.sem) * 1.1;
  const retro = v.retro || 0;                                     // 0-1: el golpe del disparo
  c.save();
  // al disparar el tanque entero se encabrita un poco hacia atras
  if (retro > 0) { c.translate(-200, 0); c.rotate(-0.025 * retro * (v.torreta > Math.PI / 2 ? -1 : 1)); c.translate(200, 0); }
  // ---- la oruga: banda, ruedas de rodaje, motriz, tensora y los eslabones que corren
  c.lineJoin = 'round';
  c.beginPath(); ORUGA.p.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
  c.fillStyle = '#1b1c1a'; c.fill();
  c.lineWidth = 16; c.strokeStyle = TINTA; c.stroke();
  c.lineWidth = 11; c.strokeStyle = '#2b2c29'; c.stroke();
  c.strokeStyle = 'rgba(110,110,104,.75)'; c.lineWidth = 2.2;
  for (let s = 0; s < ORUGA.total; s += 13) {
    const [x, y, a] = enOruga(s - v.dist);
    const nx = -Math.sin(a), ny = Math.cos(a);
    c.beginPath(); c.moveTo(x - nx * 6, y - ny * 6); c.lineTo(x + nx * 6, y + ny * 6); c.stroke();
  }
  for (let k = 0; k < 6; k++) {
    const x = -150 + k * 60;
    c.save(); c.translate(x, -24);
    circulo(c, 0, 0, 23, '#222320', 2.2, 61 + k, 0.4);
    circulo(c, 0, 0, 17, OLIVA_O, 1.4, 67 + k, 0.3);
    c.fillStyle = 'rgba(0,0,0,.55)';
    for (let q = 0; q < 5; q++) { const a = giro + q * 1.2566; c.beginPath(); c.arc(Math.cos(a) * 10, Math.sin(a) * 10, 2.6, 0, 7); c.fill(); }
    c.fillStyle = OLIVA_C; c.beginPath(); c.arc(0, 0, 4, 0, 7); c.fill();
    c.restore();
  }
  for (const [x, y, rr] of [[206, -36, 24], [-212, -38, 22]]) {
    c.save(); c.translate(x, y); circulo(c, 0, 0, rr, '#222320', 2.2, 71 + x, 0.4);
    c.strokeStyle = 'rgba(120,120,110,.7)'; c.lineWidth = 2;
    for (let q = 0; q < 8; q++) { const a = giro + q * 0.785; c.beginPath(); c.moveTo(Math.cos(a) * rr * 0.4, Math.sin(a) * rr * 0.4); c.lineTo(Math.cos(a) * rr * 0.9, Math.sin(a) * rr * 0.9); c.stroke(); }
    c.restore();
  }
  c.translate(0, bote);
  // ---- faldones de chapa sobre la parte de arriba de la oruga
  const faldon = [[-224, -50], [-230, -86], [226, -88], [232, -56], [190, -48], [-180, -46]];
  forma(c, faldon, OLIVA, 2.4, 73);
  c.save(); trazar(c, faldon); c.clip();
  c.fillStyle = OLIVA_C; c.fillRect(-240, -92, 480, 7);
  for (let k = -3; k <= 3; k++) raya(c, k * 64, -88, k * 64 + 2, -46, 0.5, 1.6);
  // abolladuras y barro
  c.fillStyle = 'rgba(40,36,30,.5)'; for (let k = 0; k < 9; k++) { c.beginPath(); c.ellipse(-210 + hash(k, 9) * 420, -52 + hash(k, 8) * 6, 14 + hash(k, 7) * 20, 4, 0, 0, 7); c.fill(); }
  barro(c, -230, 232, -46, 16, v.sem + 80);
  // impactos de bala en la chapa: el desconchon claro con su sombra
  for (let k = 0; k < 6; k++) { const x = -190 + hash(k, v.sem + 5) * 380, y = -80 + hash(k, v.sem + 6) * 24; c.fillStyle = 'rgba(0,0,0,.5)'; c.beginPath(); c.arc(x + 0.8, y + 0.8, 2.4, 0, 7); c.fill(); c.fillStyle = 'rgba(205,200,180,.4)'; c.beginPath(); c.arc(x, y, 1.6, 0, 7); c.fill(); }
  c.restore();
  // el faldon de goma delante de la oruga
  forma(c, [[226, -88], [244, -86], [246, -58], [230, -58]], GOMA, 1.6, 74, 0.4);
  remaches(c, Array.from({ length: 14 }, (_, k) => [-220 + k * 32.5, -82]));
  // ---- el casco: glacis inclinado delante, cubierta y trasera
  const casco = [[-226, -88], [-234, -104], [-206, -112], [150, -112], [232, -92], [230, -88]];
  forma(c, casco, OLIVA_O, 2.4, 75);
  c.fillStyle = OLIVA_C; c.beginPath(); c.moveTo(150, -112); c.lineTo(232, -92); c.lineTo(226, -90); c.lineTo(148, -108); c.fill();
  // eslabones de oruga de repuesto colgados en el glacis
  for (let k = 0; k < 4; k++) {
    const f = 0.18 + k * 0.19, x = 150 + 82 * f, y = -112 + 20 * f;
    c.save(); c.translate(x, y); c.rotate(0.24);
    forma(c, [[-8, -2], [8, -2], [8, 5], [-8, 5]], '#2b2c29', 1.3, 90 + k, 0.2);
    c.fillStyle = 'rgba(120,120,110,.6)'; c.fillRect(-6, 0, 2, 3); c.fillRect(4, 0, 2, 3);
    c.restore();
  }
  // cable de remolque con sus ojales, y la pala en el costado
  c.strokeStyle = TINTA; c.lineWidth = 3.4; c.beginPath(); c.moveTo(-200, -98); c.quadraticCurveTo(-20, -90, 120, -100); c.stroke();
  c.strokeStyle = '#4b463b'; c.lineWidth = 1.6; c.stroke();
  c.strokeStyle = TINTA; c.lineWidth = 2.2; c.beginPath(); c.ellipse(-206, -98, 6, 4, 0, 0, 7); c.moveTo(132, -100); c.ellipse(126, -100, 6, 4, 0, 0, 7); c.stroke();
  // en la trasera: dos bidones de combustible en su soporte y los escapes con su chapa
  for (const [x, y] of [[-262, -112], [-262, -142]]) {
    forma(c, [[x, y], [x + 26, y], [x + 26, y - 28], [x, y - 28]], OLIVA_O, 1.6, 92 + y, 0.3);
    c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 1.2; for (const yy of [y - 9, y - 19]) { c.beginPath(); c.moveTo(x + 1, yy); c.lineTo(x + 25, yy); c.stroke(); }
    c.fillStyle = 'rgba(220,215,190,.18)'; c.fillRect(x + 2, y - 27, 4, 26);
  }
  c.strokeStyle = TINTA; c.lineWidth = 2.6; c.beginPath(); c.moveTo(-236, -112); c.lineTo(-236, -146); c.stroke();
  forma(c, [[-232, -104], [-218, -104], [-218, -96], [-232, -96]], '#1d1e1b', 1.3, 94, 0.2);
  // escape: humo que sale atras (lo pinta el director como particulas); aqui la rejilla
  for (let k = 0; k < 4; k++) raya(c, -200 + k * 9, -110, -194 + k * 9, -104, 0.6, 2);
  circulo(c, 222, -98, 5.5, '#d9d2b8', 1.6, 77, 0.2);
  // ---- la torre: gira (v.torreta, 0 = adelante, PI = atras). De lado, el cañon se acorta con el coseno y la torre
  // enseña su trasera cuando apunta atras
  const a = v.torreta || 0, co = Math.cos(a), lado = co >= 0 ? 1 : -1, ancho = 0.72 + 0.28 * Math.abs(co);
  const [tx, ty] = MEDIDAS.tanque.torre;
  c.save(); c.translate(tx, -112);
  // el cañon (detras de la torre si apunta hacia la camara o lejos)
  const L = MEDIDAS.tanque.canon * co, rec = retro * 22 * lado;
  const canon = () => {
    const x0 = 96 * lado * ancho - rec, x1 = x0 + L;
    c.strokeStyle = TINTA; c.lineWidth = 12; c.lineCap = 'butt'; c.beginPath(); c.moveTo(x0, -26); c.lineTo(x1, -26); c.stroke();
    c.strokeStyle = OLIVA; c.lineWidth = 8; c.stroke();
    c.strokeStyle = 'rgba(235,230,210,.2)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x0, -29); c.lineTo(x1, -29); c.stroke();
    // extractor de humos y freno de boca
    const xm = x0 + L * 0.45;
    if (Math.abs(L) > 40) { forma(c, [[xm - 14 * lado, -33], [xm + 14 * lado, -33], [xm + 14 * lado, -19], [xm - 14 * lado, -19]], OLIVA_O, 1.8, 79); forma(c, [[x1 - 2 * lado, -32], [x1 + 14 * lado, -32], [x1 + 14 * lado, -20], [x1 - 2 * lado, -20]], OLIVA_OO, 1.8, 81); }
    else circulo(c, x0, -26, 9, OLIVA_OO, 2, 83, 0.2);      // de frente: la boca
    v._boca = [tx + x1 + 14 * lado, -112 - 26 + bote];
  };
  c.scale(lado * ancho, 1);
  const torre = [[-108, 0], [-114, -22], [-98, -44], [36, -50], [92, -34], [100, -12], [88, 0]];
  forma(c, torre, OLIVA, 2.6, 85);
  c.save(); trazar(c, torre); c.clip();
  c.fillStyle = OLIVA_C; c.beginPath(); c.moveTo(-98, -44); c.lineTo(36, -50); c.lineTo(92, -34); c.lineTo(88, -28); c.lineTo(36, -42); c.lineTo(-96, -38); c.fill();
  c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(-120, -8, 240, 10);
  raya(c, -60, -44, -66, 0, 0.35, 1.4);
  c.restore();
  // mantelete, escotilla del jefe con el jefe asomado, ametralladora
  forma(c, [[86, -38], [104, -36], [104, -14], [86, -12]], OLIVA_O, 2, 87);
  // la cesta de la trasera de la torre: el enrejado y los petates y la lona que asoman
  forma(c, [[-140, -44], [-128, -54], [-112, -50], [-104, -40], [-118, -44]], LONA, 1.4, 88, 1);
  forma(c, [[-150, -12], [-150, -44], [-106, -44], [-106, -12]], 'rgba(30,32,28,.6)', 1.6, 89, 0.3);
  c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 1;
  for (let x = -146; x < -106; x += 7) { c.beginPath(); c.moveTo(x, -44); c.lineTo(x, -12); c.stroke(); }
  for (let y = -38; y < -12; y += 8) { c.beginPath(); c.moveTo(-150, y); c.lineTo(-106, y); c.stroke(); }
  forma(c, [[-148, -30], [-138, -40], [-124, -38], [-122, -24]], LONA_O, 1.2, 86, 1);
  // los lanzahumos en el costado delantero, tres tubos hacia arriba
  for (let k = 0; k < 3; k++) { c.save(); c.translate(58 + k * 8, -46); c.rotate(-0.5); forma(c, [[-3, 0], [3, 0], [3, -12], [-3, -12]], OLIVA_OO, 1.2, 95 + k, 0.2); c.restore(); }
  // la caja del visor del tirador y la cupula del jefe con sus periscopios
  forma(c, [[30, -50], [50, -51], [50, -62], [32, -62]], OLIVA_O, 1.5, 98, 0.3);
  c.fillStyle = 'rgba(160,190,210,.3)'; c.fillRect(44, -60, 5, 7);
  forma(c, [[-54, -46], [-6, -48], [-8, -56], [-50, -55]], OLIVA_O, 1.6, 99, 0.3);
  for (let k = 0; k < 4; k++) forma(c, [[-50 + k * 11, -55], [-43 + k * 11, -55], [-44 + k * 11, -60], [-49 + k * 11, -60]], '#1d2226', 1, 100 + k, 0.1);
  remaches(c, [[-90, -36], [-40, -40], [10, -42], [60, -36], [-90, -8], [60, -8]]);
  c.restore();
  // lo que no se escala con la torre: el cañon, el jefe asomado y la insignia
  c.save(); c.translate(tx, -112);
  canon();
  c.restore();
  c.save(); c.translate(tx, -112);
  if (!v.escondido) {
    soldado(c, -30 * lado * ancho, -54, { k: 1, mira: lado > 0 ? 0.05 : -0.4, sem: 200 + v.sem });
    c.strokeStyle = TINTA; c.lineWidth = 3; c.beginPath(); c.moveTo(-18 * lado, -66); c.lineTo(22 * lado, -74); c.stroke();     // ametralladora de la escotilla
    forma(c, [[2 * lado, -72], [10 * lado, -74], [10 * lado, -66], [2 * lado, -64]], '#24251f', 1, 104, 0.2);                       // su caja de cinta
  } else {
    // escondido: la tapa de la escotilla cerrada (con un golpe de las bestias encima)
    forma(c, [[-50 * lado * ancho, -56], [-10 * lado * ancho, -57], [-12 * lado * ancho, -63], [-48 * lado * ancho, -62]], OLIVA, 1.6, 105, 0.3);
  }
  insignia(c, 20 * lado * ancho, -26, 10);
  rotulo(c, v.num || '47', -66 * lado * ancho, -18, 14);
  // antenas de latigo
  const cim = Math.sin(t * 2.3 + v.sem) * 12 + Math.sin(v.dist * 0.018) * 8;
  c.strokeStyle = TINTA; c.lineWidth = 1.6;
  for (const k of [0, 1]) { const x = (-96 + k * 12) * lado * ancho; c.beginPath(); c.moveTo(x, -40); c.quadraticCurveTo(x - 6 * lado + cim * 0.3, -130, x - 24 * lado + cim, -230 + k * 24); c.stroke(); }
  c.restore();
  c.restore();
}

export const DIBUJAR = { jeep, camion, blindado, tanque };
