// Las CONVERSACIONES del primer trozo. El 18 no habla: contesta con sus cuatro gestos (1 saludar, 2 mirar arriba,
// 3 respingo, 4 bajar la cabeza) y con lo que hace (dar, coger). Cada personaje tiene un `inicio(p)` que elige por
// donde empieza segun lo que ha pasado, y nodos con su texto y sus opciones:
//   { g: gesto 0..4 (0 = ninguno), t: lo que quiere decir, si(p): si se ofrece, hacer(p, ui): lo que pasa, ir: nodo }
// `ui` es el juego (abrir la tienda, una mesa, la puerta...); en la prueba sin navegador es un registro de llamadas.
// Escritas a mano, sin IA: nadie promete algo que el juego no sabe hacer.
import { enMochila, quitar, dar, aprender, registrar, obraPide, reloj } from './partida.js';
import { OBRA_POZO } from './datos.js';

export const GESTOS = { 1: 'Saludar', 2: 'Mirar arriba', 3: 'Respingo', 4: 'Bajar la cabeza' };

const anota = (p, texto) => { p.diario.push({ t: p.t, texto }); p.eventos.push({ tipo: 'diario', texto }); };
const B = (p) => p.banderas;
const piedrasPuerta = 10;

export const DIALOGOS = {
  // ---------------- Ramiro, el guardia de la puerta ----------------
  ramiro: {
    inicio: (p) => !B(p).mision ? 'alto'
      : B(p).mision === 'piedras' ? (enMochila(p, 'piedra') >= piedrasPuerta ? 'entrega' : 'falta')
      : 'dentro',
    alto: {
      texto: '¡Alto ahí! ¿Y tú qué eres? Por esta puerta no entra nadie con las manos vacías. El muro se cae a trozos: tráeme diez piedras de la Cuenca y te dejo pasar.',
      opciones: [
        { g: 4, t: 'Sí, las traigo', hacer: (p) => { B(p).mision = 'piedras'; anota(p, 'Ramiro, el guardia: diez piedras de la Cuenca y te deja entrar en la Base.'); }, ir: 'animo' },
        { g: 2, t: '¿La Cuenca?', ir: 'cuenca' },
        { g: 3, t: 'No', ir: 'pues' },
      ],
    },
    cuenca: {
      texto: 'Al sur, bajando el camino. Hay piedra suelta junto al arroyo. Sin pico tardarás, pero se puede. ¿Te atreves?',
      opciones: [
        { g: 4, t: 'Sí', hacer: (p) => { B(p).mision = 'piedras'; anota(p, 'Ramiro, el guardia: diez piedras de la Cuenca y te deja entrar en la Base.'); }, ir: 'animo' },
        { g: 3, t: 'No', ir: 'pues' },
      ],
    },
    animo: { texto: 'Diez. Ni nueve ni once. Venga.', opciones: [{ g: 1, t: 'Adiós' }] },
    pues: { texto: 'Pues ahí te quedas, como los demás. Si cambias de idea, ya sabes dónde estoy.', opciones: [{ g: 1, t: 'Adiós' }] },
    falta: {
      texto: (p) => `¿Las diez piedras? Llevas ${enMochila(p, 'piedra')}. La Cuenca está al sur, junto al arroyo.`,
      opciones: [{ g: 4, t: 'Ya voy' }],
    },
    entrega: {
      texto: 'Vaya. Diez piedras. No esperaba que volvieras.',
      opciones: [
        { g: 0, t: 'Dar 10 piedras', hacer: (p, ui) => {
          quitar(p, 'piedra', piedrasPuerta); p.ciudad.almacen.piedra += piedrasPuerta;
          B(p).mision = 'registro'; B(p).puertaAbierta = true; p.aprecio.ramiro += 10;
          anota(p, 'La puerta de la Base está abierta para ti. Busca a Elena en la Intendencia.');
          ui.puerta(true);
        }, ir: 'pasa' },
      ],
    },
    pasa: { texto: 'Pasa. Ve a la Intendencia, la caseta del cartel al fondo de la plaza, y pregunta por Elena.', opciones: [{ g: 1, t: 'Gracias' }] },
    dentro: {
      texto: (p) => (p.t % 1440) >= 22 * 60 || (p.t % 1440) < 6 * 60
        ? 'Es de noche. La puerta se queda entornada; no hagas ruido, que la gente duerme.'
        : 'Si buscas trabajo, el tablón de la Intendencia. Y si quieres ayudar de verdad, ayuda con el pozo.',
      opciones: [{ g: 1, t: 'Adiós' }, { g: 2, t: '¿Lía?', si: (p) => !B(p).liaHierbas, ir: 'lia' }],
    },
    lia: { texto: '¿La niña? Vive con su madre en la tienda azul, junto a las huertas. La madre está mala, dicen.', opciones: [{ g: 4, t: 'Entendido' }] },
  },

  // ---------------- Elena Saez, la Intendente ----------------
  elena: {
    inicio: (p) => B(p).mision === 'registro' ? 'registro'
      : B(p).pozoAvisar ? 'pozo_fin'
      : B(p).mision === 'hecha' ? 'despues' : 'charla',
    registro: {
      texto: 'Ramiro dice que alguien pequeño ha subido piedras por la cuesta. ¿Tú? Bien. Aquí todos trabajamos y todos comemos. Te apunto: litera en el barracón, cinco vales la noche. Toma veinte para empezar.',
      opciones: [
        { g: 4, t: 'Gracias', hacer: (p) => {
          registrar(p);
          const v = Math.min(20, p.ciudad.intendencia); p.ciudad.intendencia -= v; p.vales += v;
          p.eventos.push({ tipo: 'vales', texto: `+${v} vales` });
          B(p).mision = 'herrera';
          anota(p, 'Elena: ve a ver a Nieves, la herrera, para tus herramientas.');
        }, ir: 'explica' },
      ],
    },
    explica: {
      texto: 'El tablón de aquí al lado tiene los encargos: lo que nos falta y lo que pagamos por ello. Y lo que más falta es agua; con un pozo no llegamos. Ve a ver a Nieves, la herrera: sin herramientas no harás gran cosa.',
      opciones: [{ g: 4, t: 'Voy' }, { g: 2, t: '¿El pozo?', ir: 'pozo_info' }],
    },
    pozo_info: {
      texto: (p) => {
        const f = obraPide(p);
        const falta = Object.entries(f).filter(([, n]) => n > 0).map(([id, n]) => `${n} ${id === 'tablon' ? 'tablones' : id === 'piedra' ? 'piedras' : 'cuerdas'}`);
        const vales = Math.max(0, OBRA_POZO.vales - p.obra.vales);
        if (p.obra.terminada !== null) return 'El segundo pozo ya da agua. Gracias a ti, en buena parte.';
        if (p.obra.empezada !== null) return 'Ya lo están levantando. Mañana habrá agua para todos.';
        return `El segundo pozo: cavar, revestirlo de piedra y montar el torno. Aún faltan ${falta.length ? falta.join(', ') : 'nada de material'}${vales ? ` y ${Math.ceil(vales)} vales para los jornales` : ''}. La Intendencia pone lo que le sobra cada mañana; lo demás, quien pueda. Se aporta en el cartel de la obra.`;
      },
      opciones: [{ g: 4, t: 'Ayudaré' }],
    },
    charla: {
      texto: (p) => `${reloj(p).split('·')[1].trim()}. Siempre falta algo. ¿Qué necesitas?`,
      opciones: [{ g: 2, t: '¿Y el pozo?', ir: 'pozo_info' }, { g: 1, t: 'Nada, adiós' }],
    },
    pozo_fin: {
      texto: 'Lo has visto: agua para todos, y para los que vienen. Toma, esto estaba en la caravana que llegó destrozada la semana pasada. Va firmada por una tal Varga. Aquí nadie entiende esos garabatos; quizá tú sí.',
      opciones: [
        { g: 0, t: 'Coger la nota', hacer: (p) => {
          dar(p, 'nota_varga', 1); B(p).mision = 'hecha'; B(p).pozoAvisar = false; p.aprecio.elena += 20;
          anota(p, 'Elena te ha dado una nota firmada por Varga. Fin del primer trozo.');
        }, ir: 'despues' },
      ],
    },
    despues: { texto: 'Esa nota... si averiguas algo, cuéntamelo. Y gracias otra vez.', opciones: [{ g: 1, t: 'Adiós' }] },
  },

  // ---------------- Nieves, la herrera ----------------
  nieves: {
    inicio: (p) => !B(p).nievesEnseno ? 'ensena' : 'charla',
    ensena: {
      texto: '¿Te manda Elena? Herramientas, ¿eh? No te las voy a regalar, pero te enseño a hacerlas. Mira: un mango, una piedra buena y cuerda bien apretada.',
      opciones: [
        { g: 4, t: 'Mirar con atención', hacer: (p) => {
          for (const r of ['hacha', 'pico', 'cubo']) aprender(p, r);
          B(p).nievesEnseno = true; p.aprecio.nieves += 5;
          if (B(p).mision === 'herrera') { B(p).mision = 'pozo'; anota(p, 'Nieves te ha enseñado a hacer hacha, pico y cubo. Ayuda a levantar el segundo pozo.'); }
        }, ir: 'banco' },
      ],
    },
    banco: {
      texto: 'Ese es el banco de trabajo, y la mesa de la sierra es la carpintería: de dos maderas sale un tablón. La cuerda la haces con fibra de los juncos.',
      opciones: [{ g: 0, t: 'Usar el banco', hacer: (p, ui) => ui.abrir('mesa', 'banco') }, { g: 1, t: 'Gracias' }],
    },
    charla: {
      texto: 'El banco es tuyo cuando quieras. Y si rompes algo, me lo traes.',
      opciones: [{ g: 0, t: 'Usar el banco', hacer: (p, ui) => ui.abrir('mesa', 'banco') }, { g: 1, t: 'Adiós' }],
    },
  },

  // ---------------- Amparo, la curandera ----------------
  amparo: {
    inicio: (p) => B(p).liaHierbas === 'pedido' && enMochila(p, 'hierbas') >= 3 ? 'hierbas'
      : !B(p).amparoEnseno ? 'hola' : 'charla',
    hola: {
      texto: 'Hola, pequeño. Aquí se cura lo que se puede con lo que hay, que es poco. ¿Sabes hacer vendas? Fibra y una hierba que corte la sangre.',
      opciones: [
        { g: 4, t: 'Enséñame', hacer: (p) => { aprender(p, 'vendas'); B(p).amparoEnseno = true; p.aprecio.amparo += 5; }, ir: 'vendas' },
        { g: 1, t: 'Adiós' },
      ],
    },
    vendas: { texto: 'Dos de fibra, una de hierbas, en el banco. Si me las traes, te las pago: mira el tablón.', opciones: [{ g: 4, t: 'Vale' }] },
    hierbas: {
      texto: '¿Hierbas para la madre de Lía? Dámelas, le preparo algo.',
      opciones: [
        { g: 0, t: 'Dar 3 hierbas', hacer: (p) => {
          quitar(p, 'hierbas', 3); B(p).liaHierbas = 'hecho'; p.aprecio.amparo += 10; p.aprecio.lia += 15;
          if (!B(p).amparoEnseno) { aprender(p, 'vendas'); B(p).amparoEnseno = true; }
          anota(p, 'Amparo preparará algo para la madre de Lía. Díselo a Lía.');
        }, ir: 'hierbas2' },
      ],
    },
    hierbas2: { texto: 'Dile a Lía que su madre se pondrá bien. Y ya que estás: si me traes vendas, te las pago.', opciones: [{ g: 4, t: 'Se lo diré' }] },
    charla: { texto: '¿Traes vendas? Mira el tablón: las pago bien.', opciones: [{ g: 1, t: 'Adiós' }] },
  },

  // ---------------- Tobias, el comerciante ----------------
  tobias: {
    inicio: (p) => !B(p).tobiasHola ? 'hola' : 'charla',
    hola: {
      texto: '¡Cliente nuevo! Compro lo que sirva: piedra, madera, fibra, tablones... y vendo lo que tengo. Los precios van como va el almacén: si sobra, barato; si falta, caro.',
      opciones: [
        { g: 4, t: 'Ver qué tiene', hacer: (p, ui) => { B(p).tobiasHola = true; ui.abrir('tienda'); } },
        { g: 2, t: '¿Una mochila?', hacer: (p) => { B(p).tobiasHola = true; }, ir: 'mochila' },
      ],
    },
    mochila: {
      texto: 'Te la vendo por sesenta, o te enseño a coserla: seis de fibra y dos cuerdas. Tú verás.',
      opciones: [
        { g: 4, t: 'Enséñame', hacer: (p) => { aprender(p, 'mochila'); p.aprecio.tobias += 3; } },
        { g: 0, t: 'Comerciar', hacer: (p, ui) => ui.abrir('tienda') },
      ],
    },
    charla: {
      texto: '¿Qué necesitas?',
      opciones: [{ g: 0, t: 'Comerciar', hacer: (p, ui) => ui.abrir('tienda') }, { g: 2, t: '¿Una mochila?', si: (p) => !p.recetas.includes('mochila'), ir: 'mochila' }, { g: 1, t: 'Adiós' }],
    },
  },

  // ---------------- Lia, la nina ----------------
  lia: {
    inicio: (p) => !B(p).liaHierbas ? 'hola' : B(p).liaHierbas === 'pedido' ? 'espera'
      : !B(p).liaDibujo ? 'gracias' : 'charla',
    hola: {
      texto: '¡Hala! ¿Tú qué eres? Mi madre está mala. Amparo, la curandera, dice que necesita hierbas, de las flores blancas del prado. Pero yo no puedo entrar en la Base.',
      opciones: [
        { g: 4, t: 'Se las llevo', hacer: (p) => { B(p).liaHierbas = 'pedido'; p.aprecio.lia += 5; anota(p, 'Lía: lleva tres hierbas a Amparo, la curandera de la Base.'); }, ir: 'gracias0' },
        { g: 2, t: '¿El muro?', ir: 'muro' },
        { g: 3, t: 'No', ir: 'vale' },
      ],
    },
    gracias0: { texto: '¡Gracias! Las flores blancas están junto al arroyo. Tres.', opciones: [{ g: 1, t: 'Adiós' }] },
    muro: { texto: 'Es muy alto, ¿verdad? Dicen que detrás de la ciudad hay más muros, y detrás, más. ¿Me ayudas con lo de mi madre?', opciones: [{ g: 4, t: 'Sí', hacer: (p) => { B(p).liaHierbas = 'pedido'; p.aprecio.lia += 5; anota(p, 'Lía: lleva tres hierbas a Amparo, la curandera de la Base.'); }, ir: 'gracias0' }, { g: 3, t: 'No', ir: 'vale' }] },
    vale: { texto: 'Vale... si cambias de idea, estoy por aquí.', opciones: [{ g: 1, t: 'Adiós' }] },
    espera: { texto: '¿Ya se las has llevado a Amparo? Las flores blancas, junto al arroyo. Tres.', opciones: [{ g: 4, t: 'Ya voy' }] },
    gracias: {
      texto: '¡Mi madre ya se levanta! Toma, te he hecho un dibujo. Eres tú, con el muro detrás.',
      opciones: [{ g: 0, t: 'Coger el dibujo', hacer: (p) => { dar(p, 'dibujo_lia', 1); B(p).liaDibujo = true; p.aprecio.lia += 10; anota(p, 'Lía te ha regalado un dibujo.'); }, ir: 'charla' }],
    },
    charla: { texto: '¿Jugamos a algo? No, que tienes cosas que hacer. Otro día.', opciones: [{ g: 1, t: 'Adiós' }] },
  },
};

// el nodo de inicio de una conversacion, y su texto y opciones ya resueltos para el estado
export function abrir(p, quien) {
  const d = DIALOGOS[quien];
  return nodo(p, quien, d.inicio(p));
}
export function nodo(p, quien, id) {
  const n = DIALOGOS[quien][id];
  return { quien, id, texto: typeof n.texto === 'function' ? n.texto(p) : n.texto,
    opciones: n.opciones.map((o, i) => ({ i, g: o.g, t: o.t, sale: !o.ir })).filter((o) => !n.opciones[o.i].si || n.opciones[o.i].si(p)) };
}
// elegir una opcion: hace lo suyo y devuelve el nodo siguiente (o null si la conversacion acaba)
export function elegir(p, quien, id, i, ui) {
  const o = DIALOGOS[quien][id].opciones[i];
  if (o.hacer) o.hacer(p, ui);
  return o.ir ? nodo(p, quien, o.ir) : null;
}
