# D.O.L.I

[ [English](README.md) | 中文 ]

**D.O.L.I** (**D**egrees **o**f **L**ewdity with **I**ntelligence) 是 [Degrees of Lewdity](https://gitgud.io/Vrelnir/degrees-of-lewdity) 的智能增强模组，通过 LLM 为游戏带来更丰富、更动态的体验。

## 快速开始

1. 从 [Releases](../../releases) 下载 `DOLI.mod.zip`
2. 在 [ModLoader](https://github.com/Lyoko-Jeremie/sugarcube-2-ModLoader)（≥ 2.0.0）中通过 side load 导入 `DOLI.mod.zip`
3. 启动游戏，在游戏左下角设置中选择 DOLI 选项卡，调整模组相关配置。

## 特性

### 🤖 智能助手

游戏内嵌的 AI 对话面板，基于 [ReAct](https://arxiv.org/abs/2210.03629) Agent 模式：

- 悬浮按钮一键打开，随时与助手交互
- 内置多种 Tool，可感知游戏状态和查询信息
- 支持多轮对话、多对话记录管理
- 支持自定义 LLM 后端（OpenAI 兼容 API）

### ⚔️ 战斗文本生成

AI 驱动的战斗场景叙事，告别重复枯燥的战斗文本：

- 自动提取每回合战斗事件（接触、动作、衣物等）
- 基于半结构化的 Prompt 模板，自由调整文本偏好风格
- 由 LLM 实时生成文本，提供类似 [SillyTavern](https://github.com/SillyTavern/SillyTavern) 的丰富文本体验
- 可折叠 UI 面板，不干扰原版游戏体验

### 🎥 敬请期待

更多功能正在开发中，敬请期待！

## 开发

```bash
# 克隆仓库（含 submodule）
git clone --recurse-submodules https://github.com/ArsNativa/Degrees-of-Lewdity-Intelligence.git
cd Degrees-of-Lewdity-Intelligence

npm run dev:init   # 首次初始化（构建 ModLoader + DOLI + Dev Loader）
npm run dev        # 日常开发（webpack watch + dev server）
npm run pack       # 构建 + 打包 DOLI.mod.zip
```

## 许可证

本项目基于 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) 协议发布。
