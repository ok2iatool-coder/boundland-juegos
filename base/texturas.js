// Texturas pintadas en lienzo (nada de imagenes): hormigon agrietado, letras de chapa, lona de tienda,
// tierra, asfalto y las siluetas de los refugiados. Paleta del GDD para la ciudad: gris ceniza, ocre
// oxidado (PARDO: el naranja es solo de la Podredumbre), cielo blanquecino; una sola tinta.
import * as THREE from 'three';

export const TINTA = '#0b0a0c';

// azar con semilla: cada textura sale igual en cada carga
export function azar(semilla) {
  let s = semilla >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

export function lienzo(w, h, pinta, repetir) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  pinta(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repetir) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repetir[0], repetir[1]); }
  return t;
}

function grano(g, w, h, r, n, claro, oscuro, tam = 3) {
  for (let k = 0; k < n; k++) {
    g.fillStyle = r() < 0.5 ? claro : oscuro;
    g.globalAlpha = 0.04 + r() * 0.08;
    const s = 1 + r() * tam;
    g.fillRect(r() * w, r() * h, s, s);
  }
  g.globalAlpha = 1;
}

// grieta que baja quebrada y se ramifica, con un borde claro al lado (el canto roto)
function grieta(g, x, y, largo, r, rama, ancho) {
  const pasos = Math.max(4, Math.round(largo / 10)), ramas = [];
  const pts = [[x, y]];
  let px = x, py = y, dir = (r() - 0.5) * 0.8;
  for (let i = 0; i < pasos; i++) {
    dir += (r() - 0.5) * 0.7;
    px += Math.sin(dir) * 9; py += largo / pasos;
    pts.push([px, py]);
    if (rama > 0 && r() < 0.07) ramas.push([px, py]);
  }
  for (const [col, dx, an] of [['rgba(230,226,216,.35)', 2, ancho * 0.6], [TINTA, 0, ancho]]) {
    g.strokeStyle = col; g.lineWidth = an; g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(a + dx, b) : g.moveTo(a + dx, b))); g.stroke();
  }
  for (const [bx, by] of ramas) grieta(g, bx, by, largo * 0.35, r, rama - 1, ancho * 0.6);
}

// Un panel del muro (3 m de ancho por 12 de alto en 256 x 1024): hormigon con juntas de vertido,
// chorretones de oxido, humedad y musgo al pie, grietas, desconchones con la ferralla al aire, marcas
// de recuento y manos pintadas a la altura de la gente
export function hormigon(semilla, opciones = {}) {
  return lienzo(256, 1024, (g, w, h) => {
    const r = azar(semilla);
    const base = ['#8e8a83', '#87847e', '#928d85', '#8a8781'][semilla % 4];
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    grano(g, w, h, r, 9000, '#b4afa6', '#4c4842', 3);
    // tongadas de vertido
    for (let y = 60 + r() * 30; y < h; y += 110 + r() * 40) {
      g.fillStyle = 'rgba(40,36,32,.18)'; g.fillRect(0, y, w, 2);
      g.fillStyle = 'rgba(220,214,204,.12)'; g.fillRect(0, y + 2, w, 2);
    }
    // chorretones de oxido (pardo) y de agua sucia desde arriba
    for (let k = 0; k < 9; k++) {
      const x = r() * w, ancho = 4 + r() * 16, y0 = r() * h * 0.5, largo = 120 + r() * 520;
      const gr = g.createLinearGradient(0, y0, 0, y0 + largo);
      const col = r() < 0.55 ? '96,70,48' : '52,48,44';
      gr.addColorStop(0, `rgba(${col},.42)`); gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr; g.fillRect(x, y0, ancho, largo);
    }
    // humedad que sube del suelo y musgo
    const hu = g.createLinearGradient(0, h, 0, h - 230);
    hu.addColorStop(0, 'rgba(36,40,34,.75)'); hu.addColorStop(1, 'rgba(36,40,34,0)');
    g.fillStyle = hu; g.fillRect(0, h - 230, w, 230);
    for (let k = 0; k < 40; k++) {
      g.fillStyle = `rgba(${70 + r() * 20},${84 + r() * 20},${60 + r() * 14},${0.3 + r() * 0.4})`;
      g.beginPath(); g.arc(r() * w, h - r() * 90, 4 + r() * 16, 0, 7); g.fill();
    }
    // desconchones con ferralla
    const nd = opciones.roto ? 3 : 1 + Math.floor(r() * 2);
    for (let k = 0; k < nd; k++) {
      const x = 20 + r() * (w - 90), y = 80 + r() * (h - 400), pw = 50 + r() * 60, ph = 40 + r() * 70;
      g.save(); g.beginPath();
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, f = 0.65 + r() * 0.45; g.lineTo(x + pw / 2 + Math.cos(a) * pw / 2 * f, y + ph / 2 + Math.sin(a) * ph / 2 * f); }
      g.closePath(); g.fillStyle = '#4a4640'; g.fill(); g.clip();
      grano(g, w, h, r, 600, '#6d675f', '#2a2723', 4);
      g.strokeStyle = '#3e2f22'; g.lineWidth = 4;
      for (let xx = x + 8; xx < x + pw; xx += 18) { g.beginPath(); g.moveTo(xx, y - 4); g.lineTo(xx + (r() - 0.5) * 6, y + ph + 4); g.stroke(); }
      for (let yy = y + 10; yy < y + ph; yy += 18) { g.beginPath(); g.moveTo(x - 4, yy); g.lineTo(x + pw + 4, yy + (r() - 0.5) * 6); g.stroke(); }
      g.restore();
      g.strokeStyle = TINTA; g.lineWidth = 3; g.stroke();
    }
    // grietas
    const ng = opciones.roto ? 2 : r() < 0.6 ? 1 : 0;
    for (let k = 0; k < ng; k++) grieta(g, 30 + r() * (w - 60), r() * h * 0.5, 160 + r() * 320, r, 1, 2 + r() * 1.2);
    // juntas del panel
    g.fillStyle = 'rgba(20,18,16,.55)'; g.fillRect(0, 0, 5, h); g.fillRect(w - 5, 0, 5, h);
    g.fillStyle = 'rgba(230,224,214,.15)'; g.fillRect(5, 0, 3, h);
    // a la altura de la gente: recuentos y manos
    if (opciones.marcas) {
      g.strokeStyle = 'rgba(232,228,218,.7)'; g.lineWidth = 3;
      const y0 = h - 330 + r() * 40, x0 = 30 + r() * 60;
      for (let grupo = 0; grupo < 4; grupo++) {
        for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(x0 + grupo * 46 + i * 8, y0 + (grupo % 2) * 50); g.lineTo(x0 + grupo * 46 + i * 8 + 2, y0 + 30 + (grupo % 2) * 50); g.stroke(); }
        g.beginPath(); g.moveTo(x0 + grupo * 46 - 4, y0 + 24 + (grupo % 2) * 50); g.lineTo(x0 + grupo * 46 + 32, y0 + 6 + (grupo % 2) * 50); g.stroke();
      }
      for (let k = 0; k < 5; k++) mano(g, 40 + r() * (w - 80), h - 250 + r() * 120, 0.8 + r() * 0.4, r() < 0.5 ? 'rgba(232,228,218,.5)' : 'rgba(30,28,26,.55)');
    }
  });
}

function mano(g, x, y, k, col) {
  g.save(); g.translate(x, y); g.scale(k, k); g.fillStyle = col;
  g.beginPath(); g.ellipse(0, 10, 11, 13, 0, 0, 7); g.fill();
  for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(-9 + i * 6, -8 - (i === 1 || i === 2 ? 4 : 0), 2.6, 9, 0, 0, 7); g.fill(); }
  g.beginPath(); g.ellipse(13, 6, 3, 8, -0.7, 0, 7); g.fill();
  g.restore();
}

// letra de chapa cortada, atornillada, con su oxido; transparente alrededor
export function letra(ch, semilla) {
  return lienzo(256, 256, (g, w, h) => {
    const r = azar(semilla);
    g.font = '900 230px "Arial Black", Impact, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 14; g.strokeStyle = TINTA; g.strokeText(ch, w / 2, h / 2 + 10);
    const gr = g.createLinearGradient(0, 20, 0, 236);
    gr.addColorStop(0, '#7d766b'); gr.addColorStop(0.55, '#6a6359'); gr.addColorStop(1, '#5a4636');
    g.fillStyle = gr; g.fillText(ch, w / 2, h / 2 + 10);
    // oxido a manchas y pintura que se cae, solo dentro de la letra
    g.globalCompositeOperation = 'source-atop';
    for (let k = 0; k < 30; k++) { g.fillStyle = `rgba(${90 + r() * 20},${62 + r() * 12},${40 + r() * 10},${0.25 + r() * 0.4})`; g.beginPath(); g.arc(r() * w, r() * h, 6 + r() * 22, 0, 7); g.fill(); }
    grano(g, w, h, r, 1800, '#a69f92', '#2f2a24', 3);
    for (let k = 0; k < 3; k++) { g.fillStyle = 'rgba(200,196,186,.5)'; g.fillRect(r() * w, r() * h, 20 + r() * 30, 3); }
    g.globalCompositeOperation = 'source-over';
    // tornillos
    for (let k = 0; k < 3; k++) {
      const x = w / 2 + (r() - 0.5) * 80, y = 60 + k * 70;
      g.fillStyle = '#3a342e'; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill();
      g.fillStyle = '#a49c90'; g.beginPath(); g.arc(x - 1.5, y - 1.5, 2.4, 0, 7); g.fill();
    }
  });
}

// chorreton de oxido que la letra ha dejado en el muro (decal)
export function chorreton(semilla) {
  return lienzo(64, 256, (g, w, h) => {
    const r = azar(semilla);
    for (let k = 0; k < 4; k++) {
      const x = 10 + r() * 40, gr = g.createLinearGradient(0, 0, 0, h * (0.5 + r() * 0.5));
      gr.addColorStop(0, 'rgba(96,68,44,.55)'); gr.addColorStop(1, 'rgba(96,68,44,0)');
      g.fillStyle = gr; g.fillRect(x, 0, 3 + r() * 8, h);
    }
  });
}

// lona de tienda: remiendos, costuras y suciedad abajo
export function lona(semilla) {
  const cols = ['#7d7f6b', '#8f8670', '#6f7579', '#867a68', '#7a6f62'];
  return lienzo(256, 256, (g, w, h) => {
    const r = azar(semilla);
    g.fillStyle = cols[semilla % cols.length]; g.fillRect(0, 0, w, h);
    grano(g, w, h, r, 4000, '#b6ad9a', '#3c382f', 2);
    for (let k = 0; k < 3; k++) {
      const x = r() * w * 0.7, y = r() * h * 0.6, pw = 40 + r() * 60, ph = 30 + r() * 50;
      g.fillStyle = cols[(semilla + k + 2) % cols.length]; g.fillRect(x, y, pw, ph);
      g.strokeStyle = 'rgba(20,18,16,.7)'; g.setLineDash([5, 4]); g.lineWidth = 2; g.strokeRect(x + 3, y + 3, pw - 6, ph - 6); g.setLineDash([]);
    }
    const gr = g.createLinearGradient(0, h, 0, h * 0.6);
    gr.addColorStop(0, 'rgba(50,44,36,.6)'); gr.addColorStop(1, 'rgba(50,44,36,0)');
    g.fillStyle = gr; g.fillRect(0, h * 0.6, w, h * 0.4);
  });
}

export function tierra(semilla, asfalto = false) {
  return lienzo(512, 512, (g, w, h) => {
    const r = azar(semilla);
    g.fillStyle = asfalto ? '#5b5955' : '#6e665a'; g.fillRect(0, 0, w, h);
    grano(g, w, h, r, 20000, asfalto ? '#85827b' : '#968b78', asfalto ? '#2e2c29' : '#3d372f', 3);
    // manchas irregulares y suaves (pisadas, barro), no formas reconocibles
    for (let k = 0; k < 10; k++) {
      const x = r() * w, y = r() * h, rr = 40 + r() * 90;
      const gr = g.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, asfalto ? 'rgba(30,29,27,.12)' : 'rgba(58,50,40,.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    if (asfalto) for (let k = 0; k < 6; k++) { g.strokeStyle = 'rgba(15,14,13,.6)'; g.lineWidth = 2; g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y); for (let i = 0; i < 8; i++) { x += (r() - 0.5) * 50; y += (r() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); }
  }, [1, 1]);
}

// Los refugiados: figuras con capucha y capa, en el mismo trazo de tinta que el resto (vistas de lado)
export function refugiado(tipo, semilla) {
  const ropa = ['#6f6a5f', '#5f6668', '#7a6c5a', '#646458', '#76675e'];
  return lienzo(256, 384, (g, w, h) => {
    const r = azar(semilla);
    const c = ropa[semilla % ropa.length], piel = '#d9cbb4';
    const sentado = tipo === 'sentado', nino = tipo === 'nino';
    const k = nino ? 0.72 : 1;
    g.translate(w / 2, h - 8); g.scale(k, k);
    g.lineJoin = 'round'; g.lineWidth = 7; g.strokeStyle = TINTA;
    const alto = sentado ? 190 : 300;
    // capa
    g.beginPath();
    g.moveTo(-34, -alto + 92); g.quadraticCurveTo(-66, -alto * 0.45, -56 - r() * 10, 0);
    for (let x = -56; x < 50; x += 14) g.lineTo(x + 7, -6 - r() * 16);
    g.lineTo(54, 0); g.quadraticCurveTo(58, -alto * 0.5, 30, -alto + 96); g.closePath();
    g.fillStyle = c; g.fill(); g.stroke();
    // piernas si esta de pie
    if (!sentado) { g.fillStyle = '#2e2a26'; g.fillRect(-20, -14, 14, 14); g.fillRect(8, -14, 14, 14); }
    // capucha
    g.beginPath();
    g.moveTo(-40, -alto + 100); g.quadraticCurveTo(-48, -alto + 20, -6, -alto); g.quadraticCurveTo(42, -alto + 18, 44, -alto + 100);
    g.closePath(); g.fillStyle = c; g.fill(); g.stroke();
    // cara en sombra
    g.beginPath(); g.ellipse(10, -alto + 62, 20, 25, 0, 0, 7); g.fillStyle = '#1d1b19'; g.fill();
    g.beginPath(); g.ellipse(16, -alto + 66, 9, 13, 0, 0, 7); g.fillStyle = piel; g.globalAlpha = 0.55; g.fill(); g.globalAlpha = 1;
    // hatillo a la espalda o manta
    if (tipo === 'hatillo') { g.beginPath(); g.ellipse(-50, -alto + 140, 30, 36, 0.3, 0, 7); g.fillStyle = '#8b7d63'; g.fill(); g.stroke(); }
    // remiendos y sombreado de la capa
    g.globalCompositeOperation = 'source-atop';
    grano(g, 256, 384, r, 600, '#a9a090', '#26231f', 3);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(-80, -alto * 0.3, 160, alto);
    g.globalCompositeOperation = 'source-over';
  });
}

// tablon de avisos con papeles clavados (lo que se lee al acercarse)
export function tablon() {
  return lienzo(512, 320, (g, w, h) => {
    const r = azar(91);
    g.fillStyle = '#5d4c3b'; g.fillRect(0, 0, w, h);
    grano(g, w, h, r, 3000, '#8a7560', '#2c231b', 3);
    for (let y = 0; y < h; y += 64) { g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, y, w, 3); }
    const titulos = ['LLEGADAS', 'RACIONES', 'BUSCO A', 'NORMAS', 'TURNO DE AGUA', 'DESAPARECIDOS'];
    for (let k = 0; k < 9; k++) {
      const x = 14 + (k % 5) * 98 + r() * 10, y = 16 + Math.floor(k / 5) * 150 + r() * 14;
      g.save(); g.translate(x + 40, y + 55); g.rotate((r() - 0.5) * 0.18);
      g.fillStyle = r() < 0.5 ? '#e6dcc6' : '#d8ceb8'; g.fillRect(-40, -55, 80, 110);
      g.fillStyle = '#2a2622'; g.font = 'bold 11px Georgia'; g.textAlign = 'center';
      g.fillText(titulos[k % titulos.length], 0, -38);
      g.fillStyle = 'rgba(40,36,32,.6)';
      for (let l = 0; l < 7; l++) g.fillRect(-30, -26 + l * 10, 40 + r() * 20, 2);
      g.fillStyle = '#7a1f1f'; g.beginPath(); g.arc(0, -50, 3, 0, 7); g.fill();
      g.restore();
    }
    g.strokeStyle = TINTA; g.lineWidth = 10; g.strokeRect(0, 0, w, h);
  });
}

// cielo blanquecino con la ciudad muerta a lo lejos (siluetas)
export function ciudadLejana() {
  return lienzo(2048, 512, (g, w, h) => {
    const r = azar(5);
    for (const [cap, col, alto] of [[0, '#b5b7b3', 0.7], [1, '#9c9d99', 0.5]]) {
      g.fillStyle = col;
      let x = 0;
      while (x < w) {
        const bw = 30 + r() * 90, bh = h * (0.15 + r() * alto * (cap ? 0.6 : 1));
        g.fillRect(x, h - bh, bw, bh);
        if (r() < 0.4) { g.fillRect(x + bw * 0.3, h - bh - 30, 4, 30); }
        if (r() < 0.3) { g.beginPath(); g.moveTo(x, h - bh); g.lineTo(x + bw * 0.5, h - bh - bw * 0.4); g.lineTo(x + bw, h - bh); g.fill(); }
        x += bw * (0.8 + r() * 0.5);
      }
    }
  });
}

// el corte del terreno visto de frente (la vista 2D): tierra en capas, piedras, raices y un tubo roto,
// con el borde de arriba entintado como el terreno del juego
export function corteTierra() {
  return lienzo(1024, 256, (g, w, h) => {
    const r = azar(404);
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#4c463e'); gr.addColorStop(0.3, '#3b3631'); gr.addColorStop(1, '#1d1b19');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    grano(g, w, h, r, 9000, '#6d655a', '#141210', 3);
    for (let y = 40; y < h; y += 34 + r() * 20) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, y, w, 2 + r() * 3); }
    for (let k = 0; k < 70; k++) {
      const x = r() * w, y = 20 + r() * (h - 20), rr = 4 + r() * 14;
      g.fillStyle = r() < 0.5 ? '#5d564d' : '#4a443d'; g.beginPath(); g.ellipse(x, y, rr, rr * 0.7, r() * 3, 0, 7); g.fill();
      g.strokeStyle = TINTA; g.lineWidth = 2; g.stroke();
    }
    g.strokeStyle = 'rgba(30,26,22,.9)'; g.lineWidth = 2;
    for (let k = 0; k < 10; k++) { let x = r() * w, y = 6; g.beginPath(); g.moveTo(x, y); for (let i = 0; i < 8; i++) { x += (r() - 0.5) * 22; y += 6 + r() * 10; g.lineTo(x, y); } g.stroke(); }
    g.fillStyle = TINTA; g.fillRect(0, 0, w, 6);
    g.fillStyle = 'rgba(200,192,178,.35)'; g.fillRect(0, 6, w, 2);
  }, [8, 1]);
}
