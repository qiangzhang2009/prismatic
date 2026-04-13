/**
 * IP Geolocation utilities
 * Uses ip-api.com (free, no API key required, supports Chinese IPs)
 */

export interface GeoResult {
  countryCode: string;   // e.g. "CN", "HK", "TW", "MO"
  country: string;       // formatted display name, e.g. "中国香港"
  region: string;        // e.g. "北京市"
  city: string;          // e.g. "朝阳区"
}

// Country code -> formatted display name
const COUNTRY_NAMES: Record<string, string> = {
  CN: '中国',
  HK: '中国香港',
  TW: '中国台湾',
  MO: '中国澳门',
  US: '美国',
  JP: '日本',
  KR: '韩國',
  GB: '英國',
  DE: '德國',
  FR: '法國',
  SG: '新加坡',
  AU: '澳大利亞',
  CA: '加拿大',
  MY: '馬來西亞',
  TH: '泰國',
  VN: '越南',
  PH: '菲侓賓',
  ID: '印度尼西亞',
  IN: '印度',
  RU: '俄羅斯',
  UK: '英國',
  NL: '荷蘭',
  CH: '瑞士',
  SE: '瑞典',
  NO: '挪威',
  DK: '丹麥',
  FI: '芬蘭',
  PL: '波蘭',
  BR: '巴西',
  MX: '墨西哥',
  SA: '沙烏地阿拉伯',
  AE: '阿聯酋',
  ZA: '南非',
  NZ: '新西蘭',
  IE: '愛爾蘭',
  IT: '意大利',
  ES: '西班牙',
  PT: '葡萄牙',
  BE: '比利時',
  AT: '奧地利',
  TR: '土耳其',
  UA: '烏克蘭',
  KZ: '哈薩克斯坦',
  PK: '巴基斯坦',
  BD: '孟加拉國',
  EG: '埃及',
  NG: '奈及利亞',
  KE: '肯尼亞',
  AR: '阿根廷',
  CL: '智利',
  CO: '哥倫比亞',
  PE: '秘魯',
  CZ: '捷克',
  HU: '匈牙利',
  RO: '羅馬尼亞',
  GR: '希臘',
  IL: '以色列',
  QA: '卡塔爾',
  KW: '科威特',
  BH: '巴林',
  OM: '阿曼',
  LK: '斯里蘭卡',
  NP: '尼泊爾',
  MM: '緬甸',
  KH: '柬埔寨',
  LA: '老撾',
  MN: '蒙古',
  BT: '不丹',
  BN: '文萊',
};

// Check if IP is private/reserved
function isPrivateIP(ip: string): boolean {
  if (!ip || ip === 'unknown') return true;
  if (ip.startsWith('127.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('172.')) {
    const second = parseInt(ip.split('.')[1], 10);
    return second >= 16 && second <= 31;
  }
  if (ip.startsWith('localhost')) return true;
  if (ip === '::1') return true;
  if (ip.startsWith('fe80:')) return true;
  return false;
}

/**
 * Look up geolocation for an IP address using ip-api.com
 */
export async function lookupIP(ip: string): Promise<GeoResult | null> {
  if (isPrivateIP(ip)) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,regionName,city`,
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();

    if (data.status !== 'success') return null;

    const code = data.countryCode || '';
    const displayCountry = COUNTRY_NAMES[code]
      || (data.country || code);

    return {
      countryCode: code,
      country: displayCountry,
      region: data.regionName || data.region || '',
      city: data.city || '',
    };
  } catch {
    return null;
  }
}

/**
 * Generate an avatar seed from IP hash + optional gender
 */
export function generateAvatarSeed(ip: string, gender?: string): string {
  const input = ip + (gender || '') + Date.now().toString(36) + Math.random().toString(36);
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  // Generate a longer, more random seed string to ensure DiceBear recognizes it
  const hex1 = Math.abs(hash).toString(16).padStart(8, '0');
  const hex2 = Math.abs(hash * 1664525 + 1013904223).toString(16).padStart(8, '0');
  return `${hex1}${hex2}${hex1.slice(0, 4)}`;
}

/**
 * Build DiceBear avatar URL
 */
export function getAvatarUrl(seed: string, gender?: string): string {
  const params = new URLSearchParams({
    seed,
    size: '64',
  });
  if (gender === 'male') {
    params.set('backgroundColor', 'b6e3f4,c0aede,d1d4f9');
  } else if (gender === 'female') {
    params.set('backgroundColor', 'ffd5dc,ffdfbf');
  } else {
    params.set('backgroundColor', 'b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf');
  }
  return `https://api.dicebear.com/7.x/avataaars/png?${params.toString()}`;
}
