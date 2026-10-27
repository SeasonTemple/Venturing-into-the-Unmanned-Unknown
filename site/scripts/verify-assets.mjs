// A cached Markdown render must never point to a removed hashed code stylesheet.
import {readFile,readdir,access} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {BASE} from '../site.config.mjs';
const root=fileURLToPath(new URL('../dist/',import.meta.url)),missing=[],checked=new Set();
async function walk(folder){for(const item of await readdir(folder,{withFileTypes:true})){
 const file=resolve(folder,item.name);if(item.isDirectory()){await walk(file);continue;}
 if(!item.name.endsWith('.html'))continue;
 const html=await readFile(file,'utf8');
 for(const match of html.matchAll(/(?:href|src)="([^"]+)"/g)){
  const url=match[1];if(!url.startsWith(BASE+'/')||! /\.(css|js|mjs|webp|png|svg|woff2)(?:[?#]|$)/.test(url))continue;
  const path=resolve(root,decodeURIComponent(url.slice(BASE.length+1).split(/[?#]/)[0]));if(checked.has(path))continue;checked.add(path);
  try{await access(path);}catch{missing.push({page:relative(root,file),asset:url});}
 }
}}
await walk(root);
if(missing.length)throw Error('Missing built assets: '+JSON.stringify(missing));
console.log(`Asset references: ${checked.size} present; no missing styles, scripts or images.`);
