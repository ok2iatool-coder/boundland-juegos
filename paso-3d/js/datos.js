// Las cotas que comparten el 2D y el 3D, en metros (x a la derecha, y arriba; el plano del 2D es z = 0 y la
// camara 2D mira hacia -z). Lo que dibuja el lienzo y lo que construye three.js salen de aqui: el cambio cae en el
// mismo sitio de la pantalla porque los dos lo leen de la misma tabla.
export const D = {
  VISTA_H: 9,                       // alto visible del 2D (VISTA.h del juego: 576 u a 64 u/m)
  // la sala donde cae (dentro del muro): suelo en y = 0
  SALA: { x0: -9, x1: 0, techo: 5.5 },
  // el pozo por el que ha caido, encima de la sala
  POZO: { x0: -6.1, x1: -4.3, alto: 40 },
  CAE_X: -5.2,
  // el conducto: atraviesa el muro hacia +x
  CONDUCTO: { x0: 0, x1: 18, alto: 1.8, ancho: 1.6 },
  // el paso: oscurece de oscuro0 a oscuro1; desde `flashes` el 3D asoma en las rayas; en `x` se cambia; de `x` a
  // `giro1` la camara pasa del lateral al de detras (avanza con el 18, no con el reloj)
  PASO: { oscuro0: -0.8, oscuro1: 2.4, flashes: 1.0, x: 3.0, giro1: 10.0 },
  // el teleobjetivo con el que el 3D se ve como el 2D, y la camara de tercera persona en la que acaba
  FOV0: 2, FOV1: 52, H1: 2.4, PITCH1: 0.12,
  // el 18 en el 2D (el juego corre a 5,8 m/s; recien caido y mareado, aqui algo menos) y en el 3D (heroe.js)
  V2D: 3.4, V2D_CORRE: 5.2, V_CONDUCTO: 1.8,
  // fuera: el muro por fuera es el plano x = 18
  MURO_X: 18,
  // el muro mide 40 m: la base esta a unos 35 m del suelo (lo dijo el usuario), asi que el suelo queda en -35 y la
  // coronacion 5 m por encima de las pasarelas
  SUELO_Y: -35, TOPE_Y: 5,
  PARED_X: 62,                      // la pared de relleno donde ira la ciudad
};
