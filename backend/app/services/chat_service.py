from sqlalchemy.orm import Session
from app.models.chat_history import ChatHistory
def save_chat(
    db: Session,
    user_id: int,
    repository_url: str,
    query_text: str,
    response_text: str
):

    chat = ChatHistory(
        user_id=user_id,
        repository_url=repository_url,
        query_text=query_text,
        response_text=response_text
    )

    db.add(chat)
    db.commit()
    db.refresh(chat)

    return chat
def get_user_chats(db: Session, user_id: int):

    chats = db.query(ChatHistory).filter(
        ChatHistory.user_id == user_id
    ).all()

    return chats
def get_repository_chats(db: Session, user_id: int, repository_url: str):

    chats = db.query(ChatHistory).filter(
        ChatHistory.user_id == user_id,
        ChatHistory.repository_url == repository_url
    ).all()

    return chats