# CodeChat Backend

Backend service for **CodeChat**, a system that enables users to ask natural language questions about code repositories using **Retrieval-Augmented Generation (RAG)**.

This backend manages authentication, repository tracking, chat persistence, and integration with the RAG pipeline.

---

# Features

* User registration and login with **JWT authentication**
* Secure password hashing using **bcrypt**
* Repository management and indexing status tracking
* **FAISS vector index mapping** for repositories
* Query repositories using **RAG-based semantic retrieval**
* Persistent **chat history storage**
* Modular **FastAPI backend architecture**

---

# Tech Stack

Backend Framework
FastAPI

Database
PostgreSQL

ORM
SQLAlchemy

Authentication
JWT (python-jose)

Vector Search
FAISS

Embeddings
Sentence Transformers

---

# Project Structure

```
backend
│
├── app
│   ├── database
│   ├── dependencies
│   ├── models
│   ├── services
│   ├── rag
│   └── main.py
│
├── create_tables.py
├── requirements.txt
└── README.md
```

---

## API Endpoints

### Authentication

```
POST /register
POST /login
```

### Repository Management

```
POST /repository/add
GET  /repository/list
GET  /repository/status/{repo_id}
POST /repository/update-status
POST /repository/index/{repo_id}
```

### Chat / RAG

```
POST /chat/query
POST /chat/save
GET  /chat/history
GET  /chat/repository
```

### Index Mapping

```
GET /repository/index-path/{repo_id}
```

---

# Running the Backend

Install dependencies

```
pip install -r requirements.txt
```

Create database tables

```
python create_tables.py
```

Run the server

```
uvicorn app.main:app --reload
```

Open API docs

```
http://127.0.0.1:8000/docs
```

---

# Environment Variables

Create a `.env` file:

```
DATABASE_URL=
JWT_SECRET_KEY=
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

---
