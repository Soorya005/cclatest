from app.database.database import engine, Base
import app.models  # IMPORTANT

Base.metadata.create_all(bind=engine)
print("✅ Tables created successfully")