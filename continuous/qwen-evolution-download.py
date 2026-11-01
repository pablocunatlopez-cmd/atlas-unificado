"""Download one pinned, public Qwen snapshot to the isolated evolution disk."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import time
import urllib.request

MODEL = "Qwen/Qwen3.5-9B"
REVISION = "c202236235762e1c871ad0ccb60c8ee5ba337b9a"
FILES = {"config.json", "tokenizer.json", "tokenizer_config.json", "chat_template.jinja", "model.safetensors.index.json", "model.safetensors-00001-of-00004.safetensors", "model.safetensors-00002-of-00004.safetensors", "model.safetensors-00003-of-00004.safetensors", "model.safetensors-00004-of-00004.safetensors"}

def digest(file, algorithm="sha256", git_blob=False):
    value = hashlib.new(algorithm)
    if git_blob:
        value.update(("blob " + str(file.stat().st_size) + "\0").encode())
    with file.open("rb") as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    args = parser.parse_args()
    root = Path(args.root).resolve()
    model = root / "models" / "Qwen3.5-9B"
    root.mkdir(parents=True, exist_ok=True)
    for key, value in {"HF_HOME": str(root / "cache" / "huggingface"), "HF_HUB_OFFLINE": "0", "TRANSFORMERS_OFFLINE": "0", "HF_HUB_DISABLE_XET": "1", "HF_HUB_DISABLE_PROGRESS_BARS": "1", "HF_HUB_ETAG_TIMEOUT": "60", "HF_HUB_DOWNLOAD_TIMEOUT": "180", "TEMP": str(root / "tmp"), "TMP": str(root / "tmp")}.items():
        os.environ[key] = value
    (root / "tmp").mkdir(exist_ok=True)
    def write(name, value):
        temporary = root / (name + ".tmp")
        temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(root / name)
    status = {"modelId": MODEL, "revision": REVISION, "status": "metadata", "at": time.time(), "verified": [], "weightsChanged": False}
    write("download-status.json", status)
    with urllib.request.urlopen("https://huggingface.co/api/models/" + MODEL + "/revision/" + REVISION + "?blobs=true", timeout=60) as response:
        metadata = json.load(response)
    if metadata.get("sha") != REVISION or metadata.get("gated"):
        raise RuntimeError("El snapshot ya no corresponde al modelo público fijado.")
    siblings = [item for item in metadata["siblings"] if item["rfilename"] in FILES]
    if len(siblings) != len(FILES):
        raise RuntimeError("El snapshot no contiene los archivos previstos.")
    status.update(status="downloading", totalBytes=sum(item["size"] for item in siblings), files=[{"name": item["rfilename"], "bytes": item["size"], "sha256": item.get("lfs", {}).get("sha256")} for item in siblings])
    write("download-status.json", status)
    from huggingface_hub import snapshot_download
    snapshot_download(repo_id=MODEL, revision=REVISION, local_dir=model, allow_patterns=sorted(FILES), max_workers=4, token=False)
    status["status"] = "verifying"
    write("download-status.json", status)
    verified = []
    for item in siblings:
        file = (model / item["rfilename"]).resolve()
        if not file.is_relative_to(model.resolve()) or file.stat().st_size != item["size"]:
            raise RuntimeError("Tamaño o ruta de snapshot incorrecto.")
        expected = item.get("lfs", {}).get("sha256")
        if expected:
            if digest(file) != expected:
                raise RuntimeError("Un shard no coincide con SHA-256 oficial.")
        elif digest(file, "sha1", True) != item["blobId"]:
            raise RuntimeError("Un archivo no coincide con el objeto Git fijado.")
        verified.append({"name": item["rfilename"], "bytes": file.stat().st_size, "mtimeNs": file.stat().st_mtime_ns, "sha256": digest(file) if not expected else expected})
        status["verified"] = [value["name"] for value in verified]
        write("download-status.json", status)
    write("model-source-verified.json", {"modelId": MODEL, "revision": REVISION, "license": "Apache-2.0", "files": verified, "verifiedAt": time.time(), "weightsTrained": False})
    status.update(status="verified", finishedAt=time.time())
    write("download-status.json", status)
    print(json.dumps({"status": "verified", "files": len(verified), "bytes": sum(item["bytes"] for item in verified)}))

if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Avoid printing expiring signed artifact URLs or local credentials.
        try:
            import sys
            destination = Path(sys.argv[sys.argv.index("--root") + 1]).resolve() / "download-status.json"
            status = json.loads(destination.read_text(encoding="utf-8"))
            status.update(status="failed", errorType=type(error).__name__)
            destination.write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception:
            pass
        print(json.dumps({"status": "failed", "errorType": type(error).__name__, "reason": "La descarga fijada no terminó; se conservan sus parciales para reanudar."}))
        raise SystemExit(1)
