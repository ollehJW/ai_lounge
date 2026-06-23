from typing import Any, List, Optional

from pydantic import BaseModel, Field


class ProjectInputSchema(BaseModel):
    field_name: str
    field_type: str
    description: str

    class Config:
        from_attributes = True


class ProjectOutputSchema(BaseModel):
    field_name: str
    field_type: str
    description: str

    class Config:
        from_attributes = True


class ProjectFileSchema(BaseModel):
    filename: str
    filesize: str

    class Config:
        from_attributes = True


class ProjectListItem(BaseModel):
    id: str
    title: str
    source: str
    domain: str
    task: str
    data_type: str = Field(alias="data_type")
    maturity: str
    access: str
    score: float
    reuse: int
    updated: str
    owner: str
    license: str
    description: str
    impact: str
    tags: List[str]

    class Config:
        from_attributes = True
        populate_by_name = True


class ProjectDetail(BaseModel):
    id: str
    title: str
    source: str
    domain: str
    task: str
    data_type: str = Field(alias="data_type")
    maturity: str
    access: str
    score: float
    reuse: int
    updated: str
    owner: str
    license: str
    description: str
    impact: str
    tags: List[str]
    inputs: List[ProjectInputSchema]
    outputs: List[ProjectOutputSchema]
    files: List[ProjectFileSchema]
    governance: List[str]

    class Config:
        from_attributes = True
        populate_by_name = True


class PerformanceMetric(BaseModel):
    label: str
    value: str
    bar: float
    note: str


class PerformanceProfile(BaseModel):
    project_id: str
    grade: str
    title: str
    summary: str
    metrics: List[PerformanceMetric]
    bar_title: str
    bars: List[List[Any]]
    notes: List[List[str]]
    table_title: str
    headers: List[str]
    rows: List[List[str]]
    monitoring: List[str]


class FilterGroup(BaseModel):
    key: str
    title: str
    options: List[str]


class ImpactKpi(BaseModel):
    label: str
    value: str
    desc: str


class MonthlyData(BaseModel):
    month: str
    registered: int
    adopted: int


class DistributionRow(BaseModel):
    label: str
    count: int


class TopAsset(BaseModel):
    id: str
    title: str
    source: str
    maturity: str
    reuse: int


class ImpactDashboardResponse(BaseModel):
    kpis: List[ImpactKpi]
    monthly: List[MonthlyData]
    source_distribution: List[DistributionRow]
    domain_distribution: List[DistributionRow]
    top_assets: List[TopAsset]


class LeaderEntry(BaseModel):
    owner: str
    source: str
    assets: int
    reuse: int
    operating: int
    score: float


class LeaderboardResponse(BaseModel):
    leaders: List[LeaderEntry]


class OptionItem(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class AdminSettingsResponse(BaseModel):
    registry_enabled: bool
    source_options: List[OptionItem]
    template_options: List[OptionItem]


class SourceOptionCreate(BaseModel):
    name: str


class TemplateOptionCreate(BaseModel):
    name: str


class BookmarkToggleResponse(BaseModel):
    bookmarked: bool
    project_id: str


class BookmarksResponse(BaseModel):
    project_ids: List[str]


class RunRequest(BaseModel):
    payload: dict[str, Any]


class RunResponse(BaseModel):
    project_id: str
    result: dict[str, Any]


class QaPostCreate(BaseModel):
    author: str
    author_dept: str
    content: str
    parent_id: Optional[int] = None


class QaPostResponse(BaseModel):
    id: int
    project_id: str
    author: str
    author_dept: str
    content: str
    parent_id: Optional[int]
    created_at: str

    class Config:
        from_attributes = True


class AssetSubmitRequest(BaseModel):
    asset_name: str
    source: str
    owner_org: str
    contact: str
    access: str = "사내공유"
    maturity: str = "PoC"
    repo_url: Optional[str] = None
    branch: Optional[str] = "main"
    asset_path: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[str] = None
    git_provider: str = "GitHub"


class AssetSubmitResponse(BaseModel):
    id: int
    message: str


class RegistryToggleRequest(BaseModel):
    registry_enabled: bool


class AutoCheckRequest(BaseModel):
    asset_name: Optional[str] = None
    repo_url: Optional[str] = None
    git_provider: str = "GitHub"


class AutoCheckResponse(BaseModel):
    task: str
    data_type: str
    template: str
    metric_preset: str
    renderer: str
    tags: List[str]
    description: str
    input_schema: str
    output_schema: str
    endpoint: str
    threshold: str
    governance: str
    checks: List[dict[str, str]]


class PlaceholderPageResponse(BaseModel):
    slug: str
    title: str
    description: str
    status: str
    body: str
    cta_label: Optional[str] = None
