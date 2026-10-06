# Guion de la demo

Duración objetivo: 6 a 7 minutos. Tres pantallas: el proyector, un portátil con el centro de mando y un celular.

## Preparación (antes de presentar)

1. En `.env` deja `SLA_TIME_SCALE=60` (una hora de SLA dura un minuto) y `ALLOW_DEV_LOGIN=true`.
2. `npm run db:seed` para partir de datos limpios con una semana de historia.
3. `npm run dev:phone` para tener HTTPS en la red local (la cámara y el micrófono del celular lo exigen).
4. Proyector: abre la web con `?view=projector`. Muestra el campus 3D a pantalla completa y un QR.
5. Portátil: entra como **Supervisor** en la vista de escritorio.
6. Celular: escanea el QR del proyector, acepta el certificado local y entra como **Estudiante**.
7. Ten a mano una segunda pestaña en el portátil para correr `npm run simulate` cuando llegue el momento.
8. Ensaya una vez el QR de un salón: imprime o muestra en otra pantalla el código de `pri-a-202` (Aula 202, Bloque A).

## 1. El campus vivo (45 s), en el proyector

- "Esto es el campus en tiempo real. Cada baliza es un daño abierto y su color es la prioridad."
- Señala una baliza roja que late: está vencida.
- Señala un arco entre una baliza grande y una pequeña: son reportes que el sistema agrupó porque describen el mismo daño. La pequeña se sumó a la grande.
- En el portátil cambia a **Calor**: cada bloque levanta una columna según cuántos daños concentra.

## 2. Reportar desde el celular (90 s)

1. Toca **Escanear QR del salón** y apunta al código del Aula 202. El asistente salta directo al paso 2.
2. En el salón 3D, gira con el dedo y toca la pared del fondo cerca del punto rojo existente. Aparece el aviso "Muy cerca ya hay un reporte abierto".
3. Elige **Fuga de agua**; el riesgo se sugiere solo en **Medio**.
4. Toca el micrófono y dicta: "se filtra agua por la pared del fondo y el piso quedó mojado".
5. Aparece "Parece que ya lo reportaron". Abre la hoja y muestra el desglose: mismo salón a menos de 2 m, misma categoría, texto similar.
6. En la confirmación, señala el medidor y el desglose de la fórmula: "el estudiante ve por qué su reporte tiene esa prioridad antes de enviarlo".
7. Toca **Sumarme a este reporte** o **Enviar reporte**.

## 3. El centro de mando reacciona (45 s), en el proyector y el portátil

- En el proyector aparece la baliza del reporte, unida por un arco al caso que ya existía, y el ticker muestra el nuevo caso.
- En el portátil, la cola se reordena y la fila sube con un destello si cambió de nivel.
- Abre el detalle: pestaña **Grupo** con la similitud de cada reporte; pestaña **Resumen** con el punto exacto en el salón 3D.

## 4. Muchos reportes a la vez (45 s)

- Corre `npm run simulate -- --interval 4` en la segunda pestaña.
- "Así se ve un día real: varias personas reportan lo mismo con otras palabras." En la consola se lee `nuevo`, `agrupado` o `madre de 3`, y en el proyector aparecen balizas y arcos.
- Abre `/sugerencias`: los casos dudosos (entre 55 % y 75 %) esperan la decisión del supervisor con el desglose lado a lado.

## 5. El SLA aprieta (60 s)

- Con el reloj acelerado, en menos de un minuto llega el aviso "está por vencer" (80 % del plazo) al celular de los técnicos y al panel.
- Al vencer, la incidencia se marca como **vencida**, sube un nivel y su baliza late en rojo. En la cola aparece la insignia de escalamiento.
- Explica la regla: "la fórmula mide la gravedad; la demora sube el nivel encima de la fórmula, nunca la reemplaza".

## 6. Atender y cerrar (75 s)

1. En el celular, cierra sesión desde el menú de cuenta y entra como **Técnico**. En **Bandeja**, desliza una tarjeta a la derecha para tomar el caso.
2. Abre la incidencia, toma la foto del arreglo y marca **Resuelto**. Sin foto ni nota del arreglo el sistema no lo permite; un estudiante ni siquiera ve ese botón.
3. Verifica el arreglo. En el portátil, en `/tablero`, el supervisor arrastra la tarjeta a **Verificado**: confeti. Si el caso es del estudiante con el que reportaste, también aparece en su **Mis reportes** como "Esperan tu confirmación", con el botón **Sí, quedó bien**.
4. En el portátil, abre la pestaña **Historia** del caso: cada etapa con su duración.

## 7. La semana completa (30 s), en el proyector

- En la barra inferior del campus, arrastra la línea de tiempo al inicio y reproduce a 24 h por segundo.
- "Así se acumularon y se atendieron los daños de la semana: qué bloques concentran los problemas y cuánto tardamos."
- Cierra en `/panel`: vencidas, tiempo de resolución por prioridad, espacios con más reportes y mapa de calor.

## Si algo falla

| Problema | Salida |
|---|---|
| La cámara no abre | Escribe el código `pri-a-202` en el campo manual del escáner |
| El dictado no está disponible | Escribe la descripción; el resto del flujo es igual |
| El equipo del proyector no tiene GPU | La vista cambia sola al plano isométrico SVG con la misma información |
| Se cae la red del celular | El reporte queda en la cola sin conexión y se envía solo al volver |
| Hay que repetir la demo | `npm run db:seed` deja todo como al inicio |
