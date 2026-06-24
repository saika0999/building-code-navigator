# AGENTS.md

本仓库用于建设一个面向中国建筑设计前期工作的规范查阅与风险预警工具。所有贡献都应优先保证来源清晰、版权边界清楚、结论可追溯。

## 产品定位

- 第一版聚焦深圳市、中山市的工业建筑项目，包含普通厂房、仓库、研发厂房、工业上楼等场景。
- 核心工作流是：项目条件问诊 -> 适用规范与政策索引 -> 方案风险清单 -> 带来源的规范问答。
- 自动识图审图不是第一版目标。第一版只做人工输入条件与资料源索引驱动的辅助判断。

## 技术栈

- 前端：Vite + React + TypeScript。
- 数据：先使用可审查的 TypeScript/JSON 静态数据，后续可迁移到数据库。
- 本地资料：未来放在 `local-library/` 或用户配置目录，不提交到 Git。

## 版权与资料边界

仓库可以提交：

- 规范、政策、标准的元数据。
- 官方来源链接。
- 条文号、主题标签、适用条件、风险摘要。
- 项目团队原创的解释、流程、检查清单。

仓库不应提交：

- 整本规范 PDF、Word、扫描件或 OCR 全文。
- 从第三方规范网站批量爬取的全文。
- 收费数据库、出版物、培训资料、事务所内部资料。
- 由受限全文生成并可还原原文的大型公开索引或向量库。

若某资料只能在线阅读或需登录/付费获取，只能记录元数据和官方入口，不得绕过限制下载。

## 资料源审核流程

新增资料源时，必须填写：

- `title`：文件或标准名称。
- `jurisdiction`：适用地区。
- `authority`：发布机关或管理主体。
- `sourceUrl`：官方网页或可信来源。
- `access`：`downloadable`、`online_reading`、`metadata_only`、`restricted` 之一。
- `redistribution`：`metadata_only`、`local_only`、`allowed`、`unknown` 之一。
- `topics`：主题标签。
- `reviewStatus`：`seed`、`needs_verification`、`verified` 之一。

第一版种子数据允许标记 `needs_verification`，但所有进入正式发布的数据应完成复核。

## Git 管理

- 主分支：`main`。
- 功能分支：`feat/<short-name>`。
- 修复分支：`fix/<short-name>`。
- 资料源分支：`data/<region-or-topic>`。
- 提交信息建议使用 Conventional Commits：
  - `feat: add project intake workspace`
  - `data: add shenzhen industrial sources`
  - `docs: document copyright policy`
  - `fix: correct risk trigger wording`

每个 PR 应说明：

- 改动目的。
- 是否涉及资料源或版权边界。
- 如何验证。
- 仍需人工复核的事项。

## 开发纪律

- 修改数据时，要区分事实、推断、待核验内容。
- UI 中所有规范结论必须能追溯到资料源或明确标记为待核验。
- 不要把“经验做法”写成强制性规范。
- 不确定时优先提示用户确认项目条件，而不是给出武断答案。

## 本地运行

使用 Codex 内置 Node/pnpm 时：

```powershell
$env:Path='C:\Users\ASUS\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;C:\Users\ASUS\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin;' + $env:Path
pnpm install
pnpm dev
```

如果本机已安装 Node.js 和 Git，也可以直接运行 `pnpm install` 与 `pnpm dev`。
