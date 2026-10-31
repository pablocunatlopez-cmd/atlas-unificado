from pathlib import Path
import os
import atlas_paths


def test_env_data_root_override(tmp_path, monkeypatch):
    monkeypatch.setenv('ATLAS_DATA_ROOT', str(tmp_path/'bigdisk'))
    assert atlas_paths.choose_data_root() == tmp_path/'bigdisk'
    d=atlas_paths.ensure_layout()
    assert d['models'].is_dir() and d['datasets'].is_dir() and d['logs'].is_dir()


def test_relative_model_output_goes_to_data_root(tmp_path, monkeypatch):
    monkeypatch.setenv('ATLAS_DATA_ROOT', str(tmp_path/'atlas_data'))
    out=atlas_paths.resolve_output_path('models/example')
    assert out == tmp_path/'atlas_data'/'models'/'example'


def test_bundled_model_remains_readable(monkeypatch):
    monkeypatch.delenv('ATLAS_DATA_ROOT', raising=False)
    p=atlas_paths.resolve_model_path('models/atlas-lm-0.3-decision-nano-v2')
    assert (p/'model.pt').is_file()
