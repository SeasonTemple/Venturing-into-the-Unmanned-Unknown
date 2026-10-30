"""Private authoring inspection of source clothing parts; not an art delivery."""
from pathlib import Path
import json
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
TEMP=ROOT/'.lab/character-master-02'
TEMP.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'prototypes/visual-direction/character-master-media/character-master-v01.blend'))
ob=bpy.data.objects['Editable_coat_and_trousers']
parent=list(range(len(ob.data.vertices)))
def find(i):
    while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
    return i
for p in ob.data.polygons:
    for i in p.vertices[1:]:parent[find(i)]=find(p.vertices[0])
parts={}
for v in ob.data.vertices:parts.setdefault(find(v.index),[]).append(v.index)
report=[]
for index,ids in enumerate(parts.values()):
    mat=bpy.data.materials.new('Part_'+str(index));mat.use_nodes=True
    nodes=mat.node_tree.nodes;nodes.clear()
    emission=nodes.new('ShaderNodeEmission');emission.inputs[0].default_value=[(.8,.15,.05,1),(.1,.45,.75,1),(.5,.15,.7,1),(.1,.5,.2,1)][index]
    out=nodes.new('ShaderNodeOutputMaterial');mat.node_tree.links.new(emission.outputs[0],out.inputs[0]);ob.data.materials.append(mat)
    subset=set(ids)
    for p in ob.data.polygons:
        if p.vertices[0] in subset:p.material_index=len(ob.data.materials)-1
    coords=[ob.data.vertices[i].co for i in ids]
    report.append({'part':index,'vertices':len(ids),'idMin':min(ids),'idMax':max(ids),'bounds':[[min(v[axis] for v in coords),max(v[axis] for v in coords)] for axis in range(3)]})
scene=bpy.context.scene;scene.render.resolution_x=384;scene.render.resolution_y=588
scene.render.filepath=str(TEMP/'garment-parts-left.png');bpy.ops.render.render(write_still=True)
scene.camera.location=(0,-4,2.0);target=Vector((0,0,.93));scene.camera.rotation_euler=(target-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(TEMP/'garment-parts-front.png');bpy.ops.render.render(write_still=True)
(TEMP/'parts.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report),flush=True)
