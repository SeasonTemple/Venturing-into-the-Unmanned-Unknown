import * as T from 'three';

export function createActors(scene,{own,mat,textures}){
  const root=new T.Group();root.visible=false;scene.add(root);
  const suit=mat({color:'#dfc69b',roughness:.8}),boots=mat({color:'#253c43',roughness:.8}),skin=mat({color:'#b78c70',roughness:.8});
  const glass=mat({color:'#172c35',metalness:.3,roughness:.25});
  const proxy=mat({color:'#82d9dd',metalness:.25,roughness:.4,emissive:'#3c858c',emissiveIntensity:.45});
  const box=own(new T.BoxGeometry(1,1,1)),ball=own(new T.SphereGeometry(1,12,8));
  function mesh(parent,g,m,p,s){const v=new T.Mesh(g,m);v.position.set(...p);v.scale.set(...s);parent.add(v);return v;}
  const person=new T.Group();root.add(person);
  mesh(person,box,suit,[0,1.08,0],[.43,.48,.26]);
  mesh(person,ball,skin,[0,1.52,0],[.145,.18,.145]);
  mesh(person,ball,suit,[0,1.64,0],[.19,.1,.19]);
  mesh(person,box,glass,[0,1.54,.14],[.23,.075,.025]);
  mesh(person,box,boots,[0,1.13,-.19],[.31,.38,.16]);
  mesh(person,box,boots,[0,.86,0],[.36,.12,.23]);
  const limbs=[];
  for(const side of [-1,1]){
    const leg=new T.Group();leg.position.set(side*.12,.82,0);person.add(leg);
    mesh(leg,box,suit,[0,-.32,0],[.16,.6,.17]);mesh(leg,box,boots,[0,-.72,.06],[.18,.16,.3]);
    const arm=new T.Group();arm.position.set(side*.29,1.28,0);person.add(arm);
    mesh(arm,box,suit,[0,-.23,0],[.135,.44,.15]);mesh(arm,ball,skin,[0,-.49,0],[.075,.09,.07]);
    limbs.push({leg,arm,side});
  }
  const diamond=own(new T.OctahedronGeometry(.55)),ring=own(new T.TorusGeometry(.8,.025,4,32));
  const bots=['分解','生产','检查'].map((name,i)=>{
    const unit=new T.Group();root.add(unit);
    const core=mesh(unit,diamond,proxy,[0,1.35,0],[1,1.4,1]);
    const halo=mesh(unit,ring,proxy,[0,1.35,0],[1,1,1]);halo.rotation.x=Math.PI/2;
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=80;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#172b32';ctx.fillRect(0,0,256,80);ctx.fillStyle='#b9f2ee';ctx.font='28px "Microsoft YaHei", sans-serif';ctx.textAlign='center';ctx.fillText(`${String(i+1).padStart(2,'0')} / ${name}`,128,51);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;textures.add(texture);
    const label=new T.Sprite(new T.SpriteMaterial({map:texture,depthTest:true}));unit.add(label);label.position.y=2.6;label.scale.set(2.6,.81,1);
    return{unit,core,label};
  });
  let mode='agent',phase='idle',home=new T.Vector3(),walk=0;
  function setMode(value){mode=value;bots.forEach(b=>b.unit.visible=mode==='agent');}
  function place(point){home.copy(point);person.position.copy(point);bots.forEach((b,i)=>b.unit.position.copy(point).add(new T.Vector3(-3+i*3,0,-3)));pose(0);}
  function pose(stride){for(const{leg,arm,side}of limbs){leg.rotation.x=Math.sin(stride)*.5*side;arm.rotation.x=-Math.sin(stride)*.4*side;}}
  function move(point,direction,distance){person.position.copy(point);if(direction.lengthSq()>.001)person.rotation.y=Math.atan2(direction.x,direction.z);walk=distance;pose(distance*3);bots.forEach((b,i)=>b.unit.position.copy(point).add(new T.Vector3(-2+i*2,0,-2)));}
  function work(value,progress=0){phase=value;pose(0);bots.forEach((b,i)=>{b.unit.position.copy(home).add(new T.Vector3(-4+i*4,0,-3-progress*3));b.core.rotation.y=progress*Math.PI*2;});if(mode==='human'){person.position.copy(home).add(new T.Vector3(-progress*2,0,-progress*2));limbs.forEach(({arm})=>arm.rotation.x=-.65*Math.sin(progress*Math.PI));}}
  return{root,person,setMode,place,move,work,settle(){pose(0);},stats:()=>({human:person.position.toArray(),heading:person.rotation.y,walk,phase,agentUnits:bots.filter(b=>b.unit.visible).length}),dispose(){bots.forEach(b=>b.label.material.dispose());}};
}
