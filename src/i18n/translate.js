/**
 * 移植自 lib/translate.js 的翻译函数 _()
 */
let translation = null;

const defaultFormatter = (function () {
  var re = /\{([^}]+)\}/g;
  return function (s, args) {
    return s.replace(re, function (_, match) {
      return typeof args[match] !== 'undefined' ? args[match] : '{' + match + '}';
    });
  };
})();
let formatter = defaultFormatter;

export function setFormatter(newFormatter) {
  formatter = newFormatter;
}

export function setTranslation(newTranslation) {
  translation = newTranslation;
}

function lookup(target) {
  if (!translation || !(target in translation)) return null;
  return translation[target];
}

/** 语言包里标题/地名 key 存在三种写法：普通空格 / \u00a0 / &nbsp;，统一按“空格规范形”查找 */
function translateLookup(target) {
  if (translation == null || target == null) return target;
  const spaceForm = target.replace(/\u00a0/g, ' ').replace(/&nbsp;/g, ' ');
  const forms = [target, spaceForm];
  if (spaceForm !== target) {
    forms.push(spaceForm.split(' ').join('\u00a0'), spaceForm.split(' ').join('&nbsp;'));
  }
  for (const form of forms) {
    const hit = lookup(form);
    if (hit != null) return hit == null ? target : hit;
  }
  return target;
}

export function _(text, ...args) {
  let xlate = translateLookup(text);
  if (typeof xlate === 'function') {
    xlate = xlate.apply(null, args);
  } else if (args.length > 0) {
    xlate = formatter(xlate, args);
  }
  return xlate;
}

// 兼容翻译文件里直接调用 _（作为全局函数）
export default _;
