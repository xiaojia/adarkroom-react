/**
 * i18n 初始化：加载语言翻译数据。
 * 翻译数据位于 src/i18n/lang/<lang>/strings.js（从根项目 lang/ 同步进 React 内，
 * 使 react/ 目录完全自包含、不依赖仓库外部路径）。
 */
import _, { setTranslation } from './translate';

/** 支持的语言（en 为内建原文，无需语言文件；其余复用 lang/<code>/strings.js） */
export const SUPPORTED_LANGS = [
  { code: 'de', name: 'deutsch' },
  { code: 'en', name: 'english' },
  { code: 'es', name: 'español' },
  { code: 'fr', name: 'français' },
  { code: 'it', name: 'italiano' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'nb', name: 'norsk' },
  { code: 'pl', name: 'polski' },
  { code: 'pt', name: 'português' },
  { code: 'ru', name: 'русский' },
  { code: 'sv', name: 'svenska' },
  { code: 'tr', name: 'türkçe' },
  { code: 'uk', name: 'українська' },
  { code: 'vi', name: 'tiếng việt' },
  { code: 'zh_cn', name: '简体中文' },
];

const LANGS = SUPPORTED_LANGS.map((l) => l.code);

/** 语言代码对应的浏览器 region 别名（如 zh-CN / zh 归入 zh_cn） */
const LANG_REGION_MAP = { zh: 'zh_cn' };

function getLangFromUrl() {
  try {
    const m = new RegExp('[?|&]lang=' + '([^&;]+?)(&|#|;|$)').exec(location.search);
    if (m) return decodeURIComponent(m[1].replace(/\+/g, '%20'));
  } catch (e) {}
  try {
    if (localStorage.lang) return localStorage.lang;
  } catch (e) {}
  return null;
}

function browserLang() {
  try {
    const nav = String(navigator.language || 'en').toLowerCase().split('-')[0];
    return LANG_REGION_MAP[nav] || nav;
  } catch (e) {
    return 'en';
  }
}

export function detectLang() {
  const l = getLangFromUrl();
  if (l && LANGS.indexOf(l) !== -1) return l;
  // 无显式设置时：跟随浏览器语言（中文浏览器默认简体中文）
  const bl = browserLang();
  if (LANGS.indexOf(bl) !== -1) {
    if (bl !== 'en') saveLang(bl);
    return bl;
  }
  return 'en';
}

export function saveLang(lang) {
  try {
    localStorage.lang = lang;
  } catch (e) {}
}

/**
 * 加载语言包。返回 Promise。
 * 通过 ?raw 把 strings.js 作为文本引入，再注入 _ 执行，避免全局污染。
 */
export async function initI18n(lang) {
  if (!lang || lang === 'en') return;
  try {
    const mod = await import(`./lang/${lang}/strings.js?raw`);
    const code = mod.default;
    // 翻译文件形如：_.setTranslation({...}); —— _ 只是查找函数，需要把 API 挂上去
    const api = { setTranslation };
    const fn = new Function('_', code);
    fn(api);
  } catch (e) {
    console.error('failed to load language', lang, e);
  }
  // 暴露给逻辑层（模块代码里直接调用 _()）
  window._ = _;
  return _;
}

export { _ };
