from sqlalchemy.orm import Session
from app.models.repository import Repository, RepoStatus


def register_index_path(db: Session, repo_id: int, index_path: str):
    """
    Store FAISS index path for a repository after indexing is completed.
    """

    repo = db.query(Repository).filter(Repository.id == repo_id).first()

    if not repo:
        return None

    repo.faiss_index_path = index_path
    repo.status = RepoStatus.INDEXED

    db.commit()
    db.refresh(repo)

    return repo


def get_index_path(db: Session, repo_id: int):
    """
    Retrieve the FAISS index path for a repository.
    """

    repo = db.query(Repository).filter(Repository.id == repo_id).first()

    if not repo:
        return None

    return repo.faiss_index_path


def verify_repository_indexed(db: Session, repo_id: int):
    """
    Ensure the repository has been indexed before querying it.
    """

    repo = db.query(Repository).filter(Repository.id == repo_id).first()

    if not repo:
        raise Exception("Repository not found")

    if repo.status != RepoStatus.INDEXED:
        raise Exception("Repository is not indexed yet")

    return repo