function atlasRuntime(C) {
  const canvas=document.querySelector('canvas'),status=document.querySelector('[data-status]'),hud=document.querySelector('[data-hud]');
  const tell=(type,data={})=>parent.postMessage({atlasStudio:true,type,...data},'*');
  const fail=message=>{status.textContent=message;status.classList.add('error');tell('error',{message});};
  try {
    const gl=canvas.getContext('webgl2',{antialias:false,preserveDrawingBuffer:true,alpha:false});
    if(!gl){fail('WebGL 2 no está disponible en este dispositivo. El código y la escena se pueden exportar.');return;}
    const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
    const program=fragment=>{const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,C.vertexShader));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;};
    const ray=program(C.fragmentShader),display=program(C.displayShader),locations={};
    for(const key of ['resolution','previousFrame','samples','objectCount','scene','objects[0]','dimensions[0]','rotations[0]','materials[0]','surface[0]','camera','target','sunDirection','skyTint','fog','exposure'])locations[key]=gl.getUniformLocation(ray,key);
    const outputImage=gl.getUniformLocation(display,'image');gl.bindVertexArray(gl.createVertexArray());
    const base=structuredClone(C.scene),objects=structuredClone(base.objects),isGame=C.scene.brief.mode==='game',driving=C.scene.brief.variant==='driving';
    let textures=[],buffers=[],width=0,height=0,samples=0,index=0,dirty=true,paused=false,hasRendered=false;
    let azimuth=Math.atan2(base.camera[0]-base.target[0],base.camera[2]-base.target[2]),elevation=Math.asin((base.camera[1]-base.target[1])/Math.hypot(...base.camera.map((n,i)=>n-base.target[i]))),distance=Math.hypot(...base.camera.map((n,i)=>n-base.target[i]));
    let player={x:0,z:driving?13:8,yaw:0,speed:0},lookYaw=0,lookPitch=0,score=0,remaining=90,ended=false,lastTime=0,drag=null;
    const keys=new Set(),goals=objects.map((o,i)=>o.tag==='goal'?i:-1).filter(i=>i>=0),taken=new Set();
    const normalized=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);};
    function allocate(){const rect=canvas.getBoundingClientRect();const cap=base.brief.quality==='high'?1440:isGame?760:1000;const w=Math.max(1,Math.min(cap,Math.round(rect.width*Math.min(devicePixelRatio||1,1.5)))),h=Math.max(1,Math.round(w*Math.max(.4,rect.height/Math.max(rect.width,1))));if(w===width&&h===height)return;
      width=w;height=h;canvas.width=w;canvas.height=h;for(const b of buffers)gl.deleteFramebuffer(b);for(const t of textures)gl.deleteTexture(t);textures=[];buffers=[];
      for(let i=0;i<2;i++){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);const b=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,b);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('No se pudo crear el destino de render.');gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);textures.push(t);buffers.push(b);}dirty=true;samples=0;
    }
    const materialData=new Float32Array(48),surfaceData=new Float32Array(48);base.materials.forEach((m,i)=>{materialData.set([...m.color,m.roughness],i*4);surfaceData.set([m.metalness,m.emission,0,0],i*4);});
    function reset(){player={x:0,z:driving?13:8,yaw:0,speed:0};score=0;remaining=90;ended=false;taken.clear();objects.splice(0,objects.length,...structuredClone(base.objects));dirty=true;keys.clear();canvas.focus();}
    function collision(x,z){return objects.some(o=>o.tag==='obstacle'&&Math.hypot(x-o.position[0],z-o.position[2])<(o.type==='sphere'?o.size[0]+.35:Math.max(o.size[0],o.size[2])+.38));}
    function move(dt){if(!isGame||paused||ended)return false;remaining=Math.max(0,remaining-dt);const up=keys.has('w')||keys.has('arrowup'),down=keys.has('s')||keys.has('arrowdown'),left=keys.has('a')||keys.has('arrowleft'),right=keys.has('d')||keys.has('arrowright');let changed=false;
      if(driving){const throttle=(up?1:0)-(down?1:0);player.speed+=throttle*11*dt;player.speed*=Math.exp(-(throttle ? 0.35 : 1.3)*dt);player.speed=Math.max(-5,Math.min(17,player.speed));player.yaw+=((left?1:0)-(right?1:0))*dt*1.5*Math.min(1,Math.abs(player.speed)/4);const x=player.x-Math.sin(player.yaw)*player.speed*dt,z=player.z-Math.cos(player.yaw)*player.speed*dt;if(!collision(x,z)&&Math.abs(x)<35&&Math.abs(z)<65){player.x=x;player.z=z;}else player.speed*=-.25;changed=Math.abs(player.speed)>.005;
        objects.forEach((o,i)=>{if(o.tag!=='player')return;const source=base.objects[i],x=source.position[0],z=source.position[2]-13;o.position=[player.x+Math.cos(player.yaw)*x+Math.sin(player.yaw)*z,source.position[1],player.z-Math.sin(player.yaw)*x+Math.cos(player.yaw)*z];o.yaw=player.yaw;});
      }else{const forward=(up?1:0)-(down?1:0),side=(right?1:0)-(left?1:0),speed=keys.has('shift')?6:3.5;const x=player.x+(Math.sin(lookYaw)*forward+Math.cos(lookYaw)*side)*speed*dt,z=player.z+(-Math.cos(lookYaw)*forward+Math.sin(lookYaw)*side)*speed*dt;if(!collision(x,z)&&Math.abs(x)<30&&Math.abs(z)<40){player.x=x;player.z=z;}changed=!!(forward||side);}
      for(const i of goals){if(taken.has(i))continue;const p=base.objects[i].position;if(Math.hypot(player.x-p[0],player.z-p[2])<1.2){taken.add(i);objects[i].position[1]=-500;score++;changed=true;}}
      if(score===goals.length||remaining===0)ended=true;
      hud.textContent=ended?(score===goals.length?'Completado · '+score+'/'+goals.length:'Tiempo agotado · '+score+'/'+goals.length)+' · Pulsa R o Reiniciar':score+' / '+goals.length+' · '+Math.ceil(remaining)+' s';return changed;
    }
    function render(now){if(paused){requestAnimationFrame(render);return;}allocate();const dt=Math.min(.045,lastTime?(now-lastTime)/1000:0);lastTime=now;if(move(dt))dirty=true;
      if(dirty){samples=0;dirty=false;}
      if(samples<128){const pData=new Float32Array(160),dData=new Float32Array(160),rData=new Float32Array(160);objects.forEach((o,i)=>{pData.set([...o.position,o.type==='sphere'?0:1],i*4);dData.set([...o.size,o.material],i*4);rData[i*4]=o.yaw||0;});
        let camera,target;if(isGame){if(driving){camera=[player.x+Math.sin(player.yaw)*7,3.4,player.z+Math.cos(player.yaw)*7];target=[player.x,.75,player.z-1];}else{camera=[player.x,1.65,player.z];target=[player.x+Math.sin(lookYaw)*Math.cos(lookPitch),1.65+Math.sin(lookPitch),player.z-Math.cos(lookYaw)*Math.cos(lookPitch)];}}
        else{target=base.target;camera=[target[0]+Math.sin(azimuth)*Math.cos(elevation)*distance,target[1]+Math.sin(elevation)*distance,target[2]+Math.cos(azimuth)*Math.cos(elevation)*distance];}
        gl.viewport(0,0,width,height);gl.useProgram(ray);gl.bindFramebuffer(gl.FRAMEBUFFER,buffers[index]);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,textures[1-index]);gl.uniform1i(locations.previousFrame,0);gl.uniform2f(locations.resolution,width,height);gl.uniform1i(locations.samples,samples);gl.uniform1i(locations.objectCount,objects.length);gl.uniform1i(locations.scene,base.scene);gl.uniform4fv(locations['objects[0]'],pData);gl.uniform4fv(locations['dimensions[0]'],dData);gl.uniform4fv(locations['rotations[0]'],rData);gl.uniform4fv(locations['materials[0]'],materialData);gl.uniform4fv(locations['surface[0]'],surfaceData);gl.uniform3fv(locations.camera,camera);gl.uniform3fv(locations.target,target);gl.uniform3fv(locations.sunDirection,normalized(base.sun));gl.uniform3fv(locations.skyTint,base.sky);gl.uniform1f(locations.fog,base.fog);gl.uniform1f(locations.exposure,base.exposure);gl.drawArrays(gl.TRIANGLES,0,3);
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.useProgram(display);gl.bindTexture(gl.TEXTURE_2D,textures[index]);gl.uniform1i(outputImage,0);gl.drawArrays(gl.TRIANGLES,0,3);index=1-index;samples++;
        if(!hasRendered){hasRendered=true;tell('ready',{message:'WebGL 2 · render activo',objects:objects.length});}
        if(!isGame)status.textContent=samples>=128?'Render completado · arrastra para orbitar':samples+' / 128 muestras · render progresivo';
      }
      requestAnimationFrame(render);
    }
    canvas.tabIndex=0;canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointerdown',e=>{canvas.focus();canvas.setPointerCapture(e.pointerId);drag=[e.clientX,e.clientY];});
    canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag[0],dy=e.clientY-drag[1];drag=[e.clientX,e.clientY];if(isGame&&!driving){lookYaw+=dx*.006;lookPitch=Math.max(-1.1,Math.min(1.1,lookPitch-dy*.006));}else if(!isGame){azimuth-=dx*.008;elevation=Math.max(.06,Math.min(1.3,elevation+dy*.007));}dirty=true;});
    const stopDrag=()=>{drag=null;};canvas.addEventListener('pointerup',stopDrag);canvas.addEventListener('pointercancel',stopDrag);canvas.addEventListener('wheel',e=>{if(isGame)return;e.preventDefault();distance=Math.max(2,Math.min(30,distance*Math.exp(e.deltaY*.001)));dirty=true;},{passive:false});
    document.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();keys.add(k);if(k==='r')reset();});document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>keys.clear());
    document.querySelectorAll('[data-key]').forEach(button=>{button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);keys.add(button.dataset.key);});const end=()=>keys.delete(button.dataset.key);button.addEventListener('pointerup',end);button.addEventListener('pointercancel',end);});
    const save=()=>{try{const data=canvas.toDataURL('image/png');tell('snapshot',{data});return data;}catch{fail('El dispositivo no pudo exportar la imagen.');return null;}};
    window.addEventListener('message',e=>{if(e.source!==parent)return;if(e.data?.type==='atlas:snapshot')save();if(e.data?.type==='atlas:pause'){paused=!!e.data.value;lastTime=0;}if(e.data?.type==='atlas:reset')reset();});
    document.querySelector('[data-restart]')?.addEventListener('click',reset);document.querySelector('[data-png]')?.addEventListener('click',()=>{const data=save();if(data){const a=document.createElement('a');a.href=data;a.download='atlas-render.png';a.click();}});
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;fail('El contexto gráfico se perdió. Recarga la vista para continuar.');});
    if(isGame){status.textContent=driving?'WASD / flechas · conducir · R reiniciar':'WASD / flechas · moverse · arrastrar para mirar';hud.textContent='Recoge las 8 luces antes de que termine el tiempo';}else hud.hidden=true;
    requestAnimationFrame(render);
  } catch(error){fail('No se pudo iniciar el render: '+(error.message||error));}
}
