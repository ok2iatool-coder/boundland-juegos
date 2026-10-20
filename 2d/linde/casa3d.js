// LA CABANA DE EL LINDE EN 3D DE VERDAD, dentro del juego 2D: el modelo de Meshy (modelo/cabana.glb, de
// tools/cabana_glb.py) dibujado con three.js en un lienzo aparte y pegado en el del juego, detras del decorado y del
// terreno. La camara es en PERSPECTIVA y sigue a la del juego: en el plano del juego (z = 0, el canto delantero de la
// isla de la casa) un metro mide lo mismo que en el 2D, y lo que esta mas al fondo se mueve menos, asi que al avanzar
// la casa gira un poco y se le ven los costados (parallax de verdad, no capas). Encima: la bruma del sitio, el
// contorno de tinta de las piezas pintadas, sus luces (puerta, ventana, farol) y el humo de la chimenea.
// Si no hay WebGL se pinta la foto de la misma casa (img/linde/cabana.webp).
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';

const U = 64, SUELO_U = 19 * 32;                     // u por metro; la cara de arriba de la fila 19 (el suelo)
const X_CASA = (93 + 0.5) * 32 / U;                   // el centro de la cabana: la columna 93 (marca K del mapa)
const D = 16;                                         // de la camara al plano del juego (m): menos = mas parallax
const BRUMA = '#dcd2a2';                              // la bruma de la zona (la de linde/obrero.js por la columna 93)
const xm = (u) => u / U, ym = (v) => (SUELO_U - v) / U, uDe = (x) => x * U, vDe = (y) => SUELO_U - y * U;

export async function crearCasa3D() {
  const base = new URL('../modelo/', import.meta.url);
  const d = await (await fetch(new URL('cabana3d.json', base))).json();
  let renderer = null;
  try {
    const c = document.createElement('canvas');
    renderer = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, premultipliedAlpha: false });
  } catch (e) { renderer = null; }
  if (!renderer) return fallback();
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 0);

  const escena = new THREE.Scene();
  const gltf = await new GLTFLoader().loadAsync(new URL('cabana.glb', base).href);
  const casa = gltf.scene;
  casa.traverse((o) => { if (o.isMesh) { const m = o.material; m.metalness = 0; m.roughness = Math.max(0.75, m.roughness); m.envMapIntensity = 0; } });
  // el canto delantero de la isla en z = 0 (el plano del juego) y su cara de arriba en el suelo del juego
  const S = d.escala * 1.03, grupo = new THREE.Group();
  casa.position.set(0, -d.isla_z, -d.frente); grupo.add(casa);
  grupo.scale.setScalar(S); grupo.position.set(X_CASA, 0, 0);
  escena.add(grupo);
  const enMundo = (p) => new THREE.Vector3(p[0], p[1] - d.isla_z, p[2] - d.frente).multiplyScalar(S).add(grupo.position);

  // luz del bosque: cielo calido, sol de arriba a la izquierda, contraluz, la casa encendida por dentro y el farol
  escena.add(new THREE.HemisphereLight('#cfc7a0', '#2a2618', 0.8));
  const sol = new THREE.DirectionalLight('#ffe2b4', 1.45); sol.position.set(-6, 9, 7); escena.add(sol, sol.target);
  const contra = new THREE.DirectionalLight('#ffe9c4', 0.8); contra.position.set(6, 6, -9); escena.add(contra, contra.target);
  sol.target.position.copy(grupo.position); contra.target.position.copy(grupo.position);
  const pPuerta = enMundo(d.luces.puerta), pVentana = enMundo(d.luces.ventana), pFarol = enMundo(d.luces.farol), pChimenea = enMundo(d.chimenea);
  const dentro = new THREE.PointLight('#ffd08a', 6, 4.5, 2); dentro.position.copy(pPuerta).add(new THREE.Vector3(0.3, 0, -0.9)); escena.add(dentro);
  const farol = new THREE.PointLight('#ffd890', 2.2, 3, 2); farol.position.copy(pFarol).add(new THREE.Vector3(0, 0, 0.2)); escena.add(farol);

  const cam = new THREE.PerspectiveCamera(30, 1, 0.5, 120);
  // la caja de la casa en el mundo (para no dibujar si no se ve y para recortar el pegado)
  const caja = new THREE.Box3().setFromObject(grupo);
  const esquinas = [];
  for (const x of [caja.min.x, caja.max.x]) for (const y of [caja.min.y, caja.max.y]) for (const z of [caja.min.z, caja.max.z]) esquinas.push(new THREE.Vector3(x, y, z));
  const tmp = document.createElement('canvas'), sil = document.createElement('canvas');
  const tx = tmp.getContext('2d'), sx = sil.getContext('2d');
  const v = new THREE.Vector3();
  const aPantalla = (p, W, H) => { v.copy(p).project(cam); return [(v.x * 0.5 + 0.5) * W, (0.5 - v.y * 0.5) * H]; };

  return {
    // vista = { x, y, w, h } en u (la del juego), s = px por u, W x H el lienzo
    dibujar(ctx, vista, s, W, H, t) {
      const cxm = xm(vista.x + vista.w / 2), hm = vista.h / U;
      if (Math.abs(cxm - X_CASA) > vista.w / U / 2 + 7) return;
      cam.position.set(cxm, ym(vista.y + vista.h / 2), D);
      cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(hm / 2 / D)); cam.aspect = vista.w / vista.h; cam.updateProjectionMatrix();
      cam.lookAt(cam.position.x, cam.position.y, 0); cam.updateMatrixWorld();
      const c = renderer.domElement;
      if (c.width !== W || c.height !== H) renderer.setSize(W, H, false);
      dentro.intensity = 6 * (0.9 + 0.08 * Math.sin(t * 7) * Math.sin(t * 2.3));
      farol.intensity = 2.2 * (0.85 + 0.12 * Math.sin(t * 11) * Math.sin(t * 3.7));
      renderer.render(escena, cam);
      // el rectangulo de pantalla que ocupa la casa
      let x0 = W, y0 = H, x1 = 0, y1 = 0;
      for (const e of esquinas) { const [a, b] = aPantalla(e, W, H); x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, a); y1 = Math.max(y1, b); }
      x0 = Math.max(0, Math.floor(x0) - 4); y0 = Math.max(0, Math.floor(y0) - 4); x1 = Math.min(W, Math.ceil(x1) + 4); y1 = Math.min(H, Math.ceil(y1) + 4);
      const w = x1 - x0, h = y1 - y0; if (w < 2 || h < 2) return;
      if (tmp.width !== w || tmp.height !== h) { tmp.width = sil.width = w; tmp.height = sil.height = h; }
      // la casa con la bruma del sitio encima (solo donde hay casa)
      tx.globalCompositeOperation = 'copy'; tx.drawImage(c, x0, y0, w, h, 0, 0, w, h);
      tx.globalCompositeOperation = 'source-atop'; tx.globalAlpha = 0.14; tx.fillStyle = BRUMA; tx.fillRect(0, 0, w, h); tx.globalAlpha = 1;
      // su silueta en tinta, para el contorno
      sx.globalCompositeOperation = 'copy'; sx.drawImage(tmp, 0, 0);
      sx.globalCompositeOperation = 'source-in'; sx.fillStyle = '#0b0a0c'; sx.fillRect(0, 0, w, h);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      const k = Math.max(1, Math.round(s * 1.6));
      ctx.globalAlpha = 0.7;
      for (const [dx, dy] of [[-k, 0], [k, 0], [0, -k], [0, k], [-k, -k], [k, -k], [-k, k], [k, k]]) ctx.drawImage(sil, x0 + dx * 0.8, y0 + dy * 0.8);
      ctx.globalAlpha = 1; ctx.drawImage(tmp, x0, y0);
      // humo de la chimenea: manchas que suben, se abren y se van
      const [hx, hy] = aPantalla(pChimenea, W, H);
      for (let n = 0; n < 7; n++) {
        const f = (t * 0.12 + n / 7) % 1, r = (12 + f * 46) * s, a = 0.13 * Math.sin(Math.PI * f);
        const gx = hx + (f * 40 + Math.sin(t * 0.6 + n) * 10) * s, gy = hy - f * 170 * s;
        const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, r); gr.addColorStop(0, `rgba(170,166,150,${a})`); gr.addColorStop(1, 'rgba(170,166,150,0)');
        ctx.fillStyle = gr; ctx.fillRect(gx - r, gy - r, r * 2, r * 2);
      }
      // brillos (puerta, ventana redonda, farol), que respiran como sus luces
      ctx.globalCompositeOperation = 'lighter';
      for (const [p, rad, a] of [[pPuerta, 70, 0.22 * dentro.intensity / 6], [pVentana, 40, 0.14], [pFarol, 55, 0.32 * farol.intensity / 2.2]]) {
        const [gx, gy] = aPantalla(p, W, H), r = rad * s;
        const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, r); gr.addColorStop(0, `rgba(255,214,140,${a})`); gr.addColorStop(1, 'rgba(255,214,140,0)');
        ctx.fillStyle = gr; ctx.fillRect(gx - r, gy - r, r * 2, r * 2);
      }
      ctx.restore();
    },
  };
}

// sin WebGL: la foto de la misma casa, quieta (img/linde/cabana.webp, 1 px = 1 px del concepto = 64 / 175 u)
async function fallback() {
  const base = new URL('../img/linde/', import.meta.url);
  const d = await (await fetch(new URL('cabana.json', base))).json();
  const im = new Image(); im.src = new URL('cabana.webp', base).href; await im.decode();
  const PXU = (0.52 * 336.4) / 64;
  return {
    dibujar(ctx) { ctx.drawImage(im, uDe(X_CASA) - d.ancla[0] / PXU, vDe(0) - d.ancla[1] / PXU, d.ancho / PXU, d.alto / PXU); },
  };
}
