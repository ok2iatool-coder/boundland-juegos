// las piezas del taller se escribieron para una pagina: crean lienzos con document. En el hilo, OffscreenCanvas.
// (Va en su modulo y se importa el PRIMERO: los import se evaluan en orden, antes que el cuerpo del hilo.)
self.window = self;
self.__troncos = [];
self.document = { createElement: () => new OffscreenCanvas(1, 1) };
