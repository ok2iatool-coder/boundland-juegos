// EL NIVEL: por donde anda el 18 y que hay en cada tramo. El primero es la imagen de referencia tal cual (medida en
// sus pixeles: escena.js); los demas siguen su direccion de arte con lo que una ciudad industrial lleva de suyo.
// Las capas de fondo se generan solo en lo que llega a verse: con paralaje f, la camara que recorre [a, b] ve de la
// capa el tramo [CAM0.x (1 - f) + a f, CAM0.x (1 - f) + b f] mas media vista a cada lado.
export const NIVEL = { x0: -11, x1: 160 };
export const TRAMOS = [
  { tipo: 'referencia', x0: -22, x1: 14, nombre: 'La ventana redonda' },
  { tipo: 'planta', x0: 14, x1: 34, nombre: 'Los depositos' },
  { tipo: 'marco', x0: 34, x1: 54, nombre: 'El bloque de los balcones' },
  { tipo: 'ruina', x0: 54, x1: 73, nombre: 'El derrumbe' },
  { tipo: 'pasarela', x0: 73, x1: 96, nombre: 'La pasarela cubierta' },
  { tipo: 'patio', x0: 96, x1: 116, nombre: 'El patio de carga' },
  { tipo: 'nave', x0: 116, x1: 142, nombre: 'La nave' },
  { tipo: 'puerta', x0: 142, x1: 178, nombre: 'La puerta' },
];
export const VISTA_MEDIA = 12.5;          // media vista con margen (u), para pantallas de hasta 21:9
export function rangoCapa(f, cam0x) {
  const a = cam0x * (1 - f) + (NIVEL.x0 + cam0x) * f, b = cam0x * (1 - f) + (NIVEL.x1 + cam0x) * f;
  return [Math.min(a, b) - VISTA_MEDIA, Math.max(a, b) + VISTA_MEDIA];
}
