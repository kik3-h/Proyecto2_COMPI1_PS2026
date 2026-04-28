import { Component, EventEmitter, HostListener, Input, Output, signal } from '@angular/core';

/** Componente hijo del encabezado que emite acciones de menu y barra de herramientas al padre orquestador. */
@Component({
  selector: 'app-banner-superior',
  imports: [],
  templateUrl: './banner-superior.html',
  styleUrl: './banner-superior.css'
})
export class BannerSuperior {
  @Input({ required: true }) public titulo_framework = '';
  @Output() public readonly solicitud_crear_elemento = new EventEmitter<'archivo' | 'directorio'>();
  @Output() public readonly solicitud_guardar = new EventEmitter<void>();
  @Output() public readonly solicitud_eliminar = new EventEmitter<void>();
  @Output() public readonly solicitud_ver_errores = new EventEmitter<void>();
  @Output() public readonly solicitud_alternar_consola = new EventEmitter<void>();
  @Output() public readonly solicitud_vista_previa = new EventEmitter<void>();
  @Output() public readonly solicitud_compilar = new EventEmitter<void>();
  @Output() public readonly solicitud_ayuda = new EventEmitter<void>();
  @Output() public readonly solicitud_auto_indentado = new EventEmitter<void>();
  @Output() public readonly solicitud_abrir_asignador_color = new EventEmitter<void>();
  @Output() public readonly archivo_sqlite_seleccionado = new EventEmitter<File>();
  protected readonly menu_abierto = signal<'archivo' | 'vista' | 'ayuda' | null>(null);

  /** Cierra menus al detectar click global para mantener comportamiento encapsulado del hijo. */
  @HostListener('document:click')
  public cerrar_menus_documento(): void {
    this.menu_abierto.set(null);
  }

  /** Alterna un menu local y evita acoplar al padre con estado visual interno del encabezado. */
  protected alternar_menu(menu: 'archivo' | 'vista' | 'ayuda', evento: MouseEvent): void {
    evento.stopPropagation();
    this.menu_abierto.update((menu_actual) => (menu_actual === menu ? null : menu));
  }

  /** Emite al padre la creacion de archivo o carpeta y cierra el menu que originó la accion. */
  protected emitir_creacion_elemento(tipo_elemento: 'archivo' | 'directorio'): void {
    this.menu_abierto.set(null);
    this.solicitud_crear_elemento.emit(tipo_elemento);
  }

  /** Emite al padre la solicitud de guardado para que persista el archivo activo en IndexedDB. */
  protected emitir_guardado(): void {
    this.menu_abierto.set(null);
    this.solicitud_guardar.emit();
  }

  /** Emite al padre la solicitud de eliminacion del elemento seleccionado en el explorador. */
  protected emitir_eliminacion(): void {
    this.menu_abierto.set(null);
    this.solicitud_eliminar.emit();
  }

  /** Emite al padre la apertura del modal asignador de color sin modificar tema global. */
  protected emitir_abrir_asignador_color(): void {
    this.solicitud_abrir_asignador_color.emit();
  }

  /** Emite al padre la solicitud de auto-indentado para que el editor hijo formatee su documento. */
  protected emitir_auto_indentado(): void {
    this.solicitud_auto_indentado.emit();
  }

  /** Emite al padre la solicitud de vista de errores para registrar la accion en la consola. */
  protected emitir_ver_errores(): void {
    this.menu_abierto.set(null);
    this.solicitud_ver_errores.emit();
  }

  /** Emite al padre el cambio de visibilidad de consola manteniendo simple este componente hijo. */
  protected emitir_alternar_consola(): void {
    this.menu_abierto.set(null);
    this.solicitud_alternar_consola.emit();
  }

  /** Emite al padre la accion de vista previa para conservar la orquestacion centralizada en app. */
  protected emitir_vista_previa(): void {
    this.solicitud_vista_previa.emit();
  }

  /** Emite al padre la accion de compilacion para fases posteriores del flujo del framework. */
  protected emitir_compilar(): void {
    this.solicitud_compilar.emit();
  }

  /** Emite al padre la accion de ayuda para mostrar orientacion dentro de la terminal. */
  protected emitir_ayuda(): void {
    this.menu_abierto.set(null);
    this.solicitud_ayuda.emit();
  }

  /** Abre selector nativo de archivos SQLite para que luego el hijo reporte el archivo al padre. */
  protected abrir_selector_sqlite(selector_archivo: HTMLInputElement): void {
    selector_archivo.click();
  }

  /** Emite al padre el archivo SQLite seleccionado y limpia el input para futuras selecciones. */
  protected notificar_archivo_sqlite(evento: Event): void {
    const input_archivo = evento.target as HTMLInputElement;
    const archivo = input_archivo.files?.item(0);

    if (archivo === null || archivo === undefined) {
      return;
    }

    this.menu_abierto.set(null);
    this.archivo_sqlite_seleccionado.emit(archivo);
    input_archivo.value = '';
  }
}
