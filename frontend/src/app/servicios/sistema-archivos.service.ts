import { Injectable } from '@angular/core';
import Dexie, { type Table } from 'dexie';

/** Representa un archivo dentro del sistema de archivos virtual. */
export interface Archivo {
  id?: number;
  nombre: string;
  ruta: string;
  ruta_directorio_padre: string;
  contenido: string;
  fecha_creacion: number;
  fecha_actualizacion: number;
}

/** Representa un directorio dentro del sistema de archivos virtual. */
export interface Directorio {
  id?: number;
  nombre: string;
  ruta: string;
  ruta_directorio_padre: string | null;
  fecha_creacion: number;
}

/** Define la base de datos Dexie para persistir archivos y directorios del IDE. */
class BaseDatosSistemaArchivos extends Dexie {
  public archivos!: Table<Archivo, number>;
  public directorios!: Table<Directorio, number>;

  /** Configura el esquema y los indices de la base de datos IndexedDB. */
  public constructor() {
    super('yfera_sistema_archivos');

    this.version(1).stores({
      archivos: '++id, &ruta, nombre, ruta_directorio_padre, fecha_actualizacion',
      directorios: '++id, &ruta, nombre, ruta_directorio_padre'
    });
  }
}

/** Expone operaciones CRUD para el sistema de archivos virtual del proyecto YFERA. */
@Injectable({ providedIn: 'root' })
export class SistemaArchivosServicio {
  private readonly base_datos = new BaseDatosSistemaArchivos();

  /** Inicializa la base de datos y crea el proyecto base cuando esta vacia. */
  public async inicializar_base_datos(): Promise<void> {
    const [total_archivos, total_directorios] = await Promise.all([
      this.base_datos.archivos.count(),
      this.base_datos.directorios.count()
    ]);

    if (total_archivos === 0 && total_directorios === 0) {
      await this.crear_proyecto_defecto();
    }
  }

  /** Crea la estructura base del proyecto con carpeta src y archivos iniciales. */
  public async crear_proyecto_defecto(): Promise<void> {
    await this.base_datos.transaction(
      'rw',
      this.base_datos.directorios,
      this.base_datos.archivos,
      async () => {
        const fecha_actual = Date.now();
        const directorio_src = await this.buscar_directorio_por_ruta('/src');

        if (directorio_src === undefined) {
          await this.base_datos.directorios.add({
            nombre: 'src',
            ruta: '/src',
            ruta_directorio_padre: '/',
            fecha_creacion: fecha_actual
          });
        }

        await this.crear_o_actualizar_archivo_base('/', 'database.sqlite', '');
        await this.crear_o_actualizar_archivo_base('/src', 'main.y', '');
        await this.crear_o_actualizar_archivo_base('/src', 'main.comp', '');
        await this.crear_o_actualizar_archivo_base('/src', 'main.styles', '');
      }
    );
  }

  /** Crea un nuevo directorio en la ruta indicada validando su directorio padre. */
  public async crear_directorio(ruta_directorio_padre: string, nombre: string): Promise<Directorio> {
    const ruta_padre_normalizada = this.normalizar_ruta(ruta_directorio_padre);
    await this.validar_directorio_padre(ruta_padre_normalizada);

    const ruta_nuevo_directorio = this.construir_ruta(ruta_padre_normalizada, nombre);
    await this.validar_colision_ruta(ruta_nuevo_directorio);

    const fecha_creacion = Date.now();
    const directorio_nuevo: Directorio = {
      nombre: nombre.trim(),
      ruta: ruta_nuevo_directorio,
      ruta_directorio_padre: ruta_padre_normalizada,
      fecha_creacion
    };

    const id_directorio = await this.base_datos.directorios.add(directorio_nuevo);
    return { ...directorio_nuevo, id: id_directorio };
  }

  /** Crea un archivo nuevo dentro de un directorio existente del sistema virtual. */
  public async crear_archivo(
    ruta_directorio_padre: string,
    nombre: string,
    contenido = ''
  ): Promise<Archivo> {
    const ruta_padre_normalizada = this.normalizar_ruta(ruta_directorio_padre);
    await this.validar_directorio_padre(ruta_padre_normalizada);

    const ruta_nuevo_archivo = this.construir_ruta(ruta_padre_normalizada, nombre);
    await this.validar_colision_ruta(ruta_nuevo_archivo);

    const fecha_actual = Date.now();
    const archivo_nuevo: Archivo = {
      nombre: nombre.trim(),
      ruta: ruta_nuevo_archivo,
      ruta_directorio_padre: ruta_padre_normalizada,
      contenido,
      fecha_creacion: fecha_actual,
      fecha_actualizacion: fecha_actual
    };

    const id_archivo = await this.base_datos.archivos.add(archivo_nuevo);
    return { ...archivo_nuevo, id: id_archivo };
  }

  /** Lee un archivo por su ruta absoluta y retorna null si no existe. */
  public async leer_archivo(ruta_archivo: string): Promise<Archivo | null> {
    const ruta_normalizada = this.normalizar_ruta(ruta_archivo);
    const archivo = await this.buscar_archivo_por_ruta(ruta_normalizada);
    return archivo ?? null;
  }

  /** Actualiza el contenido de un archivo existente y su fecha de modificacion. */
  public async actualizar_archivo(ruta_archivo: string, contenido_actualizado: string): Promise<void> {
    const ruta_normalizada = this.normalizar_ruta(ruta_archivo);
    const archivo_actual = await this.buscar_archivo_por_ruta(ruta_normalizada);

    if (archivo_actual === undefined) {
      throw new Error(`No existe el archivo solicitado: ${ruta_normalizada}`);
    }

    // Correccion de tipado estricto: se valida y extrae un id numerico antes de enviarlo a Dexie.
    const id_archivo_actual = this.obtener_id_elemento_para_dexie(archivo_actual.id, ruta_normalizada);

    await this.base_datos.archivos.update(id_archivo_actual, {
      contenido: contenido_actualizado,
      fecha_actualizacion: Date.now()
    });
  }

  /** Lista todos los directorios registrados, ordenados por su ruta absoluta. */
  public async listar_directorios(): Promise<Directorio[]> {
    const directorios = await this.base_datos.directorios.toArray();
    return directorios.sort((directorio_a, directorio_b) => {
      return directorio_a.ruta.localeCompare(directorio_b.ruta);
    });
  }

  /** Lista todos los archivos registrados, ordenados por su ruta absoluta. */
  public async listar_archivos(): Promise<Archivo[]> {
    const archivos = await this.base_datos.archivos.toArray();
    return archivos.sort((archivo_a, archivo_b) => {
      return archivo_a.ruta.localeCompare(archivo_b.ruta);
    });
  }

  /** Elimina un archivo existente por ruta y reporta error si no existe. */
  public async eliminar_archivo(ruta_archivo: string): Promise<void> {
    const ruta_normalizada = this.normalizar_ruta(ruta_archivo);
    const archivo_actual = await this.buscar_archivo_por_ruta(ruta_normalizada);

    if (archivo_actual === undefined) {
      throw new Error(`No existe el archivo solicitado: ${ruta_normalizada}`);
    }

    // Correccion de tipado estricto: se evita pasar number | undefined a delete() de Dexie.
    const id_archivo_actual = this.obtener_id_elemento_para_dexie(archivo_actual.id, ruta_normalizada);
    await this.base_datos.archivos.delete(id_archivo_actual);
  }

  /** Elimina un directorio y todos sus descendientes para que el padre sincronice explorador y editor. */
  public async eliminar_directorio(ruta_directorio: string): Promise<void> {
    const ruta_normalizada = this.normalizar_ruta(ruta_directorio);

    if (ruta_normalizada === '/') {
      throw new Error('No se permite eliminar el directorio raiz.');
    }

    const directorio_actual = await this.buscar_directorio_por_ruta(ruta_normalizada);

    if (directorio_actual === undefined) {
      throw new Error(`No existe el directorio solicitado: ${ruta_normalizada}`);
    }

    // Correccion de tipado estricto: se convierte a number seguro previo a delete() en Dexie.
    const id_directorio_actual = this.obtener_id_elemento_para_dexie(
      directorio_actual.id,
      ruta_normalizada
    );
    const prefijo_descendientes = `${ruta_normalizada}/`;

    await this.base_datos.transaction(
      'rw',
      this.base_datos.directorios,
      this.base_datos.archivos,
      async () => {
        await this.base_datos.archivos.where('ruta').startsWith(prefijo_descendientes).delete();
        await this.base_datos.directorios.where('ruta').startsWith(prefijo_descendientes).delete();
        await this.base_datos.directorios.delete(id_directorio_actual);
      }
    );
  }

  /** Asegura formato de ruta absoluta sin barra final innecesaria. */
  private normalizar_ruta(ruta: string): string {
    const ruta_limpia = ruta.trim();
    const ruta_con_raiz = ruta_limpia.startsWith('/') ? ruta_limpia : `/${ruta_limpia}`;

    if (ruta_con_raiz.length > 1 && ruta_con_raiz.endsWith('/')) {
      return ruta_con_raiz.slice(0, -1);
    }

    return ruta_con_raiz || '/';
  }

  /** Construye una ruta absoluta combinando directorio padre y nombre de elemento. */
  private construir_ruta(ruta_directorio_padre: string, nombre: string): string {
    const nombre_limpio = nombre.trim();

    if (nombre_limpio.length === 0) {
      throw new Error('El nombre del elemento no puede ser vacio.');
    }

    if (ruta_directorio_padre === '/') {
      return `/${nombre_limpio}`;
    }

    return `${ruta_directorio_padre}/${nombre_limpio}`;
  }

  /** Verifica que una ruta no exista previamente como archivo o directorio. */
  private async validar_colision_ruta(ruta_elemento: string): Promise<void> {
    const [archivo_existente, directorio_existente] = await Promise.all([
      this.buscar_archivo_por_ruta(ruta_elemento),
      this.buscar_directorio_por_ruta(ruta_elemento)
    ]);

    if (archivo_existente !== undefined || directorio_existente !== undefined) {
      throw new Error(`Ya existe un elemento en la ruta: ${ruta_elemento}`);
    }
  }

  /** Valida que el directorio padre exista, excepto cuando la ruta padre es la raiz. */
  private async validar_directorio_padre(ruta_directorio_padre: string): Promise<void> {
    if (ruta_directorio_padre === '/') {
      return;
    }

    const directorio_padre = await this.buscar_directorio_por_ruta(ruta_directorio_padre);

    if (directorio_padre === undefined) {
      throw new Error(`No existe el directorio padre: ${ruta_directorio_padre}`);
    }
  }

  /** Busca un archivo por su ruta usando el indice unico de la tabla. */
  private async buscar_archivo_por_ruta(ruta_archivo: string): Promise<Archivo | undefined> {
    return this.base_datos.archivos.where('ruta').equals(ruta_archivo).first();
  }

  /** Busca un directorio por su ruta usando el indice unico de la tabla. */
  private async buscar_directorio_por_ruta(
    ruta_directorio: string
  ): Promise<Directorio | undefined> {
    return this.base_datos.directorios.where('ruta').equals(ruta_directorio).first();
  }

  /** Crea o actualiza un archivo de arranque utilizado por el proyecto base. */
  private async crear_o_actualizar_archivo_base(
    ruta_directorio_padre: string,
    nombre: string,
    contenido: string
  ): Promise<void> {
    const ruta_archivo = this.construir_ruta(ruta_directorio_padre, nombre);
    const archivo_existente = await this.buscar_archivo_por_ruta(ruta_archivo);
    const fecha_actual = Date.now();

    if (archivo_existente !== undefined) {
      // Correccion de tipado estricto: se asegura id numerico para update() del archivo base existente.
      const id_archivo_existente = this.obtener_id_elemento_para_dexie(
        archivo_existente.id,
        archivo_existente.ruta
      );

      await this.base_datos.archivos.update(id_archivo_existente, {
        contenido,
        fecha_actualizacion: fecha_actual
      });
      return;
    }

    await this.base_datos.archivos.add({
      nombre,
      ruta: ruta_archivo,
      ruta_directorio_padre: this.normalizar_ruta(ruta_directorio_padre),
      contenido,
      fecha_creacion: fecha_actual,
      fecha_actualizacion: fecha_actual
    });
  }

  /**
   * Valida el id opcional proveniente de IndexedDB y devuelve un number seguro para operaciones Dexie.
   * Esta funcion centraliza la correccion de TS2345 evitando enviar number | undefined a delete/update/equals.
   */
  private obtener_id_elemento_para_dexie(id_elemento: number | undefined, ruta_elemento: string): number {
    if (id_elemento === undefined) {
      throw new Error(`El elemento no posee id valido para operar en Dexie: ${ruta_elemento}`);
    }

    return id_elemento;
  }
}
