import { env } from '../../common/env';

const MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

type Extractor = (text: string, options: { pooling: 'mean'; normalize: boolean }) => Promise<{ data: Float32Array }>;

let extractor: Promise<Extractor> | null = null;
let unavailable = false;

export function embeddingsActive() {
  return env.SIMILARITY_EMBEDDINGS && !unavailable;
}

/**
 * Embedding de 384 dimensiones calculado en el propio servidor con transformers.js.
 * Si el paquete o el modelo no están disponibles, devuelve null y el sistema sigue con TF-IDF.
 */
export async function embed(text: string): Promise<number[] | null> {
  if (!embeddingsActive() || !text.trim()) return null;
  try {
    extractor ??= (async () => {
      const moduleName = '@huggingface/transformers';
      const transformers = (await import(/* @vite-ignore */ moduleName)) as {
        pipeline: (task: string, model: string) => Promise<Extractor>;
      };
      return transformers.pipeline('feature-extraction', MODEL);
    })();
    const run = await extractor;
    const output = await run(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  } catch (error) {
    unavailable = true;
    console.warn(
      `Embeddings desactivados: no se pudo cargar ${MODEL}. Instala @huggingface/transformers en apps/api para usarlos.`,
      (error as Error).message,
    );
    return null;
  }
}
