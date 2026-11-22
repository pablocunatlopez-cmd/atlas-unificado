# Atlas local llama.cpp adapter (CPU first)

The adapter in `continuous/atlas-local-llama-client.mjs` can call an already
running llama.cpp OpenAI-compatible HTTP server on localhost. It does not
install a model, download weights, start a server, or claim benchmark results.

## Operator setup
1. Install a trusted llama.cpp build from https://github.com/ggml-org/llama.cpp
2. Choose a small compatible GGUF model based on measured free RAM. Review
   model provenance, license and checksums before downloading.
3. Start llama-server bound to 127.0.0.1, e.g.
   `llama-server -m /path/to/model.gguf --host 127.0.0.1 --port 8080 -c 2048 -ngl 0`
4. From trusted Atlas host code call `queryAtlasLocalLlama({messages:[{role:'user',content:'Hola'}]})`.
5. Do not expose the port on a public interface. For remote Atlas access,
   use an authenticated tunnel or gateway rather than forwarding port 8080.

The adapter caps input and requested output and rejects non-loopback endpoint
strings. This is **not** a network sandbox: a compromised local service or
runtime could still create risks. Host authentication, OS isolation and
resource measurements remain future work.

Next: actual hardware probe, benchmark harness, voice-to-text adapter and
Web Audio/ERAS sound emitter integration.
