// Shared by the in-game joystick and the interactive controls guide.
// Movement remains analogue after the dead zone; diagonal input never exceeds 1.
export function stickVector(dx, dy, radius, deadZone = .10) {
  if (![dx, dy, radius].every(Number.isFinite) || radius <= 0) {
    return {x:0, y:0, knobX:0, knobY:0, strength:0, sprint:false};
  }
  const length = Math.hypot(dx, dy), raw = Math.min(1, length / radius);
  const strength = Math.max(0, (raw - deadZone) / (1 - deadZone));
  const unitX = length ? dx / length : 0, unitY = length ? dy / length : 0;
  return {x:unitX*strength, y:unitY*strength,
    knobX:unitX*raw*radius, knobY:unitY*raw*radius, strength, sprint:raw >= .94};
}

export function showTouchControls(mode, {touchPoints=0, coarse=false, width=1200} = {}) {
  return mode === 'on' || (mode !== 'off' && (touchPoints > 0 || coarse || width <= 900));
}

export class CircularJoystick {
  constructor(element, {enabled=()=>true, onChange=()=>{}} = {}) {
    this.element=element; this.knob=element.querySelector('.joystick-knob');
    this.enabled=enabled; this.onChange=onChange; this.pointer=null;
    this.down=e=>{
      if (!this.enabled() || this.pointer !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault(); e.stopPropagation(); this.pointer=e.pointerId;
      element.setPointerCapture(e.pointerId); element.classList.add('engaged'); this.move(e);
    };
    this.move=e=>{
      if (this.pointer !== e.pointerId) return;
      if (!this.enabled()) {this.reset(); return;}
      e.preventDefault();
      const rect=element.getBoundingClientRect(), radius=Math.min(rect.width,rect.height)*.31;
      const vector=stickVector(e.clientX-rect.left-rect.width/2,e.clientY-rect.top-rect.height/2,radius);
      this.knob.style.transform=`translate(${vector.knobX}px, ${vector.knobY}px)`;
      element.classList.toggle('sprinting',vector.sprint);
      element.setAttribute('aria-valuetext',vector.strength ? `Movimiento ${Math.round(vector.strength*100)} %` : 'En reposo');
      this.onChange(vector);
    };
    this.up=e=>{if (this.pointer === e.pointerId) this.reset();};
    element.addEventListener('pointerdown',this.down);
    element.addEventListener('pointermove',this.move);
    for(const type of ['pointerup','pointercancel','lostpointercapture']) element.addEventListener(type,this.up);
  }
  reset() {
    const pointer=this.pointer; this.pointer=null;
    if(pointer !== null && this.element.hasPointerCapture(pointer)) this.element.releasePointerCapture(pointer);
    this.knob.style.transform=''; this.element.classList.remove('engaged','sprinting');
    this.element.setAttribute('aria-valuetext','En reposo');
    this.onChange(stickVector(0,0,1));
  }
  destroy() {
    this.reset();
    this.element.removeEventListener('pointerdown',this.down);
    this.element.removeEventListener('pointermove',this.move);
    for(const type of ['pointerup','pointercancel','lostpointercapture']) this.element.removeEventListener(type,this.up);
  }
}
