/**
 * UI 注册式插槽机制
 * -------------------
 * 解决旧版「跨模块布局融合靠绝对定位」的痛点：
 * 任何模块都可以把展示组件【注册】到某个具名插槽（Slot），
 * 界面只负责渲染插槽，组件来源完全解耦。
 *
 * 例：多个模块都要展示库存列表，那么 StoresPanel 组件被注册到
 * 各个模块自己的面板插槽里，而不是像旧版那样把 #storesContainer
 * 用 top/right 定位挪来挪去。
 */
import { create } from 'zustand';

export const useUI = create(() => ({
  slots: {}, // { slotName: [{ id, Comp }] }
}));

/** 注册一个组件到指定插槽。slotName 用模块名做命名空间，如 'room/stores' */
export function registerSlot(slotName, id, Comp) {
  useUI.setState((s) => {
    const list = (s.slots[slotName] || []).slice();
    if (!list.some((x) => x.id === id)) {
      list.push({ id, Comp });
    }
    return { slots: { ...s.slots, [slotName]: list } };
  });
}

/** React 组件：渲染某插槽下所有已注册的组件 */
export function Slot({ name, ...rest }) {
  const items = useUI((s) => s.slots[name]);
  if (!items || items.length === 0) return null;
  return (
    <>
      {items.map(({ id, Comp }) => (
        <Comp key={id} {...rest} />
      ))}
    </>
  );
}

/** 逻辑层主动请求某个插槽的组件元数据（一般用不到，React 端用 Slot 渲染） */
export function getSlots(name) {
  return useUI.getState().slots[name] || [];
}
