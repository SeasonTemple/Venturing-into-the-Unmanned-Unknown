import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { stations, links } from './territory-map.mjs';
import { createActors } from './territory-actors.mjs';

export function buildTerritory(scene) {
  const geometries = new Set(), materials = new Set(), textures = new Set(), chunks = [], batches = new Map();
  const own = g => (geometries.add(g), g);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d'), pixels = ctx.createImageData(256,256); let seed=701;
  for(let i=0;i<pixels.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const v=110+seed/4294967296*110;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=v;pixels.data[i+3]=255;}
  ctx.putImageData(pixels,0,0);const grain=new T.CanvasTexture(canvas);grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(5,5);textures.add(grain);
  const mat=opts=>{const m=new T.MeshStandardMaterial(opts);materials.add(m);return m;};
  const stone=mat({color:'#8eaaa5',roughness:.84,bumpMap:grain,bumpScale:.06});
  const cut=mat({color:'#536e70',roughness:.93,bumpMap:grain,bumpScale:.09});
  const dark=mat({color:'#243f47',metalness:.25,roughness:.75});
  const steel=mat({color:'#48676a',metalness:.65,roughness:.48});
  const copper=mat({color:'#b99560',metalness:.55,roughness:.49});
  const pale=mat({color:'#c0c7b4',roughness:.8,bumpMap:grain,bumpScale:.025});
  let group=new T.Group();scene.add(group);
  function flush(){
    for(const [material,parts]of batches){const geo=own(mergeGeometries(parts));parts.forEach(g=>g.dispose());const mesh=new T.Mesh(geo,material);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);}
    batches.clear();chunks.push(group);
  }
  function add(g,m,p=[0,0,0],q=new T.Quaternion()){
    if(g.index){const source=g;g=g.toNonIndexed();source.dispose();}
    g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(...p),q,new T.Vector3(1,1,1)));
    if(!batches.has(m))batches.set(m,[]);batches.get(m).push(g);
  }
  function box(w,h,d,p,m=stone,bevel=.055){add(bevel&&Math.min(w,h,d)>.2?new RoundedBoxGeometry(w,h,d,1,Math.min(bevel,w/6,h/6,d/6)):new T.BoxGeometry(w,h,d),m,p);}
  function rod(a,b,r=.06,m=steel){const av=new T.Vector3(...a),bv=new T.Vector3(...b),v=bv.clone().sub(av);add(new T.CylinderGeometry(r,r,v.length(),8),m,av.add(bv).multiplyScalar(.5).toArray(),new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize()));}
  function join(a,b,width=3.6,material=stone){
    const av=new T.Vector3(...a),bv=new T.Vector3(...b),v=bv.clone().sub(av),distance=v.length();
    add(new T.BoxGeometry(width,.32,distance+.12),material,av.add(bv).multiplyScalar(.5).add(new T.Vector3(0,-.16,0)).toArray(),new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),v.normalize()));
    const side=new T.Vector3(v.z,0,-v.x).normalize().multiplyScalar(width*.46);
    for(const sign of [-1,1]){
      const aa=new T.Vector3(...a).addScaledVector(side,sign),bb=new T.Vector3(...b).addScaledVector(side,sign);
      rod(aa.clone().add(new T.Vector3(0,.95,0)).toArray(),bb.clone().add(new T.Vector3(0,.95,0)).toArray(),.035,copper);
      const steps=Math.max(2,Math.ceil(distance/4));
      for(let i=0;i<=steps;i++){const p=aa.clone().lerp(bb,i/steps);rod(p.toArray(),p.clone().add(new T.Vector3(0,.95,0)).toArray(),.035,steel);}
    }
    const supports=Math.ceil(distance/9);
    for(let i=0;i<supports;i++){const p=new T.Vector3(...a).lerp(new T.Vector3(...b),(i+.5)/supports);box(.5,p.y+14,.7,[p.x,(p.y-14)/2,p.z],dark);}
  }
  function slab(s,w=s.size[0],d=s.size[1]){const[x,y,z]=s.position;box(w,1.1,d,[x,y-.55,z],stone,.1);if(![1,4,5].includes(s.index))box(w*.86,y+12,d*.84,[x,(y-12)/2-1,z],cut,.08);}
  function seam(x,y,z,w,d){for(let i=1;i<Math.floor(w/3);i++)box(.015,.008,d,[x-w/2+i*3,y+.009,z],dark,0);}
  function rail(a,b,y){rod([a[0],y+1,a[1]],[b[0],y+1,b[1]],.04,copper);const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/3);for(let i=0;i<=n;i++){const x=T.MathUtils.lerp(a[0],b[0],i/n),z=T.MathUtils.lerp(a[1],b[1],i/n);rod([x,y,z],[x,y+1,z],.04);}}
  for(const s of stations){
    flush();group=new T.Group();group.name=s.place;scene.add(group);const[x,y,z]=s.position;
    slab(s);seam(x,y,z,s.size[0],s.size[1]);
    if(s.index===0){
      // An inhabitable courtyard; the overhang and wall fill the foreground at entry.
      box(.6,8,18,[x-10.7,y+4,z]);box(22,8,.6,[x,y+4,z-8.7]);
      box(14,.5,15,[x-4,y+8.15,z-1.5],pale,.08);
      for(const zz of [z-6,z+4])box(.35,7.9,.35,[x+2,y+4,zz],steel);
      box(5,.18,2.2,[x-3,y+1.15,z-1],pale);
      for(const xx of [x-5,x-1])box(.18,1.05,1.7,[xx,y+.55,z-1],dark);
      for(let i=0;i<3;i++)box(1.1,.025,1.5,[x-4.5+i*1.5,y+1.26,z-1],copper,0);
      box(.2,5.5,.2,[x+8,y+2.75,z+6],copper);
      rail([x-10,z+8.5],[x+10,z+8.5],y);
      for(let i=0;i<7;i++)box(2.8,.15,.42,[x+7,y-.02-i*.15,z+9+i*.42],stone);
    }
    if(s.index===1){
      // Bridge is a traversable place, with piers, transverse beams and side views.
      for(const xx of [x-13,x,x+13]){
        box(.6,10,.6,[xx,y+5,z-4],steel);box(.6,10,.6,[xx,y+5,z+4],steel);box(.65,.65,8.6,[xx,y+10,z],steel);
        for(const zz of [z-3.5,z+3.5])box(.8,y+14,.8,[xx,(y-14)/2,zz],steel);
        rod([xx,y-12,z-3.5],[xx+7,y-1,z-3.5],.16,steel);
      }
      for(let i=0;i<8;i++){box(.09,.09,8,[x-14+i*4,y+.09,z],copper,0);}
      rail([x-15.5,z-4.3],[x+15.5,z-4.3],y);rail([x-15.5,z+4.3],[x+15.5,z+4.3],y);
      box(2,1.4,1.3,[x+6,y+.7,z-2.6],dark);box(1.7,.12,1.2,[x+6,y+1.46,z-2.6],pale);
    }
    if(s.index===2){
      for(const xx of [x-11,x+11])for(const zz of [z-10,z+10])box(.5,10,.5,[xx,y+5,zz],steel);
      box(.5,10,24,[x-12.75,y+5,z],cut);box(26,6,.5,[x,y+3,z-11.75],cut);
      for(let i=0;i<9;i++)box(26,.3,.5,[x,y+10,z-10+i*2.5],steel);
      for(let i=0;i<3;i++){box(4.3,1.5+i*.4,6,[x-7+i*7,y+.75+i*.2,z],i===2?copper:stone);box(3.8,.12,4.7,[x-7+i*7,y+1.56+i*.4,z],pale);}
      rail([x-12,z+11.5],[x+12,z+11.5],y);
    }
    if(s.index===3){
      for(const sign of [-1,1]){
        box(8.3,14,.7,[x+sign*4.55,y+7,z-4],pale,.08);
        for(const yy of [3,7,11])box(8.2,.025,.012,[x+sign*4.55,y+yy,z-3.641],dark,0);
      }
      box(.8,.4,.7,[x,y+14,z-4],copper);
      box(8,.16,7,[x,y+.18,z+2],pale);
      for(const xx of [x-3.8,x+3.8])box(.035,.015,6.8,[xx,y+.275,z+2],copper,0);
      for(let i=0;i<12;i++)box(i%3===0?.45:.22,.025,.012,[x-.72,y+1.6+i*.95,z-3.637],copper,0);
      box(.5,5,15,[x-9.7,y+2.5,z+2.5],cut);
    }
    if(s.index===4){
      for(const xx of [x-12,x,x+12])for(const zz of [z-5,z+5]){
        box(.7,y+14,.7,[xx,(y-14)/2,zz],steel);rod([xx,y-9,zz],[xx+5,y-.6,zz],.18);}
      box(30,.45,1,[x,y-2,z-5.7],steel);box(30,.45,1,[x,y-2,z+5.7],steel);
      for(let i=0;i<8;i++)box(.6,.12,9,[x-12+i*3.4,y+.08,z],pale);
      box(.22,12,.22,[x+11,y+6,z-4],copper);box(4,.15,.3,[x+11,y+10.7,z-4],steel);
      rail([x-14.5,z+6.5],[x+14.5,z+6.5],y);
    }
    if(s.index===5){
      for(const xx of [x-7,x+7])box(.7,y+14,.7,[xx,(y-14)/2,z+5],steel);
      box(.5,9,.5,[x-8,y+4.5,z-6],steel);box(.5,5,.5,[x+8,y+2.5,z-6],steel);
      box(9,.4,.5,[x-3.5,y+9,z-6],steel);
      box(6,.4,17,[x,y-.2,z-17],stone);
      for(let i=0;i<7;i++)box(5.6,.06,.16,[x,y+.04,z-21-i*2],steel);
      rail([x-8.5,z+8],[x+8.5,z+8],y);
      box(3,.18,1.5,[x,y+1.1,z],pale);box(.2,1,.8,[x,y+.5,z],steel);
    }
  }
  flush();group=new T.Group();group.name='connecting-walkways';scene.add(group);
  for(const route of links)for(let i=1;i<route.length;i++)join(route[i-1],route[i]);
  // Large retaining cuts and an unfinished service alignment extend beyond the route.
  box(90,12,1.4,[12,-8,-37],dark);box(1.4,9,74,[-58,-9,-58],cut);
  for(let i=0;i<10;i++)box(1.2,5,1.2,[85+i*4,-11,-154-i*5],dark);
  flush();
  // Occupied ground, service infrastructure, then incomplete survey alignments.
  group=new T.Group();group.name='service-ground-and-frontier';scene.add(group);
  for(const [x,z,w,d] of [[-10,24,58,46],[-34,-52,46,48],[28,-64,42,46]]){
    box(w,.35,d,[x,-13.75,z],cut,0);
    for(const sign of [-1,1])box(.7,.12,d,[x+sign*(w/2-2),-13.5,z],dark,0);
  }
  for(let i=0;i<12;i++){
    box(7,.22,11,[43,-13.7,18-i*14],cut,0);
    if(i<9)box(.12,.025,5,[43,-13.56,18-i*14],copper,0);
  }
  for(let i=0;i<6;i++){
    box(8,1.1,.6,[-52,-13.2,-29-i*3],steel,0);
    box(8,.6,.6,[-52,-12.4,-29-i*3],cut,0);
  }
  for(let i=0;i<8;i++){
    const z=-177-i*12,x=24+(i%2?8:-8);
    box(.12,2.6,.12,[x,6.7-i*.3,z],steel,0);
    box(.18,.13,.18,[x,8.04-i*.3,z],copper,0);
    if(i<4)box(3.2,.06,.18,[24+(i%2?3:-3),7.4-i*.3,z],cut,0);
  }
  // Separate fragments imply an alignment, without pretending to map the void.
  for(const [x,z,h] of [[5,-199,12],[43,-215,17],[14,-244,9],[61,-269,14]]){
    box(.3,h,.3,[x,-14+h/2,z],steel,0);
    box(7,.3,.3,[x+3.5,-14+h,z],steel,0);
  }
  flush();
  const groundMat=mat({color:'#20383e',roughness:.97,bumpMap:grain,bumpScale:.055});
  const ground=new T.Mesh(own(new T.PlaneGeometry(900,900)),groundMat);ground.rotation.x=-Math.PI/2;ground.position.set(0,-14,-60);ground.receiveShadow=true;scene.add(ground);
  const actorSystem=createActors(scene,{own,mat,textures}),actors=actorSystem.root;
  function placeActors(index,mode){const[x,y,z]=stations[index].position;actorSystem.setMode(mode);actorSystem.place(new T.Vector3(index===5?x:x+3,y,index===5?z-13:z+3));if(index===5)actorSystem.person.rotation.y=Math.PI;}
  placeActors(0,'agent');
  return {actors,actorSystem,placeActors,geometries,materials,textures,chunks,dispose(){actorSystem.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}
