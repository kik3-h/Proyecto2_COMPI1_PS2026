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

/** Componente standalone que encapsula el editor CodeMirror y su barra de estado. */
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

  /** Crea la instancia del editor una vez que el contenedor HTML esta disponible. */
  public ngAfterViewInit(): void {
    this.inicializar_editor();
  }

  /** Sincroniza cambios de entradas Angular con la instancia activa de CodeMirror. */
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

  /** Libera recursos internos del editor nativo antes de destruir el componente. */
  public ngOnDestroy(): void {
    this.vista_editor?.destroy();
    this.vista_editor = null;
  }

  /** Inicializa CodeMirror con listeners de contenido y posicion de cursor. */
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

  /** Calcula y actualiza la linea y columna actual segun seleccion principal. */
  private actualizar_posicion_cursor(estado_editor: EditorState): void {
    const seleccion_principal: EditorSelection['main'] = estado_editor.selection.main;
    const posicion_cursor = seleccion_principal.head;
    const informacion_linea = estado_editor.doc.lineAt(posicion_cursor);

    this.linea_cursor = informacion_linea.number;
    this.columna_cursor = posicion_cursor - informacion_linea.from + 1;
  }
}
