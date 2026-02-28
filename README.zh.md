# DOLI — **D**egrees **o**f **L**ewdity with **I**ntelligence

[English](README.md)

**DOLI** 是 [Degrees of Lewdity](https://gitgud.io/Vrelnir/degrees-of-lewdity) 的智能增强模组，通过 AI 能力为游戏带来更丰富、更动态的体验。

## 特性

### 🤖 智能助手

游戏内嵌的 AI 对话面板，基于 ReAct Agent 模式：

- 悬浮按钮一键打开，随时与助手交互
- 自动感知当前游戏状态（时间、地点、属性、NPC 关系等）
- 内置多种 Tool，可查询详细游戏信息
- 支持多轮对话与多线程管理
- 支持自定义 LLM 后端（OpenAI 兼容 API）

### ⚔️ 战斗文本智能生成

AI 驱动的战斗场景叙事，告别重复枯燥的战斗文本：

- 自动提取每回合战斗事件（接触、衣物、控制力变化等）
- 基于结构化 Prompt 模板，由 LLM 实时生成战斗描述
- 可折叠/展开的 UI 面板，不干扰原版游戏体验
- 支持手动/自动两种生成模式
- 可保留原版文本并行展示

### 🌐 多语言

- 模组 UI 支持简体中文 / English
- AI 输出语言跟随设置或 Prompt 配置

## 安装

将 `DOLI.mod.zip` 通过 ModLoader 旁加载导入即可。要求 ModLoader ≥ 2.0.0。

## 开发

```bash
npm run dev:init   # 首次初始化（构建 ModLoader + DoL + Dev Loader）
npm run dev        # 日常开发（webpack watch + dev server）
npm run build      # 构建
npm run pack       # 构建 + 打包 DOLI.mod.zip
```

详见 [开发与测试流程](../docs/开发与测试流程.md)。
