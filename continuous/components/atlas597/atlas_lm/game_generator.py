from __future__ import annotations

import json
from dataclasses import dataclass, asdict
from html import escape
from pathlib import Path
from typing import Any


@dataclass
class District:
    name: str
    vibe: str
    density: int
    mission_type: str


class AtlasGameGenerator:
    """Genera un prototipo original de juego urbano basado en un prompt."""

    def __init__(self, project_root: str | Path | None = None):
        self.project_root = Path(project_root) if project_root is not None else Path.cwd()
        self.project_root.mkdir(parents=True, exist_ok=True)

    def build_from_prompt(self, prompt: str) -> dict[str, Any]:
        text = (prompt or "").strip()
        if not text:
            raise ValueError("Prompt vacío")

        lower = text.lower()
        character = self._character_blueprint(lower)
        universe = self._universe_blueprint(lower)

        districts = [
            District("Centro Comercial", "noche moderna, luces, tráfico denso", 8, "robos rápidos"),
            District("Puerto Viejo", "marea, almacenes, rutas ocultas", 6, "cargas clandestinas"),
            District("Colina Residencial", "vistas, calles tranquilas, vigilantes", 5, "misiones de vigilancia"),
        ]

        graphics_profile = "ultra_realistic" if any(keyword in lower for keyword in ("ultra realista", "ultrarealista", "fotorrealista", "photorealistic", "4k", "cinematic", "ray tracing", "pbr", "realism")) else "cinematic"

        city_layout = {
            "buildings": 12 if "barcelona" in lower else 9,
            "roads": 5,
            "districts": 3,
            "neon_lights": 18,
            "sidewalks": 7,
            "elevations": 3,
        }

        mobility = []
        if any(keyword in lower for keyword in ("correr", "run", "sprint")):
            mobility.append("correr")
        if any(keyword in lower for keyword in ("saltar", "jump", "salto")):
            mobility.append("saltar")
        if any(keyword in lower for keyword in ("conducir", "drive", "driving")):
            mobility.append("conducir")
        if not mobility:
            mobility = ["explorar", "interactuar", "saltar"]

        design = {
            "title": self._title_from_prompt(text),
            "setting": universe["setting"],
            "world_mode": universe["mode"],
            "style": universe["style"],
            "time_of_day": "night" if "noche" in lower or "night" in lower else "day",
            "character": character,
            "universe": universe,
            "graphics_profile": graphics_profile,
            "prototype_renderer": "canvas_2d",
            "scene_type": "3d_city" if "3d" in lower or "ciudad" in lower or "city" in lower else "3d_scene",
            "districts": [asdict(d) for d in districts],
            "city_layout": city_layout,
            "npc_count": 12 if "barcelona" in lower else 8,
            "vehicle_count": 9 if "barcelona" in lower else 6,
            "mobility": mobility,
            "mission_loop": [
                "recoger intel",
                "resolver ruta",
                "evitar vigilancia",
                "entregar objetivo",
                "escapar con recompensa"
            ],
            "player_loop": [
                "explorar",
                "interactuar",
                "conducir",
                "cumplir misión",
                "subir reputación"
            ],
            "art_direction": f"{character['render_direction']} · perfil visual {graphics_profile}, iluminación HDR, PBR, materiales de alta definición, sombras volumétricas y cámara cinemática",
            "systems": [
                "tráfico",
                "NPCs",
                "misiones",
                "dinero",
                "reputación",
                "policía"
            ],
        }
        return design

    def _character_blueprint(self, prompt: str) -> dict[str, Any]:
        """Mapea el prompt a una escala visual original, de cartoon a cine 3D."""
        if any(word in prompt for word in ("ultra realista", "ultrarealista", "fotorrealista", "photorealistic", "realismo extremo")):
            tier = "cinematic_3d"
            render = "personaje 3D cinematográfico, piel y materiales físicamente plausibles, iluminación de estudio y captura facial"
            pipeline = ["high_poly_mesh", "pbr_materials", "facial_rig", "cinematic_lighting"]
        elif any(word in prompt for word in ("cartoon", "mario", "plataformas", "platformer")):
            tier = "stylized_3d"
            render = "personaje 3D estilizado, silueta legible, colores vivos, squash and stretch y expresiones grandes"
            pipeline = ["clean_mesh", "bright_materials", "face_rig", "toon_lighting"]
        elif any(word in prompt for word in ("3d", "realista", "realistic")):
          tier = "realistic_3d"
          render = "personaje 3D realista, anatomía estilizada, materiales PBR y rig de cuerpo completo"
          pipeline = ["mid_poly_mesh", "pbr_materials", "body_rig", "key_light"]
        else:
            tier = "illustrated_2d"
            render = "personaje ilustrado original, silueta clara, paleta definida y poses expresivas"
            pipeline = ["concept_sheet", "silhouette_pass", "color_pass", "expression_sheet"]

        return {
            "name": "Atlas protagonist",
            "tier": tier,
            "render_direction": render,
            "generation_pipeline": pipeline,
            "originality_rule": "diseño propio, sin copiar personajes protegidos",
        }

    def _universe_blueprint(self, prompt: str) -> dict[str, Any]:
        if "barcelona" in prompt or "barna" in prompt:
            return {
                "mode": "real_city",
                "setting": "Barcelona",
                "style": "open city adventure",
                "landmarks": ["Eixample", "Barceloneta", "Montjuïc", "Poblenou"],
                "design_note": "usar una representación original y respetuosa de la ciudad, no una copia de activos comerciales",
            }
        if any(word in prompt for word in ("mario", "plataformas", "platformer", "reino", "setas")):
            return {
                "mode": "original_platform_fantasy",
                "setting": "Atlasia",
                "style": "colorful platform adventure",
                "regions": ["Pradera Prismática", "Cañón Rebote", "Torres de Nube", "Volcán de Cristal"],
                "design_note": "universo original de plataformas, con reglas y personajes propios",
            }
        return {
            "mode": "original_urban",
            "setting": "urban",
            "style": "modern sandbox",
            "regions": ["Centro Comercial", "Puerto Viejo", "Colina Residencial"],
            "design_note": "mundo original generado por Atlas",
        }

    def _title_from_prompt(self, prompt: str) -> str:
        words = [w for w in prompt.lower().replace("-", " ").split() if w.isalpha()][:5]
        if not words:
            return "Urban Drift"
        title = " ".join(w.capitalize() for w in words)
        if len(title) < 8:
            title = "Urban Drift"
        return title

    def generate_project(self, prompt: str) -> dict[str, Any]:
        design = self.build_from_prompt(prompt)
        design_dir = self.project_root / "design"
        design_dir.mkdir(parents=True, exist_ok=True)

        (design_dir / "game_design.json").write_text(json.dumps(design, ensure_ascii=False, indent=2), encoding="utf-8")
        (design_dir / "character_blueprint.json").write_text(
            json.dumps(design["character"], ensure_ascii=False, indent=2), encoding="utf-8"
        )
        (design_dir / "universe_blueprint.json").write_text(
            json.dumps(design["universe"], ensure_ascii=False, indent=2), encoding="utf-8"
        )

        world = {
            "map": {
                "name": f"{design['title']} District Map",
                "seed": 42,
                "world_mode": design["world_mode"],
                "setting": design["setting"],
                "zones": [
                    {"name": d["name"], "density": d["density"], "vibe": d["vibe"]} for d in design["districts"]
                ],
            },
            "traffic": {"cars": 30, "pedestrians": 80},
            "weather": "night rain" if design["time_of_day"] == "night" else "clear",
            "world_rules": design["universe"]["design_note"],
            "characters": [
                {"name": "Astra", "role": "protagonista", "tier": design["character"]["tier"]},
                {"name": "Nyx", "role": "antagonista", "tier": "elite"},
                {"name": "Carmen", "role": "aliada", "tier": "support"},
            ],
            "items": ["llave", "cargador", "intel", "botiquín", "moneda mayor"],
            "enemies": ["policía", "mercenario", "mecánico", "guarda de distrito"],
        }
        (design_dir / "world_map.json").write_text(json.dumps(world, ensure_ascii=False, indent=2), encoding="utf-8")

        missions = {
            "main_mission": {
                "name": "Ritmo del Barrio",
                "objective": "Recuperar un paquete clave y escapar por la ruta menos vigilada",
                "reward": 2500,
                "fail_conditions": ["ser detectado por la policía", "quedar sin combustible"],
            },
            "side_missions": [
                {"name": "Entrega silenciosa", "reward": 600},
                {"name": "Reto nocturno", "reward": 900},
                {"name": "Reputación del vecindario", "reward": 1300},
            ],
        }
        if design["world_mode"] == "original_platform_fantasy":
            missions["main_mission"] = {
                "name": "Puerta de Nubes",
                "objective": "Superar los puentes voladores y recuperar el núcleo de Atlasia",
                "reward": 3200,
                "fail_conditions": ["caer al abismo", "perder el núcleo", "desatar la tormenta"],
            }
        elif design["world_mode"] == "real_city":
            missions["main_mission"] = {
                "name": "Rastro de Barcelona",
                "objective": "Eludir la vigilancia y llegar al punto de extracción entre calles y tejados",
                "reward": 3400,
                "fail_conditions": ["ser rodeado por la policía", "quedar sin cobertura", "perder la pista"],
            }
        (design_dir / "missions.json").write_text(json.dumps(missions, ensure_ascii=False, indent=2), encoding="utf-8")

        gameplay = {
            "world_mode": design["world_mode"],
            "player_profile": {
                "name": "Astra",
                "visual_tier": design["character"]["tier"],
                "abilities": ["salto", "esprint", "esconderse", "hackear", "desplazamiento"],
            },
            "core_loop": [
                "explorar",
                "recoger objetos",
                "evitar enemigos",
                "cumplir misión",
                "subir reputación",
            ],
            "bosses": ["Nyx", "Lattice", "Sable"],
            "powers": ["luz de neón", "salto de energía", "filtro térmico", "camuflaje urbano"],
        }
        (design_dir / "gameplay_blueprint.json").write_text(json.dumps(gameplay, ensure_ascii=False, indent=2), encoding="utf-8")

        prototype_dir = self.project_root / "prototype"
        prototype_dir.mkdir(parents=True, exist_ok=True)

        if design["world_mode"] == "original_platform_fantasy":
            scene_label = "Reino de nubes y plataformas"
            quest_text = "Recupera el núcleo de Atlasia y cruza la tormenta flotante."
            bg_top = "#6d5ef7"
            bg_bottom = "#1e293b"
            accent = "#facc15"
            extra_legend = "Puntos de salto, nubes y energía cristalina."
        elif design["world_mode"] == "real_city":
            scene_label = "Ciudad abierta de Barcelona"
            quest_text = "Escapa entre calles, tejados y zonas de humo con observación policial."
            bg_top = "#111827"
            bg_bottom = "#0f172a"
            accent = "#22d3ee"
            extra_legend = "Calles, cámaras, edificios y tráfico activo."
        else:
            scene_label = "Barrio urbano original"
            quest_text = "Completa la misión principal en el barrio y evita la vigilancia."
            bg_top = "#111827"
            bg_bottom = "#0f172a"
            accent = "#38bdf8"
            extra_legend = "Barrio nocturno, luces, tráfico y tensión."

        if design["graphics_profile"] == "ultra_realistic":
            bg_top = "#0b1020"
            bg_bottom = "#020617"
            accent = "#7dd3fc"
            extra_legend = "Iluminación HDR, PBR, reflejos, sombras complejas y detalle cinematográfico extremo."

        html = f'''<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{escape(design['title'])}</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="hud">
    <div>
      <h1>{escape(design['title'])}</h1>
      <p>{escape(design['setting'])} · {escape(design['style'])} · personaje: {escape(design['character']['tier'])}</p>
      <p>{escape(scene_label)} · dirección visual: {escape(design['graphics_profile'])} · misión: {escape(missions['main_mission']['name'])}</p>
    </div>
    <div class="stats">
      <span>Dinero: <strong id="money">1200</strong></span>
      <span>Reputación: <strong id="rep">0</strong></span>
      <span>Estado: <strong id="status">vivo</strong></span>
    </div>
  </div>

  <canvas id="gameCanvas" width="960" height="540" aria-label="Juego"></canvas>

  <div class="panel">
    <button id="missionBtn">Iniciar misión</button>
    <button id="boostBtn">Acelerar</button>
    <p id="log" role="status" aria-live="polite">{escape(quest_text)}</p>
  </div>
  <p class="controls">Mover: flechas o WASD · Espacio: salto visual · M: iniciar o reiniciar misión. Recoge el objetivo amarillo y llega a la salida verde.</p>

  <script src="game.js"></script>
</body>
</html>
'''
        (prototype_dir / "index.html").write_text(html, encoding="utf-8")

        css = f'''body {{
  margin: 0;
  background: linear-gradient(180deg, {bg_top}, {bg_bottom});
  color: #e2e8f0;
  font-family: "Segoe UI", Arial, sans-serif;
}}

.hud {{
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 24px;
  background: rgba(15, 23, 42, 0.9);
  border-bottom: 1px solid rgba(125, 211, 252, 0.4);
}}

.hud h1 {{
  margin: 0 0 6px;
  font-size: 2rem;
}}

.stats {{
  display: flex;
  gap: 18px;
  font-size: 0.95rem;
}}

#gameCanvas {{
  display: block;
  width: min(960px, calc(100vw - 32px));
  height: auto;
  margin: 16px auto 0 auto;
  border: 2px solid rgba(125, 211, 252, 0.4);
  background: linear-gradient(180deg, {bg_top}, {bg_bottom});
  box-shadow: 0 0 25px rgba(34, 211, 238, 0.2);
}}

.panel {{
  margin: 16px auto 0 auto;
  width: min(960px, calc(100vw - 32px));
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}}

button {{
  background: linear-gradient(135deg, {accent}, #2563eb);
  color: white;
  border: none;
  border-radius: 10px;
  padding: 10px 18px;
  cursor: pointer;
  font-weight: 700;
}}

#log {{
  margin: 0;
  color: #cbd5e1;
}}

.controls {{
  width: min(960px, calc(100vw - 32px));
  margin: 12px auto 24px;
  color: #94a3b8;
  font-size: 0.9rem;
}}
'''
        (prototype_dir / "style.css").write_text(css, encoding="utf-8")

        js = f'''const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const moneyLabel = document.getElementById("money");
const repLabel = document.getElementById("rep");
const statusLabel = document.getElementById("status");
const logLabel = document.getElementById("log");

const mode = {json.dumps(design['world_mode'])};
const cityStats = {json.dumps(design['city_layout'])};
const challenge = {json.dumps({'enemySpeed': 1.8, 'contactDamage': 0.2, 'reward': 450})};
const state = {{
  x: 160,
  y: 260,
  money: 1200,
  rep: 0,
  health: 100,
  heat: 0,
  missionActive: false,
  missionPhase: "idle",
  speed: 2,
  jumpFrames: 0,
  reveal: 0,
  npc: [
    {{ x: 110, y: 150, dx: 1, dy: 0.5, color: "#fbbf24" }},
    {{ x: 420, y: 230, dx: -1, dy: 0.8, color: "#34d399" }},
    {{ x: 620, y: 120, dx: 1.2, dy: 0.4, color: "#f472b6" }},
    {{ x: 760, y: 300, dx: -0.9, dy: 0.7, color: "#c084fc" }},
    {{ x: 240, y: 350, dx: 1.1, dy: -0.2, color: "#60a5fa" }},
    {{ x: 860, y: 190, dx: -1.1, dy: 0.5, color: "#f87171" }},
    {{ x: 180, y: 380, dx: 0.8, dy: -0.7, color: "#fb7185" }},
    {{ x: 540, y: 410, dx: -1.2, dy: 0.5, color: "#4ade80" }},
    {{ x: 760, y: 180, dx: 1.0, dy: -0.4, color: "#a78bfa" }},
    {{ x: 300, y: 120, dx: -0.9, dy: 0.6, color: "#f59e0b" }},
    {{ x: 640, y: 330, dx: 1.4, dy: -0.3, color: "#38bdf8" }},
    {{ x: 910, y: 420, dx: -1.1, dy: 0.9, color: "#fca5a5" }},
  ],
  vehicles: [
    {{ x: 90, y: 390, dx: 1.8, color: "#22d3ee" }},
    {{ x: 410, y: 440, dx: 1.5, color: "#f97316" }},
    {{ x: 700, y: 420, dx: 1.2, color: "#facc15" }},
    {{ x: 300, y: 470, dx: 1.1, color: "#a78bfa" }},
    {{ x: 820, y: 380, dx: -1.8, color: "#38bdf8" }},
    {{ x: 175, y: 500, dx: 1.4, color: "#f87171" }},
  ],
  policeLights: [
    {{ x: 700, y: 250, phase: 0 }},
    {{ x: 820, y: 300, phase: 1 }},
  ]
}};

const policia = {{ x: 760, y: 350, vx: 0.9, vy: 0.7 }};
const objective = {{ x: 520, y: 280 }};
const exitZone = {{ x: 65, y: 75 }};
const platforms = mode === "original_platform_fantasy"
  ? [
      {{ x: 60, y: 440, w: 150, h: 18 }},
      {{ x: 260, y: 360, w: 170, h: 18 }},
      {{ x: 500, y: 300, w: 200, h: 18 }},
      {{ x: 720, y: 220, w: 170, h: 18 }}
    ]
  : [
      {{ x: 70, y: 430, w: 180, h: 18 }},
      {{ x: 280, y: 350, w: 180, h: 18 }},
      {{ x: 520, y: 300, w: 180, h: 18 }},
      {{ x: 760, y: 240, w: 120, h: 18 }}
    ];

function clamp(value, min, max) {{
  return Math.min(Math.max(value, min), max);
}}

function drawBackground() {{
  if (mode === "original_platform_fantasy") {{
    ctx.fillStyle = "#6d5ef7";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    for (let i = 0; i < 7; i++) {{
      const x = 80 + i * 120;
      const y = 70 + (i % 2) * 50;
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, Math.PI * 2);
      ctx.fill();
    }}
    ctx.fillStyle = "rgba(255,255,255,0.32)";
    for (const p of platforms) {{
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }}
  }} else {{
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(15, 118, 110, 0.18)";
    ctx.fillRect(0, 420, canvas.width, 120);

    ctx.fillStyle = "rgba(148,163,184,0.12)";
    for (let x = 0; x < canvas.width; x += 70) {{
      ctx.fillRect(x, 120, 40, 2);
    }}

    for (let i = 0; i < cityStats.buildings; i++) {{
      const x = 40 + i * 72;
      const h = 100 + (i % 4) * 26;
      const y = 300 - h;
      ctx.fillStyle = i % 2 === 0 ? "rgba(15, 23, 42, 0.96)" : "rgba(30, 41, 59, 0.9)";
      ctx.fillRect(x, y, 52, h);
      ctx.fillStyle = "rgba(244, 114, 182, 0.26)";
      ctx.fillRect(x + 8, y + 10, 12, 12);
      ctx.fillStyle = "rgba(34, 211, 238, 0.55)";
      for (let row = 0; row < 5; row++) {{
        for (let col = 0; col < 2; col++) {{
          ctx.fillRect(x + 8 + col * 16, y + 30 + row * 18, 10, 10);
        }}
      }}
      ctx.fillStyle = "rgba(15, 23, 42, 0.7)";
      ctx.fillRect(x + 45, y, 8, h);
    }}

    ctx.fillStyle = "rgba(148,163,184,0.18)";
    for (let i = 0; i < 16; i++) {{
      const x = (i * 90 + (state.x * 0.4)) % (canvas.width + 100);
      const y = 90 + (i % 4) * 80;
      ctx.fillRect(x, y, 60, 18);
    }}

    for (const npc of state.npc) {{
      ctx.fillStyle = npc.color;
      ctx.fillRect(npc.x, npc.y, 10, 16);
    }}

    for (const vehicle of state.vehicles) {{
      ctx.fillStyle = vehicle.color;
      ctx.fillRect(vehicle.x, vehicle.y, 36, 16);
      ctx.fillStyle = "rgba(248,250,252,0.45)";
      ctx.fillRect(vehicle.x + 8, vehicle.y + 4, 10, 4);
    }}

    for (const light of state.policeLights) {{
      ctx.fillStyle = light.phase % 2 === 0 ? "rgba(34,211,238,0.9)" : "rgba(248,113,113,0.9)";
      ctx.beginPath();
      ctx.arc(light.x, light.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }}
  }}

  if (state.missionPhase === "collect") {{
    ctx.fillStyle = "#facc15";
    ctx.fillRect(objective.x, objective.y, 22, 22);
    ctx.fillStyle = "#fef08a";
    ctx.fillText("OBJETIVO", objective.x - 24, objective.y - 8);
  }}
  if (state.missionPhase === "escape") {{
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(exitZone.x, exitZone.y, 34, 34);
    ctx.fillStyle = "#bbf7d0";
    ctx.fillText("SALIDA", exitZone.x - 10, exitZone.y - 8);
  }}

  const jumpOffset = state.jumpFrames > 0 ? Math.sin((state.jumpFrames / 24) * Math.PI) * 18 : 0;
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(state.x, state.y - jumpOffset, 28, 28);

  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.arc(policia.x, policia.y, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#22c55e";
  ctx.fillRect(20, 18, 220, 12);
  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(20, 18, (state.health / 100) * 220, 12);

  ctx.fillStyle = "#f9a825";
  ctx.fillRect(canvas.width - 220, 18, 200, 12);
  ctx.fillStyle = "#f97316";
  ctx.fillRect(canvas.width - 220, 18, (state.heat / 100) * 200, 12);

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "16px Segoe UI";
  ctx.fillText("salud", 30, 14);
  ctx.fillText("alerta", canvas.width - 200, 14);
}}

function updateNPCs() {{
  for (const npc of state.npc) {{
    npc.x += npc.dx * 0.9;
    npc.y += npc.dy * 0.7;
    if (npc.x < 40 || npc.x > canvas.width - 50) npc.dx *= -1;
    if (npc.y < 90 || npc.y > 420) npc.dy *= -1;
  }}

  for (const vehicle of state.vehicles) {{
    vehicle.x += vehicle.dx * 0.9;
    if (vehicle.x < 0 || vehicle.x > canvas.width) vehicle.dx *= -1;
  }}

  for (const light of state.policeLights) {{
    light.phase += 0.08;
    light.x += Math.sin(light.phase) * 0.6;
  }}
}}

function updateEnemy() {{
  if (!state.missionActive) {{
    policia.x += policia.vx;
    policia.y += policia.vy;
    if (policia.x < 700 || policia.x > 900) policia.vx *= -1;
    if (policia.y < 150 || policia.y > 420) policia.vy *= -1;
    return;
  }}

  const dx = state.x - policia.x;
  const dy = state.y - policia.y;
  const dist = Math.hypot(dx, dy) || 1;
  policia.x += (dx / dist) * challenge.enemySpeed;
  policia.y += (dy / dist) * challenge.enemySpeed;

  if (dist < 42) {{
    state.health = clamp(state.health - challenge.contactDamage, 0, 100);
    state.heat = clamp(state.heat + 1.5, 0, 100);
  }} else {{
    state.heat = clamp(state.heat - 1, 0, 100);
  }}
}}

function updateHud() {{
  moneyLabel.textContent = String(state.money);
  repLabel.textContent = String(state.rep);
  if (state.missionPhase === "won") statusLabel.textContent = "misión completada";
  else if (state.missionPhase === "lost") statusLabel.textContent = "misión fallida";
  else if (state.health <= 35) statusLabel.textContent = "herido";
  else if (state.missionActive) statusLabel.textContent = "misión activa";
  else statusLabel.textContent = "vivo";
}}

function movePlayer(key) {{
  const delta = state.speed * 12;
  if (key === "ArrowUp" || key === "w" || key === "W") state.y -= delta;
  if (key === "ArrowDown" || key === "s" || key === "S") state.y += delta;
  if (key === "ArrowLeft" || key === "a" || key === "A") state.x -= delta;
  if (key === "ArrowRight" || key === "d" || key === "D") state.x += delta;
  if (key === " " && state.jumpFrames === 0) state.jumpFrames = 24;
  state.x = clamp(state.x, 30, canvas.width - 60);
  state.y = clamp(state.y, 30, canvas.height - 60);
}}

function startMission() {{
  if (state.missionActive) return;
  state.x = 160;
  state.y = 260;
  state.health = 100;
  state.heat = 0;
  policia.x = 760;
  policia.y = 350;
  state.missionActive = true;
  state.missionPhase = "collect";
  logLabel.textContent = "Misión iniciada. Recoge el objetivo amarillo y evita al perseguidor rojo.";
  updateHud();
}}

function updateMission() {{
  if (!state.missionActive) return;
  if (state.health <= 0) {{
    state.missionActive = false;
    state.missionPhase = "lost";
    logLabel.textContent = "Misión fallida. Pulsa M o Iniciar misión para reintentar.";
    return;
  }}
  if (state.missionPhase === "collect" && Math.hypot(state.x - objective.x, state.y - objective.y) < 38) {{
    state.missionPhase = "escape";
    logLabel.textContent = "Objetivo recogido. Llega a la salida verde en la esquina superior izquierda.";
  }}
  if (state.missionPhase === "escape" && Math.hypot(state.x - exitZone.x, state.y - exitZone.y) < 46) {{
    state.missionActive = false;
    state.missionPhase = "won";
    state.money += challenge.reward;
    state.rep += 10;
    logLabel.textContent = `Misión completada: +${{challenge.reward}} dinero y +10 reputación. Puedes volver a jugar.`;
  }}
}}

function boost() {{
  state.speed = state.speed === 2 ? 4 : 2;
  logLabel.textContent = state.speed > 2 ? "Aceleración máxima activada." : "Velocidad normal restaurada.";
  updateHud();
}}

document.addEventListener("keydown", (event) => {{
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
  movePlayer(event.key);
  if (event.key === "m" || event.key === "M") startMission();
}});

document.getElementById("missionBtn").addEventListener("click", startMission);
document.getElementById("boostBtn").addEventListener("click", boost);

function loop() {{
  updateNPCs();
  updateEnemy();
  updateMission();
  drawBackground();
  updateHud();
  if (state.jumpFrames > 0) state.jumpFrames -= 1;
  requestAnimationFrame(loop);
}}

loop();
'''
        (prototype_dir / "game.js").write_text(js, encoding="utf-8")

        readme = f'''# {design['title']}

## Descripción
Prototipo jugable 2D en canvas generado por Atlas a partir de una dirección de mundo {design['world_mode']}, personaje {design['character']['tier']} y estilo {design['style']}.

## Jugar
- Flechas o WASD: mover. Espacio: salto visual. Botón Acelerar: alternar velocidad.
- Iniciar misión o tecla M: comenzar o reiniciar tras ganar o perder.
- Recoger el objetivo amarillo y llegar a la salida verde sin agotar la salud.
- La recompensa se entrega al completar la misión, una vez por partida.

## Alcance visual
El navegador dibuja una escena 2D. El perfil {design['graphics_profile']} y la ficha de personaje son una dirección de arte para una posible producción 3D; no representan gráficos 3D, PBR ni fotorrealismo implementados en este prototipo.

## Mundo diseñado
- escenario: {design['setting']}
- misión principal: {missions['main_mission']['name']}
- ideas para futuras ampliaciones: {', '.join(world['enemies'])}; inventario de {', '.join(world['items'])}

## Ejecutar
```bash
python launch_server.py
```
A continuación abrir `http://localhost:8000`.
'''
        (prototype_dir / "README.md").write_text(readme, encoding="utf-8")

        manifest = {
            "title": design["title"],
            "genre": "action adventure",
            "setting": design["setting"],
            "world_mode": design["world_mode"],
            "character_tier": design["character"]["tier"],
            "graphics_profile": design["graphics_profile"],
            "prototype_renderer": "canvas_2d",
            "systems": ["movimiento", "objetivo", "persecución", "salud", "recompensa"],
            "status": "playable 2D prototype",
            "generated_by": "Atlas",
            "design_note": design["universe"]["design_note"],
            "visual_target": design["art_direction"],
        }
        (self.project_root / "atlas_manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

        launch_script = '''import http.server
import socketserver
from pathlib import Path

PORT = 8000
ROOT = Path(__file__).resolve().parent

Handler = http.server.SimpleHTTPRequestHandler
handler = lambda *args, **kwargs: Handler(*args, directory=str(ROOT), **kwargs)

with socketserver.TCPServer(("127.0.0.1", PORT), handler) as httpd:
    print(f"Servidor del juego activo en http://127.0.0.1:{PORT}")
    httpd.serve_forever()
'''
        (prototype_dir / "launch_server.py").write_text(launch_script, encoding="utf-8")

        return {
            "status": "completed",
            "title": design["title"],
            "project_root": str(self.project_root),
            "design": design,
            "files": [
                str((design_dir / "game_design.json").relative_to(self.project_root)),
                str((design_dir / "world_map.json").relative_to(self.project_root)),
                str((design_dir / "missions.json").relative_to(self.project_root)),
                str((design_dir / "character_blueprint.json").relative_to(self.project_root)),
                str((design_dir / "universe_blueprint.json").relative_to(self.project_root)),
                str((design_dir / "gameplay_blueprint.json").relative_to(self.project_root)),
                str((prototype_dir / "index.html").relative_to(self.project_root)),
                str((prototype_dir / "style.css").relative_to(self.project_root)),
                str((prototype_dir / "game.js").relative_to(self.project_root)),
                str((prototype_dir / "README.md").relative_to(self.project_root)),
                str((prototype_dir / "launch_server.py").relative_to(self.project_root)),
                "atlas_manifest.json",
            ],
        }
