from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship

class PostBase(SQLModel):
    title: str
    content: str
    language: Optional[str] = "text"
    tags: Optional[str] = None # Comma-separated tags

class Post(PostBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    author_id: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    author: "User" = Relationship(back_populates="posts")
    comments: List["Comment"] = Relationship(back_populates="post")

class PostCreate(PostBase):
    pass

class PostRead(PostBase):
    id: int
    author_id: int
    created_at: datetime
