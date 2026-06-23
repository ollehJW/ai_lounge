import json
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from database import Base, engine, get_db
from models import (
    AdminSetting,
    AssetSubmission,
    Bookmark,
    ImpactMonthly,
    PagePlaceholder,
    Project,
    ProjectFile,
    ProjectGovernance,
    ProjectInput,
    ProjectOutput,
    ProjectPerformance,
    ProjectTag,
    QaPost,
    SourceOption,
    TemplateOption,
)
from schemas import (
    AdminSettingsResponse,
    AssetSubmitRequest,
    AssetSubmitResponse,
    AutoCheckRequest,
    AutoCheckResponse,
    BookmarkToggleResponse,
    BookmarksResponse,
    FilterGroup,
    ImpactDashboardResponse,
    ImpactKpi,
    LeaderEntry,
    LeaderboardResponse,
    MonthlyData,
    PlaceholderPageResponse,
    ProjectDetail,
    ProjectFileSchema,
    ProjectInputSchema,
    ProjectListItem,
    ProjectOutputSchema,
    QaPostCreate,
    QaPostResponse,
    RegistryToggleRequest,
    RunRequest,
    RunResponse,
    PerformanceProfile,
    DistributionRow,
    TopAsset,
)
from seed_data import (
    AUTO_CHECK_RESULT,
    BOOKMARKS,
    FILTER_GROUPS,
    IMPACT_BASELINE,
    IMPACT_MONTHLY,
    PERFORMANCE_PROFILES,
    PLACEHOLDER_PAGES,
    PROJECTS,
    QA_POSTS,
    SOURCE_OPTIONS,
    TEMPLATE_OPTIONS,
)


def project_payload(project: Project) -> dict:
    return {
        "id": project.id,
        "title": project.title,
        "source": project.source,
        "domain": project.domain,
        "task": project.task,
        "data_type": project.data_type,
        "maturity": project.maturity,
        "access": project.access,
        "score": project.score,
        "reuse": project.reuse,
        "updated": project.updated,
        "owner": project.owner,
        "license": project.license,
        "description": project.description,
        "impact": project.impact,
        "tags": [tag.tag for tag in project.tags],
    }


def project_detail_payload(project: Project) -> dict:
    return {
        **project_payload(project),
        "inputs": [
            ProjectInputSchema(field_name=item.field_name, field_type=item.field_type, description=item.description)
            for item in project.inputs
        ],
        "outputs": [
            ProjectOutputSchema(field_name=item.field_name, field_type=item.field_type, description=item.description)
            for item in project.outputs
        ],
        "files": [ProjectFileSchema(filename=item.filename, filesize=item.filesize) for item in project.files],
        "governance": [item.item for item in project.governance],
    }


def parse_performance(perf: ProjectPerformance) -> PerformanceProfile:
    return PerformanceProfile(
        project_id=perf.project_id,
        grade=perf.grade,
        title=perf.title,
        summary=perf.summary,
        metrics=json.loads(perf.metrics_json),
        bar_title=perf.bar_title,
        bars=json.loads(perf.bars_json),
        notes=json.loads(perf.notes_json),
        table_title=perf.table_title,
        headers=json.loads(perf.headers_json),
        rows=json.loads(perf.rows_json),
        monitoring=json.loads(perf.monitoring_json),
    )


def get_setting(db: Session, key: str, default: str) -> str:
    row = db.get(AdminSetting, key)
    return row.value if row else default


def set_setting(db: Session, key: str, value: str) -> None:
    row = db.get(AdminSetting, key)
    if row:
        row.value = value
    else:
        db.add(AdminSetting(key=key, value=value))


def seed_db() -> None:
    Base.metadata.create_all(bind=engine)
    db = Session(bind=engine)
    try:
        if db.query(Project).first():
            return

        for item in PROJECTS:
            project = Project(
                id=item["id"],
                title=item["title"],
                source=item["source"],
                domain=item["domain"],
                task=item["task"],
                data_type=item["data_type"],
                maturity=item["maturity"],
                access=item["access"],
                score=item["score"],
                reuse=item["reuse"],
                updated=item["updated"],
                owner=item["owner"],
                license=item["license"],
                description=item["description"],
                impact=item["impact"],
            )
            db.add(project)
            for tag in item["tags"]:
                db.add(ProjectTag(project_id=item["id"], tag=tag))
            for index, row in enumerate(item["inputs"]):
                db.add(ProjectInput(project_id=item["id"], field_name=row[0], field_type=row[1], description=row[2], order_index=index))
            for index, row in enumerate(item["outputs"]):
                db.add(ProjectOutput(project_id=item["id"], field_name=row[0], field_type=row[1], description=row[2], order_index=index))
            for index, row in enumerate(item["files"]):
                db.add(ProjectFile(project_id=item["id"], filename=row[0], filesize=row[1], order_index=index))
            for index, row in enumerate(item["governance"]):
                db.add(ProjectGovernance(project_id=item["id"], item=row, order_index=index))
            perf = PERFORMANCE_PROFILES[item["id"]]
            db.add(
                ProjectPerformance(
                    project_id=item["id"],
                    grade=perf["grade"],
                    title=perf["title"],
                    summary=perf["summary"],
                    metrics_json=json.dumps(perf["metrics"], ensure_ascii=False),
                    bar_title=perf["bar_title"],
                    bars_json=json.dumps(perf["bars"], ensure_ascii=False),
                    notes_json=json.dumps(perf["notes"], ensure_ascii=False),
                    table_title=perf["table_title"],
                    headers_json=json.dumps(perf["headers"], ensure_ascii=False),
                    rows_json=json.dumps(perf["rows"], ensure_ascii=False),
                    monitoring_json=json.dumps(perf["monitoring"], ensure_ascii=False),
                )
            )

        for index, name in enumerate(SOURCE_OPTIONS):
            db.add(SourceOption(name=name, order_index=index))
        for index, name in enumerate(TEMPLATE_OPTIONS):
            db.add(TemplateOption(name=name, order_index=index))
        for item in IMPACT_MONTHLY:
            db.add(ImpactMonthly(month=item["month"], registered=item["registered"], adopted=item["adopted"]))
        for project_id in BOOKMARKS:
            db.add(Bookmark(user_id="default", project_id=project_id))
        for project_id, posts in QA_POSTS.items():
            for post in posts:
                db.add(QaPost(project_id=project_id, parent_id=None, **post))
        for item in PLACEHOLDER_PAGES:
            db.add(PagePlaceholder(**item))

        set_setting(db, "registry_enabled", "true")
        set_setting(db, "registered_assets", str(IMPACT_BASELINE["registered_assets"]))
        set_setting(db, "operating_assets", str(IMPACT_BASELINE["operating_assets"]))
        set_setting(db, "verified_assets", str(IMPACT_BASELINE["verified_assets"]))
        set_setting(db, "total_reuse", str(IMPACT_BASELINE["total_reuse"]))
        set_setting(db, "expected_effect", IMPACT_BASELINE["expected_effect"])
        set_setting(db, "pending", str(IMPACT_BASELINE["pending"]))

        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_: FastAPI):
    seed_db()
    yield


app = FastAPI(title="AI Studio API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/filters", response_model=list[FilterGroup])
def get_filters():
    return [FilterGroup(**group) for group in FILTER_GROUPS]


@app.get("/api/projects", response_model=list[ProjectListItem])
def list_projects(
    q: Optional[str] = Query(default=None),
    source: Optional[str] = None,
    domain: Optional[str] = None,
    task: Optional[str] = None,
    data_type: Optional[str] = None,
    maturity: Optional[str] = None,
    access: Optional[str] = None,
    sort: str = Query(default="recommend"),
    db: Session = Depends(get_db),
):
    query = db.query(Project).options(joinedload(Project.tags))
    if source:
        query = query.filter(Project.source == source)
    if domain:
        query = query.filter(Project.domain == domain)
    if task:
        query = query.filter(Project.task == task)
    if data_type:
        query = query.filter(Project.data_type == data_type)
    if maturity:
        query = query.filter(Project.maturity == maturity)
    if access:
        query = query.filter(Project.access == access)

    projects = query.all()
    if q:
        keyword = q.lower()
        projects = [
            item
            for item in projects
            if keyword in " ".join(
                [
                    item.title,
                    item.description,
                    item.source,
                    item.domain,
                    item.task,
                    item.data_type,
                    item.maturity,
                    item.access,
                    " ".join(tag.tag for tag in item.tags),
                ]
            ).lower()
        ]

    if sort == "reuse":
        projects.sort(key=lambda item: item.reuse, reverse=True)
    elif sort == "updated":
        projects.sort(key=lambda item: item.updated, reverse=True)
    elif sort == "maturity":
        order = {"PoC": 1, "검증완료": 2, "운영전환": 3, "운영": 4}
        projects.sort(key=lambda item: (order.get(item.maturity, 0), item.score), reverse=True)
    else:
        projects.sort(key=lambda item: item.score, reverse=True)

    return [ProjectListItem(**project_payload(item)) for item in projects]


@app.get("/api/projects/{project_id}", response_model=ProjectDetail)
def get_project(project_id: str, db: Session = Depends(get_db)):
    project = (
        db.query(Project)
        .options(
            joinedload(Project.tags),
            joinedload(Project.inputs),
            joinedload(Project.outputs),
            joinedload(Project.files),
            joinedload(Project.governance),
        )
        .filter(Project.id == project_id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectDetail(**project_detail_payload(project))


@app.get("/api/projects/{project_id}/performance", response_model=PerformanceProfile)
def get_project_performance(project_id: str, db: Session = Depends(get_db)):
    perf = db.get(ProjectPerformance, project_id)
    if not perf:
        raise HTTPException(status_code=404, detail="Performance not found")
    return parse_performance(perf)


@app.post("/api/projects/{project_id}/run", response_model=RunResponse)
def run_project(project_id: str, body: RunRequest, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    payload = body.payload or {}
    result: dict = {"status": "completed", "title": project.title}
    if project_id == "assembly-defect":
        result.update(
            {
                "defect_probability": 0.86,
                "defect_type": "torque_deviation",
                "recommended_action": "체결 토크 캘리브레이션 점검",
                "root_cause_rank": ["torque", "temperature", "vision_noise"],
                "line_id": payload.get("line_id", "ASM-01"),
            }
        )
    elif project_id == "spec-rag":
        result.update(
            {
                "answer": "체결 토크 기준은 제품군과 표준 개정본 기준을 함께 확인해야 합니다.",
                "citations": ["HW-SPEC-ASM-204 p.18", "STD-FASTENING-11 p.7"],
                "confidence": 0.91,
                "question": payload.get("question", "토크 기준이 궁금합니다."),
            }
        )
    elif project_id == "parts-forecast":
        base = int(payload.get("sales_plan", 14500))
        result.update(
            {
                "forecast_qty": round(base * 1.07),
                "safety_stock": 3850,
                "risk_level": "Medium",
                "drivers": ["판매 계획 증가", "장납기 리스크", "현재 재고 부족"],
            }
        )
    elif project_id == "fault-log":
        result.update(
            {
                "fault_class": "구동계 이상",
                "cause_rank": ["베어링 마모", "윤활 부족", "센서 오프셋"],
                "inspection_priority": "High",
                "similar_cases": ["CWN-2401", "CWN-2388"],
            }
        )
    elif project_id == "quote-summary":
        result.update(
            {
                "summary": "가격 경쟁력은 높지만 납기 리스크가 있습니다.",
                "comparison_table": [{"supplier": "A사", "price": "Best", "lead_time": "Slow"}],
                "risk_flags": ["예외 조항 포함", "납기 편차 2주"],
                "recommendation": "구매전략팀 2차 검토 권장",
            }
        )
    elif project_id == "vision-segmentation":
        result.update(
            {
                "defect_label": "scratch",
                "defect_area": 12.4,
                "confidence": 0.94,
                "mask_image": "mock-overlay://vision-segmentation",
            }
        )
    elif project_id == "bi-anomaly":
        result.update(
            {
                "anomaly_score": 0.87,
                "alert_level": "High",
                "reason_hint": ["휴일 이후 급변", "적재 지연 가능성"],
                "dashboard_link": "/placeholder/dashboard-link",
            }
        )
    else:
        result.update(
            {
                "answer": "고위험 작업 전에는 표준서 최신본과 담당자 승인 여부를 함께 확인해야 합니다.",
                "safety_checklist": ["보호구 확인", "작업 허가서 확인", "비상 연락체계 확인"],
                "citations": ["EHS-STD-12 p.3"],
                "warning": "고위험 작업은 현장 관리감독자 승인 후 진행해야 합니다.",
            }
        )

    return RunResponse(project_id=project_id, result=result)


@app.get("/api/impact-dashboard", response_model=ImpactDashboardResponse)
def impact_dashboard(db: Session = Depends(get_db)):
    projects = db.query(Project).all()
    monthly_rows = db.query(ImpactMonthly).order_by(ImpactMonthly.id.asc()).all()

    kpis = [
        ImpactKpi(label="등록 AI 자산", value=f"{get_setting(db, 'registered_assets', '0')}개", desc=f"운영/전환 {get_setting(db, 'operating_assets', '0')}개 · 검증완료 {get_setting(db, 'verified_assets', '0')}개"),
        ImpactKpi(label="누적 재사용", value=f"{get_setting(db, 'total_reuse', '0')}회", desc="다운로드, 샌드박스 실행, API 호출 기반"),
        ImpactKpi(label="연간 기대 효과", value=get_setting(db, "expected_effect", "0"), desc="품질 비용, 보전 리드타임, 문서 검색 시간 절감"),
        ImpactKpi(label="심사 대기", value=f"{get_setting(db, 'pending', '0')}건", desc="신규 등록 요청 및 권한 승인 대기"),
    ]

    source_distribution = []
    for label in SOURCE_OPTIONS:
        count = sum(1 for item in projects if item.source == label)
        source_distribution.append(DistributionRow(label=label, count=count))

    domain_counts: dict[str, int] = {}
    for item in projects:
        domain_counts[item.domain] = domain_counts.get(item.domain, 0) + 1
    domain_distribution = [DistributionRow(label=key, count=value) for key, value in sorted(domain_counts.items(), key=lambda row: row[1], reverse=True)]

    top_assets = [
        TopAsset(id=item.id, title=item.title, source=item.source, maturity=item.maturity, reuse=item.reuse)
        for item in sorted(projects, key=lambda row: row.reuse, reverse=True)[:5]
    ]

    return ImpactDashboardResponse(
        kpis=kpis,
        monthly=[MonthlyData(month=item.month, registered=item.registered, adopted=item.adopted) for item in monthly_rows],
        source_distribution=source_distribution,
        domain_distribution=domain_distribution,
        top_assets=top_assets,
    )


@app.get("/api/leaderboard", response_model=LeaderboardResponse)
def leaderboard(db: Session = Depends(get_db)):
    order = {"PoC": 1, "검증완료": 2, "운영전환": 3, "운영": 4}
    rows = {}
    for project in db.query(Project).all():
        owner = project.owner.split("/")[0].strip()
        current = rows.get(owner, {"owner": owner, "source": project.source, "assets": 0, "reuse": 0, "operating": 0, "score": 0.0})
        current["assets"] += 1
        current["reuse"] += project.reuse
        current["operating"] += 1 if project.maturity in {"운영", "운영전환"} else 0
        current["score"] += project.reuse * 4 + project.score * 2 + order.get(project.maturity, 0) * 45
        rows[owner] = current
    leaders = [LeaderEntry(**item) for item in sorted(rows.values(), key=lambda row: row["score"], reverse=True)]
    return LeaderboardResponse(leaders=leaders)


@app.get("/api/admin/settings", response_model=AdminSettingsResponse)
def admin_settings(db: Session = Depends(get_db)):
    sources = db.query(SourceOption).order_by(SourceOption.order_index.asc()).all()
    templates = db.query(TemplateOption).order_by(TemplateOption.order_index.asc()).all()
    return AdminSettingsResponse(
        registry_enabled=get_setting(db, "registry_enabled", "true") == "true",
        source_options=sources,
        template_options=templates,
    )


@app.post("/api/admin/registry-toggle", response_model=AdminSettingsResponse)
def toggle_registry(body: RegistryToggleRequest, db: Session = Depends(get_db)):
    set_setting(db, "registry_enabled", "true" if body.registry_enabled else "false")
    db.commit()
    return admin_settings(db)


@app.post("/api/admin/source-options", response_model=AdminSettingsResponse)
def add_source_option(body: dict, db: Session = Depends(get_db)):
    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    exists = db.query(SourceOption).filter(func.lower(SourceOption.name) == name.lower()).first()
    if exists:
        raise HTTPException(status_code=400, detail="source option already exists")
    next_order = db.query(func.coalesce(func.max(SourceOption.order_index), -1)).scalar() + 1
    db.add(SourceOption(name=name, order_index=next_order))
    db.commit()
    return admin_settings(db)


@app.delete("/api/admin/source-options/{option_id}", response_model=AdminSettingsResponse)
def delete_source_option(option_id: int, db: Session = Depends(get_db)):
    option = db.get(SourceOption, option_id)
    if not option:
        raise HTTPException(status_code=404, detail="source option not found")
    if db.query(SourceOption).count() <= 1:
        raise HTTPException(status_code=400, detail="at least one source option is required")
    db.delete(option)
    db.commit()
    return admin_settings(db)


@app.post("/api/admin/template-options", response_model=AdminSettingsResponse)
def add_template_option(body: dict, db: Session = Depends(get_db)):
    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    exists = db.query(TemplateOption).filter(func.lower(TemplateOption.name) == name.lower()).first()
    if exists:
        raise HTTPException(status_code=400, detail="template option already exists")
    next_order = db.query(func.coalesce(func.max(TemplateOption.order_index), -1)).scalar() + 1
    db.add(TemplateOption(name=name, order_index=next_order))
    db.commit()
    return admin_settings(db)


@app.delete("/api/admin/template-options/{option_id}", response_model=AdminSettingsResponse)
def delete_template_option(option_id: int, db: Session = Depends(get_db)):
    option = db.get(TemplateOption, option_id)
    if not option:
        raise HTTPException(status_code=404, detail="template option not found")
    if db.query(TemplateOption).count() <= 1:
        raise HTTPException(status_code=400, detail="at least one template option is required")
    db.delete(option)
    db.commit()
    return admin_settings(db)


@app.get("/api/bookmarks", response_model=BookmarksResponse)
def bookmarks(user_id: str = "default", db: Session = Depends(get_db)):
    rows = db.query(Bookmark).filter(Bookmark.user_id == user_id).all()
    return BookmarksResponse(project_ids=[row.project_id for row in rows])


@app.post("/api/bookmarks/{project_id}/toggle", response_model=BookmarkToggleResponse)
def toggle_bookmark(project_id: str, user_id: str = "default", db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    bookmark = db.query(Bookmark).filter(Bookmark.user_id == user_id, Bookmark.project_id == project_id).first()
    if bookmark:
        db.delete(bookmark)
        bookmarked = False
    else:
        db.add(Bookmark(user_id=user_id, project_id=project_id))
        bookmarked = True
    db.commit()
    return BookmarkToggleResponse(bookmarked=bookmarked, project_id=project_id)


@app.get("/api/projects/{project_id}/qa", response_model=list[QaPostResponse])
def project_qa(project_id: str, db: Session = Depends(get_db)):
    rows = db.query(QaPost).filter(QaPost.project_id == project_id).order_by(QaPost.id.asc()).all()
    return [QaPostResponse.model_validate(row) for row in rows]


@app.post("/api/projects/{project_id}/qa", response_model=QaPostResponse)
def create_qa(project_id: str, body: QaPostCreate, db: Session = Depends(get_db)):
    if not db.get(Project, project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    row = QaPost(
        project_id=project_id,
        author=body.author,
        author_dept=body.author_dept,
        content=body.content,
        parent_id=body.parent_id,
        created_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return QaPostResponse.model_validate(row)


@app.post("/api/registry/auto-check", response_model=AutoCheckResponse)
def auto_check(_: AutoCheckRequest):
    return AutoCheckResponse(**AUTO_CHECK_RESULT)


@app.post("/api/asset-submissions", response_model=AssetSubmitResponse)
def submit_asset(body: AssetSubmitRequest, db: Session = Depends(get_db)):
    row = AssetSubmission(
        asset_name=body.asset_name,
        source=body.source,
        owner_org=body.owner_org,
        contact=body.contact,
        access=body.access,
        maturity=body.maturity,
        repo_url=body.repo_url,
        branch=body.branch,
        asset_path=body.asset_path,
        description=body.description,
        tags=body.tags,
        git_provider=body.git_provider,
        auto_check_summary=json.dumps(AUTO_CHECK_RESULT, ensure_ascii=False),
        created_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return AssetSubmitResponse(id=row.id, message="자산 등록 요청이 접수되었습니다.")


@app.get("/api/placeholders/{slug}", response_model=PlaceholderPageResponse)
def placeholder_page(slug: str, db: Session = Depends(get_db)):
    page = db.get(PagePlaceholder, slug)
    if not page:
        raise HTTPException(status_code=404, detail="Placeholder not found")
    return PlaceholderPageResponse(
        slug=page.slug,
        title=page.title,
        description=page.description,
        status=page.status,
        body=page.body,
        cta_label=page.cta_label,
    )
