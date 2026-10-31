from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from atlas_lm.agent_runtime import AtlasAgentRuntime
from atlas_lm.game_generator import AtlasGameGenerator


class AtlasAgentSuite:
    """Sistema conjunto de agente, generador de juego y validación local."""

    def __init__(self, root: str | Path | None = None):
        self.root = Path(root) if root is not None else Path.cwd()
        self.root.mkdir(parents=True, exist_ok=True)
        self.agent = AtlasAgentRuntime(root=self.root)
        self.game = AtlasGameGenerator(project_root=self.root)

    def handle(self, prompt: str, session_id: str = "default") -> dict[str, Any]:
        prompt_text = (prompt or "").strip()
        if not prompt_text:
            return {"status": "failed", "reason": "Prompt vacío"}

        lower = prompt_text.lower()
        if any(token in lower for token in ["juego", "game", "videojuego", "mapa", "mision", "ciudad", "sandbox"]):
            game_result = self.game.generate_project(prompt_text)
            agent_result = self.agent.respond(prompt_text, session_id=session_id)
            return {
                "status": "completed",
                "mode": "game_design",
                "game": game_result,
                "agent": agent_result,
            }

        result = self.agent.respond(prompt_text, session_id=session_id)
        return {
            "status": result.get("status", "completed"),
            "mode": "assistant",
            "answer": result.get("answer"),
            "session_id": session_id,
        }

    def run_demo(self) -> dict[str, Any]:
        prompt = "Crea un juego urbano original, con tres distritos, tráfico, misión principal y estilo moderno nocturno"
        return self.handle(prompt, session_id="demo")


if __name__ == "__main__":
    suite = AtlasAgentSuite()
    print(json.dumps(suite.run_demo(), ensure_ascii=False, indent=2))
