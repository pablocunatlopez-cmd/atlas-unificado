"""Aider API with one writable artifact and no shell, Git, tests or external API."""
from __future__ import annotations
import argparse, contextlib, io, json, os, pathlib, socket, sys

VERSION = "0.86.2"
MODEL = "openai/atlas-local"
BASE = "http://127.0.0.1:11435/v1"

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("action",choices=("preflight","edit"))
    parser.add_argument("--job",required=True)
    args=parser.parse_args()
    job=pathlib.Path(args.job).resolve(strict=True)
    artifact=(job/"artifact.mjs").resolve(strict=True)
    if artifact.parent!=job or artifact.is_symlink() or not artifact.is_file():
        raise ValueError("El artefacto no es un archivo regular del trabajo.")
    request=json.loads((job/"request.json").read_text(encoding="utf-8"))
    if not isinstance(request.get("prompt"),str) or len(request["prompt"])>16000:
        raise ValueError("Petición de agente fuera de límites.")
    if os.environ.get("OPENAI_API_BASE")!=BASE:
        raise ValueError("El agente solo puede usar el servidor local de Atlas.")
    os.chdir(job)
    # Deny remote model metadata, analytics and provider calls even if a future
    # library default tries to enable one. The only permitted socket is Qwen.
    original_connect=socket.socket.connect
    original_connect_ex=socket.socket.connect_ex
    original_getaddrinfo=socket.getaddrinfo
    def permitted(address):
        return args.action=="edit" and isinstance(address,tuple) and len(address)>=2 and address[0] in ("127.0.0.1","::1") and address[1]==11435
    def connect(sock,address):
        if not permitted(address):
            raise OSError("El agente no tiene conexiones de red externas habilitadas.")
        return original_connect(sock,address)
    socket.socket.connect=connect
    def connect_ex(sock,address):
        if not permitted(address):
            raise OSError("El agente no tiene conexiones de red externas habilitadas.")
        return original_connect_ex(sock,address)
    def getaddrinfo(host,port,*values,**kwargs):
        if not permitted((host,port)):
            raise OSError("El agente no resuelve destinos externos.")
        return original_getaddrinfo(host,port,*values,**kwargs)
    socket.socket.connect_ex=connect_ex
    socket.getaddrinfo=getaddrinfo
    with contextlib.redirect_stdout(io.StringIO()),contextlib.redirect_stderr(io.StringIO()):
        from importlib.metadata import version
        if version("aider-chat")!=VERSION:
            raise RuntimeError("Versión de Aider no revisada.")
        from aider.models import Model,ModelSettings,MODEL_SETTINGS,model_info_manager
        from aider.coders import Coder
        from aider.io import InputOutput
        # Programmatic setup does not load YAML/.env from the user's home.
        info={"max_tokens":16384,"max_input_tokens":12000,"max_output_tokens":2500,"input_cost_per_token":0,"output_cost_per_token":0,"litellm_provider":"openai","mode":"chat"}
        model_info_manager.local_model_metadata[MODEL]=info
        model_info_manager.content={MODEL:info}
        model_info_manager._cache_loaded=True
        model_info_manager.get_model_info=lambda name: dict(info) if name==MODEL else (_ for _ in ()).throw(ValueError("Modelo no permitido."))
        MODEL_SETTINGS[:]=[setting for setting in MODEL_SETTINGS if setting.name!=MODEL]
        MODEL_SETTINGS.append(ModelSettings(name=MODEL,edit_format="whole",use_repo_map=False,streaming=False,extra_params={"max_tokens":2500,"temperature":.15,"timeout":150,"extra_body":{"chat_template_kwargs":{"enable_thinking":False}}}))
        model=Model(MODEL,weak_model=False,editor_model=False)
        model.weak_model=model
        model.weak_model_name=MODEL
        model.max_chat_history_tokens=12000
        # Counting is only advisory; this avoids downloading a third-party
        # tokenizer for a local model whose server enforces the real context.
        model.token_count=lambda value:max(1,len(json.dumps(value,ensure_ascii=False))//3)
        class NoAnalytics:
            def event(self,*unused,**kwargs):
                return None
        class ClosedIO(InputOutput):
            def confirm_ask(self,*unused,**kwargs):
                return False
            def get_input(self,*unused,**kwargs):
                raise EOFError()
            def read_text(self,filename,*values,**kwargs):
                if filename is None or pathlib.Path(filename).resolve()!=artifact:
                    return None
                return super().read_text(filename,*values,**kwargs)
            def write_text(self,filename,content,*values,**kwargs):
                if pathlib.Path(filename).resolve()!=artifact or artifact.is_symlink():
                    raise OSError("El agente solo escribe su artefacto.")
                return super().write_text(filename,content,*values,**kwargs)
        output=io.StringIO()
        closed_io=ClosedIO(pretty=False,yes=False,input_history_file=None,chat_history_file=None,llm_history_file=None,output=output,fancy_input=False)
        coder=Coder.create(main_model=model,io=closed_io,edit_format="whole",fnames=[str(artifact)],use_git=False,auto_commits=False,dirty_commits=False,map_tokens=0,auto_lint=False,auto_test=False,test_cmd=None,stream=False,suggest_shell_commands=False,detect_urls=False,ignore_mentions=set(),analytics=NoAnalytics(),cache_prompts=False,num_cache_warming_pings=0)
        coder.max_reflections=0
        coder.allowed_to_edit=lambda relative:str(pathlib.Path(coder.abs_root_path(relative)).resolve())==str(artifact) and not artifact.is_symlink()
        coder.run_shell_commands=lambda:""
        coder.handle_shell_commands=lambda *unused,**kwargs:""
        coder.check_for_file_mentions=lambda *unused,**kwargs:None
        if args.action=="edit":
            coder.run(with_message=request["prompt"],preproc=False)
            if not coder.partial_response_content or coder.total_tokens_received<=0:
                raise RuntimeError("Aider no recibió una respuesta verificable del modelo local.")
        if artifact.is_symlink() or artifact.resolve().parent!=job or artifact.stat().st_size>16000:
            raise RuntimeError("Aider produjo un artefacto fuera de límites.")
    print(json.dumps({"ok":True,"framework":"aider","version":VERSION,"model":"atlas-local","independentModels":False,"edited":args.action=="edit","tokensReceived":coder.total_tokens_received,"shellEnabled":False,"externalNetworkEnabled":False}))

if __name__=="__main__":
    try:
        main()
    except Exception as error:
        # The Node owner redacts its local credential before storing diagnostics.
        print(json.dumps({"ok":False,"error":str(error)[:1200]}))
        sys.exit(1)
