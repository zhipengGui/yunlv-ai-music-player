// ============================================
// 云律 AI · 答辩 PPT 生成脚本（15 页）
// 运行: NODE_PATH=$(npm root -g) node build_ppt.js
// ============================================
const { execSync } = require("child_process");
const path = require("path");
const pptxgen = require(path.join(execSync("npm root -g").toString().trim(), "pptxgenjs"));

// ---------- 配色（云律蓝紫主题） ----------
const C = {
  bgDark:   "0F1235", // 深色背景
  bgDark2:  "1B1F4A", // 深色卡片
  bgLight:  "F4F5FB", // 浅色背景
  card:     "FFFFFF",
  primary:  "5B8CFF", // 云律蓝紫主色
  purple:   "A78BFA", // 淡紫
  pink:     "F472B6", // 粉紫强调
  textDark: "2A2D45",
  textMid:  "5A5E7A",
  textMute: "8B8FB8",
  ok:       "34C77B",
  warnBg:   "FDE8E8",
  warnTxt:  "C0392B",
};

const FONT = "Microsoft YaHei";
const MONO = "Consolas";

const W = 13.33, H = 7.5;
const TOTAL = 19;
const shadow = () => ({ type: "outer", color: "1B1F4A", blur: 8, offset: 2, angle: 90, opacity: 0.18 });

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.author = "云律 AI";
pres.title = "云律 AI 项目答辩";

// ---------- 辅助函数 ----------
function header(slide, title, page) {
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 0.46, w: 0.2, h: 0.2, fill: { color: C.primary } });
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.74, y: 0.34, w: 0.2, h: 0.2, fill: { color: C.purple } });
  slide.addText(title, { x: 1.05, y: 0.24, w: 10.5, h: 0.6, fontFace: FONT, fontSize: 26, bold: true, color: C.textDark, margin: 0, valign: "middle" });
  slide.addText(`${page} / ${TOTAL}`, { x: 11.7, y: 0.34, w: 1.03, h: 0.4, fontFace: FONT, fontSize: 11, color: C.textMute, align: "right", margin: 0 });
  slide.addText("云律 AI · 项目答辩", { x: 0.6, y: 7.05, w: 3, h: 0.3, fontFace: FONT, fontSize: 9.5, color: C.textMute, margin: 0 });
  slide.addText("2026.09", { x: 11.35, y: 7.05, w: 1.38, h: 0.3, fontFace: FONT, fontSize: 9.5, color: C.textMute, align: "right", margin: 0 });
}

function card(slide, x, y, w, h, fill = C.card, radius = 0.1) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, rectRadius: radius, shadow: shadow() });
}

function tag(slide, x, y, w, h, text, bg = C.bgDark2, color = "FFFFFF", size = 10.5, bold = false) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: bg }, rectRadius: h / 2 });
  slide.addText(text, { x, y, w, h, fontFace: FONT, fontSize: size, color, align: "center", valign: "middle", margin: 0, bold });
}

function numBadge(slide, x, y, num, label, numColor = C.primary, labelColor = C.textMid) {
  slide.addText(num, { x, y, w: 2.9, h: 0.85, fontFace: FONT, fontSize: 34, bold: true, color: numColor, margin: 0, valign: "middle" });
  slide.addText(label, { x: x + 0.02, y: y + 0.82, w: 2.9, h: 0.4, fontFace: FONT, fontSize: 12.5, color: labelColor, margin: 0 });
}

function arrow(slide, x, y, color = C.purple, size = 20) {
  slide.addText("→", { x, y, w: 0.4, h: 0.5, fontFace: FONT, fontSize: size, bold: true, color, align: "center", valign: "middle", margin: 0 });
}

// ---------- 截图插入（白边圆角垫片 + 阴影） ----------
const IMG_DIR = path.join(__dirname, "..", "ppt所用图片");
function shot(slide, file, x, y, w, h) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x - 0.07, y: y - 0.07, w: w + 0.14, h: h + 0.14, fill: { color: "FFFFFF" }, rectRadius: 0.07, shadow: shadow() });
  slide.addImage({ path: path.join(IMG_DIR, file), x, y, w, h });
}

// ============================================
// 第 1 页 · 封面（深色）
// ============================================
{
  const s = pres.addSlide();
  s.background = { color: C.bgDark };
  // 装饰圆环与音符
  s.addShape(pres.shapes.OVAL, { x: 10.9, y: -1.4, w: 4.2, h: 4.2, line: { color: C.primary, width: 2 }, fill: { color: "0F1235" } });
  s.addShape(pres.shapes.OVAL, { x: 11.5, y: -0.8, w: 3.0, h: 3.0, line: { color: C.purple, width: 1.5 }, fill: { color: "0F1235" } });
  s.addShape(pres.shapes.OVAL, { x: -1.6, y: 5.6, w: 3.4, h: 3.4, line: { color: C.purple, width: 1.5 }, fill: { color: "0F1235" } });
  s.addText("♪  ♫  ♬", { x: 10.0, y: 1.3, w: 3.0, h: 0.8, fontFace: FONT, fontSize: 20, color: "5B8CFF", align: "right", margin: 0, charSpacing: 6 });

  s.addText("项目答辩 · 2026", { x: 0.6, y: 0.85, w: 12.13, h: 0.5, fontFace: FONT, fontSize: 14, color: C.textMute, charSpacing: 6, margin: 0 });
  s.addText("云律 AI", { x: 0.6, y: 1.75, w: 12.13, h: 1.5, fontFace: FONT, fontSize: 64, bold: true, color: "FFFFFF", align: "center", margin: 0, charSpacing: 8 });
  s.addText("一款「懂情绪」的音乐播放器", { x: 0.6, y: 3.3, w: 12.13, h: 0.7, fontFace: FONT, fontSize: 26, color: "C7D2FE", align: "center", margin: 0 });
  s.addText("用 AI 理解你的心情，用数据读懂你的品味", { x: 0.6, y: 4.05, w: 12.13, h: 0.5, fontFace: FONT, fontSize: 16, italic: true, color: C.textMute, align: "center", margin: 0 });

  const tagRow = (list, y) => {
    const widths = list.map(t => 0.62 + t.length * 0.22);
    let total = widths.reduce((a, b) => a + b, 0) + (list.length - 1) * 0.25;
    let x = (13.33 - total) / 2;
    list.forEach((t, i) => {
      tag(s, x, y, widths[i], 0.5, t, C.bgDark2, "DDE3FF", 11);
      x += widths[i] + 0.25;
    });
  };
  tagRow(["Django 6.1", "原生 JS", "SQLite", "智谱 GLM"], 4.72);
  tagRow(["PWA", "花生壳内网穿透", "阿里云 OSS"], 5.34);
  s.addText("答辩人：＿＿＿        学号：＿＿＿        班级：＿＿＿        指导教师：＿＿＿", {
    x: 0.6, y: 6.15, w: 12.13, h: 0.5, fontFace: FONT, fontSize: 14, color: "B9BEDD", align: "center", margin: 0, charSpacing: 2
  });
}

// ============================================
// 第 2 页 · 项目概述
// ============================================
{
  const s = pres.addSlide();
  s.background = { color: C.bgLight };
  header(s, "项目概述", 2);

  // 左侧定位卡
  card(s, 0.6, 1.25, 5.4, 2.15);
  s.addText([
    { text: "项目定位", options: { fontFace: FONT, fontSize: 13, bold: true, color: C.primary, breakLine: true, paraSpaceAfter: 6 } },
    { text: "一款「懂情绪」的音乐播放器：告诉它你的心情，它帮你选歌；听完歌，它用数据告诉你是一个什么样的听歌人。", options: { fontFace: FONT, fontSize: 14.5, color: C.textDark, breakLine: true } }
  ], { x: 0.9, y: 1.45, w: 4.85, h: 1.8, valign: "middle" });

  // 左侧技术栈卡
  card(s, 0.6, 3.6, 5.4, 2.05);
  s.addText("技术栈", { x: 0.9, y: 3.78, w: 2, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: C.primary, margin: 0 });
  const stack = [
    ["后端", "Django 6.1 · 8 大业务 App 全部置于 apps/"],
    ["前端", "原生 JS · 21+ 个模块化文件（零框架）"],
    ["数据", "SQLite + localStorage · 统一 ListenRecord 埋点"],
    ["AI", "智谱 GLM · 情绪分析与语义理解引擎"],
  ];
  stack.forEach((r, i) => {
    s.addShape(pres.shapes.OVAL, { x: 0.9, y: 4.32 + i * 0.32, w: 0.12, h: 0.12, fill: { color: i % 2 ? C.purple : C.primary } });
    s.addText([
      { text: r[0] + "  ", options: { fontFace: FONT, fontSize: 12, bold: true, color: C.textDark } },
      { text: r[1], options: { fontFace: FONT, fontSize: 11.5, color: C.textMid } }
    ], { x: 1.1, y: 4.2 + i * 0.32, w: 4.7, h: 0.32, margin: 0, valign: "middle" });
  });

  // 开发周期条
  card(s, 0.6, 5.85, 5.4, 0.85);
  s.addText("开发周期", { x: 0.9, y: 5.98, w: 1.5, h: 0.6, fontFace: FONT, fontSize: 13, bold: true, color: C.primary, margin: 0, valign: "middle" });
  s.addText("2026.08.28 → 09.02", { x: 2.15, y: 5.98, w: 2.15, h: 0.6, fontFace: FONT, fontSize: 13.5, bold: true, color: C.textDark, margin: 0, valign: "middle" });
  s.addText("单人全栈 · 6 天", { x: 4.4, y: 5.98, w: 1.55, h: 0.6, fontFace: FONT, fontSize: 12, color: C.textMute, margin: 0, valign: "middle" });

  // 右侧大数字
  const stats = [
    ["498", "首本地曲库", "461 MP3 + 37 FLAC"],
    ["3.08", "GB 曲库容量", "真实个人收藏音乐"],
    ["13,522", "行代码总量", "Python+JS+CSS+HTML+文档"],
    ["8", "大业务模块", "曲库/歌单/歌词/推荐/AI/海报/报告/大屏"],
    ["12", "类情绪标签", "贯穿点歌·打标·推荐·曲线"],
    ["16", "项完整功能", "PWA · 穿透 · OSS"],
  ];
  stats.forEach((st, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 6.45 + col * 2.1, y = 1.25 + row * 2.3;
    card(s, x, y, 1.95, 2.1);
    s.addText(st[0], { x: x + 0.12, y: y + 0.28, w: 1.71, h: 0.75, fontFace: FONT, fontSize: 30, bold: true, color: col === 1 ? C.purple : C.primary, align: "center", margin: 0 });
    s.addText(st[1], { x: x + 0.12, y: y + 1.05, w: 1.71, h: 0.4, fontFace: FONT, fontSize: 12.5, bold: true, color: C.textDark, align: "center", margin: 0 });
    s.addText(st[2], { x: x + 0.1, y: y + 1.48, w: 1.75, h: 0.5, fontFace: FONT, fontSize: 9.5, color: C.textMute, align: "center", margin: 0 });
  });
}

// ============================================
// 第 3 页 · 功能总览（16 项功能一页看全）
// ============================================
{
  const s = pres.addSlide();
  s.background = { color: C.bgLight };
  header(s, "功能总览 · 16 项功能一页看全", 3);

  const funcGroups = [
    { mod: "AI 情绪智能", color: C.primary, items: [
      ["AI 情绪点歌", "一句话说心情 · 可多轮追问换一批"],
      ["歌曲情绪打标", "498 首 · 12 类情绪标签"],
      ["逐句情绪曲线", "歌词级情绪波动可视化"],
      ["每日推荐", "标签打分 · 可解释理由"],
    ]},
    { mod: "播放与歌单", color: C.purple, items: [
      ["增强播放器", "频谱 · 均衡 · 氛围 · 断点续播"],
      ["智能歌词", "滚动高亮 · 在线两级兜底"],
      ["歌词意境海报", "Canvas 生成 · PNG 下载"],
      ["歌单管理", "创建 · 拖拽排序 · 右键加歌"],
    ]},
    { mod: "交互与体验", color: C.pink, items: [
      ["语音点歌", "Web Speech 识别 · 语义解析意图"],
      ["收藏与最近播放", "本地记忆 · 一键回播"],
      ["主题换肤", "7 套主题 · CSS 变量驱动"],
      ["PWA 安装", "桌面 · 主屏 · 全屏运行"],
    ]},
    { mod: "数据与部署", color: C.ok, items: [
      ["听歌报告", "总时长 · 最爱 · 情绪偏好"],
      ["实时数据大屏", "6 项 KPI 实时跳动"],
      ["花生壳穿透分享", "HTTPS · 口令保护 · 外网可用"],
      ["OSS 云端加速", "静态资源上云 · 首屏秒开"],
    ]},
  ];

  s.addText("4 大板块 × 16 项功能：从“听懂心情”到“听懂数据”，从本地到云端", {
    x: 0.6, y: 1.1, w: 12.13, h: 0.35, fontFace: FONT, fontSize: 12.5, bold: true, color: C.textDark, margin: 0
  });

  const rowY0 = 1.5, rowH = 1.1, rowGap = 0.12;
  funcGroups.forEach((g, gi) => {
    const y = rowY0 + gi * (rowH + rowGap);
    // 模块标签（深色竖卡）
    card(s, 0.6, y, 1.35, rowH, g.color);
    s.addText(g.mod, { x: 0.62, y: y + 0.24, w: 1.31, h: 0.6, fontFace: FONT, fontSize: 13, bold: true, color: "FFFFFF", align: "center", margin: 0 });
    s.addText("M" + (gi + 1), { x: 0.62, y: y + 0.68, w: 1.31, h: 0.3, fontFace: FONT, fontSize: 10, color: "DDE3FF", align: "center", margin: 0 });
    // 4 个功能小卡
    g.items.forEach((it, ii) => {
      const x = 2.15 + ii * 2.71;
      card(s, x, y, 2.53, rowH);
      s.addShape(pres.shapes.OVAL, { x: x + 0.18, y: y + 0.2, w: 0.34, h: 0.34, fill: { color: g.color } });
      s.addText(String(gi * 4 + ii + 1).padStart(2, "0"), { x: x + 0.18, y: y + 0.2, w: 0.34, h: 0.34, fontFace: FONT, fontSize: 9, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
      s.addText(it[0], { x: x + 0.62, y: y + 0.14, w: 1.9, h: 0.4, fontFace: FONT, fontSize: 12.5, bold: true, color: C.textDark, margin: 0 });
      s.addText(it[1], { x: x + 0.18, y: y + 0.58, w: 2.2, h: 0.5, fontFace: FONT, fontSize: 9.5, color: C.textMid, margin: 0 });
    });
  });

  s.addText("16 项功能全部真机实测 · 技术分页见 P5–P12，演示路线见 P18", {
    x: 0.6, y: rowY0 + 4 * (rowH + rowGap) + 0.1, w: 12.13, h: 0.3, fontFace: FONT, fontSize: 10, italic: true, color: C.textMute, margin: 0
  });
}

// ============================================
// 第 4 页 · 系统架构
// ============================================
{
  const s = pres.addSlide();
  s.background = { color: C.bgLight };
  header(s, "系统架构", 4);

  // 自动换行胶囊流（返回胶囊区底部 y）
  const flow = (label, yLabel, items, itemBg, itemColor) => {
    s.addText(label, { x: 0.6, y: yLabel, w: 12.13, h: 0.3, fontFace: FONT, fontSize: 13.5, bold: true, color: C.textDark, margin: 0 });
    let x = 0.6, y = yLabel + 0.36;
    for (const it of items) {
      if (x + it.w > 13.28) { x = 0.6; y += 0.64; }
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: it.w, h: 0.5, fill: { color: itemBg }, rectRadius: 0.09 });
      s.addText(it.t, { x: x + 0.05, y, w: it.w - 0.1, h: 0.5, fontFace: FONT, fontSize: it.s || 11, color: itemColor, align: "center", valign: "middle", margin: 0, bold: it.b });
      x += it.w + 0.18;
    }
    return y + 0.5;
  };

  let y = 1.25;
  y = flow("客户端", y, [
    { t: "浏览器 / 手机", w: 1.9, b: true },
    { t: "21 个前端模块（player/lyrics/mood/spectrum…）", w: 4.4 },
    { t: "PWA 可安装 · 全屏运行", w: 2.4 },
  ], C.bgDark2, "E6E9FF");
  y += 0.2;
  y = flow("Django 服务端 · 8 大板块 + 口令", y, [
    { t: "gate 口令", w: 1.35, b: true }, { t: "music 曲库·播放", w: 1.75 }, { t: "playlists 歌单", w: 1.6 },
    { t: "lyrics 歌词", w: 1.35 }, { t: "recommend 推荐", w: 1.6 },
    { t: "mood AI 情绪", w: 1.55 }, { t: "posters 海报", w: 1.5 },
    { t: "report 报告", w: 1.4 }, { t: "web 页面·大屏", w: 1.65 },
  ], C.primary, "FFFFFF");
  y += 0.2;
  y = flow("数据层", y, [
    { t: "SQLite：498 首歌 / 歌单 / 听歌记录", w: 3.5, b: true },
    { t: "本地曲库 music_library · 3.08 GB", w: 3.0 },
    { t: "localStorage：收藏 / 主题 / 断点", w: 2.9 },
  ], C.bgDark2, "E6E9FF");
  y += 0.2;
  y = flow("第三方服务", y, [
    { t: "智谱 GLM", w: 1.3, b: true }, { t: "网易云 / lrclib 歌词", w: 1.9 }, { t: "iTunes / SoundHelix 试听", w: 2.1 },
    { t: "Jamendo 15 万+ 曲库", w: 1.95 }, { t: "Web Speech 语音", w: 1.6 }, { t: "阿里云 OSS", w: 1.55, b: true },
  ], C.bgDark2, "E6E9FF");
  y += 0.24;

  // 底部亮点框
  card(s, 0.6, y, 12.13, 0.78);
  s.addText("可插拔架构", { x: 0.85, y: y + 0.11, w: 1.5, h: 0.55, fontFace: FONT, fontSize: 12.5, bold: true, color: C.primary, margin: 0, valign: "middle" });
  s.addText("新增音乐源只需继承 MusicSource 抽象类 · 换 AI 模型只改 ai_service.py · 推荐算法重写 services.py 接口不变 —— 三个扩展点，其他代码零改动", {
    x: 2.4, y: y + 0.11, w: 10.1, h: 0.55, fontFace: FONT, fontSize: 11.5, color: C.textDark, margin: 0, valign: "middle"
  });
}

// ============================================
// 第 4 页 · 核心创新 ① AI 情绪点歌台
// ============================================
{
  const s = pres.addSlide();
  s.background = { color: C.bgLight };
  header(s, "核心创新 ① · AI 情绪点歌台", 5);

  // 左栏：五步流程竖排
  card(s, 0.6, 1.3, 5.35, 4.15);
  s.addText("五步完成一次情绪点歌", { x: 0.9, y: 1.46, w: 4.6, h: 0.4, fontFace: FONT, fontSize: 15, bold: true, color: C.primary, margin: 0 });
  const steps = [
    ["输入心情 / 语音", "“今天加班好累，想听治愈纯音乐”"],
    ["智谱 GLM 分析", "语义理解 → 情绪判定"],
    ["输出结果", "情绪标签 + 曲风 + 推荐说明"],
    ["标签匹配", "12 类情绪标签优先匹配"],
    ["载入队列", "点击即播 · 播放即埋点"],
  ];
  steps.forEach((st, i) => {
    const y = 1.98 + i * 0.66;
    s.addShape(pres.shapes.OVAL, { x: 0.9, y, w: 0.4, h: 0.4, fill: { color: i === 1 ? C.pink : (i % 2 ? C.purple : C.primary) } });
    s.addText(String(i + 1), { x: 0.9, y, w: 0.4, h: 0.4, fontFace: FONT, fontSize: 15, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    s.addText(st[0], { x: 1.45, y: y - 0.04, w: 4.3, h: 0.32, fontFace: FONT, fontSize: 12.5, bold: true, color: C.textDark, margin: 0 });
    s.addText(st[1], { x: 1.45, y: y + 0.29, w: 4.3, h: 0.3, fontFace: FONT, fontSize: 10.5, color: C.textMid, margin: 0 });
  });

  // 能力胶囊
  const caps = ["多轮追问", "换一批", "可解释理由", "断网降级", "语音输入"];
  let cx = 0.9;
  caps.forEach((c, i) => {
    if (i % 3 === 0 && i > 0) { cx = 0.9; }
    const cw = 0.7 + c.length * 0.22;
    tag(s, cx, 5.62 + (i < 3 ? 0 : 0.5), cw, 0.42, c, "EEF1FF", C.primary, 10.5, true);
    cx += cw + 0.18;
  });

  // 右栏：真实运行截图
  s.addText("情绪点歌 · 真实运行截图", { x: 6.25, y: 1.3, w: 6.4, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.textDark, margin: 0 });
  shot(s, "ai情绪点歌.png", 6.25, 1.78, 6.5, 5.03);
  s.addText("输入情绪 → AI 判定 → 一键播放", { x: 6.25, y: 6.88, w: 6.5, h: 0.3, fontFace: FONT, fontSize: 10, italic: true, color: C.textMute, align: "center", margin: 0 });
}

// ============================================
// 第 5 页 · 核心创新 ② AI 歌曲情绪分类
// ============================================
{
  const s = pres.addSlide();
  s.background = { color: C.bgLight };
  header(s, "核心创新 ② · AI 歌曲情绪分类", 6);

  // 问题卡
  card(s, 0.6, 1.3, 12.13, 0.85, C.warnBg, 0.12);
  s.addShape(pres.shapes.OVAL, { x: 0.85, y: 1.5, w: 0.4, h: 0.4, fill: { color: C.warnTxt } });
  s.addText("!", { x: 0.85, y: 1.5, w: 0.4, h: 0.4, fontFace: FONT, fontSize: 18, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
  s.addText("传统方案的痛点：498 首歌被“一刀切”统一标成 happy → 情绪点歌形同虚设、推荐失去区分度", {
    x: 1.45, y: 1.3, w: 11.0, h: 0.85, fontFace: FONT, fontSize: 14.5, bold: true, color: C.warnTxt, margin: 0, valign: "middle"
  });

  // 方案流程
  const flow = [
    ["提取特征", "歌名 + 歌手\n歌词片段"],
    ["AI 逐首判定", "12 类情绪标签\n写入数据库"],
    ["结果校验", "异常 / 无歌词\n关键词规则兜底"],
  ];
  let fx = 0.6;
  flow.forEach((f, i) => {
    card(s, fx, 2.4, 3.1, 1.4);
    s.addText(f[0], { x: fx + 0.2, y: 2.56, w: 2.7, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: C.primary, margin: 0 });
    s.addText(f[1], { x: fx + 0.2, y: 2.98, w: 2.7, h: 0.7, fontFace: FONT, fontSize: 11, color: C.textMid, margin: 0 });
    if (i < 2) arrow(s, fx + 3.14, 2.95);
    fx += 3.3;
  });

  // 成果大字
  card(s, 0.6, 4.05, 12.13, 0.95, C.bgDark2);
  s.addText("498 / 498", { x: 0.9, y: 4.18, w: 2.9, h: 0.7, fontFace: FONT, fontSize: 32, bold: true, color: C.purple, margin: 0 });
  s.addText("全部歌曲完成 AI 情绪打标 · 标签体系贯穿“点歌 → 打标 → 推荐 → 情绪曲线”全链路", {
    x: 3.95, y: 4.05, w: 8.5, h: 0.95, fontFace: FONT, fontSize: 14, color: "DDE3FF", margin: 0, valign: "middle"
  });

  // 12 类情绪标签
  s.addText("12 类情绪标签体系", { x: 0.6, y: 5.2, w: 4, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: C.textDark, margin: 0 });
  const moods = ["开心", "难过", "放松", "充满活力", "平静", "浪漫", "怀旧", "专注", "疲惫", "愤怒", "孤独", "轻快"];
  let mx = 0.6, my = 5.62, mcount = 0;
  for (const m of moods) {
    tag(s, mx, my, 1.1, 0.46, m, mcount % 2 ? "EEF1FF" : "E3E9FF", mcount % 2 ? C.purple : C.primary, 11.5, true);
    mx += 1.25;
    mcount++;
    if (mcount % 6 === 0) { mx = 0.6; my += 0.6; }
  }
  s.addText("（演示曲不参与推荐，保证推荐结果质量）", { x: 8.9, y: 5.62, w: 3.8, h: 0.46, fontFace: FONT, fontSize: 10.5, italic: true, color: C.textMute, margin: 0, valign: "middle" });
}

// ============================================
// 第 6 页 · 播放体验增强
// ============================================
{
  const s = pres.addSlide();
  s.background = { color: C.bgLight };
  header(s, "播放体验 · 播放器增强", 7);

  // 左栏：2×2 功能卡
  const grid = [
    ["频谱", "Canvas 频谱可视化", "底部实时跳动动画，跟随音乐节奏变化", C.primary],
    ["均衡", "10 段均衡器", "摇滚 / 流行 / 低音 / 古典预设，实时生效", C.purple],
    ["氛围", "全屏情绪氛围背景", "随曲风变色呼吸，一键开关 + 深色遮罩", C.pink],
    ["续播", "断点续播记忆", "刷新页面从上次进度继续，不丢位置", C.primary],
  ];
  grid.forEach((g, i) => {
    const x = 0.6, y = 1.3 + Math.floor(i / 2) * 1.85;
    card(s, x, y, 6.1, 1.7);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.22, y: y + 0.2, w: 0.55, h: 0.55, fill: { color: g[3] }, rectRadius: 0.11 });
    s.addText(g[0], { x: x + 0.22, y: y + 0.2, w: 0.55, h: 0.55, fontFace: FONT, fontSize: 14, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    s.addText(g[1], { x: x + 0.92, y: y + 0.24, w: 5.0, h: 0.4, fontFace: FONT, fontSize: 15, bold: true, color: C.textDark, margin: 0 });
    s.addText(g[2], { x: x + 0.92, y: y + 0.72, w: 5.0, h: 0.8, fontFace: FONT, fontSize: 11.5, color: C.textMid, margin: 0 });
  });

  // 左下：更多细节
  card(s, 0.6, 5.15, 6.1, 1.5);
  s.addText("更多细节", { x: 0.85, y: 5.3, w: 1.3, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: C.primary, margin: 0 });
  s.addText("Media Session 锁屏控制 · 键盘快捷键 · 定时关闭 · 三种播放模式 · 封面自动生成", {
    x: 0.85, y: 5.72, w: 5.6, h: 0.8, fontFace: FONT, fontSize: 11, color: C.textDark, margin: 0
  });

  // 右栏：播放器真实截图
  s.addText("播放器 · 真实运行截图", { x: 6.95, y: 1.3, w: 5.8, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.textDark, margin: 0 });
  shot(s, "播放器界面.png", 6.95, 1.78, 5.8, 4.49);
  s.addText("频谱 / 均衡 / 氛围 / 续播 全部集成于播放器", { x: 6.95, y: 6.35, w: 5.8, h: 0.3, fontFace: FONT, fontSize: 10, italic: true, color: C.textMute, align: "center", margin: 0 });
}

// ============================================
// 第 7 页 · 实时数据大屏
// ============================================
{
  const s = pres.addSlide();
  s.background = { color: C.bgLight };
  header(s, "亮点 · 实时数据大屏", 8);

  // 顶部：6 大 KPI 指标胶囊
  const kpis = ["累计播放次数", "今日播放", "近 1 小时", "不重样歌曲", "高频播放时段", "累计播放时长"];
  kpis.forEach((k, i) => {
    const x = 0.6 + i * 1.95;
    card(s, x, 1.3, 1.8, 0.62);
    s.addShape(pres.shapes.OVAL, { x: x + 0.12, y: 1.47, w: 0.09, h: 0.09, fill: { color: C.ok } });
    s.addText(k, { x: x + 0.26, y: 1.37, w: 1.5, h: 0.26, fontFace: FONT, fontSize: 10.5, bold: true, color: C.textDark, margin: 0 });
    s.addText("实时刷新", { x: x + 0.26, y: 1.63, w: 1.5, h: 0.22, fontFace: FONT, fontSize: 9, color: C.ok, margin: 0 });
  });

  // 左竖排要点卡
  card(s, 0.55, 2.2, 1.75, 4.55);
  s.addText("实时性", { x: 0.68, y: 2.35, w: 1.5, h: 0.35, fontFace: FONT, fontSize: 12.5, bold: true, color: C.primary, margin: 0 });
  ["每 4 秒\n自动刷新", "播放即\n回流大屏", "6 KPI\n实时跳动", "全屏\n演示模式"].forEach((t, i) => {
    s.addText(t, { x: 0.68, y: 2.85 + i * 0.92, w: 1.5, h: 0.8, fontFace: FONT, fontSize: 10.5, bold: true, color: C.textDark, align: "center", margin: 0 });
  });

  // 右竖排要点卡
  card(s, 11.05, 2.2, 1.75, 4.55);
  s.addText("数据资产", { x: 11.18, y: 2.35, w: 1.5, h: 0.35, fontFace: FONT, fontSize: 12.5, bold: true, color: C.purple, margin: 0 });
  ["统一\nListenRecord\n埋点", "4 张图表\n联动", "趋势 · 分布\n榜单", "听歌报告\n数据复用"].forEach((t, i) => {
    s.addText(t, { x: 11.18, y: 2.85 + i * 0.92, w: 1.5, h: 0.8, fontFace: FONT, fontSize: 10.5, bold: true, color: C.textDark, align: "center", margin: 0 });
  });

  // 中部：大屏真实截图（16:9）
  shot(s, "数据大屏.png", 2.49, 2.15, 8.36, 4.7);
}

// ============================================
// 第 8 页 · 项目特色：花生壳内网穿透
// ============================================
{
  const s = pres.addSlide();
  s.background = { color: C.bgLight };
  header(s, "项目特色 · 花生壳内网穿透 —— 让播放器“活”在云端", 9);

  // 左：三步流程
  card(s, 0.6, 1.3, 5.35, 4.6);
  s.addText("三步实现外网分享", { x: 0.9, y: 1.46, w: 4, h: 0.45, fontFace: FONT, fontSize: 15, bold: true, color: C.primary, margin: 0 });
  const steps = [
    ["本地运行", "python manage.py runserver 0.0.0.0:8000"],
    ["花生壳映射", "创建 HTTPS 公网地址（免费）"],
    ["朋友即用", "打开链接 → 输入口令 yunlv888 → 即点即播"],
  ];
  steps.forEach((st, i) => {
    const y = 2.1 + i * 1.15;
    s.addShape(pres.shapes.OVAL, { x: 0.9, y, w: 0.5, h: 0.5, fill: { color: [C.primary, C.purple, C.pink][i] } });
    s.addText(String(i + 1), { x: 0.9, y, w: 0.5, h: 0.5, fontFace: FONT, fontSize: 16, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    s.addText(st[0], { x: 1.6, y: y - 0.05, w: 4.1, h: 0.35, fontFace: FONT, fontSize: 13.5, bold: true, color: C.textDark, margin: 0 });
    s.addText(st[1], { x: 1.6, y: y + 0.32, w: 4.1, h: 0.6, fontFace: FONT, fontSize: 10.5, color: C.textMid, margin: 0 });
  });
  // 底部优势文字
  s.addText("换域名零改代码 · HTTPS+PWA 手机可装 · 口令保护 · 随时随地分享", {
    x: 0.9, y: 5.5, w: 4.8, h: 0.35, fontFace: FONT, fontSize: 10, italic: true, color: C.textMute, margin: 0
  });

  // 右上：花生壳真实截图
  s.addText("花生壳后台 · 真实映射截图", { x: 6.2, y: 1.3, w: 6.5, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.textDark, margin: 0 });
  shot(s, "花生壳.png", 6.25, 1.78, 6.3, 4.32);
  s.addText("公网 HTTPS 地址 · 域名通配已配置 · 零成本内网穿透", { x: 6.2, y: 6.15, w: 6.5, h: 0.3, fontFace: FONT, fontSize: 10, italic: true, color: C.textMute, align: "center", margin: 0 });

  // 底部：代码级配置条
  card(s, 0.6, 6.55, 12.13, 0.7, C.bgDark);
  s.addText("代码级配置（已内置 · 零改动）", { x: 0.85, y: 6.62, w: 3.0, h: 0.5, fontFace: FONT, fontSize: 11, bold: true, color: C.purple, margin: 0, valign: "middle" });
  s.addText("ALLOWED_HOSTS=[\"*\"] · HTTPS 代理识别 · CSRF 域名通配", {
    x: 3.95, y: 6.62, w: 8.5, h: 0.5, fontFace: MONO, fontSize: 9.5, color: "DDE3FF", margin: 0, valign: "middle"
  });
}

// ============================================
// 第 10 页 · 部署与云加速（阿里云 OSS）
// ============================================
{
  const s = pres.addSlide();
  s.background = { color: C.bgLight };
  header(s, "项目特色 · 阿里云 OSS —— 让播放器“秒开”", 10);

  // 左：三步上云流程
  card(s, 0.6, 1.3, 5.35, 4.6);
  s.addText("三步把前端搬到云端", { x: 0.9, y: 1.46, w: 4.6, h: 0.45, fontFace: FONT, fontSize: 15, bold: true, color: C.primary, margin: 0 });
  const steps = [
    ["外网已通 · 但首屏慢", "花生壳隧道带宽有限，JS/CSS/封面全部走穿透，朋友访问要等很久"],
    ["OSS 接管静态资源", "upload_statics 一键上传：曲库封面 media/ + 前端 static/ 全量上云"],
    ["云域名直连 · 秒开", "模板 / 封面统一输出 OSS 地址，首次打开不再等隧道"],
  ];
  steps.forEach((st, i) => {
    const y = 2.1 + i * 1.15;
    s.addShape(pres.shapes.OVAL, { x: 0.9, y, w: 0.5, h: 0.5, fill: { color: [C.primary, C.purple, C.pink][i] } });
    s.addText(String(i + 1), { x: 0.9, y, w: 0.5, h: 0.5, fontFace: FONT, fontSize: 16, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    s.addText(st[0], { x: 1.6, y: y - 0.05, w: 4.1, h: 0.35, fontFace: FONT, fontSize: 13.5, bold: true, color: C.textDark, margin: 0 });
    s.addText(st[1], { x: 1.6, y: y + 0.32, w: 4.1, h: 0.6, fontFace: FONT, fontSize: 10, color: C.textMid, margin: 0 });
  });
  s.addText("504 个文件 · 51 秒 · 0 失败 · 幂等可重跑 · 一键可回滚", {
    x: 0.9, y: 5.5, w: 4.8, h: 0.35, fontFace: FONT, fontSize: 10, italic: true, color: C.textMute, margin: 0
  });

  // 右上：OSS 控制台真实截图
  s.addText("OSS 控制台 · 真实截图", { x: 6.2, y: 1.3, w: 6.5, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.textDark, margin: 0 });
  shot(s, "oss控制台.png", 6.25, 1.78, 6.3, 4.32);
  s.addText("对象存储 OSS · 静态资源 + 曲库媒体全部托管 · 换域名零改代码", {
    x: 6.2, y: 6.15, w: 6.5, h: 0.3, fontFace: FONT, fontSize: 10, italic: true, color: C.textMute, align: "center", margin: 0
  });

  // 底部：代码级配置条
  card(s, 0.6, 6.55, 12.13, 0.7, C.bgDark);
  s.addText("代码级配置（内置 · 可回滚）", { x: 0.85, y: 6.62, w: 3.0, h: 0.5, fontFace: FONT, fontSize: 11, bold: true, color: C.purple, margin: 0, valign: "middle" });
  s.addText("manage.py upload_statics（504 文件）· Cache-Control: max-age=31536000 · CLOUD_STATIC_BASE=off 回滚", {
    x: 3.9, y: 6.62, w: 8.6, h: 0.5, fontFace: MONO, fontSize: 9, color: "DDE3FF", margin: 0, valign: "middle"
  });
}

// ============================================
// 第 11 页 · 歌词生态
// ============================================
{
  const s = pres.addSlide();
  s.background = { color: C.bgLight };
  header(s, "歌词生态", 11);

  // 左：2×2 功能卡
  const items = [
    ["滚动", "LRC 逐行滚动高亮", "歌词居中同步，当前行高亮显示"],
    ["兜底", "在线两级兜底", "网易云 → lrclib，成功后缓存 .lrc"],
    ["编码", "多编码兼容", "UTF-8 / GBK / GB18030 全兼容"],
    ["海报", "歌词意境海报", "Canvas 生成意境卡片，PNG 下载"],
  ];
  items.forEach((it, i) => {
    const x = 0.6 + (i % 2) * 3.45, y = 1.3 + Math.floor(i / 2) * 2.05;
    card(s, x, y, 3.3, 1.9);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.2, y: y + 0.22, w: 0.6, h: 0.6, fill: { color: [C.primary, C.purple, C.pink, C.primary][i] }, rectRadius: 0.12 });
    s.addText(it[0], { x: x + 0.2, y: y + 0.22, w: 0.6, h: 0.6, fontFace: FONT, fontSize: 14, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    s.addText(it[1], { x: x + 0.95, y: y + 0.26, w: 2.25, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: C.textDark, margin: 0 });
    s.addText(it[2], { x: x + 0.22, y: y + 0.95, w: 2.9, h: 0.85, fontFace: FONT, fontSize: 10.5, color: C.textMid, margin: 0 });
  });

  // 左下：数据条
  card(s, 0.6, 5.55, 6.6, 1.1);
  s.addText("数据与流程", { x: 0.85, y: 5.68, w: 1.6, h: 0.35, fontFace: FONT, fontSize: 12.5, bold: true, color: C.primary, margin: 0 });
  s.addText("本地 152 份 .lrc（命中率约 30%）→ 其余由在线歌词自动兜底并缓存", {
    x: 0.85, y: 6.05, w: 6.1, h: 0.5, fontFace: FONT, fontSize: 10.5, color: C.textDark, margin: 0
  });

  // 右：情绪曲线真实截图
  s.addText("逐句情绪曲线 · 真实效果", { x: 7.45, y: 1.3, w: 5.3, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.textDark, margin: 0 });
  shot(s, "情绪曲线.png", 7.45, 1.78, 5.3, 2.66);
  card(s, 7.45, 4.72, 5.3, 1.93);
  s.addText("AI 分析歌词逐句情绪，生成波动曲线；播放时游标同步移动", {
    x: 7.7, y: 4.9, w: 4.85, h: 0.8, fontFace: FONT, fontSize: 11.5, color: C.textDark, margin: 0, valign: "middle"
  });
  s.addText("情绪标签贯穿“点歌 → 打标 → 推荐 → 情绪曲线”全链路，每首歌都有一条专属曲线", {
    x: 7.7, y: 5.7, w: 4.85, h: 0.85, fontFace: FONT, fontSize: 11.5, color: C.textMid, margin: 0, valign: "middle"
  });
}

// ============================================
// 第 10 页 · 语音 · 主题 · PWA
// ============================================
{
  const s = pres.addSlide();
  s.background = { color: C.bgLight };
  header(s, "交互体验 · 语音点歌 · 主题换肤 · PWA", 12);

  // 上排：语音 + PWA
  const tops = [
    ["语音", "语音点歌", "Web Speech 语音识别 + 后端语义解析（歌手 / 情绪 / 曲风 / 随机四种意图）；环境嘈杂时用快捷指令 chips 兜底", C.primary],
    ["PWA", "PWA 安装", "安装到桌面 / 手机主屏，standalone 全屏运行，全套尺寸图标，配合 HTTPS 穿透随手可得", C.pink],
  ];
  tops.forEach((t, i) => {
    const x = 0.6 + i * 6.35;
    card(s, x, 1.3, 6.1, 2.15);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.25, y: 1.55, w: 0.65, h: 0.65, fill: { color: t[3] }, rectRadius: 0.13 });
    s.addText(t[0], { x: x + 0.25, y: 1.55, w: 0.65, h: 0.65, fontFace: FONT, fontSize: 15, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    s.addText(t[1], { x: x + 1.1, y: 1.58, w: 4.6, h: 0.45, fontFace: FONT, fontSize: 16, bold: true, color: C.textDark, margin: 0 });
    s.addText(t[2], { x: x + 0.25, y: 2.28, w: 5.6, h: 1.05, fontFace: FONT, fontSize: 11.5, color: C.textMid, margin: 0 });
  });

  // 主题区标题
  s.addText("7 套主题换肤 · 三套实际效果（CSS 变量驱动，只改 6 个变量全站换肤，本地记忆 + 首屏无闪烁）", {
    x: 0.6, y: 3.72, w: 12.13, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.primary, margin: 0
  });

  // 下排：三张主题真实截图
  const thx = [0.6, 4.82, 9.04];
  thx.forEach((x, i) => {
    shot(s, `主题${i + 1}.png`, x, 4.2, 3.46, 2.68);
  });
}

// ============================================
// 第 11 页 · AI 协作项（重点）
// ============================================
{
  const s = pres.addSlide();
  s.background = { color: C.bgLight };
  header(s, "AI 协作项 · 从“代码生成”到“问题共治”", 13);

  // 上半：4 轮迭代主案例
  s.addText("主案例 · 歌词情绪曲线：4 轮迭代闭环", { x: 0.6, y: 1.18, w: 6, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.textDark, margin: 0 });
  const rounds = [
    ["第 1 轮 · 提出需求", "“逐句情绪曲线”需求 → AI 实现基础 canvas 曲线", C.primary],
    ["第 2 轮 · 实测发现", "面板展开后曲线空白 → 反馈现象 + 复现步骤", C.purple],
    ["第 3 轮 · AI 定位修复", "canvas 被初始化为 0×0 → 加 0 尺寸保护 + 展开重绘", C.pink],
    ["第 4 轮 · 验证闭环", "硬刷新验证 → 曲线正常、游标随歌词移动 ✓", C.ok],
  ];
  let rx = 0.6;
  rounds.forEach((r, i) => {
    card(s, rx, 1.6, 2.85, 1.55);
    s.addText(r[0], { x: rx + 0.15, y: 1.75, w: 2.55, h: 0.4, fontFace: FONT, fontSize: 12.5, bold: true, color: r[2], margin: 0 });
    s.addText(r[1], { x: rx + 0.15, y: 2.2, w: 2.6, h: 0.85, fontFace: FONT, fontSize: 10, color: C.textMid, margin: 0 });
    if (i < 3) arrow(s, rx + 2.9, 2.22);
    rx += 3.05;
  });
  // 案例注记
  s.addText("这个案例同时覆盖两个评分维度：批判性思维（不盲从 AI 的“已修复”）+ 协作过程（4 轮有效迭代）", {
    x: 0.6, y: 3.22, w: 12.13, h: 0.35, fontFace: FONT, fontSize: 11, italic: true, color: C.textMute, margin: 0
  });

  // 左下：批判性思维
  card(s, 0.6, 3.65, 5.95, 2.0);
  s.addText("批判性思维", { x: 0.85, y: 3.8, w: 3, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.primary, margin: 0 });
  s.addText([
    { text: "不盲从 AI 输出：", options: { bold: true, color: C.textDark } },
    { text: "AI 曾把 498 首歌批量误标 happy → 要求改用“歌名+歌手+歌词片段”重打标 + 关键词兜底", options: { color: C.textMid }, breakLine: true, paraSpaceAfter: 5 },
    { text: "多角度验证：", options: { bold: true, color: C.textDark } },
    { text: "推荐被 genre=pop 污染 → 情绪优先、曲风仅补充、演示曲不参与；编码兼容均实测", options: { color: C.textMid }, breakLine: true, paraSpaceAfter: 5 },
    { text: "能力边界：", options: { bold: true, color: C.textDark } },
    { text: "AI 感知不了播放体验 / 浏览器缓存 / 外网环境 → 关键链路全部由我实测把关", options: { color: C.textMid } },
  ], { x: 0.85, y: 4.22, w: 5.5, h: 1.35, fontFace: FONT, fontSize: 10.5, margin: 0 });

  // 右下：协作过程
  card(s, 6.78, 3.65, 5.95, 2.0);
  s.addText("协作过程", { x: 7.03, y: 3.8, w: 3, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.purple, margin: 0 });
  s.addText([
    { text: "人机分工：", options: { bold: true, color: C.textDark } },
    { text: "我=需求决策 / 架构设计 / 业务规则 / 验收测试；AI=代码实现 / 文档 / 多文件联动 / lint", options: { color: C.textMid }, breakLine: true, paraSpaceAfter: 5 },
    { text: "可复用流程：", options: { bold: true, color: C.textDark } },
    { text: "描述问题（现象+复现步骤）→ AI 检索 / 修改 → 我实际运行验证 → 通过后更新文档", options: { color: C.textMid }, breakLine: true, paraSpaceAfter: 5 },
    { text: "迭代成果：", options: { bold: true, color: C.textDark } },
    { text: "6 项关键问题全部按此模式闭环", options: { color: C.textMid } },
  ], { x: 7.03, y: 4.22, w: 5.5, h: 1.35, fontFace: FONT, fontSize: 10.5, margin: 0 });

  // 底部金句
  card(s, 0.6, 5.85, 12.13, 0.85, C.bgDark);
  s.addText("AI 是效率放大器，质量把关权始终在人。", {
    x: 0.6, y: 5.85, w: 12.13, h: 0.85, fontFace: FONT, fontSize: 18, bold: true, color: "A78BFA", align: "center", valign: "middle", margin: 0, charSpacing: 2
  });
}

// ============================================
// 第 14 页 · AI 协作项 · 更多迭代案例
// ============================================
{
  const s = pres.addSlide();
  s.background = { color: C.bgLight };
  header(s, "AI 协作项 · 更多迭代案例", 14);

  const cases = [
    {
      title: "案例 ② · 从“跑通”到“跑快”：OSS 云加速",
      bg: "外网分享已可用，朋友却抱怨首屏加载慢",
      steps: [
        ["实测定位", "外网可用但首屏慢 —— JS/CSS/封面全走花生壳隧道"],
        ["AI 给方向", "建议对象存储 OSS 分发静态资源 → 先上传曲库与封面"],
        ["我验证找缺口", "只传 media/ 不够，前端 static/ 仍在本地 —— 主动提出前端一并上云"],
        ["双端上云闭环", "static + media 全量上传、模板切云域名 → 硬刷新首屏秒开 ✓"],
      ],
    },
    {
      title: "案例 ③ · 从“一刀切”到“一歌一标”：情绪打标",
      bg: "批量打标后推荐失去区分度，重新设计判定方案",
      steps: [
        ["抽查发现问题", "AI 把 498 首歌批量统一标成 happy，情绪点歌形同虚设"],
        ["重构判定方案", "输入特征改为“歌名 + 歌手 + 歌词片段”，逐首独立判定"],
        ["设计兜底规则", "无歌词 / 识别异常的歌走关键词规则，保证 100% 落标"],
        ["全量回归验收", "498 / 498 全部打标，标签贯穿点歌 → 打标 → 推荐 → 曲线 ✓"],
      ],
    },
  ];

  cases.forEach((cs, ci) => {
    const x = 0.6 + ci * 6.3;
    card(s, x, 1.3, 5.95, 4.55);
    s.addShape(pres.shapes.RECTANGLE, { x: x + 0.22, y: 1.52, w: 0.07, h: 0.32, fill: { color: ci ? C.purple : C.primary } });
    s.addText(cs.title, { x: x + 0.42, y: 1.46, w: 5.3, h: 0.4, fontFace: FONT, fontSize: 15, bold: true, color: ci ? C.purple : C.primary, margin: 0 });
    s.addText("背景：" + cs.bg, { x: x + 0.42, y: 1.86, w: 5.3, h: 0.3, fontFace: FONT, fontSize: 10, italic: true, color: C.textMute, margin: 0 });
    const cols = [C.primary, C.purple, C.pink, C.ok];
    cs.steps.forEach((st, si) => {
      const y = 2.3 + si * 0.82;
      s.addShape(pres.shapes.OVAL, { x: x + 0.3, y, w: 0.34, h: 0.34, fill: { color: cols[si] } });
      s.addText(String(si + 1), { x: x + 0.3, y, w: 0.34, h: 0.34, fontFace: FONT, fontSize: 11, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
      s.addText(st[0], { x: x + 0.76, y: y - 0.06, w: 4.9, h: 0.32, fontFace: FONT, fontSize: 12.5, bold: true, color: C.textDark, margin: 0 });
      s.addText(st[1], { x: x + 0.76, y: y + 0.27, w: 4.95, h: 0.5, fontFace: FONT, fontSize: 9.5, color: C.textMid, margin: 0 });
    });
  });

  // 底部方法链总结
  card(s, 0.6, 6.1, 12.13, 0.6, C.bgDark);
  s.addText("两个案例同一条方法链：AI 给方案 → 我实测把关 → 发现缺口再迭代 → 全链路回归验证，验收权始终在人", {
    x: 0.6, y: 6.1, w: 12.13, h: 0.6, fontFace: FONT, fontSize: 13, bold: true, color: "A78BFA", align: "center", valign: "middle", margin: 0
  });
}

// ============================================
// 第 15 页 · 创新点总结
// ============================================
{
  const s = pres.addSlide();
  s.background = { color: C.bgLight };
  header(s, "创新点总结 · 创新不止单点炫技", 15);

  s.addText("应用 × 工程 × 方法 三个层面 · 6 大创新全链路覆盖", {
    x: 0.6, y: 1.12, w: 12.13, h: 0.35, fontFace: FONT, fontSize: 12.5, bold: true, color: C.textDark, margin: 0
  });

  const inno = [
    ["01", "AI 情绪点歌全链路", "心情 → AI 判定情绪 → 标签匹配即点即播 · 支持多轮追问「换一批」，交互直达播放", "应用创新", C.primary],
    ["02", "词级情绪洞察", "498 首逐首打标 + 逐句情绪曲线，情绪贯穿点歌→打标→推荐→曲线", "应用创新", C.purple],
    ["03", "数据资产化", "统一 ListenRecord 埋点 → 大屏实时 + 听歌报告 + 情绪偏好洞察，边听边沉淀", "应用创新", C.pink],
    ["04", "PWA 原生级体验", "免商店安装 · standalone 全屏 · 清单图标齐备，HTTPS 穿透下随手可得", "工程创新", C.ok],
    ["05", "低成本云端交付", "花生壳内网穿透 + 阿里云 OSS 静态分发：零成本也能让朋友秒开", "工程创新", C.primary],
    ["06", "「AI 生成 → 人机共治」范式", "6 项关键问题按 描述→定位→修复→验证 闭环，质量把关权始终在人", "方法创新", C.purple],
  ];
  inno.forEach((it, i) => {
    const x = 0.6 + (i % 3) * 4.14, y = 1.55 + Math.floor(i / 3) * 2.45;
    card(s, x, y, 3.94, 2.28);
    tag(s, x + 3.94 - 1.28, y + 0.16, 1.08, 0.32, it[3], "EEF1FF", it[4], 9, true);
    s.addText(it[0], { x: x + 0.22, y: y + 0.1, w: 0.9, h: 0.55, fontFace: FONT, fontSize: 22, bold: true, color: it[4], margin: 0 });
    s.addText(it[1], { x: x + 0.24, y: y + 0.76, w: 3.5, h: 0.45, fontFace: FONT, fontSize: 15, bold: true, color: C.textDark, margin: 0 });
    s.addText(it[2], { x: x + 0.24, y: y + 1.26, w: 3.5, h: 0.9, fontFace: FONT, fontSize: 10.5, color: C.textMid, margin: 0 });
  });

  card(s, 0.6, 6.52, 12.13, 0.48, C.bgDark);
  s.addText("从 AI 应用到端侧体验，再到部署交付 —— 云律 AI 的创新写在每一层", {
    x: 0.6, y: 6.52, w: 12.13, h: 0.48, fontFace: FONT, fontSize: 12.5, bold: true, color: "A78BFA", align: "center", valign: "middle", margin: 0, charSpacing: 1
  });
}

// ============================================
// 第 16 页 · 项目成果
// ============================================
{
  const s = pres.addSlide();
  s.background = { color: C.bgLight };
  header(s, "项目成果与数据资产", 16);

  // 左：8 模块表格
  card(s, 0.6, 1.3, 7.3, 4.4);
  s.addText("8 大业务模块 · 全部交付", { x: 0.9, y: 1.45, w: 4, h: 0.45, fontFace: FONT, fontSize: 15, bold: true, color: C.primary, margin: 0 });
  const mods = [
    ["music 曲库", "扫描入库 · 三源搜索 · 播放流"],
    ["playlists 歌单", "创建 / 拖拽排序 / 右键菜单"],
    ["lyrics 歌词", "滚动高亮 · 在线兜底"],
    ["recommend 推荐", "标签打分 · 可解释理由"],
    ["mood AI 情绪", "点歌 · 打标 · 多轮追问"],
    ["posters 海报", "歌词意境 · PNG 下载"],
    ["report 报告", "听歌报告 · 排行榜"],
    ["web 大屏", "大屏 · 换肤 · PWA · 穿透+OSS"],
  ];
  mods.forEach((m, i) => {
    const y = 2.0 + i * 0.46;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.9, y, w: 6.7, h: 0.4, fill: { color: i % 2 ? "F4F5FB" : "FFFFFF" }, rectRadius: 0.08 });
    s.addText(m[0], { x: 1.05, y, w: 2.2, h: 0.4, fontFace: FONT, fontSize: 11.5, bold: true, color: C.textDark, margin: 0, valign: "middle" });
    s.addText(m[1], { x: 3.3, y, w: 3.4, h: 0.4, fontFace: FONT, fontSize: 10.5, color: C.textMid, margin: 0, valign: "middle" });
    s.addText("✓", { x: 7.2, y, w: 0.3, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: C.ok, margin: 0, valign: "middle" });
  });

  // 右：代码规模
  card(s, 8.15, 1.3, 4.6, 4.4);
  s.addText("代码规模 · 合计 13,522 行", { x: 8.45, y: 1.45, w: 4, h: 0.45, fontFace: FONT, fontSize: 15, bold: true, color: C.primary, margin: 0 });
  const codeSize = [
    ["Python 后端", "4,455 行", 0.52],
    ["JavaScript 前端", "4,840 行", 0.56],
    ["CSS 样式", "2,176 行", 0.42],
    ["HTML 模板", "707 行", 0.18],
    ["项目文档", "1,344 行", 0.25],
  ];
  codeSize.forEach((c, i) => {
    const y = 2.0 + i * 0.72;
    s.addText(c[0], { x: 8.45, y, w: 1.9, h: 0.35, fontFace: FONT, fontSize: 12, color: C.textDark, margin: 0 });
    s.addText(c[1], { x: 10.35, y, w: 1.4, h: 0.35, fontFace: FONT, fontSize: 12, bold: true, color: C.primary, align: "right", margin: 0 });
    s.addShape(pres.shapes.RECTANGLE, { x: 8.45, y: y + 0.38, w: 3.3 * c[2], h: 0.12, fill: { color: i % 2 ? C.purple : C.primary } });
  });
  s.addText("核心业务代码约 12,178 行（不含注释与空行）", { x: 8.45, y: 5.28, w: 4.1, h: 0.35, fontFace: FONT, fontSize: 10, italic: true, color: C.textMute, margin: 0 });

  // 底部缺陷率
  card(s, 0.6, 5.85, 12.13, 0.85);
  s.addText("缺陷率：约 0.49 个 / 千行", { x: 0.9, y: 6.0, w: 3.2, h: 0.55, fontFace: FONT, fontSize: 15, bold: true, color: C.ok, margin: 0, valign: "middle" });
  s.addText("开发期记录并修复 6 项关键问题 · 无遗留缺陷 · 边开发边修正，即时发现、即时修复", {
    x: 4.3, y: 6.0, w: 8.2, h: 0.55, fontFace: FONT, fontSize: 12.5, color: C.textDark, margin: 0, valign: "middle"
  });
}

// ============================================
// 第 13 页 · 关键技术难点
// ============================================
{
  const s = pres.addSlide();
  s.background = { color: C.bgLight };
  header(s, "关键技术难点与解决方案", 17);

  const issues = [
    ["AI 打标“一刀切 happy”", "按“歌名+歌手+歌词片段”重打标 + 关键词兜底"],
    ["推荐被 genre=pop 污染", "情绪标签优先 · 曲风仅补缺 · 演示曲不参与"],
    ["无本地歌词", "网易云 → lrclib 在线两级兜底 + 成功缓存"],
    ["AI 请求失败 / 断网", "情绪点歌与情绪曲线内置关键词规则降级"],
    ["情绪曲线画布空白", "0 尺寸保护 + 面板展开事件触发重绘"],
    ["刷新丢失播放进度", "localStorage 断点续播记忆"],
  ];
  issues.forEach((it, i) => {
    const x = 0.6 + (i % 3) * 4.14, y = 1.3 + Math.floor(i / 3) * 2.3;
    card(s, x, y, 3.94, 2.1);
    s.addShape(pres.shapes.OVAL, { x: x + 0.22, y: y + 0.22, w: 0.44, h: 0.44, fill: { color: C.warnTxt } });
    s.addText(String(i + 1), { x: x + 0.22, y: y + 0.22, w: 0.44, h: 0.44, fontFace: FONT, fontSize: 14, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    s.addText(it[0], { x: x + 0.24, y: y + 0.75, w: 3.5, h: 0.5, fontFace: FONT, fontSize: 13, bold: true, color: C.textDark, margin: 0 });
    s.addText(it[1], { x: x + 0.24, y: y + 1.25, w: 3.5, h: 0.75, fontFace: FONT, fontSize: 11.5, color: C.textMid, margin: 0 });
  });

  card(s, 0.6, 5.75, 12.13, 0.85);
  s.addText("核心方法论：", { x: 0.9, y: 5.92, w: 1.8, h: 0.5, fontFace: FONT, fontSize: 13.5, bold: true, color: C.primary, margin: 0, valign: "middle" });
  s.addText("发现问题 → 定位根因 → 实施修复 → 回归验证，6 项问题全部闭环，无遗留", {
    x: 2.7, y: 5.92, w: 9.8, h: 0.5, fontFace: FONT, fontSize: 13.5, color: C.textDark, margin: 0, valign: "middle"
  });
}

// ============================================
// 第 14 页 · 演示路线 + 总结
// ============================================
{
  const s = pres.addSlide();
  s.background = { color: C.bgLight };
  header(s, "演示路线 · 15 分钟答辩节奏", 18);

  const rows = [
    [
      ["01", "开场定位", "1′"],
      ["02", "曲库搜索", "1.5′"],
      ["03", "播放器增强", "2′"],
      ["04", "歌词生态", "1.5′"],
      ["05", "歌单收藏", "1.5′"],
      ["06", "每日推荐", "1′"],
    ],
    [
      ["07", "AI 情绪点歌", "3′ ★"],
      ["08", "语音点歌", "1′"],
      ["09", "报告·海报", "1.5′"],
      ["10", "数据大屏", "3′ ★"],
      ["11", "换肤·PWA", "1.5′"],
      ["12", "花生壳+OSS 秒开", "1′ ★"],
    ],
  ];
  rows.forEach((row, r) => {
    let x = 0.6;
    row.forEach((it, i) => {
      const isHot = it[2].includes("★");
      card(s, x, 1.35 + r * 1.45, 1.92, 1.25, isHot ? "EEF1FF" : C.card);
      s.addShape(pres.shapes.OVAL, { x: x + 0.14, y: 1.5 + r * 1.45, w: 0.34, h: 0.34, fill: { color: isHot ? C.pink : C.primary } });
      s.addText(it[0], { x: x + 0.14, y: 1.5 + r * 1.45, w: 0.34, h: 0.34, fontFace: FONT, fontSize: 10, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
      s.addText(it[1], { x: x + 0.55, y: 1.48 + r * 1.45, w: 1.3, h: 0.4, fontFace: FONT, fontSize: 12.5, bold: true, color: isHot ? C.pink : C.textDark, margin: 0 });
      s.addText(it[2], { x: x + 0.15, y: 1.92 + r * 1.45, w: 1.65, h: 0.3, fontFace: FONT, fontSize: 10, color: isHot ? C.pink : C.textMute, margin: 0 });
      x += 2.03;
    });
  });

  s.addText("★ 为重点展示环节 · 全流程合计约 20 分钟，答辩时压缩为 14 分钟，突出 AI 情绪点歌、数据大屏与外网分享（穿透 + OSS）", {
    x: 0.6, y: 4.35, w: 12.13, h: 0.35, fontFace: FONT, fontSize: 11, italic: true, color: C.textMute, margin: 0
  });

  card(s, 0.6, 4.85, 12.13, 1.85, C.bgDark);
  s.addText("别人做播放器是在放歌，我做播放器是在听懂你。", {
    x: 0.6, y: 5.15, w: 12.13, h: 0.7, fontFace: FONT, fontSize: 24, bold: true, color: "FFFFFF", align: "center", margin: 0, charSpacing: 2
  });
  s.addText("懂情绪 · 会分享 · 可扩展 —— 云律 AI", {
    x: 0.6, y: 5.95, w: 12.13, h: 0.5, fontFace: FONT, fontSize: 14, color: "A78BFA", align: "center", margin: 0, charSpacing: 4
  });
}

// ============================================
// 第 15 页 · 感谢页（深色）
// ============================================
{
  const s = pres.addSlide();
  s.background = { color: C.bgDark };
  s.addShape(pres.shapes.OVAL, { x: -1.8, y: -1.8, w: 4.0, h: 4.0, line: { color: C.primary, width: 1.5 }, fill: { color: "0F1235" } });
  s.addShape(pres.shapes.OVAL, { x: 11.3, y: 5.2, w: 3.6, h: 3.6, line: { color: C.purple, width: 1.5 }, fill: { color: "0F1235" } });
  s.addText("谢谢聆听", { x: 0.6, y: 2.4, w: 12.13, h: 1.3, fontFace: FONT, fontSize: 52, bold: true, color: "FFFFFF", align: "center", margin: 0, charSpacing: 8 });
  s.addText("欢迎批评指正", { x: 0.6, y: 3.85, w: 12.13, h: 0.6, fontFace: FONT, fontSize: 20, color: "A78BFA", align: "center", margin: 0, charSpacing: 6 });
  s.addText("Q & A", { x: 0.6, y: 4.6, w: 12.13, h: 0.5, fontFace: FONT, fontSize: 15, color: C.textMute, align: "center", margin: 0, charSpacing: 6 });
}

// ---------- 输出 ----------
const out = path.join(__dirname, "云律AI-答辩PPT.pptx");
pres.writeFile({ fileName: out }).then(() => {
  console.log("已生成:", out);
}).catch(e => {
  console.error("生成失败:", e);
  process.exit(1);
});
