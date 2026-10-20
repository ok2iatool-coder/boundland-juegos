// Las PAREDES con estratos del terreno (escarpe y cerros testigo) no hacen falta en el mundo: sus cortados (el farallon
// de los Picos, el Cortado de detras de la Base) salen de la rejilla. Esto deja la misma interfaz para el editor.
export function crearParedes() {
  return { rehacer() {}, info: () => ({}) };
}
export function crearLaguna() {
  return null;
}
