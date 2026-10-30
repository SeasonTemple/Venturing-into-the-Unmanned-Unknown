// Preserve multiline prompts as one argv item on Windows; .cmd wrappers can
// terminate a command at embedded newlines and silently discard later flags.
import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
const [promptPath, ...flags] = process.argv.slice(2);
if (!promptPath) throw new Error('usage: node scripts/mmx-file-prompt.mjs prompt.txt [image generate flags]');
const prompt=readFileSync(promptPath,'utf8').trim();
if (prompt.length>=1500) throw new Error(`Image prompt must be shorter than 1500 characters (received ${prompt.length}); no request submitted.`);
const cli = 'E:/DevCache/npm-global/node_modules/mmx-cli/dist/mmx.mjs';
const child = spawn(process.execPath, [cli, 'image', 'generate', '--prompt', prompt, ...flags], {
  stdio:'inherit', shell:false, windowsHide:true,
});
child.on('error', error => {console.error(error.message);process.exitCode=1;});
child.on('exit', code => {process.exitCode=code ?? 1;});
