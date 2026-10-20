// EL PLANO DE JUEGO, tramo a tramo (nivel.js). Todos escriben en los mismos colectores (ctx.K hormigon, ctx.KF
// hormigon oscuro, ctx.KM hierro, ctx.B barras de hierro, ctx.BR barras redondas, ctx.L luces), asi que el nivel
// entero sale en pocas llamadas de dibujo. Las luces de verdad (farolas, ventanas redondas) se apuntan en
// ctx.focos y main.js enciende solo las que estan cerca de la camara.
import * as THREE from 'three';
import { PAL, azar } from './base.js';
import { fachada, marco, barandilla, escalera, tuberia, celosia, cable, muroConCirculo } from './edificios.js';
import { arbusto, enredadera, ramas, malla } from './vegetacion.js';
import { humo } from './atmosfera.js';
import { px, py } from './fondos.js';

// ---------------------------------------------------------------- piezas sueltas
const SHADER_VUV = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
// un halo que suma luz alrededor de algo encendido
function halo(g, x, y, z, r, color, fuerza) {
  const c = new THREE.Color(color);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uC: { value: c }, uF: { value: fuerza } }, vertexShader: SHADER_VUV,
    fragmentShader: 'uniform vec3 uC; uniform float uF; varying vec2 vUv; void main() { float r = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(uC * uF * pow(max(0.0, 1.0 - r), 2.2), 1.0); }' }));
  m.position.set(x, y, z); g.add(m); return m;
}
// la FAROLA de la imagen: basa, fuste de tubo, cuello curvo, cabeza con su bombilla, la caja del contador
export function farola(g, ctx, x, o = {}) {
  const z = o.z ?? 0.3, alto = o.alto ?? py(380), { KM } = ctx;
  KM.base(x, 0, z, 0.22, 0.65, 0.22); KM.base(x, 0.65, z, 0.14, 0.15, 0.14);
  g.add(tuberia([[x, 0.7, z], [x, alto - 0.2, z], [x + 0.05, alto + 0.18, z], [x + 0.55, alto + 0.18, z]], 0.055, ctx.metal, { codo: 0.3 }));
  KM.add(x + 0.6, alto + 0.12, z, 0.42, 0.14, 0.28); KM.add(x + 0.02, alto * 0.55, z + 0.12, 0.18, 0.3, 0.1);
  const bombilla = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a0').multiplyScalar(4), fog: false }));
  bombilla.position.set(x + 0.6, alto + 0.03, z); g.add(bombilla);
  const foco = { p: new THREE.Vector3(x + 0.6, alto - 0.15, z + 0.3), color: '#ffc27a', intensidad: 9, distancia: 7, fuerza: 1 };
  ctx.focos.push(foco); ctx.luces.push({ p: new THREE.Vector3(x + 0.6, alto - 0.3, z + 0.3), col: new THREE.Color('#ffd09a'), r: 1.6 });
  const sem = Math.abs(Math.round(x * 7.3)) % 97;
  ctx.animar.push((t) => { const corte = (o.parpadea ?? sem % 3 === 0) && Math.sin(t * 13.1 + sem) > 0.993 ? 0.35 : 1; foco.fuerza = corte; bombilla.material.color.setRGB(4 * corte, 3.4 * corte, 2.5 * corte); });
  // el charco de luz en la franja de la calle
  const charco = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.6), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, vertexShader: SHADER_VUV,
    fragmentShader: 'varying vec2 vUv; void main() { vec2 p = (vUv - vec2(0.45, 1.0)) * vec2(1.0, 2.2); float a = exp(-dot(p, p) * 5.0); gl_FragColor = vec4(vec3(1.0, 0.72, 0.42) * a * 0.3, 1.0); }' }));
  charco.position.set(x + 0.9, -0.8, 2.27); g.add(charco);
  halo(g, x + 0.6, alto, z + 0.2, 0.9, '#ffc68a', 0.22);
}
// VALLA de malla con postes y pasamanos
export function valla(g, ctx, a, b, alto, o = {}) {
  const z = o.z ?? 0.5, m = malla(b - a, alto, { roto: o.roto ?? null }); m.position.set((a + b) / 2, 0, z); g.add(m);
  const n = Math.max(1, Math.round((b - a) / 1.1));
  for (let k = 0; k <= n; k++) { const x = a + ((b - a) * k) / n; ctx.B.add([x, 0, z], [x, alto + 0.05, z], 0.06); }
  ctx.B.add([a, alto, z], [b, alto, z], 0.04);
}
export function bolardo(g, ctx, x, z = 0.8) { g.add(tuberia([[x - 0.14, 0, z], [x - 0.14, 0.32, z], [x + 0.14, 0.32, z], [x + 0.14, 0, z]], 0.05, ctx.metal, { codo: 0.12 })); }
export function cajon(ctx, x, w, h, z = 0.6) { ctx.KM.base(x, 0, z, w, h, w * 0.8); ctx.KM.base(x, h, z, w * 1.08, 0.05, w * 0.88); }
function mata(g, x, y, z, w, h, sem) { const m = arbusto(w, h, sem); m.position.set(x, y, z); g.add(m); }
function colgajo(g, x, y, z, w, h, sem) { const m = enredadera(w, h, sem); m.position.set(x, y, z); g.add(m); }

// EDIFICIO DE MARCO (la familia del de la imagen): planta baja con huecos grandes y marcos, pilares delante,
// forjados que vuelan con su barandilla baja, plantas altas abiertas (por los huecos se ve la ciudad: la fachada
// de atras esta mas atras y tiene otros huecos), tuberias, escalera de gato, matas y enredaderas.
export function edificioMarco(g, ctx, x0, x1, o = {}) {
  const rr = azar(o.sem ?? Math.round(x0 * 17)), { K, KF, KM, B } = ctx, zF = o.z ?? -1.2;
  const pb = o.planta ?? 3.4, fh = o.piso ?? 2.7, n = o.pisos ?? 3;
  const huecos = fachada(K, x0, x1, [0, pb], zF, { huecos: Math.max(2, Math.round((x1 - x0) / 1.7)), ancho: 0.6, antepecho: 0.55, dintel: 0.62, sem: rr() * 1e4 });
  for (const h of huecos) marco(KM, h, zF + 0.02, { sem: Math.round(h.x * 10) });
  const pil = []; for (let x = x0 + 0.2; x < x1 - 0.1; x += (x1 - x0 - 0.4) / Math.max(1, Math.round((x1 - x0) / 2.6))) pil.push(x);
  pil.push(x1 - 0.2);
  for (const x of pil) K.base(x, 0, zF + 0.35, 0.34, pb + n * fh, 0.45);
  for (let p = 0; p <= n; p++) {
    const y = pb + p * fh, ultimo = p === n;
    K.add((x0 + x1) / 2, y + 0.17, zF + 0.45, x1 - x0 + 0.4, 0.34, 1.6);
    if (!ultimo || rr() < 0.5) barandilla(B, x0 + 0.15, x1 - 0.15, y + 0.34, zF + 1.1, { alto: 0.42, paso: 0.32, grueso: 0.035, sem: Math.round(x0 + p) });
    if (ultimo) break;
    // la planta: atras, otra fachada con sus huecos (la de delante no existe: se ve a traves)
    const hs = fachada(KF, x0 + 0.3, x1 - 0.3, [y + 0.34, y + fh], zF - 1.0, { huecos: Math.max(2, Math.round((x1 - x0) / 2.1)), ancho: 0.62, antepecho: 0.4, dintel: 0.4, roto: 0.35, salta: 0.15, sem: rr() * 1e4 });
    for (const h of hs) if (rr() < 0.75) marco(KM, h, zF - 0.98, { montantes: 1, travesano: 0.55, torcido: 0.45 });
    if (rr() < 0.45) mata(g, x0 + 0.6 + rr() * (x1 - x0 - 1.2), y + 0.34, zF + 1.0, 0.7 + rr() * 0.4, 0.5 + rr() * 0.3, Math.round(x0 * 3 + p));
    if (rr() < 0.4) colgajo(g, x0 + 0.5 + rr() * (x1 - x0 - 1), y, zF + 0.75, 0.5, 1.2 + rr() * 1.8, Math.round(x0 * 5 + p));
  }
  // pretil de remate roto, tuberias y la escalera
  K.add((x0 + x1) / 2, pb + n * fh + 0.5, zF - 0.4, x1 - x0, 1.0, 1.0);
  g.add(tuberia([[x0 + 0.6, pb + n * fh, zF + 0.75], [x0 + 0.6, 0.4, zF + 0.75]], 0.055, ctx.metal));
  if (rr() < 0.6) { const xe = rr() < 0.5 ? x0 - 0.15 : x1 + 0.15; escalera(B, xe, 0.6, pb + n * fh, zF + 0.3, { ancho: 0.3, jaula: true }); }
  if (o.cartel) { KM.add(x0 + (x1 - x0) * 0.5, pb + 0.9, zF + 0.9, 2.2, 0.7, 0.08); for (const s of [-0.9, 0.9]) B.add([x0 + (x1 - x0) * 0.5 + s, pb + 0.34, zF + 0.9], [x0 + (x1 - x0) * 0.5 + s, pb + 0.55, zF + 0.9], 0.04); }
  return { techo: pb + n * fh };
}
// VENTANA REDONDA (la de la imagen, y la de la puerta del final): muro con el hueco, marco cuadrado, anillos, radios
// y el fuego de dentro que respira; la luz naranja va al grupo de focos
export function ventanaRedonda(g, ctx, cx, cy, R, zV, caja) {
  const { KM, B } = ctx;
  g.add(muroConCirculo(caja[0], caja[1], caja[2], caja[3], cx, cy, R, zV, 1.4, ctx.mat));
  for (const [w, h, x, y] of [[R * 2.5, 0.12, cx, cy + R * 1.2], [R * 2.5, 0.12, cx, cy - R * 1.2], [0.12, R * 2.5, cx - R * 1.2, cy], [0.12, R * 2.5, cx + R * 1.2, cy]]) KM.add(x, y, zV + 0.08, w, h, 0.12);
  const a1 = new THREE.Mesh(new THREE.TorusGeometry(R, 0.075 * R / 0.8, 10, 64), ctx.metal); a1.position.set(cx, cy, zV + 0.06); g.add(a1);
  const a2 = new THREE.Mesh(new THREE.TorusGeometry(R * 0.32, 0.05, 8, 32), ctx.metal); a2.position.set(cx, cy, zV + 0.02); g.add(a2);
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + 0.2; B.add([cx + Math.cos(a) * R * 0.3, cy + Math.sin(a) * R * 0.3, zV], [cx + Math.cos(a) * R * 0.97, cy + Math.sin(a) * R * 0.97, zV], k % 2 ? 0.035 : 0.07); }
  B.add([cx - R, cy, zV + 0.03], [cx + R, cy, zV + 0.03], 0.09 * R / 0.8); B.add([cx, cy - R, zV + 0.03], [cx, cy + R, zV + 0.03], 0.09 * R / 0.8);
  const fuego = new THREE.Mesh(new THREE.CircleGeometry(R * 0.99, 64), new THREE.ShaderMaterial({ uniforms: { uTiempo: ctx.tiempo }, fog: false, vertexShader: SHADER_VUV,
    fragmentShader: `uniform float uTiempo; varying vec2 vUv;
      void main() { float r = length(vUv - 0.5) * 2.0; float t = uTiempo;
        float resp = 0.92 + 0.05 * sin(t * 1.7) + 0.03 * sin(t * 5.3 + 1.0);
        vec3 c = mix(vec3(2.9, 1.65, 0.62), vec3(1.25, 0.42, 0.1), smoothstep(0.05, 1.0, r));
        float aspas = 0.8 + 0.2 * sin(atan(vUv.y - 0.5, vUv.x - 0.5) * 6.0 + t * 0.4);
        gl_FragColor = vec4(c * resp * mix(1.0, aspas, smoothstep(0.3, 0.9, r)), 1.0); }` }));
  fuego.position.set(cx, cy, zV - 0.35); g.add(fuego);
  const foco = { p: new THREE.Vector3(cx, cy - 0.2, zV + 0.9), color: '#ff8838', intensidad: 9, distancia: 5.5, fuerza: 1 };
  ctx.focos.push(foco); ctx.animar.push((t) => { foco.fuerza = 0.92 + 0.05 * Math.sin(t * 1.7) + 0.03 * Math.sin(t * 5.3 + 1); });
  ctx.luces.push({ p: new THREE.Vector3(cx, cy, zV + 0.5), col: new THREE.Color('#ff9a4a'), r: 2.4 * R / 0.8 });
  halo(g, cx, cy, zV + 0.4, R * 3.4, '#ff8030', 0.26);
}

// ================================================================= 0 · LA IMAGEN DE REFERENCIA
export function tramoReferencia(g, ctx) {
  const { K, KF, KM, B, BR } = ctx, X0 = px(50), X1 = px(640), zF = -1.2;
  const huecosPB = fachada(K, X0, X1, [0, py(500)], zF, { huecos: 4, ancho: 0.62, antepecho: 0.55, dintel: 0.62, sem: 3 });
  for (const h of huecosPB) marco(KM, h, zF + 0.02, { sem: Math.round(h.x * 10) });
  for (const [xa, xb] of [[px(245), px(275)], [px(405), px(440)], [px(598), px(628)]]) K.base((xa + xb) / 2, 0, zF + 0.35, xb - xa, py(495), 0.45);
  K.add((X0 + X1) / 2 + 0.1, py(505), zF + 0.45, X1 - X0 + 0.5, 0.34, 1.6);
  barandilla(B, X0 + 0.15, px(440), py(490), zF + 1.1, { alto: 0.42, paso: 0.32, grueso: 0.035, sem: 2 });
  const zP = -1.6, ytP = py(250);
  for (const [xa, xb] of [[px(85), px(120)], [px(245), px(275)], [px(405), px(440)]]) K.base((xa + xb) / 2, py(490), zP + 0.35, xb - xa, ytP - py(490), 0.45);
  const huecos1 = fachada(KF, px(120), px(405), [py(490), ytP], zP - 0.6, { huecos: 3, ancho: 0.7, antepecho: 0.35, dintel: 0.35, machonExtremo: 0.08, roto: 0.3, sem: 5 });
  for (const h of huecos1) marco(KM, h, zP - 0.58, { montantes: 1, travesano: 0.55, torcido: 0.5 });
  K.add((X0 + px(445)) / 2, py(232), zF + 0.35, px(445) - X0 + 0.3, 0.42, 1.8);
  barandilla(B, X0 + 0.15, px(440), py(212), zF + 1.1, { alto: 0.36, paso: 0.3, grueso: 0.035, sem: 4 });
  K.base(px(305), py(212), -2.4, px(430) - px(180), 6, 1.6);
  const huecosT = fachada(KF, px(180), px(430), [py(212), py(212) + 1.4, py(212) + 2.8], -1.58, { huecos: 2, ancho: 0.4, antepecho: 0.3, dintel: 0.3, sem: 9 });
  for (const h of huecosT) marco(KM, h, -1.55, {});
  g.add(tuberia([[px(212), py(212), -1.45], [px(212), py(0) + 1, -1.45]], 0.06, ctx.metal));
  g.add(tuberia([[px(390), py(212), -1.45], [px(390), py(120), -1.45], [px(352), py(90), -1.45], [px(352), py(0) + 1, -1.45]], 0.05, ctx.metal));
  escalera(B, px(232), py(212), py(0) + 1, -1.45, { ancho: 0.32 });
  escalera(B, px(65), py(780), py(160), zF + 0.5, { ancho: 0.3, jaula: true });
  BR.add([px(108), py(212), -1.0], [px(108), py(0) + 2, -1.0], 0.14);
  for (const [a, b, c] of [[[px(108), py(40), -1.0], [px(-120), py(120), -1.0], 0.5], [[px(108), py(75), -1.0], [px(-120), py(170), -1.0], 0.6], [[px(108), py(60), -1.0], [px(300), py(110), -1.0], 0.35]]) ctx.cables.push({ g, c: cable(a, b, c) });
  // el bloque de la ventana redonda
  K.add((px(435) + px(650)) / 2, py(245), -0.8, px(650) - px(435) + 0.2, 0.36, 1.9);
  ventanaRedonda(g, ctx, px(515), py(137), 0.8, -1.0, [px(435), px(645), py(258), py(0) + 1.5]);
  g.add(tuberia([[px(470), py(258), -0.9], [px(470), py(330), -0.9], [px(520), py(360), -0.9], [px(520), py(480), -0.9]], 0.05, ctx.metal));
  escalera(B, px(633), py(250), py(0) + 1.5, -0.6, { ancho: 0.28 });
  KM.add((px(440) + px(600)) / 2, py(300), -1.1, px(600) - px(440), 0.16, 0.2);
  fachada(KF, X0, X1, [0, py(500), py(250)], -4.2, { huecos: [3, 4], ancho: 0.55, sem: 13, salta: 0.2 });
  farola(g, ctx, px(518), { parpadea: false });
  for (const [xx, yy, w, h, s] of [[150, 212, 0.75, 0.6, 1], [360, 212, 1.0, 0.7, 2], [165, 490, 0.7, 0.55, 3], [430, 395, 0.6, 0.5, 4], [440, 805, 1.6, 0.8, 5], [690, 828, 0.7, 0.35, 6]]) mata(g, px(xx), py(yy), yy > 700 ? 0.9 : zF + 1.0, w, h, s);
  colgajo(g, px(428), py(250), zF + 0.75, 0.55, 3.0, 21); colgajo(g, px(165), py(510), zF + 1.05, 0.5, 1.6, 22);
  { const m = ramas(1.6, 1.6, 23, { desde: 'derecha' }); m.position.set(px(700), py(60), -0.5); g.add(m); }
  { const m = ramas(1.2, 1.0, 24); m.position.set(px(20), py(20), -0.2); g.add(m); }
  // la derecha: el edificio oscuro con sus balcones, el armario, el poste con el cartel, vallas, bolardos y la caja
  const XD = px(1555);
  K.base(XD + 1.5, 0, -1.0, 3.0, 12, 1.6, 0, '#7d7770');
  K.add(XD - 0.1, py(298), -0.5, 1.2, 0.26, 1.2); barandilla(B, XD - 0.6, XD + 0.6, py(298) + 0.13, 0.0, { alto: 0.55, paso: 0.3, grueso: 0.035 });
  for (const yy of [60, 150]) { K.add(XD + 0.6, py(yy), -0.4, 1.6, 0.18, 0.9); barandilla(B, XD - 0.15, XD + 1.5, py(yy) + 0.09, 0.0, { alto: 0.5, paso: 0.28, grueso: 0.03 }); }
  K.add(XD - 0.05, py(640), -0.4, 0.7, 0.2, 1.0);
  escalera(B, XD - 0.15, py(640), py(0) + 1, -0.15, { ancho: 0.28 });
  g.add(tuberia([[XD + 0.15, 0.3, -0.12], [XD + 0.15, py(480), -0.12], [XD - 0.3, py(450), -0.12], [XD - 0.3, py(300), -0.12]], 0.05, ctx.metal));
  KM.add(px(1475), py(560), -0.2, 0.62, 0.75, 0.5); KM.add(px(1520), py(545), -0.2, 0.55, 0.12, 0.6);
  barandilla(B, px(1440), px(1520), py(510), 0.05, { alto: 0.35, paso: 0.18, grueso: 0.025 });
  B.add([px(1395), py(590), 0.2], [px(1450), py(590), 0.1], 0.06); B.add([px(1395), 0, 0.2], [px(1395), py(585), 0.2], 0.1);
  KM.add(px(1383), py(658), 0.3, px(1415) - px(1350), py(615) - py(700), 0.06);
  const cartel = new THREE.Mesh(new THREE.PlaneGeometry(px(1410) - px(1356), (py(620) - py(696)) * 0.9), new THREE.MeshStandardMaterial({ map: texturaCartel('ZONA', 'B · 17'), roughness: 0.9 }));
  cartel.position.set(px(1383), py(658), 0.34); g.add(cartel);
  valla(g, ctx, px(1342), px(1560), 1.25, { roto: [0.3, 0.4] }); valla(g, ctx, px(-10), px(78), 1.55);
  for (const xx of [1162, 1197]) bolardo(g, ctx, px(xx));
  cajon(ctx, px(1262), 0.6, 0.48);
  barandilla(B, px(125), px(195), 0, 0.6, { alto: 0.62, paso: 0.17, grueso: 0.035 });
}

// ================================================================= 1 · LOS DEPOSITOS
export function tramoPlanta(g, ctx, x0, x1) {
  const { K, KF, KM, B, L } = ctx, rr = azar(301);
  // dos depositos grandes con sus aros, la escalera en espiral (de frente: tramos en zigzag) y la pasarela de arriba
  for (const [cx, r, h] of [[x0 + 4.5, 2.3, 6.4], [x0 + 10.5, 1.7, 4.8]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 36), ctx.metalOsc); t.position.set(cx, h / 2, -4.2); t.castShadow = t.receiveShadow = true; g.add(t);
    const tapa = new THREE.Mesh(new THREE.SphereGeometry(r, 36, 8, 0, Math.PI * 2, 0, 0.35), ctx.metalOsc); tapa.position.set(cx, h - r * Math.cos(0.35), -4.2); g.add(tapa);
    for (let y = 0.8; y < h; y += 1.1) KM.add(cx, y, -4.2 + r * 0.98, r * 2.02, 0.07, 0.06);
    for (let y = 0.4, s = 1; y < h - 0.5; y += 1.1, s = -s) { B.add([cx - s * r * 0.7, y, -4.2 + r + 0.15], [cx + s * r * 0.7, y + 1.1, -4.2 + r + 0.15], 0.06); B.add([cx - s * r * 0.7, y + 0.6, -4.2 + r + 0.15], [cx + s * r * 0.7, y + 1.7, -4.2 + r + 0.15], 0.035); }
    barandilla(B, cx - r * 0.8, cx + r * 0.8, h, -4.2 + r * 0.5, { alto: 0.5, paso: 0.35, grueso: 0.03 });
  }
  // el haz de tuberias que cruza la calle por encima del 18, sobre porticos en T
  const yT = 4.3;
  for (let x = x0 + 1; x <= x1 - 1; x += 4.6) { KM.base(x, 0, -0.4, 0.22, yT, 0.22); KM.add(x, yT, -0.1, 0.25, 0.18, 1.6); }
  for (const [dz, r, dy] of [[0.35, 0.14, 0.24], [-0.05, 0.1, 0.2], [-0.45, 0.17, 0.27]]) g.add(tuberia([[x0 - 1, yT + dy, dz], [x1 + 1, yT + dy, dz]], r, ctx.metal));
  // una que baja a los depositos, con su valvula, y un escape de vapor
  g.add(tuberia([[x0 + 7.5, yT + 0.24, 0.35], [x0 + 7.5, 1.4, 0.35], [x0 + 6.6, 1.4, -1.2], [x0 + 6.6, 0.6, -2.0]], 0.09, ctx.metal));
  const volante = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 20), ctx.metal); volante.position.set(x0 + 7.5, 2.1, 0.5); g.add(volante);
  KM.add(x0 + 7.5, 2.1, 0.47, 0.44, 0.04, 0.04); KM.add(x0 + 7.5, 2.1, 0.47, 0.04, 0.44, 0.04);
  g.add(humo(x0 + 12.6, yT + 0.6, 18, ctx.tiempo, { vida: 7, sube: 7, viento: -1.2, tam: 0.22, color: '#b6ada2', luz: '#efe4d2' }));
  // la caseta de control con su ventana encendida, y su farola
  K.base(x1 - 4.5, 0, -1.0, 2.6, 2.6, 1.8); K.add(x1 - 4.5, 2.65, -0.9, 2.9, 0.12, 2.1);
  fachada(KF, x1 - 5.8, x1 - 3.2, [0, 2.6], -0.08, { huecos: 1, ancho: 0.5, antepecho: 0.9, dintel: 0.4 });
  L.add(x1 - 4.5, 1.6, -0.12, 1.0, 1.15, '#ffc17d', 1.2, 0);
  ctx.focos.push({ p: new THREE.Vector3(x1 - 4.5, 1.5, 0.6), color: '#ffb46a', intensidad: 3, distancia: 4, fuerza: 1 });
  farola(g, ctx, x1 - 1.6);
  for (let k = 0; k < 3; k++) mata(g, x0 + 2 + rr() * (x1 - x0 - 4), 0, 0.9, 0.8 + rr() * 0.6, 0.4 + rr() * 0.3, 300 + k);
  cajon(ctx, x0 + 13.6, 0.7, 0.55); cajon(ctx, x0 + 14.4, 0.5, 0.4, 0.9);
}

// ================================================================= 2 · EL BLOQUE DE LOS BALCONES
export function tramoMarco(g, ctx, x0, x1) {
  edificioMarco(g, ctx, x0 + 1, x0 + 13, { pisos: 3, sem: 41, cartel: true });
  farola(g, ctx, x0 + 14.5);
  valla(g, ctx, x0 + 15.5, x1 - 0.4, 1.3, { roto: [0.6, 0.3] });
  bolardo(g, ctx, x0 + 0.4);
}

// ================================================================= 3 · EL DERRUMBE
export function tramoRuina(g, ctx, x0, x1) {
  const { K, KF, KM, B } = ctx, rr = azar(503);
  // pilares en pie de alturas distintas con su varilla al aire, forjados caidos en diagonal y el monton de cascotes
  for (let x = x0 + 0.8; x < x1 - 1; x += 2.2 + rr() * 1.2) {
    const h = 1.5 + rr() * 6.5; K.base(x, 0, -1.4 + rr() * 0.4, 0.38, h, 0.45);
    for (let q = 0; q < 4; q++) B.add([x - 0.12 + q * 0.08, h, -1.3], [x - 0.2 + q * 0.12 + (rr() - 0.5) * 0.3, h + 0.4 + rr() * 0.5, -1.3], 0.02);
  }
  for (let k = 0; k < 4; k++) { const cx = x0 + 3 + k * 4 + rr(), w = 3 + rr() * 2.5, a = (rr() - 0.5) * 0.9; K.add(cx, 0.9 + rr() * 2.6, -1.8 + rr() * 0.6, w, 0.32, 1.6, a); }
  for (let k = 0; k < 70; k++) { const x = x0 + rr() * (x1 - x0), s = 0.12 + Math.pow(rr(), 2) * 0.7; K.add(x, s * 0.35, -0.6 + rr() * 1.6, s * (1 + rr()), s * (0.5 + rr() * 0.6), s, (rr() - 0.5) * 1.2, rr() < 0.5 ? '#bdb6ac' : '#ffffff'); }
  // lo que queda de la fachada: un trozo de planta baja con dos huecos y una ventana colgando
  const hs = fachada(KF, x0 + 9, x0 + 14, [0, 3.2], -2.4, { huecos: 2, ancho: 0.6, antepecho: 0.6, dintel: 0.6 }); for (const h of hs) marco(KM, h, -2.38, { torcido: 0.9 });
  // un arbol muerto que sale de los cascotes
  { const m = arbusto(3.2, 4.6, 521, { hojas: 1, tamHoja: 5 }); m.position.set(x0 + 6, 0, -0.3); g.add(m); }
  for (let k = 0; k < 4; k++) mata(g, x0 + 1 + rr() * (x1 - x0 - 2), 0, 0.9, 0.6 + rr() * 0.6, 0.35 + rr() * 0.3, 530 + k);
  farola(g, ctx, x1 - 1.2, { parpadea: true });
}

// ================================================================= 4 · LA PASARELA CUBIERTA
export function tramoPasarela(g, ctx, x0, x1) {
  const { K, KF, KM, B, L } = ctx;
  const a = edificioMarco(g, ctx, x0 + 0.5, x0 + 7.5, { pisos: 3, sem: 61 });
  edificioMarco(g, ctx, x1 - 7.5, x1 - 0.5, { pisos: 2, sem: 62, planta: 3.0, piso: 2.9 });
  // la pasarela: caja con su fila de ventanas (una encendida), el suelo de rejilla y las cerchas de los lados
  const pa = x0 + 7.5, pb = x1 - 7.5, y0 = 5.2, y1 = 6.9;
  K.add((pa + pb) / 2, y0 + 0.1, -0.6, pb - pa + 0.4, 0.2, 1.8); K.add((pa + pb) / 2, y1 - 0.08, -0.6, pb - pa + 0.4, 0.16, 1.9);
  const hs = fachada(KF, pa, pb, [y0 + 0.2, y1 - 0.16], 0.15, { huecos: Math.round((pb - pa) / 1.1), ancho: 0.62, antepecho: 0.42, dintel: 0.22, machonExtremo: 0.15, sem: 63 });
  hs.forEach((h, k) => { marco(KM, h, 0.17, { montantes: 1 }); if (k === 3) { L.add(h.x + h.w / 2, h.y + h.h / 2, 0.1, h.w * 0.95, h.h * 0.95, '#ffc58a', 1.1, 1); ctx.focos.push({ p: new THREE.Vector3(h.x + h.w / 2, h.y, 0.8), color: '#ffb46a', intensidad: 2.5, distancia: 4, fuerza: 1 }); } });
  celosia(B, [pa, y0 - 0.45, 0.25], [pb, y0 - 0.45, 0.25], 0.42, 0.05, { paso: 0.7 });
  void a;
  farola(g, ctx, (pa + pb) / 2 + 0.3);
  cajon(ctx, pa + 1.2, 0.6, 0.5); bolardo(g, ctx, pb - 1);
}

// ================================================================= 5 · EL PATIO DE CARGA
export function tramoPatio(g, ctx, x0, x1) {
  const { K, KF, KM, B, L } = ctx, rr = azar(707);
  valla(g, ctx, x0 + 0.4, x0 + 5, 1.6, { roto: [0.4, 0.5] });
  // un contenedor de chapa ondulada (costillas) con la puerta entreabierta
  { const cx = x0 + 7.5, w = 5.2, h = 2.4; KM.base(cx, 0, -1.6, w, h, 2.2, 0, '#8a6e58'); for (let x = cx - w / 2 + 0.1; x < cx + w / 2; x += 0.16) KM.add(x, h / 2, -0.48, 0.05, h - 0.1, 0.03, 0, '#8a6e58'); KM.base(cx + w / 2 + 0.3, 0, -0.4, 0.06, h, 1.1, 0.4); }
  // cajas apiladas y un camion abandonado (cabina, caja, ruedas)
  for (const [x, w, h, y] of [[x0 + 11, 0.9, 0.8, 0], [x0 + 11.95, 0.8, 0.7, 0], [x0 + 11.4, 0.85, 0.7, 0.8]]) KM.base(x, y, 0.2, w, h, w);
  { const cx = x0 + 15.5; K.base(cx - 1.4, 0.45, -0.9, 1.4, 1.5, 1.6, 0, '#7a7068'); KF.add(cx - 1.2, 1.55, -0.08, 0.7, 0.5, 0.04); KM.base(cx + 0.9, 0.45, -0.9, 3.4, 1.8, 1.9, 0, '#6a5a4c'); for (const x of [cx - 1.4, cx + 0.4, cx + 1.7]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 16), ctx.metalOsc); r.rotation.x = Math.PI / 2; r.position.set(x, 0.42, -0.05); g.add(r); } }
  // la garita con su luz
  K.base(x1 - 2, 0, -0.6, 1.4, 2.4, 1.4); K.add(x1 - 2, 2.45, -0.6, 1.7, 0.12, 1.7);
  L.add(x1 - 2, 1.5, 0.12, 0.7, 0.6, '#ffd29a', 1.3, 1);
  ctx.focos.push({ p: new THREE.Vector3(x1 - 2, 1.5, 0.8), color: '#ffc68a', intensidad: 2.5, distancia: 4, fuerza: 1 });
  B.add([x1 - 4.6, 0.9, 0.6], [x1 - 2.8, 0.9, 0.6], 0.08); KM.base(x1 - 4.7, 0, 0.6, 0.18, 1.0, 0.18);
  farola(g, ctx, x0 + 9.8);
  for (let k = 0; k < 4; k++) mata(g, x0 + rr() * (x1 - x0), 0, 0.9, 0.6 + rr() * 0.6, 0.35 + rr() * 0.3, 720 + k);
}

// ================================================================= 6 · LA NAVE
export function tramoNave(g, ctx, x0, x1) {
  const { K, KF, KM, B, L } = ctx;
  const h = 6.3, zF = -1.6;
  // el muro con sus ventanales altos (por dentro, la luz calida de la nave) y el portalon
  const hs = fachada(K, x0 + 0.5, x1 - 0.5, [0, 3.4, h], zF, { huecos: [6, 8], ancho: 0.55, antepecho: 0.6, dintel: 0.45, salta: 0.1, sem: 801 });
  hs.forEach((q, k) => { marco(KM, q, zF + 0.02, { montantes: 2, travesano: 0.66 }); if (k % 3 !== 1) L.add(q.x + q.w / 2, q.y + q.h / 2, zF - 0.3, q.w, q.h, '#e7a35c', 0.55 + (k % 2) * 0.25, k % 5 === 0 ? 1 : 0); });
  K.base((x0 + x1) / 2, h, zF - 0.3, x1 - x0, 0.9, 1.4);
  for (let x = x0 + 0.3; x < x1; x += 3.6) K.base(x, 0, zF + 0.35, 0.5, h + 0.4, 0.6);
  // la viga del puente grua por delante, con el gancho colgando
  KM.add((x0 + x1) / 2, 5.5, -0.2, x1 - x0, 0.4, 0.3);
  B.add([x0 + 10, 5.3, -0.1], [x0 + 10, 4.1, -0.1], 0.03); B.add([x0 + 10.2, 5.3, -0.1], [x0 + 10.2, 4.1, -0.1], 0.03);
  KM.add(x0 + 10.1, 3.95, -0.1, 0.45, 0.3, 0.25);
  g.add(tuberia([[x0 + 10.1, 3.8, -0.1], [x0 + 10.1, 3.45, -0.1], [x0 + 10.35, 3.3, -0.1]], 0.05, ctx.metal, { codo: 0.15 }));
  ctx.focos.push({ p: new THREE.Vector3((x0 + x1) / 2, 2.5, 0.5), color: '#e8a060', intensidad: 3, distancia: 7, fuerza: 1 });
  farola(g, ctx, x0 + 3.2); farola(g, ctx, x1 - 4);
  for (const x of [x0 + 7, x0 + 7.4, x1 - 8]) bolardo(g, ctx, x);
}

// ================================================================= 7 · LA PUERTA
export function tramoPuerta(g, ctx, x0, x1) {
  const { K, KF, KM, B } = ctx;
  const cx = x0 + 12, ancho = 8, h = 9.2;
  // dos torres macizas y el dintel con la segunda ventana redonda; por la puerta, la oscuridad de lo que sigue
  for (const s of [-1, 1]) { K.base(cx + s * (ancho / 2 + 1.4), 0, -1.6, 2.8, h, 2.2); escalera(B, cx + s * (ancho / 2 + 2.9), 0.5, h - 1, -0.4, { ancho: 0.3, jaula: true }); }
  K.add(cx, h - 1.7, -1.6, ancho + 0.2, 3.4, 2.2);
  KF.base(cx, 0, -3.4, ancho, h - 3.4, 0.4, 0, '#262321');
  celosia(B, [cx - ancho / 2, h - 3.6, -0.6], [cx + ancho / 2, h - 3.6, -0.6], 0.6, 0.06, { paso: 0.8, montantes: true });
  ventanaRedonda(g, ctx, cx, h - 1.7, 1.0, -0.45, [cx - 1.5, cx + 1.5, h - 3.3, h - 0.05]);
  // al fondo del tunel, muy lejos, una luz calida que no se sabe de donde viene
  halo(g, cx + 1.2, 1.3, -3.3, 4.2, '#c98a4e', 0.34);
  // el cartel de la puerta y la ultima farola
  const c = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.7), new THREE.MeshStandardMaterial({ map: texturaCartel('SECTOR 9', '', 512, 112), roughness: 0.9 }));
  c.position.set(cx, h - 4.4, -0.35); g.add(c);
  farola(g, ctx, cx - ancho / 2 - 3.6);
  valla(g, ctx, x0 + 0.6, cx - ancho / 2 - 4.4, 1.5);
}

// el cartel: letras gastadas sobre chapa gris
function texturaCartel(l1, l2, W = 256, H = 320) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  c.fillStyle = '#3b3833'; c.fillRect(0, 0, W, H); c.strokeStyle = '#1a1816'; c.lineWidth = 10; c.strokeRect(8, 8, W - 16, H - 16);
  c.fillStyle = '#7a746a'; c.textAlign = 'center'; c.textBaseline = 'middle';
  if (l2) { c.font = `bold ${Math.round(H * 0.17)}px Georgia`; c.fillText(l1, W / 2, H * 0.38); c.font = `${Math.round(H * 0.11)}px Georgia`; c.fillText(l2, W / 2, H * 0.62); }
  else { c.font = `bold ${Math.round(H * 0.55)}px Georgia`; c.fillText(l1, W / 2, H / 2); }
  c.fillStyle = 'rgba(20,16,12,.5)'; for (let k = 0; k < 60; k++) c.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 10, 2 + Math.random() * 30);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
