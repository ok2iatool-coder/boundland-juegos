// EL MAPA DEL MUNDO (?mapa=mundo): la GEOGRAFIA de los planos del mundo abierto (diseno/planos/mapa.py) para recorrerla
// con el 18 y modelarla a mano. Encima, de momento, solo LA MURALLA (muralla.js, 21-10): el muro de 40 m de la prueba
// del paso a 3D en circulo alrededor de la Base; ni ciudad ni caminos. 4 x 4 km: la Sierra al norte,
// los Picos de Levante al este con nieve, su lago helado, el arroyo, la Cascada, la poza y el Lago; el rio que baja al
// oeste y se va por la Hoz; la Cuenca, el Linde, el llano de la Capital y, al sur, el llano de la Base al pie del Cortado
// y los Cerros. Es una copia del mapa de terreno con su editor (tecla E) y su mapa (tecla M); lo editado se guarda en
// web/datos/mundo_edicion.json (el del terreno es otro y no se toca).
import * as THREE from 'three';
import * as R from './relieve.js';
import { CHOQUES_ROCAS, ROCAS } from './sitios.js';
import './edicion.js';                                   // lo editado a mano, leido de disco ANTES de construir nada
import { crearSuelo } from './suelo.js';
import { crearRocas } from './rocas.js';
import { crearParedes } from './paredes.js';
import { crearAgua } from './agua.js';
import { crearHierba } from './hierba.js';
import { crearCielo, BRUMA } from './cielo.js';
import { crearPlano } from './plano.js';
import { crearEditor } from './editor.js';
import { crearModelos } from './modelos.js';
import { crearMuralla } from './muralla.js';
import { crearCimientos, alturaObra } from './cimientos.js';
import { crearExterior } from './exterior.js';
import { crearMacro } from './macro.js';
import { TONO } from './tono.js';

export const LADO = R.LADO;

export function crearMundo(scene) {
  const t0 = performance.now();
  const grupo = new THREE.Group();
  grupo.name = 'mundo';
  scene.add(grupo);

  // la luz de media tarde y una bruma fina (a la escala del mundo: a 3 km la mitad del color es bruma)
  const DIR_SOL = new THREE.Vector3(-0.5, 0.68, 0.53).normalize();
  scene.background = BRUMA.clone();
  const BRUMA_DENSIDAD = 0.00022;
  const BRUMA_NORTE = new THREE.Color(0xaeb6b4), LUZ_NORTE = new THREE.Color(0xdfe6ea);   // v8: el norte, mas frio
  const _bruma = new THREE.Color(), _luz = new THREE.Color();
  scene.fog = new THREE.FogExp2(BRUMA, BRUMA_DENSIDAD);
  const cielo = new THREE.HemisphereLight(0xf3efd6, 0x55603a, 1.55);
  const sol = new THREE.DirectionalLight(0xffe3b2, 2.7);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { near: 1, far: 260, left: -32, right: 32, top: 32, bottom: -32 });
  sol.shadow.bias = -0.0006;
  sol.shadow.normalBias = 0.05;
  scene.add(cielo, sol, sol.target);
  const _ejeU = new THREE.Vector3().crossVectors(DIR_SOL, new THREE.Vector3(0, 1, 0)).normalize();
  const _ejeV = new THREE.Vector3().crossVectors(_ejeU, DIR_SOL).normalize();
  const _foco = new THREE.Vector3();

  const boveda = crearCielo(scene, DIR_SOL);
  const suelo = crearSuelo(grupo, TONO);
  suelo.actualizar(R.SALIDA, true);          // los trozos de alrededor de la salida, ya
  const rocas = crearRocas(grupo, TONO);
  const paredes = crearParedes(grupo, TONO);
  const agua = crearAgua(grupo, TONO);
  const muralla = crearMuralla(grupo);
  const hierba = crearHierba({ grupo, camara: () => enlaces.cam });
  const cajas = [];
  const cimientos = crearCimientos(grupo, cajas);   // la obra de la ciudad: antes que la hierba se haga
  const exterior = crearExterior(grupo, cajas);     // el muro de 4 m, a 300 m del grande (21-10)
  exterior.recortarSuelo(suelo.material);
  const macro = crearMacro(grupo, cajas);           // el macroedificio de El Panal sur (21-10)
  let plano = null;
  const modelos = crearModelos({ grupo, cajas, alCambiar: (x0, z0, x1, z1) => { hierba.tirarZona(x0, z0, x1, z1); if (plano) plano.rehacer(); } });
  const msCarga = Math.round(performance.now() - t0);

  // el nombre del sitio (arriba a la izquierda, debajo del titulo)
  const etiqueta = document.createElement('div');
  etiqueta.style.cssText = 'position:fixed;left:18px;top:62px;font:13px/1.4 Bahnschrift,"Segoe UI",sans-serif;letter-spacing:.16em;color:#f2ecdc;text-shadow:0 1px 6px rgba(0,0,0,.5);opacity:.9;pointer-events:none;transition:opacity .4s';
  document.body.appendChild(etiqueta);
  let cadaZona = 0, zonaAhora = '';

  const enlaces = { heroe: null, camara: null, cam: null, canvas: null };
  // ---------------- el mapa: clic = el 18 aparece alli ----------------
  // si el clic cae en una pared o en el agua honda, al sitio llano y seco mas cercano (en espiral, hasta 60 m)
  let ultimoT = 0;
  const pisable = (x, z) => R.normalY(x, z) > 0.9 && !(R.nivelAgua(x, z) - R.altura(x, z) > R.HONDO) && R.radioBorde(x, z) < R.LADO;
  function ir(x, z) {
    if (editor && editor.activo) { editor.irA(x, z); return; }
    const H = enlaces.heroe;
    if (!H || !H.listo) return;
    let p = { x, z };
    if (!pisable(x, z)) {
      let mejor = null;
      for (let rad = 4; rad <= 60 && !mejor; rad += 4) {
        for (let k = 0; k < 24; k++) {
          const a = (k / 24) * Math.PI * 2, q = { x: x + Math.cos(a) * rad, z: z + Math.sin(a) * rad };
          if (pisable(q.x, q.z)) { mejor = q; break; }
        }
      }
      if (mejor) p = mejor;
    }
    R.limitar(p);
    H.pos.set(p.x, R.altura(p.x, p.z), p.z);
    suelo.actualizar(H.pos, true);
    H.vel.set(0, 0); H.vy = 0; H.suelo = true;
    if (H.reiniciarCuerpo) H.reiniciarCuerpo();
    if (enlaces.camara) enlaces.camara.lista = false;
    hierba.actualizar(ultimoT, H.pos, H, 0, true);
  }
  let editor = null;
  plano = crearPlano({ alIr: ir });
  // ---------------- el editor (tecla E): el mundo a mano ----------------
  editor = crearEditor({ scene, suelo, rocas, paredes, hierba, plano, laguna: null, modelos });
  editor.alIr18((x, z) => { editor.salir(); ir(x, z); });
  function tecla(e, abajo) {
    if (abajo && e.code === 'KeyM' && !e.ctrlKey) { plano.abierto ? plano.cerrar() : plano.abrir(); return true; }
    if (plano.abierto) {
      if (abajo && e.code === 'Escape') { plano.cerrar(); return true; }
      return abajo && /^(Key[WASDE]|Arrow|Space|Digit)/.test(e.code);
    }
    return editor.tecla(e, abajo);
  }
  function actualizar(t, foco, heroe = null, dt = 0) {
    ultimoT = t;
    if (editor.activo) foco = editor.paso(dt);
    else if (scene.fog.density !== BRUMA_DENSIDAD) scene.fog.density = BRUMA_DENSIDAD;
    suelo.actualizar(foco);
    if (suelo.pendiente) suelo.pintarPendiente(editor.activo ? 7 : 3);
    if (plano.abierto) plano.actualizar(editor.activo ? foco : heroe ? heroe.pos : foco, editor.activo ? editor.S.yaw + Math.PI : heroe ? heroe.giro : 0);
    const texel = (sol.shadow.camera.right - sol.shadow.camera.left) / sol.shadow.mapSize.x;
    const u = _ejeU.dot(foco), w = _ejeV.dot(foco);
    _foco.copy(foco).addScaledVector(_ejeU, Math.round(u / texel) * texel - u).addScaledVector(_ejeV, Math.round(w / texel) * texel - w);
    sol.position.copy(_foco).addScaledVector(DIR_SOL, 120);
    sol.target.position.copy(_foco);
    boveda.actualizar(t, foco);
    // v8: al cruzar al norte la bruma y la luz del cielo se enfrian
    const nn = R.norte(foco.x, foco.z);
    _bruma.copy(BRUMA).lerp(BRUMA_NORTE, 0.75 * nn);
    scene.fog.color.copy(_bruma);
    scene.background.copy(_bruma);
    cielo.color.copy(_luz.set(0xf3efd6).lerp(LUZ_NORTE, 0.6 * nn));
    agua.actualizar(t, dt);
    muralla.actualizar(foco);
    exterior.actualizar(foco, editor.activo ? null : heroe);
    hierba.actualizar(t, foco, heroe, dt);
    cadaZona -= dt;
    if (cadaZona <= 0) {
      cadaZona = 0.4;
      const z = R.zona(foco.x, foco.z);
      if (z !== zonaAhora) { zonaAhora = z; etiqueta.textContent = z.toUpperCase(); }
    }
  }
  // los bordes del mundo, las paredes que no se suben y el agua honda (desde donde esta el 18 ahora)
  function limitar(p) {
    R.limitar(p);
    muralla.limitar(p);
    if (enlaces.heroe && enlaces.heroe.listo) {
      R.pasoPermitido(enlaces.heroe.pos, p);
      exterior.limitar(p, enlaces.heroe.pos, enlaces.heroe.suelo);
    }
  }
  const puntoCamino = (tt) => ({ x: R.SALIDA.x, z: R.SALIDA.z - tt * 80, tx: 0, tz: -1 });

  return {
    LADO, borde: 1e4, limitar, altura: (x, z) => exterior.altura(x, z, R.altura(x, z) + alturaObra(x, z)), actualizar, puntoCamino, sol, hierba, agua,
    choques: { circulos: CHOQUES_ROCAS, cajas },
    salida: R.SALIDA,
    titulo: 'EL MUNDO', lejos: 14000, cerca: 0.1,
    conectar(e) { Object.assign(enlaces, e); muralla.conectar(e.renderer); editor.conectar({ heroe: e.heroe, C: e.camara, cam: e.cam, canvas: e.canvas }); },
    muralla, exterior, tecla, bloqueado: () => plano.abierto || editor.activo, plano, ir, editor, modelos,
    raton: (tipo, e) => editor.raton(tipo, e),
    ayuda: `<div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> correr &nbsp; <kbd>Mayús</kbd> andar &nbsp; <kbd>Espacio</kbd> saltar &nbsp; <kbd>1</kbd>-<kbd>4</kbd> gestos</div>
      <div><kbd>M</kbd> mapa del mundo: clic en un sitio y el 18 aparece allí</div>
      <div><kbd>E</kbd> editor: subir, bajar, allanar, suavizar, pintar (también nieve), rocas y modelos 3D</div>
      <div>ratón: cámara (clic para fijarlo, <kbd>Esc</kbd> para soltar) · rueda: acercar · <kbd>H</kbd> ocultar</div>`,
    zona: R.zona,
    get info() { return { msCarga, rocas: ROCAS.length, ...suelo.info(), ...rocas.info(), ...agua.info(), ...modelos.info(), ...hierba.info(), ...muralla.info(), ...cimientos.info(), ...exterior.info(), ...macro.info(), zona: zonaAhora }; },
  };
}
