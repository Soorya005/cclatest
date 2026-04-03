import traceback
from app.main import RAGPipeline, RAGConfig
from app.rag.ingestion import clone_repository
import shutil
import os
import sys

try:
    print("cloning")
    temp_dir = clone_repository("https://github.com/octocat/Hello-World")
    print(f"cloned to {temp_dir}")
    rag_pipeline = RAGPipeline(RAGConfig())
    print("rag pipeline init")
    rag_pipeline.index_repository(temp_dir, save_path=os.path.abspath("indexes/repo_1"))
    print("indexing done")
    shutil.rmtree(temp_dir)
except Exception as e:
    traceback.print_exc(file=sys.stdout)
