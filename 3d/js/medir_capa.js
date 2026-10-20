// Mide la capa del 18 corriendo (para afinar tela.js sin mirar a ojo): por fotograma, en el marco de la pelvis,
// cuanto SALTA cada particula de los panos de delante y de los costados (lo que se mueve de mas frente a lo que predice
// su propia velocidad), hacia donde va la punta (atras / lado) y si algun TRAMO de tela (entre dos particulas) atraviesa
// el brazo (distancia del segmento a la capsula menor que su radio). Uso: `await (await import('./js/medir_capa.js')).medir(__dbg)`
import * as THREE from 'three';

const PANOS = ['cape_fl', 'cape_fr', 'cape_l', 'cape_r'];

// distancia entre dos segmentos 3D (a0-a1 y b0-b1)
function distSeg(a0, a1, b0, b1) {
  const d1 = new THREE.Vector3().subVectors(a1, a0), d2 = new THREE.Vector3().subVectors(b1, b0), r = new THREE.Vector3().subVectors(a0, b0);
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r);
  let s, t;
  if (a < 1e-12 && e < 1e-12) return a0.distanceTo(b0);
  if (a < 1e-12) { s = 0; t = Math.min(1, Math.max(0, f / e)); }
  else {
    const c = d1.dot(r);
    if (e < 1e-12) { t = 0; s = Math.min(1, Math.max(0, -c / a)); }
    else {
      const b = d1.dot(d2), den = a * e - b * b;
      s = den !== 0 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
    }
  }
  const p = a0.clone().addScaledVector(d1, s), q = b0.clone().addScaledVector(d2, t);
  return p.distanceTo(q);
}

export async function medir(D, { seg = 4, fps = 60 } = {}) {
  const T = D.heroe.tela, pel = D.heroe.raiz ? null : null;
  const cad = T.cadenas.filter((c) => c.tipo === 'capa' && PANOS.includes(c.bs[0].name.replace(/_01$/, '')));
  const brazos = T.caps.filter((k) => /arm|hand/.test(k.a.name));
  const pelvis = T.tronco.marcos[0].b;
  const inv = new THREE.Matrix4();
  D.congelar(true);
  D.ir(2.5, 2.5); D.avanzar(1 / fps, 20);
  D.pulsar('KeyW');
  D.avanzar(1 / fps, 40);                                   // que arranque
  const hist = cad.map((c) => c.P.map(() => []));
  const res = { saltos: {}, cruces: {}, tocaDentro: {}, crucesClip: {}, punta: {} };
  for (const c of cad) { const n = c.bs[0].name.replace(/_01$/, ''); res.saltos[n] = 0; res.cruces[n] = 0; res.punta[n] = { atras: 0, lado: 0, n: 0 }; }
  const n = Math.round(seg * fps);
  let peorSalto = { d: 0 };
  for (let f = 0; f < n; f++) {
    D.avanzar(1 / fps, 1);
    inv.copy(pelvis.matrixWorld).invert();
    cad.forEach((c, k) => {
      const nom = c.bs[0].name.replace(/_01$/, '');
      c.P.forEach((p, i) => {
        if (i === 0) return;
        const l = p.clone().applyMatrix4(inv), h = hist[k][i];
        h.push(l);
        if (h.length >= 3) {
          const pred = h[h.length - 2].clone().multiplyScalar(2).sub(h[h.length - 3]);
          const d = pred.distanceTo(l);
          if (d > 0.025) { res.saltos[nom]++; if (d > peorSalto.d) peorSalto = { d: +d.toFixed(3), pano: nom, i, f }; }
        }
      });
      // tramos que cruzan el brazo
      // (desde el segundo tramo: la raiz va apoyada en el hombro, dentro de la capsula del brazo, tambien en el clip)
      for (let i = 2; i < c.P.length; i++) for (const b of brazos) if (distSeg(c.P[i - 1], c.P[i], b.pa, b.pb) < b.r * 0.85) { res.cruces[nom]++; break; }
      for (let i = 2; i < c.P.length; i++) for (const b of brazos) { const d = distSeg(c.P[i - 1], c.P[i], b.pa, b.pb); if (d < b.r) { const kk = nom + ' ' + b.a.name; res.tocaDentro[kk] = (res.tocaDentro[kk] || 0) + 1; res.hondo = Math.max(res.hondo || 0, +(b.r - d).toFixed(3)); break; } }
      for (let i = 2; i < c.A.length; i++) for (const b of brazos) if (distSeg(c.A[i - 1], c.A[i], b.pa, b.pb) < b.r * 0.85) { res.crucesClip[nom] = (res.crucesClip[nom] || 0) + 1; break; }
      // la punta respecto a la raiz, en el marco de la pelvis: z = delante, x = lado
      const r0 = c.P[0].clone().applyMatrix4(inv), pt = c.P[c.P.length - 1].clone().applyMatrix4(inv);
      const pu = res.punta[nom];
      pu.atras += -(pt.z - r0.z); pu.lado += Math.abs(pt.x) - Math.abs(r0.x); pu.n++;
    });
  }
  D.soltar();
  for (const k in res.punta) { const p = res.punta[k]; res.punta[k] = { atras_cm: +(100 * p.atras / p.n).toFixed(1), afuera_cm: +(100 * p.lado / p.n).toFixed(1) }; }
  res.fotogramas = n; res.peorSalto = peorSalto; res.corre = +T.corre.toFixed(2);
  return res;
}
