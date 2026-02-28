#!/bin/bash
# ============================================================
#  dev-init.sh — 一键初始化 dev 环境
#
#  完成以下工作：
#    1. 编译 ModLoader 核心（yarn install + tsc + webpack）
#    2. 编译 ModLoader 内置 Mod（ModSubUiAngularJs + ModLoaderGui）
#    3. 编译 DoL 本体（tweego → HTML）
#    4. 注入 ModLoader + 内置 Mod 到 DoL HTML（insert2html）
#    5. 构建 DOLI 主 bundle（webpack）
#    6. 打包 Dev Loader Mod（一次性 zip）
#
#  产出：
#    submodules/DOL/Degrees of Lewdity *.html.mod.html  ← 带 ModLoader 的游戏
#    dist/DOLI.js                                       ← 主 bundle
#    dev-loader/*.mod.zip                               ← Dev Loader Mod
#
#  用法：
#    bash scripts/dev-init.sh                   # 完整初始化
#    bash scripts/dev-init.sh --skip-dol        # 跳过 DoL 编译
#    bash scripts/dev-init.sh --skip-modloader  # 跳过 ModLoader 编译
#
#  前置要求：
#    - Node.js 18+
#    - corepack (npm install -g corepack && corepack enable)
#    - yarn 3 (corepack 会自动安装)
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"          # 项目根目录
MODLOADER_DIR="$PROJECT_DIR/submodules/ModLoader"
DOL_DIR="$PROJECT_DIR/submodules/DOL"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[dev-init]${NC} $*"; }
warn()  { echo -e "${YELLOW}[dev-init]${NC} $*"; }
error() { echo -e "${RED}[dev-init]${NC} $*" >&2; }

SKIP_DOL=false
SKIP_MODLOADER=false

for arg in "$@"; do
  case "$arg" in
    --skip-dol) SKIP_DOL=true ;;
    --skip-modloader) SKIP_MODLOADER=true ;;
  esac
done

# ── Helper: ensure yarn is available ─────────────────────────
ensure_yarn() {
  if command -v yarn &>/dev/null; then
    return 0
  fi
  info "yarn not found, setting up via corepack..."
  if ! command -v corepack &>/dev/null; then
    info "Installing corepack..."
    npm install -g corepack 2>&1 | tail -1
  fi
  COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack enable 2>/dev/null || true
  COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack install -g yarn@3.4.1 2>&1 | tail -1
  if ! command -v yarn &>/dev/null; then
    error "Failed to install yarn! Please install manually: npm install -g corepack && corepack enable"
    exit 1
  fi
  info "yarn $(yarn --version) ready."
}

# ── Helpers: build built-in mods from full modList ───────────
has_script() {
  local script_name="$1"
  node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts['$script_name'] ? 0 : 1);" >/dev/null 2>&1
}

# Usage: build_mod_from_entry "mod/SomeMod/SomeMod.mod.zip"
build_mod_from_entry() {
  local mod_entry="$1"
  local mod_name
  mod_name="$(echo "$mod_entry" | sed -E 's#^mod/([^/]+)/.*#\1#')"
  local mod_dir="$MODLOADER_DIR/mod/$mod_name"
  local zip_path="$MODLOADER_DIR/$mod_entry"

  info "  Building $mod_name..."
  cd "$mod_dir"

  if [ -f package.json ]; then
    if [ ! -d node_modules ]; then
      yarn install 2>&1 | grep -E "YN0000.*Done|YN0000.*Failed" | tail -1 || true
    fi

    if has_script "ts:type"; then
      yarn run ts:type 2>&1 | tail -3
    fi
    if has_script "build:ts"; then
      yarn run build:ts 2>&1 | tail -3
    fi
    if has_script "build:webpack"; then
      yarn run build:webpack 2>&1 | tail -3
    fi
    if has_script "build-core:webpack"; then
      yarn run build-core:webpack 2>&1 | tail -3
    fi
  fi

  node "$MODLOADER_DIR/dist-insertTools/packModZip.js" boot.json 2>&1 | tail -1

  if [ ! -f "$zip_path" ]; then
    error "  $(basename "$zip_path") not found after build!"
    exit 1
  fi
  info "  $mod_name ✓"
}

# ── Step 1: Build ModLoader Core ─────────────────────────────
if [ "$SKIP_MODLOADER" = false ]; then
  info "=== Step 1/6: Building ModLoader Core ==="
  ensure_yarn

  cd "$MODLOADER_DIR"

  if [ ! -d node_modules ]; then
    info "Installing ModLoader dependencies (yarn)..."
    yarn install 2>&1 | grep -E "YN0000.*Done|YN0000.*Failed" | tail -1 || true
  fi

  # Build sequence must match CI (.github/workflows/Build-ModLoader-Package.yml):
  #   ts:BeforeSC2 → webpack:BeforeSC2 → ts:ForSC2 → webpack:insertTools
  # ts:BeforeSC2 generates .d.ts type declarations that built-in mods reference.
  info "Compiling BeforeSC2 (tsc — generates .d.ts for mods)..."
  npx tsc -p src/BeforeSC2/tsconfig.json 2>&1 | tail -3

  info "Bundling BeforeSC2 (webpack)..."
  npx webpack -c webpack.config.js 2>&1 | tail -3

  info "Compiling ForSC2 (tsc)..."
  npx tsc -p src/ForSC2/tsconfig.json 2>&1 | tail -3

  info "Bundling insertTools (webpack)..."
  npx webpack -c webpack-insertTools.config.js 2>&1 | tail -3

  # Verify critical outputs
  if [ ! -f "dist-BeforeSC2/BeforeSC2.js" ]; then
    error "BeforeSC2.js not found after build!"
    exit 1
  fi
  if [ ! -f "dist-insertTools/insert2html.js" ]; then
    error "insert2html.js not found after build!"
    exit 1
  fi
  info "ModLoader core build complete."
else
  info "=== Step 1/6: Skipping ModLoader build (--skip-modloader) ==="
  if [ ! -f "$MODLOADER_DIR/dist-BeforeSC2/BeforeSC2.js" ]; then
    error "BeforeSC2.js not found! Cannot skip ModLoader build."
    exit 1
  fi
fi

# ── Step 2: Build Full Built-in ModList ──────────────────────
if [ "$SKIP_MODLOADER" = false ]; then
  info "=== Step 2/6: Building Full Built-in ModList ==="

  cd "$MODLOADER_DIR"
  mapfile -t FULL_MOD_ENTRIES < <(grep -v '^\s*//' modList.json | grep 'mod.zip' | sed -E 's/^\s*"([^"]+)".*/\1/')

  for mod_entry in "${FULL_MOD_ENTRIES[@]}"; do
    build_mod_from_entry "$mod_entry"
  done

  info "Full built-in mod list built (${#FULL_MOD_ENTRIES[@]} mods)."
else
  info "=== Step 2/6: Skipping built-in mods (--skip-modloader) ==="
fi

# ── Step 3: Compile DoL ──────────────────────────────────────
if [ "$SKIP_DOL" = false ]; then
  info "=== Step 3/6: Compiling DoL ==="

  cd "$DOL_DIR"
  bash compile.sh 2>&1 | tail -3

  DOL_HTML=$(find "$DOL_DIR" -maxdepth 1 -name "Degrees of Lewdity*.html" ! -name "*.mod.html" | head -1)
  if [ -z "$DOL_HTML" ]; then
    error "DoL HTML not found after compile!"
    exit 1
  fi
  info "DoL compiled: $(basename "$DOL_HTML")"
else
  info "=== Step 3/6: Skipping DoL compile (--skip-dol) ==="
  DOL_HTML=$(find "$DOL_DIR" -maxdepth 1 -name "Degrees of Lewdity*.html" ! -name "*.mod.html" | head -1)
  if [ -z "$DOL_HTML" ]; then
    error "DoL HTML not found! Cannot skip DoL compile."
    exit 1
  fi
fi

# ── Step 4: Patch SC2 + Inject ModLoader (Full ModList) ──────
info "=== Step 4/6: Injecting ModLoader into DoL HTML ==="

cd "$MODLOADER_DIR"

# CI parity: patch SugarCube startup first, so ModLoader starts before main game bootstrap
node dist-insertTools/sc2PatchTool.js \
  "$DOL_HTML" 2>&1 | tail -3

PATCHED_HTML="${DOL_HTML}.sc2patch.html"
if [ ! -f "$PATCHED_HTML" ]; then
  error "SC2 patch failed — .sc2patch.html not found!"
  exit 1
fi

node dist-insertTools/insert2html.js \
  "$PATCHED_HTML" \
  modList.json \
  dist-BeforeSC2/BeforeSC2.js 2>&1 | tail -3

MOD_HTML="${PATCHED_HTML}.mod.html"
if [ ! -f "$MOD_HTML" ]; then
  error "ModLoader injection failed — .mod.html not found!"
  exit 1
fi
info "ModLoader injected: $(basename "$MOD_HTML")"

# ── Step 5: Build DOLI ────────────────────────────────
info "=== Step 5/6: Building DOLI ==="

cd "$PROJECT_DIR"

if [ ! -d node_modules ]; then
  info "Installing DOLI dependencies..."
  npm install 2>&1 | tail -3
fi

npm run build 2>&1 | tail -5

if [ ! -f dist/DOLI.js ]; then
  error "DOLI.js not found after build!"
  exit 1
fi
info "DOLI build complete."

# ── Step 6: Pack Dev Loader Mod ──────────────────────────────
info "=== Step 6/6: Packing Dev Loader Mod ==="

bash scripts/pack-dev-loader.sh 2>&1

info ""
info "=========================================="
info "  Dev environment ready!"
info "=========================================="
info ""
info "  DoL + ModLoader: $(basename "$MOD_HTML")"
info ""
info "  Start dev mode:  npm run dev"
info "  Open browser:    http://127.0.0.1:9900/"
info ""
info "  DevLoader source: Remote (/modList.json) — no manual sideload needed"
info "  Then:            edit code → save → refresh browser"
info "=========================================="
