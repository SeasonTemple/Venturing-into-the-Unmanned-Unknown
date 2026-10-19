import body from '../generated/llms-full.txt?raw';

export const GET = () => new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
