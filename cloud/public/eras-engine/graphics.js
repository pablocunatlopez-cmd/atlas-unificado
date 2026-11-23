import * as THREE from './vendor/three.module.js';
import {HDRLoader} from './vendor/HDRLoader.js';

export const GRAPHICS_VERSION = '0.12';
export function qualityProfile(quality = 'auto', mobile = false) {
  const cinematic = quality === 'ultra';
  const low = quality === 'low';
  return {
    pixelRatio: low ? 1 : cinematic ? 2 : mobile ? (quality === 'high' ? 1.65 : 1.35) : 1.8,
    shadowSize: low ? 0 : cinematic ? 4096 : mobile ? (quality === 'high' ? 2048 : 1536) : 2048,
    trees: low ? 48 : mobile ? 72 : cinematic ? 140 : 110,
    grass: low ? 750 : mobile ? 2100 : cinematic ? 7800 : 4600,
    pebbles: low ? 160 : mobile ? 500 : cinematic ? 2000 : 1100,
    scannedTrees:low?16:mobile?(cinematic?48:quality==='high'?40:32):cinematic?90:64,
    scannedRocks:low?24:mobile?48:cinematic?100:80,
    atmosphere: !low,
    postprocess: !low,
  };
}

export function hdrSunDirection(texture){
  const {data,width,height}=texture.image;let brightest=-1,index=0;
  for(let i=0;i<width*height;i++){
    const read=v=>texture.type===THREE.HalfFloatType?THREE.DataUtils.fromHalfFloat(v):v;
    const luminance=read(data[i*4])*.2126+read(data[i*4+1])*.7152+read(data[i*4+2])*.0722;
    if(luminance>brightest){brightest=luminance;index=i;}
  }
  const u=(index%width+.5)/width,v=1-(Math.floor(index/width)+.5)/height;
  const longitude=(u-.5)*Math.PI*2,latitude=(v-.5)*Math.PI;
  return new THREE.Vector3(Math.cos(latitude)*Math.cos(longitude),Math.sin(latitude),Math.cos(latitude)*Math.sin(longitude)).multiplyScalar(60);
}

export function loadSurfaces(renderer) {
  const loader = new THREE.TextureLoader();
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const surfaces = {};
  const pending = [];
  const failed = [];
  function load(name, color = false, repeat = true) {
    const path = `./assets/surfaces/${name}.webp?v=04`;
    let resolve;
    pending.push(new Promise(r => { resolve = r; }));
    const texture = loader.load(path, () => resolve(), undefined, () => {
      failed.push(path);
      // Keep the world playable with a neutral texture if an asset fails.
      texture.image = {data:new Uint8Array([178,178,178,255]),width:1,height:1};
      texture.isDataTexture = true;
      texture.needsUpdate = true;
      resolve();
    });
    texture.wrapS = texture.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    texture.anisotropy = anisotropy;
    texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    return texture;
  }
  for (const name of ['snow','earth','rock','cloth','leather','wood','stone','metal','fur','bark','brick','skin']) {
    surfaces[name] = {map:load(`${name}-color`,true),normalMap:load(`${name}-normal`),
      roughnessMap:load(`${name}-orm`),aoMap:null};
    surfaces[name].aoMap = surfaces[name].roughnessMap;
  }
  for(const name of ['snow','earth','rock','bark','wood','brick','leather'])surfaces[name].heightMap=load(`${name}-height`);
  for (const name of ['pine','olive','grass','soft']) surfaces[name] = load(name,name !== 'soft',false);
  pending.push(new Promise(resolve=>{
    new HDRLoader().load('./assets/daylight.hdr',texture=>{
      texture.mapping=THREE.EquirectangularReflectionMapping;surfaces.daylight=texture;resolve();
    },undefined,()=>{failed.push('daylight.hdr');resolve();});
  }));
  pending.push(new Promise(resolve=>{
    new HDRLoader().load('./assets/sky-2k.hdr',texture=>{
      texture.mapping=THREE.EquirectangularReflectionMapping;surfaces.panorama=texture;surfaces.daylightDirection=hdrSunDirection(texture);resolve();
    },undefined,()=>{failed.push('sky-2k.hdr');resolve();});
  }));
  return {surfaces, ready:Promise.all(pending).then(() => failed)};
}

export function pbrSurface(surfaces, kind, color = 0xffffff, extra = {}) {
  const source = surfaces?.[kind] || {};
  const maps = Object.fromEntries(Object.entries(source).filter(([name])=>name!=='heightMap'));
  return new THREE.MeshStandardMaterial({
    color,roughness:kind==='metal'?.48:.94,metalness:kind==='metal'?.82:0,
    ...maps,normalScale:new THREE.Vector2(.65,.65),aoMapIntensity:.55,
    envMapIntensity:.65,dithering:true,...extra,
  });
}

export function terrainMaterial(surfaces, biome, fallback, profile = {}) {
  const snow=biome==='snow',alpine=biome==='alpine',mountain=alpine||biome==='mountain';
  const base=surfaces?.[mountain?'rock':snow?'snow':'earth']||{map:fallback};
  const rock=surfaces?.rock||{map:fallback},dirt=surfaces?.earth||{map:fallback},powder=surfaces?.snow||{map:fallback};
  const mat=pbrSurface(surfaces,mountain?'rock':snow?'snow':'earth',0xffffff,{vertexColors:true,roughness:.96,aoMapIntensity:.2});
  mat.userData.erasGPU={kind:'terrain',surfaces,biome,fallback};
  mat.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{
      erasRock:{value:rock.map},erasDirt:{value:dirt.map},erasPowder:{value:powder.map},
      erasSnow:{value:snow||alpine?1:0},erasMountain:{value:mountain?1:0},
      erasHeight:{value:base.heightMap||fallback},erasRelief:{value:profile.postprocess===false?0:base.heightMap?1:0},
      erasNormal:{value:base.normalMap||fallback},erasRockNormal:{value:rock.normalMap||fallback},erasPowderNormal:{value:powder.normalMap||fallback},
    });
    shader.vertexShader='varying vec3 vErasPosition; varying vec3 vErasNormal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvErasPosition=(modelMatrix*vec4(position,1.)).xyz;vErasNormal=normalize(mat3(modelMatrix)*normal);');
    shader.fragmentShader=`
      varying vec3 vErasPosition;varying vec3 vErasNormal;
      uniform sampler2D erasRock;uniform sampler2D erasDirt;uniform sampler2D erasPowder;
      uniform sampler2D erasHeight;uniform sampler2D erasNormal;uniform sampler2D erasRockNormal;uniform sampler2D erasPowderNormal;
      uniform float erasSnow;uniform float erasMountain;uniform float erasRelief;
      float erasHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float erasNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(erasHash(i),erasHash(i+vec2(1,0)),f.x),mix(erasHash(i+vec2(0,1)),erasHash(i+vec2(1,1)),f.x),f.y);}
      vec3 erasTriplanar(sampler2D tex,vec3 p,vec3 n,float scale){
        vec3 weight=pow(abs(n),vec3(6.));weight/=max(dot(weight,vec3(1.)),.001);
        return texture2D(tex,p.zy*scale).rgb*weight.x+texture2D(tex,p.xz*scale).rgb*weight.y+texture2D(tex,p.xy*scale).rgb*weight.z;
      }
      vec2 erasReliefUv(vec2 uv){
        if(erasRelief<.5||erasMountain>.5)return uv;
        vec3 eye=normalize(cameraPosition-vErasPosition);vec2 stepUv=eye.xz/max(abs(eye.y),.45)*.0017;
        float layer=0.;for(int i=0;i<8;i++){if(layer>=1.-texture2D(erasHeight,uv).r)break;uv-=stepUv;layer+=.125;}
        return uv;
      }
      `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec3 surfaceUp=normalize(vErasNormal);
      vec2 terrainUv=erasReliefUv(vErasPosition.xz*.31);
      float macroNoise=erasNoise(vErasPosition.xz*.045)*.65+erasNoise(vErasPosition.xz*.19)*.35;
      float slope=1.-smoothstep(.48,.91,surfaceUp.y);
      float trailCenter=sin(vErasPosition.z*.09)*4.;
      float trail=exp(-pow((vErasPosition.x-trailCenter)/1.65,2.));
      vec3 surfaceColor=texture2D(map,terrainUv).rgb;
      surfaceColor=mix(surfaceColor,texture2D(map,terrainUv*.381+vec2(3.37,8.13)).rgb,.26);
      vec3 rockColor=erasTriplanar(erasRock,vErasPosition,surfaceUp,erasMountain>.5?.09:.24);
      vec3 dirtColor=texture2D(erasDirt,terrainUv*.72).rgb;
      float alpineSnow=smoothstep(18.+macroNoise*24.,60.+macroNoise*27.,vErasPosition.y)*(1.-smoothstep(.15,.64,slope));
      float rockBlend=erasMountain>.5?1.:slope*.85+(1.-erasSnow)*smoothstep(.55,.82,macroNoise)*.34;
      vec3 detailColor=mix(surfaceColor,rockColor,rockBlend);
      if(erasMountain>.5&&erasSnow>.5)detailColor=mix(rockColor,erasTriplanar(erasPowder,vErasPosition,surfaceUp,.18),alpineSnow);
      if(erasMountain<.5)detailColor=mix(detailColor,dirtColor,trail*(erasSnow>.5?.17:.58)*(1.-slope));
      detailColor*=.85+macroNoise*.24;
      diffuseColor.rgb*=detailColor;
    `);
    if(base.normalMap)shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
      #include <normal_fragment_maps>
      vec3 detailNormal=texture2D(erasNormal,terrainUv).xyz*2.-1.;
      float closeDetail=(1.-smoothstep(8.,34.,length(cameraPosition-vErasPosition)))*(1.-erasMountain);
      vec3 microNormal=texture2D(erasNormal,terrainUv*3.7).xyz*2.-1.;
      detailNormal=normalize(detailNormal+vec3(microNormal.xy*.24*closeDetail,0.));
      if(erasMountain>.5&&erasSnow>.5)detailNormal=mix(detailNormal,texture2D(erasPowderNormal,terrainUv).xyz*2.-1.,alpineSnow);
      vec3 tangent=normalize(vec3(1.,-surfaceUp.x/max(surfaceUp.y,.15),0.));
      vec3 bitangent=normalize(cross(tangent,surfaceUp));
      vec3 normalWorld=normalize(tangent*detailNormal.x*.65+bitangent*detailNormal.y*.65+surfaceUp*max(detailNormal.z,.25));
      normal=normalize(mat3(viewMatrix)*normalWorld);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
      #include <roughnessmap_fragment>
      roughnessFactor=clamp(.83+macroNoise*.15-trail*${snow?'.03':'.09'},.65,1.);
    `);
  };
  mat.customProgramCacheKey=()=>`eras-terrain-06-${biome}-${profile.postprocess!==false}`;
  if(base.map)mat.map=base.map;
  return mat;
}

export function windMaterial(map, color, clock, strength = .14) {
  const mat = new THREE.MeshStandardMaterial({map,color,alphaTest:.42,side:THREE.DoubleSide,
    roughness:.95,envMapIntensity:.25,dithering:true});
  mat.userData.erasGPU={kind:'wind',clock,strength};
  mat.onBeforeCompile = shader => {
    shader.uniforms.erasTime = clock;
    shader.vertexShader = 'uniform float erasTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vec4 windOrigin = vec4(position,1.0);
      #ifdef USE_INSTANCING
        windOrigin = instanceMatrix * windOrigin;
      #endif
      float wind = sin(erasTime*1.35+windOrigin.x*.31+windOrigin.z*.19);
      transformed.x += wind * pow(clamp(uv.y,0.,1.),2.) * ${strength.toFixed(3)};
      transformed.z += cos(erasTime*.9+windOrigin.x*.24)*uv.y*${(strength*.4).toFixed(3)};
    `);
  };
  mat.customProgramCacheKey = () => `eras-wind-${strength}`;
  return mat;
}

// A continuous loft, used for shoulders, torso, sleeves and boots instead of stacked primitives.
export function loftGeometry(rings, segments = 24, folds = 0) {
  const vertices = [], uv = [], indices = [];
  for(let j=0;j<rings.length;j++) {
    const [y,rx,rz,shift=0] = rings[j];
    for(let i=0;i<=segments;i++) {
      const a=i/segments*Math.PI*2;
      const fold=1+Math.sin(a*7+y*8)*folds;
      vertices.push(Math.cos(a)*rx*fold,y,Math.sin(a)*rz*fold+shift);
      uv.push(i/segments,j/(rings.length-1));
      if(j<rings.length-1&&i<segments) {
        const k=j*(segments+1)+i;
        if(rings[j+1][0]>y) indices.push(k,k+segments+1,k+1,k+1,k+segments+1,k+segments+2);
        else indices.push(k,k+1,k+segments+1,k+1,k+segments+2,k+segments+1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geo.setIndex(indices); geo.computeVertexNormals();
  return geo;
}

export function skyMaterial(era, clock) {
  const space = era.biome==='moon'||era.biome==='alien';
  const mat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
    uniforms:{erasTime:clock,zenith:{value:new THREE.Color(space?0x030712:0x547e99)},
      horizon:{value:new THREE.Color(space?era.fog:0xdad4bf)},
      sunDir:{value:new THREE.Vector3(-28,38,-35).normalize()},cloudAmount:{value:.55},space:{value:space?1:0}},
    vertexShader:`varying vec3 vSky; void main(){vSky=position;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 vSky;
      uniform vec3 zenith; uniform vec3 horizon; uniform vec3 sunDir;
      uniform float erasTime; uniform float space; uniform float cloudAmount;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=noise(p)*a;p=p*2.03+17.1;a*=.5;}return v;}
      void main(){vec3 d=normalize(vSky);float h=max(d.y,0.);
        vec3 color=mix(horizon,zenith,pow(h,.45));
        float sun=max(dot(d,sunDir),0.);
        color+=vec3(1.,.67,.32)*(pow(sun,18.)*.22+pow(sun,300.)*.8+pow(sun,3000.)*4.);
        if(space<.5&&d.y>.015){vec2 uv=d.xz/(d.y+.22)*1.9+vec2(erasTime*.002,0.);
          float clouds=smoothstep(mix(.64,.35,cloudAmount),mix(.84,.60,cloudAmount),fbm(uv));
          clouds*=smoothstep(.015,.16,d.y)*(1.-smoothstep(.32,.9,d.y));
          vec3 cloudColor=mix(vec3(.52,.59,.62),vec3(.94,.89,.77),fbm(uv+2.));
          color=mix(color,cloudColor,clouds*.68);}
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  mat.userData.erasGPU={kind:'sky'};
  return mat;
}

export function flameMaterial(clock) {
  const mat=new THREE.ShaderMaterial({side:THREE.DoubleSide,transparent:true,depthWrite:false,
    blending:THREE.AdditiveBlending,toneMapped:false,uniforms:{erasTime:clock},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 vUv; uniform float erasTime;
      void main(){vec2 uv=vUv;float y=uv.y;
        float flutter=sin(y*15.-erasTime*8.)*.06+sin(y*28.+erasTime*11.)*.025;
        float width=(1.-y)*.43;float x=abs(uv.x-.5+flutter*y);
        float alpha=(1.-smoothstep(width*.25,max(width,.001),x))*smoothstep(0.,.12,y)*(1.-y);
        vec3 color=mix(vec3(1.,.16,.015),vec3(1.,.82,.32),clamp((1.-x*6.)*(1.-y),0.,1.));
        gl_FragColor=vec4(color*1.4,alpha*.9);}`,
  });
  mat.userData.erasGPU={kind:'flame',clock};
  return mat;
}

export function waterMaterial(clock,frozen=false){
  const mat=new THREE.MeshPhysicalMaterial({color:frozen?0x9bb9c2:0x486f70,roughness:frozen?.25:.12,
    metalness:.12,clearcoat:1,clearcoatRoughness:.08,envMapIntensity:1.4,
    transparent:!frozen,opacity:frozen?1:.91,depthWrite:true});
  mat.userData.erasGPU={kind:'water',clock};
  mat.onBeforeCompile=shader=>{
    shader.uniforms.erasTime=clock;
    shader.vertexShader='varying vec3 vWaterPosition;uniform float erasTime;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`
      #include <begin_vertex>
      vWaterPosition=(modelMatrix*vec4(position,1.)).xyz;
      transformed.y+=sin(vWaterPosition.x*2.1+erasTime*.8)*.018+sin(vWaterPosition.z*3.2-erasTime*.6)*.009;
    `);
    shader.fragmentShader='varying vec3 vWaterPosition;uniform float erasTime;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
      #include <normal_fragment_maps>
      float waveX=cos(vWaterPosition.x*2.1+erasTime*.8)*.065+sin(vWaterPosition.z*4.7+erasTime)*.025;
      float waveZ=cos(vWaterPosition.z*3.2-erasTime*.6)*.06;
      normal=normalize(mat3(viewMatrix)*vec3(waveX,1.,waveZ));
    `);
  };
  return mat;
}

export class FilmPipeline {
  constructor(renderer) {
    this.renderer=renderer;
    this.target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true});
    this.target.texture.colorSpace=THREE.LinearSRGBColorSpace;
    this.target.samples=renderer.capabilities.isWebGL2?2:0;
    this.target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
    this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    this.material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,
      uniforms:{image:{value:this.target.texture},depth:{value:this.target.depthTexture},
        size:{value:new THREE.Vector2(1,1)},near:{value:.12},far:{value:700},
        exposure:{value:1.05},warmth:{value:.012},contrast:{value:1.035},
        focusDistance:{value:6},aperture:{value:0},inverseProjection:{value:new THREE.Matrix4()},
        cameraWorld:{value:new THREE.Matrix4()},aerialDensity:{value:.0017},aerialColor:{value:new THREE.Color(0xb4c9d0)},
        sunScreen:{value:new THREE.Vector2(.5,.5)},sunColor:{value:new THREE.Color(0xffe0ba)},scattering:{value:0}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:`varying vec2 vUv;
        uniform sampler2D image;uniform sampler2D depth;uniform vec2 size;
        uniform float near;uniform float far;uniform float exposure;uniform float warmth;uniform float contrast;
        uniform float focusDistance;uniform float aperture;uniform mat4 inverseProjection;
        uniform mat4 cameraWorld;uniform float aerialDensity;uniform vec3 aerialColor;
        uniform vec2 sunScreen;uniform vec3 sunColor;uniform float scattering;
        float linearDepth(vec2 uv){float z=texture2D(depth,uv).x;return near*far/(far-z*(far-near));}
        vec3 viewPosition(vec2 uv){vec4 p=inverseProjection*vec4(uv*2.-1.,texture2D(depth,uv).x*2.-1.,1.);return p.xyz/p.w;}
        void main(){vec2 px=1./size;vec3 c=texture2D(image,vUv).rgb;
          float center=linearDepth(vUv);float ao=0.;float weight=0.;
          vec3 north=texture2D(image,vUv+vec2(0.,px.y)).rgb;
          vec3 south=texture2D(image,vUv-vec2(0.,px.y)).rgb;
          vec3 east=texture2D(image,vUv+vec2(px.x,0.)).rgb;
          vec3 west=texture2D(image,vUv-vec2(px.x,0.)).rgb;
          vec3 luma=vec3(.299,.587,.114);float lc=dot(c,luma);
          float edge=max(max(abs(lc-dot(north,luma)),abs(lc-dot(south,luma))),max(abs(lc-dot(east,luma)),abs(lc-dot(west,luma))));
          if(edge>max(.045,lc*.18))c=mix(c,(north+south+east+west)*.25,.3);
          if(aperture>.001){
            float blur=clamp(abs(center-focusDistance)/max(center,1.)*aperture,0.,1.)*11.;
            vec3 bokeh=c;float bokehWeight=1.;
            for(int i=0;i<12;i++){float a=float(i)*2.39996;
              vec2 off=vec2(cos(a),sin(a))*sqrt(float(i+1)/12.)*px*blur;
              float otherDepth=linearDepth(vUv+off);
              float tapWeight=otherDepth<center-.35?.15:1.;
              bokeh+=texture2D(image,vUv+off).rgb*tapWeight;bokehWeight+=tapWeight;
            }
            c=bokeh/bokehWeight;
          }
          vec3 origin=viewPosition(vUv);
          if(aerialDensity>0.&&texture2D(depth,vUv).x<.99999){
            vec3 world=(cameraWorld*vec4(origin,1.)).xyz;
            float heightFalloff=exp(-max(world.y,0.)*.022);
            float aerial=1.-exp(-max(center-18.,0.)*aerialDensity*heightFalloff);
            c=mix(c,aerialColor,aerial*.72);
          }
          vec3 n=normalize(cross(dFdx(origin),dFdy(origin))+vec3(0.,0.,.00001));
          if(texture2D(depth,vUv).x<.99999){
            for(int i=0;i<12;i++){float a=float(i)*2.399963;
              float radius=mix(.18,1.,sqrt(float(i+1)/12.));
              vec2 offset=vec2(cos(a),sin(a))*px*clamp(110./max(center,.5),3.,35.)*radius;
              vec3 delta=viewPosition(clamp(vUv+offset,px,1.-px))-origin;
              float len=length(delta);
              ao+=max(dot(n,delta/max(len,.001))-.08,0.)*(1.-smoothstep(.12,1.1,len));weight+=1.;
            }
            c*=1.-ao/max(weight,1.)*.8;
          }
          if(scattering>.001){
            // Depth-gated shafts: terrain and buildings occlude the sun samples.
            vec2 stepUv=(sunScreen-vUv)*.065;vec2 rayUv=vUv;
            float visibility=0.;float decay=1.;
            for(int i=0;i<14;i++){rayUv+=stepUv;
              float inside=step(0.,rayUv.x)*step(rayUv.x,1.)*step(0.,rayUv.y)*step(rayUv.y,1.);
              visibility+=step(.99999,texture2D(depth,clamp(rayUv,px,1.-px)).x)*decay*inside;
              decay*=.94;
            }
            float sunFalloff=exp(-length((sunScreen-vUv)*vec2(size.x/size.y,1.))*2.8);
            c+=sunColor*visibility*scattering*sunFalloff;
          }
          vec3 glow=vec3(0.);for(int i=0;i<8;i++){float a=float(i)*.785398;
            vec3 tap=texture2D(image,vUv+vec2(cos(a),sin(a))*px*5.).rgb;
            glow+=max(tap-vec3(1.15),vec3(0.));}
          c+=glow*.035;c*=exposure;
          c=(c*(2.51*c+.03))/(c*(2.43*c+.59)+.14);
          c=clamp((c-.5)*contrast+.5,0.,1.);
          c*=vec3(1.+warmth,1.,1.-warmth);
          float vignette=1.-smoothstep(.22,.76,length(vUv-.5))*.12;
          c*=vignette;
          gl_FragColor=vec4(c,1.);
          #include <colorspace_fragment>
        }`,
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material));
  }
  resize(width,height) {this.target.setSize(width,height);this.material.uniforms.size.value.set(width,height);}
  render(scene,camera) {
    const r=this.renderer,old=r.toneMapping,exposure=r.toneMappingExposure;
    this.material.uniforms.exposure.value=exposure;
    this.material.uniforms.near.value=camera.near;this.material.uniforms.far.value=camera.far;
    this.material.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
    camera.updateMatrixWorld();this.material.uniforms.cameraWorld.value.copy(camera.matrixWorld);
    this.material.uniforms.scattering.value=0;
    if(this.lighting?.strength>0){
      const direction=this.lighting.direction;
      camera.updateMatrixWorld();
      const facing=camera.getWorldDirection(new THREE.Vector3()).dot(direction);
      if(facing>0){
        const screen=camera.getWorldPosition(new THREE.Vector3()).addScaledVector(direction,camera.far*.8).project(camera);
        this.material.uniforms.sunScreen.value.set(screen.x*.5+.5,screen.y*.5+.5);
        this.material.uniforms.sunColor.value.copy(this.lighting.color);
        this.material.uniforms.scattering.value=this.lighting.strength*Math.min(1,facing*3);
      }
    }
    r.toneMapping=THREE.NoToneMapping;r.setRenderTarget(this.target);r.render(scene,camera);
    r.setRenderTarget(null);r.toneMapping=THREE.NoToneMapping;r.render(this.scene,this.camera);
    r.toneMapping=old;
  }
  dispose(){this.target.dispose();this.material.dispose();this.scene.children[0].geometry.dispose();}
}
