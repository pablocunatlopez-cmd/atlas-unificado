import json
from pathlib import Path

from atlas_lm.game_generator import AtlasGameGenerator


def test_game_generator_creates_original_urban_design(tmp_path):
    generator = AtlasGameGenerator(project_root=tmp_path)
    design = generator.build_from_prompt(
        "Juego urbano original, tres distritos, tráfico, misión principal, noche, estilo moderno"
    )

    assert design["title"]
    assert len(design["districts"]) >= 3
    assert design["setting"] == "urban"
    assert design["mission_loop"]


def test_game_generator_selects_character_fidelity_and_world_mode(tmp_path):
    generator = AtlasGameGenerator(project_root=tmp_path)

    cartoon = generator.build_from_prompt("personaje cartoon 3D de plataformas en un reino original")
    cinematic = generator.build_from_prompt("personaje ultra realista 3D en Barcelona de noche")

    assert cartoon["character"]["tier"] == "stylized_3d"
    assert cartoon["world_mode"] == "original_platform_fantasy"
    assert cinematic["character"]["tier"] == "cinematic_3d"
    assert cinematic["setting"] == "Barcelona"
    assert cinematic["world_mode"] == "real_city"
    assert cinematic["graphics_profile"] == "ultra_realistic"


def test_game_generator_writes_project_files(tmp_path):
    generator = AtlasGameGenerator(project_root=tmp_path)
    result = generator.generate_project(
        "Juego urbano original, barrio, coches, misión principal, estilo moderno"
    )

    assert result["status"] == "completed"
    assert (tmp_path / "design" / "game_design.json").exists()
    assert (tmp_path / "design" / "world_map.json").exists()
    assert (tmp_path / "design" / "missions.json").exists()


def test_game_generator_builds_playable_browser_prototype(tmp_path):
    generator = AtlasGameGenerator(project_root=tmp_path)
    result = generator.generate_project(
        "Juego urbano original, tres distritos, tráfico, misión principal, noche, estilo moderno"
    )

    assert result["status"] == "completed"
    assert (tmp_path / "prototype" / "index.html").exists()
    assert (tmp_path / "prototype" / "style.css").exists()
    assert (tmp_path / "prototype" / "game.js").exists()
    assert "canvas" in (tmp_path / "prototype" / "index.html").read_text(encoding="utf-8").lower()


def test_game_generator_builds_full_stack_launchable_project(tmp_path):
    generator = AtlasGameGenerator(project_root=tmp_path)
    result = generator.generate_project(
        "Juego urbano original, barrio, misión principal, policía, neón, noche"
    )

    assert result["status"] == "completed"
    assert (tmp_path / "prototype" / "README.md").exists()
    assert (tmp_path / "prototype" / "launch_server.py").exists()
    assert "http.server" in (tmp_path / "prototype" / "launch_server.py").read_text(encoding="utf-8")


def test_game_generator_explicitly_models_city_npcs_and_3d_layout(tmp_path):
    generator = AtlasGameGenerator(project_root=tmp_path)
    result = generator.generate_project(
        "Barcelona de noche, ciudad 3D, NPCs caminando, coches, edificios, tráfico, iluminación HDR"
    )

    assert result["status"] == "completed"
    design = json.loads((tmp_path / "design" / "game_design.json").read_text(encoding="utf-8"))
    assert design["city_layout"]["buildings"] >= 8
    assert design["npc_count"] >= 6
    assert design["vehicle_count"] >= 5
    game_js = (tmp_path / "prototype" / "game.js").read_text(encoding="utf-8")
    assert "NPC" in game_js or "npc" in game_js.lower()
    assert "building" in game_js.lower() or "edificio" in game_js.lower()


def test_game_generator_writes_character_and_universe_blueprints(tmp_path):
    generator = AtlasGameGenerator(project_root=tmp_path)
    result = generator.generate_project("personaje 3D ultra realista en Barcelona con misiones nocturnas")

    assert result["status"] == "completed"
    assert (tmp_path / "design" / "character_blueprint.json").exists()
    assert (tmp_path / "design" / "universe_blueprint.json").exists()
    assert "cinematic_3d" in (tmp_path / "atlas_manifest.json").read_text(encoding="utf-8")
    assert "Barcelona" in (tmp_path / "design" / "universe_blueprint.json").read_text(encoding="utf-8")


def test_game_generator_supports_prompt_to_3d_scene_with_mobility(tmp_path):
    generator = AtlasGameGenerator(project_root=tmp_path)
    result = generator.generate_project(
        "Crea un escenario 3D urbano con protagonista que puede correr, saltar y conducir, NPCs en la calle y ciudad nocturna"
    )

    assert result["status"] == "completed"
    design = result["design"]
    assert design["scene_type"] == "3d_city"
    assert "correr" in " ".join(design["mobility"]).lower()
    assert "saltar" in " ".join(design["mobility"]).lower()
    assert "conducir" in " ".join(design["mobility"]).lower()
    game_js = (tmp_path / "prototype" / "game.js").read_text(encoding="utf-8")
    assert "ArrowUp" in game_js or "W" in game_js
    assert "NPC" in game_js or "npc" in game_js.lower()
