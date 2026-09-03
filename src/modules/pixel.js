/**
 * 像素精灵引擎
 * --------------
 * 一套自包含的像素画工具。
 * 用 ASCII 网格 + 调色板定义精灵，渲染为内联 SVG，
 * 配合 shape-rendering: crispEdges 保持像素锐利、可任意缩放。
 *
 * 全局对象：Pixel
 *  - Pixel.define(name, {grid:[], palette:{}, bg})  注册精灵
 *  - Pixel.svg(name, {pixel:px, bg})                返回 SVG 字符串
 *  - Pixel.icon(name, {pixel:px, className})        返回 jQuery 元素
 *  - Pixel.TERRAIN_CLASS / Pixel.TILE_ICONS          供世界地图查询
 */
var Pixel = {

	// 每个网格单元的默认显示像素数
	scale: 3,

	// 精灵注册表
	sprites: {},

	/*
	 * 定义精灵。def 结构：
	 *   grid: ['....', '....', ...]  ASCII 网格，'.'/空格 表示空
	 *   palette: {字符: '#rrggbb'}   颜色映射
	 *   bg: '#rrggbb'                  可选，整块背景填充
	 */
	define: function(name, def) {
		this.sprites[name] = def;
		return this;
	},

	// 解析网格，返回 {rects:[{x,y,c}], w, h}
	_parse: function(def) {
		var grid = def.grid;
		var palette = def.palette;
		var rects = [];
		var w = 0;
		for(var y = 0; y < grid.length; y++) {
			var row = grid[y];
			if(row.length > w) w = row.length;
			for(var x = 0; x < row.length; x++) {
				var ch = row[x];
				if(ch === '.' || ch === ' ') continue;
				if(palette[ch]) {
					rects.push({x: x, y: y, c: palette[ch]});
				}
			}
		}
		return { rects: rects, w: w, h: grid.length };
	},

	// 生成 SVG 字符串。pixel 为每格显示像素数，bg 可传入背景色。
	svg: function(name, opts) {
		opts = opts || {};
		var def = this.sprites[name];
		if(!def) return '';
		var p = this._parse(def);
		var pixel = opts.pixel || this.scale;
		var w = p.w * pixel;
		var h = p.h * pixel;
		var bg = (typeof opts.bg !== 'undefined') ? opts.bg : (def.bg || 'none');
		var parts = [];
		parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h +
			'" viewBox="0 0 ' + w + ' ' + h + '" shape-rendering="crispEdges" class="px-svg">');
		if(bg !== 'none') {
			parts.push('<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="' + bg + '"/>');
		}
		for(var i = 0; i < p.rects.length; i++) {
			var r = p.rects[i];
			parts.push('<rect x="' + (r.x * pixel) + '" y="' + (r.y * pixel) +
				'" width="' + pixel + '" height="' + pixel + '" fill="' + r.c + '"/>');
		}
		parts.push('</svg>');
		return parts.join('');
	},

	// 返回 SVG 字符串（React 组件用 dangerouslySetInnerHTML 渲染）
	icon: function(name, opts) {
		return this.svg(name, opts);
	}
};

/* ============================================================
 * 精灵定义
 * ============================================================ */

// —— 战斗：玩家（流浪者）——
Pixel.define('player', {
	palette: {
		'o': '#1a120a', 'H': '#e8b98a', 'h': '#5a3a1f',
		'B': '#4a7a2e', 'b': '#2e551d', 'S': '#cdd3d6', 's': '#98a0a5',
		'L': '#3a3a3a', 'F': '#6a4a2a', 'A': '#d9ad7d'
	},
	grid: [
		'............',
		'....oooo....',
		'...ohhhho...',
		'...oHHHHo...',
		'...oHHHHo...',
		'...oHHHHo...',
		'....oBBo....',
		'..oBooBBoo..',
		'.oBBBo.oAAo.',
		'.oBBBo.sSAo.',
		'.oBbbBo.sSo.',
		'.oBBBBo.oo..',
		'..oLLLLo....',
		'..oLL.oLLo..',
		'..oFF.oFFo..'
	]
});

// —— 战斗：野兽（狼 / 恶犬）——
Pixel.define('beast', {
	palette: {
		'o': '#1a120a', 'H': '#7a6a55', 'h': '#4a3a2a',
		'B': '#5a4a35', 'E': '#d04a2a', 'T': '#efe6d0'
	},
	grid: [
		'............',
		'....oo......',
		'..oHHHHoo...',
		'.oHhhhhHho..',
		'.oHHHHHHHho.',
		'.oHEHEHHHho.',
		'.oHHHHHHHHo.',
		'..ooHHHHHOo.',
		'....oHHHHOo.',
		'....oBBBBo..',
		'....oBB.oBo.',
		'....oBB.oBo.',
		'....oo...oo.'
	]
});

// —— 战斗：豺狼人 / 劫匪（人类敌人）——
Pixel.define('raider', {
	palette: {
		'o': '#1a120a', 'H': '#d8a878', 'h': '#2a2a2a',
		'B': '#7a3a2a', 'b': '#4a2418', 'S': '#b9c0c4',
		'L': '#3a3a3a', 'F': '#5a3a2a'
	},
	grid: [
		'............',
		'....oooo....',
		'...ohhhho...',
		'...oHHHHo...',
		'...oHHHHo...',
		'....oHHo....',
		'....oBBo....',
		'...oBBBBo...',
		'..oBbBBoAo..',
		'..oBbbBOSAo.',
		'..oBbBBoSSo.',
		'...oBBBBoo..',
		'...oLLLLo...',
		'...oLL.oLL..',
		'...oFF.oFF..'
	]
});

// —— 战斗：怪鸟 ——
Pixel.define('bird', {
	palette: {
		'o': '#1a120a', 'H': '#d8e26a', 'h': '#8a3a2a',
		'B': '#b8b12a', 'E': '#d04a2a', 'T': '#e0b03a'
	},
	grid: [
		'............',
		'..........o.',
		'.oooo...oo..',
		'.oHHHHoBBo..',
		'.oHEHeHHBo..',
		'.oHHHHHBBo..',
		'.oHHHHHBBo..',
		'..ooHHHo....',
		'....oHBo....',
		'....oTTo....',
		'...o.oo.o...',
		'............'
	]
});

// —— 战斗：巨蜥 ——
Pixel.define('lizard', {
	palette: {
		'o': '#1a120a', 'H': '#4a8a3a', 'h': '#2e5a22',
		'B': '#5a9a46', 'E': '#d08a2a', 'T': '#8a6a3a'
	},
	grid: [
		'............',
		'.oooooo.....',
		'.oHHHhHho...',
		'.oHEHEhHho..',
		'..oHHHhHho..',
		'..oBBBBBBo..',
		'..oBBbBBBo..',
		'..oBBBBBBo..',
		'..oBo..oBo..',
		'..oBo...oo..',
		'..oo........',
		'............'
	]
});

// —— 战斗：士兵（远程）——
Pixel.define('soldier', {
	palette: {
		'o': '#1a120a', 'H': '#d8a878', 'h': '#3a3a2a',
		'B': '#4a5a2a', 'b': '#2e3a1a', 'S': '#8a9296',
		'L': '#2a2a2a', 'F': '#3a3a2a', 'R': '#5a3a2a'
	},
	grid: [
		'............',
		'....oooo....',
		'...ohhhho...',
		'...oHHHHo...',
		'...oHHHHo...',
		'....oHHo....',
		'....oBBo....',
		'..ooBBBBoo..',
		'.oBbBBBBRS..',
		'.oBbbBBRRS..',
		'.oBbBBBo.S..',
		'..oBBBBoo...',
		'...oLLLLo...',
		'...oLL.oLL..',
		'...oFF.oFF..'
	]
});

// —— 战斗：猛兽（野怪 / 食人兽）——
Pixel.define('terror', {
	palette: {
		'o': '#1a120a', 'H': '#8a4a2a', 'h': '#5a2e1a',
		'B': '#6a3a22', 'E': '#e05a2a', 'T': '#efe0c8', 'b': '#3a2416'
	},
	grid: [
		'............',
		'..oooo......',
		'.oHHHHoo....',
		'.oHhhhHHo...',
		'oHHHHHHHHo..',
		'oHEhHEhHHo..',
		'oHHHHHHHHHo.',
		'.ooHHHHHHHo.',
		'..oHHHHBBHo.',
		'..oBBbBBBBo.',
		'..oBBBBBbBo.',
		'..oBbo.oBBo.',
	'..oBBo.oBBo.',
	'..oo...oo...',
	'............'
]
});

// —— 战斗：机械守卫 / 机器人 ——
Pixel.define('robot', {
	palette: {
		'o': '#1a120a', 'M': '#9aa2a8', 'm': '#5a6266',
		'B': '#3a3e42', 'b': '#7a8288', 'R': '#e05a2a', 'L': '#2a2e32', 'F': '#3a3a2a'
	},
	grid: [
		'............',
		'.....oo.....',
		'....obbo....',
		'...oMMMMo...',
		'...oMRRMo...',
		'...oMMMMo...',
		'....oMMo....',
		'...oBMMBo...',
		'..oMBBBBMo..',
		'..oMbBBbMo..',
		'..oMBBBBMo..',
		'...oBBBBo...',
		'...oMBB.Mo..',
		'...oLLo.oLL.',
		'...oFFo.oFF.'
	]
});

// —— 战斗：炮塔（防御 / 自动炮塔）——
Pixel.define('turret', {
	palette: {
		'o': '#1a120a', 'M': '#9aa2a8', 'm': '#5a6266',
		'B': '#3a3e42', 'b': '#7a8288', 'R': '#e05a2a'
	},
	grid: [
		'............',
		'......oo....',
		'.....oRRo...',
		'....oBBBBo..',
		'....oBBBBo..',
		'...oMMMMMMo.',
		'...oMmBBmMo.',
		'...oMBBBBMo.',
		'...oMMMMMMo.',
		'....oMMMMo..',
		'....oMMmMo..',
		'....oMMMMo..'
	]
});

// —— 战斗：机械四足兽 ——
Pixel.define('mechquad', {
	palette: {
		'o': '#1a120a', 'M': '#9aa2a8', 'm': '#5a6266',
		'B': '#3a3e42', 'b': '#7a8288', 'R': '#e05a2a'
	},
	grid: [
		'............',
		'...ooooo....',
		'..oMBBBBMo..',
		'..oMBbbBMo..',
		'..oMBBBBMo..',
		'..oMRRRRMo..',
		'...oMMMMo...',
		'..oMo..oMo..',
		'..omo..omo..',
		'..omo..omo..',
		'..om....om..',
		'..oo....oo..',
		'............'
	]
});

// —— 战斗：几丁质怪物（异形 / 节肢）——
Pixel.define('chitin', {
	palette: {
		'o': '#1a120a', 'H': '#7a4a1a', 'h': '#5a3410',
		'B': '#8a5a22', 'b': '#6a3a18', 'E': '#e0a02a', 'T': '#efe0c8'
	},
	grid: [
		'............',
		'..o......o..',
		'.oBHo..oBBo.',
		'.oHHHo.oBHo.',
		'oHHHHHoBHHo.',
		'oHEhHHoHHHo.',
		'oHHHHHHHHHo.',
		'.oBBBBBBBHo.',
		'..oBBBBBBo..',
		'..oBbBBbBo..',
		'..oBbo.oBBo.',
		'..oBBo..oB..',
		'..oBB....o..',
		'..oo........',
		'............'
	]
});

// —— 战斗：双头怪 ——
Pixel.define('twohead', {
	palette: {
		'o': '#1a120a', 'H': '#6a4a2a', 'h': '#4a3018',
		'B': '#5a3a22', 'E': '#e05a2a'
	},
	grid: [
		'............',
		'..oBBo.oBBo.',
		'.oHHHo.oHHHo',
		'.oHEHooHEHo.',
		'.oHHHo.oHHHo',
		'..oHHhooHHo.',
		'...oHHHHHo..',
		'..oHHHHHHo..',
		'..oHhHHhHo..',
		'..oHHHHHHo..',
		'...oHHHHo...',
		'...oBBBBo...',
		'...oBB.oBB..',
		'...oBB.oBB..',
		'...oo...oo..'
	]
});

// —— 战斗：研究员（科学家）——
Pixel.define('researcher', {
	palette: {
		'o': '#1a120a', 'H': '#d8a878', 'h': '#2a2a2a',
		'W': '#d8d8d0', 'w': '#a8a8a0', 'L': '#3a3a3a', 'F': '#3a3a2a'
	},
	grid: [
		'............',
		'....oooo....',
		'...ohhhho...',
		'...oHHHHo...',
		'...oHHHHo...',
		'....oHHo....',
		'....oWWo....',
		'...oWWWWo...',
		'..oWWWWWWo..',
		'..oWwwwWWo..',
		'..oWwwwWWo..',
		'..oWWWWWWo..',
		'...oLLLLo...',
		'...oLL.oLL..',
		'...oFF.oFF..'
	]
});

// —— 村庄：村民（通用工人小人）——
Pixel.define('worker', {
	palette: {
		'o': '#1a120a', 'H': '#e8b98a', 'h': '#4a331f',
		'B': '#7a5a2e', 'b': '#5a4020', 'S': '#7a8338', 'F': '#4a3120'
	},
	grid: [
		'............',
		'....oooo....',
		'...oSSSSo...',
		'...oSssSo...',
		'...oSSSSo...',
		'....oHHo....',
		'....oHHo....',
		'...oHBHHo...',
		'...oBBBBo...',
		'...oBbBBo...',
		'...oBBBBo...',
		'....oBBo....',
		'...oFF.FFo..',
		'..oFFo.oFFo.',
		'............'
	]
});

/* ---------------------------------------------------------------------
 * 地形瓦片（世界地图，每个瓦片为正方形纯色块，紧凑不生成大量 SVG 节点）
 * --------------------------------------------------------------------- */
Pixel.TERRAIN_CLASS = {
	';': 'terr-forest',
	',': 'terr-field',
	'.': 'terr-barrens',
	'#': 'terr-road',
	'M': 'terr-swamp'
};

// 地标（生成 SVG 图标）—— 字符 对应 精灵名
Pixel.TILE_ICONS = {
	'A': 'lm_village',
	'I': 'lm_iron',
	'C': 'lm_coal',
	'S': 'lm_sulphur',
	'H': 'lm_house',
	'V': 'lm_cave',
	'O': 'lm_town',
	'Y': 'lm_city',
	'P': 'lm_outpost',
	'W': 'lm_ship',
	'B': 'lm_borehole',
	'F': 'lm_battlefield',
	'U': 'lm_cache'
};

// —— 地标：村庄 ——
Pixel.define('lm_village', {
	palette: {
		'o': '#1a120a', 'W': '#d8c090', 'w': '#a89058',
		'R': '#a04a2a', 'r': '#7a2e1a', 'G': '#3a6a2a'
	},
	grid: [
		'............',
		'.oooooooooo.',
		'.oWWWWWWWWo.',
		'.oWWpWWpWWo.',
		'.oWWWWWWWWo.',
		'.oWWWWWWWWo.',
		'.oooooooooo.',
		'..oRRRRRRo..',
		'..oRrrrrRo..',
		'..oRaRaaRo..',
		'..ooooooooo.',
		'...ooGGoo...'
	]
});

// —— 地标：铁矿 ——
Pixel.define('lm_iron', {
	palette: {
		'o': '#1a120a', 'R': '#8a2a1a', 'r': '#6a1e12', 'G': '#3a6a2a', 'g': '#2e551d'
	},
	grid: [
		'............',
		'.....oo.....',
		'....oRRo....',
		'...oRRRRo...',
		'....oRRo....',
		'...oRRRRo...',
		'......o.....',
		'.oooooooooo.',
		'.oGGGGGGGGo.',
		'.oGgGGgGGgo.',
		'.oGGGGGGGGo.',
		'...oooooo...'
	]
});

// —— 地标：煤矿 ——
Pixel.define('lm_coal', {
	palette: {
		'o': '#1a120a', 'K': '#3a3a3a', 'k': '#1e1e1e', 'G': '#3a6a2a', 'g': '#2e551d'
	},
	grid: [
		'............',
		'.....oo.....',
		'....oKko....',
		'...oKKkKo...',
		'....oKo.....',
		'...oKkKKo...',
		'......o.....',
		'.oooooooooo.',
		'.oGGGGGGGGo.',
		'.oGgGGgGGgo.',
		'.oGGGGGgGGo.',
		'...oooooo...'
	]
});

// —— 地标：硫磺矿 ——
Pixel.define('lm_sulphur', {
	palette: {
		'o': '#1a120a', 'Y': '#e0c01a', 'y': '#a89010', 'G': '#3a6a2a', 'g': '#2e551d'
	},
	grid: [
		'............',
		'.....oo.....',
		'....oYYo....',
		'...oYYyYo...',
		'....oYy.....',
		'...oYyYYo...',
		'......o.....',
		'.oooooooooo.',
		'.oGGGGGGGGo.',
		'.oGgGGgGGgo.',
		'.oGGGGGGGGo.',
		'...oooooo...'
	]
});

// —— 地标：老房子 ——
Pixel.define('lm_house', {
	palette: {
		'o': '#1a120a', 'W': '#d8c090', 'w': '#a89058', 'R': '#a04a2a', 'r': '#7a2e1a', 'H': '#e8e0d0'
	},
	grid: [
		'............',
		'.....oo.....',
		'....oRRo....',
		'...oRRRRo...',
		'..oRRRRRRo..',
		'.oooooooooo.',
		'.oWWWWWWWWo.',
		'.oWHWWWHWWo.',
		'.oWWWWWWWWo.',
		'.oWWWWWWWWo.',
		'.oooooooooo.',
		'............'
	]
});

// —— 地标：洞穴 ——
Pixel.define('lm_cave', {
	palette: {
		'o': '#1a120a', 'R': '#2a2a2a', 'r': '#1a1a1a', 'G': '#3a6a2a', 'g': '#2e551d'
	},
	grid: [
		'............',
		'...oooo.....',
		'..oGGGGo....',
		'.oGGGGGGo...',
		'.oGGRRRGo...',
		'.oGRrrrRGo..',
		'.oGrrrrrGo..',
		'.oGRrrrRGo..',
		'..oGGGGGo...',
		'...ooooo....',
		'............',
		'............'
	]
});

// —— 地标：废弃小镇 ——
Pixel.define('lm_town', {
	palette: {
		'o': '#1a120a', 'W': '#c8a070', 'w': '#a08050', 'R': '#a04a2a', 'r': '#7a2e1a', 'K': '#3a3a3a'
	},
	grid: [
		'.o.o.o.o.o.o',
		'oooooooooooo',
		'..oWWoWWo..o',
		'..oWWoWWoRo.',
		'..oWWoWWoRo.',
		'..ooooooooo.',
		'..oWWoOOoWWo',
		'..oWWoOOoWWo',
		'..oWWooooWWo',
		'..oWWWWWWWWo',
		'..oooooooooo',
		'............'
	]
});

// —— 地标：废墟城市 ——
Pixel.define('lm_city', {
	palette: {
		'o': '#1a120a', 'W': '#c8a070', 'w': '#a08050', 'K': '#4a4a4a', 'G': '#3a6a2a'
	},
	grid: [
		'..o..o.o..o..',
		'.oKo.oKo.oKo.',
		'.oWo.oWo.oWo.',
		'.oWo.oWo.oWo.',
		'oooooooooooo',
		'.oWo.oWo.oWo.',
		'.oWo.oWo.oWo.',
		'.ooooooooooo.',
		'..oWo.oooWoo.',
		'..oWo.oGoWoo.',
		'..ooo.oGooo..',
		'............'
	]
});

// —— 地标：哨站 ——
Pixel.define('lm_outpost', {
	palette: {
		'o': '#1a120a', 'W': '#d8c090', 'w': '#a89058', 'H': '#7aa03a', 'G': '#3a6a2a'
	},
	grid: [
		'............',
		'...oooo.....',
		'...oWWo.....',
		'...oWWo..o..',
		'.ooooooo../.',
		'.oWWWWW.//..',
		'.oWHWWW.....',
		'.oWWWWW.....',
		'.ooooooo....',
		'..oGGo.oGo..',
		'..oGo..oGo..',
		'............'
	]
});

// —— 地标：坠落飞船 ——
Pixel.define('lm_ship', {
	palette: {
		'o': '#1a120a', 'S': '#8a9296', 's': '#5a6064', 'B': '#4a7aa0', 'b': '#2a4a68', 'W': '#f0f0f0'
	},
	grid: [
		'......oo....',
		'..o..oBBo...',
		'.oSo.oBBBo..',
		'.oSSo.oBbo..',
		'.oSSo.obbo..',
		'..oSo.oo....',
		'.ooooooooooo',
		'.oSSSSSSSSSo',
		'.oWWWoWWWWWo',
		'.oBBBoBBBBBo',
		'..ooo..oooo.',
		'............'
	]
});

// —— 地标：钻井 ——
Pixel.define('lm_borehole', {
	palette: {
		'o': '#1a120a', 'K': '#3a3a3a', 'k': '#1e1e1e', 'G': '#3a6a2a', 'g': '#2e551d'
	},
	grid: [
		'.....oo.....',
		'.....oKo....',
		'....oKkKo...',
		'....oKKKo...',
		'....oKkKo...',
		'.....oKo....',
		'.....oo.....',
		'.oooooooooo.',
		'.oGGGGGGGGo.',
		'.oGgGGGgGGo.',
		'.oGGGGGgGGo.',
		'...oooooo...'
	]
});

// —— 地标：战场 ——
Pixel.define('lm_battlefield', {
	palette: {
		'o': '#1a120a', 'K': '#3a3a3a', 'k': '#1e1e1e', 'R': '#a04a2a', 'G': '#3a6a2a', 'g': '#2e551d'
	},
	grid: [
		'............',
		'..oGKogo....',
		'.oKGo.oGo...',
		'..oGKo.Ko...',
		'....oKGo....',
		'.....oKo....',
		'....oo..o...',
		'.oooKooKoo..',
		'.oKKKKKKKo..',
		'.oKKoKoKKo..',
		'..oo...oo...',
		'............'
	]
});

// —— 地标：沼泽 ——
Pixel.define('lm_cache', {
	palette: {
		'o': '#1a120a', 'K': '#3a3a3a', 'k': '#1e1e1e', 'W': '#d8c090', 'w': '#a89058'
	},
	grid: [
		'..oo.oo.oo..',
		'.oWWoKKoWWo.',
		'.oWWKKKKWWo.',
		'.oWWKWKWWWo.',
		'..oKKKKKko..',
		'...oKkkkKo..',
		'....oKKKo...',
		'.....oKo....',
		'.....oKo....',
		'....ooooo...',
		'............',
		'............'
	]
});

/* ---------------------------------------------------------------------
 * 村庄建筑（outside.js / room.js 用）
 * --------------------------------------------------------------------- */

// —— 小屋 ——
Pixel.define('bld_hut', {
	palette: {
		'o': '#1a120a', 'W': '#c8a070', 'w': '#a08050', 'R': '#a04a2a', 'r': '#7a2e1a', 'K': '#2a1e12'
	},
	grid: [
		'............',
		'.....oo.....',
		'....oRRo....',
		'...oRRRRo...',
		'..oRrRRrRo..',
		'.oooooooooo.',
		'.oWWWWWWWWo.',
		'.oWWKWWKWWo.',
		'.oWWWWWWWWo.',
		'.oWWWWWWWWo.',
		'.oWWWWWWWWo.',
		'.oooooooooo.'
	]
});

// —— 陷阱 ——
Pixel.define('bld_trap', {
	palette: {
		'o': '#1a120a', 'R': '#7a3a1a', 'r': '#5a2a12', 'K': '#d8d0b0'
	},
	grid: [
		'............',
		'............',
		'.o..........',
		'..o.........',
		'...o........',
		'....ooo.....',
		'...oKKKo....',
		'....oOOo....',
		'.....oo.....',
		'....oRRo....',
		'...oRooRo...',
		'............'
	]
});

// —— 推车 ——
Pixel.define('bld_cart', {
	palette: {
		'o': '#1a120a', 'W': '#c8a070', 'w': '#a08050', 'K': '#2a1e12', 'G': '#3a6a2a'
	},
	grid: [
		'............',
		'............',
		'......oooo..',
		'..o...oWWo..',
		'.oWoo.oWWo..',
		'.oWWWoWWWoo.',
		'.oWWWWWWWWWo',
		'..ooooooooo.',
		'....o.W.......',
		'....o.o.oo...',
		'.....o...o...',
		'............'
	]
});

// —— 猎屋 ——
Pixel.define('bld_lodge', {
	palette: {
		'o': '#1a120a', 'W': '#c8a070', 'w': '#a08050', 'R': '#a04a2a', 'r': '#7a2e1a', 'G': '#3a6a2a'
	},
	grid: [
		'............',
		'.....oo.....',
		'....oRRo....',
		'...oRRRRo...',
		'..oRRrRRRo..',
		'.oooooooooo.',
		'.oWWWWWWWWo.',
		'.oWWGWWGWWo.',
		'.oWWWWWWWWo.',
		'.oWWWWWWWWo.',
		'.oooooooooo.',
		'....oGo.o...'
	]
});

// —— 贸易站 ——
Pixel.define('bld_trading', {
	palette: {
		'o': '#1a120a', 'W': '#d8c090', 'w': '#a89058', 'R': '#b87a3a', 'r': '#8a5a28', 'B': '#c8781a'
	},
	grid: [
		'..oo..oo..oo',
		'..oWWoWWoWWo',
		'..oWWoWWoWWo',
		'..oooooooooo',
		'.oWWWWWWWWWo',
		'.oWWBWWBWWWo',
		'.oWWWWWWWWWo',
		'.oWWWWWWWWWo',
		'.oWWWWWWWWWo',
		'.ooooooooooo',
		'.............',
		'............'
	]
});

// —— 制革厂 ——
Pixel.define('bld_tannery', {
	palette: {
		'o': '#1a120a', 'W': '#c8a070', 'w': '#a08050', 'R': '#8a5a2a', 'F': '#b0803a', 'K': '#2a1e12'
	},
	grid: [
		'............',
		'....oooo....',
		'...oRRRRo...',
		'..oRrrrrRo..',
		'.oooooooooo.',
		'.oWWWWWWWWo.',
		'.oWKWWWWKWo.',
		'.oWWWWWWWWo.',
		'.oF.WWWWW.o.',
		'.oFF.WWW.o..',
		'..oFFo.o....',
		'............'
	]
});

// —— 熏肉坊 ——
Pixel.define('bld_smokehouse', {
	palette: {
		'o': '#1a120a', 'W': '#c8a070', 'w': '#a08050', 'R': '#a04a2a', 'r': '#7a2e1a', 'K': '#2a1e12'
	},
	grid: [
		'............',
		'...oKKKo....',
		'....oKo.....',
		'...oKKKo....',
		'....oKo.....',
		'..oRRRRRo...',
		'.oRrrrrrRo..',
		'.oRrrrrrRo..',
		'.oRRRRRRRo..',
		'.oWWWWWWWo..',
		'.ooooooooo..',
		'......o.....'
	]
});

// —— 工坊 ——
Pixel.define('bld_workshop', {
	palette: {
		'o': '#1a120a', 'W': '#c8a070', 'w': '#a08050', 'R': '#a04a2a', 'K': '#4a4a4a', 'k': '#1e1e1e', 'G': '#3a6a2a'
	},
	grid: [
		'............',
		'.oooooooooo.',
		'.oWWWWWWWWo.',
		'.oWWKWWKWWo.',
		'.oWWWWWWWWo.',
		'.oWWWWWWWWo.',
		'.oWWWWWWWWo.',
		'.oooooooooo.',
		'..oKkKkKo...',
		'..oKkKkKo...',
		'..oKKKKKo...',
		'..ooooooo...'
	]
});

// —— 钢铁厂 ——
Pixel.define('bld_steelworks', {
	palette: {
		'o': '#1a120a', 'W': '#6a6a6a', 'w': '#4a4a4a', 'R': '#a04a2a', 'r': '#7a2e1a', 'S': '#8a9296', 'K': '#1e1e1e'
	},
	grid: [
		'...oRo...oRo',
		'...oRo...oRo',
		'..oRRo...oRR',
		'..oRRooooRR.',
		'..oWWWWWWWWo',
		'..oWWWWWWWWo',
		'..oWWWWWWWWo',
		'..ooooooooo.',
		'..oKKo....oK',
		'..oKSo....oS',
		'..oKKo....oO',
		'..oooo...ooo'
	]
});

// —— 军械库 ——
Pixel.define('bld_armoury', {
	palette: {
		'o': '#1a120a', 'W': '#4a4a4a', 'w': '#333333', 'S': '#9aa0a5', 'R': '#a04a2a', 'K': '#1e1e1e'
	},
	grid: [
		'.oooooooooo.',
		'.oWWWWWWWWo.',
		'.oWSWWWSWWo.',
		'.oWWWWWWWWo.',
		'.oooooooooo.',
		'....o.So...',
		'....o.So...',
		'.oRW.WWWo.O.',
		'.oWW.WWWo...',
		'.oWW.WWWo..O',
		'.oooo.oooo..',
		'............'
	]
});

// —— 火把（工具）——
Pixel.define('tool_torch', {
	palette: {
		'o': '#1a120a', 'R': '#e08a1a', 'r': '#c86a10', 'W': '#a08050', 'w': '#6a4a2a', 'K': '#2a1e12'
	},
	grid: [
		'....oR.....',
		'...oRR.....',
		'...oRr.....',
		'....oR.....',
		'...oRro....',
		'....oR.....',
		'....oWo....',
		'....oWo....',
		'....oWo....',
		'....oWo....',
		'...oWWWo...',
		'...oooo....'
	]
});

// —— 水袋（升级品）——
Pixel.define('upgrade_waterskin', {
	palette: {
		'o': '#1a120a', 'W': '#7a9a6a', 'w': '#5a7a4a', 'B': '#3a5a8a', 'K': '#2a1e12'
	},
	grid: [
		'............',
		'....oooo....',
		'...oWWWWo...',
		'..oWWWWWWo..',
		'..oWBWBWWo..',
		'..oWWWWWWo..',
		'..oWWWWWWo..',
		'..oWWWWWWo..',
		'...oWWWWo...',
		'....oWWo....',
		'.....oo.....',
		'............'
	]
});

// —— 水桶（升级品）——
Pixel.define('upgrade_cask', {
	palette: {
		'o': '#1a120a', 'W': '#a0703a', 'w': '#7a5228', 'B': '#4a6a4a', 'K': '#2a1e12'
	},
	grid: [
		'............',
		'....oooo....',
		'...oWWWWo...',
		'..oWWWWWWo..',
		'..oWBWBWWo..',
		'..oWWWWWWo..',
		'..oWBWBWWo..',
		'..oWWWWWWo..',
		'..oWWWWWWo..',
		'...oWWWWo...',
		'....oooo....',
		'............'
	]
});

// —— 水罐（升级品）——
Pixel.define('upgrade_water_tank', {
	palette: {
		'o': '#1a120a', 'G': '#8a9a9a', 'g': '#6a7a7a', 'B': '#3a5a8a', 'K': '#2a1e12'
	},
	grid: [
		'............',
		'....oooo....',
		'...oBBBBo...',
		'..oGBBBBGo..',
		'..oGBBBBGo..',
		'..oBBBBBBo..',
		'..oBBBBBBo..',
		'..oBBBBBBo..',
		'..oBBBBBBo..',
		'...oggggo...',
		'....oooo....',
		'............'
	]
});

// —— 双肩包（升级品）——
Pixel.define('upgrade_rucksack', {
	palette: {
		'o': '#1a120a', 'R': '#8a5a2a', 'r': '#6a4018', 'G': '#c8a060', 'K': '#2a1e12'
	},
	grid: [
		'............',
		'....oooo....',
		'...oRRRRo...',
		'..oRRRRRRo..',
		'..oRRRRRRo..',
		'..oRGRGRRo..',
		'..oRRRRRRo..',
		'..oRRRRRRo..',
		'..oRRRRRRo..',
		'...oRRRRo...',
		'....oooo....',
		'............'
	]
});

// —— 篷车（升级品）——
Pixel.define('upgrade_wagon', {
	palette: {
		'o': '#1a120a', 'W': '#c8a070', 'w': '#a08050', 'K': '#2a1e12', 'G': '#6a4a2a'
	},
	grid: [
		'............',
		'....oooo....',
		'...oWWWWo...',
		'..oWWWWWWo..',
		'..oWWWWWWo..',
		'..oWWWWWWo..',
		'..oWWWWWWo..',
		'..oGGGGGGo..',
		'...oWWWWo...',
		'....oWWo....',
		'...o.o..o...',
		'....o..o....'
	]
});

// —— 车队（升级品）——
Pixel.define('upgrade_convoy', {
	palette: {
		'o': '#1a120a', 'W': '#c8a070', 'w': '#a08050', 'K': '#2a1e12', 'G': '#6a4a2a'
	},
	grid: [
		'............',
		'............',
		'....oo.oo...',
		'...oWWoWWo..',
		'...oWWoWWo..',
		'..oWWWWWWWo.',
		'..oWWWWWWWo.',
		'..oGGGGGGGo.',
		'..oWWoWWo...',
	'...o..o.....',
	'...o..o.....',
	'............'
	]
});

// —— 液体循环机（升级品）——
Pixel.define('upgrade_fluid_recycler', {
	palette: {
		'o': '#1a120a', 'M': '#8a9a9a', 'm': '#6a7a7a', 'B': '#3a5a8a', 'b': '#5a9aba', 'K': '#2a1e12'
	},
	grid: [
		'............',
		'...oooooo...',
		'..oMMMMMMo..',
		'.oMMMMMMMMo.',
		'.oMMbBBBMMo.',
		'.oMBbBBBMMo.',
		'.oMBbBBBMMo.',
		'.oMMbBBBMMo.',
		'.oMMMMMMMMo.',
		'..oMMMMMMo..',
		'...oooooo...',
		'............'
	]
});

// —— 货运无人机（升级品）——
Pixel.define('upgrade_cargo_drone', {
	palette: {
		'o': '#1a120a', 'M': '#a0b0b0', 'm': '#6a7a7a', 'C': '#a0703a', 'c': '#7a5228', 'K': '#2a1e12'
	},
	grid: [
		'............',
		'....o..o....',
		'..o.o..o.o..',
		'...oooooo...',
		'..oMMMMMMo..',
		'..oMMmmMMo..',
		'..oMMCCMMo..',
		'...oCCCCo...',
		'..oCccccCo..',
		'...oCCCCo...',
		'....oooo....',
		'............'
	]
});

// —— 对号（已装备状态图标）——
Pixel.define('icon_check', {
	palette: {
		'o': '#1a120a', 'G': '#4a8a2a', 'g': '#3a6a1a'
	},
	grid: [
		'............',
		'............',
		'............',
		'..........oo',
		'.........oGG',
		'........oGg.',
		'..o....oGg..',
		'..oG..oGg...',
		'...oGGoG....',
		'....oGGo....',
		'.....oo.....',
		'............'
	]
});

// —— 叉（未装备状态图标）——
Pixel.define('icon_cross', {
	palette: {
		'o': '#1a120a', 'R': '#a02a1a', 'r': '#7a1e12'
	},
	grid: [
		'............',
		'............',
		'............',
		'...oo..oo...',
		'..oRRooRRo..',
		'..oRrooRro..',
		'...oRRRRo...',
		'....oRRo....',
		'...oRRRRo...',
		'..oRrooRro..',
		'..oRRooRRo..',
		'...oo..oo...'
	]
});

// —— 皮甲（升级品）——
Pixel.define('upgrade_l_armour', {
	palette: {
		'o': '#1a120a', 'B': '#8a5a30', 'b': '#6a3f20'
	},
	grid: [
		'............',
		'...oooooo...',
		'..oBBBBBBo..',
		'..oBooooBo..',
		'..oBBBbbBo..',
		'..oBBBbbBo..',
		'..oBBBbbBo..',
		'..oBBBBBBo..',
		'...oBBBBo...',
		'....oBBo....',
		'.....oo.....',
		'............'
	]
});

// —— 铁甲（升级品）——
Pixel.define('upgrade_i_armour', {
	palette: {
		'o': '#1a120a', 'B': '#8a8a8a', 'b': '#5a5a5a'
	},
	grid: [
		'............',
		'...oooooo...',
		'..oBBBBBBo..',
		'..oBooooBo..',
		'..oBBBbbBo..',
		'..oBBBbbBo..',
		'..oBBBbbBo..',
		'..oBBBBBBo..',
		'...oBBBBo...',
		'....oBBo....',
		'.....oo.....',
		'............'
	]
});

// —— 钢甲（升级品）——
Pixel.define('upgrade_s_armour', {
	palette: {
		'o': '#1a120a', 'B': '#aab4c0', 'b': '#6a7480'
	},
	grid: [
		'............',
		'...oooooo...',
		'..oBBBBBBo..',
		'..oBooooBo..',
		'..oBBBbbBo..',
		'..oBBBbbBo..',
		'..oBBBbbBo..',
		'..oBBBBBBo..',
		'...oBBBBo...',
		'....oBBo....',
		'.....oo.....',
		'............'
	]
});

// —— 动能装甲（升级品，最高级护甲）——
Pixel.define('upgrade_kinetic_armour', {
	palette: {
		'o': '#1a120a', 'B': '#4ac6d6', 'b': '#1f7a8c', 'g': '#8ef2ff'
	},
	grid: [
		'............',
		'...oooooo...',
		'..oBBBBBBo..',
		'..oBooooBo..',
		'..oBBBbbBo..',
		'..oBgBbBo...',
		'..oBBbbBBo..',
		'..oBBBBBBo..',
		'...oBBBBo...',
		'....oBBo....',
		'.....oo.....',
		'............'
	]
});

/* ---------------------------------------------------------------------
 * 物资图标（商店 / 背包用）—— 统一 12x12
 * --------------------------------------------------------------------- */

// —— 木头 ——
Pixel.define('res_wood', {
	palette: {
		'o': '#1a120a', 'W': '#a0703a', 'w': '#7a5228', 'K': '#4a3018'
	},
	grid: [
		'............',
		'............',
		'............',
		'.....oooo...',
		'....oWWWWo..',
		'....oWWwWo..',
		'...oWWwWWo..',
		'...owWWWWo..',
		'...oWWWWo...',
		'....oKKo....',
		'............',
		'............'
	]
});

// —— 皮毛 ——
Pixel.define('res_fur', {
	palette: {
		'o': '#1a120a', 'W': '#b08a6a', 'w': '#8a6a4e', 'K': '#6a4a2e'
	},
	grid: [
		'............',
		'............',
		'.....oo.....',
		'....oWWWo...',
		'...oWWWWWo..',
		'...owWWwWo..',
		'...oWKKWWo..',
		'...oWWwWWo..',
		'....owWWo...',
		'.....oo.....',
		'............',
		'............'
	]
});

// —— 生肉 ——
Pixel.define('res_meat', {
	palette: {
		'o': '#1a120a', 'M': '#c04a3a', 'm': '#9a2e22', 'K': '#efe6d0', 'B': '#5a4a35'
	},
	grid: [
		'............',
		'............',
		'...oMmmmmo..',
		'..oMMmmmmMo.',
		'..oMmmMMmmo.',
		'..oMmmMMmmo.',
		'..oMMmmMMmo.',
		'...oMmmmmo..',
		'...oBooBo...',
		'...oKKoKKo..',
		'............',
		'............'
	]
});

// —— 熏肉 ——
Pixel.define('res_curedmeat', {
	palette: {
		'o': '#1a120a', 'M': '#8a4a2a', 'm': '#6a3a1e', 'K': '#d8d0b0', 'B': '#5a3a25'
	},
	grid: [
		'............',
		'............',
		'...oMMMMo...',
		'..oMMmmMMo..',
		'..oMMmmMMo..',
		'..oMmmMMMo..',
		'..oMMmmMMo..',
		'...oMMMMo...',
		'...oBooBo...',
		'...oKKoKKo..',
		'............',
		'............'
	]
});

// —— 布料 ——
Pixel.define('res_cloth', {
	palette: {
		'o': '#1a120a', 'W': '#d8c090', 'w': '#b8a070'
	},
	grid: [
		'............',
		'............',
		'...oooooo...',
		'..oWWWWWWo..',
		'..oWWWWWWo..',
		'..oWwWwWWo..',
		'..oWWWWWWo..',
		'..oWWWwWWo..',
		'..oWWWWWWo..',
		'...oooooo...',
		'............',
		'............'
	]
});

// —— 皮革 ——
Pixel.define('res_leather', {
	palette: {
		'o': '#1a120a', 'W': '#9a6a3a', 'w': '#7a4e24'
	},
	grid: [
		'............',
		'....oo......',
		'...oWWWo....',
		'..oWWWWWo...',
		'..oWwWwWo...',
		'..oWWWWWWo..',
		'..oWwWWwWo..',
		'..oWWWWWWo..',
		'..oWWWWWWo..',
		'...oWWWWo...',
		'....oooo....',
		'............'
	]
});

// —— 鳞片 ——
Pixel.define('res_scales', {
	palette: {
		'o': '#1a120a', 'S': '#7aa0b0', 's': '#5a7a8a', 'T': '#c0d8e0'
	},
	grid: [
		'............',
		'...o..o..o..',
		'..oSSoSSo...',
		'..oSSoSSo...',
		'...o..o..o..',
		'..oSSoSSoSS.',
		'..oSSoSSoSS.',
		'...o..o..o..',
		'..oSS.oSSo..',
		'..oSS.oSSo..',
		'...o...o....',
		'............'
	]
});

// —— 牙齿 ——
Pixel.define('res_teeth', {
	palette: {
		'o': '#1a120a', 'T': '#efe8d0', 't': '#cfc8a8'
	},
	grid: [
		'............',
		'...o.o.o....',
		'..oTToTTo...',
		'..oTtTTtTo..',
		'...o.o.o....',
		'....oTTo....',
		'...oTttTo...',
		'...oTtTTo...',
		'....oTT.....',
		'.....oo.....',
		'............',
		'............'
	]
});

// —— 诱饵 ——
Pixel.define('res_bait', {
	palette: {
		'o': '#1a120a', 'M': '#c04a3a', 'm': '#9a2e22', 'W': '#e8d8b0'
	},
	grid: [
		'............',
		'............',
		'.....oo.....',
		'....oWWo....',
		'....oWo.....',
		'....oWWo....',
		'...oMMMo....',
		'....oMo.....',
		'....oMo.....',
		'....oMo.....',
		'.....o......',
		'............'
	]
});

// —— 铁 ——
Pixel.define('res_iron', {
	palette: {
		'o': '#1a120a', 'I': '#8a2a1a', 'i': '#6a1e12', 'S': '#c0c8cc'
	},
	grid: [
		'............',
		'............',
		'......oo....',
		'.....oIIo...',
		'....oIIiIo..',
		'....oIiIIo..',
		'...oIIiIIi..',
		'....oIIIo...',
		'.....oIo....',
		'......o.....',
		'............',
		'............'
	]
});

// —— 煤 ——
Pixel.define('res_coal', {
	palette: {
		'o': '#1a120a', 'K': '#3a3a3a', 'k': '#1e1e1e', 'S': '#5a5a5a'
	},
	grid: [
		'............',
		'............',
		'.....oo.....',
		'....oKKo....',
		'...oKkkKo...',
		'...oKkSkKo..',
		'...oKkkKKo..',
		'....oKKKo...',
		'.....oKo....',
		'.....oo.....',
		'............',
		'............'
	]
});

// —— 硫磺 ——
Pixel.define('res_sulphur', {
	palette: {
		'o': '#1a120a', 'Y': '#e0c01a', 'y': '#a89010'
	},
	grid: [
		'............',
		'............',
		'.....oo.....',
		'....oYYo....',
		'...oYyYYo...',
		'...oYYYyYo..',
		'...oYYyYYo..',
		'....oYYYo...',
		'.....oYo....',
		'.....oo.....',
		'............',
		'............'
	]
});

// —— 钢 ——
Pixel.define('res_steel', {
	palette: {
		'o': '#1a120a', 'S': '#b9c0c4', 's': '#8a9296', 'T': '#e6eaec'
	},
	grid: [
		'............',
		'............',
		'....oooo....',
		'...oSSSSo...',
		'..oSTssTSo..',
		'..oSsSSsSo..',
		'..oSTTssSo..',
		'..oSssSSSo..',
		'...oSSSSo...',
		'....oooo....',
		'............',
		'............'
	]
});

// —— 子弹 ——
Pixel.define('res_bullets', {
	palette: {
		'o': '#1a120a', 'G': '#c8a030', 'g': '#9a7a20', 'S': '#e0d8a0'
	},
	grid: [
		'............',
		'............',
		'...oo..oo...',
		'..oGGooGGo..',
		'..oGGooGGo..',
		'..oGSooGSo..',
		'..oGGooGGo..',
		'...oo..oo...',
		'....o..o....',
		'............',
		'............',
		'............'
	]
});

// —— 药 ——
Pixel.define('res_medicine', {
	palette: {
		'o': '#1a120a', 'W': '#e8e8e8', 'w': '#c8c8c8', 'R': '#c04a3a', 'B': '#3a5a8a'
	},
	grid: [
		'............',
		'...oooooo...',
		'..oWWWWWWo..',
		'..oWWRRWWo..',
		'..oWRRRRWo..',
		'..oWRRRRWo..',
		'..oWRRRRWo..',
		'..oWWRRWWo..',
		'..oWWBBWWo..',
		'...oooooo...',
		'............',
		'............'
	]
});

// —— 水 ——
Pixel.define('res_water', {
	palette: {
		'o': '#1a120a', 'B': '#4a7aa0', 'b': '#2a4a68', 'T': '#8ab8d8'
	},
	grid: [
		'............',
		'............',
		'...oooooo...',
		'..oBBBBBBo..',
		'..oBTbBBBo..',
		'..oBbTBBBb..',
		'..oBBBBbBo..',
		'..oBBbTBBo..',
		'..oBBBBBBo..',
		'...oooooo...',
		'............',
		'............'
	]
});

// —— 护符 ——
Pixel.define('res_charm', {
	palette: {
		'o': '#1a120a', 'W': '#c8a070', 'B': '#4a7aa0', 'R': '#a04a2a', 'F': '#8a6a2a'
	},
	grid: [
		'............',
		'...oooooo...',
		'..oWWWWWWo..',
		'..oWFFFFWo..',
		'..oWFRRFWo..',
		'..oWFRRFWo..',
		'..oWFFFFWo..',
		'..oWWWWWWo..',
		'...oBooBo...',
		'....o..o....',
		'............',
		'............'
	]
});

// —— 手雷 ——
Pixel.define('res_grenade', {
	palette: {
		'o': '#1a120a', 'G': '#5a7a2a', 'g': '#3a5a1a', 'S': '#8a9296', 'R': '#e08a1a'
	},
	grid: [
		'............',
		'............',
		'......oS....',
		'.....oSo....',
		'....oSSSoo..',
		'...oGGGGo...',
		'..oGGgGGGo..',
		'..oGgGGgGo..',
		'..oGGgGGGo..',
		'...oGGGGo...',
		'....ooooo...',
		'............'
	]
});

// —— 能量电池 ——
Pixel.define('res_energycell', {
	palette: {
		'o': '#1a120a', 'B': '#4a7aa0', 'b': '#2a4a68', 'S': '#c0ccd0', 'R': '#e0c01a'
	},
	grid: [
		'............',
		'............',
		'...oooooo...',
		'..oBBBBBBo..',
		'..oBBRRBBo..',
		'..oBBRRBSo..',
		'..oBBSBBBSo.',
		'..oBBBBBBo..',
		'..oBBBBBBo..',
		'...oooooo...',
		'............',
		'............'
	]
});

// —— 步枪 ——
Pixel.define('res_rifle', {
	palette: {
		'o': '#1a120a', 'W': '#8a6a3a', 'w': '#5a3a1e', 'S': '#9aa0a5', 'K': '#4a3018'
	},
	grid: [
		'............',
		'............',
		'............',
		'............',
		'............',
		'..oooooooooo',
		'.oWKwwwWWWWo',
		'..oWWWWWWWo.',
		'...ooooo....',
		'...oKKo.....',
		'...oKKo.....',
		'.............'
	]
});

// —— 骨枪 ——
Pixel.define('res_bonespear', {
	palette: {
		'o': '#1a120a', 'B': '#e0d8b8', 'b': '#b0a078', 'W': '#8a6a3a', 'w': '#5a3a1e'
	},
	grid: [
		'.....oo.....',
		'....oBBo....',
		'...oBBBBo...',
		'...oBbBBo...',
		'....oBBo....',
		'.....oWo....',
		'.....oWo....',
		'.....oWo....',
		'.....oWo....',
		'.....oWo....',
		'....oWwWo...',
		'.....oo.....'
	]
});

// —— 铁剑 ——
Pixel.define('res_ironsword', {
	palette: {
		'o': '#1a120a', 'S': '#9aa2a8', 's': '#6a7076', 'T': '#d0d6da', 'W': '#8a6a3a', 'w': '#5a3a1e'
	},
	grid: [
		'.....oo.....',
		'....oSTSo...',
		'....oSsSo...',
		'....oSsSo...',
		'....oSsSo...',
		'....oSTSo...',
		'...oSSSSSo..',
		'.....oWo....',
		'.....oWo....',
		'....oWoWo...',
		'....oWwWo...',
		'.....ooo....'
	]
});

// —— 钢剑 ——
Pixel.define('res_steelsword', {
	palette: {
		'o': '#1a120a', 'S': '#c8d2d8', 's': '#8a98a0', 'T': '#f0f6f8', 'B': '#4a7aa0', 'b': '#2a4a68'
	},
	grid: [
		'.....oo.....',
		'....oSTSo...',
		'...oSTTSo...',
		'...oSTsSo...',
		'...oSTsSo...',
		'....oSTSo...',
		'...oSSSSSo..',
		'.....oBo....',
		'.....oBo....',
		'....oBbBo...',
		'....oBBBo...',
		'.....oo.....'
	]
});

// —— 套索（投石索）——
Pixel.define('res_bolas', {
	palette: {
		'o': '#1a120a', 'S': '#c8a870', 's': '#9a7a40', 'R': '#6a6a6a', 'r': '#4a4a4a'
	},
	grid: [
		'............',
		'..ooo..ooo..',
		'.oRSo..oRSo.',
		'.oRSo..oRSo.',
		'..ooo..ooo..',
		'...oSo.oSo..',
		'....oSoSo...',
		'.....oSSo...',
		'.....oSo....',
		'....oSo.....',
		'...oSo......',
		'............'
	]
});

// —— 刺刀 ——
Pixel.define('res_bayonet', {
	palette: {
		'o': '#1a120a', 'S': '#c8d2d8', 's': '#8a98a0', 'T': '#f0f6f8', 'W': '#8a6a3a', 'w': '#5a3a1e'
	},
	grid: [
		'.....oo.....',
		'....oSTSo...',
		'....oSTsSo..',
		'....oSTSo...',
		'....oSTSo...',
		'....oSTSo...',
		'....oSTSo...',
		'....oSSSo...',
		'...oSSsSo...',
		'.....oWo....',
		'....oWWWo...',
		'.....oo.....'
	]
});

// —— 能量剑（造物台武器）——
Pixel.define('res_energyblade', {
	palette: {
		'o': '#0a1616', 'E': '#5ae0f0', 'e': '#2a98b0', 'W': '#eaffff', 'K': '#3a3a3a', 'k': '#2a2a2a'
	},
	grid: [
		'.....oo.....',
		'....oEEo....',
		'....oEeEo...',
		'...oEWWWEo..',
		'...oEWWWEo..',
		'...oEWWWEo..',
		'...oEWWWEo..',
		'....oEeEo...',
		'....oEEo....',
		'.....oKo....',
		'....oKKKo...',
		'.....oo.....'
	]
});

// —— 激光步枪（造物台武器）——
Pixel.define('res_laserrifle', {
	palette: {
		'o': '#1a120a', 'M': '#5a6a72', 'm': '#3a4a52', 'W': '#8a96a0', 'E': '#5ae0f0', 'e': '#2a98b0', 'K': '#3a3a3a'
	},
	grid: [
		'............',
		'............',
		'............',
		'............',
		'............',
		'..oooooooooo',
		'.oWmWWWWEEeo',
		'..oMWWWWEEo.',
		'...ooooo....',
		'...oKKo.....',
		'...oKKo.....',
		'.............'
	]
});

// —— 等离子步枪（造物台武器）——
Pixel.define('res_plasma_rifle', {
	palette: {
		'o': '#1a120a', 'M': '#4a5a62', 'm': '#3a4a52', 'W': '#8a96a0',
		'V': '#b06af0', 'v': '#7a3ac0', 'G': '#e0c0ff', 'K': '#3a3a3a'
	},
	grid: [
		'............',
		'............',
		'............',
		'............',
		'............',
		'..oooooooooo',
		'.oWmWVVVVGGo',
		'..oMWVVVVGo.',
		'...ooooo....',
		'...oKKo.....',
		'...oKKo.....',
		'.............'
	]
});

// —— 干扰器（造物台武器，眩晕）——
Pixel.define('res_disruptor', {
	palette: {
		'o': '#1a120a', 'W': '#8a96a0', 'm': '#4a5a62', 'K': '#3a3a3a',
		'Y': '#ffe15a', 'y': '#c8a020'
	},
	grid: [
		'............',
		'............',
		'............',
		'............',
		'............',
		'...oooooo...',
		'..oWWYYYWWo.',
		'..omWWYYWWo.',
		'....oWWWo...',
		'....oKKo....',
		'....oKKo....',
		'....oooo....'
	]
});

// —— 外星合金 ——
Pixel.define('res_alienalloy', {
	palette: {
		'o': '#1a120a', 'P': '#a05ad0', 'G': '#7ad87a', 'g': '#3a8a3a', 'T': '#e0ffe0'
	},
	grid: [
		'............',
		'...oooooo...',
		'..oPPPPPPo..',
		'.oPGTTGGPPo.',
		'.oPGgGGgPPo.',
		'.oPGgGGGPPo.',
		'.oPGgGGgPPo.',
		'.oPGTTGGPPo.',
		'..oPPPPPPo..',
		'...oooooo...',
		'............',
		'............'
	]
});

// —— 罗盘 ——
Pixel.define('res_compass', {
	palette: {
		'o': '#1a120a', 'B': '#c8a030', 'b': '#9a7a20', 'W': '#e8e8e8', 'R': '#c04a3a', 'w': '#6a6a6a'
	},
	grid: [
		'............',
		'...oooooo...',
		'..oBBBBBBo..',
		'.oBWWWWWWBo.',
		'.oBWWRRWWBo.',
		'.oBWWRRWWBo.',
		'.oBWWWWWWBo.',
		'.oBbWWWWbBo.',
		'..oBBBBBBo..',
		'...oooooo...',
		'............',
		'............'
	]
});

// —— 注射剂（hypo，一支注射器）——
Pixel.define('res_hypo', {
	palette: {
		'o': '#1a120a', 'W': '#e8e8e8', 'w': '#b8b8b8', 'B': '#4a7ad0', 'N': '#8a8a8a'
	},
	grid: [
		'............',
		'.....oooo...',
		'...oWWWWWWo.',
		'...oWWWWWWo.',
		'...oWWBBWWo.',
		'...oWWBBWWo.',
		'...oWWBBWWo.',
		'...oWWWWWWo.',
		'....oWWWWo..',
		'....oNNNNo..',
		'.....oNNo...',
		'............'
	]
});

// —— 兴奋剂（stim，装有橙色能量液的小瓶）——
Pixel.define('res_stim', {
	palette: {
		'o': '#1a120a', 'G': '#8a6a3a', 'Y': '#ffd23a', 'R': '#f07030', 'W': '#fff8d0'
	},
	grid: [
		'............',
		'....oooo....',
		'....oYYo....',
		'....oYYo....',
		'...oooooo...',
		'..oGRRRRGo..',
		'..oGRWWRGo..',
		'..oGRWWRGo..',
		'..oGRRRRGo..',
		'...oGGGGo...',
		'....oooo....',
		'............'
	]
});

// —— 辉光石（glowstone，发光球体）——
Pixel.define('res_glowstone', {
	palette: {
		'o': '#1a120a', 'C': '#35d0e0', 'c': '#7ae8f0', 'W': '#e0ffff', 'Y': '#f4e05a'
	},
	grid: [
		'............',
		'...oooooo...',
		'..oCCCCCCo..',
		'..oCWWCCCc..',
		'..oCWCCCCo..',
		'..oCCcCCCo..',
		'..oCCcCCCo..',
		'..oCCCCCCo..',
		'..oCCYYCCo..',
		'...oCCCCo...',
		'............',
		'............'
	]
});

// —— 通用物资（未知物资的兜底）——
Pixel.define('res_generic', {
	palette: {
		'o': '#1a120a', 'K': '#6a6a6a', 'k': '#4a4a4a'
	},
	grid: [
		'............',
		'............',
		'...oooooo...',
		'..oKKKKKKo..',
		'..oKkKKkKo..',
		'..oKKkkKKo..',
		'..oKkKKkKo..',
		'..oKKKKKKo..',
		'..oKKKKKKo..',
		'...oooooo...',
	'............',
	'............'
	]
});

// —— 火焰（生火 / 添柴按钮）——
Pixel.define('fx_fire', {
	palette: {
		'o': '#5a2410', 'F': '#ff7a1a', 'f': '#ffd24a'
	},
	grid: [
		'............',
		'.....oo.....',
		'....oFFo....',
		'...oFFFFo...',
		'..oFFFfFFo..',
		'..oFfffFFo..',
		'.oFFfo.oFFo.',
		'.oFFo...oFFo',
		'.oFo.....oF.',
		'..o.......o.',
		'............',
		'............'
	]
});

/* ============================================================
 * 太空界面（升空后）
 * ============================================================ */

// —— 太空：玩家飞船（俯视，机头向上）——
Pixel.define('space_ship', {
	palette: {
		'o': '#1a120a', 'W': '#f0f0f0',
		'B': '#4a7aa0', 'b': '#2a4a68',
		'S': '#8a9296', 's': '#5a6064',
		'w': '#3a4a5a', 'R': '#ff7a2a'
	},
	grid: [
		'............',
		'.....oo.....',
		'....oWWo....',
		'....oBBo....',
		'....oBBo....',
		'....oSSo....',
		'....oSSo....',
		'...oSSSSo...',
		'..oSSwwSSo..',
		'..oSSwwSSo..',
		'.oSSSWWSSSo.',
		'.oBBo..oBBo.',
		'.oRRo..oRRo.',
		'..oo....oo..'
	]
});

// —— 太空：陨石（按原字符分类，5 种配色）——
(function() {
	var _grid = [
		'............',
		'....oo......',
		'...oKKKo....',
		'..oKkKKKo...',
		'.oKkKKkkKo..',
		'.oKKkkKKKo..',
		'.oKkKKKkKo..',
		'..oKKkkKKo..',
		'..oKKKKKo...',
		'...oKKKo....',
		'....ooo.....',
		'............'
	];
	var _pals = [
		{ 'o': '#1a120a', 'K': '#6a6a6a', 'k': '#4a4a4a' },   // #
		{ 'o': '#1a120a', 'K': '#8a6a4a', 'k': '#6a4a2e' },   // $
		{ 'o': '#1a120a', 'K': '#7a7a52', 'k': '#565636' },   // %
		{ 'o': '#1a120a', 'K': '#5a7aa0', 'k': '#3a5a78' },   // &
		{ 'o': '#1a120a', 'K': '#d0b05a', 'k': '#a08038' }    // H
	];
	var _names = ['space_ast_a', 'space_ast_b', 'space_ast_c', 'space_ast_d', 'space_ast_e'];
	for(var i = 0; i < _names.length; i++) {
		Pixel.define(_names[i], { palette: _pals[i], grid: _grid });
	}
})();

/* ============================================================
 * 查询辅助
 * ============================================================ */

/**
 * 根据物资名返回对应的像素图标精灵名。
 * 已知物资用定制的图标，未知物资用通用图标兜底。
 */
Pixel.resourceSprite = function(name) {
	name = String(name).toLowerCase().replace(/ /g, '');
	var map = {
		'wood': 'res_wood',
		'fur': 'res_fur',
		'meat': 'res_meat',
		'curedmeat': 'res_curedmeat',
		'cloth': 'res_cloth',
		'leather': 'res_leather',
		'scales': 'res_scales',
		'teeth': 'res_teeth',
		'bait': 'res_bait',
		'iron': 'res_iron',
		'coal': 'res_coal',
		'sulphur': 'res_sulphur',
		'steel': 'res_steel',
		'bullets': 'res_bullets',
		'medicine': 'res_medicine',
		'water': 'res_water',
		'charm': 'res_charm',
		'grenade': 'res_grenade',
		'energycell': 'res_energycell',
		'energyblade': 'res_energyblade',
		'laserrifle': 'res_laserrifle',
		'plasmarifle': 'res_plasma_rifle',
		'disruptor': 'res_disruptor',
		'rifle': 'res_rifle',
		'bonespear': 'res_bonespear',
		'ironsword': 'res_ironsword',
		'steelsword': 'res_steelsword',
		'bolas': 'res_bolas',
		'bayonet': 'res_bayonet',
		'alienalloy': 'res_alienalloy',
		'compass': 'res_compass',
		'hypo': 'res_hypo',
		'stim': 'res_stim',
		'glowstone': 'res_glowstone'
	};
	return map[name] || 'res_generic';
};

/**
 * 根据建筑名返回对应的像素图标精灵名。
 */
Pixel.buildingSprite = function(name) {
	name = String(name).toLowerCase();
	var map = {
			'hut': 'bld_hut',
			'trap': 'bld_trap',
			'baited trap': 'bld_trap',
			'cart': 'bld_cart',
			'lodge': 'bld_lodge',
			'trading post': 'bld_trading',
			'tannery': 'bld_tannery',
			'smokehouse': 'bld_smokehouse',
			'workshop': 'bld_workshop',
			'steelworks': 'bld_steelworks',
			'armoury': 'bld_armoury',
			'iron mine': 'res_iron',
			'coal mine': 'res_coal',
			'sulphur mine': 'res_sulphur',
			'torch': 'tool_torch',
			'waterskin': 'upgrade_waterskin',
			'cask': 'upgrade_cask',
			'water tank': 'upgrade_water_tank',
			'fluid recycler': 'upgrade_fluid_recycler',
			'rucksack': 'upgrade_rucksack',
			'wagon': 'upgrade_wagon',
			'convoy': 'upgrade_convoy',
			'cargo drone': 'upgrade_cargo_drone',
			'l armour': 'upgrade_l_armour',
			'i armour': 'upgrade_i_armour',
			's armour': 'upgrade_s_armour',
			'kinetic armour': 'upgrade_kinetic_armour'
		};
	return map[name] || null;
};

/**
 * 根据战斗敌方名返回对应的精灵名。
 */
Pixel.fighterSprite = function(name) {
	name = String(name).toLowerCase();
	var map = {
		// —— 野兽（狼 / 恶犬）——
		'snarling beast': 'beast',
		'beast': 'beast',
		'beastly matriarch': 'terror',
		// —— 人形敌人（村民 / 匪徒）——
		'gaunt man': 'raider',
		'shivering man': 'raider',
		'scavenger': 'raider',
		'thug': 'raider',
		'madman': 'raider',
		'vigilante': 'raider',
		'frail man': 'raider',
		'old man': 'raider',
		'man': 'raider',
		'squatter': 'raider',
		'squatters': 'raider',
		'youth': 'raider',
		// —— 怪鸟 ——
		'strange bird': 'bird',
		'bird': 'bird',
		// —— 蜥蜴 / 鼠群 ——
		'lizard': 'lizard',
		'cave lizard': 'lizard',
		'lizards': 'lizard',
		'rats': 'lizard',
		// —— 士兵类 ——
		'soldier': 'soldier',
		'sniper': 'soldier',
		'veteran': 'soldier',
		'commando': 'soldier',
		// —— 猛兽 / 变异体 ——
		'man-eater': 'terror',
		'feral terror': 'terror',
		'deformed': 'terror',
		'tentacles': 'terror',
		'chief': 'terror',
		// —— 双头怪 ——
		'two-headed creature': 'twohead',
		// —— 机械 / 机器人（处刑者场景）——
		'mechanical guard': 'robot',
		'broken medic': 'robot',
		'operative': 'soldier',
		'unruly welder': 'robot',
		'unstable prototype': 'robot',
		'murderous robot': 'robot',
		'unstable automaton': 'robot',
		'immortal wanderer': 'robot',
		// —— 机械四足兽 ——
		'mechanical quadruped': 'mechquad',
		// —— 炮塔 ——
		'defence turret': 'turret',
		'automated turret': 'turret',
		// —— 几丁质 / 异形 ——
		'chitinous horror': 'chitin',
		'chitinous queen': 'chitin',
		'ancient beast': 'chitin',
		'malformed experiment': 'chitin',
		// —— 研究员 ——
		'researcher': 'researcher'
	};
	return map[name] || null;
};

/**
 * 由世界地图的地形字符返回瓦片 CSS 类名（纯色瓦片）。
 */
Pixel.tileClass = function(c) {
	return this.TERRAIN_CLASS[c] || null;
};

// —— 通知：温度计（房间温度状态）——
Pixel.define('fx_temp', {
	palette: {
		'o': '#2a1a10', 'B': '#4a7ab0', 'R': '#d9432a'
	},
	grid: [
		'............',
		'.....oo.....',
		'....oBBo....',
		'....oBBo....',
		'....oBBo....',
		'....oBBo....',
		'....oBBo....',
		'....oBBo....',
		'...oRBBRo...',
		'...oRRRRo...',
		'....oRRo....',
		'............'
	]
});

// —— 通知：通用消息气泡（无法识别内容的通用消息兜底图标）——
Pixel.define('notify_generic', {
	palette: {
		'o': '#3a4a5a', 'w': '#aebfcf', 'd': '#4a5a6a'
	},
	grid: [
		'............',
		'..oooooooo..',
		'.owwwwwwwwo.',
		'.owwwwwwwwo.',
		'.owwddwwdwo.',
		'.owwwwwwwwo.',
		'.owwddwwdwo.',
		'.owwwwwwwwo.',
		'.oooooooooo.',
		'....oo......',
		'...oo.......',
		'............'
	]
});

// —— 增减通用箭头（统一 icon，向下通过 CSS 旋转 180°）——
// 不对称三角：尖端朝上表示「+」，旋转 180° 表示「-」
Pixel.define('arrow', {
	palette: { 'o': '#1a120a', 'p': '#e8b25a' },
	grid: [
		'.....oo.....',
		'....oppo....',
		'...oppppo...',
		'..oppppppo..',
		'.oppppppppo.',
		'.oppppppppo.',
		'..oppppppo..',
		'...oppppo...',
		'....oppo....',
		'.....oo.....',
		'............',
		'............'
	]
});

/**
 * 根据通知文本内容推断一个合适的像素图标精灵名。
 * 通过关键词（中/英文）匹配，返回精灵名；无法识别时返回通用气泡图标。
 * 规则按「具体 → 通用」排序，避免子串误判（如 fur 命中 sulphur）。
 */
Pixel.notificationIcon = function(text) {
	text = String(text).toLowerCase();
	var rules = [
		// —— 具体物资（长词优先，避免子串误判）——
		['res_curedmeat',  ['cured meat', 'curedmeat', '腌肉', '熏肉', '腌制']],
		['res_energycell', ['energy cell', 'energycell', '电池']],
		['bld_trading',    ['trading post', '贸易站', '交易站']],
		['res_sulphur',    ['sulphur', 'sulfur', '硫磺', '硫']],
		['bld_smokehouse', ['smokehouse', '熏肉房', '烟熏房']],
		['bld_steelworks', ['steelworks', '炼钢厂']],
		['bld_armoury',    ['armoury', 'armory', '军械库', '盔甲坊']],
		['bld_tannery',    ['tannery', '制革厂', '皮革厂']],
		['bld_workshop',   ['workshop', '工坊']],
		['res_steel',      ['steel', '钢']],
		['res_medicine',   ['medicine', '药']],
		['res_grenade',    ['grenade', '手雷', '手榴弹']],
		['res_bullets',    ['bullet', '子弹', '弹药']],
		['res_cloth',      ['cloth', '布']],
		['res_leather',    ['leather', '皮革']],
		['res_scales',     ['scales', '鳞片']],
		['res_teeth',      ['teeth', '牙']],
		['res_bait',       ['bait', '诱饵', '饵']],
		['res_rifle',      ['rifle', '步枪', '激光枪']],
		['res_charm',      ['charm', '护符']],
		['res_iron',       ['iron', '铁']],
		['res_coal',       ['coal', '煤炭', '煤']],
		['res_fur',        ['fur', '毛皮', '兽皮']],
		['res_meat',       ['meat', '肉']],
		['res_wood',       ['wood', '木头', '木材', '柴']],
		['lm_city',        ['city', '城市']],
		['lm_village',     ['village', '村庄', '村子', '小镇']],
		['lm_outpost',     ['outpost', '前哨']],
		// —— 建筑 ——
		['bld_hut',        ['hut', '小屋', '茅屋', '木屋']],
		['bld_trap',       ['trap', '陷阱']],
		['bld_cart',       ['cart', '推车', '马车']],
		['bld_lodge',      ['lodge', '猎人小屋', '狩猎']],
		// —— 关键人物（高于 fire，避免陌生人剧情被火图标抢占）——
		['player',         ['stranger', 'scout', '陌生人', '流浪者', '旅行者', '冒险者']],
		// —— 火 ——
		['fx_fire',        ['fire', '火', '烟火', 'firelit', '燃烧', '熊熊', '熄灭']],
		// —— 温度 ——
		['fx_temp',        ['freezing', 'cold', 'mild', 'warm', 'hot', 'freeze', '冰冷', '寒冷', '暖和', '炎热', '凉爽', '温度', '室温', '寒风']],
		// —— 建造者 / 工人 ——
		['player',         ['builder', '建造者', '建筑工', '工人', '伐木']],
		// —— 小偷 ——
		['raider',         ['thief', 'thieves', '小偷', '窃贼']],
		// —— 战斗 ——
		['beast',          ['beast', '野兽', '狼']],
		['raider',         ['attack', 'attacked', '袭击', '攻击', '伏击']],
		['player',         ['survive', '败退', '杀']]
	];
	for(var i = 0; i < rules.length; i++) {
		var sprite = rules[i][0];
		var kws = rules[i][1];
		for(var j = 0; j < kws.length; j++) {
			if(text.indexOf(kws[j]) !== -1) {
				if(this.sprites[sprite]) return sprite;
				break;
			}
		}
	}
	// 无法识别内容的通用消息，用通用气泡图标兜底
	return this.sprites['notify_generic'] ? 'notify_generic' : null;
};

export { Pixel };
export default Pixel;