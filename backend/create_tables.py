from sqlalchemy import inspect, text

from app.database.database import engine, Base
import app.models  # IMPORTANT


def ensure_repository_sync_key_column() -> None:
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    if "repositories" not in table_names:
        return

    existing_columns = {column["name"] for column in inspector.get_columns("repositories")}

    with engine.begin() as connection:
        if "sync_api_key" not in existing_columns:
            connection.execute(text("ALTER TABLE repositories ADD COLUMN sync_api_key VARCHAR(64)"))

        connection.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_repositories_sync_api_key "
                "ON repositories (sync_api_key)"
            )
        )


Base.metadata.create_all(bind=engine)
ensure_repository_sync_key_column()
print("Tables created successfully")
