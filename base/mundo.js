// La base de refugiados en 3D. En metros; el muro corre por el eje X en z = 0 (fuera z > 0, dentro el
// campamento en z < 0) con el porton en x = 0. Todo con sombreado de tres tonos y contorno de tinta
// (casco invertido), para que case con el trazo del 18.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { TINTA, azar, hormigon, letra, chorreton, lona, tierra, refugiado, tablon, ciudadLejana, lienzo, corteTierra } from './texturas.js';

export const MURO = { alto: 12, grueso: 1.2, x0: -48, x1: 48, puerta: 3, altoPuerta: 6.5 };
export const TEXTO_CARTEL = 'BASE DE REFUGIADOS';

// ---------------------------------------------------------------- materiales con tinta
const tonos = (() => {
  const d = new Uint8Array([140, 205, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
  return t;
})();
export function toon(o) {
  return new THREE.MeshToonMaterial({ gradientMap: tonos, ...(typeof o === 'string' ? { color: o } : o) });
}
const matTinta = new THREE.MeshBasicMaterial({ color: TINTA, side: THREE.BackSide });
const tintas = new Map();
export const contornos = [];       // los cascos de tinta: la camara oculta los que corta su plano cercano
function materialTinta(ancho) {
  if (tintas.has(ancho)) return tintas.get(ancho);
  const m = matTinta.clone();
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n transformed += normalize(normal) * ${ancho.toFixed(4)};`);
  };
  tintas.set(ancho, m);
  return m;
}
// contorno de tinta: la misma forma un poco mas gorda, por detras (normales suavizadas para que no se abra
// en las esquinas)
export function tinta(mesh, ancho = 0.035) {
  const g = mesh.geometry.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  const m = mergeVertices(g, 1e-4);
  m.computeVertexNormals();
  const c = new THREE.Mesh(m, materialTinta(ancho));
  c.castShadow = false; c.receiveShadow = false;
  m.computeBoundingSphere();
  mesh.add(c);
  contornos.push(c);
  return mesh;
}
function malla(geo, mat, x, y, z, o = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (o.ry) m.rotation.y = o.ry;
  if (o.rx) m.rotation.x = o.rx;
  if (o.rz) m.rotation.z = o.rz;
  m.castShadow = o.sombra !== false; m.receiveShadow = true;
  if (o.tinta !== 0) tinta(m, o.tinta || 0.035);
  return m;
}

// ---------------------------------------------------------------- el mundo
export function crearMundo(escena) {
  const r = azar(2026);
  const solidos = [];           // obstaculos en planta: {x, z, r} o {x0, x1, z0, z1}
  const hablar = [];            // lo que se puede leer o escuchar: {x, z, radio, titulo, texto}
  const vivos = [];             // lo que se anima: (t, dt) => void
  const npcs = [];
  const raiz = new THREE.Group();
  escena.add(raiz);

  // ---- suelos: asfalto fuera, tierra pisada dentro
  const asf = tierra(3, true); asf.repeat.set(24, 4);
  const suelo1 = malla(new THREE.PlaneGeometry(120, 30), toon({ map: asf }), 0, 0, 15.6, { rx: -Math.PI / 2, tinta: 0, sombra: false });
  const tie = tierra(8); tie.repeat.set(24, 14);
  const suelo2 = malla(new THREE.PlaneGeometry(120, 71.2), toon({ map: tie }), 0, 0, -35.0, { rx: -Math.PI / 2, tinta: 0, sombra: false });
  raiz.add(suelo1, suelo2);
  // el corte de tierra delante del camino: lo que la vista 2D ve debajo del suelo, como en el juego
  const corte = new THREE.Mesh(new THREE.PlaneGeometry(120, 7), new THREE.MeshBasicMaterial({ map: corteTierra(), fog: false }));
  corte.position.set(0, -3.5, 9.5); raiz.add(corte);

  // ---- el muro: paneles prefabricados de 3 m, cada uno con su hormigon, alguno ladeado
  const paneles = Array.from({ length: 7 }, (_, k) => toon({ map: hormigon(11 + k * 17, { roto: k % 3 === 1, marcas: k === 0 || k === 4 }) }));
  for (let x = MURO.x0; x < MURO.x1; x += 3) {
    const cx = x + 1.5;
    if (Math.abs(cx) < MURO.puerta) continue;
    const h = MURO.alto + (r() - 0.5) * 0.5;
    const p = malla(new THREE.BoxGeometry(2.96, h, MURO.grueso), paneles[Math.floor(r() * paneles.length)], cx, h / 2, 0, { rz: r() < 0.12 ? (r() - 0.5) * 0.03 : 0, tinta: 0.04 });
    raiz.add(p);
  }
  // dintel sobre el porton
  const dintel = malla(new THREE.BoxGeometry(MURO.puerta * 2 + 0.2, MURO.alto - MURO.altoPuerta, MURO.grueso + 0.2), paneles[2], 0, (MURO.alto + MURO.altoPuerta) / 2, 0, { tinta: 0.04 });
  raiz.add(dintel);
  solidos.push({ x0: MURO.x0, x1: -MURO.puerta + 0.2, z0: -MURO.grueso / 2 - 0.1, z1: MURO.grueso / 2 + 0.1 });
  solidos.push({ x0: MURO.puerta - 0.2, x1: MURO.x1, z0: -MURO.grueso / 2 - 0.1, z1: MURO.grueso / 2 + 0.1 });

  // ---- concertina por arriba (alambre en espiral, linea de tinta)
  const pts = [];
  for (let x = MURO.x0; x <= MURO.x1; x += 0.04) {
    const a = x * 21;
    pts.push(new THREE.Vector3(x + Math.sin(a) * 0.05, MURO.alto + 0.45 + Math.sin(a) * 0.38, Math.cos(a) * 0.38));
  }
  raiz.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: TINTA })));
  for (let x = MURO.x0; x <= MURO.x1; x += 2.5) raiz.add(malla(new THREE.CylinderGeometry(0.03, 0.03, 1.1), toon('#3c3833'), x, MURO.alto + 0.5, 0, { tinta: 0.015 }));

  // ---- porton: dos hojas de chapa con nervios, abiertas hacia dentro (se abren del todo al acercarse)
  const chapa = lienzo(256, 512, (g, w, h) => {
    const rr = azar(77);
    g.fillStyle = '#5f5a52'; g.fillRect(0, 0, w, h);
    for (let y = 30; y < h; y += 64) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, y, w, 8); g.fillStyle = 'rgba(220,214,204,.18)'; g.fillRect(0, y + 8, w, 3); }
    for (let k = 0; k < 12; k++) { const gr = g.createLinearGradient(0, rr() * h, 0, h); gr.addColorStop(0, 'rgba(96,68,44,.5)'); gr.addColorStop(1, 'rgba(96,68,44,0)'); g.fillStyle = gr; g.fillRect(rr() * w, rr() * h * 0.6, 4 + rr() * 10, h); }
    for (let y = 12; y < h; y += 64) for (let x = 12; x < w; x += 40) { g.fillStyle = '#2d2925'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
    g.strokeStyle = TINTA; g.lineWidth = 10; g.strokeRect(0, 0, w, h);
  });
  const hojas = [];
  for (const lado of [-1, 1]) {
    const piv = new THREE.Group();
    piv.position.set(lado * MURO.puerta, 0, -MURO.grueso / 2);
    const hoja = malla(new THREE.BoxGeometry(MURO.puerta, MURO.altoPuerta, 0.18), toon({ map: chapa }), -lado * MURO.puerta / 2, MURO.altoPuerta / 2, 0, { tinta: 0.03 });
    piv.add(hoja); raiz.add(piv);
    hojas.push({ piv, lado });
  }
  let abre = 0.35;
  const porton = {
    abrir(objetivo, dt) { abre += (objetivo - abre) * Math.min(1, dt * 1.6); for (const h of hojas) h.piv.rotation.y = h.lado * abre * 1.45; },
  };

  // ---- el cartel: letras de chapa sueltas sobre el porton; falta una y otra cuelga de un tornillo
  const cartel = new THREE.Group();
  const paso = 1.08, tam = 1.25, yC = 9.4;
  const n = TEXTO_CARTEL.length;
  const FALTA = 10, CUELGA = 13;           // la F de REFUGIADOS falta (queda su sombra); la I cuelga
  let colgada = null;
  [...TEXTO_CARTEL].forEach((ch, k) => {
    if (ch === ' ') return;
    const x = (k - (n - 1) / 2) * paso;
    // el oxido que ha chorreado la letra (aunque ya no este)
    const d = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 2.4), new THREE.MeshBasicMaterial({ map: chorreton(k + 3), transparent: true, depthWrite: false }));
    d.position.set(x, yC - 1.7, MURO.grueso / 2 + 0.02); cartel.add(d);
    if (k === FALTA) {
      const sombra = new THREE.Mesh(new THREE.PlaneGeometry(tam * 0.8, tam * 0.85), new THREE.MeshBasicMaterial({ color: '#a29d93', transparent: true, opacity: 0.55, depthWrite: false }));
      sombra.position.set(x, yC, MURO.grueso / 2 + 0.015); cartel.add(sombra);
      return;
    }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(tam, tam), new THREE.MeshToonMaterial({ gradientMap: tonos, map: letra(ch, 100 + k), transparent: true, alphaTest: 0.4 }));
    m.castShadow = true;
    if (k === CUELGA) {
      // cuelga del tornillo de arriba a la izquierda: el pivote es esa esquina
      const piv = new THREE.Group();
      piv.position.set(x - tam * 0.3, yC + tam * 0.38, MURO.grueso / 2 + 0.12);
      m.position.set(tam * 0.3, -tam * 0.38, 0);
      piv.add(m); cartel.add(piv);
      colgada = piv;
      return;
    }
    m.position.set(x + (r() - 0.5) * 0.05, yC + (r() - 0.5) * 0.08, MURO.grueso / 2 + 0.1);
    m.rotation.z = (r() - 0.5) * 0.05;
    cartel.add(m);
  });
  raiz.add(cartel);
  vivos.push((t) => { if (colgada) colgada.rotation.z = -0.95 + Math.sin(t * 1.1) * 0.06 + Math.sin(t * 2.7) * 0.02; });

  // ---- torres de guardia junto al porton, por dentro
  const metal = toon({ map: chapa });
  for (const lado of [-1, 1]) {
    const tx = lado * 9, tz = -3.2;
    const torre = new THREE.Group(); torre.position.set(tx, 0, tz);
    for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) torre.add(malla(new THREE.CylinderGeometry(0.1, 0.12, 13), toon('#4f4a43'), ax * 1.1, 6.5, az * 1.1, { tinta: 0.02 }));
    for (let y = 2.5; y < 12; y += 3) for (const rot of [0, Math.PI / 2]) torre.add(malla(new THREE.BoxGeometry(2.4, 0.08, 0.08), toon('#4f4a43'), 0, y, 0, { ry: rot, rz: 0.9, tinta: 0.015 }));
    torre.add(malla(new THREE.BoxGeometry(3, 2.2, 3), metal, 0, 14, 0, { tinta: 0.04 }));
    const ventana = malla(new THREE.BoxGeometry(3.05, 0.6, 3.05), toon('#1c1a18'), 0, 14.3, 0, { tinta: 0 });
    torre.add(ventana);
    const tejado = malla(new THREE.ConeGeometry(2.6, 1.2, 4), toon('#5b554c'), 0, 15.7, 0, { ry: Math.PI / 4, tinta: 0.04 });
    torre.add(tejado);
    raiz.add(torre);
    solidos.push({ x: tx, z: tz, r: 1.6 });
    hablar.push({ x: tx, z: tz + 1.8, radio: 1.8, titulo: 'Torre de guardia', texto: 'La escalera esta rota a media altura. Nadie vigila desde aqui hace años: dentro solo queda una silla y una radio sin pilas.' });
  }

  // ---- focos sobre el muro: uno parpadea
  const focos = [];
  for (const [fx, haciaDentro] of [[-6, true], [6, true], [-15, false], [15, false]]) {
    raiz.add(malla(new THREE.CylinderGeometry(0.06, 0.06, 2.2), toon('#3b3631'), fx, MURO.alto + 1.1, haciaDentro ? -0.3 : 0.3, { tinta: 0.015 }));
    const caja = malla(new THREE.BoxGeometry(0.6, 0.4, 0.4), toon('#45403a'), fx, MURO.alto + 2.2, haciaDentro ? -0.4 : 0.4, { tinta: 0.02 });
    raiz.add(caja);
    const luz = new THREE.SpotLight('#f3ecdc', 0, 30, 0.55, 0.6, 1.2);
    luz.position.set(fx, MURO.alto + 2.1, haciaDentro ? -0.6 : 0.6);
    luz.target.position.set(fx * 0.6, 0, haciaDentro ? -9 : 7);
    raiz.add(luz, luz.target);
    focos.push({ luz, fx });
  }
  vivos.push((t) => {
    focos[0].luz.intensity = 26;
    focos[1].luz.intensity = (Math.sin(t * 23) > 0.2 && Math.sin(t * 3.1) > -0.6) ? 22 : 2;     // el que falla
    focos[2].luz.intensity = 0; focos[3].luz.intensity = 18;
  });

  // ---- FUERA: los que no entraron. Carretera, coche quemado, sacos terreros, barrera, tiendas pegadas al muro
  const sacoMat = toon('#8a7d62');
  for (let k = 0; k < 18; k++) {
    const x = -8.5 + (k % 6) * 0.95 + (Math.floor(k / 6) % 2) * 0.45, y = 0.25 + Math.floor(k / 6) * 0.42;
    raiz.add(malla(new THREE.CapsuleGeometry(0.24, 0.5, 4, 8), sacoMat, x, y, 2.6, { rz: Math.PI / 2, tinta: 0.02 }));
  }
  solidos.push({ x0: -9, x1: -3, z0: 2.2, z1: 3.0 });
  // barrera de paso, levantada
  raiz.add(malla(new THREE.BoxGeometry(0.4, 1.1, 0.4), toon('#55504a'), 5.5, 0.55, 5, { tinta: 0.02 }));
  const barra = malla(new THREE.BoxGeometry(5, 0.14, 0.14), toon({ map: lienzo(256, 16, (g, w, h) => { for (let x = 0; x < w; x += 32) { g.fillStyle = (x / 32) % 2 ? '#d8d2c6' : '#3a3632'; g.fillRect(x, 0, 32, h); } }) }), 5.5 + 2.2, 2.6, 5, { rz: 1.1, tinta: 0.02 });
  raiz.add(barra);
  // coche quemado
  const coche = new THREE.Group(); coche.position.set(16, 0, 8.5); coche.rotation.y = 0.25;
  coche.add(malla(new THREE.BoxGeometry(4.2, 0.9, 1.8), toon('#3e3b37'), 0, 0.75, 0, { tinta: 0.04 }));
  coche.add(malla(new THREE.BoxGeometry(2.2, 0.75, 1.6), toon('#2f2c29'), -0.2, 1.55, 0, { tinta: 0.04 }));
  for (const [ax, az] of [[-1.4, -0.95], [1.4, -0.95], [-1.4, 0.95], [1.4, 0.95]]) coche.add(malla(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 12), toon('#1f1d1b'), ax, 0.36, az, { rx: Math.PI / 2, tinta: 0.02 }));
  raiz.add(coche); solidos.push({ x: 16, z: 8.5, r: 2.2 });
  // escombros
  for (let k = 0; k < 26; k++) {
    const x = (r() - 0.5) * 90, z = 1.3 + r() * 8;
    if ((Math.abs(x) < 4 && z < 8) || (z > 3.2 && z < 5)) continue;
    const s = 0.08 + r() * 0.26;
    raiz.add(malla(new THREE.DodecahedronGeometry(s, 0), toon(r() < 0.5 ? '#77736c' : '#8a857d'), x, s * 0.5, z, { ry: r() * 6, rx: r() * 6, tinta: 0.02 }));
  }

  const hx = 0, hz = -14;           // la hoguera del centro
  // ---- tiendas (de cumbrera y militares cuadradas)
  const lonas = Array.from({ length: 5 }, (_, k) => toon({ map: lona(k + 1) }));
  function tienda(x, z, giro, tipo, escala = 1) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = giro; g.scale.setScalar(escala);
    const mat = lonas[Math.floor(r() * lonas.length)];
    if (tipo === 'cumbrera') {
      const forma = new THREE.Shape(); forma.moveTo(-1.3, 0); forma.lineTo(0, 1.7); forma.lineTo(1.3, 0); forma.closePath();
      const geo = new THREE.ExtrudeGeometry(forma, { depth: 3, bevelEnabled: false });
      geo.translate(0, 0, -1.5);
      g.add(malla(geo, mat, 0, 0, 0, { tinta: 0.035 }));
      // entrada oscura
      const boca = new THREE.Mesh(new THREE.CircleGeometry(0.55, 3), new THREE.MeshBasicMaterial({ color: '#141210' }));
      boca.position.set(0, 0.42, 1.52); boca.rotation.z = Math.PI / 2; g.add(boca);
    } else {
      g.add(malla(new THREE.BoxGeometry(3, 1.5, 3), mat, 0, 0.75, 0, { tinta: 0.035 }));
      g.add(malla(new THREE.ConeGeometry(2.25, 1.2, 4), mat, 0, 2.1, 0, { ry: Math.PI / 4, tinta: 0.035 }));
      const boca = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.2), new THREE.MeshBasicMaterial({ color: '#141210' }));
      boca.position.set(0, 0.6, 1.51); g.add(boca);
    }
    raiz.add(g);
    solidos.push({ x, z, r: 1.7 * escala });
    return g;
  }
  // fuera, pegadas al muro: los que esperan
  tienda(-24, 1.95, 0.1, 'cumbrera', 0.85); tienda(-18.5, 1.95, -0.1, 'cumbrera', 0.8); tienda(26, 2.0, 0.05, 'cuadrada', 0.8);
  // dentro, en dos barrios con una calle al medio que va del porton a la hoguera
  const sitios = [];
  for (let k = 0; k < 44; k++) {
    for (let intento = 0; intento < 60; intento++) {
      const x = (r() < 0.5 ? -1 : 1) * (6.5 + r() * 24), z = -4.5 - r() * 28;
      if (Math.abs(x) < 6.5 || (Math.abs(x - 13) < 4 && z > -12)) continue;
      if (Math.hypot(x - 24, z + 25) < 4) continue;
      if (sitios.some(([a, b]) => Math.hypot(a - x, b - z) < 3.6)) continue;
      if (Math.hypot(x - hx, z - hz) < 5.5) continue;
      sitios.push([x, z]);
      tienda(x, z, (r() - 0.5) * 0.8 + (r() < 0.3 ? Math.PI / 2 : 0), r() < 0.6 ? 'cumbrera' : 'cuadrada', 0.85 + r() * 0.3);
      break;
    }
  }

  // ---- la hoguera en el centro: piedras, troncos, llamas, chispas y su luz que tiembla
  for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; raiz.add(malla(new THREE.DodecahedronGeometry(0.22, 0), toon('#6b6760'), hx + Math.cos(a) * 0.75, 0.12, hz + Math.sin(a) * 0.75, { ry: k, tinta: 0.015 })); }
  for (let k = 0; k < 3; k++) raiz.add(malla(new THREE.CylinderGeometry(0.08, 0.1, 1.2), toon('#3d2f22'), hx, 0.2, hz, { rz: Math.PI / 2 - 0.3, ry: k * 2.1, tinta: 0.015 }));
  const llamaTex = lienzo(128, 256, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h * 0.78, 2, w / 2, h * 0.7, h * 0.55);
    gr.addColorStop(0, 'rgba(255,250,232,1)'); gr.addColorStop(0.35, 'rgba(255,224,170,.8)'); gr.addColorStop(1, 'rgba(255,200,140,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(w / 2, 8); g.quadraticCurveTo(w, h * 0.7, w / 2, h - 4); g.quadraticCurveTo(0, h * 0.7, w / 2, 8); g.fill();
  });
  const llamas = [];
  for (let k = 0; k < 3; k++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.6), new THREE.MeshBasicMaterial({ map: llamaTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(hx, 0.75, hz); m.rotation.y = (k * Math.PI) / 3; raiz.add(m); llamas.push(m);
  }
  const fuego = new THREE.PointLight('#ffd7a0', 9, 16, 1.4);
  fuego.position.set(hx, 1.2, hz); fuego.castShadow = true; fuego.shadow.mapSize.set(512, 512); raiz.add(fuego);
  const chispas = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(60 * 3), 3)), new THREE.PointsMaterial({ color: '#fff0d0', size: 0.06, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const vida = Array.from({ length: 60 }, () => r() * 2);
  raiz.add(chispas);
  vivos.push((t, dt) => {
    llamas.forEach((m, k) => { m.scale.set(1 + Math.sin(t * 9 + k) * 0.08, 1 + Math.sin(t * 13 + k * 2) * 0.14, 1); });
    fuego.intensity = 8 + Math.sin(t * 11) * 1.2 + Math.sin(t * 23) * 0.8;
    const p = chispas.geometry.attributes.position;
    for (let k = 0; k < 60; k++) {
      vida[k] += dt * 0.7; if (vida[k] > 2) vida[k] = 0;
      const v = vida[k];
      p.setXYZ(k, hx + Math.sin(k * 7.3 + v * 2) * 0.3 * v, 0.6 + v * 1.8, hz + Math.cos(k * 3.1 + v) * 0.3 * v);
    }
    p.needsUpdate = true;
  });
  solidos.push({ x: hx, z: hz, r: 1.1 });

  // ---- reparto de raciones: mesa con toldo y cajas
  const rx = 13, rz = -8;
  raiz.add(malla(new THREE.BoxGeometry(3.2, 0.9, 1), toon('#6b5844'), rx, 0.45, rz, { tinta: 0.03 }));
  for (const ax of [-1.5, 1.5]) raiz.add(malla(new THREE.CylinderGeometry(0.05, 0.05, 2.6), toon('#4a3f33'), rx + ax, 1.3, rz - 0.4, { tinta: 0.015 }));
  raiz.add(malla(new THREE.BoxGeometry(3.6, 0.08, 1.8), lonas[2], rx, 2.55, rz + 0.1, { rx: 0.18, tinta: 0.025 }));
  for (let k = 0; k < 5; k++) raiz.add(malla(new THREE.BoxGeometry(0.6, 0.45, 0.45), toon('#7c6a50'), rx - 1.2 + k * 0.6, 1.12, rz - 0.1, { ry: (r() - 0.5) * 0.3, tinta: 0.02 }));
  solidos.push({ x0: rx - 1.7, x1: rx + 1.7, z0: rz - 0.7, z1: rz + 0.6 });
  hablar.push({ x: rx, z: rz + 1.4, radio: 1.6, titulo: 'Reparto de raciones', texto: 'Una ración por persona y día. Sin cartilla no hay ración. Las cartillas se dan en la entrada... cuando hay alguien en la entrada.' });

  // ---- tablon de avisos junto al porton, por dentro
  const tb = new THREE.Group(); tb.position.set(-5.2, 0, -4.2); tb.rotation.y = 0.35;
  for (const ax of [-1.1, 1.1]) tb.add(malla(new THREE.BoxGeometry(0.12, 2.6, 0.12), toon('#4a3f33'), ax, 1.3, 0, { tinta: 0.015 }));
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), toon({ map: tablon() })); panel.position.set(0, 1.85, 0.07); panel.castShadow = true; tb.add(panel);
  raiz.add(tb);
  solidos.push({ x: -5.2, z: -4.2, r: 1.2 });
  hablar.push({ x: -4.6, z: -3.0, radio: 1.7, titulo: 'Tablón de avisos', texto: 'LLEGADAS: la lista se acaba hace años; la última línea está a medio escribir.  ·  BUSCO A mi hermano, Tomas, pelo rojo, vino del hospital.  ·  TURNO DE AGUA: los pares por la mañana.  ·  NO ACERCARSE al bosque: lo naranja se mueve de noche.' });

  // ---- deposito de agua en patas
  const dx = 24, dz = -25;
  for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) raiz.add(malla(new THREE.CylinderGeometry(0.1, 0.12, 4), toon('#4f4a43'), dx + ax * 1.1, 2, dz + az * 1.1, { tinta: 0.015 }));
  raiz.add(malla(new THREE.CylinderGeometry(1.6, 1.6, 2.4, 16), toon('#6f6a62'), dx, 5.2, dz, { tinta: 0.04 }));
  raiz.add(malla(new THREE.ConeGeometry(1.75, 0.7, 16), toon('#5b564e'), dx, 6.75, dz, { tinta: 0.03 }));
  solidos.push({ x: dx, z: dz, r: 1.7 });
  hablar.push({ x: dx, z: dz + 2.2, radio: 1.7, titulo: 'Depósito de agua', texto: 'Alguien ha escrito con tiza en una pata: «HOY SÍ HAY». Debajo, otra letra: «MENTIRA».' });

  // ---- tendederos con ropa entre tiendas
  const trapos = ['#a79f8c', '#7d7f6b', '#8e8576', '#6f7579', '#9c8f78'];
  for (let k = 0; k < 6; k++) {
    const a = sitios[(k * 3) % sitios.length], b = sitios[(k * 3 + 1) % sitios.length];
    if (!a || !b || Math.hypot(a[0] - b[0], a[1] - b[1]) > 9) continue;
    const p0 = new THREE.Vector3(a[0], 2.1, a[1]), p1 = new THREE.Vector3(b[0], 2.1, b[1]);
    const cur = new THREE.QuadraticBezierCurve3(p0, p0.clone().lerp(p1, 0.5).add(new THREE.Vector3(0, -0.45, 0)), p1);
    raiz.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(cur.getPoints(20)), new THREE.LineBasicMaterial({ color: TINTA })));
    for (let i = 1; i < 5; i++) {
      const q = cur.getPoint(i / 5);
      const trapo = malla(new THREE.PlaneGeometry(0.5, 0.65), toon({ color: trapos[(i + k) % 5], side: THREE.DoubleSide }), q.x, q.y - 0.32, q.z, { ry: Math.atan2(p1.x - p0.x, p1.z - p0.z) + Math.PI / 2, tinta: 0 });
      raiz.add(trapo);
      const fase = i + k;
      vivos.push((t) => { trapo.rotation.x = Math.sin(t * 1.7 + fase) * 0.12; });
    }
  }

  // ---- cajas y bidones sueltos
  for (let k = 0; k < 60; k++) {
    const x = (r() - 0.5) * 60, z = -3 - r() * 30;
    if (Math.abs(x) < 4 || sitios.some(([a, b]) => Math.hypot(a - x, b - z) < 2.4) || Math.hypot(x - hx, z - hz) < 3) continue;
    if (r() < 0.5) raiz.add(malla(new THREE.BoxGeometry(0.8, 0.6, 0.6), toon('#7c6a50'), x, 0.3, z, { ry: r() * 3, tinta: 0.025 }));
    else raiz.add(malla(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 12), toon(r() < 0.5 ? '#5d5a52' : '#6e6052'), x, 0.45, z, { tinta: 0.025 }));
    solidos.push({ x, z, r: 0.5 });
  }

  // ---- la gente: figuras dibujadas de pie, sentadas o niños; unas quietas, otras andando entre sitios
  const texRef = {
    de_pie: [0, 1, 2].map((k) => refugiado('de_pie', 30 + k)),
    sentado: [0, 1, 2].map((k) => refugiado('sentado', 40 + k)),
    nino: [0, 1].map((k) => refugiado('nino', 50 + k)),
    hatillo: [0, 1].map((k) => refugiado('hatillo', 60 + k)),
  };
  function persona(tipo, x, z, o = {}) {
    const lista = texRef[tipo];
    const mat = new THREE.MeshBasicMaterial({ map: lista[npcs.length % lista.length], transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
    const alto = 1.75;
    const geo = new THREE.PlaneGeometry(alto * (256 / 384), alto); geo.translate(0, alto / 2, 0);
    const m = new THREE.Mesh(geo, mat); m.position.set(x, 0, z); m.castShadow = true;
    m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: mat.map, alphaTest: 0.4 });
    raiz.add(m);
    const sombra = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.28, depthWrite: false }));
    sombra.rotation.x = -Math.PI / 2; sombra.position.set(x, 0.02, z); raiz.add(sombra);
    const p = { m, sombra, x, z, cara: o.cara || 1, ruta: o.ruta || null, i: 0, vel: o.vel || 0.9, fase: npcs.length * 1.7 };
    npcs.push(p);
    if (o.decir) hablar.push({ x, z, radio: 1.6, titulo: o.quien || 'Refugiado', texto: o.decir, npc: p });
    if (!o.ruta) solidos.push({ x, z, r: 0.35 });
    return p;
  }
  // en torno a la hoguera
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + 0.4;
    persona(k === 3 ? 'nino' : 'sentado', hx + Math.cos(a) * 1.9, hz + Math.sin(a) * 1.9, { cara: Math.cos(a) > 0 ? -1 : 1, ...(k === 1 ? { quien: 'Una mujer junto al fuego', decir: '¿Vienes de la ciudad? Hace mucho que nadie viene de la ciudad. Siéntate si quieres; el fuego es de todos.' } : {}), ...(k === 3 ? { quien: 'Un niño', decir: 'Mi madre dice que el muro se cae a trozos. Ayer se cayó una letra. Ahora pone «BASE DE RE UGIADOS».' } : {}) });
  }
  // la cola de las raciones
  for (let k = 0; k < 5; k++) persona(k === 2 ? 'hatillo' : 'de_pie', rx - 0.5 + k * 0.05, rz + 1.6 + k * 0.85, { cara: -1, ...(k === 0 ? { quien: 'El primero de la cola', decir: 'Llevo aquí desde que amaneció. Si vienes a colarte, ponte detrás de la señora del hatillo.' } : {}) });
  // fuera, sentados contra el muro
  persona('sentado', -21.5, 2.9, { cara: 1, quien: 'Un hombre fuera del muro', decir: 'No me dejaron entrar. Dijeron que traía «la tos». Llevo aquí desde entonces, mirando la puerta.' });
  persona('hatillo', -13, 2.6, { cara: 1 });
  // los que andan
  persona('de_pie', -10, -8, { ruta: [[-10, -8], [-3, -11], [-3, -26], [-12, -30]], vel: 0.8 });
  persona('nino', 4, -20, { ruta: [[4, -20], [9, -16], [3, -9], [-2, -18]], vel: 1.4 });
  persona('hatillo', 2, -32, { ruta: [[2, -32], [2, -5], [-2, -5], [-2, -32]], vel: 0.6 });
  vivos.push((t, dt) => {
    for (const p of npcs) {
      if (p.ruta) {
        const [ax, az] = p.ruta[(p.i + 1) % p.ruta.length];
        const dx = ax - p.x, dz = az - p.z, d = Math.hypot(dx, dz);
        if (d < 0.2) p.i = (p.i + 1) % p.ruta.length;
        else { p.x += (dx / d) * p.vel * dt; p.z += (dz / d) * p.vel * dt; if (Math.abs(dx) > 0.05) p.cara = Math.sign(dx); }
        p.m.position.set(p.x, Math.abs(Math.sin(t * 7 * p.vel + p.fase)) * 0.05, p.z);
        p.sombra.position.set(p.x, 0.02, p.z);
      } else p.m.scale.y = 1 + Math.sin(t * 1.6 + p.fase) * 0.012;
    }
  });

  // ---- la ciudad muerta a lo lejos y el cielo
  const ciudad = new THREE.Mesh(new THREE.PlaneGeometry(420, 105), new THREE.MeshBasicMaterial({ map: ciudadLejana(), transparent: true, fog: false, depthWrite: false }));
  ciudad.position.set(0, 40, -150); raiz.add(ciudad);
  const ciudad2 = ciudad.clone(); ciudad2.position.set(0, 40, 150); ciudad2.rotation.y = Math.PI; raiz.add(ciudad2);

  // ---- motas de polvo en el aire alrededor del 18
  const nm = 400;
  const motas = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(nm * 3), 3)), new THREE.PointsMaterial({ color: '#f3efe6', size: 0.035, transparent: true, opacity: 0.55, depthWrite: false }));
  const semM = Array.from({ length: nm }, () => [r() * 40 - 20, r() * 10, r() * 40 - 20, r() * 6]);
  raiz.add(motas);
  const actualizarMotas = (t, cx, cz) => {
    const p = motas.geometry.attributes.position;
    for (let k = 0; k < nm; k++) {
      const s = semM[k];
      const x = ((s[0] + t * 0.15 + Math.sin(t * 0.3 + s[3]) * 0.5 - cx) % 40 + 60) % 40 - 20 + cx;
      const z = ((s[2] + Math.cos(t * 0.2 + s[3]) * 0.5 - cz) % 40 + 60) % 40 - 20 + cz;
      p.setXYZ(k, x, (s[1] + t * 0.05) % 10, z);
    }
    p.needsUpdate = true;
  };

  return { solidos, hablar, vivos, npcs, porton, actualizarMotas };
}
