// El MAPA: el bosque del video de referencia (escuela/obras/sujeto18_3d/referencia/video_gemini.mp4): niebla calida,
// arboles enormes al lado del 18 (mide 1 m), un camino empedrado que serpentea, columnas de sillares con musgo, un arco
// en ruina, muros caidos, helechos, hierba, rocas, haces de sol y motas en el aire.
// Devuelve la altura del suelo y los CHOQUES (circulos y cajas en planta) que usa el heroe.
import * as THREE from 'three';
import * as T from './texturas.js';
import { crearVida, meceMaterial } from './bosque_vida.js';
import { crearEmpedrado, levante } from './empedrado3d.js';
import { crearRejilla, crearMascara, crearSuelo } from './suelo_bosque.js';
import { crearHojarasca } from './hojarasca3d.js';

export const LADO = 60;                       // el mapa va de -LADO a +LADO en X y Z (m)

// ---------------- el camino ----------------
const PUNTOS = [[-56, 22], [-42, 15], [-28, 18], [-14, 9], [-4, 2], [6, -2], [16, 3], [27, -6], [36, -16], [47, -18], [57, -30]];
const curva = new THREE.CatmullRomCurve3(PUNTOS.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
const CAMINO = curva.getSpacedPoints(400);
const ANCHO_CAMINO = 2.6;

export function distCamino(x, z) {
  let mejor = 1e9, t = 0;
  for (let i = 0; i < CAMINO.length - 1; i++) {
    const a = CAMINO[i], b = CAMINO[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const k = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    const px = a.x + dx * k - x, pz = a.z + dz * k - z;
    const d = px * px + pz * pz;
    if (d < mejor) { mejor = d; t = (i + k) / (CAMINO.length - 1); }
  }
  return { d: Math.sqrt(mejor), t };
}

const suave = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// el relieve LISO: lomas suaves que se aplanan junto al camino (el camino del video va casi a nivel). Desde el 21-10 no
// se pisa directamente: con los baches pequenos se hornea en la rejilla de 25 cm (suelo_bosque.js), que es `altura`
function alturaLisa(x, z, dc = null) {
  const d = dc ?? distCamino(x, z).d;
  const h = 0.9 * Math.sin(x * 0.055 + 0.7) * Math.cos(z * 0.048) + 0.35 * Math.sin(x * 0.16 + 1.3) * Math.sin(z * 0.13 + 0.4)
    + 0.12 * Math.sin(x * 0.41) * Math.cos(z * 0.37 + 2.1);
  return h * (0.25 + 0.75 * suave(2.5, 9, d));
}

// el medio ancho del camino a cada lado ([izquierda, derecha] respecto al avance) a `largo` m del principio: el
// empedrado se pierde en la hierba con un borde que ondula (por METROS de camino: por indice de tramo, 0,35 m, el borde
// salia en dientes de sierra)
export function anchoCamino(largo) {
  return [ANCHO_CAMINO / 2 * (1 + 0.1 * Math.sin(largo * 0.45) + 0.05 * Math.sin(largo * 1.3 + 1)),
    ANCHO_CAMINO / 2 * (1 + 0.1 * Math.sin(largo * 0.38 + 2) + 0.05 * Math.sin(largo * 1.1 + 4))];
}

// la altura que PISA el 18: la del terreno y, en el camino, encima de las piedras (empedrado3d.js)
const LARGO_CAMINO = curva.getLength();
export function alturaPisada(x, z) {
  const { d, t } = distCamino(x, z);
  const h = altura(x, z, d);
  if (d > ANCHO_CAMINO) return h;
  const [a, b] = anchoCamino(t * LARGO_CAMINO);
  return h + levante(d, (a + b) / 2);
}

// la REJILLA (21-10): relieve liso + baches de 2-5 cm, menos en el empedrado; se hace una vez al cargar el modulo
const REJILLA = crearRejilla({
  muestra: (x, z) => { const d = distCamino(x, z).d; return [alturaLisa(x, z, d), 1 - suave(ANCHO_CAMINO / 2 + 0.15, ANCHO_CAMINO / 2 + 0.9, d)]; },
  lado: 75, paso: 0.25, azar: T.azar(99),
});
// la altura del terreno (sin las piedras del camino): bilineal de la rejilla, la misma cuenta que el sombreador del suelo
export function altura(x, z) { return REJILLA.altura(x, z); }

export function puntoCamino(t) {
  const p = curva.getPointAt(Math.max(0, Math.min(1, t)));
  const tg = curva.getTangentAt(Math.max(0, Math.min(1, t)));
  return { x: p.x, z: p.z, tx: tg.x, tz: tg.z };
}

export function crearMundo(scene) {
  const r = T.azar(42);
  const choques = { circulos: [], cajas: [] };
  const grupo = new THREE.Group();
  scene.add(grupo);

  // niebla y cielo. 21-10 («hazlo mas bonito, ambiente 0 tenebroso»): ya no es el verde lechoso y espeso del video
  // (0,038: a 25 m la mitad era niebla) sino una bruma fina y clara de manana de sol, con cielo azul entre las copas
  const NIEBLA = new THREE.Color(0xd2e2cf);
  scene.background = NIEBLA.clone();
  scene.fog = new THREE.FogExp2(NIEBLA, 0.015);
  const bovedaCielo = new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), new THREE.ShaderMaterial({
    uniforms: { uArriba: { value: new THREE.Color(0x7fb8e8) }, uAbajo: { value: NIEBLA.clone() } },
    vertexShader: 'varying vec3 vD; void main() { vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uArriba, uAbajo; varying vec3 vD;
      void main() { float y = normalize(vD).y; gl_FragColor = vec4(mix(uAbajo, uArriba, smoothstep(0.02, 0.55, y)), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  }));
  bovedaCielo.renderOrder = -10;
  bovedaCielo.frustumCulled = false;
  scene.add(bovedaCielo);

  // luces: sol de media manana, dorado, y un cielo que rellena con azul claro y rebota verde del prado
  const cielo = new THREE.HemisphereLight(0xe2f0ff, 0x6f8f3e, 1.65);
  const sol = new THREE.DirectionalLight(0xffe2a6, 3.2);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { near: 1, far: 80, left: -14, right: 14, top: 14, bottom: -14 });
  sol.shadow.bias = -0.0006;
  sol.shadow.normalBias = 0.02;
  scene.add(cielo, sol, sol.target);
  const DIR_SOL = new THREE.Vector3(-0.55, 0.62, 0.56).normalize();
  const _ejeU = new THREE.Vector3().crossVectors(DIR_SOL, new THREE.Vector3(0, 1, 0)).normalize();
  const _ejeV = new THREE.Vector3().crossVectors(_ejeU, DIR_SOL).normalize();
  const _foco = new THREE.Vector3();

  // (el SUELO va mas abajo, despues de los arboles: su mascara pone hojarasca debajo de ellos)

  // ---------------- camino empedrado ----------------
  // 21-10: ya no hay CINTA debajo de las piedras (la junta pintada, luego de foto): con el suelo de tierra de verdad
  // (suelo_bosque.js, tierra pisada en el camino) las piedras se asientan en el terreno y la cinta oscura asomaba como
  // un marco en los bordes, donde las piedras se ralean. Las piedras en 3D van en empedrado3d.js (mas abajo).

  // ---------------- ruinas: columnas de sillares, un arco, muros caidos ----------------
  const texSillar = T.sillar();
  const matPiedra = new THREE.MeshLambertMaterial({ map: texSillar });
  const cajaGeo = new THREE.BoxGeometry(1, 1, 1);
  const sillares = [];          // [x, y, z, sx, sy, sz, giro]
  const ruinas = [];            // centros para no plantar arboles encima
  const columnas = [];          // para la hiedra (bosque_vida.js)
  let arco = null;
  function columna(x, z, bloques, lado = 0.72, giro = r() * 0.6, fijo = null) {
    // fijo = Y de la base: las dos columnas del arco arrancan igual y con sillares iguales, asi acaban a la MISMA
    // altura (con alturas al azar el arco quedaba flotando sobre la mas baja)
    const y0 = fijo ?? altura(x, z) - 0.15;
    let y = y0;
    // basa mas ancha
    sillares.push([x, y + 0.2, z, lado * 1.35, 0.4, lado * 1.35, giro]);
    y += 0.4;
    for (let k = 0; k < bloques; k++) {
      const rh = r(), rx = r(), rz = r(), r1 = r(), r2 = r(), rg = r();
      const h = fijo != null ? 0.68 : 0.62 + rh * 0.12;
      const j = fijo != null ? 0 : 1;
      sillares.push([x + (rx - 0.5) * 0.06 * j, y + h / 2, z + (rz - 0.5) * 0.06 * j, lado * (0.96 + r1 * 0.06 * j), h,
        lado * (0.96 + r2 * 0.06 * j), giro + (rg - 0.5) * 0.08 * j]);
      y += h + 0.015;
    }
    choques.circulos.push({ x, z, r: lado * 0.75 });
    ruinas.push([x, z]);
    columnas.push({ x, z, y0, yTop: y, lado, giro });
    return y;
  }
  function muro(x, z, ang, largo, alto) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const n = Math.round(largo / 0.9);
    for (let i = 0; i < n; i++) {
      const s = (i - (n - 1) / 2) * 0.9;
      const bx = x + ca * s, bz = z + sa * s;
      const filas = Math.max(1, Math.round(alto * (0.4 + 0.6 * Math.abs(Math.sin(i * 1.7 + x)))));
      let y = altura(bx, bz) - 0.1;
      for (let f = 0; f < filas; f++) {
        sillares.push([bx, y + 0.27, bz, 0.86, 0.54, 0.6, -ang + (r() - 0.5) * 0.06]);
        y += 0.55;
      }
    }
    choques.cajas.push({ x, z, hx: largo / 2 + 0.1, hz: 0.38, ang });
    ruinas.push([x, z]);
  }
  // columnas a los lados del camino, por parejas, algunas rotas
  for (const t of [0.07, 0.19, 0.33, 0.6, 0.74, 0.9]) {
    const p = puntoCamino(t);
    const nx = -p.tz, nz = p.tx;
    for (const s of [-1, 1]) {
      const d = ANCHO_CAMINO / 2 + 1.1 + r() * 0.8;
      columna(p.x + nx * s * d, p.z + nz * s * d, r() < 0.35 ? 1 + Math.floor(r() * 2) : 4 + Math.floor(r() * 3));
    }
  }
  // el ARCO sobre el camino (t = 0.47)
  {
    const p = puntoCamino(0.47);
    const nx = -p.tz, nz = p.tx;
    const vano = ANCHO_CAMINO / 2 + 0.9;
    const giro = Math.atan2(nx, nz);
    const base = Math.min(altura(p.x + nx * vano, p.z + nz * vano), altura(p.x - nx * vano, p.z - nz * vano)) - 0.15;
    const hb = columna(p.x + nx * vano, p.z + nz * vano, 6, 0.8, giro, base);
    columna(p.x - nx * vano, p.z - nz * vano, 6, 0.8, giro, base);
    arco = { x: p.x, z: p.z, nx, nz, vano, hb, giro };
    // semicirculo de radio = vano, con el centro a la altura de las columnas: la primera dovela apoya en su cabeza
    // (antes iba 0,3 m por encima y en elipse, con las dovelas giradas como en circulo: flotaba)
    const dov = 11;
    for (let k = 0; k < dov; k++) {
      const a = Math.PI * (k + 0.5) / dov;
      const rx = Math.cos(a) * vano, ry = Math.sin(a) * vano;
      // cada dovela inclinada a lo largo del arco: giro sobre el eje del camino (Euler YXZ, X en local tras el giro)
      sillares.push([p.x + nx * rx, hb + ry, p.z + nz * rx, 0.8, 0.5, vano * Math.PI / dov * 1.06, giro, Math.PI / 2 - a]);
    }
  }
  // muros caidos y bloques sueltos fuera del camino
  for (const [t, s, dist, largo, alto] of [[0.12, 1, 5, 4.5, 2], [0.27, -1, 6, 6, 3], [0.42, 1, 7, 3.6, 1], [0.56, -1, 5.5, 5, 2], [0.69, 1, 6, 4, 2], [0.84, -1, 6.5, 5.5, 3]]) {
    const p = puntoCamino(t);
    const nx = -p.tz, nz = p.tx;
    muro(p.x + nx * s * dist, p.z + nz * s * dist, Math.atan2(p.tz, p.tx) + (r() - 0.5) * 0.6, largo, alto);
  }
  for (let i = 0; i < 26; i++) {
    const t = r(), p = puntoCamino(t), nx = -p.tz, nz = p.tx, s = r() < 0.5 ? -1 : 1, d = ANCHO_CAMINO / 2 + 0.6 + r() * 4;
    const x = p.x + nx * s * d, z = p.z + nz * s * d, h = 0.4 + r() * 0.3;
    sillares.push([x, altura(x, z) + h / 2 - 0.08, z, 0.6 + r() * 0.5, h, 0.5 + r() * 0.3, r() * Math.PI]);
    if (h > 0.5) choques.circulos.push({ x, z, r: 0.35 });
  }
  {
    const im = new THREE.InstancedMesh(cajaGeo, matPiedra, sillares.length);
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    sillares.forEach(([x, y, z, sx, sy, sz, gy, rx], i) => {
      e.set(rx ?? (r() - 0.5) * 0.04, gy, (r() - 0.5) * 0.04, 'YXZ');
      q.setFromEuler(e);
      mt.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
      im.setMatrixAt(i, mt);
    });
    im.castShadow = im.receiveShadow = true;
    grupo.add(im);
  }

  // ---------------- arboles ----------------
  // el CLARO soleado (21-10): sin arboles ni helechos y lleno de flores, a un lado del camino
  const claro = (() => { const p = puntoCamino(0.58); return { x: p.x + p.tz * 9.5, z: p.z - p.tx * 9.5, r: 6.5 }; })();
  const enClaro = (x, z, m = 0) => Math.hypot(x - claro.x, z - claro.z) < claro.r + m;
  const arboles = [];
  const libre = (x, z, dmin) => {
    for (const [ax, az] of ruinas) if (Math.hypot(ax - x, az - z) < 3) return false;
    for (const a of arboles) if (Math.hypot(a.x - x, a.z - z) < dmin) return false;
    return true;
  };
  let intentos = 0;
  while (arboles.length < 260 && intentos++ < 8000) {
    const x = (r() * 2 - 1) * (LADO + 10), z = (r() * 2 - 1) * (LADO + 10);
    const { d } = distCamino(x, z);
    if (d < ANCHO_CAMINO / 2 + 2.2) continue;
    // mas espeso lejos del camino
    if (d < 7 && r() < 0.55) continue;
    if (!libre(x, z, 3.2) || enClaro(x, z, 1.5)) continue;
    // uno de cada cuatro, ABEDUL: tronco blanco y fino, copa clara (21-10)
    const abedul = r() < 0.27;
    const rb = abedul ? 0.16 + r() * 0.1 : 0.32 + r() * 0.42, h = abedul ? 9 + r() * 5 : 11 + r() * 9;
    arboles.push({ x, z, rb, h, y: altura(x, z, d), abedul });
  }
  {
    const texC = T.corteza();
    texC.repeat.set(2, 9);
    const tronco = new THREE.CylinderGeometry(0.62, 1, 1, 12, 6, true);
    tronco.translate(0, 0.5, 0);
    // raiz: el pie del tronco se abre
    const p = tronco.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), k = 1 + 0.55 * Math.pow(Math.max(0, 1 - y * 8), 2);
      p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k);
    }
    tronco.computeVertexNormals();
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion();
    const texB = T.abedul();
    texB.repeat.set(1, 4);
    for (const [lista, mat] of [[arboles.filter((a) => !a.abedul), new THREE.MeshLambertMaterial({ map: texC })],
      [arboles.filter((a) => a.abedul), new THREE.MeshLambertMaterial({ map: texB })]]) {
      const im = new THREE.InstancedMesh(tronco, mat, lista.length);
      lista.forEach((a, i) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI * 2);
        mt.compose(new THREE.Vector3(a.x, a.y - 0.2, a.z), q, new THREE.Vector3(a.rb, a.h, a.rb));
        im.setMatrixAt(i, mt);
        choques.circulos.push({ x: a.x, z: a.z, r: a.rb + 0.12 });
      });
      im.castShadow = im.receiveShadow = true;
      grupo.add(im);
    }
    // copas: racimos de bultos altos (el techo del bosque deja pasar el sol a manchas)
    const texH = T.hojas('#5f8a36');
    texH.repeat.set(2, 2);
    const bulto = new THREE.IcosahedronGeometry(1, 2);
    const bp = bulto.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const v = new THREE.Vector3(bp.getX(i), bp.getY(i), bp.getZ(i));
      const k = 1 + 0.18 * Math.sin(v.x * 5.1) * Math.cos(v.y * 4.3 + v.z * 3.7);
      bp.setXYZ(i, v.x * k, v.y * k * 0.8, v.z * k);
    }
    bulto.computeVertexNormals();
    const copas = [];
    for (const a of arboles) {
      // el abedul: copa mas pequena, mas alta y mas clara
      const n = a.abedul ? 3 + Math.floor(r() * 3) : 4 + Math.floor(r() * 4);
      for (let k = 0; k < n; k++) {
        const ang = r() * Math.PI * 2, rad = a.abedul ? 0.6 + r() * 1.4 : 1 + r() * 2.6;
        copas.push([a.x + Math.cos(ang) * rad, a.y + a.h * (a.abedul ? 0.66 + r() * 0.34 : 0.72 + r() * 0.3), a.z + Math.sin(ang) * rad,
          a.abedul ? 1.2 + r() * 1.1 : 1.8 + r() * 1.8, a.abedul]);
      }
      // alguna rama baja suelta
      if (r() < 0.4) copas.push([a.x + (r() - 0.5) * 3, a.y + a.h * (0.45 + r() * 0.15), a.z + (r() - 0.5) * 3, 1 + r() * 0.8, a.abedul]);
    }
    const imc = new THREE.InstancedMesh(bulto, new THREE.MeshLambertMaterial({ map: texH, color: 0xe4f0c4 }), copas.length);
    const col = new THREE.Color();
    copas.forEach(([x, y, z, s, ab], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28);
      mt.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s));
      imc.setMatrixAt(i, mt);
      // verdes vivos (21-10): antes casi grises (saturacion 0,35, luz 0,32)
      if (ab) col.setHSL(0.19 + r() * 0.04, 0.55 + r() * 0.15, 0.5 + r() * 0.1);
      else col.setHSL(0.22 + r() * 0.07, 0.45 + r() * 0.2, 0.38 + r() * 0.12);
      imc.setColorAt(i, col);
    });
    imc.castShadow = true;
    grupo.add(imc);
  }

  // ---------------- el SUELO de tierra de verdad (suelo_bosque.js) y lo que hay tirado (hojarasca3d.js) ----------------
  const MASCARA = crearMascara({ lado: 75, paso: 0.5, distCamino, anchoCamino: ANCHO_CAMINO / 2, arboles, claro });
  const sueloReal = crearSuelo({ grupo, rejilla: REJILLA, mascara: MASCARA });
  const tirado = crearHojarasca({ grupo, altura, mascara: MASCARA.mascara, distCamino: (x, z) => distCamino(x, z), anchoCamino: ANCHO_CAMINO / 2, LADO, azar: T.azar, corteza: T.corteza() });

  // ---------------- helechos, hierba y rocas ----------------
  function roseta(tex, hojasN, ancho, alto, inclina) {
    const g = new THREE.BufferGeometry();
    const vs = [], uvs = [], idx = [];
    for (let k = 0; k < hojasN; k++) {
      const a = k / hojasN * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      // fronda: de la base (0,0) hacia fuera y arriba, inclinada
      const fx = ca * Math.sin(inclina) * alto, fy = Math.cos(inclina) * alto, fz = sa * Math.sin(inclina) * alto;
      const px = -sa * ancho / 2, pz = ca * ancho / 2;
      const b = vs.length / 3;
      vs.push(px, 0, pz, -px, 0, -pz, -px + fx, fy, -pz + fz, px + fx, fy, pz + fz);
      uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return new THREE.Mesh(g, meceMaterial(new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide }), 0.07));
  }
  function sembrar(malla, n, filtro, escala) {
    const im = new THREE.InstancedMesh(malla.geometry, malla.material, n);
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion();
    let i = 0, intentos = 0;
    while (i < n && intentos++ < n * 30) {
      const x = (r() * 2 - 1) * LADO, z = (r() * 2 - 1) * LADO;
      const dc = distCamino(x, z).d;
      if (!filtro(dc, x, z)) continue;
      const s = escala[0] + r() * (escala[1] - escala[0]);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28);
      mt.compose(new THREE.Vector3(x, altura(x, z, dc) - 0.03, z), q, new THREE.Vector3(s, s, s));
      im.setMatrixAt(i++, mt);
    }
    im.count = i;
    im.receiveShadow = true;
    grupo.add(im);
    return im;
  }
  const helecho = roseta(T.helecho(), 7, 0.55, 0.95, 0.95);
  sembrar(helecho, 1500, (d, x, z) => d > ANCHO_CAMINO / 2 + 0.3 && !enClaro(x, z) && (d < 7 || r() < 0.45), [0.55, 1.35]);
  const hierba = roseta(T.hierba(), 3, 0.5, 0.42, 0.25);
  // la hierba de cruces, solo donde el suelo es hierba (la mascara), y de un verde apagado de verdad
  hierba.material.color.set(0xc4c8a0);
  helecho.material.color.set(0xb4bc98);
  sembrar(hierba, 6500, (d, x, z) => d > ANCHO_CAMINO / 2 - 0.2 && r() < 0.1 + MASCARA.mascara(x, z)[2] * 1.2, [0.6, 1.5]);
  {
    const roca = new THREE.IcosahedronGeometry(1, 1);
    const rp = roca.attributes.position;
    for (let i = 0; i < rp.count; i++) {
      const k = 0.75 + 0.35 * Math.abs(Math.sin(rp.getX(i) * 3.1 + rp.getZ(i) * 2.3));
      rp.setXYZ(i, rp.getX(i) * k, rp.getY(i) * k * 0.6, rp.getZ(i) * k);
    }
    roca.computeVertexNormals();
    const rocas = [];
    while (rocas.length < 70) {
      const x = (r() * 2 - 1) * LADO, z = (r() * 2 - 1) * LADO, dc = distCamino(x, z).d;
      if (dc < ANCHO_CAMINO / 2 + 0.6) continue;
      rocas.push([x, z, 0.15 + Math.pow(r(), 2) * 0.9, dc]);
    }
    const im = new THREE.InstancedMesh(roca, matPiedra, rocas.length);
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion();
    rocas.forEach(([x, z, s, dc], i) => {
      q.setFromEuler(new THREE.Euler(r() * 0.4, r() * 6.28, r() * 0.4));
      mt.compose(new THREE.Vector3(x, altura(x, z, dc) - s * 0.15, z), q, new THREE.Vector3(s, s, s));
      im.setMatrixAt(i, mt);
      if (s > 0.4) choques.circulos.push({ x, z, r: s * 0.8 });
    });
    im.castShadow = im.receiveShadow = true;
    grupo.add(im);
  }

  // ---------------- las piedras del camino, en 3D ----------------
  const empedrado = crearEmpedrado({ grupo, curva, altura, ancho: anchoCamino });

  // ---------------- la vida: flores, setas, arbustos, hiedra, mariposas (bosque_vida.js) ----------------
  const vida = crearVida({ grupo, r, altura, distCamino, ANCHO_CAMINO, LADO, claro, arboles, columnas, arco, choques });

  // ---------------- haces de sol y motas ----------------
  const rayos = new THREE.Group();
  {
    const tex = T.rayo();
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0xffe6a8, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    for (let i = 0; i < 22; i++) {
      const t = r(), p = puntoCamino(t), x = p.x + (r() - 0.5) * 24, z = p.z + (r() - 0.5) * 24;
      const alto = 18 + r() * 10, ancho = 1.5 + r() * 3;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), mat);
      m.position.set(x - DIR_SOL.x * alto * 0.25, altura(x, z) + alto * 0.42, z - DIR_SOL.z * alto * 0.25);
      // inclinado hacia el sol
      m.lookAt(m.position.clone().add(new THREE.Vector3(DIR_SOL.z, 0, -DIR_SOL.x)));
      m.rotateZ(0.42);
      m.userData.fase = r() * 6.28;
      rayos.add(m);
    }
    grupo.add(rayos);
  }
  const motas = (() => {
    const n = 500, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { p[i * 3] = (r() * 2 - 1) * 14; p[i * 3 + 1] = r() * 5; p[i * 3 + 2] = (r() * 2 - 1) * 14; }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    // punto REDONDO y difuso: con el punto cuadrado por defecto, cerca de la camara se veian cuadrados blancos
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const gc = c.getContext('2d'), gr = gc.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    gc.fillStyle = gr; gc.fillRect(0, 0, 32, 32);
    const m = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff1c0, size: 0.03, map: new THREE.CanvasTexture(c), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    // las motas viven en coordenadas del mundo y siguen al heroe: la esfera de recorte se calcula UNA vez (alrededor
    // del origen) y, lejos de el, three las recortaba todas y desaparecian
    m.frustumCulled = false;
    grupo.add(m);
    return m;
  })();

  let tAntes = 0;
  function actualizar(t, foco) {
    vida.actualizar(t, Math.min(0.1, Math.max(0, t - tAntes)), foco);
    empedrado.actualizar(foco);
    sueloReal.actualizar(foco);
    tirado.actualizar(foco);
    tAntes = t;
    bovedaCielo.position.set(foco.x, 0, foco.z);
    // el sol y su sombra siguen al heroe (la caja de sombra es pequena y nitida)
    // ajustado a la rejilla de texeles del mapa de sombras en el plano de la luz: si la caja se mueve medio texel
    // cada fotograma, los bordes de todas las sombras tiemblan al andar
    const texel = (sol.shadow.camera.right - sol.shadow.camera.left) / sol.shadow.mapSize.x;
    const u = _ejeU.dot(foco), v = _ejeV.dot(foco);
    _foco.copy(foco).addScaledVector(_ejeU, Math.round(u / texel) * texel - u).addScaledVector(_ejeV, Math.round(v / texel) * texel - v);
    sol.position.copy(_foco).addScaledVector(DIR_SOL, 40);
    sol.target.position.copy(_foco);
    for (const m of rayos.children) m.material.opacity = 0.15;
    rayos.children.forEach((m, i) => { m.scale.x = 1 + 0.08 * Math.sin(t * 0.4 + m.userData.fase); });
    // motas alrededor del heroe, a la deriva. Cada una vive en coordenadas del mundo y se envuelve SOLA cuando se
    // aleja mas de 14 m (antes se movia la nube entera a saltos de 2 m y se veian brincar todas a la vez)
    const p = motas.geometry.attributes.position;
    const suelo = altura(foco.x, foco.z);
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i) + 0.0015 * Math.sin(t * 0.7 + i * 1.3), z = p.getZ(i);
      while (x - foco.x > 14) x -= 28;
      while (x - foco.x < -14) x += 28;
      while (z - foco.z > 14) z -= 28;
      while (z - foco.z < -14) z += 28;
      let y = p.getY(i) + 0.002 + 0.0015 * Math.sin(t + i);
      while (y > suelo + 5) y -= 5;
      while (y < suelo - 0.2) y += 5;
      p.setXYZ(i, x, y, z);
    }
    p.needsUpdate = true;
  }

  const p0 = puntoCamino(0.02);
  return {
    // altura = lo que pisa el 18 (encima de las piedras del camino); alturaTerreno, el suelo sin ellas (la auditoria del
    // camino mira que el terreno no asome por encima de la junta)
    LADO, altura: alturaPisada, alturaTerreno: altura, choques, actualizar, sol, puntoCamino, distCamino,
    salida: { x: p0.x, z: p0.z, giro: Math.atan2(p0.tx, p0.tz) },
    conectar({ renderer }) { if (renderer) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25; } },
    info: { arboles: arboles.length, abedules: arboles.filter((a) => a.abedul).length, sillares: sillares.length, circulos: choques.circulos.length, cajas: choques.cajas.length, ...vida.info, ...empedrado.info, ...tirado.info },
  };
}
