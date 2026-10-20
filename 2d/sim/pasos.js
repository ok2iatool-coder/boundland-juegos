// Como se pasa de un nivel al siguiente: el 18 sale del nivel N por algo de verdad y aparece en el N+1
// por lo que le corresponde, andando, sin quedarse quieto ni teletransportarse.
//   esclusa   puerta blindada del laboratorio (dos hojas que se meten en el marco)
//   ascensor  montacargas: el 18 se sube, la reja se cierra y la jaula se va por el hueco (baja o sube);
//             en el nivel siguiente llega por el mismo hueco (desde arriba o desde abajo), abre y sale
//   escalera  escotilla con escalerilla: trepa y se mete por el techo; en el siguiente asoma por el suelo
//   trampilla se abre bajo sus pies y cae; en el siguiente cae por una trampilla del techo y aterriza
//   conducto  boca de un conducto de ventilacion con su rejilla (la huida del nivel 5)
//   portal    portal de un edificio en ruinas con persiana de chapa (la entrada a la ciudad y al edificio de Varga)
//   casa      puerta de piso, de madera, que se abre hacia dentro
//   borde     sin nada: el mapa no tiene pared por ese lado y se sale corriendo (de la azotea, al vacio)
//   cae       se llega cayendo del cielo
//   continuo  en la calle no hay nada que cruzar: los dos niveles estan PEGADOS. Cada uno lleva el trozo
//             del otro al lado (`unir`), asi que se sale andando por el borde y se entra en el siguiente
//             sin corte: misma vista, mismo 18, misma velocidad.
export const PASOS = {
  1: { salida: 'esclusa' },                                   // empieza dentro del frasco: sin entrada
  2: { entrada: 'esclusa', salida: 'ascensor', va: 'baja' },
  3: { entrada: 'ascensor', viene: 'arriba', salida: 'escalera' },        // su salida esta arriba del todo
  4: { entrada: 'escalera', salida: 'trampilla' },
  5: { entrada: 'trampilla', salida: 'conducto' },            // huye por la ventilacion
  6: { entrada: 'conducto', salida: 'portal' },               // El Linde: sale del conducto a la ladera; entra en la ciudad por una persiana
  7: { entrada: 'portal', salida: 'continuo' },               // sale a la calle por el portal
  8: { entrada: 'continuo', salida: 'portal' },               // el portal del edificio de Varga
  9: { entrada: 'casa', salida: 'borde' },                    // del piso a la azotea, y de la azotea al vacio
  10: { entrada: 'cae', salida: 'continuo' },                 // cae en la plaza que flota; sigue hasta el hospital
  11: { entrada: 'continuo', salida: 'esclusa' },
  // la zona conectada del laboratorio (sim/zona_lab.js): sustituye a los niveles 1-5 y sale por la ventilacion al Linde
  lab: { salida: 'conducto' },
};

export const siguiente = (id) => (id === 'lab' ? 6 : id + 1);

// ---------------------------------------------------------------- niveles pegados
const SOLAPE = 40;          // casillas del vecino que lleva cada nivel (40: las farolas lucen igual en los dos)
const PASO_AL = 6;          // el cambio de nivel ocurre 6 casillas dentro del trozo del siguiente
const TILES = ' #=^H%|!xh';
// del vecino solo viaja lo quieto: terreno y decorado (ni enemigos, ni objetos, ni el autobus)
const DECORADO = new Set(['edificio', 'coche', 'senal', 'farola', 'nido_chapa', 'cartel_ceniza', 'soldado_caido', 'orden_militar', 'rejilla_salida', 'arbol_patio', 'banco_patio', 'grieta']);
const LIBRES = 'jlmnpqrsuvwyIJKLMOTVXZ0123456789';

// el suelo de una columna: la cara de arriba del macizo de abajo (buscando desde abajo: si se busca desde
// arriba, en un interior lo primero que aparece es el techo)
function suelo(mapa, i) {
  const c = (j) => { const f = mapa[j]; return i < f.length ? f[i] : f[f.length - 1]; };
  let j = mapa.length - 1;
  while (j >= 0 && c(j) !== '#') j--;
  while (j > 0 && c(j - 1) === '#') j--;
  return j < 0 ? mapa.length : j;
}
const celda = (mapa, i, j) => { if (j < 0) return ' '; if (j >= mapa.length) return '#'; const f = mapa[j]; return i < f.length ? f[i] : f[f.length - 1]; };

// copia del mapa del siguiente sin la pared de su borde izquierdo (por encima de su suelo)
// (si por encima hay un techo o un piso, solo hasta el: un hueco en la fachada, no el edificio entero)
function abrirIzquierda(n) {
  const s = suelo(n.mapa, 2);
  let tope = 0;
  for (let j = s - 1; j >= 0; j--) { const c = celda(n.mapa, 2, j); if (c === '#' || c === '=') { tope = j + 1; break; } }
  return n.mapa.map((f, j) => (j < s && j >= tope ? f.replace(/^#+/, (m) => ' '.repeat(m.length)) : f));
}

// los caracteres del vecino, traducidos a las marcas del nivel que los recibe
function traductor(propio, vecino) {
  const marcas = { ...propio.marcas }, mapa = {};
  for (const [c, m] of Object.entries(vecino.marcas || {})) {
    if (!DECORADO.has(m.tipo)) continue;
    const igual = Object.entries(marcas).find(([, q]) => q.tipo === m.tipo && JSON.stringify(q) === JSON.stringify(m));
    if (igual) { mapa[c] = igual[0]; continue; }
    const libre = !(c in marcas) ? c : [...LIBRES].find((k) => !(k in marcas));
    marcas[libre] = m; mapa[c] = libre;
  }
  const t = (c) => (TILES.includes(c) ? c : mapa[c] || ' ');
  return { marcas, t };
}

// El nivel tal y como se juega: si su paso es `continuo`, con el trozo del vecino pegado. Devuelve el nivel
// (copia) y, para el que se deja, la costura (donde se cambia y cuanto se desplaza todo al cambiar).
export function unir(nivel, NIVELES) {
  const p = PASOS[nivel.id] || {};
  const ant = p.entrada === 'continuo' ? NIVELES.find((n) => n.id === nivel.id - 1) : null;
  const sig = p.salida === 'continuo' ? NIVELES.find((n) => n.id === nivel.id + 1) : null;
  if (!ant && !sig) return { nivel };
  let mapa = nivel.mapa.slice(), marcas = nivel.marcas, desplX = 0, costura = null, mundo = null;
  const ancho = (m) => Math.max(...m.map((f) => f.length));
  if (sig) {
    const W = ancho(mapa), sigMapa = abrirIzquierda(sig);
    const dy = suelo(sigMapa, 2) - suelo(mapa, W - 1);          // el suelo del final de este con el del principio del otro
    const tr = traductor({ marcas }, sig);
    marcas = tr.marcas;
    mapa = mapa.map((f, j) => {
      const fila = f.padEnd(W, f[f.length - 1]).replace('S', ' ');   // la salida es la costura, no una puerta
      let extra = '';
      for (let i = 0; i < SOLAPE; i++) extra += tr.t(celda(sigMapa, i, j + dy));
      return fila + extra;
    });
    costura = { x: (W + PASO_AL) * 32, sig: sig.id, dx: (SOLAPE - W) * 32, dy: dy * 32 };
    // el mundo comun a los dos (para que el fondo y el primer plano sigan sin salto): este empieza en 0
    mundo = { clave: nivel.id + '-' + sig.id, id: nivel.id, semilla: nivel.semilla ?? nivel.id, mismaZona: nivel.zona === sig.zona, ox: 0, oy: 0, ancho: (W + ancho(sig.mapa)) * 32, alto: Math.max(nivel.mapa.length, sig.mapa.length - dy) * 32 };
  }
  if (ant) {
    const Wa = ancho(ant.mapa), propio = abrirIzquierda(nivel);
    const dy = suelo(propio, 2) - suelo(ant.mapa, Wa - 1);
    const tr = traductor({ marcas }, ant);
    marcas = tr.marcas;
    const antes = (j) => { let s = ''; for (let i = Wa - SOLAPE; i < Wa; i++) s += tr.t(celda(ant.mapa, i, j - dy)); return s; };
    mapa = propio.map((f, j) => antes(j) + f);
    // por abajo tan hondo como el anterior: si no, la camara topa antes con el borde y da un salto. Lo propio va
    // macizo; el trozo del anterior, con lo que de verdad tiene (la plaza es mas alta que el hospital y alli abajo
    // esta su gravedad cero: rellenarlo de macizo hacia distintas las dos copias de la costura)
    const Wp = ancho(propio);
    while (mapa.length < ant.mapa.length + dy) mapa.push(antes(mapa.length) + '#'.repeat(Wp));
    desplX = SOLAPE * 32;
    mundo = { clave: ant.id + '-' + nivel.id, id: ant.id, semilla: ant.semilla ?? ant.id, mismaZona: nivel.zona === ant.zona, ox: (Wa - SOLAPE) * 32, oy: -dy * 32, ancho: (Wa + ancho(nivel.mapa)) * 32, alto: Math.max(ant.mapa.length, nivel.mapa.length - dy) * 32 };
  }
  const n = { ...nivel, mapa, marcas };
  if (desplX) {
    n.pistas = (nivel.pistas || []).map((q) => ({ ...q, x: q.x + SOLAPE }));
    n.salas = (nivel.salas || []).map((s) => [s[0] + SOLAPE, s[1] + SOLAPE, s[2], s[3]]);
  }
  return { nivel: n, costura, desplX, mundo };
}
