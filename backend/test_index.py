from app.main import background_index
import os
os.makedirs("indexes", exist_ok=True)
background_index("https://github.com/octocat/Hello-World", os.path.abspath("indexes/repo_1"), 1)
