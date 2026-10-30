# AGY MCP 生图探测返回

以下是 agy 对内部工具调用的报告；外部已另行核实输出文件存在并可解码。后端图像模型未暴露，不能将结果标记为 Nano Banana 2。

I have launched the [`image-generator`](conversation://71635022-a03f-4531-bcf3-0c6efd87123f) subagent once (`Model: "inherit"`) to inspect its native image tool and execute the single reference-based edit test. Waiting for its completion message.
### Image Capability Probe Results

The [`image-generator`](conversation://71635022-a03f-4531-bcf3-0c6efd87123f) subagent completed the probe using its native image tool.

1. **Actual Image Tool Name & Schema (inside `image-generator` subagent):**
   * **Tool Name:** `generate_image` (`default_api:generate_image`)
   * **Description:** *"Generate an image, or edit existing images, from a text prompt."*
   * **Parameter Schema:**
     ```json
     {
       "type": "OBJECT",
       "required": ["Prompt", "ImageName"],
       "properties": {
         "AspectRatio": {
           "type": "STRING",
           "enum": ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9"],
           "description": "Defaults to 1:1."
         },
         "ImageName": {
           "type": "STRING",
           "description": "Short descriptive name for the saved file."
         },
         "ImagePaths": {
           "type": "ARRAY",
           "items": { "type": "STRING" },
           "description": "Images to edit, combine, or use as references."
         },
         "Prompt": {
           "type": "STRING",
           "description": "What the image should depict, or how to edit the given images."
         }
       }
     }
     ```

2. **Model Selector / Image Backend Identity:**
   * **Status:** `not exposed`
   * Neither the tool schema nor the tool response exposes an image backend identifier or model selector parameter. Explicit selection of **Nano Banana 2** is not available in the tool interface.

3. **Source Reference Image Supplied:**
   * **Yes:** [first-frame.png](file:///E:/theorylab/Venturing-into-the-Unmanned-Unknown/prototypes/visual-direction/pixel-loaded-keyposes-v01/candidates/first-frame-step01/first-frame.png) was passed directly in the `ImagePaths` array parameter (`["E:/theorylab/Venturing-into-the-Unmanned-Unknown/prototypes/visual-direction/pixel-loaded-keyposes-v01/candidates/first-frame-step01/first-frame.png"]`) with `AspectRatio: "3:4"`.

4. **Image Generation Calls Executed:**
   * **1** (`invoke_subagent` called once; `generate_image` called once inside the subagent).

5. **Actual Saved Output Path:**
   * `generate_image` only accepts an `ImageName` stem and writes directly to the conversation artifact directory rather than an arbitrary target path.
   * **Native Output File:** [reference_edit01_1793339969094.jpg](file:///~/.gemini/antigravity-cli/brain/7831a4d0-3e30-4e03-b34e-aa857109cf35/reference_edit01_1793339969094.jpg) (`~/.gemini\antigravity-cli\brain\7831a4d0-3e30-4e03-b34e-aa857109cf35\reference_edit01_1793339969094.jpg`)

