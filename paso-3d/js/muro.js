// EL MURO por su cara de dentro (la que mira a la ciudad): 40 m, del suelo en y = -35 a la coronacion en y = 5. La base
// de pasarelas cuelga de el a 35 m del suelo (el usuario: «estoy a unos 35 metros»), asi que por encima solo quedan 5 m
// de muro y por debajo se ve caer hasta el suelo.
//
// De abajo arriba: ZOCALO escalonado, PANELES prefabricados de 3 x 3 m (cada uno su caja, con su junta de 4 cm, su tono y
// una de cuatro caras: limpia, con oxido de los agujeros de encofrado, vieja o remendada; los AGRIETADOS, desconchados
// y descantillados no son una caja sino la placa partida en trozos con su volumen, danos.js),
// CONTRAFUERTES cada 12 m fuera de la base, CINTURONES a -21 y -9 con sus GARGOLAS, BAJANTES con abrazaderas y bridas,
// la tuberia general, REJILLAS de ventilacion, ESCOTILLAS de otros conductos (una con su balconcillo abandonado),
// DESCONCHONES con la ferralla a la vista (danos.js), ROTULOS de plantilla, la BANDEJA DE CABLES, la caja de registro y el aplique
// junto a la salida, la ESCALA CON JAULA de la base a la coronacion y la que baja al suelo, y arriba la CORONACION con
// goterón, parapeto, barandilla y CONCERTINA, dos GARITAS voladas y seis TORRES DE FOCOS (su haz en la bruma, el polvo y
// el deslumbramiento, en focos.js).
// Abajo, el SUELO: solera de hormigon al pie del muro, canaleta, cascotes, charcos y tierra.
//
// Lo que es caja va a los lotes de mundo3d.js (una malla por material, con su casco de tinta); los paneles, el fondo de
// las juntas, los rotulos, los conos y el suelo, aqui, porque llevan su propio material.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { D } from './datos.js';
import { texturaMancha, planosMancha } from './musgo.js';
import { crearDanos } from './danos.js';

const MX = D.MURO_X, G = D.SUELO_Y, T = D.TOPE_Y;
const COR0 = T - 0.8;                              // cara de abajo de la coronacion
const HZ = 70;
export const MURO = { G, T, COR0, ESCALA_Z: 2.1, CONTRAFUERTES: [-56, -44, -32, -20, 10, 22, 34, 46, 58], GARITAS: [-12, 14] };

function azar(semilla) { let s = semilla >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

// ALAMBRES: tubos finos por polilinea y laminas (puas y cuchillas) con color por vertice, todo en una geometria. Los tubos
// van con su marco transportado a lo largo de la linea (una espiral no se retuerce) y las caras hacia fuera
class Alambres {
  constructor() { this.p = []; this.n = []; this.c = []; this.i = []; this.tris = 0; }
  tubo(pts, r, lados, col) {
    if (pts.length < 2) return;
    const base = this.p.length / 3, t = new THREE.Vector3(), nn = new THREE.Vector3(), b = new THREE.Vector3();
    for (let k = 0; k < pts.length; k++) {
      t.subVectors(pts[Math.min(pts.length - 1, k + 1)], pts[Math.max(0, k - 1)]).normalize();
      if (k === 0) nn.crossVectors(t, Math.abs(t.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
      else nn.addScaledVector(t, -nn.dot(t)).normalize();
      b.crossVectors(t, nn);
      for (let q = 0; q < lados; q++) {
        const an = q / lados * Math.PI * 2, ca = Math.cos(an), sa = Math.sin(an);
        const ox = nn.x * ca + b.x * sa, oy = nn.y * ca + b.y * sa, oz = nn.z * ca + b.z * sa;
        this.p.push(pts[k].x + ox * r, pts[k].y + oy * r, pts[k].z + oz * r);
        this.n.push(ox, oy, oz);
        this.c.push(col.r, col.g, col.b);
      }
    }
    for (let k = 0; k < pts.length - 1; k++) for (let q = 0; q < lados; q++) {
      const a = base + k * lados + q, a2 = base + k * lados + (q + 1) % lados;
      this.i.push(a, a2, a + lados, a2, a2 + lados, a + lados);
    }
    this.tris += 2 * lados * (pts.length - 1);
  }
  // un rombo: centro +- u (lo largo) +- v (lo ancho); va con un material de dos caras
  lamina(c, u, v, col) {
    const base = this.p.length / 3, n = new THREE.Vector3().crossVectors(u, v).normalize();
    for (const [a, b] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      this.p.push(c.x + u.x * a + v.x * b, c.y + u.y * a + v.y * b, c.z + u.z * a + v.z * b);
      this.n.push(n.x, n.y, n.z);
      this.c.push(col.r, col.g, col.b);
    }
    this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.tris += 2;
  }
  geometria() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    return g;
  }
}

// ---------------------------------------------------------------- texturas
// los paneles: cuatro caras de 512 px en un atlas de 1024 (3 x 3 m cada una)
function texturaPaneles() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1024;
  let remiendo = null;
  const c = cv.getContext('2d');
  const r = azar(101);
  for (let v = 0; v < 4; v++) {
    const ox = (v % 2) * 512, oy = Math.floor(v / 2) * 512;
    c.save(); c.translate(ox, oy);
    c.beginPath(); c.rect(0, 0, 512, 512); c.clip();
    c.fillStyle = '#858d95'; c.fillRect(0, 0, 512, 512);
    // aguas del hormigon: manchas grandes y poro
    for (let n = 0; n < 90; n++) {
      const x = r() * 512, y = r() * 512, rr = 20 + r() * 110;
      const g = c.createRadialGradient(x, y, 0, x, y, rr);
      const t = r() < 0.65 ? '44,50,56' : '176,182,188';
      g.addColorStop(0, `rgba(${t},${0.04 + r() * 0.1})`); g.addColorStop(1, `rgba(${t},0)`);
      c.fillStyle = g; c.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    for (let n = 0; n < 2600; n++) { c.fillStyle = `rgba(36,40,46,${r() * 0.3})`; c.fillRect(r() * 512, r() * 512, 1 + r() * 1.5, 1 + r() * 1.5); }
    // tongadas del encofrado (lineas horizontales muy suaves)
    for (let y = 64; y < 512; y += 64 + r() * 20) { c.fillStyle = 'rgba(60,66,72,.10)'; c.fillRect(0, y, 512, 2); }
    // chaflan del canto: oscuro por fuera, una linea de luz por dentro
    c.strokeStyle = 'rgba(30,34,39,.85)'; c.lineWidth = 7; c.strokeRect(3.5, 3.5, 505, 505);
    c.strokeStyle = 'rgba(205,210,214,.22)'; c.lineWidth = 2; c.strokeRect(10, 10, 492, 492);
    // agujeros de los tirantes del encofrado, 3 x 3
    const agujeros = [];
    for (const fx of [0.2, 0.5, 0.8]) for (const fy of [0.2, 0.5, 0.8]) agujeros.push([fx * 512 + (r() - 0.5) * 4, fy * 512 + (r() - 0.5) * 4]);
    for (const [x, y] of agujeros) {
      if (v === 1) {   // chorreones de oxido PARDO (el naranja es solo de la Podredumbre): un velo difuso bajo el agujero
        // y dos a cuatro hilos que bajan torciendose y se apagan (antes era una franja recta: parecia una raya pintada)
        c.save(); c.filter = 'blur(3px)';
        const g = c.createLinearGradient(0, y, 0, y + 130);
        g.addColorStop(0, 'rgba(92,70,54,.3)'); g.addColorStop(1, 'rgba(92,70,54,0)');
        c.fillStyle = g; c.beginPath(); c.ellipse(x, y + 55, 6 + r() * 5, 62, 0, 0, 7); c.fill();
        c.restore();
        c.lineCap = 'round';
        for (let k = 0, nk = 2 + Math.floor(r() * 3); k < nk; k++) {
          let px = x + (r() - 0.5) * 6, py = y + 3;
          const largo = 70 + r() * 210, a = 0.18 + 0.3 * r();
          c.lineWidth = 0.7 + r() * 2;
          for (let t = 0; t < largo; t += 6) {
            const nx = px + (r() - 0.5) * 1.8, ny = py + 6;
            c.strokeStyle = `rgba(86,64,49,${(a * (1 - t / largo)).toFixed(3)})`;
            c.beginPath(); c.moveTo(px, py); c.lineTo(nx, ny); c.stroke();
            px = nx; py = ny;
          }
        }
      }
      c.fillStyle = 'rgba(170,176,182,.45)'; c.beginPath(); c.arc(x, y, 5.5, 0, 7); c.fill();
      c.fillStyle = '#41464c'; c.beginPath(); c.arc(x, y, 3.8, 0, 7); c.fill();
      c.fillStyle = '#25292e'; c.beginPath(); c.arc(x + 0.6, y + 0.6, 2.2, 0, 7); c.fill();
    }
    if (v === 1) {     // y una marea de agua por arriba
      const g = c.createLinearGradient(0, 0, 0, 200);
      g.addColorStop(0, 'rgba(40,46,52,.35)'); g.addColorStop(1, 'rgba(40,46,52,0)');
      c.fillStyle = g; c.fillRect(0, 0, 512, 200);
    }
    if (v === 2) {     // vieja: aguas mas oscuras y lavados de lluvia (las grietas y los desconchones son geometria, danos.js)
      for (let n = 0; n < 40; n++) {
        const x = r() * 512, y = r() * 512, rr = 30 + r() * 90, g = c.createRadialGradient(x, y, 0, x, y, rr);
        g.addColorStop(0, `rgba(38,43,48,${0.05 + r() * 0.08})`); g.addColorStop(1, 'rgba(38,43,48,0)');
        c.fillStyle = g; c.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      }
      for (let n = 0; n < 16; n++) {
        const x = r() * 512, y0 = r() * 120, h = 160 + r() * 300, g = c.createLinearGradient(0, y0, 0, y0 + h);
        g.addColorStop(0, `rgba(44,50,56,${0.08 + r() * 0.12})`); g.addColorStop(1, 'rgba(44,50,56,0)');
        c.fillStyle = g; c.fillRect(x, y0, 3 + r() * 10, h);
      }
    }
    if (v === 3) {     // remiendo: un parche mas claro y liso con las marcas de la llana
      const x0 = 120 + r() * 120, y0 = 140 + r() * 120, w = 160 + r() * 120, h = 120 + r() * 100;
      remiendo = [x0, y0, w, h];
      // el parche no se pinta: es una placa de verdad 3 mm por encima (danos.js), mas clara por su color; aqui solo
      // las marcas de la llana, dentro de el
      c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip();
      c.strokeStyle = 'rgba(150,156,162,.32)'; c.lineWidth = 1.5;
      for (let i = 0; i < 9; i++) { c.beginPath(); const yy = y0 + 10 + r() * (h - 20); c.arc(x0 + r() * w, yy, 30 + r() * 40, 3.6, 5.6); c.stroke(); }
      c.restore();
    }
    c.restore();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.userData.remiendo = remiendo;                // [x, y, ancho, alto] en px de su casilla: ahi va la placa de danos.js
  return t;
}
// la casilla del atlas de cada cara: el lienzo se sube con flipY, asi que la fila de ARRIBA del lienzo es v alto (antes
// se tomaba al reves y el 42 % de los paneles, los que tenian que ser limpios, llevaban las grietas pintadas)
const casillaAtlas = (cara) => [(cara % 2) * 0.5, (1 - Math.floor(cara / 2)) * 0.5];
// rotulos de plantilla y lo demas que se pinta: 5 casillas de 256 (el alfa es la pintura gastada)
const CASILLA = { C7: 0, S07: 1, N35: 2, FRANJAS: 3, DESCONCHON: 4 };
function texturaRotulos() {
  const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 256;
  const c = cv.getContext('2d');
  const r = azar(55);
  c.clearRect(0, 0, 1280, 256);
  const texto = (x, s, tam) => {
    c.font = `700 ${tam}px Bahnschrift, "Segoe UI", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#e8ecef'; c.fillText(s, x + 128, 128);
  };
  texto(0, 'C-7 ▶', 92); texto(256, 'S-07', 120); texto(512, 'N+35', 104);
  // franjas de peligro: ocre apagado y negro (el naranja es solo de la Podredumbre), recortadas a su casilla
  c.save(); c.beginPath(); c.rect(768, 0, 256, 256); c.clip();
  for (let i = -4; i < 8; i++) {
    c.fillStyle = i % 2 ? '#a8955a' : '#15171a';
    c.beginPath(); c.moveTo(768 + i * 40, 0); c.lineTo(768 + i * 40 + 40, 0); c.lineTo(768 + i * 40 + 40 - 256, 256); c.lineTo(768 + i * 40 - 256, 256); c.closePath(); c.fill();
  }
  c.restore();
  // (la casilla 4 era un desconchon pintado: ya no se usa, los desconchones son geometria en danos.js)
  // pintura gastada: se le comen trocitos (no al desconchon)
  c.globalCompositeOperation = 'destination-out';
  for (let n = 0; n < 900; n++) { c.fillStyle = `rgba(0,0,0,${0.25 + r() * 0.6})`; c.fillRect(r() * 1024, r() * 256, 2 + r() * 7, 2 + r() * 4); }
  c.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function texturaTierra() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const c = cv.getContext('2d');
  const r = azar(7);
  c.fillStyle = '#4a4e47'; c.fillRect(0, 0, 256, 256);
  for (let n = 0; n < 200; n++) {
    const x = r() * 256, y = r() * 256, rr = 6 + r() * 30;
    for (const [dx, dy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
      const g = c.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rr);
      g.addColorStop(0, `rgba(${r() < 0.5 ? '30,32,29' : '92,94,86'},${0.15 + r() * 0.2})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(x + dx - rr, y + dy - rr, rr * 2, rr * 2);
    }
  }
  for (let n = 0; n < 1500; n++) { c.fillStyle = `rgba(${r() < 0.5 ? '120,122,114' : '28,30,27'},.6)`; c.fillRect(r() * 256, r() * 256, 1.5, 1.5); }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(60, 60);
  return t;
}

// ---------------------------------------------------------------- el muro
// k: lo que presta mundo3d.js (M, gradiente, caja, cajaE, barra, cilindro, meter, choques, W2, H)
export function construirMuro(scene, k) {
  const { M, gradiente, caja, cajaE, barra, cilindro, meter, choques, W2, H, senal, caseta } = k;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const r = azar(19);
  const texturas = [];
  // lo que el musgo tiene que saber del muro (musgo.js): los HUECOS de la cara (rectangulos z0, z1, y0, y1 donde no se
  // pinta: rotulos, rejillas, escotillas, lo que tapan contrafuertes y cinturones) y los SITIOS de los que cuelga algo
  const huecos = [];
  const sitios = { gargolas: [], bandeja: [], escotillas: [], rejillas: [], balcon: null, contrafuertes: MURO.CONTRAFUERTES, garitas: MURO.GARITAS, escalaZ: MURO.ESCALA_Z };

  // ---- paneles: cajas de 5 cm (x 17,95..18) con 4 cm de junta, una cara del atlas y un tono cada una
  const tPan = texturaPaneles(); texturas.push(tPan);
  const filas = [];
  for (let y = -33; y < 3; y += 3) filas.push([y, y + 3]);
  filas.push([3, COR0]);
  const gsPan = [], tinte = new THREE.Color();
  function panel(z0, z1, y0, y1, zA, yA, cara) {
    const g = new THREE.BoxGeometry(0.05, y1 - y0, z1 - z0).translate(MX - 0.025, (y0 + y1) / 2, (z0 + z1) / 2);
    const p = g.attributes.position, uv = g.attributes.uv, n = p.count;
    const [qu, qv] = casillaAtlas(cara);
    // la textura por la posicion en el panel ENTERO (asi los trozos del de la salida casan); u hacia -z: se lee bien desde la base
    for (let i = 0; i < n; i++) uv.setXY(i, qu + 0.004 + 0.492 * Math.min(1, Math.max(0, (zA + 3 - p.getZ(i)) / 3)), qv + 0.004 + 0.492 * Math.min(1, Math.max(0, (p.getY(i) - yA) / 3)));
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = tinte.r; col[i * 3 + 1] = tinte.g; col[i * 3 + 2] = tinte.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.userData = { zc: zA + 1.5, y0: yA, cara, tinte: tinte.clone() };
    gsPan.push(g);
  }
  // los DANADOS (cara vieja: grietas, ferralla o golpe; algunos de los demas: un canto comido; los remendados: su placa)
  // se apartan y se hacen al final con danos.js, cuando ya se sabe que tienen delante; con su propio azar, para no
  // mover el del resto del muro
  const porDanar = [], rD = azar(4242);
  const tapado = (zc, y0) => y0 >= G + 2.9 && MURO.CONTRAFUERTES.some((z) => Math.abs(z - zc) < 1.5);
  for (let zc = -69; zc <= 69; zc += 3) {
    for (const [y0, y1] of filas) {
      const u = r(), cara = u < 0.42 ? 0 : u < 0.66 ? 1 : u < 0.82 ? 2 : 3;
      const t = 0.64 + 0.15 * r();
      tinte.setRGB(t, t * (0.99 + 0.02 * r()), t * (0.98 + 0.05 * r()));
      const zA = zc - 1.5, e = 0.02;
      if (zc === 0 && y0 === 0) {          // el panel de la salida: tres trozos alrededor del hueco
        panel(zA + e, -W2, y0 + e, y1 - e, zA, y0, cara);
        panel(W2, zc + 1.5 - e, y0 + e, y1 - e, zA, y0, cara);
        panel(-W2, W2, H, y1 - e, zA, y0, cara);
        continue;
      }
      const x = rD();
      const tipo = tapado(zc, y0) ? null : cara === 2 ? ['grietas', 'grietas', 'ferralla', 'golpe'][Math.floor(rD() * 4)] : cara === 3 ? 'remiendo' : x < 0.1 ? 'canto' : null;
      if (tipo) porDanar.push({ zc, zA, y0, y1, cara, tinte: tinte.clone(), tipo, semilla: Math.floor(rD() * 1e9) });
      else panel(zA + e, zc + 1.5 - e, y0 + e, y1 - e, zA, y0, cara);
    }
  }
  const mPan = new THREE.MeshToonMaterial({ map: tPan, vertexColors: true, gradientMap: gradiente });
  const paneles = new THREE.Mesh(undefined, mPan);
  paneles.castShadow = paneles.receiveShadow = true;
  // el fondo de las juntas (oscuro), con el hueco de la salida
  const fondo = [];
  const plano = (y0, y1, z0, z1) => fondo.push(new THREE.PlaneGeometry(z1 - z0, y1 - y0).rotateY(Math.PI / 2).translate(MX - 0.04, (y0 + y1) / 2, (z0 + z1) / 2));
  plano(G, 0, -HZ, HZ); plano(H, COR0, -HZ, HZ); plano(0, H, -HZ, -W2); plano(0, H, W2, HZ);
  const juntas = new THREE.Mesh(mergeGeometries(fondo), new THREE.MeshToonMaterial({ color: '#30363c', gradientMap: gradiente }));
  juntas.receiveShadow = true;
  scene.add(juntas);

  // ---- zocalo, cinturones, coronacion, parapeto
  cajaE('hormigon', MX - 0.05, MX + 0.95, G, G + 2.0, -HZ, HZ, { tile: 3, tinta: 0.02 });
  cajaE('hormigon', MX - 0.05, MX + 0.5, G + 2.0, G + 3.0, -HZ, HZ, { tile: 3, tinta: 0.02 });
  for (const y of [-21, -9]) {
    huecos.push([-HZ, HZ, y - 0.27, y + 0.27]);
    cajaE('hormigonOsc', MX, MX + 0.55, y - 0.25, y + 0.25, -HZ, HZ, { tinta: 0.02 });
    cajaE('aceroOsc', MX + 0.42, MX + 0.47, y - 0.27, y - 0.25, -HZ, HZ, { tinta: 0 });        // goteron
  }
  const hueco = [MURO.ESCALA_Z - 0.5, MURO.ESCALA_Z + 0.5];                                      // por donde sale la escala
  for (const [z0, z1] of [[-HZ, hueco[0]], [hueco[1], HZ]]) {
    cajaE('hormigon', MX - 0.1, MX + 1.1, COR0, T, z0, z1, { tile: 3, tinta: 0.02 });
    cajaE('aceroOsc', MX + 0.98, MX + 1.03, COR0 - 0.03, COR0, z0, z1, { tinta: 0 });            // goteron
    cajaE('hormigon', MX - 0.1, MX + 0.25, T, T + 1.1, z0, z1, { tile: 3, tinta: 0.02 });        // parapeto
  }
  // ---- la ALAMBRADA de la coronacion (antes eran anillos sueltos y tres cuerdas): postes en Y sobre el parapeto con
  // ESPINO tensado (tres hilos por brazo y dos en el poste, con puas de cuatro puntas) y una CONCERTINA de cuchillas en la V,
  // y otra concertina tendida en la cornisa por fuera del parapeto. La concertina es una espiral que inclina cada vuelta al
  // reves que la anterior (las vueltas se cruzan como las grapadas de verdad) y cuelga un poco entre apoyos. Hilos, puas y
  // cuchillas van en dos mallas propias y sin sombra (a 3 cm por texel solo parpadearia); cerca de la base, espiral fina
  // con cuchillas y puas; lejos, espiral basta, un poco mas gruesa para que no se pierda, y sin ellas
  const cercaAl = (z) => z > -26 && z < 14;
  const AL = new Alambres(), LA = new Alambres();
  const cAl = new THREE.Color('#3f454c'), cOx = new THREE.Color('#5d4a39'), cCu = new THREE.Color('#7f8891');
  const tonoAl = () => cAl.clone().lerp(cOx, r() * r() * 0.65);
  const huecosAl = [[hueco[0] - 0.05, hueco[1] + 0.05], ...MURO.GARITAS.map((g) => [g - 1.45, g + 1.45])].sort((p, q) => p[0] - q[0]);
  const tramosAl = [];
  let zAl = -HZ + 1;
  for (const [h0, h1] of huecosAl) { if (h0 > zAl + 1) tramosAl.push([zAl, h0]); zAl = Math.max(zAl, h1); }
  if (HZ - 1 > zAl + 1) tramosAl.push([zAl, HZ - 1]);
  const XP = MX + 0.08, YB = T + 1.1, YV = T + 1.55;                       // el poste: del parapeto al nudo de la Y
  const brazo = (sg, t, z) => V(XP + sg * 0.5 * t, YV + 0.5 * t, z);       // a lo largo del brazo: sg +1 hacia la base
  // una concertina de radio R con el eje en (cx, cy) de z0 a z1, una vuelta cada `paso`, colgando `flecha` entre apoyos
  function concertina(z0, z1, cx, cy, R, paso, apoyos, flecha) {
    const fase = r() * Math.PI * 2, sem = r() * 50, col = tonoAl();
    let pts = [], cerca = cercaAl(z0), largo = 0;
    const cortar = () => { if (pts.length > 1) AL.tubo(pts, cerca ? 0.0072 : 0.011, 3, col); };
    for (let sv = 0; ; ) {
      const zb = z0 + sv * paso;
      if (zb > z1) break;
      const th = sv * Math.PI * 2 + fase, signo = Math.floor(sv) % 2 ? -1 : 1;
      let fl = 0;
      for (let k = 0; k < apoyos.length - 1; k++) if (zb >= apoyos[k] && zb <= apoyos[k + 1]) { fl = flecha * Math.sin(Math.PI * (zb - apoyos[k]) / (apoyos[k + 1] - apoyos[k])); break; }
      const rr = R * (1 + 0.05 * Math.sin(sv * 1.3 + sem) + 0.03 * Math.sin(sv * 3.7 + 2 * sem));
      const pt = V(cx + rr * Math.cos(th), cy - fl + rr * 0.93 * Math.sin(th), zb + 0.42 * paso * Math.sin(sv * Math.PI * 2) * signo);
      const ahora = cercaAl(zb);
      if (ahora !== cerca) { pts.push(pt); cortar(); pts = [pt]; cerca = ahora; }
      else pts.push(pt);
      // las cuchillas: rombos a lo largo del hilo que salen hacia fuera de la espiral
      if (cerca && pts.length > 1) {
        const ant = pts[pts.length - 2], d = new THREE.Vector3().subVectors(pt, ant), l = d.length();
        largo += l;
        while (largo > 0.05) {
          largo -= 0.05;
          const c = ant.clone().addScaledVector(d, 1 - largo / Math.max(l, 1e-6)), radial = V(c.x - cx, c.y - cy + fl, 0).normalize();
          LA.lamina(c, d.clone().normalize().multiplyScalar(0.017), radial.multiplyScalar(0.008), cCu);
        }
      }
      sv += 1 / (cerca ? 30 : 9);
    }
    cortar();
  }
  for (const [a, b] of tramosAl) {
    // postes: los de punta mas gruesos y con tornapunta
    const zs = [a];
    for (let z = Math.ceil((a + 1.2) / 3) * 3; z < b - 1.2; z += 3) zs.push(z);
    zs.push(b);
    for (const z of zs) {
      const punta = z === a || z === b;
      cajaE('aceroOsc', XP - 0.09, XP + 0.09, YB, YB + 0.015, z - 0.07, z + 0.07, { tinta: 0.005 });          // placa
      for (const dz of [-0.045, 0.045]) cajaE('acero', XP - 0.065, XP - 0.045, YB + 0.015, YB + 0.03, z + dz - 0.01, z + dz + 0.01, { tinta: 0 });   // pernos
      barra('aceroOsc', V(XP, YB, z), V(XP, YV, z), punta ? 0.07 : 0.05, { tinta: 0.007 });
      for (const sg of [-1, 1]) barra('aceroOsc', V(XP, YV - 0.02, z), brazo(sg, 1, z), 0.04, { tinta: 0.006 });
      if (punta) barra('aceroOsc', V(XP, YB + 0.05, z + (z === a ? 0.7 : -0.7)), V(XP, YV - 0.1, z), 0.035, { tinta: 0.005 });
    }
    // el espino, tenso con una flecha de 1,5 cm por vano, y sus puas cerca de la base
    const hilos = [];
    for (const sg of [-1, 1]) for (const t of [0.4, 0.7, 0.98]) hilos.push(brazo(sg, t, 0));
    hilos.push(V(XP + 0.03, YB + 0.18, 0), V(XP + 0.03, YB + 0.36, 0));
    for (const h of hilos) for (let k = 0; k < zs.length - 1; k++) {
      const z0 = zs[k], z1 = zs[k + 1], y = (t) => h.y - 0.015 * Math.sin(Math.PI * t), pts = [];
      for (let j = 0; j <= 4; j++) pts.push(V(h.x, y(j / 4), z0 + (z1 - z0) * j / 4));
      AL.tubo(pts, cercaAl(z0) ? 0.0045 : 0.008, 3, tonoAl());
      if (!cercaAl((z0 + z1) / 2)) continue;
      for (let z = z0 + 0.06; z < z1 - 0.03; z += 0.11) {
        const c = V(h.x, y((z - z0) / (z1 - z0)), z), an = r() * Math.PI, ej = V(0, 0, 0.003);
        for (const d of [0, Math.PI / 2]) LA.lamina(c, V(Math.cos(an + d) * 0.016, Math.sin(an + d) * 0.016, 0), ej, cAl);
      }
    }
    // la concertina en la V de los postes: radio 0,28, apoyada en los dos brazos
    concertina(a + 0.15, b - 0.15, XP, YV + 0.28 * Math.SQRT2, 0.28, 0.17, zs, 0.05);
  }
  // la concertina tendida en la cornisa, por fuera del parapeto: se corta en el hueco de la escala, en las garitas y en
  // cada torre de focos (atada a su poste)
  {
    const cortes = [[hueco[0] - 0.4, hueco[1] + 0.4], ...MURO.GARITAS.map((g) => [g - 1.45, g + 1.45]), ...[-30, -18, -6, 6, 18, 30].map((z) => [z - 0.35, z + 0.35])].sort((p, q) => p[0] - q[0]);
    let z = -HZ + 0.6;
    for (const [c0, c1] of [...cortes, [HZ - 0.6, HZ]]) {
      if (c0 > z + 1) {
        const apoyos = [z]; for (let k = Math.ceil((z + 1) / 2.5) * 2.5; k < c0 - 1; k += 2.5) apoyos.push(k); apoyos.push(c0);
        concertina(z, c0, MX + 0.68, T + 0.3, 0.3, 0.19, apoyos, -0.02);          // flecha negativa: aplastada contra la cornisa
      }
      z = Math.max(z, c1);
    }
  }
  const mAlambre = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradiente });
  const mCuchilla = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradiente, side: THREE.DoubleSide });
  const alambres = new THREE.Mesh(AL.geometria(), mAlambre), cuchillas = new THREE.Mesh(LA.geometria(), mCuchilla);
  alambres.name = 'alambrada'; cuchillas.name = 'cuchillas';
  scene.add(alambres, cuchillas);
  const alambrada = { tris: AL.tris + LA.tris, hilos: AL.tris, laminas: LA.tris / 2 };

  // ---- contrafuertes (fuera de donde cuelga la base)
  for (const z of MURO.CONTRAFUERTES) {
    huecos.push([z - 0.72, z + 0.72, G + 2.9, COR0]);
    cajaE('hormigon', MX, MX + 0.9, G + 3.0, COR0, z - 0.7, z + 0.7, { tile: 3, tinta: 0.02 });
    cajaE('hormigon', MX, MX + 1.15, G + 2.0, G + 3.0, z - 0.85, z + 0.85, { tile: 3, tinta: 0.02 });
    for (const y of [-27, -15, -3]) cajaE('aceroOsc', MX + 0.9, MX + 0.96, y, y + 0.08, z - 0.5, z + 0.5, { tinta: 0.006 });   // pletinas de anclaje
  }

  // ---- bajantes con abrazaderas y bridas, y la tuberia general
  for (const z of [6.4, -8.8, 15.5]) {
    cilindro('aceroOsc', V(MX + 0.25, G + 3, z), V(MX + 0.25, COR0, z), 0.16, 12, 0.016);
    for (let y = -32; y <= 4; y += 4) cajaE('acero', MX, MX + 0.42, y, y + 0.12, z - 0.22, z + 0.22, { tinta: 0.01 });
    for (let y = -30; y < 4; y += 6) cilindro('acero', V(MX + 0.25, y, z), V(MX + 0.25, y + 0.08, z), 0.2, 12, 0.01);
    cilindro('aceroOsc', V(MX + 0.25, G + 3.2, z), V(MX + 0.9, G + 2.2, z), 0.16, 12, 0.014);     // codo a la arqueta
  }
  cilindro('aceroOsc', V(MX + 0.35, -5.5, -19.2), V(MX + 0.35, -5.5, 9.2), 0.22, 14, 0.016);
  for (let z = -18; z < 9; z += 6) {
    cilindro('acero', V(MX + 0.35, -5.5, z), V(MX + 0.35, -5.5, z + 0.1), 0.28, 14, 0.01);
    cajaE('acero', MX, MX + 0.6, -5.85, -5.75, z + 2.95, z + 3.15, { tinta: 0.008 });
  }

  // ---- rejillas de ventilacion
  const qLama = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.6);
  for (const [z, y, w, h] of [[7.6, 1.0, 0.9, 0.7], [-5.2, -4.6, 1.2, 0.9], [4.5, -13.2, 1.2, 1.2], [-17, -6.2, 1.0, 0.8], [12.5, -24.5, 1.4, 1.0], [-25.5, 2.3, 1.0, 0.8], [-3.5, -26.5, 1.6, 1.1]]) {
    huecos.push([z - w / 2 - 0.04, z + w / 2 + 0.04, y - h / 2 - 0.04, y + h / 2 + 0.04]);
    sitios.rejillas.push({ z, y0: y - h / 2, w });
    cajaE('negro', MX - 0.01, MX + 0.01, y - h / 2, y + h / 2, z - w / 2, z + w / 2, { tinta: 0 });
    cajaE('aceroOsc', MX, MX + 0.09, y + h / 2 - 0.06, y + h / 2, z - w / 2, z + w / 2, { tinta: 0.008 });
    cajaE('aceroOsc', MX, MX + 0.09, y - h / 2, y - h / 2 + 0.06, z - w / 2, z + w / 2, { tinta: 0.008 });
    cajaE('aceroOsc', MX, MX + 0.09, y - h / 2, y + h / 2, z - w / 2, z - w / 2 + 0.06, { tinta: 0.008 });
    cajaE('aceroOsc', MX, MX + 0.09, y - h / 2, y + h / 2, z + w / 2 - 0.06, z + w / 2, { tinta: 0.008 });
    for (let yy = y - h / 2 + 0.1; yy < y + h / 2 - 0.06; yy += 0.11) caja('acero', MX + 0.04, yy, z, 0.11, 0.015, w - 0.1, { q: qLama, tinta: 0.004 });
  }

  // ---- escotillas de otros conductos (cerradas) y un balconcillo abandonado
  function escotilla(z, y, conBalcon = false) {
    huecos.push([z - 0.96, z + 0.96, y - 0.16, y + 1.96]);
    sitios.escotillas.push({ z, y });
    if (conBalcon) sitios.balcon = { z, y: y - 0.16, x: MX + 1.4, ancho: 1.1 };
    cajaE('negro', MX - 0.01, MX + 0.01, y, y + 1.8, z - 0.8, z + 0.8, { tinta: 0 });
    for (const [a, b, c, d] of [[y - 0.12, y, z - 0.92, z + 0.92], [y + 1.8, y + 1.92, z - 0.92, z + 0.92], [y, y + 1.8, z - 0.92, z - 0.8], [y, y + 1.8, z + 0.8, z + 0.92]]) cajaE('aceroOsc', MX, MX + 0.12, a, b, c, d, { tinta: 0.01 });
    cajaE('acero', MX + 0.02, MX + 0.06, y + 0.04, y + 1.76, z - 0.76, z + 0.76, { tinta: 0.008 });
    for (const yy of [y + 0.35, y + 1.45]) cajaE('aceroOsc', MX + 0.06, MX + 0.11, yy, yy + 0.16, z + 0.62, z + 0.74, { tinta: 0.004 });
    meter('aceroOsc', new THREE.TorusGeometry(0.13, 0.016, 5, 14).rotateY(Math.PI / 2).translate(MX + 0.1, y + 0.95, z - 0.2));
    if (conBalcon) {
      cajaE('acero', MX, MX + 1.4, y - 0.16, y - 0.06, z - 1.1, z + 1.1, { tinta: 0.012 });
      for (const zz of [z - 1.1, z + 1.1]) barra('aceroOsc', V(MX + 1.3, y - 0.12, zz), V(MX, y - 1.4, zz), 0.07, { tinta: 0.008 });
      for (const [a, b] of [[V(MX + 1.38, y - 0.06, z - 1.08), V(MX + 1.38, y - 0.06, z + 1.08)], [V(MX, y - 0.06, z - 1.08), V(MX + 1.38, y - 0.06, z - 1.08)], [V(MX, y - 0.06, z + 1.08), V(MX + 1.38, y - 0.06, z + 1.08)]]) {
        barra('acero', a.clone().setY(y + 0.94), b.clone().setY(y + 0.94), 0.04, { tinta: 0.006 });
        for (const p of [a, b]) barra('acero', p, p.clone().setY(y + 0.94), 0.035, { tinta: 0.006 });
      }
    }
  }
  escotilla(-6, -15, true); escotilla(9, -27.5); escotilla(-22, -20.75); escotilla(24.2, -4.2); escotilla(-37, -33);

  // ---- gargolas de los cinturones
  for (const y of [-21, -9]) for (const z of [-15.2, -3.4, 8.6, 27.2, -27.4]) {
    sitios.gargolas.push({ z, y: y - 0.17 });
    cajaE('hormigonOsc', MX + 0.55, MX + 1.2, y - 0.17, y + 0.02, z - 0.14, z + 0.14, { tinta: 0.01 });
    cajaE('negro', MX + 1.19, MX + 1.21, y - 0.12, y - 0.02, z - 0.08, z + 0.08, { tinta: 0 });
  }

  // ---- bandeja de cables a 3,6 m sobre la base, con sus mensulas, tres cables y alguno que se descuelga
  const huecosBandeja = [[MURO.ESCALA_Z - 0.45, MURO.ESCALA_Z + 0.45], [6.1, 6.7], [-9.1, -8.5], [15.2, 15.8], ...MURO.CONTRAFUERTES.map((z) => [z - 0.8, z + 0.8])];
  const tramosBandeja = [];
  let z0 = -60;
  for (const [a, b] of huecosBandeja.filter(([a]) => a > -60 && a < 60).sort((p, q) => p[0] - q[0])) { if (a > z0) tramosBandeja.push([z0, a]); z0 = Math.max(z0, b); }
  tramosBandeja.push([z0, 60]);
  for (const [a, b] of tramosBandeja) {
    if (b - a < 0.4) continue;
    sitios.bandeja.push([a, b]);
    cajaE('acero', MX + 0.05, MX + 0.46, 3.55, 3.6, a, b, { tinta: 0.008 });
    cajaE('acero', MX + 0.43, MX + 0.46, 3.6, 3.7, a, b, { tinta: 0.006 });
    for (const x of [0.15, 0.25, 0.35]) barra('cuerda', V(MX + x, 3.64, a), V(MX + x, 3.64, b), 0.02, { tinta: 0 });
    for (let z = a + 0.2; z < b; z += 1.5) {
      barra('aceroOsc', V(MX, 3.53, z), V(MX + 0.46, 3.53, z), 0.035, { tinta: 0.005 });
      barra('aceroOsc', V(MX, 3.2, z), V(MX + 0.4, 3.52, z), 0.025, { tinta: 0.004 });
    }
    for (let z = a + 3.3; z + 1.5 < b; z += 7.3 + r() * 3) {           // un cable que se descuelga entre dos mensulas
      const caida = 0.25 + r() * 0.3;
      let ant = V(MX + 0.42, 3.6, z);
      for (let i = 1; i <= 8; i++) {
        const t = i / 8, p = V(MX + 0.44, 3.6 - Math.sin(t * Math.PI) * caida, z + 1.5 * t);
        barra('cuerda', ant, p, 0.018, { tinta: 0 }); ant = p;
      }
    }
  }
  // la caja de registro junto a la salida con su tubo, y el aplique
  huecos.push([-3.02, -2.41, 0.86, 1.59], [-2.04, -1.68, 1.91, 2.22]);
  cajaE('aceroOsc', MX, MX + 0.16, 0.9, 1.55, -2.98, -2.45, { tinta: 0.01 });
  cajaE('ambar', MX + 0.16, MX + 0.17, 1.38, 1.44, -2.62, -2.56, { tinta: 0 });
  cilindro('aceroOsc', V(MX + 0.1, 1.55, -2.85), V(MX + 0.1, 3.55, -2.85), 0.025, 6, 0.006);
  cilindro('aceroOsc', V(MX + 0.1, -0.4, -2.6), V(MX + 0.1, 0.9, -2.6), 0.025, 6, 0.006);
  cajaE('aceroOsc', MX, MX + 0.14, 1.95, 2.18, -2.0, -1.72, { tinta: 0.008 });
  cajaE('ambar', MX + 0.14, MX + 0.2, 1.98, 2.15, -1.97, -1.75, { tinta: 0.004 });
  for (const z of [-1.98, -1.86, -1.74]) barra('aceroOsc', V(MX + 0.2, 1.97, z), V(MX + 0.2, 2.16, z), 0.008, { tinta: 0 });
  const aplique = new THREE.PointLight('#ffd2a0', 2.6, 5, 2);
  aplique.position.set(MX + 0.4, 2.05, -1.86);
  scene.add(aplique);
  // apliques pequenos bajo la coronacion
  for (let z = -63; z <= 63; z += 9) if (Math.abs(z - MURO.ESCALA_Z) > 1) cajaE('ambar', MX + 0.85, MX + 0.95, COR0 - 0.08, COR0, z - 0.12, z + 0.12, { tinta: 0.006 });

  // ---- escala con jaula: de la base a la coronacion (por el hueco del parapeto)
  function escala(z, y0, y1, jauladesde, x = MX + 0.45) {
    // la jaula: aros abiertos hacia el muro y cinco barras
    for (const dz of [-0.22, 0.22]) barra('acero', V(x, y0, z + dz), V(x, y1, z + dz), 0.045, { tinta: 0.008 });
    for (let y = y0 + 0.25; y < y1; y += 0.3) barra('acero', V(x, y, z - 0.22), V(x, y, z + 0.22), 0.024, { tinta: 0.004 });
    for (let y = y0 + 0.6; y < y1; y += 1.8) for (const dz of [-0.22, 0.22]) barra('aceroOsc', V(MX, y, z + dz), V(x, y, z + dz), 0.035, { tinta: 0.005 });
    const aros = [];
    for (let y = jauladesde; y < y1 - 0.1; y += 0.75) aros.push(new THREE.TorusGeometry(0.4, 0.014, 4, 14, Math.PI * 1.25).rotateX(Math.PI / 2).rotateY(Math.PI * 0.625).translate(x + 0.36, y, z));
    if (aros.length) meter('acero', mergeGeometries(aros));
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI * 0.62 + i * (Math.PI * 1.24 / 4);
      barra('acero', V(x + 0.36 + Math.cos(a) * 0.4, jauladesde, z + Math.sin(a) * 0.4), V(x + 0.36 + Math.cos(a) * 0.4, y1 - 0.15, z + Math.sin(a) * 0.4), 0.02, { tinta: 0.003 });
    }
  }
  escala(MURO.ESCALA_Z, 0, T + 1.0, 2.3);
  choques.cajas.push({ x: MX + 0.6, z: MURO.ESCALA_Z, hx: 0.55, hz: 0.45, ang: 0 });
  // y la que baja al suelo desde el final de la pasarela pegada al muro, con descansillos cada 9 m
  escala(-13.4, G, -0.1, G + 2.4, MX + 0.72);
  cajaE('aceroOsc', MX + 0.4, MX + 1.2, -0.03, 0.012, -13.85, -12.95, { tinta: 0.006 });               // la trampilla
  for (const y of [-9, -18, -27]) {
    cajaE('acero', MX + 0.6, MX + 1.6, y - 0.08, y, -15.4, -13.9, { tinta: 0.01 });
    for (const [a, b] of [[V(MX + 1.55, y, -15.35), V(MX + 1.55, y, -13.95)], [V(MX + 0.6, y, -15.35), V(MX + 1.55, y, -15.35)]]) {
      barra('aceroOsc', a.clone().setY(y + 1.0), b.clone().setY(y + 1.0), 0.04, { tinta: 0.006 });
      for (const p of [a, b]) barra('aceroOsc', p, p.clone().setY(y + 1.0), 0.04, { tinta: 0.006 });
    }
  }

  // ---- garitas voladas sobre la coronacion
  // cada una es una caseta de casetas.js (chapa grecada, ventanas con lo de dentro encendido, puerta al paso de ronda,
  // foco buscador, camara, cuadro, aire y antena) sobre un suelo volado con su balconcillo de rejilla y barandilla, y
  // cuatro tornapuntas con sus placas de anclaje atornilladas al muro
  MURO.GARITAS.forEach((z, i) => {
    const x0 = MX + 0.2, x1 = MX + 2.4, y0 = T, xb = x1 + 0.75;
    caseta({ x0, x1, z0: z - 1.2, z1: z + 1.2, y0, alto: 2.6, codigo: i,
      puerta: { lado: '-z', u: 0.62, mano: 'der' },
      ventanas: [{ lado: '+x', u: 1.2, ancho: 1.8, v0: 1.0, v1: 1.95 }, { lado: '+z', u: 1.35, ancho: 1.0, v0: 1.05, v1: 1.9 }, { lado: '-z', u: 1.65, ancho: 0.6, v0: 1.1, v1: 1.9 }],
      foco: [x1 - 0.3, z + 0.85, 1, 0], camara: ['+x', false], cuadro: ['+z', 0.38], aire: [x0 + 0.65, z + 0.55], antenaEn: [x0 + 0.4, z - 0.85], canalon: '+z' });
    // el suelo volado y el balconcillo
    cajaE('acero', MX + 1.0, xb, y0 - 0.16, y0 - 0.02, z - 1.3, z + 1.3, { tinta: 0.012 });
    const rej = new THREE.PlaneGeometry(xb - x1, 2.5).rotateX(-Math.PI / 2).translate((x1 + xb) / 2, y0 + 0.005, z);
    const uvR = rej.attributes.uv, pR = rej.attributes.position;
    for (let k2 = 0; k2 < uvR.count; k2++) uvR.setXY(k2, pR.getX(k2) / 0.32, pR.getZ(k2) / 0.32);
    meter('rejilla', rej);
    for (const [a, b] of [[V(xb, y0, z - 1.25), V(xb, y0, z + 1.25)], [V(x1, y0, z - 1.25), V(xb, y0, z - 1.25)], [V(x1, y0, z + 1.25), V(xb, y0, z + 1.25)]]) {
      for (const p of [a, b, a.clone().lerp(b, 0.5)]) barra('acero', p, p.clone().setY(y0 + 1.0), 0.04, { tinta: 0.008 });
      for (const h of [1.0, 0.5]) barra('acero', a.clone().setY(y0 + h), b.clone().setY(y0 + h), h > 0.9 ? 0.045 : 0.03, { tinta: 0.008 });
      barra('aceroOsc', a.clone().setY(y0 + 0.07), b.clone().setY(y0 + 0.07), 0.012, { tinta: 0 });
    }
    // tornapuntas: dos bajo la caseta y dos bajo el balconcillo, con sus placas y pernos en el muro
    for (const s of [-1, 1]) for (const [xa, ya] of [[x1 - 0.1, y0 - 2.6], [xb - 0.1, y0 - 3.3]]) {
      barra('aceroOsc', V(xa, y0 - 0.14, z + s * 1.1), V(MX + 0.03, ya, z + s * 1.1), 0.11, { tinta: 0.012 });
      cajaE('aceroOsc', MX, MX + 0.03, ya - 0.18, ya + 0.18, z + s * 1.1 - 0.16, z + s * 1.1 + 0.16, { tinta: 0.006 });
      for (const dy of [-0.12, 0.12]) for (const dz of [-0.1, 0.1]) cilindro('acero', V(MX + 0.03, ya + dy, z + s * 1.1 + dz), V(MX + 0.06, ya + dy, z + s * 1.1 + dz), 0.018, 6, 0);
      cajaE('aceroOsc', xa - 0.15, xa + 0.15, y0 - 0.3, y0 - 0.16, z + s * 1.1 - 0.08, z + s * 1.1 + 0.08, { tinta: 0.005 });   // cartela
    }
    for (const xx of [x1, xb - 0.05]) cajaE('aceroOsc', xx - 0.05, xx + 0.05, y0 - 0.28, y0 - 0.16, z - 1.3, z + 1.3, { tinta: 0.006 });
  });

  // ---- torres de focos sobre la coronacion (su haz, el polvo y el deslumbramiento van en focos.js)
  const focos = [];
  for (const z of [-30, -18, -6, 6, 18, 30]) {
    cilindro('aceroOsc', V(MX + 0.55, T, z), V(MX + 0.55, T + 4.0, z), 0.08, 8, 0.01);
    barra('aceroOsc', V(MX + 0.55, T + 3.8, z), V(MX + 1.75, T + 3.8, z), 0.07, { tinta: 0.008 });
    barra('aceroOsc', V(MX + 0.55, T + 2.9, z), V(MX + 1.5, T + 3.75, z), 0.04, { tinta: 0.005 });
    cajaE('aceroOsc', MX + 1.55, MX + 2.05, T + 3.45, T + 3.85, z - 0.3, z + 0.3, { tinta: 0.01 });
    cajaE('focoLuz', MX + 1.6, MX + 2.0, T + 3.42, T + 3.46, z - 0.25, z + 0.25, { tinta: 0 });
    // placa con pernos, caja de conexiones con su aviso, tubo, peldanos, visera y aletas del proyector y la reactancia
    cajaE('aceroOsc', MX + 0.35, MX + 0.75, T, T + 0.03, z - 0.2, z + 0.2, { tinta: 0.005 });
    for (const dx of [-0.13, 0.13]) for (const dz of [-0.13, 0.13]) cilindro('acero', V(MX + 0.55 + dx, T + 0.03, z + dz), V(MX + 0.55 + dx, T + 0.07, z + dz), 0.02, 6, 0);
    cajaE('acero', MX + 0.63, MX + 0.76, T + 1.0, T + 1.42, z - 0.13, z + 0.13, { tinta: 0.008 });
    senal(4, V(MX + 0.765, T + 1.3, z), V(1, 0, 0), 0.12, 0.12);
    cilindro('aceroOsc', V(MX + 0.66, T + 1.42, z + 0.07), V(MX + 0.66, T + 3.72, z + 0.07), 0.018, 6, 0.004);
    for (let y = T + 1.7, i = 0; y < T + 3.5; y += 0.35, i++) barra('acero', V(MX + 0.55, y, z), V(MX + 0.55, y, z + (i % 2 ? 0.22 : -0.22)), 0.025, { tinta: 0.003 });
    cajaE('aceroOsc', MX + 1.5, MX + 2.15, T + 3.85, T + 3.89, z - 0.36, z + 0.36, { tinta: 0.004 });
    for (let x = MX + 1.6; x < MX + 2.0; x += 0.09) cajaE('aceroOsc', x, x + 0.02, T + 3.89, T + 3.98, z - 0.27, z + 0.27, { tinta: 0 });
    cajaE('acero', MX + 0.75, MX + 1.0, T + 3.6, T + 3.76, z - 0.1, z + 0.1, { tinta: 0.006 });
    // de la lente hacia abajo y hacia fuera, hacia la ciudad (los dos de la base, a donde apunta su luz, abajo)
    focos.push({ z, x: MX + 1.8, y: T + 3.4, direccion: [0.408, -0.913, (z > 0 ? 1 : -1) * 0.06] });
  }
  // dos de verdad, los que alumbran la base (los demas solo se ven)
  const luces = [];
  for (const [z, tx, tz] of [[-6, 21.5, -4.5], [6, 22.5, 2.5]]) {
    const s = new THREE.SpotLight('#dfe7f0', 26, 34, 0.5, 0.7, 1.4);
    s.position.set(MX + 1.8, T + 3.4, z); s.target.position.set(tx, 0, tz);
    focos.find((f) => f.z === z).objetivo = [tx, 0, tz];        // su haz, por donde va su luz
    scene.add(s, s.target); luces.push(s);
  }

  // ---- rotulos de plantilla y desconchones (con la ferralla a la vista)
  const tRot = texturaRotulos(); texturas.push(tRot);
  const gsRot = [];
  const rotulo = (cas, z0, z1, y0, y1, x = MX + 0.004) => {
    if (cas !== CASILLA.DESCONCHON && x < MX + 0.01) huecos.push([z0 - 0.04, z1 + 0.04, y0 - 0.04, y1 + 0.04]);
    const g = new THREE.PlaneGeometry(z1 - z0, y1 - y0).rotateY(Math.PI / 2).translate(x, (y0 + y1) / 2, (z0 + z1) / 2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, (cas + uv.getX(i)) / 5);
    gsRot.push(g);
  };
  rotulo(CASILLA.C7, -3.3, -2.1, 2.4, 2.85);
  rotulo(CASILLA.N35, 2.75, 3.6, 2.3, 2.75);
  rotulo(CASILLA.S07, -7.0, -4.6, -3.6, -2.0);
  rotulo(CASILLA.S07, -24.2, -22.4, 0.6, 1.8);
  rotulo(CASILLA.S07, 19.6, 21.4, -12.4, -11.2);
  rotulo(CASILLA.FRANJAS, MURO.ESCALA_Z - 1.0, MURO.ESCALA_Z + 1.0, COR0, T, MX + 1.102);
  // (aqui iban los desconchones PINTADOS, una casilla con un borron y tres barras pegadas delante: ahora son agujeros de
  // verdad en su panel, abajo)
  for (let i = 0; i < 18; i++) r();                // lo que gastaban del azar, para no mover lo de despues
  const rotulos = new THREE.Mesh(mergeGeometries(gsRot), new THREE.MeshToonMaterial({ map: tRot, gradientMap: gradiente, transparent: true, alphaTest: 0.02, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  rotulos.renderOrder = -1;
  rotulos.receiveShadow = true;
  scene.add(rotulos);

  // ---- los paneles DANADOS (danos.js), ya sabiendo lo que tienen delante (rotulos, rejillas, escotillas, cinturones)
  const danos = crearDanos();
  const fijos = [[-5.9, 1.9, 0.55, 'golpe'], [4.8, -3.2, 0.7, 'ferralla'], [-9.6, -14.2, 0.8, 'golpe'], [6.2, -27.2, 0.9, 'ferralla'], [-30.5, 1.4, 0.6, 'ferralla'], [26.5, 2.0, 0.7, 'golpe']];
  for (const [z, y, s, tipo] of fijos) {
    const zc = Math.round(z / 3) * 3, fila = filas.find(([a, b]) => y >= a && y < b);
    if (!fila || (zc === 0 && fila[0] === 0)) continue;
    let p = porDanar.find((q) => q.zc === zc && q.y0 === fila[0]);
    if (!p) {                                       // era una caja: se quita del lote y pasa a danado
      p = { zc, zA: zc - 1.5, y0: fila[0], y1: fila[1], cara: 1, tinte: new THREE.Color(0.7, 0.7, 0.71), semilla: Math.floor(rD() * 1e9) };
      const i = gsPan.findIndex((g) => g.userData.zc === zc && g.userData.y0 === fila[0]);
      if (i >= 0) { p.cara = gsPan[i].userData.cara; p.tinte = gsPan[i].userData.tinte; gsPan.splice(i, 1); }
      porDanar.push(p);
    }
    p.tipo = tipo; p.desconchon = { u: p.zA + 3 - z, v: y - fila[0], R: 0.5 * s };
  }
  const [rqx, rqy, rqw, rqh] = tPan.userData.remiendo;
  for (const p of porDanar) {
    const { zA, y0, y1, cara } = p, [qu, qv] = casillaAtlas(cara);
    const ok = danos.panel({
      r: azar(p.semilla), tipo: p.tipo, ancho: 3, alto: y1 - y0, col: p.tinte, desconchon: p.desconchon,
      cerca: Math.abs(p.zc) <= 30 && y0 >= -12,               // lo que se ve de cerca desde la base
      m: (u, v, w) => [MX - 0.05 + w, y0 + v, zA + 3 - u],
      uvDe: (u, v) => [qu + 0.004 + 0.492 * Math.min(1, Math.max(0, u / 3)), qv + 0.004 + 0.492 * Math.min(1, Math.max(0, v / 3))],
      aMundo: (u, v) => [zA + 3 - u, y0 + v],
      // la placa del remiendo, donde la pinta la textura (px de su casilla de 512 -> m del panel)
      remiendo: p.tipo === 'remiendo' ? [rqx / 512 * 3, (rqx + rqw) / 512 * 3, (1 - (rqy + rqh) / 512) * 3, (1 - rqy / 512) * 3] : null,
      evitar: huecos.filter(([a0, a1, b0, b1]) => a1 > zA && a0 < zA + 3 && b1 > y0 && b0 < y1).map(([a0, a1, b0, b1]) => [zA + 3 - a1, zA + 3 - a0, b0 - y0, b1 - y0]),
    });
    if (!ok) panel(zA + 0.02, zA + 2.98, y0 + 0.02, y1 - 0.02, zA, y0, cara);
  }
  gsPan.push(danos.placas());
  paneles.geometry = mergeGeometries(gsPan);
  scene.add(paneles);
  const mDanos = danos.mallas(scene, gradiente);
  texturas.push(...(mDanos.texturas || []));
  for (const [a, b, rr] of danos.barras) cilindro('ferralla', V(...a), V(...b), rr, 6, 0);
  huecos.push(...danos.huecos);
  // chorreones de agua bajo cinturones, gargolas, contrafuertes y la coronacion
  const tMancha = texturaMancha(); texturas.push(tMancha);
  const gsMan = [];
  const salida = [-W2 - 0.16, W2 + 0.16, -0.14, H + 0.16];                              // que no pasen por delante del conducto
  const noPisar = [salida, ...danos.huecos];                                                // ni por delante de los desconchones
  const mancha = (z0, z1, y0, y1, lote = gsMan) => lote.push(...planosMancha(MX + 0.002, z0, z1, y0, y1, noPisar));
  for (const y of [-21, -9]) for (const z of [-15.2, -3.4, 8.6, 27.2, -27.4]) mancha(z - 0.5, z + 0.5, y - 9 - r() * 3, y - 0.3);
  for (let z = -66; z < 66; z += 4 + r() * 5) mancha(z, z + 1.5 + r() * 2.5, COR0 - 2.5 - r() * 3, COR0);
  for (const z of MURO.CONTRAFUERTES) mancha(z - 1.5, z - 0.75, -30 + r() * 10, -12 + r() * 10);
  // y lo que sale de los danos: humedad bajo las grietas, eflorescencia blanca y el oxido que chorrea de la ferralla
  for (const q of danos.manchas.humeda) mancha(...q);
  const gsBlanca = [], gsOxido = [];
  for (const q of danos.manchas.blanca) mancha(...q, gsBlanca);
  for (const q of danos.manchas.oxido) mancha(...q, gsOxido);
  const mMancha = (color, opacity) => new THREE.MeshBasicMaterial({ color, alphaMap: tMancha, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const chorreones = new THREE.Mesh(mergeGeometries(gsMan), mMancha('#141a1f', 0.5));
  chorreones.renderOrder = -2;
  scene.add(chorreones);
  for (const [gs, color, op] of [[gsBlanca, '#bfc4bc', 0.12], [gsOxido, '#4a3121', 0.42]]) {
    if (!gs.length) continue;
    const mm = new THREE.Mesh(mergeGeometries(gs), mMancha(color, op));
    mm.renderOrder = -2;
    scene.add(mm);
  }

  // ---- el suelo, 35 m mas abajo: tierra, solera al pie del muro con su canaleta, cascotes y charcos
  const tTierra = texturaTierra(); texturas.push(tTierra);
  const tierra = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2).translate(60, G, 0), new THREE.MeshToonMaterial({ map: tTierra, gradientMap: gradiente, color: '#6f746c' }));
  tierra.receiveShadow = true;
  const solera = new THREE.PlaneGeometry(8, 2 * HZ).rotateX(-Math.PI / 2).translate(MX + 4.9, G + 0.02, 0);
  const uvS = solera.attributes.uv, pS = solera.attributes.position;
  for (let i = 0; i < uvS.count; i++) uvS.setXY(i, pS.getX(i) / 3, pS.getZ(i) / 3);
  const mSolera = new THREE.Mesh(solera, M.hormigon);
  mSolera.receiveShadow = true;
  scene.add(tierra, mSolera);
  cajaE('negro', MX + 1.25, MX + 1.55, G + 0.0, G + 0.03, -HZ, HZ, { tinta: 0 });                 // canaleta
  for (let z = -HZ; z < HZ; z += 0.6) cajaE('aceroOsc', MX + 1.25, MX + 1.55, G + 0.03, G + 0.045, z, z + 0.04, { tinta: 0 });
  for (let i = 0; i < 46; i++) {
    const s = 0.15 + r() * r() * 0.9, x = MX + 1.0 + r() * 7, z = -40 + r() * 80;
    caja('hormigonOsc', x, G + s * 0.3, z, s * (0.8 + r()), s * 0.6, s * (0.8 + r()), { q: new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 0.4, r() * 3, r() * 0.4)), tinta: 0.012 });
  }
  const charcos = [];
  for (const [x, z, a, b] of [[21.5, -6, 2.4, 1.2], [24.8, 4.5, 1.6, 0.9], [20.3, 13, 3.0, 1.0], [27.5, -18, 2.0, 1.4]]) charcos.push(new THREE.CircleGeometry(1, 20).scale(a, b, 1).rotateX(-Math.PI / 2).translate(x, G + 0.03, z));
  const mCharco = new THREE.Mesh(mergeGeometries(charcos), new THREE.MeshBasicMaterial({ color: '#232a30', transparent: true, opacity: 0.75, depthWrite: false }));
  scene.add(mCharco);
  // el CAMINO DE RONDA al pie del muro: asfalto oscuro con la raya discontinua (una raya de 3 m vista desde 35 m es lo
  // que dice la altura) y bordillo
  const RX0 = MX + 9, RX1 = MX + 15;
  const ronda = new THREE.Mesh(new THREE.PlaneGeometry(RX1 - RX0, 2 * HZ).rotateX(-Math.PI / 2).translate((RX0 + RX1) / 2, G + 0.025, 0),
    new THREE.MeshToonMaterial({ color: '#2d3236', gradientMap: gradiente }));
  ronda.receiveShadow = true;
  scene.add(ronda);
  const rayas = [];
  for (let z = -HZ + 1; z < HZ - 3; z += 6) rayas.push(new THREE.PlaneGeometry(0.15, 3).rotateX(-Math.PI / 2).translate((RX0 + RX1) / 2, G + 0.035, z + 1.5));
  for (const x of [RX0 + 0.3, RX1 - 0.3]) rayas.push(new THREE.PlaneGeometry(0.12, 2 * HZ).rotateX(-Math.PI / 2).translate(x, G + 0.035, 0));
  const mRayas = new THREE.Mesh(mergeGeometries(rayas), new THREE.MeshBasicMaterial({ color: '#9aa1a3', transparent: true, opacity: 0.55, depthWrite: false }));
  scene.add(mRayas);
  for (const x of [RX0 - 0.25, RX1]) cajaE('hormigonOsc', x, x + 0.25, G, G + 0.15, -HZ, HZ, { tinta: 0.01 });
  // FAROLAS DE PARED al pie del muro: brazo, pantalla y su charco de luz calida en el suelo (aditivo, sin luz de verdad:
  // seis PointLight a 35 m no se notarian y costarian)
  const tCharcoLuz = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const c = cv.getContext('2d'), g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  texturas.push(tCharcoLuz);
  const gsLuz = [];
  for (let z = -60; z <= 60; z += 12) {
    if (Math.abs(z) < 1) continue;
    const yL = G + 6.2;
    barra('aceroOsc', V(MX, yL + 0.5, z), V(MX + 1.1, yL + 0.15, z), 0.05);
    cajaE('aceroOsc', MX + 0.9, MX + 1.5, yL - 0.05, yL + 0.15, z - 0.22, z + 0.22, { tinta: 0.012 });
    cajaE('focoLuz', MX + 0.95, MX + 1.45, yL - 0.07, yL - 0.05, z - 0.18, z + 0.18, { tinta: 0 });
    gsLuz.push(new THREE.CircleGeometry(1, 24).scale(5.5, 4.2, 1).rotateX(-Math.PI / 2).translate(MX + 3.6, G + 0.05, z));
  }
  const mLuzSuelo = new THREE.Mesh(mergeGeometries(gsLuz), new THREE.MeshBasicMaterial({ color: '#b98a52', map: tCharcoLuz, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  mLuzSuelo.renderOrder = 1;
  scene.add(mLuzSuelo);

  // ---- por fotograma: los focos tiemblan un poco y uno falla
  function actualizar(t) {
    luces[0].intensity = 26 * (0.96 + 0.04 * Math.sin(t * 17.3));
    aplique.intensity = 2.6 * (0.9 + 0.1 * Math.sin(t * 23) * Math.sin(t * 5.3));
  }
  const dano = { ...danos.cuenta, tris: mDanos.tris, barras: danos.barras.length };
  const danados = porDanar.map((p) => ({ z: p.zc, y0: p.y0, tipo: p.tipo }));      // para fotografiarlos
  return { actualizar, luces, aplique, texturas, focos, huecos, sitios, alambrada, dano, danados };
}
