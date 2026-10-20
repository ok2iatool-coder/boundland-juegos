// Un RECORRIDO variado del 18 (correr, girar, media vuelta, frenar, saltar, andar) fotograma a fotograma, midiendo la
// capa por tramos: saltos de cada particula en el marco de la pelvis (lo que se aparta de lo que predice su propia
// velocidad), giros bruscos de cada hueso de la capa de un fotograma al siguiente y fotos cada `cada` fotogramas para
// montarlas en una tira (tools/tira_capa.py). Uso: `await (await import('/js/recorrido_capa.js')).grabar(__dbg)`
import * as THREE from 'three';

export const GUION = [
  // [desde s, hasta s, teclas, nombre]
  [0, 1.2, ['KeyW'], 'corre'],
  [1.2, 2.0, ['KeyW', 'KeyD'], 'gira'],
  [2.0, 2.6, ['KeyD'], 'gira mas'],
  [2.6, 3.3, ['KeyA'], 'media vuelta'],
  [3.3, 4.0, [], 'frena'],
  [4.0, 5.0, ['KeyW'], 'salta corriendo'],
  [5.0, 6.2, ['KeyW', 'ShiftLeft'], 'anda'],
  [6.2, 7.0, [], 'para'],
];
const SALTO = 4.3;

export async function grabar(D, { fps = 60, cada = 0, prefijo = 'rc', umbral = 0.02, desde = 0, hasta = 99 } = {}) {
  const T = D.heroe.tela;
  const cad = T.cadenas.filter((c) => c.tipo === 'capa');
  const pelvis = T.tronco.marcos[0].b;
  const inv = new THREE.Matrix4(), q = new THREE.Quaternion(), qPrev = new Map();
  D.congelar(true);
  D.soltar();
  // el mismo arranque siempre (si no, dos pruebas seguidas no se pueden comparar): camara, rumbo, velocidad, animacion y tela
  D.camara(Math.PI, 0.28, 3.4);
  D.ir(0, 0);
  const H = D.heroe;
  if (H.vel) H.vel.set(0, 0, 0);
  H.giro = 0; H.vy = 0;
  if (H.mixer) H.mixer.setTime(0);
  D.avanzar(1 / fps, 90);
  T.reiniciar();
  D.avanzar(1 / fps, 30);
  const hist = cad.map((c) => c.P.map(() => []));
  const histA = cad.map((c) => c.A.map(() => []));
  const tramos = {};
  const fotos = [];
  let peor = { d: 0 };
  const fin = GUION[GUION.length - 1][1];
  for (let f = 0, t = 0; t < fin; f++, t = f / fps) {
    const g = GUION.find(([a, b]) => t >= a && t < b);
    D.soltar(); D.pulsar(...g[2]);
    if (Math.abs(t - SALTO) < 0.5 / fps) D.saltar();
    if (T.OPC) T.OPC.traza = {};
    D.avanzar(1 / fps, 1);
    const traza = T.OPC ? T.OPC.traza : null;
    const tr = (tramos[g[3]] ||= { fotogramas: 0, saltos: 0, peor_cm: 0, giros: 0, peorGiro_grados: 0 });
    tr.fotogramas++;
    inv.copy(pelvis.matrixWorld).invert();
    cad.forEach((c, k) => {
      for (let i = 1; i < c.P.length; i++) {
        const l = c.P[i].clone().applyMatrix4(inv), h = hist[k][i];
        h.push(l); if (h.length > 3) h.shift();
        // lo mismo para la pose del CLIP (la animacion sola, sin fisica): la referencia de lo que ya se mueve a tirones
        const la = c.A[i].clone().applyMatrix4(inv), ha = histA[k][i];
        ha.push(la); if (ha.length > 3) ha.shift();
        if (ha.length === 3 && ha[1].clone().multiplyScalar(2).sub(ha[0]).distanceTo(ha[2]) > umbral) tr.saltosClip = (tr.saltosClip || 0) + 1;
        if (h.length === 3) {
          const d = h[1].clone().multiplyScalar(2).sub(h[0]).distanceTo(h[2]);
          if (d > umbral) {
            tr.saltos++; const tk = t.toFixed(2); (tr.cuando ||= {})[tk] = (tr.cuando[tk] || 0) + 1; tr.peor_cm = Math.max(tr.peor_cm, +(d * 100).toFixed(1));
            const clave = c.bs[0].name.replace(/_01$/, '') + '#' + i;
            (tr.donde ||= {})[clave] = (tr.donde[clave] || 0) + 1;
            // que etapa movio mas la tela en los fotogramas con tirones (suma por etapa, en cm)
            if (traza) for (const [et, v] of Object.entries(traza)) (tr.etapas ||= {})[et] = +(((tr.etapas[et] || 0) + v * 100)).toFixed(1);
          }
          if (d > peor.d) peor = { d, pano: c.bs[0].name, i, t: +t.toFixed(2), tramo: g[3] };
        }
      }
      // giro de cada hueso respecto a la pelvis de un fotograma al siguiente
      c.bs.forEach((b, bi) => {
        b.getWorldQuaternion(q);
        q.premultiply(new THREE.Quaternion().setFromRotationMatrix(inv));
        const p = qPrev.get(b);
        if (p) {
          const ang = 2 * Math.acos(Math.min(1, Math.abs(p.dot(q)))) * 180 / Math.PI;
          if (ang > 25) {
            tr.giros++;
            // de que hueso, y cuanto se aparta la tela de la direccion del clip en ese hueso (cerca de 180 = vuelta)
            const nb = b.name;
            (tr.huesos ||= {})[nb] = (tr.huesos[nb] || 0) + 1;
            const dA = c.A[bi + 1].clone().sub(c.A[bi]).normalize(), dP = c.P[bi + 1].clone().sub(c.P[bi]).normalize();
            const sw = Math.round(Math.acos(Math.max(-1, Math.min(1, dA.dot(dP)))) * 180 / Math.PI / 30) * 30;
            (tr.swing ||= {})[sw] = (tr.swing[sw] || 0) + 1;
          }
          tr.peorGiro_grados = Math.max(tr.peorGiro_grados, +ang.toFixed(1));
        }
        qPrev.set(b, q.clone());
      });
    });
    if (cada && f % cada === 0 && t >= desde && t <= hasta) {
      // la camara de lado al 18, a 2,4 m
      const yaw = (D.heroe.giro ?? 0) + Math.PI / 2;
      D.camara(yaw, 0.18, 2.4);
      const nom = `${prefijo}_${String(f).padStart(4, '0')}`;
      await D.snap(nom);
      fotos.push({ nom, t: +t.toFixed(2), tramo: g[3] });
    }
  }
  D.soltar();
  return { tramos, peor: { ...peor, d: +(peor.d * 100).toFixed(1) + ' cm' }, fotos };
}
