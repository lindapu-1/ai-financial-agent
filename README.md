# FinGPT AI Agent 🤖

这是一个为 FinGPT 定制的投研 AI 智能体。它能自动拆解财务分析任务、实时抓取股票数据、分析财报并生成深度研究报告。

---

## 🚀 5 分钟快速上手指南 (Windows/Mac)

如果你是第一次接触这个项目，请按照以下步骤操作：

### 1. 安装基础环境 (仅需一次)
你的电脑需要安装以下三个软件：
- **Node.js**: [点击下载 (推荐 20.x 版本)](https://nodejs.org/)
- **Docker Desktop**: [点击下载](https://www.docker.com/products/docker-desktop/)（用于运行本地数据库）
- **Git**: [点击下载](https://git-scm.com/downloads)

### 2. 下载并安装项目
打开你的终端（Windows 搜索 `PowerShell` 或 `CMD`），依次运行：

```bash
# 1. 克隆代码
git clone https://github.com/lindapu-1/ai-financial-agent.git
cd ai-financial-agent

# 2. 安装 pnpm (项目包管理器)
npm install -g pnpm

# 3. 安装项目依赖
pnpm install
```

### 3. 配置 API Key
在项目根目录下，你会看到一个 `.env.example` 文件：
1. 将它复制一份命名为 `.env.local`（推荐）或 `.env`。
2. 用记事本打开 `.env.local`，填入你的 API Key：

```bash
# OpenAI API Key (必须)
OPENAI_API_KEY=your-openai-api-key

# Google Gemini API Key (可选，用于使用 Gemini 模型)
GOOGLE_API_KEY=your-google-api-key

# DeepSeek API Key (可选，用于使用 DeepSeek 模型)
DEEPSEEK_API_KEY=your-deepseek-api-key

# Financial Datasets API Key (可选，用于股票数据功能)
FINANCIAL_DATASETS_API_KEY=your-financial-datasets-api-key
```

**注意**：所有 API Key 都可以写在 `.env.local` 文件中，项目会优先读取 `.env.local` 中的配置。

### 4. 启动项目 (一键运行)
确保你的 **Docker Desktop** 已经打开并正在运行，然后执行：

```bash
# 1. 启动本地数据库
docker run -d --name ai-financial-agent-postgres -p 5433:5432 -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=ai_financial_agent postgres:16

# 2. 跑数据库初始化
pnpm db:migrate

# 3. 启动应用
pnpm dev
```

**现在打开浏览器访问：[http://localhost:3000](http://localhost:3000) 即可开始聊天！**

---

## 🛠 已包含的稳定性优化 (V1.1)
- **自动登录**：打开页面即可自动创建临时账户，无需手动注册。
- **数据库健壮性**：即使本地数据库被重置，系统也能自动识别并补全用户信息，不会报错。
- **模型自动回退**：默认使用 GPT-4o，避免了部分账号没有 4.1 快照模型的权限问题。

---

## 📂 主要功能
- **任务拆解**：自动将模糊的问题拆分为"搜数、对比、分析"三个子任务。
- **实时研报**：调用 Financial Datasets API 获取最新的美股财报和价格。
- **Deep Research**：在 `note.md` 中有详细的深度研究 SOP，可指导模型生成高质量备忘录。
- **Portfolio 管理**：持仓管理界面，支持股票跟踪和管理。
- **Canvas 深度研究**：支持多轮对话叠加和记忆功能的深度研究界面。

---

## 📝 更新日志

### 最新更新
- **Portfolio 界面**：新增持仓管理功能，支持股票跟踪和管理
- **投资研报撰写 SOP**：优化了投资研报撰写的标准操作流程，支持完整的市场研究、公司研究、财务分析和风险评估流程
- **Canvas 文件上传**：支持上传 PDF 和 Word 文档（.pdf, .docx），自动提取文本内容
- **Canvas 历史记忆**：Canvas 界面支持多轮对话记忆，切换项目时保留历史对话记录
- **投资研报 SOP 技能**：在 Canvas 技能栏中新增"投资研报撰写SOP"技能，可按照标准流程生成完整研报

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

## 🔧 技术栈
- **框架**: Next.js 15 (App Router)
- **数据库**: PostgreSQL (Docker)
- **ORM**: Drizzle ORM
- **AI SDK**: Vercel AI SDK
- **UI**: Radix UI + Tailwind CSS

