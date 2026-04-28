import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  ArchivoExplorador,
  DirectorioExplorador,
  ElementoSeleccionadoExplorador
} from '../../modelos/ide.model';

/** Describe un nodo visual del arbol para separar renderizado del estado que entrega el padre. */
interface NodoExploradorVisual {
  tipo: 'archivo' | 'directorio';
  nombre: string;
  ruta: string;
  profundidad: number;
}

/** Componente hijo que renderiza el arbol y notifica al padre seleccion y acciones de apertura. */
@Component({
  selector: 'app-explorador-archivos',
  imports: [],
  templateUrl: './explorador-archivos.html',
  styleUrl: './explorador-archivos.css'
})
export class ExploradorArchivos {
  @Input({ required: true }) public directorios_explorador: DirectorioExplorador[] = [];
  @Input({ required: true }) public archivos_explorador: ArchivoExplorador[] = [];
  @Input() public ruta_archivo_activo: string | null = null;
  @Input() public seleccion_actual: ElementoSeleccionadoExplorador | null = null;
  @Output() public readonly solicitud_creacion = new EventEmitter<'archivo' | 'directorio'>();
  @Output() public readonly abrir_archivo_solicitado = new EventEmitter<string>();
  @Output() public readonly seleccion_cambiada = new EventEmitter<ElementoSeleccionadoExplorador>();

  /** Emite al padre la accion de creacion para abrir modal sin acoplar logica de persistencia en este hijo. */
  protected emitir_solicitud_creacion(tipo_elemento: 'archivo' | 'directorio'): void {
    this.solicitud_creacion.emit(tipo_elemento);
  }

  /** Emite al padre apertura de archivo y seleccion para sincronizar editor, pestanas y explorador. */
  protected abrir_archivo_desde_arbol(ruta_archivo: string): void {
    this.seleccion_cambiada.emit({ tipo: 'archivo', ruta: ruta_archivo });
    this.abrir_archivo_solicitado.emit(ruta_archivo);
  }

  /** Emite al padre seleccion de directorio para que las acciones globales operen sobre este contexto. */
  protected seleccionar_directorio(ruta_directorio: string): void {
    this.seleccion_cambiada.emit({ tipo: 'directorio', ruta: ruta_directorio });
  }

  /** Construye nodos planos desde estructuras del padre para renderizar un arbol de profundidad variable. */
  protected obtener_nodos_visuales(): NodoExploradorVisual[] {
    const nodos: NodoExploradorVisual[] = [];
    this.construir_nodos_visuales('/', 1, nodos);
    return nodos;
  }

  /** Determina si un archivo coincide con la ruta activa definida por el padre para resaltar pestana actual. */
  protected es_archivo_activo(ruta_archivo: string): boolean {
    return this.ruta_archivo_activo === ruta_archivo;
  }

  /** Determina si un nodo coincide con la seleccion global que mantiene el padre en su estado central. */
  protected es_nodo_seleccionado(nodo: NodoExploradorVisual): boolean {
    return (
      this.seleccion_actual !== null &&
      this.seleccion_actual.ruta === nodo.ruta &&
      this.seleccion_actual.tipo === nodo.tipo
    );
  }

  /** Retorna icono textual segun extension para mantener lectura rapida de tipos en el arbol. */
  protected obtener_icono_archivo(nombre_archivo: string): string {
    const extension = this.obtener_extension_archivo(nombre_archivo);

    if (extension === 'y') {
      return '{ }';
    }

    if (extension === 'comp') {
      return '[]';
    }

    if (extension === 'styles') {
      return 'PA';
    }

    if (extension === 'sqlite' || extension === 'db') {
      return 'DB';
    }

    return 'AR';
  }

  /** Recorre directorios y archivos para generar una estructura visual simple consumida por la plantilla hija. */
  private construir_nodos_visuales(
    ruta_padre: string,
    profundidad_actual: number,
    nodos: NodoExploradorVisual[]
  ): void {
    const directorios_hijos = this.directorios_explorador.filter(
      (directorio) => directorio.ruta_directorio_padre === ruta_padre
    );
    const archivos_hijos = this.archivos_explorador.filter(
      (archivo) => archivo.ruta_directorio_padre === ruta_padre
    );

    for (const directorio_hijo of directorios_hijos) {
      nodos.push({
        tipo: 'directorio',
        nombre: directorio_hijo.nombre,
        ruta: directorio_hijo.ruta,
        profundidad: profundidad_actual
      });

      this.construir_nodos_visuales(directorio_hijo.ruta, profundidad_actual + 1, nodos);
    }

    for (const archivo_hijo of archivos_hijos) {
      nodos.push({
        tipo: 'archivo',
        nombre: archivo_hijo.nombre,
        ruta: archivo_hijo.ruta,
        profundidad: profundidad_actual
      });
    }
  }

  /** Obtiene extension en minusculas para delegar al icono de archivo sin depender del padre. */
  private obtener_extension_archivo(nombre_archivo: string): string {
    const partes = nombre_archivo.toLowerCase().split('.');
    return partes[partes.length - 1] ?? '';
  }
}
