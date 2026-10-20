// Todo en unidades del mundo (u) y segundos. 1 casilla = T = 32 u = medio metro: el Sujeto 18 mide
// 1 m (dos casillas). La vista es de 32 x 18 casillas (16 x 9 m), la del Caballero en Hollow Knight.
export const T = 32;
export const DT = 1 / 60;
export const VISTA = { w: 1024, h: 576 };
export const U_POR_M = 64;

// El 18. Salto sencillo: 880^2 / (2*2400) = 161 u (5 casillas); doble: +102 u (8 en total). Corre a
// 370 u/s (5,8 m/s). Gravedad alta para que el salto sea rapido y nitido, no flotante. Sin inercia en
// el suelo: se para y arranca en seco, que es lo que da precision al plataformeo.
export const J = {
  ancho: 22, alto: 50,
  vel: 370, velZorro: 460,
  salto: 880, doble: 700, saltoZorro: 940,
  grav: 2400, gravCaida: 3000, caidaMax: 900, corte: 0.35,
  coyote: 0.1, buffer: 0.13,
  // andar: arranca ya a media velocidad y llega a la entera en unos 3 fotogramas; frena en 3 y en el aire
  // algo menos, para que el salto lleve inercia sin perder el control; dar la vuelta en el suelo es seco
  arranque: 0.55, acel: 5200, frena: 7000, giro: 9000, acelAire: 4200, frenaAire: 2600,
  // cumbre del salto: mientras se mantiene, la gravedad baja a la mitad cerca del punto mas alto (tiempo
  // para apuntar el aterrizaje); y si la cabeza roza una esquina, se le aparta hasta 9 u
  cumbreV: 150, cumbreG: 0.5, esquina: 9,
  // daga
  ataqueT: 0.24, ataqueActivo: 0.1, ataqueCd: 0.3, alcance: 62, pogo: 640, retroceso: 210, retrocesoT: 0.08,
  // combo: memoria de pulsacion, el golpe que acierta acorta la espera, tres tajos seguidos y el tercero
  // remata (mas alcance y empujon); en el aire un tajo de lado frena la caida (dos por salto); racha de
  // aciertos que se pierde a los 2,5 s sin acertar o al recibir dano
  ataqueBuf: 0.18, ataqueCdGolpe: 0.19, comboVentana: 0.5, remataAlcance: 16, remataEmpuje: 1.8,
  frenoAire: 40, aereos: 2, rachaT: 2.5,
  // RITMO del combo (2026-10-18, tools/medir_combate.mjs): el remate se prepara 4 fotogramas (se echa atras
  // y sale disparado `embateVel` durante `embateT`, si hay suelo delante) y deja una espera mas larga, asi
  // que el combo suena ta-ta--TAM y no ta-ta-ta. Contra el cristal del escarabajo la daga REBOTA: el 18
  // sale despedido `rebotaVel` durante `rebotaT`. Lo que tarda en volver a moverse la hormiga golpeada.
  remataAnticipa: 0.066, remataCd: 0.42, embateVel: 300, embateT: 0.07, rebotaVel: 320, rebotaT: 0.12,
  hormigaAturde: 0.34,
  // la memoria del tajo pasa de 0,18 a 0,24 s: con 0,18 no cubria la espera tras un acierto (0,19 s) y la
  // pulsacion hecha justo despues de pegar SE PERDIA (medido)
  ataqueBufLargo: 0.24,
  // combate mejorado. DESVIO: un tajo que coincide con un proyectil lo devuelve (mas rapido y contra los
  // enemigos) y con el golpe de un enemigo lo para: el enemigo queda aturdido y el 18 sale empujado.
  // POSTURA: cada golpe gasta aguante (el remate 2, la estocada 3, el desvio todo); a cero, aturdido
  // `aturdeT` s y recibe un punto mas de dano. ESTOCADA: mantener la daga `estocadaCarga` s y soltar.
  // ESENCIA: cada acierto da 1 (el desvio 2), hasta `esenciaMax`; mantener curar `curaT` s quieto gasta
  // `curaCoste` y devuelve una dosis
  desvioEmpuje: 300, desvioT: 0.14, devueltoVel: 1.7, devueltoDano: 2,
  aturdeT: 1.3, aturdeJefeT: 1.7,
  estocadaCarga: 0.5, estocadaVel: 720, estocadaT: 0.2, estocadaDano: 3,
  esenciaMax: 6, curaCoste: 3, curaT: 0.9,
  // dano
  vida: 7, invul: 1.25, golpeVx: 300, golpeVy: 420, golpeT: 0.2,
  // trepar
  trepar: 170,
  // gancho
  ganchoAlcance: 270, ganchoMin: 44, ganchoMax: 270, ganchoCuerda: 150, ganchoBombeo: 900, ganchoSuelta: 420,
  // teletransporte (doble pulsacion de direccion)
  teleDist: 120, teleCd: 0.55, teleVentana: 0.24, teleT: 0.12,
  // gravedad cero (GDD: se flota y sube despacio; el salto empuja en vez de elevar)
  gzSube: 140, gzMaxSube: 80, gzEmpuje: 400, gzEspera: 0.28, gzAcel: 520, gzRoce: 1.6,
  // solo dibujo: lo que duran las hojas `empuje` (12 a 20 fps) y `flotar_entra` (8 a 12 fps), y desde que
  // velocidad un choque dentro de la zona se nota (aplasta y suelta luz)
  gzEmpujeT: 0.6, gzEntraT: 0.66, gzChoqueV: 110,
  // lanzar
  cogerDist: 46, lanzarVel: 900, lanzarGrav: 700,
  // forma zorro y Sunikel (mantener ataque en forma zorro)
  sunikelCarga: 0.45, sunikelVel: 900, sunikelT: 0.22, sunikelDano: 4, zarpaDano: 2,
};

export const VEL_CAIDA_PELIGRO = 40; // u bajo el mapa = caida al vacio
