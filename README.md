# 菜谱卡 App

粘贴小红书链接（或文字），自动生成结构化菜谱卡；数据保存在本机。

## Docker 部署（推荐给别人用）

```bash
# 1. 构建镜像
docker build -t everybite .

# 2. 运行（数据持久化到命名卷，AI 整理可选）
docker run -d --name everybite -p 3456:3456 \
  -e LLM_API_KEY=你的Key \
  -e LLM_BASE_URL=https://api.deepseek.com/v1 \
  -e LLM_MODEL=deepseek-flash \
  -v everybite-data:/app/src/data \
  -v everybite-covers:/app/covers \
  everybite
```

- 访问：`http://localhost:3456`，同一局域网的手机用 `http://<主机IP>:3456`
- 不配 `LLM_*` 环境变量也能跑（内置规则解析兜底）；任何 OpenAI 兼容接口（Kimi / DeepSeek 等）均可
- 数据在 `everybite-data`（SQLite 菜谱库）和 `everybite-covers`（封面素材）两个卷里，删容器不丢数据

## 本地启动

双击 `启动.bat`（或执行 `npm start`）。启动后终端会打印：

- 本机访问：`http://localhost:3456`
- 手机访问：`http://<电脑局域网IP>:3456`（手机连同一 WiFi 后浏览器打开）

## 配置 AI 整理（可选）

复制 `.env.example` 为 `.env`，填入：

```
LLM_API_KEY=你的Key
LLM_BASE_URL=https://api.moonshot.cn/v1
LLM_MODEL=kimi-k2-0905-preview
```

任何 OpenAI 兼容接口（Kimi / DeepSeek 等）均可。**不填 Key 也能用**：会自动用内置规则解析兜底，只是整理结果粗一些。

## 数据

- 菜谱库：`src/data/recipes.db`（SQLite；若 better-sqlite3 不可用自动回退 `src/data/recipes.json`）
- 封面素材：`covers/`，建议偶尔备份 `src/data/` 和 `covers/`

## 开发

```bash
npm install            # 后端
cd web && npm install  # 前端
npm start              # 后端（托管 web/dist）
cd web && npm run build  # 前端构建
node scripts/test-scrape.js  # 抓取自测
```
