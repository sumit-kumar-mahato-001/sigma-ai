# ◈ StudyAI — AI-Powered Personalized Learning Operating System

> **Multimodal AI Hackathon 2026 — Track D: Personalized Tutoring & Adaptive Learning**
> A premium, modern AI educational web application and RAG backend that turns lecture videos, textbooks, PDFs, slides, and transcripts into a source-grounded AI tutor, adaptive assessment generator, and personalized study companion.

---

## 📸 System Architecture

```text
┌──────────────────────────────────────────────────────────────────┐
│                   React 18 + TypeScript + Vite UI               │
│                  (Black + White Premium SaaS Aesthetic)          │
└─────────────────────────────────┬────────────────────────────────┘
                                  │
                       REST API / HTTP Client
                                  │
┌─────────────────────────────────▼────────────────────────────────┐
│               Python FastAPI Backend (backend/ & ai-tutor)       │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ SQLite Database (DBMS courses, topics, materials, chunks)   │ │
│ │ Google Gemini API with Real Key Configuration                │ │
│ │ Multimodal Extraction (pypdf, python-pptx, OCR, transcripts) │ │
│ │ Grounded Assessment Generator & Learner Mastery Engine       │ │
│ │ Beta-Bernoulli + pyBKT Knowledge Tracing Engine              │ │
│ └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Integrated Features

| Feature | Description |
|---|---|
| **Source-Grounded AI Tutor** | Answers student questions in **Hinglish**, **English**, or **Hindi**, citing exact lecture videos, page numbers, slide decks, and timestamps (e.g. `DBMS.pdf · Page 38`). |
| **Multimodal Knowledge Base** | Ingests PDF textbooks, PowerPoint slides with table and note parsing, lecture video MP4s/transcripts, and course notes into an extraction and search pipeline. |
| **Adaptive Assessment Engine** | Generates MCQs, short answer, and numerical problems grounded in course chunks with modes (`practice`, `diagnostic`, `mock_exam`) adapted from `Project-Hackathon`. |
| **Beta-Bernoulli & pyBKT Learner Engine** | Conjugate prior Beta(1,1) tracking with 95% credible intervals and Bayesian Knowledge Tracing updates on each graded answer. |
| **Misconception Diagnostics** | Detects repeated confusable patterns across questions (e.g., `COMMIT` vs `ROLLBACK`) and cites specific course grounds. |
| **Out-of-Bounds Detection** | Flags unsupported queries not covered in the uploaded course material and prompts the student to upload relevant material. |
| **Interactive Course Map & Study Plan** | Visual prerequisite graph (`DBMS → ER Model → Relational Model → Normalization → 1NF / 2NF / 3NF → Transactions`) and daily time-blocked study schedule. |

---

## 📁 Integrated Project Structure

```text
hackathon_1/
├── Project-Hackathon/                # Provided reference codebase
│   ├── server/services/              # quizService, ragService, dataStore, pptxService, videoService
│   ├── LEARNER_MODEL.md              # Beta-Bernoulli mathematical specification
│   └── evaluation/                   # Test harness & benchmark datasets
├── backend/                          # FastAPI REST Backend & Database
│   ├── app/
│   │   ├── main.py                   # FastAPI server entrypoint
│   │   ├── config.py                 # Pydantic settings & Gemini API configuration
│   │   ├── database.py               # SQLite database engine
│   │   ├── seed.py                   # Pre-seeded DBMS course, topics, chunks
│   │   ├── models/                   # SQLAlchemy ORM & Pydantic schemas
│   │   ├── routers/                  # Chat, Materials, Assessments, Courses, Auth
│   │   └── services/                 # Gemini service, Extraction, Retrieval, Learner Engine
│   ├── storage/                      # SQLite db and uploaded course PDFs
│   └── requirements.txt              # Backend dependencies
├── ai-tutor-hackathon/               # Lecture Transcription & RAG Engine
│   ├── server.py                     # Lecture chunk RAG server
│   ├── embeddings.json               # Pre-computed Lecture Vector Embeddings Data
│   ├── quiz_progress.json            # Student Mastery Database
│   └── generate_answer_gemini.py     # Gemini RAG generation script
├── src/                              # Modern React + TypeScript + Tailwind CSS Frontend
│   ├── api/client.ts                 # React API Client connecting to Python Backend
│   ├── components/                   # Cards, Header, Sidebar & Source Viewer Modal
│   ├── context/AppContext.tsx        # Global State Manager with live Python API integration
│   ├── pages/                        # Landing, Dashboard, AI Tutor, Knowledge Base, Quiz, Progress
│   └── types/                        # TypeScript Domain Definitions
├── .env                              # Configured Gemini API Key
├── index.html                        # Main HTML with Inter Typography
├── package.json                      # npm launch & build scripts
├── requirements.txt                  # Root Python requirements
└── vite.config.ts                    # Vite Configuration
```

---

## ⚡ Quick Start & Running the Project

### 1. Prerequisites
- **Node.js**: v18 or newer
- **Python**: v3.9 or newer

### 2. Launching the Integrated Platform

#### Terminal 1 — Python Backend:
```powershell
npm run backend
# FastAPI server running on http://127.0.0.1:8000
# Interactive API Docs: http://127.0.0.1:8000/docs
```

#### Terminal 2 — React SaaS Frontend:
```powershell
npm run dev
# Frontend running on http://localhost:5173
```

---

## 📡 Live REST API Verification

| Method | Endpoint | Tested Result |
|---|---|---|
| `GET` | `/api/health` | `{"status": "ok", "gemini_configured": true}` |
| `GET` | `/api/courses/dbms/topics` | Returns topics: `ER Model (85%)`, `SQL (72%)`, `Normalization (45%)`, `Transactions (30%)` |
| `POST` | `/api/chat/ask` | Returns live Gemini grounded explanation with `[Page 38]` citations |
| `POST` | `/api/materials/upload` | Uploads and extracts text from PDFs, PPTXs, Images, and TXT |
| `POST` | `/api/assessments/generate` | Generates adaptive grounded MCQ practice quizzes |
| `POST` | `/api/assessments/submit` | Grades quiz, detects misconceptions (`COMMIT` vs `ROLLBACK`), and updates mastery |

---

## 🏆 Hackathon Compliance & Achievements
- **Track D Challenge Fully Satisfied**: Personalized Tutoring, Source-Grounded QA, Adaptive Assessments, and Misconception Diagnostics.
- **Real Gemini Reasoning**: Connected directly to Google Gemini API using your provided key with automatic failover between flash models.
- **Source-Grounded Citations**: Answers point to exact page numbers (`Page 38`) and video timestamps.
- **Hinglish & Multilingual Support**: Genuine conversational Hinglish, Hindi, and English tutoring modes.
- **Offline & Graceful Fallback**: The React UI works seamlessly with live Python backend API endpoints while maintaining smooth offline fallback capabilities.
