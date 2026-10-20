// Lo que flota en la plaza (y lo que cae por la ciudad), modelado con algo de verdad en vez de cajas:
// - LOSA: un trozo de plaza arrancado: arriba el pavimento con sus juntas y un bordillo, debajo la capa de
//   hormigon y la tierra con raices colgando, el borde partido y varillas de ferralla que asoman.
// - VIGA: perfil de acero en doble T visto de lado (alas, alma con su sombra, rigidizadores, tornillos,
//   un extremo cortado a soplete y oxido pardo).
// - BURBUJA: agua en gravedad cero, que tiembla, con reflejo, la luz que la atraviesa y el borde mas oscuro.
// - SILUETAS para el fondo: coche, banco, farola, losa, viga, arbol con raices, buzon.
// Todo en unidades del mundo con el centro en el origen; el color de cada cosa sigue la paleta de la zona.
import { TINTA, GROSOR, azar, rgba, mezclar } from './tinta.js';

const OXIDO = '#5e4130', OXIDO2 = '#7a5640';

export function losa(c, w, h, semilla, z, verde = '#3f5a54', verdeClaro = '#7ea69b') {
  const r = azar(semilla * 131 + 7);
  // contorno: arriba casi recto (la plaza), abajo un cono roto de tierra
  const arriba = [], abajo = [];
  for (let k = 0; k <= 6; k++) arriba.push([-w / 2 + (w * k) / 6, -h / 2 + (r() - 0.5) * 2.5]);
  const fondo = h * (0.9 + r() * 0.5);
  // tierra arrancada: un bulto irregular, mas hondo hacia el centro y con terrones que cuelgan
  const n = 11;
  for (let k = n; k >= 0; k--) {
    const u = k / n, centro = Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(u - 0.5) * 2, 2)));
    const terron = k % 3 === 1 ? 0.25 : 0;
    abajo.push([-w / 2 + w * u + (r() - 0.5) * 5, -h / 2 + 8 + centro * fondo * (0.45 + r() * 0.45 + terron)]);
  }
  const pts = arriba.concat(abajo);
  const camino = () => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) c.lineTo(p[0], p[1]); c.closePath(); };
  // tierra
  camino();
  const g = c.createLinearGradient(0, -h / 2, 0, h);
  g.addColorStop(0, '#4d4a44'); g.addColorStop(1, '#2c2a27');
  c.fillStyle = g; c.fill();
  c.save(); camino(); c.clip();
  // hormigon (capa gris bajo el pavimento) y piedrecitas en la tierra
  c.fillStyle = '#6b6d70'; c.fillRect(-w, -h / 2 + 4, w * 2, 6);
  for (let k = 0; k < w / 4; k++) { c.fillStyle = rgba(r() < 0.5 ? '#8a8578' : '#211f1c', 0.7); c.beginPath(); c.arc(-w / 2 + r() * w, -h / 2 + 12 + r() * fondo, 0.8 + r() * 1.6, 0, 7); c.fill(); }
  // pavimento: baldosas con juntas
  c.fillStyle = mezclar(z.medio, '#ffffff', 0.25); c.fillRect(-w, -h / 2 - 4, w * 2, 8);
  c.strokeStyle = rgba(TINTA, 0.7); c.lineWidth = 1;
  for (let x = -w / 2 + 6 + r() * 6; x < w / 2; x += 11 + r() * 3) { c.beginPath(); c.moveTo(x, -h / 2 - 3); c.lineTo(x + 0.5, -h / 2 + 4); c.stroke(); }
  c.restore();
  camino(); c.lineWidth = GROSOR; c.strokeStyle = TINTA; c.lineJoin = 'round'; c.stroke();
  // linea del pavimento
  c.beginPath(); c.moveTo(-w / 2, -h / 2 + 4); c.lineTo(w / 2, -h / 2 + 4); c.lineWidth = 1.2; c.stroke();
  // varillas de ferralla que asoman por el borde partido
  c.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    const lado = k % 2 ? 1 : -1, y = -h / 2 + 6 + r() * 4;
    const x0 = lado * w / 2, largo = 6 + r() * 12, curva = (r() - 0.5) * 10;
    c.beginPath(); c.moveTo(x0, y); c.quadraticCurveTo(x0 + lado * largo * 0.6, y + curva * 0.3, x0 + lado * largo, y + curva);
    c.lineWidth = 2.6; c.strokeStyle = TINTA; c.stroke(); c.lineWidth = 1.2; c.strokeStyle = OXIDO2; c.stroke();
  }
  // raices colgando
  c.strokeStyle = '#1e1c1a'; c.lineWidth = 1.2;
  for (let k = 0; k < 5; k++) {
    const x = -w / 3 + r() * (w * 2 / 3), y = -h / 2 + 10 + fondo * 0.5;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + (r() - 0.5) * 10, y + 8, x + (r() - 0.5) * 14, y + 14 + r() * 14); c.stroke();
  }
  // hierba que sigue creciendo encima
  c.strokeStyle = verde; c.lineWidth = 1.6;
  for (let k = 0; k < 8; k++) {
    const x = -w / 2 + 4 + r() * (w - 8), alto = 4 + r() * 9;
    c.beginPath(); c.moveTo(x, -h / 2 - 3); c.quadraticCurveTo(x + (r() - 0.5) * 4, -h / 2 - 3 - alto * 0.6, x + (r() - 0.5) * 6, -h / 2 - 3 - alto); c.stroke();
  }
  c.fillStyle = verdeClaro; c.beginPath(); c.ellipse(-w / 2 + 8 + r() * (w - 16), -h / 2 - 3, 6, 2.5, 0, 0, 7); c.fill();
}

export function vigaH(c, w, h, semilla) {
  const r = azar(semilla * 59 + 3);
  const ala = Math.max(4, h * 0.2), x0 = -w / 2, x1 = w / 2;
  // extremo derecho cortado a soplete (en diagonal)
  const corte = 6 + r() * 8;
  const perfil = () => { c.beginPath(); c.moveTo(x0, -h / 2); c.lineTo(x1 - corte, -h / 2); c.lineTo(x1, h / 2); c.lineTo(x0, h / 2); c.closePath(); };
  perfil();
  c.fillStyle = '#55595e'; c.fill();
  c.save(); perfil(); c.clip();
  // alma: mas oscura y metida (sombra bajo el ala de arriba)
  const g = c.createLinearGradient(0, -h / 2 + ala, 0, h / 2 - ala);
  g.addColorStop(0, '#2c2f33'); g.addColorStop(0.35, '#3f4347'); g.addColorStop(1, '#474b50');
  c.fillStyle = g; c.fillRect(x0, -h / 2 + ala, w, h - ala * 2);
  // alas con su brillo
  c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x0, -h / 2, w, 1.5); c.fillRect(x0, h / 2 - ala, w, 1.2);
  // rigidizadores cada tanto
  for (let x = x0 + 16 + r() * 10; x < x1 - 12; x += 26 + r() * 8) { c.fillStyle = '#5b6066'; c.fillRect(x, -h / 2 + ala, 3.5, h - ala * 2); c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x + 3.5, -h / 2 + ala, 1.5, h - ala * 2); }
  // tornillos en la cartela de la izquierda
  c.fillStyle = '#2a2c2f';
  for (let q = 0; q < 2; q++) for (let p = 0; p < 2; p++) { c.beginPath(); c.arc(x0 + 6 + p * 6, -h / 2 + ala + 4 + q * (h - ala * 2 - 8), 1.6, 0, 7); c.fill(); }
  // oxido
  for (let k = 0; k < 10; k++) { c.fillStyle = rgba(r() < 0.5 ? OXIDO : OXIDO2, 0.5); c.beginPath(); c.ellipse(x0 + r() * w, (r() - 0.5) * h, 2 + r() * 7, 1 + r() * 3, 0, 0, 7); c.fill(); }
  // chorreones desde el ala de arriba
  for (let k = 0; k < 4; k++) { const x = x0 + r() * w; c.fillStyle = rgba(OXIDO, 0.4); c.fillRect(x, -h / 2 + ala, 1.6, 4 + r() * (h - ala * 2 - 4)); }
  c.restore();
  perfil(); c.lineWidth = GROSOR; c.strokeStyle = TINTA; c.lineJoin = 'round'; c.stroke();
  c.lineWidth = 1.2; c.beginPath(); c.moveTo(x0, -h / 2 + ala); c.lineTo(x1 - corte * (1 - ala / h), -h / 2 + ala); c.moveTo(x0, h / 2 - ala); c.lineTo(x1 - corte * (ala / h), h / 2 - ala); c.stroke();
}

export function burbuja(c, R, t, fase) {
  // agua sin peso: tiembla en dos modos y gira despacio
  const a = Math.sin(t * 2.3 + fase) * 0.07, b = Math.sin(t * 3.7 + fase * 2) * 0.04;
  c.save(); c.rotate(t * 0.2 + fase); c.scale(1 + a, 1 - a + b);
  // halo
  c.save(); c.globalCompositeOperation = 'lighter';
  const halo = c.createRadialGradient(0, 0, R * 0.6, 0, 0, R * 2);
  halo.addColorStop(0, 'rgba(190,225,250,.25)'); halo.addColorStop(1, 'rgba(190,225,250,0)');
  c.fillStyle = halo; c.fillRect(-R * 2, -R * 2, R * 4, R * 4); c.restore();
  // cuerpo: casi transparente en el centro, mas denso en el borde (Fresnel)
  const g = c.createRadialGradient(-R * 0.2, -R * 0.2, R * 0.1, 0, 0, R);
  g.addColorStop(0, 'rgba(200,232,250,.08)'); g.addColorStop(0.7, 'rgba(160,205,235,.22)'); g.addColorStop(1, 'rgba(120,170,210,.55)');
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, 7); c.fill();
  // la luz que pasa y se concentra abajo (caustica)
  c.fillStyle = 'rgba(235,248,255,.45)'; c.beginPath(); c.ellipse(R * 0.25, R * 0.45, R * 0.35, R * 0.14, -0.4, 0, 7); c.fill();
  // reflejo de ventana arriba a la izquierda
  c.fillStyle = 'rgba(255,255,255,.85)';
  c.beginPath(); c.ellipse(-R * 0.38, -R * 0.42, R * 0.22, R * 0.11, -0.7, 0, 7); c.fill();
  c.beginPath(); c.arc(-R * 0.12, -R * 0.62, R * 0.06, 0, 7); c.fill();
  c.lineWidth = 1.4; c.strokeStyle = 'rgba(40,70,95,.7)'; c.beginPath(); c.arc(0, 0, R, 0, 7); c.stroke();
  c.restore();
}

// siluetas planas para las capas del fondo (se pintan una vez y se desenfocan)
export function silueta(c, tipo, s, r) {
  c.save(); c.scale(s, s);
  c.beginPath();
  if (tipo === 'coche') {
    c.moveTo(-64, 0); c.lineTo(-66, -14); c.quadraticCurveTo(-62, -26, -48, -28); c.quadraticCurveTo(-36, -44, -20, -46); c.lineTo(16, -46);
    c.quadraticCurveTo(24, -44, 36, -30); c.lineTo(60, -26); c.quadraticCurveTo(67, -22, 67, -12); c.lineTo(66, 0); c.closePath();
    c.fill(); c.beginPath(); c.arc(-40, 0, 11, 0, 7); c.arc(42, 0, 11, 0, 7);
  } else if (tipo === 'banco') {
    c.rect(-34, -16, 68, 4); c.rect(-34, -30, 68, 4); c.rect(-34, -24, 68, 3); c.rect(-30, -16, 4, 16); c.rect(26, -16, 4, 16); c.rect(-30, -30, 3, 14); c.rect(27, -30, 3, 14);
  } else if (tipo === 'farola') {
    c.rect(-2, -110, 4, 110); c.rect(-6, -4, 12, 4); c.moveTo(0, -110); c.quadraticCurveTo(4, -120, 22, -116); c.lineTo(22, -112); c.quadraticCurveTo(6, -116, 2, -106); c.rect(16, -116, 14, 5);
  } else if (tipo === 'losa') {
    c.moveTo(-40, -6); c.lineTo(38, -8); c.lineTo(42, 0); c.lineTo(20, 14); c.lineTo(4, 26); c.lineTo(-14, 16); c.lineTo(-38, 4); c.closePath();
  } else if (tipo === 'viga') {
    c.rect(-60, -6, 120, 12);
  } else if (tipo === 'arbol') {
    // arbol arrancado de cuajo: copa, tronco y raices al aire
    for (let k = 0; k < 7; k++) c.ellipse(-8 + (r() - 0.5) * 50, -70 - r() * 30, 16 + r() * 10, 12 + r() * 8, 0, 0, 7);
    c.rect(-4, -60, 8, 60);
    c.fill(); c.beginPath();
    c.lineWidth = 3; c.lineCap = 'round';
    for (let k = 0; k < 7; k++) { c.moveTo(0, 0); c.quadraticCurveTo((r() - 0.5) * 30, 10, (r() - 0.5) * 50, 14 + r() * 18); }
    c.stroke(); c.restore(); return;
  } else if (tipo === 'buzon') {
    c.rect(-8, -34, 16, 26); c.ellipse(0, -34, 8, 5, 0, Math.PI, 0); c.rect(-2, -8, 4, 8);
  }
  c.fill();
  c.restore();
}
