import { useDeferredValue, useEffect, useState } from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom'

const api = axios.create({ baseURL: '/api' })

type FilterGroup = {
  key: string
  title: string
  options: string[]
}

type Project = {
  id: string
  title: string
  source: string
  domain: string
  task: string
  data_type: string
  maturity: string
  access: string
  score: number
  reuse: number
  updated: string
  owner: string
  license: string
  description: string
  impact: string
  tags: string[]
}

type ProjectField = {
  field_name: string
  field_type: string
  description: string
}

type ProjectFile = {
  filename: string
  filesize: string
}

type ProjectDetail = Project & {
  inputs: ProjectField[]
  outputs: ProjectField[]
  files: ProjectFile[]
  governance: string[]
}

type PerformanceMetric = {
  label: string
  value: string
  bar: number
  note: string
}

type PerformanceProfile = {
  project_id: string
  grade: string
  title: string
  summary: string
  metrics: PerformanceMetric[]
  bar_title: string
  bars: [string, number, string][]
  notes: [string, string][]
  table_title: string
  headers: string[]
  rows: string[][]
  monitoring: string[]
}

type ImpactDashboard = {
  kpis: { label: string; value: string; desc: string }[]
  monthly: { month: string; registered: number; adopted: number }[]
  source_distribution: { label: string; count: number }[]
  domain_distribution: { label: string; count: number }[]
  top_assets: { id: string; title: string; source: string; maturity: string; reuse: number }[]
}

type Leaderboard = {
  leaders: { owner: string; source: string; assets: number; reuse: number; operating: number; score: number }[]
}

type AdminSettings = {
  registry_enabled: boolean
  source_options: { id: number; name: string }[]
  template_options: { id: number; name: string }[]
}

type Bookmarks = {
  project_ids: string[]
}

type QaPost = {
  id: number
  project_id: string
  author: string
  author_dept: string
  content: string
  parent_id: number | null
  created_at: string
}

type AutoCheck = {
  task: string
  data_type: string
  template: string
  metric_preset: string
  renderer: string
  tags: string[]
  description: string
  input_schema: string
  output_schema: string
  endpoint: string
  threshold: string
  governance: string
  checks: { label: string; title: string; description: string }[]
}

type PlaceholderData = {
  slug: string
  title: string
  description: string
  status: string
  body: string
  cta_label?: string | null
}

const scenarios = [
  '검사 이미지로 제품 결함을 분류하고 불량 유형을 설명하고 싶습니다.',
  '설비 로그와 센서 데이터로 고장 원인을 분류하고 이상 신호를 조기에 탐지하고 싶습니다.',
  '도면과 사양서 PDF를 RAG로 검색하고 담당자가 질문하면 근거 문서와 함께 답변하고 싶습니다.',
  '월별 판매와 생산 계획 데이터를 기반으로 부품 수요를 예측하고 싶습니다.',
]

const menu = [
  { to: '/', label: 'AI 프로젝트 탐색' },
  { to: '/registry', label: 'AI 자산 등록' },
  { to: '/admin', label: 'Admin 관리자' },
  { to: '/placeholders/newsletter', label: 'AX Community' },
]

function scoreMatch(project: Project, text: string) {
  const normalized = text.toLowerCase()
  let score = project.score - 8
  const join = [project.title, project.description, project.task, project.data_type, ...project.tags].join(' ').toLowerCase()
  normalized.split(/\s+/).filter(Boolean).forEach((word) => {
    if (join.includes(word)) score += 5
  })
  return Math.max(58, Math.min(99, Math.round(score)))
}

function sortProjects(projects: Project[], sort: string, matchScores: Record<string, number>) {
  const maturityRank: Record<string, number> = { PoC: 1, 검증완료: 2, 운영전환: 3, 운영: 4 }
  const copied = [...projects]
  copied.sort((a, b) => {
    if (sort === 'reuse') return b.reuse - a.reuse
    if (sort === 'updated') return b.updated.localeCompare(a.updated)
    if (sort === 'maturity') return (maturityRank[b.maturity] ?? 0) - (maturityRank[a.maturity] ?? 0)
    return (matchScores[b.id] ?? b.score) - (matchScores[a.id] ?? a.score)
  })
  return copied
}

function samplePayload(projectId?: string) {
  if (projectId === 'assembly-defect') return { line_id: 'ASM-01', torque: 32.5, temperature: 41.2 }
  if (projectId === 'spec-rag') return { question: '체결 토크 기준이 어떻게 되나요?', permission_group: '설계팀' }
  if (projectId === 'parts-forecast') return { part_no: 'P-10023', month: '2026-07', sales_plan: 14500 }
  if (projectId === 'fault-log') return { equipment_id: 'EQ-204', alarm_code: 'ALM-88' }
  if (projectId === 'quote-summary') return { comparison_axis: ['가격', '납기', '품질'] }
  if (projectId === 'vision-segmentation') return { product_type: 'shaft', threshold: 0.42 }
  if (projectId === 'bi-anomaly') return { metric_id: 'quality_defect_rate' }
  return { question: '고위험 작업 전 확인 사항이 궁금합니다.', site: '창원1공장' }
}

function projectCerts(project: Project) {
  const certs: { label: string; cls: string }[] = []
  if (['검증완료', '운영전환', '운영'].includes(project.maturity)) certs.push({ label: '검증 완료', cls: 'ok' })
  certs.push({ label: '재현 가능', cls: 'rep' })
  if (project.maturity === '운영') certs.push({ label: '운영 적용', cls: 'live' })
  if (project.access === '권한승인') certs.push({ label: '권한 필요', cls: 'lock' })
  return certs
}

function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">WIA</span>
          <div>
            <strong>AI Studio</strong>
            <p>Mockup to product</p>
          </div>
        </div>
        <nav className="nav-list">
          {menu.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')} end={item.to === '/'}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-card">
          <strong>Portal Notes</strong>
          <p>목업 데이터는 FastAPI + SQLite로 이관했고, 미정의 화면은 플레이스홀더 라우트로 연결했습니다.</p>
        </div>
      </aside>
      <main className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">HYUNDAI WIA</p>
            <h1>AI Studio Portal</h1>
          </div>
          <div className="topbar-chip">FastAPI · React · SQLite</div>
        </header>
        <div className="page-body">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/registry" element={<RegistryPage />} />
            <Route path="/placeholders/:slug" element={<PlaceholderPage />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

function HomePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('recommend')
  const [selected, setSelected] = useState<Record<string, string[]>>({})
  const [taskText, setTaskText] = useState('')
  const [matchScores, setMatchScores] = useState<Record<string, number>>({})
  const [drawerProjectId, setDrawerProjectId] = useState<string | null>(null)
  const [drawerTab, setDrawerTab] = useState('overview')
  const deferredSearch = useDeferredValue(search)

  const filtersQuery = useQuery({ queryKey: ['filters'], queryFn: async () => (await api.get<FilterGroup[]>('/filters')).data })
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: async () => (await api.get<Project[]>('/projects')).data })
  const bookmarksQuery = useQuery({ queryKey: ['bookmarks'], queryFn: async () => (await api.get<Bookmarks>('/bookmarks')).data })
  const dashboardQuery = useQuery({ queryKey: ['impact-dashboard'], queryFn: async () => (await api.get<ImpactDashboard>('/impact-dashboard')).data })
  const leaderboardQuery = useQuery({ queryKey: ['leaderboard'], queryFn: async () => (await api.get<Leaderboard>('/leaderboard')).data })
  const adminQuery = useQuery({ queryKey: ['admin-settings'], queryFn: async () => (await api.get<AdminSettings>('/admin/settings')).data })

  const bookmarkToggle = useMutation({
    mutationFn: async (projectId: string) => (await api.post(`/bookmarks/${projectId}/toggle`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookmarks'] }),
  })

  const projects = projectsQuery.data ?? []
  const bookmarked = new Set(bookmarksQuery.data?.project_ids ?? [])
  const normalized = deferredSearch.trim().toLowerCase()
  const visibleProjects = sortProjects(
    projects.filter((project) => {
      const textOk = !normalized || [project.title, project.description, project.source, project.domain, project.task, project.data_type, project.maturity, project.access, ...project.tags].join(' ').toLowerCase().includes(normalized)
      const filterable = { source: project.source, domain: project.domain, task: project.task, data_type: project.data_type, maturity: project.maturity, access: project.access }
      const filterOk = Object.entries(selected).every((entry) => entry[1].length === 0 || entry[1].includes(filterable[entry[0] as keyof typeof filterable]))
      return textOk && filterOk
    }),
    sort,
    matchScores,
  )

  const matchedTop = sortProjects(projects, 'recommend', matchScores).slice(0, 3)

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <p className="eyebrow">AI PORTAL</p>
          <h2>목업 기반 AI 자산 포털</h2>
          <p className="hero-copy">카탈로그, 샌드박스 실행, 운영 임팩트, 관리자 설정, 신규 자산 등록 흐름을 하나의 프론트엔드로 연결했습니다.</p>
          <div className="hero-actions">
            <a className="primary-btn" href="#catalog">프로젝트 탐색</a>
            <a className="ghost-btn" href="#impact">임팩트 보기</a>
          </div>
        </div>
        <div className="hero-grid">
          <article className="mini-panel"><strong>{projects.length}</strong><span>시드 프로젝트</span></article>
          <article className="mini-panel"><strong>{dashboardQuery.data?.kpis[1]?.value ?? '-'}</strong><span>누적 재사용</span></article>
          <article className="mini-panel"><strong>{adminQuery.data?.registry_enabled ? 'ON' : 'OFF'}</strong><span>등록 기능</span></article>
          <article className="mini-panel"><strong>{leaderboardQuery.data?.leaders[0]?.owner ?? '-'}</strong><span>현재 리더</span></article>
        </div>
      </section>

      <section className="section-card" id="matching">
        <SectionHead title="LLM 자산 매칭" description="목업의 추천 흐름을 React에서 재구성했습니다." />
        <textarea className="prompt-box" value={taskText} onChange={(event) => setTaskText(event.target.value)} placeholder="예: 검사 이미지와 설비 센서 데이터를 이용해서 조립 공정의 불량 가능성을 사전에 예측하고 싶습니다." />
        <div className="scenario-row">
          {scenarios.map((item) => (
            <button key={item} className="chip-btn" onClick={() => setTaskText(item)}>{item}</button>
          ))}
        </div>
        <div className="toolbar-row">
          <button
            className="primary-btn"
            onClick={() => {
              const next: Record<string, number> = {}
              projects.forEach((project) => {
                next[project.id] = scoreMatch(project, taskText)
              })
              setMatchScores(next)
              setSort('recommend')
            }}
          >
            최적 프로젝트 추천받기
          </button>
          <span className="helper-text">입력 문장을 기준으로 추천도를 다시 계산합니다.</span>
        </div>
        {Object.keys(matchScores).length > 0 && (
          <div className="match-banner">
            {matchedTop.map((project) => `${project.title} ${matchScores[project.id] ?? project.score}%`).join(' · ')}
          </div>
        )}
      </section>

      <section className="section-card" id="catalog">
        <SectionHead title="AI 프로젝트 카탈로그" description="검색, 필터, 정렬, 북마크를 연결했습니다." />
        <div className="catalog-layout">
          <aside className="filter-panel">
            <input className="search-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="프로젝트 검색" />
            <button className="ghost-btn full" onClick={() => { setSearch(''); setSelected({}); setMatchScores({}); }}>초기화</button>
            {(filtersQuery.data ?? []).map((group) => (
              <div key={group.key} className="filter-group">
                <strong>{group.title}</strong>
                <div className="filter-chips">
                  {group.options.map((option) => {
                    const active = selected[group.key]?.includes(option)
                    return (
                      <button
                        key={option}
                        className={active ? 'chip-btn active' : 'chip-btn'}
                        onClick={() => {
                          const current = selected[group.key] ?? []
                          const nextValues = current.includes(option) ? current.filter((value) => value !== option) : [...current, option]
                          setSelected({ ...selected, [group.key]: nextValues })
                        }}
                      >
                        {option}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </aside>
          <div className="catalog-panel">
            <div className="toolbar-row spread">
              <strong>{visibleProjects.length}개 프로젝트</strong>
              <div className="tab-row">
                {['recommend', 'reuse', 'updated', 'maturity'].map((item) => (
                  <button key={item} className={sort === item ? 'tab-btn active' : 'tab-btn'} onClick={() => setSort(item)}>
                    {{ recommend: '추천순', reuse: '재사용순', updated: '최신순', maturity: '성숙도순' }[item]}
                  </button>
                ))}
              </div>
            </div>
            <div className="project-grid">
              {visibleProjects.map((project) => {
                const score = matchScores[project.id] ?? project.score
                const certs = projectCerts(project)
                return (
                  <article key={project.id} className="project-card">
                    <div className="card-topline">
                      <span className="source-label">{project.source}</span>
                      <span className="card-top-actions">
                        <button className={bookmarked.has(project.id) ? 'bookmark-card-btn active' : 'bookmark-card-btn'} onClick={() => bookmarkToggle.mutate(project.id)}>★</button>
                        <span className={score >= 90 ? 'score-badge high' : 'score-badge'}>{score}%</span>
                      </span>
                    </div>
                    <h3>{project.title}</h3>
                    <p className="project-desc">{project.description}</p>
                    <div className="cert-row">
                      {certs.map((cert) => <span key={`${project.id}-${cert.label}`} className={`cert-badge ${cert.cls}`}>{cert.label}</span>)}
                    </div>
                    <div className="meta-row">
                      <span className="meta-pill blue">{project.domain}</span>
                      <span className="meta-pill">{project.task}</span>
                      <span className="meta-pill">{project.data_type}</span>
                      <span className="meta-pill green">{project.maturity}</span>
                    </div>
                    <div className="meta-row">
                      {project.tags.slice(0, 4).map((tag) => <span key={tag} className="meta-pill">#{tag}</span>)}
                    </div>
                    <div className="card-foot">
                      <div className="small-stat"><b>{project.reuse}회</b> 재사용<br />Updated {project.updated}</div>
                      <div className="card-actions">
                        <button className="mini-btn primary" onClick={() => { setDrawerProjectId(project.id); setDrawerTab('overview') }}>상세/실행</button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="split-grid" id="impact">
        <div className="section-card">
          <SectionHead title="임팩트 대시보드" description="목업 KPI와 분포 차트를 API에서 받아 렌더링합니다." />
          <div className="kpi-grid">
            {(dashboardQuery.data?.kpis ?? []).map((item) => (
              <article key={item.label} className="kpi-card">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.desc}</p>
              </article>
            ))}
          </div>
          <div className="chart-card">
            {(dashboardQuery.data?.monthly ?? []).map((item) => (
              <div key={item.month} className="bar-col">
                <div className="bar-stack">
                  <i style={{ height: `${item.registered}px` }} />
                  <i className="alt" style={{ height: `${item.adopted * 2}px` }} />
                </div>
                <span>{item.month}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="stack-card">
          <div className="section-card compact">
            <SectionHead title="출처 분포" description="시드 프로젝트 기준" />
            {(dashboardQuery.data?.source_distribution ?? []).map((item) => <DistributionRow key={item.label} {...item} />)}
          </div>
          <div className="section-card compact">
            <SectionHead title="업무 영역 분포" description="카탈로그 기준" />
            {(dashboardQuery.data?.domain_distribution ?? []).map((item) => <DistributionRow key={item.label} {...item} />)}
          </div>
          <div className="section-card compact">
            <SectionHead title="Top 재사용 자산" description="재사용 횟수 기준" />
            {(dashboardQuery.data?.top_assets ?? []).map((item, index) => (
              <div key={item.id} className="list-row">
                <span>{index + 1}</span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.source} · {item.maturity}</p>
                </div>
                <b>{item.reuse}</b>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="split-grid">
        <div className="section-card">
          <SectionHead title="AX Community" description="정의되지 않은 화면은 형태만 구현했습니다." />
          <div className="community-grid">
            <button className="community-card" onClick={() => navigate('/placeholders/newsletter')}>
              <strong>AI Trend News Letter</strong>
              <p>뉴스레터 발행 화면 골격</p>
            </button>
            <button className="community-card" onClick={() => navigate('/placeholders/ask-anything')}>
              <strong>AI 무엇이든 물어보살</strong>
              <p>질문/답변 허브 화면 골격</p>
            </button>
            <button className="community-card" onClick={() => navigate('/placeholders/best-practice')}>
              <strong>Best Practice 공유</strong>
              <p>사례 등록 화면 골격</p>
            </button>
          </div>
        </div>
        <div className="section-card">
          <SectionHead title="내 컬렉션" description="북마크 API와 연결된 저장 자산" />
          <div className="collection-grid">
            {projects.filter((project) => bookmarked.has(project.id)).map((project) => (
              <article key={project.id} className="collection-card">
                <span className="source-pill">{project.source}</span>
                <strong>{project.title}</strong>
                <p>{project.description}</p>
                <button className="ghost-btn slim" onClick={() => { setDrawerProjectId(project.id); setDrawerTab('overview') }}>열기</button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-card">
        <SectionHead title="기여자 랭킹" description="목업 로직과 동일하게 조직 단위 점수를 계산합니다." />
        <div className="leaderboard-list">
          {(leaderboardQuery.data?.leaders ?? []).map((leader, index) => (
            <div key={leader.owner} className="leader-row">
              <span>{index + 1}</span>
              <div>
                <strong>{leader.owner}</strong>
                <p>{leader.source} · 자산 {leader.assets}건 · 재사용 {leader.reuse}회</p>
              </div>
              <b>{Math.round(leader.score)}</b>
            </div>
          ))}
        </div>
      </section>
      <ProjectDrawer
        projectId={drawerProjectId}
        initialTab={drawerTab}
        onClose={() => setDrawerProjectId(null)}
        onTabChange={setDrawerTab}
      />
    </div>
  )
}


function ProjectDrawer({
  projectId,
  initialTab,
  onClose,
  onTabChange,
}: {
  projectId: string | null
  initialTab: string
  onClose: () => void
  onTabChange: (tab: string) => void
}) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState(initialTab)
  const [runInput, setRunInput] = useState('{}')
  const [author, setAuthor] = useState('')
  const [authorDept, setAuthorDept] = useState('')
  const [content, setContent] = useState('')

  const detailQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => (await api.get<ProjectDetail>(`/projects/${projectId}`)).data,
    enabled: Boolean(projectId),
  })
  const performanceQuery = useQuery({
    queryKey: ['performance', projectId],
    queryFn: async () => (await api.get<PerformanceProfile>(`/projects/${projectId}/performance`)).data,
    enabled: Boolean(projectId),
  })
  const qaQuery = useQuery({
    queryKey: ['qa', projectId],
    queryFn: async () => (await api.get<QaPost[]>(`/projects/${projectId}/qa`)).data,
    enabled: Boolean(projectId),
  })

  useEffect(() => {
    if (projectId) {
      setActiveTab(initialTab)
      setRunInput(JSON.stringify(samplePayload(projectId), null, 2))
    }
  }, [projectId, initialTab])

  useEffect(() => {
    onTabChange(activeTab)
  }, [activeTab, onTabChange])

  useEffect(() => {
    if (!projectId) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [projectId, onClose])

  const runMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => (await api.post(`/projects/${projectId}/run`, { payload })).data,
  })
  const qaMutation = useMutation({
    mutationFn: async () => (await api.post(`/projects/${projectId}/qa`, { author, author_dept: authorDept, content })).data,
    onSuccess: async () => {
      setAuthor('')
      setAuthorDept('')
      setContent('')
      await queryClient.invalidateQueries({ queryKey: ['qa', projectId] })
    },
  })

  const tabs = [
    ['overview', '개요 정보'],
    ['schema', '스키마 정보'],
    ['run', '실행'],
    ['performance', '성능 분석'],
    ['downloads', '다운로드'],
    ['governance', 'Governance'],
    ['diffusion', '확산'],
    ['qa', 'Q&A'],
  ] as const

  const project = detailQuery.data
  const performance = performanceQuery.data
  const qaPosts = qaQuery.data ?? []

  return (
    <>
      <div className={projectId ? 'drawer-backdrop open' : 'drawer-backdrop'} onClick={onClose} />
      <aside className={projectId ? 'detail-drawer open' : 'detail-drawer'} aria-hidden={projectId ? 'false' : 'true'}>
        {project ? (
          <>
            <div className="drawer-head">
              <button className="drawer-close" onClick={onClose} aria-label="닫기">X</button>
              <small>{project.source} / {project.domain}</small>
              <h2>{project.title}</h2>
              <p>{project.description}</p>
              <div className="drawer-metrics">
                <div className="drawer-metric"><b>{project.score}%</b><span>품질 점수</span></div>
                <div className="drawer-metric"><b>{project.maturity}</b><span>성숙도 단계</span></div>
                <div className="drawer-metric"><b>{project.reuse}</b><span>재사용 횟수</span></div>
                <div className="drawer-metric"><b>{project.updated}</b><span>최근 업데이트</span></div>
              </div>
            </div>
            <div className="drawer-tabs">
              {tabs.map(([key, label]) => (
                <button key={key} className={activeTab === key ? 'drawer-tab active' : 'drawer-tab'} onClick={() => setActiveTab(key)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="drawer-body">
              {activeTab === 'overview' && (
                <>
                  <section className="detail-section">
                    <h3>프로젝트 개요 요약</h3>
                    <p>{project.description}</p>
                    <div className="spacer-12" />
                    <div className="cert-row">{projectCerts(project).map((cert) => <span key={cert.label} className={`cert-badge ${cert.cls}`}>{cert.label}</span>)}</div>
                    <div className="spacer-12" />
                    <div className="meta-row">{[project.source, project.domain, project.task, project.data_type, project.access, ...project.tags].map((tag) => <span key={tag} className="meta-pill">{tag}</span>)}</div>
                  </section>
                  <section className="detail-section">
                    <h3>기대 효과</h3>
                    <p>{project.impact}</p>
                  </section>
                  <div className="info-grid">
                    <div className="info-tile"><b>오너 조직</b><span>{project.owner}</span></div>
                    <div className="info-tile"><b>라이선스 / 접근</b><span>{project.license} / {project.access}</span></div>
                    <div className="info-tile"><b>적용 업무 영역</b><span>{project.domain} 영역의 주요 업무 Task에 맞춰 설계된 프로젝트입니다.</span></div>
                    <div className="info-tile"><b>연동 방식</b><span>배치 작업 자동화, REST API 호출, 내부 서비스 임베딩 연동 지원</span></div>
                  </div>
                </>
              )}
              {activeTab === 'schema' && (
                <>
                  <section className="detail-section"><h3>Input Data Format</h3><SchemaTable title="Input" rows={project.inputs} /></section>
                  <section className="detail-section"><h3>Output Data Format</h3><SchemaTable title="Output" rows={project.outputs} /></section>
                </>
              )}
              {activeTab === 'run' && (
                <section className="detail-section run-box">
                  <h3>샘플 입력 실행</h3>
                  <p>아래 예시 JSON을 수정한 뒤 실행하면 현재 프로젝트의 mock 결과를 바로 확인할 수 있습니다.</p>
                  <textarea className="code-box drawer-code" value={runInput} onChange={(event) => setRunInput(event.target.value)} />
                  <div className="toolbar-row">
                    <button className="primary-btn" onClick={() => {
                      try {
                        runMutation.mutate(JSON.parse(runInput))
                      } catch {
                        alert('JSON 형식을 확인해 주세요.')
                      }
                    }}>실행하여 결과 확인</button>
                    <button className="ghost-btn">API Spec 보기</button>
                  </div>
                  {runMutation.data && <pre className="result-box">{JSON.stringify(runMutation.data.result, null, 2)}</pre>}
                </section>
              )}
              {activeTab === 'performance' && performance && (
                <>
                  <section className="detail-section performance-hero-card">
                    <div>
                      <div className="eyebrow">PERFORMANCE METRICS</div>
                      <h3>{performance.title}</h3>
                      <p>{performance.summary}</p>
                    </div>
                    <div className="perf-grade">{performance.grade}</div>
                  </section>
                  <div className="metric-grid drawer-metric-grid">
                    {performance.metrics.map((metric) => (
                      <article key={metric.label} className="metric-card">
                        <span>{metric.label}</span>
                        <strong>{metric.value}</strong>
                        <div className="bar-track"><i style={{ width: `${metric.bar}%` }} /></div>
                        <p>{metric.note}</p>
                      </article>
                    ))}
                  </div>
                  <section className="detail-section">
                    <h3>{performance.bar_title}</h3>
                    <div className="bar-summary">{performance.bars.map((item) => <div key={item[0]} className="dist-row"><b>{item[0]}</b><div className="dist-track"><i style={{ width: `${item[1]}%` }} /></div><strong>{item[2]}</strong></div>)}</div>
                  </section>
                  <section className="detail-section">
                    <h3>{performance.table_title}</h3>
                    <div className="table-wrap"><table><thead><tr>{performance.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{performance.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={`${index}-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody></table></div>
                  </section>
                  <section className="detail-section">
                    <h3>운영 모니터링 항목</h3>
                    <div className="governance-list one-col">{performance.monitoring.map((item) => <div key={item} className="governance-item">{item}</div>)}</div>
                  </section>
                </>
              )}
              {activeTab === 'downloads' && (
                <>
                  <section className="detail-section">
                    <h3>배포 패키지 다운로드</h3>
                    <p>프로젝트 실행에 필요한 샘플 파일과 패키지를 내려받아 빠르게 검증할 수 있습니다.</p>
                  </section>
                  <div className="list-stack">
                    {project.files.map((file) => (
                      <div key={file.filename} className="list-row download-row">
                        <div><strong>{file.filename}</strong><p>{file.filesize}</p></div>
                        <button className="ghost-btn slim">다운로드</button>
                      </div>
                    ))}
                  </div>
                  <section className="detail-section">
                    <h3>Package Quickstart</h3>
                    <div className="table-wrap"><table><tbody>
                      <tr><td>Smoke Test</td><td>python -m ai_asset.run --sample tests/input_example.json</td></tr>
                      <tr><td>Evaluation</td><td>python -m ai_asset.evaluate --config eval/metric_config.yaml</td></tr>
                      <tr><td>API</td><td>POST /ai-portal/assets/{project.id}/predict</td></tr>
                    </tbody></table></div>
                  </section>
                </>
              )}
              {activeTab === 'governance' && (
                <>
                  <section className="detail-section">
                    <h3>Governance Gate</h3>
                    <div className="governance-list one-col">{project.governance.map((item) => <div key={item} className="governance-item">{item}</div>)}</div>
                  </section>
                  <div className="info-grid">
                    <div className="info-tile"><b>Model Card</b><span>목적, 주요 성능 지표, 제약 사항, 위험, 운영 체크 포인트를 함께 관리합니다.</span></div>
                    <div className="info-tile"><b>Dataset Card</b><span>데이터 출처, 수집 범위, 전처리 이력, 접근 및 보관 정책을 함께 기록합니다.</span></div>
                    <div className="info-tile"><b>Evaluation Dataset</b><span>검증 기준, test split 정의, metric config, 승인 threshold를 명시해 둡니다.</span></div>
                    <div className="info-tile"><b>Lineage</b><span>학습 버전, 코드 commit, 데이터 digest, 산출 artifact, 배포 변경 이력을 추적합니다.</span></div>
                  </div>
                </>
              )}
              {activeTab === 'diffusion' && (
                <>
                  <section className="detail-section"><h3>확산 및 전파 계획</h3><p>유사한 현업 과제에 빠르게 적용할 수 있도록 재사용 포인트, 운영 가이드, 협업 채널을 함께 제공합니다.</p></section>
                  <div className="info-grid">
                    <div className="info-tile"><b>추천 대상</b><span>유사 공정 개선 PoC를 준비하는 조직에서 바로 참고할 수 있습니다.</span></div>
                    <div className="info-tile"><b>확산 준비 상태</b><span>재사용 가능한 구성 요소와 운영 문서를 기준으로 빠른 전개가 가능합니다.</span></div>
                    <div className="info-tile"><b>지원 채널</b><span>프로젝트별 Q&A, AI 커뮤니티 세션, Teams 문의 채널을 통해 지원합니다.</span></div>
                    <div className="info-tile"><b>예상 파급</b><span>현재 {project.reuse + 18}개 팀, 월 평균 {project.reuse * 3}건 활용, 잠재 수혜 사용자 {Math.round(project.reuse / 2)}백 명 수준으로 추정됩니다.</span></div>
                  </div>
                </>
              )}
              {activeTab === 'qa' && (
                <section className="detail-section">
                  <h3>Q&A 및 운영 문의</h3>
                  <p>프로젝트 활용 중 궁금한 점이나 요청 사항, 운영 관련 문의를 남길 수 있습니다.</p>
                  <div className="qa-form drawer-qa-form">
                    <input className="search-input" placeholder="작성자" value={author} onChange={(event) => setAuthor(event.target.value)} />
                    <input className="search-input" placeholder="부서" value={authorDept} onChange={(event) => setAuthorDept(event.target.value)} />
                    <textarea className="prompt-box small" placeholder="질문 내용을 입력하세요." value={content} onChange={(event) => setContent(event.target.value)} />
                    <button className="primary-btn" onClick={() => qaMutation.mutate()} disabled={!author || !authorDept || !content}>질문 등록</button>
                  </div>
                  <div className="qa-list drawer-qa-list">
                    {qaPosts.map((post) => (
                      <article key={post.id} className="qa-card">
                        <strong>{post.author} / {post.author_dept}</strong>
                        <p>{post.content}</p>
                        <span>{post.created_at}</span>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </>
        ) : (
          <div className="drawer-loading">불러오는 중...</div>
        )}
      </aside>
    </>
  )
}

function ProjectDetailPage() {
  const { projectId = '' } = useParams()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [runInput, setRunInput] = useState('{}')
  const [author, setAuthor] = useState('')
  const [authorDept, setAuthorDept] = useState('')
  const [content, setContent] = useState('')

  const detailQuery = useQuery({ queryKey: ['project', projectId], queryFn: async () => (await api.get<ProjectDetail>(`/projects/${projectId}`)).data, enabled: Boolean(projectId) })
  const performanceQuery = useQuery({ queryKey: ['performance', projectId], queryFn: async () => (await api.get<PerformanceProfile>(`/projects/${projectId}/performance`)).data, enabled: Boolean(projectId) })
  const qaQuery = useQuery({ queryKey: ['qa', projectId], queryFn: async () => (await api.get<QaPost[]>(`/projects/${projectId}/qa`)).data, enabled: Boolean(projectId) })

  useEffect(() => {
    setRunInput(JSON.stringify(samplePayload(projectId), null, 2))
  }, [projectId])

  const runMutation = useMutation({ mutationFn: async (payload: Record<string, unknown>) => (await api.post(`/projects/${projectId}/run`, { payload })).data })
  const qaMutation = useMutation({
    mutationFn: async () => (await api.post(`/projects/${projectId}/qa`, { author, author_dept: authorDept, content })).data,
    onSuccess: async () => {
      setAuthor('')
      setAuthorDept('')
      setContent('')
      await queryClient.invalidateQueries({ queryKey: ['qa', projectId] })
    },
  })

  if (detailQuery.isLoading || performanceQuery.isLoading) return <LoadingCard />
  if (!detailQuery.data || !performanceQuery.data) return <EmptyCard title="프로젝트를 찾을 수 없습니다." />

  const project = detailQuery.data
  const performance = performanceQuery.data

  return (
    <div className="page-stack">
      <section className="hero-card compact-hero">
        <div>
          <button className="back-link" onClick={() => navigate(-1)}>← 돌아가기</button>
          <p className="eyebrow">{project.source}</p>
          <h2>{project.title}</h2>
          <p className="hero-copy">{project.description}</p>
          <div className="tag-row">
            <span className="meta-pill accent">{project.domain}</span>
            <span className="meta-pill">{project.task}</span>
            <span className="meta-pill">{project.data_type}</span>
            <span className="meta-pill ok">{project.maturity}</span>
          </div>
        </div>
        <div className="hero-grid narrow">
          <article className="mini-panel"><strong>{project.score}%</strong><span>추천도</span></article>
          <article className="mini-panel"><strong>{project.reuse}</strong><span>재사용</span></article>
          <article className="mini-panel"><strong>{performance.grade}</strong><span>성능 등급</span></article>
          <article className="mini-panel"><strong>{project.updated}</strong><span>업데이트</span></article>
        </div>
      </section>

      <section className="split-grid detail-grid">
        <div className="section-card">
          <SectionHead title="입출력 스키마" description="목업 데이터로 DB 시딩된 스키마 정보" />
          <div className="schema-columns">
            <SchemaTable title="Input" rows={project.inputs} />
            <SchemaTable title="Output" rows={project.outputs} />
          </div>
        </div>
        <div className="section-card">
          <SectionHead title="프로젝트 산출물" description={project.impact} />
          <div className="file-list">
            {project.files.map((file) => (
              <div key={file.filename} className="list-row">
                <div>
                  <strong>{file.filename}</strong>
                  <p>{file.filesize}</p>
                </div>
                <button className="ghost-btn slim">Mock 다운로드</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="split-grid detail-grid">
        <div className="section-card">
          <SectionHead title="성능 프로필" description={performance.summary} />
          <div className="metric-grid">
            {performance.metrics.map((metric) => (
              <article key={metric.label} className="metric-card">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <div className="bar-track"><i style={{ width: `${metric.bar}%` }} /></div>
                <p>{metric.note}</p>
              </article>
            ))}
          </div>
          <div className="bar-summary">
            <strong>{performance.bar_title}</strong>
            {performance.bars.map((item) => (
              <div key={item[0]} className="dist-row">
                <b>{item[0]}</b>
                <div className="dist-track"><i style={{ width: `${item[1]}%` }} /></div>
                <strong>{item[2]}</strong>
              </div>
            ))}
          </div>
          <div className="notes-grid">
            {performance.notes.map((item) => (
              <article key={item[0]} className="note-card">
                <strong>{item[0]}</strong>
                <p>{item[1]}</p>
              </article>
            ))}
          </div>
        </div>
        <div className="section-card">
          <SectionHead title="실행 샌드박스" description="Mock inference API와 연결되어 있습니다." />
          <textarea className="code-box" value={runInput} onChange={(event) => setRunInput(event.target.value)} />
          <div className="toolbar-row">
            <button
              className="primary-btn"
              onClick={() => {
                try {
                  runMutation.mutate(JSON.parse(runInput))
                } catch {
                  alert('JSON 형식을 확인해 주세요.')
                }
              }}
            >
              실행하여 결과 확인
            </button>
            <button className="ghost-btn" onClick={() => navigate('/placeholders/case-register')}>적용 사례 등록</button>
          </div>
          {runMutation.data && <pre className="result-box">{JSON.stringify(runMutation.data.result, null, 2)}</pre>}
        </div>
      </section>

      <section className="split-grid detail-grid">
        <div className="section-card">
          <SectionHead title="Governance Gate" description="등록 시 제출된 거버넌스 체크리스트" />
          <div className="governance-list">
            {project.governance.map((item) => <div key={item} className="governance-item">{item}</div>)}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>{performance.headers.map((header) => <th key={header}>{header}</th>)}</tr>
              </thead>
              <tbody>
                {performance.rows.map((row, index) => (
                  <tr key={index}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="section-card">
          <SectionHead title="Q&A" description="프로젝트 단위 질의응답" />
          <div className="qa-list">
            {(qaQuery.data ?? []).map((post) => (
              <article key={post.id} className="qa-card">
                <strong>{post.author} · {post.author_dept}</strong>
                <p>{post.content}</p>
                <span>{post.created_at}</span>
              </article>
            ))}
          </div>
          <div className="qa-form">
            <input className="search-input" placeholder="작성자" value={author} onChange={(event) => setAuthor(event.target.value)} />
            <input className="search-input" placeholder="부서" value={authorDept} onChange={(event) => setAuthorDept(event.target.value)} />
            <textarea className="prompt-box small" placeholder="질문 내용을 입력하세요." value={content} onChange={(event) => setContent(event.target.value)} />
            <button className="primary-btn" onClick={() => qaMutation.mutate()} disabled={!author || !authorDept || !content}>질문 등록</button>
          </div>
        </div>
      </section>
    </div>
  )
}

function AdminPage() {
  const queryClient = useQueryClient()
  const [sourceName, setSourceName] = useState('')
  const [templateName, setTemplateName] = useState('')
  const settingsQuery = useQuery({ queryKey: ['admin-settings'], queryFn: async () => (await api.get<AdminSettings>('/admin/settings')).data })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
  const toggleMutation = useMutation({ mutationFn: async (registry_enabled: boolean) => (await api.post('/admin/registry-toggle', { registry_enabled })).data, onSuccess: refresh })
  const addSourceMutation = useMutation({ mutationFn: async () => (await api.post('/admin/source-options', { name: sourceName })).data, onSuccess: () => { setSourceName(''); refresh() } })
  const addTemplateMutation = useMutation({ mutationFn: async () => (await api.post('/admin/template-options', { name: templateName })).data, onSuccess: () => { setTemplateName(''); refresh() } })
  const deleteSourceMutation = useMutation({ mutationFn: async (id: number) => (await api.delete(`/admin/source-options/${id}`)).data, onSuccess: refresh })
  const deleteTemplateMutation = useMutation({ mutationFn: async (id: number) => (await api.delete(`/admin/template-options/${id}`)).data, onSuccess: refresh })

  if (settingsQuery.isLoading) return <LoadingCard />
  if (!settingsQuery.data) return <EmptyCard title="관리자 설정을 불러오지 못했습니다." />

  const settings = settingsQuery.data

  return (
    <div className="page-stack">
      <section className="hero-card compact-hero">
        <div>
          <p className="eyebrow">ADMIN</p>
          <h2>AI 자산 등록 설정</h2>
          <p className="hero-copy">목업의 토글, 출처 관리, 템플릿 관리 영역을 실제 API와 연결했습니다.</p>
        </div>
        <button className={settings.registry_enabled ? 'toggle-btn active' : 'toggle-btn'} onClick={() => toggleMutation.mutate(!settings.registry_enabled)}>
          {settings.registry_enabled ? '등록 기능 ON' : '등록 기능 OFF'}
        </button>
      </section>

      <section className="split-grid">
        <div className="section-card">
          <SectionHead title="출처 옵션" description="등록 화면 드롭다운과 공유되는 옵션" />
          <div className="form-inline">
            <input className="search-input" value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="예: AI 챌린지" />
            <button className="primary-btn" onClick={() => addSourceMutation.mutate()} disabled={!sourceName.trim()}>추가</button>
          </div>
          <div className="list-stack">
            {settings.source_options.map((item) => (
              <div key={item.id} className="list-row">
                <div><strong>{item.name}</strong></div>
                <button className="ghost-btn slim" onClick={() => deleteSourceMutation.mutate(item.id)}>삭제</button>
              </div>
            ))}
          </div>
        </div>
        <div className="section-card">
          <SectionHead title="실행 템플릿" description="자동 체크 추천 대상 템플릿" />
          <div className="form-inline">
            <input className="search-input" value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="예: Custom Simulator Adapter" />
            <button className="primary-btn" onClick={() => addTemplateMutation.mutate()} disabled={!templateName.trim()}>추가</button>
          </div>
          <div className="list-stack">
            {settings.template_options.map((item) => (
              <div key={item.id} className="list-row">
                <div><strong>{item.name}</strong></div>
                <button className="ghost-btn slim" onClick={() => deleteTemplateMutation.mutate(item.id)}>삭제</button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function RegistryPage() {
  const settingsQuery = useQuery({ queryKey: ['admin-settings'], queryFn: async () => (await api.get<AdminSettings>('/admin/settings')).data })
  const [form, setForm] = useState({
    asset_name: '',
    source: '',
    owner_org: '',
    contact: '',
    access: '사내공유',
    maturity: 'PoC',
    repo_url: '',
    branch: 'main',
    asset_path: '/ai_asset',
    description: '',
    tags: '',
    git_provider: 'GitHub',
  })
  const [autoCheck, setAutoCheck] = useState<AutoCheck | null>(null)

  useEffect(() => {
    if (settingsQuery.data && !form.source) {
      setForm((current) => ({ ...current, source: settingsQuery.data?.source_options[0]?.name ?? '' }))
    }
  }, [settingsQuery.data, form.source])

  const autoCheckMutation = useMutation({
    mutationFn: async () => (await api.post<AutoCheck>('/registry/auto-check', { asset_name: form.asset_name, repo_url: form.repo_url, git_provider: form.git_provider })).data,
    onSuccess: (data) => {
      setAutoCheck(data)
      setForm((current) => ({ ...current, description: data.description, tags: data.tags.join(', ') }))
    },
  })
  const submitMutation = useMutation({ mutationFn: async () => (await api.post('/asset-submissions', form)).data })

  if (settingsQuery.isLoading) return <LoadingCard />
  if (!settingsQuery.data) return <EmptyCard title="등록 설정을 불러오지 못했습니다." />
  if (!settingsQuery.data.registry_enabled) return <EmptyCard title="현재 신규 AI 자산 등록 기능이 비활성화되어 있습니다." />

  return (
    <div className="page-stack">
      <section className="hero-card compact-hero">
        <div>
          <p className="eyebrow">REGISTRY</p>
          <h2>신규 AI 자산 등록</h2>
          <p className="hero-copy">목업의 LLM 자동 체크 흐름과 등록 요청 폼을 실제 API와 연결했습니다.</p>
        </div>
        <div className="tab-row">
          {['GitHub', 'GitLab', 'Package'].map((provider) => (
            <button key={provider} className={form.git_provider === provider ? 'tab-btn active' : 'tab-btn'} onClick={() => setForm({ ...form, git_provider: provider })}>{provider}</button>
          ))}
        </div>
      </section>

      <section className="split-grid">
        <div className="section-card">
          <SectionHead title="기본 정보" description="실제 제출은 SQLite에 저장됩니다." />
          <div className="form-grid">
            <input className="search-input" placeholder="자산명" value={form.asset_name} onChange={(event) => setForm({ ...form, asset_name: event.target.value })} />
            <select className="search-input" value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })}>
              {settingsQuery.data.source_options.map((item) => <option key={item.id}>{item.name}</option>)}
            </select>
            <input className="search-input" placeholder="오너 조직" value={form.owner_org} onChange={(event) => setForm({ ...form, owner_org: event.target.value })} />
            <input className="search-input" placeholder="담당자 연락처" value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} />
            <input className="search-input" placeholder="Repository URL" value={form.repo_url} onChange={(event) => setForm({ ...form, repo_url: event.target.value })} />
            <input className="search-input" placeholder="Branch" value={form.branch} onChange={(event) => setForm({ ...form, branch: event.target.value })} />
            <input className="search-input" placeholder="Asset Path" value={form.asset_path} onChange={(event) => setForm({ ...form, asset_path: event.target.value })} />
            <select className="search-input" value={form.maturity} onChange={(event) => setForm({ ...form, maturity: event.target.value })}>
              {['PoC', '검증완료', '운영전환', '운영'].map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <textarea className="prompt-box" placeholder="설명" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          <input className="search-input" placeholder="태그" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} />
          <div className="toolbar-row">
            <button className="primary-btn" onClick={() => autoCheckMutation.mutate()}>LLM 자동 체크 실행</button>
            <button className="ghost-btn" onClick={() => submitMutation.mutate()} disabled={!form.asset_name || !form.source || !form.owner_org || !form.contact}>자산 등록 제출</button>
          </div>
          {submitMutation.data && <div className="match-banner">{submitMutation.data.message}</div>}
        </div>
        <div className="section-card">
          <SectionHead title="자동 체크 결과" description="정의되지 않은 후속 워크플로는 목업 형태만 유지했습니다." />
          {autoCheck ? (
            <>
              <div className="kpi-grid two">
                <article className="kpi-card"><span>Task</span><strong>{autoCheck.task}</strong></article>
                <article className="kpi-card"><span>Data Type</span><strong>{autoCheck.data_type}</strong></article>
                <article className="kpi-card"><span>Template</span><strong>{autoCheck.template}</strong></article>
                <article className="kpi-card"><span>Metric</span><strong>{autoCheck.metric_preset}</strong></article>
              </div>
              <div className="list-stack">
                {autoCheck.checks.map((item) => (
                  <article key={item.label} className="note-card">
                    <strong>{item.label}</strong>
                    <p>{item.title}</p>
                    <span>{item.description}</span>
                  </article>
                ))}
              </div>
              <pre className="result-box small">{JSON.stringify(autoCheck, null, 2)}</pre>
            </>
          ) : (
            <EmptyCard title="자동 체크 실행 전입니다." compact />
          )}
        </div>
      </section>
    </div>
  )
}

function PlaceholderPage() {
  const { slug = '' } = useParams()
  const query = useQuery({ queryKey: ['placeholder', slug], queryFn: async () => (await api.get<PlaceholderData>(`/placeholders/${slug}`)).data, enabled: Boolean(slug) })

  if (query.isLoading) return <LoadingCard />
  if (!query.data) return <EmptyCard title="플레이스홀더를 찾을 수 없습니다." />

  return (
    <div className="page-stack">
      <section className="hero-card compact-hero">
        <div>
          <p className="eyebrow">PLACEHOLDER</p>
          <h2>{query.data.title}</h2>
          <p className="hero-copy">{query.data.description}</p>
        </div>
        <div className="status-chip">{query.data.status}</div>
      </section>
      <section className="section-card">
        <p className="placeholder-copy">{query.data.body}</p>
        {query.data.cta_label && <button className="primary-btn">{query.data.cta_label}</button>}
      </section>
    </div>
  )
}

function SchemaTable({ title, rows }: { title: string; rows: ProjectField[] }) {
  return (
    <div className="table-wrap">
      <strong className="table-title">{title}</strong>
      <table>
        <thead>
          <tr>
            <th>필드</th>
            <th>타입</th>
            <th>설명</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.field_name}>
              <td>{row.field_name}</td>
              <td>{row.field_type}</td>
              <td>{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SectionHead({ title, description }: { title: string; description: string }) {
  return (
    <div className="section-head">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  )
}

function DistributionRow({ label, count }: { label: string; count: number }) {
  return (
    <div className="dist-row">
      <b>{label}</b>
      <div className="dist-track"><i style={{ width: `${Math.max(count * 18, 12)}%` }} /></div>
      <strong>{count}</strong>
    </div>
  )
}

function LoadingCard() {
  return <div className="section-card">불러오는 중...</div>
}

function EmptyCard({ title, compact = false }: { title: string; compact?: boolean }) {
  return <div className={compact ? 'empty-card compact' : 'empty-card'}>{title}</div>
}

export default App





