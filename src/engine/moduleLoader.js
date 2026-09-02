/**
 * 延迟模块引用表
 * ------------------
 * 解决模块之间的循环依赖（Room↔Outside↔Path 互相调用）。
 * 各模块逻辑代码通过 requireModule(name) 获取其它模块对象，
 * 由 main.jsx 启动时用 bindModule(name, mod) 注入。
 */
const lazyModules = {};

export function bindModule(name, mod) {
  lazyModules[name] = mod;
}

export function requireModule(name) {
  return lazyModules[name];
}

export function getLazyModules() {
  return lazyModules;
}
