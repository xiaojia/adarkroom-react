/**
 * PixelIcon — 像素精灵展示组件
 * 把 Pixel.svg() 生成的 SVG 字符串渲染为真实图标（dangerouslySetInnerHTML）。
 */
import { Pixel } from '../../modules/pixel';

export default function PixelIcon({ name, pixel, className }) {
  if (!name || !Pixel.sprites[name]) return null;
  const svg = Pixel.svg(name, { pixel });
  return (
    <span
      className={'px-icon ' + (className || '')}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
