# 建筑规范查阅页

面向中国建筑设计前期工作的规范查阅与风险预警工具。第一版聚焦深圳市、中山市工业建筑项目，帮助建筑师在方案早期完成项目条件梳理、适用规范索引、风险清单和带来源的规范问答。

## 第一版能力

- 项目条件问诊：地区、工业建筑类型、火灾危险性类别、仓储、配电房、高层、地下室、任务书完整度。
- 资料源导航：按项目条件筛选全国、广东、深圳、中山的规范和政策来源。
- 风险清单：把未知条件和关键规范专题转化为前期待确认事项。
- 问答原型：对“甲类仓库和配电房间距”“灰空间面积计算”等问题给出带来源的回答框架。
- 开源治理：`AGENTS.md` 明确版权边界、资料源审核、Git 工作流。

## 本地运行

如果本机安装了 Node.js 和 pnpm：

```powershell
pnpm install
pnpm dev
```

如果使用 Codex 桌面内置运行时：

```powershell
$env:Path='C:\Users\ASUS\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;C:\Users\ASUS\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin;' + $env:Path
pnpm install
pnpm dev
```

构建检查：

```powershell
pnpm lint
pnpm build
```

## 版权策略

本仓库提交规范和政策的元数据、官方链接、条文索引、原创摘要和风险清单，不提交规范全文、第三方网站爬取全文、收费数据库资料或事务所内部资料。

未来的“一键同步资料源”会把可公开下载的官方文件下载到用户本地目录，并在本地解析、索引和问答，不把全文打包进 GitHub 仓库。

## 目录

```text
src/
  data/                 第一版种子数据
  types/                领域模型
docs/                   产品说明和 Git 工作流
data/                   资料源 schema
AGENTS.md              协作、版权、资料源审核规则
```

## 路线图

1. 完成深圳/中山工业建筑资料源官方链接复核。
2. 增加本地资料同步器和下载目录管理。
3. 增加条文级索引和引用格式。
4. 接入本地 RAG 问答。
5. 支持项目档案保存和导出风险报告。
