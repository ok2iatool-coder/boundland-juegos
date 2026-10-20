// EL MURO de la Base con su PUERTA SUR, las dos torres de vigia y, detras, la ciudad que rodea. Low poly con tinta.
//   muro: paneles de hormigon de 3 m (34 m de alto, 2,4 de grueso) con juntas, chapas oxidadas, cabezas rotas con
//     varillas, contrafuertes escalonados por fuera cada 32 m y concertina arriba cerca de la puerta
//   puerta: hueco de 10 x 14 m con marco de acero; dos hojas que giran hacia dentro (abrir(true)); cerrada, choca
//   letrero: «BASE DE REFUGIADOS» en letras de chapa sobre la puerta; la F no esta (se cayo: esta en el suelo)
//   torres: celosia de cuatro patas hasta 36 m con caseta y foco (de noche barren la Cuenca)
//   ciudad: bloques y ruinas detras del cierre, en la niebla (la Base es un trozo de una ciudad mayor)
import * as THREE from 'three';
import { Lote, FORMAS, M, col, azar, matToon, TONO } from './geo.js';
import { MURO, DENTRO } from './mapa.js';

const ALTO = MURO.alto, GR = MURO.grueso, HUECO = MURO.puerta, ALTO_PUERTA = MURO.altoPuerta;
const HORMIGON = col(0x9d988a), HORMIGON_OSC = col(0x7f7a6e), OXIDO = col(0x7a5236), ACERO = col(0x55504a), CHAPA = col(0x6d5a45);
export const TORRES = [{ x: -13, z: -9 }, { x: 13, z: -9 }];
export const ALTO_TORRE = 36;

export function crearMuro(grupo, { altura, choques }) {
  const r = azar(31);
  const cerca = new Lote('muro', 1), lejos = new Lote('muro_lejos', 2), detalle = new Lote('muro_detalle', 3);
  const LARGO = 420;

  // ---------------- paneles ----------------
  for (const lado of [-1, 1]) {
    for (let x0 = HUECO; x0 < LARGO; x0 += 3) {
      const x = lado * (x0 + 1.5);
      const roto = r() < 0.07, alto = ALTO + (roto ? -2.5 - r() * 3 : (r() - 0.6) * 1.2);
      const tono = HORMIGON.clone().lerp(HORMIGON_OSC, r() * 0.55);
      const L = x0 < 160 ? cerca : lejos;
      L.poner(FORMAS.cajaSuelo, M(x, -1, 0, 0, [3, alto + 1, GR]), tono, { tinta: x0 < 160 ? 0.03 : 0.05, varia: 0.04 });
      if (x0 >= 160) continue;
      // junta vertical (las dos caras) y suciedad al pie
      for (const s of [-1, 1]) {
        detalle.poner(FORMAS.cajaSuelo, M(x - lado * 1.5, 0, s * (GR / 2 + 0.01), 0, [0.08, alto, 0.04]), HORMIGON_OSC.clone().multiplyScalar(0.7), { tinta: 0 });
        detalle.poner(FORMAS.cajaSuelo, M(x, -0.2, s * (GR / 2 + 0.015), 0, [3, 1.6 + r() * 1.4, 0.03]), col(0x6e6658), { tinta: 0, varia: 0.1 });
      }
      // cabeza rota: varillas que asoman
      if (roto) for (let k = 0; k < 4; k++) {
        detalle.poner(FORMAS.cil6, M(x + (r() - 0.5) * 2.4, alto - 0.3, (r() - 0.5) * 1.8, [(r() - 0.5) * 0.6, 0, (r() - 0.5) * 0.6], [0.05, 1 + r() * 1.6, 0.05]), OXIDO, { tinta: 0.012 });
      }
      // chapas oxidadas clavadas (parches)
      if (r() < 0.22) {
        const s = r() < 0.6 ? 1 : -1, y = 2 + r() * 22, w = 1.6 + r() * 1.6, h = 1.4 + r() * 2.6;
        detalle.poner(FORMAS.caja, M(x + (r() - 0.5) * 0.6, y, s * (GR / 2 + 0.04), [0, 0, (r() - 0.5) * 0.15], [w, h, 0.06]), OXIDO.clone().lerp(CHAPA, r()), { tinta: 0.02 });
      }
    }
  }
  // juntas horizontales (largas) en las dos caras
  for (const lado of [-1, 1]) for (const s of [-1, 1]) for (const y of [8.5, 17, 25.5]) {
    detalle.poner(FORMAS.caja, M(lado * (HUECO + 80), y, s * (GR / 2 + 0.012), 0, [160, 0.09, 0.03]), HORMIGON_OSC.clone().multiplyScalar(0.72), { tinta: 0 });
  }

  // ---------------- contrafuertes por fuera ----------------
  for (let x0 = 22; x0 < LARGO; x0 += 32) {
    for (const lado of [-1, 1]) {
      const x = lado * x0, L = x0 < 160 ? cerca : lejos, tono = HORMIGON.clone().lerp(HORMIGON_OSC, 0.3 + r() * 0.4);
      const z0 = GR / 2, y0 = altura(x, z0 + 2) - 0.6;
      L.poner(FORMAS.cajaSuelo, M(x, y0, z0 + 1.75, 0, [4, 12.6, 3.5]), tono);
      L.poner(FORMAS.cajaSuelo, M(x, y0 + 12.6, z0 + 1.3, 0, [3.4, 10, 2.6]), tono);
      L.poner(FORMAS.cajaSuelo, M(x, y0 + 22.6, z0 + 0.9, 0, [2.8, 9, 1.8]), tono);
      // los remates inclinados
      L.poner(FORMAS.dosAguas, M(x, y0 + 31.6, z0 + 0.9, Math.PI / 2, [1.8, 1.2, 2.8]), tono);
      choques.cajas.push({ x, z: z0 + 1.75, hx: 2, hz: 1.75, ang: 0 });
    }
  }

  // ---------------- el marco de la puerta ----------------
  const marco = new Lote('puerta_marco', 4);
  for (const s of [-1, 1]) {
    marco.poner(FORMAS.cajaSuelo, M(s * (HUECO + 0.6), -0.5, 0, 0, [1.2, ALTO_PUERTA + 2.9, GR + 0.6]), ACERO);
    // remaches
    for (let y = 1; y < ALTO_PUERTA; y += 1.4) for (const zz of [-1, 1]) marco.poner(FORMAS.bola, M(s * (HUECO + 0.6), y, zz * (GR / 2 + 0.31), 0, 0.16), col(0x6a645b), { tinta: 0.008 });
    // focos sobre la puerta
    marco.poner(FORMAS.cil8, M(s * (HUECO + 2.4), ALTO_PUERTA + 4.5, GR / 2 + 0.5, [Math.PI / 2 + 0.5, 0, 0], [0.7, 0.8, 0.7]), col(0x3c3934));
    marco.poner(FORMAS.caja, M(s * (HUECO + 2.4), ALTO_PUERTA + 4.6, GR / 2 + 0.2, 0, [0.2, 0.2, 0.6]), ACERO);
  }
  marco.poner(FORMAS.cajaSuelo, M(0, ALTO_PUERTA, 0, 0, [2 * HUECO + 2.4, 2.4, GR + 0.6]), ACERO);
  // el muro sigue por encima del dintel (sin esto quedaba un hueco de 10 m hasta arriba)
  for (const s of [-1, 1]) cerca.poner(FORMAS.cajaSuelo, M(s * HUECO / 2, ALTO_PUERTA + 2.4, 0, 0, [HUECO, ALTO - ALTO_PUERTA - 2.4 + (s > 0 ? 0.2 : -0.3), GR]), HORMIGON.clone().lerp(HORMIGON_OSC, 0.25 + 0.2 * s), { tinta: 0.03, varia: 0.04 });
  marco.poner(FORMAS.caja, M(0, ALTO_PUERTA + 1.2, GR / 2 + 0.32, 0, [2 * HUECO + 1.6, 0.25, 0.08]), col(0xb59a3a), { tinta: 0.01 });   // franja de aviso
  // el suelo del paso: losas de hormigon gastado
  for (let k = -2; k <= 2; k++) marco.poner(FORMAS.cajaSuelo, M(k * 2, altura(k * 2, 0) - 0.18, 0, 0, [1.96, 0.2, GR + 0.4]), col(0x8e897c), { tinta: 0.008, varia: 0.08 });

  // ---------------- las hojas (giran) ----------------
  const hojas = [];
  for (const s of [-1, 1]) {
    const L = new Lote('puerta_hoja', 10 + s);
    const W = HUECO, cx = -s * W / 2;               // la hoja va del gozne hacia el centro
    L.poner(FORMAS.cajaSuelo, M(cx, 0.05, 0, 0, [W - 0.06, ALTO_PUERTA - 0.15, 0.32]), CHAPA, { tinta: 0.03 });
    for (let k = 0; k < 5; k++) L.poner(FORMAS.cajaSuelo, M(-s * (0.5 + k * 1.0), 0.05, 0.2, 0, [0.18, ALTO_PUERTA - 0.15, 0.1]), CHAPA.clone().multiplyScalar(0.85), { tinta: 0.012 });
    for (const y of [2.5, 7, 11.5]) L.poner(FORMAS.caja, M(cx, y, -0.2, 0, [W - 0.3, 0.35, 0.1]), CHAPA.clone().multiplyScalar(0.82), { tinta: 0.012 });
    L.poner(FORMAS.caja, M(cx, 1.2, 0.24, [0, 0, 0.3], [2.2, 1.0, 0.03]), OXIDO, { tinta: 0.008 });
    const piv = new THREE.Group();
    piv.position.set(s * HUECO, altura(s * HUECO, -0.6), -0.95);
    piv.add(L.hacer());
    piv.name = 'hoja';
    grupo.add(piv);
    const caja = { x: 0, z: 0, hx: W / 2, hz: 0.22, ang: 0 };
    choques.cajas.push(caja);
    hojas.push({ piv, s, caja, giro: 0 });
  }
  const puerta = { abierta: false, objetivo: 0 };
  function colocarHojas() {
    for (const h of hojas) {
      h.piv.rotation.y = h.giro * -h.s;
      // la caja de choque sigue a la hoja: centro a medio largo desde el gozne
      const a = h.piv.rotation.y, dx = -h.s * Math.cos(a), dz = h.s * Math.sin(a);
      h.caja.x = h.piv.position.x + dx * HUECO / 2;
      h.caja.z = h.piv.position.z + dz * HUECO / 2;
      h.caja.ang = -a;
    }
  }
  colocarHojas();
  puerta.abrir = (v, ya = false) => { puerta.abierta = v; puerta.objetivo = v ? 1.72 : 0; if (ya) { for (const h of hojas) h.giro = puerta.objetivo; colocarHojas(); } };
  puerta.actualizar = (dt) => {
    let mov = false;
    for (const h of hojas) {
      const d = puerta.objetivo - h.giro;
      if (Math.abs(d) > 1e-4) { h.giro += Math.sign(d) * Math.min(Math.abs(d), dt * 0.45); mov = true; }
    }
    if (mov) colocarHojas();
    return mov;
  };

  // ---------------- el letrero (letras de chapa) y la F en el suelo ----------------
  const letrero = letras(r, altura);
  grupo.add(letrero);

  // ---------------- concertina arriba, cerca de la puerta ----------------
  {
    const pts = [];
    for (const s of [-1, 1]) {
      const seg = [];
      for (let t = 0; t <= 1; t += 1 / 1600) {
        const x = s * (HUECO + 1 + t * 70), a = t * 70 / 0.32 * Math.PI * 2;
        seg.push(new THREE.Vector3(x + Math.sin(a) * 0.08, ALTO + 0.55 + Math.sin(a) * 0.42, Math.cos(a) * 0.42));
      }
      pts.push(seg);
    }
    for (const seg of pts) {
      const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seg), seg.length, 0.018, 3, false);
      const m = new THREE.Mesh(g, new THREE.MeshToonMaterial({ color: 0x3a3631, gradientMap: TONO }));
      m.name = 'concertina';
      grupo.add(m);
    }
  }

  // ---------------- torres de vigia ----------------
  const torres = new Lote('torres', 5);
  for (const t of TORRES) {
    const y0 = altura(t.x, t.z) - 0.2, A = 1.7, B = 1.15;
    const pata = (sx, sz) => [t.x + sx * A, t.z + sz * A];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const [x0, z0] = pata(sx, sz), x1 = t.x + sx * B, z1 = t.z + sz * B;
      const v = new THREE.Vector3(x1 - x0, ALTO_TORRE, z1 - z0), l = v.length();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize());
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x0, y0, z0), q, new THREE.Vector3(0.28, l, 0.28));
      torres.poner(FORMAS.cajaSuelo, m, ACERO);
      torres.poner(FORMAS.cajaSuelo, M(x0, y0 - 0.3, z0, 0, [0.9, 0.5, 0.9]), HORMIGON_OSC);     // zapata
      choques.circulos.push({ x: x0, z: z0, r: 0.45 });
    }
    // cruces de la celosia en cada cara, cada 6 m
    for (let y = 2; y < ALTO_TORRE - 2; y += 6) {
      const k0 = y / ALTO_TORRE, k1 = (y + 6) / ALTO_TORRE, a0 = A + (B - A) * k0, a1 = A + (B - A) * k1;
      for (const [ux, uz] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const px = -uz, pz = ux;                      // a lo ancho de la cara
        for (const s of [-1, 1]) {
          const p0 = new THREE.Vector3(t.x + ux * a0 + px * s * a0, y0 + y, t.z + uz * a0 + pz * s * a0);
          const p1 = new THREE.Vector3(t.x + ux * a1 - px * s * a1, y0 + y + 6, t.z + uz * a1 - pz * s * a1);
          const v = p1.clone().sub(p0), l = v.length();
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
          torres.poner(FORMAS.cajaSuelo, new THREE.Matrix4().compose(p0, q, new THREE.Vector3(0.1, l, 0.1)), ACERO.clone().multiplyScalar(0.9), { tinta: 0.012 });
        }
      }
    }
    // la caseta, la barandilla, el tejado y el foco
    const yc = y0 + ALTO_TORRE;
    torres.poner(FORMAS.cajaSuelo, M(t.x, yc - 0.3, t.z, 0, [4.4, 0.3, 4.4]), ACERO);
    torres.poner(FORMAS.cajaSuelo, M(t.x, yc, t.z, 0, [3.6, 1.1, 3.6]), col(0x77705f));
    torres.poner(FORMAS.cajaSuelo, M(t.x, yc + 1.1, t.z, 0, [3.62, 0.9, 3.62]), col(0x2b2a28), { tinta: 0 });   // ventanas
    for (const [cx, cz] of [[-1.75, -1.75], [1.75, -1.75], [-1.75, 1.75], [1.75, 1.75]]) torres.poner(FORMAS.cajaSuelo, M(t.x + cx, yc + 1.1, t.z + cz, 0, [0.16, 0.9, 0.16]), col(0x77705f));
    torres.poner(FORMAS.cajaSuelo, M(t.x, yc + 2.0, t.z, 0, [3.7, 0.3, 3.7]), col(0x77705f));
    torres.poner(FORMAS.cono4, M(t.x, yc + 2.3, t.z, 0, [5.6, 1.6, 5.6]), col(0x5f4a3a));
    torres.poner(FORMAS.cil8, M(t.x + Math.sign(t.x) * 0.6, yc + 1.3, t.z + 2.1, [Math.PI / 2 - 0.25, 0, 0], [0.7, 0.9, 0.7]), col(0x3c3934));
    // escalera de mano por una pata
    for (let y = 0.4; y < ALTO_TORRE; y += 0.4) torres.poner(FORMAS.caja, M(t.x - Math.sign(t.x) * 1.5, y0 + y, t.z - 1.55, 0, [0.5, 0.05, 0.05]), ACERO, { tinta: 0 });
  }

  // ---------------- la ciudad de detras ----------------
  const ciudad = new Lote('ciudad', 6);
  {
    const q = azar(77);
    for (let k = 0; k < 140; k++) {
      // en anillos tras el cierre de dentro, y algun bloque alto que asoma por encima del muro
      const lejosZ = DENTRO.z0 - 12 - q() * 260, x = (q() - 0.5) * 760;
      const alto = 8 + Math.pow(q(), 2.4) * (lejosZ < -260 ? 70 : 38), w = 8 + q() * 18, d = 8 + q() * 16;
      const tono = col(0x7d7c74).lerp(col(0x6b6d6a), q()).multiplyScalar(0.85 + q() * 0.2);
      ciudad.poner(FORMAS.cajaSuelo, M(x, -0.5, lejosZ, (q() - 0.5) * 0.3, [w, alto, d]), tono, { tinta: 0.08, varia: 0.05 });
      // ruina: un piso roto encima
      if (q() < 0.4) ciudad.poner(FORMAS.cajaSuelo, M(x + (q() - 0.5) * w * 0.4, alto - 0.5, lejosZ, (q() - 0.5) * 0.5, [w * 0.5, 2 + q() * 5, d * 0.6]), tono.clone().multiplyScalar(0.9), { tinta: 0.08 });
    }
    // dos gruas viejas
    for (const [x, z] of [[-120, -260], [180, -320]]) {
      ciudad.poner(FORMAS.cajaSuelo, M(x, 0, z, 0, [1.6, 64, 1.6]), col(0x6f6a5f), { tinta: 0.08 });
      ciudad.poner(FORMAS.caja, M(x + 14, 63, z, 0.3, [42, 1.4, 1.4]), col(0x6f6a5f), { tinta: 0.08 });
    }
  }

  for (const L of [cerca, lejos, detalle, marco, torres, ciudad]) {
    const g = L.hacer();
    if (L === ciudad || L === lejos) g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    grupo.add(g);
  }
  return { puerta, letrero };
}

// ---------------- letras de chapa ----------------
// un atlas con las letras pintadas (chapa clara con oxido) y un plano por letra; detras, la misma silueta oscura
// (el canto de la chapa) y dos escuadras. «BASE DE RE·UGIADOS»: el hueco de la F con sus dos tornillos.
function letras(r, altura) {
  const TEXTO = 'BASE DE REFUGIADOS', W = 128, Hh = 160, letrasUnicas = [...new Set(TEXTO.replace(/ /g, ''))];
  const c = document.createElement('canvas');
  c.width = W * letrasUnicas.length; c.height = Hh;
  const g = c.getContext('2d');
  g.font = 'bold 150px Bahnschrift, "Arial Narrow", Impact, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  letrasUnicas.forEach((L, i) => {
    g.fillStyle = '#d9d2bf';
    g.fillText(L, W * i + W / 2, Hh - 14);
    // oxido que chorrea
    g.globalCompositeOperation = 'source-atop';
    for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(${120 + r() * 30},${70 + r() * 20},${40},${0.25 + r() * 0.35})`; g.fillRect(W * i + r() * W, r() * Hh * 0.6, 3 + r() * 7, 20 + r() * 70); }
    g.globalCompositeOperation = 'source-over';
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const frente = [], fondo = [], uvF = [], ancho = 1.9, alto = 2.4, y = 21.2, z = GR / 2 + 0.22;
  const paso = 2.0, x0 = -((TEXTO.length - 1) * paso) / 2;
  const grupo = new THREE.Group();
  grupo.name = 'letrero';
  const escuadras = new Lote('letrero_escuadras', 9);
  const quad = (arr, uv, cx, cy, cz, a, slot) => {
    const ca = Math.cos(a), sa = Math.sin(a), hw = ancho / 2, hh = alto / 2;
    const P = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([u, v]) => [cx + u * ca - v * sa, cy + u * sa + v * ca, cz]);
    for (const k of [0, 1, 2, 0, 2, 3]) arr.push(...P[k]);
    const u0 = slot / letrasUnicas.length, u1 = (slot + 1) / letrasUnicas.length;
    for (const k of [0, 1, 2, 0, 2, 3]) uv.push(k === 0 || k === 3 ? u0 : u1, k < 2 ? 0 : 1);
  };
  const uvB = [];
  [...TEXTO].forEach((L, i) => {
    if (L === ' ') return;
    const x = x0 + i * paso;
    if (L === 'F') {
      // el hueco: dos tornillos y la marca mas limpia en el hormigon
      for (const dy of [-0.7, 0.7]) escuadras.poner(FORMAS.bola, M(x, y + dy, GR / 2 + 0.05, 0, 0.14), col(0x5a4a3a), { tinta: 0.006 });
      escuadras.poner(FORMAS.caja, M(x, y, GR / 2 + 0.008, 0, [ancho * 0.9, alto * 0.95, 0.01]), col(0xb3ae9f), { tinta: 0, varia: 0 });
      return;
    }
    const a = (r() - 0.5) * 0.07 + (L === 'G' ? -0.12 : 0), dy = (r() - 0.5) * 0.15;
    const slot = letrasUnicas.indexOf(L);
    quad(frente, uvF, x, y + dy, z, a, slot);
    quad(fondo, uvB, x + 0.03, y + dy - 0.03, z - 0.12, a, slot);
    for (const s of [-1, 1]) escuadras.poner(FORMAS.caja, M(x + s * 0.5, y + dy - 0.9, GR / 2 + 0.11, 0, [0.12, 0.12, 0.22]), col(0x4c4741), { tinta: 0.006 });
  });
  const hacer = (arr, uv, color, nombre) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ map: tex, color, alphaTest: 0.5, gradientMap: TONO, side: THREE.DoubleSide }));
    m.castShadow = true;
    m.name = nombre;
    return m;
  };
  grupo.add(hacer(frente, uvF, 0xffffff, 'letras'), hacer(fondo, uvB, 0x2e2822, 'letras_canto'));
  // la F, tirada al pie del muro, medio enterrada, entre hierbajos
  {
    const iF = TEXTO.indexOf('F'), xf = x0 + iF * paso + 1.3, zf = 3.4, slot = letrasUnicas.indexOf('F');
    const P = [], U = [];
    const hw = ancho / 2, hh = alto / 2, yb = altura(xf, zf) + 0.09;
    const esq = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([u, v]) => {
      const a = 0.6, ca = Math.cos(a), sa = Math.sin(a);
      return [xf + u * ca - v * sa, yb + 0.12 * (u + hw), zf + u * sa + v * ca];
    });
    for (const k of [0, 1, 2, 0, 2, 3]) P.push(...esq[k]);
    const u0 = slot / letrasUnicas.length, u1 = (slot + 1) / letrasUnicas.length;
    for (const k of [0, 1, 2, 0, 2, 3]) U.push(k === 0 || k === 3 ? u0 : u1, k < 2 ? 0 : 1);
    grupo.add(hacer(P, U, 0xffffff, 'letra_F'));
  }
  grupo.add(escuadras.hacer());
  return grupo;
}
