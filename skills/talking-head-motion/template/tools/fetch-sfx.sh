#!/usr/bin/env bash
# 下载模板用到的真实录音音效到 public/sfx/。
# 音效来自 Pixabay（Pixabay Content License），这里不直接转存，而是从 HyperFrames 的 npm 包里取出来用。
# 想换成自己的音效：把同名 mp3 放进 public/sfx/，或改 src/sfx.js 里的 SOUND 表。
set -euo pipefail
cd "$(dirname "$0")/.."
VER=0.8.171
tmp=$(mktemp -d)
(cd "$tmp" && npm pack "hyperframes@$VER" --silent >/dev/null)
mkdir -p public/sfx
tar xzf "$tmp/hyperframes-$VER.tgz" -C "$tmp" package/dist/skills/media-use/audio/assets/sfx
cp "$tmp"/package/dist/skills/media-use/audio/assets/sfx/*.mp3 public/sfx/
rm -rf "$tmp"
ls public/sfx
