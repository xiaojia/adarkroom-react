/**
 * 通知系统（逻辑层）
 * -------------------
 * 与旧版 Notifications 行为一致：
 *  - notify(module, text, noQueue)：若消息属于非当前模块且未标记 noQueue，
 *    则进入该模块的队列，等切换到该模块时一次性打印（printQueue）。
 *  - 消息附带像素图标（Pixel.notificationIcon 按关键词匹配）。
 *  - 超出可视区域的消息会被清理（clearHidden）。
 */
import { create } from 'zustand';
import { Pixel } from '../modules/pixel';
import { Engine } from './Engine';
import { _ } from '../i18n';

export const useNotifications = create(() => ({
  messages: [], // [{ id, text, icon }]  新消息在前
  notifyQueue: {}, // module -> [text]
}));

let _seq = 0;

export const Notifications = {
  notify(module, text, noQueue) {
    if (typeof text === 'undefined') return;
    text = String(text);
    if (text.slice(-1) !== '.') text += '.';
    // 模块参数规范化为 id 字符串：支持传模块对象或字符串（原版传对象，React 版引擎存 id）
    const key = typeof module === 'string' ? module : module && module.id ? module.id : null;
    const activeModule = Engine.activeModuleId;
    if (key != null && activeModule !== key) {
      if (!noQueue) {
        useNotifications.setState((s) => {
          const q = s.notifyQueue[key] ? s.notifyQueue[key].slice() : [];
          q.push(text);
          return { notifyQueue: { ...s.notifyQueue, [key]: q } };
        });
      }
    } else {
      Notifications.printMessage(text);
    }
    Engine.saveGame();
  },

  printMessage(t) {
    const icon = Pixel.notificationIcon ? Pixel.notificationIcon(t) : null;
    useNotifications.setState((s) => ({
      messages: [{ id: ++_seq, text: t, icon }, ...s.messages].slice(0, 60),
    }));
  },

  printQueue(module) {
    useNotifications.setState((s) => {
      const q = s.notifyQueue[module];
      if (!q || q.length === 0) return s;
      const newMsgs = q.map((text) => {
        const icon = Pixel.notificationIcon ? Pixel.notificationIcon(text) : null;
        return { id: ++_seq, text, icon };
      });
      const queue = { ...s.notifyQueue };
      delete queue[module];
      return { messages: [...newMsgs.reverse(), ...s.messages].slice(0, 60), notifyQueue: queue };
    });
  },

  clearHidden() {
    // React 端通过渲染数量控制，逻辑层无需清理
  },
};
