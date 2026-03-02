# D.O.L.I

[ English | [中文](README.zh.md) ]

**D.O.L.I** (**D**egrees **o**f **L**ewdity with **I**ntelligence) is an AI-enhanced mod for [Degrees of Lewdity](https://gitgud.io/Vrelnir/degrees-of-lewdity), bringing richer and more dynamic experiences to the game through LLM.

## Quick Start

1. Download `DOLI.mod.zip` from [Releases](../../releases)
2. Use side load to import `DOLI.mod.zip` in [ModLoader](https://github.com/Lyoko-Jeremie/sugarcube-2-ModLoader) (≥ 2.0.0)
3. Launch the game, go to the settings in the bottom left corner, select the DOLI tab, and adjust the mod-related configurations.

## Features

### 🤖 Intelligent Assistant

An in-game AI assistant powered by the [ReAct](https://arxiv.org/abs/2210.03629) Agent pattern:

- Floating button for instant access during gameplay
- Built-in tools for perceiving game state and querying information
- Intelligent assistant with multi-turn/thread conversation
- Compatible with any OpenAI-compatible LLM backend

### ⚔️ AI Combat Narration

AI-driven combat scene narration — no more repetitive battle text:

- Automatically extracts per-turn combat events (contact, actions, clothing, etc.)
- Semi-structured prompt templates with customizable text style preferences
- Real-time LLM generation for rich narrative text, similar to [SillyTavern](https://github.com/SillyTavern/SillyTavern)
- Collapsible UI panel that doesn't interfere with the vanilla experience

### 🎥 TBD

More features coming soon!

## Development

```bash
# Clone the repository (with submodules)
git clone --recurse-submodules https://github.com/ArsNativa/Degrees-of-Lewdity-Intelligence.git
cd Degrees-of-Lewdity-Intelligence

npm run dev:init   # First-time setup (build ModLoader + DoL + Dev Loader)
npm run dev        # Daily development (webpack watch + dev server)
npm run pack       # Build + package DOLI.mod.zip
```

## License

This work is licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).
