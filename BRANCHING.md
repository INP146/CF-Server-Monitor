# 分支维护规范

本仓库作为独立版本维护。上游改动必须经过审查和测试，不能直接覆盖本仓库的发布历史。

## 分支职责

- `main` 只保存可部署的正式版本，生产部署由该分支触发。
- `dev` 是默认集成分支，功能和修复 PR 均以该分支为目标。
- `feature/*` 和 `fix/*` 是从 `dev` 创建的短期开发分支。
- `release/*` 是可选的发布稳定分支，从 `dev` 创建。
- `hotfix/*` 从 `main` 创建，用于生产环境紧急修复。
- `sync/upstream-main` 由上游同步工作流维护，审查后只能合入 `dev`。

不要合并 `upstream/dev`。本仓库只从 `upstream/main` 吸收上游已经发布的改动。

## 日常开发

1. 从 `dev` 创建功能或修复分支。
2. 完成开发后提交 PR 到 `dev`。
3. 发布准备开始前不要修改版本号。

## 发布流程

1. 在 `dev` 或基于 `dev` 的 `release/*` 分支准备发布。
2. 统一更新 Workers、Agent 的版本号及更新记录。
3. 完成构建和测试。
4. 创建从 `dev` 到 `main` 的 PR 并合并。
5. 在合并后的 `main` 提交上创建带注释的 `vX.Y.Z` 标签。
6. 新一轮开发开始前，立即将 `dev` 快进到 `main`，保证两个分支共享同一个发布节点。

```bash
git switch dev
git fetch origin
git merge --ff-only origin/main
git push origin dev
```

## 热修复

从 `main` 创建 `hotfix/*`，修复后合入 `main`，然后在继续开发前把 `main` 合回
`dev`。如果 `dev` 已有新提交，必须通过正常 PR 回合并，禁止重写任一分支历史。

## 同步上游

`Prepare Upstream Sync` 工作流每周检查一次 `upstream/main`，也支持手动运行。发现新
提交后，工作流会更新 `sync/upstream-main`，并在运行摘要中提供差异比较和 PR 链接。

审查差异后创建合入 `dev` 的 PR，解决冲突并完成测试。上游改动只能通过正常发布流程
进入 `main`。
