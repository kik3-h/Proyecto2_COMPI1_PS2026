import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { AsignadorColor } from './componentes/asignador-color/asignador-color';
import { BannerSuperior } from './componentes/banner-superior/banner-superior';
import { EditorCodigoComponent } from './componentes/editor-codigo/editor-codigo.component';
import { ExploradorArchivos } from './componentes/explorador-archivos/explorador-archivos';
import { TerminalConsola } from './componentes/terminal-consola/terminal-consola';
import {
  ArchivoAbierto,
  ArchivoExplorador,
  DirectorioExplorador,
  ElementoSeleccionadoExplorador,
  EventoComandoTerminal,
  TipoLenguajeArchivo
} from './modelos/ide.model';
import { SistemaArchivosServicio } from './servicios/sistema-archivos.service';

/** Componente padre orquestador que coordina la comunicacion entre banner, explorador, editor y terminal. */
@Component({
  selector: 'app-root',
  imports: [BannerSuperior, ExploradorArchivos, EditorCodigoComponent, TerminalConsola, AsignadorColor],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class Aplicacion implements OnInit {
  @ViewChild(EditorCodigoComponent) private editor_codigo?: EditorCodigoComponent;
  private readonly sistema_archivos_servicio = inject(SistemaArchivosServicio);
  protected readonly titulo_framework = 'YFERA Framework_EH';
  protected readonly modal_creacion_visible = signal(false);
  protected readonly tipo_elemento_modal = signal<'archivo' | 'directorio'>('archivo');
  protected readonly nombre_elemento_modal = signal('');
  protected readonly modal_asignador_color_visible = signal(false);
  protected readonly mostrar_terminal = signal(true);
  protected readonly directorios_explorador = signal<DirectorioExplorador[]>([]);
  protected readonly archivos_explorador = signal<ArchivoExplorador[]>([]);
  protected readonly archivos_abiertos = signal<ArchivoAbierto[]>([]);
  protected readonly ruta_archivo_activo = signal<string | null>(null);
  protected readonly seleccion_explorador = signal<ElementoSeleccionadoExplorador | null>(null);
  protected readonly lineas_terminal = signal<string[]>([
    'Terminal YFERA inicializada.',
    'Fase 1.3 activa: arquitectura desacoplada y herramientas interactivas.'
  ]);

  /** Inicializa datos base y abre el archivo principal para que los hijos reciban estado inicial consistente. */
  public async ngOnInit(): Promise<void> {
    await this.inicializar_ide();
  }

  /** Atiende peticion de apertura desde explorador hijo y actualiza seleccion central en el padre. */
  protected async manejar_apertura_archivo_desde_explorador(ruta_archivo: string): Promise<void> {
    await this.abrir_archivo(ruta_archivo);
  }

  /** Guarda en el estado padre la seleccion reportada por el explorador hijo para acciones globales. */
  protected manejar_seleccion_explorador(elemento: ElementoSeleccionadoExplorador): void {
    this.seleccion_explorador.set(elemento);
  }

  /** Selecciona una pestana desde la vista central y sincroniza el elemento seleccionado en explorador hijo. */
  protected seleccionar_pestana(ruta_archivo: string): void {
    this.ruta_archivo_activo.set(ruta_archivo);
    this.seleccion_explorador.set({ tipo: 'archivo', ruta: ruta_archivo });
  }

  /** Cierra una pestana y recalcula ruta activa para mantener editor hijo sincronizado con el padre. */
  protected cerrar_pestana(ruta_archivo: string, evento: MouseEvent): void {
    evento.stopPropagation();

    const pestanas_actuales = this.archivos_abiertos();
    const indice_pestana = pestanas_actuales.findIndex(
      (archivo_abierto) => archivo_abierto.ruta === ruta_archivo
    );

    if (indice_pestana < 0) {
      return;
    }

    const nuevas_pestanas = pestanas_actuales.filter(
      (archivo_abierto) => archivo_abierto.ruta !== ruta_archivo
    );
    this.archivos_abiertos.set(nuevas_pestanas);

    if (this.ruta_archivo_activo() !== ruta_archivo) {
      return;
    }

    const ruta_siguiente =
      nuevas_pestanas[indice_pestana]?.ruta ?? nuevas_pestanas[indice_pestana - 1]?.ruta ?? null;
    this.ruta_archivo_activo.set(ruta_siguiente);

    if (ruta_siguiente !== null) {
      this.seleccion_explorador.set({ tipo: 'archivo', ruta: ruta_siguiente });
      return;
    }

    this.seleccion_explorador.set(null);
  }

  /** Recibe texto del editor hijo y actualiza el archivo activo en memoria para acciones de guardado. */
  protected guardar_cambios_editor(contenido_actualizado: string): void {
    const archivo_activo = this.obtener_archivo_activo();

    if (archivo_activo === null) {
      return;
    }

    this.actualizar_contenido_pestana(archivo_activo.ruta, contenido_actualizado);
  }

  /** Persistencia solicitada desde banner hijo: guarda contenido del editor activo en IndexedDB. */
  protected async guardar_archivo_activo(): Promise<void> {
    const archivo_activo = this.obtener_archivo_activo();

    if (archivo_activo === null) {
      this.agregar_linea_terminal('No hay un archivo activo para guardar.');
      return;
    }

    await this.sistema_archivos_servicio.actualizar_archivo(
      archivo_activo.ruta,
      archivo_activo.contenido
    );
    this.agregar_linea_terminal(`Archivo guardado: ${archivo_activo.ruta}`);
  }

  /** Elimina archivo o carpeta seleccionada en el explorador hijo y sincroniza editor, pestanas y arbol. */
  protected async eliminar_elemento_seleccionado(): Promise<void> {
    const elemento_seleccionado = this.seleccion_explorador();

    if (elemento_seleccionado === null) {
      this.agregar_linea_terminal('Seleccione un archivo o carpeta en el explorador para eliminar.');
      return;
    }

    if (elemento_seleccionado.tipo === 'archivo') {
      await this.sistema_archivos_servicio.eliminar_archivo(elemento_seleccionado.ruta);
      this.cerrar_pestanas_afectadas_por_eliminacion(elemento_seleccionado.ruta, 'archivo');
      this.agregar_linea_terminal(`Archivo eliminado: ${elemento_seleccionado.ruta}`);
    } else {
      if (elemento_seleccionado.ruta === '/') {
        this.agregar_linea_terminal('No se permite eliminar la carpeta raiz.');
        return;
      }

      await this.sistema_archivos_servicio.eliminar_directorio(elemento_seleccionado.ruta);
      this.cerrar_pestanas_afectadas_por_eliminacion(elemento_seleccionado.ruta, 'directorio');
      this.agregar_linea_terminal(`Carpeta eliminada: ${elemento_seleccionado.ruta}`);
    }

    this.seleccion_explorador.set(null);
    await this.refrescar_explorador();
  }

  /** Recibe solicitud del banner hijo para formatear el documento dentro del editor hijo actual. */
  protected aplicar_auto_indentar_editor(): void {
    const archivo_activo = this.obtener_archivo_activo();

    if (archivo_activo === null) {
      this.agregar_linea_terminal('No hay un archivo activo para auto-indentar.');
      return;
    }

    this.editor_codigo?.aplicar_auto_indentado_basico();
    this.agregar_linea_terminal(`Auto-indentado aplicado en: ${archivo_activo.ruta}`);
  }

  /** Abre modal hijo de asignador para que el usuario elija codigo de color a insertar en el editor. */
  protected abrir_modal_asignador_color(): void {
    this.modal_asignador_color_visible.set(true);
  }

  /** Cierra modal hijo de asignador sin modificar estado de documento ni tema del IDE. */
  protected cerrar_modal_asignador_color(): void {
    this.modal_asignador_color_visible.set(false);
  }

  /** Inserta en el editor hijo el color emitido por el modal hijo usando la posicion de cursor actual. */
  protected insertar_color_desde_asignador(codigo_color: string): void {
    const archivo_activo = this.obtener_archivo_activo();

    if (archivo_activo === null) {
      this.agregar_linea_terminal('No hay un archivo activo para insertar color.');
      this.modal_asignador_color_visible.set(false);
      return;
    }

    this.editor_codigo?.insertar_texto_en_cursor(codigo_color);
    this.modal_asignador_color_visible.set(false);
    this.agregar_linea_terminal(`Color insertado en ${archivo_activo.ruta}: ${codigo_color}`);
  }

  /** Alterna consola inferior por solicitud del banner hijo y deja registro de la accion en historial. */
  protected alternar_consola(): void {
    const nuevo_estado = !this.mostrar_terminal();
    this.mostrar_terminal.set(nuevo_estado);
    this.agregar_linea_terminal(nuevo_estado ? 'Consola visible.' : 'Consola oculta.');
  }

  /** Registra comando de visualizar errores emitido por el banner hijo para fases futuras del compilador. */
  protected registrar_ver_errores(): void {
    this.agregar_linea_terminal('Panel de errores en preparacion para fases de analisis.');
  }

  /** Registra solicitud de vista previa desde el banner hijo sin ejecutar compilacion en esta fase. */
  protected registrar_vista_previa(): void {
    this.agregar_linea_terminal('Vista previa disponible en fases posteriores.');
  }

  /** Registra solicitud de compilacion desde el banner hijo sin integrar Jison en esta fase. */
  protected registrar_compilacion(): void {
    this.agregar_linea_terminal('Compilacion disponible en fases posteriores.');
  }

  /** Registra solicitud de ayuda desde el banner hijo y escribe orientacion basica en consola. */
  protected registrar_ayuda(): void {
    this.agregar_linea_terminal(
      'Ayuda: use Archivo para crear elementos y la barra de herramientas para editar.'
    );
  }

  /** Abre modal de creacion solicitado por banner o explorador hijo para crear archivo o carpeta. */
  protected abrir_modal_creacion(tipo_elemento: 'archivo' | 'directorio'): void {
    this.tipo_elemento_modal.set(tipo_elemento);
    this.nombre_elemento_modal.set('');
    this.modal_creacion_visible.set(true);
  }

  /** Cierra modal de creacion y limpia estado temporal para futuros eventos enviados por hijos. */
  protected cerrar_modal_creacion(): void {
    this.modal_creacion_visible.set(false);
    this.nombre_elemento_modal.set('');
  }

  /** Actualiza texto del modal de creacion para confirmar luego accion pedida desde componentes hijos. */
  protected actualizar_nombre_modal(evento: Event): void {
    const objetivo = evento.target as HTMLInputElement;
    this.nombre_elemento_modal.set(objetivo.value);
  }

  /** Crea archivo o carpeta en el servicio y sincroniza inmediatamente explorador, tabs y editor hijos. */
  protected async confirmar_creacion_elemento(): Promise<void> {
    const nombre_elemento = this.nombre_elemento_modal().trim();

    if (nombre_elemento.length === 0) {
      this.agregar_linea_terminal('Debe ingresar un nombre valido para crear el elemento.');
      return;
    }

    const ruta_destino = this.obtener_ruta_directorio_objetivo();

    if (this.tipo_elemento_modal() === 'directorio') {
      const directorio_creado = await this.sistema_archivos_servicio.crear_directorio(
        ruta_destino,
        nombre_elemento
      );
      this.seleccion_explorador.set({ tipo: 'directorio', ruta: directorio_creado.ruta });
      this.agregar_linea_terminal(`Directorio creado: ${directorio_creado.ruta}`);
    } else {
      const archivo_creado = await this.sistema_archivos_servicio.crear_archivo(
        ruta_destino,
        nombre_elemento,
        ''
      );
      await this.abrir_archivo(archivo_creado.ruta);
      this.agregar_linea_terminal(`Archivo creado: ${archivo_creado.ruta}`);
    }

    await this.refrescar_explorador();
    this.cerrar_modal_creacion();
  }

  /** Recibe del componente terminal hijo lineas de salida y las agrega al historial central del padre. */
  protected procesar_comando_terminal(evento_terminal: EventoComandoTerminal): void {
    this.agregar_lineas_terminal(evento_terminal.lineas_generadas);
  }

  /** Limpia historial por solicitud del componente terminal hijo y deja una linea de confirmacion. */
  protected limpiar_historial_terminal(): void {
    this.lineas_terminal.set(['Consola limpiada.']);
  }

  /** Recibe archivo SQLite elegido en banner hijo y registra seleccion sin cargar motor SQL aun. */
  protected registrar_archivo_sqlite_seleccionado(archivo_sqlite: File): void {
    this.agregar_linea_terminal(`Archivo SQLite seleccionado: ${archivo_sqlite.name}`);
  }

  /** Entrega contenido del archivo activo al editor hijo para mantener visualizacion sincronizada. */
  protected obtener_contenido_archivo_activo(): string {
    return this.obtener_archivo_activo()?.contenido ?? '';
  }

  /** Entrega tipo de lenguaje del archivo activo al editor hijo para barra de estado contextual. */
  protected obtener_lenguaje_archivo_activo(): TipoLenguajeArchivo {
    return this.obtener_archivo_activo()?.tipo_lenguaje ?? 'Y';
  }

  /** Abre o enfoca archivo, actualiza seleccion y deja listo el contenido para que el editor hijo lo renderice. */
  private async abrir_archivo(ruta_archivo: string): Promise<void> {
    const indice_pestana_existente = this.archivos_abiertos().findIndex(
      (archivo_abierto) => archivo_abierto.ruta === ruta_archivo
    );

    if (indice_pestana_existente >= 0) {
      this.ruta_archivo_activo.set(ruta_archivo);
      this.seleccion_explorador.set({ tipo: 'archivo', ruta: ruta_archivo });
      return;
    }

    const archivo = await this.sistema_archivos_servicio.leer_archivo(ruta_archivo);

    if (archivo === null) {
      throw new Error(`No existe el archivo solicitado: ${ruta_archivo}`);
    }

    const archivo_abierto: ArchivoAbierto = {
      nombre: archivo.nombre,
      ruta: archivo.ruta,
      contenido: archivo.contenido,
      tipo_lenguaje: this.obtener_tipo_lenguaje_por_nombre(archivo.nombre)
    };

    this.archivos_abiertos.update((archivos_actuales) => [...archivos_actuales, archivo_abierto]);
    this.ruta_archivo_activo.set(ruta_archivo);
    this.seleccion_explorador.set({ tipo: 'archivo', ruta: ruta_archivo });
    this.agregar_linea_terminal(`Archivo abierto: ${ruta_archivo}`);
  }

  /** Inicializa servicio, recarga explorador y abre archivo base para proveer contexto inicial a componentes hijos. */
  private async inicializar_ide(): Promise<void> {
    await this.sistema_archivos_servicio.inicializar_base_datos();
    await this.refrescar_explorador();
    await this.abrir_archivo('/src/main.y');
  }

  /** Refresca estructuras del explorador para propagar al hijo una vista actualizada del sistema de archivos. */
  private async refrescar_explorador(): Promise<void> {
    const [directorios, archivos] = await Promise.all([
      this.sistema_archivos_servicio.listar_directorios(),
      this.sistema_archivos_servicio.listar_archivos()
    ]);

    this.directorios_explorador.set(
      directorios.map((directorio) => ({
        nombre: directorio.nombre,
        ruta: directorio.ruta,
        ruta_directorio_padre: directorio.ruta_directorio_padre
      }))
    );

    this.archivos_explorador.set(
      archivos.map((archivo) => ({
        nombre: archivo.nombre,
        ruta: archivo.ruta,
        ruta_directorio_padre: archivo.ruta_directorio_padre
      }))
    );
  }

  /** Retorna archivo activo del estado central para que acciones de hijos operen sobre el objetivo correcto. */
  private obtener_archivo_activo(): ArchivoAbierto | null {
    const ruta_activa = this.ruta_archivo_activo();

    if (ruta_activa === null) {
      return null;
    }

    return this.archivos_abiertos().find((archivo_abierto) => archivo_abierto.ruta === ruta_activa) ?? null;
  }

  /** Actualiza contenido de una pestana para reflejar en el padre lo emitido por el editor hijo. */
  private actualizar_contenido_pestana(ruta_archivo: string, contenido_actualizado: string): void {
    this.archivos_abiertos.update((archivos_actuales) =>
      archivos_actuales.map((archivo_abierto) =>
        archivo_abierto.ruta === ruta_archivo
          ? { ...archivo_abierto, contenido: contenido_actualizado }
          : archivo_abierto
      )
    );
  }

  /** Determina directorio objetivo para crear elementos usando seleccion actual de explorador o archivo activo. */
  private obtener_ruta_directorio_objetivo(): string {
    const elemento_seleccionado = this.seleccion_explorador();

    if (elemento_seleccionado !== null) {
      if (elemento_seleccionado.tipo === 'directorio') {
        return elemento_seleccionado.ruta;
      }

      return this.obtener_ruta_directorio_padre(elemento_seleccionado.ruta);
    }

    const ruta_archivo_activo = this.ruta_archivo_activo();

    if (ruta_archivo_activo !== null) {
      return this.obtener_ruta_directorio_padre(ruta_archivo_activo);
    }

    return '/src';
  }

  /** Convierte nombre de archivo a tipo de lenguaje para que el editor hijo muestre estado correcto. */
  private obtener_tipo_lenguaje_por_nombre(nombre_archivo: string): TipoLenguajeArchivo {
    const extension = this.obtener_extension_archivo(nombre_archivo);

    if (extension === 'comp') {
      return 'COMP';
    }

    if (extension === 'styles') {
      return 'STYLES';
    }

    return 'Y';
  }

  /** Extrae extension en minusculas para clasificar archivos antes de enviarlos al editor hijo. */
  private obtener_extension_archivo(nombre_archivo: string): string {
    const partes = nombre_archivo.toLowerCase().split('.');
    return partes[partes.length - 1] ?? '';
  }

  /** Obtiene directorio padre desde ruta absoluta para resolver operaciones creadas por acciones de hijos. */
  private obtener_ruta_directorio_padre(ruta_absoluta: string): string {
    const ultimo_indice = ruta_absoluta.lastIndexOf('/');

    if (ultimo_indice <= 0) {
      return '/';
    }

    return ruta_absoluta.slice(0, ultimo_indice);
  }

  /** Cierra pestanas impactadas por eliminacion y recalcula archivo activo para mantener coherencia con hijos. */
  private cerrar_pestanas_afectadas_por_eliminacion(
    ruta_elemento: string,
    tipo_elemento: 'archivo' | 'directorio'
  ): void {
    const pestanas_filtradas = this.archivos_abiertos().filter((archivo_abierto) => {
      if (tipo_elemento === 'archivo') {
        return archivo_abierto.ruta !== ruta_elemento;
      }

      const prefijo_directorio = `${ruta_elemento}/`;
      return !archivo_abierto.ruta.startsWith(prefijo_directorio);
    });

    this.archivos_abiertos.set(pestanas_filtradas);

    const ruta_activa = this.ruta_archivo_activo();

    if (ruta_activa === null) {
      return;
    }

    const ruta_activa_fue_eliminada =
      tipo_elemento === 'archivo'
        ? ruta_activa === ruta_elemento
        : ruta_activa.startsWith(`${ruta_elemento}/`);

    if (!ruta_activa_fue_eliminada) {
      return;
    }

    const nueva_ruta_activa = pestanas_filtradas[0]?.ruta ?? null;
    this.ruta_archivo_activo.set(nueva_ruta_activa);

    if (nueva_ruta_activa !== null) {
      this.seleccion_explorador.set({ tipo: 'archivo', ruta: nueva_ruta_activa });
    }
  }

  /** Agrega una linea de historial para que la terminal hija la muestre inmediatamente en su area de lectura. */
  private agregar_linea_terminal(linea: string): void {
    this.lineas_terminal.update((lineas_actuales) => [...lineas_actuales, linea]);
  }

  /** Agrega multiples lineas de historial desde eventos de terminal hija para preservar orden de salida. */
  private agregar_lineas_terminal(lineas: string[]): void {
    this.lineas_terminal.update((lineas_actuales) => [...lineas_actuales, ...lineas]);
  }
}
