// LA ZONA CONECTADA DEL LABORATORIO (prueba metroidvania a lo Hollow Knight, 2026-10-18): los niveles 1 a 5
// rehechos como UNA zona de salas unidas por varios caminos. Este fichero es el PLANO: donde esta cada sala en
// la rejilla del mundo (en casillas de 32 u), por donde se pasa de una a otra, que pide cada paso, que hay en
// cada sala y que se VE antes de poder alcanzarlo. tools/plano_zona.mjs dibuja la lamina desde aqui.
// Puro: sin DOM.

// Las cuatro partes de la zona (los rotulos que salen al entrar, a lo Hollow Knight)
export const AREAS = {
  estasis: { es: 'Ala de estasis', en: 'Stasis Wing', tinte: '#c9d3dc' },
  pozo: { es: 'El pozo', en: 'The Shaft', tinte: '#d6d0c2' },
  tejado: { es: 'Bajo el tejado', en: 'Under the Roof', tinte: '#d9cdb4' },
  anomalia: { es: 'La anomalía', en: 'The Anomaly', tinte: '#c4d6e6' },
};

// Lo que abre caminos. `se` es donde se consigue.
export const HABILIDADES = {
  doble: { es: 'Doble salto', en: 'Double jump', se: 'orilla', por: { es: 'la anomalía despierta el cuerpo mutado, que pesa poco', en: 'the anomaly wakes the light mutated body' } },
  gancho: { es: 'Gancho', en: 'Hook', se: 'nave', por: { es: 'la línea de carga de los Entomórficos, en el tornillo gigante', en: 'the Entomorphs’ cargo line, on the giant screw' } },
  tele: { es: 'Teletransporte', en: 'Teleport', se: 'corazon', por: { es: 'el corazón de la anomalía despierta el resto de la mutación (GDD)', en: 'the heart of the anomaly wakes the rest of the mutation (GDD)' } },
  hack: { es: 'Hack 1 (tres círculos)', en: 'Hack 1 (three circles)', se: 'rejilla', por: { es: 'la cerradura de la rejilla pide el patrón del sujeto', en: 'the grate lock asks for the subject’s pattern' } },
};

// Las salas: x, y, w, h en casillas del mundo (y hacia abajo). `n` es el numero en el plano.
// El laboratorio esta DEBAJO de la capital: el 18 despierta en lo mas hondo del ala de estasis y la zona entera se
// recorre de abajo arriba hasta la rejilla, que sale por arriba al Linde. La unica bajada es la de la anomalia (de
// las vigas por la sima al corazon), y el corazon queda solo un poco mas hondo que el despertar.
export const SALAS = [
  { id: 'estasis', n: 1, area: 'estasis', x: 0, y: 76, w: 64, h: 22, es: 'Estasis', en: 'Stasis' },
  { id: 'pasillo', n: 2, area: 'estasis', x: 64, y: 78, w: 48, h: 20, es: 'Pasillo de servicio', en: 'Service Corridor' },
  { id: 'pozo', n: 3, area: 'pozo', x: 112, y: 22, w: 32, h: 70, es: 'El pozo del montacargas', en: 'The Lift Shaft' },
  { id: 'frascos', n: 4, area: 'estasis', x: 20, y: 54, w: 50, h: 22, es: 'La sala de los frascos', en: 'The Jar Room' },
  { id: 'tornillos', n: 5, area: 'tejado', x: 70, y: 56, w: 42, h: 20, es: 'Caen tornillos', en: 'Falling Bolts' },
  { id: 'nave', n: 6, area: 'tejado', x: 100, y: 0, w: 90, h: 22, es: 'La nave de los tornillos gigantes', en: 'The Giant Screw Hall' },
  { id: 'foso', n: 7, area: 'anomalia', x: 248, y: 84, w: 44, h: 28, es: 'El foso de cristal', en: 'The Glass Pit' },
  { id: 'brecha', n: 8, area: 'anomalia', x: 144, y: 44, w: 48, h: 24, es: 'La brecha', en: 'The Breach' },
  { id: 'sima', n: 9, area: 'anomalia', x: 192, y: 26, w: 56, h: 60, es: 'La sima', en: 'The Chasm' },
  { id: 'orilla', n: 10, area: 'anomalia', x: 248, y: 58, w: 36, h: 26, es: 'La orilla', en: 'The Far Shore' },
  { id: 'andamios', n: 11, area: 'anomalia', x: 248, y: 6, w: 34, h: 52, es: 'Los andamios', en: 'The Scaffolds' },
  { id: 'corazon', n: 12, area: 'anomalia', x: 160, y: 92, w: 88, h: 20, es: 'El corazón de la anomalía', en: 'The Heart of the Anomaly' },
  { id: 'camara', n: 13, area: 'pozo', x: 144, y: 68, w: 48, h: 24, es: 'La cámara fría', en: 'The Cold Room' },
  { id: 'escondite', n: 14, area: 'estasis', x: 76, y: 98, w: 28, h: 14, es: 'El escondite del 17', en: 'Seventeen’s Hideout', secreta: true },
  { id: 'huida', n: 15, area: 'tejado', x: 30, y: 4, w: 70, h: 18, es: 'La huida', en: 'The Escape' },
  { id: 'rejilla', n: 16, area: 'tejado', x: 0, y: 2, w: 30, h: 20, es: 'La rejilla', en: 'The Grate' },
  { id: 'archivo', n: 17, area: 'estasis', x: 0, y: 62, w: 20, h: 14, es: 'El archivo de Varga', en: 'Varga’s Archive', secreta: true },
  { id: 'vigas', n: 18, area: 'tejado', x: 190, y: 0, w: 58, h: 26, es: 'Las vigas', en: 'The Girders' },
];

// Los pasos entre salas, con el hueco que se talla en el mapa (x, y, w, h en casillas del mundo). `pide` es la
// habilidad que hace falta (null: nada), `ida` si solo se puede en un sentido (de a a b) y `tipo` como se cruza:
//   anda: andando por un hueco de la pared   cae: dejarse caer por un agujero   sube: saltar o trepar hacia arriba
//   reja: barrotes que solo cruza el teletransporte   esclusa: atajo que se abre desde un lado
// `tabla`: fila de una plataforma de paso dentro del hueco (se sube saltando y se baja con abajo + salto);
// `cuerda`: columna de una cuerda que baja por el hueco (para volver a subir)
export const PASOS = [
  { a: 'estasis', b: 'pasillo', tipo: 'anda', x: 62, y: 93, w: 3, h: 3 },
  { a: 'pasillo', b: 'pozo', tipo: 'anda', x: 111, y: 88, w: 2, h: 3 },
  { a: 'frascos', b: 'estasis', tipo: 'cae', vuelta: 'doble', x: 50, y: 75, w: 3, h: 2, tabla: 76 },
  { a: 'estasis', b: 'archivo', tipo: 'sube', pide: 'gancho', x: 9, y: 75, w: 2, h: 2 },
  { a: 'frascos', b: 'tornillos', tipo: 'anda', x: 69, y: 72, w: 2, h: 3 },
  { a: 'tornillos', b: 'pozo', tipo: 'anda', x: 111, y: 72, w: 2, h: 3 },
  { a: 'pozo', b: 'nave', tipo: 'sube', pide: 'doble', x: 126, y: 21, w: 4, h: 2, tabla: 21 },
  { a: 'pozo', b: 'brecha', tipo: 'anda', x: 143, y: 61, w: 2, h: 3 },
  { a: 'camara', b: 'pozo', tipo: 'esclusa', ida: true, x: 143, y: 88, w: 2, h: 3 },
  { a: 'brecha', b: 'sima', tipo: 'anda', x: 191, y: 50, w: 2, h: 14 },
  { a: 'sima', b: 'orilla', tipo: 'anda', x: 247, y: 77, w: 2, h: 3 },
  { a: 'orilla', b: 'andamios', tipo: 'sube', pide: 'doble', x: 262, y: 57, w: 4, h: 2, tabla: 57 },
  { a: 'andamios', b: 'vigas', tipo: 'anda', x: 247, y: 15, w: 2, h: 3 },
  { a: 'vigas', b: 'nave', tipo: 'anda', x: 189, y: 18, w: 2, h: 3 },
  { a: 'vigas', b: 'sima', tipo: 'cae', ida: true, x: 227, y: 25, w: 5, h: 2 },
  { a: 'orilla', b: 'foso', tipo: 'cae', pide: 'gancho', x: 277, y: 80, w: 3, h: 5, cuerda: 277 },
  { a: 'foso', b: 'corazon', tipo: 'anda', pide: 'gancho', x: 247, y: 105, w: 2, h: 3 },
  { a: 'corazon', b: 'camara', tipo: 'reja', pide: 'tele', x: 166, y: 91, w: 1, h: 2, cuerda: 166 },
  { a: 'pasillo', b: 'escondite', tipo: 'reja', pide: 'tele', x: 85, y: 96, w: 3, h: 3, cuerda: 85 },
  { a: 'nave', b: 'huida', tipo: 'reja', pide: 'tele', x: 99, y: 18, w: 2, h: 3 },
  { a: 'huida', b: 'rejilla', tipo: 'anda', x: 29, y: 16, w: 2, h: 3 },
];

// Lo que se VE antes de poder alcanzarlo: desde donde, que, y que hace falta
export const VISTAS = [
  { sala: 'estasis', desde: [34, 95], ve: [50, 79], pide: 'doble', es: 'la balda alta y el hueco del techo', en: 'the high shelf and the hole in the ceiling' },
  { sala: 'estasis', desde: [16, 95], ve: [10, 78], pide: 'gancho', es: 'una anilla bajo una trampilla con luz', en: 'a ring under a lit hatch' },
  { sala: 'pasillo', desde: [80, 95], ve: [94, 95], pide: 'tele', es: 'la celda del 17, tras barrotes, con algo que brilla', en: 'Seventeen’s cell, behind bars, with a glint' },
  { sala: 'pozo', desde: [124, 62], ve: [128, 26], pide: 'doble', es: 'la luz de la nave arriba del pozo', en: 'the hall’s light at the top of the shaft' },
  { sala: 'pozo', desde: [126, 90], ve: [143, 89], pide: 'esclusa', es: 'la esclusa con el piloto rojo: no tiene asa por este lado', en: 'the airlock’s red light: no handle on this side' },
  { sala: 'orilla', desde: [270, 80], ve: [270, 100], pide: 'gancho', es: 'el foso de cristal y sus anillas colgadas', en: 'the glass pit and its hanging rings' },
  { sala: 'sima', desde: [226, 82], ve: [224, 96], pide: 'gancho', es: 'la luz del corazón entre las grietas del suelo', en: 'the heart’s light through the cracks of the floor' },
  { sala: 'nave', desde: [112, 18], ve: [60, 14], pide: 'tele', es: 'tras los barrotes, el pasillo de la huida y la luz de la rejilla', en: 'behind the bars, the escape corridor and the grate’s light' },
];

// El camino principal en etapas (los numeros redondos del plano) y lo opcional (las letras)
export const ETAPAS = [
  { n: 1, en: [16, 83], es: 'Despierta en su frasco, en lo más hondo del laboratorio. Nota 1.' },
  { n: 2, en: [86, 92], es: 'Pasillo de servicio: tras unos barrotes, la celda del 17 con algo que brilla.' },
  { n: 3, en: [128, 80], es: 'El fondo del pozo: primer frasco de reserva (banco) y una esclusa con el piloto rojo. Se sube por el pozo; arriba se ve luz.' },
  { n: 4, en: [206, 48], es: 'La brecha y la sima: gravedad cero, se cruza flotando.' },
  { n: 5, en: [278, 64], es: 'La orilla: la anomalía despierta el DOBLE SALTO. Abajo se ve el foso de cristal.' },
  { n: 6, en: [262, 34], es: 'Con el doble salto: los andamios y las vigas hasta la nave (o de vuelta por la sima y el pozo).' },
  { n: 7, en: [138, 8], es: 'La nave: dos tornillos gigantes lo encierran y la línea de carga da el GANCHO. Tras unos barrotes se ve el pasillo de la huida.' },
  { n: 8, en: [260, 92], es: 'Por el agujero de las vigas a la sima, a la orilla y, con el gancho, por el foso de cristal.' },
  { n: 9, en: [238, 98], es: 'El corazón de la anomalía: TELETRANSPORTE. Con él cruza los barrotes.' },
  { n: 10, en: [168, 78], es: 'La cámara fría: segundo frasco y la palanca que abre la esclusa: ATAJO de vuelta al pozo.' },
  { n: 11, en: [70, 10], es: 'Por el pozo a la nave, a través de los barrotes y a la huida: los tornillos persiguen.' },
  { n: 12, en: [16, 12], es: 'La rejilla: nota 3, el Hack 1 (tres círculos) y el conducto al Linde.' },
];
export const OPCIONAL = [
  { l: 'A', en: [34, 62], es: 'La sala de los frascos (nota 2): con doble salto desde Estasis o andando desde Caen tornillos.' },
  { l: 'B', en: [6, 66], es: 'El archivo de Varga (nota escondida): con el gancho, por la trampilla del techo de Estasis.' },
  { l: 'C', en: [84, 106], es: 'El escondite del 17 (fragmento de ampolla): teletransporte por los barrotes y un suelo falso.' },
];

// ================================================================ el mapa
// La zona entera es UN mapa de ANCHO x ALTO casillas (sin cortes ni cargas entre salas): todo es roca y cada sala
// talla su hueco (con un marco de una casilla), sus suelos y sus cosas; luego se tallan los pasos. Las letras son
// las de niveles.js; lo que no cabe en una letra (frascos de reserva, motas de esencia, el atajo, el suelo falso...)
// va en `entidades` y lo monta sim/zona.js.
export const ANCHO = 292, ALTO = 112;

// marcas de decorado de la zona: las del laboratorio del nivel 1 y las de los niveles 2-5
const as = (id, o = {}) => ({ tipo: 'asset', id, ...o });
export const MARCAS = {
  j: as('frasco', { escala: 0.72, numerado: true }), K: as('caja_rombo', { solido: true, capa: 'sobre', dx: 16, escala: 0.92 }),
  l: { tipo: 'fluorescente', calida: true }, '2': { tipo: 'fluorescente' },
  g: as('gancho_grua', { balanceo: 0.05, largo: 170 }), c: as('cadena_colgante', { balanceo: 0.04, largo: 60 }), A: as('cadena_colgante', { balanceo: 0.03, largo: 260 }),
  V: as('roca_flotante', { flota: true, ancla: 'libre', escala: 1.5 }), E: as('charco', { escala: 1.1 }), F: as('boceto_18', { capa: 'frente', ancla: 'suelo', escala: 1.5, dy: 18 }),
  w: as('cables_colgando'), s: as('taburete'), p: as('papeles'), q: as('tanque_vertical'), u: as('consola_mandos'), v: as('escombros'),
  m: as('cristales_rotos'), b: as('barril'), n: as('boceto_18'), i: as('tuberia_codo'), r: as('escombros', { escala: 1.2 }), d: as('tornillos_sueltos'),
  y: as('columna_hierro'), M: as('mesa_laboratorio'), O: as('baul_remachado'), L: as('farol_laton'),
  Z: { tipo: 'cascada' }, '3': { tipo: 'estanteria' }, '4': { tipo: 'carrito' }, '5': { tipo: 'cartel_bio' }, '6': { tipo: 'rastro_laton' },
  '7': { tipo: 'grieta' }, '8': { tipo: 'frascos_rotos' }, J: { tipo: 'frasco' }, h: { tipo: 'adn' },
  // la trampa de la nave: dos tornillos gigantes, los dos con su linea de carga (se cae dentro desde cualquier lado)
  T: { tipo: 'disparador' }, U: { tipo: 'tornillo_gigante', ancho: 4, alto: 9, gancho: true }, W: { tipo: 'tornillo_gigante', ancho: 4, alto: 9, gancho: true },
  '<': { tipo: 'disparador' }, '>': { tipo: 'disparador' },
  // de la zona (dibujo/zona_lab.js): los aranazos del 17 y la luz del corazon que sube por las grietas
  '0': { tipo: 'aranazos' }, '1': { tipo: 'grieta_luz' },
};

// Las filas del laboratorio del nivel 1 (sus columnas 0-63, filas 5-26): la sala Estasis empieza igual
const ESTASIS = [
  '################################################################',
  '##      w     c     c     l      g     c    c           ########',
  '##                                                      ########',
  '##                                                c         ####',
  '##                                                          ####',
  '##                                                          ####',
  '##                                                            ##',
  '##                                                            ##',
  '##   j  j Dj  j                                               ##',
  '## ===============                                              ',
  '##                                                              ',
  '##                                                    i         ',
  '##  j  j  j  j  j                              ============     ',
  '## ===============                                              ',
  '##                                           ##                 ',
  '##                                           K#                 ',
  '##  j  j  j  j  j             n          ##  ##                 ',
  '## ===============        P              K#  K#                 ',
  '##                     #######      ##   ##  ##                 ',
  '##               E b s ####### N p  K#  EK#  K# q   C   u  F v  ',
  '################################################################',
  '################################################################',
];

let cache = null;
export function nivelZona() { return cache || (cache = construir()); }

function construir() {
  const g = Array.from({ length: ALTO }, () => Array(ANCHO).fill('#'));
  const ent = [];
  const notas = [];
  const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < ANCHO && y < ALTO) g[y][x] = c; };
  const rect = (x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(i, j, c); };
  const sala = (id) => SALAS.find((s) => s.id === id);
  // todo en casillas del MUNDO
  const aire = (x, y, w, h) => rect(x, y, w, h, ' ');
  const roca = (x, y, w, h) => rect(x, y, w, h, '#');
  const plat = (x, y, w) => rect(x, y, w, 1, '=');
  const vidrio = (x, y, w) => rect(x, y, w, 1, '^');
  const hunde = (x, y, w) => rect(x, y, w, 1, 'x');
  const cuerda = (x, y0, y1) => { for (let j = y0; j <= y1; j++) put(x, j, 'H'); };
  const nota = (x, y, n) => { put(x, y, 'N'); notas.push({ n, x, y }); };
  const cosa = (t, x, y, d = {}) => ent.push({ t, i: x, j: y, ...d });
  const hueco = (id) => { const s = sala(id); aire(s.x + 1, s.y + 1, s.w - 2, s.h - 2); return s; };

  // ---------------------------------------------------------------- 1 Estasis (el laboratorio del nivel 1)
  ESTASIS.forEach((f, j) => [...f].forEach((c, i) => put(i, 76 + j, c)));
  put(52, 95, ' ');                        // sin circulo de tiza: aqui los puntos de vuelta son los frascos
  roca(62, 82, 2, 11);                     // la pared de la derecha (el nivel 1 se abria a la caverna)
  put(62, 95, ' '); put(61, 95, 'v');
  plat(46, 82, 11);                        // la balda alta, bajo el agujero que sube a los frascos (doble salto)
  nota(31, 95, 1);
  cosa('mota', 51, 81);                    // en la balda alta: premio por volver con el doble salto
  // el archivo: la anilla en la trampilla del techo, que solo se alcanza con el gancho desde la balda de arriba;
  // trepando la linea hasta arriba se sube al suelo del archivo
  cosa('subir', 9, 76, { a: [11, 75] });

  // ---------------------------------------------------------------- 17 El archivo de Varga (secreta)
  hueco('archivo');
  put(12, 63, 'l');
  nota(15, 74, 9);
  cosa('mota', 4, 74);
  put(7, 74, 'n'); put(17, 74, 'p'); put(13, 74, 's'); put(2, 74, 'M');

  // ---------------------------------------------------------------- 2 Pasillo de servicio
  hueco('pasillo');
  roca(65, 96, 46, 2);                     // suelo (fila 96)
  // la celda del 17: barrotes a la izquierda, losa encima (por la que se anda) y pared a la derecha
  rect(79, 93, 1, 3, '%');
  roca(79, 91, 11, 2); roca(89, 93, 1, 3);
  cosa('mota', 83, 95);                    // lo que brilla tras los barrotes
  put(81, 95, '0');                        // los aranazos del 17
  // un cajon para subir a la losa
  put(76, 94, '#'); put(77, 94, '#'); put(76, 95, 'K'); put(77, 95, '#');
  // la parte de la derecha va alta (fila 91), con un suelo que se hunde sobre cristal
  roca(90, 91, 21, 5);
  aire(96, 91, 6, 4); hunde(96, 91, 6); vidrio(96, 95, 6);
  put(72, 79, '2'); put(100, 79, '2'); put(86, 79, 'i'); put(93, 79, '6'); put(106, 90, '7'); put(68, 95, '5'); put(108, 90, 'b');

  // ---------------------------------------------------------------- 14 El escondite del 17 (secreta)
  hueco('escondite');
  roca(77, 99, 6, 4); roca(95, 99, 8, 3); roca(77, 108, 3, 3);
  cuerda(85, 96, 110);                     // pegada al borde del agujero: arriba se sale al suelo de la celda
  cosa('falso', 85, 96, { w: 3, h: 2 });   // el suelo de la celda que cede
  cosa('fragmento', 99, 110);
  put(91, 107, '0'); put(97, 109, '0'); put(94, 110, '8');

  // ---------------------------------------------------------------- 3 El pozo del montacargas
  // Se entra por el FONDO (del pasillo) y se sube: el primer frasco de reserva esta abajo, frente a la esclusa
  // de la camara fria; Caen tornillos y la brecha salen a media altura y la nave, arriba, pide el doble salto
  hueco('pozo');
  roca(113, 75, 9, 2);                     // el rellano de Caen tornillos
  roca(131, 64, 12, 2);                    // el rellano de la brecha
  roca(113, 59, 12, 2); roca(113, 43, 9, 2);   // repisas de la pared en la subida
  cosa('frasco', 118, 90, { id: 'pozo' });
  // escalones del fondo a Caen tornillos y a la brecha, sin doble salto; de ahi arriba
  plat(125, 87, 7); plat(116, 83, 7); plat(125, 79, 6);
  plat(124, 71, 6); plat(126, 67, 4);
  plat(125, 62, 4);
  plat(127, 55, 7); plat(116, 51, 7); plat(126, 47, 7);
  plat(124, 39, 7); plat(114, 35, 7); plat(125, 31, 7); plat(120, 27, 14);
  put(116, 23, 'A'); put(138, 23, 'g'); put(129, 24, 'w'); put(122, 52, 'L'); put(140, 30, '6'); put(136, 90, 'v'); put(114, 90, 'b');
  put(137, 50, '7'); put(120, 72, 'L');

  // ---------------------------------------------------------------- 4 La sala de los frascos
  hueco('frascos');
  [23, 25, 27, 30, 32, 34, 37, 39, 41, 44, 46, 48, 55, 57, 59, 62, 64, 67].forEach((x) => put(x, 74, 'J'));
  nota(65, 74, 2);
  // la escalera de ADN sube a una balda con una mota
  roca(23, 60, 7, 1); for (let j = 60; j <= 74; j++) put(22, j, 'h');
  cosa('mota', 27, 59);
  put(30, 55, '2'); put(45, 55, '2'); put(60, 55, '2'); put(40, 55, '6'); put(55, 62, '7'); put(36, 55, 'c');

  // ---------------------------------------------------------------- 5 Caen tornillos
  hueco('tornillos');
  [75, 80, 86, 92, 98, 104].forEach((x) => put(x, 56, 't'));
  aire(84, 75, 12, 1); hunde(84, 75, 12); vidrio(84, 76, 12);
  plat(86, 71, 8);
  roca(99, 65, 7, 2);
  cosa('mota', 102, 64);
  put(78, 57, 'L'); put(100, 57, 'L'); put(90, 57, '6'); put(106, 62, '7'); put(73, 74, 'd'); put(108, 74, '4');

  // ---------------------------------------------------------------- 6 La nave de los tornillos gigantes
  hueco('nave');
  rect(101, 18, 1, 3, '%');                // los barrotes de la huida
  put(136, 20, 'U'); put(154, 20, 'W'); put(145, 20, 'T');
  put(110, 1, 'A'); put(172, 1, 'A'); put(120, 1, 'g'); put(115, 1, '2'); put(165, 1, '2'); put(182, 1, '2');
  put(141, 1, '6'); put(160, 1, '6'); put(130, 20, 'v'); put(176, 20, 'v'); put(106, 20, 'O'); put(186, 20, 'b');

  // ---------------------------------------------------------------- 18 Las vigas
  hueco('vigas');
  roca(191, 21, 8, 4);                     // el rellano de la nave
  roca(240, 18, 7, 7);                     // el rellano de los andamios
  plat(235, 22, 4);
  plat(199, 17, 6); plat(205, 14, 6); plat(213, 10, 8);
  put(216, 9, 'D');
  put(198, 1, 'A'); put(232, 1, 'A'); put(210, 1, '6'); put(228, 1, 'c');

  // ---------------------------------------------------------------- 11 Los andamios
  hueco('andamios');
  roca(249, 18, 8, 2);                     // el rellano de las vigas
  plat(255, 53, 7); plat(266, 49, 7); plat(255, 45, 7); plat(266, 41, 7); plat(274, 37, 7); plat(263, 33, 7);
  plat(252, 29, 7); plat(260, 25, 7); plat(252, 21, 7); plat(259, 14, 6); plat(270, 10, 7);
  cosa('mota', 275, 9);
  put(270, 7, 'w'); put(252, 7, 'A'); put(262, 7, '2'); put(278, 7, 'L'); put(279, 30, 'i');

  // ---------------------------------------------------------------- 10 La orilla
  hueco('orilla');
  roca(249, 80, 34, 3);                    // suelo (fila 80)
  cosa('hab', 253, 79, { h: 'doble' });
  plat(257, 76, 7); plat(266, 72, 7); plat(257, 68, 7); plat(261, 64, 8);
  put(270, 59, '2'); put(250, 79, 'r'); put(268, 79, 'E'); put(274, 79, 'm'); put(282, 70, '7');

  // ---------------------------------------------------------------- 7 El foso de cristal
  hueco('foso');
  roca(276, 92, 15, 19);                   // el rellano de la orilla
  roca(249, 108, 5, 3);                    // el rellano del corazon
  roca(257, 85, 17, 4);                    // las estalactitas: no dejan cruzarlo de un salto
  vidrio(254, 110, 22);
  [271, 264, 258].forEach((x) => put(x, 89, 'o'));
  cosa('mota', 251, 107);
  put(289, 91, 'm'); put(250, 107, '7');

  // ---------------------------------------------------------------- 12 El corazon de la anomalia
  hueco('corazon');
  roca(161, 108, 86, 3);                   // suelo (fila 108)
  rect(175, 93, 1, 15, '%');               // los barrotes: el teletransporte los cruza
  cuerda(166, 93, 107);
  cosa('gz', 186, 95, { w: 51, h: 12 });
  cosa('hab', 211, 100, { h: 'tele' });
  put(196, 99, 'f'); put(224, 103, 'f'); put(203, 104, 'f');
  put(195, 97, 'V'); put(229, 98, 'V'); put(170, 107, '8'); put(240, 107, '1');

  // ---------------------------------------------------------------- 13 La camara fria
  hueco('camara');                         // su suelo (fila 91) es el del fondo del pozo: la esclusa se pasa andando
  cosa('frasco', 178, 90, { id: 'camara' });
  cosa('palanca', 149, 90);
  cosa('esclusa', 143, 88, { w: 2, h: 3 });
  put(168, 69, '2'); put(158, 90, 'q'); put(186, 90, 'q'); put(171, 90, 'u'); put(155, 90, 'b');

  // ---------------------------------------------------------------- 8 La brecha
  hueco('brecha');
  roca(145, 64, 46, 3);                    // suelo (fila 64)
  plat(158, 60, 6); plat(166, 56, 6); plat(157, 52, 6);
  cosa('mota', 159, 51);
  put(160, 45, '2'); put(176, 63, 'r'); put(183, 63, 'v'); put(170, 63, 'm'); put(188, 55, '7'); put(150, 63, 'E');

  // ---------------------------------------------------------------- 9 La sima (gravedad cero)
  hueco('sima');
  roca(193, 64, 5, 21);                    // el borde de la brecha
  roca(241, 80, 6, 5);                     // el borde de la orilla
  cosa('gz', 199, 33, { w: 42, h: 50 });
  [[205, 45], [212, 60], [220, 40], [226, 70], [232, 52], [214, 76], [236, 64], [206, 68]].forEach(([x, y]) => put(x, y, 'f'));
  put(210, 38, 'V'); put(230, 58, 'V'); put(204, 72, 'V'); put(226, 27, 'Z'); put(214, 84, '1'); put(232, 84, '1');

  // ---------------------------------------------------------------- 15 La huida (los tornillos persiguen hacia el oeste)
  hueco('huida');
  roca(31, 19, 60, 3);                     // suelo (fila 19); el tramo de la nave queda en la 21
  aire(80, 19, 6, 2); vidrio(80, 21, 6);   // foso
  roca(72, 15, 4, 4);                      // pilar
  aire(60, 19, 10, 2); vidrio(60, 21, 10); hunde(60, 19, 10);   // suelo que se hunde
  aire(44, 19, 13, 2); vidrio(44, 21, 13); // foso ancho con anillas
  put(53, 12, 'o'); put(47, 12, 'o');
  roca(37, 16, 2, 3);
  put(93, 20, '<'); put(34, 18, '>');
  put(90, 5, '6'); put(70, 5, '2'); put(50, 5, '6'); put(38, 5, '2'); put(96, 20, 'v');

  // ---------------------------------------------------------------- 16 La rejilla (salida al Linde)
  hueco('rejilla');
  roca(1, 19, 28, 2);                      // suelo (fila 19)
  put(3, 18, 'S'); put(7, 18, 'R');
  nota(13, 18, 3);
  put(12, 3, '2'); put(22, 3, 'L'); put(18, 18, 'q');

  // ---------------------------------------------------------------- los pasos
  for (const p of PASOS) {
    aire(p.x, p.y, p.w, p.h);
    if (p.tabla !== undefined) plat(p.x, p.tabla, p.w);
    if (p.cuerda !== undefined) for (let j = p.y; j < p.y + p.h; j++) put(p.cuerda, j, 'H');
  }
  put(9, 76, 'o');                         // la anilla de la trampilla del archivo, en su hueco
  cuerda(277, 80, 91);                     // la cuerda del foso baja por el borde del hueco de la orilla hasta el rellano

  // el orden de las notas en el mapa (crearPartida las lee por filas)
  notas.sort((a, b) => a.y - b.y || a.x - b.x);
  return {
    id: 'lab', nombre: 'Ceniza Laboratory', zonaLab: true, zona: 'laboratorio', semilla: 1, intro: true, frasco18: true,
    titulo: { en: 'CENIZA LABORATORY', es: 'LABORATORIO CENIZA' }, sub: { en: 'Year 70', es: 'Año 70' },
    brechaX: 192 * 32, cascadaX: 226 * 32 + 16,
    notas: notas.map((q) => q.n),
    marcas: MARCAS,
    tornillos: { periodo: 1.9, aviso: 0.75, radio: 11 },
    persecucion: { desde: '<', hasta: '>', vel: 175, dir: -1 },
    trampa: { disparo: 'T', tornillos: ['U', 'W'], zona: [138, 153, 1, 21] },
    pistas: [
      { x: 30, y: 96, en: 'A / D  move  ·  SPACE  jump  ·  E  read', es: 'A / D  moverse  ·  ESPACIO  saltar  ·  E  leer' },
      { x: 118, y: 91, en: 'E at the jar  rest  ·  M  map', es: 'E en el frasco  descansar  ·  M  mapa' },
      { x: 196, y: 64, en: 'Inside you float. SPACE pushes you where you point (WASD)', es: 'Dentro se flota. ESPACIO te empuja hacia donde apuntes (WASD)' },
      { x: 145, y: 21, en: 'E  take the cargo line  ·  W / S  climb  ·  SPACE  let go', es: 'E  coger la línea de carga  ·  W / S  trepar  ·  ESPACIO  soltar' },
      { x: 272, y: 92, en: 'E near a ring  hook  ·  A / D while hanging  swing', es: 'E junto a una anilla  enganchar  ·  A / D colgado  balancearse' },
      { x: 9, y: 19, en: 'E  at the grate', es: 'E  en la rejilla' },
    ],
    mapa: g.map((f) => f.join('')),
    entidades: ent,
  };
}

// la sala de una casilla del mundo (o null si es roca entre salas)
export function salaEn(i, j) {
  for (const s of SALAS) if (i >= s.x && i < s.x + s.w && j >= s.y && j < s.y + s.h) return s;
  return null;
}
