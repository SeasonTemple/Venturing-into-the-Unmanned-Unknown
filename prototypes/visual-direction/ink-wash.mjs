import { surveyHeight as heightAt, surveyBoundary as boundary, surveySample as sample, surveyAnchors } from './survey-field.mjs';
const cache = new WeakMap();

function build(width, height) {
  const edges = [], contours = [], points = [];
  const project = (x,z,h=heightAt(x,z)) => [width*(.57+(x+z*.55)/15),height*(.68+z/8-h*.12)];
  const edge = (x,z,xx,zz,major) => {
    if (Math.max(x,xx)>Math.min(boundary(z),boundary(zz))) return;
    edges.push({a:project(x,z),b:project(xx,zz),x:(x+xx)/2,z:(z+zz)/2,major});
  };
  const nx=42,nz=28,dx=20/nx,dz=11/nz;
  for(let i=0;i<=nx;i++)for(let j=0;j<=nz;j++) {
    const x=-10+i*dx,z=-5.5+j*dz;
    if(i<nx)edge(x,z,x+dx,z,j%4===0);
    if(j<nz)edge(x,z,x,z+dz,i%4===0);
    if(x>boundary(z)&&sample(i,j)>.69)points.push({p:project(x,z),x,z});
    if(i===nx||j===nz||x+dx>Math.min(boundary(z),boundary(z+dz)))continue;
    const corners=[[x,z],[x+dx,z],[x+dx,z+dz],[x,z+dz]];
    for(const level of [.15,.6,1.1,1.6,2.1,2.6,3.1]) {
      const cuts=[];
      for(let k=0;k<4;k++) {
        const a=corners[k],b=corners[(k+1)%4],ha=heightAt(...a),hb=heightAt(...b);
        if((ha<=level&&hb>level)||(hb<=level&&ha>level)) {
          const t=(level-ha)/(hb-ha);cuts.push(project(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,level));
        }
      }
      if(cuts.length===2)contours.push(cuts);
    }
  }
  return {width,height,edges,contours,points,project};
}

// A scan briefly reveals the topography; it is an editorial metaphor, not reading progress.
export function paintInkWash(ctx,width,height,time) {
  let data=cache.get(ctx);
  if(!data||data.width!==width||data.height!==height){data=build(width,height);cache.set(ctx,data);}
  ctx.clearRect(0,0,width,height);ctx.lineCap='round';ctx.lineJoin='round';
  const sweep=-13+((time*.95+6)%28),buckets=Array.from({length:12},()=>[]);
  for(const e of data.edges) {
    const distance=sweep-e.x-e.z*.16;
    const light=Math.exp(-((distance/.85)**2))+.25*Math.exp(-((distance/3.5)**2));
    const index=Math.min(11,Math.floor(light*10));
    if(e.major||index>1)buckets[index].push(e);
  }
  for(let i=0;i<buckets.length;i++) {
    ctx.strokeStyle=`rgba(81,153,161,${.055+i*.065})`;ctx.lineWidth=i?1.5:1;
    ctx.beginPath();for(const e of buckets[i]){ctx.moveTo(...e.a);ctx.lineTo(...e.b);}ctx.stroke();
  }
  ctx.strokeStyle='rgba(91,147,154,.24)';ctx.lineWidth=1.4;ctx.beginPath();
  for(const [a,b] of data.contours){ctx.moveTo(...a);ctx.lineTo(...b);}ctx.stroke();
  // The scan is a narrow, soft pool over the actual projected surface.
  const center=data.project(sweep,0),radius=Math.min(width,height)*.18;
  const glow=ctx.createRadialGradient(...center,0,...center,radius);
  glow.addColorStop(0,'rgba(106,190,195,.12)');glow.addColorStop(1,'rgba(106,190,195,0)');
  ctx.fillStyle=glow;ctx.fillRect(center[0]-radius,center[1]-radius,radius*2,radius*2);
  for(const {p,x,z} of data.points) {
    const lit=Math.exp(-(((x+z*.16-sweep)/1.4)**2));
    ctx.fillStyle=`rgba(116,153,195,${.16+.65*lit})`;ctx.beginPath();ctx.arc(...p,1+lit,0,Math.PI*2);ctx.fill();
  }
  ctx.strokeStyle='rgba(193,148,94,.35)';ctx.lineWidth=1.7;ctx.setLineDash([]);ctx.beginPath();
  for(const [i,a] of surveyAnchors.entries()){const p=data.project(...a);if(i)ctx.lineTo(...p);else ctx.moveTo(...p);}ctx.stroke();
  for(const a of surveyAnchors) {
    const p=data.project(...a);ctx.fillStyle='rgba(193,148,94,.75)';ctx.beginPath();ctx.arc(...p,3,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(193,148,94,.4)';ctx.beginPath();ctx.arc(...p,8,0,Math.PI*2);ctx.stroke();
  }
  // A cropped folio, not a second complete map behind the prose. Keep the reading measure quiet.
  const reserve=ctx.createLinearGradient(0,0,width,0);
  for(const [stop,alpha] of [[0,.85],[.16,.70],[.34,.12],[.70,.12],[.88,.65],[1,.85]])reserve.addColorStop(stop,`rgba(0,0,0,${alpha*.58})`);
  ctx.globalCompositeOperation='destination-in';ctx.fillStyle=reserve;ctx.fillRect(0,0,width,height);
  ctx.globalCompositeOperation='source-over';
}
