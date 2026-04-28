/** Define los tipos de lenguaje que el editor expone al componente padre para su barra de estado. */
export type TipoLenguajeArchivo = 'Y' | 'COMP' | 'STYLES';

/** Representa un archivo del explorador enviado desde el componente padre hacia el hijo. */
export interface ArchivoExplorador {
  nombre: string;
  ruta: string;
  ruta_directorio_padre: string;
}

/** Representa un directorio del explorador enviado desde el componente padre hacia el hijo. */
export interface DirectorioExplorador {
  nombre: string;
  ruta: string;
  ruta_directorio_padre: string | null;
}

/** Representa una pestana abierta y sincronizada entre el padre orquestador y el editor hijo. */
export interface ArchivoAbierto {
  nombre: string;
  ruta: string;
  contenido: string;
  tipo_lenguaje: TipoLenguajeArchivo;
}

/** Describe el elemento seleccionado en el explorador para que el padre coordine acciones globales. */
export interface ElementoSeleccionadoExplorador {
  tipo: 'archivo' | 'directorio';
  ruta: string;
}

/** Encapsula el resultado de comandos emitidos desde la terminal hija hacia el padre orquestador. */
export interface EventoComandoTerminal {
  comando: string;
  lineas_generadas: string[];
}
