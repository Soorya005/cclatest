# CodeChat (Backend + Frontend)

Clone and run locally with minimal setup.

## 1) Prerequisites

- Python 3.12+
- Node.js 18+
- Ollama installed

## 2) Clone

```bash
git clone https://github.com/Soorya005/cclatest.git
cd cclatest
```

## 3) Backend setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python create_tables.py
uvicorn app.main:app --reload
```

Backend runs at: `http://127.0.0.1:8000`

## 4) Ollama setup

In a separate terminal:

```bash
ollama serve
ollama pull qwen2.5-coder:1.5b-instruct-q4_K_M
```

## 5) Frontend setup

In another terminal:

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Frontend runs at: `http://localhost:3000`

### Windows quick start

From PowerShell in the repo root, run:

```powershell
.\run.ps1
```

This starts the backend and frontend together.

## 6) First run flow

1. Register and login in UI
2. Add a repository URL
3. Index repository
4. Ask questions in chat

## Notes

- Do **not** commit real `.env` files with secrets.
- Local generated files (`backend/indexes/`, `backend/codechat.db`, `.venv/`) are ignored.

## 7) CI/CD auto-sync to CodeChat (localhost via ngrok)

This project already supports background re-indexing through:

- `POST /repository/sync/{repo_id}?api_key=...`

Use GitHub Actions in your target repository so every push to `main` triggers this endpoint.

### Step A: Run backend and expose it with ngrok

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

In another terminal:

```bash
ngrok http 8000
```

Copy the public forwarding URL (example: `https://abc123.ngrok-free.app`).

### Step B: Get `repo_id` and `sync_api_key` from CodeChat

After login in UI, add your target repository URL.

The backend response from `POST /repository/add` includes:

- `repository_id` -> use as `CODECHAT_REPO_ID`
- `sync_api_key` -> use as `CODECHAT_API_KEY`

### Step C: Configure GitHub repository settings (target repo)

In the target GitHub repository:

- Settings -> Secrets and variables -> Actions -> **Secrets**
	- Add `CODECHAT_API_KEY` with value from `sync_api_key`
- Settings -> Secrets and variables -> Actions -> **Variables**
	- Add `CODECHAT_URL` with your ngrok URL (no trailing slash)
	- Add `CODECHAT_REPO_ID` with numeric `repository_id`

### Step D: Enable workflow in target repo

Use the workflow file at `.github/workflows/codechat-sync.yml`.

It triggers on:

- `push` to `main`
- manual run (`workflow_dispatch`)

### Step E: Validate

1. Push a small commit to `main` in target repo.
2. Confirm workflow success in GitHub Actions.
3. In CodeChat UI, check status transitions `INDEXING` -> `INDEXED`.
4. Query newly pushed code and verify updated answers.

### Important for localhost + ngrok

Each time ngrok URL changes, update GitHub Actions variable `CODECHAT_URL`.
