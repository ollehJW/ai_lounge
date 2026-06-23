from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    source = Column(String, nullable=False)
    domain = Column(String, nullable=False)
    task = Column(String, nullable=False)
    data_type = Column(String, nullable=False, index=True)
    maturity = Column(String, nullable=False)
    access = Column(String, nullable=False)
    score = Column(Float, nullable=False, default=0)
    reuse = Column(Integer, nullable=False, default=0)
    updated = Column(String, nullable=False)
    owner = Column(String, nullable=False)
    license = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    impact = Column(Text, nullable=False)

    tags = relationship("ProjectTag", back_populates="project", cascade="all, delete-orphan")
    inputs = relationship(
        "ProjectInput",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="ProjectInput.order_index",
    )
    outputs = relationship(
        "ProjectOutput",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="ProjectOutput.order_index",
    )
    files = relationship(
        "ProjectFile",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="ProjectFile.order_index",
    )
    governance = relationship(
        "ProjectGovernance",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="ProjectGovernance.order_index",
    )
    performance = relationship(
        "ProjectPerformance",
        back_populates="project",
        uselist=False,
        cascade="all, delete-orphan",
    )
    qa_posts = relationship("QaPost", back_populates="project", cascade="all, delete-orphan")


class ProjectTag(Base):
    __tablename__ = "project_tags"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    tag = Column(String, nullable=False)

    project = relationship("Project", back_populates="tags")


class ProjectInput(Base):
    __tablename__ = "project_inputs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    field_name = Column(String, nullable=False)
    field_type = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    order_index = Column(Integer, nullable=False, default=0)

    project = relationship("Project", back_populates="inputs")


class ProjectOutput(Base):
    __tablename__ = "project_outputs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    field_name = Column(String, nullable=False)
    field_type = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    order_index = Column(Integer, nullable=False, default=0)

    project = relationship("Project", back_populates="outputs")


class ProjectFile(Base):
    __tablename__ = "project_files"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    filename = Column(String, nullable=False)
    filesize = Column(String, nullable=False)
    order_index = Column(Integer, nullable=False, default=0)

    project = relationship("Project", back_populates="files")


class ProjectGovernance(Base):
    __tablename__ = "project_governance"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    item = Column(Text, nullable=False)
    order_index = Column(Integer, nullable=False, default=0)

    project = relationship("Project", back_populates="governance")


class ProjectPerformance(Base):
    __tablename__ = "project_performance"

    project_id = Column(String, ForeignKey("projects.id"), primary_key=True)
    grade = Column(String, nullable=False)
    title = Column(String, nullable=False)
    summary = Column(Text, nullable=False)
    metrics_json = Column(Text, nullable=False)
    bar_title = Column(String, nullable=False)
    bars_json = Column(Text, nullable=False)
    notes_json = Column(Text, nullable=False)
    table_title = Column(String, nullable=False)
    headers_json = Column(Text, nullable=False)
    rows_json = Column(Text, nullable=False)
    monitoring_json = Column(Text, nullable=False)

    project = relationship("Project", back_populates="performance")


class AdminSetting(Base):
    __tablename__ = "admin_settings"

    key = Column(String, primary_key=True)
    value = Column(Text, nullable=False)


class SourceOption(Base):
    __tablename__ = "source_options"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True)
    order_index = Column(Integer, nullable=False, default=0)


class TemplateOption(Base):
    __tablename__ = "template_options"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True)
    order_index = Column(Integer, nullable=False, default=0)


class ImpactMonthly(Base):
    __tablename__ = "impact_monthly"

    id = Column(Integer, primary_key=True, autoincrement=True)
    month = Column(String, nullable=False)
    registered = Column(Integer, nullable=False, default=0)
    adopted = Column(Integer, nullable=False, default=0)


class Bookmark(Base):
    __tablename__ = "bookmarks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False, default="default")
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "project_id"),)


class QaPost(Base):
    __tablename__ = "qa_posts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    author = Column(String, nullable=False)
    author_dept = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    parent_id = Column(Integer, ForeignKey("qa_posts.id"), nullable=True)
    created_at = Column(String, nullable=False)

    project = relationship("Project", back_populates="qa_posts")


class AssetSubmission(Base):
    __tablename__ = "asset_submissions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    asset_name = Column(String, nullable=False)
    source = Column(String, nullable=False)
    owner_org = Column(String, nullable=False)
    contact = Column(String, nullable=False)
    access = Column(String, nullable=False)
    maturity = Column(String, nullable=False)
    repo_url = Column(String, nullable=True)
    branch = Column(String, nullable=True)
    asset_path = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    tags = Column(Text, nullable=True)
    git_provider = Column(String, nullable=False, default="GitHub")
    auto_check_summary = Column(Text, nullable=True)
    created_at = Column(String, nullable=False)


class PagePlaceholder(Base):
    __tablename__ = "page_placeholders"

    slug = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String, nullable=False, default="준비 중")
    body = Column(Text, nullable=False)
    cta_label = Column(String, nullable=True)
