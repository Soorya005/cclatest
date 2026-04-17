from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import json
import os
import shutil
from pydantic import BaseModel
from threading import Lock
from typing import Any, Dict, List
from dotenv import load_dotenv

import app.models

from app.dependencies.auth_dependency import get_db, get_current_user

from app.models.user import User
from app.models.repository import Repository, RepoStatus

from app.services.auth_service import (
    hash_password,
    verify_password,
    create_access_token
)

from app.services.repository_service import (
    create_repository,
    update_repository_status,
    get_repository_if_indexed
)
from app.services.chat_service import (
    save_chat,
    get_user_chats,
    get_repository_chats
)

from app.rag.rag_pipeline import RAGPipeline, RAGConfig
from app.rag.ingestion import clone_repository
from app.database.database import SessionLocal

load_dotenv()

app = FastAPI()

_pipeline_cache: Dict[str, RAGPipeline] = {}
_pipeline_cache_lock = Lock()


def _normalize_index_path(index_path: str) -> str:
    return os.path.abspath(index_path)


def get_or_create_pipeline(index_path: str) -> RAGPipeline:
    normalized_path = _normalize_index_path(index_path)

    with _pipeline_cache_lock:
        cached_pipeline = _pipeline_cache.get(normalized_path)
        if cached_pipeline:
            return cached_pipeline

    pipeline = RAGPipeline(RAGConfig())
    pipeline.load_index(normalized_path)

    with _pipeline_cache_lock:
        _pipeline_cache[normalized_path] = pipeline

    return pipeline


def invalidate_pipeline(index_path: str | None) -> None:
    if not index_path:
        return

    normalized_path = _normalize_index_path(index_path)
    with _pipeline_cache_lock:
        _pipeline_cache.pop(normalized_path, None)


def _snapshot_dir(index_path: str) -> str:
    return os.path.join(_normalize_index_path(index_path), "source_snapshot")


def _tree_cache_path(index_path: str) -> str:
    return os.path.join(_normalize_index_path(index_path), "repo_tree.json")


def _build_tree_from_filesystem(root_dir: str) -> List[Dict[str, Any]]:
    def build_node(current_path: str, rel_path: str = "") -> List[Dict[str, Any]]:
        entries = []
        with os.scandir(current_path) as iterator:
            for entry in iterator:
                if entry.name == ".git":
                    continue
                child_rel_path = f"{rel_path}/{entry.name}" if rel_path else entry.name
                if entry.is_dir(follow_symlinks=False):
                    entries.append(
                        {
                            "name": entry.name,
                            "path": child_rel_path,
                            "type": "directory",
                            "children": build_node(entry.path, child_rel_path),
                        }
                    )
                else:
                    entries.append(
                        {
                            "name": entry.name,
                            "path": child_rel_path,
                            "type": "file",
                        }
                    )

        directories = sorted(
            [entry for entry in entries if entry["type"] == "directory"],
            key=lambda entry: entry["name"].lower(),
        )
        files = sorted(
            [entry for entry in entries if entry["type"] == "file"],
            key=lambda entry: entry["name"].lower(),
        )
        return directories + files

    return build_node(root_dir)


def _save_snapshot_and_tree(source_dir: str, index_path: str) -> None:
    snapshot_dir = _snapshot_dir(index_path)
    tree_cache = _tree_cache_path(index_path)

    if os.path.exists(snapshot_dir):
        shutil.rmtree(snapshot_dir)

    # Avoid copying git metadata files that are commonly locked on Windows.
    shutil.copytree(source_dir, snapshot_dir, ignore=shutil.ignore_patterns(".git"))

    tree = _build_tree_from_filesystem(snapshot_dir)
    with open(tree_cache, "w", encoding="utf-8") as tree_file:
        json.dump(tree, tree_file)


def _ensure_snapshot_exists(repo_url: str, index_path: str) -> None:
    snapshot_dir = _snapshot_dir(index_path)
    tree_cache = _tree_cache_path(index_path)
    if os.path.exists(snapshot_dir) and os.path.exists(tree_cache):
        return

    temp_dir = clone_repository(repo_url)
    try:
        _save_snapshot_and_tree(temp_dir, index_path)
    finally:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)


def _to_repo_relative_paths(file_paths: List[str]) -> List[str]:
    normalized = [os.path.normpath(path) for path in file_paths if path]
    if not normalized:
        return []

    try:
        common_prefix = os.path.commonpath(normalized)
    except ValueError:
        common_prefix = ""

    relative_paths: List[str] = []
    for path in normalized:
        if common_prefix:
            rel_path = os.path.relpath(path, common_prefix)
        else:
            rel_path = os.path.basename(path)
        rel_path = rel_path.replace("\\", "/")
        if rel_path and rel_path != ".":
            relative_paths.append(rel_path)

    return relative_paths


def _build_tree_nodes(relative_paths: List[str]) -> List[Dict[str, Any]]:
    unique_paths = sorted(set(relative_paths))
    tree: Dict[str, Any] = {}

    for rel_path in unique_paths:
        parts = [part for part in rel_path.split("/") if part]
        if not parts:
            continue

        current = tree
        for index, part in enumerate(parts):
            is_file = index == len(parts) - 1
            if part not in current:
                current[part] = {
                    "type": "file" if is_file else "directory",
                    "children": {},
                }
            if not is_file:
                current = current[part]["children"]

    def convert(node: Dict[str, Any], prefix: str = "") -> List[Dict[str, Any]]:
        directories = []
        files = []

        for name in sorted(node.keys()):
            entry = node[name]
            entry_path = f"{prefix}/{name}" if prefix else name
            if entry["type"] == "directory":
                directories.append(
                    {
                        "name": name,
                        "path": entry_path,
                        "type": "directory",
                        "children": convert(entry["children"], entry_path),
                    }
                )
            else:
                files.append(
                    {
                        "name": name,
                        "path": entry_path,
                        "type": "file",
                    }
                )

        return directories + files

    return convert(tree)

_dev_origins = [f"http://localhost:{port}" for port in range(3000, 3011)] + [
    f"http://127.0.0.1:{port}" for port in range(3000, 3011)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_dev_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# User Registration
# -----------------------------
class RegisterRequest(BaseModel):
    username: str
    password: str

@app.post("/register")
def register(request: RegisterRequest, db: Session = Depends(get_db)):

    existing_user = db.query(User).filter(User.username == request.username).first()

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Username already exists"
        )

    hashed_pw = hash_password(request.password)

    new_user = User(
        username=request.username,
        password_hash=hashed_pw
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"message": "User registered successfully"}


# -----------------------------
# User Login
# -----------------------------
from fastapi.security import OAuth2PasswordRequestForm

@app.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):

    user = db.query(User).filter(User.username == form_data.username).first()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    access_token = create_access_token({"user_id": user.id})

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


# -----------------------------
# Add Repository
# -----------------------------
@app.post("/repository/add")
def add_repository(
    repo_url: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):

    repo = create_repository(
        db=db,
        user_id=current_user.id,
        repo_url=repo_url
    )

    return {
        "repository_id": repo.id,
        "repo_url": repo.repo_url,
        "status": repo.status,
        "sync_api_key": repo.sync_api_key
    }


# -----------------------------
# List User Repositories
# -----------------------------
@app.get("/repository/list")
def list_repositories(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):

    repos = db.query(Repository).filter(
        Repository.user_id == current_user.id
    ).all()

    return repos


# -----------------------------
# Check Repository Status
# -----------------------------
@app.get("/repository/status/{repo_id}")
def get_repository_status(
    repo_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):

    repo = db.query(Repository).filter(
        Repository.id == repo_id,
        Repository.user_id == current_user.id
    ).first()

    if not repo:
        raise HTTPException(
            status_code=404,
            detail="Repository not found"
        )

    return {
        "repo_id": repo.id,
        "status": repo.status,
        "faiss_index_path": repo.faiss_index_path
    }


@app.get("/repository/tree/{repo_id}")
def get_repository_tree(
    repo_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    repo = get_repository_if_indexed(db, repo_id, current_user.id)

    index_path = _normalize_index_path(repo.faiss_index_path)
    tree_cache = _tree_cache_path(index_path)

    _ensure_snapshot_exists(repo.repo_url, index_path)

    if os.path.exists(tree_cache):
        with open(tree_cache, "r", encoding="utf-8") as tree_file:
            tree = json.load(tree_file)
    else:
        rag_pipeline = get_or_create_pipeline(repo.faiss_index_path)
        if not rag_pipeline.vector_store:
            raise HTTPException(status_code=404, detail="Repository index not loaded")
        file_paths = [metadata.file_path for metadata in rag_pipeline.vector_store.metadata]
        relative_paths = _to_repo_relative_paths(file_paths)
        tree = _build_tree_nodes(relative_paths)

    return {
        "repo_id": repo.id,
        "tree": tree,
    }


@app.get("/repository/file-content/{repo_id}")
def get_repository_file_content(
    repo_id: int,
    file_path: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    repo = get_repository_if_indexed(db, repo_id, current_user.id)

    index_path = _normalize_index_path(repo.faiss_index_path)
    _ensure_snapshot_exists(repo.repo_url, index_path)
    snapshot_dir = _snapshot_dir(index_path)

    normalized_relative = os.path.normpath(file_path).replace("\\", "/")
    if normalized_relative.startswith(".."):
        raise HTTPException(status_code=400, detail="Invalid file path")

    absolute_path = os.path.abspath(os.path.join(snapshot_dir, normalized_relative))
    snapshot_root = os.path.abspath(snapshot_dir)
    if not absolute_path.startswith(snapshot_root + os.sep):
        raise HTTPException(status_code=400, detail="Invalid file path")

    if not os.path.exists(absolute_path) or os.path.isdir(absolute_path):
        raise HTTPException(status_code=404, detail="File not found")

    max_chars = 200_000
    try:
        with open(absolute_path, "r", encoding="utf-8") as file_handle:
            content = file_handle.read(max_chars + 1)
    except UnicodeDecodeError:
        raise HTTPException(status_code=415, detail="Binary file preview is not supported")

    truncated = len(content) > max_chars
    if truncated:
        content = content[:max_chars]

    return {
        "repo_id": repo.id,
        "file_path": normalized_relative,
        "content": content,
        "truncated": truncated,
    }


# -----------------------------
# Update Repository Status
# (Used by indexing pipeline)
# -----------------------------
@app.post("/repository/update-status")
def update_repo_status(
    repo_id: int,
    status: RepoStatus,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):

    repo = update_repository_status(db, repo_id, status)

    if not repo:
        raise HTTPException(
            status_code=404,
            detail="Repository not found"
        )

    return {"message": "Repository status updated"}
@app.post("/chat/save")
def store_chat(
    repository_url: str,
    query_text: str,
    response_text: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):

    chat = save_chat(
        db=db,
        user_id=current_user.id,
        repository_url=repository_url,
        query_text=query_text,
        response_text=response_text
    )

    return {"message": "Chat saved", "chat_id": chat.id}
@app.get("/chat/history")
def get_chat_history(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):

    chats = get_user_chats(db, current_user.id)

    return chats
@app.get("/chat/repository")
def get_repo_chat_history(
    repository_url: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):

    chats = get_repository_chats(
        db,
        current_user.id,
        repository_url
    )

    return chats
from app.services.index_registry_service import get_index_path

@app.get("/repository/index-path/{repo_id}")
def fetch_index_path(
    repo_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):

    path = get_index_path(db, repo_id)

    return {"index_path": path}

@app.post("/chat/query")
def query_repository(
    repo_id: int,
    query: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    
    # Check repository belongs to user and is indexed
    repo = get_repository_if_indexed(db, repo_id, current_user.id)

    rag_pipeline = get_or_create_pipeline(repo.faiss_index_path)

    # Run RAG query
    response = rag_pipeline.query(query)

    # Save chat history
    save_chat(
        db=db,
        user_id=current_user.id,
        repository_url=repo.repo_url,
        query_text=query,
        response_text=response.answer
    )

    return {
        "answer": response.answer,
        "sources": [
            {
                "file": meta.file_path,
                "symbol": meta.symbol_name,
                "line": meta.start_line
            }
            for meta, score in response.retrieved_chunks
        ]
    }
def background_index(repo_url: str, save_path: str, repo_id: int):
    db: Session = SessionLocal()
    temp_dir: str | None = None
    try:
        temp_dir = clone_repository(repo_url)
        rag_pipeline = RAGPipeline(RAGConfig())
        rag_pipeline.index_repository(temp_dir, save_path=save_path)
        _save_snapshot_and_tree(temp_dir, save_path)

        repo = db.query(Repository).filter(Repository.id == repo_id).first()
        if repo:
            repo.status = RepoStatus.INDEXED
            repo.faiss_index_path = save_path
            invalidate_pipeline(save_path)
            db.commit()
    except Exception as e:
        import traceback
        traceback.print_exc()
        db.rollback()
        repo = db.query(Repository).filter(Repository.id == repo_id).first()
        if repo:
            repo.status = RepoStatus.FAILED
            db.commit()
    finally:
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)
        db.close()


@app.post("/repository/index/{repo_id}")
def index_repository_endpoint(
    repo_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):

    repo = db.query(Repository).filter(
        Repository.id == repo_id,
        Repository.user_id == current_user.id
    ).first()

    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    invalidate_pipeline(repo.faiss_index_path)

    # mark indexing
    repo.status = RepoStatus.INDEXING
    db.commit()

    index_path = os.path.abspath(f"indexes/repo_{repo_id}")
    os.makedirs("indexes", exist_ok=True)

    background_tasks.add_task(background_index, repo.repo_url, index_path, repo_id)

    return {"message": "Indexing started"}

@app.post("/repository/sync/{repo_id}")
def sync_repository(
    repo_id: int,
    api_key: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    repo = db.query(Repository).filter(Repository.id == repo_id).first()

    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    if not repo.sync_api_key or repo.sync_api_key != api_key:
        raise HTTPException(status_code=401, detail="Unauthorized API key")

    invalidate_pipeline(repo.faiss_index_path)

    # mark indexing
    repo.status = RepoStatus.INDEXING
    db.commit()

    index_path = os.path.abspath(f"indexes/repo_{repo_id}")
    os.makedirs("indexes", exist_ok=True)

    background_tasks.add_task(background_index, repo.repo_url, index_path, repo_id)

    return {"message": "Repository sync and indexing started"}