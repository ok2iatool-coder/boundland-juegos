// Todo lo que no es el 18 se dibuja aqui por codigo, una vez, en lienzos con su escala en px/m.
// Cada pieza es un PLANO paralelo a la pantalla (x0, y0 abajo a la izquierda, ancho y alto en metros) que
// main.js coloca a su profundidad z: asi un plano solo se escala y se desplaza, y la perspectiva es exacta.
// Junto a cada lienzo va su silueta en el color de la niebla, para mezclar la niebla por profundidad.

export const NIEBLA = '#56616b';
export const TINTA = '#0b0a0c';

export function azar(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function lienzo(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

// silueta del lienzo en el color de la niebla (misma alfa)
export function silueta(img, color = NIEBLA) {
  const s = lienzo(img.width, img.height);
  const c = s.getContext('2d');
  c.drawImage(img, 0, 0);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = color;
  c.fillRect(0, 0, s.width, s.height);
  return s;
}

function pieza(img, x0, y0, P, extra = {}) {
  return { img, fog: silueta(img), x0, y0, w: img.width / P, h: img.height / P, ...extra };
}

// grano por pixel y manchas grandes encima de lo que ya hay
function grano(c, w, h, fuerza, r) {
  const d = c.getImageData(0, 0, w, h);
  const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3] === 0) continue;
    const n = (r() - 0.5) * fuerza;
    p[i] += n; p[i + 1] += n; p[i + 2] += n;
  }
  c.putImageData(d, 0, 0);
}

function manchas(c, w, h, celda, fuerza, r, op = 'overlay') {
  const m = lienzo(w / celda, h / celda);
  const mc = m.getContext('2d');
  const d = mc.createImageData(m.width, m.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = 128 + (r() - 0.5) * 255 * fuerza;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 255;
  }
  mc.putImageData(d, 0, 0);
  const t = lienzo(w, h);
  const tc = t.getContext('2d');
  tc.imageSmoothingEnabled = true;
  tc.imageSmoothingQuality = 'high';
  tc.drawImage(m, 0, 0, w, h);
  // solo donde ya hay algo: overlay sobre lo transparente pintaria el gris
  tc.globalCompositeOperation = 'destination-in';
  tc.drawImage(c.canvas, 0, 0);
  c.save();
  c.globalCompositeOperation = op;
  c.drawImage(t, 0, 0);
  c.restore();
}

// trazo a tinta con temblor
function trazo(c, pts, ancho, color = TINTA, alfa = 1) {
  if (pts.length < 2) return;
  c.save();
  c.strokeStyle = color;
  c.globalAlpha = alfa;
  c.lineWidth = ancho;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.stroke();
  c.restore();
}

function temblar(pts, a, r) {
  return pts.map(([x, y]) => [x + (r() - 0.5) * a, y + (r() - 0.5) * a]);
}

function linea(x0, y0, x1, y1, n) {
  const o = [];
  for (let i = 0; i <= n; i++) o.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
  return o;
}

// grieta que serpentea y se ramifica; devuelve los trazos para poder dibujar el labio claro debajo
function grieta(c, x, y, ang, largo, ancho, r, P, prof = 0) {
  const pts = [[x, y]];
  let a = ang;
  const paso = 0.35 * P;
  const n = Math.floor(largo / 0.35);
  for (let i = 0; i < n; i++) {
    a += (r() - 0.5) * 0.9;
    a = a * 0.85 + ang * 0.15;
    x += Math.cos(a) * paso;
    y += Math.sin(a) * paso;
    pts.push([x, y]);
    if (prof < 2 && r() < 0.07) grieta(c, x, y, a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.7), largo * (0.25 + r() * 0.3), ancho * 0.6, r, P, prof + 1);
  }
  // labio claro abajo (la luz viene de arriba) y la grieta oscura encima, adelgazando
  for (let i = 1; i < pts.length; i++) {
    const k = 1 - i / pts.length;
    const w = Math.max(0.8, ancho * (0.35 + 0.65 * k));
    trazo(c, [[pts[i - 1][0], pts[i - 1][1] + w * 0.8], [pts[i][0], pts[i][1] + w * 0.8]], w * 0.7, '#9aa19c', 0.35);
    trazo(c, [pts[i - 1], pts[i]], w, '#151617', 0.95);
  }
}

// ------------------------------------------------------------------ el muro
export const MURO = { X0: -70, X1: 150, ALTO: 34, Z: 30, P: 24, TECHO: 46, PUERTA: [33, 47, 16] };

export function hacerMuro(lang) {
  const { X0, X1, ALTO, P, TECHO } = MURO;
  const W = (X1 - X0) * P, H = TECHO * P;
  const X = (x) => (x - X0) * P, Y = (y) => (TECHO - y) * P;
  const cv = lienzo(W, H);
  const c = cv.getContext('2d');
  const r = azar(1871);

  // hormigon prefabricado en paneles de 6 m
  c.fillStyle = '#4d5350';
  c.fillRect(0, Y(ALTO), W, ALTO * P);
  for (let x = X0; x < X1; x += 6) {
    const t = (r() - 0.5) * 22;
    c.fillStyle = `rgba(${t > 0 ? 255 : 0},${t > 0 ? 255 : 0},${t > 0 ? 250 : 0},${Math.abs(t) / 255})`;
    c.fillRect(X(x), Y(ALTO), 6 * P, ALTO * P);
  }
  manchas(c, W, H, 110, 0.32, r);
  manchas(c, W, H, 26, 0.14, r);
  // cada panel un poco abombado: luz por la izquierda, sombra a la derecha
  for (let x = X0; x < X1; x += 6) {
    const g = c.createLinearGradient(X(x), 0, X(x + 6), 0);
    g.addColorStop(0, 'rgba(210,218,220,.06)');
    g.addColorStop(0.5, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.12)');
    c.fillStyle = g;
    c.fillRect(X(x), Y(ALTO), 6 * P, ALTO * P);
  }
  // la luna da arriba; abajo, penumbra
  const gl = c.createLinearGradient(0, Y(ALTO), 0, Y(0));
  gl.addColorStop(0, 'rgba(196,206,212,.14)');
  gl.addColorStop(0.45, 'rgba(0,0,0,0)');
  gl.addColorStop(1, 'rgba(0,0,0,.3)');
  c.fillStyle = gl;
  c.fillRect(0, Y(ALTO), W, ALTO * P);
  // juntas de hormigonado cada 2,5 m
  for (let y = 2.5; y < ALTO; y += 2.5) {
    c.fillStyle = 'rgba(20,22,22,.22)';
    c.fillRect(0, Y(y), W, 2);
    c.fillStyle = 'rgba(200,205,200,.07)';
    c.fillRect(0, Y(y) + 2, W, 1);
  }
  // juntas verticales de los paneles
  for (let x = X0 + 6; x < X1; x += 6) {
    trazo(c, temblar(linea(X(x), Y(ALTO), X(x), Y(0), 30), 1.2, r), 3, '#1d1f1f', 0.8);
    trazo(c, linea(X(x) + 3, Y(ALTO), X(x) + 3, Y(0), 1), 1, '#8d938f', 0.25);
  }
  // escorrentias desde la albardilla: churretes oscuros
  for (let i = 0; i < 260; i++) {
    const x = X(X0 + r() * (X1 - X0));
    const l = (2 + r() * r() * 22) * P;
    const w = (0.1 + r() * 0.9) * P;
    const g = c.createLinearGradient(0, Y(ALTO), 0, Y(ALTO) + l);
    const a = 0.08 + r() * 0.22;
    g.addColorStop(0, `rgba(18,20,19,${a})`);
    g.addColorStop(1, 'rgba(18,20,19,0)');
    c.fillStyle = g;
    for (let k = 0; k < 4; k++) c.fillRect(x + (r() - 0.5) * w, Y(ALTO), w * (0.2 + r() * 0.4), l * (0.6 + r() * 0.4));
  }
  // mugre de abajo y salpicones
  const gb = c.createLinearGradient(0, Y(3.5), 0, Y(0));
  gb.addColorStop(0, 'rgba(16,17,15,0)');
  gb.addColorStop(1, 'rgba(16,17,15,.55)');
  c.fillStyle = gb;
  c.fillRect(0, Y(3.5), W, 3.5 * P);
  for (let i = 0; i < 2600; i++) {
    c.fillStyle = `rgba(14,15,13,${0.1 + r() * 0.25})`;
    const y = Y(r() * r() * 2.2);
    c.fillRect(r() * W, y, 1 + r() * 3, 1 + r() * 3);
  }

  // impactos con armadura a la vista y oxido que chorrea (pardo: el naranja es solo la Podredumbre)
  const impactos = [];
  for (let i = 0; i < 22; i++) {
    const x = X0 + 4 + r() * (X1 - X0 - 8);
    if (x > 31 && x < 49 && r() < 0.7) continue;
    impactos.push([x, 2 + r() * 28, 0.6 + r() * 1.9]);
  }
  impactos.push([44.5, 25.5, 2.6], [36, 27, 1.4], [58, 9, 2.2], [21, 14, 1.8]);
  for (const [ix, iy, ir] of impactos) {
    const cx = X(ix), cy = Y(iy), R = ir * P;
    const n = 14;
    const pol = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const rr = R * (0.6 + r() * 0.55);
      pol.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.85]);
    }
    // halo de desconchado
    c.fillStyle = 'rgba(120,126,121,.18)';
    c.beginPath();
    pol.forEach(([x, y], k) => (k ? c.lineTo((x - cx) * 1.35 + cx, (y - cy) * 1.35 + cy) : c.moveTo((x - cx) * 1.35 + cx, (y - cy) * 1.35 + cy)));
    c.fill();
    // hueco
    const g = c.createRadialGradient(cx, cy - R * 0.2, R * 0.1, cx, cy, R);
    g.addColorStop(0, '#1a1b1a');
    g.addColorStop(1, '#3a3e3b');
    c.fillStyle = g;
    c.beginPath();
    pol.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.fill();
    // borde de arriba en sombra, el de abajo con luz
    c.save();
    c.clip();
    c.fillStyle = 'rgba(0,0,0,.35)';
    c.fillRect(cx - R * 2, cy - R * 2, R * 4, R * 1.4);
    c.restore();
    trazo(c, [...pol, pol[0]], 2.2, TINTA, 0.9);
    // armadura: barras en reticula, alguna doblada
    if (ir > 1) {
      for (let k = -1; k <= 1; k++) {
        const yy = cy + k * R * 0.45;
        trazo(c, temblar(linea(cx - R * 0.9, yy, cx + R * 0.9, yy + (r() - 0.5) * R * 0.3, 6), 2, r), 2.6, '#4b3423', 0.95);
        const xx = cx + k * R * 0.45;
        trazo(c, temblar(linea(xx, cy - R * 0.8, xx + (r() - 0.5) * R * 0.5, cy + R * 0.85, 6), 2, r), 2.6, '#4b3423', 0.95);
      }
      // chorreon de oxido
      const gr = c.createLinearGradient(0, cy + R * 0.6, 0, cy + R * 0.6 + (2 + r() * 6) * P);
      gr.addColorStop(0, 'rgba(92,58,36,.5)');
      gr.addColorStop(1, 'rgba(92,58,36,0)');
      c.fillStyle = gr;
      for (let k = 0; k < 3; k++) c.fillRect(cx - R * 0.5 + r() * R, cy + R * 0.6, 2 + r() * 4, (2 + r() * 6) * P);
    }
  }
  // grietas grandes
  const grietas = [[38, 33.8, 1.75, 30], [52, 33.6, 1.9, 22], [8, 33.5, 1.4, 18], [-30, 12, -0.4, 16], [72, 33, 2.0, 14], [96, 4, -1.2, 15], [26, 18, 0.2, 9], [61, 22, 2.6, 12]];
  for (const [gx, gy, ga, gl] of grietas) grieta(c, X(gx), Y(gy), ga, gl, 4.2, r, P);
  for (let i = 0; i < 40; i++) grieta(c, X(X0 + r() * (X1 - X0)), Y(1 + r() * 32), r() * Math.PI * 2, 2 + r() * 5, 2, r, P, 1);

  // marcas de la gente al pie: palotes, flechas a la puerta, manos, carteles de desaparecidos
  const tiza = '#c2bcac';
  for (let i = 0; i < 26; i++) {
    const x = X(X0 + 10 + r() * (X1 - X0 - 20)), y = Y(0.8 + r() * 1.6);
    const n = 1 + Math.floor(r() * 4);
    for (let g = 0; g < n; g++) {
      const bx = x + g * 0.42 * P;
      for (let k = 0; k < 4; k++) trazo(c, temblar(linea(bx + k * 0.07 * P, y, bx + k * 0.07 * P + 1, y + 0.3 * P, 2), 1, r), 1.6, tiza, 0.55);
      trazo(c, [[bx - 2, y + 0.22 * P], [bx + 0.3 * P, y + 0.06 * P]], 1.6, tiza, 0.55);
    }
  }
  for (const [ax, dir] of [[18, 1], [24, 1], [62, -1], [70, -1], [5, 1]]) {
    const x = X(ax), y = Y(1.6), l = 1.6 * P * dir;
    trazo(c, temblar(linea(x, y, x + l, y, 6), 2, r), 5, '#b9b19c', 0.45);
    trazo(c, temblar([[x + l - dir * 0.5 * P, y - 0.4 * P], [x + l, y], [x + l - dir * 0.5 * P, y + 0.4 * P]], 2, r), 5, '#b9b19c', 0.45);
  }
  for (let i = 0; i < 14; i++) {
    const x = X(29 + r() * 22 + (r() < 0.5 ? -8 : 8)), y = Y(1.2 + r() * 1.3);
    c.fillStyle = `rgba(210,204,190,${0.15 + r() * 0.2})`;
    c.beginPath();
    c.ellipse(x, y, 0.09 * P, 0.11 * P, 0, 0, Math.PI * 2);
    c.fill();
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k - 2) * 0.38;
      trazo(c, [[x + Math.cos(a) * 0.08 * P, y + Math.sin(a) * 0.09 * P], [x + Math.cos(a) * 0.2 * P, y + Math.sin(a) * 0.22 * P]], 0.05 * P, `rgba(210,204,190,1)`, 0.25);
    }
  }
  // carteles: papel claro, rayas de letra ilegible, cinta en las esquinas, alguno roto
  for (let i = 0; i < 38; i++) {
    const lado = r() < 0.5 ? -1 : 1;
    const x = X(40 + lado * (8.5 + r() * 9)), y = Y(1.4 + r() * 1.5);
    const w = (0.32 + r() * 0.22) * P, h = (0.42 + r() * 0.2) * P;
    c.save();
    c.translate(x, y);
    c.rotate((r() - 0.5) * 0.25);
    c.fillStyle = `rgb(${172 + r() * 30},${168 + r() * 26},${150 + r() * 22})`;
    c.beginPath();
    c.moveTo(-w / 2, -h / 2);
    c.lineTo(w / 2, -h / 2);
    if (r() < 0.35) { c.lineTo(w / 2, h * 0.1); c.lineTo(0, h * 0.25); c.lineTo(-w / 2, h * 0.35); }
    else { c.lineTo(w / 2, h / 2); c.lineTo(-w / 2, h / 2); }
    c.closePath();
    c.fill();
    c.fillStyle = 'rgba(40,38,34,.55)';
    if (r() < 0.6) c.fillRect(-w * 0.3, -h * 0.38, w * 0.6, h * 0.32); // la foto
    for (let k = 0; k < 4; k++) c.fillRect(-w * 0.38, -h * 0.02 + k * h * 0.09, w * (0.4 + r() * 0.36), 1.2);
    c.fillStyle = 'rgba(200,196,170,.5)';
    c.fillRect(-w / 2 - 2, -h / 2 - 2, 5, 3);
    c.fillRect(w / 2 - 3, -h / 2 - 2, 5, 3);
    c.restore();
  }
  // rotulo de la puerta y numeros de panel a plantilla, muy gastados
  c.save();
  c.font = `bold ${Math.round(1.1 * P)}px Bahnschrift, Impact, "Arial Narrow", sans-serif`;
  c.fillStyle = 'rgba(196,190,174,.4)';
  c.textAlign = 'center';
  c.fillText(lang === 'en' ? 'GATE 3' : 'PUERTA 3', X(40), Y(17.9) + 1.1 * P);
  c.font = `bold ${Math.round(1.6 * P)}px Bahnschrift, Impact, "Arial Narrow", sans-serif`;
  for (let x = X0 + 3, n = 1; x < X1; x += 24, n++) {
    c.fillStyle = `rgba(190,186,170,${0.12 + r() * 0.12})`;
    c.fillText(String(n).padStart(2, '0'), X(x), Y(30.5));
  }
  c.restore();
  // franjas de peligro a los lados de la puerta, casi borradas (ocre apagado, nada de naranja)
  for (const [a, b] of [[30.2, 33], [47, 49.8]]) {
    c.save();
    c.beginPath();
    c.rect(X(a), Y(2.2), (b - a) * P, 2.2 * P);
    c.clip();
    for (let k = -4; k < 12; k++) {
      c.fillStyle = k % 2 ? 'rgba(20,20,18,.35)' : 'rgba(150,130,78,.32)';
      c.beginPath();
      const x = X(a) + k * 0.55 * P;
      c.moveTo(x, Y(2.2));
      c.lineTo(x + 0.55 * P, Y(2.2));
      c.lineTo(x + 0.55 * P + 2.2 * P, Y(0));
      c.lineTo(x + 2.2 * P, Y(0));
      c.fill();
    }
    c.restore();
  }

  // albardilla con sombra debajo
  const ya = Y(ALTO);
  c.fillStyle = '#6e7470';
  c.fillRect(0, ya - 0.9 * P, W, 0.9 * P);
  const gs = c.createLinearGradient(0, ya, 0, ya + 1.2 * P);
  gs.addColorStop(0, 'rgba(5,6,6,.6)');
  gs.addColorStop(1, 'rgba(5,6,6,0)');
  c.fillStyle = gs;
  c.fillRect(0, ya, W, 1.2 * P);
  for (let x = 0; x < W; x += P * (1.5 + r() * 3)) {
    if (r() < 0.3) { c.fillStyle = 'rgba(25,27,26,.7)'; c.fillRect(x, ya - 0.9 * P, P * (0.3 + r() * 1.2), 0.35 * P * r()); }
  }
  trazo(c, temblar(linea(0, ya - 0.9 * P, W, ya - 0.9 * P, 300), 1.4, r), 3, TINTA);
  trazo(c, temblar(linea(0, ya, W, ya, 300), 1.2, r), 2.4, TINTA, 0.85);

  // valla con postes, malla rota y concertina encima
  const yv0 = Y(ALTO + 0.9), yv1 = Y(ALTO + 3.4);
  for (let x = X0 + 1.5; x < X1; x += 3) {
    const inc = (r() - 0.5) * 0.25;
    trazo(c, [[X(x), yv0], [X(x + inc), yv1]], 0.13 * P, '#1b1c1c');
  }
  c.save();
  c.globalAlpha = 0.32;
  c.strokeStyle = '#2b2e2e';
  c.lineWidth = 1;
  const malla = 0.35 * P;
  for (let x = 0; x < W + 4 * P; x += malla) {
    if (r() < 0.06) { x += P * (1 + r() * 4); continue; } // tramo arrancado
    c.beginPath();
    c.moveTo(x, yv0);
    c.lineTo(x - 2.5 * P, yv1 + (r() - 0.3) * 0.3 * P);
    c.moveTo(x - 2.5 * P, yv0);
    c.lineTo(x, yv1);
    c.stroke();
  }
  c.restore();
  trazo(c, temblar(linea(0, yv1, W, yv1, 200), 2, r), 2, '#1b1c1c');
  c.save();
  c.strokeStyle = '#26292a';
  c.lineWidth = 1.3;
  for (let x = 0; x < W; x += 0.28 * P) {
    c.beginPath();
    c.ellipse(x, yv1 - 0.45 * P, 0.48 * P, 0.42 * P, 0.4, 0, Math.PI * 2);
    c.stroke();
  }
  c.restore();
  // hiedra que cuelga
  for (let i = 0; i < 18; i++) {
    const x0 = X(X0 + r() * (X1 - X0));
    const n = 3 + Math.floor(r() * 6);
    for (let k = 0; k < n; k++) {
      let x = x0 + (r() - 0.5) * 1.6 * P, y = ya;
      const l = (2 + r() * 9) * P;
      const pts = [[x, y]];
      while (y < ya + l) { y += 0.3 * P; x += (r() - 0.5) * 0.25 * P; pts.push([x, y]); }
      trazo(c, pts, 1.6, '#202820', 0.9);
      for (const [px, py] of pts) if (r() < 0.6) { c.fillStyle = r() < 0.5 ? '#2b362c' : '#1d241e'; c.beginPath(); c.ellipse(px + (r() - 0.5) * 6, py, 3 + r() * 3, 2 + r() * 2, r() * 3, 0, Math.PI * 2); c.fill(); }
    }
  }

  // bocados que faltan arriba: se ve el cielo y la armadura retorcida
  const bocados = [[69, 78, 27.5], [-11, -6, 31.2], [106, 109, 32]];
  for (const [a, b, fondo] of bocados) {
    const pol = [[X(a), Y(ALTO + 3.5)]];
    const n = 9;
    for (let k = 0; k <= n; k++) {
      const x = a + ((b - a) * k) / n;
      const fy = fondo + (ALTO - fondo) * Math.pow(Math.abs(k / n - 0.5) * 2, 1.6) + (r() - 0.5) * 1.2;
      pol.push([X(x), Y(Math.min(ALTO, fy))]);
    }
    pol.push([X(b), Y(ALTO + 3.5)]);
    c.save();
    c.globalCompositeOperation = 'destination-out';
    c.beginPath();
    pol.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.fill();
    c.restore();
    const borde = pol.slice(1, -1);
    trazo(c, borde, 3.2, TINTA);
    for (let k = 0; k < (b - a) * 1.2; k++) {
      const [bx, by] = borde[1 + Math.floor(r() * (borde.length - 2))];
      const ang = -Math.PI / 2 + (r() - 0.5) * 1.6;
      const l = (0.6 + r() * 2.4) * P;
      trazo(c, temblar([[bx, by], [bx + Math.cos(ang) * l * 0.5, by + Math.sin(ang) * l * 0.5], [bx + Math.cos(ang + 0.5) * l, by + Math.sin(ang + 0.5) * l]], 2, r), 2.2, '#3d2b1f');
    }
  }

  // hueco de la puerta con su dintel
  const [pa, pb, ph] = MURO.PUERTA;
  c.save();
  c.globalCompositeOperation = 'destination-out';
  c.fillRect(X(pa), Y(ph), (pb - pa) * P, ph * P + 2);
  c.restore();
  c.fillStyle = 'rgba(8,9,9,.45)';
  c.fillRect(X(pa) - 0.5 * P, Y(ph + 1.6), (pb - pa + 1) * P, 1.6 * P);
  trazo(c, [[X(pa), Y(0)], [X(pa), Y(ph)], [X(pb), Y(ph)], [X(pb), Y(0)]], 3.4, TINTA);
  trazo(c, temblar(linea(X(pa) - 0.5 * P, Y(ph + 1.6), X(pb) + 0.5 * P, Y(ph + 1.6), 20), 1.5, r), 2.4, TINTA, 0.8);

  // tinta del canto superior de la valla para que el muro recorte contra el cielo
  grano(c, W, H, 26, r);
  // borde inferior oscuro donde pisa el suelo
  c.fillStyle = 'rgba(6,7,7,.6)';
  c.fillRect(0, Y(0.25), W, 0.25 * P);
  return pieza(cv, X0, 0, P, { bocados });
}

// Por un bocado del canto se ve la cara de atras del muro (3 m mas lejos), rota mas arriba: asi el
// agujero tiene fondo y no es un recorte negro contra el cielo
export function hacerFondoBocados(bocados) {
  const P = 24, { ALTO } = MURO;
  return bocados.map(([a, b, fondo], i) => {
    const r = azar(640 + i);
    const x0 = a - 0.5, x1 = b + 0.5, top = ALTO + 0.9;
    const cv = lienzo((x1 - x0) * P, (top - fondo + 1) * P);
    const c = cv.getContext('2d');
    const X = (x) => (x - x0) * P, Y = (y) => (top - y) * P;
    const alto = fondo + (ALTO - fondo) * 0.5;
    const pol = [[X(x0), Y(fondo - 1)]];
    const n = 8;
    for (let k = 0; k <= n; k++) {
      const x = a + ((b - a) * k) / n;
      const fy = alto + (ALTO - alto) * Math.pow(Math.abs(k / n - 0.5) * 2, 1.3) + (r() - 0.5) * 1.1;
      pol.push([X(x), Y(Math.min(ALTO, fy))]);
    }
    pol.push([X(x1), Y(ALTO)], [X(x1), Y(fondo - 1)]);
    c.fillStyle = '#464c49';
    c.beginPath();
    pol.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.fill();
    manchas(c, cv.width, cv.height, 10, 0.4, r);
    // la cara de rotura, con luz arriba
    const borde = pol.slice(1, -2);
    trazo(c, borde.map(([x, y]) => [x, y + 3]), 4, '#626865', 0.5);
    trazo(c, borde, 3, TINTA);
    for (let k = 0; k < (b - a) * 1.4; k++) {
      const [bx, by] = borde[Math.floor(r() * borde.length)];
      const ang = -Math.PI / 2 + (r() - 0.5) * 1.8, l = (0.5 + r() * 1.8) * P;
      trazo(c, [[bx, by], [bx + Math.cos(ang) * l, by + Math.sin(ang) * l]], 2, '#3d2b1f');
    }
    grano(c, cv.width, cv.height, 22, r);
    return pieza(cv, x0, fondo - 1, P, { z: MURO.Z + 3 });
  });
}

// ------------------------------------------------------------------ el porton (hundido en el hueco)
export function hacerPorton() {
  const [pa, pb, ph] = MURO.PUERTA;
  const P = 30;
  const w = (pb - pa) * P, h = ph * P;
  const cv = lienzo(w, h);
  const c = cv.getContext('2d');
  const r = azar(77);
  c.fillStyle = '#433f3b';
  c.fillRect(0, 0, w, h);
  manchas(c, w, h, 24, 0.5, r);
  // nervios horizontales con luz arriba y sombra abajo
  for (let y = 0.9; y < ph; y += 1.6) {
    const yy = h - y * P;
    c.fillStyle = '#56504a';
    c.fillRect(0, yy - 0.16 * P, w, 0.3 * P);
    c.fillStyle = 'rgba(210,200,185,.14)';
    c.fillRect(0, yy - 0.16 * P, w, 2);
    c.fillStyle = 'rgba(0,0,0,.45)';
    c.fillRect(0, yy + 0.14 * P, w, 3);
    for (let x = 0.3; x < pb - pa; x += 0.5) {
      c.fillStyle = 'rgba(15,14,13,.8)';
      c.beginPath();
      c.arc(x * P, yy, 2.3, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(200,190,170,.25)';
      c.fillRect(x * P - 1, yy - 2, 2, 1);
    }
  }
  // montantes
  for (const x of [0.25, (pb - pa) / 2 - 0.3, (pb - pa) / 2 + 0.3, pb - pa - 0.25]) {
    c.fillStyle = '#4e4843';
    c.fillRect(x * P - 0.25 * P, 0, 0.5 * P, h);
    trazo(c, [[x * P - 0.25 * P, 0], [x * P - 0.25 * P, h]], 1.5, TINTA, 0.7);
  }
  // raja entre hojas
  c.fillStyle = '#0d0c0b';
  c.fillRect(w / 2 - 3, 0, 6, h);
  // chapas soldadas encima
  for (let i = 0; i < 7; i++) {
    const x = r() * w * 0.85, y = r() * h * 0.8, pw = (1 + r() * 2.5) * P, phh = (0.8 + r() * 2) * P;
    c.fillStyle = r() < 0.5 ? '#4b4540' : '#3c3834';
    c.fillRect(x, y, pw, phh);
    c.save();
    c.setLineDash([3, 3]);
    c.strokeStyle = 'rgba(150,140,120,.45)';
    c.lineWidth = 2;
    c.strokeRect(x, y, pw, phh);
    c.restore();
    trazo(c, [[x, y], [x + pw, y], [x + pw, y + phh], [x, y + phh], [x, y]], 1.2, TINTA, 0.6);
  }
  // oxido pardo en manchas que chorrean
  for (let i = 0; i < 46; i++) {
    const x = r() * w, y = r() * h, R = (0.3 + r() * 1.4) * P;
    const g = c.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, `rgba(96,62,40,${0.25 + r() * 0.35})`);
    g.addColorStop(1, 'rgba(96,62,40,0)');
    c.fillStyle = g;
    c.fillRect(x - R, y - R, R * 2, R * 2);
    const gr = c.createLinearGradient(0, y, 0, y + R * 3);
    gr.addColorStop(0, 'rgba(84,54,34,.35)');
    gr.addColorStop(1, 'rgba(84,54,34,0)');
    c.fillStyle = gr;
    c.fillRect(x - 2, y, 3 + r() * 3, R * 3);
  }
  // puerta peatonal en la hoja izquierda
  const dx = 2.2 * P, dw = 1.25 * P, dh = 2.3 * P;
  c.fillStyle = '#3a3633';
  c.fillRect(dx, h - dh, dw, dh);
  trazo(c, [[dx, h], [dx, h - dh], [dx + dw, h - dh], [dx + dw, h]], 3, TINTA);
  c.fillStyle = '#121110';
  c.fillRect(dx + dw * 0.25, h - dh * 0.8, dw * 0.5, 0.12 * P);
  c.fillStyle = '#8c8578';
  c.fillRect(dx + dw * 0.82, h - dh * 0.48, 0.12 * P, 0.06 * P);
  // circulo pintado con el numero, casi ido
  c.save();
  c.globalAlpha = 0.18;
  c.strokeStyle = '#d6d0c0';
  c.lineWidth = 0.4 * P;
  c.beginPath();
  c.arc(w * 0.72, h * 0.45, 2.2 * P, 0, Math.PI * 2);
  c.stroke();
  c.font = `bold ${Math.round(3 * P)}px Bahnschrift, Impact, sans-serif`;
  c.fillStyle = '#d6d0c0';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('3', w * 0.72, h * 0.46);
  c.restore();
  // abolladuras de bala
  for (let i = 0; i < 70; i++) {
    const x = r() * w, y = r() * h;
    c.fillStyle = 'rgba(10,9,8,.8)';
    c.beginPath();
    c.arc(x, y, 1.6 + r() * 1.6, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(190,180,160,.3)';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(x, y, 3.3, Math.PI * 0.9, Math.PI * 1.9);
    c.stroke();
  }
  grano(c, w, h, 22, r);
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(0,0,0,.35)');
  g.addColorStop(0.3, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,.4)');
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  return pieza(cv, pa, 0, P, { z: MURO.Z + 1.6 });
}

// ------------------------------------------------------------------ contrafuertes (salen 3 m del muro)
export const CONTRAFUERTES = [-54, -30, -6, 18, 62, 86, 110, 134]; // sin tapar el cartel (22-58)
export function hacerContrafuerte(i) {
  const P = 26, ancho = 3, alto = 38.6;
  const cv = lienzo(ancho * P, alto * P + 2);
  const c = cv.getContext('2d');
  const r = azar(300 + i * 13);
  const w = cv.width, h = cv.height;
  c.fillStyle = '#5a605d';
  c.fillRect(0, 0, w, h);
  manchas(c, w, h, 30, 0.26, r);
  manchas(c, w, h, 9, 0.1, r);
  const gl = c.createLinearGradient(0, 0, 0, h);
  gl.addColorStop(0, 'rgba(196,206,212,.14)');
  gl.addColorStop(0.5, 'rgba(0,0,0,0)');
  gl.addColorStop(1, 'rgba(0,0,0,.28)');
  c.fillStyle = gl;
  c.fillRect(0, 0, w, h);
  for (let y = 2.5; y < alto; y += 2.5) {
    c.fillStyle = 'rgba(20,22,22,.25)';
    c.fillRect(0, h - y * P, w, 2);
  }
  for (let k = 0; k < 14; k++) {
    const x = r() * w, l = (2 + r() * 14) * P;
    const g = c.createLinearGradient(0, 0.6 * P, 0, l);
    g.addColorStop(0, `rgba(18,20,19,${0.1 + r() * 0.25})`);
    g.addColorStop(1, 'rgba(18,20,19,0)');
    c.fillStyle = g;
    c.fillRect(x, 0.6 * P, 1 + r() * 0.5 * P, l);
  }
  const gb = c.createLinearGradient(0, h - 3 * P, 0, h);
  gb.addColorStop(0, 'rgba(16,17,15,0)');
  gb.addColorStop(1, 'rgba(16,17,15,.6)');
  c.fillStyle = gb;
  c.fillRect(0, h - 3 * P, w, 3 * P);
  // grieta y algun desconchado
  grieta(c, r() * w, (4 + r() * 20) * P, Math.PI / 2 + (r() - 0.5), 6 + r() * 8, 3, r, P);
  // remate
  c.fillStyle = '#757b77';
  c.fillRect(0, 0, w, 0.6 * P);
  c.fillStyle = 'rgba(0,0,0,.5)';
  c.fillRect(0, 0.6 * P, w, 0.25 * P);
  grano(c, w, h, 24, r);
  trazo(c, [[1.5, h], [1.5, 1.5], [w - 1.5, 1.5], [w - 1.5, h]], 3.2, TINTA);
  return pieza(cv, CONTRAFUERTES[i] - ancho / 2, 0, P, { z: MURO.Z - 3, alto });
}

// ------------------------------------------------------------------ cartel: letras de chapa sobre una celosia
export function hacerLetras(lang) {
  const texto = lang === 'en' ? 'REFUGEE BASE' : 'BASE DE REFUGIADOS';
  const cae = lang === 'en' ? 3 : 10; // la G
  const P = 44, altoM = 2.7, Y = 19.4, ESTRECHA = 0.74;
  const fuente = (px) => `bold ${px}px Bahnschrift, "Arial Narrow", Impact, sans-serif`;
  const m = lienzo(10, 10).getContext('2d');
  m.font = fuente(100);
  const esc = (altoM * P) / 100 / 0.74; // altura de mayuscula ~ 0,74 em
  const letras = [];
  let total = 0;
  const hueco = 0.36;
  for (const ch of texto) {
    const ancho = ch === ' ' ? 1.2 : (m.measureText(ch).width * esc * ESTRECHA) / P + 0.25;
    letras.push({ ch, ancho });
    total += ancho + (ch === ' ' ? 0 : hueco);
  }
  const r = azar(9001);
  let x = 40 - total / 2;
  const out = [];
  letras.forEach((L, i) => {
    if (L.ch === ' ') { x += L.ancho; return; }
    const w = L.ancho * P, h = altoM * 1.18 * P;
    const cara = lienzo(w, h), luz = lienzo(w, h), dorso = lienzo(w, h);
    const base = (cv, relleno) => {
      const c = cv.getContext('2d');
      c.font = fuente(Math.round(100 * esc));
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      c.fillStyle = relleno;
      c.save();
      c.translate(w / 2, 0);
      c.scale(ESTRECHA, 1);
      c.fillText(L.ch, 0, h - 0.16 * P);
      c.restore();
      return c;
    };
    const cc = base(cara, '#a8a294');
    // pintura gastada: desconchones al metal, mugre abajo, oxido pardo que baja de los tornillos
    cc.save();
    cc.globalCompositeOperation = 'source-atop';
    for (let k = 0; k < 30; k++) {
      cc.fillStyle = r() < 0.6 ? 'rgba(52,48,44,.9)' : 'rgba(80,58,40,.7)';
      cc.beginPath();
      cc.ellipse(r() * w, r() * h, (0.05 + r() * 0.25) * P, (0.03 + r() * 0.15) * P, r() * 3, 0, Math.PI * 2);
      cc.fill();
    }
    const g = cc.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(20,18,15,.55)');
    cc.fillStyle = g;
    cc.fillRect(0, 0, w, h);
    for (let k = 0; k < 4; k++) {
      const sx = r() * w;
      const gr = cc.createLinearGradient(0, h * 0.2, 0, h);
      gr.addColorStop(0, 'rgba(90,58,36,.55)');
      gr.addColorStop(1, 'rgba(90,58,36,0)');
      cc.fillStyle = gr;
      cc.fillRect(sx, h * 0.2, 2 + r() * 4, h);
    }
    cc.restore();
    grano(cc, w, h, 30, r);
    // contorno a tinta
    cc.save();
    cc.font = fuente(Math.round(100 * esc));
    cc.textAlign = 'center';
    cc.lineWidth = 2.6;
    cc.strokeStyle = TINTA;
    cc.lineJoin = 'round';
    cc.translate(w / 2, 0);
    cc.scale(ESTRECHA, 1);
    cc.strokeText(L.ch, 0, h - 0.16 * P);
    cc.restore();
    // version iluminada por los focos de abajo
    const lc = luz.getContext('2d');
    lc.drawImage(cara, 0, 0);
    lc.globalCompositeOperation = 'source-atop';
    const gl = lc.createLinearGradient(0, h, 0, 0);
    gl.addColorStop(0, 'rgba(255,246,226,.75)');
    gl.addColorStop(0.55, 'rgba(255,246,226,.3)');
    gl.addColorStop(1, 'rgba(255,246,226,.06)');
    lc.fillStyle = gl;
    lc.globalCompositeOperation = 'source-atop';
    lc.globalAlpha = 1;
    lc.fillRect(0, 0, w, h);
    lc.globalCompositeOperation = 'source-over';
    lc.save();
    lc.font = fuente(Math.round(100 * esc));
    lc.textAlign = 'center';
    lc.lineWidth = 2.6;
    lc.strokeStyle = TINTA;
    lc.translate(w / 2, 0);
    lc.scale(ESTRECHA, 1);
    lc.strokeText(L.ch, 0, h - 0.16 * P);
    lc.restore();
    base(dorso, '#26241f');
    out.push({
      ch: L.ch, cae: i === cae, cara: pieza(cara, x, Y, P), luz: luz, dorso: pieza(dorso, x, Y, P),
      x, y: Y, w: w / P, h: h / P, z: MURO.Z - 1.4,
    });
    x += L.ancho + hueco;
  });
  return { letras: out, x0: 40 - total / 2 - 0.8, x1: 40 + total / 2 + 0.8 };
}

// celosia bajo las letras
export function hacerCelosia(x0, x1) {
  const P = 30, alto = 1.4;
  const w = (x1 - x0) * P, h = alto * P;
  const cv = lienzo(w, h + 4);
  const c = cv.getContext('2d');
  const r = azar(55);
  const cord = 0.16 * P;
  c.fillStyle = '#2e2b28';
  c.fillRect(0, 2, w, cord);
  c.fillRect(0, h - cord + 2, w, cord);
  const paso = 1.1 * P;
  for (let x = 0, k = 0; x < w; x += paso, k++) {
    trazo(c, [[x, 2 + cord / 2], [x + paso, h + 2 - cord / 2]], 0.09 * P, '#2a2724');
    trazo(c, [[x + paso, 2 + cord / 2], [x, h + 2 - cord / 2]], 0.09 * P, '#2a2724');
    trazo(c, [[x, 2], [x, h + 2]], 0.1 * P, '#24221f');
  }
  // oxido
  for (let i = 0; i < 80; i++) {
    c.fillStyle = `rgba(90,58,36,${0.3 + r() * 0.4})`;
    c.fillRect(r() * w, 2 + r() * h, 2 + r() * 6, 2 + r() * 3);
  }
  trazo(c, [[0, 2], [w, 2]], 2, TINTA);
  trazo(c, [[0, h + 2], [w, h + 2]], 2, TINTA);
  return pieza(cv, x0, 17.9, P, { z: MURO.Z - 1.2 });
}

// ------------------------------------------------------------------ suelo: tesela de 20 x 20 m
export function hacerSuelo() {
  const N = 512, M = 20, P = N / M;
  const cv = lienzo(N, N);
  const c = cv.getContext('2d');
  const r = azar(4242);
  c.fillStyle = '#34332f';
  c.fillRect(0, 0, N, N);
  manchas(c, N, N, 40, 0.32, r);
  manchas(c, N, N, 8, 0.16, r);
  const envolver = (f) => { for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) { c.save(); c.translate(dx, dy); f(); c.restore(); } };
  for (let i = 0; i < 1600; i++) {
    const x = r() * N, y = r() * N, s = 0.5 + r() * 2.5;
    c.fillStyle = r() < 0.5 ? 'rgba(90,88,80,.5)' : 'rgba(14,14,12,.6)';
    c.fillRect(x, y, s, s * 0.6);
  }
  for (let i = 0; i < 14; i++) {
    let x = r() * N, y = r() * N, a = r() * Math.PI * 2;
    const pts = [[x, y]];
    for (let k = 0; k < 30; k++) { a += (r() - 0.5) * 1; x += Math.cos(a) * 6; y += Math.sin(a) * 6; pts.push([x, y]); }
    envolver(() => trazo(c, pts, 1.4, '#141412', 0.7));
  }
  grano(c, N, N, 30, r);
  return { img: cv, P, M };
}

// ------------------------------------------------------------------ atrezo: tarjetas a su profundidad
function tarjeta(wm, hm, P, dibujar, semilla) {
  const cv = lienzo(wm * P, hm * P);
  const c = cv.getContext('2d');
  dibujar(c, cv.width, cv.height, azar(semilla), P);
  return cv;
}

export function hacerAtrezo() {
  const P = 40;
  const out = {};
  out.barrera = tarjeta(3.7, 1.0, P, (c, w, h, r) => {
    c.fillStyle = '#5c605c';
    c.beginPath();
    c.moveTo(4, h);
    c.lineTo(0.35 * P, 0.25 * P);
    c.lineTo(0.55 * P, 0.05 * P);
    c.lineTo(w - 0.55 * P, 0.05 * P);
    c.lineTo(w - 0.35 * P, 0.25 * P);
    c.lineTo(w - 4, h);
    c.closePath();
    c.fill();
    manchas(c, w, h, 6, 0.5, r);
    c.save();
    c.clip();
    for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? 'rgba(20,20,18,.4)' : 'rgba(160,150,120,.25)'; c.fillRect(k * 0.5 * P, 0.4 * P, 0.5 * P, 0.25 * P); }
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,.08)');
    g.addColorStop(1, 'rgba(0,0,0,.5)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.restore();
    grano(c, w, h, 24, r);
    trazo(c, [[4, h], [0.35 * P, 0.25 * P], [0.55 * P, 0.05 * P], [w - 0.55 * P, 0.05 * P], [w - 0.35 * P, 0.25 * P], [w - 4, h]], 3, TINTA);
  }, 1);
  out.erizo = tarjeta(1.9, 1.6, P, (c, w, h, r) => {
    const v = [[[0.1, 1.55], [1.75, 0.15]], [[0.2, 0.1], [1.8, 1.5]], [[0.95, 1.6], [0.9, 0.05]]];
    for (const [[a, b], [d, e]] of v) {
      trazo(c, [[a * P, b * P], [d * P, e * P]], 0.2 * P, '#262321');
      trazo(c, [[a * P, b * P - 2], [d * P, e * P - 2]], 2, 'rgba(160,150,135,.35)');
    }
    for (let k = 0; k < 20; k++) { c.fillStyle = 'rgba(90,58,36,.6)'; c.fillRect(r() * w, r() * h, 3, 3); }
  }, 2);
  out.coche = tarjeta(4.4, 1.6, P, (c, w, h, r) => {
    const pts = [[0.1, 1.15], [0.2, 0.75], [1.2, 0.65], [1.75, 0.15], [3.0, 0.12], [3.6, 0.62], [4.3, 0.72], [4.35, 1.15]];
    c.fillStyle = '#2b2725';
    c.beginPath();
    pts.forEach(([x, y], k) => (k ? c.lineTo(x * P, y * P) : c.moveTo(x * P, y * P)));
    c.closePath();
    c.fill();
    manchas(c, w, h, 5, 0.6, r);
    // chapa quemada: pardos y negro, ventanillas vacias
    for (let k = 0; k < 40; k++) { c.fillStyle = `rgba(${70 + r() * 30},${48 + r() * 20},${34},${0.3 + r() * 0.4})`; c.beginPath(); c.ellipse(r() * w, (0.2 + r() * 0.9) * P, 4 + r() * 14, 2 + r() * 6, 0, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#0d0c0c';
    c.beginPath(); c.moveTo(1.4 * P, 0.65 * P); c.lineTo(1.85 * P, 0.25 * P); c.lineTo(2.35 * P, 0.25 * P); c.lineTo(2.35 * P, 0.65 * P); c.fill();
    c.beginPath(); c.moveTo(2.5 * P, 0.65 * P); c.lineTo(2.5 * P, 0.25 * P); c.lineTo(2.95 * P, 0.25 * P); c.lineTo(3.35 * P, 0.65 * P); c.fill();
    trazo(c, [...pts.map(([x, y]) => [x * P, y * P]), [pts[0][0] * P, pts[0][1] * P]], 3, TINTA);
    // sin ruedas: sobre las llantas, hundido
    for (const x of [0.95, 3.45]) { c.fillStyle = '#151413'; c.beginPath(); c.ellipse(x * P, 1.2 * P, 0.38 * P, 0.3 * P, 0, 0, Math.PI * 2); c.fill(); trazo(c, [[x * P - 0.36 * P, 1.2 * P], [x * P + 0.36 * P, 1.2 * P]], 2, '#5a4a3a', 0.6); }
    c.fillStyle = '#1a1917';
    c.fillRect(0, 1.3 * P, w, h - 1.3 * P);
    grano(c, w, h, 26, r);
  }, 3);
  out.sacos = tarjeta(5, 1.3, P, (c, w, h, r) => {
    for (let fila = 0; fila < 3; fila++) {
      const y = h - (fila + 1) * 0.4 * P;
      for (let x = (fila % 2) * 0.35 * P - 0.3 * P; x < w; x += 0.7 * P) {
        if (fila === 2 && r() < 0.35) continue;
        c.fillStyle = `rgb(${82 + r() * 18},${78 + r() * 14},${62 + r() * 10})`;
        c.beginPath();
        c.ellipse(x + 0.35 * P, y + 0.22 * P, 0.38 * P, 0.22 * P, (r() - 0.5) * 0.15, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = TINTA; c.lineWidth = 2; c.stroke();
        trazo(c, [[x + 0.15 * P, y + 0.15 * P], [x + 0.55 * P, y + 0.17 * P]], 1, 'rgba(0,0,0,.4)');
      }
    }
    grano(c, w, h, 28, r);
  }, 4);
  out.escombro = tarjeta(6, 1.6, P, (c, w, h, r) => {
    for (let k = 0; k < 46; k++) {
      const cx = w / 2 + (r() - 0.5) * w * 0.85 * (1 - k / 60), s = (0.15 + r() * 0.6) * P;
      const cy = h - s * 0.4 - r() * (h - s) * Math.max(0, 1 - Math.abs(cx - w / 2) / (w / 2)) * 0.9;
      const n = 5 + Math.floor(r() * 3);
      const pol = [];
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + r(); pol.push([cx + Math.cos(a) * s * (0.6 + r() * 0.5), cy + Math.sin(a) * s * 0.6]); }
      const t = 70 + r() * 30;
      c.fillStyle = `rgb(${t},${t + 4},${t})`;
      c.beginPath();
      pol.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
      c.fill();
      c.fillStyle = 'rgba(0,0,0,.35)';
      c.fill();
      c.strokeStyle = TINTA; c.lineWidth = 2; c.stroke();
      if (r() < 0.2) trazo(c, [[cx, cy], [cx + (r() - 0.5) * P, cy - r() * P]], 2.2, '#3d2b1f');
    }
    grano(c, w, h, 24, r);
  }, 5);
  out.maletas = tarjeta(1.8, 0.9, P, (c, w, h, r) => {
    const cajas = [[0.05, 0.35, 0.8, 0.55, '#3c342c'], [0.75, 0.45, 0.6, 0.45, '#2f3330'], [0.2, 0.05, 0.6, 0.32, '#45392e'], [1.3, 0.62, 0.45, 0.28, '#3a2f2a']];
    for (const [x, y, ww, hh, col] of cajas) {
      c.fillStyle = col;
      c.fillRect(x * P, y * P, ww * P, hh * P);
      c.strokeStyle = TINTA; c.lineWidth = 2; c.strokeRect(x * P, y * P, ww * P, hh * P);
      trazo(c, [[(x + ww * 0.35) * P, y * P], [(x + ww * 0.35) * P, (y - 0.06) * P], [(x + ww * 0.65) * P, (y - 0.06) * P], [(x + ww * 0.65) * P, y * P]], 2, TINTA);
    }
    grano(c, w, h, 24, r);
  }, 6);
  out.arbol = tarjeta(9, 11, P, (c, w, h, r) => {
    const rama = (x, y, a, l, g) => {
      const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l;
      const pts = temblar(linea(x, y, x2, y2, 5), g * 0.6, r);
      trazo(c, pts, g, '#0e0f10');
      if (g > 1.6) {
        const n = 2 + Math.floor(r() * 2);
        for (let k = 0; k < n; k++) rama(x2, y2, a + (r() - 0.5) * 1.3, l * (0.55 + r() * 0.25), g * 0.62);
      }
    };
    rama(w * 0.48, h, -Math.PI / 2 + 0.06, 3.2 * P, 0.55 * P);
  }, 7);
  out.farola = tarjeta(3.4, 7.5, P, (c, w, h, r) => {
    trazo(c, [[0.6 * P, h], [1.2 * P, 1.2 * P], [2.6 * P, 0.4 * P]], 0.16 * P, '#141515');
    c.fillStyle = '#141515';
    c.beginPath(); c.ellipse(2.75 * P, 0.55 * P, 0.4 * P, 0.16 * P, 0.4, 0, Math.PI * 2); c.fill();
    trazo(c, [[2.6 * P, 0.75 * P], [2.5 * P, 1.6 * P]], 1.5, '#141515');
  }, 8);
  return out;
}

// ------------------------------------------------------------------ primer plano: siluetas desenfocadas
export function hacerPrimerPlano() {
  const P = 30;
  const piezas = [];
  const mk = (wm, hm, semilla, dib) => {
    const pad = 12;
    const cv = lienzo(wm * P + pad * 2, hm * P + pad);
    const c = cv.getContext('2d');
    c.translate(pad, pad);
    dib(c, wm * P, hm * P, azar(semilla));
    const b = lienzo(cv.width, cv.height);
    const bc = b.getContext('2d');
    bc.filter = 'blur(5px)';
    bc.drawImage(cv, 0, 0);
    return { img: b, nitida: cv, w: cv.width / P, h: cv.height / P, pad: pad / P };
  };
  const roca = (c, w, h, r) => {
    c.fillStyle = '#07080a';
    c.beginPath();
    c.moveTo(0, h);
    const n = 12;
    for (let i = 0; i <= n; i++) c.lineTo((i / n) * w, h - Math.sin((i / n) * Math.PI) * h * (0.55 + r() * 0.45));
    c.lineTo(w, h);
    c.fill();
    for (let k = 0; k < 9; k++) trazo(c, [[r() * w, h * (0.3 + r() * 0.4)], [r() * w, -h * 0.2 * r()]], 3 + r() * 3, '#07080a');
  };
  const hierba = (c, w, h, r) => {
    for (let k = 0; k < 70; k++) {
      const x = r() * w, l = h * (0.3 + r() * 0.7), a = (r() - 0.5) * 0.7;
      c.strokeStyle = '#08090b';
      c.lineWidth = 1 + r() * 1.4;
      c.beginPath();
      c.moveTo(x, h);
      c.quadraticCurveTo(x + a * l * 0.3, h - l * 0.6, x + a * l, h - l);
      c.stroke();
    }
  };
  const valla = (c, w, h, r) => {
    trazo(c, [[0.2 * P, h], [0.25 * P, 0]], 0.16 * P, '#07080a');
    trazo(c, [[w - 0.3 * P, h], [w - 0.15 * P, 0.3 * P]], 0.16 * P, '#07080a');
    c.strokeStyle = '#07080a';
    c.lineWidth = 2;
    for (let x = -h; x < w; x += 0.4 * P) {
      c.beginPath(); c.moveTo(x, 0.3 * P); c.lineTo(x + h, h); c.stroke();
      c.beginPath(); c.moveTo(x + h, 0.3 * P); c.lineTo(x, h); c.stroke();
    }
    trazo(c, [[0, 0.3 * P], [w, 0.5 * P + r() * 10]], 3, '#07080a');
  };
  // bajos: el primer plano enmarca por abajo y nunca tapa al 18
  piezas.push({ ...mk(5, 0.8, 1, roca), x: -18, z: -4.5 });
  piezas.push({ ...mk(3, 0.55, 2, hierba), x: -3, z: -3.8 });
  piezas.push({ ...mk(2.2, 0.6, 3, roca), x: 12, z: -5.5 });
  piezas.push({ ...mk(3.5, 0.6, 4, hierba), x: 22, z: -3.6 });
  piezas.push({ ...mk(5, 0.9, 5, roca), x: 4, z: -6 });
  piezas.push({ ...mk(3, 0.5, 6, hierba), x: 47, z: -3.5 });
  piezas.push({ ...mk(5, 0.85, 7, roca), x: 58, z: -5 });
  piezas.push({ ...mk(3, 0.55, 8, hierba), x: 32, z: -3.2 });
  return piezas;
}

// ------------------------------------------------------------------ cielo y nubes
export function hacerNubes(semilla, oscuro) {
  const w = 2048, h = 360;
  const cv = lienzo(w, h);
  const c = cv.getContext('2d');
  const r = azar(semilla);
  for (let i = 0; i < 160; i++) {
    const x = r() * w, y = h * (0.25 + r() * 0.6), R = 30 + r() * 120;
    for (const dx of [-w, 0, w]) {
      const g = c.createRadialGradient(x + dx, y, 0, x + dx, y, R);
      const a = 0.1 + r() * 0.16;
      g.addColorStop(0, oscuro ? `rgba(18,23,29,${a * 1.6})` : `rgba(96,108,118,${a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(x + dx, y, R * 2.2, R * 0.6, 0, 0, Math.PI * 2);
      c.fill();
    }
  }
  return cv;
}

// grua dentro de la base (asoma por encima del muro)
export function hacerGrua() {
  const P = 8;
  const W = 64, H = 74;
  const cv = lienzo(W * P, H * P);
  const c = cv.getContext('2d');
  const X = (x) => x * P, Y = (y) => (H - y) * P;
  const col = '#22282e';
  const mx = 18;
  // torre en celosia
  for (const dx of [-1, 1]) trazo(c, [[X(mx + dx), Y(0)], [X(mx + dx), Y(66)]], 2.4, col);
  for (let y = 0; y < 66; y += 2) {
    trazo(c, [[X(mx - 1), Y(y)], [X(mx + 1), Y(y + 2)]], 1.2, col);
    trazo(c, [[X(mx + 1), Y(y)], [X(mx - 1), Y(y + 2)]], 1.2, col);
  }
  // pluma y contrapluma
  trazo(c, [[X(mx - 14), Y(66)], [X(mx + 44), Y(66)]], 3, col);
  trazo(c, [[X(mx - 14), Y(64.6)], [X(mx + 44), Y(65.2)]], 2, col);
  for (let x = mx - 14; x < mx + 44; x += 2) trazo(c, [[X(x), Y(64.6 + ((x - mx + 14) / 58) * 0.6)], [X(x + 1), Y(66)]], 1, col);
  trazo(c, [[X(mx), Y(72)], [X(mx + 40), Y(66)]], 1.4, col);
  trazo(c, [[X(mx), Y(72)], [X(mx - 13), Y(66)]], 1.4, col);
  trazo(c, [[X(mx - 1), Y(66)], [X(mx), Y(72)], [X(mx + 1), Y(66)]], 2, col);
  c.fillStyle = col;
  c.fillRect(X(mx - 14), Y(66), 5 * P, 2.5 * P); // contrapeso
  // cable con gancho, torcido
  trazo(c, [[X(mx + 30), Y(64.8)], [X(mx + 30.8), Y(40)]], 1, col);
  c.fillRect(X(mx + 30.4), Y(40), 1.2 * P, 1 * P);
  return pieza(cv, -4, 0, P, { z: 78, luz: [mx + 44 - 4, 66.5] });
}
