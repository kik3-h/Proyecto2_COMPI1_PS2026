import { Component, OnInit, inject, signal } from '@angular/core';
import { EditorCodigoComponent } from './componentes/editor-codigo/editor-codigo.component';
import { SistemaArchivosServicio } from './servicios/sistema-archivos.service';

/** Representa un archivo mostrado en el explorador lateral. */
interface ArchivoExplorador {
  nombre: string;
  ruta: string;
  ruta_directorio_padre: string;
}

/** Representa un directorio mostrado en el explorador lateral. */
interface DirectorioExplorador {
  nombre: string;
  ruta: string;
  ruta_directorio_padre: string | null;
}

/** Representa una pestana de archivo abierta en el editor central. */
interface ArchivoAbierto {
  nombre: string;
  ruta: string;
  contenido: string;
  tipo_lenguaje: 'Y' | 'COMP' | 'STYLES';
}

/** Componente raiz que orquesta la interfaz principal del IDE YFERA. */
@Component({
  selector: 'app-root',
  imports: [EditorCodigoComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class Aplicacion implements OnInit {
  private readonly sistema_archivos_servicio = inject(SistemaArchivosServicio);

  protected readonly titulo_framework = 'YFERA Framework_EH';
  protected readonly color_dorado_personalizado = signal('#EDBB00');
  protected readonly menu_abierto = signal<'archivo' | 'vista' | 'ayuda' | null>(null);
  protected readonly modal_creacion_visible = signal(false);
  protected readonly tipo_elemento_modal = signal<'archivo' | 'directorio'>('archivo');
  protected readonly nombre_elemento_modal = signal('');
  protected readonly mostrar_terminal = signal(true);
  protected readonly directorios_explorador = signal<DirectorioExplorador[]>([]);
  protected readonly archivos_explorador = signal<ArchivoExplorador[]>([]);
  protected readonly archivos_abiertos = signal<ArchivoAbierto[]>([]);
  protected readonly ruta_archivo_activo = signal<string | null>(null);
  protected readonly lineas_terminal = signal<string[]>([
    'Terminal YFERA inicializada.',
    'Fase 1.2 activa: herramientas visuales y gestion de pestanas.'
  ]);

  /** Inicializa la interfaz y carga el proyecto virtual por defecto. */
  public async ngOnInit(): Promise<void> {
    await this.inicializar_ide();
  }

  /** Abre o enfoca una pestana de archivo, cargando su contenido desde IndexedDB. */
  protected async abrir_archivo(ruta_archivo: string): Promise<void> {
    const indice_pestana_existente = this.archivos_abiertos().findIndex(
      (archivo_abierto) => archivo_abierto.ruta === ruta_archivo
    );

    if (indice_pestana_existente >= 0) {
      this.ruta_archivo_activo.set(ruta_archivo);
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
    this.agregar_linea_terminal(`Archivo abierto: ${ruta_archivo}`);
  }

  /** Selecciona la pestana indicada y la vuelve activa en el editor. */
  protected seleccionar_pestana(ruta_archivo: string): void {
    this.ruta_archivo_activo.set(ruta_archivo);
  }

  /** Cierra la pestana indicada y recalcula la pestana activa resultante. */
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
      nuevas_pestanas[indice_pestana]?.ruta ??
      nuevas_pestanas[indice_pestana - 1]?.ruta ??
      null;
    this.ruta_archivo_activo.set(ruta_siguiente);
  }

  /** Refleja cambios del editor en la pestana activa sin persistirlos aun en disco virtual. */
  protected guardar_cambios_editor(contenido_actualizado: string): void {
    const archivo_activo = this.obtener_archivo_activo();

    if (archivo_activo === null) {
      return;
    }

    this.actualizar_contenido_pestana(archivo_activo.ruta, contenido_actualizado);
  }

  /** Persiste manualmente el archivo activo dentro del sistema de archivos virtual. */
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

  /** Elimina el archivo activo desde IndexedDB, explorador y pestanas abiertas. */
  protected async eliminar_archivo_activo(): Promise<void> {
    const archivo_activo = this.obtener_archivo_activo();

    if (archivo_activo === null) {
      this.agregar_linea_terminal('No hay un archivo activo para eliminar.');
      return;
    }

    await this.sistema_archivos_servicio.eliminar_archivo(archivo_activo.ruta);
    this.archivos_abiertos.update((archivos_actuales) =>
      archivos_actuales.filter((archivo_abierto) => archivo_abierto.ruta !== archivo_activo.ruta)
    );
    this.ruta_archivo_activo.set(this.archivos_abiertos()[0]?.ruta ?? null);
    await this.refrescar_explorador();
    this.agregar_linea_terminal(`Archivo eliminado: ${archivo_activo.ruta}`);
  }

  /** Ejecuta auto-indentado basico del archivo activo usando llaves como referencia. */
  protected aplicar_auto_indentar(): void {
    const archivo_activo = this.obtener_archivo_activo();

    if (archivo_activo === null) {
      return;
    }

    const contenido_indentado = this.generar_texto_auto_indentado(archivo_activo.contenido);
    this.actualizar_contenido_pestana(archivo_activo.ruta, contenido_indentado);
    this.agregar_linea_terminal(`Auto-indentado aplicado en: ${archivo_activo.ruta}`);
  }

  /** Registra que el selector de color fue solicitado y abre el control nativo. */
  protected activar_selector_color(selector_color: HTMLInputElement): void {
    selector_color.click();
  }

  /** Actualiza el color dorado de realce segun el valor elegido por el usuario. */
  protected actualizar_color_dorado(evento: Event): void {
    const objetivo = evento.target as HTMLInputElement;
    this.color_dorado_personalizado.set(objetivo.value);
    this.agregar_linea_terminal(`Color de realce actualizado a: ${objetivo.value}`);
  }

  /** Alterna la visibilidad del panel de consola inferior del IDE. */
  protected alternar_consola(): void {
    const nuevo_estado = !this.mostrar_terminal();
    this.mostrar_terminal.set(nuevo_estado);
    this.agregar_linea_terminal(
      nuevo_estado ? 'Consola visible.' : 'Consola oculta.'
    );
  }

  /** Registra una accion de visualizacion de errores en la terminal del IDE. */
  protected registrar_ver_errores(): void {
    this.agregar_linea_terminal('Panel de errores en preparacion para fases de analisis.');
  }

  /** Registra la accion de vista previa sin ejecutar compilacion en esta fase. */
  protected registrar_vista_previa(): void {
    this.agregar_linea_terminal('Vista previa disponible en fases posteriores.');
  }

  /** Registra la accion de compilacion sin ejecutar interpretes en esta fase. */
  protected registrar_compilacion(): void {
    this.agregar_linea_terminal('Compilacion disponible en fases posteriores.');
  }

  /** Muestra u oculta un menu dropdown del encabezado principal. */
  protected alternar_menu(menu: 'archivo' | 'vista' | 'ayuda', evento: MouseEvent): void {
    evento.stopPropagation();
    this.menu_abierto.update((menu_actual) => (menu_actual === menu ? null : menu));
  }

  /** Cierra todos los menus desplegables al hacer click fuera del encabezado. */
  protected cerrar_menus(): void {
    this.menu_abierto.set(null);
  }

  /** Inicia la apertura del modal para crear archivo o directorio desde la UI. */
  protected abrir_modal_creacion(tipo_elemento: 'archivo' | 'directorio'): void {
    this.menu_abierto.set(null);
    this.tipo_elemento_modal.set(tipo_elemento);
    this.nombre_elemento_modal.set('');
    this.modal_creacion_visible.set(true);
  }

  /** Cierra el modal de creacion y limpia su entrada de texto temporal. */
  protected cerrar_modal_creacion(): void {
    this.modal_creacion_visible.set(false);
    this.nombre_elemento_modal.set('');
  }

  /** Actualiza el nombre digitado dentro del modal de creacion de elementos. */
  protected actualizar_nombre_modal(evento: Event): void {
    const objetivo = evento.target as HTMLInputElement;
    this.nombre_elemento_modal.set(objetivo.value);
  }

  /** Crea archivo o directorio segun modal activo y refresca explorador y pestanas. */
  protected async confirmar_creacion_elemento(): Promise<void> {
    const nombre_elemento = this.nombre_elemento_modal().trim();

    if (nombre_elemento.length === 0) {
      this.agregar_linea_terminal('Debe ingresar un nombre valido para crear el elemento.');
      return;
    }

    const ruta_destino = this.obtener_ruta_directorio_objetivo();

    if (this.tipo_elemento_modal() === 'directorio') {
      await this.sistema_archivos_servicio.crear_directorio(ruta_destino, nombre_elemento);
      this.agregar_linea_terminal(`Directorio creado: ${ruta_destino}/${nombre_elemento}`);
    } else {
      const archivo_creado = await this.sistema_archivos_servicio.crear_archivo(
        ruta_destino,
        nombre_elemento,
        ''
      );
      this.agregar_linea_terminal(`Archivo creado: ${archivo_creado.ruta}`);
      await this.abrir_archivo(archivo_creado.ruta);
    }

    await this.refrescar_explorador();
    this.cerrar_modal_creacion();
  }

  /** Filtra y retorna directorios hijos directos para una ruta de directorio padre. */
  protected obtener_directorios_hijos(ruta_padre: string): DirectorioExplorador[] {
    return this.directorios_explorador().filter(
      (directorio) => directorio.ruta_directorio_padre === ruta_padre
    );
  }

  /** Filtra y retorna archivos hijos directos para una ruta de directorio padre. */
  protected obtener_archivos_hijos(ruta_padre: string): ArchivoExplorador[] {
    return this.archivos_explorador().filter((archivo) => archivo.ruta_directorio_padre === ruta_padre);
  }

  /** Retorna el texto visible del icono segun extension de archivo del explorador. */
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

    if (extension === 'sqlite') {
      return 'DB';
    }

    return 'AR';
  }

  /** Obtiene el contenido actual del archivo activo para pintarlo en CodeMirror. */
  protected obtener_contenido_archivo_activo(): string {
    return this.obtener_archivo_activo()?.contenido ?? '';
  }

  /** Obtiene el tipo de lenguaje del archivo activo para la barra de estado del editor. */
  protected obtener_lenguaje_archivo_activo(): 'Y' | 'COMP' | 'STYLES' {
    return this.obtener_archivo_activo()?.tipo_lenguaje ?? 'Y';
  }

  /** Muestra un texto de ayuda general dentro de la terminal del IDE. */
  protected registrar_ayuda(): void {
    this.menu_abierto.set(null);
    this.agregar_linea_terminal(
      'Ayuda: use Archivo para crear elementos y la barra de herramientas para editar.'
    );
  }

  /** Inicializa base de datos, explorador y apertura inicial del archivo principal. */
  private async inicializar_ide(): Promise<void> {
    await this.sistema_archivos_servicio.inicializar_base_datos();
    await this.refrescar_explorador();
    await this.abrir_archivo('/src/main.y');
  }

  /** Recarga directorios y archivos desde IndexedDB para refrescar el explorador. */
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

  /** Retorna el archivo activo segun la ruta de pestana seleccionada en la interfaz. */
  private obtener_archivo_activo(): ArchivoAbierto | null {
    const ruta_activa = this.ruta_archivo_activo();

    if (ruta_activa === null) {
      return null;
    }

    return this.archivos_abiertos().find((archivo_abierto) => archivo_abierto.ruta === ruta_activa) ?? null;
  }

  /** Actualiza el contenido de una pestana abierta sin alterar su posicion en el arreglo. */
  private actualizar_contenido_pestana(ruta_archivo: string, contenido_actualizado: string): void {
    this.archivos_abiertos.update((archivos_actuales) =>
      archivos_actuales.map((archivo_abierto) =>
        archivo_abierto.ruta === ruta_archivo
          ? { ...archivo_abierto, contenido: contenido_actualizado }
          : archivo_abierto
      )
    );
  }

  /** Determina el directorio de creacion usando el archivo activo o /src por defecto. */
  private obtener_ruta_directorio_objetivo(): string {
    const ruta_activa = this.ruta_archivo_activo();

    if (ruta_activa === null) {
      return '/src';
    }

    const ultimo_indice = ruta_activa.lastIndexOf('/');

    if (ultimo_indice <= 0) {
      return '/';
    }

    return ruta_activa.slice(0, ultimo_indice);
  }

  /** Convierte nombre de archivo en tipo de lenguaje visible para barra de estado. */
  private obtener_tipo_lenguaje_por_nombre(nombre_archivo: string): 'Y' | 'COMP' | 'STYLES' {
    const extension = this.obtener_extension_archivo(nombre_archivo);

    if (extension === 'comp') {
      return 'COMP';
    }

    if (extension === 'styles') {
      return 'STYLES';
    }

    return 'Y';
  }

  /** Obtiene extension en minusculas a partir de un nombre de archivo. */
  private obtener_extension_archivo(nombre_archivo: string): string {
    const partes = nombre_archivo.toLowerCase().split('.');
    return partes[partes.length - 1] ?? '';
  }

  /** Genera texto con indentacion basica por niveles de llaves de bloque. */
  private generar_texto_auto_indentado(contenido: string): string {
    const lineas = contenido.split('\n');
    let nivel_indentacion = 0;

    const lineas_indentadas = lineas.map((linea_actual) => {
      const linea_limpia = linea_actual.trim();

      if (linea_limpia.startsWith('}')) {
        nivel_indentacion = Math.max(0, nivel_indentacion - 1);
      }

      const prefijo = '  '.repeat(nivel_indentacion);
      const resultado_linea = `${prefijo}${linea_limpia}`;

      if (linea_limpia.endsWith('{')) {
        nivel_indentacion += 1;
      }

      return resultado_linea;
    });

    return lineas_indentadas.join('\n');
  }

  /** Agrega una linea con marca de tiempo en la consola interna del IDE. */
  private agregar_linea_terminal(mensaje: string): void {
    const marca_tiempo = new Date().toLocaleTimeString('es-GT', { hour12: false });
    this.lineas_terminal.update((lineas_actuales) => [
      ...lineas_actuales,
      `[${marca_tiempo}] ${mensaje}`
    ]);
  }
}
