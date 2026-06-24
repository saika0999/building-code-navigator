# Git 工作流

## 初始化

```powershell
git init
git branch -m main
git add .
git commit -m "feat: initialize building code navigator"
```

## 分支

- `main`：稳定主线。
- `feat/app-shell`：产品功能。
- `data/shenzhen-industrial`：资料源和索引。
- `docs/governance`：治理、说明、贡献规范。

## 提交粒度

- 代码、数据、文档分开提交。
- 资料源修订应单独提交，便于追溯。
- 涉及风险规则变更时，提交信息应说明规则主题。

## 发布前检查

```powershell
pnpm lint
pnpm build
git status --short
```

## 资料源 PR 检查

- 是否来自官方或可信来源。
- 是否误提交全文文件。
- 是否填写版权/分发状态。
- 是否标记待核验事项。
