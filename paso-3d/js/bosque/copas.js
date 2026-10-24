// LAS HOJAS DE LAS COPAS (2026-10-23, pedido «haz hojas en los arboles, mas detallados»): cada bulto de copa de
// arboles3d.js (el icosaedro abollado) se cubre de RAMILLETES de hojas dibujadas: tarjetas con una ramita y sus hojas en un
// lienzo (cuatro variantes en un atlas de 2 x 2), recortadas por alfa, puestas en escamas sobre la superficie del bulto,
// mirando hacia fuera. El bulto se queda dentro (al 45 % de su radio y sin tinta) como hojas en sombra que tapa el fondo (como la masa del arbusto de
// escuela/obras/arbusto). La luz la da la NORMAL DE LA MASA (la del bulto en ese punto, por instancia), no la de la tarjeta,
// asi la copa se lee como un volumen y no como un monton de papeles; por detras, la misma normal. El viento mece cada
// ramillete con la racha que corre por el bosque (la de la hierba). Todo en una InstancedMesh.
import * as THREE from 'three';

const TAM = 512;                       // cada variante del atlas
const TINTA = '#0b0a0c';

// el atlas: cuatro ramilletes en blanco y gris (el color lo pone la instancia), con nervio y contorno de tinta
function atlasRamillete() {
  const cv = document.createElement('canvas'); cv.width = cv.height = TAM * 2;
  const c = cv.getContext('2d');
  const azar = (s) => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let v = 0; v < 4; v++) {
    const rr = azar(97 + v * 131), ox = (v % 2) * TAM, oy = Math.floor(v / 2) * TAM;
    c.save(); c.translate(ox, oy);
    c.beginPath(); c.rect(0, 0, TAM, TAM); c.clip();
    // la ramita: de abajo al centro de la tarjeta, curvada
    const cur = (rr() - 0.5) * 120, pts = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([TAM / 2 + Math.sin(t * 2.2) * cur * t, TAM - 18 - t * (TAM - 90)]); }
    c.lineCap = 'round';
    c.strokeStyle = TINTA; c.lineWidth = 11; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
    c.strokeStyle = '#7a7f73'; c.lineWidth = 5; c.stroke();
    // las hojas, alternas y cada vez mas pequenas hacia la punta; las de abajo se pintan primero (las de arriba las tapan)
    const n = 9 + Math.floor(rr() * 4), hojas = [];
    for (let k = 0; k < n; k++) {
      const t = 0.12 + (k / (n - 1)) * 0.86, i = Math.min(11, Math.floor(t * 12)), f = t * 12 - i;
      const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f;
      const lado = k % 2 ? 1 : -1, ang = -Math.PI / 2 + lado * (0.55 + rr() * 0.5) * (1 - t * 0.5) + (rr() - 0.5) * 0.25;
      const L = TAM * (0.27 - t * 0.12) * (0.85 + rr() * 0.3);
      hojas.push({ x, y, ang, L, W: L * (0.3 + rr() * 0.08), tono: rr() });
    }
    hojas.push({ x: pts[12][0], y: pts[12][1], ang: -Math.PI / 2 + (rr() - 0.5) * 0.4, L: TAM * 0.16, W: TAM * 0.05, tono: 1 });   // la punta
    for (const h of hojas) {
      c.save(); c.translate(h.x, h.y); c.rotate(h.ang + Math.PI / 2);
      // la hoja: lanceolada, con el borde un poco ondulado (y apunta hacia -y)
      const L = h.L, W = h.W;
      const contorno = () => {
        c.beginPath(); c.moveTo(0, 0);
        c.bezierCurveTo(W * 1.15, -L * 0.18, W * 0.95, -L * 0.72, 0, -L);
        c.bezierCurveTo(-W * 0.95, -L * 0.72, -W * 1.15, -L * 0.18, 0, 0);
        c.closePath();
      };
      const g = c.createLinearGradient(-W, 0, W, 0);
      const base = 150 + h.tono * 60;
      g.addColorStop(0, `rgb(${base - 40},${base - 40},${base - 40})`); g.addColorStop(0.5, `rgb(${base + 30},${base + 30},${base + 30})`); g.addColorStop(1, `rgb(${base - 20},${base - 20},${base - 20})`);
      contorno(); c.fillStyle = g; c.fill();
      // nervio y nervios laterales
      c.strokeStyle = 'rgba(11,10,12,0.55)'; c.lineWidth = 2.2;
      c.beginPath(); c.moveTo(0, -2); c.quadraticCurveTo(W * 0.08, -L * 0.5, 0, -L * 0.94); c.stroke();
      c.lineWidth = 1.2;
      for (let j = 1; j < 6; j++) { const yy = -L * j / 6.5; c.beginPath(); c.moveTo(0, yy); c.lineTo(W * 0.55, yy - L * 0.07); c.moveTo(0, yy); c.lineTo(-W * 0.55, yy - L * 0.07); c.stroke(); }
      contorno(); c.strokeStyle = TINTA; c.lineWidth = 4; c.stroke();
      c.restore();
    }
    c.restore();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true;
  return t;
}

// blobs: [{ x, y, z, r, ap }] en el mundo (ap: aplastado vertical del bulto); pal: colores de hoja
export function crearHojasCopa(grupo, blobs, { gradiente, enCapa, pal, luz, rr }) {
  // cuantos ramilletes en cada bulto: por su superficie (uno cada 1,5 m2, de 1,1-1,8 veces su tamano base; con uno cada
  // 0,7 m2 eran 711.000 y costaban 1-4 ms mas por fotograma)
  let total = 0;
  const por = blobs.map((b) => { const n = Math.max(10, Math.round(4 * Math.PI * b.r * b.r * (0.4 + 0.6 * b.ap) / 1.5)); total += n; return n; });
  const g = new THREE.PlaneGeometry(1, 1);
  const uT = { value: 0 };
  const m = new THREE.MeshToonMaterial({ map: atlasRamillete(), gradientMap: gradiente, side: THREE.DoubleSide, alphaTest: 0.5 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uT = uT;
    sh.vertexShader = 'attribute vec3 nMasa;\nattribute vec2 uvOff;\nuniform float uT;\n' + sh.vertexShader
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n vMapUv = vMapUv * 0.5 + uvOff;')
      // la luz de la masa: la normal del bulto en ese punto (en el mundo; la malla esta en el origen)
      .replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\n transformedNormal = normalize(normalMatrix * nMasa);')
      // el viento: todo el ramillete se mece con la racha que corre por el bosque, mas en la punta de la tarjeta
      .replace('#include <project_vertex>', `vec4 mvPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        {
          float racha = 0.5 + 0.5 * sin(uT * 0.8 - dot(mvPosition.xz, vec2(0.82, 0.57)) * 0.35);
          float k = (0.5 + position.y) * (0.05 + 0.1 * racha) + 0.03 * sin(uT * 2.3 + mvPosition.x * 1.7 + mvPosition.z * 1.3);
          mvPosition.xz += vec2(0.82, 0.57) * k; mvPosition.y -= abs(k) * 0.3;
        }
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal = normalize(vNormal);');
  };
  m.customProgramCacheKey = () => 'ramillete';
  // POR TROZOS de 12 x 12 m (por el sitio del bulto), cada uno su InstancedMesh con su esfera: la camara descarta los que
  // no ve (todo en una era dibujar 340.000 ramilletes aunque la mitad quedara detras)
  const TROZO = 12, trozos = new Map();
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), qz = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const d = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1), n = new THREE.Vector3(), c = new THREE.Color();
  blobs.forEach((b, j) => {
    const clave = `${Math.floor(b.x / TROZO)},${Math.floor(b.z / TROZO)}`;
    if (!trozos.has(clave)) trozos.set(clave, { mat: [], nm: [], uv: [], col: [] });
    const T = trozos.get(clave);
    for (let k = 0; k < por[j]; k++) {
      // un punto de la superficie, por todo el bulto: desde el suelo la copa se ve por debajo
      do { d.set(rr() * 2 - 1, rr() * 2 - 1, rr() * 2 - 1); } while (d.lengthSq() > 1 || d.lengthSq() < 0.05);
      d.normalize();
      const prof = 0.66 + rr() * 0.4;                  // la masa queda dentro (0,45 del radio): el borde es de hojas
      p.set(b.x + d.x * b.r * prof, b.y + d.y * b.r * b.ap * prof, b.z + d.z * b.r * prof);
      // la normal del elipsoide en ese punto
      n.set(d.x, d.y / Math.max(0.3, b.ap), d.z).normalize();
      // la tarjeta mira casi hacia fuera, girada al azar alrededor de esa normal, con la ramita hacia fuera y arriba
      const fuera = n.clone().lerp(d.set(rr() - 0.5, rr() - 0.5, rr() - 0.5), 0.45).normalize();
      q.setFromUnitVectors(Z, fuera); qz.setFromAxisAngle(Z, rr() * 6.28); q.multiply(qz);
      const tam = (1.1 + rr() * 0.7) * Math.min(1.45, 0.6 + b.r * 0.5);
      T.mat.push(M.compose(p, q, s.set(tam, tam, tam)).clone());
      T.nm.push(n.x, n.y, n.z);
      T.uv.push((Math.floor(rr() * 4) % 2) * 0.5, Math.floor(rr() * 2) * 0.5);
      // el color: de las hojas del arbol, oscuro por debajo y con luz arriba
      c.copy(pal[Math.floor(rr() * pal.length)]).lerp(pal[0], lisa(0.2, -0.8, n.y) * 0.7).lerp(luz, lisa(0.45, 1, n.y) * 0.3 * (0.5 + rr()));
      T.col.push(c.clone());
    }
  });
  const im = new THREE.Group(); im.name = 'hojasCopa';
  for (const T of trozos.values()) {
    const gt = g.clone();
    gt.setAttribute('nMasa', new THREE.InstancedBufferAttribute(new Float32Array(T.nm), 3));
    gt.setAttribute('uvOff', new THREE.InstancedBufferAttribute(new Float32Array(T.uv), 2));
    const t = new THREE.InstancedMesh(gt, m, T.mat.length);
    T.mat.forEach((x, i) => { t.setMatrixAt(i, x); t.setColorAt(i, T.col[i]); });
    t.computeBoundingSphere(); t.boundingSphere.radius += 2;     // (el viento las mueve un poco)
    t.receiveShadow = true;
    t.userData.z = t.boundingSphere.center.z;
    im.add(t);
  }
  grupo.add(enCapa(im));
  // y solo cerca del 18: mas alla de 60 m por delante o 40 por detras la bruma ya se las ha comido
  return { im, total, trozos: trozos.size, actualizar(t, zh) {
    uT.value = t;
    if (zh !== undefined) for (const x of im.children) x.visible = x.userData.z > zh - 40 && x.userData.z < zh + 60;
  } };
}
const lisa = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
