# Mediana: evitar pérdida de valores subnormales

22-11-2026. Base Atlas v64, f8b54afb7530663a7406c51b85a582c0e870568e. Corrección distinta de la suma compensada anterior: no se cuenta aquella reparación otra vez como novedad.

Defecto reproducido: stats([Number.MIN_VALUE,Number.MIN_VALUE]) daba min=max=5e-324 y median=0. Para [MIN_VALUE,2*MIN_VALUE] daba MIN_VALUE en vez del punto medio redondeado 2*MIN_VALUE. Dividir cada extremo por dos antes de sumar pierde información en el rango subnormal.

La nueva mediana par calcula primero pair=lower+upper: si es finito usa pair/2; si desborda usa lower/2+upper/2 como antes. Así evita el subdesbordamiento prematuro sin perder la alternativa que evita overflow. La biblioteca se identifica como atlas-program-tools-3. Conserva suma compensada, formato, entradas finitas, límite128, mediana impar, vacío, errores de total y exportación autocontenida. La instantánea de código se regeneró.

Las tres nuevas pruebas se ejecutaron sobre la base: dos fallaban y una pasaba. Con los mismos datos y tolerancias, ahora pasan. Cubren subnormales iguales y adyacentes, negativos y signos opuestos, mediana grande cuyo par central desborda, datos ordinarios/vacíos y ejecución del código exportado. Las otras 19 comprobaciones de suma, biblioteca, herramientas y evidencia pasan; total22. TypeScript sin emisión pasa. No se modifica el juez ni el baremo.

Fuentes públicas realmente leídas: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MIN_VALUE y https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isFinite . La primera distingue el menor valor positivo representable, la segunda la prueba de finitud sin coerción. La elección de cálculo es una intervención de ingeniería contrastada con casos, no una garantía de exactitud arbitraria. Resultados más pequeños que el mínimo siguen redondeándose y los totales fuera de rango siguen rechazándose.

Consulta icarus-87 de resident:body-console: fuentes guardadas y salida GPT-OSS120B completada, pero rechazada por el contrato de propuesta (PROPOSAL); Qwen quedó unavailable y no se acredita revisión. No se inventa la causa concreta dentro de ese contrato ni se reintenta para obtener aprobación. Se publica, si el despliegue termina correctamente, una reparación manual con pruebas ejecutadas, no una propuesta de modelos revisada. La consulta ordinaria 86 terminó rechazada y no se aplica.

GitHub main inspeccionado en 86b08002ed57a806d3a270f362a326f3ae694dd3, sin sobrescribir trabajo. Atlas e identidades de Lía, historial y memorias se conservan; ERAS mantiene v13. No hay cambio gráfico, musical, de proveedor, de cuota ni de pesos. El encargo anterior de body-console ya fue cerrado con otra revisión: no se sobrescribe su recibo de house-work ni se pretende cerrar dos veces la misma cola. El recibo nuevo corresponde a icarus-87 y a la revisión final realmente desplegada.
