# AI Lounge 실행 방법

## Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

- 실행 주소: `http://localhost:8000`

## Frontend

```bash
cd frontend
npm install
npm run dev
```

- 실행 주소: `http://localhost:3000`
- frontend에서 `/api` 요청은 backend `http://localhost:8000`으로 프록시됩니다.
