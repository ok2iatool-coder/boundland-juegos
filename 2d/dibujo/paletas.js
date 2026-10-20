// Colores con significado (GDD, direccion de arte): el blanco calido es el 18, el azul palido es Varga y
// el recuerdo, el naranja enfermizo es SOLO la Podredumbre, laton/oxido/verde cristal los Entomorficos,
// blanco y azul brillante en particulas la gravedad cero.
export const COLOR = {
  sujeto: '#fff4e2',
  varga: '#a9cde6',
  podre: '#e2792b',
  podreOsc: '#7a3510',
  laton: '#b38f4c',
  oxido: '#8a4a2a',
  cristalVerde: '#86bba3',
  gz: '#e9f5ff',
  gzAzul: '#8fc7ff',
  tinta: '#0b0a0c',
};

// Una paleta por zona. `oscuro` es cuanta penumbra cae sobre la escena (luz con intencion: una o dos
// fuentes por sala, lo demas en sombra).
export const ZONAS = {
  // El nivel 1: el laboratorio de los frascos y, tras la brecha, la caverna de la anomalia (el arte del menu)
  laboratorio: {
    cielo: ['#0c1016', '#131a22'], lejos: '#28323e', medio: '#323e4b', masa: '#12161b', masaClara: '#2b333c',
    borde: '#aebccb', textura: 'pintada', masaTex: '#3b424b', niebla: '#4d6178', luz: '#ffd8a0', oscuro: 0.6, rugoso: 1.5,
    polvo: '#eadfca', efectos: true, calida: '#ffbf72', fria: '#86c2ff', brecha: 64,
  },
  lab: {
    cielo: ['#111a25', '#1a2633'], lejos: '#2a3a4c', medio: '#34475b', masa: '#0b0f14', masaClara: '#24303d',
    borde: '#7f97ad', textura: 'paneles', niebla: '#3a5068', luz: '#d6e9ff', oscuro: 0.66, rugoso: 0.9,
    polvo: '#cfe0f0',
  },
  ciudad: {
    cielo: ['#cfcdc5', '#8e8b84'], lejos: '#a7a59d', medio: '#77736b', masa: '#2c2925', masaClara: '#433e37',
    // hormigon y asfalto: casi rectos (la piedra tiembla, el hormigon no); el fondo y el decorado los pinta un hilo
    // aparte (dibujo/ciudad_pintada.js, con la imagen de referencia boundland/concepto/ciudad_referencia.webp)
    borde: '#d2c7b2', textura: 'hormigon', niebla: '#c9c3b6', luz: '#f2ede2', oscuro: 0.5, rugoso: 1.0,
    polvo: '#e8e2d4',
    // penumbra como los niveles de antes: la luz es la de las farolas y lo que pinta encendido la ciudad (orbes)
    ambiente: '#a7b0bc', exterior: true,
  },
  casa: {
    cielo: ['#2b241c', '#1b1611'], lejos: '#3a3026', medio: '#2c241b', masa: '#1d1813', masaClara: '#2e261d',
    borde: '#b59c78', textura: 'yeso', niebla: '#5a4a38', luz: '#f6e6c8', oscuro: 0.6, rugoso: 1.2,
    polvo: '#efe1c8',
  },
  plaza: {
    cielo: ['#c1c6cc', '#7f8790'], lejos: '#a3a9b0', medio: '#6d737a', masa: '#2a2c30', masaClara: '#3d4046',
    borde: '#dfe8f2', textura: 'hormigon', niebla: '#cdd8e4', luz: '#f2f8ff', oscuro: 0.5, rugoso: 2.0,
    polvo: '#f0f8ff',
    ambiente: '#b4c3d4', exterior: true,
  },
  // El Linde (nivel 6): el bosque a contraluz dorado. Tierra oscura con el canto dorado y musgo; el fondo, el
  // decorado y el primer plano los pinta un hilo aparte con las piezas del concepto (`pintada`, dibujo/linde.js)
  linde: {
    cielo: ['#c9c99a', '#8f9670'], lejos: '#a3a685', medio: '#6c6e50', masa: '#17150c', masaClara: '#3a3322',
    borde: '#d3ba72', textura: 'tierra', niebla: '#d8cf9e', luz: '#fff1c8', oscuro: 0.63, rugoso: 2.2,
    polvo: '#f3ecd0', hunde: '#6b543a', pintada: true,
    // penumbra como los niveles de antes (linde/luces.js enciende ventanas, farol, capsulas y claros del dosel):
    // la sombra es fria y las lamparas calidas; es un exterior (bajo roca hay menos cielo) aunque este oscuro
    ambiente: '#a9b8a8', exterior: true,
  },
  hospital: {
    cielo: ['#141213', '#1d1a1a'], lejos: '#1f1b1b', medio: '#272221', masa: '#171313', masaClara: '#2a2423',
    borde: '#9c918b', textura: 'azulejo', niebla: '#4a3f3c', luz: '#e0d8d0', oscuro: 0.7, rugoso: 1.1,
    polvo: '#e6ddd5', patio: ['#3a3d45', '#20222a'],
  },
};
