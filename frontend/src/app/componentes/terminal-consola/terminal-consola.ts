import {
  AfterViewChecked,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild
} from '@angular/core';
import { EventoComandoTerminal } from '../../modelos/ide.model';

/** Componente hijo de terminal que procesa comandos basicos y reporta resultados al componente padre. */
@Component({
  selector: 'app-terminal-consola',
  imports: [],
  templateUrl: './terminal-consola.html',
  styleUrl: './terminal-consola.css'
})
export class TerminalConsola implements AfterViewChecked {
  @Input({ required: true }) public lineas_historial: string[] = [];
  @Output() public readonly comando_procesado = new EventEmitter<EventoComandoTerminal>();
  @Output() public readonly limpiar_solicitado = new EventEmitter<void>();
  @ViewChild('historial_terminal')
  private historial_terminal?: ElementRef<HTMLTextAreaElement>;
  protected comando_actual = '';

  /** Mantiene el scroll al final del historial para que el padre y el usuario vean la ultima salida. */
  public ngAfterViewChecked(): void {
    this.desplazar_historial_al_final();
  }

  /** Actualiza el valor local del comando antes de enviarlo al padre cuando se presiona Enter. */
  protected actualizar_comando(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    this.comando_actual = entrada.value;
  }

  /** Intercepta Enter para transformar la entrada en evento estructurado que el padre agrega al historial. */
  protected procesar_tecla(evento: KeyboardEvent): void {
    if (evento.key !== 'Enter') {
      return;
    }

    evento.preventDefault();
    this.enviar_comando();
  }

  /** Solicita al padre limpiar el historial global manteniendo estado centralizado en el orquestador. */
  protected solicitar_limpieza_historial(): void {
    this.limpiar_solicitado.emit();
  }

  /** Empaqueta comando y respuestas para que el padre actualice lineas de consola de forma unificada. */
  private enviar_comando(): void {
    const comando_normalizado = this.comando_actual.trim();

    if (comando_normalizado.length === 0) {
      return;
    }

    const evento_terminal: EventoComandoTerminal = {
      comando: comando_normalizado,
      lineas_generadas: [
        `yfera@workspace:~$ ${comando_normalizado}`,
        ...this.construir_respuestas_comando(comando_normalizado)
      ]
    };

    this.comando_procesado.emit(evento_terminal);
    this.comando_actual = '';
  }

  /** Resuelve comandos locales help y db-status para no acoplar esta fase con interpretes futuros. */
  private construir_respuestas_comando(comando_normalizado: string): string[] {
    if (comando_normalizado === 'help') {
      return [
        'Comandos disponibles: help, db-status.',
        'help: muestra la ayuda de la consola.',
        'db-status: muestra estado simulado de SQLite.'
      ];
    }

    if (comando_normalizado === 'db-status') {
      return ['Base de datos SQLite Activa. Version: 3.49.1'];
    }

    return [`Comando no reconocido: ${comando_normalizado}. Usa "help".`];
  }

  /** Realiza auto-scroll del area de texto de solo lectura para mejorar la retroalimentacion visual. */
  private desplazar_historial_al_final(): void {
    const elemento_historial = this.historial_terminal?.nativeElement;

    if (elemento_historial === undefined) {
      return;
    }

    elemento_historial.scrollTop = elemento_historial.scrollHeight;
  }
}
