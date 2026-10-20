// FISICA DE LA HIERBA alrededor del 18. Modulo PURO (sin three ni DOM): lo prueba `node boundland-bosque3d/test.mjs`.
//
// Un campo de MUELLES en una ventana de `lado` m que sigue al heroe, en celdas de `celda` m. Cada celda guarda cuanto
// esta doblada la hierba (desplazamiento de la punta, b, en m), a que velocidad (v) y cuanto esta APLASTADA (ap, 0..1,
// con la direccion en que se tumbo, d). La hierba de cada mata lee su celda en el sombreador.
//   - muelle con poco amortiguado: lo que se empuja vuelve con un rebote (zeta ~0,37)
//   - contacto: pies, piernas, cuerpo y bajo de la capa la apartan hacia fuera y hacia donde se mueven
//   - pisada: lo que pisa la deja tumbada en su direccion y se levanta despacio (RECUPERA s): deja RASTRO
//   - caida: al aterrizar de un salto, una onda que la abre en corro
// Fuera de la ventana la hierba solo tiene el viento del sombreador; en sus bordes el campo se apaga.

export const FISICA = {
  K: 45,              // rigidez del muelle (1/s2)
  C: 5,               // amortiguado (1/s)
  K_CONTACTO: 450,    // lo fuerte que un contacto lleva la hierba a su sitio apartado (1/s2)
  B_MAX: 0.18,        // desplazamiento maximo de la punta (a 25 cm) por un contacto (m)
  B_TOPE: 0.22,       // y en ningun caso mas (m)
  B_APLASTADA: 0.17,  // la punta de la hierba tumbada del todo (m)
  RECUPERA: 12,       // s que tarda en levantarse del todo la hierba pisada
  ONDA_R: 1.3,        // radio de la onda al caer de un salto (m)
  BORDE: 3,           // celdas del borde de la ventana en que el campo se apaga
};

export function crearCampo({ lado = 24, celda = 0.25 } = {}) {
  const n = Math.round(lado / celda);
  const N2 = n * n;
  const bx = new Float32Array(N2), bz = new Float32Array(N2), vx = new Float32Array(N2), vz = new Float32Array(N2);
  const ap = new Float32Array(N2), dx = new Float32Array(N2), dz = new Float32Array(N2);
  const capas = [bx, bz, vx, vz, ap, dx, dz];
  const tmp = new Float32Array(N2);
  let i0 = null, j0 = null;              // indice de mundo (en celdas) de la celda (0, 0) de la ventana
  const previos = new Map();             // id del emisor -> su posicion anterior (para su velocidad)
  let aterrizajes = 0;

  // la ventana se centra en (x, z) a saltos de 2 m; los datos se desplazan con ella (el rastro sigue en su sitio)
  function centrar(x, z) {
    const ni = Math.round(x / celda) - (n >> 1), nj = Math.round(z / celda) - (n >> 1);
    if (i0 === null) { i0 = ni; j0 = nj; return true; }
    const si = ni - i0, sj = nj - j0;
    if (Math.abs(si) < 8 && Math.abs(sj) < 8) return false;
    for (const a of capas) {
      tmp.fill(0);
      for (let j = 0; j < n; j++) {
        const jv = j + sj;
        if (jv < 0 || jv >= n) continue;
        for (let i = 0; i < n; i++) {
          const iv = i + si;
          if (iv >= 0 && iv < n) tmp[j * n + i] = a[jv * n + iv];
        }
      }
      a.set(tmp);
    }
    i0 = ni; j0 = nj;
    return true;
  }

  // emisores: [{ id, x, z, r, fuerza (0..1, lo metido en la hierba), pisa (0..1) }]; caida: { n, x, z, v } o null
  function paso(dt, emisores = [], caida = null) {
    if (i0 === null) return;
    const F = FISICA;
    // mas de 1/30 s de golpe (pestana en segundo plano): en trozos, el muelle explicito no aguanta pasos largos
    if (dt > 1 / 30) {
      const k = Math.min(6, Math.ceil(dt * 30));
      for (let s = 0; s < k; s++) paso(dt / k, s === 0 ? emisores : emisores.map((e) => ({ ...e, id: e.id })), s === 0 ? caida : null);
      return;
    }
    // la onda de una caida
    if (caida && caida.n !== aterrizajes) {
      aterrizajes = caida.n;
      const imp = Math.min(3.2, 0.9 * Math.max(0, caida.v));
      recorrer(caida.x, caida.z, F.ONDA_R, (k, ex, ez, d) => {
        const f = 1 - d / F.ONDA_R, l = d || 1;
        vx[k] += ex / l * imp * f;
        vz[k] += ez / l * imp * f;
      });
    }
    // contactos
    for (const e of emisores) {
      const p = previos.get(e.id);
      let mx = 0, mz = 0;
      if (p) { mx = (e.x - p.x) / Math.max(dt, 1e-4); mz = (e.z - p.z) / Math.max(dt, 1e-4); }
      previos.set(e.id, { x: e.x, z: e.z });
      const vel = Math.hypot(mx, mz);
      if (e.fuerza <= 0) continue;
      // hacia donde va (si se mueve) pesa en la direccion en que se aparta la hierba
      const ux = vel > 0.05 ? mx / vel : 0, uz = vel > 0.05 ? mz / vel : 0;
      const empuje = Math.min(1, vel / 1.5);
      recorrer(e.x, e.z, e.r, (k, ex, ez, d) => {
        const f = (1 - d / e.r) * e.fuerza;
        // justo debajo del contacto no hay "hacia fuera": si se mueve, hacia donde va; si esta quieto, cada celda tiene
        // su direccion fija (si no, la mata que quedaba en el centro no se apartaba)
        let rx = ex, rz = ez;
        if (d < 0.03 && empuje < 0.1) { const a = ((k * 2654435761) >>> 0) / 4294967296 * 6.2832; rx = Math.cos(a); rz = Math.sin(a); }
        const l = Math.hypot(rx, rz) || 1;
        let ox = rx / l + ux * empuje * 0.8, oz = rz / l + uz * empuje * 0.8;
        const lo = Math.hypot(ox, oz) || 1;
        ox /= lo; oz /= lo;
        const tx = ox * F.B_MAX * f, tz = oz * F.B_MAX * f;
        vx[k] += (tx - bx[k]) * F.K_CONTACTO * f * dt;
        vz[k] += (tz - bz[k]) * F.K_CONTACTO * f * dt;
        if (e.pisa > 0) {
          const a = f * e.pisa;
          if (a > ap[k]) {
            // se tumba hacia donde la empujan; si ya estaba tumbada, mezcla las dos direcciones
            const w = ap[k] / (ap[k] + a);
            let nx = dx[k] * w + ox * (1 - w), nz = dz[k] * w + oz * (1 - w);
            const ln = Math.hypot(nx, nz) || 1;
            dx[k] = nx / ln; dz[k] = nz / ln;
            ap[k] = a;
          }
        }
      });
    }
    // muelles
    const borde = F.BORDE;
    for (let j = 0; j < n; j++) {
      const fj = Math.min(j, n - 1 - j);
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        if (ap[k] > 0) ap[k] = Math.max(0, ap[k] - dt / F.RECUPERA);
        const rx = dx[k] * ap[k] * F.B_APLASTADA, rz = dz[k] * ap[k] * F.B_APLASTADA;
        vx[k] += (-F.K * (bx[k] - rx) - F.C * vx[k]) * dt;
        vz[k] += (-F.K * (bz[k] - rz) - F.C * vz[k]) * dt;
        bx[k] += vx[k] * dt;
        bz[k] += vz[k] * dt;
        const lb = Math.hypot(bx[k], bz[k]);
        if (lb > F.B_TOPE) { bx[k] *= F.B_TOPE / lb; bz[k] *= F.B_TOPE / lb; }
        // en el borde de la ventana se apaga (al moverla no queda un escalon)
        const fb = Math.min(fj, i, n - 1 - i);
        if (fb < borde) {
          const g = fb / borde;
          bx[k] *= g; bz[k] *= g; vx[k] *= g; vz[k] *= g; ap[k] *= g;
        }
      }
    }
  }

  // llama fn(indice, dx, dz, distancia) para las celdas a menos de r de (x, z)
  function recorrer(x, z, r, fn) {
    const ia = Math.max(0, Math.floor((x - r) / celda) - i0), ib = Math.min(n - 1, Math.ceil((x + r) / celda) - i0);
    const ja = Math.max(0, Math.floor((z - r) / celda) - j0), jb = Math.min(n - 1, Math.ceil((z + r) / celda) - j0);
    for (let j = ja; j <= jb; j++) {
      const cz = (j + j0) * celda;
      for (let i = ia; i <= ib; i++) {
        const cx = (i + i0) * celda;
        const ex = cx - x, ez = cz - z, d = Math.hypot(ex, ez);
        if (d < r) fn(j * n + i, ex, ez, d);
      }
    }
  }

  // la celda que cae en (x, z) del mundo (o -1 fuera de la ventana)
  function indice(x, z) {
    const i = Math.round(x / celda) - i0, j = Math.round(z / celda) - j0;
    return i < 0 || j < 0 || i >= n || j >= n ? -1 : j * n + i;
  }

  function energia() {
    let e = 0;
    for (let k = 0; k < N2; k++) e += vx[k] * vx[k] + vz[k] * vz[k] + FISICA.K * (bx[k] * bx[k] + bz[k] * bz[k]);
    return e;
  }

  return {
    n, celda, lado: n * celda, bx, bz, vx, vz, ap, dx, dz,
    // el mundo de la celda (0, 0): el sombreador lee la celda con (x - origen) / lado
    origen: () => [i0 * celda, j0 * celda],
    centrar, paso, indice, energia,
  };
}
