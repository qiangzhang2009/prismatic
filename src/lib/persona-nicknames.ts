/**
 * Prismatic — Persona Nicknames Registry
 *
 * Maps publicly-known short names / nicknames /大众俗称
 * to persona IDs, so users can @mention without knowing the full name.
 *
 * Examples:
 *   @济群     → jiqun         (@济群法师 works too, but casual users just say @济群)
 *   @乔布斯    → steve-jobs
 *   @马斯克    → elon-musk
 *   @巴菲特    → warren-buffett
 *   @费曼     → richard-feynman
 *   @孔子     → confucius
 *   @老子     → lao-zi
 *   @庄子     → zhuang-zi
 *   @苏格拉底  → socrates
 *   @奥勒留   → marcus-aurelius
 *   @芒格     → charlie-munger
 *   @塔勒布    → nassim-taleb
 *   @纳瓦尔    → naval-ravikant
 *   @马云     → jack-ma
 *   @一鸣     → zhang-yiming
 */

/** nickname → personaId */
export const PERSONA_NICKNAMES: Record<string, string> = {
  // 济群法师
  '济群':    'jiqun',
  '济群法师': 'jiqun',
  '法师':    'jiqun',

  // 乔布斯
  '乔布斯':  'steve-jobs',
  'Jobs':   'steve-jobs',

  // 马斯克
  '马斯克':  'elon-musk',
  'Musk':   'elon-musk',
  '埃隆马斯克': 'elon-musk',
  '埃隆':   'elon-musk',
  'Elon':   'elon-musk',
  'ElonMusk': 'elon-musk',

  // 巴菲特
  '巴菲特':  'warren-buffett',
  'Buffett': 'warren-buffett',

  // 费曼
  '费曼':    'richard-feynman',
  'Feynman': 'richard-feynman',

  // 孔子
  '孔子':    'confucius',

  // 老子
  '老子':    'lao-zi',

  // 庄子
  '庄子':    'zhuang-zi',

  // 苏格拉底
  '苏格拉底': 'socrates',
  '苏格拉底斯': 'socrates',

  // 马可·奥勒留
  '奥勒留':   'marcus-aurelius',
  '马可':     'marcus-aurelius',
  '奥勒留斯': 'marcus-aurelius',

  // 查理·芒格
  '芒格':    'charlie-munger',
  'Munger':  'charlie-munger',

  // 纳西姆·塔勒布
  '塔勒布':  'nassim-taleb',
  'Taleb':   'nassim-taleb',

  // 纳瓦尔·拉维坎特
  '纳瓦尔':  'naval-ravikant',
  'Naval':   'naval-ravikant',

  // 马云
  '马云':    'jack-ma',

  // 张一鸣
  '一鸣':    'zhang-yiming',
  '张一鸣':  'zhang-yiming',

  // 苏轼
  '苏轼':    'su-shi',
  '东坡':    'su-shi',
  '苏东坡':  'su-shi',

  // 鲁迅
  '鲁迅':    'lu-xun',

  // 刘备 (已在库中，但很多人只知道演义中的形象)
  '刘备':    'liu-bei',

  // 德鲁克
  '德鲁克':  'peter-drucker',
  ' Drucker': 'peter-drucker',
};

/**
 * Resolve a nickname or full name to a persona ID.
 * Returns null if not found.
 */
export function resolvePersonaByNickname(name: string): string | null {
  return PERSONA_NICKNAMES[name] ?? null;
}
