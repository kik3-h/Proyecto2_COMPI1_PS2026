import { TestBed } from '@angular/core/testing';
import { Aplicacion } from './app';
import {
  Archivo,
  Directorio,
  SistemaArchivosServicio
} from './servicios/sistema-archivos.service';

describe('Aplicacion', () => {
  const archivo_principal: Archivo = {
    id: 1,
    nombre: 'main.y',
    ruta: '/src/main.y',
    ruta_directorio_padre: '/src',
    contenido: 'component(){}',
    fecha_creacion: Date.now(),
    fecha_actualizacion: Date.now()
  };

  const sistema_archivos_servicio_simulado: Pick<
    SistemaArchivosServicio,
    | 'inicializar_base_datos'
    | 'leer_archivo'
    | 'actualizar_archivo'
    | 'listar_archivos'
    | 'listar_directorios'
    | 'eliminar_archivo'
    | 'crear_archivo'
    | 'crear_directorio'
  > = {
    inicializar_base_datos: async (): Promise<void> => {},
    leer_archivo: async (): Promise<Archivo | null> => archivo_principal,
    actualizar_archivo: async (): Promise<void> => {},
    listar_archivos: async (): Promise<Archivo[]> => [archivo_principal],
    listar_directorios: async (): Promise<Directorio[]> => [
      {
        nombre: 'src',
        ruta: '/src',
        ruta_directorio_padre: '/',
        fecha_creacion: Date.now()
      }
    ],
    eliminar_archivo: async (): Promise<void> => {},
    crear_archivo: async (): Promise<Archivo> => archivo_principal,
    crear_directorio: async () => ({
      nombre: 'src',
      ruta: '/src',
      ruta_directorio_padre: '/',
      fecha_creacion: Date.now()
    })
  };

  /** Configura el modulo de pruebas e inyecta un servicio de archivos simulado. */
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Aplicacion],
      providers: [
        {
          provide: SistemaArchivosServicio,
          useValue: sistema_archivos_servicio_simulado
        }
      ]
    }).compileComponents();
  });

  /** Verifica que el componente principal del IDE se cree correctamente. */
  it('debe crear la aplicacion', () => {
    const fixture = TestBed.createComponent(Aplicacion);
    const aplicacion = fixture.componentInstance;
    expect(aplicacion).toBeTruthy();
  });

  /** Verifica que el encabezado muestre el nombre del framework. */
  it('debe renderizar el titulo del framework', async () => {
    const fixture = TestBed.createComponent(Aplicacion);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.titulo-framework')?.textContent).toContain('YFERA Framework_EH');
  });
});
