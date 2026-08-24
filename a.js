import { Redis } from '@upstash/redis';

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

async function run() {
  const all = await kv.hgetall('likes:counts');
  if (!all) return;
  for (const [k, v] of Object.entries(all)) {
    if (/^\d+$/.test(k)) {
      await kv.hset('likes:counts', { [`shuoshuo:${k}`]: v });
      await kv.hdel('likes:counts', k);
    }
  }
  console.log('ok');
}
run();
