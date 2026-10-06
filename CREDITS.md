# Créditos y licencias

Todo el material de terceros es gratuito y de uso libre. Las atribuciones se listan aunque la licencia no las exija.

## Modelos 3D

| Recurso | Autor | Licencia | Uso |
|---|---|---|---|
| Stylized Nature MegaKit (versión gratuita): `CommonTree_1`, `CommonTree_3`, `Pine_2`, `Pine_5`, `Bush_Common`, `Rock_Medium_1` | [Quaternius](https://quaternius.com) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Vegetación del gemelo digital del campus |

Los originales están en `assets-src/nature/` junto con su archivo de licencia. `npm run models` los optimiza hacia `apps/web/public/models/` con `gltf-transform` (compresión meshopt, texturas webp de 256 px y geometría simplificada): de 36,6 MB a 426 KB en total.

Los edificios del campus y el mobiliario de los salones se generan por código a partir de la base de datos (`Block`, `Space` y `ROOM_DIMENSIONS`), sin modelos externos.

## Íconos e ilustraciones

- [Lucide](https://lucide.dev), licencia ISC. Único set de íconos de la interfaz, centralizado en `apps/web/src/ui/icons.ts`.
- La marca y las ilustraciones de los estados vacíos son SVG propios.

## Fuentes

Distribuidas con `@fontsource`, licencia SIL Open Font License 1.1:

- Space Grotesk (títulos)
- Inter (texto)
- JetBrains Mono (códigos, tiempos y puntajes)

## Datos y bibliotecas

- `detect-gpu` (MIT): los benchmarks se sirven localmente desde `apps/web/public/gpu-benchmarks/` para no depender de una CDN.
- Modelo opcional de embeddings `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (Apache 2.0), ejecutado localmente con `@huggingface/transformers`.

No se usa el logo institucional de UNIMINUTO.
