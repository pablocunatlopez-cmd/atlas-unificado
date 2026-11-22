# Atlas P0 — revisión del gate de autorización (16-11-2026)

## Evidencia de código
Se inspeccionaron `continuous/atlas-agent-change-gate.mjs` y `continuous/atlas-agent-change-gate.test.mjs` en `main`, además de `.github/workflows/atlas-tests.yml`.

## Hallazgo P0: una afirmación del llamante puede parecer una autorización del host
`evaluateAtlasAgentChange` acepta `approval.verifiedByHost === true`, un `principal` no vacío y `proposalId === id` para devolver `readyForReview: true` cuando las comprobaciones proporcionadas por el llamante también son `true`. Esta función es un **evaluador puro**, no un verificador criptográfico ni una frontera de autorización. La prueba actual construye esos campos directamente y espera `true`. Por tanto, un llamante que controle `approval` y `checks` puede producir un resultado positivo **sin demostrar** una atestación externa. Esto **no prueba** que exista una ruta de explotación remota ni que el resultado se utilice para ejecutar/publicar: hay que auditar los consumidores.

### Reproducción estática
```js
evaluateAtlasAgentChange({
  id: 'demo',
  actions: [{kind: 'write', target: 'continuous/example.mjs'}],
  checks: {syntax: true, unit: true, security: true},
  approval: {verifiedByHost: true, principal: 'user', proposalId: 'demo'}
}).readyForReview // true por contrato actual
```

## Corrección propuesta (no aplicada aún)
1. Localizar todos los consumidores y separar claramente el estado **propuesto para revisión** del permiso **autorizado para ejecutar**.
2. No aceptar atestaciones ni resultados de pruebas controlados por el agente como prueba de seguridad.
3. Vincular el permiso a principal autenticado, operación, hash del diff, SHA de base, nonce y caducidad; verificarlo en el host confiable, con protección contra replay.
4. Añadir pruebas negativas para suplantación, cambios de diff, caducidad, reutilización y fallo de verificación.
5. Mantener los cambios en una rama y exigir CI verde antes de merge.

## CI
El workflow configura Node 22.20.0, `npm ci --ignore-scripts`, comprobación de sintaxis y `npm test`. La ejecución del PR #9 estaba **en curso** al consultar Actions; no se declara éxito.

## Estado
Inspección estática: completada. Explotabilidad: no determinada. Corrección funcional y pruebas adversariales: pendientes. No desplegado.
