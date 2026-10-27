// Shared by the material study and the offline chapter projection generator.
// Noise is injected so this field has no browser, renderer or package dependency.
export const reliefView={position:[12,15.5,19],target:[0,.55,0],span:32,width:1920,height:1080,nx:224,nz:134};
export function createReliefField(sample){
 const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 const n=(x,z)=>sample(x,z,3.71);
 const boundary=z=>2.5+.7*Math.sin(z*.68)+.25*Math.sin(z*1.7);
 const height=(x,z)=>{
  const wx=x+1.5*n(x*.19+6,z*.19),wz=z+1.2*n(x*.21,z*.21+8);
  let ridge=0,amp=1,freq=.22,weight=1;
  for(let i=0;i<5;i++){
   let r=Math.max(0,1-Math.abs(n(wx*freq+11,wz*freq+4))*1.8);r*=r;
   ridge+=r*amp*weight;weight=Math.max(0,Math.min(1,r*1.8));freq*=2.12;amp*=.48;
  }
  const spine=Math.exp(-(((wz+1.1-Math.sin(wx*.34)*1.6)/3.25)**2));
  const reach=Math.exp(-(((x+1)/9.7)**4));
  const edge=smooth(0,2.1,10-Math.abs(x))*smooth(0,1.8,6-Math.abs(z));
  return .08+edge*(.22+ridge*2.3)*(.30+spine*.9)*reach;
 };
 return {height,boundary};
}
