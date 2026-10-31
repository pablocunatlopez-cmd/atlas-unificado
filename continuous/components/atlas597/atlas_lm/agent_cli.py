from __future__ import annotations

import argparse
from pathlib import Path

from .agent_runtime import AtlasAgentRuntime


def main():
    ap = argparse.ArgumentParser(description="Atlas Agent: ejecuta tareas verificables localmente")
    ap.add_argument("task", nargs="*", help="Tarea a ejecutar")
    ap.add_argument("--root", default=".", help="Directorio base del agente")
    args = ap.parse_args()

    task = " ".join(args.task).strip()
    if not task:
        task = "Crea un archivo llamado atlas_agent_demo.txt con el contenido 'hola atlas'"

    runtime = AtlasAgentRuntime(root=Path(args.root))
    print(runtime.plan(task))
    print(runtime.run_task(task))


if __name__ == "__main__":
    main()
