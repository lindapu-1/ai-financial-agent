# AI Financial Agent 🤖

这是一个专为投资研究设计的 AI 智能体。它能自动拆解财务分析任务、实时抓取股票数据、分析财报并生成深度研究报告。

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
1. 将它重命名为 `.env`（或者直接复制一份命名为 `.env`）。
2. 用记事本打开 `.env`，在 `OPENAI_API_KEY=` 后面填入你的 Key。

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
- **任务拆解**：自动将模糊的问题拆分为“搜数、对比、分析”三个子任务。
- **实时研报**：调用 Financial Datasets API 获取最新的美股财报和价格。
- **Deep Research**：在 `note.md` 中有详细的深度研究 SOP，可指导模型生成高质量备忘录。

