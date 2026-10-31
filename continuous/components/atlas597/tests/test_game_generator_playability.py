import json
import shutil
import subprocess

import pytest

from atlas_lm.game_generator import AtlasGameGenerator
from atlas_lm.agent_runtime import AtlasAgentRuntime


@pytest.mark.skipif(shutil.which("node") is None, reason="Node.js unavailable")
def test_generated_browser_game_has_a_winnable_and_restartable_mission(tmp_path):
    AtlasGameGenerator(tmp_path).generate_project("Juego urbano nocturno original")
    manifest = json.loads((tmp_path / "atlas_manifest.json").read_text(encoding="utf-8"))
    assert manifest["prototype_renderer"] == "canvas_2d"

    script = r"""
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const labels = {};
const listeners = {};
const ctx = new Proxy({}, { get: () => () => {} });
const canvas = { width: 960, height: 540, getContext: () => ctx };
const document = {
  getElementById(id) {
    if (id === 'gameCanvas') return canvas;
    labels[id] ??= { textContent: '', addEventListener: (kind, fn) => { listeners[id + ':' + kind] = fn; } };
    return labels[id];
  },
  addEventListener(kind, fn) { listeners[kind] = fn; }
};
const context = vm.createContext({ document, requestAnimationFrame() {} });
vm.runInContext(fs.readFileSync(process.argv[1], 'utf8'), context);
const run = code => vm.runInContext(code, context);

assert.equal(run('state.money'), 1200);
run('startMission()');
assert.equal(run('state.missionPhase'), 'collect');
run('startMission()');
assert.equal(run('state.money'), 1200);
run('state.x = objective.x; state.y = objective.y; updateMission()');
assert.equal(run('state.missionPhase'), 'escape');
run('state.x = exitZone.x; state.y = exitZone.y; updateMission()');
assert.equal(run('state.missionPhase'), 'won');
assert.equal(run('state.money'), 1650);
assert.equal(run('state.rep'), 10);
run('updateMission()');
assert.equal(run('state.money'), 1650);

run('startMission()');
assert.equal(run('state.missionPhase'), 'collect');
run('state.health = 0; updateMission()');
assert.equal(run('state.missionPhase'), 'lost');
assert.equal(run('state.money'), 1650);
run('startMission()');
assert.equal(run('state.health'), 100);
assert.equal(run('state.missionPhase'), 'collect');

const before = run('state.x');
listeners.keydown({ key: 'd', preventDefault() {} });
assert.ok(run('state.x') > before);
console.log('mission transitions and controls OK');
"""
    result = subprocess.run(
        [shutil.which("node"), "-e", script, str(tmp_path / "prototype" / "game.js")],
        capture_output=True,
        text=True,
        timeout=15,
    )
    assert result.returncode == 0, result.stderr
    assert "mission transitions and controls OK" in result.stdout


def test_creative_pipeline_generates_real_game_and_applies_difficulty(tmp_path):
    agent = AtlasAgentRuntime(tmp_path)
    result = agent.generate_full_pipeline("Ciudad nocturna con tráfico")

    assert result["status"] == "completed"
    js_path = tmp_path / "prototype" / "game.js"
    js = js_path.read_text(encoding="utf-8")
    assert '"enemySpeed": 2.6' in js
    assert "function updateMission()" in js
    assert (tmp_path / "prototype" / "style.css").exists()
    assert (tmp_path / "blender" / "urban_cinematic_shot.py").exists()
    assert result["pipeline"] == ["design", "prototype", "difficulty_tuning", "blender_scene"]

    repeat = agent.self_improve_project("Más tensión policial", project_root=tmp_path)
    assert repeat["status"] == "completed"
    assert repeat["changed"] is False
    assert js_path.read_text(encoding="utf-8") == js


def test_self_improvement_declines_incompatible_project_without_changing_it(tmp_path):
    game_js = tmp_path / "prototype" / "game.js"
    game_js.parent.mkdir()
    game_js.write_text("// custom game\n", encoding="utf-8")

    result = AtlasAgentRuntime(tmp_path).self_improve_project("Más tensión", project_root=tmp_path)

    assert result["status"] == "failed"
    assert game_js.read_text(encoding="utf-8") == "// custom game\n"
