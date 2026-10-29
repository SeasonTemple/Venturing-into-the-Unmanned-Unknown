"""
Copyright (C) 2023-2025 Lucas Roedel
    https://lucasroedel.com
    contato@lucasroedel.com

Created by Lucas Roedel Ribeiro

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
"""
"""
Modified by Trashy (Aka Simon)

Notes:
    This code is a total mess, but it works. There are a lot of things
    here to optimize and a lot of inconsistencies to fix. But I wont
    be doing that, I hate Python
"""

import bpy

def get_bayer():
    bayerMatrix = bpy.data.images.get("Bayer Matrix")
    
    if bayerMatrix == None:
        bayerMatrix = bpy.data.images.new("Bayer Matrix", 2, 2)
        bayerMatrix.use_fake_user = True
        bayerMatrix.pixels[0] = (0.75294)
        bayerMatrix.pixels[1] = (0.75294)
        bayerMatrix.pixels[2] = (0.75294)
        bayerMatrix.pixels[4] = (0.25098)
        bayerMatrix.pixels[5] = (0.25098)
        bayerMatrix.pixels[6] = (0.25098)
        bayerMatrix.pixels[12] = (0.50196)
        bayerMatrix.pixels[13] = (0.50196)
        bayerMatrix.pixels[14] = (0.50196)
        
        bayerMatrix.filepath_raw = "/tmp/bayerMatrix.png"
        bayerMatrix.file_format = 'PNG'
        bayerMatrix.save()

    return bayerMatrix

########## Creates Dynamic Default Material ##########
def dynamic_material(context, defaultName = "PixelArt_Dynamic"):
    bayerMatrix = get_bayer()

    # Creates a material with the name if it doesn't exist already
    for material in bpy.data.materials:
        if material.name == defaultName:
            bpy.data.materials.remove(material)
    material = bpy.data.materials.new(name = defaultName)
    material.use_nodes = True
    material.use_fake_user = True

    for node in material.node_tree.nodes:
        if node.type == 'OUTPUT_MATERIAL':
            material.node_tree.nodes.remove(node)
            break

    for node in material.node_tree.nodes:
        if node.type == 'BSDF_PRINCIPLED':
            material.node_tree.nodes.remove(node)
            break

    # Don't look too closely here please
    # --- Nodes ---
    Material_Output = material.node_tree.nodes.new(type="ShaderNodeOutputMaterial")
    Material_Output.name = 'Material Output'
    Material_Output.location = (1620, 380)

    Principled_BSDF = material.node_tree.nodes.new(type="ShaderNodeBsdfPrincipled")
    Principled_BSDF.name = 'Principled BSDF'
    Principled_BSDF.location = (-1870, 250)
    Principled_BSDF.inputs[0].default_value = [0.378697, 0.740593, 0.800007, 1.000000]

    Shader_to_RGB = material.node_tree.nodes.new(type="ShaderNodeShaderToRGB")
    Shader_to_RGB.name = 'Shader to RGB'
    Shader_to_RGB.location = (-1505, 300)

    Separate_Color = material.node_tree.nodes.new(type="ShaderNodeSeparateColor")
    Separate_Color.name = 'Separate Color'
    Separate_Color.location = (-1310, 250)
    Separate_Color.mode = 'HSV'

    Combine_Color = material.node_tree.nodes.new(type="ShaderNodeCombineColor")
    Combine_Color.name = 'Combine Color'
    Combine_Color.location = (1235, 335)
    Combine_Color.mode = 'HSV'

    Invert_Color = material.node_tree.nodes.new(type="ShaderNodeInvert")
    Invert_Color.name = 'Invert Color'
    Invert_Color.location = (-140, -60)

    Map_Range = material.node_tree.nodes.new(type="ShaderNodeMapRange")
    Map_Range.name = 'Map Range'
    Map_Range.location = (330, 40)
    Map_Range.inputs[2].default_value = 1
    Map_Range.inputs[3].default_value = 1

    Saturation_Shift_Note_1 = material.node_tree.nodes.new(type="NodeFrame")
    Saturation_Shift_Note_1.name = 'Saturation Shift Note 1'
    Saturation_Shift_Note_1.location = (-395, -295)
    Saturation_Shift_Note_1.label = "Determine saturation here"
    Saturation_Shift_Note_1.height = 35
    Saturation_Shift_Note_1.width = 290

    Math = material.node_tree.nodes.new(type="ShaderNodeMath")
    Math.name = 'Math'
    Math.location = (-890, 510)
    Math.operation = 'SUBTRACT'

    Color = material.node_tree.nodes.new(type="ShaderNodeRGB")
    Color.name = 'Color'
    Color.location = (-1295, 685)
    Color.outputs[0].default_value = [0.18116, 0, 0.502878, 1.000000]

    Darkest_Hue_Note = material.node_tree.nodes.new(type="NodeFrame")
    Darkest_Hue_Note.name = 'Darkest Hue Note'
    Darkest_Hue_Note.location = (-1300, 745)
    Darkest_Hue_Note.label = "Darkest Hue"
    Darkest_Hue_Note.height = 35

    Separate_Color_001 = material.node_tree.nodes.new(type="ShaderNodeSeparateColor")
    Separate_Color_001.name = 'Separate Color.001'
    Separate_Color_001.location = (-1100, 690)
    Separate_Color_001.mode = 'HSV'

    Math_001 = material.node_tree.nodes.new(type="ShaderNodeMath")
    Math_001.name = 'Math.001'
    Math_001.location = (-895, 680)
    Math_001.operation = 'SUBTRACT'

    Color_001 = material.node_tree.nodes.new(type="ShaderNodeRGB")
    Color_001.name = 'Color.001'
    Color_001.location = (-1295, 460)
    Color_001.outputs[0].default_value = [0.499858, 0, 0, 1.000000]

    Brightest_Hue_Note = material.node_tree.nodes.new(type="NodeFrame")
    Brightest_Hue_Note.name = 'Brightest Hue Note'
    Brightest_Hue_Note.location = (-1300, 520)
    Brightest_Hue_Note.label = "Brightest Hue"
    Brightest_Hue_Note.height = 35

    Separate_Color_002 = material.node_tree.nodes.new(type="ShaderNodeSeparateColor")
    Separate_Color_002.name = 'Separate Color.002'
    Separate_Color_002.location = (-1095, 460)
    Separate_Color_002.mode = 'HSV'

    Math_002 = material.node_tree.nodes.new(type="ShaderNodeMath")
    Math_002.name = 'Math.002'
    Math_002.location = (-690, 685)
    Math_002.inputs[1].default_value = 0.5

    Math_003 = material.node_tree.nodes.new(type="ShaderNodeMath")
    Math_003.name = 'Math.003'
    Math_003.location = (-700, 515)
    Math_003.inputs[1].default_value = 0.5

    Math_004 = material.node_tree.nodes.new(type="ShaderNodeMath")
    Math_004.name = 'Math.004'
    Math_004.location = (-515, 675)
    Math_004.operation = 'FRACT'

    Math_005 = material.node_tree.nodes.new(type="ShaderNodeMath")
    Math_005.name = 'Math.005'
    Math_005.location = (-520, 515)
    Math_005.operation = 'FRACT'

    Math_006 = material.node_tree.nodes.new(type="ShaderNodeMath")
    Math_006.name = 'Math.006'
    Math_006.location = (-325, 685)
    Math_006.inputs[1].default_value = 0.5
    Math_006.operation = 'SUBTRACT'

    Math_007 = material.node_tree.nodes.new(type="ShaderNodeMath")
    Math_007.name = 'Math.007'
    Math_007.location = (-320, 530)
    Math_007.inputs[1].default_value = 0.5
    Math_007.operation = 'SUBTRACT'

    Invert_Color_001 = material.node_tree.nodes.new(type="ShaderNodeInvert")
    Invert_Color_001.name = 'Invert Color.001'
    Invert_Color_001.location = (-130, 610)

    Math_008 = material.node_tree.nodes.new(type="ShaderNodeMath")
    Math_008.name = 'Math.008'
    Math_008.location = (215, 740)
    Math_008.operation = 'MULTIPLY'

    Math_009 = material.node_tree.nodes.new(type="ShaderNodeMath")
    Math_009.name = 'Math.009'
    Math_009.location = (215, 530)
    Math_009.operation = 'MULTIPLY'

    Map_Range_001 = material.node_tree.nodes.new(type="ShaderNodeMapRange")
    Map_Range_001.name = 'Map Range.001'
    Map_Range_001.location = (35, 415)
    Map_Range_001.inputs[1].default_value = 0.5
    Map_Range_001.inputs[2].default_value = 1
    Map_Range_001.inputs[3].default_value = 0
    Map_Range_001.inputs[4].default_value = 1

    Map_Range_002 = material.node_tree.nodes.new(type="ShaderNodeMapRange")
    Map_Range_002.name = 'Map Range.002'
    Map_Range_002.location = (30, 710)
    Map_Range_002.inputs[1].default_value = 0.5
    Map_Range_002.inputs[2].default_value = 1
    Map_Range_002.inputs[3].default_value = 0
    Map_Range_002.inputs[4].default_value = 1

    Math_010 = material.node_tree.nodes.new(type="ShaderNodeMath")
    Math_010.name = 'Math.010'
    Math_010.location = (405, 600)

    Math_011 = material.node_tree.nodes.new(type="ShaderNodeMath")
    Math_011.name = 'Math.011'
    Math_011.location = (790, 435)

    Math_012 = material.node_tree.nodes.new(type="ShaderNodeMath")
    Math_012.name = 'Math.012'
    Math_012.location = (610, 555)
    Math_012.operation = 'MULTIPLY'

    Hue_Shift_Strength = material.node_tree.nodes.new(type="ShaderNodeValue")
    Hue_Shift_Strength.name = 'Hue Shift Strength'
    Hue_Shift_Strength.location = (415, 435)
    Hue_Shift_Strength.outputs[0].default_value = 0.6
    Hue_Shift_Strength.label = "Hue Shift"

    Normal_Map = material.node_tree.nodes.new(type="ShaderNodeNormalMap")
    Normal_Map.name = 'Normal Map'
    Normal_Map.location = (-2175, 100)

    Math_013 = material.node_tree.nodes.new(type="ShaderNodeMath")
    Math_013.name = 'Math.013'
    Math_013.location = (995, 385)
    Math_013.operation = 'FRACT'

    Color_Ramp = material.node_tree.nodes.new(type="ShaderNodeValToRGB")
    Color_Ramp.name = 'Color Ramp'
    Color_Ramp.location = (-560, 200)
    Color_Ramp.color_ramp.interpolation = 'CONSTANT'
    Color_Ramp.color_ramp.elements.remove(Color_Ramp.color_ramp.elements[1])
    Color_Ramp.color_ramp.elements.new(0.075)
    Color_Ramp.color_ramp.elements.new(0.225)
    Color_Ramp.color_ramp.elements.new(0.450)
    Color_Ramp.color_ramp.elements.new(0.800)
    Color_Ramp.color_ramp.elements[0].color = [0.005423, 0.005423, 0.005423, 1.000000]
    Color_Ramp.color_ramp.elements[1].color = [0.033104, 0.033104, 0.033104, 1.000000]
    Color_Ramp.color_ramp.elements[2].color = [0.132871, 0.132871, 0.132871, 1.000000]
    Color_Ramp.color_ramp.elements[3].color = [0.318555, 0.318555, 0.318555, 1.000000]
    Color_Ramp.color_ramp.elements[4].color = [0.603831, 0.603831, 0.603831, 1.000000]

    Separate_Color_003 = material.node_tree.nodes.new(type="ShaderNodeSeparateColor")
    Separate_Color_003.name = 'Separate Color.003'
    Separate_Color_003.location = (-275, 245)
    Separate_Color_003.mode = 'HSV'

    Mix_Legacy = material.node_tree.nodes.new(type="ShaderNodeMixRGB")
    Mix_Legacy.name = 'Mix (Legacy)'
    Mix_Legacy.location = (-750, 45)
    Mix_Legacy.blend_type = 'SOFT_LIGHT'
    Mix_Legacy.inputs[0].default_value = 0.6

    Image_Texture_002 = material.node_tree.nodes.new(type="ShaderNodeTexImage")
    Image_Texture_002.name = 'Image Texture.002'
    Image_Texture_002.location = (-1065, -355)
    Image_Texture_002.image = bayerMatrix
    Image_Texture_002.interpolation = 'Closest'

    Vector_Math = material.node_tree.nodes.new(type="ShaderNodeVectorMath")
    Vector_Math.name = 'Vector Math'
    Vector_Math.location = (-1265, -555)
    Vector_Math.operation = 'MULTIPLY'

    Texture_Coordinate = material.node_tree.nodes.new(type="ShaderNodeTexCoord")
    Texture_Coordinate.name = 'Texture Coordinate'
    Texture_Coordinate.location = (-1475, -505)

    Combine_XYZ = material.node_tree.nodes.new(type="ShaderNodeCombineXYZ")
    Combine_XYZ.name = 'Combine XYZ'
    Combine_XYZ.location = (-1475, -805)

    # Resolution Drivers
    XRes = material.node_tree.nodes.new(type="ShaderNodeValue")
    XRes.name = 'X Resolution'
    XRes.location = (-1675, -805)
    XRes.label = "ResolutionX / 2"

    XResDriver = XRes.outputs[0].driver_add("default_value")
    var1 = XResDriver.driver.variables.new()
    var1.name = "resolutionX"
    var1.targets[0].id_type = 'SCENE'
    var1.targets[0].id = bpy.data.scenes["Scene"]
    var1.targets[0].data_path = "render.resolution_x"
    XResDriver.driver.expression = "resolutionX / 2"

    YRes = material.node_tree.nodes.new(type="ShaderNodeValue")
    YRes.name = 'Y Resolution'
    YRes.location = (-1675, -905)
    YRes.label = "ResolutionY / 2"

    YResDriver = YRes.outputs[0].driver_add("default_value")
    var2 = YResDriver.driver.variables.new()
    var2.name = "resolutionY"
    var2.targets[0].id_type = 'SCENE'
    var2.targets[0].id = bpy.data.scenes["Scene"]
    var2.targets[0].data_path = "render.resolution_y"
    YResDriver.driver.expression = "resolutionY / 2"

    Math_014 = material.node_tree.nodes.new(type="ShaderNodeMath")
    Math_014.name = 'Math.014'
    Math_014.location = (480, 250)
    Math_014.operation = 'MULTIPLY'

    Emission = material.node_tree.nodes.new(type="ShaderNodeEmission")
    Emission.name = 'Emission'
    Emission.location = (1445, 360)

    Image_Texture_003 = material.node_tree.nodes.new(type="ShaderNodeTexImage")
    Image_Texture_003.name = 'Image Texture.003'
    Image_Texture_003.location = (-1570, -50)

    Separate_Color_004 = material.node_tree.nodes.new(type="ShaderNodeSeparateColor")
    Separate_Color_004.name = 'Separate Color.004'
    Separate_Color_004.location = (-1230, -100)
    Separate_Color_004.inputs[0].default_value = [0, 0, 0, 1]
    Separate_Color_004.mode = 'HSV'

    Math_015 = material.node_tree.nodes.new(type="ShaderNodeMath")
    Math_015.name = 'Math.015'
    Math_015.location = (-1000, 90)

    Attribute = material.node_tree.nodes.new(type="ShaderNodeAttribute")
    Attribute.name = 'Attribute'
    Attribute.location = (-1485, -280)

    Normal_Map_Note = material.node_tree.nodes.new(type="NodeFrame")
    Normal_Map_Note.name = 'Normal Map Note'
    Normal_Map_Note.location = (-2305, 165)
    Normal_Map_Note.label = "Add normal map here when wanted"
    Normal_Map_Note.height = 35
    Normal_Map_Note.width = 370

    Texture_Attribute_Note = material.node_tree.nodes.new(type="NodeFrame")
    Texture_Attribute_Note.name = 'Texture/Attribute Note'
    Texture_Attribute_Note.location = (-2060, -275)
    Texture_Attribute_Note.label = "Use either texture or vertex map to brighten/darken"
    Texture_Attribute_Note.height = 35
    Texture_Attribute_Note.width = 520

    Add_Subtract_Note = material.node_tree.nodes.new(type="NodeFrame")
    Add_Subtract_Note.name = 'Add/Subtract Note'
    Add_Subtract_Note.location = (-1140, 155)
    Add_Subtract_Note.label = "Switch between Add and Subtract here"
    Add_Subtract_Note.height = 35
    Add_Subtract_Note.width = 410

    Hue_Shift_Note = material.node_tree.nodes.new(type="NodeFrame")
    Hue_Shift_Note.name = 'Hue Shift Note'
    Hue_Shift_Note.location = (320, 370)
    Hue_Shift_Note.label = "Modify hue shift amount here"
    Hue_Shift_Note.height = 35
    Hue_Shift_Note.width = 310

    Math_016 = material.node_tree.nodes.new(type="ShaderNodeMath")
    Math_016.name = 'Math.016'
    Math_016.location = (145, -225)
    Math_016.operation = 'SUBTRACT'
    Math_016.inputs[0].default_value = 2

    Saturation_Value_Strength = material.node_tree.nodes.new(type="ShaderNodeValue")
    Saturation_Value_Strength.name = 'Saturation Value Strength'
    Saturation_Value_Strength.location = (-315, -230)
    Saturation_Value_Strength.label = "Saturation Shift"

    Clamp = material.node_tree.nodes.new(type="ShaderNodeClamp")
    Clamp.name = 'Clamp'
    Clamp.location = (-100, -180)
    Clamp.inputs[1].default_value = 0
    Clamp.inputs[2].default_value = 1

    Saturation_Shift_Note_2 = material.node_tree.nodes.new(type="NodeFrame")
    Saturation_Shift_Note_2.name = 'Saturation Shift Note 2'
    Saturation_Shift_Note_2.location = (-480, -350)
    Saturation_Shift_Note_2.label = "0 is full saturation shift, 1 is no saturation shift"
    Saturation_Shift_Note_2.height = 35
    Saturation_Shift_Note_2.width = 470

    # --- Links ---
    material.node_tree.links.new(Principled_BSDF.outputs[0], Shader_to_RGB.inputs[0])
    material.node_tree.links.new(Invert_Color.outputs[0], Map_Range.inputs[0])
    material.node_tree.links.new(Separate_Color.outputs[0], Math.inputs[1])
    material.node_tree.links.new(Color.outputs[0], Separate_Color_001.inputs[0])
    material.node_tree.links.new(Separate_Color.outputs[0], Math_001.inputs[1])
    material.node_tree.links.new(Color_001.outputs[0], Separate_Color_002.inputs[0])
    material.node_tree.links.new(Separate_Color_002.outputs[0], Math.inputs[0])
    material.node_tree.links.new(Separate_Color_001.outputs[0], Math_001.inputs[0])
    material.node_tree.links.new(Math_001.outputs[0], Math_002.inputs[0])
    material.node_tree.links.new(Math.outputs[0], Math_003.inputs[0])
    material.node_tree.links.new(Math_002.outputs[0], Math_004.inputs[0])
    material.node_tree.links.new(Math_003.outputs[0], Math_005.inputs[0])
    material.node_tree.links.new(Math_004.outputs[0], Math_006.inputs[0])
    material.node_tree.links.new(Math_005.outputs[0], Math_007.inputs[0])
    material.node_tree.links.new(Map_Range_002.outputs[0], Math_008.inputs[1])
    material.node_tree.links.new(Math_006.outputs[0], Math_008.inputs[0])
    material.node_tree.links.new(Math_007.outputs[0], Math_009.inputs[0])
    material.node_tree.links.new(Map_Range_001.outputs[0], Math_009.inputs[1])
    material.node_tree.links.new(Invert_Color_001.outputs[0], Map_Range_002.inputs[0])
    material.node_tree.links.new(Math_008.outputs[0], Math_010.inputs[0])
    material.node_tree.links.new(Math_009.outputs[0], Math_010.inputs[1])
    material.node_tree.links.new(Separate_Color.outputs[0], Math_011.inputs[1])
    material.node_tree.links.new(Math_012.outputs[0], Math_011.inputs[0])
    material.node_tree.links.new(Math_013.outputs[0], Combine_Color.inputs[0])
    material.node_tree.links.new(Math_010.outputs[0], Math_012.inputs[0])
    material.node_tree.links.new(Hue_Shift_Strength.outputs[0], Math_012.inputs[1])
    material.node_tree.links.new(Shader_to_RGB.outputs[0], Separate_Color.inputs[0])
    material.node_tree.links.new(Math_011.outputs[0], Math_013.inputs[0])
    material.node_tree.links.new(Color_Ramp.outputs[0], Separate_Color_003.inputs[0])
    material.node_tree.links.new(Separate_Color_003.outputs[2], Invert_Color.inputs[1])
    material.node_tree.links.new(Separate_Color_003.outputs[2], Map_Range_001.inputs[0])
    material.node_tree.links.new(Separate_Color_003.outputs[2], Combine_Color.inputs[2])
    material.node_tree.links.new(Separate_Color_003.outputs[2], Invert_Color_001.inputs[1])
    material.node_tree.links.new(Image_Texture_002.outputs[0], Mix_Legacy.inputs[2])
    material.node_tree.links.new(Vector_Math.outputs[0], Image_Texture_002.inputs[0])
    material.node_tree.links.new(Texture_Coordinate.outputs[5], Vector_Math.inputs[0])
    material.node_tree.links.new(Combine_XYZ.outputs[0], Vector_Math.inputs[1])
    material.node_tree.links.new(XRes.outputs[0], Combine_XYZ.inputs[0])
    material.node_tree.links.new(YRes.outputs[0], Combine_XYZ.inputs[1])
    material.node_tree.links.new(Mix_Legacy.outputs[0], Color_Ramp.inputs[0])
    material.node_tree.links.new(Map_Range.outputs[0], Math_014.inputs[1])
    material.node_tree.links.new(Separate_Color.outputs[1], Math_014.inputs[0])
    material.node_tree.links.new(Math_014.outputs[0], Combine_Color.inputs[1])
    material.node_tree.links.new(Emission.outputs[0], Material_Output.inputs[0])
    material.node_tree.links.new(Separate_Color.outputs[2], Math_015.inputs[0])
    material.node_tree.links.new(Math_015.outputs[0], Mix_Legacy.inputs[1])
    material.node_tree.links.new(Separate_Color_004.outputs[2], Math_015.inputs[1])
    material.node_tree.links.new(Combine_Color.outputs[0], Emission.inputs[0])
    material.node_tree.links.new(Normal_Map.outputs[0], Principled_BSDF.inputs[6])
    material.node_tree.links.new(Math_016.outputs[0], Map_Range.inputs[4])
    material.node_tree.links.new(Clamp.outputs[0], Map_Range.inputs[1])
    material.node_tree.links.new(Saturation_Value_Strength.outputs[0], Clamp.inputs[0])
    material.node_tree.links.new(Clamp.outputs[0], Math_016.inputs[1])

    return material

def dynamic_material_shine(self, context):
    dynamic_material(context)
    
    mat = None

    for material in bpy.data.materials:
        if material.name == "PixelArt_Dynamic":
            mat = material

    if mat is None:
        self.report({'ERROR'}, "No PixelArt material found. This should not be possible... good luck")
        return

    nodes = mat.node_tree.nodes
    # Get pre-existing nodes
    material_output = nodes.get("Material Output")
    emission = nodes.get("Emission")
    combine_col = nodes.get("Combine Color")

    # Disconnect
    link = combine_col.outputs[0].links[0]
    combine_col.id_data.links.remove(link)

    # Move preexisting
    material_output.location = (1880, 375)
    emission.location = (1700, 355)

    # Create
    shine_group = nodes.new(type="ShaderNodeGroup")
    shine_group.node_tree = bpy.data.node_groups["Shine Reflection"]
    shine_group.location = (1320, 155)

    # Value nodes for rotation and scale of shine group
    value_rot = nodes.new(type="ShaderNodeValue")
    value_rot.location = (1110, 25)
    value_rot.label = "Shine Rotation"
    value_rot.outputs[0].default_value = 2.5

    value_scale = nodes.new(type="ShaderNodeValue")
    value_scale.location = (1110, -65)
    value_scale.label = "Shine Scale"
    value_scale.outputs[0].default_value = 1

    # Create color mixing node and set correct settings before use
    mix_node = nodes.new(type="ShaderNodeMixRGB")
    mix_node.location = (1515, 330)
    mix_node.blend_type = 'MIX'
    mix_node.inputs[2].default_value = [1, 1, 1, 1]

    Shine_Blend_Note = material.node_tree.nodes.new(type="NodeFrame")
    Shine_Blend_Note.name = 'Shine Node Note'
    Shine_Blend_Note.location = (1425, 415)
    Shine_Blend_Note.label = "Try different blend modes"
    Shine_Blend_Note.height = 35
    Shine_Blend_Note.width = 300

    # Linking
    links = mat.node_tree.links

    links.new(value_rot.outputs[0], shine_group.inputs['Rotation'])
    links.new(value_scale.outputs[0], shine_group.inputs['Scale'])
    links.new(shine_group.outputs[0], mix_node.inputs[0])
    links.new(combine_col.outputs[0], mix_node.inputs['Color1'])
    links.new(mix_node.outputs[0], emission.inputs['Color'])

########## Creates Simple Default Material ##########
def single_material(context, defaultName = "PixelArt_Simple"):
    bayerMatrix = get_bayer()

    # Creates a material with the name if it doesn't exist already
    for material in bpy.data.materials:
        if material.name == defaultName:
            bpy.data.materials.remove(material)
    material = bpy.data.materials.new(name = defaultName)
    material.use_nodes = True
    material.use_fake_user = True

    materialOutput = None
    for node in material.node_tree.nodes:
        if node.type == 'OUTPUT_MATERIAL':
            materialOutput = node
            break

    for node in material.node_tree.nodes:
        if node.type == 'BSDF_PRINCIPLED':
            material.node_tree.nodes.remove(node)
            break

    # Creates the emission shader node
    emissionNode = material.node_tree.nodes.new(type = "ShaderNodeEmission")
    emissionNode.location = (100,300)
    material.node_tree.links.new(emissionNode.outputs[0], materialOutput.inputs[0])

    # Creates the color ramp node
    colorRampNode = material.node_tree.nodes.new(type = "ShaderNodeValToRGB")
    colorRampNode.location = (-250,300)
    material.node_tree.links.new(colorRampNode.outputs[0], emissionNode.inputs[0])
    colorRampNode.color_ramp.interpolation = 'CONSTANT'
    colorRampNode.color_ramp.elements.remove(colorRampNode.color_ramp.elements[1])
    colorRampNode.color_ramp.elements.new(0.075)
    colorRampNode.color_ramp.elements.new(0.225)
    colorRampNode.color_ramp.elements.new(0.450)
    colorRampNode.color_ramp.elements.new(0.800)
    colorRampNode.color_ramp.elements[0].color = [0.191202, 0.033105, 0.063010, 1.000000]
    colorRampNode.color_ramp.elements[1].color = [0.337164, 0.063010, 0.045186, 1.000000]
    colorRampNode.color_ramp.elements[2].color = [0.603828, 0.138432, 0.049707, 1.000000]
    colorRampNode.color_ramp.elements[3].color = [0.783538, 0.274677, 0.078187, 1.000000]
    colorRampNode.color_ramp.elements[4].color = [0.955974, 0.473532, 0.090842, 1.000000]

    # Creates the mixRGB soft light node
    mixSoftLightNode = material.node_tree.nodes.new(type = "ShaderNodeMixRGB")
    mixSoftLightNode.location = (-500, 138)
    mixSoftLightNode.blend_type = 'SOFT_LIGHT'
    mixSoftLightNode.inputs[0].default_value = 0.2
    material.node_tree.links.new(mixSoftLightNode.outputs[0], colorRampNode.inputs[0])

    # Creates the shader to RGB node
    shaderToRgbNode = material.node_tree.nodes.new(type = "ShaderNodeShaderToRGB")
    shaderToRgbNode.location = (-750, 250)
    material.node_tree.links.new(shaderToRgbNode.outputs[0], mixSoftLightNode.inputs[1])

    # Creates the principled BSDF node
    bsdfNode = material.node_tree.nodes.new(type = "ShaderNodeBsdfPrincipled")
    bsdfNode.location = (-1100, 500)
    material.node_tree.links.new(bsdfNode.outputs[0], shaderToRgbNode.inputs[0])

    # Creates the bayer texture node
    bayerTexNode = material.node_tree.nodes.new(type = "ShaderNodeTexImage")
    bayerTexNode.location = (-850, -250)
    material.node_tree.links.new(bayerTexNode.outputs[0], mixSoftLightNode.inputs[2])
    bayerTexNode.image = bayerMatrix
    bayerTexNode.interpolation = 'Closest'

    # Creates the multiply node
    multiplyVector = material.node_tree.nodes.new(type = "ShaderNodeVectorMath")
    multiplyVector.location = (-1050, -450)
    multiplyVector.operation = 'MULTIPLY'
    material.node_tree.links.new(multiplyVector.outputs[0], bayerTexNode.inputs[0])

    # Creates the Texture Coordinate node
    texCoordNode = material.node_tree.nodes.new(type = "ShaderNodeTexCoord")
    texCoordNode.location = (-1250, -300)
    material.node_tree.links.new(texCoordNode.outputs[5], multiplyVector.inputs[0])

    # Creates the combineXYZ node
    combineXyzNode = material.node_tree.nodes.new(type = "ShaderNodeCombineXYZ")
    combineXyzNode.location = (-1250, -600)
    material.node_tree.links.new(combineXyzNode.outputs[0], multiplyVector.inputs[1])

    # Creates the Resolution nodes
    resolutionXNode = material.node_tree.nodes.new(type = "ShaderNodeValue")
    resolutionXNode.location = (-1450, -600)
    resolutionXNode.label = "ResolutionX / 2"
    material.node_tree.links.new(resolutionXNode.outputs[0], combineXyzNode.inputs[0])

    resolutionXDriver = resolutionXNode.outputs['Value'].driver_add("default_value")
    var1 = resolutionXDriver.driver.variables.new()
    var1.name = "resolutionX"
    var1.targets[0].id_type = 'SCENE'
    var1.targets[0].id = bpy.data.scenes["Scene"]
    var1.targets[0].data_path = "render.resolution_x"
    resolutionXDriver.driver.expression = "resolutionX / 2"

    resolutionYNode = material.node_tree.nodes.new(type = "ShaderNodeValue")
    resolutionYNode.location = (-1450, -700)
    resolutionYNode.label = "ResolutionY / 2"
    material.node_tree.links.new(resolutionYNode.outputs[0], combineXyzNode.inputs[1])

    resolutionYDriver = resolutionYNode.outputs['Value'].driver_add("default_value")
    var2 = resolutionYDriver.driver.variables.new()
    var2.name = "resolutionY"
    var2.targets[0].id_type = 'SCENE'
    var2.targets[0].id = bpy.data.scenes["Scene"]
    var2.targets[0].data_path = "render.resolution_y"
    resolutionYDriver.driver.expression = "resolutionY / 2"

    return material

def single_material_shine(self, context):
    single_material(context)

    mat = None

    for material in bpy.data.materials:
        if material.name == "PixelArt_Simple":
            mat = material

    if mat is None:
        self.report({'ERROR'}, "No PixelArt material found. This should not be possible... good luck")
        return
    
    nodes = mat.node_tree.nodes
    # Get pre-existing nodes
    material_output = nodes.get("Material Output")
    emission = nodes.get("Emission")
    color_ramp = nodes.get("Color Ramp")

    # Disconnect color ramp and emission nodes
    link = color_ramp.outputs[0].links[0]
    color_ramp.id_data.links.remove(link)

    # Move material output and emission nodes
    material_output.location = (785, 340)
    emission.location = (590, 320)

    # Create new nodes
    shine_group = nodes.new(type="ShaderNodeGroup")
    shine_group.node_tree = bpy.data.node_groups["Shine Reflection"]
    shine_group.location = (-105, 30)

    # Value nodes for rotation and scale of shine group
    value_rot = nodes.new(type="ShaderNodeValue")
    value_rot.location = (-315, -100)
    value_rot.label = "Shine Rotation"
    value_rot.outputs[0].default_value = 2.5

    value_scale = nodes.new(type="ShaderNodeValue")
    value_scale.location = (-315, -190)
    value_scale.label = "Shine Scale"
    value_scale.outputs[0].default_value = 1

    # Create color mixing node and set correct settings before use
    mix_node = nodes.new(type="ShaderNodeMixRGB")
    mix_node.location = (360, 235)
    mix_node.blend_type = 'MIX'
    mix_node.inputs[2].default_value = [1, 1, 1, 1]

    # Connect nodes
    links = mat.node_tree.links

    links.new(value_rot.outputs[0], shine_group.inputs['Rotation'])
    links.new(value_scale.outputs[0], shine_group.inputs['Scale'])
    links.new(shine_group.outputs[0], mix_node.inputs[0])
    links.new(color_ramp.outputs['Color'], mix_node.inputs['Color1'])
    links.new(mix_node.outputs[0], emission.inputs['Color'])

########## Creates Multiple Lights Default Material ##########
def multiple_material(context):
    bayerMatrix = get_bayer()

    # Creates a material with the name if it doesn't exist already
    for material in bpy.data.materials:
        if material.name == "PixelArt_MultipleLights":
            bpy.data.materials.remove(material)
        
    material = bpy.data.materials.new(name = "PixelArt_MultipleLights")

    material.use_nodes = True
    material.use_fake_user = True

    materialOutput = None
    for node in material.node_tree.nodes:
        if node.type == 'OUTPUT_MATERIAL':
            materialOutput = node
            break

    for node in material.node_tree.nodes:
        if node.type == 'BSDF_PRINCIPLED':
            material.node_tree.nodes.remove(node)
            break

    # Creates a group for the dithering part
    for group in bpy.data.node_groups:
        if group.name == 'Dithering':
            bpy.data.node_groups.remove(group)

    ditherGroup = bpy.data.node_groups.new('Dithering', 'ShaderNodeTree')
    ditherGroup.interface.new_socket("Color", in_out='OUTPUT', socket_type="NodeSocketColor")

    outputNode = ditherGroup.nodes.new("NodeGroupOutput")
    outputNode.location = (0, 0)

    # Creates the bayer texture node
    bayerTexNode = ditherGroup.nodes.new(type = "ShaderNodeTexImage")
    bayerTexNode.location = (-300, 0)
    ditherGroup.links.new(bayerTexNode.outputs[0], outputNode.inputs[0])
    bayerTexNode.image = bayerMatrix
    bayerTexNode.interpolation = 'Closest'

    # Creates the multiply node
    multiplyVector = ditherGroup.nodes.new(type = "ShaderNodeVectorMath")
    multiplyVector.location = (-500, -210)
    multiplyVector.operation = 'MULTIPLY'
    ditherGroup.links.new(multiplyVector.outputs[0], bayerTexNode.inputs[0])

    # Creates the Texture Coordinate node
    texCoordNode = ditherGroup.nodes.new(type = "ShaderNodeTexCoord")
    texCoordNode.location = (-700, -100)
    ditherGroup.links.new(texCoordNode.outputs[5], multiplyVector.inputs[0])

    # Creates the combineXYZ node
    combineXyzNode = ditherGroup.nodes.new(type = "ShaderNodeCombineXYZ")
    combineXyzNode.location = (-700, -400)
    ditherGroup.links.new(combineXyzNode.outputs[0], multiplyVector.inputs[1])

    # Creates the Resolution nodes
    resolutionXNode = ditherGroup.nodes.new(type = "ShaderNodeValue")
    resolutionXNode.location = (-900, -400)
    resolutionXNode.label = "ResolutionX / 2"
    ditherGroup.links.new(resolutionXNode.outputs[0], combineXyzNode.inputs[0])

    resolutionXDriver = resolutionXNode.outputs['Value'].driver_add("default_value")
    var1 = resolutionXDriver.driver.variables.new()
    var1.name = "resolutionX"
    var1.targets[0].id_type = 'SCENE'
    var1.targets[0].id = bpy.data.scenes["Scene"]
    var1.targets[0].data_path = "render.resolution_x"
    resolutionXDriver.driver.expression = "resolutionX / 2"

    resolutionYNode = ditherGroup.nodes.new(type = "ShaderNodeValue")
    resolutionYNode.location = (-900, -500)
    resolutionYNode.label = "ResolutionY / 2"
    ditherGroup.links.new(resolutionYNode.outputs[0], combineXyzNode.inputs[1])

    resolutionYDriver = resolutionYNode.outputs['Value'].driver_add("default_value")
    var2 = resolutionYDriver.driver.variables.new()
    var2.name = "resolutionY"
    var2.targets[0].id_type = 'SCENE'
    var2.targets[0].id = bpy.data.scenes["Scene"]
    var2.targets[0].data_path = "render.resolution_y"
    resolutionYDriver.driver.expression = "resolutionY / 2"

    # Creates the two mix RGB
    emissionOutputNode = material.node_tree.nodes.new(type = "ShaderNodeEmission")
    emissionOutputNode.location = (100, 300)
    material.node_tree.links.new(emissionOutputNode.outputs[0], materialOutput.inputs[0])

    mixShaderNode1 = material.node_tree.nodes.new(type = "ShaderNodeMixRGB")
    mixShaderNode1.location = (-150, 300)
    mixShaderNode1.blend_type = 'LIGHTEN'
    material.node_tree.links.new(mixShaderNode1.outputs[0], emissionOutputNode.inputs[0])

    mixShaderNode2 = material.node_tree.nodes.new(type = "ShaderNodeMixRGB")
    mixShaderNode2.location = (-400, 100)
    mixShaderNode2.blend_type = 'LIGHTEN'    
    material.node_tree.links.new(mixShaderNode2.outputs[0], mixShaderNode1.inputs[2])

    ### RED CHANNEL ###
    # Creates the color ramp node
    colorRampNode = material.node_tree.nodes.new(type = "ShaderNodeValToRGB")
    colorRampNode.location = (-850,600)
    material.node_tree.links.new(colorRampNode.outputs[0], mixShaderNode1.inputs[1])
    colorRampNode.color_ramp.interpolation = 'CONSTANT'
    colorRampNode.color_ramp.elements.remove(colorRampNode.color_ramp.elements[1])
    colorRampNode.color_ramp.elements.new(0.01)
    colorRampNode.color_ramp.elements.new(0.075)
    colorRampNode.color_ramp.elements.new(0.225)
    colorRampNode.color_ramp.elements.new(0.450)
    colorRampNode.color_ramp.elements.new(0.800)

    colorRampNode.color_ramp.elements[0].color = [0, 0, 0, 1.000000]
    colorRampNode.color_ramp.elements[1].color = [0.191202, 0.033105, 0.063010, 1.000000]
    colorRampNode.color_ramp.elements[2].color = [0.337164, 0.063010, 0.045186, 1.000000]
    colorRampNode.color_ramp.elements[3].color = [0.603828, 0.138432, 0.049707, 1.000000]
    colorRampNode.color_ramp.elements[4].color = [0.783538, 0.274677, 0.078187, 1.000000]
    colorRampNode.color_ramp.elements[5].color = [0.955974, 0.473532, 0.090842, 1.000000]

    # Creates the mixRGB soft light node
    mixSoftLightNode = material.node_tree.nodes.new(type = "ShaderNodeMixRGB")
    mixSoftLightNode.location = (-1100, 600)
    mixSoftLightNode.blend_type = 'SOFT_LIGHT'
    mixSoftLightNode.inputs[0].default_value = 0.2
    material.node_tree.links.new(mixSoftLightNode.outputs[0], colorRampNode.inputs[0])

    # Adds the dithering node group to the tree
    ditherGroupNode = material.node_tree.nodes.new("ShaderNodeGroup")
    ditherGroupNode.node_tree = ditherGroup
    ditherGroupNode.location = (-1300, 600)
    material.node_tree.links.new(ditherGroupNode.outputs[0], mixSoftLightNode.inputs[2])

    ### GREEN CHANNEL ###
    # Creates the color ramp node
    colorRampNodeG = material.node_tree.nodes.new(type = "ShaderNodeValToRGB")
    colorRampNodeG.location = (-850,200)
    material.node_tree.links.new(colorRampNodeG.outputs[0], mixShaderNode2.inputs[1])
    colorRampNodeG.color_ramp.interpolation = 'CONSTANT'
    colorRampNodeG.color_ramp.elements.remove(colorRampNodeG.color_ramp.elements[1])
    colorRampNodeG.color_ramp.elements.new(0.01)
    colorRampNodeG.color_ramp.elements.new(0.075)
    colorRampNodeG.color_ramp.elements.new(0.225)
    colorRampNodeG.color_ramp.elements.new(0.450)
    colorRampNodeG.color_ramp.elements.new(0.800)

    colorRampNodeG.color_ramp.elements[0].color = [0, 0, 0, 1.000000]
    colorRampNodeG.color_ramp.elements[1].color = [0.011612, 0.102242, 0.074214, 1.000000]
    colorRampNodeG.color_ramp.elements[2].color = [0.011612, 0.102242, 0.074214, 1.000000]
    colorRampNodeG.color_ramp.elements[3].color = [0.016807, 0.496933, 0.168269, 1.000000]
    colorRampNodeG.color_ramp.elements[4].color = [0.278894, 0.701102, 0.141263, 1.000000]
    colorRampNodeG.color_ramp.elements[5].color = [0.603828, 0.730461, 0.149960, 1.000000]

    # Creates the mixRGB soft light node
    mixSoftLightNodeG = material.node_tree.nodes.new(type = "ShaderNodeMixRGB")
    mixSoftLightNodeG.location = (-1100, 200)
    mixSoftLightNodeG.blend_type = 'SOFT_LIGHT'
    mixSoftLightNodeG.inputs[0].default_value = 0.2
    material.node_tree.links.new(mixSoftLightNodeG.outputs[0], colorRampNodeG.inputs[0])

    # Adds the dithering node group to the tree
    ditherGroupNodeG = material.node_tree.nodes.new("ShaderNodeGroup")
    ditherGroupNodeG.node_tree = ditherGroup
    ditherGroupNodeG.location = (-1300, 200)
    material.node_tree.links.new(ditherGroupNodeG.outputs[0], mixSoftLightNodeG.inputs[2])

    ### BLUE CHANNEL ###
    # Creates the color ramp node
    colorRampNodeB = material.node_tree.nodes.new(type = "ShaderNodeValToRGB")
    colorRampNodeB.location = (-850,-100)
    material.node_tree.links.new(colorRampNodeB.outputs[0], mixShaderNode2.inputs[2])
    colorRampNodeB.color_ramp.interpolation = 'CONSTANT'
    colorRampNodeB.color_ramp.elements.remove(colorRampNodeB.color_ramp.elements[1])
    colorRampNodeB.color_ramp.elements.new(0.01)
    colorRampNodeB.color_ramp.elements.new(0.075)
    colorRampNodeB.color_ramp.elements.new(0.225)
    colorRampNodeB.color_ramp.elements.new(0.450)
    colorRampNodeB.color_ramp.elements.new(0.800)

    colorRampNodeB.color_ramp.elements[0].color = [0, 0, 0, 1.000000]
    colorRampNodeB.color_ramp.elements[1].color = [0.035601, 0.036889, 0.088656, 1.000000]
    colorRampNodeB.color_ramp.elements[2].color = [0.068478, 0.070360, 0.181164, 1.000000]
    colorRampNodeB.color_ramp.elements[3].color = [0.076185, 0.130137, 0.450786, 1.000000]
    colorRampNodeB.color_ramp.elements[4].color = [0.076185, 0.323143, 0.783538, 1.000000]
    colorRampNodeB.color_ramp.elements[5].color = [0.270498, 0.644480, 1.000000, 1.000000]

    # Creates the mixRGB soft light node
    mixSoftLightNodeB = material.node_tree.nodes.new(type = "ShaderNodeMixRGB")
    mixSoftLightNodeB.location = (-1100, -100)
    mixSoftLightNodeB.blend_type = 'SOFT_LIGHT'
    mixSoftLightNodeB.inputs[0].default_value = 0.2
    material.node_tree.links.new(mixSoftLightNodeB.outputs[0], colorRampNodeB.inputs[0])

    # Adds the dithering node group to the tree
    ditherGroupNodeB = material.node_tree.nodes.new("ShaderNodeGroup")
    ditherGroupNodeB.node_tree = ditherGroup
    ditherGroupNodeB.location = (-1300, -100)
    material.node_tree.links.new(ditherGroupNodeB.outputs[0], mixSoftLightNodeB.inputs[2])

    # Creates the shader to RGB node
    shaderToRgbNode = material.node_tree.nodes.new(type = "ShaderNodeShaderToRGB")
    shaderToRgbNode.location = (-2200, 0)

    # Creates the separate color node
    separateColorNode = material.node_tree.nodes.new(type = "ShaderNodeSeparateColor")
    separateColorNode.location = (-2000, 0)
    material.node_tree.links.new(shaderToRgbNode.outputs[0], separateColorNode.inputs[0])
    material.node_tree.links.new(separateColorNode.outputs[0], mixSoftLightNode.inputs[1])
    material.node_tree.links.new(separateColorNode.outputs[1], mixSoftLightNodeG.inputs[1])
    material.node_tree.links.new(separateColorNode.outputs[2], mixSoftLightNodeB.inputs[1])

    # Creates the principled BSDF node
    bsdfNode = material.node_tree.nodes.new(type = "ShaderNodeBsdfPrincipled")
    bsdfNode.location = (-2500, 0)
    material.node_tree.links.new(bsdfNode.outputs[0], shaderToRgbNode.inputs[0])

def multiple_material_shine(self, context):
    multiple_material(context)

    mat = None

    for material in bpy.data.materials:
        if material.name == "PixelArt_MultipleLights":
            mat = material

    if mat is None:
        self.report({'ERROR'}, "No PixelArt material found. This should not be possible...")
        return
    
    nodes = mat.node_tree.nodes
    # Get pre-existing nodes
    material_output = nodes.get("Material Output")
    emission = nodes.get("Emission")
    # Could either be Mix (Legacy) or Mix (Legacy).003
    legacy_mix = nodes.get("Mix (Legacy)")

    # Disconnect mix legacy (lighten) and emission nodes
    link = legacy_mix.outputs[0].links[0]
    legacy_mix.id_data.links.remove(link)

    # Move material output and emission nodes
    material_output.location = (890, 330)
    emission.location = (690, 330)

    # Create new nodes
    shine_group = nodes.new(type="ShaderNodeGroup")
    shine_group.node_tree = bpy.data.node_groups["Shine Reflection"]
    shine_group.location = (-45, 95)

    # Value nodes for rotation and scale of shine group
    value_rot = nodes.new(type="ShaderNodeValue")
    value_rot.location = (-235, -35)
    value_rot.label = "Shine Rotation"
    value_rot.outputs[0].default_value = 2.5

    value_scale = nodes.new(type="ShaderNodeValue")
    value_scale.location = (-235, -125)
    value_scale.label = "Shine Scale"
    value_scale.outputs[0].default_value = 1

    # Create color mixing node and set correct settings before use
    mix_node = nodes.new(type="ShaderNodeMixRGB")
    mix_node.location = (460, 295)
    mix_node.blend_type = 'MIX'
    mix_node.inputs[2].default_value = [1, 1, 1, 1]

    # Connect nodes
    links = mat.node_tree.links

    links.new(value_rot.outputs[0], shine_group.inputs['Rotation'])
    links.new(value_scale.outputs[0], shine_group.inputs['Scale'])
    links.new(shine_group.outputs[0], mix_node.inputs[0])
    links.new(legacy_mix.outputs['Color'], mix_node.inputs['Color1'])
    links.new(mix_node.outputs[0], emission.inputs['Color'])

########## Creates Tri Lights Setup ##########
def lights_setup(context):
    
    # Deletes previous light sources with the same name
    for obj in bpy.data.objects:
        if obj.name.startswith("PixelArt_Light_"):
            bpy.data.objects.remove(obj, do_unlink = True)

    for light in bpy.data.lights:
        if light.name.startswith("PixelArt_Light_"):
            bpy.data.lights.remove(light, do_unlink = True)

    # Creates the red light
    lightR = bpy.data.lights.new(name = "PixelArt_Light_R", type = 'POINT')
    lightR.color = (1,0,0)
    lightR.energy = 250
    lightR_object = bpy.data.objects.new(name = "PixelArt_Light_R", object_data = lightR)
    bpy.context.collection.objects.link(lightR_object)
    lightR_object.location = (3.46, -0.41, 1.04)

    # Creates the green light
    lightG = bpy.data.lights.new(name = "PixelArt_Light_G", type = 'POINT')
    lightG.color = (0,1,0)
    lightG.energy = 250
    lightG_object = bpy.data.objects.new(name = "PixelArt_Light_G", object_data = lightG)
    bpy.context.collection.objects.link(lightG_object)
    lightG_object.location = (-2.1, 2, 1.37)

    # Creates the blue light
    lightB = bpy.data.lights.new(name = "PixelArt_Light_B", type = 'POINT')
    lightB.color = (0,0,1)
    lightB.energy = 150
    lightB_object = bpy.data.objects.new(name = "PixelArt_Light_B", object_data = lightB)
    bpy.context.collection.objects.link(lightB_object)
    lightB_object.location = (-0.06, -1.46, 2.18)

    # Removes world light
    bpy.data.worlds["World"].node_tree.nodes["Background"].inputs[1].default_value = 0

def create_emitter():
    # I did this instead of using the regular plane creation function out of stupidity
    verts = [(-2, -2, 0), (-2, 2, 0), (2, 2, 0), (2, -2, 0)]
    faces = [(0, 1, 2, 3)]
    
    mesh = bpy.data.meshes.new("Emitter (Won't render)")
    emitter = bpy.data.objects.new("Emitter (Won't render)", mesh)
    bpy.context.collection.objects.link(emitter)

    mesh.from_pydata(verts,[],faces)

    # Create particle system and cache particle settings
    emitter.modifiers.new("ParticleSystem", type='PARTICLE_SYSTEM')
    ps = emitter.particle_systems[0]
    pss = ps.settings

    # Set up particle system settings
    pss.lifetime = 60
    pss.lifetime_random = 0.5
    pss.object_align_factor = (0, 0, 10)
    pss.effector_weights.gravity = 0
    pss.render_type = 'OBJECT'
    pss.particle_size = 1
    pss.use_scale_instance = True
    pss.size_random = 1

    emitter.show_instancer_for_render = False

    # Create new texture and set up basic settings for gradient
    size_texture = bpy.data.textures.new("Smoke Size Texture", type='BLEND')
    size_texture.progression = 'QUADRATIC'
    size_texture.use_color_ramp = True
    size_texture.color_ramp.interpolation = 'EASE'

    # Set up color ramp values
    ramp = size_texture.color_ramp
    ramp.elements.new(0.03)
    ramp.elements.new(0.565)
    ramp.elements[0].color = [1, 1, 1, 1]
    ramp.elements[1].color = [0, 0, 0, 1]
    ramp.elements[2].color = [0, 0, 0, 1]
    ramp.elements[3].color = [1, 1, 1, 1]

    # Add texture slot under particle system and set to new texture
    texture_slot = pss.texture_slots.add()
    texture_slot.texture = size_texture

    # Set up particle system texture usage settings
    texture_slot.use_map_time = False
    texture_slot.use_map_size = True
    texture_slot.size_factor = -1.0
    texture_slot.texture_coords = 'STRAND'
    # This is the default blend type when you create a texture by hand, but not when you create in code????
    texture_slot.blend_type = 'MULTIPLY'

    return pss

def create_particle():
    mat = None

    for material in bpy.data.materials:
        if material.name == "PixelSmoke_material":
            mat = material

    if mat is None:
        mat = single_material(bpy.context, "PixelSmoke_material")

        color_ramp_node = mat.node_tree.nodes.get("Color Ramp")
        mix_node = mat.node_tree.nodes.get("Mix (Legacy)")

        # Set dither fac
        mix_node.inputs[0].default_value = 1

        # Remove last two elements
        for i in range(2):
            color_ramp_node.color_ramp.elements.remove(color_ramp_node.color_ramp.elements[len(color_ramp_node.color_ramp.elements) - 1])
        
        # Set new colors
        color_ramp_node.color_ramp.elements[0].color = [0.14, 0.15, 0.175, 1.000000]
        color_ramp_node.color_ramp.elements[1].color = [0.266, 0.301, 0.283, 1.000000]
        color_ramp_node.color_ramp.elements[2].color = [0.6, 0.52, 0.52, 1.000000]

        # Set correct positions
        color_ramp_node.color_ramp.elements[1].position = 0.255
        color_ramp_node.color_ramp.elements[2].position = 0.795

    # Create actual particle
    particle = bpy.ops.object.metaball_add(type='BALL')
    particle = bpy.context.active_object
    # Set material to the particle
    bpy.ops.object.material_slot_add()
    particle.material_slots[0].material = mat

    return particle

def create_smoke():
    emitter = create_emitter()

    emitter.instance_object = create_particle()