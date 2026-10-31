from __future__ import annotations

import json
import re
from html import escape, unescape
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from urllib.request import urlopen, url2pathname

from atlas_lm.game_generator import AtlasGameGenerator


class AtlasAgentRuntime:
    """Runtime local de agente con memoria de sesión, búsqueda textual y abstención."""

    def __init__(self, root: str | Path | None = None):
        self.root = (Path(root) if root is not None else Path.cwd()).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.session_path = self.root / ".atlas_agent_sessions.json"
        self._ensure_session_store()

    def _resolve_project_path(self, path: str | Path | None = None) -> Path:
        """Resolve a project path, including symlinks, without leaving the project."""
        target = (self.root / path if path is not None else self.root).resolve()
        if not target.is_relative_to(self.root):
            raise ValueError("Ruta fuera del proyecto Atlas")
        return target

    def _ensure_session_store(self) -> None:
        if not self.session_path.exists():
            self.session_path.write_text(json.dumps({}, ensure_ascii=False, indent=2), encoding="utf-8")

    def _load_sessions(self) -> dict[str, Any]:
        try:
            data = json.loads(self.session_path.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
        except (json.JSONDecodeError, OSError):
            pass
        return {}

    def _save_sessions(self, sessions: dict[str, Any]) -> None:
        self.session_path.write_text(json.dumps(sessions, ensure_ascii=False, indent=2), encoding="utf-8")

    def _session_memory(self, session_id: str) -> dict[str, Any]:
        sessions = self._load_sessions()
        session = sessions.setdefault(session_id, {"facts": [], "history": []})
        self._save_sessions(sessions)
        return session

    def tool_names(self) -> list[str]:
        return [
            "inspect",
            "list_dir",
            "read_file",
            "write_file",
            "run_python",
            "search_text",
            "web_fetch",
            "generate_art_prompt",
            "generate_video_prompt",
            "run_tests",
            "project_summary",
            "respond",
        ]

    def plan(self, task: str) -> dict[str, Any]:
        task_text = (task or "").strip()
        if not task_text:
            raise ValueError("Tarea vacía")

        steps = ["inspect", "decide", "execute", "verify"]
        lower = task_text.lower()
        if "archivo" in lower or "file" in lower:
            steps.insert(1, "write_file")
        if "python" in lower or "script" in lower:
            steps.insert(2, "run_python")
        if "buscar" in lower or "search" in lower:
            steps.insert(2, "search_text")

        return {
            "task": task_text,
            "steps": steps,
            "root": str(self.root),
            "mode": "local-agent",
        }

    def _remember_fact(self, session_id: str, task: str) -> None:
        session = self._session_memory(session_id)
        patterns = [
            r"mi nombre es\s+([A-Za-zÀ-ÿ\- ]+)",
            r"me llamo\s+([A-Za-zÀ-ÿ\- ]+)",
            r"recuerda\s+que\s+mi nombre\s+es\s+([A-Za-zÀ-ÿ\- ]+)",
            r"apodo\s+es\s+([A-Za-zÀ-ÿ\- ]+)",
        ]
        for pattern in patterns:
            match = re.search(pattern, task, flags=re.I)
            if match:
                fact = match.group(1).strip().strip(".")
                if fact and fact not in session["facts"]:
                    session["facts"].append(fact)
                    sessions = self._load_sessions()
                    sessions[session_id] = session
                    self._save_sessions(sessions)
                return

    def _answer_memory_question(self, task: str, session_id: str) -> str | None:
        lower = task.lower()
        if "como me llamo" in lower or "cómo me llamo" in lower or "mi nombre" in lower:
            session = self._session_memory(session_id)
            if session["facts"]:
                return f"Te llamas {session['facts'][-1]}."
            return "Todavía no tengo registrado tu nombre. Puedes decirme 'Recuerda que mi nombre es ...'."
        return None

    def _should_abstain(self, task: str) -> bool:
        lower = task.lower()
        triggers = [
            "precio exacto del bitcoin",
            "precio actual del bitcoin",
            "precio exacto del bitcoi",
            "precio exacto del btc",
            "en este momento",
            "ahora mismo",
            "última cifra exacta",
        ]
        return any(item in lower for item in triggers)

    def respond(self, task: str, session_id: str = "default") -> dict[str, Any]:
        task_text = (task or "").strip()
        if not task_text:
            return {"status": "failed", "answer": "Tarea vacía", "session_id": session_id}

        sessions = self._load_sessions()
        session = sessions.setdefault(session_id, {"facts": [], "history": []})
        session["history"].append({"role": "user", "content": task_text})
        sessions[session_id] = session
        self._save_sessions(sessions)

        self._remember_fact(session_id, task_text)

        memory_answer = self._answer_memory_question(task_text, session_id)
        if memory_answer:
            session = self._session_memory(session_id)
            session["history"].append({"role": "assistant", "content": memory_answer})
            self._save_sessions({**self._load_sessions(), session_id: session})
            return {"status": "completed", "answer": memory_answer, "session_id": session_id, "plan": self.plan(task_text)}

        if self._should_abstain(task_text):
            answer = "No puedo darte un precio exacto del Bitcoin en este momento sin una fuente viva y verificada. Necesito evidencia actual o una consulta web con fuente clara."
            session = self._session_memory(session_id)
            session["history"].append({"role": "assistant", "content": answer})
            self._save_sessions({**self._load_sessions(), session_id: session})
            return {"status": "needs_evidence", "answer": answer, "session_id": session_id, "plan": self.plan(task_text)}

        if "buscar" in task_text.lower() or "search" in task_text.lower():
            needle = re.sub(r"^(buscar|search)\s+", "", task_text, flags=re.I)
            matches = self.search_text(needle, root=self.root)
            if not matches:
                answer = f"No encontré resultados para '{needle}' en este proyecto."
            else:
                sample = matches[0]
                answer = f"He encontrado una coincidencia en {sample['path']}:\n{sample['text']}"
            session = self._session_memory(session_id)
            session["history"].append({"role": "assistant", "content": answer})
            self._save_sessions({**self._load_sessions(), session_id: session})
            return {"status": "completed", "answer": answer, "session_id": session_id, "matches": matches}

        if "crea" in task_text.lower() and "archivo" in task_text.lower() and "contenido" in task_text.lower():
            result = self.run_task(task_text)
            session = self._session_memory(session_id)
            session["history"].append({"role": "assistant", "content": json.dumps(result, ensure_ascii=False)})
            self._save_sessions({**self._load_sessions(), session_id: session})
            return result | {"session_id": session_id, "plan": self.plan(task_text)}

        answer = (
            "Estoy funcionando como un agente local con memoria y herramientas. "
            "Puedo buscar en tu proyecto, leer y escribir archivos, ejecutar scripts Python y decirte si falta evidencia para responder con seguridad."
        )
        session = self._session_memory(session_id)
        session["history"].append({"role": "assistant", "content": answer})
        self._save_sessions({**self._load_sessions(), session_id: session})
        return {"status": "completed", "answer": answer, "session_id": session_id, "plan": self.plan(task_text)}

    def run_task(self, task: str) -> dict[str, Any]:
        plan = self.plan(task)
        lower = task.lower()

        if "crea" in lower and "archivo" in lower and "contenido" in lower:
            match = self._extract_create_file_task(task)
            if match is None:
                return {"status": "failed", "reason": "No pude interpretar la tarea de archivo"}
            path, content = match
            try:
                abs_path = self._resolve_project_path(path)
            except ValueError as exc:
                return {"status": "failed", "reason": str(exc), "plan": plan}
            abs_path.parent.mkdir(parents=True, exist_ok=True)
            abs_path.write_text(content, encoding="utf-8")
            return {
                "status": "completed",
                "task": task,
                "path": str(abs_path),
                "plan": plan,
                "result": {"written": True, "content": content},
            }

        return {
            "status": "failed",
            "task": task,
            "plan": plan,
            "reason": "Tarea no admitida por el agente local",
        }

    def _extract_create_file_task(self, task: str):
        m = re.search(r'archivo(?:\s+llamado|\s+denominado)?\s+([A-Za-z0-9_./\\-]+)', task, flags=re.I)
        if not m:
            return None
        path = m.group(1)
        content_match = re.search(r'contenido\s+["\'](.+?)["\']', task, flags=re.I | re.S)
        if not content_match:
            content_match = re.search(r'con\s+el\s+texto\s+["\'](.+?)["\']', task, flags=re.I | re.S)
        if not content_match:
            return None
        content = content_match.group(1)
        return path, content

    def inspect(self, path: str | None = None) -> dict[str, Any]:
        target = self._resolve_project_path(path)
        if not target.exists():
            return {"exists": False, "path": str(target)}
        if target.is_dir():
            return {"exists": True, "path": str(target), "entries": [p.name for p in sorted(target.iterdir())]}
        return {"exists": True, "path": str(target), "size": target.stat().st_size}

    def list_dir(self, path: str | None = None) -> list[str]:
        target = self._resolve_project_path(path)
        if not target.exists():
            return []
        return [p.name for p in sorted(target.iterdir())]

    def read_file(self, path: str) -> str:
        return self._resolve_project_path(path).read_text(encoding="utf-8")

    def write_file(self, path: str, content: str) -> dict[str, Any]:
        target = self._resolve_project_path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return {"status": "written", "path": str(target), "bytes": len(content.encode("utf-8"))}

    def project_summary(self, root: str | Path | None = None) -> dict[str, Any]:
        search_root = Path(root) if root is not None else self.root
        files = sorted(p for p in search_root.rglob("*") if p.is_file())
        return {
            "root": str(search_root),
            "file_count": len(files),
            "top_files": [str(p.relative_to(search_root)) for p in files[:10]],
            "python_files": len([p for p in files if p.suffix == ".py"]),
        }

    def run_tests(self, target: str | None = None, extra_args: list[str] | None = None) -> dict[str, Any]:
        import subprocess
        import sys

        cmd = [sys.executable, "-m", "pytest", "-q"]
        if target:
            cmd.append(target)
        if extra_args:
            cmd.extend(extra_args)
        proc = subprocess.run(cmd, cwd=str(self.root), capture_output=True, text=True)
        return {
            "status": "completed" if proc.returncode == 0 else "failed",
            "returncode": proc.returncode,
            "stdout": proc.stdout.strip(),
            "stderr": proc.stderr.strip(),
        }

    def search_text(self, text: str, root: str | Path | None = None) -> list[dict[str, str]]:
        needle = (text or "").strip()
        search_root = Path(root) if root is not None else self.root
        if not needle:
            return []

        matches: list[dict[str, str]] = []
        for candidate in sorted(search_root.rglob("*")):
            if not candidate.is_file():
                continue
            try:
                payload = candidate.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue
            lowered = payload.lower()
            idx = lowered.find(needle.lower())
            if idx >= 0:
                start = max(0, idx - 80)
                snippet = payload[start:idx + len(needle) + 140].replace("\n", " ")
                matches.append({"path": str(candidate.relative_to(search_root)), "text": snippet.strip()})
        return matches

    def run_python(self, code: str) -> dict[str, Any]:
        import subprocess
        import sys

        script = self.root / "_atlas_agent_tmp.py"
        script.write_text(code, encoding="utf-8")
        proc = subprocess.run([sys.executable, str(script)], capture_output=True, text=True)
        return {
            "status": "completed" if proc.returncode == 0 else "failed",
            "returncode": proc.returncode,
            "stdout": proc.stdout,
            "stderr": proc.stderr,
        }

    def web_fetch(self, url: str) -> dict[str, Any]:
        target = (url or "").strip()
        if not target:
            return {"status": "failed", "reason": "URL vacía"}

        try:
            if target.startswith("file://"):
                parsed = urlparse(target)
                local_path = Path(url2pathname(parsed.path))
                if not local_path.exists():
                    return {"status": "failed", "reason": "Archivo local no encontrado", "url": target}
                content = local_path.read_text(encoding="utf-8", errors="replace")
            else:
                with urlopen(target, timeout=15) as response:
                    content = response.read().decode("utf-8", errors="replace")
        except Exception as exc:  # pragma: no cover - reintento por red o rutas locales
            return {"status": "failed", "reason": str(exc), "url": target}

        title_match = re.search(r"<title>(.*?)</title>", content, flags=re.I | re.S)
        title = unescape(title_match.group(1)).strip() if title_match else "Sin título"
        clean = re.sub(r"<script.*?</script>", " ", content, flags=re.I | re.S)
        clean = re.sub(r"<style.*?</style>", " ", clean, flags=re.I | re.S)
        clean = re.sub(r"<[^>]+>", " ", clean)
        clean = " ".join(clean.split())
        return {
            "status": "completed",
            "url": target,
            "title": title,
            "content": clean[:4000],
        }

    def generate_art_prompt(self, prompt: str, root: str | Path | None = None) -> dict[str, Any]:
        text = (prompt or "").strip()
        if not text:
            return {"status": "failed", "reason": "Prompt vacío"}

        root_path = Path(root) if root is not None else self.root
        media_dir = root_path / "media" / "art"
        media_dir.mkdir(parents=True, exist_ok=True)

        title = re.sub(r"[^A-Za-z0-9]+", " ", text).strip().title()[:32] or "Atlas Concept"
        art_path = media_dir / "concept.svg"
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#090b1a"/>
      <stop offset="50%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#1f2937"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#bg)"/>
  <circle cx="1180" cy="220" r="110" fill="#22d3ee" opacity="0.45"/>
  <circle cx="400" cy="650" r="180" fill="#f472b6" opacity="0.28"/>
  <rect x="110" y="110" width="1380" height="680" rx="28" fill="none" stroke="#7dd3fc" stroke-width="3" opacity="0.8"/>
  <text x="130" y="260" fill="#e2e8f0" font-size="52" font-family="Segoe UI, Arial" font-weight="700">{escape(title)}</text>
  <text x="130" y="340" fill="#cbd5e1" font-size="28" font-family="Segoe UI, Arial">{escape(text[:120])}</text>
  <rect x="130" y="430" width="320" height="220" rx="18" fill="#0f172a" opacity="0.7" stroke="#38bdf8"/>
  <text x="160" y="500" fill="#7dd3fc" font-size="22" font-family="Segoe UI, Arial">Mood</text>
  <text x="160" y="560" fill="#e2e8f0" font-size="20" font-family="Segoe UI, Arial">neón · lluvia · skyline</text>
  <text x="160" y="610" fill="#e2e8f0" font-size="20" font-family="Segoe UI, Arial">realismo urbano</text>
</svg>
'''
        art_path.write_text(svg, encoding="utf-8")
        return {
            "status": "completed",
            "prompt": text,
            "path": str(art_path.relative_to(root_path)),
            "format": "svg",
        }

    def generate_video_prompt(self, prompt: str, root: str | Path | None = None) -> dict[str, Any]:
        text = (prompt or "").strip()
        if not text:
            return {"status": "failed", "reason": "Prompt vacío"}

        root_path = Path(root) if root is not None else self.root
        media_dir = root_path / "media" / "video"
        media_dir.mkdir(parents=True, exist_ok=True)

        shotlist = {
            "title": "Atlas motion concept",
            "prompt": text,
            "shots": [
                {"id": 1, "shot": "Plano general de la ciudad con neón y lluvia.", "duration": 4},
                {"id": 2, "shot": "Cámara lenta sobre el skyline y el tráfico.", "duration": 5},
                {"id": 3, "shot": "Plano medio del protagonista entre luces y movimiento urbano.", "duration": 6},
                {"id": 4, "shot": "Transición final con intensidad dramática y cierre visual.", "duration": 5},
            ],
        }
        shot_path = media_dir / "shotlist.json"
        shot_path.write_text(json.dumps(shotlist, ensure_ascii=False, indent=2), encoding="utf-8")
        return {
            "status": "completed",
            "prompt": text,
            "path": str(shot_path.relative_to(root_path)),
            "shots": shotlist["shots"],
        }

    def self_improve_project(self, request: str, project_root: str | Path | None = None) -> dict[str, Any]:
        text = (request or "").strip()
        if not text:
            return {"status": "failed", "reason": "Petición vacía"}

        root_path = Path(project_root) if project_root is not None else self.root
        lower = text.casefold()
        if any(word in lower for word in ("tensión", "tension", "policía", "policia", "difícil", "dificil", "intenso", "riesgo")):
            level = "intenso"
            tuning = {"enemySpeed": 2.6, "contactDamage": 0.35, "reward": 650}
        elif any(word in lower for word in ("fácil", "facil", "suave", "tranquilo")):
            level = "suave"
            tuning = {"enemySpeed": 1.2, "contactDamage": 0.1, "reward": 300}
        else:
            return {"status": "failed", "reason": "Mejora no disponible: pide dificultad intensa o suave"}

        game_js = root_path / "prototype" / "game.js"
        if not game_js.exists():
            AtlasGameGenerator(project_root=root_path).generate_project(text)

        js = game_js.read_text(encoding="utf-8")
        match = re.search(r"^const challenge = (\{[^\n]+\});$", js, flags=re.M)
        if match is None:
            return {"status": "failed", "reason": "El prototipo no tiene ajustes compatibles; no se ha modificado"}

        old_tuning = json.loads(match.group(1))
        changed = old_tuning != tuning
        if changed:
            js = js[:match.start(1)] + json.dumps(tuning) + js[match.end(1):]
            game_js.write_text(js, encoding="utf-8")

        readme = root_path / "prototype" / "README.md"
        if readme.exists():
            content = readme.read_text(encoding="utf-8")
            content = re.sub(r"\n\n## Ajuste de dificultad Atlas\n[^\n]*", "", content)
            content += f"\n\n## Ajuste de dificultad Atlas\nNivel {level}: velocidad policial {tuning['enemySpeed']}, daño por contacto {tuning['contactDamage']} y recompensa {tuning['reward']}.\n"
            readme.write_text(content, encoding="utf-8")

        return {
            "status": "completed",
            "request": text,
            "project_root": str(root_path),
            "difficulty": level,
            "changed": changed,
            "challenge": tuning,
            "updated_files": [
                str(game_js.relative_to(root_path)),
                str(readme.relative_to(root_path)),
            ],
        }

    def generate_blender_scene(self, prompt: str, project_root: str | Path | None = None) -> dict[str, Any]:
        text = (prompt or "").strip()
        if not text:
            return {"status": "failed", "reason": "Prompt vacío"}

        root_path = Path(project_root) if project_root is not None else self.root
        blender_dir = root_path / "blender"
        blender_dir.mkdir(parents=True, exist_ok=True)

        script_path = blender_dir / "urban_cinematic_shot.py"
        script = '''import bpy
import math

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 64
scene.cycles.use_adaptive_sampling = True
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.film_transparent = False

for obj in bpy.data.objects:
    if obj.type == "MESH":
        obj.select_set(False)

bpy.ops.object.select_all(action="DESELECT")

# Crear plano de suelo
bpy.ops.mesh.primitive_plane_add(location=(0, 0, 0), scale=(20, 20, 1))
plane = bpy.context.active_object
plane.name = "Street"
plane.data.materials.append(bpy.data.materials.new(name="StreetMat"))
mat = plane.data.materials[0]
mat.use_nodes = True
bsdf = mat.node_tree.nodes.get("Principled BSDF")
bsdf.inputs[0].default_value = (0.06, 0.07, 0.08, 1.0)

# Crear coche
bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0.5), scale=(1.6, 3.3, 0.6))
car = bpy.context.active_object
car.name = "Car"
car.rotation_euler = (0.0, 0.0, math.radians(90.0))

# Crear cámara
bpy.ops.object.camera_add(location=(0.0, -8.0, 3.5))
camera = bpy.context.active_object
camera.name = "UrbanCamera"
camera.rotation_euler = (math.radians(80.0), 0.0, 0.0)
scene.camera = camera

# Crear luz principal
bpy.ops.object.light_add(type="AREA", location=(4, -6, 8))
light = bpy.context.active_object
light.name = "MainLight"
light.data.energy = 4000
light.data.shape = "RECTANGLE"

# Crear luz de neón
bpy.ops.object.light_add(type="POINT", location=(0, 0, 4))
neon = bpy.context.active_object
neon.name = "NeonLight"
neon.data.energy = 1200
neon.data.color = (0.2, 0.8, 1.0)

# Crear fondo de ciudad con bloques
for i in range(12):
    x = -10 + (i % 4) * 7
    y = -6 + (i // 4) * 8
    bpy.ops.mesh.primitive_cube_add(location=(x, y, 2.0), scale=(2.5, 2.5, 4.0))
    block = bpy.context.active_object
    block.name = f"Building_{i}"
    mat = bpy.data.materials.new(name=f"BuildingMat_{i}")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs[0].default_value = (0.1, 0.12, 0.15, 1.0)
    block.data.materials.append(mat)

# Añadir movimiento de cámara
camera.location.x = 0.0
camera.location.y = -8.0
for frame in range(1, 121):
    camera.location.y = -8.0 + (frame / 120.0) * 6.0
    camera.keyframe_insert(data_path="location", frame=frame)

# Ajustar entorno
scene.world.use_nodes = True
bg = scene.world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.02, 0.02, 0.05, 1.0)

print("Urban cinematic shot scene created.")
'''
        script_path.write_text(script, encoding="utf-8")
        return {
            "status": "completed",
            "prompt": text,
            "project_root": str(root_path),
            "path": str(script_path.relative_to(root_path)),
        }

    def generate_full_pipeline(self, prompt: str, project_root: str | Path | None = None) -> dict[str, Any]:
        text = (prompt or "").strip()
        if not text:
            return {"status": "failed", "reason": "Prompt vacío"}

        root_path = Path(project_root) if project_root is not None else self.root
        root_path.mkdir(parents=True, exist_ok=True)
        suite = self.generate_creative_suite(text, project_root=root_path)
        if suite["status"] != "completed":
            return {"status": "failed", "reason": "No se completó el flujo creativo", "suite": suite}

        pipeline = {
            "status": "completed",
            "prompt": text,
            "project_root": str(root_path),
            "pipeline": [
                "design",
                "prototype",
                "difficulty_tuning",
                "blender_scene",
            ],
            "artifacts": suite["artifacts"],
            "notes": "Prototipo 2D jugable y script de escena Blender generados; el render Blender no se ha ejecutado.",
        }

        (root_path / "atlas_pipeline.json").write_text(json.dumps(pipeline, ensure_ascii=False, indent=2), encoding="utf-8")
        return pipeline

    def generate_creative_suite(self, prompt: str, project_root: str | Path | None = None) -> dict[str, Any]:
        text = (prompt or "").strip()
        if not text:
            return {"status": "failed", "reason": "Prompt vacío"}

        root_path = Path(project_root) if project_root is not None else self.root
        root_path.mkdir(parents=True, exist_ok=True)

        game = AtlasGameGenerator(project_root=root_path)
        project = game.generate_project(text)
        if project["status"] != "completed":
            return {"status": "failed", "stage": "game_design", "details": project}
        improved = self.self_improve_project(
            f"Ajusta la dificultad a intensa, con más tensión policial: {text}",
            project_root=root_path,
        )
        if improved["status"] != "completed":
            return {"status": "failed", "stage": "difficulty_tuning", "details": improved}
        scene = self.generate_blender_scene(text, project_root=root_path)
        if scene["status"] != "completed":
            return {"status": "failed", "stage": "blender_scene", "details": scene}

        suite = {
            "status": "completed",
            "prompt": text,
            "project_root": str(root_path),
            "layers": {
                "game_design": project["status"],
                "difficulty_tuning": improved["status"],
                "blender_scene": scene["status"],
            },
            "artifacts": {
                "prototype": str((root_path / "prototype" / "index.html").relative_to(root_path)),
                "scene": str((root_path / "blender" / "urban_cinematic_shot.py").relative_to(root_path)),
                "manifest": "atlas_manifest.json",
            },
            "notes": "Atlas genera un prototipo 2D jugable, ajusta su dificultad y escribe un script de escena Blender. No ejecuta Blender ni renderiza el vídeo.",
        }
        (root_path / "atlas_creative_suite.json").write_text(json.dumps(suite, ensure_ascii=False, indent=2), encoding="utf-8")
        return suite

    def run_workflow(self, task: str, session_id: str = "default") -> dict[str, Any]:
        plan = self.plan(task)
        steps = []
        steps.append({"name": "plan", "status": "completed", "details": plan})
        execution = self.run_task(task)
        steps.append({"name": "execute", "status": execution.get("status", "completed"), "details": execution})
        verification = self.verify_task(task) if execution.get("status") == "completed" else {
            "status": "skipped", "reason": "La ejecución no se completó"
        }
        steps.append({"name": "verify", "status": verification.get("status", "completed"), "details": verification})
        completed = execution.get("status") == "completed" and verification.get("status") == "completed"
        answer = "Tarea ejecutada y verificada." if completed else (
            execution.get("reason") or verification.get("reason") or "No se pudo verificar la tarea."
        )
        sessions = self._load_sessions()
        session = sessions.setdefault(session_id, {"facts": [], "history": []})
        session["history"].extend([
            {"role": "user", "content": task},
            {"role": "assistant", "content": answer},
        ])
        sessions[session_id] = session
        self._save_sessions(sessions)
        return {
            "status": "completed" if completed else "failed",
            "answer": answer,
            "session_id": session_id,
            "plan": plan,
            "steps": steps,
            "workflow": "plan_execute_verify",
        }

    def verify_task(self, task: str) -> dict[str, Any]:
        lower = task.lower()
        if "archivo" in lower and "contenido" in lower and "crea" in lower:
            match = self._extract_create_file_task(task)
            if match is None:
                return {"status": "failed", "reason": "No pude verificar la creación del archivo"}
            path, content = match
            try:
                target = self._resolve_project_path(path)
            except ValueError as exc:
                return {"status": "failed", "reason": str(exc)}
            existing = target.read_text(encoding="utf-8") if target.exists() else None
            return {
                "status": "completed" if existing == content else "failed",
                "path": str(target),
                "expected": content,
                "actual": existing,
            }
        return {"status": "failed", "reason": "Tarea no admitida por el agente local"}

    def interactive(self, session_id: str = "cli") -> None:
        print("Atlas Agent local. Comandos: 'salir', 'resumen', 'lista', 'pruebas', 'ayuda'.")
        while True:
            try:
                prompt = input("\nATLAS> ").strip()
            except (EOFError, KeyboardInterrupt):
                print("\nHasta luego.")
                break
            if not prompt:
                continue
            lower = prompt.lower()
            if lower in {"salir", "exit", "quit"}:
                print("Hasta luego.")
                break
            if lower in {"ayuda", "help"}:
                print("Puedes pedir: crear archivo ..., buscar ..., listar ..., resumen del proyecto, pruebas, o cualquier tarea local.")
                continue
            if lower in {"lista", "list"}:
                print(self.list_dir())
                continue
            if lower in {"resumen", "summary"}:
                print(json.dumps(self.project_summary(), ensure_ascii=False, indent=2))
                continue
            if lower in {"pruebas", "tests"}:
                print(json.dumps(self.run_tests(), ensure_ascii=False, indent=2))
                continue
            result = self.respond(prompt, session_id=session_id)
            print(result.get("answer", json.dumps(result, ensure_ascii=False, indent=2)))
