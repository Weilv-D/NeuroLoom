# NeuroLoom

<p align="center">
  <img src="./docs/workflow.svg" alt="NeuroLoom Workflow" width="100%">
</p>

NeuroLoom 是一个以实时流为核心、面向 Transformer 模型激活值的三维可视化舞台，当前聚焦于 `Qwen/Qwen3.5-0.8B`。它将一段文本对话转化为一幅稠密的星场——残差流、分组注意力、DeltaNet 记忆与解码压力交织其中。会话可导出为 `.loomtrace` 格式并逐帧回放检视。

*其他语言版本：[English](README.md), [简体中文](README_zh.md)*

## 核心特性

- **实时会话流** — 本地 Runner 启动 Qwen 会话，通过 WebSocket 逐 Token 推送事件，实时驱动三维舞台。
- **逐帧回放** — 任意会话均可导出为 `.loomtrace`，本地加载后在时间轴上拖拽检视，无需 Runner 在线。
- **86,400 神经元星场** — 24 个 Transformer 块 ×（3,584 FFN + 16 注意力头），以 GPU 点云配合自定义 GLSL 着色器渲染。
- **真实激活值捕获** — Python 工具通过 PyTorch 前向钩子提取模型的实际神经元激活值。
- **后端适配** — 接入 LM Studio、Ollama 或 vLLM 进行实时推理，同时保留 NeuroLoom 视觉协议。

## 仓库结构

| 包 | 说明 |
|----|------|
| `packages/core` | Zod schema、ReplayEngine、`.loomtrace` 归档 I/O、校验器 |
| `packages/official-traces` | Qwen 合成轨迹生成、实时会话录制器 |
| `apps/studio` | React 19 + Vite + R3F 三维可视化前端 |
| `tools/runner` | 本地代理服务器（WebSocket + SSE），桥接推理后端 |
| `tools/exporters` | 生成官方兜底回放 `.loomtrace` 文件 |
| `tools/activation-capture` | Python 工具：通过 PyTorch 钩子提取真实神经元激活值 |

## 快速开始

前置条件：

- `Node.js 22+`
- `pnpm 10+`

安装并启动：

```bash
pnpm install
pnpm build
pnpm dev
```

`pnpm dev` 会在后台生成轨迹文件并立即启动 Vite 开发服务器（`http://localhost:5173`）。

在另一个终端启动实时 Runner：

```bash
pnpm dev:runner:ollama    # 或 :lmstudio / :vllm
```

若 Runner 不可用，应用会自动回退到合成回放模式。

## 真实激活值捕获

从任意兼容的 Transformer 模型中提取真实神经元激活值：

```bash
cd tools/activation-capture
pip install -r requirements.txt

# 生成包含真实激活值的 .loomtrace 文件
python capture.py --prompt "你好，请介绍一下自己" --model Qwen/Qwen3.5-0.8B --output trace.loomtrace

# 或直接流式推送到运行中的 NeuroLoom Runner
python capture.py --prompt "解释一下量子计算" --runner-url ws://127.0.0.1:7778
```

捕获工具在 每个 Transformer 块的 MLP 和注意力层上挂载 PyTorch 前向钩子，产出的神经元激活值与 86,400 神经元布局完全对应。

## 常用命令

```bash
pnpm build              # 完整构建（轨迹 + 所有包）
pnpm dev                # 启动 Studio（后台生成轨迹）
pnpm test               # 运行全部测试（41 个）
pnpm lint               # ESLint 检查
pnpm format:check       # Prettier 格式检查
pnpm generate:traces    # 重新构建 core → official-traces → exporters
pnpm validate:samples   # 按 schema 校验生成的 .loomtrace
pnpm dev:runner         # 启动 Runner（合成模式）
pnpm dev:runner:ollama  # 启动 Runner + Ollama 后端
pnpm dev:runner:lmstudio # 启动 Runner + LM Studio 后端
pnpm dev:runner:vllm    # 启动 Runner + vLLM 后端
```

## 本地 Runner

接口列表：

- `POST /v1/chat/completions` — 根据提示词启动新会话
- `GET /sessions` — 列出近期会话
- `POST /sessions/:sessionId/cancel` — 终止实时会话
- `GET /backend/probe` — 验证后端可达性
- `WS /live/:sessionId` — 流式推送 Token 事件
- `GET /sessions/:sessionId/trace` — 导出会话为 `.loomtrace`
- `GET /health` — Runner 状态与模式

环境变量：

- `NEUROLOOM_RUNNER_PORT`
- `NEUROLOOM_BACKEND_URL`
- `NEUROLOOM_BACKEND_API_KEY`
- `NEUROLOOM_BACKEND_MODEL`
- `NEUROLOOM_BACKEND_STREAM`
- `NEUROLOOM_BACKEND_THINK`
- `NEUROLOOM_BACKEND_PROVIDER`
- `NEUROLOOM_SESSION_RETENTION`

详见 [docs/backends.md](./docs/backends.md) 了解后端配置说明。

## `.loomtrace` 格式

每帧包含：Token 文本、层归一化值、残差带、分组注意力分数、注意力行摘要、采样单元星、Top Logits、相机锚点以及逐神经元激活状态。

详见 [docs/loomtrace-spec.md](./docs/loomtrace-spec.md) 了解完整的格式规格。
