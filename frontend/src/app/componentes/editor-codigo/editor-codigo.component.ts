import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { type EditorSelection, EditorState } from '@codemirror/state';
import { EditorView, basicSetup } from 'codemirror';

/** Componente hijo que encapsula CodeMirror y notifica cambios de texto al componente padre. */
@Component({
  selector: 'app-editor-codigo',
  standalone: true,
  templateUrl: './editor-codigo.component.html',
  styleUrl: './editor-codigo.component.css'
})
export class EditorCodigoComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) public texto_archivo = '';
  @Input() public tipo_lenguaje: 'Y' | 'COMP' | 'STYLES' = 'Y';
  @Output() public readonly texto_archivo_cambiado = new EventEmitter<string>();
  @ViewChild('contenedor_editor', { static: true })
  private contenedor_editor!: ElementRef<HTMLDivElement>;

  protected linea_cursor = 1;
  protected columna_cursor = 1;
  private vista_editor: EditorView | null = null;

  /** Inicializa CodeMirror para comenzar la comunicacion de cambios entre hijo editor y padre orquestador. */
  public ngAfterViewInit(): void {
    this.inicializar_editor();
  }

  /** Sincroniza entradas del padre con el documento interno para mantener editor y estado global alineados. */
  public ngOnChanges(cambios: SimpleChanges): void {
    if (!('texto_archivo' in cambios) || this.vista_editor === null) {
      return;
    }

    const contenido_actual_editor = this.vista_editor.state.doc.toString();

    if (contenido_actual_editor === this.texto_archivo) {
      return;
    }

    this.vista_editor.dispatch({
      changes: {
        from: 0,
        to: contenido_actual_editor.length,
        insert: this.texto_archivo
      }
    });

    this.actualizar_posicion_cursor(this.vista_editor.state);
  }

  /** Libera recursos del hijo editor cuando Angular lo destruye para evitar fugas en la comunicacion. */
  public ngOnDestroy(): void {
    this.vista_editor?.destroy();
    this.vista_editor = null;
  }

  /** Inserta texto en el cursor actual por solicitud del padre, usado por el modal asignador de color. */
  public insertar_texto_en_cursor(texto_a_insertar: string): void {
    if (this.vista_editor === null || texto_a_insertar.length === 0) {
      return;
    }

    const seleccion_principal = this.vista_editor.state.selection.main;
    const inicio = Math.min(seleccion_principal.anchor, seleccion_principal.head);
    const fin = Math.max(seleccion_principal.anchor, seleccion_principal.head);
    const nueva_posicion = inicio + texto_a_insertar.length;

    this.vista_editor.dispatch({
      changes: {
        from: inicio,
        to: fin,
        insert: texto_a_insertar
      },
      selection: { anchor: nueva_posicion }
    });
  }

  /** Aplica auto-indentado basico por solicitud del padre para mantener desacoplada la logica de formato. */
  public aplicar_auto_indentado_basico(): void {
    if (this.vista_editor === null) {
      return;
    }

    const contenido_actual = this.vista_editor.state.doc.toString();
    const contenido_indentado = this.generar_texto_auto_indentado(contenido_actual);

    if (contenido_actual === contenido_indentado) {
      return;
    }

    const posicion_cursor_actual = this.vista_editor.state.selection.main.head;
    const nueva_posicion_cursor = Math.min(posicion_cursor_actual, contenido_indentado.length);

    this.vista_editor.dispatch({
      changes: {
        from: 0,
        to: contenido_actual.length,
        insert: contenido_indentado
      },
      selection: { anchor: nueva_posicion_cursor }
    });
  }

  /** Inicializa listeners que emiten cambios al padre cada vez que el usuario modifica texto o cursor. */
  private inicializar_editor(): void {
    const estado_editor = EditorState.create({
      doc: this.texto_archivo,
      extensions: [
        basicSetup,
        EditorView.updateListener.of((actualizacion) => {
          if (actualizacion.docChanged) {
            this.texto_archivo_cambiado.emit(actualizacion.state.doc.toString());
          }

          if (actualizacion.docChanged || actualizacion.selectionSet) {
            this.actualizar_posicion_cursor(actualizacion.state);
          }
        })
      ]
    });

    this.vista_editor = new EditorView({
      state: estado_editor,
      parent: this.contenedor_editor.nativeElement
    });

    this.actualizar_posicion_cursor(estado_editor);
  }

  /** Recalcula posicion visual del cursor para que el padre muestre estado consistente en la UI. */
  private actualizar_posicion_cursor(estado_editor: EditorState): void {
    const seleccion_principal: EditorSelection['main'] = estado_editor.selection.main;
    const posicion_cursor = seleccion_principal.head;
    const informacion_linea = estado_editor.doc.lineAt(posicion_cursor);

    this.linea_cursor = informacion_linea.number;
    this.columna_cursor = posicion_cursor - informacion_linea.from + 1;
  }

  /** Genera texto indentado por llaves y permite que el cambio se emita al padre via el listener de CodeMirror. */
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
}
