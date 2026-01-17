# Hony Capital AI Agent 🤖 (FinGPT Internal)

这是一个为弘毅投资（Hony Capital）深度定制的投研 AI 助手，内部代号 **FinGPT**。它不仅支持基于任务拆解的 **智能聊天 (Chat)**，还拥有全新的 **创作画布 (Canvas)** 模式和 **持仓管理 (Portfolio)** 功能，旨在帮助投研人员全方位提升工作效率。

---

## 🚀 5 分钟快速上手指南 (小白友好型)

如果你是第一次使用这个项目，请按照以下四个步骤操作：

### 1. 安装基础环境 (仅需一次)
你的电脑需要安装以下三个软件：
- **Node.js**: [点击下载 (推荐 20.x 版本)](https://nodejs.org/)
- **Docker Desktop**: [点击下载](https://www.docker.com/products/docker-desktop/)（**必须启动**，用于运行本地数据库）
- **Git**: [点击下载](https://git-scm.com/downloads)

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

# Tavily API Key (可选，用于联网搜索)
TAVILY_API_KEY=tvly-xxxx...
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
- **联网搜索**：集成 Tavily API，支持获取最新的市场新闻和动态。

### 2. Canvas 模式 (报告创作工作台)
- **项目素材库**：左侧管理项目，中间编辑器支持粘贴或上传超长投研素材。
- **技能插件 (Skills)**：预设“行业研究”、“技术壁垒”、“投资研报撰写SOP”等技能，严格按规范生成报告。
- **超长上下文**：建议配合 **Gemini 1.5 Pro** 使用，可一次性处理超过 10 万字的复杂素材。

### 3. Portfolio 模式 (持仓管理) - **NEW** 🚀
- **持仓跟踪**：支持股票跟踪与管理界面。
- **动态监控**：实时更新股票新闻与价格变动。

---

## 📝 更新日志 (Update Log)

### pu (User)
- **Canvas 投研画布**：实现三栏式可拖拽布局，支持项目制管理。
- **Skill 技能管理**：支持用户自定义技能 Prompt 模板，并实现自动初始化。
- **编辑器优化**：支持数万字长文本的流畅粘贴与实时字数统计。
- **UI 架构重构**：统一 Global Header，实现侧边栏跟随模式动态切换。

### duan (Friend)
- **Portfolio 持仓管理**：新增投资组合管理界面，支持股票跟踪。
- **投资研报 SOP**：引入标准研报撰写流程，覆盖市场、公司、财务等多维度分析。
- **Web Search 集成**：通过 Tavily API 为 AI 赋予实时联网搜索能力。
- **文件解析增强**：支持上传 PDF 和 Word (.docx) 文档，自动提取文本至编辑器。

---

## 🐛 待修复问题 (Bug List)

### 高优先级
1. **文件上传功能增强**
   - [ ] 支持上传 PDF、Word、PPT 文件
   - [ ] 当前仅支持 PDF 和 Word (.docx)，需要添加 PPT (.pptx) 支持
   - [ ] 优化大文件处理性能

2. **Portfolio 功能完善**
   - [ ] Portfolio 界面可以增加 stocks（添加股票功能）
   - [ ] 实时更新 stocks news（股票新闻实时更新）
   - [ ] 添加股票价格实时监控

3. **数据库隔离**
   - [ ] Canvas 数据不显示在 Chat 数据库中
   - [ ] 实现 Canvas 和 Chat 的完全数据隔离
   - [ ] 优化数据查询性能

### 中优先级
- [ ] 优化 Canvas 界面的文件上传体验
- [ ] 添加更多文档格式支持（Excel, CSV 等）
- [ ] 改进错误处理和用户提示

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
