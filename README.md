# DOLI — **D**egrees **o**f **L**ewdity with **I**ntelligence

[中文](README.zh.md)

**DOLI** is an AI-enhanced mod for [Degrees of Lewdity](https://gitgud.io/Vrelnir/degrees-of-lewdity), bringing richer and more dynamic experiences to the game through intelligent capabilities.

## Features

### 🤖 Intelligent Assistant

An in-game AI chat panel powered by the ReAct Agent pattern:

- Floating button for instant access during gameplay
- Context-aware — automatically perceives current game state (time, location, attributes, NPC relationships, etc.)
- Built-in tools for querying detailed game information
- Multi-turn conversations with thread management
- Compatible with any OpenAI-compatible LLM backend

### ⚔️ AI Combat Narration

AI-driven combat scene narration — no more repetitive battle text:

- Automatically extracts per-turn combat events (contact, clothing, control shifts, etc.)
- Generates vivid combat descriptions in real-time via structured prompt templates
- Collapsible UI panel that doesn't interfere with the vanilla experience
- Manual or automatic generation modes
- Option to display original text side-by-side

### 🌐 Multilingual

- Mod UI supports Simplified Chinese / English
- AI output language follows settings or prompt configuration

## Installation

Import `DOLI.mod.zip` via ModLoader sideloading. Requires ModLoader ≥ 2.0.0.

## Development

```bash
npm run dev:init   # First-time setup (build ModLoader + DoL + Dev Loader)
npm run dev        # Daily development (webpack watch + dev server)
npm run build      # Build
npm run pack       # Build + package DOLI.mod.zip
```

See [Development & Testing Workflow](../docs/开发与测试流程.md) for details.
