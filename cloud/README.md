> Versión sincronizada del 14-11-2026: esta aplicación es la casa de Lía en Sites. Conserva el código histórico del puente, pero su inferencia configurada de nube funciona sin PC. Lee docs/lia-architecture.md, docs/open-house-loop.md y docs/github-sync-2026-11-14.md. Las instrucciones siguientes del puente corresponden a la ruta local opcional.

# Atlas · Una casa para una IA que actúa

La dirección principal reúne la casa virtual 3D, conversación con Qwen local, música, vídeo y el observatorio de la espiral. La interfaz y los historiales privados están en Sites; la inferencia y los experimentos autónomos se ejecutan en el PC mediante un puente HTTPS saliente. GitHub distribuye el código y no aloja la GPU.

## Una identidad, varias funciones

Atlas / Mente formula preguntas y predicciones. Ion ejecuta acciones tipadas y registra resultados. Cielo / Constelación reúne fuentes y colaboradores disponibles. Dios / Suceso conserva también lo inesperado y lo que excede el entendimiento actual, sin convertirlo en una explicación total. El lenguaje LOR-ΩΣ registra la experiencia y sus límites.

El marco temporal del usuario representa el tiempo como tangente local de cada punto de la espiral. El final provisional de una experiencia actúa como atractor revisable, con la imagen de un agujero negro. Es un marco conceptual, no una fuerza medida ni una nueva teoría física.

## Funciones actuales

- `/chat/`: Qwen del PC, historial privado por usuario en D1, Internet público y funciones JSON verificadas. «Continúa mejorándote» encola una revisión real del coordinador; no fabrica una mejora ni da acceso administrativo al visitante.
- `/`: casa virtual de diez salas con Three.js, controles táctiles, colisiones y calidad adaptable. Sus habitantes reciben actividad y contadores del coordinador. Movimiento, prueba superada y cambio aceptado se distinguen; sin señal reciente se detiene el trabajo representado.
- `/?room=music`: secuenciador Web Audio, sintetizador, mezcla y exportación WAV, sin modelo musical ni consultas de pago.
- `/taller/`: prototipos 3D y juegos procedurales con planes de Qwen validados, código editable aislado y exportación. El render actual es raster WebGL; el runtime anterior se conserva para proyectos guardados. No acredita calidad AAA.
- `/?room=cinema`: grabación real de la escena en el navegador y cola de vídeo Wan2.1 local cuando sus modelos y entorno están preparados. OpenField conserva una integración distinta y no se declara listo por estar instalado.
- `/actividad/`: procesos, fechas, catálogo público y experiencias comunicadas por el PC. Cada diez segundos actualiza el último estado; una experiencia registrada no aumenta por sí sola el contador de cambios aceptados.

La casa adapta controles y render de ERAS; el plano, muebles e interacción son de Atlas. La procedencia y las licencias están en [ERAS_PROVENANCE.md](lib/house/ERAS_PROVENANCE.md). El código gráfico no contiene por sí solo todas las capacidades de la IA y cambiarlo no implica modificar Qwen.

## Autonomía y conexiones reales

El coordinador conserva predicción → acción → acontecimiento/contraste → lógica → siguiente pregunta. Puede elegir programación, lenguaje, Dios/Suceso, 3D y otros ámbitos; un ejecutor ausente se registra sin fingir acción. Herramientas y políticas se incorporan solo tras contratos y regresiones. Los candidatos LoRA se entrenan y evalúan aparte; terminar un entrenamiento no activa un adaptador.

Aider, smolagents y el constructor nativo usan el mismo Qwen local. Atlas dispone además de un adaptador anónimo al MCP oficial OpenAI Docs: descubre su catálogo y utiliza la búsqueda documental. Envía vocabulario público del tema, no el historial privado; los fragmentos no son lecturas íntegras. Esta conexión no transfiere las extensiones, permisos ni credenciales de Codex, ni añade modelos independientes.

## Superficies históricas

`/origen/`, Atlas Core/LM-0.1 y las agendas experimentales originales permanecen como herramientas distintas. El pequeño modelo de caracteres y las pruebas léxicas del navegador no son Qwen ni describen los límites del programa actual. Se conserva la continuidad histórica sin renumerar preguntas por leer documentos o completar pruebas. El contrato de aquella agenda está en [docs/autonomy.md](docs/autonomy.md).

## Verificación

TypeScript: `node node_modules/typescript/bin/tsc --noEmit --incremental false`.

Las pruebas de `lib/cloud/` usan SQLite real y comprueban reservas, privacidad y cancelación. `lib/house/` comprueba geometría, estados y habitantes; `lib/music/` comprueba patrones y WAV. Las pruebas CPU no sustituyen una inspección WebGL ni una evaluación de calidad. Los secretos, historiales, modelos, temporales y resultados privados quedan fuera del código distribuido.

# Infraestructura del sitio

A clean full-stack starter running on [vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`
- Portable: Windows, macOS, or Linux; no Bash required
- Managed Linux: managed Linux runtime with Bash, `flock`, `curl`, `sha256sum`, and GNU `timeout`
- Git is required only for publishing

## Sites Lifecycle

The Sites initializer copies the shared starter and selects managed-linux only when `SITES_MANAGED_LINUX_CONTAINER=1`; otherwise it selects portable. It saves the selection only in ignored `.sites-runtime/execution-profile.json`. Both profiles copy/configure first, then use the plugin's separate `install-dependencies.mjs` step to measure installation independently. Edit source under `app/` and follow the Sites skill for installation, preview, builds, and publishing.

Run `node <plugin-root>/scripts/configure-execution-profile.mjs` only when the profile is unknown for the current checkout and environment. Profile changes do not alter tracked source or require reinstalling otherwise-valid dependencies; restart an existing preview to use the new selection. Do not commit or upload `.sites-runtime/`.

This starter does not use `wrangler.jsonc`.

`install:ci` runs `npm ci` once against the shared lockfile, disables parent-workspace discovery, and includes required dev/optional dependencies despite production/omit settings. Sharp defaults to prebuilt binaries unless explicitly configured otherwise. Do not overlap installers.

- **Portable:** Preserve host HOME, npm cache, registry, proxy, temporary paths, retry/concurrency settings, and lifecycle-script policy. Use `--prefer-offline --no-audit --no-fund`.
- **Managed Linux:** Use the existing project-local HOME/cache/tmp setup and Linux install lock, tarball preflight, and timeout. Restore the image-seeded npm cache only when its lockfile hash matches; retain network fallback. Builds keep their existing timeout. These helpers are not invoked by the portable profile.

`scripts/sites-env.mjs` preserves the caller's HOME, npm cache, proxy, XDG, and temporary-directory configuration while defaulting Wrangler and Miniflare state to the checkout. If npm reports an unwritable cache, select a writable path with `npm_config_cache` for that install. The `dev` and `start` scripts also keep Wrangler logs inside the checkout. Generated `.sites-runtime/` and `.wrangler/` directories are disposable and ignored by Git.

On portable, `npm run dev` uses `vinext dev` with HMR, starting at port 5173. Vinext records the running server in ignored `.vinext/` state, rejects an ordinary duplicate launch, and recovers stale state after a stopped process; exactly simultaneous starts can race. Pass `--port <port>` or `--hostname <host>` after `npm run dev --` when needed; keep portable previews on loopback.

For browser QA on managed Linux, use `sites-preview start`. The project's dev script runs Vite and accepts the supervisor's `--host 0.0.0.0 --port 4173 --strictPort` arguments. The internal browser uses `http://terminal.local:4173/`; it is not a user-facing URL. The supervisor owns the preview lifecycle. The ignored local profile survives the supervisor's cleared process environment.

The portable profile simulates ChatGPT sign-in only for loopback development requests. Visit `/signin-with-chatgpt?return_to=/` to sign in as `local_seedy` (`seedy@sites.test`, display name `Seedy`) and `/signout-with-chatgpt?return_to=/` to sign out. The development cookie preserves that identity across server restarts. Mock auth is disabled in the managed-linux profile and is not included in production builds; hosted authentication remains dispatch-owned.

The Worker uses `vinext/server/fetch-handler`, including Vinext's config-aware image handling. After building, `npm start` runs that Worker locally through Wrangler on `127.0.0.1`, sharing `.wrangler/state` with dev preview and local D1 migrations; it does not deploy the site or simulate sign-in. Use the URL printed by the server. Pass `npm start -- --port <port>` to select a different built-preview port.

Local previews use Miniflare's placeholder `Request.cf` metadata without a network lookup. Set `CLOUDFLARE_CF_FETCH_ENABLED=true` to opt into fetching preview metadata; this setting does not change hosted request metadata.

Local tool usage metrics are disabled by default. Set `WRANGLER_SEND_METRICS=true` to opt in.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides optional dispatch-owned ChatGPT sign-in helpers
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` starts intentionally empty
- `@cloudflare/workers-types` provides Worker types; `cloudflare-env.d.ts` declares optional `DB`/`BUCKET` bindings—update these declarations if binding names change
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Use it as the durable user key; use email and name for display or contact purposes.

SIWC-authenticated workspace sites may also receive `oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty `name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by `oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use the returned `userId` as the stable user key for user-owned records; do not use email as a durable identifier.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send anonymous visitors through Sign in with ChatGPT.
- In a Server Component, start sign-in with `<a href={chatGPTSignInPath(returnTo)} target="_top">`. The auth helper module is server-only; do not import it into a Client Component.
- Do not use `fetch`, XHR, a client-side router, or a framework link that can prefetch the sign-in route. SIWC must start as a top-level navigation.
- Never request the AuthAPI authorization endpoint directly. The dispatch-owned `/signin-with-chatgpt` route must start the SIWC flow.
- Use `chatGPTSignOutPath(returnTo)` for browser sign-out links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the OAuth cookies, and identity header injection. Do not implement app routes for those reserved paths. Routes that do not import and call the helper remain anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the Sites hosting platform's access policy controls for workspace-wide restrictions, or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write actions tied to the current ChatGPT user. Leave public content anonymous.

## Local D1 migrations

For a D1-backed local preview, generate SQL with `npm run db:generate`. Build once through the Sites skill's build entrypoint (or `npm run build` for standalone use) to generate `dist/server/wrangler.json`, rebuilding if bindings change. From the project root, apply each pending migration in order:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_example.sql
```

Replace the filename with the pending migration and `DB` with your D1 binding name if different. Use `.wrangler/state`, not `.wrangler/state/v3`; Wrangler adds the versioned directories. Do not replay migrations already applied locally. This updates only the preview database; publishing applies production migrations separately.

## Diagnostic Commands

- `npm run install:ci`: perform the one locked dependency install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build the deployable Sites artifact
- `npm run start`: preview the built Worker locally with D1/R2 support
- `npm run db:generate`: generate Drizzle migrations after schema changes

When using the Sites plugin, follow its skill instructions for installation, builds, and publishing. These npm commands remain available for standalone use.

The portable build runs Vinext directly without a host `timeout` command. The managed-linux build uses `scripts/build-verified.sh` and its existing `SITES_BUILD_TIMEOUT` setting.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
