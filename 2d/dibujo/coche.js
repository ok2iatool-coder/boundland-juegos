// Coche abandonado de la ciudad: un turismo de cinco puertas a escala del mundo (4,1 m = 262 u de largo,
// 1,45 m = 92 u de alto; el 18 mide 50 u). Lleva lo que tiene un coche de verdad visto de lado: capo,
// parabrisas inclinado, techo, luneta y maletero; pasos de rueda; ruedas DESINFLADAS con su llanta;
// puertas con juntas y tiradores; cristales oscuros con grietas y alguno roto; faros y pilotos;
// parachoques; oxido pardo (GDD: el naranja es solo la Podredumbre) y abolladuras; musgo y hierba encima.
// Origen: en el suelo, en el centro del coche; el morro mira a +x. Todo en unidades del mundo.
import { TINTA, GROSOR, azar, rgba, mezclar } from './tinta.js';

export const COCHE = { largo: 262, alto: 92 };
const PINTURAS = ['#5d6870', '#5f6a58', '#7a7464', '#6e534c', '#4e5a66', '#6b6b63'];

// silueta del lateral (sin los pasos de rueda): de la cola por arriba hasta el morro
function silueta(c) {
  c.moveTo(-128, -16);
  c.lineTo(-133, -22); c.lineTo(-133, -38);                       // parachoques trasero
  c.quadraticCurveTo(-131, -50, -122, -53);                        // esquina del maletero
  c.lineTo(-98, -56);                                              // tapa del maletero
  c.quadraticCurveTo(-88, -58, -82, -64);                          // arranque de la luneta
  c.quadraticCurveTo(-70, -86, -52, -89);                          // luneta inclinada
  c.quadraticCurveTo(-10, -93, 30, -89);                           // techo
  c.quadraticCurveTo(44, -86, 70, -62);                            // parabrisas
  c.quadraticCurveTo(100, -57, 120, -52);                          // capo
  c.quadraticCurveTo(131, -49, 133, -40);                          // morro
  c.lineTo(134, -24); c.lineTo(128, -16);                          // parachoques delantero
  // bajos con los pasos de rueda
  c.lineTo(112, -16); c.arc(84, -16, 28, 0, Math.PI, true);
  c.lineTo(-56, -16); c.arc(-84, -16, 28, 0, Math.PI, true);
  c.closePath();
}

function rueda(c, x, y, r, rnd, sinTapa) {
  // neumatico pinchado: aplastado contra el suelo
  c.save(); c.translate(x, y);
  c.beginPath(); c.ellipse(0, 1.5, r + 1.5, r - 1.5, 0, 0, 7);
  c.fillStyle = '#17171a'; c.fill(); c.lineWidth = GROSOR; c.strokeStyle = TINTA; c.stroke();
  // banda de rodadura gastada
  c.lineWidth = 1; c.strokeStyle = 'rgba(70,70,74,.6)';
  c.beginPath(); c.arc(0, 1.5, r - 3, Math.PI * 1.1, Math.PI * 1.65); c.stroke();
  // llanta
  c.beginPath(); c.arc(0, 0, r * 0.56, 0, 7);
  c.fillStyle = sinTapa ? '#3d3f42' : '#7d8084'; c.fill(); c.lineWidth = 1.6; c.strokeStyle = TINTA; c.stroke();
  c.fillStyle = TINTA;
  if (sinTapa) for (let k = 0; k < 5; k++) { const a = k * 1.2566 + rnd; c.beginPath(); c.arc(Math.cos(a) * r * 0.32, Math.sin(a) * r * 0.32, 1.4, 0, 7); c.fill(); }
  else { c.beginPath(); c.arc(0, 0, r * 0.14, 0, 7); c.fill(); c.lineWidth = 0.8; c.beginPath(); c.arc(0, 0, r * 0.4, Math.PI * 1.1, Math.PI * 1.6); c.strokeStyle = 'rgba(255,255,255,.35)'; c.stroke(); }
  c.restore();
}

// dibuja el coche; opciones: { semilla, vuelto, escala, pintura, vegetacion, verde, verdeClaro }
export function dibujarCoche(c, o = {}) {
  const r = azar((o.semilla || 1) * 977 + 3);
  const pintura = o.pintura || PINTURAS[Math.floor(r() * PINTURAS.length)];
  const verde = o.verde || '#4e5038', verdeClaro = o.verdeClaro || '#7d7f58';
  const oxido = '#5e4130', oxidoClaro = '#7a5640';
  c.save();
  if (o.escala) c.scale(o.escala, o.escala);
  if (o.vuelto) { c.translate(0, -94); c.scale(1, -1); }
  // sombra en el suelo
  if (!o.vuelto && !o.flota) { c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(0, -2, 140, 7, 0, 0, 7); c.fill(); }
  // ruedas detras de la carroceria
  rueda(c, -84, -21, 21, r() * 6, r() < 0.5);
  rueda(c, 84, -21, 21, r() * 6, r() < 0.5);
  // carroceria
  c.beginPath(); silueta(c);
  const g = c.createLinearGradient(0, -92, 0, -14);
  g.addColorStop(0, mezclar(pintura, '#ffffff', 0.12)); g.addColorStop(0.45, pintura); g.addColorStop(1, mezclar(pintura, '#000000', 0.35));
  c.fillStyle = g; c.fill();
  c.save(); c.clip();
  // linea de cintura (el pliegue que recorre el lateral) y su brillo
  c.fillStyle = mezclar(pintura, '#000000', 0.18); c.fillRect(-140, -41, 280, 3);
  c.fillStyle = rgba('#ffffff', 0.12); c.fillRect(-140, -45, 280, 2);
  // oxido: alrededor de los pasos de rueda, en los bajos y chorreones bajo las ventanas
  for (const [cx, cy, n] of [[-84, -24, 9], [84, -24, 9], [0, -18, 8], [-120, -30, 4], [125, -28, 3]]) {
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI, d = 26 + r() * 10;
      c.fillStyle = rgba(r() < 0.5 ? oxido : oxidoClaro, 0.45 + r() * 0.35);
      c.beginPath(); c.ellipse(cx + Math.cos(a) * d * (cy < -20 ? 1 : 2.5), cy - Math.sin(a) * d * 0.5, 3 + r() * 8, 2 + r() * 5, r() * 3, 0, 7); c.fill();
    }
  }
  for (let k = 0; k < 7; k++) {
    const x = -80 + r() * 150, y = -56;
    c.fillStyle = rgba(oxido, 0.35);
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + 2.5, y); c.lineTo(x + 1.5 + r() * 2, y + 10 + r() * 20); c.lineTo(x + 0.5, y + 12); c.fill();
  }
  c.restore();
  c.beginPath(); silueta(c); c.lineWidth = GROSOR; c.strokeStyle = TINTA; c.lineJoin = 'round'; c.stroke();

  // cristales: luneta+ventana trasera, ventana delantera, parabrisas (de lado se ve fino)
  const cristal = (pts) => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) c.lineTo(pts[k][0], pts[k][1]); c.closePath(); };
  const trasera = [[-79, -60], [-66, -80], [-50, -84], [-16, -85], [-16, -60]];
  const delantera = [[-8, -60], [-8, -85], [26, -84], [40, -80], [60, -62]];
  const rota = Math.floor(r() * 3);   // 0: ninguna, 1: trasera rota, 2: delantera rota
  for (const [k, pts] of [[1, trasera], [2, delantera]]) {
    cristal(pts);
    if (rota === k) {
      // rota: se ve el interior (respaldo del asiento) y quedan picos de cristal en el marco
      c.fillStyle = '#121315'; c.fill();
      c.save(); c.clip();
      c.fillStyle = '#26282b'; c.beginPath(); c.ellipse(pts[0][0] + 26, -66, 9, 16, -0.2, 0, 7); c.fill();
      c.fillStyle = 'rgba(160,185,200,.35)';
      for (let q = 0; q < 4; q++) { const x = pts[0][0] + 6 + q * 14; c.beginPath(); c.moveTo(x, -60); c.lineTo(x + 5, -60); c.lineTo(x + 2, -66 - r() * 8); c.fill(); }
      c.restore();
    } else {
      const gc = c.createLinearGradient(0, -86, 0, -60);
      gc.addColorStop(0, '#2f3a42'); gc.addColorStop(1, '#14181c');
      c.fillStyle = gc; c.fill();
      c.save(); c.clip();
      // reflejo en diagonal
      c.fillStyle = 'rgba(220,235,245,.16)';
      c.beginPath(); c.moveTo(pts[0][0] + 8, -60); c.lineTo(pts[0][0] + 20, -60); c.lineTo(pts[0][0] + 40, -86); c.lineTo(pts[0][0] + 28, -86); c.fill();
      // grietas en tela de arana
      if (r() < 0.6) {
        const gx = pts[0][0] + 14 + r() * 30, gy = -70 - r() * 8;
        c.strokeStyle = 'rgba(210,225,235,.5)'; c.lineWidth = 0.7;
        for (let q = 0; q < 7; q++) { const a = q * 0.9 + r(); c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + Math.cos(a) * (8 + r() * 14), gy + Math.sin(a) * (6 + r() * 10)); c.stroke(); }
        c.beginPath(); c.arc(gx, gy, 4, 0, 7); c.stroke();
      }
      c.restore();
    }
    c.lineWidth = 1.8; c.strokeStyle = TINTA; c.stroke();
  }
  // pilares B y C en negro mate
  c.fillStyle = '#1b1c1e'; c.fillRect(-16, -86, 8, 26);
  // juntas de las puertas, tiradores y retrovisor
  c.strokeStyle = TINTA; c.lineWidth = 1.4;
  c.beginPath();
  // la puerta de atras acaba sobre el paso de rueda trasero y la de delante antes del delantero
  c.moveTo(-79, -59); c.quadraticCurveTo(-70, -50, -60, -40); c.quadraticCurveTo(-56, -30, -55, -20);
  c.moveTo(-12, -60); c.lineTo(-12, -20);                            // entre puertas
  c.moveTo(60, -61); c.quadraticCurveTo(62, -44, 56, -32); c.lineTo(56, -20);
  c.moveTo(-55, -20); c.lineTo(56, -20);
  c.stroke();
  c.fillStyle = '#1b1c1e'; c.fillRect(-36, -50, 11, 3); c.fillRect(34, -50, 11, 3);
  c.beginPath(); c.moveTo(60, -63); c.lineTo(72, -66); c.lineTo(73, -59); c.lineTo(62, -58); c.closePath();
  c.fillStyle = pintura; c.fill(); c.lineWidth = 1.4; c.stroke();
  // abolladuras
  c.strokeStyle = rgba('#000000', 0.45); c.lineWidth = 1;
  for (let k = 0; k < 3; k++) { const x = -100 + r() * 200, y = -30 - r() * 20; c.beginPath(); c.arc(x, y, 6 + r() * 6, Math.PI * (0.9 + r() * 0.3), Math.PI * (1.6 + r() * 0.3)); c.stroke(); }
  // faro (roto: pico oscuro) y piloto
  c.beginPath(); c.moveTo(118, -50); c.quadraticCurveTo(130, -48, 132, -42); c.lineTo(118, -42); c.closePath();
  c.fillStyle = '#a9b4b8'; c.fill(); c.lineWidth = 1.4; c.stroke();
  c.fillStyle = '#2a2d30'; c.beginPath(); c.moveTo(124, -49); c.lineTo(130, -44); c.lineTo(124, -43); c.fill();
  c.beginPath(); c.moveTo(-132, -48); c.lineTo(-122, -52); c.lineTo(-120, -42); c.lineTo(-132, -40); c.closePath();
  c.fillStyle = '#4e2826'; c.fill(); c.stroke();
  // parachoques
  c.fillStyle = '#2b2c2f';
  c.beginPath(); c.moveTo(-134, -36); c.lineTo(-120, -36); c.lineTo(-120, -22); c.lineTo(-132, -20); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(134, -36); c.lineTo(118, -36); c.lineTo(118, -22); c.lineTo(130, -20); c.closePath(); c.fill(); c.stroke();
  // matricula
  c.fillStyle = '#c9c4b4'; c.fillRect(-133, -33, 3, 9);

  // vegetacion: musgo sobre techo, capo y maletero; hierba entre las ruedas; una enredadera que baja
  if (o.vegetacion !== false) {
    // musgo: una almohadilla baja que sigue la chapa, con briznas que asoman
    const mata = (x, y, n, tam) => {
      const ancho = tam * n * 0.9;
      c.beginPath(); c.moveTo(x - ancho / 2, y + 1);
      for (let k = 0; k <= n; k++) {
        const xx = x - ancho / 2 + (ancho * k) / n;
        c.quadraticCurveTo(xx - ancho / n / 2, y - tam * (0.5 + r() * 0.6), xx, y - tam * 0.2 * r());
      }
      c.lineTo(x + ancho / 2, y + 1); c.closePath();
      c.fillStyle = verde; c.fill(); c.lineWidth = 1.3; c.strokeStyle = TINTA; c.stroke();
      c.fillStyle = verdeClaro;
      for (let k = 0; k < n; k++) { c.beginPath(); c.ellipse(x - ancho / 2 + ancho * (k + 0.5) / n, y - tam * 0.35, tam * 0.45, tam * 0.18, 0, 0, 7); c.fill(); }
      c.strokeStyle = verde; c.lineWidth = 1.2; c.lineCap = 'round';
      for (let k = 0; k < n * 2; k++) { const xx = x - ancho / 2 + r() * ancho; c.beginPath(); c.moveTo(xx, y - tam * 0.3); c.lineTo(xx + (r() - 0.5) * 4, y - tam * (0.9 + r())); c.stroke(); }
    };
    mata(-22, -90, 7, 6); mata(14, -90, 3, 5); mata(-110, -55, 4, 5); mata(96, -56, 3, 4);
    c.strokeStyle = verde; c.lineWidth = 1.8; c.lineCap = 'round';
    for (let k = 0; k < 16; k++) {
      const x = -60 + r() * 120, alto = 10 + r() * 22;
      c.beginPath(); c.moveTo(x, -4); c.quadraticCurveTo(x + (r() - 0.5) * 8, -4 - alto * 0.6, x + (r() - 0.5) * 12, -4 - alto); c.stroke();
    }
    // enredadera desde el techo por la ventana trasera
    c.lineWidth = 1.4; c.strokeStyle = TINTA;
    let x = -40, y = -90;
    c.beginPath(); c.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 10; y += 9; c.lineTo(x, y); }
    c.stroke();
    for (let k = 0; k < 6; k++) { c.fillStyle = k % 2 ? verde : verdeClaro; c.beginPath(); c.ellipse(-40 + (r() - 0.5) * 12, -86 + k * 8, 3.5, 2, r() * 3, 0, 7); c.fill(); }
  }
  c.restore();
}
