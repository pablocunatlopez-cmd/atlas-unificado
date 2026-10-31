from __future__ import annotations

import os
import shutil
import string
from pathlib import Path


ROOT = Path(__file__).resolve().parent
ENV_NAME = 'ATLAS_DATA_ROOT'


def _windows_candidate_drives():
    if os.name != 'nt':
        return []
    out = []
    # Prefer X when present, then select the available drive with most free space.
    ordered = ['X'] + [drive for drive in string.ascii_uppercase if drive != 'X']
    for drive in ordered:
        path = Path(f'{drive}:\\')
        try:
            if path.exists():
                out.append((drive, path, shutil.disk_usage(path).free))
        except OSError:
            pass
    return out


def choose_data_root() -> Path:
    raw = os.getenv(ENV_NAME, '').strip()
    if raw:
        return Path(raw).expanduser()
    if os.name == 'nt':
        x = Path('X:\\')
        try:
            if x.exists():
                return x / 'ATLAS_DATA'
        except OSError:
            pass
        drives = _windows_candidate_drives()
        if drives:
            _, path, _ = max(drives, key=lambda item: item[2])
            return path / 'ATLAS_DATA'
    return ROOT / 'runtime_data'


def layout(root: Path | None = None) -> dict[str, Path]:
    selected = Path(root) if root else choose_data_root()
    return {
        'root': selected,
        'models': selected / 'models',
        'checkpoints': selected / 'checkpoints',
        'datasets': selected / 'datasets',
        'cache': selected / 'cache',
        'logs': selected / 'logs',
        'tmp': selected / 'tmp',
        'eval': selected / 'eval',
    }


def ensure_layout(root: Path | None = None) -> dict[str, Path]:
    directories = layout(root)
    for name, path in directories.items():
        if name != 'root':
            path.mkdir(parents=True, exist_ok=True)
    directories['root'].mkdir(parents=True, exist_ok=True)
    return directories


def data_report() -> dict:
    directories = ensure_layout()
    root = directories['root']
    try:
        usage = shutil.disk_usage(root)
        total, used, free = usage.total, usage.used, usage.free
    except OSError:
        total = used = free = 0

    writable = False
    probe = directories['tmp'] / '.atlas_write_probe'
    try:
        probe.write_text('ok', encoding='utf-8')
        probe.unlink(missing_ok=True)
        writable = True
    except OSError:
        pass

    return {
        'data_root': str(root),
        'preferred_x': os.name == 'nt' and str(root).upper().startswith('X:'),
        'writable': writable,
        'total_gb': round(total / 1073741824, 2) if total else None,
        'free_gb': round(free / 1073741824, 2) if free else None,
        'paths': {name: str(path) for name, path in directories.items() if name != 'root'},
    }


def resolve_model_path(raw: str | Path) -> Path:
    path = Path(raw).expanduser()
    if path.is_absolute():
        return path

    directories = layout()
    portable = str(path).replace('\\', '/')
    if portable.startswith('models/'):
        stored = directories['models'] / Path(portable).relative_to('models')
        if stored.exists():
            return stored

    bundled = ROOT / path
    if bundled.exists():
        return bundled
    if portable.startswith('models/'):
        return directories['models'] / Path(portable).relative_to('models')
    return ROOT / path


def resolve_output_path(raw: str | Path, category: str = 'root') -> Path:
    path = Path(raw).expanduser()
    if path.is_absolute():
        return path

    directories = ensure_layout()
    portable = str(path).replace('\\', '/')
    if portable.startswith('models/'):
        return directories['models'] / Path(portable).relative_to('models')
    if portable.startswith('training/generated/'):
        return directories['datasets'] / Path(portable).relative_to('training/generated')
    if category in directories and category != 'root':
        return directories[category] / path.name
    return directories['root'] / path
