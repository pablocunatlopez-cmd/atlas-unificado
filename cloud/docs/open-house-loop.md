# Trabajo mientras la casa está abierta

La casa de Lía activa turnos reales al iniciar sesión y mantener la pestaña visible. Cada pulso de unos diez segundos reparte dos oficios de los habitantes y una sala o sistema. Los 24 habitantes reciben un turno en doce pulsos cuando no hay bloqueo. Esto es reparto de trabajo, no una medida de inteligencia.

La consulta documental y de colaboradores tiene una puerta separada de dos minutos, con rotación propia de especialidades y propósito automático. Conserva el límite de 48 llamadas automáticas dentro del total de 60 al día UTC. Cuando se agota la cuota, las herramientas de CPU pueden seguir trabajando; la interfaz conserva la espera de la IA. No se crean compras ni proveedores nuevos.

Sigma, llamado Siggy por el propietario y confirmado expresamente en esta conversación, conserva el identificador `language-symbol`. Los resultados reales de investigación activan su recorrido: puesto → cielo/Ícaro → especialista destinatario → puesto. Los caminos usan las colisiones y puertas existentes. Los recibos tienen caducidad, deduplicación y contrapresión. Un recorrido representa trabajo registrado; no añade hechos, ejecución ni aprendizaje.

## Resultados disponibles

- Música: un borrador procedural reproducible por autor, válido y editable. Cargarlo en el estudio requiere pulsar el botón y permite deshacer; no sustituye el proyecto del usuario por sí solo.
- Audio: medición y procesamiento de una señal estéreo de prueba. La demostración elimina DC y recorte; no atribuye escucha musical ni aplica efectos ocultos al audio personal.
- Vídeo: guion acotado de planos y duración, ofrecido en Cine. Grabar exige pulsar el botón y soporte del navegador; no se activa automáticamente.
- LOR: doce campos y seis fases originales, contratos lógicos y ejemplos ejecutados. No utiliza una cola GPU inexistente.
- Herramientas: ejecución de la biblioteca y, cuando corresponde y hay cuota, generación y prueba de programas acotados. La instalación solo se comunica después de persistirla bajo lease de investigación.
- Gráficos: el laboratorio espacial existente puede aplicar una mejora medible y acotada de una obra. Cambiar módulos completos de programación o gráficos requiere la tarea de ingeniería de nube y su publicación en Sites.

Los cambios repetidos, las variantes artísticas y los contratos de contexto no se contabilizan como mejoras de calidad. El informe de evidencia incorpora los validadores publicados en GitHub; `consistent_report` sigue significando un informe coherente, no verificación independiente. Las revisiones anteriores de artefactos se conservan y `/api/house-work` permite recuperar una versión mediante `rollback` por tipo.

## Ciclo y concurrencia

El servidor fija el turno y el siguiente instante posible. Una lease impide que dos pestañas ejecuten el mismo pulso; los reintentos reutilizan la petición. El cliente comunica una sesión y una época de visibilidad monotónica. Al ocultar, cerrar o desmontar comunica el cierre por beacon; una solicitud antigua no puede reabrir una sesión cerrada. La sesión caduca a los 45 segundos si el aviso no llega. Se comprueba entre etapas. Una petición a un proveedor ya iniciada puede terminar, pero no habilita una nueva etapa después del cierre.

Las memorias de personaje, sala y módulo reciben el resultado con procedencia, separado de las conclusiones factuales. Si otra investigación tiene la lease, se conserva una sincronización pendiente y se reintenta. Los recibos recientes tienen retención acotada de 2.000 pulsos; el historial de versiones y las memorias tienen sus propios límites.

## Cola de ingeniería

GET `/api/house-work` expone `engineeringQueue`: encargos que requieren inspeccionar y modificar código completo. La tarea de nube debe leer esta cola junto con las consultas. Solo después de pruebas, push y despliegue satisfactorio puede comunicar `{action:'record-engineering',actorId,receipt:{project_id,commit_sha,version_id,summary,checks}}`. El recibo es un reporte del flujo autenticado; no una consulta directa del Worker a Sites.

La observación visual WebGL/GPU no se ha realizado en este entorno. Las pruebas automatizadas verifican herramientas, guardias de concurrencia, visibilidad, memoria, identidades y rutas; no certifican belleza, comodidad ni FPS en el dispositivo.
