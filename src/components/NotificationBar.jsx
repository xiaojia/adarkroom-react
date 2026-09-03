/**
 * NotificationBar — 通知栏（展示层）
 * -----------------------------------
 * 渲染 useNotifications 中的消息列表（新消息在最上方）。
 */
import { useNotifications } from '../engine/notifications';
import PixelIcon from './shared/PixelIcon';

export default function NotificationBar() {
  const messages = useNotifications((s) => s.messages);

  return (
    <div id="notifications">
      <div id="notificationsList">
        {messages.map((m) => (
          <div className="notification" key={m.id}>
            {m.icon && <PixelIcon name={m.icon} />}
            <div>{m.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
