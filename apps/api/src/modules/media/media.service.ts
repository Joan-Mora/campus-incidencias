import sharp from 'sharp';
import { badRequest } from '../../common/errors';
import { storage } from '../../common/storage';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface ProcessedImage {
  url: string | null;
  data: Buffer | null;
  width: number;
  height: number;
  mime: string;
}

/**
 * Re-codifica la imagen a WebP: limita el tamaño, corrige la orientación y descarta
 * todos los metadatos (EXIF y GPS) porque sharp no los copia salvo que se pida.
 */
export async function processImage(buffer: Buffer, mime: string): Promise<ProcessedImage> {
  if (!ALLOWED_MIME.has(mime)) throw badRequest('Formato no permitido: usa JPG, PNG o WebP', 'file');
  if (buffer.length > MAX_UPLOAD_BYTES) throw badRequest('La imagen supera el tamaño máximo de 5 MB', 'file');

  let output: { data: Buffer; info: sharp.OutputInfo };
  try {
    output = await sharp(buffer, { failOn: 'error' })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw badRequest('El archivo no es una imagen válida', 'file');
  }

  const stored = await storage.put(output.data, 'webp');
  return { ...stored, width: output.info.width, height: output.info.height, mime: 'image/webp' };
}
