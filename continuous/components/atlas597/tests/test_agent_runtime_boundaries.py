import xml.etree.ElementTree as ET

import pytest

from atlas_lm.agent_runtime import AtlasAgentRuntime


def test_file_tools_reject_paths_outside_project(tmp_path):
    root = tmp_path / "project"
    root.mkdir()
    outside = tmp_path / "outside.txt"
    outside.write_text("untouched", encoding="utf-8")
    agent = AtlasAgentRuntime(root)

    for operation in (
        lambda: agent.inspect("../outside.txt"),
        lambda: agent.list_dir(".."),
        lambda: agent.read_file("../outside.txt"),
        lambda: agent.write_file("../outside.txt", "overwritten"),
        lambda: agent.read_file(str(outside)),
    ):
        with pytest.raises(ValueError, match="fuera del proyecto"):
            operation()

    assert outside.read_text(encoding="utf-8") == "untouched"
    assert agent.write_file("inside.txt", "allowed")["status"] == "written"
    assert agent.read_file("inside.txt") == "allowed"


def test_file_tools_reject_symlink_to_outside_project(tmp_path):
    root = tmp_path / "project"
    root.mkdir()
    outside = tmp_path / "outside.txt"
    outside.write_text("untouched", encoding="utf-8")
    link = root / "link.txt"
    try:
        link.symlink_to(outside)
    except (NotImplementedError, OSError) as exc:
        pytest.skip(f"Symlinks unavailable on this filesystem: {exc}")

    agent = AtlasAgentRuntime(root)
    with pytest.raises(ValueError, match="fuera del proyecto"):
        agent.read_file("link.txt")
    with pytest.raises(ValueError, match="fuera del proyecto"):
        agent.write_file("link.txt", "overwritten")
    assert outside.read_text(encoding="utf-8") == "untouched"


def test_task_execution_and_verification_reject_path_escape(tmp_path):
    agent = AtlasAgentRuntime(tmp_path / "project")
    task = "Crea un archivo llamado ../outside.txt con el contenido 'escaped'"

    assert agent.run_task(task)["status"] == "failed"
    assert agent.verify_task(task)["status"] == "failed"
    assert agent.run_workflow(task)["status"] == "failed"
    assert not (tmp_path / "outside.txt").exists()


def test_workflow_executes_once_and_reports_unsupported_tasks(tmp_path, monkeypatch):
    agent = AtlasAgentRuntime(tmp_path)
    task = "Crea un archivo llamado inside.txt con el contenido 'hola'"
    actual_run_task = agent.run_task
    calls = []

    def count_run_task(value):
        calls.append(value)
        return actual_run_task(value)

    monkeypatch.setattr(agent, "run_task", count_run_task)
    result = agent.run_workflow(task)
    assert result["status"] == "completed"
    assert calls == [task]
    assert (tmp_path / "inside.txt").read_text(encoding="utf-8") == "hola"

    unsupported = "Construye una nave espacial de verdad"
    assert agent.run_task(unsupported)["status"] == "failed"
    assert agent.verify_task(unsupported)["status"] == "failed"
    workflow = agent.run_workflow(unsupported)
    assert workflow["status"] == "failed"
    assert workflow["steps"][1]["status"] == "failed"
    assert workflow["steps"][2]["status"] == "skipped"


def test_generated_art_escapes_prompt_as_xml_text(tmp_path):
    agent = AtlasAgentRuntime(tmp_path)
    prompt = "x</text><script>alert(1)</script><text> & más"
    result = agent.generate_art_prompt(prompt)
    assert result["status"] == "completed"

    svg_path = tmp_path / result["path"]
    svg = svg_path.read_text(encoding="utf-8")
    root = ET.parse(svg_path).getroot()
    assert root.tag.endswith("svg")
    assert not any(element.tag.endswith("script") for element in root.iter())
    assert "&lt;script&gt;" in svg
