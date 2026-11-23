import {Quaternion,Vector3} from './vendor/three.module.js';

const pitch = new Vector3(1,0,0);
const closingTime = .080;
const closedTime = .026;
const openingTime = .116;
const ease = value => value*value*(3-2*value);

export function residentBlinkAmount(time,phase){
 const period = 3.8+phase*2.1;
 const age = (time+phase*period)%period;
 if(!Number.isFinite(age)||age<0||age>=closingTime+closedTime+openingTime)return 0;
 if(age<closingTime)return ease(age/closingTime);
 if(age<closingTime+closedTime)return 1;
 return 1-ease((age-closingTime-closedTime)/openingTime);
}

export function createResidentBlink(bones,phase){
 const lids = [];
 for(const side of ['L','R']){
  const upper = bones['orbicularis03.'+side];
  const lower = bones['orbicularis04.'+side];
  if(!upper||!lower)return ()=>{};
  // Both joints pivot at the eyeball center in the authored +Z-facing rig.
  // The upper lid travels farther while the lower lid preserves a seam.
  lids.push({bone:upper,rest:upper.quaternion.clone(),sweep:.46});
  lids.push({bone:lower,rest:lower.quaternion.clone(),sweep:-.14});
 }
 const rotation = new Quaternion();
 return (time,enabled)=>{
  const amount = enabled?residentBlinkAmount(time,phase):0;
  for(const {bone,rest,sweep} of lids){
   rotation.setFromAxisAngle(pitch,amount*sweep);
   bone.quaternion.copy(rest).multiply(rotation);
  }
 };
}
