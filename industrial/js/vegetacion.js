// LA VEGETACION SECA y la malla de las vallas: se dibujan por codigo en un lienzo (ramas que se bifurcan, hojas
// secas, enredaderas que cuelgan) y van en planos que miran a la camara, como todo lo que en la imagen es plano
// contra el contraluz. El canto que mira al sol (arriba a la derecha) lleva un hilo calido.
import * as THREE from 'three';
import { azar } from './base.js';

const PX = 160;            // px de lienzo por unidad

function plano(cv, w, h, o = {}) {
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.04, depthWrite: o.depthWrite ?? true, side: THREE.DoubleSide, fog: o.fog ?? true, color: o.color ?? '#ffffff' });
  const geo = new THREE.PlaneGeometry(w, h);
  if (o.ancla === 'abajo') geo.translate(0, h / 2, 0); else if (o.ancla === 'arriba') geo.translate(0, -h / 2, 0);
  const m = new THREE.Mesh(geo, mat); m.renderOrder = o.orden ?? 1;
  return m;
}
const lienzo = (w, h) => { const cv = document.createElement('canvas'); cv.width = Math.ceil(w * PX); cv.height = Math.ceil(h * PX); const c = cv.getContext('2d'); c.lineCap = 'round'; c.lineJoin = 'round'; return { cv, c }; };

// una rama y sus hijas (en px del lienzo); hojas en las puntas
function rama(c, x, y, ang, largo, grueso, prof, rr, o) {
  const pasos = 6; let px = x, py = y, a = ang;
  const pts = [[px, py]];
  for (let k = 0; k < pasos; k++) { a += (rr() - 0.5) * 0.35 + (o.cae || 0) * 0.04; px += Math.cos(a) * largo / pasos; py += Math.sin(a) * largo / pasos; pts.push([px, py]); }
  c.strokeStyle = o.tallo; c.lineWidth = grueso; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts) c.lineTo(p[0], p[1]); c.stroke();
  if (o.canto) { c.strokeStyle = o.canto; c.lineWidth = Math.max(1, grueso * 0.3); c.beginPath(); c.moveTo(pts[0][0] + grueso * 0.3, pts[0][1] - grueso * 0.2); for (const p of pts) c.lineTo(p[0] + grueso * 0.3, p[1] - grueso * 0.2); c.stroke(); }
  if (prof > 0) {
    const n = 1 + Math.floor(rr() * 2.4);
    for (let k = 0; k < n; k++) { const i = 2 + Math.floor(rr() * (pasos - 2)), [hx, hy] = pts[i]; rama(c, hx, hy, a + (rr() < 0.5 ? -1 : 1) * (0.4 + rr() * 0.6), largo * (0.5 + rr() * 0.25), grueso * 0.62, prof - 1, rr, o); }
  }
  if (prof <= 1 && o.hojas) for (let k = 0; k < o.hojas; k++) {
    const t = 0.3 + rr() * 0.7, i = Math.floor(t * pasos), [hx, hy] = pts[i];
    hoja(c, hx + (rr() - 0.5) * 8, hy + (rr() - 0.5) * 8, (o.tamHoja || 7) * (0.6 + rr() * 0.7), rr() * 6.28, rr, o);
  }
}
function hoja(c, x, y, s, a, rr, o) {
  c.save(); c.translate(x, y); c.rotate(a);
  const z = rr(); c.fillStyle = z < 0.6 ? o.hoja : z < 0.85 ? o.hoja2 : o.hojaSeca;
  c.beginPath(); c.ellipse(0, 0, s, s * 0.45, 0, 0, 7); c.fill();
  if (o.canto && rr() < 0.5) { c.fillStyle = o.canto; c.beginPath(); c.ellipse(s * 0.2, -s * 0.2, s * 0.5, s * 0.18, 0, 0, 7); c.fill(); }
  c.restore();
}
const SECO = { tallo: '#14110d', canto: 'rgba(214,170,110,.55)', hoja: '#1e1b12', hoja2: '#2b2616', hojaSeca: '#5a4a28', hojas: 7, tamHoja: 7 };

// ARBUSTO seco: matas que salen del suelo (ancla abajo)
export function arbusto(w, h, sem, o = {}) {
  const { cv, c } = lienzo(w, h), rr = azar(sem), O = { ...SECO, ...o };
  const n = Math.round(4 + w * 4);
  for (let k = 0; k < n; k++) {
    const x = cv.width * (0.2 + rr() * 0.6), ang = -Math.PI / 2 + (rr() - 0.5) * 1.5;
    rama(c, x, cv.height, ang, cv.height * (0.45 + rr() * 0.5), 3 + rr() * 3, 2, rr, O);
  }
  return plano(cv, w, h, { ancla: 'abajo', ...o });
}
// ENREDADERA que cuelga de un borde (ancla arriba): hebras que caen con hojas secas, alguna que se enrosca
export function enredadera(w, h, sem, o = {}) {
  const { cv, c } = lienzo(w, h), rr = azar(sem), O = { ...SECO, hojas: 0, ...o };
  const n = Math.round(3 + w * 3);
  for (let k = 0; k < n; k++) {
    let x = rr() * cv.width, y = 0; const largo = cv.height * (0.35 + rr() * 0.65), pasos = 18;
    c.strokeStyle = O.tallo; c.lineWidth = 2 + rr() * 2; c.beginPath(); c.moveTo(x, y);
    const pts = [];
    for (let q = 0; q < pasos; q++) { x += Math.sin(q * 0.7 + k) * 4 + (rr() - 0.5) * 3; y += largo / pasos; c.lineTo(x, y); pts.push([x, y]); }
    c.stroke();
    for (const [px, py] of pts) if (rr() < 0.65) hoja(c, px + (rr() - 0.5) * 10, py, 6 + rr() * 6, rr() * 6.28, rr, { ...O, hojaSeca: '#6a5730' });
  }
  return plano(cv, w, h, { ancla: 'arriba', ...o });
}
// RAMAS muertas que entran desde una esquina (para el primer plano o el borde de un edificio)
export function ramas(w, h, sem, o = {}) {
  const { cv, c } = lienzo(w, h), rr = azar(sem), O = { ...SECO, hojas: 2, ...o };
  const x0 = o.desde === 'derecha' ? cv.width : 0, ang0 = o.desde === 'derecha' ? Math.PI * 0.85 : 0.15;
  for (let k = 0; k < 3; k++) rama(c, x0, cv.height * (0.05 + k * 0.08), ang0 + (rr() - 0.5) * 0.5, cv.width * (0.6 + rr() * 0.3), 9 - k * 2, 3, rr, { ...O, cae: 1 });
  return plano(cv, w, h, o);
}
// MALLA de valla (rombos) en su lienzo, transparente; el marco y los postes van aparte como geometria
export function malla(w, h, o = {}) {
  const { cv, c } = lienzo(w, h), paso = 0.11 * PX;
  c.strokeStyle = o.color ?? 'rgba(22,20,18,.95)'; c.lineWidth = o.grueso ?? 1.6;
  for (let x = -cv.height; x < cv.width + cv.height; x += paso) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + cv.height, cv.height); c.stroke(); c.beginPath(); c.moveTo(x, cv.height); c.lineTo(x + cv.height, 0); c.stroke(); }
  // un roto: rombos que faltan
  if (o.roto) { c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.ellipse(cv.width * o.roto[0], cv.height * o.roto[1], cv.width * 0.12, cv.height * 0.2, 0.3, 0, 7); c.fill(); c.globalCompositeOperation = 'source-over'; }
  return plano(cv, w, h, { ancla: 'abajo', ...o });
}
