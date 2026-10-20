// DATOS del primer trozo jugable (la puerta sur de la Base, extramuros y un pedazo de la Cuenca). Puro: sin three
// ni DOM, lo leen el juego y `node boundland-bosque3d/test_trozo.mjs`. Cifras de partida del documento de diseno
// (https://claude.ai/artifact/MsbdcpFugbutbwjfwFoY6s), escaladas a un trozo de 40 minutos.

// ---------------- el tiempo ----------------
// un dia de juego son 30 minutos reales: 48 minutos de juego por minuto real
export const MIN_JUEGO_POR_SEG = 0.8;
export const DIA = 24 * 60;                    // minutos de juego
export const HORA_INICIO = 8 * 60;             // la partida empieza el dia 1 a las 8:00

// ---------------- lo que hay ----------------
// precio base en vales; `ciudad`: la Base lleva su almacen (consumo y produccion por hora de juego, y con cuanto
// empieza respecto a lo deseado: 5 dias de consumo)
export const OBJETOS = {
  piedra:   { nombre: 'Piedra',   plural: 'piedras',   base: 4,  ciudad: { consumo: 0.25, prod: 0.25, empieza: 0.4 } },
  madera:   { nombre: 'Madera',   plural: 'maderas',   base: 2,  ciudad: { consumo: 0.75, prod: 0.75, empieza: 1 } },
  fibra:    { nombre: 'Fibra',    plural: 'fibras',    base: 1,  ciudad: { consumo: 0.5,  prod: 0.5,  empieza: 1 } },
  arcilla:  { nombre: 'Arcilla',  plural: 'arcillas',  base: 2,  ciudad: { consumo: 0.2,  prod: 0.2,  empieza: 1 } },
  hierbas:  { nombre: 'Hierbas',  plural: 'hierbas',   base: 2,  ciudad: { consumo: 0.3,  prod: 0.25, empieza: 0.4 } },
  agua:     { nombre: 'Agua',     plural: 'cubos de agua', base: 1, ciudad: { consumo: 10, prod: 9.2, empieza: 0.42 } },
  tablon:   { nombre: 'Tablón',   plural: 'tablones',  base: 6,  ciudad: { consumo: 0.33, prod: 0.33, empieza: 1 } },
  cuerda:   { nombre: 'Cuerda',   plural: 'cuerdas',   base: 4,  ciudad: { consumo: 0.1,  prod: 0.1,  empieza: 1 } },
  vendas:   { nombre: 'Vendas',   plural: 'vendas',    base: 8,  ciudad: { consumo: 0.15, prod: 0.08, empieza: 0.3 } },
  // herramientas y equipo: precio fijo en la tienda (se fabrican mas baratas)
  hacha:    { nombre: 'Hacha de piedra', base: 25, herramienta: 'madera' },
  pico:     { nombre: 'Pico de piedra',  base: 30, herramienta: 'piedra' },
  cubo:     { nombre: 'Cubo',            base: 20, herramienta: 'agua' },
  mochila:  { nombre: 'Mochila de tela', base: 60, equipo: true },
  antorcha: { nombre: 'Antorcha',        base: 6 },
  nota_varga: { nombre: 'Nota de Varga', base: 0, unica: true },
  dibujo_lia: { nombre: 'Dibujo de Lía', base: 0, unica: true },
};
export const DIAS_RESERVA = 5;
export const POBLACION = 120;

// lo que cuesta recoger una unidad (segundos reales) a mano y con su herramienta, y lo que da cada sitio
export const RECURSOS = {
  roca:    { da: 'piedra',  seg: 3.0, segHerr: 1.2, herramienta: 'pico',  cantidad: 4, vuelve: 6 * 60, verbo: 'Picar' },
  arbol:   { da: 'madera',  seg: 3.5, segHerr: 1.3, herramienta: 'hacha', cantidad: 5, vuelve: 8 * 60, verbo: 'Cortar' },
  tronco:  { da: 'madera',  seg: 2.5, segHerr: 1.0, herramienta: 'hacha', cantidad: 2, vuelve: 10 * 60, verbo: 'Partir' },
  juncos:  { da: 'fibra',   seg: 1.2, segHerr: 1.2, cantidad: 4, vuelve: 4 * 60, verbo: 'Arrancar' },
  flores:  { da: 'hierbas', seg: 1.5, segHerr: 1.5, cantidad: 3, vuelve: 5 * 60, verbo: 'Coger' },
  barro:   { da: 'arcilla', seg: 2.0, segHerr: 2.0, cantidad: 3, vuelve: 5 * 60, verbo: 'Sacar' },
  agua:    { da: 'agua',    seg: 1.0, segHerr: 1.0, herramienta: 'cubo', necesita: 'cubo', cantidad: 99, vuelve: 0, verbo: 'Llenar' },
};

// ---------------- recetas (8, de nivel 1 y 2) ----------------
// mesa: 'banco' (el banco de trabajo de extramuros o el de la herreria) o 'carpinteria'
export const RECETAS = [
  { id: 'cuerda',   da: 'cuerda',   n: 1, pide: { fibra: 3 },                         mesa: 'banco',       seg: 2, conocida: true },
  { id: 'tablon',   da: 'tablon',   n: 1, pide: { madera: 2 },                        mesa: 'carpinteria', seg: 2, conocida: true },
  { id: 'hacha',    da: 'hacha',    n: 1, pide: { madera: 1, piedra: 2, cuerda: 1 },  mesa: 'banco',       seg: 4, aprende: 'herrera' },
  { id: 'pico',     da: 'pico',     n: 1, pide: { madera: 1, piedra: 3, cuerda: 1 },  mesa: 'banco',       seg: 4, aprende: 'herrera' },
  { id: 'cubo',     da: 'cubo',     n: 1, pide: { tablon: 3, cuerda: 1 },             mesa: 'carpinteria', seg: 4, aprende: 'herrera' },
  { id: 'vendas',   da: 'vendas',   n: 2, pide: { fibra: 2, hierbas: 1 },             mesa: 'banco',       seg: 3, aprende: 'curandera' },
  { id: 'mochila',  da: 'mochila',  n: 1, pide: { fibra: 6, cuerda: 2 },              mesa: 'banco',       seg: 5, aprende: 'comerciante' },
  { id: 'antorcha', da: 'antorcha', n: 2, pide: { madera: 1, fibra: 2 },              mesa: 'banco',       seg: 2, conocida: true },
];

export const MOCHILA = { base: 40, conMochila: 80 };      // unidades que caben
export const LITERA = 5;                                  // vales por noche
export const VALES_INICIO = 0;

// ---------------- la obra: el segundo pozo ----------------
export const OBRA_POZO = {
  id: 'pozo2', nombre: 'Segundo pozo',
  pide: { piedra: 30, tablon: 12, cuerda: 4 }, vales: 250,
  horasObra: 2,                     // horas de juego que tarda en levantarse con todo puesto
  agua: 8.3,                        // cubos por hora que anade a la Base
  llegan: 4,                        // refugiados que entran al dia siguiente
};

// ---------------- la gente ----------------
// horario: [desde, hasta, sitio] en horas de juego; el sitio lo coloca el mapa (mapa.js). Fuera de horario
// duermen y no se les puede hablar. Ramiro no duerme: de noche guarda la puerta desde dentro, con un farol.
export const PERSONAS = {
  ramiro:   { nombre: 'Ramiro', oficio: 'guardia de la puerta', horario: [[6, 22, 'puerta'], [22, 30, 'puerta_noche']], siempre: true },
  elena:    { nombre: 'Elena Sáez', oficio: 'la Intendente', horario: [[8, 14, 'intendencia'], [14, 15, 'plaza'], [15, 20, 'intendencia'], [20, 22, 'hoguera'], [22, 32, 'casa_elena']] },
  nieves:   { nombre: 'Nieves', oficio: 'la herrera', horario: [[7, 19, 'herreria'], [19, 22, 'hoguera'], [22, 31, 'casa_nieves']] },
  amparo:   { nombre: 'Amparo', oficio: 'la curandera', horario: [[8, 20, 'enfermeria'], [20, 32, 'casa_amparo']] },
  tobias:   { nombre: 'Tobías', oficio: 'comerciante de materiales', horario: [[8, 20, 'puesto'], [20, 22, 'hoguera'], [22, 32, 'casa_tobias']] },
  lia:      { nombre: 'Lía', oficio: 'una niña refugiada', horario: [[7, 12, 'huerta'], [12, 18, 'arroyo'], [18, 21, 'fuego_fuera'], [21, 31, 'tienda_lia']] },
};
