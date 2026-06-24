import {
  AlertTriangle,
  BookOpen,
  Building2,
  CheckCircle2,
  ClipboardList,
  Database,
  Download,
  HelpCircle,
  MapPinned,
  Search,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import './App.css'
import { intakeQuestions } from './data/intake'
import { qaExamples } from './data/qa'
import { risks } from './data/risks'
import { sources } from './data/sources'
import type { ProjectProfile, ProjectType, RegionId, RiskItem } from './types/domain'

const initialProfile: ProjectProfile = {
  region: 'shenzhen',
  projectType: 'industrial-upstairs',
  stage: 'pre_design',
  fireHazard: 'unknown',
  hasWarehouse: true,
  hasSubstation: true,
  isHighRise: false,
  hasBasement: false,
  clientBriefQuality: 'unclear',
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

const fireHazardLabels: Record<ProjectProfile['fireHazard'], string> = {
  unknown: '未知，待确认',
  class_a: '甲类',
  class_b: '乙类',
  class_c: '丙类',
  class_d_e: '丁/戊类',
}

const briefQualityLabels: Record<ProjectProfile['clientBriefQuality'], string> = {
  unclear: '任务书不清楚',
  partial: '部分条件明确',
  clear: '条件较完整',
}

function riskMatchesProfile(risk: RiskItem, profile: ProjectProfile) {
  const regionMatch = risk.regions.includes(profile.region)
  const typeMatch = risk.projectTypes.includes(profile.projectType)
  const triggerMatch = risk.triggers.some((trigger) => {
    const value = profile[trigger]

    if (trigger === 'fireHazard') {
      return value === 'unknown' || value === 'class_a' || value === 'class_b'
    }

    if (trigger === 'clientBriefQuality') {
      return value === 'unclear' || value === 'partial'
    }

    if (trigger === 'projectType' || trigger === 'region') {
      return true
    }

    return Boolean(value)
  })

  return regionMatch && typeMatch && triggerMatch
}

function App() {
  const [profile, setProfile] = useState<ProjectProfile>(initialProfile)
  const [query, setQuery] = useState('甲类仓库和配电房之间间距多少？')

  const matchedSources = useMemo(() => {
    return sources.filter((source) => {
      const jurisdictionMatch =
        source.jurisdiction === '全国' ||
        source.jurisdiction === '广东省' ||
        source.jurisdiction === regionLabels[profile.region]

      return jurisdictionMatch && source.projectTypes.includes(profile.projectType)
    })
  }, [profile.projectType, profile.region])

  const matchedRisks = useMemo(() => {
    return risks.filter((risk) => riskMatchesProfile(risk, profile))
  }, [profile])

  const matchedQa = useMemo(() => {
    const normalizedQuery = query.trim()
    const exact = qaExamples.find((item) => item.question === normalizedQuery)
    if (exact) {
      return exact
    }

    return qaExamples.find((item) =>
      normalizedQuery
        .split(/[，。？?\s]/)
        .filter(Boolean)
        .some((token) => item.question.includes(token) || item.answer.includes(token)),
    )
  }, [query])

  const unknownCount = [
    profile.fireHazard === 'unknown',
    profile.clientBriefQuality !== 'clear',
    profile.hasWarehouse && profile.fireHazard === 'unknown',
    profile.projectType === 'industrial-upstairs' && profile.region !== 'shenzhen',
  ].filter(Boolean).length

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Building2 aria-hidden="true" />
          <div>
            <span>建筑规范查阅页</span>
            <strong>工业建筑工作台</strong>
          </div>
        </div>

        <nav className="nav-list" aria-label="工作区">
          <a href="#intake">
            <ClipboardList aria-hidden="true" />
            项目条件
          </a>
          <a href="#sources">
            <Database aria-hidden="true" />
            资料源
          </a>
          <a href="#risks">
            <AlertTriangle aria-hidden="true" />
            风险清单
          </a>
          <a href="#qa">
            <Search aria-hidden="true" />
            规范问答
          </a>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">深圳 / 中山 · 第一版 MVP</p>
            <h1>把模糊任务书整理成可追溯的规范工作流</h1>
          </div>
          <div className="status-stack">
            <span>
              <BookOpen aria-hidden="true" />
              {matchedSources.length} 个资料源
            </span>
            <span>
              <AlertTriangle aria-hidden="true" />
              {matchedRisks.length} 个触发风险
            </span>
          </div>
        </header>

        <section className="summary-band">
          <div>
            <span>当前项目</span>
            <strong>
              {regionLabels[profile.region]} · {projectTypeLabels[profile.projectType]}
            </strong>
          </div>
          <div>
            <span>火灾危险性</span>
            <strong>{fireHazardLabels[profile.fireHazard]}</strong>
          </div>
          <div>
            <span>待确认强度</span>
            <strong>{unknownCount > 0 ? `${unknownCount} 项待确认` : '条件较完整'}</strong>
          </div>
        </section>

        <section id="intake" className="panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">Project Intake</p>
              <h2>项目条件问诊</h2>
            </div>
            <HelpCircle aria-hidden="true" />
          </div>

          <div className="form-grid">
            <label>
              <span>项目所在城市</span>
              <select
                value={profile.region}
                onChange={(event) =>
                  setProfile((current) => ({ ...current, region: event.target.value as RegionId }))
                }
              >
                <option value="shenzhen">深圳市</option>
                <option value="zhongshan">中山市</option>
              </select>
            </label>

            <label>
              <span>工业建筑类型</span>
              <select
                value={profile.projectType}
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    projectType: event.target.value as ProjectType,
                  }))
                }
              >
                {Object.entries(projectTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>火灾危险性类别</span>
              <select
                value={profile.fireHazard}
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    fireHazard: event.target.value as ProjectProfile['fireHazard'],
                  }))
                }
              >
                {Object.entries(fireHazardLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>任务书完整度</span>
              <select
                value={profile.clientBriefQuality}
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    clientBriefQuality: event.target.value as ProjectProfile['clientBriefQuality'],
                  }))
                }
              >
                {Object.entries(briefQualityLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="toggle-row">
            {[
              ['hasWarehouse', '包含仓储功能'],
              ['hasSubstation', '有配电房/变配电'],
              ['isHighRise', '可能为高层工业建筑'],
              ['hasBasement', '包含地下室'],
            ].map(([field, label]) => (
              <label key={field} className="check-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(profile[field as keyof ProjectProfile])}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      [field]: event.target.checked,
                    }))
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <div className="question-list">
            {intakeQuestions.map((question) => (
              <div key={question.id}>
                <CheckCircle2 aria-hidden="true" />
                <div>
                  <strong>{question.label}</strong>
                  <p>{question.helper}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="sources" className="panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">Source Manifest</p>
              <h2>适用规范与政策资料源</h2>
            </div>
            <button type="button" className="icon-button" title="未来接入一键同步资料源">
              <Download aria-hidden="true" />
            </button>
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

        <section id="risks" className="panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">Risk Register</p>
              <h2>方案前期风险清单</h2>
            </div>
            <AlertTriangle aria-hidden="true" />
          </div>

          <div className="risk-list">
            {matchedRisks.map((risk) => (
              <article key={risk.id} className={`risk-item ${risk.severity}`}>
                <div>
                  <span>{risk.severity}</span>
                  <h3>{risk.title}</h3>
                  <p>{risk.description}</p>
                </div>
                <ul>
                  {risk.actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section id="qa" className="panel qa-panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">Grounded QA</p>
              <h2>设计过程规范问答原型</h2>
            </div>
            <Search aria-hidden="true" />
          </div>

          <div className="query-box">
            <input value={query} onChange={(event) => setQuery(event.target.value)} />
            <button type="button" onClick={() => setQuery('建筑灰空间面积怎么计算？')}>
              试问灰空间
            </button>
          </div>

          {matchedQa ? (
            <article className="answer-box">
              <h3>{matchedQa.question}</h3>
              <p>{matchedQa.answer}</p>
              <div>
                <strong>适用前提</strong>
                <ul>
                  {matchedQa.assumptions.map((assumption) => (
                    <li key={assumption}>{assumption}</li>
                  ))}
                </ul>
              </div>
              <div>
                <strong>来源</strong>
                <p>
                  {matchedQa.sourceIds
                    .map((id) => sources.find((source) => source.id === id)?.title ?? id)
                    .join('、')}
                </p>
              </div>
              <div>
                <strong>不确定项</strong>
                <p>{matchedQa.uncertainty}</p>
              </div>
            </article>
          ) : (
            <article className="answer-box muted">
              <h3>还没有匹配到示例答案</h3>
              <p>后续接入本地全文索引后，这里会调用规范资料库生成带条文来源的回答。</p>
            </article>
          )}
        </section>
      </section>
    </main>
  )
}

export default App
