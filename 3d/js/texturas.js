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
  g.fillStyle = '#3d3a2e';
  g.fillRect(0, 0, N, N);
  manchas(g, N, N, 60, ['70,82,48', '52,60,38'], 8, 30, 0.5, r);
  const filas = 9;
  for (let f = 0; f < filas; f++) {
    const y0 = (f / filas) * N;
    let x = (f % 2) * 20 - 30;
    while (x < N + 30) {
      const ancho = 38 + r() * 34, alto = N / filas - 6;
      const cx = x + ancho / 2, cy = y0 + alto / 2 + 3 + (r() - 0.5) * 4;
      const v = 88 + r() * 46, tinte = r() * 10;
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
  const N = 512, r = azar(5);
  const [c, g] = lienzo(N);
  g.fillStyle = '#3f4a2a';
  g.fillRect(0, 0, N, N);
  manchas(g, N, N, 90, ['86,92,46', '58,70,34', '96,76,48', '70,58,40'], 20, 70, 0.45, r);
  // hojas caidas
  for (let i = 0; i < 700; i++) {
    const x = r() * N, y = r() * N, l = 3 + r() * 6;
    const t = r();
    g.fillStyle = t < 0.5 ? `rgba(${120 + r() * 60},${78 + r() * 30},${36},0.8)` : `rgba(${70 + r() * 30},${92 + r() * 30},${40},0.7)`;
    g.save(); g.translate(x, y); g.rotate(r() * Math.PI); g.beginPath(); g.ellipse(0, 0, l, l * 0.45, 0, 0, Math.PI * 2); g.fill(); g.restore();
  }
  // briznas
  g.strokeStyle = 'rgba(120,140,60,0.35)';
  for (let i = 0; i < 1600; i++) {
    const x = r() * N, y = r() * N;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y - 3 - r() * 5); g.stroke();
  }
  return textura(c);
}

// CORTEZA: vetas verticales y musgo
export function corteza() {
  const W = 256, H = 512, r = azar(7);
  const [c, g] = lienzo(W, H);
  g.fillStyle = '#4a3f33';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 160; i++) {
    const x = r() * W, w = 2 + r() * 7, v = 40 + r() * 50;
    g.fillStyle = `rgba(${v + 20},${v + 12},${v},0.55)`;
    g.fillRect(x, 0, w, H);
  }
  for (let i = 0; i < 260; i++) {
    const x = r() * W, y = r() * H;
    g.fillStyle = `rgba(20,16,12,${0.25 + r() * 0.3})`;
    g.fillRect(x, y, 1 + r() * 3, 8 + r() * 40);
  }
  manchas(g, W, H, 40, ['86,104,46', '70,88,40'], 10, 40, 0.5, r);
  return textura(c);
}

// SILLARES de piedra con musgo arriba (las columnas en ruina del video)
export function sillar() {
  const N = 256, r = azar(13);
  const [c, g] = lienzo(N);
  g.fillStyle = '#6d6a5c';
  g.fillRect(0, 0, N, N);
  manchas(g, N, N, 50, ['120,116,98', '84,80,68', '96,100,80'], 10, 50, 0.45, r);
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
    g.fillStyle = `rgba(${74 + r() * 30},${100 + r() * 36},${40 + r() * 16},${0.55 - y / N * 0.4})`;
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
        const v = 70 + r() * 40;
        g.fillStyle = `rgb(${v - 20},${v + 50},${v - 40})`;
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
    const v = 70 + r() * 50;
    g.strokeStyle = `rgb(${v - 10},${v + 40},${v - 40})`;
    g.lineWidth = 1.5 + r() * 2;
    g.beginPath(); g.moveTo(x, N); g.quadraticCurveTo(x + curva * 0.4, N - alto * 0.6, x + curva, N - alto); g.stroke();
  }
  return textura(c, false);
}

// HOJAS de copa: racimos de hojas con huecos (alfa)
export function hojas() {
  const N = 256, r = azar(23);
  const [c, g] = lienzo(N);
  g.clearRect(0, 0, N, N);
  for (let i = 0; i < 520; i++) {
    const x = r() * N, y = r() * N, l = 5 + r() * 9, v = 50 + r() * 60;
    g.fillStyle = `rgb(${v - 10},${v + 40},${v - 30})`;
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
