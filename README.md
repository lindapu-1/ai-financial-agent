# Hony Capital AI Agent 🤖 (FinGPT Internal)

这是一个为弘毅投资（Hony Capital）深度定制的投研 AI 助手，内部代号 **FinGPT**。它不仅支持基于任务拆解的 **智能聊天 (Chat)**，还拥有全新的 **创作画布 (Canvas)** 模式和 **持仓管理 (Portfolio)** 功能，旨在帮助投研人员全方位提升工作效率。

---

## 🚀 5 分钟快速上手指南 (小白友好型)

如果你是第一次使用这个项目，请按照以下四个步骤操作：

### 1. 安装基础环境 (仅需一次)
你的电脑需要安装以下三个软件：
- **Node.js**: [点击下载 (推荐 20.x 版本)](https://nodejs.org/)
- **Docker Desktop**: [点击下载](https://www.docker.com/products/docker-desktop/)（**必须启动**，用于运行本地数据库）
- **Git**: [点击下载](https://git-scm.get-scm.com/downloads)

### 2. 下载并安装项目
打开你的终端（Windows 搜索 `PowerShell`；Mac 搜索 `终端`），依次运行：

```bash
# 1. 克隆代码
git clone https://github.com/lindapu-1/ai-financial-agent.git
cd ai-financial-agent

# 2. 安装 pnpm (项目包管理器)
npm install -g pnpm

# 3. 安装项目依赖
pnpm install
```

### 3. 配置 API Key (重要)
在项目根目录下，你会看到一个 `.env.example` 文件：
1. 在文件夹里手动将 `.env.example` 复制一份，改名为 `.env.local`。
2. 用记事本（或 VS Code）打开 `.env.local`，填入你的 API Key：

```bash
# OpenAI API Key (推荐，默认模型使用)
OPENAI_API_KEY=sk-xxxx...

# Google Gemini API Key (推荐，用于超长文本处理，Canvas 模式神器)
GOOGLE_API_KEY=AIzaSy...

# DeepSeek API Key (可选)
DEEPSEEK_API_KEY=sk-xxxx...

# Financial Datasets API Key (可选，用于 Chat 模式下自动抓取股票财报数据)
FINANCIAL_DATASETS_API_KEY=your-key...
```

### 4. 启动项目 (一键运行)
确保你的 **Docker Desktop** 已经打开并正在运行（看到鲸鱼图标变绿），然后执行：

```bash
# 1. 启动本地数据库 (此命令只会创建空数据库，不会包含作者的私人对话)
docker run -d --name hony-agent-db -p 5433:5432 -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=hony_agent postgres:16

# 2. 初始化数据库结构 (它会自动为您创建所需的表格)
pnpm db:migrate

# 3. 启动应用
pnpm dev
```

**现在打开浏览器访问：[http://localhost:3000](http://localhost:3000) 即可开始！**

---

## 🌟 核心模式与功能

### 1. Chat 模式 (智能投研助理)
- **任务拆解**：自动将模糊的问题拆分为"搜数、对比、分析"等子任务。
- **实时数据**：结合 Financial Datasets，实时获取最新估值、利润表、资产负债表。

### 2. Canvas 模式 (报告创作工作台)
- **项目素材库**：左侧管理项目，中间编辑器支持粘贴或上传超长投研素材。
- **技能插件 (Skills)**：预设“行业研究”、“技术壁垒”、“投资研报撰写SOP”等技能，严格按规范生成报告。
- **超长上下文**：建议配合 **Gemini 1.5 Pro** 使用，可一次性处理超过 10 万字的复杂素材。

### 3. Portfolio 模式 (持仓管理) - **NEW** 🚀
- **持仓跟踪**：支持股票跟踪与管理界面。
- **动态监控**：实时更新股票新闻与价格变动（持续完善中）。

---

## 📝 最近更新 (Update Log)

- **Portfolio 界面**：新增持仓管理功能，支持股票跟踪和管理。
- **投资研报撰写 SOP**：优化了投资研报撰写的标准流程，支持完整的市场研究、公司研究、财务分析和风险评估。
- **Canvas 历史记忆**：支持多轮对话记忆，切换项目时保留历史对话记录。
- **文件解析增强**：支持解析 PDF 和 Word 文档内容并提取文本。

---

## ❓ 常见问题排查 (FAQ)

- **Q: 数据库启动失败，提示 "Name conflict"?**
  - **A**: 说明你之前运行过旧容器。请运行 `docker rm -f hony-agent-db` 然后再执行步骤 4 的第一条指令。
- **Q: 我能看到作者的聊天记录吗？**
  - **A**: 不能。数据库运行在你自己的 Docker 本地环境中，数据是完全隔离且私密的。
- **Q: 为什么技能栏是空的？**
  - **A**: 首次进入 Canvas 模式并登录后，系统会自动为您初始化默认技能。
- **Q: 粘贴几万字会卡吗？**
  - **A**: 不会。编辑器已针对长文本进行了高度自适应和性能优化。

---

## 🛠 技术栈
Next.js 15, Vercel AI SDK, Drizzle ORM, PostgreSQL, Docker, Tailwind CSS.
