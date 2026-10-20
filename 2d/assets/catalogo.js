// Los 50 assets de los primeros mapas (laboratorio en ruinas, niveles 1-5): hierro oxidado y remachado,
// cadenas y ganchos, frascos de estasis numerados, cajas con el rombo, luz calida de las lamparas contra el
// azul frio de la anomalia, papeles de Varga. Cada uno se dibuja en su caja (0..w, 0..h) en unidades del
// mundo; `ancla` dice donde se apoya: suelo (abajo al centro), techo (arriba al centro), pared o libre.
import { hash, azar } from '../dibujo/tinta.js';
import {
  P, TINTA, camino, tembloroso, rect, rectRedondo, tinta, metal, madera, vidrio, brillo, sombraSuelo,
  cadena, remache, remaches, manchasOxido, aranazos, grano, texto, rgba, mezcla,
} from './pintura.js';

const A = [];
const def = (id, grupo, es, en, w, h, ancla, dibujar) => A.push({ id, grupo, es, en, w, h, ancla, dibujar });

// ======================================================================== estructura
def('plataforma_chapa', 'estructura', 'Plataforma de chapa remachada', 'Riveted plate platform', 128, 26, 'libre', (c) => {
  metal(c, () => camino(c, tembloroso(rect(2, 4, 124, 16), 0.5, 10, 3)), [2, 4, 124, 16], { semilla: 3, oxido: 0.6 });
  remaches(c, 8, 9, 120, 9, 14, 1.4);
  // mensulas debajo
  for (const x of [16, 104]) metal(c, () => camino(c, [[x, 20], [x + 8, 20], [x + 4, 26]]), [x, 20, 8, 6], { semilla: x, oxido: 0.8, brilloBorde: 0 });
});
def('viga_doble_t', 'estructura', 'Viga de doble T oxidada', 'Rusted I-beam', 160, 24, 'libre', (c) => {
  const f = () => camino(c, [[0, 2], [160, 2], [160, 7], [152, 7], [152, 17], [160, 17], [160, 22], [0, 22], [0, 17], [8, 17], [8, 7], [0, 7]]);
  metal(c, f, [0, 2, 160, 20], { semilla: 5, oxido: 1 });
  for (let x = 24; x < 150; x += 26) { c.fillStyle = 'rgba(0,0,0,.55)'; c.beginPath(); c.ellipse(x, 12, 4, 3, 0, 0, 7); c.fill(); }
  remaches(c, 4, 4.5, 156, 4.5, 10, 1.1); remaches(c, 4, 19.5, 156, 19.5, 10, 1.1);
});
def('pasarela_rejilla', 'estructura', 'Pasarela de rejilla con barandilla', 'Grated catwalk with rail', 160, 64, 'libre', (c) => {
  // barandilla
  for (const x of [6, 56, 106, 154]) metal(c, () => camino(c, rect(x - 2, 10, 4, 42)), [x - 2, 10, 4, 42], { semilla: x, oxido: 0.7, brilloBorde: 0.3 });
  metal(c, () => camino(c, rect(2, 8, 156, 4)), [2, 8, 156, 4], { semilla: 2, oxido: 0.6 });
  metal(c, () => camino(c, rect(2, 28, 156, 3)), [2, 28, 156, 3], { semilla: 4, oxido: 0.6, brilloBorde: 0.2 });
  // piso de rejilla
  metal(c, () => camino(c, rect(0, 50, 160, 10)), [0, 50, 160, 10], { semilla: 7, oxido: 0.5 });
  c.save(); c.beginPath(); c.rect(2, 52, 156, 6); c.clip();
  c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 1.2;
  for (let x = -10; x < 170; x += 5) { c.beginPath(); c.moveTo(x, 52); c.lineTo(x + 6, 58); c.stroke(); }
  c.restore();
  // cadena rota colgando
  cadena(c, 130, 60, 136, 64 + 0, 4, 1, 3);
});
def('muro_bloques', 'estructura', 'Muro de bloques agrietado', 'Cracked block wall', 128, 96, 'suelo', (c) => {
  const r = azar(11);
  for (let fila = 0; fila < 6; fila++) for (let k = -1; k < 5; k++) {
    const x = k * 32 + (fila % 2) * 16, y = 96 - (fila + 1) * 16;
    if (x + 32 < 0 || x > 128) continue;
    const xx = Math.max(0, x), ww = Math.min(128, x + 32) - xx;
    if (fila >= 4 && r() < 0.35) continue;      // bloques caidos arriba
    const sem = fila * 9 + k + 20;
    c.save();
    metal(c, () => camino(c, tembloroso(rect(xx + 0.5, y + 0.5, ww - 1, 15), 0.6, 6, sem)), [xx, y, ww, 16], { base: mezcla(P.hormigon, '#000000', r() * 0.3), oxido: 0.15, semilla: sem, brilloBorde: 0.15, tintaG: 1.3 });
    c.restore();
  }
  c.strokeStyle = TINTA; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(70, 30); c.lineTo(62, 46); c.lineTo(68, 58); c.lineTo(58, 74); c.stroke();
});
def('columna_hierro', 'estructura', 'Columna de hierro remachada', 'Riveted iron column', 36, 192, 'suelo', (c) => {
  metal(c, () => camino(c, rect(8, 14, 20, 166)), [8, 14, 20, 166], { semilla: 13, oxido: 0.8, cilindro: 'v' });
  metal(c, () => camino(c, rect(2, 2, 32, 14)), [2, 2, 32, 14], { semilla: 14, oxido: 0.6 });
  metal(c, () => camino(c, rect(2, 178, 32, 14)), [2, 178, 32, 14], { semilla: 15, oxido: 0.7 });
  remaches(c, 11, 20, 11, 174, 12, 1); remaches(c, 25, 20, 25, 174, 12, 1);
});
def('escalera_mano', 'estructura', 'Escalera de mano metálica', 'Metal ladder', 36, 160, 'suelo', (c) => {
  for (const x of [4, 28]) metal(c, () => camino(c, rect(x, 0, 4, 160)), [x, 0, 4, 160], { semilla: x, oxido: 0.9, brilloBorde: 0.3, cilindro: 'v' });
  for (let y = 12; y < 156; y += 16) metal(c, () => camino(c, rect(6, y, 24, 3)), [6, y, 24, 3], { semilla: y, oxido: 0.6, brilloBorde: 0.2, tintaG: 1.2 });
});
def('tuberia_valvula', 'estructura', 'Tubería con válvula', 'Pipe with valve', 160, 48, 'libre', (c) => {
  metal(c, () => camino(c, rect(0, 18, 160, 16)), [0, 18, 160, 16], { semilla: 21, oxido: 0.7, base: '#55606a', cilindro: 'h' });
  for (const x of [30, 120]) metal(c, () => camino(c, rect(x - 4, 15, 8, 22)), [x - 4, 15, 8, 22], { semilla: x, oxido: 0.5, cilindro: 'h' });
  metal(c, () => camino(c, rect(74, 10, 14, 30)), [74, 10, 14, 30], { semilla: 22, base: P.laton, oxido: 0.4, luz: 'calida', cilindro: 'v' });
  // volante
  c.beginPath(); c.arc(81, 6, 7, 0, 7); c.lineWidth = 4.4; c.strokeStyle = TINTA; c.stroke(); c.lineWidth = 2.4; c.strokeStyle = '#8c3a2a'; c.stroke();
  c.lineWidth = 1.6; c.strokeStyle = TINTA; c.beginPath(); c.moveTo(74, 6); c.lineTo(88, 6); c.moveTo(81, -1); c.lineTo(81, 13); c.stroke();
  // goteo
  c.fillStyle = 'rgba(170,205,230,.7)'; c.beginPath(); c.ellipse(121, 41, 1.4, 2.4, 0, 0, 7); c.fill();
});
def('tuberia_codo', 'estructura', 'Tubería vertical con codo', 'Vertical pipe with elbow', 64, 160, 'techo', (c) => {
  const f = () => { c.beginPath(); c.moveTo(14, 0); c.lineTo(14, 120); c.quadraticCurveTo(14, 146, 40, 146); c.lineTo(64, 146); c.lineTo(64, 130); c.lineTo(40, 130); c.quadraticCurveTo(30, 130, 30, 120); c.lineTo(30, 0); c.closePath(); };
  metal(c, f, [14, 0, 50, 146], { semilla: 25, oxido: 0.8, base: '#53606b', cilindro: 'v' });
  for (const y of [30, 90]) metal(c, () => camino(c, rect(10, y, 24, 7)), [10, y, 24, 7], { semilla: y, oxido: 0.5 });
  remaches(c, 12, 33.5, 32, 33.5, 6.6, 0.9); remaches(c, 12, 93.5, 32, 93.5, 6.6, 0.9);
});
def('rejilla_ventilacion', 'estructura', 'Rejilla de ventilación', 'Ventilation grate', 64, 96, 'pared', (c) => {
  metal(c, () => camino(c, rect(2, 2, 60, 92)), [2, 2, 60, 92], { semilla: 31, oxido: 0.5, base: '#3c444c' });
  c.fillStyle = '#07090b'; c.fillRect(8, 8, 48, 80);
  for (let y = 12; y < 86; y += 8) metal(c, () => camino(c, [[8, y], [56, y], [56, y + 4], [8, y + 6]]), [8, y, 48, 6], { semilla: y, oxido: 0.4, brilloBorde: 0.4, tintaG: 1.1 });
  for (const [x, y] of [[6, 6], [58, 6], [6, 90], [58, 90]]) remache(c, x, y, 2);
});
def('compuerta', 'estructura', 'Compuerta blindada', 'Armoured hatch door', 96, 128, 'suelo', (c) => {
  metal(c, () => camino(c, rect(0, 0, 96, 128)), [0, 0, 96, 128], { semilla: 33, oxido: 0.6, base: '#3d454d' });
  metal(c, () => { c.beginPath(); c.roundRect(10, 10, 76, 118, [30, 30, 0, 0]); }, [10, 10, 76, 118], { semilla: 34, oxido: 0.7, base: '#4c555e' });
  // rueda de cierre
  c.beginPath(); c.arc(48, 60, 16, 0, 7); c.lineWidth = 5; c.strokeStyle = TINTA; c.stroke(); c.lineWidth = 3; c.strokeStyle = P.laton; c.stroke();
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; c.beginPath(); c.moveTo(48, 60); c.lineTo(48 + Math.cos(a) * 16, 60 + Math.sin(a) * 16); c.lineWidth = 2.4; c.strokeStyle = TINTA; c.stroke(); }
  c.beginPath(); c.arc(48, 60, 4, 0, 7); c.fillStyle = P.laton; c.fill(); tinta(c, 1.2);
  // franjas de aviso desgastadas
  c.save(); c.beginPath(); c.rect(14, 110, 68, 12); c.clip();
  for (let x = 6; x < 90; x += 12) { c.fillStyle = 'rgba(200,170,60,.55)'; c.beginPath(); c.moveTo(x, 122); c.lineTo(x + 6, 122); c.lineTo(x + 18, 110); c.lineTo(x + 12, 110); c.fill(); }
  c.restore();
  remaches(c, 4, 4, 92, 4, 11, 1.3); remaches(c, 4, 124, 92, 124, 11, 1.3);
  texto(c, '04', 48, 24, 9, 'rgba(220,210,190,.6)');
});

// ======================================================================== laboratorio
// sujeto: 0 vacio, 1 un hermano del 18 dormido (encogido, con su capucha), 2 un experimento fallido (deforme, con
// mas brazos de la cuenta), 3 uno que mira: de pie con las manos en el cristal (2026-10-20, pedido: «en las capsulas
// tiene que haber algun personaje de experimento mas encerrado»)
function sujetoDentro(c, tipo, sem, t = 0) {
  c.save(); c.beginPath(); c.rect(11, 40, 38, 69); c.clip();
  const sombra = 'rgba(10,14,16,.9)', canto = 'rgba(185,225,215,.5)';
  // el tubo que le da de comer, de la tapa al cuerpo
  c.strokeStyle = 'rgba(40,50,52,.7)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(30, 40); c.quadraticCurveTo(34 + hash(sem, 3) * 6, 52, 30, 64); c.stroke();
  c.fillStyle = sombra; c.strokeStyle = canto; c.lineWidth = 0.8;
  if (tipo === 1) {
    // encogido, de lado: la capucha con su pico, la espalda curva y las rodillas al pecho
    c.beginPath(); c.moveTo(22, 70); c.quadraticCurveTo(18, 58, 28, 54); c.lineTo(36, 46); c.lineTo(34, 56); c.quadraticCurveTo(42, 62, 40, 74);
    c.quadraticCurveTo(44, 90, 34, 98); c.quadraticCurveTo(24, 102, 20, 92); c.quadraticCurveTo(14, 82, 22, 70); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = 'rgba(120,150,145,.35)'; c.beginPath(); c.ellipse(28, 64, 4, 3, -0.3, 0, 7); c.fill();          // la cara, palida
  } else if (tipo === 2) {
    // deforme: un torso hinchado, la cabeza ladeada y cuatro brazos finos que flotan
    c.beginPath(); c.ellipse(30, 82, 10, 14, 0.2, 0, 7); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(26, 62, 7, 8, -0.4, 0, 7); c.fill(); c.stroke();
    c.strokeStyle = sombra; c.lineWidth = 2;
    for (const [a, l] of [[-2.5, 13], [-0.6, 12], [2.7, 11], [0.4, 14]]) { c.beginPath(); c.moveTo(30 + Math.cos(a) * 8, 78 + Math.sin(a) * 6); c.quadraticCurveTo(30 + Math.cos(a) * 14, 74 + Math.sin(a) * 12, 30 + Math.cos(a + 0.4) * l * 1.3, 78 + Math.sin(a + 0.4) * l); c.stroke(); }
    c.fillStyle = 'rgba(226,121,43,.35)'; c.beginPath(); c.arc(28, 82, 2, 0, 7); c.fill();                          // algo del hongo dentro
  } else {
    // de pie, pegado al cristal: las dos manos abiertas delante
    c.beginPath(); c.moveTo(24, 106); c.lineTo(26, 80); c.quadraticCurveTo(22, 70, 26, 62); c.lineTo(30, 50); c.lineTo(33, 60);
    c.quadraticCurveTo(38, 70, 34, 80); c.lineTo(36, 106); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = 'rgba(200,215,210,.28)';
    for (const [x, y] of [[17, 74], [42, 72]]) { c.beginPath(); c.ellipse(x, y, 3.5, 4.5, 0, 0, 7); c.fill(); for (let k = 0; k < 4; k++) c.fillRect(x - 3 + k * 2, y - 8, 1, 4); }
    c.fillStyle = 'rgba(210,235,230,.6)'; c.fillRect(27, 60, 1.6, 1.6); c.fillRect(31, 60, 1.6, 1.6);               // dos ojos que miran
  }
  c.restore();
}

function frasco(c, o = {}) {
  const { n = '', roto = false, abierto = false, brillar = false, sem = 1, sujeto = 0 } = o;
  // base y tapa de hierro
  if (brillar) brillo(c, 30, 70, 70, P.calida, 0.45);
  if (!roto) {
    vidrio(c, () => camino(c, rect(10, 18, 40, 92)), [10, 18, 40, 92], { semilla: sem, a: brillar ? 0.12 : 0.16, tinte: brillar ? 'rgba(255,220,170,' : P.vidrio });
    if (brillar) { brillo(c, 30, 60, 26, P.calidaFuerte, 0.35); }
    // liquido de estasis
    c.save(); c.beginPath(); c.rect(11, 40, 38, 69); c.clip();
    c.fillStyle = brillar ? 'rgba(255,220,160,.22)' : 'rgba(140,190,180,.16)'; c.fillRect(11, 40, 38, 69);
    if (sujeto && !abierto && !brillar) sujetoDentro(c, sujeto, sem);
    for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(16 + hash(k, sem) * 28, 50 + hash(k, sem + 1) * 54, 1 + hash(k, sem + 2) * 1.5, 0, 7); c.strokeStyle = 'rgba(230,245,255,.5)'; c.lineWidth = 0.6; c.stroke(); }
    c.restore();
    c.strokeStyle = 'rgba(230,245,255,.6)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(10, 40); c.lineTo(50, 40); c.stroke();
    if (abierto) {
      // puerta del frasco abierta hacia fuera, cristal limpio (abierto desde dentro)
      c.save(); c.translate(50, 22); c.rotate(0.85);
      vidrio(c, () => camino(c, rect(0, 0, 5, 80)), [0, 0, 5, 80], { semilla: sem + 3, a: 0.1 });
      c.restore();
    }
  } else {
    const r = azar(sem * 3);
    const pts = [[10, 110], [10, 70 - r() * 30], [18, 80 - r() * 20], [24, 60 - r() * 26], [32, 76 - r() * 20], [40, 54 - r() * 30], [50, 72 - r() * 20], [50, 110]];
    vidrio(c, () => camino(c, pts), [10, 30, 40, 80], { semilla: sem, a: 0.14 });
    c.fillStyle = 'rgba(30,40,40,.6)'; c.beginPath(); c.ellipse(30, 106, 16, 3, 0, 0, 7); c.fill();
  }
  metal(c, () => camino(c, rect(4, 106, 52, 14)), [4, 106, 52, 14], { semilla: sem + 5, oxido: 0.7, cilindro: 'v' });
  // CLAVADO A LA BASE (2026-10-20: en las baldas que se mecen parecia flotar): dos escuadras de chapa de la base del
  // frasco a lo que lo sostiene, con sus tornillos
  for (const x of [0, 52]) {
    metal(c, () => { c.beginPath(); c.moveTo(x, 112); c.lineTo(x + 8, 112); c.lineTo(x + 8, 134); c.lineTo(x, 134); c.closePath(); }, [x, 112, 8, 22], { semilla: sem + 11 + x, oxido: 0.85, brilloBorde: 0.15, tintaG: 1.2 });
    for (const y of [118, 129]) { c.fillStyle = '#20252b'; c.beginPath(); c.arc(x + 4, y, 1.6, 0, 7); c.fill(); c.fillStyle = 'rgba(200,205,210,.4)'; c.fillRect(x + 3.2, y - 0.4, 1.6, 0.8); }
  }
  if (!roto) {
    metal(c, () => camino(c, rect(6, 8, 48, 12)), [6, 8, 48, 12], { semilla: sem + 6, oxido: 0.7, cilindro: 'v' });
    for (let k = 0; k < 4; k++) metal(c, () => camino(c, rect(9 + k * 13, 0, 3, 9)), [9 + k * 13, 0, 3, 9], { semilla: sem + k, oxido: 0.9, brilloBorde: 0, tintaG: 1.1 });
  }
  remaches(c, 8, 113, 52, 113, 7, 1);
  if (n) {
    metal(c, () => camino(c, rect(20, 122, 20, 10)), [20, 122, 20, 10], { semilla: sem + 8, base: P.laton, oxido: 0.3, luz: 'calida', brilloBorde: 0.3, tintaG: 1.2 });
    texto(c, String(n), 30, 127.5, 7, TINTA);
  }
}
def('frasco_estasis', 'laboratorio', 'Frasco de estasis', 'Stasis jar', 60, 134, 'suelo', (c) => frasco(c, { n: 9, sem: 4 }));
def('frasco_brillante', 'laboratorio', 'Frasco que brilla', 'Glowing jar', 60, 134, 'suelo', (c) => frasco(c, { n: 18, brillar: true, sem: 6 }));
def('frasco_roto', 'laboratorio', 'Frasco roto', 'Broken jar', 60, 134, 'suelo', (c) => frasco(c, { n: 12, roto: true, sem: 8 }));
def('frasco_17', 'laboratorio', 'Frasco 17, abierto desde dentro', 'Jar 17, opened from inside', 72, 134, 'suelo', (c) => frasco(c, { n: 17, abierto: true, sem: 10 }));
def('estanteria_frascos', 'laboratorio', 'Estantería de frascos numerados', 'Shelf of numbered jars', 160, 176, 'suelo', (c) => {
  for (const x of [2, 152]) metal(c, () => camino(c, rect(x, 0, 6, 176)), [x, 0, 6, 176], { semilla: x + 40, oxido: 0.8, cilindro: 'v' });
  metal(c, () => camino(c, rect(0, 0, 160, 5)), [0, 0, 160, 5], { semilla: 44, oxido: 0.8 });
  for (const y of [84, 168]) metal(c, () => camino(c, rect(0, y, 160, 6)), [0, y, 160, 6], { semilla: y + 41, oxido: 0.7 });
  const r = azar(43);
  for (let fila = 0; fila < 2; fila++) for (let k = 0; k < 4; k++) {
    const x = 14 + k * 35, yb = fila === 0 ? 84 : 168;
    c.save(); c.translate(x, yb - 62); c.scale(0.45, 0.46);
    frasco(c, { n: 13 + k + fila * 4, roto: r() < 0.4, sem: 50 + k + fila * 7 });
    c.restore();
  }
  cadena(c, 40, 5, 42, 26, 4, 1, 4); cadena(c, 120, 5, 118, 34, 4, 1, 5);
});
def('mesa_laboratorio', 'laboratorio', 'Mesa de laboratorio', 'Lab bench', 160, 76, 'suelo', (c) => {
  sombraSuelo(c, 80, 75, 150);
  for (const x of [10, 142]) metal(c, () => camino(c, rect(x, 22, 8, 54)), [x, 22, 8, 54], { semilla: x + 60, oxido: 0.8 });
  metal(c, () => camino(c, rect(14, 52, 132, 4)), [14, 52, 132, 4], { semilla: 61, oxido: 0.6, brilloBorde: 0.2 });
  metal(c, () => camino(c, tembloroso(rect(0, 14, 160, 10), 0.4, 10, 62)), [0, 14, 160, 10], { semilla: 62, oxido: 0.5, base: '#4f5961' });
  matraz(c, 30, 14, 9, 'rgba(120,200,170,'); matraz(c, 54, 14, 6, 'rgba(200,140,90,'); probeta(c, 72, 14, 18);
  probeta(c, 80, 14, 14); probeta(c, 88, 14, 20);
  // papeles y lupa
  c.save(); c.translate(116, 12); c.rotate(-0.08); c.fillStyle = P.papel; c.fillRect(-14, -3, 28, 4); c.fillStyle = P.varga; c.fillRect(-14, -3, 28, 0.8); c.restore();
});
function matraz(c, x, yb, r, liq) {
  const f = () => { c.beginPath(); c.moveTo(x - 2.5, yb - r * 3.2); c.lineTo(x - 2.5, yb - r * 1.6); c.lineTo(x - r, yb); c.lineTo(x + r, yb); c.lineTo(x + 2.5, yb - r * 1.6); c.lineTo(x + 2.5, yb - r * 3.2); c.closePath(); };
  vidrio(c, f, [x - r, yb - r * 3.2, r * 2, r * 3.2], { a: 0.15, tintaG: 1.2 });
  c.save(); f(); c.clip(); c.fillStyle = liq + '.55)'; c.fillRect(x - r, yb - r * 0.9, r * 2, r); c.restore();
}
function probeta(c, x, yb, h) {
  vidrio(c, () => { c.beginPath(); c.roundRect(x - 2.5, yb - h, 5, h, [0, 0, 2.5, 2.5]); }, [x - 2.5, yb - h, 5, h], { a: 0.2, tintaG: 1 });
  c.fillStyle = 'rgba(160,190,120,.6)'; c.fillRect(x - 2, yb - h * 0.4, 4, h * 0.38);
}
def('carrito_instrumental', 'laboratorio', 'Carrito de instrumental', 'Instrument trolley', 80, 72, 'suelo', (c) => {
  sombraSuelo(c, 40, 71, 76);
  for (const x of [6, 70]) metal(c, () => camino(c, rect(x, 14, 4, 50)), [x, 14, 4, 50], { semilla: x + 70, oxido: 0.7, brilloBorde: 0.2 });
  metal(c, () => camino(c, rect(2, 10, 76, 6)), [2, 10, 76, 6], { semilla: 71, oxido: 0.5 });
  metal(c, () => camino(c, rect(4, 44, 72, 5)), [4, 44, 72, 5], { semilla: 72, oxido: 0.6 });
  for (const x of [10, 70]) { c.beginPath(); c.arc(x, 66, 5.5, 0, 7); c.fillStyle = '#1b1d20'; c.fill(); tinta(c, 1.6); remache(c, x, 66, 1.6); }
  matraz(c, 20, 10, 6, 'rgba(120,200,170,'); probeta(c, 36, 10, 14); probeta(c, 42, 10, 10);
  metal(c, () => camino(c, rect(52, 0, 18, 10)), [52, 0, 18, 10], { semilla: 74, oxido: 0.4, base: '#666d74' });
  c.strokeStyle = TINTA; c.lineWidth = 1.2; c.beginPath(); c.moveTo(14, 44); c.quadraticCurveTo(30, 30, 40, 44); c.stroke();
});
def('taburete', 'laboratorio', 'Taburete metálico', 'Metal stool', 40, 52, 'suelo', (c) => {
  sombraSuelo(c, 20, 51, 40);
  c.strokeStyle = TINTA; c.lineWidth = 3.6;
  for (const [a, b] of [[8, 4], [32, 36], [14, 14], [26, 26]]) { c.beginPath(); c.moveTo(20 + (a - 20) * 0.4, 12); c.lineTo(b, 52); c.stroke(); }
  c.strokeStyle = '#5c6168'; c.lineWidth = 1.8;
  for (const [a, b] of [[8, 4], [32, 36]]) { c.beginPath(); c.moveTo(20 + (a - 20) * 0.4, 12); c.lineTo(b, 52); c.stroke(); }
  metal(c, () => { c.beginPath(); c.ellipse(20, 9, 17, 5, 0, 0, 7); }, [3, 4, 34, 10], { semilla: 81, oxido: 0.8, base: '#5a3a28' });
  metal(c, () => camino(c, rect(8, 34, 24, 3)), [8, 34, 24, 3], { semilla: 82, oxido: 0.7, brilloBorde: 0, tintaG: 1.2 });
});
def('pizarra', 'laboratorio', 'Pizarra con fórmulas', 'Blackboard with formulas', 128, 88, 'pared', (c) => {
  madera(c, () => camino(c, rect(0, 0, 128, 88)), [0, 0, 128, 88], { semilla: 95 });
  c.save(); c.beginPath(); c.rect(6, 6, 116, 76); c.clip();
  const g = c.createLinearGradient(0, 6, 0, 82); g.addColorStop(0, '#2a3530'); g.addColorStop(1, '#18201c');
  c.fillStyle = g; c.fillRect(6, 6, 116, 76);
  grano(c, 6, 6, 116, 76, 0.25, 'overlay', 96, 8);
  c.fillStyle = 'rgba(225,230,225,.55)'; c.font = '7px "Ink Free", "Segoe Print", cursive'; c.textAlign = 'left';
  c.fillText('N(t) = N0 · e^(-t/τ)', 12, 20); c.fillText('Zone 412 h → 0 loss', 12, 32); c.fillText('18 ✓     17 ?', 12, 66);
  c.strokeStyle = 'rgba(225,230,225,.5)'; c.lineWidth = 0.8;
  c.beginPath(); c.arc(96, 30, 12, 0.3, 6.2); c.stroke(); c.beginPath(); c.arc(98, 31, 8, 0.6, 6.5); c.stroke();
  c.beginPath(); c.moveTo(12, 48); for (let x = 12; x < 80; x += 4) c.lineTo(x, 48 - Math.exp((x - 12) / 30) * 2); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(60, 40, 40, 14);
  c.restore();
  metal(c, () => camino(c, rect(10, 82, 108, 4)), [10, 82, 108, 4], { semilla: 97, oxido: 0.4, brilloBorde: 0.2, tintaG: 1.2 });
});
def('cartel_biologico', 'laboratorio', 'Cartel de riesgo biológico', 'Biohazard sign', 56, 72, 'pared', (c) => {
  c.save(); c.translate(28, 36); c.rotate(-0.04); c.translate(-28, -36);
  metal(c, () => camino(c, tembloroso(rect(2, 2, 52, 68), 0.6, 8, 101)), [2, 2, 52, 68], { semilla: 101, base: '#b9b296', oxido: 0.9, brilloBorde: 0.2 });
  camino(c, [[28, 12], [48, 46], [8, 46]]); c.fillStyle = 'rgba(214,176,58,.9)'; c.fill(); tinta(c, 1.6);
  c.strokeStyle = TINTA; c.lineWidth = 1.6;
  for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + k * 2.094; c.beginPath(); c.arc(28 + Math.cos(a) * 5, 34 + Math.sin(a) * 5, 4.5, a + 2.2, a + 4.1); c.stroke(); }
  c.beginPath(); c.arc(28, 34, 2, 0, 7); c.stroke();
  texto(c, 'PROJECT ASH', 28, 56, 5.5); texto(c, 'NO ENTRY', 28, 63, 4.5, 'rgba(10,9,11,.75)', 'normal');
  remache(c, 6, 6, 1.4); remache(c, 50, 6, 1.4);
  c.restore();
});
def('fluorescente', 'laboratorio', 'Fluorescente colgante', 'Hanging fluorescent lamp', 112, 140, 'techo', (c) => {
  cadena(c, 22, 0, 26, 30, 4, 1, 111); cadena(c, 90, 0, 86, 30, 4, 1, 112);
  // cono de luz con polvo
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createLinearGradient(0, 38, 0, 140); g.addColorStop(0, 'rgba(220,235,255,.28)'); g.addColorStop(1, 'rgba(220,235,255,0)');
  c.fillStyle = g; c.beginPath(); c.moveTo(18, 38); c.lineTo(94, 38); c.lineTo(112, 140); c.lineTo(0, 140); c.fill();
  c.fillStyle = 'rgba(235,245,255,.7)';
  for (let k = 0; k < 30; k++) c.fillRect(10 + hash(k, 3) * 92, 44 + hash(k, 4) * 90, 1, 1);
  c.restore();
  metal(c, () => camino(c, rect(14, 28, 84, 10)), [14, 28, 84, 10], { semilla: 113, oxido: 0.6, base: '#3e4750' });
  c.fillStyle = '#f2f8ff'; c.fillRect(20, 36, 72, 3);
  brillo(c, 56, 38, 46, P.friaFuerte, 0.5);
});

// ======================================================================== cadenas y maquinaria
def('cadena_colgante', 'maquinaria', 'Cadena colgante', 'Hanging chain', 24, 160, 'techo', (c) => {
  cadena(c, 12, 0, 12, 150, 8, 2, 121);
  metal(c, () => camino(c, rect(6, 148, 12, 10)), [6, 148, 12, 10], { semilla: 122, oxido: 1 });
});
def('gancho_grua', 'maquinaria', 'Gancho de grúa', 'Crane hook', 48, 176, 'techo', (c) => {
  cadena(c, 24, 0, 24, 112, 8, 2.2, 131);
  metal(c, () => camino(c, rect(12, 108, 24, 18)), [12, 108, 24, 18], { semilla: 132, oxido: 0.7 });
  remache(c, 24, 117, 2.2);
  const f = () => { c.beginPath(); c.moveTo(20, 126); c.lineTo(20, 150); c.arc(30, 152, 10, Math.PI, Math.PI * 0.15, true); c.lineTo(42, 146); c.lineTo(36, 146); c.arc(30, 152, 4, Math.PI * 0.1, Math.PI, false); c.lineTo(28, 150); c.lineTo(28, 126); c.closePath(); };
  metal(c, f, [18, 126, 26, 38], { semilla: 133, oxido: 0.9, base: '#5c6066' });
});
def('polea', 'maquinaria', 'Polea con cuerda', 'Pulley with rope', 56, 128, 'techo', (c) => {
  metal(c, () => camino(c, rect(22, 0, 12, 18)), [22, 0, 12, 18], { semilla: 141, oxido: 0.8 });
  metal(c, () => { c.beginPath(); c.arc(28, 30, 16, 0, 7); }, [12, 14, 32, 32], { semilla: 142, oxido: 0.9 });
  c.beginPath(); c.arc(28, 30, 10, 0, 7); c.lineWidth = 1.4; c.strokeStyle = 'rgba(0,0,0,.6)'; c.stroke(); remache(c, 28, 30, 3);
  for (const x of [12, 44]) { c.beginPath(); c.moveTo(x, 30); c.lineTo(x + (x < 28 ? -2 : 3), 128); c.lineWidth = 3.2; c.strokeStyle = TINTA; c.stroke(); c.lineWidth = 1.6; c.strokeStyle = '#8a6a48'; c.stroke(); }
});
def('engranaje', 'maquinaria', 'Engranaje oxidado', 'Rusted cog', 96, 96, 'libre', (c) => {
  const f = () => {
    c.beginPath();
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2, r = k % 2 ? 40 : 46;
      const a2 = ((k + 1) / 24) * Math.PI * 2;
      c.lineTo(48 + Math.cos(a) * r, 48 + Math.sin(a) * r); c.lineTo(48 + Math.cos(a2 - 0.05) * r, 48 + Math.sin(a2 - 0.05) * r);
    }
    c.closePath();
    c.moveTo(48 + 14, 48); c.arc(48, 48, 14, 0, Math.PI * 2, true);
  };
  c.save(); f(); c.clip('evenodd'); metal(c, () => { c.beginPath(); c.rect(0, 0, 96, 96); }, [0, 0, 96, 96], { semilla: 151, oxido: 1.4, tintaG: 0 }); c.restore();
  f(); c.lineWidth = 1.8; c.strokeStyle = TINTA; c.stroke();
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; c.fillStyle = 'rgba(0,0,0,.6)'; c.beginPath(); c.arc(48 + Math.cos(a) * 26, 48 + Math.sin(a) * 26, 5, 0, 7); c.fill(); }
});
def('tornillo_gigante', 'maquinaria', 'Tornillo gigante', 'Giant screw', 128, 288, 'suelo', (c) => {
  metal(c, () => camino(c, rect(18, 32, 92, 230)), [18, 32, 92, 230], { semilla: 161, oxido: 0.9, base: '#59616a', cilindro: 'v' });
  c.save(); c.beginPath(); c.rect(12, 34, 104, 226); c.clip();
  for (let y = 36; y < 264; y += 16) {
    c.beginPath(); c.moveTo(10, y); c.lineTo(118, y + 9); c.lineWidth = 4; c.strokeStyle = TINTA; c.stroke();
    c.beginPath(); c.moveTo(14, y + 2.5); c.lineTo(114, y + 11); c.lineWidth = 1.2; c.strokeStyle = 'rgba(190,205,220,.35)'; c.stroke();
  }
  c.restore();
  metal(c, () => camino(c, [[18, 262], [64, 288], [110, 262]]), [18, 262, 92, 26], { semilla: 162, oxido: 0.9 });
  metal(c, () => camino(c, tembloroso(rect(0, 0, 128, 34), 0.5, 10, 163)), [0, 0, 128, 34], { semilla: 163, oxido: 0.7, base: '#6a727b' });
  c.fillStyle = TINTA; c.fillRect(56, 4, 16, 26);
  c.fillStyle = rgba(P.laton, 0.7); c.fillRect(4, 28, 120, 3);
});
def('tornillos_sueltos', 'maquinaria', 'Tornillos y tuercas sueltos', 'Loose bolts and nuts', 64, 24, 'suelo', (c) => {
  sombraSuelo(c, 32, 23, 62, 0.35);
  const r = azar(171);
  for (let k = 0; k < 7; k++) {
    const x = 6 + r() * 52, y = 16 + r() * 5, a = (r() - 0.5) * 2;
    c.save(); c.translate(x, y); c.rotate(a);
    if (k % 3 === 0) { metal(c, () => { c.beginPath(); for (let q = 0; q < 6; q++) { const b = q * Math.PI / 3; c.lineTo(Math.cos(b) * 5, Math.sin(b) * 5); } c.closePath(); c.moveTo(2.2, 0); c.arc(0, 0, 2.2, 0, 7, true); }, [-5, -5, 10, 10], { semilla: 172 + k, oxido: 0.6, tintaG: 1.2 }); }
    else { metal(c, () => camino(c, rect(-7, -2, 12, 4)), [-7, -2, 12, 4], { semilla: 172 + k, oxido: 0.8, tintaG: 1.1, brilloBorde: 0.2 }); metal(c, () => camino(c, rect(4, -4, 4, 8)), [4, -4, 4, 8], { semilla: 180 + k, oxido: 0.5, tintaG: 1.1 }); }
    c.restore();
  }
});
def('caja_rombo', 'maquinaria', 'Caja de madera con el rombo', 'Crate with diamond emblem', 72, 64, 'suelo', (c) => {
  sombraSuelo(c, 36, 63, 70);
  madera(c, () => camino(c, tembloroso(rect(2, 4, 68, 60), 0.5, 10, 191)), [2, 4, 68, 60], { semilla: 191 });
  for (const y of [4, 58]) metal(c, () => camino(c, rect(2, y, 68, 6)), [2, y, 68, 6], { semilla: 192 + y, oxido: 0.8, brilloBorde: 0.3, tintaG: 1.4 });
  remaches(c, 6, 7, 66, 7, 10, 1); remaches(c, 6, 61, 66, 61, 10, 1);
  camino(c, [[36, 18], [50, 34], [36, 50], [22, 34]]); c.fillStyle = 'rgba(15,12,10,.55)'; c.fill(); tinta(c, 1.4);
  camino(c, [[36, 24], [44, 34], [36, 44], [28, 34]]); c.strokeStyle = rgba(P.laton, 0.8); c.lineWidth = 1.2; c.stroke();
});
def('baul_remachado', 'maquinaria', 'Baúl metálico remachado', 'Riveted metal chest', 88, 56, 'suelo', (c) => {
  sombraSuelo(c, 44, 55, 86);
  metal(c, () => camino(c, rect(2, 14, 84, 42)), [2, 14, 84, 42], { semilla: 201, oxido: 0.8, base: '#3f4a52' });
  metal(c, () => { c.beginPath(); c.moveTo(2, 18); c.quadraticCurveTo(44, -2, 86, 18); c.closePath(); }, [2, 6, 84, 12], { semilla: 202, oxido: 0.7, base: '#46525b' });
  for (const x of [14, 74]) metal(c, () => camino(c, rect(x - 3, 10, 6, 46)), [x - 3, 10, 6, 46], { semilla: x + 203, oxido: 1, base: P.laton, luz: 'calida', brilloBorde: 0.3, tintaG: 1.2 });
  metal(c, () => camino(c, rect(38, 20, 12, 12)), [38, 20, 12, 12], { semilla: 205, base: P.laton, luz: 'calida', oxido: 0.4 });
  c.fillStyle = TINTA; c.fillRect(43, 24, 2, 5);
});
def('barril', 'maquinaria', 'Barril oxidado', 'Rusted barrel', 48, 72, 'suelo', (c) => {
  sombraSuelo(c, 24, 71, 48);
  const f = () => { c.beginPath(); c.moveTo(6, 6); c.quadraticCurveTo(2, 38, 6, 70); c.lineTo(42, 70); c.quadraticCurveTo(46, 38, 42, 6); c.closePath(); };
  metal(c, f, [2, 6, 44, 64], { semilla: 211, oxido: 1.2, base: '#4a4640', cilindro: 'v' });
  for (const y of [16, 38, 60]) { c.beginPath(); c.moveTo(4, y); c.quadraticCurveTo(24, y + 3, 44, y); c.lineWidth = 3.6; c.strokeStyle = TINTA; c.stroke(); c.lineWidth = 1.6; c.strokeStyle = '#6a5040'; c.stroke(); }
  c.beginPath(); c.ellipse(24, 6, 18, 4, 0, 0, 7); c.fillStyle = '#2a2018'; c.fill(); tinta(c, 1.6);
  // goteo naranja: NO (el naranja es solo la Podredumbre); un charco oscuro
  c.fillStyle = 'rgba(20,24,22,.55)'; c.beginPath(); c.ellipse(34, 71, 12, 2, 0, 0, 7); c.fill();
});
def('caja_fusibles', 'maquinaria', 'Caja de fusibles con cables', 'Fuse box with cables', 64, 112, 'pared', (c) => {
  metal(c, () => camino(c, rect(6, 6, 52, 64)), [6, 6, 52, 64], { semilla: 221, oxido: 0.6, base: '#4a5258' });
  c.fillStyle = '#0d0f12'; c.fillRect(12, 14, 40, 30);
  for (let k = 0; k < 4; k++) { metal(c, () => camino(c, rect(15 + k * 9, 18, 6, 22)), [15 + k * 9, 18, 6, 22], { semilla: 222 + k, base: '#8a8070', oxido: 0.3, brilloBorde: 0.2, tintaG: 1 }); }
  c.fillStyle = 'rgba(255,190,90,.9)'; c.beginPath(); c.arc(48, 54, 2.2, 0, 7); c.fill(); brillo(c, 48, 54, 10, P.calida, 0.6);
  for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(18 + k * 9, 70); c.bezierCurveTo(16 + k * 10, 90, 30 - k * 6, 96, 22 + k * 8, 112); c.lineWidth = 3.2; c.strokeStyle = TINTA; c.stroke(); c.lineWidth = 1.4; c.strokeStyle = ['#3a3a3a', '#5a2a22', '#2a3a4a', '#3a3a2a'][k]; c.stroke(); }
});

// ======================================================================== ruina y suelo
def('escombros', 'ruina', 'Escombros de hormigón', 'Concrete rubble', 96, 36, 'suelo', (c) => {
  sombraSuelo(c, 48, 35, 94);
  const r = azar(231);
  for (let k = 0; k < 9; k++) {
    const x = 6 + r() * 80, w = 10 + r() * 18, h = 6 + r() * 14, y = 36 - h - r() * 4 * (k > 5 ? 1 : 0);
    const pts = tembloroso([[x, y + h], [x + w * 0.1, y + h * 0.2], [x + w * 0.6, y], [x + w, y + h * 0.4], [x + w * 0.9, y + h]], 1, 5, 232 + k);
    metal(c, () => camino(c, pts), [x, y, w, h], { semilla: 232 + k, base: mezcla(P.hormigon, '#000000', r() * 0.3), oxido: 0.1, brilloBorde: 0.25, tintaG: 1.4 });
  }
  c.strokeStyle = TINTA; c.lineWidth = 1.6; c.beginPath(); c.moveTo(60, 20); c.lineTo(70, 2); c.lineTo(73, 6); c.stroke();
});
def('cristales_rotos', 'ruina', 'Cristales rotos', 'Broken glass shards', 96, 28, 'suelo', (c) => {
  const r = azar(241);
  for (let k = 0; k < 11; k++) {
    const x = 4 + r() * 88, h = 8 + r() * 18, w = 4 + r() * 7, inc = (r() - 0.5) * 10;
    vidrio(c, () => camino(c, [[x - w / 2, 28], [x + inc, 28 - h], [x + w / 2, 28]]), [x - w / 2, 28 - h, w, h], { semilla: 241 + k, a: 0.3, tintaG: 1.2 });
  }
  c.fillStyle = TINTA; c.fillRect(0, 26.5, 96, 1.5);
});
def('charco', 'ruina', 'Charco con reflejo', 'Puddle with reflection', 112, 12, 'suelo', (c) => {
  c.save(); c.beginPath(); c.ellipse(56, 6, 54, 5, 0, 0, 7); c.clip();
  const g = c.createLinearGradient(0, 0, 112, 0); g.addColorStop(0, 'rgba(25,32,40,.85)'); g.addColorStop(0.5, 'rgba(60,80,100,.85)'); g.addColorStop(1, 'rgba(25,32,40,.85)');
  c.fillStyle = g; c.fillRect(0, 0, 112, 12);
  c.fillStyle = 'rgba(220,235,255,.45)'; c.fillRect(30, 4, 40, 1); c.fillRect(46, 6.5, 24, 0.8);
  c.fillStyle = 'rgba(255,207,138,.35)'; c.fillRect(70, 5, 14, 1);
  c.restore();
  c.beginPath(); c.ellipse(56, 6, 54, 5, 0, 0, 7); c.lineWidth = 0.8; c.strokeStyle = 'rgba(10,9,11,.7)'; c.stroke();
});
def('papeles', 'ruina', 'Papeles dispersos', 'Scattered papers', 96, 20, 'suelo', (c) => {
  const r = azar(251);
  for (let k = 0; k < 6; k++) {
    c.save(); c.translate(10 + k * 15 + r() * 6, 15 + r() * 3); c.rotate((r() - 0.5) * 0.6); c.scale(1, 0.45);
    camino(c, tembloroso(rect(-9, -12, 18, 24), 0.4, 6, 252 + k)); c.fillStyle = mezcla(P.papel, '#000000', r() * 0.25); c.fill(); tinta(c, 1.2);
    c.fillStyle = 'rgba(40,40,40,.4)'; for (let q = 0; q < 5; q++) c.fillRect(-6, -8 + q * 4, 12 - (q % 2) * 3, 0.8);
    if (k === 2) { c.fillStyle = P.varga; c.fillRect(-9, -12, 1.4, 24); }
    c.restore();
  }
});
def('boceto_18', 'ruina', 'Boceto "Sujeto 18" clavado', 'Pinned "Subject 18" sketch', 72, 92, 'pared', (c) => {
  c.save(); c.translate(36, 46); c.rotate(0.06); c.translate(-36, -46);
  const pts = tembloroso([[2, 4], [70, 0], [68, 90], [4, 88]], 0.6, 6, 261);
  camino(c, pts);
  const g = c.createLinearGradient(0, 0, 72, 92); g.addColorStop(0, '#e2d8bd'); g.addColorStop(1, '#bfb08c');
  c.fillStyle = g; c.fill();
  c.save(); camino(c, pts); c.clip(); grano(c, 0, 0, 72, 92, 0.2, 'multiply', 262, 10); c.restore();
  tinta(c, 1.4);
  c.fillStyle = P.varga; c.fillRect(3, 5, 2, 82);
  c.fillStyle = 'rgba(50,50,55,.8)'; c.font = '7px "Ink Free", "Segoe Print", cursive'; c.textAlign = 'left'; c.fillText('Sujeto 18', 10, 13);
  // el 18 a lapiz: capucha puntiaguda, cara palida
  c.strokeStyle = 'rgba(55,55,60,.75)'; c.lineWidth = 0.9; c.lineCap = 'round';
  for (let k = 0; k < 2; k++) {
    c.beginPath(); c.moveTo(28 + k * 0.6, 70); c.quadraticCurveTo(24, 40, 14 + k, 24); c.quadraticCurveTo(40, 30, 46, 50); c.quadraticCurveTo(48, 62, 44, 70);
    c.moveTo(30, 44); c.quadraticCurveTo(28, 56, 36, 60); c.quadraticCurveTo(44, 58, 43, 46);
    c.moveTo(28, 70); c.lineTo(24, 84); c.lineTo(46, 84); c.lineTo(44, 70); c.stroke();
  }
  c.fillStyle = 'rgba(40,40,45,.9)'; c.fillRect(35, 50, 1.2, 2.4); c.fillRect(39, 50, 1.2, 2.4);
  c.strokeStyle = 'rgba(55,55,60,.4)'; for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(52, 30 + k * 8); c.lineTo(66, 30 + k * 8); c.stroke(); }
  // chincheta
  c.beginPath(); c.arc(36, 4, 2.2, 0, 7); c.fillStyle = '#8c3a2a'; c.fill(); tinta(c, 0.8);
  c.restore();
});
def('cables_colgando', 'ruina', 'Cables colgando', 'Hanging cables', 72, 128, 'techo', (c) => {
  const r = azar(271);
  for (let k = 0; k < 5; k++) {
    const x = 8 + k * 14, L = 50 + r() * 74;
    c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + (r() - 0.5) * 30, L * 0.4, x + (r() - 0.5) * 30, L * 0.8, x + (r() - 0.5) * 16, L);
    c.lineWidth = 3.4; c.strokeStyle = TINTA; c.stroke(); c.lineWidth = 1.6; c.strokeStyle = ['#2c2c2c', '#4a2a22', '#2a3644', '#3a3a2a', '#2c2c2c'][k]; c.stroke();
    if (k === 2) { brillo(c, x + 2, L, 8, P.friaFuerte, 0.8); }
  }
});
def('grieta_techo', 'ruina', 'Grieta en el techo con polvo', 'Ceiling crack with dust', 96, 112, 'techo', (c) => {
  metal(c, () => camino(c, tembloroso([[0, 0], [96, 0], [80, 10], [60, 6], [50, 18], [40, 8], [20, 12]], 1, 6, 281)), [0, 0, 96, 18], { semilla: 281, base: P.hormigon, oxido: 0.2 });
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createLinearGradient(0, 14, 0, 112); g.addColorStop(0, 'rgba(210,225,240,.25)'); g.addColorStop(1, 'rgba(210,225,240,0)');
  c.fillStyle = g; c.beginPath(); c.moveTo(44, 14); c.lineTo(56, 14); c.lineTo(66, 112); c.lineTo(34, 112); c.fill();
  c.fillStyle = 'rgba(230,240,250,.8)'; for (let k = 0; k < 26; k++) c.fillRect(40 + hash(k, 1) * 20 + hash(k, 3) * 10 * (hash(k, 2)), 18 + hash(k, 2) * 92, 1, 1);
  c.restore();
});
def('rastro_laton', 'ruina', 'Rastro de patas de latón', 'Brass claw tracks', 128, 24, 'techo', (c) => {
  // los Entomorficos pasan por el techo antes de verlos
  c.strokeStyle = rgba(P.laton, 0.7); c.lineWidth = 1.4;
  for (let k = 0; k < 10; k++) { const x = 6 + k * 12 + hash(k, 1) * 4; c.beginPath(); c.moveTo(x, 2); c.lineTo(x + 5, 8 + hash(k, 2) * 4); c.moveTo(x + 6, 2); c.lineTo(x + 2, 9 + hash(k, 3) * 4); c.stroke(); }
  c.lineWidth = 3; c.strokeStyle = rgba(P.laton, 0.45);
  c.beginPath(); c.moveTo(0, 14); c.bezierCurveTo(40, 22, 80, 6, 128, 16); c.stroke();
  c.lineWidth = 1; c.strokeStyle = rgba(P.latonClaro, 0.5); c.beginPath(); c.moveTo(0, 13); c.bezierCurveTo(40, 21, 80, 5, 128, 15); c.stroke();
});

// ======================================================================== gravedad cero
def('roca_flotante', 'anomalia', 'Roca flotante', 'Floating rock', 80, 64, 'libre', (c) => {
  brillo(c, 40, 34, 46, P.fria, 0.25);
  const pts = tembloroso([[6, 22], [22, 6], [52, 4], [74, 18], [70, 34], [52, 50], [40, 62], [28, 50], [10, 38]], 1.6, 6, 291);
  metal(c, () => camino(c, pts), [4, 4, 72, 58], { semilla: 291, base: '#3d434b', oxido: 0.15, brilloBorde: 0.8 });
  c.save(); camino(c, pts); c.clip();
  c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(20, 20); c.lineTo(40, 30); c.lineTo(36, 44); c.moveTo(52, 14); c.lineTo(58, 30); c.stroke();
  c.restore();
  // filo de luz azul arriba
  c.strokeStyle = 'rgba(200,232,255,.7)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(24, 7); c.lineTo(51, 5); c.lineTo(72, 18); c.stroke();
  for (let k = 0; k < 6; k++) { c.fillStyle = 'rgba(230,245,255,.8)'; c.fillRect(10 + hash(k, 7) * 60, 52 + hash(k, 8) * 10, 1.2, 1.2); }
});
def('chatarra_flotante', 'anomalia', 'Chatarra flotante', 'Floating scrap', 72, 48, 'libre', (c) => {
  brillo(c, 36, 24, 40, P.fria, 0.2);
  c.save(); c.translate(36, 24); c.rotate(-0.25); c.translate(-36, -24);
  metal(c, () => camino(c, tembloroso(rect(6, 14, 60, 18), 0.8, 8, 301)), [6, 14, 60, 18], { semilla: 301, oxido: 1, brilloBorde: 0.8 });
  remaches(c, 10, 18, 62, 18, 9, 1.1);
  c.restore();
  metal(c, () => camino(c, rect(46, 2, 8, 22)), [46, 2, 8, 22], { semilla: 302, oxido: 1, brilloBorde: 0.6 });
});
def('gotas_suspendidas', 'anomalia', 'Gotas suspendidas', 'Suspended droplets', 64, 64, 'libre', (c) => {
  for (let k = 0; k < 9; k++) {
    const x = 6 + hash(k, 11) * 52, y = 6 + hash(k, 12) * 52, r = 2 + hash(k, 13) * 4;
    brillo(c, x, y, r * 4, P.fria, 0.3);
    c.beginPath(); c.arc(x, y, r, 0, 7);
    const g = c.createRadialGradient(x - r * 0.3, y - r * 0.4, 0, x, y, r);
    g.addColorStop(0, 'rgba(240,250,255,.9)'); g.addColorStop(0.5, 'rgba(160,210,240,.45)'); g.addColorStop(1, 'rgba(90,140,180,.55)');
    c.fillStyle = g; c.fill(); c.lineWidth = 0.7; c.strokeStyle = 'rgba(10,9,11,.6)'; c.stroke();
  }
});
def('columna_luz', 'anomalia', 'Columna de luz de la anomalía', 'Anomaly light column', 96, 256, 'libre', (c) => {
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createLinearGradient(0, 0, 96, 0);
  g.addColorStop(0, 'rgba(143,199,255,0)'); g.addColorStop(0.35, 'rgba(180,220,255,.22)'); g.addColorStop(0.5, 'rgba(235,245,255,.45)'); g.addColorStop(0.65, 'rgba(180,220,255,.22)'); g.addColorStop(1, 'rgba(143,199,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 96, 256);
  for (let k = 0; k < 18; k++) { const x = 38 + hash(k, 21) * 20, y0 = hash(k, 22) * 256; c.fillStyle = 'rgba(240,250,255,.35)'; c.fillRect(x, y0, 0.8, 20 + hash(k, 23) * 40); }
  for (let k = 0; k < 40; k++) { c.fillStyle = hash(k, 25) < 0.5 ? 'rgba(233,245,255,.9)' : 'rgba(143,199,255,.9)'; const s = 0.8 + hash(k, 26) * 1.6; c.fillRect(10 + hash(k, 27) * 76, hash(k, 28) * 256, s, s); }
  c.restore();
});
def('puente_colgante', 'anomalia', 'Puente colgante en ruinas', 'Ruined hanging bridge', 192, 72, 'libre', (c) => {
  cadena(c, 4, 0, 8, 40, 5, 1.2, 311); cadena(c, 188, 0, 184, 36, 5, 1.2, 312);
  c.strokeStyle = TINTA; c.lineWidth = 2.4; c.beginPath(); c.moveTo(8, 40); c.quadraticCurveTo(96, 70, 184, 36); c.stroke();
  for (let k = 0; k < 14; k++) {
    if (k === 6 || k === 7) continue;     // tablones caidos
    const t = (k + 0.5) / 14, x = 8 + 176 * t, y = 40 + (1 - (2 * t - 1) ** 2) * 15 - 4 * t + 2;
    c.save(); c.translate(x, y); c.rotate((hash(k, 3) - 0.5) * 0.2 + (t - 0.5) * 0.35);
    madera(c, () => camino(c, rect(-6, -2, 12, 5)), [-6, -2, 12, 5], { semilla: 313 + k, vetas: false, tintaG: 1.2 });
    c.restore();
  }
  for (let k = 0; k < 6; k++) { const x = 20 + k * 30; c.beginPath(); c.moveTo(x, 6 + k); c.lineTo(x + 2, 44 + Math.sin(k) * 6); c.lineWidth = 1; c.strokeStyle = 'rgba(10,9,11,.7)'; c.stroke(); }
});

// ======================================================================== entomorficos
def('nido_chapa', 'entomorficos', 'Nido de chapa', 'Scrap-metal nest', 96, 80, 'pared', (c) => {
  const r = azar(321);
  for (let k = 0; k < 14; k++) {
    const a = r() * Math.PI * 2, d = r() * 26, x = 48 + Math.cos(a) * d, y = 42 + Math.sin(a) * d * 0.7;
    c.save(); c.translate(x, y); c.rotate(r() * 6);
    const w = 18 + r() * 14, h = 9 + r() * 8;
    metal(c, () => camino(c, tembloroso(rect(-w / 2, -h / 2, w, h), 0.6, 6, 322 + k)), [-w / 2, -h / 2, w, h], { semilla: 322 + k, base: [P.laton, P.oxido, '#5c6066'][k % 3], oxido: 0.8, luz: 'calida', tintaG: 1.3 });
    remache(c, -w / 2 + 3, 0, 1.1, 'calida'); remache(c, w / 2 - 3, 0, 1.1, 'calida');
    c.restore();
  }
  vidrio(c, () => camino(c, [[40, 34], [48, 14], [56, 36]]), [40, 14, 16, 22], { tinte: 'rgba(134,187,163,', a: 0.5, tintaG: 1.2 });
  c.beginPath(); c.ellipse(48, 48, 9, 7, 0, 0, 7); c.fillStyle = '#060607'; c.fill(); tinta(c, 1.4);
});
def('linea_carga', 'entomorficos', 'Línea de carga de los insectos', 'Insect cargo line', 48, 192, 'techo', (c) => {
  // cuerda trenzada de alambre con un gancho de laton y piezas atadas
  c.beginPath(); c.moveTo(24, 0); c.bezierCurveTo(30, 60, 18, 120, 24, 160);
  c.lineWidth = 4; c.strokeStyle = TINTA; c.stroke(); c.lineWidth = 2; c.strokeStyle = P.laton; c.stroke();
  c.setLineDash([2, 3]); c.lineWidth = 1; c.strokeStyle = P.latonClaro; c.stroke(); c.setLineDash([]);
  for (const [y, s] of [[50, 331], [96, 332]]) { c.save(); c.translate(26, y); c.rotate(0.4); metal(c, () => camino(c, rect(-6, -3, 12, 6)), [-6, -3, 12, 6], { semilla: s, oxido: 0.8, base: '#5c6066', tintaG: 1.1 }); c.restore(); }
  const f = () => { c.beginPath(); c.moveTo(21, 158); c.lineTo(21, 172); c.arc(29, 174, 8, Math.PI, 0.3, true); c.lineTo(36, 170); c.lineTo(32, 172); c.arc(29, 174, 3.5, 0.2, Math.PI, false); c.lineTo(27, 172); c.lineTo(27, 158); c.closePath(); };
  metal(c, f, [21, 158, 16, 24], { semilla: 333, base: P.laton, luz: 'calida', oxido: 0.4 });
});
def('hormiga_caparazon', 'entomorficos', 'Caparazón de hormiga abandonado', 'Discarded ant shell', 64, 40, 'suelo', (c) => {
  sombraSuelo(c, 32, 39, 60);
  c.beginPath(); c.ellipse(24, 26, 18, 12, -0.2, 0, 7);
  const g = c.createLinearGradient(8, 14, 40, 38); g.addColorStop(0, '#9a5a32'); g.addColorStop(1, '#3a1e10');
  c.fillStyle = g; c.fill(); tinta(c, 1.6);
  c.beginPath(); c.ellipse(46, 30, 9, 7, 0.2, 0, 7); c.fillStyle = '#6a3a20'; c.fill(); tinta(c, 1.4);
  metal(c, () => camino(c, rect(14, 18, 18, 10)), [14, 18, 18, 10], { semilla: 341, base: P.laton, luz: 'calida', oxido: 0.6, tintaG: 1.2 });
  c.strokeStyle = TINTA; c.lineWidth = 1.4; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(20 + k * 8, 36); c.lineTo(16 + k * 10, 40); c.stroke(); }
  c.strokeStyle = 'rgba(255,230,190,.4)'; c.lineWidth = 1; c.beginPath(); c.ellipse(20, 20, 10, 4, -0.3, Math.PI * 1.1, Math.PI * 1.8); c.stroke();
});
def('farol_laton', 'entomorficos', 'Farol de latón', 'Brass lantern', 40, 96, 'techo', (c) => {
  cadena(c, 20, 0, 20, 34, 5, 1.2, 351);
  // el halo de alrededor NO va aqui (el lienzo del asset lo cortaba en cuadrado): es la luz de Blender
  metal(c, () => camino(c, rect(10, 34, 20, 6)), [10, 34, 20, 6], { semilla: 352, base: P.laton, luz: 'calida', oxido: 0.5 });
  vidrio(c, () => camino(c, rect(11, 40, 18, 32)), [11, 40, 18, 32], { tinte: 'rgba(255,214,150,', a: 0.4, tintaG: 1.3 });
  brillo(c, 20, 56, 12, P.calidaFuerte, 0.9);
  c.fillStyle = '#fff2d0'; c.beginPath(); c.ellipse(20, 58, 2.4, 4, 0, 0, 7); c.fill();
  for (const x of [11, 29]) metal(c, () => camino(c, rect(x - 1.5, 38, 3, 36)), [x - 1.5, 38, 3, 36], { semilla: x + 353, base: P.laton, luz: 'calida', oxido: 0.5, brilloBorde: 0.2, tintaG: 1 });
  metal(c, () => camino(c, rect(8, 72, 24, 6)), [8, 72, 24, 6], { semilla: 355, base: P.laton, luz: 'calida', oxido: 0.5 });
});

// ======================================================================== mas laboratorio (hasta 50)
def('tanque_vertical', 'laboratorio', 'Tanque vertical con manómetro', 'Vertical tank with gauge', 72, 160, 'suelo', (c) => {
  sombraSuelo(c, 36, 159, 72);
  metal(c, () => { c.beginPath(); c.roundRect(8, 8, 56, 146, 24); }, [8, 8, 56, 146], { semilla: 361, oxido: 1, base: '#4b5660', cilindro: 'v' });
  remaches(c, 10, 40, 62, 40, 8, 1.1); remaches(c, 10, 120, 62, 120, 8, 1.1);
  c.beginPath(); c.arc(36, 74, 11, 0, 7); c.fillStyle = '#d9d2bf'; c.fill(); tinta(c, 2);
  c.strokeStyle = TINTA; c.lineWidth = 1.2; c.beginPath(); c.moveTo(36, 74); c.lineTo(42, 67); c.stroke();
  for (let k = 0; k < 7; k++) { const a = Math.PI * 0.8 + k * 0.23; c.beginPath(); c.moveTo(36 + Math.cos(a) * 8, 74 + Math.sin(a) * 8); c.lineTo(36 + Math.cos(a) * 10, 74 + Math.sin(a) * 10); c.lineWidth = 0.7; c.stroke(); }
  metal(c, () => camino(c, rect(30, 0, 12, 10)), [30, 0, 12, 10], { semilla: 362, base: P.laton, luz: 'calida', oxido: 0.5 });
});
def('consola_mandos', 'laboratorio', 'Consola de mandos apagada', 'Dead control console', 128, 88, 'suelo', (c) => {
  sombraSuelo(c, 64, 87, 126);
  metal(c, () => camino(c, [[4, 88], [4, 34], [20, 10], [108, 10], [124, 34], [124, 88]]), [4, 10, 120, 78], { semilla: 371, oxido: 0.7, base: '#414b54' });
  c.fillStyle = '#0a0f12'; c.beginPath(); c.roundRect(26, 16, 76, 22, 3); c.fill(); tinta(c, 1.4);
  c.strokeStyle = 'rgba(140,200,180,.25)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(30, 28); for (let x = 30; x < 98; x += 3) c.lineTo(x, 28 + Math.sin(x * 0.4) * 2); c.stroke();
  for (let k = 0; k < 6; k++) { remache(c, 22 + k * 17, 50, 3); }
  for (let k = 0; k < 4; k++) { c.fillStyle = k === 2 ? 'rgba(255,190,90,.9)' : '#1a1d20'; c.fillRect(28 + k * 20, 62, 10, 6); tinta(c, 0); c.strokeStyle = TINTA; c.lineWidth = 1; c.strokeRect(28 + k * 20, 62, 10, 6); }
  brillo(c, 73, 65, 10, P.calida, 0.6);
});
export const ASSETS = A;
export { frasco as dibujarFrasco };
export const GRUPOS = { estructura: 'Estructura', laboratorio: 'Laboratorio', maquinaria: 'Cadenas y maquinaria', ruina: 'Ruina y suelo', anomalia: 'Gravedad cero', entomorficos: 'Entomórficos' };

// Pinta un asset a un lienzo propio a `k` pixeles por unidad (con margen para el brillo y la tinta)
export function lienzoDe(a, k = 3, margen = 6) {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil((a.w + margen * 2) * k); cv.height = Math.ceil((a.h + margen * 2) * k);
  const c = cv.getContext('2d');
  c.scale(k, k); c.translate(margen, margen);
  a.dibujar(c);
  return cv;
}
