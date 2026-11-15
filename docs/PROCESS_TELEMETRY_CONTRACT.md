# Contracto de telemetría de procesos de la casa

## Propósito y límite

Este documento define cómo interpretar la telemetría que la casa ya consulta desde `/api/cloud/status`. La telemetría permite representar el estado comunicado por el coordinador; no demuestra por sí sola que un modelo haya respondido correctamente ni que una mejora se haya integrado.

La UI puede decir **En ejecución** solo si el proceso declara `running`, existe una marca de tiempo válida, la señal no está desconectada y el dato tiene menos de 75 segundos. La falta de datos, una marca de tiempo futura o una señal antigua deben mostrarse como **En espera / Sin señal reciente**. Una animación nunca autoriza el estado.

**Versión de contrato cliente:** `TELEMETRY_CONTRACT_VERSION = 1` en `cloud/public/house/process-state.js`.

## Esquema recibido actualmente

El normalizador de `cloud/public/house/process-state.js` acepta hasta 32 procesos con:

```ts
type ProcessState = {
  at: string | null;
  connected: boolean;
  contractVersion?: number;
  processes: Array<{
    id: string;
    room: string;
    state: 'idle' | 'running' | 'passed' | 'failed' | 'waiting';
    label?: string;
    phase?: 'observe' | 'understand' | 'connect' | 'apply' | 'refute' | 'retain';
    counters?: {
      observations?: number;
      trials?: number;
      accepted?: number;
      rejected?: number;
    };
  }>;
};
```

Los identificadores y salas se limitan a valores conocidos, las etiquetas se acotan y los contadores deben ser enteros seguros dentro del rango permitido. No se admiten instrucciones, scripts ni URLs de la telemetría como contenido ejecutable.

## Razones explícitas (P2)

`telemetryFreshness()` y `processForRoom` / `processForResident` devuelven un `reason` cerrado:

| reason | Presentación | Cuándo |
| --- | --- | --- |
| `fresh` | Señal reciente | Edad ≤ 75 s y puente conectado |
| `stale` | Sin señal reciente | Edad > 75 s |
| `invalid_time` | Señal con hora no válida | Timestamp ausente, malformado o futuro |
| `disconnected` | Puente desconectado | `connected === false` |
| `no_process` | Sin telemetría | No hay proceso para la sala/residente |
| `wrong_phase` | En espera de su fase | `running` pero fase no aplica al puesto |
| `local_only` | Disponible · local | Puesto sin `processIds` (p. ej. música) |
| `reported` | Estado reportado | Estado no-running con señal usable |

La UI debe preferir `displayState` / `REASON_LABELS[reason]` frente a inventar texto. `workVerified` solo es true con `running` + señal fresca (+ fase pertinente en residentes).

## Interpretación de estados

| Estado | Presentación | Significado permitido |
| --- | --- | --- |
| `idle` | En reposo | El coordinador reporta que no hay tarea activa. |
| `waiting` | En espera | No hay tarea activa o el proceso espera una condición. |
| `running` | En ejecución | Solo con señal conectada, marca temporal válida y reciente, y fase pertinente para el residente. |
| `passed` | Resultado reportado | El coordinador reporta un resultado satisfactorio; no equivale a integración ni a verificación independiente. |
| `failed` | Fallo reportado | El coordinador reporta un fallo/refutación; mostrarlo como registro comunicado, no como prueba independiente sin artefacto. |

Si el proceso desaparece de la telemetría, la señal expira o se pierde el enlace, no se debe presentar el último resultado o contador como actual ni inferir actividad a partir de la animación. La casa vuelve a un estado desconocido/en espera, incluso para resultados terminales.

## Evidencia necesaria para declarar una mejora de Lía

El esquema actual **no incluye una referencia de evidencia tipada**. Por tanto, ni `passed` ni el contador `accepted` bastan para afirmar en UI que un artefacto quedó verificado o integrado. La cifra aceptada debe describirse como contador reportado por el coordinador, no como verificación autónoma.

Antes de poder mostrar **Verificado** o **Integrado en Lía**, el servicio deberá emitir un registro de resultado con al menos:

- `taskId` y `processId` estables;
- `artifactId` y revisión/hash de origen;
- `completedAt` y resultado de pruebas;
- identificadores/versiones de las pruebas y criterios aplicados;
- referencia opaca y autorizada a los logs/resultados (no una URL arbitraria renderizada sin validación);
- resultado explícito de comparación con la versión estable y, si se integra, referencia al commit/revisión de destino;
- motivo acotado para espera o fallo.

El servicio que ejecuta y valida la tarea debe ser la fuente de esos datos. La UI solo los muestra; nunca los crea a partir de movimiento, narrativa, estado del navegador o respuestas del modelo.

La casa muestra el panel de registros tipados al abrir los detalles de una sala. La validación de forma del contrato v1 y una revisión de integración citada son declaraciones del puente, no autenticación independiente de las pruebas ni confirmación de integración. Por ello se muestran como reportadas; `verified` e `integrated` no se afirman con este contrato. Un fallo o rechazo también se presenta como reportado, y la ausencia o un error de consulta permanece desconocido.

## Compatibilidad y siguiente trabajo

Mantener el formato actual mientras la API del coordinador no publique evidencia. Al extenderlo:

1. versionar el esquema (`TELEMETRY_CONTRACT_VERSION`);
2. validar el objeto en el servidor y volver a limitar su representación en cliente;
3. añadir expiración, límites y pruebas de datos ausentes, antiguos, futuros, malformados y de estado cruzado;
4. no convertir `passed` en `verified` hasta que exista evidencia tipada y se compruebe su procedencia;
5. mantener un estado desconocido/en espera cuando falle cualquier comprobación.

Este contrato documenta el límite entre telemetría y evidencia; no afirma que el ciclo de ejecución autónoma o la integración continua estén implementados.
