// FISICA de la capa y de la punta de la capucha del 18, en tiempo real, como MALLA DE TELA (20-10): mas particulas
// que huesos. Como en el video de referencia: al correr la capa vuela hacia atras como una bandera, ondea con cada paso,
// cae al pararse y se APOYA en los brazos cuando los mueve (los brazos van libres por debajo, no la atraviesan), y por
// detras sale de debajo de la mochila.
//
// La capa es una REJILLA de 7 columnas (una por cadena de huesos del .glb: cape_fl, l, bl, b, br, r, fr) y 7 filas (cada
// eslabon de hueso partido en SUB particulas). Cada particula (Verlet) siente gravedad, aire y un MUELLE-AMORTIGUADOR
// hacia su sitio en el clip (la pose de los huesos interpolada a lo largo de cada eslabon); las columnas son largos
// rigidos, y entre columnas hay ESTRUCTURA (fila con fila), CIZALLA (diagonales) y FLEXION (columna con la de dos mas
// alla), con su largo de reposo sacado del clip en cada fotograma. Todas chocan con el tronco medido, los brazos, las
// piernas, la mochila, el suelo y los obstaculos del mapa. Los huesos se LEEN de la rejilla: cada uno apunta a la
// particula de su fila siguiente, y `c.P` son las cabezas de los huesos tal como se pintan.
//
// Y la tela solo siente una parte del movimiento del cuerpo (INERCIA, como NvCloth o Chaos Cloth): en cada fotograma
// se lleva con la pelvis una fraccion de lo que la pelvis se ha movido y girado. El 18 empieza una media vuelta a
// ~31 rad/s y despega del suelo a 3,3 m/s de golpe: ninguna tela libre sigue eso sin latigazos.
import * as THREE from 'three';

const CAPA = ['cape_fl', 'cape_l', 'cape_bl', 'cape_b', 'cape_br', 'cape_r', 'cape_fr'];
const G = new THREE.Vector3(0, -9.8, 0);

// parametros de la tela (por cadena): gravedad (escala), aire (1/s), muelle a la pose del clip (1/s, por eslabon de
// hueso), amortiguado
const AJUSTE = {
  capa: { g: 1.0, aire: 9, muelle: [5, 1.6, 0.8], amort: 0.02 },
  capucha: { g: 0.25, aire: 1.2, muelle: [40, 28, 20], amort: 0.06 },
};
// particulas por eslabon de hueso (la capucha sigue siendo una cadena)
const SUB = { capa: 2, capucha: 1 };
// capsulas de brazos y piernas: [hueso de, hueso a, radio m]; MARGEN = medio grosor de la tela. El TRONCO no es una
// capsula: se mide (medirTronco)
const CAPSULAS = [
  ['upperarm_l', 'lowerarm_l', 0.045], ['lowerarm_l', 'hand_l', 0.04], ['hand_l', 'fingers_l', 0.04],
  ['upperarm_r', 'lowerarm_r', 0.045], ['lowerarm_r', 'hand_r', 0.04], ['hand_r', 'fingers_r', 0.04],
  ['thigh_l', 'calf_l', 0.055], ['calf_l', 'foot_l', 0.048],
  ['thigh_r', 'calf_r', 0.055], ['calf_r', 'foot_r', 0.048],
];
const MARGEN = 0.014;
// TRONCO: el cuerpo de verdad bajo la capa, medido en los vertices del propio .glb en reposo: por altura y angulo
// alrededor de la columna, el radio de la tunica, el chaleco, la bufanda, el rollo y las correas, en dos marcos (la
// pelvis abajo y spine_02 arriba: sigue a la columna cuando se dobla). La capsula centrada de 75 mm que habia no se le
// parecia: la barriga llega a 110 mm por delante, los costados a 46-53 y la espalda a 27-30
const TRONCO_PIEZAS = /^(tunica|chaleco|bufanda|cuello_rollo|correa|mochila_tirante)/;
const T_ANG = 48, T_DY = 0.015;
const PERMISO_R = 0.05;
const DOBLEZ_EXTRA = 0.6;
const RECUPERA = 6, RECUPERA_D = 0.15;
// cuanto puede girar cada pano alrededor del cuerpo desde su raiz (rad)
const SECTOR = { cape_fl: 2.0, cape_fr: 2.0, cape_l: 1.75, cape_r: 1.75, cape_bl: 1.3, cape_b: 1.3, cape_br: 1.3 };
// AL CORRER la capa se ABRE (pedido del usuario el 20-10): el muelle de cada pano tira hacia una pose de ARRASTRE
// (hacia atras, un pelo hacia su lado y algo hacia abajo), tanto mas cuanto mas deprisa
const ABRE = { cape_fl: 1, cape_fr: 1, cape_l: 0.85, cape_r: 0.85, cape_bl: 0.25, cape_br: 0.25, cape_b: 0 };
const ABRE_V0 = 0.5, ABRE_V1 = 1.5;   // velocidad (m/s) a la que empieza a abrirse y a la que se abre entera
const GIRO_RUMBO = 7;                 // rad/s: lo mas deprisa que gira la direccion de arrastre (veleta)
const ABRE_LADO = 0.15, ABRE_CAIDA = 0.3;   // (0,45 con la malla: la capa corriendo se quedaba 6 cm mas cerca del cuerpo)

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion();
const Y = new THREE.Vector3(0, 1, 0);

function cabeza(b, out) { return out.setFromMatrixPosition(b.matrixWorld); }

export function crearTela(raiz, altura, mapa = null) {
  const huesos = {};
  raiz.traverse((o) => { if (o.isBone) huesos[o.name] = o; });
  raiz.updateMatrixWorld(true);

  // interruptores para medir (recorrido_capa.js): cada parte se puede cambiar en vivo
  const OPC = {
    espalda: true, sector: true, tramos: false, malla: true, girar: true, doblez: true,
    lin: 0.7, ang: 0.95,            // INERCIA: fraccion del movimiento (lin) y del giro (ang) de la pelvis que se lleva la tela
    relativo: 'pelvis',             // el amortiguado frena la velocidad RELATIVA a la de la pelvis ('pelvis'), a la de la meta (true) o la absoluta (false)
    estira: 0.15, comprime: 0.5,    // ventana de la estructura y la cizalla entre columnas (fraccion del largo del clip)
    flexion: 0.7,                   // la columna con la de dos mas alla no se acerca a menos de esto (sin acordeon)
    brazoExtra: 0.006,              // el antebrazo y la mano chocan con las particulas este pelo mas gordos: el hueso es una cuerda recta entre ellas
    piel: false, pielHolgura: 0.004, pielVueltas: 3, muestraCada: 6,  // la malla pintada contra el brazo (R23): APAGADO, ver README
    rigidez: 0.15, dobMedio: 1.2, kMul: 0.5, zeta: 4, hz: 120, iter: 4, recto: true,
  };
  // ?opc={"lin":0} cambia los interruptores desde el arranque (para medir variantes tras recargar)
  try { const o = typeof location !== 'undefined' && new URLSearchParams(location.search).get('opc'); if (o) Object.assign(OPC, JSON.parse(o)); } catch (e) { /* sin opciones */ }

  // TRAZA para medir: con OPC.traza = {} suma cuanto mueve cada etapa las particulas de la capa (m)
  const tz = new THREE.Vector3();
  const trazar = (c) => c.tipo === 'capa' && OPC.traza && (!OPC.trazaCol || c.nombre === OPC.trazaCol);
  let jTraza = -1, itTraza = -1;
  function anotar(et, p) { const t = OPC.traza; if (!t) return; if (OPC.trazaJ) et += '#' + jTraza + (OPC.trazaIt ? '@' + itTraza : ''); t[et] = (t[et] || 0) + tz.distanceTo(p); }

  // ---------- la rejilla ----------
  // cada cadena de huesos es una COLUMNA de particulas: X (ahora), Q (antes), R (sitio en el clip), T (meta del muelle),
  // V (velocidad del clip), Vf (lo que la lleva la pelvis este fotograma), l (largo de reposo del tramo que llega a j)
  const cadenas = [];
  function cadena(nombres, tipo) {
    const bs = nombres.map((n) => huesos[n]);
    if (bs.some((b) => !b)) return null;
    const nb = bs.length, S = (tipo === "capa" && OPC.sub) || SUB[tipo], n = nb * S + 1;
    const c = { bs, tipo, nb, S, n, A: [], P: [], L: [], X: [], Q: [], R: [], Rp: [], T: [], M: [], Mp: [], V: [], Vf: [], Vp: [], largo: new Float32Array(n), l: new Float32Array(n), TA: new Float32Array(n), dob: new Float32Array(n) };
    for (let i = 0; i <= nb; i++) { c.A.push(new THREE.Vector3()); c.P.push(new THREE.Vector3()); }
    for (const k of ['X', 'Q', 'R', 'Rp', 'T', 'M', 'Mp', 'V', 'Vf', 'Vp']) for (let j = 0; j < n; j++) c[k].push(new THREE.Vector3());
    cadenas.push(c);
    return c;
  }
  const capa = CAPA.map((n) => cadena([1, 2, 3].map((i) => `${n}_0${i}`), 'capa'));
  capa.forEach((c, k) => { if (c) { c.nombre = CAPA[k]; c.espalda = ['cape_bl', 'cape_b', 'cape_br'].includes(CAPA[k]); } });
  cadena(['hood_01', 'hood_02', 'hood_03'], 'capucha');

  // las restricciones ENTRE columnas (no por delante: la capa esta abierta entre fr y fl): [columna a, fila a,
  // columna b, fila b, tipo] con su largo de reposo del clip en `reposo` (cada fotograma)
  const lazos = [];
  for (let k = 0; k + 1 < capa.length; k++) {
    const a = capa[k], b = capa[k + 1];
    if (!a || !b) continue;
    for (let j = 0; j < a.n; j++) {
      if (j > 0) lazos.push([a, j, b, j, 0]);                               // estructura
      if (j + 1 < a.n) { lazos.push([a, j, b, j + 1, 0]); lazos.push([a, j + 1, b, j, 0]); }   // cizalla
    }
    const c2 = capa[k + 2];
    if (c2) for (let j = 1; j < a.n; j++) lazos.push([a, j, c2, j, 1]);    // flexion
  }
  const reposo = new Float32Array(lazos.length);

  // la MOCHILA: caja en el espacio de spine_02 (medida en el modelo), con la pose de reposo. Por delante llega hasta
  // el cuerpo (-0,005): por la rendija entre la espalda y la mochila el pano de atras subia al saltar
  const espalda = huesos.spine_02;
  const caja = new THREE.Box3(new THREE.Vector3(-0.112, 0.224, -0.19), new THREE.Vector3(0.104, 0.452, -0.005));
  const raizAEspalda = new THREE.Matrix4().copy(espalda.matrixWorld).invert().multiply(raiz.matrixWorld);
  caja.applyMatrix4(raizAEspalda);
  const mEsp = new THREE.Matrix4(), mEspInv = new THREE.Matrix4();

  const caps = CAPSULAS.map(([a, b, r]) => ({ a: huesos[a], b: huesos[b], r, arriba: /^upperarm_/.test(a), ante: /^(lowerarm|hand)_/.test(a), pa: new THREE.Vector3(), pb: new THREE.Vector3() }))
    .filter((c) => c.a && c.b);
  const tronco = medirTronco(raiz, huesos);

  // obstaculos del mapa cerca del heroe (troncos, columnas, muros): la capa no los atraviesa al pegarse a ellos
  let cerca = { circulos: [], cajas: [] };
  function obstaculos(p) {
    for (const c of cerca.circulos) {
      const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + MARGEN;
      if (d < m && d > 1e-6) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; }
    }
    for (const b of cerca.cajas) {
      const ca = Math.cos(b.ang), sa = Math.sin(b.ang);
      const lx = (p.x - b.x) * ca + (p.z - b.z) * sa, lz = -(p.x - b.x) * sa + (p.z - b.z) * ca;
      const hx = b.hx + MARGEN, hz = b.hz + MARGEN;
      if (Math.abs(lx) >= hx || Math.abs(lz) >= hz) continue;
      let nx = lx, nz = lz;
      if (hx - Math.abs(lx) < hz - Math.abs(lz)) nx = Math.sign(lx) * hx; else nz = Math.sign(lz) * hz;
      p.x = b.x + nx * ca - nz * sa;
      p.z = b.z + nx * sa + nz * ca;
    }
  }

  let iniciada = false, resto = 0, quieto = 1, corre = 0;
  const marcha = new THREE.Vector3(), rumbo = new THREE.Vector3(0, 0, 1), lado = new THREE.Vector3(), arr = new THREE.Vector3();
  // la pose de ARRASTRE de cada pano: desde su raiz, la columna estirada hacia atras, hacia su lado y algo hacia abajo,
  // mezclada con la del clip segun lo que se corre (T, la meta del muelle)
  function poseArrastre(eje) {
    for (const c of cadenas) {
      if (c.tipo !== 'capa') continue;
      const w = ABRE[c.nombre] || 0;
      c.abre = OPC.abre === false ? 0 : corre * w;
      if (c.abre <= 0) continue;
      // su lado: de la columna a su raiz, sin la componente de la marcha
      lado.set(c.R[0].x - eje.x, 0, c.R[0].z - eje.z);
      lado.addScaledVector(rumbo, -lado.dot(rumbo));
      if (lado.lengthSq() < 1e-8) lado.set(-rumbo.z, 0, rumbo.x);
      lado.normalize();
      arr.copy(rumbo).multiplyScalar(-1).addScaledVector(lado, OPC.lado ?? ABRE_LADO).addScaledVector(Y, -(OPC.caida ?? ABRE_CAIDA)).normalize();
      c.T[0].copy(c.R[0]);
      for (let j = 1; j < c.n; j++) c.T[j].copy(c.R[0]).addScaledVector(arr, c.largo[j]).lerp(c.R[j], 1 - c.abre);
    }
  }
  const ultimo = new THREE.Vector3();

  // la pose del clip: las cabezas de los huesos (A) y, a lo largo de cada eslabon, el sitio de cada fila (R)
  function leerAnimado(dt) {
    for (const c of cadenas) {
      for (let i = 0; i < c.nb; i++) cabeza(c.bs[i], c.A[i]);
      // la punta: la cabeza del ultimo hueso + su eje Y con el largo del eslabon anterior
      const l = c.A[c.nb - 1].distanceTo(c.A[c.nb - 2]);
      v1.copy(Y).transformDirection(c.bs[c.nb - 1].matrixWorld);
      c.A[c.nb].copy(c.A[c.nb - 1]).addScaledVector(v1, l);
      for (let i = 0; i < c.nb; i++) c.L[i] = c.A[i].distanceTo(c.A[i + 1]);
      for (let j = 0; j < c.n; j++) {
        const i = Math.min(c.nb - 1, Math.floor(j / c.S)), f = j / c.S - i;
        c.R[j].copy(c.A[i]).lerp(c.A[i + 1], f);
        if (j) { c.l[j] = c.L[Math.floor((j - 1) / c.S)] / c.S; c.largo[j] = c.largo[j - 1] + c.l[j]; }
        // la velocidad del clip (de un fotograma al siguiente): el amortiguado es RELATIVO a ella. (En la version de
        // cadenas salia siempre 0: se leia la pose de antes contra si misma, asi que el amortiguado era absoluto)
        c.V[j].subVectors(c.R[j], c.Rp[j]).divideScalar(Math.max(dt, 1e-3));
        if (c.V[j].lengthSq() > 100) c.V[j].set(0, 0, 0);
      }
    }
  }

  function reiniciar() {
    for (const c of cadenas) for (let j = 0; j < c.n; j++) { c.X[j].copy(c.R[j]); c.Q[j].copy(c.R[j]); c.Rp[j].copy(c.R[j]); c.M[j].copy(c.R[j]); c.Mp[j].copy(c.R[j]); c.V[j].set(0, 0, 0); c.Vf[j].set(0, 0, 0); c.Vp[j].set(0, 0, 0); }
    corre = 0; quieto = 1; rumbo.set(0, 0, 1); resto = 0;     // todo el estado, no solo las particulas (pruebas repetibles)
    pelPrev = null;
    iniciada = true;
  }

  // la particula en el marco de la pelvis, recordada mientras no se mueva (las reglas y el tronco la piden seguidas)
  const locC = new THREE.Vector3();
  let locX = NaN, locY = NaN, locZ = NaN;
  function local(p) {
    if (p.x !== locX || p.y !== locY || p.z !== locZ) {
      locC.copy(p).applyMatrix4(tronco.marcos[0].inv);
      locX = p.x; locY = p.y; locZ = p.z;
    }
    return locC;
  }
  // CUERPOS: cada uno dice cuanto le falta a p para estar fuera (>0 = dentro) y deja la normal hacia fuera en n
  const w1 = new THREE.Vector3(), w2 = new THREE.Vector3(), w3 = new THREE.Vector3();
  const nTmp = new THREE.Vector3(), nRad = new THREE.Vector3();
  function huecoCapsula(c, p, n) {
    w1.subVectors(c.pb, c.pa);
    const t = Math.max(0, Math.min(1, w2.subVectors(p, c.pa).dot(w1) / Math.max(1e-9, w1.lengthSq())));
    w3.copy(c.pa).addScaledVector(w1, t);
    const d = p.distanceTo(w3), m = c.r + MARGEN + (c.ante ? OPC.brazoExtra : 0);
    if (d >= m) return 0;
    if (d < 1e-6) n.set(0, 1, 0); else n.subVectors(p, w3).divideScalar(d);
    // el BRAZO DE ARRIBA solo empuja la tela HACIA FUERA del cuerpo (en horizontal, desde la columna): con su normal,
    // la tela que baja del hombro quedaba pillada entre el brazo y el costado y temblaba. La tela pasa POR ENCIMA
    if (c.arriba && tronco && OPC.brazoArriba !== false) {
      const l = local(p), rho = Math.hypot(l.x, l.z);
      if (rho > 0.01) {
        nRad.set(l.x / rho, 0, l.z / rho).transformDirection(tronco.marcos[0].b.matrixWorld);
        const k = (m - d) / Math.max(n.dot(nRad), 0.35);
        n.copy(nRad);
        return k;
      }
    }
    return m - d;
  }
  // contra el TRONCO cada particula puede estar tan metida como la pone el clip (`permitido`) y nada mas, y solo cerca
  // de su sitio del clip (se apaga en PERMISO_R): los huesos de la capa van por dentro de la tela
  let permitido = 0;
  function permisoEn(ta, p, a) {
    const k = 1 - p.distanceTo(a) / PERMISO_R;
    return k > 0 ? ta * k : 0;
  }
  function huecoTronco(p, n) {
    const k = huecoTroncoBruto(p, n) - permitido;
    return k > 0 ? k : 0;
  }
  function huecoTroncoBruto(p, n) {
    w1.copy(local(p));
    const arriba = w1.y >= tronco.corte;
    const M = tronco.marcos[arriba ? 1 : 0];
    if (arriba) w1.copy(p).applyMatrix4(M.inv);
    const h = Math.floor((w1.y - M.y0) / T_DY);
    if (h < 0 || h >= M.nh) return 0;
    const rho = Math.hypot(w1.x, w1.z);
    const a = ((Math.atan2(w1.x, w1.z) / (2 * Math.PI) + 1) % 1) * T_ANG;
    const a0 = Math.floor(a) % T_ANG, a1 = (a0 + 1) % T_ANG, f = a - Math.floor(a);
    const r = M.r[h * T_ANG + a0] * (1 - f) + M.r[h * T_ANG + a1] * f;
    if (r <= 0) return 0;
    const m = r + MARGEN;
    if (rho >= m) return 0;
    if (rho < 1e-6) n.set(0, 0, 1); else n.set(w1.x / rho, 0, w1.z / rho);
    n.transformDirection(M.b.matrixWorld);
    return m - rho;
  }
  // los paños de la ESPALDA no pasan al otro lado del cuerpo: semiplano por el eje de la columna, de cara a donde nace
  // cada cadena (la mitad de su distancia al eje)
  let cadenaActual = null;
  function huecoEspalda(p, n) {
    const c = cadenaActual;
    if (!OPC.espalda || !c || !c.espalda || !tronco) return 0;
    w1.copy(local(p));
    const d = w1.x * c.u.x + w1.z * c.u.z;
    if (d >= c.lim) return 0;
    n.copy(c.u).transformDirection(tronco.marcos[0].b.matrixWorld);
    return c.lim - d;
  }
  // y ningun pano da la vuelta al cuerpo: cada columna se queda en su SECTOR alrededor de la columna vertebral
  function huecoSector(p, n) {
    const c = cadenaActual;
    if (!OPC.sector || !c || c.th0 === undefined || !tronco) return 0;
    w1.copy(local(p));
    const rho = Math.hypot(w1.x, w1.z);
    if (rho < 0.01) return 0;
    const fi = Math.atan2(w1.x, w1.z);
    let dif = fi - c.th0;
    dif = Math.atan2(Math.sin(dif), Math.cos(dif));
    const e = Math.abs(dif) - c.sector;
    if (e <= 0) return 0;
    const sg = dif > 0 ? -1 : 1;
    n.set(sg * Math.cos(fi), 0, -sg * Math.sin(fi)).transformDirection(tronco.marcos[0].b.matrixWorld);
    return e * rho;
  }
  // (APAGADO por defecto, OPC.tramos: con medio eslabon el brazo ya no cabe entre dos particulas y este choque era el
  // que pasaba de golpe el pano de delante al otro lado del antebrazo al empezar a correr)
  // TRAMO contra BRAZO: lo mas cerca que pasa el tramo de tela (de la particula anterior a esta) del antebrazo o la
  // mano; si entra, el tramo GIRA alrededor de la anterior hasta quedar apoyado. El choque es SECO (fuera la velocidad
  // hacia dentro del brazo, algo de roce): la tela va con el brazo en vez de salir rebotada. El brazo de arriba va
  // DEBAJO de la capa ya en el clip
  const brazosCaps = caps.filter((k) => /^(lowerarm|hand)_/.test(k.a.name));
  const vT = new THREE.Vector3(), sA = new THREE.Vector3(), sB = new THREE.Vector3(), sD1 = new THREE.Vector3(), sD2 = new THREE.Vector3(), sR = new THREE.Vector3();
  // la direccion del punto mas cercano del segmento b0-b1 (capsula) al del segmento a0-a1 (tela), hacia la tela, en out
  const cA = new THREE.Vector3(), cB = new THREE.Vector3(), cD1 = new THREE.Vector3(), cD2 = new THREE.Vector3(), cR = new THREE.Vector3();
  function cerca2(a0, a1, b0, b1, out) {
    cD1.subVectors(a1, a0); cD2.subVectors(b1, b0); cR.subVectors(a0, b0);
    const a = cD1.dot(cD1), e = cD2.dot(cD2), f = cD2.dot(cR), cc = cD1.dot(cR), b = cD1.dot(cD2), den = a * e - b * b;
    let s = den > 1e-12 && a > 1e-12 ? Math.min(1, Math.max(0, (b * f - cc * e) / den)) : 0;
    let t = e > 1e-12 ? (b * s + f) / e : 0;
    if (t < 0) { t = 0; s = a > 1e-12 ? Math.min(1, Math.max(0, -cc / a)) : 0; } else if (t > 1) { t = 1; s = a > 1e-12 ? Math.min(1, Math.max(0, (b - cc) / a)) : 0; }
    cA.copy(a0).addScaledVector(cD1, s); cB.copy(b0).addScaledVector(cD2, t);
    return out.subVectors(cA, cB);
  }
  function tramoBrazo(c, j, jp = j - 1) {
    if (!OPC.tramos || j <= c.S) return;           // el primer eslabon nace en el hombro
    const a0 = c.X[jp], a1 = c.X[j];
    for (const k of brazosCaps) {
      sD1.subVectors(a1, a0); sD2.subVectors(k.pb, k.pa); sR.subVectors(a0, k.pa);
      const a = sD1.dot(sD1), e = sD2.dot(sD2), f = sD2.dot(sR);
      if (a < 1e-10 || e < 1e-10) continue;
      const cc = sD1.dot(sR), b = sD1.dot(sD2), den = a * e - b * b;
      let s = den > 1e-12 ? Math.min(1, Math.max(0, (b * f - cc * e) / den)) : 0;
      let t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -cc / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - cc) / a)); }
      sA.copy(a0).addScaledVector(sD1, s); sB.copy(k.pa).addScaledVector(sD2, t);
      const d = sA.distanceTo(sB), m = k.r + MARGEN;
      if (d >= m || d < 1e-6) continue;
      if (s < 0.15) continue;                       // el contacto en la raiz del tramo es cosa de esa particula
      sR.subVectors(sA, sB).divideScalar(d);
      // de que LADO del brazo venia el tramo (con las posiciones de antes): si en este paso ha cruzado el eje del brazo,
      // se le devuelve a su lado. Con el lado de ahora, el antebrazo que barre el pano de delante al empezar a correr lo
      // empujaba al otro lado de golpe (medido: la punta saltaba 42 cm en un fotograma)
      let hueco = m - d;
      if (OPC.ladoTramo !== false) {
        cerca2(c.Q[jp], c.Q[j], k.pa, k.pb, sD1);
        if (sD1.dot(sR) < 0) { sR.negate(); hueco = m + d; }
      }
      const falta = Math.min(OPC.tramoMax ?? 0.03, hueco / Math.max(s, 0.3));
      vT.subVectors(a1, c.Q[j]);
      const vn = vT.dot(sR);
      if (vn < 0) vT.addScaledVector(sR, -vn);
      vT.multiplyScalar(0.9);
      a1.addScaledVector(sR, falta);
      c.Q[j].copy(a1).sub(vT);
    }
  }
  const fisicos = caps.map((c) => (p, n) => huecoCapsula(c, p, n));
  if (tronco) fisicos.push(huecoTronco);
  const reglas = tronco ? [huecoEspalda, huecoSector] : [];
  // primero las reglas de sitio y el cuerpo fisico el ULTIMO: si chocan, gana el cuerpo
  const cuerpos = reglas.concat(fisicos);
  function empujar(p) {
    for (const c of cuerpos) { const k = c(p, nTmp); if (k > 0) p.addScaledVector(nTmp, k); }
  }
  // p ya esta a su largo L de prev; si ha caido dentro de un cuerpo, el tramo GIRA alrededor de prev hacia fuera
  // (biseccion entre su direccion y la normal del cuerpo) hasta quedar en la superficie
  const d0 = new THREE.Vector3(), nG = new THREE.Vector3(), xG = new THREE.Vector3(), nX = new THREE.Vector3();
  function girarFuera(p, prev, L, c) {
    if (c(p, nG) <= 1e-4) return;
    d0.subVectors(p, prev).divideScalar(L);
    const prueba = (s) => xG.copy(d0).addScaledVector(nG, s).normalize().multiplyScalar(L).add(prev);
    let hi = 1;
    while (c(prueba(hi), nX) > 0 && hi < 64) hi *= 2;
    if (c(xG, nX) > 0) return;
    let lo = 0;
    for (let k = 0; k < 12; k++) {
      const s = (lo + hi) / 2;
      if (c(prueba(s), nX) > 0) lo = s; else hi = s;
    }
    p.copy(prueba(hi));
  }
  // cuanto esta metida la cabeza del hueso i (lo que se pinta) en el cuerpo, sin el margen (lo mira la auditoria)
  function penetracion(c, i) {
    permitido = permisoEn(c.TA[i * c.S], c.P[i], c.A[i]);
    cadenaActual = c;
    const extra = OPC.brazoExtra; OPC.brazoExtra = 0;     // contra el brazo de verdad, sin el colchon de las particulas
    let k = 0;
    for (const cu of fisicos) k = Math.max(k, cu(c.P[i], nTmp) - MARGEN);
    OPC.brazoExtra = extra;
    return k;
  }
  const nombresCuerpos = (tronco ? ['regla espalda', 'regla sector'] : []).concat(caps.map((k) => 'capsula ' + k.a.name), tronco ? ['tronco'] : []);
  function penetraciones(c, i) {
    permitido = permisoEn(c.TA[i * c.S], c.P[i], c.A[i]);
    cadenaActual = c;
    const r = {}, extra = OPC.brazoExtra; OPC.brazoExtra = 0;
    cuerpos.forEach((cu, k) => { const d = cu(c.P[i], nTmp) - MARGEN; if (d > 0) r[nombresCuerpos[k]] = d; });
    OPC.brazoExtra = extra;
    return r;
  }

  // DOBLEZ: el angulo en la particula j-1 no pasa del que tiene el clip + DOBLEZ_EXTRA (en las filas de en medio de un
  // eslabon, donde el clip va recto, dobMedio). Sin limite una punta se doblaba hacia arriba y se quedaba asi
  const dA = new THREE.Vector3(), dB = new THREE.Vector3(), dP = new THREE.Vector3();
  function doblez(c, j, jp = j - 1, jpp = j - 2, lim = c.dob[j]) {
    if (jpp < 0) return;
    dA.subVectors(c.X[jp], c.X[jpp]);
    const la = dA.length();
    if (la < 1e-6) return;
    dA.divideScalar(la);
    dB.subVectors(c.X[j], c.X[jp]);
    const L = dB.length() || 1e-6;
    dB.divideScalar(L);
    const co = dA.dot(dB);
    if (co >= Math.cos(lim)) return;
    dP.copy(dB).addScaledVector(dA, -co);
    // doblada casi del reves (mas de ~150 grados) el lado hacia el que se abre esta mal definido y saltaba de un lado al
    // otro (medido: la punta del pano de delante, levantada por el antebrazo, 37 cm en un fotograma); entonces se queda
    // del lado en que estaba en el paso anterior
    if (OPC.dobLado !== false && dP.lengthSq() < 0.25) {
      dB.subVectors(c.Q[j], c.X[jp]);
      const q = dB.dot(dA);
      dB.addScaledVector(dA, -q);
      if (dB.lengthSq() > 1e-10 && dB.dot(dP) < 0) dP.negate();
      if (dB.lengthSq() > 1e-10 && dP.lengthSq() < 1e-6) dP.copy(dB);
    }
    if (dP.lengthSq() < 1e-10) dP.set(1, 0, 0).addScaledVector(dA, -dA.x);
    dP.normalize();
    c.X[j].copy(c.X[jp]).addScaledVector(dA, Math.cos(lim) * L).addScaledVector(dP, Math.sin(lim) * L);
  }

  function mochila(p) {
    v1.copy(p).applyMatrix4(mEspInv);
    if (!caja.containsPoint(v1)) return;
    const d = [v1.x - caja.min.x, caja.max.x - v1.x, v1.y - caja.min.y, caja.max.y - v1.y, v1.z - caja.min.z, caja.max.z - v1.z];
    let k = 0;
    for (let i = 1; i < 6; i++) if (d[i] < d[k]) k = i;
    const ej = ['x', 'x', 'y', 'y', 'z', 'z'][k];
    v1[ej] = k % 2 ? caja.max[ej] + 0.004 : caja.min[ej] - 0.004;
    p.copy(v1.applyMatrix4(mEsp));
  }

  // ESTRUCTURA, CIZALLA y FLEXION entre columnas: cada par se queda en su ventana del largo del clip (estira de mas,
  // comprime de menos; la flexion solo de menos). La fila 0 va clavada al hueso
  const dL = new THREE.Vector3();
  function malla() {
    const rig = OPC.rigidez;
    if (OPC.traza) OPC.traza.malla = (OPC.traza.malla || 0);
    for (let k = 0; k < lazos.length; k++) {
      const [a, ja, b, jb, tipo] = lazos[k];
      const pa = a.X[ja], pb = b.X[jb], r = reposo[k];
      dL.subVectors(pb, pa);
      const d = dL.length() || 1e-6;
      const lo = r * (tipo ? OPC.flexion : OPC.comprime), hi = tipo ? Infinity : r * (1 + OPC.estira);
      const obj = d < lo ? lo : d > hi ? hi : d;
      if (obj === d) continue;
      const wa = ja ? 1 : 0, wb = jb ? 1 : 0;
      if (!wa && !wb) continue;
      const corr = (d - obj) / d * rig / (wa + wb);
      pa.addScaledVector(dL, corr * wa);
      pb.addScaledVector(dL, -corr * wb);
      if (OPC.traza) OPC.traza.malla += Math.abs(corr) * d * (wa + wb);
    }
  }

  const vI = new THREE.Vector3(), vM = new THREE.Vector3(), aI = new THREE.Vector3();
  const mMedio = new THREE.Vector3();
  function subpaso(dt) {
    for (const c of cadenas) {
      const A = AJUSTE[c.tipo];
      c.X[0].copy(c.R[0]); c.Q[0].copy(c.R[0]);
      const abre = c.abre || 0;
      for (let j = 1; j < c.n; j++) {
        const p = c.X[j], q = c.Q[j];
        // MUELLE-AMORTIGUADOR hacia su sitio: aceleracion = gravedad + K (sitio - p) - amortiguado de la velocidad
        // relativa a la del clip - aire; el amortiguado, implicito (estable a cualquier paso). Antes el muelle movia la
        // particula una fraccion hacia su sitio en cada paso: en Verlet eso es un muelle de rigidez fraccion/paso que
        // tiembla mas cuanto mas sube la frecuencia. RECUPERACION: parado y lejos de su sitio tira hasta x RECUPERA
        const meta = c.M[j];
        const lejos = Math.min(1, p.distanceTo(meta) / RECUPERA_D);
        const fuerza = A.muelle[Math.floor((j - 1) / c.S)] * (1 + 2.5 * abre) * (1 + (RECUPERA - 1) * lejos * lejos * quieto);
        const K = fuerza * 120 * OPC.kMul;
        const Cc = 2 * OPC.zeta * Math.sqrt(K);
        const aire = A.aire + A.amort * 120;
        // la velocidad propia de la particula no incluye lo que la lleva la pelvis (Vf): el aire frena las dos, y el
        // amortiguado mira la del clip menos esa
        vI.subVectors(p, q).divideScalar(dt);
        vM.copy(OPC.relativo === 'pelvis' ? c.Vp[j] : OPC.relativo ? c.V[j] : v3.set(0, 0, 0)).sub(c.Vf[j]);
        aI.copy(G).multiplyScalar(A.g).addScaledVector(v2.subVectors(meta, p), K).addScaledVector(vM, Cc).addScaledVector(c.Vf[j], -aire);
        vI.addScaledVector(aI, dt).divideScalar(1 + dt * (Cc + aire));
        q.copy(p);
        p.addScaledVector(vI, dt);
        if (trazar(c)) { jTraza = j; itTraza = -1; tz.copy(q); anotar('integrar', p); }
      }
    }
    for (let it = 0; it < OPC.iter; it++) {
      if (OPC.malla) malla();
      // choques y largo de cada tramo, PARTICULA A PARTICULA desde la raiz: sale del choque y vuelve a su largo de la
      // anterior, tres veces; lo ultimo es el largo, y si el largo la mete otra vez el tramo gira hasta la superficie.
      // La ULTIMA vuelta va por eslabones de HUESO (de fila de hueso a fila de hueso, con el largo del hueso) y deja las
      // filas de en medio sobre la recta: el hueso es recto, y si la rejilla se doblaba a mitad de eslabon lo pintado se
      // pasaba de lo simulado y entraba en el cuerpo (medido: hasta 39 mm en la auditoria)
      const recto = OPC.recto && it === OPC.iter - 1;
      for (const c of cadenas) {
        cadenaActual = c;
        const salto = recto ? c.S : 1;
        for (let j = salto; j < c.n; j += salto) {
          const p = c.X[j], jp = j - salto, prev = c.X[jp];
          const L = recto ? c.L[j / c.S - 1] : c.l[j];
          permitido = permisoEn(c.TA[j], p, c.R[j]);
          const tr = trazar(c);
          jTraza = j; itTraza = it;
          if (tr) tz.copy(p);
          // pasada recta 'ligera': solo el largo del hueso y salir del cuerpo girando (sin doblez ni tramo, que ya
          // hicieron las filas de en medio: repetirlos con el hueso entero lo empujaba al otro lado del antebrazo)
          const ligero = recto && OPC.rectoModo !== 'completo';
          if (c.tipo === 'capa' && OPC.doblez && !ligero) {
            if (!recto) doblez(c, j);
            else if (jp >= c.S) doblez(c, j, jp, jp - c.S, c.dobB[j / c.S]);
          }
          if (tr) anotar('doblez', p);
          for (let k = 0; k < (ligero ? 1 : 3); k++) {
            if (c.tipo === 'capa' && !ligero) {
              if (tr) tz.copy(p);
              empujar(p);
              if (tr) { anotar('cuerpo', p); tz.copy(p); }
              // contra el antebrazo, el tramo es el eslabon de HUESO entero (de fila de hueso a fila de hueso): con medio
              // eslabon la tela rodeaba el brazo por la fila de en medio y el hueso recto lo cruzaba
              if (OPC.tramoHueso === false) tramoBrazo(c, j, jp);
              else if (j % c.S === 0) tramoBrazo(c, j, j - c.S);
              if (tr) { anotar('tramo', p); tz.copy(p); }
              mochila(p);
              obstaculos(p);
              const s = altura(p.x, p.z) + 0.012;
              if (p.y < s) p.y = s;
              if (tr) anotar('mochila_suelo', p);
            }
            if (tr) tz.copy(p);
            v1.subVectors(p, prev);
            const d = v1.length() || 1e-6;
            p.copy(prev).addScaledVector(v1, L / d);
            if (tr) anotar('largo', p);
          }
          if (tr) tz.copy(p);
          if (c.tipo === 'capa' && OPC.girar) for (let k = 0; k < 2; k++) for (const cu of cuerpos) girarFuera(p, prev, L, cu);
          // (OPC.medioBrazo: que el punto medio del hueso tampoco entre en el antebrazo; medido: quita los 3 mm de roce
          // pero mete saltos de 35 cm al aterrizar. En su lugar el antebrazo choca con las particulas OPC.brazoExtra mas gordo)
          if (OPC.medioBrazo && recto && ligero && c.tipo === 'capa' && OPC.girar && c.S > 1 && jp >= c.S) for (const k of brazosCaps) girarFuera(p, prev, L, (q, n) => huecoCapsula(k, mMedio.lerpVectors(prev, q, 0.5), n) * 2);
          if (tr) anotar('girar', p);
        }
        if (recto && c.S > 1) {
          // las filas de en medio, a la recta de su hueso (su velocidad propia se conserva)
          for (let i = 0; i < c.nb; i++) for (let s = 1; s < c.S; s++) {
            const j = i * c.S + s, m = c.X[j];
            tmp.copy(m);
            m.lerpVectors(c.X[i * c.S], c.X[(i + 1) * c.S], s / c.S);
            c.Q[j].add(tmp.subVectors(m, tmp));
          }
        }
      }
    }
  }

  // los huesos se LEEN de la rejilla: cada uno, desde donde lo deja su padre, apunta a la particula de la fila de su
  // hueso siguiente; c.P son sus cabezas (y la punta) tal como se pintan
  function escribir() {
    for (const c of cadenas) {
      for (let i = 0; i < c.nb; i++) {
        const b = c.bs[i];
        b.updateWorldMatrix(true, false);
        cabeza(b, c.P[i]);
        v2.copy(Y).transformDirection(b.matrixWorld);
        v3.subVectors(c.X[(i + 1) * c.S], c.P[i]);
        if (v3.lengthSq() < 1e-10) continue;
        v3.normalize();
        q1.setFromUnitVectors(v2, v3);
        b.getWorldQuaternion(q2);
        q2.premultiply(q1);
        b.parent.getWorldQuaternion(q1);
        b.quaternion.copy(q1.invert().multiply(q2));
        b.updateWorldMatrix(false, true);
      }
      const u = c.bs[c.nb - 1];
      cabeza(u, c.P[c.nb - 1]);
      c.P[c.nb].copy(c.P[c.nb - 1]).addScaledVector(v1.copy(Y).transformDirection(u.matrixWorld), c.L[c.nb - 1]);
    }
  }

  // INERCIA: la tela se lleva una fraccion de lo que la pelvis se ha movido (OPC.lin) y girado (OPC.ang) desde el
  // fotograma anterior; X y Q a la vez, asi la velocidad propia no cambia. Vf = lo que eso la ha movido, por segundo
  let pelPrev = null;
  const pelPos = new THREE.Vector3(), pelQ = new THREE.Quaternion(), pelPos0 = new THREE.Vector3(), pelQ0 = new THREE.Quaternion();
  const qD = new THREE.Quaternion(), qI = new THREE.Quaternion(), mov = new THREE.Vector3(), tmp = new THREE.Vector3();
  function arrastrar(dt) {
    const pel = tronco ? tronco.marcos[0].b : espalda;
    pel.getWorldPosition(pelPos); pel.getWorldQuaternion(pelQ);
    if (pelPrev) {
      qD.copy(pelQ).multiply(q1.copy(pelQ0).invert());
      qI.identity().slerp(qD, OPC.ang);
      mov.subVectors(pelPos, pelPos0).multiplyScalar(OPC.lin);
      for (const c of cadenas) {
        for (let j = 1; j < c.n; j++) {
          tmp.copy(c.X[j]);
          // la velocidad que tendria la particula si fuera pegada a la pelvis (referencia del amortiguado 'pelvis')
          c.Vp[j].copy(tmp).sub(pelPos0).applyQuaternion(qD).add(pelPos).sub(tmp).divideScalar(Math.max(dt, 1e-3));
          if (c.Vp[j].lengthSq() > 100) c.Vp[j].set(0, 0, 0);
          c.X[j].sub(pelPos0).applyQuaternion(qI).add(pelPos0).add(mov);
          if (trazar(c)) { tz.copy(tmp); anotar('inercia', c.X[j]); }
          c.Q[j].sub(pelPos0).applyQuaternion(qI).add(pelPos0).add(mov);
          c.Vf[j].subVectors(c.X[j], tmp).divideScalar(Math.max(dt, 1e-3));
        }
      }
    }
    pelPrev = true;
    pelPos0.copy(pelPos); pelQ0.copy(pelQ);
  }

  // ---------- LA MALLA PINTADA CONTRA EL BRAZO (regla R23 del taller: la ropa no traspasa el brazo ni un milimetro) ----------
  // Las particulas no bastan: la capa que se pinta se interpola entre columnas que van a 10-14 cm, y la mano se metia por
  // ese hueco (medido con medir_ropa_brazo.js: 9,8 mm dentro de la mano ya en reposo). Y la capsula de la mano acababa en
  // la base de los dedos, con la manopla 3 cm mas alla. Asi que:
  //  - el brazo son ENVOLVENTES medidas en su propia malla (manga y mano): por hueso, un cilindro con casquetes a lo largo
  //    de su eje Y que contiene todos los vertices que mas pesan en ese hueso, en la pose de reposo;
  //  - la capa son MUESTRAS de su malla (un vertice de cada OPC.muestraCada) con sus pesos de piel: despues de escribir los
  //    huesos se pinta cada muestra cerca del brazo (applyBoneTransform, la misma cuenta que la tarjeta), y si cae dentro de
  //    una envolvente se empujan las filas de hueso que la mueven, segun su peso, y se vuelven a escribir los huesos.
  const ARM_MALLA = /^(manga_[lr]_1|mano_palma_[lr])$/, ROPA_MALLA = /^(capa_1|capa_jiron_[di]_1|dobladillo)$/;
  const envolventes = [], muestras = [];
  {
    const huesoCadena = new Map();
    for (const c of cadenas) if (c.tipo === 'capa') c.bs.forEach((b, i) => huesoCadena.set(b, [c, i]));
    const mallasArm = [], mallasRopa = [];
    raiz.traverse((o) => { if (o.isSkinnedMesh) { if (ARM_MALLA.test(o.name)) mallasArm.push(o); else if (ROPA_MALLA.test(o.name)) mallasRopa.push(o); } });
    raiz.updateMatrixWorld(true);
    const grupos = new Map(), pv = new THREE.Vector3();
    for (const m of mallasArm) {
      const pos = m.geometry.attributes.position, si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight;
      for (let i = 0; i < pos.count; i++) {
        let kb = 0;
        for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, kb)) kb = k;
        const b = m.skeleton.bones[si.getComponent(i, kb)];
        if (!/^(clavicle|upperarm|lowerarm|hand|fingers|thumb)_/.test(b.name)) continue;
        pv.fromBufferAttribute(pos, i);
        m.applyBoneTransform(i, pv); pv.applyMatrix4(m.matrixWorld);
        let g = grupos.get(b); if (!g) grupos.set(b, (g = { inv: b.matrixWorld.clone().invert(), pts: [] }));
        g.pts.push(pv.clone().applyMatrix4(g.inv));
      }
    }
    for (const [b, g] of grupos) {
      let cx = 0, cz = 0, y0 = Infinity, y1 = -Infinity;
      for (const p of g.pts) { cx += p.x; cz += p.z; y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
      cx /= g.pts.length; cz /= g.pts.length;
      let r = 0;
      for (const p of g.pts) r = Math.max(r, Math.hypot(p.x - cx, p.z - cz));
      // el eje corto por dentro el radio (casquetes); y 2 mm de holgura para lo que la piel mezcla en las juntas
      const a = Math.min(y0 + r, (y0 + y1) / 2), z = Math.max(y1 - r, (y0 + y1) / 2);
      envolventes.push({ b, l0: new THREE.Vector3(cx, a, cz), l1: new THREE.Vector3(cx, z, cz), r: r + 0.002, a: new THREE.Vector3(), z: new THREE.Vector3(), alto: /^upperarm_/.test(b.name) });
    }
    for (const m of mallasRopa) {
      const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight, n = m.geometry.attributes.position.count;
      const paso = OPC.muestraCada ?? 6;
      for (let i = 0; i < n; i += paso) {
        const inf = [];
        for (let k = 0; k < 4; k++) {
          const w = sw.getComponent(i, k);
          const hc = w > 0 && huesoCadena.get(m.skeleton.bones[si.getComponent(i, k)]);
          if (hc) inf.push([hc[0], hc[1], w]);
        }
        // s2 con suelo: un vertice que casi solo sigue a la espalda pediria empujar 10 veces su hueso de capa
        if (!inf.length) continue;
        // solo la cara de DENTRO de la tela (su normal mira hacia la columna): la de fuera no toca el brazo sin que lo
        // toque antes la de dentro
        if (tronco && OPC.soloDentro !== false) {
          pv.fromBufferAttribute(m.geometry.attributes.position, i); m.applyBoneTransform(i, pv); pv.applyMatrix4(m.matrixWorld);
          nTmp.fromBufferAttribute(m.geometry.attributes.normal, i).multiplyScalar(0.001).add(m.geometry.attributes.position.array.length ? v3.fromBufferAttribute(m.geometry.attributes.position, i) : v3);
          m.applyBoneTransform(i, nTmp); nTmp.applyMatrix4(m.matrixWorld).sub(pv);
          w1.copy(pv).applyMatrix4(tronco.marcos[0].inv); w1.y = 0;
          w2.copy(nTmp).transformDirection(tronco.marcos[0].inv); w2.y = 0;
          if (w1.dot(w2) > 0) continue;
        }
        // su alcance: lo lejos que esta, en reposo, de la cabeza de su hueso que mas pesa (para descartarla sin pintarla)
        inf.sort((x, y) => y[2] - x[2]);
        pv.fromBufferAttribute(m.geometry.attributes.position, i);
        m.applyBoneTransform(i, pv); pv.applyMatrix4(m.matrixWorld);
        const alcance = pv.distanceTo(cabeza(inf[0][0].bs[inf[0][1]], new THREE.Vector3()));
        // para la piel propia: la posicion de reposo en el espacio de la union (bindMatrix) y sus cuatro huesos
        const vb = new THREE.Vector3().fromBufferAttribute(m.geometry.attributes.position, i).applyMatrix4(m.bindMatrix);
        const hb = [], wb = [];
        for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > 0) { hb.push(si.getComponent(i, k)); wb.push(w); } }
        muestras.push({ m, i, inf, alcance, vb: [vb.x, vb.y, vb.z], hb, wb, s2: Math.max(0.3, inf.reduce((s, x) => s + x[2] * x[2], 0)) });
      }
    }
  }
  const qS = new THREE.Vector3(), cS = new THREE.Vector3(), dS = new THREE.Vector3(), eS = new THREE.Vector3();
  // PIEL PROPIA (applyBoneTransform costaba 2,4 us por muestra: 8,7 ms por fotograma): por malla y hueso, una vez por
  // pasada, K = matrixWorld de la malla x bindMatrixInverse x hueso.matrixWorld x boneInverse; la muestra = suma de w K vb
  const mallasM = [...new Set(muestras.map((s) => s.m))].map((m) => ({ m, K: m.skeleton.bones.map(() => new Float32Array(16)), usados: [...new Set(muestras.filter((s) => s.m === m).flatMap((s) => s.hb))] }));
  for (const mm of mallasM) for (const s of muestras) if (s.m === mm.m) s.mm = mm;
  const mK = new THREE.Matrix4(), mW = new THREE.Matrix4();
  const porHueso = [];
  for (const s of muestras) {
    const [c, i] = s.inf[0];
    let g = porHueso.find((x) => x.c === c && x.i === i);
    if (!g) porHueso.push((g = { c, i, alcance: 0, muestras: [], cerca: null }));
    g.alcance = Math.max(g.alcance, s.alcance);
    g.muestras.push(s);
  }
  function matricesPiel() {
    for (const mm of mallasM) {
      mW.multiplyMatrices(mm.m.matrixWorld, mm.m.bindMatrixInverse);
      for (const b of mm.usados) {
        mK.multiplyMatrices(mm.m.skeleton.bones[b].matrixWorld, mm.m.skeleton.boneInverses[b]).premultiply(mW);
        mm.K[b].set(mK.elements);
      }
    }
  }
  function pintar(s, out) {
    const [x, y, z] = s.vb;
    let px = 0, py = 0, pz = 0;
    for (let k = 0; k < s.hb.length; k++) {
      const e = s.mm.K[s.hb[k]], w = s.wb[k];
      px += w * (e[0] * x + e[4] * y + e[8] * z + e[12]);
      py += w * (e[1] * x + e[5] * y + e[9] * z + e[13]);
      pz += w * (e[2] * x + e[6] * y + e[10] * z + e[14]);
    }
    return out.set(px, py, pz);
  }
  let pielStats = { muestras: muestras.length, envolventes: envolventes.length, empujes: 0 };
  function pielContraBrazo() {
    if (!OPC.piel || !envolventes.length) return;
    for (const e of envolventes) { e.a.copy(e.l0).applyMatrix4(e.b.matrixWorld); e.z.copy(e.l1).applyMatrix4(e.b.matrixWorld); }
    // las cajas de las envolventes (con lo que pasa de la tela) para descartar muestras lejos del brazo sin pintarlas
    const hol = OPC.pielHolgura;
    pielStats.empujes = 0;
    for (let vuelta = 0; vuelta < OPC.pielVueltas; vuelta++) {
      let hubo = false;
      matricesPiel();
      for (const c of cadenas) if (c.tipo === 'capa') { c.empuje ||= c.X.map(() => new THREE.Vector3()); c.pesoE ||= new Float32Array(c.n); for (let j = 0; j < c.n; j++) { c.empuje[j].set(0, 0, 0); c.pesoE[j] = 0; } }
      // descarte barato POR HUESO: la cabeza del hueso que mas pesa en cada muestra, lejos de todas las envolventes (con el
      // alcance mayor de sus muestras), y sus muestras ni se pintan
      for (const g of porHueso) {
        const h = g.c.P[g.i];
        g.cerca = null;
        for (const e of envolventes) {
          dS.subVectors(e.z, e.a);
          const t = Math.max(0, Math.min(1, eS.subVectors(h, e.a).dot(dS) / Math.max(1e-9, dS.lengthSq())));
          if (cS.copy(e.a).addScaledVector(dS, t).distanceToSquared(h) < (e.r + g.alcance + hol + 0.02) ** 2) (g.cerca ||= []).push(e);
        }
      }
      for (const g of porHueso) for (const s of g.cerca ? g.muestras : []) {
        pintar(s, qS);
        for (const e of g.cerca) {
          dS.subVectors(e.z, e.a);
          const t = Math.max(0, Math.min(1, eS.subVectors(qS, e.a).dot(dS) / Math.max(1e-9, dS.lengthSq())));
          cS.copy(e.a).addScaledVector(dS, t);
          const d = qS.distanceTo(cS), m = e.r + hol;
          if (d >= m) continue;
          // fuera, hacia donde mire la muestra desde el eje (el brazo de arriba: hacia fuera del cuerpo, como en las capsulas)
          if (d > 1e-6) eS.subVectors(qS, cS).divideScalar(d); else eS.set(0, 1, 0);
          const falta = m - d;
          for (const [c, i, w] of s.inf) {
            const j = (i + 1) * c.S, k = w / s.s2;
            c.empuje[j].addScaledVector(eS, falta * k * w);
            c.pesoE[j] += w;
          }
          hubo = true; pielStats.empujes++;
        }
      }
      if (!hubo) break;
      // cada fila de hueso se mueve lo que le piden (la media pesada) y lo de debajo con ella; luego largos rigidos
      for (const c of cadenas) {
        if (c.tipo !== 'capa') continue;
        let algo = false;
        for (let i = 1; i <= c.nb; i++) {
          const j = i * c.S;
          if (c.pesoE[j] <= 0) continue;
          algo = true;
          dS.copy(c.empuje[j]).divideScalar(c.pesoE[j]);
          for (let jj = j; jj < c.n; jj++) { c.X[jj].add(dS); c.Q[jj].add(dS); }
        }
        if (!algo) continue;
        for (let i = 1; i <= c.nb; i++) {
          const j = i * c.S, jp = j - c.S;
          v1.subVectors(c.X[j], c.X[jp]);
          const d = v1.length() || 1e-6, L = c.L[i - 1];
          tmp.copy(c.X[j]);
          c.X[j].copy(c.X[jp]).addScaledVector(v1, L / d);
          dS.subVectors(c.X[j], tmp);
          for (let jj = j + 1; jj < c.n; jj++) c.X[jj].add(dS);
          for (let s = 1; s < c.S; s++) c.X[jp + s].lerpVectors(c.X[jp], c.X[j], s / c.S);
        }
      }
      escribir();
    }
  }

  // un paso: despues de mixer.update y de colocar la raiz
  function paso(dt) {
    raiz.updateMatrixWorld(true);
    leerAnimado(dt);
    mEsp.copy(espalda.matrixWorld);
    mEspInv.copy(mEsp).invert();
    for (const k of caps) { cabeza(k.a, k.pa); cabeza(k.b, k.pb); }
    if (tronco) {
      for (const M of tronco.marcos) M.inv.copy(M.b.matrixWorld).invert();
      locX = NaN;
      for (const c of cadenas) {
        if (c.tipo !== 'capa') continue;
        for (let j = 0; j < c.n; j++) c.TA[j] = huecoTroncoBruto(c.R[j], nTmp);
        w2.copy(c.R[0]).applyMatrix4(tronco.marcos[0].inv);
        c.th0 = Math.atan2(w2.x, w2.z);
        for (let j = 2; j < c.n; j++) {
          dA.subVectors(c.R[j - 1], c.R[j - 2]); dB.subVectors(c.R[j], c.R[j - 1]);
          const junta = (j - 1) % c.S === 0;
          c.dob[j] = junta ? Math.min(2.6, Math.max(1.0, dA.angleTo(dB) + DOBLEZ_EXTRA)) : OPC.dobMedio;
        }
        c.dobB = c.dobB || new Float32Array(c.nb + 1);
        for (let i = 2; i <= c.nb; i++) {
          dA.subVectors(c.A[i - 1], c.A[i - 2]); dB.subVectors(c.A[i], c.A[i - 1]);
          c.dobB[i] = Math.min(2.6, Math.max(1.0, dA.angleTo(dB) + DOBLEZ_EXTRA));
        }
        c.sector = SECTOR[c.nombre] ?? Math.PI;
        if (c.espalda) {
          const r = Math.hypot(w2.x, w2.z) || 1;
          c.u = (c.u || new THREE.Vector3()).set(w2.x / r, 0, w2.z / r);
          c.lim = 0.5 * r;
        }
      }
    }
    for (let k = 0; k < lazos.length; k++) { const [a, ja, b, jb] = lazos[k]; reposo[k] = a.R[ja].distanceTo(b.R[jb]); }
    // reinicio si el heroe salta de sitio (teletransporte de prueba) o al empezar
    cabeza(espalda, v1);
    if (mapa) {
      const R = 1.6;
      cerca = {
        circulos: mapa.circulos.filter((c) => Math.abs(c.x - v1.x) < R + c.r && Math.abs(c.z - v1.z) < R + c.r),
        cajas: mapa.cajas.filter((c) => Math.hypot(c.x - v1.x, c.z - v1.z) < R + Math.hypot(c.hx, c.hz)),
      };
    }
    if (!iniciada || v1.distanceTo(ultimo) > 1.0) reiniciar();
    arrastrar(dt);
    // parado = la espalda casi no se mueve (la recuperacion no frena la capa que vuela al correr)
    const vel = v1.distanceTo(ultimo) / Math.max(dt, 1e-3);
    quieto += ((1 - Math.min(1, vel / 0.3)) - quieto) * Math.min(1, 4 * dt);
    marcha.set(v1.x - ultimo.x, 0, v1.z - ultimo.z);
    const vh = marcha.length() / Math.max(dt, 1e-3);
    // el rumbo GIRA como una veleta hacia la marcha, como mucho a GIRO_RUMBO rad/s (mezclarlos pasaba por cero en una
    // media vuelta y la direccion de arrastre salia disparada: los panos se cruzaban y ensenaban el enves)
    if (vh > 0.2) {
      const a0 = Math.atan2(rumbo.x, rumbo.z), a1 = Math.atan2(marcha.x, marcha.z);
      let d = a1 - a0; d = Math.atan2(Math.sin(d), Math.cos(d));
      const p = Math.max(-GIRO_RUMBO * dt, Math.min(GIRO_RUMBO * dt, d));
      rumbo.set(Math.sin(a0 + p), 0, Math.cos(a0 + p));
    }
    const meta = Math.max(0, Math.min(1, (vh - ABRE_V0) / (ABRE_V1 - ABRE_V0)));
    corre += (meta - corre) * Math.min(1, (meta > corre ? 3.5 : 1.8) * dt);
    ultimo.copy(v1);
    poseArrastre(v1);
    // la META de cada particula (su sitio del clip o, corriendo, el de arrastre) y su velocidad: el amortiguado mira esa
    // (con la del clip a secas, al abrirse la capa corriendo la meta se va por un lado y el freno tira por otro)
    for (const c of cadenas) for (let j = 0; j < c.n; j++) {
      c.M[j].copy((c.abre || 0) > 0 ? c.T[j] : c.R[j]);
      c.V[j].subVectors(c.M[j], c.Mp[j]).divideScalar(Math.max(dt, 1e-3));
      if (c.V[j].lengthSq() > 100 || OPC.velClip) c.V[j].subVectors(c.R[j], c.Rp[j]).divideScalar(Math.max(dt, 1e-3));
      if (c.V[j].lengthSq() > 100) c.V[j].set(0, 0, 0);
    }
    resto += Math.min(dt, 0.1);
    const h = 1 / OPC.hz;
    while (resto >= h) { subpaso(h); resto -= h; }
    escribir();
    pielContraBrazo();
    for (const c of cadenas) for (let j = 0; j < c.n; j++) { c.Rp[j].copy(c.R[j]); c.Mp[j].copy(c.M[j]); }
  }

  return { paso, reiniciar, cadenas, AJUSTE, caps, tronco, penetracion, penetraciones, lazos, envolventes, get piel() { return pielStats; }, get corre() { return corre; }, OPC };
}

// el tronco en reposo, de los vertices de sus piezas: radio maximo por (altura, angulo) en el marco de la pelvis (abajo)
// y de spine_02 (arriba); los huecos de la tabla se rellenan con sus vecinos y se ensancha una casilla
function medirTronco(raiz, huesos) {
  const pel = huesos.pelvis, esp = huesos.spine_02;
  if (!pel || !esp) return null;
  raiz.updateMatrixWorld(true);
  const marcos = [pel, esp].map((b) => ({ b, inv: b.matrixWorld.clone().invert(), pts: [] }));
  const corte = esp.getWorldPosition(new THREE.Vector3()).applyMatrix4(marcos[0].inv).y;
  const v = new THREE.Vector3(), l = new THREE.Vector3();
  raiz.traverse((o) => {
    if (!o.isMesh || !TRONCO_PIEZAS.test(o.name)) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    if (/tinta/i.test(mat.name)) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      l.copy(v).applyMatrix4(marcos[0].inv);
      const M = marcos[l.y < corte ? 0 : 1];
      M.pts.push(v.clone().applyMatrix4(M.inv));
    }
  });
  for (const M of marcos) {
    if (!M.pts.length) { M.nh = 0; M.y0 = 0; M.r = new Float32Array(0); continue; }
    let y0 = Infinity, y1 = -Infinity;
    for (const p of M.pts) { y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    M.y0 = y0;
    M.nh = Math.floor((y1 - y0) / T_DY) + 1;
    let r = new Float32Array(M.nh * T_ANG);
    for (const p of M.pts) {
      const h = Math.floor((p.y - M.y0) / T_DY);
      const a = Math.floor(((Math.atan2(p.x, p.z) / (2 * Math.PI) + 1) % 1) * T_ANG) % T_ANG;
      r[h * T_ANG + a] = Math.max(r[h * T_ANG + a], Math.hypot(p.x, p.z));
    }
    // huecos de angulo: el vecino de la misma altura
    for (let it = 0; it < T_ANG; it++) {
      let hay = false;
      const r2 = r.slice();
      for (let h = 0; h < M.nh; h++) for (let a = 0; a < T_ANG; a++) {
        if (r[h * T_ANG + a] > 0) continue;
        const m = Math.max(r[h * T_ANG + (a + 1) % T_ANG], r[h * T_ANG + (a + T_ANG - 1) % T_ANG]);
        if (m > 0) { r2[h * T_ANG + a] = m; hay = true; }
      }
      r = r2;
      if (!hay) break;
    }
    // una casilla mas en angulo y en altura (la tabla sale de vertices: entre dos vertices la cara va algo por fuera)
    const r3 = r.slice();
    for (let h = 0; h < M.nh; h++) for (let a = 0; a < T_ANG; a++) {
      let m = 0;
      for (let dh = -1; dh <= 1; dh++) for (let da = -1; da <= 1; da++) {
        const hh = h + dh;
        if (hh < 0 || hh >= M.nh) continue;
        m = Math.max(m, r[hh * T_ANG + (a + da + T_ANG) % T_ANG]);
      }
      r3[h * T_ANG + a] = m;
    }
    M.r = r3;
    delete M.pts;
  }
  return { marcos, corte };
}
