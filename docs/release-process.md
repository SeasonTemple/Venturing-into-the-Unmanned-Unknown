# 发版流程

本流程以 `book.config.json` 为章节与版本的唯一真源。版本号形如 `vX.Y.Z`，下文以 `vX.Y.Z` 代指。

相关文件：`.github/workflows/release.yml`（tag 触发建 Release）、`scripts/build_release_artifacts.sh`（`verify` 校验、`build TAG` 产出 `dist/`）、`.github/workflows/pages.yml`（部署在线站点）。

## 1. 改版本号（两处必须一致）

1. `book.config.json` 的 `"version"` 改为 `vX.Y.Z`。
2. `README.md` 的「版本」段改为 `- 版本：**vX.Y.Z**`（保持这个写法，CI 按它匹配）。

`validate-skills.yml` 里的「版本一致性」检查会在两处不一致时失败，所以漏改一处，PR 就会变红。

## 2. 写发布说明

1. 复制 `docs/release-notes/TEMPLATE.md` 为 `docs/release-notes/vX.Y.Z.md`。
2. 只填四块：标题行、变更章节、制品、已知问题与未验证项。章节名照抄 `book.config.json`。
3. 制品文件名里的版本号替换为 `vX.Y.Z`。

Release 正文取自这个文件；文件不存在时，workflow 退回 GitHub 自动生成的 notes。

## 3. 发版前本地校验，打 tag 并推送

先把版本号和发布说明合并到 `main`，再对该提交打 tag：

```bash
bash scripts/build_release_artifacts.sh verify vX.Y.Z

git tag vX.Y.Z
git push origin vX.Y.Z
```

想先演练、不真的发布：在 Actions 页面手动运行 Release workflow，勾选 `dry_run`；或

```bash
gh workflow run release.yml -f tag=main -f dry_run=true
```

注意：Release workflow 检出的是 tag 所指的提交。如果某个旧 tag 所指提交里没有 `scripts/build_release_artifacts.sh` 或发布说明，用它补发会失败，这时应改发新版本，而不是移动旧 tag。

## 4. 等待 workflow 创建 Release

tag 推送后，Release workflow 依次跑 verify、build，然后创建 GitHub Release，挂三个制品：

- `ai-native-sdlc-guidebook-vX.Y.Z-source.tar.gz`
- `ai-native-sdlc-skills-vX.Y.Z.zip`
- `BOOK.md`

同一 tag 的 Release 已存在时，workflow 会跳过创建，不会覆盖。

核对：

```bash
gh run list --workflow release.yml --limit 3
gh release view vX.Y.Z --json tagName,assets --jq '{tag: .tagName, assets: [.assets[].name]}'
```

assets 必须恰好是上面三个文件。

## 5. 设置仓库 About

需要 PowerShell 7.3+ 和已登录的 `gh`（`gh auth status`）。

```powershell
pwsh -File scripts/set-about.ps1
```

脚本设置 Description、Homepage（在线阅读站地址）和 Topics，末尾回读并核对，不一致会以非零退出。该脚本可重复执行，Topics 只增不减。

## 6. 首次启用 GitHub Pages（人工动作）

`pages.yml` 已在仓库里，但 Pages 本身需要仓库 owner 在网页上开一次，workflow 代劳不了：

1. 打开仓库 Settings → Pages → Build and deployment → Source，选 **GitHub Actions**。
2. 到 Actions → Pages → Run workflow，手动触发第一次部署。之后只有改动 `skills/**` 或 `book.config.json` 的 push 才会自动触发。
3. 在 Actions 页面确认部署成功，再打开 `https://seasontemple.github.io/Venturing-into-the-Unmanned-Unknown/`。
4. 外链检查已覆盖站点链接：`link-check.yml` 里曾为站点临时加的 `--exclude` 已在站点上线后删除，无需再操作。
5. 仓库 About 的 Homepage 由 `scripts/set-about.ps1` 一并设置（见第 5 步），不需要人工填写。

没做第 1 步时，`pages.yml` 的 deploy job 会失败。

## 7. 回滚：撤销发错的 Release 和 tag

先确认要删的版本：

```bash
gh release list
git ls-remote --tags origin "vX.Y.Z"
```

删除 Release 并同时删除远端 tag：

```bash
gh release delete vX.Y.Z --cleanup-tag --yes
```

删除本地 tag：

```bash
git tag -d vX.Y.Z
```

如果 Release 已经不存在、只剩远端 tag：

```bash
git push origin --delete vX.Y.Z
```

核对已清干净（两条都应无输出）：

```bash
gh release list | grep "vX.Y.Z"
git ls-remote --tags origin "vX.Y.Z"
```

删除后改好内容，从步骤 1 重新走一遍。如果发错的版本已被别人下载或引用过，不要重打同名 tag，改发 `vX.Y.(Z+1)`。
