"""
ingestion.py
Loads source code files from a repository for RAG pipeline.
"""

import os
import logging
import tempfile
import git

logger = logging.getLogger(__name__)

# Supported code file extensions
SUPPORTED_EXTENSIONS = (".py", ".js", ".java", ".ts", ".tsx", ".jsx")


def clone_repository(repo_url: str) -> str:
    temp_dir = tempfile.mkdtemp()
    logger.debug(f"Cloning {repo_url} into {temp_dir}")
    git.Repo.clone_from(repo_url, temp_dir)
    return temp_dir


def load_repository(repo_path: str):
    """
    Load all supported source files from a repository path.

    Args:
        repo_path (str): Local path to repository

    Returns:
        List[dict]: [{"file_path": str, "content": str}]
    """

    # Normalize path (important for Windows)
    repo_path = os.path.abspath(repo_path)

    logger.debug(f"repo_path = {repo_path}")

    if not os.path.exists(repo_path):
        raise ValueError(f"Repository path does not exist: {repo_path}")

    documents = []

    for root, _, files in os.walk(repo_path):
        for file in files:

            # Only process supported file types
            if not file.endswith(SUPPORTED_EXTENSIONS):
                continue

            file_path = os.path.join(root, file)

            logger.debug(f"reading file: {file_path}")

            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()

                # Skip empty files
                if not content.strip():
                    continue

                documents.append({
                    "file_path": file_path,
                    "content": content
                })

            except Exception as e:
                logger.error(f"ERROR reading file: {file_path}", exc_info=e)
                continue

    logger.debug(f"total documents = {len(documents)}")

    if not documents:
        raise ValueError(f"No supported code files found in: {repo_path}")

    return documents