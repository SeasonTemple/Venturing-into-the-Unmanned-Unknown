import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export const V=a=>new T.Vector3(...a);
export function createKit(scene){
 const geometries=new Set(),materials=new Set(),textures=new Set();
 const own=g=>(geometries.add(g),g),material=(o)=>{const m=new T.MeshStandardMaterial(o);materials.add(m);return m;};
 const cube=own(new T.BoxGeometry(1,1,1)),round=own(new RoundedBoxGeometry(1,1,1,2,.06)),ball=own(new T.SphereGeometry(1,14,10)),cylinder=own(new T.CylinderGeometry(1,1,1,12));
 const root=scene;
 function mesh(geometry,mat,p=[0,0,0],scale=[1,1,1],parent=root){const m=new T.Mesh(geometry,mat);m.position.set(...p);m.scale.set(...scale);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
 const box=(size,p,m,parent=root,soft=false)=>mesh(soft?round:cube,m,p,size,parent);
 const ellipsoid=(size,p,m,parent=root)=>mesh(ball,m,p,size,parent);
 function rod(a,b,r,m,parent=root,r2=r){const start=V(a),end=V(b),d=end.clone().sub(start),g=own(new T.CylinderGeometry(r2,r,d.length(),10));const o=mesh(g,m,start.add(end).multiplyScalar(.5).toArray(),[1,1,1],parent);o.quaternion.setFromUnitVectors(V([0,1,0]),d.normalize());return o;}
 function tube(points,r,m,parent=root){return mesh(own(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(V)),Math.max(10,points.length*7),r,6,false)),m,[0,0,0],[1,1,1],parent);}
 function label(text,p,size,mcolor='#ebe7d4',bg='#33474b',parent=root){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,512,128);ctx.fillStyle=mcolor;ctx.font='500 37px Segoe UI';ctx.textAlign='center';ctx.fillText(text,256,78);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;textures.add(tex);const mat=material({map:tex,roughness:.8});return mesh(own(new T.PlaneGeometry(size,size/4)),mat,p,[1,1,1],parent);}
 function lathe(profile,depth,m,p=[0,0,0],parent=root){const g=own(new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),16));return mesh(g,m,p,[1,1,depth],parent);}
 function consolidate(group){group.updateWorldMatrix(true,true);const inverse=group.matrixWorld.clone().invert(),bins=new Map(),remove=[];group.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&!Array.isArray(o.material)){let g=o.geometry.clone();g.applyMatrix4(inverse.clone().multiply(o.matrixWorld));if(g.index){const indexed=g;g=g.toNonIndexed();indexed.dispose();}g.deleteAttribute('uv');g.deleteAttribute('color');const key=o.material;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(g);remove.push(o);}});remove.forEach(o=>o.removeFromParent());for(const[m,parts]of bins){const g=mergeGeometries(parts);parts.forEach(p=>p.dispose());if(g)mesh(own(g),m,[0,0,0],[1,1,1],group);}}
 return{own,material,mesh,box,ellipsoid,rod,tube,label,lathe,consolidate,geometries,materials,textures,dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}

export function fieldPerson(kit,palette,{pose='stand',rotation=0}={}){
 const {box,ellipsoid,rod,tube,lathe,consolidate}=kit,{coat,trousers,boot,skin,hair,strap,trim,metal,screen}=palette;
 const person=new T.Group(),torso=new T.Group();person.add(torso);torso.position.y=.84;
 torso.rotation.x=pose==='check'?.29:pose==='observe'?-.035:0;
 // Coat is one continuous tailored surface, with a hem, shoulders and a collar.
 lathe([[.18,0],[.245,.04],[.252,.14],[.225,.35],[.25,.49],[.225,.57],[.14,.64],[.1,.66]],.7,coat,[0,0,0],torso);
 lathe([[.12,0],[.132,.025],[.13,.085],[.11,.105]],.8,trim,[0,.57,0],torso);
 box([.022,.48,.025],[0,.29,.169],strap,torso);
 for(const sign of [-1,1]){
  const pocket=box([.13,.145,.025],[sign*.13,.18,.161],coat,torso,true);pocket.rotation.z=sign*.09;box([.13,.016,.034],[sign*.13,.235,.17],trim,torso);
 }
 const head=new T.Group();head.position.set(0,.76,0);torso.add(head);head.scale.setScalar(.86);head.rotation.x=pose==='check'?.22:0;head.rotation.y=pose==='observe'?-.22:0;
 ellipsoid([.125,.153,.118],[0,0,0],skin,head);ellipsoid([.105,.07,.095],[0,-.105,.026],skin,head);
 // Hair cap leaves the cheek and forehead silhouette readable, without a spherical helmet.
 ellipsoid([.135,.104,.127],[0,.091,-.018],hair,head);box([.205,.05,.071],[0,.118,.059],hair,head,true);
 for(const s of [-1,1]){ellipsoid([.025,.038,.023],[s*.123,-.01,0],skin,head);box([.034,.054,.07],[s*.115,.039,-.047],hair,head,true);}
 ellipsoid([.026,.035,.037],[0,-.005,.111],skin,head);
 for(const s of [-1,1]){box([.071,.026,.017],[s*.061,.027,.108],strap,head,true);}box([.046,.012,.014],[0,.026,.113],metal,head);
 const pack=box([.31,.36,.15],[0,.34,-.205],trousers,torso,true);pack.rotation.x=-.08;box([.265,.15,.035],[0,.4,-.296],trim,torso,true);
 for(const s of [-1,1]){tube([[s*.13,.55,-.16],[s*.18,.51,.03],[s*.155,.2,.17],[s*.13,.06,.05]],.018,strap,torso);box([.085,.19,.085],[s*.21,.15,-.18],metal,torso,true);}
 for(const s of [-1,1]){
  const ankle=[s*.105,.13,s===1&&pose==='observe'?.07:0],knee=[s*.11,.48,pose==='check'?.07:0],hip=[s*.108,.87,-.01];
  rod(ankle,knee,.075,trousers,person,.087);rod(knee,hip,.087,trousers,person,.115);ellipsoid([.085,.095,.086],knee,trousers,person);
  box([.155,.15,.275],[ankle[0],.08,ankle[2]+.052],boot,person,true);box([.16,.035,.28],[ankle[0],.018,ankle[2]+.05],strap,person,true);
  box([.13,.06,.09],[ankle[0],.155,ankle[2]+.035],boot,person,true);
  const shoulder=[s*.235,.51,0],elbow=pose==='check'?[s*.29,.27,.19]:pose==='observe'&&s===1?[s*.31,.48,.21]:[s*.28,.23,.025],hand=pose==='check'?[s*.16,.23,.4]:pose==='observe'&&s===1?[s*.18,.7,.28]:[s*.24,.01,.07];
  tube([shoulder,elbow,hand],.077,coat,torso);ellipsoid([.055,.07,.035],hand,boot,torso);
 }
 if(pose==='check'){const tablet=box([.29,.045,.2],[0,.23,.43],metal,torso,true);tablet.rotation.x=.1;box([.24,.006,.15],[0,.257,.43],screen,torso,true);}
 person.rotation.y=rotation;consolidate(person);person.userData.kind='human';return person;
}

export function fieldRover(kit,palette){
 const {box,ellipsoid,rod,tube,consolidate}=kit,{metal,coat,boot,screen,trim,strap}=palette,root=new T.Group();
 box([.78,.2,1.03],[0,.39,0],metal,root,true);box([.65,.23,.63],[0,.58,-.08],trim,root,true);box([.38,.035,.34],[0,.715,-.12],coat,root,true);
 for(const x of [-.43,.43])for(const z of [-.34,.34]){const wheel=kit.mesh(kit.own(new T.CylinderGeometry(.205,.205,.11,16)),boot,[x,.215,z],[1,1,1],root);wheel.rotation.z=Math.PI/2;const hub=kit.mesh(kit.own(new T.CylinderGeometry(.087,.087,.115,12)),metal,[x,.215,z],[1,1,1],root);hub.rotation.z=Math.PI/2;rod([x*.65,.42,z],[x,.24,z],.037,strap,root);}
 rod([0,.7,-.25],[0,1.04,-.25],.035,metal,root);box([.31,.12,.16],[0,1.08,-.25],metal,root,true);ellipsoid([.043,.043,.018],[.065,1.08,-.155],screen,root);box([.055,.02,.018],[-.075,1.08,-.155],strap,root);box([.23,.01,.018],[0,1.035,-.155],screen,root);
 rod([.23,.57,.3],[.35,.86,.34],.047,metal,root);rod([.35,.86,.34],[.23,.96,.7],.036,trim,root);ellipsoid([.065,.065,.065],[.35,.86,.34],strap,root);box([.11,.07,.15],[.23,.96,.73],metal,root,true);
 for(const s of [-1,1])rod([.23+s*.04,.96,.76],[.23+s*.055,.94,.87],.015,strap,root);
 tube([[.23,.6,.3],[.29,.76,.31],[.32,.88,.41],[.22,.93,.63]],.018,boot,root);
 for(const x of [-.25,.25])box([.08,.035,.02],[x,.48,.525],screen,root,true);
 consolidate(root);root.userData.kind='rover';return root;
}
