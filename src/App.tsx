import {
  AlertTriangle,
  BookOpen,
  Building2,
  CheckCircle2,
  ClipboardList,
  Database,
  Download,
  HelpCircle,
  Library,
  MapPinned,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { zhongshanIndustrialUpstairsCase } from './data/projectCases'
import { sourceReferences } from './data/references'
import { sources } from './data/sources'
import { answerProjectQuestion } from './lib/qaEngine'
import { getFindingsForProject, getSourceIdsForProject, getUnknownsForProject } from './lib/ruleEngine'
import type {
  BuildingAsset,
  BuildingUse,
  FireHazard,
  GeneratedFinding,
  ProjectCase,
  ProjectType,
  RegionId,
  SourceManifest,
} from './types/domain'

const emptyProject: ProjectCase = {
  id: 'draft-project',
  name: '未命名工业项目',
  region: 'zhongshan',
  projectType: 'industrial-upstairs',
  stage: 'pre_design',
  description: '从项目条件和楼栋组成开始，加载规范索引后生成查阅路径、风险提示和带来源回答。',
  assumptions: ['项目条件由用户手动录入。未加载规范索引前，系统不输出规范结论。'],
  siteConditions: {
    hasIndependentWarehouse: false,
    warehouseFireHazard: 'unknown',
    hasSubstation: false,
    hasGraySpace: false,
    exhibitionOpenToPublic: false,
    industrialUpstairsPolicyKnown: false,
  },
  buildings: [],
}

const regionLabels: Record<RegionId, string> = {
  shenzhen: '深圳市',
  zhongshan: '中山市',
}

const projectTypeLabels: Record<ProjectType, string> = {
  factory: '普通厂房',
  warehouse: '仓库',
  'rd-factory': '研发厂房',
  'industrial-upstairs': '工业上楼',
  'mixed-industrial': '混合工业项目',
}

const fireHazardLabels: Record<FireHazard, string> = {
  unknown: '待确认',
  class_a: '甲类',
  class_b: '乙类',
  class_c: '丙类',
  class_d: '丁类',
  class_e: '戊类',
  civil: '民用/公共功能',
}

const useLabels: Record<BuildingUse, string> = {
  factory: '厂房',
  warehouse: '仓库',
  'headquarters-office': '总部办公',
  dormitory: '宿舍',
  cafeteria: '食堂',
  exhibition: '展厅',
  substation: '配电房',
  basement: '地下室',
  parking: '停车',
}

const buildingTemplates: Array<{
  label: string
  uses: BuildingUse[]
  fireHazard: FireHazard
  flags: Partial<BuildingAsset>
  unknowns: string[]
}> = [
  {
    label: '厂房',
    uses: ['factory'],
    fireHazard: 'unknown',
    flags: { hasProduction: true, hasStorage: true },
    unknowns: ['生产工艺', '火灾危险性类别', '防火分区面积', '层高和楼面荷载', '货运组织'],
  },
  {
    label: '总部大楼',
    uses: ['headquarters-office'],
    fireHazard: 'civil',
    flags: { hasPublicAccess: true },
    unknowns: ['办公人数', '是否对外服务', '是否计入产业配套比例', '停车配建口径'],
  },
  {
    label: '宿舍（底层食堂）',
    uses: ['dormitory', 'cafeteria'],
    fireHazard: 'civil',
    flags: { hasSleeping: true, hasCooking: true, hasPublicAccess: true },
    unknowns: ['住宿人数', '食堂厨房燃料类型', '厨房排油烟路径', '宿舍与食堂防火分隔'],
  },
  {
    label: '展厅',
    uses: ['exhibition'],
    fireHazard: 'civil',
    flags: { hasPublicAccess: true },
    unknowns: ['是否对外开放', '最大同时参观人数', '是否布置可燃展品或临展装修'],
  },
  {
    label: '仓库',
    uses: ['warehouse'],
    fireHazard: 'unknown',
    flags: { hasStorage: true },
    unknowns: ['储存物品类别', '最大储量', '是否为独立仓库或中间仓库', '装卸组织'],
  },
  {
    label: '配电房/变配电',
    uses: ['substation'],
    fireHazard: 'civil',
    flags: { hasPowerEquipment: true },
    unknowns: ['电压等级', '是否独立建筑', '服务对象', '与仓储/厂房关系'],
  },
]

const severityLabels: Record<GeneratedFinding['severity'], string> = {
  high: '高风险',
  medium: '中风险',
  low: '低风险',
}

const categoryLabels: Record<GeneratedFinding['category'], string> = {
  fire: '消防',
  planning: '规划/产业',
  area: '面积/指标',
  operation: '运营/物流',
  documents: '资料',
}

function sourceTitle(id: string) {
  return sources.find((source) => source.id === id)?.title ?? id
}

function referencesFor(ids: string[] = [], loadedSourceIds: string[]) {
  return ids
    .map((id) => sourceReferences.find((reference) => reference.id === id))
    .filter((reference): reference is NonNullable<typeof reference> => Boolean(reference))
    .filter((reference) => loadedSourceIds.includes(reference.sourceId))
}

type LocalSourceState = {
  indexLoaded: boolean
  documentReady: boolean
  localPath?: string
  downloadedAt?: string
  bytes?: number
  localFileKind?: 'official_attachment' | 'page_snapshot'
  indexPath?: string
  indexChars?: number
  indexedAt?: string | null
  searchable?: boolean
}

type LocalSourceStatus = Record<string, LocalSourceState>

const sourceStatusStorageKey = 'building-code-navigator-source-status-v1'

function defaultSourceState(): LocalSourceState {
  return { indexLoaded: false, documentReady: false }
}

function readStoredSourceStatus(): LocalSourceStatus {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const stored = window.localStorage.getItem(sourceStatusStorageKey)
    return stored ? (JSON.parse(stored) as LocalSourceStatus) : {}
  } catch {
    return {}
  }
}

function saveSourceStatus(status: LocalSourceStatus) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(sourceStatusStorageKey, JSON.stringify(status))
  }
}

function sourceState(status: LocalSourceStatus, sourceId: string): LocalSourceState {
  return { ...defaultSourceState(), ...status[sourceId] }
}

function sourceLibraryPath(source: SourceManifest) {
  const region = source.jurisdiction.replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
  const fileName = (source.code ?? source.id).replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
  return `local-library/documents/${region}/${fileName}.pdf`
}

type SourceDownloadResult = {
  sourceId: string
  relativePath: string
  bytes: number
  savedAt: string
  kind: 'official_attachment' | 'page_snapshot'
}

type SourceFileStatus = {
  sourceId: string
  exists: boolean
  relativePath: string
  bytes: number
  updatedAt: string | null
  extension: string | null
  kind: 'official_attachment' | 'page_snapshot' | null
  indexExists: boolean
  indexPath: string
  indexUpdatedAt: string | null
  indexChars: number
  searchable: boolean
}

type SourceSearchResult = {
  sourceId: string
  title: string
  relativePath: string
  kind: 'text_index' | 'page_snapshot'
  snippet: string
}

type SourceIndexResult = {
  sourceId: string
  indexPath: string
  indexChars: number
  pageCount: number | null
  searchable: boolean
  message: string
  error?: string
}

function App() {
  const [project, setProject] = useState<ProjectCase>(() => structuredClone(emptyProject))
  const [buildingType, setBuildingType] = useState(buildingTemplates[0].label)
  const [buildingName, setBuildingName] = useState('')
  const [buildingFloors, setBuildingFloors] = useState('8')
  const [query, setQuery] = useState('这个项目有哪些前期风险？')
  const [selectedQuestion, setSelectedQuestion] = useState(query)
  const [sourceStatus, setSourceStatus] = useState<LocalSourceStatus>(() => readStoredSourceStatus())
  const [downloadMessages, setDownloadMessages] = useState<Record<string, string>>({})
  const [downloadingSourceId, setDownloadingSourceId] = useState<string | null>(null)
  const [indexingSourceId, setIndexingSourceId] = useState<string | null>(null)
  const [indexMessages, setIndexMessages] = useState<Record<string, string>>({})
  const [libraryStatuses, setLibraryStatuses] = useState<Record<string, SourceFileStatus>>({})
  const [libraryMessage, setLibraryMessage] = useState('尚未扫描本地资料库')
  const [batchAcquiring, setBatchAcquiring] = useState(false)
  const [libraryQuery, setLibraryQuery] = useState('防火间距')
  const [libraryResults, setLibraryResults] = useState<SourceSearchResult[]>([])
  const [librarySearchMessage, setLibrarySearchMessage] = useState('')

  const findings = useMemo(() => getFindingsForProject(project), [project])
  const unknowns = useMemo(() => getUnknownsForProject(project), [project])
  const recommendedSourceIds = useMemo(() => getSourceIdsForProject(project), [project])
  const recommendedSources = sources.filter((source) => recommendedSourceIds.includes(source.id))
  const loadedSourceIds = useMemo(
    () => sources.filter((source) => sourceState(sourceStatus, source.id).indexLoaded).map((source) => source.id),
    [sourceStatus],
  )
  const loadedSources = sources.filter((source) => loadedSourceIds.includes(source.id))
  const documentReadyCount = sources.filter((source) => sourceState(sourceStatus, source.id).documentReady || libraryStatuses[source.id]?.exists).length
  const recommendedReadyCount = recommendedSources.filter((source) => sourceState(sourceStatus, source.id).documentReady || libraryStatuses[source.id]?.exists).length
  const searchableCount = sources.filter((source) => sourceState(sourceStatus, source.id).searchable || libraryStatuses[source.id]?.searchable).length
  const answer = useMemo(
    () => answerProjectQuestion(project, selectedQuestion, loadedSourceIds),
    [loadedSourceIds, project, selectedQuestion],
  )

  const highRiskCount = findings.filter((finding) => finding.severity === 'high').length
  const unknownFactoryCount = project.buildings.filter(
    (building) => building.uses.includes('factory') && building.fireHazard === 'unknown',
  ).length

  useEffect(() => {
    void scanLocalLibrary()
    // 本地资料库只需要在页面首次打开时扫描一次，后续由下载/扫描按钮主动刷新。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function loadRecommendedPackage() {
    setSourceStatus((current) => {
      const next = { ...current }
      recommendedSourceIds.forEach((sourceId) => {
        next[sourceId] = { ...defaultSourceState(), ...next[sourceId], indexLoaded: true }
      })
      saveSourceStatus(next)
      return next
    })
  }

  function loadSource(sourceId: string) {
    updateSourceState(sourceId, { indexLoaded: true })
  }

  function unloadSource(sourceId: string) {
    updateSourceState(sourceId, { indexLoaded: false })
  }

  function markDocumentReady(sourceId: string) {
    updateSourceState(sourceId, { indexLoaded: true, documentReady: true })
  }

  function unmarkDocumentReady(sourceId: string) {
    updateSourceState(sourceId, { documentReady: false })
  }

  function updateSourceState(sourceId: string, patch: Partial<LocalSourceState>) {
    setSourceStatus((current) => {
      const next = {
        ...current,
        [sourceId]: { ...defaultSourceState(), ...current[sourceId], ...patch },
      }
      saveSourceStatus(next)
      return next
    })
  }

  function syncSourceStatusFromLibrary(statuses: Record<string, SourceFileStatus>) {
    setSourceStatus((current) => {
      const next = { ...current }

      Object.values(statuses).forEach((status) => {
        if (!status.exists) {
          return
        }

        next[status.sourceId] = {
          ...defaultSourceState(),
          ...next[status.sourceId],
          indexLoaded: true,
          documentReady: true,
          localPath: status.relativePath,
          downloadedAt: status.updatedAt ?? next[status.sourceId]?.downloadedAt,
          bytes: status.bytes,
          localFileKind: status.kind ?? next[status.sourceId]?.localFileKind,
          indexPath: status.indexPath,
          indexChars: status.indexChars,
          indexedAt: status.indexUpdatedAt,
          searchable: status.searchable,
        }
      })

      saveSourceStatus(next)
      return next
    })
  }

  async function scanLocalLibrary() {
    try {
      const response = await fetch('/api/source-library/status')
      const result = await response.json() as { sources?: SourceFileStatus[]; error?: string }

      if (!response.ok) {
        throw new Error(result.error ?? '扫描失败')
      }

      const statusMap = Object.fromEntries((result.sources ?? []).map((status) => [status.sourceId, status]))
      const readyCount = Object.values(statusMap).filter((status) => status.exists).length
      setLibraryStatuses(statusMap)
      syncSourceStatusFromLibrary(statusMap)
      setLibraryMessage(`已扫描本地资料库，发现 ${readyCount} 份本地文件。`)
    } catch (error) {
      setLibraryMessage(error instanceof Error ? `扫描失败：${error.message}` : '扫描失败：未知错误。')
    }
  }

  async function downloadSourceToLibrary(source: SourceManifest) {
    setDownloadingSourceId(source.id)
    setDownloadMessages((current) => ({ ...current, [source.id]: '正在从官方来源获取到本地资料库...' }))

    try {
      const response = await fetch('/api/source-library/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: source.id }),
      })
      const result = await response.json() as Partial<SourceDownloadResult> & { error?: string }

      if (!response.ok) {
        throw new Error(result.error ?? '本地下载失败')
      }

      updateSourceState(source.id, {
        indexLoaded: true,
        documentReady: true,
        localPath: result.relativePath,
        downloadedAt: result.savedAt,
        bytes: result.bytes,
        localFileKind: result.kind,
      })
      setLibraryStatuses((current) => ({
        ...current,
        [source.id]: {
          sourceId: source.id,
          exists: true,
          relativePath: result.relativePath ?? sourceLibraryPath(source),
          bytes: result.bytes ?? 0,
          updatedAt: result.savedAt ?? null,
          extension: result.relativePath?.split('.').pop() ?? null,
          kind: result.kind ?? null,
          indexExists: false,
          indexPath: '',
          indexUpdatedAt: null,
          indexChars: 0,
          searchable: false,
        },
      }))
      setDownloadMessages((current) => ({
        ...current,
        [source.id]: `${result.kind === 'page_snapshot' ? '已保存官方页面正文快照' : '已下载官方附件'}：${result.relativePath}，大小 ${Math.round((result.bytes ?? 0) / 1024)} KB。`,
      }))
    } catch (error) {
      setDownloadMessages((current) => ({
        ...current,
        [source.id]: error instanceof Error
          ? `下载失败：${error.message}。请确认正在用 pnpm dev 运行本地服务，并且官方链接可访问。`
          : '下载失败：未知错误。',
      }))
    } finally {
      setDownloadingSourceId(null)
    }
  }

  async function indexSource(source: SourceManifest) {
    setIndexingSourceId(source.id)
    setIndexMessages((current) => ({ ...current, [source.id]: '正在建立文本索引...' }))

    try {
      const response = await fetch('/api/source-library/index-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: source.id }),
      })
      const result = await response.json() as SourceIndexResult

      if (!response.ok) {
        throw new Error(result.error ?? '建立索引失败')
      }

      updateSourceState(source.id, {
        indexPath: result.indexPath,
        indexChars: result.indexChars,
        indexedAt: new Date().toISOString(),
        searchable: result.searchable,
      })
      setLibraryStatuses((current) => ({
        ...current,
        [source.id]: {
          ...(current[source.id] ?? {
            sourceId: source.id,
            exists: false,
            relativePath: sourceLibraryPath(source),
            bytes: 0,
            updatedAt: null,
            extension: null,
            kind: null,
          }),
          indexExists: true,
          indexPath: result.indexPath,
          indexUpdatedAt: new Date().toISOString(),
          indexChars: result.indexChars,
          searchable: result.searchable,
        },
      }))
      setIndexMessages((current) => ({
        ...current,
        [source.id]: `${result.message} 有效文本 ${result.indexChars} 字${result.pageCount ? `，PDF ${result.pageCount} 页` : ''}。`,
      }))
    } catch (error) {
      setIndexMessages((current) => ({
        ...current,
        [source.id]: error instanceof Error ? `索引失败：${error.message}` : '索引失败：未知错误。',
      }))
    } finally {
      setIndexingSourceId(null)
    }
  }

  async function acquireRecommendedSources() {
    setBatchAcquiring(true)
    setLibraryMessage(`开始获取 ${recommendedSources.length} 份推荐资料...`)

    for (const source of recommendedSources) {
      await downloadSourceToLibrary(source)
    }

    await scanLocalLibrary()
    setBatchAcquiring(false)
  }

  async function searchLocalLibrary() {
    const query = libraryQuery.trim()

    if (query.length < 2) {
      setLibraryResults([])
      setLibrarySearchMessage('请输入至少两个字符。')
      return
    }

    try {
      const sourceIds = loadedSourceIds.join(',')
      const response = await fetch(`/api/source-library/search?q=${encodeURIComponent(query)}&sourceIds=${encodeURIComponent(sourceIds)}`)
      const result = await response.json() as { results?: SourceSearchResult[]; message?: string; error?: string; searchableFiles?: number }

      if (!response.ok) {
        throw new Error(result.error ?? '搜索失败')
      }

      setLibraryResults(result.results ?? [])
      setLibrarySearchMessage(result.message ?? `在 ${result.searchableFiles ?? 0} 个可搜索文本中找到 ${result.results?.length ?? 0} 条结果。`)
    } catch (error) {
      setLibraryResults([])
      setLibrarySearchMessage(error instanceof Error ? `搜索失败：${error.message}` : '搜索失败：未知错误。')
    }
  }

  function localFileUrl(relativePath: string) {
    return `/api/source-library/file?path=${encodeURIComponent(relativePath)}`
  }

  function addBuilding() {
    const template = buildingTemplates.find((item) => item.label === buildingType) ?? buildingTemplates[0]
    const nextIndex = project.buildings.length + 1
    const name = buildingName.trim() || `${nextIndex}#${template.label}`
    const floors = Number.parseInt(buildingFloors, 10)

    const building: BuildingAsset = {
      id: `${Date.now()}-${nextIndex}`,
      name,
      uses: template.uses,
      floors: Number.isFinite(floors) ? floors : undefined,
      fireHazard: template.fireHazard,
      knownUnknowns: template.unknowns,
      ...template.flags,
    }

    setProject((current) => ({
      ...current,
      buildings: current.buildings.concat(building),
      siteConditions: {
        ...current.siteConditions,
        hasSubstation: current.siteConditions.hasSubstation || template.uses.includes('substation'),
        hasIndependentWarehouse: current.siteConditions.hasIndependentWarehouse || template.uses.includes('warehouse'),
        exhibitionOpenToPublic: current.siteConditions.exhibitionOpenToPublic || template.uses.includes('exhibition'),
      },
    }))
    setBuildingName('')
  }

  function removeBuilding(buildingId: string) {
    setProject((current) => ({
      ...current,
      buildings: current.buildings.filter((building) => building.id !== buildingId),
    }))
  }

  function updateSiteCondition<Key extends keyof ProjectCase['siteConditions']>(
    key: Key,
    value: ProjectCase['siteConditions'][Key],
  ) {
    setProject((current) => ({
      ...current,
      siteConditions: {
        ...current.siteConditions,
        [key]: value,
      },
    }))
  }

  function updateBuildingFireHazard(buildingId: string, fireHazard: FireHazard) {
    setProject((current) => ({
      ...current,
      buildings: current.buildings.map((building) =>
        building.id === buildingId ? { ...building, fireHazard } : building,
      ),
    }))
  }

  function loadZhongshanTemplate() {
    setProject(structuredClone(zhongshanIndustrialUpstairsCase))
    setSourceStatus({})
    saveSourceStatus({})
    setQuery('这个项目有哪些前期风险？')
    setSelectedQuestion('这个项目有哪些前期风险？')
  }

  const quickQuestions = [
    '这个项目有哪些前期风险？',
    '四栋厂房的火灾危险性没有确定会影响什么？',
    '宿舍楼底层食堂要重点查什么？',
    '展厅在工业项目里有什么风险？',
    '中山项目建筑灰空间面积怎么计算？',
    '甲类仓库和配电房之间间距多少？',
  ]

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Building2 aria-hidden="true" />
          <div>
            <span>建筑规范查阅页</span>
            <strong>通用项目工作台</strong>
          </div>
        </div>

        <nav className="nav-list" aria-label="工作区">
          <a href="#project"><ClipboardList aria-hidden="true" />项目录入</a>
          <a href="#library"><Library aria-hidden="true" />规范包</a>
          <a href="#risks"><AlertTriangle aria-hidden="true" />风险提示</a>
          <a href="#qa"><Search aria-hidden="true" />规范问答</a>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Generic Building Code Navigator</p>
            <h1>先录入项目，再加载规范索引，最后生成风险和回答</h1>
            <p className="lead">
              这个页面不是为某个固定项目写死的。你可以手动添加厂房、总部、宿舍食堂、展厅、仓库、配电房等单体；系统会根据录入内容推荐资料源，加载索引后再给出带来源的提示。
            </p>
          </div>
          <div className="status-stack">
            <span><Building2 aria-hidden="true" />{project.buildings.length} 栋/组建筑</span>
            <span><Database aria-hidden="true" />{loadedSourceIds.length} 份索引已加载</span>
            <span><AlertTriangle aria-hidden="true" />{highRiskCount} 个高风险</span>
          </div>
        </header>

        <section className="summary-band">
          <div>
            <span>当前地区</span>
            <strong>{regionLabels[project.region]}</strong>
          </div>
          <div>
            <span>项目类型</span>
            <strong>{projectTypeLabels[project.projectType]}</strong>
          </div>
          <div>
            <span>厂房类别</span>
            <strong>{unknownFactoryCount} 栋待确认</strong>
          </div>
        </section>

        <section id="project" className="panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">Project Intake</p>
              <h2>项目与单体手动录入</h2>
            </div>
            <button type="button" className="ghost-button" onClick={loadZhongshanTemplate}>
              载入中山样例
            </button>
          </div>

          <div className="form-grid">
            <label>
              <span>项目名称</span>
              <input value={project.name} onChange={(event) => setProject((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              <span>城市</span>
              <select value={project.region} onChange={(event) => setProject((current) => ({ ...current, region: event.target.value as RegionId }))}>
                <option value="zhongshan">中山市</option>
                <option value="shenzhen">深圳市</option>
              </select>
            </label>
            <label>
              <span>项目类型</span>
              <select value={project.projectType} onChange={(event) => setProject((current) => ({ ...current, projectType: event.target.value as ProjectType }))}>
                {Object.entries(projectTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="condition-grid">
            <label className="check-toggle">
              <input type="checkbox" checked={project.siteConditions.hasIndependentWarehouse} onChange={(event) => updateSiteCondition('hasIndependentWarehouse', event.target.checked)} />
              <span>存在独立仓库/中间仓库</span>
            </label>
            <label>
              <span>仓储火灾危险性</span>
              <select value={project.siteConditions.warehouseFireHazard} onChange={(event) => updateSiteCondition('warehouseFireHazard', event.target.value as FireHazard)}>
                <option value="unknown">待确认</option>
                <option value="class_a">甲类</option>
                <option value="class_b">乙类</option>
                <option value="class_c">丙类</option>
                <option value="class_d">丁类</option>
                <option value="class_e">戊类</option>
              </select>
            </label>
            <label className="check-toggle">
              <input type="checkbox" checked={project.siteConditions.hasSubstation} onChange={(event) => updateSiteCondition('hasSubstation', event.target.checked)} />
              <span>有配电房/变配电设施</span>
            </label>
            <label className="check-toggle">
              <input type="checkbox" checked={project.siteConditions.hasGraySpace} onChange={(event) => updateSiteCondition('hasGraySpace', event.target.checked)} />
              <span>涉及灰空间/架空/连廊</span>
            </label>
            <label className="check-toggle">
              <input type="checkbox" checked={project.siteConditions.exhibitionOpenToPublic} onChange={(event) => updateSiteCondition('exhibitionOpenToPublic', event.target.checked)} />
              <span>展厅可能对外开放</span>
            </label>
          </div>

          <div className="add-building-row">
            <label>
              <span>单体类型</span>
              <select value={buildingType} onChange={(event) => setBuildingType(event.target.value)}>
                {buildingTemplates.map((template) => (
                  <option key={template.label} value={template.label}>{template.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>单体名称</span>
              <input value={buildingName} placeholder="例如 1#厂房" onChange={(event) => setBuildingName(event.target.value)} />
            </label>
            <label>
              <span>层数</span>
              <input value={buildingFloors} onChange={(event) => setBuildingFloors(event.target.value)} />
            </label>
            <button type="button" onClick={addBuilding}>
              <Plus aria-hidden="true" />添加单体
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">Building Register</p>
              <h2>已录入的楼栋</h2>
            </div>
            <Building2 aria-hidden="true" />
          </div>

          {project.buildings.length === 0 ? (
            <div className="empty-state">
              <strong>还没有录入楼栋</strong>
              <p>先添加厂房、总部、宿舍食堂、展厅等单体。未录入单体前，系统不会假设项目组成。</p>
            </div>
          ) : (
            <div className="building-grid">
              {project.buildings.map((building) => (
                <article key={building.id} className="building-card">
                  <div className="card-head">
                    <Building2 aria-hidden="true" />
                    <span>{building.floors ? `${building.floors} 层` : '层数待确认'}</span>
                  </div>
                  <div className="card-title-row">
                    <h3>{building.name}</h3>
                    <button type="button" title="删除单体" onClick={() => removeBuilding(building.id)}>
                      <Trash2 aria-hidden="true" />
                    </button>
                  </div>
                  <div className="tag-row">
                    {building.uses.map((use) => <span key={use}>{useLabels[use]}</span>)}
                  </div>
                  <p>火灾危险性：<strong>{fireHazardLabels[building.fireHazard]}</strong></p>
                  {building.uses.includes('factory') || building.uses.includes('warehouse') ? (
                    <label>
                      <span>火灾危险性</span>
                      <select value={building.fireHazard} onChange={(event) => updateBuildingFireHazard(building.id, event.target.value as FireHazard)}>
                        <option value="unknown">待确认</option>
                        <option value="class_a">甲类</option>
                        <option value="class_b">乙类</option>
                        <option value="class_c">丙类</option>
                        <option value="class_d">丁类</option>
                        <option value="class_e">戊类</option>
                      </select>
                    </label>
                  ) : null}
                  <ul>
                    {building.knownUnknowns.slice(0, 4).map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </article>
              ))}
            </div>
          )}
        </section>

        <section id="library" className="panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">Code Package</p>
              <h2>规范索引与本地资料库</h2>
            </div>
            <button type="button" className="primary-button" onClick={loadRecommendedPackage}>
              <Download aria-hidden="true" />加载推荐索引包
            </button>
          </div>

          <div className="library-status">
            <div>
              <strong>{loadedSourceIds.length > 0 ? '规范索引已加载' : '尚未加载规范索引'}</strong>
              <p>索引用于生成风险、查阅路径和带来源回答；PDF 全文是否已在本地资料库中，会在每张规范卡片上单独显示。</p>
            </div>
            <div>
              <span>推荐资料源</span>
              <strong>{recommendedSources.length} 份</strong>
            </div>
            <div>
              <span>本地全文就绪</span>
              <strong>{documentReadyCount} 份</strong>
            </div>
            <div>
              <span>推荐就绪率</span>
              <strong>{recommendedReadyCount}/{recommendedSources.length}</strong>
            </div>
            <div>
              <span>可搜索索引</span>
              <strong>{searchableCount} 份</strong>
            </div>
          </div>

          <div className="library-note">
            <strong>下载位置与调用方式</strong>
            <p>
              本机通过 <code>pnpm dev</code> 运行时，“获取到资料库”会优先下载官方附件；如果官方页没有附件，就保存官方页面正文快照。
              文件会进入 <code>local-library/documents/城市或层级/规范编号.pdf</code> 或 <code>.txt</code>。PDF 下载后可尝试建立文本索引；若有效文本很少，说明该文件需要 OCR 或人工打开查阅。
            </p>
          </div>

          <div className="library-toolbar">
            <button type="button" onClick={() => void acquireRecommendedSources()} disabled={batchAcquiring}>
              {batchAcquiring ? '获取中...' : '获取全部推荐资料'}
            </button>
            <button type="button" onClick={() => void scanLocalLibrary()}>
              重新扫描资料库
            </button>
            <span>{libraryMessage}</span>
          </div>

          <div className="source-grid">
            {recommendedSources.map((source) => {
              const state = sourceState(sourceStatus, source.id)
              const localStatus = libraryStatuses[source.id]
              const loaded = state.indexLoaded
              const documentReady = state.documentReady || Boolean(localStatus?.exists)
              const localPath = localStatus?.relativePath ?? state.localPath ?? sourceLibraryPath(source)
              const searchable = state.searchable || Boolean(localStatus?.searchable)
              const indexAttempted = Boolean(state.indexPath || localStatus?.indexExists)
              return (
                <article key={source.id} className={`source-card ${loaded ? 'loaded' : 'not-loaded'} ${documentReady ? 'document-ready' : ''}`}>
                  <div className="card-head">
                    <MapPinned aria-hidden="true" />
                    <span>{source.jurisdiction}</span>
                  </div>
                  <h3>{source.title}</h3>
                  <p>{source.notes}</p>
                  <div className="tag-row">
                    <span className={loaded ? 'status-pill index-loaded' : 'status-pill missing'}>{loaded ? '索引已加载' : '索引未加载'}</span>
                    <span className={documentReady ? 'status-pill document-ready' : 'status-pill missing'}>{documentReady ? '全文已就绪' : '全文未下载'}</span>
                    <span className={searchable ? 'status-pill searchable' : indexAttempted ? 'status-pill needs-ocr' : 'status-pill missing'}>
                      {searchable ? '可搜索' : indexAttempted ? '需 OCR' : '未建索引'}
                    </span>
                    <span>{source.access}</span>
                    <span>{source.redistribution}</span>
                  </div>
                  <div className="library-path">
                    <span>本地调用路径</span>
                    <code>{localPath}</code>
                  </div>
                  <div className="source-actions">
                    <button type="button" onClick={() => (loaded ? unloadSource(source.id) : loadSource(source.id))}>
                      {loaded ? '卸载索引' : '加载索引'}
                    </button>
                    <button
                      type="button"
                      disabled={downloadingSourceId === source.id}
                      onClick={() => void downloadSourceToLibrary(source)}
                    >
                      {downloadingSourceId === source.id ? '获取中...' : '获取到资料库'}
                    </button>
                    <a href={source.downloadUrl ?? source.sourceUrl} target="_blank" rel="noreferrer">
                      {source.downloadUrl ? '下载/打开官方文件' : '打开官方来源'}
                    </a>
                    {documentReady ? (
                      <a href={localFileUrl(localPath)} target="_blank" rel="noreferrer">
                        打开本地文件
                      </a>
                    ) : null}
                    {documentReady ? (
                      <button type="button" disabled={indexingSourceId === source.id} onClick={() => void indexSource(source)}>
                        {indexingSourceId === source.id ? '索引中...' : '建立文本索引'}
                      </button>
                    ) : null}
                    {localStatus?.indexExists || state.indexPath ? (
                      <a href={localFileUrl(localStatus?.indexPath ?? state.indexPath ?? '')} target="_blank" rel="noreferrer">
                        打开索引
                      </a>
                    ) : null}
                    <button type="button" onClick={() => (documentReady ? unmarkDocumentReady(source.id) : markDocumentReady(source.id))}>
                      {documentReady ? '取消全文标记' : '标记本地已有'}
                    </button>
                  </div>
                  {localStatus?.exists ? (
                    <p className="download-message">本地文件：{Math.round(localStatus.bytes / 1024)} KB，{localStatus.extension?.toUpperCase()}，更新时间 {localStatus.updatedAt ? new Date(localStatus.updatedAt).toLocaleString() : '未知'}。</p>
                  ) : null}
                  {downloadMessages[source.id] ? <p className="download-message">{downloadMessages[source.id]}</p> : null}
                  {indexMessages[source.id] ? <p className="download-message">{indexMessages[source.id]}</p> : null}
                </article>
              )
            })}
          </div>

          <div className="local-search">
              <div>
                <strong>本地资料快照搜索</strong>
                <p>可搜索已建立的 PDF 文本索引和官方页面正文快照。若 PDF 抽取有效文本很少，页面会提示需要 OCR 或人工打开查阅。</p>
            </div>
            <div className="query-box">
              <input value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} />
              <button type="button" onClick={() => void searchLocalLibrary()}>搜索</button>
            </div>
            {librarySearchMessage ? <p className="hint-text">{librarySearchMessage}</p> : null}
            {libraryResults.length > 0 ? (
              <div className="search-results">
                {libraryResults.map((result) => (
                    <article key={`${result.sourceId}-${result.relativePath}`}>
                      <strong>{result.title}</strong>
                      <span>{result.kind === 'text_index' ? 'PDF 文本索引' : '官方页面快照'}</span>
                      <p>{result.snippet}</p>
                      <a href={localFileUrl(result.relativePath)} target="_blank" rel="noreferrer">打开索引文件</a>
                    </article>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section id="risks" className="panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">Risk Register</p>
              <h2>根据录入内容生成的提示</h2>
            </div>
            <AlertTriangle aria-hidden="true" />
          </div>

          {project.buildings.length === 0 ? (
            <div className="empty-state">
              <strong>请先录入楼栋</strong>
              <p>风险清单会根据楼栋功能、火灾危险性和已加载规范索引生成。</p>
            </div>
          ) : (
            <div className="risk-list">
              {findings.map((finding) => {
                const refs = referencesFor(finding.referenceIds, loadedSourceIds)
                return (
                  <article key={finding.id} className={`risk-item ${finding.severity}`}>
                    <div>
                      <span>{severityLabels[finding.severity]} · {categoryLabels[finding.category]}</span>
                      <h3>{finding.title}</h3>
                      <p>{finding.why}</p>
                      <div className="tag-row">
                        {finding.appliesTo.map((item) => <span key={item}>{item}</span>)}
                      </div>
                    </div>
                    <div>
                      <strong>下一步核对</strong>
                      <ul>
                        {finding.checks.map((check) => <li key={check}>{check}</li>)}
                      </ul>
                      {refs.length > 0 ? (
                        <div className="reference-stack compact">
                          {refs.map((reference) => (
                            <span key={reference.id}>{reference.label}{reference.pdfPages ? ` · PDF ${reference.pdfPages.join(', ')}` : ''}</span>
                          ))}
                        </div>
                      ) : (
                        <p className="hint-text">加载相关规范索引后显示引用索引。</p>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">Lookup Package</p>
              <h2>查阅路径包</h2>
            </div>
            <BookOpen aria-hidden="true" />
          </div>

          {loadedSources.length === 0 ? (
            <div className="empty-state">
              <strong>规范索引未加载</strong>
              <p>点击“加载推荐索引包”后，这里会显示本项目该查的文件、章节和 PDF 页码。</p>
            </div>
          ) : (
            <div className="lookup-list">
              {findings.map((finding) => (
                <article key={`lookup-${finding.id}`}>
                  <div>
                    <span>{categoryLabels[finding.category]}</span>
                    <strong>{finding.title}</strong>
                  </div>
                  <p>{finding.sourceIds.filter((id) => loadedSourceIds.includes(id)).map(sourceTitle).join('、') || '相关资料源尚未加载'}</p>
                  <div className="reference-stack">
                    {referencesFor(finding.referenceIds, loadedSourceIds).map((reference) => (
                      <span key={reference.id}>
                        <strong>{reference.label}</strong>
                        {reference.pdfPages ? ` · PDF ${reference.pdfPages.join(', ')}` : ''}
                        <small>{reference.summary}</small>
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">Open Questions</p>
              <h2>需要确认的资料</h2>
            </div>
            <HelpCircle aria-hidden="true" />
          </div>
          <div className="unknown-grid">
            {unknowns.map((unknown) => (
              <div key={`${unknown.buildingId}-${unknown.item}`}>
                <strong>{unknown.buildingName}</strong>
                <span>{unknown.item}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="qa" className="panel qa-panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">Grounded QA</p>
              <h2>带项目上下文的规范问答</h2>
            </div>
            <Search aria-hidden="true" />
          </div>

          <div className="quick-row">
            {quickQuestions.map((question) => (
              <button type="button" key={question} onClick={() => { setQuery(question); setSelectedQuestion(question) }}>
                {question}
              </button>
            ))}
          </div>

          <div className="query-box">
            <input value={query} onChange={(event) => setQuery(event.target.value)} />
            <button type="button" onClick={() => setSelectedQuestion(query)}>回答</button>
          </div>

          <article className="answer-box">
            <h3>{answer.question}</h3>
            <div>
              <strong>结论</strong>
              <p>{answer.conclusion}</p>
            </div>
            <div>
              <strong>适用范围</strong>
              <div className="tag-row">
                {answer.appliesTo.map((item) => <span key={item}>{item}</span>)}
              </div>
            </div>
            <div>
              <strong>下一步核对</strong>
              <ul>
                {answer.nextChecks.map((check) => <li key={check}>{check}</li>)}
              </ul>
            </div>
            <div>
              <strong>来源</strong>
              <p>{answer.sourceIds.filter((id) => loadedSourceIds.includes(id)).map(sourceTitle).join('、') || '尚未加载相关规范索引'}</p>
            </div>
            {referencesFor(answer.referenceIds, loadedSourceIds).length > 0 ? (
              <div>
                <strong>引用索引</strong>
                <div className="reference-stack">
                  {referencesFor(answer.referenceIds, loadedSourceIds).map((reference) => (
                    <span key={reference.id}>
                      <strong>{reference.label}</strong>
                      {reference.pdfPages ? ` · PDF ${reference.pdfPages.join(', ')}` : ''}
                      <small>{reference.summary}</small>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            <div>
              <strong>不确定项</strong>
              <p>{answer.uncertainty}</p>
            </div>
          </article>
        </section>

        <section id="sources" className="panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">Source Manifest</p>
              <h2>已加载资料源</h2>
            </div>
            <CheckCircle2 aria-hidden="true" />
          </div>
          {loadedSources.length === 0 ? (
            <div className="empty-state">
              <strong>还没有索引进入当前工作台</strong>
              <p>在规范索引与本地资料库中加载推荐索引后，这里会汇总当前可用于回答的资料源。</p>
            </div>
          ) : (
            <div className="source-grid">
              {loadedSources.map((source) => {
                const state = sourceState(sourceStatus, source.id)
                const localStatus = libraryStatuses[source.id]
                const localPath = localStatus?.relativePath ?? state.localPath ?? sourceLibraryPath(source)
                const searchable = state.searchable || localStatus?.searchable
                const indexAttempted = Boolean(state.indexPath || localStatus?.indexExists)
                return (
                  <article key={source.id} className={`source-card loaded ${state.documentReady || localStatus?.exists ? 'document-ready' : ''}`}>
                    <div className="card-head"><MapPinned aria-hidden="true" /><span>{source.jurisdiction}</span></div>
                    <h3>{source.title}</h3>
                    <p>{source.notes}</p>
                    <div className="tag-row">
                      <span className="status-pill index-loaded">索引已加载</span>
                      <span className={state.documentReady || localStatus?.exists ? 'status-pill document-ready' : 'status-pill missing'}>
                        {state.documentReady || localStatus?.exists ? '全文已就绪' : '全文未下载'}
                      </span>
                      <span className={searchable ? 'status-pill searchable' : indexAttempted ? 'status-pill needs-ocr' : 'status-pill missing'}>
                        {searchable ? '可搜索' : indexAttempted ? '需 OCR' : '未建索引'}
                      </span>
                    </div>
                    <div className="library-path">
                      <span>本地调用路径</span>
                      <code>{localPath}</code>
                    </div>
                    {state.downloadedAt || localStatus?.updatedAt ? <p className="download-message">最近下载：{new Date(state.downloadedAt ?? localStatus?.updatedAt ?? '').toLocaleString()}</p> : null}
                    <a href={source.downloadUrl ?? source.sourceUrl} target="_blank" rel="noreferrer">打开官方来源</a>
                    {state.documentReady || localStatus?.exists ? <a href={localFileUrl(localPath)} target="_blank" rel="noreferrer">打开本地文件</a> : null}
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  )
}

export default App
