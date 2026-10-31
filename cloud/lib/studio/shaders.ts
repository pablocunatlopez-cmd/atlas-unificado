export const vertexShader=`#version 300 es
precision highp float;
precision highp int;
out vec2 uv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
export const fragmentShader=`#version 300 es
precision highp float;
precision highp int;
uniform vec2 resolution;
uniform sampler2D previousFrame;
uniform int samples;
uniform int objectCount;
uniform int scene;
uniform vec4 objects[40];
uniform vec4 dimensions[40];
uniform vec4 rotations[40];
uniform vec4 materials[12];
uniform vec4 surface[12];
uniform vec3 camera;
uniform vec3 target;
uniform vec3 sunDirection;
uniform vec3 skyTint;
uniform float fog;
uniform float exposure;
in vec2 uv;
out vec4 color;
const float PI=3.14159265359;
uint state;
float randomValue(){state=state*747796405u+2891336453u;uint word=((state>>((state>>28u)+4u))^state)*277803737u;word=(word>>22u)^word;return float(word)/4294967296.;}
vec3 sky(vec3 d){float up=max(d.y,0.);vec3 horizon=mix(vec3(.65,.7,.78),skyTint,.35);vec3 zenith=skyTint*.65;vec3 c=mix(horizon,zenith,pow(up,.45));c+=vec3(5.,3.8,2.6)*pow(max(dot(d,sunDirection),0.),900.);return c;}
mat2 rotateY(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
struct Hit{float distance;vec3 normal;int materialId;};
Hit intersectScene(vec3 ro,vec3 rd){
 Hit hit;hit.distance=10000.;hit.normal=vec3(0,1,0);hit.materialId=0;
 if(abs(rd.y)>.00001){float t=-ro.y/rd.y;if(t>.002){hit.distance=t;hit.normal=vec3(0,1,0);}}
 for(int i=0;i<40;i++){if(i>=objectCount)break;vec3 p=ro-objects[i].xyz,d=rd;float yaw=rotations[i].x;mat2 rotation=rotateY(-yaw);p.xz=rotation*p.xz;d.xz=rotation*d.xz;float t=10000.;vec3 n=vec3(0,1,0);
  if(objects[i].w<.5){float radius=dimensions[i].x;float b=dot(p,d),c=dot(p,p)-radius*radius,h=b*b-c;if(h>0.){float nearT=-b-sqrt(h),farT=-b+sqrt(h);t=nearT>.002?nearT:farT;n=normalize(p+d*t);}}
  else{vec3 safeD=vec3(abs(d.x)<.000001?.000001:d.x,abs(d.y)<.000001?.000001:d.y,abs(d.z)<.000001?.000001:d.z);vec3 inv=1./safeD,m=inv*p,k=abs(inv)*dimensions[i].xyz;vec3 t1=-m-k,t2=-m+k;float nearT=max(max(t1.x,t1.y),t1.z),farT=min(min(t2.x,t2.y),t2.z);if(farT>max(nearT,.002)){t=nearT>.002?nearT:farT;vec3 q=(p+d*t)/dimensions[i].xyz;vec3 aq=abs(q);n=aq.x>aq.y&&aq.x>aq.z?vec3(sign(q.x),0,0):aq.y>aq.z?vec3(0,sign(q.y),0):vec3(0,0,sign(q.z));}}
  if(t>.002&&t<hit.distance){hit.distance=t;n.xz=rotateY(yaw)*n.xz;hit.normal=n;hit.materialId=int(dimensions[i].w+.5);}
 }
 return hit;
}
vec3 groundColor(vec3 p,vec3 base){
 if(scene==3){float center=3.2*sin(p.z*.045);float x=abs(p.x-center);float road=1.-smoothstep(3.95,4.05,x);vec3 grass=base*(.8+.12*sin(p.x*43.)*sin(p.z*36.));vec3 asphalt=vec3(.055,.06,.067)*(1.+.12*sin(p.x*92.)*sin(p.z*77.));float stripe=(1.-smoothstep(.055,.095,x))*step(.45,fract(p.z*.19));float edge=1.-smoothstep(.05,.09,abs(x-3.6));return mix(grass,mix(asphalt,vec3(.9),max(stripe,edge)*.85),road);}
 float grain=sin(p.x*97.)*sin(p.z*103.)*.016;float marble=sin(p.x*.75+p.z*.18+sin(p.z*.7)*1.8);return base*(.965+.035*marble+grain);
}
vec3 hemisphere(vec3 n){float a=2.*PI*randomValue(),r=sqrt(randomValue());vec3 u=normalize(cross(abs(n.y)<.9?vec3(0,1,0):vec3(1,0,0),n)),v=cross(n,u);return normalize(u*cos(a)*r+v*sin(a)*r+n*sqrt(1.-r*r));}
float distribution(float nh,float rough){float a=rough*rough,a2=a*a,d=nh*nh*(a2-1.)+1.;return a2/max(PI*d*d,.00001);}
float geometry(float nx,float rough){float k=(rough+1.);k=k*k/8.;return nx/(nx*(1.-k)+k);}
vec3 fresnel(float v,vec3 f0){return f0+(1.-f0)*pow(clamp(1.-v,0.,1.),5.);}
vec3 trace(vec3 ro,vec3 rd){
 vec3 radiance=vec3(0),throughput=vec3(1);float firstDistance=10000.;
 for(int bounce=0;bounce<3;bounce++){
  Hit h=intersectScene(ro,rd);if(bounce==0)firstDistance=h.distance;if(h.distance>9999.){radiance+=throughput*sky(rd);break;}
  vec3 p=ro+rd*h.distance,n=faceforward(h.normal,rd,h.normal);int id=h.materialId;vec3 albedo=materials[id].rgb;float rough=clamp(materials[id].a,.04,1.),metal=surface[id].x,emission=surface[id].y;
  if(id==0)albedo=groundColor(p,albedo);
  radiance+=throughput*albedo*emission;
  vec3 l=normalize(sunDirection+hemisphere(sunDirection)*.035),v=-rd,halfVector=normalize(l+v);float nl=max(dot(n,l),0.),nv=max(dot(n,v),.001),nh=max(dot(n,halfVector),0.),vh=max(dot(v,halfVector),0.);
  vec3 f0=mix(vec3(.04),albedo,metal),F=fresnel(vh,f0);float D=distribution(nh,rough),G=geometry(nv,rough)*geometry(nl,rough);vec3 spec=D*G*F/max(4.*nv*max(nl,.001),.001);
  float visibility=intersectScene(p+n*.005,l).distance>9999.?1.:0.;vec3 direct=((1.-F)*(1.-metal)*albedo/PI+spec)*nl*visibility*vec3(3.5,3.15,2.7)*(max(skyTint.r,max(skyTint.g,skyTint.b))<.2?.035:1.);
  radiance+=throughput*direct;
  float specChance=mix(.22,.9,metal);if(randomValue()<specChance){rd=normalize(mix(reflect(rd,n),hemisphere(n),rough*rough));if(dot(rd,n)<=0.)rd=reflect(rd,n);throughput*=fresnel(nv,f0)/max(specChance,.1);}else{rd=hemisphere(n);throughput*=albedo*(1.-metal)/max(1.-specChance,.1);}
  ro=p+n*.005;throughput=min(throughput,vec3(4.));if(max(throughput.r,max(throughput.g,throughput.b))<.005)break;
 }
 if(fog>0.&&firstDistance<9999.)radiance=mix(sky(vec3(0,.1,1)),radiance,exp(-firstDistance*fog));return max(radiance,vec3(0));
}
vec3 toneMap(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){
 state=uint(gl_FragCoord.x)*1973u+uint(gl_FragCoord.y)*9277u+uint(samples+1)*26699u;
 vec2 jitter=vec2(randomValue(),randomValue())-.5;vec2 pixel=(gl_FragCoord.xy+jitter)/resolution;vec2 p=(pixel*2.-1.)*vec2(resolution.x/resolution.y,1.);
 vec3 forward=normalize(target-camera),right=normalize(cross(forward,vec3(0,1,0))),up=cross(right,forward);vec3 direction=normalize(forward*1.75+right*p.x+up*p.y);
 vec3 c=pow(toneMap(trace(camera,direction)*exposure),vec3(1./2.2));vec3 history=texture(previousFrame,gl_FragCoord.xy/resolution).rgb;
 color=vec4(mix(history,c,1./float(samples+1)),1.);
}`;
export const displayShader=`#version 300 es
precision highp float;
precision highp int;
uniform sampler2D image;
in vec2 uv;
out vec4 color;
void main(){color=texture(image,uv);}`;
