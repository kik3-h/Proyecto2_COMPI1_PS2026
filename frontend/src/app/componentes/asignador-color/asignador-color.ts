import { Component, EventEmitter, Output } from '@angular/core';

/** Representa un color seleccionable del modal para insertar codigo en el editor gestionado por el padre. */
interface ColorPredefinido {
  nombre: string;
  codigo_hex: string;
}

/** Componente hijo modal que emite al padre el codigo de color a insertar en el cursor del editor. */
@Component({
  selector: 'app-asignador-color',
  imports: [],
  templateUrl: './asignador-color.html',
  styleUrl: './asignador-color.css'
})
export class AsignadorColor {
  @Output() public readonly insertar_color_solicitado = new EventEmitter<string>();
  @Output() public readonly cerrar_solicitado = new EventEmitter<void>();
  protected readonly colores_predefinidos: ColorPredefinido[] = [
    { nombre: 'Blue', codigo_hex: '#0000FF' },
    { nombre: 'Red', codigo_hex: '#FF0000' },
    { nombre: 'White', codigo_hex: '#FFFFFF' },
    { nombre: 'Green', codigo_hex: '#00FF00' },
    { nombre: 'Black', codigo_hex: '#000000' },
    { nombre: 'Teal', codigo_hex: '#40BFB2' }
  ];
  protected formato_actual: 'HEX' | 'RGB' = 'HEX';
  protected codigo_hex_activo = this.colores_predefinidos[0]?.codigo_hex ?? '#000000';

  /** Cambia el color activo local para que el padre reciba exactamente el color que el usuario eligio. */
  protected seleccionar_color(indice_color: number): void {
    this.codigo_hex_activo = this.colores_predefinidos[indice_color]?.codigo_hex ?? this.codigo_hex_activo;
  }

  /** Cambia formato de salida sin tocar el tema del IDE, cumpliendo el objetivo de solo insertar codigo. */
  protected seleccionar_formato(formato: 'HEX' | 'RGB'): void {
    this.formato_actual = formato;
  }

  /** Sincroniza el selector nativo de color personalizado con el valor final que se insertara en el editor. */
  protected actualizar_color_personalizado(evento: Event): void {
    const entrada_color = evento.target as HTMLInputElement;
    this.codigo_hex_activo = entrada_color.value.toUpperCase();
  }

  /** Determina si una opcion predefinida coincide con el color activo para resaltar el boton seleccionado. */
  protected es_color_predefinido_activo(indice_color: number): boolean {
    const color_predefinido = this.colores_predefinidos[indice_color];
    return color_predefinido?.codigo_hex === this.codigo_hex_activo;
  }

  /** Retorna codigo en formato elegido para mostrar vista previa y enviarlo al padre cuando se inserte. */
  protected obtener_codigo_color_activo(): string {
    if (this.formato_actual === 'HEX') {
      return this.codigo_hex_activo;
    }

    return this.convertir_hex_a_rgb(this.codigo_hex_activo);
  }

  /** Emite al padre el codigo del color para que el editor hijo lo inserte en la posicion del cursor. */
  protected emitir_insercion_color(): void {
    this.insertar_color_solicitado.emit(this.obtener_codigo_color_activo());
  }

  /** Emite al padre cierre del modal manteniendo la orquestacion centralizada en app.component. */
  protected emitir_cierre_modal(): void {
    this.cerrar_solicitado.emit();
  }

  /** Convierte un codigo HEX valido a notacion RGB para respetar el formato solicitado por el usuario. */
  private convertir_hex_a_rgb(codigo_hex: string): string {
    const codigo_sin_numeral = codigo_hex.replace('#', '');

    if (codigo_sin_numeral.length !== 6) {
      return 'rgb(0, 0, 0)';
    }

    const canal_rojo = Number.parseInt(codigo_sin_numeral.slice(0, 2), 16);
    const canal_verde = Number.parseInt(codigo_sin_numeral.slice(2, 4), 16);
    const canal_azul = Number.parseInt(codigo_sin_numeral.slice(4, 6), 16);

    return `rgb(${canal_rojo}, ${canal_verde}, ${canal_azul})`;
  }
}
