// FISICA de la capa y de la punta de la capucha del 18, en tiempo real, sobre los huesos que ya trae el .glb (siete
// cadenas de capa de tres eslabones y la cadena de la capucha). Como en el video de referencia: al correr la capa
// vuela hacia atras como una bandera, ondea con cada paso, cae al pararse y se APOYA en los brazos cuando los mueve
// (los brazos van libres por debajo, no la atraviesan), y por detras sale de debajo de la mochila.
//
// Cada cadena es una fila de particulas (Verlet): la primera va pegada al hueso animado y las demas sienten gravedad,
// el AIRE (frenado por la velocidad propia: al correr se quedan atras), un muelle suave hacia la pose del clip (la tela
// conserva su forma) y restricciones de largo; las cadenas vecinas se atan entre si (la tela no se abre en tiras) y
// todas chocan con capsulas del cuerpo (tronco, brazos, piernas), la caja de la mochila y el suelo. Despues se gira
// cada hueso para que apunte a su particula siguiente.
import * as THREE from 'three';

const CAPA = ['cape_fl', 'cape_l', 'cape_bl', 'cape_b', 'cape_br', 'cape_r', 'cape_fr'];
const G = new THREE.Vector3(0, -9.8, 0);
const PASO = 1 / 120;

// parametros de la tela (por cadena): gravedad (escala), aire (1/s), muelle a la pose del clip (1/s), amortiguado
const AJUSTE = {
  capa: { g: 1.0, aire: 9, muelle: [5, 1.6, 0.8], amort: 0.02 },
  capucha: { g: 0.25, aire: 1.2, muelle: [40, 28, 20], amort: 0.06 },
};
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
// parecia: la barriga llega a 110 mm por delante, los costados a 46-53 y la espalda a 27-30; se quedaba corta delante
// y sobraba 25 mm en los costados, donde se pisaba con la del brazo y la tela quedaba atrapada entre las dos
const TRONCO_PIEZAS = /^(tunica|chaleco|bufanda|cuello_rollo|correa|mochila_tirante)/;
const T_ANG = 48, T_DY = 0.015;
const PERMISO_R = 0.05;
const BRAZO_R = 0.042, BRAZO_HOLGURA = 0.17, BRAZO_CERCA = 0.09;
const DOBLEZ_EXTRA = 0.6;
const RECUPERA = 6, RECUPERA_D = 0.15;
// cuanto puede girar cada pano alrededor del cuerpo desde su raiz (rad): los de delante vuelan hacia atras por los
// costados al correr, los de atras se quedan detras
const SECTOR = { cape_fl: 2.0, cape_fr: 2.0, cape_l: 1.75, cape_r: 1.75, cape_bl: 1.3, cape_b: 1.3, cape_br: 1.3 };

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion();
const Y = new THREE.Vector3(0, 1, 0);

function cabeza(b, out) { return out.setFromMatrixPosition(b.matrixWorld); }

export function crearTela(raiz, altura, mapa = null) {
  const huesos = {};
  raiz.traverse((o) => { if (o.isBone) huesos[o.name] = o; });
  raiz.updateMatrixWorld(true);

  const cadenas = [];
  function cadena(nombres, tipo) {
    const bs = nombres.map((n) => huesos[n]);
    if (bs.some((b) => !b)) return null;
    const n = bs.length + 1;
    const c = { bs, tipo, A: [], P: [], Q: [], L: [] };
    for (let i = 0; i < n; i++) { c.A.push(new THREE.Vector3()); c.P.push(new THREE.Vector3()); c.Q.push(new THREE.Vector3()); }
    cadenas.push(c);
    return c;
  }
  const capa = CAPA.map((n) => cadena([1, 2, 3].map((i) => `${n}_0${i}`), 'capa'));
  capa.forEach((c, k) => { if (c) c.espalda = ['cape_bl', 'cape_b', 'cape_br'].includes(CAPA[k]); });
  // el brazo de cada pano de delante: hombro, codo, mano (posiciones de mundo, al dia en cada paso)
  const ladoBrazo = { cape_fl: 'l', cape_fr: 'r' };
  capa.forEach((c, k) => {
    const s = ladoBrazo[CAPA[k]];
    if (c && s && huesos['upperarm_' + s]) { c.brazo = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]; c.huesosBrazo = ['upperarm_', 'lowerarm_', 'hand_'].map((h) => huesos[h + s]); }
  });
  cadena(['hood_01', 'hood_02', 'hood_03'], 'capucha');

  // la MOCHILA: caja en el espacio de spine_02 (medida en el modelo: X -0,105..0,097, Z de Blender 0,224..0,450,
  // Y de Blender 0,045..0,183 -> glTF y = Z, z = -Y), con la pose de reposo
  const espalda = huesos.spine_02;
  // por delante la caja llega hasta el cuerpo (-0,005): entre la espalda (z -0,03) y la mochila (-0,045) quedaba una
  // rendija por la que el pano de atras subia al saltar, y la caja lo empujaba por su cara mas cercana, hacia dentro:
  // se quedaba enganchado ahi. La capa de debajo de la mochila no se simula (va rigida con la espalda)
  const caja = new THREE.Box3(new THREE.Vector3(-0.112, 0.224, -0.19), new THREE.Vector3(0.104, 0.452, -0.005));
  const raizAEspalda = new THREE.Matrix4().copy(espalda.matrixWorld).invert().multiply(raiz.matrixWorld);
  caja.applyMatrix4(raizAEspalda);          // la caja, ahora en el espacio de spine_02
  const mEsp = new THREE.Matrix4(), mEspInv = new THREE.Matrix4();

  const caps = CAPSULAS.map(([a, b, r]) => ({ a: huesos[a], b: huesos[b], r, pa: new THREE.Vector3(), pb: new THREE.Vector3() }))
    .filter((c) => c.a && c.b);
  const tronco = medirTronco(raiz, huesos);
  // anillo de la capa: vecinas atadas (no por delante: la capa esta abierta entre fr y fl)
  const anillo = [];
  for (let k = 0; k < capa.length - 1; k++) if (capa[k] && capa[k + 1]) anillo.push([capa[k], capa[k + 1]]);

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

  let iniciada = false, resto = 0, quieto = 1;
  const ultimo = new THREE.Vector3();

  function leerAnimado() {
    for (const c of cadenas) {
      for (let i = 0; i < c.bs.length; i++) cabeza(c.bs[i], c.A[i]);
      // la punta: la cabeza del ultimo hueso + su eje Y con el largo del eslabon anterior
      const l = c.A[c.bs.length - 1].distanceTo(c.A[c.bs.length - 2]);
      v1.copy(Y).transformDirection(c.bs[c.bs.length - 1].matrixWorld);
      c.A[c.bs.length].copy(c.A[c.bs.length - 1]).addScaledVector(v1, l);
      for (let i = 0; i < c.bs.length; i++) c.L[i] = c.A[i].distanceTo(c.A[i + 1]);
    }
  }

  function reiniciar() {
    for (const c of cadenas) for (let i = 0; i < c.A.length; i++) { c.P[i].copy(c.A[i]); c.Q[i].copy(c.A[i]); }
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
  const nTmp = new THREE.Vector3();
  function huecoCapsula(c, p, n) {
    w1.subVectors(c.pb, c.pa);
    const t = Math.max(0, Math.min(1, w2.subVectors(p, c.pa).dot(w1) / Math.max(1e-9, w1.lengthSq())));
    w3.copy(c.pa).addScaledVector(w1, t);
    const d = p.distanceTo(w3), m = c.r + MARGEN;
    if (d >= m) return 0;
    if (d < 1e-6) n.set(0, 1, 0); else n.subVectors(p, w3).divideScalar(d);
    return m - d;
  }
  // contra el TRONCO cada particula puede estar tan metida como la pone el clip (`permitido`, de su pose animada en
  // este fotograma) y nada mas: el clip ya casa con el cuerpo (los dos siguen a la columna) y los huesos de la capa
  // van por dentro de la tela, 11-25 mm "dentro" del rollo y las correas; sin esto la fisica apartaba la capa del
  // cuerpo. Con brazos y piernas no hay permiso: al correr las piernas entran en la pose del clip y la tela debe salir
  // Solo cerca de su pose del clip: se apaga en PERMISO_R. Valiendo en cualquier sitio, el pano de delante se metia
  // 28 mm en el costado (su permiso era el de la barriga, donde lo pone el clip)
  let permitido = 0;
  function permiso(c, i) {
    if (!c.TA) return 0;
    const k = 1 - c.P[i].distanceTo(c.A[i]) / PERMISO_R;
    return k > 0 ? c.TA[i] * k : 0;
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
  // cada cadena (la mitad de su distancia al eje). Por debajo del tronco solo estan las piernas, y con un salto o una
  // carrera la tela de atras pasaba por debajo y salia por DELANTE, donde el tronco la empujaba hacia fuera por el lado
  // equivocado: se quedaba enganchada en la cadera, a 10-30 cm de su sitio
  let cadenaActual = null;
  function huecoEspalda(p, n) {
    const c = cadenaActual;
    if (!c || !c.espalda || !tronco) return 0;
    w1.copy(local(p));
    const d = w1.x * c.u.x + w1.z * c.u.z;
    if (d >= c.lim) return 0;
    n.copy(c.u).transformDirection(tronco.marcos[0].b.matrixWorld);
    return c.lim - d;
  }
  // y ningun pano da la vuelta al cuerpo: cada cadena se queda en su SECTOR alrededor de la columna (angulo de su raiz
  // +-SECTOR). El de delante se colaba entre el brazo y el tronco y acababa en la espalda, a 19 cm de su sitio
  function huecoSector(p, n) {
    const c = cadenaActual;
    if (!c || c.th0 === undefined || !tronco) return 0;
    w1.copy(local(p));
    const rho = Math.hypot(w1.x, w1.z);
    if (rho < 0.01) return 0;
    const fi = Math.atan2(w1.x, w1.z);
    let dif = fi - c.th0;
    dif = Math.atan2(Math.sin(dif), Math.cos(dif));
    const e = Math.abs(dif) - c.sector;
    if (e <= 0) return 0;
    // tangente hacia dentro del sector (derivada de (sin, cos) por el angulo, con el signo que reduce |dif|)
    const sg = dif > 0 ? -1 : 1;
    n.set(sg * Math.cos(fi), 0, -sg * Math.sin(fi)).transformDirection(tronco.marcos[0].b.matrixWorld);
    return e * rho;
  }
  // los paños de DELANTE van por fuera del brazo: lo que este mas alla del brazo (alrededor del cuerpo, desde la raiz del
  // pano) tiene que estar a mas distancia del eje que el brazo. Al correr el pano se colaba por DENTRO del brazo, entre
  // el y el costado, y quedaba en un bolsillo: la barriga le cerraba el paso hacia delante y el brazo hacia fuera
  const brazoTmp = new THREE.Vector3(), brazoA = new THREE.Vector3(), brazoB = new THREE.Vector3();
  function huecoBrazo(p, n) {
    const c = cadenaActual;
    if (!c || !c.brazo || !tronco) return 0;
    w1.copy(local(p));
    const rho = Math.hypot(w1.x, w1.z);
    if (rho < 0.01) return 0;
    // el punto del brazo mas cercano (hombro-codo-mano), en el marco de la pelvis
    let mejor = Infinity;
    for (let k = 0; k < 2; k++) {
      brazoA.copy(c.brazoL[k]); brazoB.copy(c.brazoL[k + 1]);
      w2.subVectors(brazoB, brazoA);
      const t = Math.max(0, Math.min(1, w3.subVectors(w1, brazoA).dot(w2) / Math.max(1e-9, w2.lengthSq())));
      w3.copy(brazoA).addScaledVector(w2, t);
      const dd = w3.distanceToSquared(w1);
      if (dd < mejor) { mejor = dd; brazoTmp.copy(w3); }
    }
    // solo junto al brazo (la trampa es el hueco entre el brazo y el costado): con el brazo abierto al saltar, la regla
    // pedia ir por fuera de un brazo a 30 cm, imposible
    if (mejor > BRAZO_CERCA * BRAZO_CERCA) return 0;
    const rhoA = Math.hypot(brazoTmp.x, brazoTmp.z);
    const ang = (v) => { const d = Math.atan2(v.x, v.z) - c.th0; return Math.atan2(Math.sin(d), Math.cos(d)); };
    const dif = ang(w1), difA = ang(brazoTmp);
    if (Math.sign(dif) !== Math.sign(difA)) return 0;
    const limite = Math.max(0, Math.abs(difA) - BRAZO_HOLGURA);
    if (Math.abs(dif) <= limite) return 0;
    const fuera = rhoA + BRAZO_R + MARGEN;
    if (rho >= fuera) return 0;
    // sale por donde menos se mueve: girando hacia delante del brazo o hacia fuera de el
    const eT = (Math.abs(dif) - limite) * rho, eR = fuera - rho;
    const fi = Math.atan2(w1.x, w1.z);
    if (eT < eR) { const sg = dif > 0 ? -1 : 1; n.set(sg * Math.cos(fi), 0, -sg * Math.sin(fi)); }
    else n.set(w1.x / rho, 0, w1.z / rho);
    n.transformDirection(tronco.marcos[0].b.matrixWorld);
    return Math.min(eT, eR);
  }
  // primero las reglas de sitio y el cuerpo fisico el ULTIMO: si chocan, gana el cuerpo (con la regla del brazo la
  // ultima, al saltar la tela entraba 16 mm en el antebrazo)
  const fisicos = caps.map((c) => (p, n) => huecoCapsula(c, p, n));
  if (tronco) fisicos.push(huecoTronco);
  const reglas = tronco ? [huecoEspalda, huecoSector, huecoBrazo] : [];
  const cuerpos = reglas.concat(fisicos);
  function empujar(p) {
    for (const c of cuerpos) { const k = c(p, nTmp); if (k > 0) p.addScaledVector(nTmp, k); }
  }
  // p ya esta a su largo L de prev; si ha caido dentro de un cuerpo, el eslabon GIRA alrededor de prev hacia fuera
  // (biseccion entre su direccion y la normal del cuerpo) hasta quedar en la superficie. Empujar hacia fuera y devolver
  // el largo no basta: con la tela enrollada de lado alrededor del tronco el largo la mete por la cuerda (25 mm dentro)
  const d0 = new THREE.Vector3(), nG = new THREE.Vector3(), xG = new THREE.Vector3(), nX = new THREE.Vector3();
  function girarFuera(p, prev, L, c) {
    if (c(p, nG) <= 1e-4) return;
    d0.subVectors(p, prev).divideScalar(L);
    const prueba = (s) => xG.copy(d0).addScaledVector(nG, s).normalize().multiplyScalar(L).add(prev);
    let hi = 1;
    while (c(prueba(hi), nX) > 0 && hi < 64) hi *= 2;
    if (c(xG, nX) > 0) return;             // ni girando sale (la particula anterior ya esta dentro)
    let lo = 0;
    for (let k = 0; k < 12; k++) {
      const s = (lo + hi) / 2;
      if (c(prueba(s), nX) > 0) lo = s; else hi = s;
    }
    p.copy(prueba(hi));
  }
  // cuanto esta metida p en el cuerpo, sin contar el margen de la tela (lo mira la auditoria del juego)
  function penetracion(c, i) {
    permitido = permiso(c, i);
    cadenaActual = c;
    let k = 0;
    for (const cu of fisicos) k = Math.max(k, cu(c.P[i], nTmp) - MARGEN);
    return k;
  }
  // lo mismo por cuerpo (nombre: penetracion), para saber contra que choca (reglas de sitio incluidas)
  const nombresCuerpos = (tronco ? ['regla espalda', 'regla sector', 'regla brazo'] : []).concat(caps.map((k) => 'capsula ' + k.a.name), tronco ? ['tronco'] : []);
  function penetraciones(c, i) {
    permitido = permiso(c, i);
    cadenaActual = c;
    const r = {};
    cuerpos.forEach((cu, k) => { const d = cu(c.P[i], nTmp) - MARGEN; if (d > 0) r[nombresCuerpos[k]] = d; });
    return r;
  }

  // DOBLEZ: el angulo entre un eslabon y el siguiente no pasa del que tiene el clip + DOBLEZ_EXTRA. Sin limite, la punta
  // de un pano se doblaba hacia arriba sobre el eslabon anterior y se quedaba asi (pendulo invertido: el muelle tiraba
  // justo a traves del punto de giro y el tronco la sujetaba por detras)
  const dA = new THREE.Vector3(), dB = new THREE.Vector3(), dP = new THREE.Vector3();
  function doblez(c, i) {
    if (i < 2 || !c.dobLim) return;
    dA.subVectors(c.P[i - 1], c.P[i - 2]);
    const la = dA.length();
    if (la < 1e-6) return;
    dA.divideScalar(la);
    dB.subVectors(c.P[i], c.P[i - 1]);
    const L = dB.length() || 1e-6;
    dB.divideScalar(L);
    const co = dA.dot(dB), lim = c.dobLim[i];
    if (co >= Math.cos(lim)) return;
    dP.copy(dB).addScaledVector(dA, -co);
    if (dP.lengthSq() < 1e-10) dP.set(1, 0, 0).addScaledVector(dA, -dA.x);
    dP.normalize();
    c.P[i].copy(c.P[i - 1]).addScaledVector(dA, Math.cos(lim) * L).addScaledVector(dP, Math.sin(lim) * L);
  }

  function mochila(p) {
    v1.copy(p).applyMatrix4(mEspInv);
    if (!caja.containsPoint(v1)) return;
    // sale por la cara mas cercana
    const d = [v1.x - caja.min.x, caja.max.x - v1.x, v1.y - caja.min.y, caja.max.y - v1.y, v1.z - caja.min.z, caja.max.z - v1.z];
    let k = 0;
    for (let i = 1; i < 6; i++) if (d[i] < d[k]) k = i;
    const ej = ['x', 'x', 'y', 'y', 'z', 'z'][k];
    v1[ej] = k % 2 ? caja.max[ej] + 0.004 : caja.min[ej] - 0.004;
    p.copy(v1.applyMatrix4(mEsp));
  }

  function subpaso(dt) {
    for (const c of cadenas) {
      const A = AJUSTE[c.tipo];
      c.P[0].copy(c.A[0]); c.Q[0].copy(c.A[0]);
      for (let i = 1; i < c.P.length; i++) {
        const p = c.P[i], q = c.Q[i];
        // velocidad implicita, aire y amortiguado
        v1.subVectors(p, q).multiplyScalar(1 - A.amort - A.aire * dt);
        q.copy(p);
        p.add(v1).addScaledVector(G, A.g * dt * dt);
        // muelle hacia la pose del clip (la tela no olvida su forma)
        // RECUPERACION: parado y lejos de su pose del clip, el muelle tira mas (hasta x RECUPERA a RECUPERA_D): si la tela
        // queda atrapada detras de un brazo o en un pliegue, vuelve sola en vez de quedarse ahi
        const lejos = Math.min(1, p.distanceTo(c.A[i]) / RECUPERA_D);
        p.lerp(c.A[i], Math.min(1, A.muelle[i - 1] * (1 + (RECUPERA - 1) * lejos * lejos * quieto) * dt));
      }
    }
    for (let it = 0; it < 4; it++) {
      // las cadenas vecinas no se separan ni se cruzan mas de lo que estan en el clip (la tela es una pieza)
      for (const [a, b] of anillo) {
        for (let i = 1; i < a.P.length; i++) {
          const rest = a.A[i].distanceTo(b.A[i]);
          v1.subVectors(b.P[i], a.P[i]);
          const d = v1.length() || 1e-6;
          if (d > rest * 1.15 || d < rest * 0.6) {
            const obj = d > rest ? rest * 1.15 : rest * 0.6;
            const k = (d - obj) / d * 0.5;
            a.P[i].addScaledVector(v1, k);
            b.P[i].addScaledVector(v1, -k);
          }
        }
      }
      // choques (cuerpo, brazos, piernas, mochila, suelo) y largo de cada eslabon, PARTICULA A PARTICULA desde la raiz:
      // cada una sale del choque y vuelve a su largo de la anterior, tres veces. Lo ultimo es el largo: los huesos se
      // giran hacia la particula siguiente con su largo, asi lo simulado es lo que se pinta. (Choques y largos por
      // separado se deshacian el uno al otro: o eslabones estirados, 111, o la tela de delante 25 mm dentro del tronco)
      for (const c of cadenas) {
        for (let i = 1; i < c.P.length; i++) {
          const p = c.P[i];
          permitido = permiso(c, i);
          cadenaActual = c;
          if (c.tipo === 'capa') doblez(c, i);
          for (let k = 0; k < 3; k++) {
            if (c.tipo === 'capa') {
              empujar(p);
              mochila(p);
              obstaculos(p);
              const s = altura(p.x, p.z) + 0.012;
              if (p.y < s) p.y = s;
            }
            v1.subVectors(p, c.P[i - 1]);
            const d = v1.length() || 1e-6;
            p.copy(c.P[i - 1]).addScaledVector(v1, c.L[i - 1] / d);
          }
          if (c.tipo === 'capa') for (let k = 0; k < 2; k++) for (const cu of cuerpos) girarFuera(p, c.P[i - 1], c.L[i - 1], cu);
        }
      }
    }
  }

  function escribir() {
    for (const c of cadenas) {
      for (let i = 0; i < c.bs.length; i++) {
        const b = c.bs[i];
        b.updateWorldMatrix(true, false);
        cabeza(b, v1);
        v2.copy(Y).transformDirection(b.matrixWorld);
        v3.subVectors(c.P[i + 1], v1);
        if (v3.lengthSq() < 1e-10) continue;
        v3.normalize();
        q1.setFromUnitVectors(v2, v3);
        b.getWorldQuaternion(q2);
        q2.premultiply(q1);
        b.parent.getWorldQuaternion(q1);
        b.quaternion.copy(q1.invert().multiply(q2));
        b.updateWorldMatrix(false, true);
      }
    }
  }

  // un paso: despues de mixer.update y de colocar la raiz
  function paso(dt) {
    raiz.updateMatrixWorld(true);
    leerAnimado();
    mEsp.copy(espalda.matrixWorld);
    mEspInv.copy(mEsp).invert();
    for (const k of caps) { cabeza(k.a, k.pa); cabeza(k.b, k.pb); }
    if (tronco) {
      for (const M of tronco.marcos) M.inv.copy(M.b.matrixWorld).invert();
      locX = NaN;
      for (const c of cadenas) {
        if (c.tipo !== 'capa') continue;
        c.TA = c.TA || new Float32Array(c.A.length);
        for (let i = 0; i < c.A.length; i++) c.TA[i] = huecoTroncoBruto(c.A[i], nTmp);
        w2.copy(c.A[0]).applyMatrix4(tronco.marcos[0].inv);
        c.th0 = Math.atan2(w2.x, w2.z);
        c.dobLim = c.dobLim || new Float32Array(c.A.length);
        for (let i = 2; i < c.A.length; i++) {
          dA.subVectors(c.A[i - 1], c.A[i - 2]); dB.subVectors(c.A[i], c.A[i - 1]);
          c.dobLim[i] = Math.min(2.6, Math.max(1.0, dA.angleTo(dB) + DOBLEZ_EXTRA));
        }
        if (c.brazo) {
          c.brazoL = c.brazoL || [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
          c.huesosBrazo.forEach((b, k) => { cabeza(b, c.brazo[k]); c.brazoL[k].copy(c.brazo[k]).applyMatrix4(tronco.marcos[0].inv); });
        }
        c.sector = SECTOR[c.bs[0].name.replace(/_01$/, '')] ?? Math.PI;
        if (c.espalda) {
          const r = Math.hypot(w2.x, w2.z) || 1;
          c.u = (c.u || new THREE.Vector3()).set(w2.x / r, 0, w2.z / r);
          c.lim = 0.5 * r;
        }
      }
    }
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
    // parado = la espalda casi no se mueve (la recuperacion no frena la capa que vuela al correr)
    const vel = v1.distanceTo(ultimo) / Math.max(dt, 1e-3);
    quieto += ((1 - Math.min(1, vel / 0.3)) - quieto) * Math.min(1, 4 * dt);
    ultimo.copy(v1);
    resto += Math.min(dt, 0.1);
    while (resto >= PASO) { subpaso(PASO); resto -= PASO; }
    escribir();
  }

  return { paso, reiniciar, cadenas, AJUSTE, caps, tronco, penetracion, penetraciones };
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
