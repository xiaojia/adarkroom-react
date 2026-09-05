/**
 * Panel — 统一外层容器
 * --------------------
 * 各面板（村庄工作/建筑、出装/装备、仙舟图纸、商店库存等）共用的
 * "暖木像素面板 + 顶部标题铭牌" 外壳。
 *
 * 只统一『外层容器』（方框、圆角、木质底、衬线、标题牌），内部各行
 * 仍由各自组件自己的 CSS 控制（workerRow / outfitRow / storeRow / perkRow / blueprintRow…）。
 *
 * props：
 *   - title: 标题文本，会渲染为顶部铭牌（data-title）。不传则无铭牌。
 *   - legend: 附加说明，拼在铭牌后（data-legend）。
 *   - id / className: 透传给最外层 div（保留唯一 id 供各自行样式/功能定位）。
 *   - children.
 */
export default function Panel({ title, legend, id, className, children }) {
  const attrs = {};
  if (id) attrs.id = id;
  if (title) attrs['data-title'] = title;
  if (legend) attrs['data-legend'] = legend;

  return (
    <div {...attrs} className={'panel' + (className ? ' ' + className : '')}>
      {children}
    </div>
  );
}
