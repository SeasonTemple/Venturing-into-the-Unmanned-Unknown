// Original, dependency-free authoring math. Distances are source-art pixels.
export const SPEC = Object.freeze({width:128,height:196,rootX:64,floor:185,stride:48,frames:24,duty:15/24,thigh:36.5,shin:39.5,travel:192});
export const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
export const smooth=n=>{const t=clamp(n);return t*t*(3-2*t);};
export const mix=(a,b,t)=>a+(b-a)*t;
export function solveLeg(hip,ankle,forward=1){
 const dx=ankle[0]-hip[0],dy=ankle[1]-hip[1],raw=Math.hypot(dx,dy),d=clamp(raw,.001,SPEC.thigh+SPEC.shin-.001);
 const a=(SPEC.thigh**2-SPEC.shin**2+d*d)/(2*d),h=Math.sqrt(Math.max(0,SPEC.thigh**2-a*a));
 return {knee:[hip[0]+dx/raw*a+forward*dy/raw*h,hip[1]+dy/raw*a-forward*dx/raw*h],reachError:Math.max(0,raw-d)};
}
export function footAt(phase,sign){
 const q=((phase%1)+1)%1,stance=q<SPEC.duty;
 if(stance)return {p:[sign*(SPEC.stride*SPEC.duty/2-SPEC.stride*q),178],stance,q,pitch:0};
 const t=(q-SPEC.duty)/(1-SPEC.duty);
 return {p:[sign*mix(-15,15,smooth(t)),178-12*Math.sin(Math.PI*t)],stance,q,pitch:sign*(-.18*Math.sin(Math.PI*t))};
}
export function gaitPose(phase,direction='left',energy=1){
 const sign=direction==='left'?-1:1,q=((phase%1)+1)%1;
 const bob=energy*(.8+1.35*Math.sin(q*Math.PI*4)),sway=energy*.55*Math.sin(q*Math.PI*2);
 const hip=[64+sway,104+bob],legs={};
 for(const side of ['right','left']){
  const f=footAt(q+(side==='left'?.5:0),sign),offset=side==='right'?1.25:-1.25;
  const h=[hip[0]+offset,hip[1]+(side==='right'?1:-1)*energy*.45*Math.sin(q*Math.PI*2)];
  const ankle=[64+f.p[0]+offset,f.p[1]];
  const ik=solveLeg(h,ankle,sign);
  legs[side]={hip:h,ankle,knee:ik.knee,stance:f.stance,pitch:f.pitch,q:f.q,reachError:ik.reachError};
 }
 return {phase:q,direction,sign,hip,bob,sway,lean:energy*sign*(.025+.012*Math.cos(q*Math.PI*2)),headAngle:energy*sign*.008*Math.sin(q*Math.PI*2),energy,legs};
}
// Turn with two deliberate repositioning steps. The right foot moves first;
// the left foot remains planted, then the roles swap. Equipment is never mirrored.
export function turnPose(progress){
 const t=clamp(progress),a=smooth(Math.min(t*2,1)),b=smooth(Math.max(0,t*2-1));
 const hip=[64+10*Math.sin(t*Math.PI),104+Math.sin(t*Math.PI*4)*.55+2*Math.sin(t*Math.PI)],yaw=mix(-Math.PI/2,Math.PI/2,smooth(t));
 const legs={};
 for(const side of ['right','left']){
  const right=side==='right',x=right?mix(-13.75,16.25,a):mix(7.75,-10.25,b);
  const active=right?t<.5:t>=.5,step=right?t*2:(t-.5)*2,lift=active?4*Math.sin(clamp(step)*Math.PI):0;
  const h=[hip[0]+(right?1:-1)*(1.25+Math.cos(yaw)*4.5),hip[1]],ankle=[64+x,178-lift];
  const ik=solveLeg(h,ankle,1),other=solveLeg(h,ankle,-1),projection=(Math.sin(yaw)+1)/2;
  // During front views knee flexion points into depth. Project the two side
  // solutions continuously instead of snapping knee direction at 90 degrees.
  const knee=ik.knee.map((n,i)=>mix(other.knee[i],n,projection));
  legs[side]={hip:h,knee,ankle,stance:!active,pitch:0,reachError:ik.reachError};
 }
 return {hip,legs,yaw,sign:Math.sin(yaw),direction:t<.5?'left':'right',energy:0,lean:0,headAngle:0,progress:t};
}
const WALK=6.8,REST=.7,TURN=1.2,LEAD=.6;
export const DURATION=LEAD+WALK+REST+TURN+REST+WALK+REST;
// Accelerate/decelerate root travel; gait phase follows the resulting distance.
function runDistance(t){
 const p=clamp(t/WALK),r=.11;
 const area=p<r?p*p/(2*r):p>1-r?(1-r)-(1-p)**2/(2*r):p-r/2;
 return SPEC.travel*area/(1-r);
}
export function sampleRun(time){
 let t=clamp(time,0,DURATION),distance=0,dir='left',state='准备',turn=null,energy=0;
 if(t>=LEAD){
  t-=LEAD;
  if(t<WALK){distance=runDistance(t);energy=Math.min(1,t/.45,(WALK-t)/.45);state=t<.6?'起步':t>WALK-.6?'减速停步':'向左行走';}
  else if((t-=WALK)<REST){distance=SPEC.travel;energy=1-smooth(t/.35);state='停步 · 两脚承重';}
  else if((t-=REST)<TURN){distance=SPEC.travel;turn=t/TURN;state='换步转身';}
  else if((t-=TURN)<REST){distance=SPEC.travel;dir='right';state='回望 · 准备返回';}
  else if((t-=REST)<WALK){distance=SPEC.travel-runDistance(t);dir='right';energy=Math.min(1,t/.45,(WALK-t)/.45);state=t<.6?'返回起步':t>WALK-.6?'返回停步':'向右返回';}
  else{distance=0;dir='right';energy=1-smooth((t-WALK)/.35);state='已回到原处';}
 }
 const traveled=dir==='left'?distance:SPEC.travel-distance;
 const phase=((traveled/SPEC.stride)%1+1)%1;
 const frame=Math.round(phase*SPEC.frames)%SPEC.frames;
 const settle=energy<.18;
 return {time:clamp(time,0,DURATION),distance,worldX:1254-distance,worldY:858,direction:dir,state,turn,phase,frame,energy,settle,complete:time>=DURATION};
}
