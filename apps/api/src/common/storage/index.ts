import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { env } from '../env';

export interface StoredObject {
  /** URL pública cuando el archivo vive fuera de la base. */
  url: string | null;
  /** Bytes a guardar en la fila de Evidence cuando el driver es la base de datos. */
  data: Buffer | null;
}

export interface StorageDriver {
  readonly name: string;
  put(buffer: Buffer, extension: string): Promise<StoredObject>;
}

class LocalStorage implements StorageDriver {
  readonly name = 'local';
  private ready: Promise<unknown> | null = null;

  async put(buffer: Buffer, extension: string): Promise<StoredObject> {
    this.ready ??= mkdir(env.uploadDir, { recursive: true });
    await this.ready;
    const fileName = `${randomUUID()}.${extension}`;
    await writeFile(join(env.uploadDir, fileName), buffer);
    return { url: `/uploads/${fileName}`, data: null };
  }
}

/** Para Render u otros discos efímeros: la imagen comprimida se guarda en Postgres. */
class DatabaseStorage implements StorageDriver {
  readonly name = 'database';
  async put(buffer: Buffer): Promise<StoredObject> {
    return { url: null, data: buffer };
  }
}

export const storage: StorageDriver = env.STORAGE_DRIVER === 'database' ? new DatabaseStorage() : new LocalStorage();
