#!/usr/bin/env bash
# 发版制品构建与校验。章节清单的唯一真源是 book.config.json（chapters[].skill），本脚本不硬编码任何章节。
#
#   scripts/build_release_artifacts.sh verify [TAG]   发版前校验；给了 TAG 时还校验 TAG 格式与 docs/release-notes/<TAG>.md
#   scripts/build_release_artifacts.sh build  TAG     产出 dist/ 下三个制品并自检
#
# 环境变量：DIST_DIR（默认 dist）
set -euo pipefail
export PYTHONIOENCODING=utf-8

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CONFIG="book.config.json"
DIST_DIR="${DIST_DIR:-dist}"
ARCHIVE_PREFIX="ai-native-sdlc-guidebook"
SKILLS_PREFIX="ai-native-sdlc-skills"
BOOK_SCRIPT="scripts/build_book.mjs"

fail() { echo "ERROR: $*" >&2; exit 1; }

find_python() {
  local c
  for c in python3 python; do
    if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)' >/dev/null 2>&1; then
      echo "$c"
      return 0
    fi
  done
  return 1
}

check_tag() {
  local tag="$1"
  [[ "$tag" =~ ^[0-9A-Za-z][0-9A-Za-z._-]*$ ]] || fail "非法 tag/ref '$tag'：只允许字母数字与 . _ -，且不能含 /（要进文件名）。发布时是否以 v 开头由 release job 另行强制"
}

# 从 book.config.json 读出 chapters[].skill，每行一个，保持章节顺序。
config_skills() {
  [ -f "$CONFIG" ] || fail "缺少 $CONFIG（章节顺序的唯一真源）"
  command -v node >/dev/null 2>&1 || fail "需要 node 来读取 $CONFIG"
  node -e '
    const fs = require("fs");
    const cfg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    if (!Array.isArray(cfg.chapters) || cfg.chapters.length === 0) { console.error("chapters 为空或不是数组"); process.exit(1); }
    const seen = new Set();
    for (const [i, ch] of cfg.chapters.entries()) {
      if (typeof ch.skill !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(ch.skill)) { console.error("chapters[" + i + "].skill 非法: " + JSON.stringify(ch.skill)); process.exit(1); }
      if (seen.has(ch.skill)) { console.error("chapters 中 skill 重复: " + ch.skill); process.exit(1); }
      seen.add(ch.skill);
      console.log(ch.skill);
    }
  ' "$CONFIG" || fail "$CONFIG 解析失败"
}

# 输出 SKILL.md 首个 frontmatter 块里 key 的值；frontmatter 不合法则返回非 0。
frontmatter_value() {
  local file="$1" key="$2"
  tr -d '\r' < "$file" | awk -v key="$key" '
    NR == 1 { if ($0 != "---") exit 2; next }
    $0 == "---" { closed = 1; exit }
    index($0, key ":") == 1 && !found {
      v = substr($0, length(key) + 2)
      sub(/^[ \t]+/, "", v); sub(/[ \t]+$/, "", v)
      gsub(/^["'"'"']|["'"'"']$/, "", v)
      print v; found = 1
    }
    END { if (!closed) exit 3; if (!found) exit 4 }
  '
}

cmd_verify() {
  local tag="${1:-}"
  local errors=0
  err() { echo "FAIL: $*" >&2; errors=$((errors + 1)); }

  [ -z "$tag" ] || check_tag "$tag"

  local f
  for f in README.md LICENSE "$CONFIG"; do
    [ -f "$f" ] || err "缺少根文件 $f"
  done
  [ -d skills ] || { err "缺少 skills/ 目录"; echo "verify: $errors 个问题" >&2; exit 1; }

  local -a cfg_skills
  mapfile -t cfg_skills < <(config_skills)
  echo "$CONFIG 声明了 ${#cfg_skills[@]} 个章节 skill"

  # 双向对账：config 里的每章都必须有目录，skills/ 下的每个目录都必须被 config 收录。
  local s d
  for s in "${cfg_skills[@]}"; do
    [ -d "skills/$s" ] || err "$CONFIG 声明了 $s，但 skills/$s 不存在"
  done
  for d in skills/*/; do
    [ -d "$d" ] || continue
    s="$(basename "$d")"
    printf '%s\n' "${cfg_skills[@]}" | grep -qxF -- "$s" || err "skills/$s 存在，但未被 $CONFIG 收录"
  done

  local file name rc
  for d in skills/*/; do
    [ -d "$d" ] || continue
    s="$(basename "$d")"
    file="skills/$s/SKILL.md"
    if [ ! -f "$file" ]; then err "$file 不存在"; continue; fi
    if [ "$(head -n1 "$file" | tr -d '\r')" != "---" ]; then err "$file 首行不是 ---"; continue; fi
    rc=0; name="$(frontmatter_value "$file" name)" || rc=$?
    case $rc in
      0) [ "$name" = "$s" ] || err "$file 的 name='$name' 与目录名 '$s' 不一致" ;;
      3) err "$file 的 frontmatter 没有闭合的 ---" ;;
      *) err "$file frontmatter 缺少 name:" ;;
    esac
    rc=0; frontmatter_value "$file" description >/dev/null || rc=$?
    [ $rc -eq 0 ] || err "$file frontmatter 缺少 description:（或为空行以外的非法结构）"
  done

  if [ -n "$tag" ]; then
    local notes="docs/release-notes/$tag.md"
    if [ -f "$notes" ]; then
      grep -q '[^[:space:]]' "$notes" || err "$notes 存在但内容为空：空正文会得到空白 release，请写内容或删除该文件"
      echo "发布说明: $notes（将用 --notes-file 覆盖自动生成）"
    else
      echo "发布说明: 没有 $notes，将使用 GitHub 自动生成"
    fi
  fi

  if [ "$errors" -ne 0 ]; then
    echo "verify 失败：$errors 个问题，终止发版" >&2
    exit 1
  fi
  echo "verify 通过：${#cfg_skills[@]} 个 skill 结构、frontmatter、name=目录名 均合法"
}

cmd_build() {
  local tag="${1:-}"
  [ -n "$tag" ] || fail "用法: $0 build TAG"
  check_tag "$tag"

  local py
  py="$(find_python)" || fail "需要 python3（用于生成 zip，跨平台一致）"
  [ -f "$BOOK_SCRIPT" ] || fail "$BOOK_SCRIPT 不存在：BOOK.md 无法生成，拒绝产出空文件或缺件的发版制品"

  local -a cfg_skills
  mapfile -t cfg_skills < <(config_skills)
  local s
  for s in "${cfg_skills[@]}"; do
    [ -d "skills/$s" ] || fail "skills/$s 不存在（$CONFIG 声明了它）"
  done

  local tarball="$DIST_DIR/$ARCHIVE_PREFIX-$tag-source.tar.gz"
  local zipfile="$DIST_DIR/$SKILLS_PREFIX-$tag.zip"
  local bookmd="$DIST_DIR/BOOK.md"

  mkdir -p "$DIST_DIR"
  rm -f "$tarball" "$zipfile" "$bookmd"

  # a. 全仓源码：排除 .git / dist / book / .build / .verify / node_modules / .scratch；--anchored 保证只排除仓库根下的这些名字，不误伤同名子目录。
  #    解包后带一层 <prefix>-<tag>/ 顶层目录（--transform 把根 "." 本身也改写成该目录）。
  local top="$ARCHIVE_PREFIX-$tag"
  echo "==> source tarball: $tarball"
  tar -czf "$tarball" \
    --anchored \
    --exclude='./.git' \
    --exclude='./dist' \
    --exclude='./book' \
    --exclude='./.build' \
    --exclude='./.verify' \
    --exclude='./node_modules' \
    --exclude='./.scratch' \
    --exclude="./$DIST_DIR" \
    --transform "s,^\.,$top," \
    -C "$ROOT" .

  # b. skills zip：顶层就是各章目录名（不带 skills/ 前缀），目录清单来自 book.config.json。
  echo "==> skills zip: $zipfile"
  "$py" - "$zipfile" skills "${cfg_skills[@]}" <<'PY'
import os, sys, zipfile
out, base, *names = sys.argv[1:]
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for name in names:
        root = os.path.join(base, name)
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames.sort()
            for fn in sorted(filenames):
                full = os.path.join(dirpath, fn)
                z.write(full, os.path.relpath(full, base).replace(os.sep, "/"))
PY

  # c. BOOK.md：严格按 CLI 契约调用；失败或空文件都直接报错。
  echo "==> BOOK.md: $bookmd"
  node "$BOOK_SCRIPT" --mode=book --out="$bookmd" || fail "node $BOOK_SCRIPT 失败"
  [ -s "$bookmd" ] || fail "$bookmd 不存在或为空：$BOOK_SCRIPT 没有真正产出内容"

  self_check "$py" "$tarball" "$zipfile" "$top" "${cfg_skills[@]}"
  print_manifest "$tarball" "$zipfile" "$bookmd"
}

self_check() {
  local py="$1" tarball="$2" zipfile="$3" top="$4"
  shift 4
  echo "==> 自检"
  local listing bad
  listing="$(tar -tzf "$tarball")"
  bad="$(grep -E "^($top|\.)/(\.git|dist|book|\.build|\.verify|node_modules|\.scratch)(/|$)" <<<"$listing" || true)"
  [ -z "$bad" ] || fail "source tarball 含应排除的路径:
$bad"
  grep -qxF "$top/book.config.json" <<<"$listing" || fail "source tarball 缺少 $top/book.config.json"
  echo "  tarball: 顶层目录 $top/，已排除 .git dist book .build .verify node_modules .scratch"

  "$py" - "$zipfile" "$@" <<'PY' || fail "skills zip 自检失败"
import sys, zipfile
zf, *expected = sys.argv[1:]
names = zipfile.ZipFile(zf).namelist()
tops = {n.split("/", 1)[0] for n in names}
if "skills" in tops:
    sys.exit("zip 多包了一层 skills/")
if tops != set(expected):
    sys.exit("zip 顶层与 book.config.json 不一致: 多 %s / 少 %s" % (sorted(tops - set(expected)), sorted(set(expected) - tops)))
for e in expected:
    if (e + "/SKILL.md") not in names:
        sys.exit(e + "/SKILL.md 不在 zip 中")
print("  zip: 顶层 %d 个章节目录，均含 SKILL.md，无 skills/ 外层" % len(tops))
PY
}

print_manifest() {
  echo "==> 制品清单（$DIST_DIR/）"
  local f bytes
  for f in "$@"; do
    bytes="$(wc -c < "$f" | tr -d '[:space:]')"
    awk -v n="$(basename "$f")" -v b="$bytes" 'BEGIN { printf "  %-60s %12d bytes  (%.1f KiB)\n", n, b, b / 1024 }'
  done
}

case "${1:-}" in
  verify) shift; cmd_verify "$@" ;;
  build)  shift; cmd_build "$@" ;;
  *) echo "用法: $0 {verify [TAG]|build TAG}" >&2; exit 2 ;;
esac
