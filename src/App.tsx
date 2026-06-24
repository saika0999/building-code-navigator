import {
  AlertTriangle,
  BookOpen,
  Building2,
  ClipboardList,
  Database,
  HelpCircle,
  MapPinned,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import './App.css'
import { zhongshanIndustrialUpstairsCase } from './data/projectCases'
import { sourceReferences } from './data/references'
import { sources } from './data/sources'
import { answerProjectQuestion } from './lib/qaEngine'
import { getFindingsForProject, getSourceIdsForProject, getUnknownsForProject } from './lib/ruleEngine'
import type { BuildingAsset, FireHazard, GeneratedFinding, ProjectCase } from './types/domain'

const fireHazardLabels: Record<FireHazard, string> = {
  unknown: '待确认',
  class_a: '甲类',
  class_b: '乙类',
  class_c: '丙类',
  class_d: '丁类',
  class_e: '戊类',
  civil: '民用/公共功能',
}

const useLabels: Record<BuildingAsset['uses'][number], string> = {
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

function referencesFor(ids: string[] = []) {
  return ids
    .map((id) => sourceReferences.find((reference) => reference.id === id))
    .filter((reference): reference is NonNullable<typeof reference> => Boolean(reference))
}

function App() {
  const [project, setProject] = useState<ProjectCase>(() => structuredClone(zhongshanIndustrialUpstairsCase))
  const [query, setQuery] = useState('这个中山工业上楼项目有哪些前期风险？')
  const [selectedQuestion, setSelectedQuestion] = useState(query)

  const findings = useMemo(() => getFindingsForProject(project), [project])
  const unknowns = useMemo(() => getUnknownsForProject(project), [project])
  const projectSourceIds = useMemo(() => getSourceIdsForProject(project), [project])
  const matchedSources = sources.filter((source) => projectSourceIds.includes(source.id))
  const answer = useMemo(() => answerProjectQuestion(project, selectedQuestion), [project, selectedQuestion])

  const highRiskCount = findings.filter((finding) => finding.severity === 'high').length
  const publicUseCount = project.buildings.filter((building) => building.hasPublicAccess).length
  const unknownFactoryCount = project.buildings.filter(
    (building) => building.uses.includes('factory') && building.fireHazard === 'unknown',
  ).length

  const quickQuestions = [
    '这个中山工业上楼项目有哪些前期风险？',
    '四栋厂房的火灾危险性没有确定会影响什么？',
    '宿舍楼底层食堂要重点查什么？',
    '展厅在工业项目里有什么风险？',
    '中山项目建筑灰空间面积怎么计算？',
    '甲类仓库和配电房之间间距多少？',
  ]

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

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Building2 aria-hidden="true" />
          <div>
            <span>建筑规范查阅页</span>
            <strong>中山工业上楼项目</strong>
          </div>
        </div>

        <nav className="nav-list" aria-label="工作区">
          <a href="#project">
            <ClipboardList aria-hidden="true" />
            项目组成
          </a>
          <a href="#risks">
            <AlertTriangle aria-hidden="true" />
            风险提示
          </a>
          <a href="#qa">
            <Search aria-hidden="true" />
            规范问答
          </a>
          <a href="#sources">
            <Database aria-hidden="true" />
            资料源
          </a>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Zhongshan · Industrial Upstairs</p>
            <h1>{project.name}</h1>
            <p className="lead">{project.description}</p>
          </div>
          <div className="status-stack">
            <span>
              <Building2 aria-hidden="true" />
              {project.buildings.length} 栋/组建筑
            </span>
            <span>
              <AlertTriangle aria-hidden="true" />
              {highRiskCount} 个高风险
            </span>
            <span>
              <HelpCircle aria-hidden="true" />
              {unknowns.length} 个待确认项
            </span>
          </div>
        </header>

        <section className="summary-band">
          <div>
            <span>项目阶段</span>
            <strong>前期条件梳理</strong>
          </div>
          <div>
            <span>公共/民用功能</span>
            <strong>{publicUseCount} 个单体涉及</strong>
          </div>
          <div>
            <span>厂房火灾类别</span>
            <strong>{unknownFactoryCount} 栋待确认</strong>
          </div>
        </section>

        <section id="project" className="panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">Project Composition</p>
              <h2>项目条件快调</h2>
            </div>
            <ShieldCheck aria-hidden="true" />
          </div>

          <div className="condition-grid">
            <label className="check-toggle">
              <input
                type="checkbox"
                checked={project.siteConditions.hasIndependentWarehouse}
                onChange={(event) => updateSiteCondition('hasIndependentWarehouse', event.target.checked)}
              />
              <span>存在独立仓库/中间仓库</span>
            </label>
            <label>
              <span>仓储火灾危险性</span>
              <select
                value={project.siteConditions.warehouseFireHazard}
                onChange={(event) => updateSiteCondition('warehouseFireHazard', event.target.value as FireHazard)}
              >
                <option value="unknown">待确认</option>
                <option value="class_a">甲类</option>
                <option value="class_b">乙类</option>
                <option value="class_c">丙类</option>
                <option value="class_d">丁类</option>
                <option value="class_e">戊类</option>
              </select>
            </label>
            <label className="check-toggle">
              <input
                type="checkbox"
                checked={project.siteConditions.hasSubstation}
                onChange={(event) => updateSiteCondition('hasSubstation', event.target.checked)}
              />
              <span>有配电房/变配电设施</span>
            </label>
            <label className="check-toggle">
              <input
                type="checkbox"
                checked={project.siteConditions.hasGraySpace}
                onChange={(event) => updateSiteCondition('hasGraySpace', event.target.checked)}
              />
              <span>涉及灰空间/架空/连廊</span>
            </label>
            <label className="check-toggle">
              <input
                type="checkbox"
                checked={project.siteConditions.exhibitionOpenToPublic}
                onChange={(event) => updateSiteCondition('exhibitionOpenToPublic', event.target.checked)}
              />
              <span>展厅可能对外开放</span>
            </label>
            <label className="check-toggle">
              <input
                type="checkbox"
                checked={project.siteConditions.industrialUpstairsPolicyKnown}
                onChange={(event) => updateSiteCondition('industrialUpstairsPolicyKnown', event.target.checked)}
              />
              <span>已确认中山工业上楼专项口径</span>
            </label>
          </div>
        </section>

        <section className="panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">Building Register</p>
              <h2>项目组成与单体条件</h2>
            </div>
            <Building2 aria-hidden="true" />
          </div>

          <div className="building-grid">
            {project.buildings.map((building) => (
              <article key={building.id} className="building-card">
                <div className="card-head">
                  <Building2 aria-hidden="true" />
                  <span>{building.floors ? `${building.floors} 层` : '层数待确认'}</span>
                </div>
                <h3>{building.name}</h3>
                <div className="tag-row">
                  {building.uses.map((use) => (
                    <span key={use}>{useLabels[use]}</span>
                  ))}
                </div>
                <p>
                  火灾危险性：<strong>{fireHazardLabels[building.fireHazard]}</strong>
                </p>
                {building.uses.includes('factory') ? (
                  <label>
                    <span>厂房火灾危险性</span>
                    <select
                      value={building.fireHazard}
                      onChange={(event) => updateBuildingFireHazard(building.id, event.target.value as FireHazard)}
                    >
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
                  {building.knownUnknowns.slice(0, 4).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section id="risks" className="panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">Generated Risk Register</p>
              <h2>根据项目组成生成的提示</h2>
            </div>
            <AlertTriangle aria-hidden="true" />
          </div>

          <div className="risk-list">
            {findings.map((finding) => (
              <article key={finding.id} className={`risk-item ${finding.severity}`}>
                <div>
                  <span>
                    {severityLabels[finding.severity]} · {categoryLabels[finding.category]}
                  </span>
                  <h3>{finding.title}</h3>
                  <p>{finding.why}</p>
                  <div className="tag-row">
                    {finding.appliesTo.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <strong>下一步核对</strong>
                  <ul>
                    {finding.checks.map((check) => (
                      <li key={check}>{check}</li>
                    ))}
                  </ul>
                  {referencesFor(finding.referenceIds).length > 0 ? (
                    <div className="reference-stack compact">
                      {referencesFor(finding.referenceIds).map((reference) => (
                        <span key={reference.id}>
                          {reference.label}
                          {reference.pdfPages ? ` · PDF ${reference.pdfPages.join(', ')}` : ''}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">Lookup Package</p>
              <h2>按主题生成的查阅路径</h2>
            </div>
            <BookOpen aria-hidden="true" />
          </div>

          <div className="lookup-list">
            {findings.map((finding) => (
              <article key={`lookup-${finding.id}`}>
                <div>
                  <span>{categoryLabels[finding.category]}</span>
                  <strong>{finding.title}</strong>
                </div>
                <p>{finding.sourceIds.map(sourceTitle).join('、')}</p>
                <div className="reference-stack">
                  {referencesFor(finding.referenceIds).map((reference) => (
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
        </section>

        <section className="panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">Open Questions</p>
              <h2>需要向甲方/主管部门确认的资料</h2>
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
              <button
                type="button"
                key={question}
                onClick={() => {
                  setQuery(question)
                  setSelectedQuestion(question)
                }}
              >
                {question}
              </button>
            ))}
          </div>

          <div className="query-box">
            <input value={query} onChange={(event) => setQuery(event.target.value)} />
            <button type="button" onClick={() => setSelectedQuestion(query)}>
              回答
            </button>
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
                {answer.appliesTo.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>
            <div>
              <strong>下一步核对</strong>
              <ul>
                {answer.nextChecks.map((check) => (
                  <li key={check}>{check}</li>
                ))}
              </ul>
            </div>
            <div>
              <strong>来源</strong>
              <p>{answer.sourceIds.map(sourceTitle).join('、')}</p>
            </div>
            {referencesFor(answer.referenceIds).length > 0 ? (
              <div>
                <strong>引用索引</strong>
                <div className="reference-stack">
                  {referencesFor(answer.referenceIds).map((reference) => (
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
              <h2>本项目触发的资料源</h2>
            </div>
            <BookOpen aria-hidden="true" />
          </div>

          <div className="source-grid">
            {matchedSources.map((source) => (
              <article key={source.id} className="source-card">
                <div className="card-head">
                  <MapPinned aria-hidden="true" />
                  <span>{source.jurisdiction}</span>
                </div>
                <h3>{source.title}</h3>
                <p>{source.notes}</p>
                <div className="tag-row">
                  <span>{source.access}</span>
                  <span>{source.redistribution}</span>
                  <span>{source.reviewStatus}</span>
                </div>
                <a href={source.sourceUrl} target="_blank" rel="noreferrer">
                  打开官方来源
                </a>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  )
}

export default App
