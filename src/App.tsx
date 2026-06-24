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
import { useMemo, useState } from 'react'
import './App.css'
import { zhongshanIndustrialUpstairsCase } from './data/projectCases'
import { sourceReferences } from './data/references'
import { sources } from './data/sources'
import { answerProjectQuestion } from './lib/qaEngine'
import { getFindingsForProject, getSourceIdsForProject, getUnknownsForProject } from './lib/ruleEngine'
import type { BuildingAsset, BuildingUse, FireHazard, GeneratedFinding, ProjectCase, ProjectType, RegionId } from './types/domain'

const emptyProject: ProjectCase = {
  id: 'draft-project',
  name: '未命名工业项目',
  region: 'zhongshan',
  projectType: 'industrial-upstairs',
  stage: 'pre_design',
  description: '从项目条件和楼栋组成开始，加载规范包后生成查阅路径、风险提示和带来源回答。',
  assumptions: ['项目条件由用户手动录入。未加载规范包前，系统不输出规范结论。'],
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

function App() {
  const [project, setProject] = useState<ProjectCase>(() => structuredClone(emptyProject))
  const [buildingType, setBuildingType] = useState(buildingTemplates[0].label)
  const [buildingName, setBuildingName] = useState('')
  const [buildingFloors, setBuildingFloors] = useState('8')
  const [query, setQuery] = useState('这个项目有哪些前期风险？')
  const [selectedQuestion, setSelectedQuestion] = useState(query)
  const [loadedSourceIds, setLoadedSourceIds] = useState<string[]>([])

  const findings = useMemo(() => getFindingsForProject(project), [project])
  const unknowns = useMemo(() => getUnknownsForProject(project), [project])
  const recommendedSourceIds = useMemo(() => getSourceIdsForProject(project), [project])
  const recommendedSources = sources.filter((source) => recommendedSourceIds.includes(source.id))
  const loadedSources = sources.filter((source) => loadedSourceIds.includes(source.id))
  const answer = useMemo(
    () => answerProjectQuestion(project, selectedQuestion, loadedSourceIds),
    [loadedSourceIds, project, selectedQuestion],
  )

  const highRiskCount = findings.filter((finding) => finding.severity === 'high').length
  const unknownFactoryCount = project.buildings.filter(
    (building) => building.uses.includes('factory') && building.fireHazard === 'unknown',
  ).length

  function loadRecommendedPackage() {
    setLoadedSourceIds((current) => Array.from(new Set(current.concat(recommendedSourceIds))))
  }

  function loadSource(sourceId: string) {
    setLoadedSourceIds((current) => (current.includes(sourceId) ? current : current.concat(sourceId)))
  }

  function unloadSource(sourceId: string) {
    setLoadedSourceIds((current) => current.filter((id) => id !== sourceId))
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
    setLoadedSourceIds([])
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
            <h1>先录入项目，再加载规范包，最后生成风险和回答</h1>
            <p className="lead">
              这个页面不是为某个固定项目写死的。你可以手动添加厂房、总部、宿舍食堂、展厅、仓库、配电房等单体；系统会根据录入内容推荐规范包，加载后再给出带来源的提示。
            </p>
          </div>
          <div className="status-stack">
            <span><Building2 aria-hidden="true" />{project.buildings.length} 栋/组建筑</span>
            <span><Database aria-hidden="true" />{loadedSourceIds.length} 份资料已加载</span>
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
              <h2>规范包加载与下载入口</h2>
            </div>
            <button type="button" className="primary-button" onClick={loadRecommendedPackage}>
              <Download aria-hidden="true" />加载推荐规范包
            </button>
          </div>

          <div className="library-status">
            <div>
              <strong>{loadedSourceIds.length > 0 ? '规范包已加载' : '尚未加载规范包'}</strong>
              <p>未加载规范包时，问答只能提示需要先加载资料源；加载后才会显示引用索引和查阅路径。</p>
            </div>
            <div>
              <span>推荐资料源</span>
              <strong>{recommendedSources.length} 份</strong>
            </div>
          </div>

          <div className="source-grid">
            {recommendedSources.map((source) => {
              const loaded = loadedSourceIds.includes(source.id)
              return (
                <article key={source.id} className={`source-card ${loaded ? 'loaded' : ''}`}>
                  <div className="card-head">
                    <MapPinned aria-hidden="true" />
                    <span>{source.jurisdiction}</span>
                  </div>
                  <h3>{source.title}</h3>
                  <p>{source.notes}</p>
                  <div className="tag-row">
                    <span>{loaded ? 'loaded' : 'not loaded'}</span>
                    <span>{source.access}</span>
                    <span>{source.redistribution}</span>
                  </div>
                  <div className="source-actions">
                    <button type="button" onClick={() => (loaded ? unloadSource(source.id) : loadSource(source.id))}>
                      {loaded ? '卸载索引' : '加载索引'}
                    </button>
                    <a href={source.downloadUrl ?? source.sourceUrl} target="_blank" rel="noreferrer">
                      {source.downloadUrl ? '下载/打开官方文件' : '打开官方来源'}
                    </a>
                  </div>
                </article>
              )
            })}
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
              <p>风险清单会根据楼栋功能、火灾危险性和已加载规范包生成。</p>
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
                        <p className="hint-text">加载相关规范包后显示引用索引。</p>
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
              <strong>规范包未加载</strong>
              <p>点击“加载推荐规范包”后，这里会显示本项目该查的文件、章节和 PDF 页码。</p>
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
              <p>{answer.sourceIds.filter((id) => loadedSourceIds.includes(id)).map(sourceTitle).join('、') || '尚未加载相关规范包'}</p>
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
          <div className="source-grid">
            {loadedSources.map((source) => (
              <article key={source.id} className="source-card loaded">
                <div className="card-head"><MapPinned aria-hidden="true" /><span>{source.jurisdiction}</span></div>
                <h3>{source.title}</h3>
                <p>{source.notes}</p>
                <a href={source.downloadUrl ?? source.sourceUrl} target="_blank" rel="noreferrer">打开官方来源</a>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  )
}

export default App
