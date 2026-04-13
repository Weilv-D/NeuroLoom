# NeuroLoom

<p align="center">
  <img src="./docs/workflow.svg" alt="NeuroLoom Workflow" width="100%">
</p>

**NeuroLoom** 是一个呈现电影级视觉效果、开源的 2.5D 神经网络执行回放与解释器。它借助高度打磨的 WebGL/WebGPU 图形技术，在浏览器中精准可视化 Hugging Face 等平台上的现代化前沿（SOTA）微型神经网络的完整前向和反向传播过程。

*其他语言版本：[English](README.md), [简体中文](README_zh.md)*

## 核心特性

- **微型 SOTA 可视化生成**：项目内置了对现代极简架构的定义和状态导出支持，包括：
  - **Tiny MLP-Mixer**：抛弃传统卷积，通过 Token Mixing 和 Channel Mixing 两个维度的解耦实现特征交叉。
  - **Tiny ConvNeXt**：展现基于大核深度可分离卷积（Depthwise Conv）和倒置瓶颈设计（Inverted Bottleneck）的现代化视觉处理架构。
  - **Tiny Llama**：解剖包含旋转位置编码（RoPE）、分组查询注意力（GQA）以及 SwiGLU 激活函数等前沿机制配置的 Transformer。
- **电影级渲染**：利用 `@react-spring/three` 驱动物理阻尼动画，配合毛玻璃折射材质呈现张量流动。
- **动态回推与纯浏览器推理**：基于 ONNX Runtime Web + WebGPU 实时加载执行，非静态动画素材。
- **Trace 驱动引擎**：独创 `.loomtrace` 二进制格式格式，全量捕获并还原节点的确定性交互、张量形态。
- **双引擎呈现**：用于解说演示视角的 *Story Mode*（故事模式）和专为逐帧底层数据研读优化的 *Studio Mode*（工作室模式）。
- **张量冻结解剖**：悬停或点选并冻结神经元节点，即可在界面上深度读取原始输入输出张量、梯度指标及多头注意力矩阵（Attention Matrix）。

## 快速开始

请确保本地已安装 `Node.js 22+` 与 `pnpm 10+`。若需开发与重建图结构，可根据需要配置支持 `torch` 与 `onnxruntime` 的 Python 3 环境库。

```bash
# 1. 安装项目 NPM 依赖
pnpm install

# 2. 构建项目各个核心包结构
pnpm build

# 3. 产出三款核心 SOTA 模型的官方 Trace 轨迹文件
pnpm generate:traces

# 4. 启动本地 3D 渲染服务器 (默认在 http://localhost:5173)
pnpm dev
```

## 架构组成

- `apps/studio`: 基于 WebGL 和 React 19 的前沿 2.5D Studio 前端应用，包含渲染引擎。
- `packages/core`: 定义和解析 `.loomtrace` 核心协议的核心引擎，严格校验物理节点（Nodes）及时间轴帧（Timeline）。
- `packages/official-traces`: 官方支持架构的拓扑图布局计算、场景叙事绑定库。
- `tools/exporters`: 负责将模拟好的多维张量 Payload 数据压缩并打包成轨迹二进制文。
- `tools/model-training`: PyTorch 微型网络训练与中间级张量提取工具，支持利用 GPU(CUDA) 加速捕获计算流。
