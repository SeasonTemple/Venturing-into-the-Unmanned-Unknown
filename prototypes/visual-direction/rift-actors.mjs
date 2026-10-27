import * as T from 'three';
export function createActors(scene,{own,mat,textures}){
 const root=new T.Group();scene.add(root);
 const cloth=mat({color:'#d4bd90',roughness:.9}),dark=mat({color:'#283c42',roughness:.83}),skin=mat({color:'#bc9075',roughness:.87}),helmet=mat({color:'#ede4c4',roughness:.68});
 const capsule=own(new T.CapsuleGeometry(1,1,4,10)),sphere=own(new T.SphereGeometry(1,14,10)),box=own(new T.BoxGeometry(1,1,1));
 function part(parent,geometry,material,p,s){const mesh=new T.Mesh(geometry,material);mesh.position.set(...p);mesh.scale.set(...s);parent.add(mesh);return mesh;}
 const person=new T.Group();root.add(person);
 part(person,capsule,cloth,[0,1.08,0],[.19,.18,.14]);
 part(person,box,dark,[0,.84,0],[.32,.12,.24]);
 part(person,sphere,skin,[0,1.52,.015],[.13,.16,.13]);
 part(person,sphere,helmet,[0,1.61,0],[.17,.11,.17]);
 part(person,box,helmet,[0,1.58,.12],[.34,.035,.2]);
 part(person,box,dark,[0,1.16,-.16],[.28,.34,.15]);
 part(person,box,helmet,[0,1.18,-.245],[.2,.2,.025]);
 const limbs=[];
 for(const side of [-1,1]){
  const leg=new T.Group();leg.position.set(side*.105,.83,0);person.add(leg);
  part(leg,capsule,cloth,[0,-.19,0],[.073,.11,.075]);
  part(leg,capsule,cloth,[0,-.51,0],[.064,.11,.067]);
  part(leg,box,dark,[0,-.75,.045],[.14,.13,.24]);
  const arm=new T.Group();arm.position.set(side*.235,1.28,0);person.add(arm);
  part(arm,capsule,cloth,[0,-.15,0],[.058,.075,.063]);
  part(arm,capsule,cloth,[0,-.38,.025],[.05,.065,.054]);
  part(arm,sphere,skin,[0,-.52,.03],[.054,.068,.055]);
  limbs.push({leg,arm,side});
 }
 const proxy=mat({color:'#a7d8d5',metalness:.3,roughness:.4,emissive:'#518c92',emissiveIntensity:.25,wireframe:true});
 const core=own(new T.OctahedronGeometry(.42)),ring=own(new T.TorusGeometry(.65,.017,4,32));
 const bots=['分解','生产','检查'].map((name,i)=>{
  const unit=new T.Group();root.add(unit);part(unit,core,proxy,[0,1.3,0],[1,1.4,1]);const halo=part(unit,ring,proxy,[0,1.3,0],[1,1,1]);halo.rotation.x=Math.PI/2;
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=70;const ctx=canvas.getContext('2d');ctx.fillStyle='#c3efeb';ctx.font='26px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText(`0${i+1} / ${name}`,128,45);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;textures.add(texture);const material=new T.SpriteMaterial({map:texture,depthTest:true});const label=new T.Sprite(material);label.position.y=2.2;label.scale.set(2.1,.57,1);unit.add(label);return{unit,material};
 });
 const origin=new T.Vector3();let mode='agent',walk=0;
 function setMode(value){mode=value;bots.forEach(b=>b.unit.visible=value==='agent');}
 function pose(value){limbs.forEach(({leg,arm,side})=>{leg.rotation.x=Math.sin(value)*side*.5;arm.rotation.x=-Math.sin(value)*side*.37;});}
 function place(point){origin.copy(point);person.position.copy(point);bots.forEach((b,i)=>b.unit.position.copy(point).add(new T.Vector3(-5+i*5,0,-4)));pose(0);}
 function move(point,direction,distance){walk=distance;person.position.copy(point);person.rotation.y=Math.atan2(direction.x,direction.z);pose(distance*3.5);}
 return{root,person,setMode,place,move,settle:()=>pose(0),stats:()=>({human:person.position.toArray(),heading:person.rotation.y,walk,agentUnits:bots.filter(b=>b.unit.visible).length}),dispose(){bots.forEach(b=>b.material.dispose());}};
}
