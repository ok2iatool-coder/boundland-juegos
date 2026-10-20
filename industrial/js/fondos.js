// LOS FONDOS de todo el nivel, capa a capa, en coordenadas de su capa. Cerca del principio llevan lo que hay en la
// imagen de referencia, en su sitio medido (px y py: los pixeles de la imagen); despues siguen con lo mismo de la
// imagen (gruas, chimeneas con humo, cupulas, torres goticas de plataformas, torres de alta tension con sus cables,
// bloques con ventanas encendidas, viaductos de arco) y lo que una ciudad industrial anade: gasometros, depositos
// de agua, el viaducto del tren, naves de dientes de sierra y torres de refrigeracion.
import * as THREE from 'three';
import { PAL, Cajas, Barras, Luces, Formas, hormigon, hierro, azar, lerp } from './base.js';
import { barandilla, escalera, celosia, torreAltaTension, cable, torreGotica, chimenea, cupula, grua, bloque, viaducto, muroArcos, remate, andamio } from './edificios.js';
import { humo, bruma } from './atmosfera.js';

export const px = (p) => (p - 655) * 0.01116, py = (p) => (828 - p) * 0.01116;

// ---------------------------------------------------------------- piezas que solo estan en los fondos
function gasometro(K, B, x, y0, r, alto, z, mat) {
  const g = new THREE.Group();
  const tanque = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.9, alto * 0.72, 28), mat); tanque.position.set(x, y0 + alto * 0.36, z); g.add(tanque);
  K.add(x, y0 + alto * 0.72 + 0.1, z, r * 1.9, 0.2, r * 0.6);
  // la jaula de columnas y vigas (de frente: las de delante y las de los lados)
  for (let k = 0; k <= 8; k++) { const a = Math.PI * (k / 8), cx = x + Math.cos(a) * r; B.add([cx, y0, z + Math.sin(a) * r], [cx, y0 + alto, z + Math.sin(a) * r], 0.12); }
  for (let q = 1; q <= 4; q++) { const y = y0 + (alto * q) / 4; B.add([x - r, y, z + 0.2], [x + r, y, z + 0.2], 0.1); for (let k = 0; k < 8; k++) { const a0 = Math.PI * (k / 8), a1 = Math.PI * ((k + 1) / 8); B.add([x + Math.cos(a0) * r, y - alto / 4, z + Math.sin(a0) * r], [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r], 0.05); } }
  return g;
}
function depositoAgua(K, B, x, y0, alto, z, mat) {
  const g = new THREE.Group(), r = alto * 0.16, yt = y0 + alto * 0.68;
  for (const s of [-1, -0.35, 0.35, 1]) B.add([x + s * r * 1.15, y0, z], [x + s * r * 0.85, yt, z], 0.1);
  for (let q = 0; q < 3; q++) { const ya = y0 + (yt - y0) * (q / 3), yb = y0 + (yt - y0) * ((q + 1) / 3); B.add([x - r * 1.1, ya, z], [x + r * 1.0, yb, z], 0.04); B.add([x + r * 1.1, ya, z], [x - r * 1.0, yb, z], 0.04); }
  const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, alto * 0.22, 20), mat); t.position.set(x, yt + alto * 0.11, z); g.add(t);
  const tejado = new THREE.Mesh(new THREE.ConeGeometry(r * 1.05, alto * 0.1, 20), mat); tejado.position.set(x, yt + alto * 0.27, z); g.add(tejado);
  barandilla(B, x - r, x + r, yt, z + r * 0.8, { alto: 0.4, paso: 0.25, grueso: 0.03 });
  return g;
}
function viaductoTren(x0, x1, y, alto, z, mat, B) {
  const vano = 3.2, arcos = [];
  for (let x = x0 + 0.5; x + vano < x1 - 0.3; x += vano + 0.55) arcos.push([x, x + vano, y - 0.7 - vano / 2]);
  const s = muroArcos(x0, x1, y, y - alto, arcos);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 1.4, bevelEnabled: false, curveSegments: 18 }); geo.translate(0, 0, z - 0.7);
  const m = new THREE.Mesh(geo, mat);
  barandilla(B, x0, x1, y, z + 0.6, { alto: 0.6, paso: 0.5, grueso: 0.04 });
  // catenaria del tren: postes y el hilo
  for (let x = x0 + 1; x < x1; x += 4.5) { B.add([x, y, z], [x, y + 1.6, z], 0.06); B.add([x - 0.5, y + 1.5, z], [x + 0.5, y + 1.5, z], 0.04); }
  return m;
}
function naveDientes(K, x0, x1, y0, alto, z, mat) {
  K.base((x0 + x1) / 2, y0, z, x1 - x0, alto, 3);
  const s = new THREE.Shape(), d = 1.6; s.moveTo(x0, y0 + alto);
  for (let x = x0; x < x1 - 0.01; x += d) { s.lineTo(Math.min(x1, x + d * 0.82), y0 + alto + 0.9); s.lineTo(Math.min(x1, x + d * 0.82), y0 + alto); s.lineTo(Math.min(x1, x + d), y0 + alto); }
  s.lineTo(x0, y0 + alto);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 2.4, bevelEnabled: false }); geo.translate(0, 0, z - 1.2);
  return new THREE.Mesh(geo, mat);
}
function torreRefrigeracion(x, y0, alto, r, z, mat) {
  const pts = []; for (let k = 0; k <= 16; k++) { const t = k / 16, rr = r * (1 - 0.32 * Math.sin(Math.PI * Math.pow(t, 0.85))) * (t > 0.92 ? 1.02 : 1); pts.push(new THREE.Vector2(rr, y0 + alto * t)); }
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), mat); m.position.set(x, 0, z);
  return m;
}

// DEPOSITO ESFERICO sobre patas (los de gas), con su anillo de pasarela y la escalera que sube en diagonal
function esfera(F, B, x, y0, r, z) {
  const yc = y0 + r * 1.5;
  for (let k = 0; k < 6; k++) { const a = Math.PI * (k / 5), px0 = x + Math.cos(a) * r * 0.92; B.add([px0, y0, z + Math.sin(a) * r * 0.4], [px0, yc, z + Math.sin(a) * r * 0.4], r * 0.07); }
  for (let k = 0; k < 5; k++) B.add([x + Math.cos(Math.PI * k / 5) * r * 0.92, y0 + r * 0.3, z + 0.1], [x + Math.cos(Math.PI * (k + 1) / 5) * r * 0.92, yc - r * 0.1, z + 0.1], r * 0.03);
  F.ESF.add(x, yc, z, r * 2, r * 2, r * 2);
  B.add([x - r * 1.05, yc, z + r * 0.6], [x + r * 1.05, yc, z + r * 0.6], r * 0.05); barandilla(B, x - r * 1.0, x + r * 1.0, yc, z + r * 0.7, { alto: r * 0.25, paso: r * 0.2, grueso: r * 0.025 });
  B.add([x - r * 1.4, y0, z + r * 0.8], [x - r * 0.3, yc + r * 0.9, z + r * 0.8], r * 0.04);
}
// CISTERNA tumbada sobre sus cunas
function cisterna(F, K, x, y0, l, r, z) { F.BR.add([x - l / 2, y0 + r + 0.15, z], [x + l / 2, y0 + r + 0.15, z], r * 2); for (const s of [-0.3, 0.3]) K.base(x + s * l, y0, z + 0.1, 0.2, r + 0.1, r * 1.6); for (const s of [-0.5, 0.5]) F.ESF.add(x + s * l, y0 + r + 0.15, z, r * 0.6, r * 2, r * 2); }

// ================================================================= LEJOS (f 0,12)
export function capaLejos(g, ctx, a, b) {
  const mat = hormigon('#57514a', { mugre: 0.3, chorro: 0.2 }), K = new Cajas(mat, false), B = new Barras(mat, false, false);
  const KV = new Cajas(hormigon('#57514a', { mugre: 0.3, chorro: 0.2, ventanas: { w: 0.14, h: 0.22, enc: 0.07 }, amb: 0.5 }), false);
  const F = { BR: new Barras(mat, true, false), CONO: new Formas(new THREE.ConeGeometry(0.5, 1, 8), mat), ESF: new Formas(new THREE.SphereGeometry(0.5, 16, 10), mat) };
  const rr = azar(41), SUELO = py(620);
  // lo de la imagen
  g.add(grua(K, B, px(912), py(560), py(250) - py(560), 1.0, 2.35, 0, mat));
  const chs = [chimenea(B, px(1257), py(600), py(209) - py(600), 0.32, 0, mat, { anillos: 8 }), chimenea(B, px(1414), py(600), py(325) - py(600), 0.2, 0, mat, { anillos: 6 })];
  for (const [xx, top, r] of [[1297, 359, 0.13], [1318, 352, 0.12], [1470, 380, 0.15], [1452, 420, 0.1]]) g.add(chimenea(B, px(xx), py(600), py(top) - py(600), r, 0, mat, { escalera: false }).grupo);
  g.add(cupula(K, B, px(1456), py(560), 1.06, 0, mat));
  // lo de despues: chimeneas con humo, otra grua, una cupula grande, torres de refrigeracion, agujas
  for (let x = 12; x < b; x += 4 + rr() * 5) {
    const z = rr();
    if (z < 0.35) chs.push(chimenea(B, x, SUELO, 3.2 + rr() * 2.6, 0.18 + rr() * 0.16, 0, mat, { anillos: 6, escalera: rr() < 0.5 }));
    else if (z < 0.5) g.add(grua(K, B, x, SUELO + 0.6, 2.6 + rr() * 1.4, 0.6 + rr() * 0.6, 1.4 + rr() * 1.2, 0, mat));
    else if (z < 0.62) g.add(cupula(K, B, x, SUELO + 0.4, 0.8 + rr() * 0.7, 0, mat));
    else if (z < 0.75) g.add(torreRefrigeracion(x, SUELO, 2.6 + rr() * 1.2, 1.0 + rr() * 0.4, 0, mat));
    else { const h = 3 + rr() * 3, w = 0.25 + rr() * 0.2; K.base(x, SUELO, 0, w * 2, h * 0.7, 1); const ag = new THREE.Mesh(new THREE.ConeGeometry(w, h * 0.32, 6), mat); ag.position.set(x, SUELO + h * 0.86, 0); g.add(ag); }
  }
  for (const c of chs) g.add(c.grupo);
  // el humo: las dos de la imagen y una de cada tres de las demas (el humo cuesta)
  chs.forEach((c, k) => { if (k < 2 || k % 3 === 0) g.add(humo(c.boca[0], c.boca[1], k < 2 ? 110 : 60, ctx.tiempo, { vida: 28 + (k % 3) * 3, sube: 5.2, viento: -2.5, tam: k === 0 ? 0.75 : 0.55 })); });
  // el horizonte: bloques bajos, agujas y antenas, de punta a punta
  for (let x = a; x < b; x += 0.6 + rr() * 1.4) { const h = 0.8 + rr() * 2.6, w = 0.5 + rr() * 1.4; KV.base(x, SUELO, 0, w, h, 1); if (rr() < 0.6) remate(KV, K, B, F, x - w / 2, x + w / 2, SUELO + h, 0, 1, rr, 0.7); else if (rr() < 0.4) B.add([x, SUELO + h, 0], [x, SUELO + h + 1 + rr() * 2.5, 0], 0.08); }
  for (let x = 14 + rr() * 5; x < b; x += 8 + rr() * 9) esfera(F, B, x, SUELO, 0.5 + rr() * 0.35, -0.5);
  for (const [xx, top, w] of [[20, 140, 0.35], [45, 200, 0.25], [230, 260, 0.3], [1540, 300, 0.3], [1600, 360, 0.25], [1640, 260, 0.22]]) { const x = px(xx), h = py(top) - SUELO; K.base(x, SUELO, 0, w * 2, h * 0.7, 1); const ag = new THREE.Mesh(new THREE.ConeGeometry(w, h * 0.32, 6), mat); ag.position.set(x, SUELO + h * 0.86, 0); g.add(ag); }
  g.add(K.malla(), KV.malla(), B.malla(), F.BR.malla(), F.CONO.malla(), F.ESF.malla());
  const br = bruma(b - a + 20, 5, '#9a8a75', 0.4, ctx.tiempo, 0.012, 3); br.position.set((a + b) / 2, py(560), 6); g.add(br);
}

// ================================================================= MEDIO LEJOS (f 0,3)
export function capaMedioLejos(g, ctx, a, b) {
  const mat = hormigon('#433e38', { mugre: 0.4 }), K = new Cajas(mat, false), KO = new Cajas(new THREE.MeshBasicMaterial({ color: '#191715' }), false), B = new Barras(mat, false, false), L = new Luces();
  const KV = new Cajas(hormigon('#433e38', { mugre: 0.4, ventanas: { w: 0.19, h: 0.3, enc: 0.13 }, tiempo: ctx.tiempo, amb: 0.3 }), false), F = { BR: new Barras(mat, true, false), CONO: new Formas(new THREE.ConeGeometry(0.5, 1, 10), mat), ESF: new Formas(new THREE.SphereGeometry(0.5, 20, 12), mat) }, BL = (...a) => bloque(K, KO, B, L, ...a.slice(0, 5), { densidad: 1.2, ...(a[5] || {}), KV, F });
  const rr = azar(73), SUELO = py(640);
  // lo de la imagen
  g.add(torreGotica(K, B, px(745), py(600), py(159) - py(600), 0.95, 0, { cuerpos: 4, sem: 5 }));
  g.add(torreGotica(K, B, px(840), py(600), py(320) - py(600), 0.36, 0, { cuerpos: 3, sem: 8 }));
  g.add(torreGotica(K, B, px(650), py(620), py(339) - py(620), 0.3, 0, { cuerpos: 3, sem: 9 }));
  BL(px(612), px(738), SUELO, py(494) - SUELO, 0, { encendidas: 0.22, sem: 1 });
  BL(px(965), px(1060), SUELO, py(560) - SUELO, 0, { encendidas: 0.18, sem: 2 });
  BL(px(1290), px(1390), py(660), py(540) - py(660), 0, { encendidas: 0.1, sem: 3 });
  torreAltaTension(B, px(1012), py(600), py(384) - py(600), 0.55, 0, { grueso: 0.05, sem: 4 });
  // y siguiendo: bloques de alturas distintas, torres goticas cada tanto, alguna torre de alta tension
  for (let x = a; x < b;) {
    if (x > -1 && x < 9.5) { x = 9.5; continue; }                   // ahi esta lo de la imagen
    const w = 1.0 + rr() * 2.2, h = 1.2 + rr() * 3.0;
    BL(x, x + w, SUELO, h, (rr() - 0.5) * 2, { encendidas: 0.12 + rr() * 0.12, sem: Math.round(x * 7) });
    if (rr() < 0.18) g.add(torreGotica(K, B, x + w + 0.6, SUELO, 4.5 + rr() * 2.5, 0.5 + rr() * 0.4, -0.5, { cuerpos: 3 + Math.floor(rr() * 2), sem: Math.round(x) }));
    else if (rr() < 0.15) torreAltaTension(B, x + w + 0.5, SUELO, 3 + rr() * 1.5, 0.5, 0.4, { grueso: 0.045, sem: Math.round(x) });
    x += w + 0.3 + rr() * 1.2;
  }
  // depositos esfericos y cisternas entre los bloques, cada tanto
  for (let x = 11 + rr() * 4; x < b; x += 9 + rr() * 10) { if (rr() < 0.55) esfera(F, B, x, SUELO, 0.7 + rr() * 0.5, -0.8); else cisterna(F, K, x, SUELO, 2.2 + rr() * 1.4, 0.38 + rr() * 0.2, -0.6); }
  g.add(K.malla(), KV.malla(), KO.malla(), B.malla(), L.malla(ctx.tiempo), F.BR.malla(), F.CONO.malla(), F.ESF.malla());
  const br = bruma(b - a + 20, 4.5, '#8c7d6b', 0.3, ctx.tiempo, 0.016, 7); br.position.set((a + b) / 2, SUELO, 4); g.add(br);
}

// ================================================================= MEDIO (f 0,55)
export function capaMedio(g, ctx, a, b) {
  const mat = hormigon('#332f2a', { mugre: 0.5, pie: py(700) }), K = new Cajas(mat), KO = new Cajas(new THREE.MeshBasicMaterial({ color: '#100f0e' }), false), B = new Barras(hierro('#2a2420'), false), L = new Luces();
  const KV = new Cajas(hormigon('#332f2a', { mugre: 0.5, pie: py(700), ventanas: { w: 0.24, h: 0.38, enc: 0.17 }, tiempo: ctx.tiempo, amb: 0.12 })), F = { BR: new Barras(mat, true), CONO: new Formas(new THREE.ConeGeometry(0.5, 1, 10), mat), ESF: new Formas(new THREE.SphereGeometry(0.5, 24, 14), mat) }, BL = (...a) => bloque(K, KO, B, L, ...a.slice(0, 5), { densidad: 1.0, ...(a[5] || {}), KV, F });
  const rr = azar(95), SUELO = py(760);
  // lo de la imagen: los dos bloques que une el puente, el bloque bajo, el de la izquierda, el viaducto y la torre
  BL(px(757), px(892), SUELO, py(519) - SUELO, 0, { encendidas: 0.3, sem: 11, planta: 0.9, paso: 0.62, ventana: 0.26 });
  BL(px(1002), px(1102), SUELO, py(509) - SUELO, 0, { encendidas: 0.22, sem: 12, planta: 0.9, paso: 0.6, ventana: 0.24 });
  BL(px(1072), px(1250), SUELO, py(614) - SUELO, 1.2, { encendidas: 0.3, sem: 13, planta: 0.8, paso: 0.55, ventana: 0.22 });
  BL(px(615), px(745), SUELO, py(560) - SUELO, -0.8, { encendidas: 0.25, sem: 14, planta: 0.85, paso: 0.55, ventana: 0.22 });
  g.add(viaducto(px(892), px(1002), py(549), 0.25, 0, mat, B, { luz: px(1002) - px(892) - 0.2, flecha: 0.55, alto: 6 }));
  const torres = [{ x: px(1157), puntas: torreAltaTension(B, px(1157), py(640), py(159) - py(640), 1.05, 0.4, { grueso: 0.07, sem: 15 }) }];
  // y siguiendo: la ciudad del medio con sus hitos, y una torre de alta tension cada 15-20 u con su tendido
  // los hitos (x de su izquierda, ancho que ocupan): entre uno y otro, bloques
  const hitos = [[22, 5.5, 'gasometro'], [40, 3, 'agua'], [52, 21, 'tren'], [78, 10, 'nave'], [94, 5.5, 'gasometro']];
  for (const [hx, , tipo] of hitos) {
    if (hx > b) continue;
    if (tipo === 'gasometro') g.add(gasometro(K, B, hx + 2.6, SUELO, 2.2, 4.4, -0.6, mat));
    else if (tipo === 'agua') g.add(depositoAgua(K, B, hx + 1.4, SUELO, 6.5, 0.3, mat));
    else if (tipo === 'tren') g.add(viaductoTren(hx, hx + 20, SUELO + 3.2, 3.6, 0.6, mat, B));
    else if (tipo === 'nave') g.add(naveDientes(K, hx, hx + 9, SUELO, 2.6, -0.4, mat));
  }
  let xt = px(1157) + 15;
  for (let x = Math.max(a, 7.5); x < b;) {
    const hito = hitos.find(([hx, hw, tipo]) => x > hx - 0.6 && x < hx + hw && tipo !== 'tren');
    if (hito) { x = hito[0] + hito[1] + 0.4; continue; }
    const w = 1.2 + rr() * 2.6, h = 1.6 + rr() * 3.2;
    BL(x, x + w, SUELO, h, (rr() - 0.5) * 1.6, { encendidas: 0.2 + rr() * 0.15, sem: Math.round(x * 13), planta: 0.85, paso: 0.58, ventana: 0.24 });
    // un viaducto de arco entre este y el siguiente, a veces
    if (rr() < 0.18) { const v = 1.8 + rr() * 1.4, y = SUELO + h * (0.45 + rr() * 0.3); g.add(viaducto(x + w, x + w + v, y, 0.22, 0, mat, B, { luz: v - 0.2, flecha: 0.45, alto: y - SUELO + 0.5 })); x += w + v; continue; }
    x += w + 0.2 + rr() * 1.4;
  }
  for (; xt < b; xt += 15 + rr() * 6) torres.push({ x: xt, puntas: torreAltaTension(B, xt, SUELO + 0.5, 6.2 + rr() * 1.4, 0.95, 0.4, { grueso: 0.065, sem: Math.round(xt) }) });
  // depositos, cisternas y andamios entre medias
  for (let x = 14 + rr() * 6; x < b; x += 11 + rr() * 12) { const q = rr(); if (q < 0.4) esfera(F, B, x, SUELO, 0.9 + rr() * 0.5, 0.9); else if (q < 0.7) cisterna(F, K, x, SUELO, 2.6 + rr() * 1.6, 0.42 + rr() * 0.2, 1.2); else andamio(K, B, x, x + 2.7 + rr() * 2, SUELO, 2.2 + rr() * 2, 1.5, rr); }
  g.add(K.malla(), KV.malla(), KO.malla(), B.malla(), L.malla(ctx.tiempo), F.BR.malla(), F.CONO.malla(), F.ESF.malla());
  // el tendido: de cada torre a la siguiente, cruceta con cruceta; la primera tambien hacia la izquierda (la imagen)
  for (const p of torres[0].puntas) if (p[0] < torres[0].x) ctx.cables.push({ g, c: cable(p, [px(560), p[1] - 1.2 - rr() * 0.8, 0.4], 0.6 + rr() * 0.5) });
  for (let k = 0; k < torres.length - 1; k++) {
    const A = torres[k].puntas.filter((q) => q[0] > torres[k].x), Bp = torres[k + 1].puntas.filter((q) => q[0] < torres[k + 1].x);
    for (let q = 0; q < Math.min(A.length, Bp.length); q++) ctx.cables.push({ g, c: cable(A[q], Bp[q], 0.9 + rr() * 0.5, 32) });
  }
  const br = bruma(b - a + 20, 3.5, '#85776a', 0.26, ctx.tiempo, 0.02, 11); br.position.set((a + b) / 2, py(800), 3); g.add(br);
}
