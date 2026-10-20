// El agua de un charco: la ecuacion de ondas en una rejilla, sin three ni DOM (se prueba en test.mjs).
//
// Aguas someras: la onda va a sqrt(g * profundidad), asi que en la orilla va mas despacio y se dobla hacia ella, como en
// un charco de verdad. La orilla refleja (lo que no es agua hace de pared) y todo se apaga solo en un par de segundos.
// El 18 hunde el agua donde pisa: quien la mueve son `empujar` (un pie, una gota) y el paso del tiempo.

export const AGUA = {
  DT: 1 / 120,            // el paso fijo de la simulacion (s)
  MAX_PASOS: 8,           // como mucho, en cada fotograma
  G: 9.8,
  C_MAX: 0.75,            // tope de la velocidad de la onda (m/s): la de 5,7 cm de fondo
  FRENO: 0.994,           // por paso: la onda se apaga en ~1,5 s
  TOPE: 0.02,             // la superficie no se aparta mas de 2 cm
};

// ancho x alto en metros, celda en metros; hondo(x, y) -> profundidad (m) en ese punto de la rejilla (0 o menos: tierra)
export function crearAgua({ ancho, alto, celda, hondo }) {
  const nx = Math.max(3, Math.round(ancho / celda)), ny = Math.max(3, Math.round(alto / celda)), n = nx * ny;
  const h = new Float32Array(n), h0 = new Float32Array(n), hn = new Float32Array(n);
  const prof = new Float32Array(n), agua = new Uint8Array(n), k2 = new Float32Array(n);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i, d = hondo((i + 0.5) * celda, (j + 0.5) * celda);
      prof[k] = Math.max(0, d);
      agua[k] = d > 0.002 ? 1 : 0;
      const c = Math.min(AGUA.C_MAX, Math.sqrt(AGUA.G * Math.max(d, 0.002)));
      k2[k] = (c * AGUA.DT / celda) ** 2;                               // con C_MAX y celda >= 1,5 cm: < 0,2, estable
    }
  }
  let resto = 0;

  function un_paso() {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (!agua[k]) { hn[k] = 0; continue; }
        const c = h[k];
        // lo que no es agua hace de pared: el vecino de tierra cuenta como esta misma celda (la onda rebota)
        const l = i > 0 && agua[k - 1] ? h[k - 1] : c, r = i < nx - 1 && agua[k + 1] ? h[k + 1] : c;
        const d = j > 0 && agua[k - nx] ? h[k - nx] : c, u = j < ny - 1 && agua[k + nx] ? h[k + nx] : c;
        let v = (2 * c - h0[k] + k2[k] * (l + r + d + u - 4 * c)) * AGUA.FRENO;
        hn[k] = v > AGUA.TOPE ? AGUA.TOPE : v < -AGUA.TOPE ? -AGUA.TOPE : v;
      }
    }
    h0.set(h); h.set(hn);
  }

  return {
    nx, ny, celda, h, prof, agua,
    // avanza dt segundos en pasos fijos; devuelve cuantos dio
    paso(dt) {
      resto = Math.min(resto + dt, AGUA.DT * AGUA.MAX_PASOS);
      let pasos = 0;
      while (resto >= AGUA.DT) { un_paso(); resto -= AGUA.DT; pasos++; }
      return pasos;
    },
    // hunde (cantidad > 0) o levanta el agua alrededor de (x, y) con una campana de radio r (m)
    empujar(x, y, r, cantidad) {
      const rc = Math.max(r, celda) / celda, ci = x / celda - 0.5, cj = y / celda - 0.5, R = Math.ceil(rc * 2);
      for (let j = Math.max(0, Math.floor(cj) - R); j <= Math.min(ny - 1, Math.ceil(cj) + R); j++) {
        for (let i = Math.max(0, Math.floor(ci) - R); i <= Math.min(nx - 1, Math.ceil(ci) + R); i++) {
          const k = j * nx + i;
          if (!agua[k]) continue;
          const q = ((i - ci) ** 2 + (j - cj) ** 2) / (rc * rc);
          if (q < 4) { h[k] -= cantidad * Math.exp(-q); h0[k] -= cantidad * Math.exp(-q) * 0.5; }
        }
      }
    },
    // profundidad y si hay agua en (x, y) (m, coordenadas de la rejilla)
    hondo(x, y) {
      const i = Math.floor(x / celda), j = Math.floor(y / celda);
      if (i < 0 || j < 0 || i >= nx || j >= ny) return 0;
      return agua[j * nx + i] ? prof[j * nx + i] : 0;
    },
    altura(x, y) {
      const i = Math.floor(x / celda), j = Math.floor(y / celda);
      if (i < 0 || j < 0 || i >= nx || j >= ny) return 0;
      return h[j * nx + i];
    },
    energia() { let e = 0; for (let k = 0; k < n; k++) e += h[k] * h[k]; return e; },
  };
}
