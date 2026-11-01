"""Official smolagents, local Qwen only, no generated Python/shell execution."""
from __future__ import annotations
import argparse, contextlib, io, json, os, pathlib, socket, sys
VERSION='1.26.0'
BASE='http://127.0.0.1:11435/v1'

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('action',choices=('preflight','edit'))
    parser.add_argument('--job',required=True)
    args=parser.parse_args()
    job=pathlib.Path(args.job).resolve(strict=True)
    artifact=job/'artifact.mjs'
    if artifact.is_symlink() or artifact.resolve(strict=True).parent!=job or not artifact.is_file():
        raise ValueError('Artefacto fuera del trabajo.')
    request=json.loads((job/'request.json').read_text(encoding='utf-8'))
    prompt=request.get('prompt')
    if not isinstance(prompt,str) or len(prompt)>16000 or os.environ.get('OPENAI_API_BASE')!=BASE:
        raise ValueError('Solicitud o motor fuera de límites.')
    os.chdir(job)
    original_connect=socket.socket.connect
    original_connect_ex=socket.socket.connect_ex
    original_getaddrinfo=socket.getaddrinfo
    def permitted(address):
        return args.action=='edit' and isinstance(address,tuple) and len(address)>=2 and address[0] in ('127.0.0.1','::1') and address[1]==11435
    def connect(sock,address):
        if not permitted(address): raise OSError('Solo Qwen local está habilitado.')
        return original_connect(sock,address)
    def connect_ex(sock,address):
        if not permitted(address): raise OSError('Solo Qwen local está habilitado.')
        return original_connect_ex(sock,address)
    def getaddrinfo(host,port,*values,**kwargs):
        if not permitted((host,port)): raise OSError('No se resuelven destinos externos.')
        return original_getaddrinfo(host,port,*values,**kwargs)
    socket.socket.connect=connect
    socket.socket.connect_ex=connect_ex
    socket.getaddrinfo=getaddrinfo
    with contextlib.redirect_stdout(io.StringIO()),contextlib.redirect_stderr(io.StringIO()):
        from importlib.metadata import version
        if version('smolagents')!=VERSION: raise RuntimeError('Versión no revisada.')
        from smolagents import OpenAIModel, ToolCallingAgent
        model=OpenAIModel(model_id='atlas-local',api_base=BASE,api_key=os.environ['OPENAI_API_KEY'],client_kwargs={'timeout':150,'max_retries':0},max_tokens=2500,temperature=.15,extra_body={'chat_template_kwargs':{'enable_thinking':False}})
        # Only final_answer is registered. No CodeAgent interpreter, browser,
        # filesystem tools, MCP server, remote model or arbitrary tool loading.
        agent=ToolCallingAgent(tools=[],model=model,max_steps=2,verbosity_level=0,add_base_tools=False)
        if args.action=='edit':
            current=artifact.read_text(encoding='utf-8')
            answer=agent.run(prompt+'\nArchivo actual:\n'+current+'\nDevuelve el código completo JavaScript llamando final_answer con answer igual a una cadena de código, sin Markdown. No ejecutes código.')
            if not isinstance(answer,str): raise RuntimeError('El agente no devolvió código como texto.')
            answer=answer.strip()
            if answer.startswith('```'):
                answer=answer.split('\n',1)[1].rsplit('```',1)[0].strip()
            if not answer or len(answer.encode('utf-8'))>16000: raise RuntimeError('Artefacto fuera de límites.')
            if artifact.is_symlink() or artifact.resolve().parent!=job: raise RuntimeError('Ruta de artefacto alterada.')
            artifact.write_text(answer+'\n',encoding='utf-8')
    print(json.dumps({'ok':True,'framework':'smolagents','version':VERSION,'model':'atlas-local','edited':args.action=='edit','independentModels':False,'shellEnabled':False,'externalNetworkEnabled':False}))

if __name__=='__main__':
    try: main()
    except Exception as error:
        print(json.dumps({'ok':False,'error':str(error)[:1200]}))
        sys.exit(1)
