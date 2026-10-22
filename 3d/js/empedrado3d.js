// EL EMPEDRADO EN 3D (21-10, «el suelo de piedras, mas detallado, con piedras con profundidad, en 3d, que se vea
// bien»; segunda pasada el mismo dia, «haz otras mas pequenas, busca alguna imagen»): cada piedra es una malla de verdad
// con su sombra, puesta en hileras a lo largo del camino; entre ellas asoma la tierra del suelo.
//
// REFERENCIA: referencia/empedrado/Old_cobbles_stones.jpg (Wikimedia Commons, «Old cobbles stones», dominio publico),
// un adoquinado viejo de granito visto desde arriba. De ella, MEDIDO con PIL:
//   - las piedras son casi CUADRADAS con las esquinas redondeadas y la cara de arriba casi plana (no cantos redondos)
//   - de tamanos muy distintos en la misma hilera, con piedras pequenas de relleno
//   - seis tonos de granito (gris, gris calido, rosado, ocre, gris azulado y claro): PALETA de abajo
//   - la junta es el 12 % de la superficie, tierra pardo-oliva (0,33 0,28 0,15) con musgo, chinas blancas y briznas
// Lo que se hace:
//   - tres formas (torno de perfil plano y seccion de superelipse de grado 4, con ruido distinto en cada una)
//   - hileras de 13-24 cm de fondo; en cada una, piedras de 11-27 cm a matajunta; una de cada siete partida en dos
//     pequenas; en el borde se pierden en la hierba con el mismo ancho que la cinta
//   - CHINAS sueltas en las juntas y MATAS de hierba que salen entre las piedras
//   - por TRAMOS de 8 m: solo se dibujan los tramos a menos de 60 m del 18 (mas alla, la cinta en la bruma)
// `levante(d, ancho)` da lo que suben las piedras sobre el terreno a una distancia d del eje: lo usa la altura que pisa
// el 18 (mundo.js), asi los pies apoyan en las piedras y no 5 cm dentro.
import * as THREE from 'three';
import { azar } from './texturas.js';

// la junta: desde el 21-10 no hay cinta, la tierra del suelo (suelo_bosque.js) hace de junta; las piedras, en el terreno
export const JUNTA = 0;
const LOMO = 0.048;                  // la cara de arriba de una piedra media, sobre la junta

// el levante medio del suelo pisable sobre el terreno: junta + lomo dentro, cayendo en el borde
export function levante(d, ancho) {
  const t = Math.max(0, Math.min(1, (d - (ancho - 0.25)) / 0.3));
  return JUNTA + LOMO * (1 - t * t * (3 - 2 * t));
}

// los tonos de la foto (sRGB) con su peso: gris, gris calido, rosado, ocre, gris azulado, claro
const PALETA = [
  [[0.64, 0.61, 0.58], 0.26], [[0.70, 0.63, 0.58], 0.2], [[0.72, 0.55, 0.52], 0.14],
  [[0.68, 0.57, 0.42], 0.14], [[0.52, 0.54, 0.57], 0.14], [[0.82, 0.80, 0.76], 0.12],
];

// una forma de adoquin: torno de perfil plano arriba, seccion casi cuadrada (superelipse de grado 4), con ruido propio
function piedra(sem) {
  const r = azar(sem);
  const perfil = [[0.0, -0.4], [0.9, -0.4], [1.0, -0.05], [0.99, 0.42], [0.95, 0.74], [0.82, 0.93], [0.45, 1.0], [0.0, 1.0]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(perfil, 20);
  const p = g.attributes.position;
  const f = [r() * 6, r() * 6, r() * 6, 0.05 + r() * 0.05];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
    const cuadro = 1 / Math.pow(Math.pow(Math.abs(Math.cos(a)), 4) + Math.pow(Math.abs(Math.sin(a)), 4), 0.25);
    const k = cuadro / 1.12 * (1 + f[3] * Math.sin(a * 2 + f[0]) + 0.04 * Math.sin(a * 5 + f[1]));
    p.setXYZ(i, x * k, y * (1 + 0.1 * Math.sin(a + f[2]) + 0.05 * Math.sin(a * 3 + f[1])), z * k);
  }
  g.computeVertexNormals();
  return g;
}

// granito: casi blanco (el color lo pone cada piedra) con grano oscuro y claro, cristales, y musgo y tierra abajo
function texturaPiedra() {
  const N = 256, r = azar(51);
  const c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d');
  g.fillStyle = '#ece8e0'; g.fillRect(0, 0, N, N);
  for (let i = 0; i < 7000; i++) {
    const v = r();
    g.fillStyle = v < 0.45 ? `rgba(60,56,52,${0.2 + r() * 0.35})` : v < 0.85 ? `rgba(255,252,246,${0.3 + r() * 0.4})` : `rgba(150,110,96,${0.25 + r() * 0.3})`;
    g.fillRect(r() * N, r() * N, 1 + r() * 2, 1 + r() * 2);
  }
  // la base: tierra y musgo (el torno pone v = 0 abajo; el lienzo, abajo)
  const gr = g.createLinearGradient(0, N, 0, N * 0.5);
  gr.addColorStop(0, 'rgba(70,64,36,0.95)'); gr.addColorStop(0.45, 'rgba(96,116,50,0.5)'); gr.addColorStop(1, 'rgba(96,116,50,0)');
  g.fillStyle = gr; g.fillRect(0, N * 0.5, N, N * 0.5);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// una mata de hierba entre piedras: dos planos cruzados con briznas (alfa)
function mata() {
  const N = 64, r = azar(57);
  const c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d');
  for (let i = 0; i < 16; i++) {
    const x = N / 2 + (r() - 0.5) * N * 0.5, alto = N * (0.45 + r() * 0.5), curva = (r() - 0.5) * 20, v = 100 + r() * 60;
    g.strokeStyle = r() < 0.2 ? `rgb(${v + 60},${v + 40},${v - 20})` : `rgb(${v - 20},${v + 60},${v - 50})`;
    g.lineWidth = 1.5 + r() * 1.5;
    g.beginPath(); g.moveTo(x, N); g.quadraticCurveTo(x + curva * 0.4, N - alto * 0.6, x + curva, N - alto); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const vs = [], uvs = [], idx = [];
  for (const a of [0, Math.PI / 2]) {
    const cx = Math.cos(a) / 2, sz = Math.sin(a) / 2, b = vs.length / 3;
    vs.push(-cx, 0, -sz, cx, 0, sz, cx, 1, sz, -cx, 1, -sz);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(vs.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  geo.setIndex(idx);
  return { geo, mat: new THREE.MeshLambertMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide }) };
}

export function crearEmpedrado({ grupo, curva, altura, ancho }) {
  const r = azar(77);
  const L = curva.getLength();
  const FORMAS = [piedra(3), piedra(9), piedra(21)];
  const mat = new THREE.MeshLambertMaterial({ map: texturaPiedra() });
  const CHINA = new THREE.IcosahedronGeometry(1, 1);
  const matChina = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const MATA = mata();
  const TRAMO = 8;
  const tramos = [];
  const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  const col = new THREE.Color();
  const pesoTotal = PALETA.reduce((a, [, w]) => a + w, 0);
  const tono = () => {
    let x = r() * pesoTotal;
    for (const [c, w] of PALETA) { if ((x -= w) <= 0) return c; }
    return PALETA[0][0];
  };
  let piedras = 0, chinas = 0, matas = 0;
  let largo = 0, fila = 0;
  while (largo < L) {
    const fondo = 0.13 + r() * 0.11;
    const u = Math.min(1, (largo + fondo / 2) / L);
    const P = curva.getPointAt(u), Tg = curva.getTangentAt(u);
    const nx = -Tg.z, nz = Tg.x;                        // la normal en planta (a la izquierda del avance)
    const [aIzq, aDer] = ancho(largo);
    const ki = Math.floor(largo / TRAMO);
    while (tramos.length <= ki) tramos.push(null);
    const T = tramos[ki] || (tramos[ki] = { piedras: [[], [], []], chinas: [], matas: [], centro: new THREE.Vector3(), n: 0 });
    const giroFila = Math.atan2(Tg.x, Tg.z);
    // un punto de la hilera: c a lo ancho (desde el eje), l a lo largo (desde el centro de la hilera)
    const punto = (c, l) => [P.x + nx * c + Tg.x * l, P.z + nz * c + Tg.z * l];
    const piedraEn = (c, l, anchoP, fondoP) => {
      const [x, z] = punto(c, l);
      const y = altura(x, z) + JUNTA - 0.006;
      const alto = 0.032 + r() * 0.032 * Math.min(1, anchoP / 0.18);
      e.set((r() - 0.5) * 0.07, giroFila + (r() - 0.5) * 0.22, (r() - 0.5) * 0.07, 'YXZ');
      q.setFromEuler(e);
      // la seccion casi cuadrada mide 0,89 en los lados (cuadro / 1,12): x1,12 para que la junta quede en el 12 % de la foto
      mt.compose(v.set(x, y, z), q, s.set(anchoP / 2 * 1.12, alto, fondoP / 2 * 1.1));
      // el tono de la foto, con un tercio de su gris: con la luz del juego los colores salian mas vivos que en ella
      const [cr, cg, cb] = tono(), gm = (cr + cg + cb) / 3, luz = 0.9 + r() * 0.2;
      col.setRGB((cr * 0.67 + gm * 0.33) * luz, (cg * 0.67 + gm * 0.33) * luz, (cb * 0.67 + gm * 0.33) * luz, THREE.SRGBColorSpace);
      T.piedras[Math.floor(r() * 3)].push([mt.clone(), col.clone()]);
      T.centro.add(v); T.n++;
      piedras++;
    };
    // la hilera: de un borde al otro, a matajunta con la anterior
    let w = -aIzq + (fila % 2 ? 0.09 : 0) - r() * 0.06;
    while (w < aDer) {
      // tamanos muy distintos: muchas medianas, algunas grandes y pequenas
      const anchoP = 0.11 + Math.pow(r(), 1.4) * 0.16, c = w + anchoP / 2;
      w += anchoP + 0.02 + r() * 0.012;
      // en el borde se pierden en la hierba
      const borde = c < 0 ? (c + aIzq) : (aDer - c);
      if (borde < 0.03 || (borde < 0.3 && r() > borde / 0.3)) continue;
      if (r() < 0.14) {
        // partida en dos pequenas (relleno), una detras de otra
        const f2 = fondo / 2 - 0.012;
        piedraEn(c, -fondo / 4, anchoP * (0.85 + r() * 0.1), f2);
        piedraEn(c, fondo / 4, anchoP * (0.7 + r() * 0.2), f2);
      } else piedraEn(c, (r() - 0.5) * 0.02, anchoP, fondo);
      // una china en la junta de al lado, alguna vez dos
      for (let k = 0; k < 2; k++) {
        if (r() > 0.3) continue;
        const [x, z] = punto(c + anchoP / 2 + 0.01, (r() - 0.5) * fondo);
        const rad = 0.012 + r() * 0.022;
        const [cr, cg, cb] = r() < 0.5 ? [0.86, 0.84, 0.8] : tono();
        T.chinas.push([x, altura(x, z) + JUNTA + rad * 0.15, z, rad, col.setRGB(cr, cg, cb, THREE.SRGBColorSpace).clone()]);
        chinas++;
      }
      // una mata de hierba que sale de la junta
      if (r() < 0.05 || (borde < 0.5 && r() < 0.12)) {
        const [x, z] = punto(c + anchoP / 2 + 0.01, (r() - 0.5) * fondo);
        T.matas.push([x, altura(x, z) + JUNTA - 0.01, z, 0.07 + r() * 0.1]);
        matas++;
      }
    }
    largo += fondo + 0.02;
    fila++;
  }
  const vivos = tramos.filter(Boolean);
  for (const T of vivos) {
    T.centro.divideScalar(Math.max(1, T.n));
    T.mallas = T.piedras.map((l, k) => {
      const im = new THREE.InstancedMesh(FORMAS[k], mat, l.length);
      l.forEach(([m, c], i) => { im.setMatrixAt(i, m); im.setColorAt(i, c); });
      im.castShadow = im.receiveShadow = true;
      return im;
    });
    const ic = new THREE.InstancedMesh(CHINA, matChina, T.chinas.length);
    T.chinas.forEach(([x, y, z, rad, c], i) => {
      q.setFromEuler(e.set(r() * 3, r() * 3, r() * 3));
      ic.setMatrixAt(i, mt.compose(v.set(x, y, z), q, s.set(rad, rad * 0.6, rad * (0.8 + r() * 0.4))));
      ic.setColorAt(i, c);
    });
    ic.receiveShadow = true;
    const ih = new THREE.InstancedMesh(MATA.geo, MATA.mat, T.matas.length);
    T.matas.forEach(([x, y, z, h], i) => {
      q.setFromAxisAngle(v.set(0, 1, 0), r() * 3);
      ih.setMatrixAt(i, mt.compose(v.set(x, y, z), q, s.set(h * 1.2, h, h * 1.2)));
    });
    T.mallas.push(ic, ih);
    for (const m of T.mallas) { m.computeBoundingSphere(); grupo.add(m); }
    delete T.piedras; delete T.chinas; delete T.matas;
  }
  const LEJOS = 60;
  return {
    actualizar(foco) {
      for (const T of vivos) {
        const ver = Math.hypot(T.centro.x - foco.x, T.centro.z - foco.z) < LEJOS;
        for (const m of T.mallas) m.visible = ver;
      }
    },
    info: { piedras, chinas, matasJunta: matas, tramosEmpedrado: vivos.length, trisPiedra: FORMAS[0].index.count / 3 },
  };
}
