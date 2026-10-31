"""Compile Atlas's ESSL 3 shaders and render the real scene with offscreen EGL.
This is a graphics test, not browser/UI QA. No HTTP server or browser is started.
"""
import ctypes as C
import ctypes.util
import json
import sys
from pathlib import Path
from PIL import Image

fixture=json.loads(Path(sys.argv[1]).read_text())
egl=C.CDLL(ctypes.util.find_library('EGL'))
egl.eglGetProcAddress.argtypes=[C.c_char_p];egl.eglGetProcAddress.restype=C.c_void_p
get_display=C.CFUNCTYPE(C.c_void_p,C.c_uint,C.c_void_p,C.POINTER(C.c_int))(egl.eglGetProcAddress(b'eglGetPlatformDisplayEXT'))
display=get_display(0x31DD,None,None)
def call(name,restype,args):
 f=getattr(egl,name);f.restype=restype;f.argtypes=args;return f
initialize=call('eglInitialize',C.c_uint,[C.c_void_p,C.POINTER(C.c_int),C.POINTER(C.c_int)])
major=C.c_int();minor=C.c_int();assert initialize(display,C.byref(major),C.byref(minor)), 'EGL initialization failed'
assert call('eglBindAPI',C.c_uint,[C.c_uint])(0x30A0), 'OpenGL ES unavailable'
attrs=(C.c_int*15)(0x3024,8,0x3023,8,0x3022,8,0x3021,8,0x3033,1,0x3040,0x40,0x3025,0,0x3038)
config=C.c_void_p();count=C.c_int()
assert call('eglChooseConfig',C.c_uint,[C.c_void_p,C.POINTER(C.c_int),C.POINTER(C.c_void_p),C.c_int,C.POINTER(C.c_int)])(display,attrs,C.byref(config),1,C.byref(count)) and count.value, 'No ES3 config'
w,h=256,176
pattrs=(C.c_int*5)(0x3057,w,0x3056,h,0x3038)
surface=call('eglCreatePbufferSurface',C.c_void_p,[C.c_void_p,C.c_void_p,C.POINTER(C.c_int)])(display,config,pattrs)
cattrs=(C.c_int*3)(0x3098,3,0x3038)
context=call('eglCreateContext',C.c_void_p,[C.c_void_p,C.c_void_p,C.c_void_p,C.POINTER(C.c_int)])(display,config,None,cattrs)
assert context and surface and call('eglMakeCurrent',C.c_uint,[C.c_void_p,C.c_void_p,C.c_void_p,C.c_void_p])(display,surface,surface,context), 'No graphics context'

def gl(name,restype,args):
 address=egl.eglGetProcAddress(name.encode());assert address,name
 return C.CFUNCTYPE(restype,*args)(address)
create_shader=gl('glCreateShader',C.c_uint,[C.c_uint]);shader_source=gl('glShaderSource',None,[C.c_uint,C.c_int,C.POINTER(C.c_char_p),C.POINTER(C.c_int)]);compile_shader=gl('glCompileShader',None,[C.c_uint]);shader_iv=gl('glGetShaderiv',None,[C.c_uint,C.c_uint,C.POINTER(C.c_int)]);shader_log=gl('glGetShaderInfoLog',None,[C.c_uint,C.c_int,C.POINTER(C.c_int),C.c_char_p])
def shader(kind,source):
 s=create_shader(kind);raw=C.c_char_p(source.encode());shader_source(s,1,C.byref(raw),None);compile_shader(s);ok=C.c_int();shader_iv(s,0x8B81,C.byref(ok));
 if not ok.value:
  buffer=C.create_string_buffer(30000);shader_log(s,30000,None,buffer);raise AssertionError(buffer.value.decode())
 return s
create_program=gl('glCreateProgram',C.c_uint,[]);attach=gl('glAttachShader',None,[C.c_uint,C.c_uint]);link=gl('glLinkProgram',None,[C.c_uint]);program_iv=gl('glGetProgramiv',None,[C.c_uint,C.c_uint,C.POINTER(C.c_int)]);program_log=gl('glGetProgramInfoLog',None,[C.c_uint,C.c_int,C.POINTER(C.c_int),C.c_char_p])
def program(fragment):
 p=create_program();attach(p,shader(0x8B31,fixture['vertexShader']));attach(p,shader(0x8B30,fragment));link(p);ok=C.c_int();program_iv(p,0x8B82,C.byref(ok));
 if not ok.value:
  buffer=C.create_string_buffer(30000);program_log(p,30000,None,buffer);raise AssertionError(buffer.value.decode())
 return p
ray=program(fixture['fragmentShader']);program(fixture['displayShader'])
use=gl('glUseProgram',None,[C.c_uint]);loc=gl('glGetUniformLocation',C.c_int,[C.c_uint,C.c_char_p]);uniform1i=gl('glUniform1i',None,[C.c_int,C.c_int]);uniform1f=gl('glUniform1f',None,[C.c_int,C.c_float]);uniform2f=gl('glUniform2f',None,[C.c_int,C.c_float,C.c_float]);uniform3fv=gl('glUniform3fv',None,[C.c_int,C.c_int,C.POINTER(C.c_float)]);uniform4fv=gl('glUniform4fv',None,[C.c_int,C.c_int,C.POINTER(C.c_float)])
gen_tex=gl('glGenTextures',None,[C.c_int,C.POINTER(C.c_uint)]);bind_tex=gl('glBindTexture',None,[C.c_uint,C.c_uint]);image_tex=gl('glTexImage2D',None,[C.c_uint,C.c_int,C.c_int,C.c_int,C.c_int,C.c_int,C.c_uint,C.c_uint,C.c_void_p]);tex_param=gl('glTexParameteri',None,[C.c_uint,C.c_uint,C.c_int]);gen_fb=gl('glGenFramebuffers',None,[C.c_int,C.POINTER(C.c_uint)]);bind_fb=gl('glBindFramebuffer',None,[C.c_uint,C.c_uint]);attach_fb=gl('glFramebufferTexture2D',None,[C.c_uint,C.c_uint,C.c_uint,C.c_uint,C.c_int]);check_fb=gl('glCheckFramebufferStatus',C.c_uint,[C.c_uint]);viewport=gl('glViewport',None,[C.c_int,C.c_int,C.c_int,C.c_int]);draw=gl('glDrawArrays',None,[C.c_uint,C.c_int,C.c_int]);active_tex=gl('glActiveTexture',None,[C.c_uint]);read=gl('glReadPixels',None,[C.c_int,C.c_int,C.c_int,C.c_int,C.c_uint,C.c_uint,C.c_void_p]);error=gl('glGetError',C.c_uint,[])
vao=C.c_uint();gl('glGenVertexArrays',None,[C.c_int,C.POINTER(C.c_uint)])(1,C.byref(vao));gl('glBindVertexArray',None,[C.c_uint])(vao)
textures=(C.c_uint*2)();buffers=(C.c_uint*2)();gen_tex(2,textures);gen_fb(2,buffers)
for i in range(2):
 bind_tex(0x0DE1,textures[i]);image_tex(0x0DE1,0,0x8058,w,h,0,0x1908,0x1401,None)
 for param,value in [(0x2801,0x2600),(0x2800,0x2600),(0x2802,0x812F),(0x2803,0x812F)]:tex_param(0x0DE1,param,value)
 bind_fb(0x8D40,buffers[i]);attach_fb(0x8D40,0x8CE0,0x0DE1,textures[i],0);assert check_fb(0x8D40)==0x8CD5
use(ray)
def f3(name,value):uniform3fv(loc(ray,name.encode()),1,(C.c_float*3)(*value))
def f4(name,values):uniform4fv(loc(ray,name.encode()),len(values)//4,(C.c_float*len(values))(*values))
scene=fixture['scene'];objects=[];dimensions=[];rotations=[]
for o in scene['objects']:
 objects.extend(o['position']+[0 if o['type']=='sphere' else 1]);dimensions.extend(o['size']+[o['material']]);rotations.extend([o['yaw'],0,0,0])
objects.extend([0.]*(160-len(objects)));dimensions.extend([0.]*(160-len(dimensions)));rotations.extend([0.]*(160-len(rotations)))
materials=[];surfaces=[]
for m in scene['materials']:materials.extend(m['color']+[m['roughness']]);surfaces.extend([m['metalness'],m['emission'],0,0])
f4('objects[0]',objects);f4('dimensions[0]',dimensions);f4('rotations[0]',rotations);f4('materials[0]',materials);f4('surface[0]',surfaces)
uniform1i(loc(ray,b'objectCount'),len(scene['objects']));uniform1i(loc(ray,b'scene'),scene['scene']);uniform1i(loc(ray,b'previousFrame'),0);uniform2f(loc(ray,b'resolution'),w,h)
f3('camera',scene['camera']);f3('target',scene['target']);f3('skyTint',scene['sky'])
import math
sun=scene['sun'];length=math.sqrt(sum(x*x for x in sun));f3('sunDirection',[x/length for x in sun]);uniform1f(loc(ray,b'fog'),scene['fog']);uniform1f(loc(ray,b'exposure'),scene['exposure'])
viewport(0,0,w,h);active_tex(0x84C0)
sample_count=int(sys.argv[3]) if len(sys.argv)>3 else 24
for n in range(sample_count):
 i=n%2;bind_fb(0x8D40,buffers[i]);bind_tex(0x0DE1,textures[1-i]);uniform1i(loc(ray,b'samples'),n);draw(0x0004,0,3)
pixels=(C.c_ubyte*(w*h*4))();read(0,0,w,h,0x1908,0x1401,pixels);assert error()==0,'OpenGL error'
image=Image.frombytes('RGBA',(w,h),bytes(pixels)).transpose(Image.Transpose.FLIP_TOP_BOTTOM).convert('RGB');image.save(sys.argv[2]);extrema=image.getextrema();assert any(b-a>40 for a,b in extrema),'Render is effectively blank'
renderer=gl('glGetString',C.c_char_p,[C.c_uint])(0x1F01).decode();print(json.dumps({'shaders':'compiled and linked','rendered':str(sys.argv[2]),'renderer':renderer,'objects':len(scene['objects']),'samples':sample_count,'range':extrema}))
call('eglTerminate',C.c_uint,[C.c_void_p])(display)
