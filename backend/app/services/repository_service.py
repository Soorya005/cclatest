from sqlalchemy.orm import Session
from app.models.repository import Repository, RepoStatus
from fastapi import HTTPException
def create_repository(db: Session, user_id: int, repo_url: str):

    repo = Repository(
        user_id=user_id,
        repo_url=repo_url,
        status=RepoStatus.NOT_INDEXED
    )

    db.add(repo)
    db.commit()
    db.refresh(repo)

    return repo
def update_repository_status(db: Session, repo_id: int, status: RepoStatus):

    repo = db.query(Repository).filter(Repository.id == repo_id).first()

    if not repo:
        return None

    repo.status = status
    db.commit()
    db.refresh(repo)

    return repo
def set_faiss_index_path(db: Session, repo_id: int, index_path: str):

    repo = db.query(Repository).filter(Repository.id == repo_id).first()

    if not repo:
        return None

    repo.faiss_index_path = index_path

    db.commit()
    db.refresh(repo)

    return repo
def get_repository_if_indexed(db: Session, repo_id: int, user_id: int):

    repo = db.query(Repository).filter(Repository.id == repo_id, Repository.user_id == user_id).first()

    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    if repo.status != RepoStatus.INDEXED:
        raise HTTPException(status_code=400, detail="Repository is not indexed yet")

    return repo