from pathlib import Path

from atlas_lm.agent_runtime import AtlasAgentRuntime


def test_agent_plan_lists_execution_steps(tmp_path):
    agent = AtlasAgentRuntime(root=tmp_path)
    plan = agent.plan("Crea un archivo llamado demo.txt con el contenido 'hola atlas'")
    assert "inspect" in plan["steps"]
    assert "write_file" in agent.tool_names()


def test_agent_can_execute_a_simple_file_task(tmp_path):
    agent = AtlasAgentRuntime(root=tmp_path)
    result = agent.run_task("Crea un archivo llamado salida.txt con el contenido 'hola atlas'")
    assert result["status"] == "completed"
    assert (tmp_path / "salida.txt").read_text(encoding="utf-8") == "hola atlas"


def test_agent_remembers_previous_turns_in_session(tmp_path):
    agent = AtlasAgentRuntime(root=tmp_path)
    first = agent.respond("Recuerda que mi nombre es Pablo", session_id="s1")
    second = agent.respond("¿Cómo me llamo?", session_id="s1")
    assert first["status"] == "completed"
    assert "Pablo" in second["answer"]
    assert second["session_id"] == "s1"


def test_agent_abstains_when_factual_claim_is_unsupported(tmp_path):
    agent = AtlasAgentRuntime(root=tmp_path)
    result = agent.respond("Dime el precio exacto del Bitcoin en este momento", session_id="s2")
    assert result["status"] in {"abstain", "needs_evidence"}
    assert "fuente" in result["answer"].lower() or "evidencia" in result["answer"].lower()


def test_agent_can_search_text_in_project_files(tmp_path):
    sample = tmp_path / "notes.txt"
    sample.write_text("Atlas tiene memoria local y revisión.", encoding="utf-8")
    agent = AtlasAgentRuntime(root=tmp_path)
    matches = agent.search_text("memoria local", root=tmp_path)
    assert matches
    assert "Atlas" in matches[0]["text"]


def test_agent_workflow_has_plan_execute_and_verify(tmp_path):
    agent = AtlasAgentRuntime(root=tmp_path)
    workflow = agent.run_workflow("Crea un archivo llamado demo.txt con el contenido 'hola agente'", session_id="wf1")
    assert workflow["status"] == "completed"
    assert [step["name"] for step in workflow["steps"]] == ["plan", "execute", "verify"]
    assert (tmp_path / "demo.txt").read_text(encoding="utf-8") == "hola agente"


def test_agent_can_summarize_project_and_run_tests(tmp_path):
    (tmp_path / "sample.py").write_text("print('ok')\n", encoding="utf-8")
    agent = AtlasAgentRuntime(root=tmp_path)
    summary = agent.project_summary(root=tmp_path)
    tests = agent.run_tests(target="sample.py")
    assert summary["file_count"] >= 1
    assert tests["status"] in {"completed", "failed"}


def test_agent_can_fetch_web_content_from_local_file_url(tmp_path):
    page = tmp_path / "page.html"
    page.write_text("<html><body><h1>Atlas local</h1><p>agente ok</p></body></html>", encoding="utf-8")
    agent = AtlasAgentRuntime(root=tmp_path)
    result = agent.web_fetch(page.as_uri())
    assert result["status"] == "completed"
    assert "Atlas local" in result["title"] or "Atlas local" in result["content"]


def test_agent_can_generate_art_and_video_prototypes(tmp_path):
    agent = AtlasAgentRuntime(root=tmp_path)
    art = agent.generate_art_prompt("ciudad futurista con neón, lluvia, skyline, personaje heroico", root=tmp_path)
    video = agent.generate_video_prompt("cámara lenta sobre la ciudad, ráfaga de neón, transiciones del tráfico", root=tmp_path)
    assert art["status"] == "completed"
    assert video["status"] == "completed"
    assert (tmp_path / "media" / "art" / "concept.svg").exists()
    assert (tmp_path / "media" / "video" / "shotlist.json").exists()


def test_agent_can_self_improve_generated_game(tmp_path):
    agent = AtlasAgentRuntime(root=tmp_path)
    result = agent.self_improve_project(
        "Haz que el juego sea más realista, con policía, salud, objetivos y más tensión nocturna",
        project_root=tmp_path,
    )
    assert result["status"] == "completed"
    assert "policia" in (tmp_path / "prototype" / "game.js").read_text(encoding="utf-8").lower()
    assert "salud" in (tmp_path / "prototype" / "README.md").read_text(encoding="utf-8").lower()


def test_agent_can_generate_blender_cinematic_scene(tmp_path):
    agent = AtlasAgentRuntime(root=tmp_path)
    scene = agent.generate_blender_scene(
        "Shot urbano nocturno, neón, ciudad mediterránea, coche, cámara en movimiento, iluminación de cine",
        project_root=tmp_path,
    )
    assert scene["status"] == "completed"
    assert (tmp_path / "blender" / "urban_cinematic_shot.py").exists()
    assert "bpy" in (tmp_path / "blender" / "urban_cinematic_shot.py").read_text(encoding="utf-8").lower()
    assert "camera" in (tmp_path / "blender" / "urban_cinematic_shot.py").read_text(encoding="utf-8").lower()


def test_agent_can_orchestrate_full_pipeline(tmp_path):
    agent = AtlasAgentRuntime(root=tmp_path)
    pipeline = agent.generate_full_pipeline(
        "Crea un shot urbano nocturno con neón, tráfico, ciudad, coche y tensión cinematográfica",
        project_root=tmp_path,
    )
    assert pipeline["status"] == "completed"
    assert (tmp_path / "prototype" / "index.html").exists()
    assert (tmp_path / "blender" / "urban_cinematic_shot.py").exists()
    assert (tmp_path / "atlas_pipeline.json").exists()
