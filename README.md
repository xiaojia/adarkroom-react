
THE OFFICIAL REPO CAN NOW BE FOUND AT https://github.com/doublespeakgames/adarkroom

A Dark Room
===========
> "awake. head throbbing. vision blurry. come light the fire."

a minimalist text adventure game for your browser

## 与旧版的玩法差异

### 1. 全新的「初章」开场流程
- 开局直接送 **15 根木柴**，默认提示「旁边有一些柴，可以生火」。
- 首次点火有遮罩闪烁 + 渐显动画；初次试火约 5 秒后自动熄灭并提示「火灭了，好冷」。
- 需连续添柴把 **火势烧到 4 级**才算正式开始；初章内火每级约 20 秒降温，15 秒不续柴会提示「火堆快熄灭了，好冷」。
- 火升到 3 级提示「房间很暖」、4 级提示「房间很热」。
- 火到 4 级后进入「初章结尾」动画（入睡提示 → 黑屏 → 天亮），随后才解锁静谧森林与熄灯按钮。
- **初章失败判定**：木柴不足以烧到 4 级时直接进入死亡结局（黑屏 + 提示 + 重启弹窗）；死亡存档不可恢复，刷新后从头开始。

### 2. 静谧森林解锁条件变更
旧版只要有木头即可进入静谧森林；新版改为**过完初章（火达到 4 级）后才解锁**。

### 3. 熄灯 / 开灯按钮
新增昼夜切换（熄灯 = 夜晚，开灯 = 白天），过初章后解锁，且切换状态会**持久化到存档**。

### 4. 库存显示优化
- 每个动态库存都显示**当前产出 / 消耗**。
- 库存按「资源 / 消耗品」分组显示。

### 5. 装备穿戴系统
可以把水罐、背包、护甲等装备卸下（为了更快获取能力，如连续渴死 10 次获得荒漠跳鼠能力）。

### 6. 战斗调整
- 近战武器（挥拳、劈砍、刺刀、能量剑等）可**自动攻击**：第一次攻击后，本次战斗内后续会自动释放。
- 遇敌后敌人直到玩家发起攻击前不会动作。

### 7. 消息与随机事件
- 消息列表补充部分随机事件的说明（如黑死病死了多少村民）。

### 8. 大地图城市
- 攻打下来的城市每局大地图都可以**无限进入**，但城内的物品不会再每次刷新。

---

Available | Languages
--------- | ---------
[Chinese](http://adarkroom.doublespeakgames.com/?lang=zh_cn) | [English](http://adarkroom.doublespeakgames.com/?lang=en)
[French](http://adarkroom.doublespeakgames.com/?lang=fr) | [German](http://adarkroom.doublespeakgames.com/?lang=de)
[Italian](http://adarkroom.doublespeakgames.com/?lang=it) | [Japanese](http://adarkroom.doublespeakgames.com/?lang=ja)
[Korean](http://adarkroom.doublespeakgames.com/?lang=ko) | [Norwegian](http://adarkroom.doublespeakgames.com/?lang=nb)
[Polish](http://adarkroom.doublespeakgames.com/?lang=pl) | [Portuguese](http://adarkroom.doublespeakgames.com/?lang=pt)
[Russian](http://adarkroom.doublespeakgames.com/?lang=ru) | [Spanish](http://adarkroom.doublespeakgames.com/?lang=es)
[Swedish](http://adarkroom.doublespeakgames.com/?lang=sv) | [Turkish](http://adarkroom.doublespeakgames.com/?lang=tr)
[Ukrainian](http://adarkroom.doublespeakgames.com/?lang=uk) | [Vietnamese] (http://adarkroom.doublespeakgames.com/?lang=vi)

or play the latest on [GitHub](http://continuities.github.io/adarkroom)

[![app store](http://i.imgur.com/M6jlJQH.png)](https://itunes.apple.com/us/app/a-dark-room/id736683061)
