// EL PASO A 3D POR EL BOSQUE (2026-10-21, sustituye al del conducto; pedido del usuario: «mientras va entrando, ves
// agregando arboles en primer plano, por delante del personaje, solo algunos, no muchos; arboles 3D, poco a poco, hasta
// que este todo verde y sea completamente 3D. Aparecera el primer muro de 4 metros de altura y a partir de ahi, el muro
// mas grande delante»). Las cotas que comparten el 2D (bosque/plano2d.js) y el 3D (bosque/arboles3d.js, bosque/main.js).
//
// El sitio es el de la escena del MURO EXTERIOR (muro4/mundo.js): el muro corre a lo largo de x por z = 0 y fuera es -z.
// El 18 llega por el bosque andando hacia +z, por la carretera vieja (x = CAMINO_X), hasta el caballon del foso.
// En el 2D la camara mira de lado (desde -x hacia +x): la derecha de la pantalla es +z, asi que la x del 2D es la z del
// mundo y la y del 2D es la altura. El suelo del bosque es el del muro (muro4.suelo) con la cuesta del campo cortada a
// partir de Z_LLANO (mas alla del trozo fino del muro el suelo de lejos esta mas bajo): llano en todo el tramo 2D.
export const B = {
  VISTA_H: 9,                 // alto visible del 2D (el del juego: 576 u a 64 u/m)
  CAMINO_X: -1.5,             // por donde anda (el carril izquierdo de la carretera: el coche quemado ocupa el derecho)
  Z_LLANO: -84,               // de aqui hacia fuera el suelo no baja mas
  Z0: -134,                   // donde empieza (2D, andando por el bosque)
  // los arboles 3D de DELANTE (entre la camara y el 18): pocos, cada vez mas seguidos
  DELANTE0: -119, DELANTE1: -96.5,
  // los de DETRAS y alrededor: desde aqui, y todo se va poniendo verde
  DETRAS0: -103,
  // el 2D se va (el 3D ya lo tapa casi todo) entre MEZCLA0 y MEZCLA1
  MEZCLA0: -97, MEZCLA1: -91,
  // el cambio: el 18 pasa al .glb y la camara va del lateral a detras de el entre CAMBIO y GIRO1 (por lo que avanza)
  CAMBIO: -91, GIRO1: -78,
  // EL PASO, DIRECTO (2026-10-21, tercera version; pedido: «la transformacion debe ser directa, como en el del conducto:
  // mientras vas avanzando, la camara se va moviendo, fallos en la realidad, y el personaje pasa de 2D a 3D no del tiron,
  // sino mientras la transicion»). Todo va atado a lo que AVANZA el 18 (si se para, se para todo). La camara, entre CAMBIO
  // y GIRO1, en dos tiempos que se solapan: el ZOOM (g de 0 a zoom: de lado, el teleobjetivo de 2 grados se abre a fovO y
  // se acerca a R0 m del 18; el dibujo plano coge profundidad) y la ORBITA (g de orbita0 a 1: el cuarto de vuelta
  // alrededor del 18 hasta detras de el, cerrandose a R1 m y fov1). Con las dos en una sola curva el giro entero cabia en
  // dos fotogramas. (La version de antes, con un arbol de primer plano que tapaba el cambio, no gusto: no era directa)
  GIRO: { zoom: 0.5, orbita0: 0.4, fovO: 42, R0: 6.5, fov1: 50, R1: 3.4 },
  // EL 18 SE CONVIERTE POR BANDAS entre estos dos momentos del giro: tiras horizontales de la pantalla que pasan del
  // dibujo al .glb, cada vez mas, parpadeando en el borde; a la vez el .glb se infla de canto a su grosor
  PASO18: [0.08, 0.86],
  // LOS FALLOS DE LA REALIDAD (la vista rayada del conducto: bandas que se corren, colores separados, hilos, el otro
  // mundo que asoma por tiras), en rafagas puestas a lo largo del camino entre z0 y z1, mas fuertes cerca del pico
  FALLOS: { z0: -104, z1: -79, pico: -90 },
  // EL MURO EN EL BOSQUE (pedido: «que el muro este entre el bosque, casi al final del bosque»): los arboles llegan hasta
  // el foso (BOSQUE1) y al otro lado del muro quedan unos pocos (DENTRO, fuera del eje de la carretera, para que se vea
  // el muro grande); de ahi al muro grande, campo abierto
  BOSQUE1: -8,
  DENTRO: { z0: 9, z1: 90 },
  LLEGADA: -17,               // ya delante del muro: se para y mira; la camara se abre al muro y al muro grande
  TOPE_Z: -7.4,               // hasta aqui se anda (el caballon del foso: no se salta el muro)
  // la camara 2D y la 3D que la casa
  FOV0: 2, FOV1: 52, H1: 2.4, PITCH1: 0.12,
  ALTO_CAM: 2.6,              // la camara 2D, tanto por encima del suelo (el suelo queda a una quinta parte de abajo)
  V2D: 1.8,                   // andando, la del 18 en 3D (heroe.js: lo que pide su ciclo sin patinar)
  V2D_CORRE: 3.2,
};
