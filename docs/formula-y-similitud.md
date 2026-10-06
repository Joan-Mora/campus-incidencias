# Fórmula de prioridad y criterio de similitud

Contenido de la diapositiva técnica. Todos los números salen de `packages/shared/src/domain/`, el mismo código que usan la API y la vista previa del celular.

## 1. Prioridad ponderada

```
P = 0,35 R + 0,25 T + 0,20 S + 0,10 E + 0,10 A        (cada variable de 0 a 100)
```

| Variable | Qué mide | Valores |
|---|---|---|
| R, riesgo para las personas | Lo que percibe quien reporta; el sistema sugiere uno según la categoría y el supervisor puede corregirlo | Ninguno 0, Bajo 30, Medio 60, Alto 100 |
| T, tipo de daño | Gravedad típica de la categoría | Eléctrico 100, Fuga de agua 80, Estructural 70, Sanitario 60, Iluminación 50, Mobiliario 40, Estético 15 |
| S, reportes similares | Cuántas personas reportaron el mismo daño | `25 * log2(n + 1)`, crece rápido con los primeros y se satura en 100 |
| E, impacto del espacio | Cuánta gente se afecta | Laboratorio 100, Aula 90, Baño 80, Zona común 60, Oficina 40, más hasta 10 puntos por capacidad |
| A, antigüedad | Porción consumida del SLA de resolución | 0 al crear, 100 al vencer |

Niveles: **Crítica** desde 75, **Alta** desde 50, **Media** desde 25, **Baja** por debajo.

No hay reglas por palabra clave: dos reportes con el mismo texto pueden quedar en niveles distintos si cambian el espacio, el riesgo o la cantidad de personas afectadas.

### Ejemplo numérico

Una gotera en el Aula 202 (aula para 35 personas), riesgo medio, ya reportada por 3 personas y con la mitad de su SLA consumido:

| Variable | Valor | Peso | Aporte |
|---|---|---|---|
| R, riesgo medio | 60 | 0,35 | 21,0 |
| T, fuga de agua | 80 | 0,25 | 20,0 |
| S, 3 reportes: 25 * log2(4) | 50 | 0,20 | 10,0 |
| E, aula 90 + 3,5 por capacidad | 93,5 | 0,10 | 9,4 |
| A, 50 % del SLA consumido | 50 | 0,10 | 5,0 |
| **P** | | | **65,4: Alta** |

## 2. SLA doble y escalamiento

| Nivel | Primera respuesta | Resolución |
|---|---|---|
| Crítica | 1 h | 4 h |
| Alta | 4 h | 24 h |
| Media | 12 h | 72 h |
| Baja | 48 h | 7 días |

- Mientras está **Pendiente** corre el SLA de respuesta; en **En proceso**, el de resolución.
- Al 80 % del plazo se avisa a supervisores y técnicos.
- Al vencer, la incidencia se marca como **vencida** y **sube un nivel**. El escalamiento se suma al nivel que da la fórmula, sin reemplazarla: la fórmula mide la gravedad y el escalamiento castiga la demora.
- Siguiendo el ejemplo: si nadie toma la gotera en 4 horas, pasa de Alta a **Crítica**, su nuevo plazo de resolución es de 4 horas y en el campus 3D su baliza empieza a latir en rojo.

## 3. Similitud entre reportes

```
sim = 0,35 Ubicación + 0,15 Categoría + 0,40 Texto + 0,10 Tiempo
```

| Criterio | Cómo se calcula |
|---|---|
| Ubicación | Mismo salón y puntos a menos de 2 m en el modelo 3D: 1. Mismo salón: 0,8. Mismo bloque y piso: 0,5. Mismo bloque: 0,3. Misma sede: 0,1 |
| Categoría | Igual: 1. Relacionadas (eléctrico e iluminación, fuga y sanitario, estructural y fuga): 0,5 |
| Texto | Coseno TF-IDF sobre el texto normalizado (sin tildes, sin palabras vacías, con raíces en español). Con embeddings activados se usa el mayor entre TF-IDF y el modelo multilingüe local |
| Tiempo | `e^(-horas / 72)`: dos reportes del mismo día pesan más que dos de semanas distintas |

Decisión:

- **75 % o más:** se agrupan solos. El reporte nuevo se suma al grupo, la madre conserva el trabajo y su prioridad sube por el factor S.
- **Entre 55 % y 75 %:** se crea una sugerencia y el supervisor decide en `/sugerencias` con el desglose a la vista.
- **Menos de 55 %:** se tratan como daños distintos.

Antes de enviar, el celular corre la misma comparación y le ofrece al estudiante sumarse a un reporte parecido.

### Ejemplo numérico

Reporte nuevo: "Se filtra agua por la pared del fondo y el piso quedó mojado", Aula 202.

| Candidato | Ubicación | Categoría | Texto | Tiempo | Similitud | Decisión |
|---|---|---|---|---|---|---|
| INC-00033, mismo salón, a 1,8 m | 1 x 0,35 | 1 x 0,15 | 0,70 x 0,40 | 0,63 x 0,10 | **84 %** | Se agrupa solo |
| INC-00047, mismo bloque, otro piso | 0,3 x 0,35 | 1 x 0,15 | 0,70 x 0,40 | 0,90 x 0,10 | **62 %** | Sugerencia al supervisor |

El mismo texto da resultados distintos según dónde ocurrió: por eso la ubicación en el salón 3D pesa tanto como el texto.
