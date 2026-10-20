// 构建时取最近一次 Release 的真实资产名与体积。取不到（离线、限流、尚无 Release）就返回 null，页面回落到「以 Releases 页为准」，绝不编造。
export interface ReleaseAsset {
  name: string;
  size: number;
  url: string;
}
export interface LatestRelease {
  tag: string;
  date: string;
  assets: ReleaseAsset[];
}

let cached: Promise<LatestRelease | null> | undefined;

export function getLatestRelease(githubUrl: string): Promise<LatestRelease | null> {
  cached ??= load(githubUrl);
  return cached;
}

async function load(githubUrl: string): Promise<LatestRelease | null> {
  const repo = githubUrl.replace(/^https:\/\/github\.com\//, '').replace(/\/+$/, '');
  try {
    const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
    const token = process.env.GITHUB_TOKEN;
    if (token) headers.Authorization = 'Bearer ' + token;
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const j = await res.json();
    const assets: ReleaseAsset[] = (j.assets ?? []).map((a: any) => ({ name: String(a.name), size: Number(a.size), url: String(a.browser_download_url) }));
    if (!j.tag_name || assets.length === 0) return null;
    return { tag: String(j.tag_name), date: String(j.published_at ?? '').slice(0, 10), assets };
  } catch {
    return null;
  }
}

export function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? (bytes / 1024).toFixed(1) + ' KB' : (bytes / 1024 / 1024).toFixed(2) + ' MB';
}
