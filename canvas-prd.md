# Canvas 模式：金融投研报告创作工作台 - 产品规划书 (PRD)

## 1. 产品愿景
通过“项目制”管理和“技能插件化”生成的逻辑，将 AI 从一个“聊天对象”转变为一个“协同创作者”。帮助投研人员将零散的项目素材，根据公司标准，高效转化为专业、规范的报告段落。

---

## 2. 界面布局 (UI/UX) 设计 - 增强版

### 2.1 全局顶层导航 (Global Top Bar)
*   **固定位置**：页面最顶端，跨越整个屏幕宽度。
*   **标识**：左侧显示 "FinGPT" 品牌标识。
*   **Tab 切换器**：居中显示 `Chat` | `Canvas` 切换按钮。
*   **持久性**：切换 Tab 时，此 Top Bar 保持不变。

### 2.2 模式切换逻辑
当用户切换 Tab 时，下方所有内容（包括侧边栏）将同步切换：

#### A. Chat 模式布局
*   **左侧栏 (1/5)**：`Chat History` 列表。
    *   右上角设有 `+` 按钮，用于开启新会话。
*   **右侧内容区 (4/5)**：标准对话流界面，底部为 Prompt 输入框。

#### B. Canvas 模式布局 (三栏式)
*   **左侧栏 (1/5)**：`Project List` 列表。
    *   右上角设有 `+` 按钮，用于创建新项目。
*   **中间编辑器 (2/5)**：沉浸式项目素材编辑器。
*   **右侧 AI 助手 (2/5)**：Canvas 专用 AI 协作栏。
*   **可拖拽分隔线**：中间编辑器与右侧 AI 助手之间设有水平拖拽条，允许用户自定义两栏宽度。

---

## 3. 核心功能逻辑 (AI Logic) - 彻底解耦设计

**重要提醒：** Canvas 模式的 AI 逻辑与现有的 Chat 模式（任务拆解型 SOP）完全独立，不复用现有的任务拆解逻辑。

### 3.1 AI 行为模式差异对比

| 特性 | 当前 Chat 模式 (Financial Agent) | **全新 Canvas 模式 (Report Co-writer)** |
| :--- | :--- | :--- |
| **SOP 逻辑** | **任务拆解型**：`generateObject` (拆分任务) -> 逐一执行 | **内容协作型**：直接处理上下文 -> 结构化生成 |
| **核心上下文** | 用户输入 + 历史对话 + 实时金融工具结果 | **编辑器实时内容** + 用户输入 + 历史对话 |
| **指令约束** | 通用金融助手提示词 (Prompt) | **选中的 Skill Prompt** (专用段落生成指令) |
| **工具使用** | 深度依赖 `financialTools` (价格、财报等) | **无工具模式**，核心是素材的有机整合与润色 |
| **输出目标** | 寻找答案、对比数据 | **按公司规范生成/打磨报告段落** |

### 3.2 技术分流策略 (Backend Decoupling)

为了确保两套逻辑互不干扰，后端 `api/chat` 路由将采用大分流设计：
*   **路由分发**：根据请求中的 `mode: 'canvas'` 字段，直接跳转至独立的处理函数。
*   **跳过拆解**：Canvas 模式将彻底跳过 `generateObject` 步骤，不产生任何“任务拆解”中间状态（如小圆点进度条）。
*   **上下文注入**：后端在调用 `streamText` 前，会动态将编辑器中的 `Project Context` 与选中的 `Skill Prompt` 拼接成最终的 System 指令。

### 3.3 技能定义 (Skills Definition - V1.0)
我们将预设两个核心技能，每个技能对应一个隐藏的专用 Prompt：

1.  **技能：行业情况 (Industry Analysis)**
    *   **Prompt 重点**：要求模型分析行业规模、增长率、产业链上下游逻辑、竞争梯队、政策环境。
    *   **规范**：强调逻辑结构，提示数据支撑点。

2.  **技能：技术壁垒 (Technical Barriers)**
    *   **Prompt 重点**：要求模型从专利储备、核心算法、研发团队背景、迁移成本、准入门槛等角度进行深度解构。
    *   **规范**：客观、严谨，对比行业平均水平进行打分。

---

## 4. 技术实现详细规划

### 4.1 数据库层 (Database)
*   **新增 `Project` 表**：存储项目名称、用户关联、编辑器富文本内容（`content`）。
*   **消息关联**：消息表新增 `projectId` 字段，确保项目对话与项目内容绑定。

### 4.2 前端层 (Frontend)
*   **状态管理**：引入 `ViewModeContext` 统一管理全局模式状态。
*   **UI 框架**：使用 `react-resizable-panels` 实现 Canvas 的可拖拽列布局。
*   **组件重构**：
    *   `AppSidebar`: 实现 `History` 与 `ProjectList` 的按需加载。
    *   `GlobalHeader`: 承载品牌标识与模式切换。
*   **编辑器持久化**：集成 TipTap，配合 Debounce 技术实现内容自动保存至数据库。

### 4.3 独立的 Prompt 仓库
*   新建 `lib/ai/prompts-canvas.ts`，专门存放 Canvas 基础指令及各项技能（Skills）的详细 Prompts。

---

## 5. 实施路线图 (Roadmap)
1.  **[Step 1] 数据库底座 (Completed ✅ & Tested 🛡️)**：定义 `Project` Schema，支持内容持久化。
    *   已完成 `Project` 表创建，包含 `id`, `name`, `content`, `userId`, `updatedAt` 等字段。
    *   已在 `Chat` 表中添加 `projectId` 可选关联字段。
    *   已在 `lib/db/queries.ts` 中实现项目的 CRUD 查询函数。
    *   **验证情况**：已通过 `tests/test-canvas-db.ts` 自动化测试，覆盖了项目创建、内容自动保存、以及 Chat-Project 关联关系。
2.  **[Step 2] 全局 UI 架构调整 (Completed ✅)**：
    *   已实现全局顶部 `GlobalHeader`，包含品牌标识与 `Chat | Canvas` 模式切换。
    *   已改造 `AppSidebar`：支持根据模式显示 `Chat History` 或 `Project Workspace`。
    *   已引入 `ViewModeContext` 实现全局模式状态同步。
    *   已实现 Canvas 可拖拽布局，使用 `react-resizable-panels` 库支持编辑器与 AI 栏宽度自定义。
3.  **[Step 3] 编辑器与 API 联动 (Completed ✅)**：
    *   已实现项目创建、列表获取、删除等后端 Server Actions 和 API 端点。
    *   已开发 `ProjectList` 侧边栏组件，支持项目的新增与切换。
    *   已实现编辑器（Editor）与数据库的联动，支持 1000ms 防抖自动保存内容。
    *   已通过 `ProjectProvider` 实现项目状态在侧边栏、编辑器和 AI 助手间的全局同步。
4.  **[Step 4] 独立 AI 逻辑实现 (Completed ✅)**：
    *   **Context 注入**：已实现 `/api/chat` 自动读取 `projectId` 对应的编辑器内容并注入 System Prompt。
    *   **Skill 封装**：实现了“行业情况分析”和“技术壁垒解构”两个技能提示词。
    *   **API 分流**：完成了 `mode: 'canvas'` 的后端大分流，跳过任务拆解 SOP，实现极速响应。
    *   **前端联动**：`AiSidebar` 已集成 `useChat`，支持模型选择、技能切换和上下文同步。
5.  **[Step 5] 技能自定义与管理系统 (Completed ✅)**：
    *   **数据库支持**：已新增 `Skill` 表，支持持久化存储自定义 Prompt。
    *   **管理弹窗**：实现了“侧边栏列表 + 编辑区域”布局的 Skill 管理器（SkillManagerModal）。
    *   **动态调用**：AI 逻辑已实现从数据库实时获取最新的 Skill Prompt。
    *   **自动初始化**：为新用户自动初始化“行业分析”和“技术壁垒”默认技能。
6.  **[Step 6] UI/UX 深度打磨 (Completed ✅)**：
    *   **侧边栏折叠**：实现了一键收起/展开侧边栏功能，收起时宽度仅 8px，极大释放屏幕空间。
    *   **零干扰模式**：在侧边栏折叠状态下，自动隐藏所有文字标签、新建按钮及用户信息，实现真正的“沉浸式”体验。
    *   **图标精简**：去除了 `ChatHeader` 中与全局导航栏冲突的冗余切换图标，使界面更加简洁专业。
    *   **编辑器性能优化**：实现了高度自适应的 TextArea，解决了长文本渲染时的滚动阻碍和空白问题。
7.  **[Step 7] 发布与分发准备 (Completed ✅)**：
    *   **小白友好 README**：重写了 `README.md`，提供了详尽的 Docker 启动指南和 FAQ。
    *   **隐私保护**：通过本地数据库策略，确保推送代码时不会泄露个人聊天记录。
    *   **技能同步**：实现了 Skill 自动初始化机制，保证新用户下载即用。
8.  **后续拓展**：一键填空、多格式导出。
