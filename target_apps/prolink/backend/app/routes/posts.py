from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from ..models.post import Post, PostCreate, PostRead
from ..auth import decode_access_token
from fastapi.security import OAuth2PasswordBearer

router = APIRouter(prefix="/posts", tags=["posts"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# In-memory storage for the demo
mock_db_posts: List[Post] = []

@router.post("/", response_model=PostRead)
async def create_post(post: PostCreate, token: str = Depends(oauth2_scheme)):
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    
    user_id = payload.get("sub")
    new_post = Post(
        **post.model_dump(),
        id=len(mock_db_posts) + 1,
        author_id=int(user_id) if user_id else 0
    )
    mock_db_posts.append(new_post)
    return new_post

@router.get("/", response_model=List[PostRead])
async def list_posts(tag: str = None):
    if tag:
        return [p for p in mock_db_posts if tag in (p.tags or "")]
    return mock_db_posts
