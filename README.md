# 🎵 云律 AI · 懂情绪的音乐播放器

基于 Django 的轻量音乐播放器，核心特色是 **AI 情绪点歌**：输入一句心情，AI 自动推荐匹配的歌单；同时支持对本地曲库进行 **AI 情绪分类**（按歌词判定），让推荐更懂你。

## 功能一览

| 优先级 | 功能 | 说明 |
|---|---|---|
| P0 | 在线/本地播放 | MP3/FLAC/WAV，进度拖拽、音量控制、上/下一首、三种播放模式（顺序/循环/随机） |
| P0 | 多源在线曲库 | iTunes 试听 + Jamendo 完整版 + SoundHelix 纯音乐，统一搜索合并展示 |
| P0 | 歌单管理 | 创建/编辑/删除、封面上传、拖拽排序、添加歌曲（本地+在线均可） |
| P0 | 收藏与最近播放 | 歌曲收藏到「我的收藏」，播放历史自动记入「最近播放」 |
| P0 | 右键快捷菜单 | 右键歌曲可快速播放、收藏、加入任意歌单（支持一首歌进多个歌单） |
| P1 | 滚动歌词 | LRC 解析，`timeupdate` 同步高亮当前行，自动居中滚动；无本地歌词时自动在线抓取（网易云 → lrclib 兜底） |
| P1 | 播放增强 | 频谱可视化、10 段均衡器、定时关闭、播放记忆（刷新后从上次断点续播）、Media Session 锁屏控制 |
| P1 | 歌词情绪曲线 | 歌词加载后逐句 AI 情绪分析，情绪色带 + 平滑曲线 + 播放游标；后端失败自动本地规则兜底 |
| P1 | 每日推荐 | 基于听歌历史的标签相似度推荐，附"为什么推荐" |
| P2 | AI 情绪点歌台 | 心情文本 → 智谱 GLM 分析情绪 → 标签匹配歌曲（核心创新） |
| P2 | 语音点歌 | Web Speech API 语音识别 + 快捷指令 chips（舒缓/欢快/动感/歌手/钢琴/随机） |
| P2 | 智能歌词海报 | Canvas 生成歌词意境卡片，一键下载 PNG |
| P2 | 全屏情绪氛围 | 播放时全屏极光/星云动态背景，换歌时色调随歌曲情绪平滑过渡 |
| P2 | 听歌报告 & 排行榜 | 播放统计总结 + 热门歌曲榜/情绪分布 |
| P2 | AI 歌曲情绪分类 | 按「歌名+歌词」批量判定每首歌的情绪标签，修复"一刀切 happy"问题 |
| P3 | 访问口令 | 分享时用口令保护，未通过验证无法访问页面与接口 |
| P3 | 主题换肤 | 7 套预设主题（云律蓝紫/网易云红/电光青/青柠绿/暖橙/玫瑰粉/黑金），侧边栏底部一键切换，品牌色全局同步，本地记忆 |
| P3 | 实时数据大屏 | 独立大屏页 /dashboard/，Canvas 自绘播放趋势/24h/情绪环形图，4 秒轮询实时刷新 |
| P3 | 键盘快捷键 | 空格/方向键/M/[ ]/R/F/1~7 全局控制播放与快捷操作，Ctrl+K 搜索、Ctrl+L AI 点歌，按 ? 查看帮助 |
| P3 | PWA 安装 | 支持安装到桌面/手机主屏全屏运行：manifest、全套尺寸图标、Apple 触摸图标、主题色联动 |

## 快速开始

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 配置智谱 AI 密钥（情绪点歌 + 歌曲情绪分类）
setx ZHIPU_API_KEY "你的密钥"   # Windows，新开窗口生效

# 3. 初始化数据库 + 启动
python manage.py migrate
python manage.py runserver 8000

# 4. 打开浏览器
# http://127.0.0.1:8000
```

> 智谱密钥仅从环境变量读取，代码中不写死。免费模型 `glm-4-flash` 即可。

## ⌨️ 键盘快捷键

桌面端全局快捷键，播放控制与快捷操作一手搞定；**输入框/编辑区聚焦时自动停用**（避免干扰打字），仅 `Esc` 例外用于取消聚焦。

| 按键 | 功能 |
|---|---|
| 空格 | 播放 / 暂停 |
| ← / → | 上一首 / 下一首 |
| ↑ / ↓ | 音量 +10% / −10% |
| M | 静音 / 取消静音（取消时恢复原音量） |
| [ / ] | 快退 / 快进 10 秒 |
| R | 切换播放模式（顺序 / 循环 / 随机） |
| F | 收藏 / 取消收藏当前歌曲 |
| / 或 Ctrl/Meta + K | 聚焦搜索框 |
| Ctrl/Meta + L | 聚焦 AI 点歌输入框 |
| 1 ~ 7 | 切换侧边栏板块（发现/推荐/情绪/歌单/收藏/最近/报告） |
| ? 或 Shift+/ | 打开快捷键帮助面板 |
| Esc | 关闭帮助面板 / 取消输入框聚焦 |

> 按 `?` 可在页面内随时打开帮助面板；其余带修饰键的组合一律不响应，避免误触。

## 部署 & 分享

### 局域网分享

```bash
python manage.py runserver 0.0.0.0:8000
```

同一 Wi-Fi 下用 `http://电脑IP:8000` 访问（需输入访问口令 `yunlv888`）。

### 外网分享（花生壳 HTTPS 内网穿透）

1. 花生壳添加 **HTTPS 映射**，目标地址填 `127.0.0.1:8000`
2. 启动服务：`python manage.py runserver 0.0.0.0:8000`
3. 把 `https://你的花生壳域名` 发给朋友，输入访问口令即可使用
4. 服务已内置配套配置：
   - `ALLOWED_HOSTS = ["*"]`：放行任意域名
   - `SECURE_PROXY_SSL_HEADER`：识别花生壳转发来的 HTTPS，保证 Cookie/重定向正确
   - `CSRF_TRUSTED_ORIGINS`：内置 `*.vicp.fun` / `*.gicp.net` / `*.oray.fun` 通配，换域名无需改配置

> **PWA 安装要求 HTTPS**（或 localhost）：本地 `127.0.0.1` 可直接安装；外网必须走 HTTPS 域名，http 穿透地址浏览器会拒绝安装。

### （推荐）给本地曲库打上 AI 情绪标签

把音乐文件放入 `music_library/` 并扫描入库后，跑一次：

```bash
python manage.py retag_songs                 # 全部本地歌（自动跳过演示曲）
python manage.py retag_songs --limit 5       # 只处理前 5 首（调试）
python manage.py retag_songs --dry-run       # 只预览不改库
python manage.py retag_songs --workers 1     # 串行（更慢但更不容易被限流）
```

- 原理：读取本地 `.lrc`（无则在线抓取歌词）→ 把「歌名+歌手+歌词片段」交给智谱 GLM → 从情绪词表中选择 1-3 个标签写回数据库
- 无歌词 / AI 不可用时自动退回关键词规则，保证每首歌都有合理标签
- 扫描入库时不再把"无曲风标签"的歌曲误标为 happy；新歌入库后补跑一次本命令即可
- 相关命令：`python manage.py fetch_lyrics` 可先批量缓存歌词（可选）

## 曲库说明

- **本地曲库**：把音乐文件放入 `music_library/`，刷新页面自动扫描入库；同名 `.lrc` 文件自动识别为歌词
- **在线曲库**：三源合一，按优先级 `Jamendo 完整版 > SoundHelix 纯音乐 > iTunes 试听` 合并展示；iTunes 结果 30 秒试听，Jamendo 授权音乐可完整播放
- **扩展**：新增音乐源只需在 `apps/music/sources.py` 继承 `MusicSource` 并注册，其他代码零改动

## 目录结构（8 大板块 + 基础设施）

```
云律AI/
├── cloud_music/        # 项目配置
├── apps/
│   ├── gate/           # 访问口令（中间件 + 口令页）
│   ├── music/          # 板块1 音乐核心：模型/曲库扫描/音乐源抽象/播放流
│   │   └── management/commands/
│   │       └── retag_songs.py    # AI 歌曲情绪打标命令
│   ├── web/            # 板块2 前端页面
│   ├── playlists/      # 板块3 歌单管理
│   ├── lyrics/         # 板块4 歌词同步（网易云/lrclib 在线抓取）
│   ├── recommend/      # 板块5 推荐系统（服务层算法可替换）
│   ├── mood/           # 板块6 AI 情绪点歌台（ai_service 可换模型）
│   ├── posters/        # 板块7 歌词海报
│   └── report/         # 板块8 听歌报告与排行榜
├── templates/          # HTML 模板（index.html / dashboard.html 数据大屏 / gate/login.html）
├── static/
│   ├── css/style.css   # 样式（含 7 套主题色板，data-theme 切换）
│   ├── js/             # 前端模块（播放器/歌词/情绪曲线/氛围背景/海报/报告/数据大屏/快捷键等）
│   ├── img/icons/      # PWA / favicon 图标（192/512/180/maskable）
│   └── manifest.webmanifest  # PWA 应用清单
├── music_library/      # 本地曲库：放入 MP3/FLAC 自动扫描入库
├── scripts/            # 工具脚本
└── manage.py
```

## 主要 API

### 音乐（`/api/music/`）

| 接口 | 说明 |
|---|---|
| `GET songs/` | 歌曲列表（支持 genre/tag 过滤） |
| `GET songs/<id>/` | 歌曲详情 |
| `POST songs/<id>/play/` | 记录播放（推荐/报告的数据来源） |
| `GET search/?q=` | 多源搜索（本地 + 在线） |
| `GET stream/<id>/` | 音频流（支持 Range 拖拽） |
| `GET proxy/` | 在线音频代理（解决跨域） |
| `POST scan/` | 扫描本地曲库 |
| `POST voice/` | 语音/文本点歌解析 |
| `GET hot/` | 热门歌曲榜 |
| `GET tags/` | 情绪标签 / 曲风 / 可用音乐源 |

### 其他板块

| 接口 | 说明 |
|---|---|
| `GET/POST /api/playlists/...` | 歌单 CRUD、加歌、删歌、排序 |
| `GET /api/lyrics/<id>/` | 歌词（LRC 原文，自动在线兜底） |
| `POST /api/lyrics/analyze/` | 逐句歌词情绪分析（歌词情绪曲线数据源） |
| `GET /api/recommend/daily/` | 每日推荐 |
| `POST /api/mood/songs/` | 情绪点歌 `{"text": "今天加班好累"}` |
| `GET /api/posters/palette/` | 海报配色方案 |
| `GET /api/report/summary/` | 听歌报告统计 |
| `GET /api/report/leaderboard/` | 排行榜 |
| `POST /gate/verify/` | 访问口令校验 |

## 迭代路线

- **V1.0** 当前版本：8 大板块 + 收藏/最近播放/右键歌单 + AI 情绪分类 + 主题换肤 + PWA 安装全部完成
- V1.1 用户注册登录、歌单归属用户、情绪记录
- V1.2 推荐升级（协同过滤/向量检索）、在线曲库增强
- V1.3 海报接 AIGC、移动端适配
- V1.4 数据看板、每周歌单报告

详细功能说明见 [docs/项目功能介绍.md](docs/项目功能介绍.md)。
