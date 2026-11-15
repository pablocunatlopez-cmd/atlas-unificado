# Verificación en el PC (`continuous/`)

| Acción | Comando / doc |
| --- | --- |
| Contratos offline (evidencia + gate P3) | `node verify-local-contracts.mjs` |
| Publicar última auditoría a Sites | `node publish-report-evidence.mjs` |
| Cómo se genera la evidencia | `TYPED_EVIDENCE_HOOK.md` |
| Ciclo en vivo (flags, opt-in) | `SESSION_LIVE_WORK.md` |
| Checklist tras publicar el site | [docs/VERIFY_AFTER_DEPLOY.md](../docs/VERIFY_AFTER_DEPLOY.md) |

Orden recomendado:

1. `node verify-local-contracts.mjs` → debe imprimir `"ok":true`.
2. Publicar Sites desde `main`.
3. Reiniciar coordinador + puente.
4. Seguir el checklist de deploy.
5. Solo entonces valorar `ATLAS_LIVE_CYCLE_ENABLED=1`.

No actives el ciclo en vivo solo porque los tests offline pasen.
