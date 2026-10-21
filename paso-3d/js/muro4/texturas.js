// Las texturas del Muro Exterior, pintadas en lienzos al cargar (nada de fotos): suelo, asfalto, madera de cajas y
// pales, bidones, la malla con geotextil de los gaviones, la arpillera de los sacos, la lona, y la tira de PINTADAS del
// muro (sin palabras: el juego va en ingles; marcas de dias, flechas, manos, una firma, codigos de bloque y el oxido que
// chorrea de los agujeros de izado).
import * as THREE from 'three';

const lienzo = (w, h = w) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return [cv, cv.getContext('2d')]; };
const azar = (s) => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
function textura(cv, { srgb = true, rep = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}
// pinta f en las nueve copias (para que la textura no tenga costura)
const vuelta = (c, N, M, f) => { for (const dx of [-N, 0, N]) for (const dy of [-M, 0, M]) { c.save(); c.translate(dx, dy); f(); c.restore(); } };
function mancha(c, x, y, rr, rgb, a) { const g = c.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); c.fillStyle = g; c.fillRect(x - rr, y - rr, 2 * rr, 2 * rr); }

// ruido de valor (gris) para variar lo que pintan los sombreadores
export function texturaRuido() {
  const N = 256, [cv, c] = lienzo(N), r = azar(5);
  c.fillStyle = '#808080'; c.fillRect(0, 0, N, N);
  for (let n = 0; n < 420; n++) { const x = r() * N, y = r() * N, rr = 8 + r() * 46; vuelta(c, N, N, () => mancha(c, x, y, rr, r() < 0.5 ? '0,0,0' : '255,255,255', 0.1 + r() * 0.2)); }
  const t = textura(cv, { srgb: false });
  return t;
}

// el grano del suelo (tierra, grava, barro): se multiplica por el color de cada vertice
export function texturaSuelo() {
  const N = 1024, [cv, c] = lienzo(N), r = azar(17);
  c.fillStyle = '#b4b4b4'; c.fillRect(0, 0, N, N);
  for (let n = 0; n < 160; n++) { const x = r() * N, y = r() * N, rr = 20 + r() * 120; vuelta(c, N, N, () => mancha(c, x, y, rr, r() < 0.6 ? '60,60,60' : '230,230,230', 0.06 + r() * 0.12)); }
  // piedrecillas con su sombra y su luz
  for (let n = 0; n < 5200; n++) {
    const x = r() * N, y = r() * N, rr = 0.8 + r() * r() * r() * 7, k = 120 + r() * 80;
    c.fillStyle = 'rgba(20,20,20,.45)'; c.beginPath(); c.ellipse(x + rr * 0.35, y + rr * 0.4, rr, rr * 0.8, 0, 0, 7); c.fill();
    c.fillStyle = `rgb(${k},${k},${k - 6})`; c.beginPath(); c.ellipse(x, y, rr, rr * (0.6 + r() * 0.4), r() * 3, 0, 7); c.fill();
    if (rr > 2.5) { c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.ellipse(x - rr * 0.3, y - rr * 0.3, rr * 0.4, rr * 0.3, 0, 0, 7); c.fill(); }
  }
  // grieteado del barro seco
  c.strokeStyle = 'rgba(30,30,30,.35)'; c.lineWidth = 1.2;
  for (let n = 0; n < 40; n++) {
    let x = r() * N, y = r() * N, a = r() * 6.3;
    c.beginPath(); c.moveTo(x, y);
    for (let k = 0; k < 9; k++) { a += (r() - 0.5) * 1.4; x += Math.cos(a) * 12; y += Math.sin(a) * 12; c.lineTo(x, y); }
    c.stroke();
  }
  return textura(cv);
}

// el asfalto de la carretera del puesto (6 m de ancho: la textura va a 1 m = 170 px a lo ancho y se repite a lo largo)
export function texturaAsfalto() {
  const W = 1024, H = 1024, [cv, c] = lienzo(W, H), r = azar(23);
  c.fillStyle = '#4a4b4c'; c.fillRect(0, 0, W, H);
  for (let n = 0; n < 7000; n++) { const k = 50 + r() * 110; c.fillStyle = `rgba(${k},${k},${k},${0.3 + r() * 0.5})`; c.fillRect(r() * W, r() * H, 1 + r() * 2.5, 1 + r() * 2.5); }
  for (let n = 0; n < 60; n++) { const x = r() * W, y = r() * H; vuelta(c, W, H, () => mancha(c, x, y, 30 + r() * 140, r() < 0.7 ? '20,20,22' : '120,120,118', 0.08 + r() * 0.12)); }
  // bacheo: parches rectos mas oscuros con su junta
  for (let n = 0; n < 5; n++) {
    const x = 60 + r() * (W - 300), y = r() * H, w = 80 + r() * 200, h = 60 + r() * 220;
    vuelta(c, W, H, () => { c.fillStyle = 'rgba(30,31,33,.22)'; c.fillRect(x, y, w, h); c.strokeStyle = 'rgba(15,15,16,.45)'; c.lineWidth = 2; c.strokeRect(x, y, w, h); });
  }
  // las rodadas (dos bandas mas lisas y oscuras) y aceite
  for (const xr of [0.27, 0.73]) { const g = c.createLinearGradient(xr * W - 90, 0, xr * W + 90, 0); g.addColorStop(0, 'rgba(25,25,27,0)'); g.addColorStop(0.5, 'rgba(25,25,27,.22)'); g.addColorStop(1, 'rgba(25,25,27,0)'); c.fillStyle = g; c.fillRect(xr * W - 90, 0, 180, H); }
  for (let n = 0; n < 14; n++) { const x = W * (0.35 + r() * 0.3), y = r() * H; vuelta(c, W, H, () => mancha(c, x, y, 10 + r() * 40, '8,8,10', 0.3)); }
  // grietas: longitudinales, transversales y piel de cocodrilo en los bordes
  const grieta = (x, y, a, n, paso, w) => { c.lineWidth = w; c.strokeStyle = 'rgba(12,12,13,.8)'; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < n; k++) { a += (r() - 0.5) * 0.7; x += Math.cos(a) * paso; y += Math.sin(a) * paso; c.lineTo(x, y); if (r() < 0.12) { const xx = x, yy = y; c.moveTo(xx, yy); } } c.stroke(); };
  for (let n = 0; n < 7; n++) { const x = r() * W, y = r() * H; vuelta(c, W, H, () => grieta(x, y, Math.PI / 2 + (r() - 0.5) * 0.4, 30, 14, 1.6 + r() * 1.4)); }
  for (let n = 0; n < 9; n++) { const x = r() * W * 0.3, y = r() * H; vuelta(c, W, H, () => grieta(x, y, (r() - 0.5) * 0.6, 14, 14, 1.4)); }
  for (const lado of [0, 1]) for (let n = 0; n < 160; n++) {
    const x = lado ? W - r() * 120 : r() * 120, y = r() * H;
    vuelta(c, W, H, () => grieta(x, y, r() * 6.3, 3, 9, 1));
  }
  // la orilla comida (el borde se deshace en la tierra)
  for (const lado of [0, 1]) {
    const g = c.createLinearGradient(lado ? W : 0, 0, lado ? W - 70 : 70, 0);
    g.addColorStop(0, 'rgba(80,76,70,.85)'); g.addColorStop(1, 'rgba(80,76,70,0)');
    c.fillStyle = g; c.fillRect(lado ? W - 70 : 0, 0, 70, H);
  }
  return textura(cv);
}

// madera de cajas y pales: tablas con veta, nudos, clavos y suciedad; v a lo largo de la tabla
export function texturaMadera() {
  const N = 512, [cv, c] = lienzo(N), r = azar(31);
  for (let t = 0; t < 4; t++) {
    const y0 = t * N / 4, k = 112 + r() * 40;
    c.fillStyle = `rgb(${k},${k * 0.86},${k * 0.68})`; c.fillRect(0, y0, N, N / 4);
    for (let n = 0; n < 60; n++) { const yy = y0 + r() * N / 4; c.strokeStyle = `rgba(50,38,26,${0.1 + r() * 0.2})`; c.lineWidth = 0.6 + r(); c.beginPath(); c.moveTo(0, yy); for (let x = 0; x <= N; x += 32) c.lineTo(x, yy + Math.sin(x * 0.02 + n) * 2.5); c.stroke(); }
    for (let n = 0; n < 2; n++) { const x = r() * N, yy = y0 + 20 + r() * (N / 4 - 40); c.fillStyle = 'rgba(55,38,24,.7)'; c.beginPath(); c.ellipse(x, yy, 7 + r() * 6, 4 + r() * 3, 0, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(25,18,12,.85)'; c.fillRect(0, y0, N, 3);
    for (const x of [24, N - 24]) for (const dy of [22, N / 4 - 22]) { c.fillStyle = '#2a2520'; c.beginPath(); c.arc(x, y0 + dy, 3, 0, 7); c.fill(); mancha(c, x, y0 + dy + 10, 12, '60,40,25', 0.35); }
  }
  for (let n = 0; n < 40; n++) mancha(c, r() * N, r() * N, 20 + r() * 80, '35,30,26', 0.08 + r() * 0.15);
  return textura(cv);
}

// pictogramas de las cajas (sin palabras): flechas de este lado arriba, copa de fragil, el paraguas
export function texturaPictogramas() {
  const N = 256, [cv, c] = lienzo(N * 3, N);
  c.clearRect(0, 0, N * 3, N);
  c.fillStyle = 'rgba(28,26,24,.78)';
  for (const dx of [70, 150]) { c.fillRect(dx, 90, 18, 110); c.beginPath(); c.moveTo(dx - 26, 100); c.lineTo(dx + 9, 46); c.lineTo(dx + 44, 100); c.fill(); }
  c.fillRect(30, 212, 196, 10);
  c.beginPath(); c.moveTo(N + 70, 50); c.lineTo(N + 186, 50); c.quadraticCurveTo(N + 180, 130, N + 136, 140); c.lineTo(N + 136, 200); c.lineTo(N + 170, 214); c.lineTo(N + 86, 214); c.lineTo(N + 120, 200); c.lineTo(N + 120, 140); c.quadraticCurveTo(N + 76, 130, N + 70, 50); c.fill();
  c.fillStyle = 'rgba(160,150,135,1)'; c.beginPath(); c.moveTo(N + 112, 60); c.lineTo(N + 126, 96); c.lineTo(N + 140, 60); c.fill();
  c.fillStyle = 'rgba(28,26,24,.78)';
  c.beginPath(); c.arc(2 * N + 128, 120, 80, Math.PI, 0); c.fill(); c.fillRect(2 * N + 122, 118, 12, 80); c.lineWidth = 12; c.strokeStyle = 'rgba(28,26,24,.78)'; c.beginPath(); c.arc(2 * N + 108, 198, 20, 0, Math.PI); c.stroke();
  for (let i = 0; i < 3; i++) for (let n = 0; n < 4; n++) { c.fillStyle = 'rgba(0,0,0,.6)'; c.beginPath(); c.arc(i * N + 128 + (n - 1.5) * 26, 34 + n * 7, 2.5, 0, 7); c.fill(); }
  // desgaste: el pigmento se va en manchas
  c.globalCompositeOperation = 'destination-out';
  const r = azar(77);
  for (let n = 0; n < 900; n++) { c.fillStyle = `rgba(0,0,0,${0.2 + r() * 0.6})`; c.fillRect(r() * N * 3, r() * N, 2 + r() * 6, 1 + r() * 3); }
  c.globalCompositeOperation = 'source-over';
  return textura(cv, { rep: false });
}

// bidon de 200 l: la chapa pintada (cuatro colores apagados por fila de la textura), los aros, el oxido que la come
export function texturaBidon() {
  const W = 512, H = 512, [cv, c] = lienzo(W, H), r = azar(41);
  const colores = ['#44505a', '#535a45', '#5a3f37', '#2d2f31'];
  colores.forEach((col, i) => {
    const y0 = i * H / 4;
    c.fillStyle = col; c.fillRect(0, y0, W, H / 4);
    for (const yy of [0.33, 0.66]) { c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, y0 + yy * H / 4 - 3, W, 3); c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(0, y0 + yy * H / 4, W, 2); }
    for (let n = 0; n < 40; n++) {
      const x = r() * W, y = y0 + r() * H / 4, rr = 3 + r() * r() * 30;
      const k = 0.85 + r() * 0.3; c.fillStyle = `rgba(${80 * k | 0},${60 * k | 0},${47 * k | 0},${0.5 + r() * 0.4})`; c.beginPath(); c.ellipse(x, y, rr, rr * (0.5 + r() * 0.6), r() * 3, 0, 7); c.fill();
    }
    // chorrea el oxido de los aros hacia abajo
    for (let n = 0; n < 24; n++) { const x = r() * W, y = y0 + (r() < 0.5 ? 0.33 : 0.66) * H / 4; const g = c.createLinearGradient(0, y, 0, y + 30 + r() * 30); g.addColorStop(0, 'rgba(76,57,44,.5)'); g.addColorStop(1, 'rgba(76,57,44,0)'); c.fillStyle = g; c.fillRect(x, y, 1.5 + r() * 3, 60); }
    for (let n = 0; n < 2400; n++) { c.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.04 + r() * 0.06})`; c.fillRect(r() * W, y0 + r() * H / 4, 1 + r() * 2, 1); }
    // abolladuras: sombra y luz
    for (let n = 0; n < 3; n++) { const x = r() * W, y = y0 + 20 + r() * (H / 4 - 40); mancha(c, x, y, 20, '0,0,0', 0.25); mancha(c, x - 8, y - 8, 12, '255,255,255', 0.08); }
  });
  return textura(cv);
}

// arpillera de los sacos terreros (tejido de rafia con su trama), verde oliva y beige apagados por mitades
export function texturaSaco() {
  const N = 256, [cv, c] = lienzo(N), r = azar(53);
  c.fillStyle = '#86806c'; c.fillRect(0, 0, N, N / 2); c.fillStyle = '#6a6c55'; c.fillRect(0, N / 2, N, N / 2);
  for (let y = 0; y < N; y += 3) { c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(0, y, N, 1); }
  for (let x = 0; x < N; x += 3) { c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(x, 0, 1, N); }
  for (let n = 0; n < 50; n++) mancha(c, r() * N, r() * N, 8 + r() * 30, '40,34,26', 0.1 + r() * 0.2);
  return textura(cv);
}

// gavion (Hesco): malla de acero de 7,6 cm con el geotextil beige dentro, que se abomba entre los alambres
export function texturaGavion() {
  const N = 512, [cv, c] = lienzo(N), r = azar(61);
  c.fillStyle = '#857c69'; c.fillRect(0, 0, N, N);
  for (let n = 0; n < 70; n++) mancha(c, r() * N, r() * N, 20 + r() * 90, r() < 0.7 ? '45,40,32' : '170,160,140', 0.08 + r() * 0.14);
  const p = N / 8;
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const g = c.createRadialGradient(i * p + p / 2, j * p + p / 2, 2, i * p + p / 2, j * p + p / 2, p * 0.7); g.addColorStop(0, 'rgba(255,250,235,.10)'); g.addColorStop(1, 'rgba(0,0,0,.18)'); c.fillStyle = g; c.fillRect(i * p, j * p, p, p); }
  c.strokeStyle = '#3b3e40'; c.lineWidth = 3.5;
  for (let i = 0; i <= 8; i++) { c.beginPath(); c.moveTo(i * p, 0); c.lineTo(i * p, N); c.stroke(); c.beginPath(); c.moveTo(0, i * p); c.lineTo(N, i * p); c.stroke(); }
  c.strokeStyle = 'rgba(200,205,205,.25)'; c.lineWidth = 1;
  for (let i = 0; i <= 8; i++) { c.beginPath(); c.moveTo(i * p - 1, 0); c.lineTo(i * p - 1, N); c.stroke(); }
  // oxido en los cruces y la tierra que se sale por abajo
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) if (r() < 0.4) mancha(c, i * p, j * p, 6 + r() * 8, '82,62,48', 0.5);
  const g = c.createLinearGradient(0, N * 0.7, 0, N); g.addColorStop(0, 'rgba(60,52,40,0)'); g.addColorStop(1, 'rgba(60,52,40,.55)'); c.fillStyle = g; c.fillRect(0, N * 0.7, N, N * 0.3);
  return textura(cv);
}

// la lona azul desteñida de la chabola, con sus pliegues y el sucio
export function texturaLona() {
  const N = 512, [cv, c] = lienzo(N), r = azar(71);
  c.fillStyle = '#4c6478'; c.fillRect(0, 0, N, N);
  for (let n = 0; n < 60; n++) mancha(c, r() * N, r() * N, 30 + r() * 120, r() < 0.5 ? '230,235,236' : '20,26,32', 0.06 + r() * 0.12);
  for (let n = 0; n < 30; n++) { const x = r() * N; const g = c.createLinearGradient(x - 14, 0, x + 14, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,.18)'); g.addColorStop(1, 'rgba(255,255,255,.06)'); c.fillStyle = g; c.fillRect(x - 14, 0, 28, N); }
  for (let y = 0; y < N; y += 4) { c.fillStyle = 'rgba(0,0,0,.05)'; c.fillRect(0, y, N, 1); }
  return textura(cv);
}

// chapa grecada oxidada de la chabola
export function texturaChapa() {
  const N = 512, [cv, c] = lienzo(N), r = azar(83);
  c.fillStyle = '#6d6f70'; c.fillRect(0, 0, N, N);
  // el oxido PARDO (en el juego el naranja es solo de la Podredumbre)
  for (let n = 0; n < 120; n++) { const x = r() * N, y = r() * N, rr = 6 + r() * r() * 70; const k = 0.8 + r() * 0.3; c.fillStyle = `rgba(${84 * k | 0},${64 * k | 0},${50 * k | 0},${0.35 + r() * 0.45})`; c.beginPath(); c.ellipse(x, y, rr, rr * (0.5 + r()), r() * 3, 0, 7); c.fill(); }
  for (let n = 0; n < 50; n++) { const x = r() * N, y = r() * N; const g = c.createLinearGradient(0, y, 0, y + 120); g.addColorStop(0, 'rgba(74,56,44,.42)'); g.addColorStop(1, 'rgba(74,56,44,0)'); c.fillStyle = g; c.fillRect(x, y, 2 + r() * 5, 120); }
  return textura(cv);
}

// la chapa pintada de un coche viejo (u a lo largo, v en altura, 1,4 m por textura): pintura con su brillo gastado,
// el barro que sube desde abajo, algun punto de oxido en los bajos y rayones
export function texturaCarroceria() {
  const N = 512, [cv, c] = lienzo(N), r = azar(29);
  c.fillStyle = '#d7d9d6'; c.fillRect(0, 0, N, N);
  for (let n = 0; n < 40; n++) mancha(c, r() * N, r() * N, 30 + r() * 120, r() < 0.5 ? '90,92,94' : '255,255,255', 0.05 + r() * 0.08);
  const g = c.createLinearGradient(0, N, 0, N * 0.55); g.addColorStop(0, 'rgba(78,66,54,.75)'); g.addColorStop(1, 'rgba(78,66,54,0)');
  c.fillStyle = g; c.fillRect(0, N * 0.55, N, N * 0.45);
  for (let n = 0; n < 26; n++) { const x = r() * N, y = N * (0.7 + r() * 0.3), rr = 2 + r() * r() * 16; c.fillStyle = `rgba(80,60,47,${0.5 + r() * 0.4})`; c.beginPath(); c.ellipse(x, y, rr, rr * 0.7, r() * 3, 0, 7); c.fill(); }
  c.strokeStyle = 'rgba(250,250,248,.35)'; c.lineWidth = 0.8;
  for (let n = 0; n < 30; n++) { const x = r() * N, y = r() * N; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 20 + r() * 60, y + (r() - 0.5) * 8); c.stroke(); }
  return textura(cv);
}
// la funda de un colchon: rayas de cuti y manchas
export function texturaColchon() {
  const N = 256, [cv, c] = lienzo(N), r = azar(37);
  c.fillStyle = '#c9c4b5'; c.fillRect(0, 0, N, N);
  for (let x = 0; x < N; x += 16) { c.fillStyle = 'rgba(96,110,124,.55)'; c.fillRect(x, 0, 5, N); }
  for (let n = 0; n < 14; n++) mancha(c, r() * N, r() * N, 14 + r() * 50, '110,92,70', 0.15 + r() * 0.2);
  return textura(cv);
}

// LA TIRA DE PINTADAS: ocho casillas de 512 (fondo transparente). 0 marcas de dias, 1 flecha arriba, 2 manos, 3 firma,
// 4 circulo tachado, 5 y 6 codigos de bloque estarcidos, 7 oxido que chorrea de un agujero de izado
export function texturaPintadas() {
  const S = 512, [cv, c] = lienzo(S * 4, S * 2), r = azar(97);
  c.clearRect(0, 0, S * 4, S * 2);
  const casilla = (i, f) => { c.save(); c.translate((i % 4) * S, Math.floor(i / 4) * S); c.beginPath(); c.rect(0, 0, S, S); c.clip(); f(); c.restore(); };
  // pulverizado: trazo con el borde blando y gotas que chorrean
  function spray(pts, w, col, gotas = 0.12) {
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const [k, a] of [[2.2, 0.12], [1.4, 0.35], [1, 0.95]]) {
      c.strokeStyle = col.replace('A', a); c.lineWidth = w * k; c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
    }
    for (const [x, y] of pts) if (r() < gotas) { const h = 20 + r() * 70; const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, col.replace('A', 0.9)); g.addColorStop(1, col.replace('A', 0)); c.fillStyle = g; c.fillRect(x - w * 0.12, y, w * 0.24 + 1, h); c.beginPath(); c.arc(x, y + h * 0.9, w * 0.14, 0, 7); c.fill(); }
    for (let n = 0; n < pts.length * 30; n++) { const [x, y] = pts[Math.floor(r() * pts.length)]; c.fillStyle = col.replace('A', 0.25); c.fillRect(x + (r() - 0.5) * w * 3, y + (r() - 0.5) * w * 3, 1.2, 1.2); }
  }
  const BLANCO = 'rgba(226,228,224,A)', NEGRO = 'rgba(18,18,20,A)', OCRE = 'rgba(176,150,104,A)';
  casilla(0, () => {     // marcas de dias, a tiza, en grupos de cinco
    c.lineCap = 'round';
    let x = 40, y = 70;
    for (let g = 0; g < 9; g++) {
      for (let k = 0; k < 5; k++) {
        const pts = k < 4 ? [[x + k * 16, y], [x + k * 16 + (r() - 0.5) * 5, y + 70]] : [[x - 8, y + 58], [x + 62, y + 10]];
        c.strokeStyle = 'rgba(222,222,214,.75)'; c.lineWidth = 4 + r() * 2; c.beginPath(); c.moveTo(...pts[0]); c.lineTo(...pts[1]); c.stroke();
      }
      x += 100; if (x > S - 90) { x = 40; y += 120; }
      if (y > S - 90) break;
    }
  });
  casilla(1, () => {     // flecha arriba (por aqui se sube) con dos puntos
    spray([[256, 440], [256, 130]], 26, BLANCO, 0.3);
    spray([[170, 220], [256, 110], [342, 220]], 26, BLANCO, 0.25);
    spray([[180, 470], [182, 472]], 34, BLANCO, 0.2); spray([[332, 470], [334, 472]], 34, BLANCO, 0.2);
  });
  casilla(2, () => {     // dos manos estampadas con pintura
    const mano = (cx, cy, ang, col) => {
      c.save(); c.translate(cx, cy); c.rotate(ang); c.fillStyle = col;
      c.beginPath(); c.ellipse(0, 30, 48, 56, 0, 0, 7); c.fill();
      for (const [dx, l, a] of [[-38, 70, -0.35], [-16, 92, -0.08], [8, 98, 0.03], [30, 84, 0.16], [50, 48, 0.85]]) { c.save(); c.translate(dx, -10); c.rotate(a); c.beginPath(); c.ellipse(0, -l / 2, 11, l / 2, 0, 0, 7); c.fill(); c.restore(); }
      c.globalCompositeOperation = 'destination-out';
      for (let n = 0; n < 260; n++) { c.fillStyle = `rgba(0,0,0,${0.3 + r() * 0.7})`; c.beginPath(); c.arc((r() - 0.5) * 120, (r() - 0.6) * 200, 1 + r() * 5, 0, 7); c.fill(); }
      c.globalCompositeOperation = 'source-over';
      c.restore();
    };
    mano(170, 280, -0.25, 'rgba(206,206,198,.88)'); mano(345, 250, 0.18, 'rgba(170,148,104,.9)');
  });
  casilla(3, () => {     // una firma (garabato sin letras) con contorno
    const pts = [];
    for (let k = 0; k <= 60; k++) { const t = k / 60; pts.push([60 + t * 390, 260 + Math.sin(t * 19) * 70 * Math.sin(t * 3.1) + Math.cos(t * 7) * 30]); }
    spray(pts, 22, NEGRO, 0.06);
    spray(pts.map(([x, y]) => [x + 3, y - 3]), 9, OCRE, 0);
    spray([[90, 360], [440, 330]], 10, NEGRO, 0.1);
  });
  casilla(4, () => {     // circulo tachado (no pasar)
    const pts = []; for (let k = 0; k <= 48; k++) { const a = k / 48 * 6.3; pts.push([256 + Math.cos(a) * 170 + (r() - 0.5) * 6, 256 + Math.sin(a) * 170 + (r() - 0.5) * 6]); }
    spray(pts, 24, NEGRO, 0.15);
    spray([[150, 140], [370, 380]], 24, NEGRO, 0.2);
  });
  // los codigos de bloque, estarcidos (plantilla con sus puentes)
  const estarcido = (i, t) => casilla(i, () => {
    c.font = 'bold 150px Bahnschrift, "Arial Narrow", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = 'rgba(214,216,210,.85)'; c.fillText(t, 256, 256);
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = '#000';
    for (let x = 30; x < S; x += 52) c.fillRect(x, 0, 7, S);          // los puentes de la plantilla
    for (let n = 0; n < 1200; n++) { c.fillStyle = `rgba(0,0,0,${0.3 + r() * 0.6})`; c.fillRect(r() * S, r() * S, 1 + r() * 5, 1 + r() * 3); }
    c.globalCompositeOperation = 'source-over';
    for (let n = 0; n < 50; n++) { c.fillStyle = 'rgba(214,216,210,.3)'; c.fillRect(100 + r() * 300, 180 + r() * 150, 1.5, 1.5); }
  });
  estarcido(5, 'X3-17'); estarcido(6, 'X3-24');
  casilla(7, () => {     // oxido que chorrea del agujero (el agujero arriba en el centro)
    for (let n = 0; n < 26; n++) {
      const x = 256 + (r() - 0.5) * 90, h = 120 + r() * 340, w = 3 + r() * 14;
      const g = c.createLinearGradient(0, 40, 0, 40 + h);
      g.addColorStop(0, `rgba(88,62,46,${0.35 + r() * 0.35})`); g.addColorStop(0.6, `rgba(82,60,46,${0.15 + r() * 0.15})`); g.addColorStop(1, 'rgba(82,60,46,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(x - w / 2, 40); for (let k = 0; k <= 10; k++) c.lineTo(x - w / 2 + Math.sin(k * 0.9 + n) * 3, 40 + h * k / 10); c.lineTo(x + w / 2, 40 + h); c.lineTo(x + w / 2, 40); c.fill();
    }
    mancha(c, 256, 40, 70, '78,58,44', 0.5);
  });
  const t = textura(cv, { rep: false });
  return t;
}
