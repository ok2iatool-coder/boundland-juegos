// EL SOL del mapa del mundo, en un solo sitio (antes cada modulo copiaba su direccion): mundo.js pone con el la luz y
// las sombras, cielo.js el disco y las sierras, agua.js el brillo y muralla.js las fotos de la muralla lejana.
// 2026-10-21 («sube la calidad, sombras, pon el sol»): bajado de 43 a 22 grados y al oes-noroeste. A 43 grados quedaba
// por encima de lo que ve la camara y nunca salia en el cielo; ahora asoma al girar hacia el oeste y las sombras son largas.
import * as THREE from 'three';

export const DIR_SOL = new THREE.Vector3(-0.82, 0.38, -0.43).normalize();   // hacia el sol
export const COLOR_SOL = 0xffd9a0;                                          // de media tarde, algo mas calido
