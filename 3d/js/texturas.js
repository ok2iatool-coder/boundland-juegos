// Texturas pintadas en un lienzo (sin imagenes): empedrado, suelo de bosque, corteza, sillares con musgo, helecho y
// hierba. Todo con una semilla fija: el bosque sale igual en cada carga.
import * as THREE from 'three';

export function azar(semilla = 1) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lienzo(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function textura(c, repetir = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// ruido de manchas: muchos circulos difusos de un color con poca opacidad
function manchas(g, w, h, n, colores, rmin, rmax, alfa, r) {
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, rad = rmin + r() * (rmax - rmin);
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    const col = colores[Math.floor(r() * colores.length)];
    grad.addColorStop(0, `rgba(${col},${alfa})`);
    grad.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = grad;
    for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
      g.save(); g.translate(dx, dy); g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill(); g.restore();
    }
  }
}

// EMPEDRADO: piedras redondeadas de tamanos distintos con junta oscura y musgo en las juntas (el camino del video)
export function empedrado() {
  const N = 512, r = azar(11);
  const [c, g] = lienzo(N);
  g.fillStyle = '#5e6a3a';
  g.fillRect(0, 0, N, N);
  manchas(g, N, N, 60, ['96,122,52', '78,96,44'], 8, 30, 0.5, r);
  const filas = 9;
  for (let f = 0; f < filas; f++) {
    const y0 = (f / filas) * N;
    let x = (f % 2) * 20 - 30;
    while (x < N + 30) {
      const ancho = 38 + r() * 34, alto = N / filas - 6;
      const cx = x + ancho / 2, cy = y0 + alto / 2 + 3 + (r() - 0.5) * 4;
      const v = 128 + r() * 50, tinte = r() * 10;
      for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) {
        g.save();
        g.translate(cx + dx, cy + dy);
        g.rotate((r() - 0.5) * 0.12);
        g.beginPath();
        g.ellipse(0, 0, ancho / 2 - 3, alto / 2 - 2, 0, 0, Math.PI * 2);
        const gr = g.createRadialGradient(-ancho * 0.15, -alto * 0.2, 2, 0, 0, ancho * 0.6);
        gr.addColorStop(0, `rgb(${v + 22},${v + 20 + tinte},${v + 10})`);
        gr.addColorStop(1, `rgb(${v - 30},${v - 28 + tinte},${v - 36})`);
        g.fillStyle = gr;
        g.fill();
        g.restore();
      }
      x += ancho + 2;
    }
  }
  manchas(g, N, N, 120, ['78,94,44', '96,108,52', '60,54,40'], 3, 12, 0.35, r);
  return textura(c);
}

// SUELO de bosque: tierra parda con hojarasca y hierba corta
export function suelo() {
  // 21-10 («mas bonito, nada tenebroso»): PRADERA de musgo y hierba corta con treboles, florecillas y pocas hojas
  // caidas, en vez de la hojarasca parda y oscura del video
  const N = 512, r = azar(5);
  const [c, g] = lienzo(N);
  g.fillStyle = '#5d7a30';
  g.fillRect(0, 0, N, N);
  manchas(g, N, N, 110, ['118,150,58', '84,120,44', '140,160,70', '96,110,52'], 20, 70, 0.45, r);
  // treboles: tres circulitos
  for (let i = 0; i < 260; i++) {
    const x = r() * N, y = r() * N, rad = 1.6 + r() * 1.4, v = r();
    g.fillStyle = `rgba(${70 + v * 40},${130 + v * 40},${50 + v * 20},0.85)`;
    for (let k = 0; k < 3; k++) { const a = k * 2.1 + r(); g.beginPath(); g.arc(x + Math.cos(a) * rad, y + Math.sin(a) * rad, rad, 0, Math.PI * 2); g.fill(); }
  }
  // alguna hoja caida (pocas, calidas)
  for (let i = 0; i < 90; i++) {
    const x = r() * N, y = r() * N, l = 3 + r() * 5;
    g.fillStyle = `rgba(${170 + r() * 50},${120 + r() * 40},${50},0.7)`;
    g.save(); g.translate(x, y); g.rotate(r() * Math.PI); g.beginPath(); g.ellipse(0, 0, l, l * 0.45, 0, 0, Math.PI * 2); g.fill(); g.restore();
  }
  // florecillas de pradera: puntos blancos, amarillos y lila
  for (let i = 0; i < 220; i++) {
    const x = r() * N, y = r() * N, t = r();
    g.fillStyle = t < 0.5 ? 'rgba(250,248,235,0.95)' : t < 0.8 ? 'rgba(250,214,70,0.95)' : 'rgba(200,170,240,0.9)';
    g.beginPath(); g.arc(x, y, 1.1 + r() * 0.9, 0, Math.PI * 2); g.fill();
  }
  // briznas claras
  for (let i = 0; i < 2600; i++) {
    const x = r() * N, y = r() * N;
    g.strokeStyle = `rgba(${150 + r() * 50},${180 + r() * 40},${80},0.35)`;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y - 3 - r() * 5); g.stroke();
  }
  return textura(c);
}

// CORTEZA: vetas verticales y musgo
export function corteza() {
  const W = 256, H = 512, r = azar(7);
  const [c, g] = lienzo(W, H);
  g.fillStyle = '#6a5642';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 160; i++) {
    const x = r() * W, w = 2 + r() * 7, v = 60 + r() * 60;
    g.fillStyle = `rgba(${v + 20},${v + 12},${v},0.55)`;
    g.fillRect(x, 0, w, H);
  }
  for (let i = 0; i < 260; i++) {
    const x = r() * W, y = r() * H;
    g.fillStyle = `rgba(20,16,12,${0.25 + r() * 0.3})`;
    g.fillRect(x, y, 1 + r() * 3, 8 + r() * 40);
  }
  manchas(g, W, H, 40, ['110,140,56', '92,124,48'], 10, 40, 0.5, r);
  return textura(c);
}

// SILLARES de piedra con musgo arriba (las columnas en ruina del video)
export function sillar() {
  const N = 256, r = azar(13);
  const [c, g] = lienzo(N);
  g.fillStyle = '#9a9480';
  g.fillRect(0, 0, N, N);
  manchas(g, N, N, 50, ['168,160,136', '120,114,98', '140,144,118'], 10, 50, 0.45, r);
  // grietas
  g.strokeStyle = 'rgba(30,28,24,0.6)';
  for (let i = 0; i < 18; i++) {
    let x = r() * N, y = r() * N;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 24; y += (r() - 0.5) * 24; g.lineTo(x, y); }
    g.stroke();
  }
  // musgo: denso arriba (v pequena), raleando hacia abajo
  for (let i = 0; i < 900; i++) {
    const y = Math.pow(r(), 2.2) * N, x = r() * N;
    g.fillStyle = `rgba(${96 + r() * 40},${140 + r() * 40},${46 + r() * 20},${0.6 - y / N * 0.42})`;
    g.beginPath(); g.arc(x, y, 2 + r() * 6, 0, Math.PI * 2); g.fill();
  }
  return textura(c);
}

// HELECHO: una fronda con pinnas a los lados, fondo transparente
export function helecho() {
  const N = 256, r = azar(17);
  const [c, g] = lienzo(N);
  g.clearRect(0, 0, N, N);
  for (let f = 0; f < 3; f++) {
    g.save();
    g.translate(N / 2, N);
    g.rotate((f - 1) * 0.35);
    const largo = N * (0.85 - Math.abs(f - 1) * 0.12);
    g.strokeStyle = '#3c5a22';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(10, -largo * 0.5, 0, -largo); g.stroke();
    for (let i = 0; i < 18; i++) {
      const t = 0.12 + i / 18 * 0.85, y = -largo * t, l = (1 - t) * 46 + 8;
      for (const lado of [-1, 1]) {
        const v = 60 + r() * 40, seca = r() < 0.12;
        g.fillStyle = seca ? `rgb(${v + 70},${v + 50},${v - 10})` : `rgb(${v - 5},${v + 32},${v - 30})`;
        g.save(); g.translate(0, y); g.rotate(lado * (1.1 - t * 0.3));
        g.beginPath(); g.ellipse(0, -l / 2, 4 + (1 - t) * 3, l / 2, 0, 0, Math.PI * 2); g.fill();
        g.restore();
      }
    }
    g.restore();
  }
  const t = textura(c, false);
  return t;
}

// HIERBA: mata de briznas
export function hierba() {
  const N = 128, r = azar(19);
  const [c, g] = lienzo(N);
  g.clearRect(0, 0, N, N);
  for (let i = 0; i < 40; i++) {
    const x = N / 2 + (r() - 0.5) * N * 0.7, alto = N * (0.4 + r() * 0.55), curva = (r() - 0.5) * 30;
    const v = 70 + r() * 50, seca = r() < 0.3;
    g.strokeStyle = seca ? `rgb(${v + 70},${v + 55},${v + 5})` : `rgb(${v - 5},${v + 35},${v - 35})`;
    g.lineWidth = 1.5 + r() * 2;
    g.beginPath(); g.moveTo(x, N); g.quadraticCurveTo(x + curva * 0.4, N - alto * 0.6, x + curva, N - alto); g.stroke();
  }
  return textura(c, false);
}

// HOJAS de copa: racimos de hojas con huecos (alfa)
export function hojas(fondo = null) {
  const N = 256, r = azar(23);
  const [c, g] = lienzo(N);
  g.clearRect(0, 0, N, N);
  if (fondo) { g.fillStyle = fondo; g.fillRect(0, 0, N, N); }
  for (let i = 0; i < 520; i++) {
    const x = r() * N, y = r() * N, l = 5 + r() * 9, v = 80 + r() * 80;
    g.fillStyle = `rgb(${v - 10},${v + 55},${v - 45})`;
    g.save(); g.translate(x, y); g.rotate(r() * Math.PI * 2);
    g.beginPath(); g.ellipse(0, 0, l, l * 0.5, 0, 0, Math.PI * 2); g.fill(); g.restore();
  }
  return textura(c);
}

// RAYO de sol: degradado vertical para los haces de luz entre los arboles (aditivo)
export function rayo() {
  const [c, g] = lienzo(64, 256);
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, 'rgba(255,240,200,0.0)');
  gr.addColorStop(0.25, 'rgba(255,236,190,0.55)');
  gr.addColorStop(1, 'rgba(255,230,180,0.0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 256);
  const gx = g.createLinearGradient(0, 0, 64, 0);
  gx.addColorStop(0, 'rgba(0,0,0,1)');
  gx.addColorStop(0.5, 'rgba(0,0,0,0)');
  gx.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = gx;
  g.fillRect(0, 0, 64, 256);
  return textura(c, false);
}

// ---------------- 21-10: lo nuevo del bosque bonito ----------------

// FLORES: atlas de 4 en fila (margarita, boton de oro, clavelina rosa, nomeolvides azul), cada una una mata con tallos
// y varias flores, fondo transparente; la flor k ocupa u de k/4 a (k+1)/4
export function flores() {
  const N = 128, r = azar(31);
  const [c, g] = lienzo(N * 4, N);
  g.clearRect(0, 0, N * 4, N);
  const tipos = [
    { petalos: 12, centro: '#f2c430', color: (v) => `rgb(${250 - v * 10},${250 - v * 8},${244 - v * 16})`, rad: 11, larga: 1.0 },
    { petalos: 5, centro: '#d8a018', color: (v) => `rgb(255,${214 + v * 20},${40 + v * 30})`, rad: 8, larga: 0.75 },
    { petalos: 6, centro: '#f6e0ee', color: (v) => `rgb(${238 + v * 12},${120 + v * 40},${170 + v * 30})`, rad: 9, larga: 0.8 },
    { petalos: 5, centro: '#f6e27a', color: (v) => `rgb(${110 + v * 30},${150 + v * 30},245)`, rad: 6, larga: 0.6 },
  ];
  tipos.forEach((T, k) => {
    const ox = k * N;
    const cabezas = [];
    for (let i = 0; i < 5; i++) {
      const x = ox + N / 2 + (r() - 0.5) * N * 0.6, alto = N * (0.45 + r() * 0.42);
      g.strokeStyle = `rgb(${70 + r() * 30},${130 + r() * 30},50)`;
      g.lineWidth = 2;
      const cx = Math.max(ox + 12, Math.min(ox + N - 12, x + (r() - 0.5) * 18));
      g.beginPath(); g.moveTo(ox + N / 2 + (r() - 0.5) * 10, N); g.quadraticCurveTo(x, N - alto * 0.5, cx, N - alto); g.stroke();
      g.fillStyle = 'rgb(86,150,56)';
      g.save(); g.translate(x, N - alto * 0.35); g.rotate((r() - 0.5) * 1.6); g.beginPath(); g.ellipse(0, 0, 3, 9, 0, 0, Math.PI * 2); g.fill(); g.restore();
      cabezas.push([cx, Math.max(14, N - alto)]);
    }
    for (const [x, y] of cabezas) {
      const rad = T.rad * (0.85 + r() * 0.3);
      for (let p = 0; p < T.petalos; p++) {
        const a = p / T.petalos * Math.PI * 2 + r() * 0.2;
        g.fillStyle = T.color(r());
        g.save(); g.translate(x, y); g.rotate(a);
        g.beginPath(); g.ellipse(rad * 0.55, 0, rad * 0.55, rad * 0.32 * T.larga + 1, 0, 0, Math.PI * 2); g.fill(); g.restore();
      }
      g.fillStyle = T.centro;
      g.beginPath(); g.arc(x, y, rad * 0.3, 0, Math.PI * 2); g.fill();
    }
  });
  return textura(c, false);
}

// ABEDUL: corteza blanca con rayas oscuras horizontales
export function abedul() {
  const W = 128, H = 512, r = azar(37);
  const [c, g] = lienzo(W, H);
  g.fillStyle = '#e8e4d8';
  g.fillRect(0, 0, W, H);
  manchas(g, W, H, 30, ['214,208,190', '240,238,228'], 10, 30, 0.6, r);
  for (let i = 0; i < 90; i++) {
    const x = r() * W, y = r() * H, w = 6 + r() * 26;
    g.fillStyle = `rgba(${40 + r() * 20},${36 + r() * 16},30,${0.55 + r() * 0.35})`;
    g.beginPath(); g.ellipse(x, y, w / 2, 1 + r() * 2.2, 0, 0, Math.PI * 2); g.fill();
    if (x + w / 2 > W) { g.beginPath(); g.ellipse(x - W, y, w / 2, 1.6, 0, 0, Math.PI * 2); g.fill(); }
  }
  return textura(c);
}

// SETA: el sombrero (rojo con lunares blancos, v alta = arriba de la esfera) y la parte de abajo crema
export function seta() {
  const N = 128, r = azar(41);
  const [c, g] = lienzo(N);
  const gr = g.createLinearGradient(0, 0, 0, N);
  gr.addColorStop(0, '#e0473a'); gr.addColorStop(0.5, '#c8352a'); gr.addColorStop(0.55, '#f3e6c8'); gr.addColorStop(1, '#f3e6c8');
  g.fillStyle = gr; g.fillRect(0, 0, N, N);
  g.fillStyle = 'rgba(255,250,240,0.95)';
  for (let i = 0; i < 26; i++) { g.beginPath(); g.arc(r() * N, r() * N * 0.45, 2 + r() * 4, 0, Math.PI * 2); g.fill(); }
  return textura(c);
}

// MARIPOSA: un ala (la otra es la misma en espejo), cuatro colores en fila
export function mariposa() {
  const N = 64;
  const [c, g] = lienzo(N * 4, N);
  g.clearRect(0, 0, N * 4, N);
  const colores = [['#f6c13a', '#3b2a12'], ['#f2f0ea', '#6b6a64'], ['#7ab8f0', '#1e3a66'], ['#f08a3c', '#2a1a0c']];
  colores.forEach(([base, borde], k) => {
    const ox = k * N;
    g.fillStyle = borde;
    g.beginPath(); g.ellipse(ox + 34, 22, 26, 18, -0.5, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(ox + 24, 46, 17, 13, 0.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = base;
    g.beginPath(); g.ellipse(ox + 34, 22, 22, 14, -0.5, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(ox + 24, 46, 13, 10, 0.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.beginPath(); g.arc(ox + 44, 16, 3, 0, Math.PI * 2); g.fill();
  });
  return textura(c, false);
}

// HIEDRA: tira vertical de hojas con alguna flor, para colgar de columnas y del arco (alfa; v alta = arriba)
export function hiedra() {
  const W = 64, H = 256, r = azar(43);
  const [c, g] = lienzo(W, H);
  g.clearRect(0, 0, W, H);
  g.strokeStyle = 'rgb(70,96,40)'; g.lineWidth = 2;
  for (let k = 0; k < 3; k++) {
    let x = W / 2 + (k - 1) * 12;
    g.beginPath(); g.moveTo(x, 0);
    const fin = H * (0.6 + r() * 0.4);
    for (let y = 0; y < fin; y += 8) { x += (r() - 0.5) * 6; g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 160; i++) {
    const y = Math.pow(r(), 1.4) * H, x = W / 2 + (r() - 0.5) * W * (0.9 - y / H * 0.5), l = 4 + r() * 4, v = 80 + r() * 70;
    g.fillStyle = `rgb(${v - 20},${v + 60},${v - 50})`;
    g.save(); g.translate(x, y); g.rotate(r() * Math.PI * 2);
    g.beginPath(); g.moveTo(0, -l); g.lineTo(l * 0.8, 0); g.lineTo(0, l * 0.7); g.lineTo(-l * 0.8, 0); g.closePath(); g.fill(); g.restore();
  }
  for (let i = 0; i < 14; i++) {
    const y = r() * H * 0.8, x = W / 2 + (r() - 0.5) * W * 0.7;
    g.fillStyle = r() < 0.5 ? 'rgba(250,246,236,1)' : 'rgba(236,150,190,1)';
    for (let p = 0; p < 5; p++) { const a = p * 1.256; g.beginPath(); g.arc(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 2, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#f2c430'; g.beginPath(); g.arc(x, y, 1.4, 0, Math.PI * 2); g.fill();
  }
  return textura(c, false);
}

// JUNTA del empedrado 3D (21-10): lo que asoma entre piedra y piedra, con el color MEDIDO en la foto de referencia
// (referencia/empedrado/Old_cobbles_stones.jpg: tierra pardo-oliva 0,33 0,28 0,15) con musgo, chinas blancas y briznas
export function junta() {
  const N = 256, r = azar(53);
  const [c, g] = lienzo(N);
  g.fillStyle = '#53472a';
  g.fillRect(0, 0, N, N);
  manchas(g, N, N, 80, ['92,112,46', '70,60,34', '104,128,54', '60,50,30'], 5, 22, 0.6, r);
  for (let i = 0; i < 380; i++) {
    const v = 180 + r() * 60;
    g.fillStyle = 'rgba(' + v + ',' + (v - 6) + ',' + (v - 20) + ',0.85)';
    g.beginPath(); g.arc(r() * N, r() * N, 0.8 + r() * 1.6, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 260; i++) {
    const x = r() * N, y = r() * N, a = r() * Math.PI, l = 4 + r() * 10;
    g.strokeStyle = r() < 0.5 ? 'rgba(170,150,90,0.6)' : 'rgba(110,150,60,0.6)';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  return textura(c);
}
