# 🚀 Production Deployment Guide: Vercel + Render + Supabase

This project is architected for modern full-stack deployment:
- **Database**: [Supabase](https://supabase.com) (PostgreSQL + Pooling)
- **Backend API**: [Render](https://render.com) (FastAPI + Uvicorn)
- **Frontend App**: [Vercel](https://vercel.com) (React + Vite + TypeScript)

---

## 1. Supabase (Database Setup)

1. Sign up / Log in to [Supabase](https://supabase.com).
2. Click **New Project**:
   - **Name**: `sigma-ai`
   - **Database Password**: *(Save this securely!)*
   - **Region**: Choose closest (e.g. `South Asia (Mumbai)` or `US East`).
3. Once the project is created:
   - Go to **Project Settings** (gear icon) -> **Database**.
   - Under **Connection string**, select **URI**.
   - Copy the URI string:
     ```text
     postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
     ```
   - *(Note: If using Connection Pooling on port 6543, copy the Session Mode or Transaction Mode URI).*
4. The backend will automatically create all tables (`topics`, `materials`, `chats`, `quiz_attempts`, etc.) on first boot via SQLAlchemy.

---

## 2. Push Code to GitHub

1. Create a new repository on [GitHub](https://github.com/new) (e.g. `sigma-ai`).
2. In your terminal run:
   ```bash
   git add .
   git commit -m "feat: production configuration for Vercel, Render, and Supabase"
   git branch -M main
   git remote add origin https://github.com/<YOUR_USERNAME>/sigma-ai.git
   git push -u origin main
   ```

---

## 3. Render (Backend Deployment)

1. Sign up / Log in to [Render](https://render.com).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository (`sigma-ai`).
4. Configure the Web Service:
   - **Name**: `sigma-backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port $PORT`
   - **Plan**: `Free`
5. Under **Environment Variables**, add:
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | Your Supabase PostgreSQL URI from Step 1 |
   | `GEMINI_API_KEY` | Your Google Gemini API Key |
   | `GEMINI_MODEL` | `gemini-flash-latest` |
   | `PYTHON_VERSION` | `3.11.9` |
   | `FRONTEND_ORIGIN` | `*` (or your Vercel URL once deployed) |
6. Click **Create Web Service**.
7. Once deployed, Render will provide your backend URL (e.g., `https://sigma-backend.onrender.com`).
8. Verify health: visit `https://sigma-backend.onrender.com/api/health` -> should return `{"status":"ok","gemini_configured":true}`.

---

## 4. Vercel (Frontend Deployment)

1. Sign up / Log in to [Vercel](https://vercel.com).
2. Click **Add New...** -> **Project**.
3. Import your GitHub repository (`sigma-ai`).
4. Project Configuration:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./` (Leave default)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Under **Environment Variables**, add:
   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://sigma-backend.onrender.com` (Your Render backend URL, without trailing slash) |
6. Click **Deploy**.
7. Once complete, Vercel will give you a live production URL (e.g. `https://sigma-ai.vercel.app`)!

---

## 5. Final Connection Check

1. Open your live Vercel URL (`https://sigma-ai.vercel.app`).
2. Ask a question to Sigma AI in the Chat.
3. Attempt an Assignment to verify pyBKT and Supabase database updates.
4. Check your Supabase Table Editor: you will see real rows created in `users`, `chat_sessions`, and `quiz_attempts`!
