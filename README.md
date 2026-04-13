# NeuroLoom

NeuroLoom 是一个面向 `MLP`、`CNN` 和标准 `GPT-style Transformer` 的开源神经网络运行回放解释器。

它不直接连接任意模型运行时，也不试图成为通用图可视化平台。NeuroLoom 读取受控的 `.loomtrace` 回放文件，把一次训练或推理过程重建成一个 2.5D 动画场景，让发光、流动、镜头切换和数值检查始终对齐到同一帧。

## 当前状态

当前仓库已经完成了 NeuroLoom v1 的核心闭环，但还没有把计划中的所有增强项全部做完。

已经完成的部分包括：

- `Replay-first` 工作流
- 三类官方模型族支持：`mlp`、`cnn`、`transformer`
- 三套官方内容：`spiral-2d-mlp`、`fashion-mnist-cnn`、`tiny-gpt-style-transformer`
- `Story Mode` 与 `Studio Mode`
- 时间轴播放、暂停、逐帧步进、章节跳转、结构选择、本地 `.loomtrace` 导入、PNG 导出
- 三类专属分析面板：
  - `MLP` 的 decision boundary explorer
  - `CNN` 的 feature explorer
  - `Transformer` 的 attention explorer
- `.loomtrace` schema、validator、archive I/O、replay engine、CLI

还没有完成的部分主要是：

- 浏览器内官方 trace 重建能力，也就是计划中的 `ONNX Runtime Web + WebGPU` 渐进增强链路
- 独立的视觉回归基线和更完整的发布级测试体系
- 更正式的文档站和开源发布包装
- 单独的“局部冻结”工作流；当前 Studio 通过选择聚焦和场景衰减来突出局部，但没有独立 freeze 控件

如果按产品定义来看，NeuroLoom 已经是一个可运行、可构建、可演示的 v1 MVP；如果按最初完整路线图来看，它还没有结束。

## 项目在做什么

NeuroLoom 关注的不是“神经网络长什么样”，而是“神经网络在某一次运行里到底发生了什么”。

项目把一次受控运行拆成一组确定性的回放帧。每一帧都同时包含：

- 结构语义：有哪些节点、边和层级
- 时间语义：当前是第几步、第几个子阶段、属于哪一个 phase
- 视觉语义：哪些地方该发亮、哪些连接在流动、镜头该聚焦哪里
- 数值语义：这一帧的激活、注意力、特征图、梯度和指标是什么

NeuroLoom 的目标不是把网络“画出来”，而是把一次运行“演出来”，同时保证每个视觉效果都能回到可检查的真实数据。

## 产品形态

NeuroLoom 现在提供两种使用方式，共用同一套回放内核。

### Story Mode

`Story Mode` 面向讲解和展示。它会按章节组织一条官方叙事路径，结合预设镜头、章节说明、关键帧注释和高亮焦点，引导用户理解一次运行中最重要的变化。

### Studio Mode

`Studio Mode` 面向逐帧分析。它提供：

- 时间轴拖拽和逐帧播放
- 章节之间的快速跳转
- 结构树选择
- 右侧 inspector
- family-specific explorer
- 本地 `.loomtrace` 文件导入
- 当前帧 PNG 导出

在当前实现里，选择一个节点不仅会更新右侧面板，也会反向驱动 2.5D 场景本身，包括节点高亮、邻接连线增强、非焦点元素衰减，以及 `Transformer` attention ribbon 的局部聚焦。

## 官方内容

### `spiral-2d-mlp`

这套内容用一个小型 MLP 展示输入特征如何扇出到隐藏层，loss 如何收束成标量，再如何通过 backward pulse 返回早期层。Studio 里可以切换 decision boundary snapshot，并查看不同区域的响应强度。

### `fashion-mnist-cnn`

这套内容围绕 stage 化卷积网络展开，重点是特征图堆叠、卷积响应、池化压缩和分类头提升。Studio 里可以切换 stage 和 channel，查看 stage map、channel response 和 top classes。

### `tiny-gpt-style-transformer`

这套内容围绕标准 `decoder-only Transformer` 构建，重点是 token rail、attention ribbon、residual band 和 decode candidates。Studio 里可以切换 head 和 token，查看 attention matrix、聚焦行和候选 token。

## `.loomtrace`

`.loomtrace` 是 NeuroLoom v1 的唯一输入协议。它是一个 zip archive，用来描述一次受控运行的回放内容。

当前协议核心由五部分组成：

- `manifest.json`
- `graph.json`
- `timeline.ndjson`
- `payload/`
- `narrative.json`

`preview.webp` 在协议中是可选项，不是当前所有官方样例都必须携带的强制入口。

这个协议解决的不是“任意 runtime dump”问题，而是“受控解释回放”问题。它明确约束：

- 支持的模型族只有 `mlp`、`cnn`、`transformer`
- 支持的 phase 只有 `forward`、`loss`、`backward`、`update`、`decode`
- 回放必须是确定性的
- renderer 依赖稳定的语义节点和边，而不是运行时临时推断

更详细的协议说明见 [docs/loomtrace-spec.md](docs/loomtrace-spec.md)。

## 仓库结构

NeuroLoom 采用 monorepo 组织，分成三层。

### `apps/studio`

Web 端工作台。使用 `React 19`、`Vite`、`React Three Fiber`、`Three.js` 和 `@react-three/postprocessing` 构建，负责 Story Mode、Studio Mode、主场景渲染、时间轴和 inspector。

### `packages/core`

项目的协议与回放内核。这里定义 `.loomtrace` schema、语义校验、archive 读写、replay engine、renderer contract 和 CLI。

### `tools/exporters`

官方内容生成器。它负责构建三套官方 trace，并把样例输出到 `apps/studio/public/traces/`。

## 技术路线

NeuroLoom 当前的主渲染基线是 `WebGL + EffectComposer`。这条路线是为了保证 2.5D 场景、发光、景深、色带和后处理链的稳定性，而不是为了追求实验性 API。

`WebGPU` 在当前仓库里还没有进入主渲染路径。它只保留为后续官方 demo 的浏览器内 trace 重建能力，也就是一个渐进增强方向，而不是当前产品的前提条件。

## 本地运行

要求：

- `Node.js 22+`
- `pnpm 10+`

安装依赖：

```bash
pnpm install
```

生成官方样例：

```bash
pnpm generate:traces
```

启动本地开发环境：

```bash
pnpm dev
```

构建整个仓库：

```bash
pnpm build
```

运行测试：

```bash
pnpm test
```

校验官方样例：

```bash
pnpm validate:samples
```

## 交互说明

Studio 当前支持以下快捷操作：

- `Space`：播放 / 暂停
- `← / →`：逐帧步进
- `S`：导出当前帧 PNG

用户既可以从内置官方样例开始，也可以直接导入本地 `.loomtrace` 文件。

## 范围边界

NeuroLoom v1 的边界是明确收缩过的。

它不是：

- 通用模型运行时监控平台
- Live streaming 可视化系统
- 任意模型 hook SDK
- 通用 DAG 回退查看器
- 多人协作或远程任务管理系统

它当前专注于一件事：把三类标准模型族的一次受控运行，以美观、可交互、可审计的方式重放出来。

## 文档

- [docs/index.md](docs/index.md)
- [docs/loomtrace-spec.md](docs/loomtrace-spec.md)

项目定义保持一致：

> NeuroLoom is a neural network replay explainer.
