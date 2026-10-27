// Inputs are exported once from journal-assets.html using scripts/shot.mjs.
// The production reader shares these baked materials and does not initialize Three.js.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const sharp=createRequire(import.meta.url)('sharp');
const root=new URL('../public/journal/',import.meta.url);await mkdir(root,{recursive:true});
await sharp(fileURLToPath(new URL('../../.lab/reader-revision/relief-base-ready.png',import.meta.url))).webp({quality:88}).toFile(fileURLToPath(new URL('relief-base-v01.webp',root)));
await sharp(fileURLToPath(new URL('../../.lab/reader-revision/paper-base.png',import.meta.url))).resize(1200).webp({quality:85}).toFile(fileURLToPath(new URL('paper-base-v01.webp',root)));
await writeFile(new URL('sources.json',root),JSON.stringify({source:'Original approved procedural relief and tracing membrane',export:'prototypes/visual-direction/journal-assets.html',capture:'scripts/shot.mjs --batch prototypes/visual-direction/journal-assets-shots.json',relief:{size:[1920,1080],time:0,camera:'Orthographic (12,15.5,19)',route:'Chapter routes are semantic SVG overlays, not baked into the shared terrain'},paper:{size:[1200,900],time:0},purpose:'Shared static materials: no per-chapter modeling, shadow maps or full-screen transmission passes at runtime'},null,2)+'\n');
