// Map selection remains convenient in the normal house. A playable mission
// requires an approach to the actual object, equally for pointer and keyboard.
export function canUseHouseFunction({prototype=false,overview=false,distance=Infinity,playerDistance=Infinity,transitioning=false}={}){
 return !prototype||!overview&&!transitioning&&Number.isFinite(distance)&&distance>=0&&distance<3.5&&Number.isFinite(playerDistance)&&playerDistance>=0&&playerDistance<3.5;
}
