// 内容由 scripts/sync.mjs（经 scripts/llms.mjs）在构建前生成到 src/generated/，这里只负责输出。
// 不在端点里直接读 skills/：端点会被打包到 dist/.prerender，打包后 import.meta.url 相对路径失效。
import body from '../generated/llms.txt?raw';

export const GET = () => new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
