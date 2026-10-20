// EL TALLER: las piezas con las que se monta la ciudad industrial, todas por codigo y modulares. Nada de cubos
// sueltos: una fachada son antepechos, dinteles y machones (los huecos quedan abiertos y por ellos se ve lo de
// detras), con marcos de ventana de perfil de hierro; las torres son celosias de barras; las tuberias llevan codos.
// Cada pieza escribe en COLECTORES (base.js: una malla instanciada por material) para que toda la ciudad salga en
// pocas llamadas de dibujo.
import * as THREE from 'three';
import { Cajas, Barras, Luces, azar, lerp, PAL } from './base.js';

// ---------------------------------------------------------------- fachadas
// Fachada de x0 a x1, con pisos (alturas de forjado de abajo arriba, en y) y n huecos por planta. Devuelve los
// huecos [{x, y, w, h}] para ponerles marcos, vidrio o luz. o: grueso, antepecho, dintel, machonExtremo, huecos
// (numero o lista por planta), salta (prob. de que un hueco no exista: muro ciego), roto (prob. de hueco sin dintel)
export function fachada(K, x0, x1, pisos, z, o = {}) {
  const rr = azar(o.sem ?? 7), g = o.grueso ?? 0.28, ap = o.antepecho ?? 0.75, di = o.dintel ?? 0.45, me = o.machonExtremo ?? 0.38;
  const huecos = [];
  for (let p = 0; p < pisos.length - 1; p++) {
    const yb = pisos[p], yt = pisos[p + 1], hh = yt - yb;
    const n = Array.isArray(o.huecos) ? o.huecos[p] : o.huecos ?? Math.max(1, Math.round((x1 - x0) / 2.1));
    if (n === 0) { K.add((x0 + x1) / 2, (yb + yt) / 2, z, x1 - x0, hh, g); continue; }
    const W = x1 - x0 - me * 2, ww = (W / n) * (o.ancho ?? 0.64), mach = (W - ww * n) / Math.max(1, n - 1);
    // machones de los extremos
    K.add(x0 + me / 2, (yb + yt) / 2, z, me, hh, g); K.add(x1 - me / 2, (yb + yt) / 2, z, me, hh, g);
    for (let k = 0; k < n; k++) {
      const hx = x0 + me + k * (ww + mach);
      const ciego = rr() < (o.salta ?? 0);
      if (ciego) { K.add(hx + ww / 2, (yb + yt) / 2, z, ww, hh, g); }
      else {
        const sinDintel = rr() < (o.roto ?? 0);
        K.add(hx + ww / 2, yb + ap / 2, z, ww, ap, g);                                   // antepecho
        if (!sinDintel) K.add(hx + ww / 2, yt - di / 2, z, ww, di, g);                  // dintel
        huecos.push({ x: hx, y: yb + ap, w: ww, h: hh - ap - (sinDintel ? 0 : di), piso: p });
      }
      if (k < n - 1) K.add(hx + ww + mach / 2, (yb + yt) / 2, z, mach, hh, g);          // machon
    }
  }
  return huecos;
}
// el marco de una ventana: perfil de hierro alrededor, montantes y un travesano; a veces con un pano de vidrio sucio
export function marco(K, h, z, o = {}) {
  const t = o.perfil ?? 0.05, rr = azar(o.sem ?? Math.round(h.x * 100 + h.y * 7));
  K.add(h.x + h.w / 2, h.y + t / 2, z, h.w, t, 0.06); K.add(h.x + h.w / 2, h.y + h.h - t / 2, z, h.w, t, 0.06);
  K.add(h.x + t / 2, h.y + h.h / 2, z, t, h.h, 0.06); K.add(h.x + h.w - t / 2, h.y + h.h / 2, z, t, h.h, 0.06);
  const nm = o.montantes ?? (h.w > 1.1 ? 2 : 1);
  for (let k = 1; k <= nm; k++) K.add(h.x + (h.w * k) / (nm + 1), h.y + h.h / 2, z, t * 0.8, h.h, 0.05);
  const ty = h.y + h.h * (o.travesano ?? 0.62); K.add(h.x + h.w / 2, ty, z, h.w, t * 0.8, 0.05);
  // un montante torcido o que falta: la ventana rota
  if (rr() < (o.torcido ?? 0.25)) K.add(h.x + h.w * 0.5, h.y + h.h * 0.3, z + 0.02, t * 0.8, h.h * 0.55, 0.05, 0.35 * (rr() - 0.5));
}
// barandilla de tubo: postes, pasamanos y una barra intermedia; algun poste doblado
export function barandilla(B, x0, x1, y, z, o = {}) {
  const h = o.alto ?? 1.0, paso = o.paso ?? 0.55, rr = azar(o.sem ?? Math.round(x0 * 31)), g = o.grueso ?? 0.045;
  for (let x = x0; x <= x1 + 1e-3; x += paso) { const dob = rr() < (o.doblados ?? 0.08) ? (rr() - 0.5) * 0.4 : 0; B.add([x, y, z], [x + dob, y + h, z], g); }
  B.add([x0, y + h, z], [x1, y + h + (rr() - 0.5) * 0.04, z], g * 1.2);
  B.add([x0, y + h * 0.5, z], [x1, y + h * 0.5, z], g * 0.8);
  if (o.balaustres) for (let x = x0 + paso / 4; x < x1; x += paso / 4) B.add([x, y, z], [x, y + h * 0.5, z], g * 0.5);
}
// escalera de gato: dos largueros y peldanos; con aros de jaula arriba si o.jaula
export function escalera(B, x, y0, y1, z, o = {}) {
  const w = o.ancho ?? 0.42, g = 0.04;
  B.add([x - w / 2, y0, z], [x - w / 2, y1, z], g); B.add([x + w / 2, y0, z], [x + w / 2, y1, z], g);
  for (let y = y0 + 0.2; y < y1; y += 0.3) B.add([x - w / 2, y, z], [x + w / 2, y, z], g * 0.8);
  if (o.jaula) for (let y = y0 + 2.2; y < y1; y += 0.9) { B.add([x - w / 2, y, z], [x - w / 2, y, z + 0.5], g * 0.7); B.add([x + w / 2, y, z], [x + w / 2, y, z + 0.5], g * 0.7); B.add([x - w / 2, y, z + 0.5], [x + w / 2, y, z + 0.5], g * 0.7); }
}
// tuberia por una polilinea con codos redondos (radio de codo rc)
export function tuberia(pts, r, mat, o = {}) {
  const P = pts.map((p) => new THREE.Vector3(...p)), cam = new THREE.CurvePath(), rc = o.codo ?? r * 2.6;
  let a = P[0].clone();
  for (let k = 1; k < P.length; k++) {
    const b = P[k];
    if (k < P.length - 1) {
      const c = P[k + 1], ab = b.clone().sub(a), bc = c.clone().sub(b), l1 = ab.length(), l2 = bc.length(), e = Math.min(rc, l1 / 2, l2 / 2);
      const p1 = b.clone().sub(ab.normalize().multiplyScalar(e)), p2 = b.clone().add(bc.normalize().multiplyScalar(e));
      cam.add(new THREE.LineCurve3(a, p1)); cam.add(new THREE.QuadraticBezierCurve3(p1, b.clone(), p2)); a = p2;
    } else cam.add(new THREE.LineCurve3(a, b.clone()));
  }
  const m = new THREE.Mesh(new THREE.TubeGeometry(cam, Math.max(8, P.length * 12), r, 8, false), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
// bridas a lo largo de una recta (anillos un poco mas gruesos)
export function bridas(K, a, b, r, n) { for (let k = 1; k < n; k++) { const t = k / n; K.add(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), r * 2.6, r * 2.6 * (Math.abs(a[1] - b[1]) > Math.abs(a[0] - b[0]) ? 0.12 : 1), r * 2.6); } }

// ---------------------------------------------------------------- celosias
// tramo de celosia entre dos cordones: barras en zigzag (Warren) y montantes; a..b el cordon de abajo, alto h
export function celosia(B, a, b, h, g, o = {}) {
  const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / (o.paso ?? h)));
  const P = (t, s) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t) + s * h, lerp(a[2], b[2], t)];
  B.add(P(0, 0), P(1, 0), g * 1.3); B.add(P(0, 1), P(1, 1), g * 1.3);
  for (let k = 0; k < n; k++) { B.add(P(k / n, 0), P((k + 0.5) / n, 1), g); B.add(P((k + 0.5) / n, 1), P((k + 1) / n, 0), g); if (o.montantes) B.add(P(k / n, 0), P(k / n, 1), g * 0.8); }
}
// TORRE DE ALTA TENSION: dos patas que se cierran al subir con cruces de San Andres por tramos, tres pares de
// crucetas (la de en medio mas ancha) y un pico. Devuelve las puntas de las crucetas (para colgar los cables).
export function torreAltaTension(B, x, y0, alto, ancho, z, o = {}) {
  const g = o.grueso ?? 0.07, rr = azar(o.sem ?? 3);
  const semi = (t) => lerp(ancho / 2, ancho * 0.09, Math.pow(t, 0.75));
  const P = (t, s) => [x + s * semi(t), y0 + alto * t, z];
  B.add(P(0, -1), P(1, -1), g * 1.6); B.add(P(0, 1), P(1, 1), g * 1.6);
  let t = 0; const tramos = 11;
  for (let k = 0; k < tramos; k++) {
    const t1 = (k + 1) / tramos;
    B.add(P(t1, -1), P(t1, 1), g * 0.9);
    if (rr() > 0.06) { B.add(P(t, -1), P(t1, 1), g * 0.7); B.add(P(t, 1), P(t1, -1), g * 0.7); }
    t = t1;
  }
  const puntas = [];
  for (const [tc, largo] of [[0.62, 1.0], [0.76, 1.35], [0.9, 0.85]]) {
    const yc = y0 + alto * tc, half = ancho * 0.5 * largo + semi(tc);
    B.add([x - half, yc, z], [x + half, yc, z], g * 1.1);
    B.add([x - half, yc, z], [x - semi(tc), yc + alto * 0.05, z], g * 0.8); B.add([x + half, yc, z], [x + semi(tc), yc + alto * 0.05, z], g * 0.8);
    // aisladores colgando
    for (const s of [-1, 1]) { B.add([x + s * half, yc, z], [x + s * half, yc - 0.35, z], g * 0.6); puntas.push([x + s * half, yc - 0.35, z]); }
  }
  B.add(P(1, 0), [x, y0 + alto * 1.08, z], g);
  return puntas;
}
// CABLE colgado entre dos puntos (catenaria aproximada por una parabola): una linea fina que se mece
export function cable(a, b, comba, n = 24) {
  const pts = []; for (let k = 0; k <= n; k++) { const t = k / n; pts.push(lerp(a[0], b[0], t), lerp(a[1], b[1], t) - comba * 4 * t * (1 - t), lerp(a[2], b[2], t)); }
  return { a, b, comba, n, pts: new Float32Array(pts) };
}

// ---------------------------------------------------------------- volumenes de la ciudad
// TORRE GOTICA INDUSTRIAL (la de la izquierda del centro): fuste de celosia por cuerpos que se estrechan, cada
// uno con su plataforma (losa con barandilla), un cuerpo cerrado arriba y la aguja con su remate.
export function torreGotica(K, B, x, y0, alto, ancho, z, o = {}) {
  const rr = azar(o.sem ?? 11), cuerpos = o.cuerpos ?? 4;
  let y = y0, w = ancho;
  for (let k = 0; k < cuerpos; k++) {
    const h = (alto * 0.62) / cuerpos * (k === 0 ? 1.3 : 1 - k * 0.07);
    // cuatro montantes y cruces
    for (const s of [-1, 1]) B.add([x + s * w / 2, y, z], [x + s * w * 0.46, y + h, z], 0.12);
    for (let q = 0; q < 3; q++) { const ya = y + (h * q) / 3, yb = y + (h * (q + 1)) / 3; B.add([x - w / 2, ya, z], [x + w / 2, yb, z], 0.06); B.add([x + w / 2, ya, z], [x - w / 2, yb, z], 0.06); }
    // la plataforma de arriba del cuerpo: losa que vuela y barandilla
    K.add(x, y + h, z, w * 1.35, 0.22, 1.2);
    barandilla(B, x - w * 0.66, x + w * 0.66, y + h + 0.11, z + 0.3, { alto: 0.7, paso: 0.4, grueso: 0.04, sem: k });
    // a veces un cuarto cerrado en la plataforma
    if (k === cuerpos - 1 || rr() < 0.4) K.add(x, y + h + 0.6, z - 0.2, w * 0.7, 1.0, 0.8);
    y += h; w *= 0.78;
  }
  // el cuerpo de arriba y la aguja
  K.add(x, y + 0.9, z, w * 0.9, 1.8, 0.9);
  const ah = alto - (y - y0) - 1.8;
  const aguja = new THREE.Mesh(new THREE.ConeGeometry(w * 0.45, ah, 6, 1), K.mat); aguja.position.set(x, y + 1.8 + ah / 2, z); aguja.castShadow = true;
  B.add([x, y + 1.8 + ah, z], [x, y + 1.8 + ah + 1.2, z], 0.05);
  return aguja;
}
// CHIMENEA: fuste algo conico con anillos, la boca con su labio y escalerilla; devuelve la boca (para el humo)
export function chimenea(B, x, y0, alto, r, z, mat, o = {}) {
  const grupo = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.82, r, alto, 18, 1, true), mat); m.position.set(x, y0 + alto / 2, z); grupo.add(m);
  for (let y = y0 + alto * 0.12; y < y0 + alto - 0.5; y += alto / (o.anillos ?? 7)) {
    const rr2 = lerp(r, r * 0.82, (y - y0) / alto), a = new THREE.Mesh(new THREE.CylinderGeometry(rr2 * 1.06, rr2 * 1.06, 0.28, 18), mat);
    a.position.set(x, y, z); grupo.add(a);
  }
  const labio = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.95, r * 0.88, 0.6, 18), mat); labio.position.set(x, y0 + alto, z); grupo.add(labio);
  if (o.escalera !== false) escalera(B, x + r * 0.85, y0, y0 + alto, z + r * 0.3, { ancho: 0.3 });
  grupo.traverse((q) => { if (q.isMesh) q.castShadow = true; });
  return { grupo, boca: [x, y0 + alto + 0.3, z] };
}
// CUPULA sobre tambor, con costillas, la linterna y su aguja
export function cupula(K, B, x, y0, r, z, mat) {
  const grupo = new THREE.Group();
  const tambor = new THREE.Mesh(new THREE.CylinderGeometry(r, r, r * 0.5, 32, 1, true), mat); tambor.position.set(x, y0 + r * 0.25, z);
  const domo = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat); domo.position.set(x, y0 + r * 0.5, z);
  grupo.add(tambor, domo);
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k / 9) * Math.PI; const pts = []; for (let q = 0; q <= 10; q++) { const t = (q / 10) * Math.PI / 2; pts.push([x + Math.sin(a) * Math.cos(t) * r * 1.01, y0 + r * 0.5 + Math.sin(t) * r * 1.01, z + Math.cos(a) * Math.cos(t) * r * 1.01]); } for (let q = 0; q < 10; q++) B.add(pts[q], pts[q + 1], r * 0.025); }
  K.add(x, y0 + r * 1.5 + 0.4, z, r * 0.3, 0.8, r * 0.3); K.add(x, y0 + r * 1.5 + 0.85, z, r * 0.36, 0.1, r * 0.36);
  B.add([x, y0 + r * 1.5 + 0.9, z], [x, y0 + r * 1.5 + 2.2, z], 0.06);
  K.add(x, y0 + r * 0.5 + 0.08, z, r * 2.15, 0.16, r * 0.4);
  return grupo;
}
// GRUA PORTICO (la de arriba del centro): pila con su cabina redonda, la pluma de celosia y el tirante
export function grua(K, B, x, y0, alto, izq, der, z, mat) {
  const grupo = new THREE.Group();
  const fuste = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, alto, 16, 1, true), mat); fuste.position.set(x, y0 + alto / 2, z); grupo.add(fuste);
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.44, 1.1, 16), mat); cab.position.set(x, y0 + alto + 0.4, z); grupo.add(cab);
  const cupo = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat); cupo.position.set(x, y0 + alto + 0.95, z); grupo.add(cupo);
  celosia(B, [x - izq, y0 + alto + 1.2, z], [x + der, y0 + alto + 1.2, z], 0.7, 0.07, { paso: 0.9, montantes: true });
  B.add([x, y0 + alto + 3.5, z], [x - izq * 0.7, y0 + alto + 1.9, z], 0.05); B.add([x, y0 + alto + 3.5, z], [x + der * 0.7, y0 + alto + 1.9, z], 0.05);
  B.add([x, y0 + alto + 1.2, z], [x, y0 + alto + 3.5, z], 0.12);
  return grupo;
}
// BLOQUE INDUSTRIAL (plano medio y fondo): cuerpo con su reticula de ventanas (oscuras, algunas encendidas en
// calido y alguna que parpadea), azotea con trastos (deposito sobre patas, antenas, casetas), remate roto y
// voladizos. K: cuerpo, KO: lo oscuro (huecos), B: barras, L: luces. Devuelve la altura de su azotea.
export function bloque(K, KO, B, L, x0, x1, y0, alto, z, o = {}) {
  const rr = azar(o.sem ?? Math.round(x0 * 13 + alto)), w = x1 - x0, d = o.fondo ?? 2.5;
  // con o.KV el cuerpo lleva las ventanas en el sombreador (base.js, sucio con ventanas): ni cajas ni luces sueltas
  (o.KV || K).base((x0 + x1) / 2, y0, z, w, alto, d);
  // remate roto: un mordisco en una esquina (un trozo del remate que sobresale, a escalones)
  if (rr() < 0.6) { const mw = w * (0.15 + rr() * 0.25), mx = rr() < 0.5 ? x0 + mw / 2 : x1 - mw / 2; K.base(mx, y0 + alto, z, mw, 0.3 + rr() * 0.6, d * 0.8); }
  // ventanas por plantas
  const fh = o.planta ?? 1.25, vw = o.ventana ?? 0.42, paso = o.paso ?? 0.95, enc = o.encendidas ?? 0.12;
  if (!o.KV) for (let y = y0 + 0.9; y < y0 + alto - 0.9; y += fh) {
    for (let x = x0 + 0.5; x < x1 - 0.5; x += paso) {
      if (rr() < 0.06) continue;
      if (rr() < enc) L.add(x + vw / 2, y + 0.3, z + d / 2 + 0.03, vw * 0.55, 0.32, rr() < 0.7 ? PAL.calido : '#ffb36b', 1.1 + rr() * 0.8, rr() < 0.15 ? 1 : 0);
      else KO.add(x + vw / 2, y + 0.3, z + d / 2 + 0.01, vw, 0.62, 0.02);
    }
    if (rr() < 0.18) K.add((x0 + x1) / 2, y - 0.08, z + d / 2 + 0.12, w + 0.3, 0.12, 0.25);    // imposta
  }
  const ya = y0 + alto;
  if (o.F) {
    remate(o.KV || K, K, B, o.F, x0, x1, ya, z, d, rr, o.densidad ?? 1);
    // la escalera de incendios por un costado y algun balcon corrido
    if (rr() < 0.35) { const ex = rr() < 0.5 ? x0 - 0.12 : x1 + 0.12; for (let y = y0 + 1.2; y < ya - 0.3; y += 1.1) { K.add(ex, y, z + d / 2 - 0.2, 0.5, 0.06, 0.4); barandilla(B, ex - 0.25, ex + 0.25, y, z + d / 2, { alto: 0.4, paso: 0.25, grueso: 0.025 }); } B.add([ex, y0 + 1.2, z + d / 2], [ex, ya - 0.3, z + d / 2], 0.03); }
    if (rr() < 0.35) { const by = y0 + fh * (1 + Math.floor(rr() * 3)); K.add((x0 + x1) / 2, by, z + d / 2 + 0.3, w * 0.8, 0.1, 0.6); barandilla(B, x0 + w * 0.1, x1 - w * 0.1, by + 0.05, z + d / 2 + 0.55, { alto: 0.45, paso: 0.3, grueso: 0.025 }); }
    return ya;
  }
  // azotea: deposito sobre patas, casetas, antenas, barandilla
  if (rr() < 0.55) { const dx = x0 + w * (0.2 + rr() * 0.6), dh = 0.9 + rr() * 0.6; for (const s of [-1, 1]) B.add([dx + s * 0.45, ya, z], [dx + s * 0.4, ya + dh, z], 0.07); K.add(dx, ya + dh + 0.45, z, 1.2, 0.9, 1.0); }
  for (let k = 0; k < 1 + Math.floor(rr() * 3); k++) K.base(x0 + w * rr(), ya, z, 0.5 + rr() * 1.2, 0.4 + rr() * 0.8, 1.0);
  for (let k = 0; k < Math.floor(rr() * 4); k++) { const ax = x0 + w * rr(); B.add([ax, ya, z], [ax, ya + 0.8 + rr() * 2.2, z], 0.04); }
  if (rr() < 0.5) barandilla(B, x0 + 0.1, x1 - 0.1, ya, z + d / 2 - 0.1, { alto: 0.6, paso: 0.5, grueso: 0.035, sem: Math.round(x0) });
  // voladizo o balcon corrido
  if (rr() < 0.4) { const by = y0 + fh * (1 + Math.floor(rr() * 3)); K.add((x0 + x1) / 2, by, z + d / 2 + 0.35, w * 0.8, 0.12, 0.7); barandilla(B, x0 + w * 0.1, x1 - w * 0.1, by + 0.06, z + d / 2 + 0.65, { alto: 0.55, paso: 0.4, grueso: 0.03 }); }
  return ya;
}
// REMATE de un bloque (lo que hace que la silueta contra el cielo no sea una caja, como en la imagen): cuerpos
// retranqueados a escalones (que llevan su propio remate, mas pequeno), depositos de agua sobre patas con su
// tejadillo, torretas de celosia, antenas con travesanos, chimeneas cortas, carteles sobre su estructura, casetas,
// conductos y la barandilla del borde. KV: el cuerpo con ventanas; F: { BR barras redondas, CONO } (colectores).
export function remate(KV, K, B, F, x0, x1, ya, z, d, rr, dens = 1) {
  const w = x1 - x0;
  // cuerpos a escalones
  if (w > 1.2 && rr() < 0.6 * dens) {
    const w2 = w * (0.3 + rr() * 0.4), x2 = x0 + rr() * (w - w2), h2 = 0.5 + rr() * 1.5;
    KV.base(x2 + w2 / 2, ya, z - 0.15, w2, h2, d * 0.8);
    remate(KV, K, B, F, x2, x2 + w2, ya + h2, z - 0.15, d * 0.8, rr, dens * 0.55);
  }
  // cornisa
  if (rr() < 0.5) K.add((x0 + x1) / 2, ya - 0.05, z + d / 2 + 0.06, w + 0.18, 0.12, 0.2);
  const n = Math.max(1, Math.round(w * 1.4 * dens));
  for (let k = 0; k < n; k++) {
    const x = x0 + 0.2 + rr() * Math.max(0.1, w - 0.4), q = rr();
    if (q < 0.16) {
      // deposito de agua sobre patas, con su tejadillo conico y la escalerilla
      const r = 0.22 + rr() * 0.22, hp = 0.5 + rr() * 0.8, ht = r * (1.6 + rr() * 0.6);
      for (const s of [-1, -0.3, 0.3, 1]) B.add([x + s * r, ya, z], [x + s * r * 0.85, ya + hp, z], 0.035);
      B.add([x - r, ya + hp * 0.5, z], [x + r, ya + hp * 0.5, z], 0.025);
      F.BR.add([x, ya + hp, z], [x, ya + hp + ht, z], r * 2);
      F.CONO.add(x, ya + hp + ht + r * 0.35, z, r * 2.2, r * 0.7, r * 2.2);
    } else if (q < 0.3) {
      // torreta de celosia (las que sostienen antenas y focos)
      const h = 0.8 + rr() * 1.8, a = 0.18 + rr() * 0.12;
      B.add([x - a, ya, z], [x - a * 0.4, ya + h, z], 0.03); B.add([x + a, ya, z], [x + a * 0.4, ya + h, z], 0.03);
      for (let y = 0; y < h - 0.1; y += 0.3) { const t0 = y / h, t1 = Math.min(1, (y + 0.3) / h), A0 = a * (1 - t0 * 0.6), A1 = a * (1 - t1 * 0.6); B.add([x - A0, ya + y, z], [x + A1, ya + y + 0.3, z], 0.015); B.add([x + A0, ya + y, z], [x - A1, ya + y + 0.3, z], 0.015); }
      B.add([x, ya + h, z], [x, ya + h + 0.6, z], 0.02);
    } else if (q < 0.48) {
      // antena con travesanos
      const h = 0.7 + rr() * 2.0; B.add([x, ya, z], [x, ya + h, z], 0.028);
      for (let t = 0; t < 1 + Math.floor(rr() * 3); t++) { const yy = ya + h * (0.5 + t * 0.18), l = 0.15 + rr() * 0.25; B.add([x - l, yy, z], [x + l, yy, z], 0.018); }
    } else if (q < 0.6) {
      // chimenea corta con su sombrerete
      const r = 0.06 + rr() * 0.07, h = 0.4 + rr() * 0.9; F.BR.add([x, ya, z], [x, ya + h, z], r * 2); K.add(x, ya + h + 0.03, z, r * 3, 0.06, r * 3);
    } else if (q < 0.7 && w > 1.5) {
      // cartel sobre su estructura
      const cw = 0.6 + rr() * 0.9, ch = 0.3 + rr() * 0.3, h = 0.3 + rr() * 0.4;
      for (const s of [-0.4, 0.4]) B.add([x + s * cw, ya, z + 0.3], [x + s * cw, ya + h, z + 0.3], 0.025);
      B.add([x - cw * 0.45, ya + h * 0.5, z + 0.3], [x + cw * 0.45, ya + h * 0.5, z + 0.3], 0.015);
      K.add(x, ya + h + ch / 2, z + 0.3, cw, ch, 0.05);
    } else if (q < 0.86) {
      // caseta o maquina
      K.base(x, ya, z - 0.1, 0.3 + rr() * 0.7, 0.25 + rr() * 0.55, d * 0.4);
    } else {
      // conducto que corre por la azotea y baja por el borde
      const l = 0.5 + rr() * 1.2; K.add(Math.min(x + l / 2, x1 - l / 2), ya + 0.14, z + 0.2, l, 0.14, 0.16);
    }
  }
  if (rr() < 0.45) barandilla(B, x0 + 0.05, x1 - 0.05, ya, z + d / 2 - 0.08, { alto: 0.35, paso: 0.22, grueso: 0.02, sem: Math.round(x0 * 7) });
}
// ANDAMIO delante de una fachada: montantes, largueros por plantas, cruces y alguna plataforma
export function andamio(K, B, x0, x1, y0, alto, z, rr) {
  const paso = 0.9, piso = 1.1;
  for (let x = x0; x <= x1 + 1e-3; x += paso) B.add([x, y0, z], [x, y0 + alto, z], 0.03);
  for (let y = y0 + piso; y <= y0 + alto + 1e-3; y += piso) { B.add([x0, y, z], [x1, y, z], 0.025); if (rr() < 0.6) K.add((x0 + x1) / 2, y, z + 0.1, x1 - x0, 0.04, 0.3); }
  for (let x = x0; x < x1 - 0.1; x += paso) for (let y = y0; y < y0 + alto - 0.1; y += piso) if (rr() < 0.45) B.add([x, y, z], [x + paso, y + piso, z], 0.015);
}
// VIADUCTO de arco entre dos bloques: el tablero, el muro con el arco de medio punto (hueco de verdad) y el peto
// MURO CON ARCOS hasta abajo: un solo contorno que sube y baja por cada arco (un hueco que corta el borde no se
// triangula y el arco salia macizo). arcos: [[izquierda, derecha, y de arranque del medio punto]]
export function muroArcos(x0, x1, yTop, yBase, arcos) {
  const s = new THREE.Shape(); s.moveTo(x0, yBase);
  for (const [a, b, yr] of arcos.slice().sort((p, q) => p[0] - q[0])) { s.lineTo(a, yBase); s.lineTo(a, yr); s.absarc((a + b) / 2, yr, (b - a) / 2, Math.PI, 0, true); s.lineTo(b, yBase); }
  s.lineTo(x1, yBase); s.lineTo(x1, yTop); s.lineTo(x0, yTop); s.closePath();
  return s;
}
export function viaducto(x0, x1, y, grosor, z, mat, B, o = {}) {
  const w = x1 - x0, luz = o.luz ?? w * 0.62, flecha = o.flecha ?? luz * 0.5, cx = (x0 + x1) / 2;
  const s = muroArcos(x0, x1, y, y - (o.alto ?? 6), [[cx - luz / 2, cx + luz / 2, y - grosor - flecha]]);
  const geo = new THREE.ExtrudeGeometry(s, { depth: o.fondo ?? 1.6, bevelEnabled: false, curveSegments: 24 });
  geo.translate(0, 0, z - (o.fondo ?? 1.6) / 2);
  const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true;
  barandilla(B, x0, x1, y, z + (o.fondo ?? 1.6) / 2 - 0.1, { alto: 0.8, paso: 0.45, grueso: 0.04, balaustres: true });
  return m;
}
// bloque con un HUECO CIRCULAR (la ventana redonda): un muro con el agujero, y el anillo del marco con su fondo
export function muroConCirculo(x0, x1, y0, y1, cx, cy, r, z, fondo, mat) {
  const s = new THREE.Shape(); s.moveTo(x0, y0); s.lineTo(x1, y0); s.lineTo(x1, y1); s.lineTo(x0, y1); s.closePath();
  const h = new THREE.Path(); h.absarc(cx, cy, r, 0, Math.PI * 2, true); s.holes.push(h);
  const geo = new THREE.ExtrudeGeometry(s, { depth: fondo, bevelEnabled: false, curveSegments: 48 }); geo.translate(0, 0, z - fondo);
  const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true;
  return m;
}
