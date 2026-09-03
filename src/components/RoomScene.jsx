/**
 * RoomScene — 生火间场景（本地背景图 + 逐帧火焰）
 * -------------------------------------------------------
 * 叠层（自上而下）：
 *   1. room-bg.png        居中铺满的木屋内景背景
 *   2. room-vignette      四周黑色渐晕，让背景边缘平滑渐变到黑
 *   3. room-fire          透明的逐帧篝火，按 game.fire.value（0-4 添柴状态）
 *                         决定是否点燃及火焰大小，帧与帧之间慢速渐隐渐出。
 *
 * 熄灯（lightsOff）时：背景压暗、火焰仍保持亮起，避免被整体压暗吞没。
 */
import { useEffect, useState } from 'react';
import { useEngine } from '../engine/Engine';
import { $SM, useTick } from '../store/stateManager';

const FIRE_FRAMES = [0, 1, 2, 3, 4, 5].map((i) => `/bg/room/fire/frame${i}.png`);
const FRAME_COUNT = FIRE_FRAMES.length;

// fire.value 0-4（dead/smoldering/flickering/burning/roaring）→ 火焰大小 & 亮度
// 0 级（熄火）也保留一点暗红余烬，避免火炉位置完全空白
const SCALE_BY_LEVEL = [0.5, 0.62, 0.76, 0.9, 1.06];
const OPACITY_BY_LEVEL = [0.24, 0.78, 0.88, 0.96, 1];

const FIRE_MS = 2600; // 每帧停留时长，配合渐隐渐出形成缓慢的“慢生活”烟火
const XFADE_MS = 1600; // 帧与帧之间的渐隐渐出时长

export default function RoomScene() {
  useTick();
  const lightsOff = useEngine((s) => s.options.lightsOff);

  const fireValue = $SM.get('game.fire.value', true);
  const level = Math.max(0, Math.min(4, Number(fireValue) || 0));

  const [frame, setFrame] = useState(0);

  // 逐帧缓慢轮播（熄火时也保留余烬微微闪动）
  useEffect(() => {
    const id = window.setInterval(() => setFrame((f) => (f + 1) % FRAME_COUNT), FIRE_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className={`room-scene${lightsOff ? ' off' : ''}`}>
      <img className="room-bg" src="/bg/room/room-bg.png" alt="" draggable="false" />
      <div className="room-vignette" />

      <div
        className="room-fire"
        style={{
          opacity: OPACITY_BY_LEVEL[level],
          transform: `scale(${SCALE_BY_LEVEL[level]})`,
        }}
      >
        {FIRE_FRAMES.map((src, i) => (
          <img
            key={src}
            className="room-fire-frame"
            src={src}
            alt=""
            draggable="false"
            style={{ opacity: i === frame ? 1 : 0 }}
          />
        ))}
      </div>
    </div>
  );
}
