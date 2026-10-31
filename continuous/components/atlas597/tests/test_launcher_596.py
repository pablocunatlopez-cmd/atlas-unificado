from pathlib import Path
from unittest.mock import patch, Mock


def test_launcher_is_one_click_and_has_diagnostics():
    root=Path(__file__).resolve().parent.parent
    bat=(root/'ABRIR_ATLAS_EDGE.bat').read_text(encoding='utf-8',errors='replace')
    ps=(root/'ATLAS_START.ps1').read_text(encoding='utf-8',errors='replace')
    assert 'ExecutionPolicy Bypass' in bat
    assert 'venv\\atlas-5.9.7' in ps
    assert '/api/health' in ps
    assert 'ATLAS_STARTUP.log' in ps
    assert '8765' in ps and '8795' in ps


def test_codex_presence_not_blocked_by_failed_doctor(monkeypatch):
    import atlas_lm.codex_live as c
    monkeypatch.setattr(c.shutil,'which',lambda name:'C:/fake/codex.exe')
    def fake_run(args,**kwargs):
        if '--version' in args:
            return Mock(returncode=0,stdout='codex-cli 0.1',stderr='')
        return Mock(returncode=1,stdout='{"overallStatus":"fail"}',stderr='')
    monkeypatch.setattr(c.subprocess,'run',fake_run)
    r=c.codex_available()
    assert r['available'] is True
    assert r['doctor_ok'] is False


def test_launcher_597_never_dies_silently_and_probes_via_files():
    root=Path(__file__).resolve().parent.parent
    ps=(root/'ATLAS_START.ps1').read_text(encoding='utf-8',errors='replace')
    assert 'atlas-5.9.7' in ps
    assert 'trap {' in ps
    assert 'Invoke-NativeLogged' in ps
    assert 'startup_probe.py' in ps
    assert 'startup_gpu_probe.py' in ps
    assert 'Dependencias núcleo OK.' in ps
    assert 'FATAL POWERSHELL' in ps


def test_launcher_597_has_safe_fallbacks():
    root=Path(__file__).resolve().parent.parent
    assert (root/'ABRIR_ATLAS_EDGE_SIN_GPU.bat').exists()
    assert (root/'ABRIR_ATLAS_PORTABLE.bat').exists()
    no_gpu=(root/'ABRIR_ATLAS_EDGE_SIN_GPU.bat').read_text(encoding='utf-8',errors='replace')
    portable=(root/'ABRIR_ATLAS_PORTABLE.bat').read_text(encoding='utf-8',errors='replace')
    assert '-SkipGpuSetup' in no_gpu
    assert '-Portable' in portable
