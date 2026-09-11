from __future__ import annotations

import hashlib
import os
from pathlib import Path
import subprocess
import sys
import time
from urllib.error import URLError
from urllib.request import urlopen


PROJECT_ROOT = Path(__file__).resolve().parents[2]
VENV_DIR = PROJECT_ROOT / ".venv-homeharvest"
REQUIREMENTS = Path(__file__).with_name("requirements.txt")
MARKER = VENV_DIR / ".requirements.sha256"
HOMEHARVEST_VERSION = "0.8.18"
ADAPTER_ENV_KEYS = {"HOMEHARVEST_HOST", "HOMEHARVEST_PORT"}


def load_adapter_environment() -> None:
    env_file = PROJECT_ROOT / ".env"
    if not env_file.exists():
        return
    for raw_line in env_file.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if key in ADAPTER_ENV_KEYS and key not in os.environ:
            os.environ[key] = value.strip().strip('"\'')


def adapter_health_url() -> str:
    host = os.environ.get("HOMEHARVEST_HOST", "127.0.0.1")
    port = os.environ.get("HOMEHARVEST_PORT", "4310")
    return f"http://{host}:{port}/health"


def existing_adapter_is_healthy() -> bool:
    try:
        with urlopen(adapter_health_url(), timeout=1) as response:
            payload = response.read(1024)
        return b'"status":"ok"' in payload and b'"service":"homeharvest"' in payload
    except (OSError, URLError):
        return False


def reuse_existing_adapter() -> None:
    print(f"Reusing HomeHarvest adapter at {adapter_health_url()}", flush=True)
    while existing_adapter_is_healthy():
        time.sleep(5)
    raise SystemExit("Existing HomeHarvest adapter stopped responding")


def venv_python() -> Path:
    return VENV_DIR / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def requirements_digest() -> str:
    return hashlib.sha256(REQUIREMENTS.read_bytes()).hexdigest()


def installed_homeharvest_version(python: Path) -> str | None:
    result = subprocess.run([
        str(python), "-c",
        "from importlib.metadata import version; print(version('homeharvest'))",
    ], capture_output=True, text=True)
    return result.stdout.strip() if result.returncode == 0 else None


def enable_python39_annotations(python: Path) -> None:
    if sys.version_info >= (3, 10):
        return
    result = subprocess.run([
        str(python), "-c",
        "import homeharvest, pathlib; print(pathlib.Path(homeharvest.__file__).parent)",
    ], capture_output=True, text=True)
    package = Path(result.stdout.strip()) if result.returncode == 0 else None
    if package is None or not package.exists():
        package = next((VENV_DIR / "lib").glob("python*/site-packages/homeharvest"))
    for source in package.rglob("*.py"):
        content = source.read_text(encoding="utf-8")
        if " | " in content and "from __future__ import annotations" not in content:
            source.write_text("from __future__ import annotations\n" + content, encoding="utf-8")


def ensure_environment() -> Path:
    python = venv_python()
    if not python.exists():
        subprocess.run([sys.executable, "-m", "venv", str(VENV_DIR)], check=True)

    digest = requirements_digest()
    installed_digest = MARKER.read_text(encoding="utf-8").strip() if MARKER.exists() else ""
    if installed_digest != digest or installed_homeharvest_version(python) != HOMEHARVEST_VERSION:
        subprocess.run([
            str(python), "-m", "pip", "install", "--disable-pip-version-check",
            "--requirement", str(REQUIREMENTS),
        ], check=True)
        MARKER.write_text(digest, encoding="utf-8")
    enable_python39_annotations(python)
    return python


if __name__ == "__main__":
    load_adapter_environment()
    if existing_adapter_is_healthy():
        reuse_existing_adapter()
    interpreter = ensure_environment()
    os.execv(str(interpreter), [str(interpreter), str(Path(__file__).with_name("server.py"))])