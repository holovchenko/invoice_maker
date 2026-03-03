import { kv } from "@vercel/kv";

export async function kvGet<T>(key: string): Promise<T | null> {
  return kv.get<T>(key);
}

export async function kvSet<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
  const options = ttlSeconds ? { ex: ttlSeconds } : {};
  await kv.set(key, value, options);
}

export async function kvDel(key: string): Promise<void> {
  await kv.del(key);
}

export async function kvIncr(key: string): Promise<number> {
  return kv.incr(key);
}
