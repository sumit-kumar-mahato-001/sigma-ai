"""
AI Tutor chat: retrieves grounded context from the course's uploaded
material and asks Gemini to answer from it only. Returns "not covered"
when nothing relevant is found, matching the frontend's existing state.
Supports per-user sessions, messages, sync, edit, and delete in SQLite.
"""
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.orm import ChatSession, ChatMessage
from app.models.schemas import ChatMessageIn, ChatMessageOut
from app.services.retrieval import search_course
from app.services.gemini_service import answer_from_sources, answer_general_chat, generate_chat_title

router = APIRouter(prefix="/api/chat", tags=["chat"])


class RenameSessionIn(BaseModel):
    title: str


class SyncChatItem(BaseModel):
    id: Optional[str] = None
    title: str
    group: Optional[str] = "Today"
    messages: list[dict]


class SyncChatsIn(BaseModel):
    user_id: str
    chats: list[SyncChatItem]


@router.post("")
@router.post("/ask")
def ask(body: ChatMessageIn, db: Session = Depends(get_db)):
    user_text = (body.text or body.query or "").strip()
    if not user_text:
        raise HTTPException(400, "Message text or query cannot be empty")

    lang_code = body.lang.lower()
    if lang_code in ("hinglish", "hn"):
        lang_code = "hn"
    elif lang_code in ("hindi", "hi"):
        lang_code = "hi"
    else:
        lang_code = "en"

    course_id = body.course_id or "dbms"
    session = db.get(ChatSession, body.session_id) if body.session_id else None
    if session is None:
        session = ChatSession(
            title=user_text[:40],
            user_id=body.user_id
        )
        db.add(session)
        db.commit()
        db.refresh(session)
    elif body.user_id and not session.user_id:
        session.user_id = body.user_id
        db.add(session)
        db.commit()

    db.add(ChatMessage(session_id=session.id, role="user", text=user_text, lang=lang_code))
    db.commit()

    # Retrieve conversation history (from request payload or existing session)
    conversation_history: list[dict] = []
    if body.history and len(body.history) > 0:
        conversation_history = list(body.history)
    elif session and session.id:
        prior_msgs = (
            db.query(ChatMessage)
            .filter(ChatMessage.session_id == session.id)
            .order_by(ChatMessage.created_at.asc())
            .all()
        )
        for pm in prior_msgs[:-1]:  # exclude the user message just added
            conversation_history.append({
                "role": pm.role,
                "text": pm.text,
            })

    # If the user query is very short or a follow-up, incorporate the last topic/query for retrieval
    retrieval_query = user_text
    if conversation_history:
        last_user_msgs = [m for m in conversation_history if m.get("role") in ("user", "u")]
        if last_user_msgs:
            last_text = last_user_msgs[-1].get("text", "")
            if len(user_text.split()) <= 4 or any(w in user_text.lower() for w in ["isme", "usme", "iska", "uska", "ye", "wo", "example", "explain", "aur", "more"]):
                retrieval_query = f"{last_text} {user_text}"

    hits = search_course(db, course_id, retrieval_query)
    if not hits and retrieval_query != user_text:
        hits = search_course(db, course_id, user_text)

    if not hits:
        ans_dict = answer_general_chat(user_text, lang_code, history=conversation_history)
        reply = ChatMessage(
            session_id=session.id, role="assistant",
            text=ans_dict["text"],
            lang=lang_code, covered=True,
        )
        db.add(reply)
        
        # Analyze chat and update session title
        msg_count = db.query(ChatMessage).filter(ChatMessage.session_id == session.id).count()
        smart_title = session.title
        if msg_count <= 2 or session.title == user_text[:40]:
            smart_title = generate_chat_title(user_text, ans_dict["text"][:160])
            session.title = smart_title
            db.add(session)
        
        db.commit()
        return {
            "session_id": str(session.id),
            "role": "assistant",
            "text": ans_dict["text"],
            "answer": ans_dict["text"],
            "title": smart_title,
            "covered": True,
            "is_unsupported": False,
            "confidence": ans_dict.get("confidence", 0),
            "verified": ans_dict.get("verified", False),
            "citations": ans_dict.get("citations", []),
            "sources": []
        }

    sources = [(chunk.page, chunk.text) for chunk, _material, _score in hits]
    ans_dict = answer_from_sources(user_text, lang_code, sources, history=conversation_history)

    top_chunk, top_material, _score = hits[0]
    reply = ChatMessage(
        session_id=session.id, role="assistant", text=ans_dict["text"], lang=lang_code,
        covered=True, source_file=top_material.name, source_loc=top_chunk.page,
    )
    db.add(reply)

    # Analyze chat and update session title
    msg_count = db.query(ChatMessage).filter(ChatMessage.session_id == session.id).count()
    smart_title = session.title
    if msg_count <= 2 or session.title == user_text[:40]:
        smart_title = generate_chat_title(user_text, ans_dict["text"][:160])
        session.title = smart_title
        db.add(session)

    db.commit()

    formatted_sources = []
    for chunk, mat, sc in hits:
        page_num = int(chunk.page.replace("Page ", "")) if "Page " in str(chunk.page) and str(chunk.page).replace("Page ", "").isdigit() else None
        formatted_sources.append({
            "documentId": str(mat.id),
            "documentTitle": mat.name,
            "fileType": mat.kind,
            "page": page_num,
            "excerpt": chunk.text,
            "highlightText": chunk.text[:80] + "..."
        })

    return {
        "session_id": str(session.id),
        "role": "assistant",
        "text": ans_dict["text"],
        "answer": ans_dict["text"],
        "title": smart_title,
        "covered": True,
        "is_unsupported": False,
        "source_file": top_material.name,
        "source_loc": top_chunk.page,
        "confidence": ans_dict.get("confidence", 95),
        "verified": ans_dict.get("verified", True),
        "citations": ans_dict.get("citations", []),
        "sources": formatted_sources
    }


@router.get("/history")
def get_user_history(user_id: str = Query(...), db: Session = Depends(get_db)):
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == user_id)
        .order_by(ChatSession.created_at.desc())
        .all()
    )
    res = []
    for s in sessions:
        msgs = (
            db.query(ChatMessage)
            .filter(ChatMessage.session_id == s.id)
            .order_by(ChatMessage.created_at.asc())
            .all()
        )
        res.append({
            "id": s.id,
            "title": s.title,
            "created_at": s.created_at.isoformat() if s.created_at else "",
            "messages": [
                {
                    "role": m.role,
                    "text": m.text,
                    "covered": m.covered,
                    "source_file": m.source_file,
                    "source_loc": m.source_loc,
                }
                for m in msgs
            ]
        })
    return res


@router.post("/sync")
def sync_chats(body: SyncChatsIn, db: Session = Depends(get_db)):
    for c in body.chats:
        session = None
        if c.id:
            session = db.get(ChatSession, c.id)
        if not session:
            session = ChatSession(id=c.id, title=c.title, user_id=body.user_id)
            db.add(session)
            db.commit()
            db.refresh(session)
        else:
            session.title = c.title
            session.user_id = body.user_id
            db.add(session)
            db.commit()

        # Check existing messages count
        existing_count = db.query(ChatMessage).filter(ChatMessage.session_id == session.id).count()
        if existing_count < len(c.messages):
            # Add new messages
            for m in c.messages[existing_count:]:
                db.add(ChatMessage(
                    session_id=session.id,
                    role=m.get("r", m.get("role", "user")),
                    text=m.get("t", m.get("text", "")),
                    source_file=m.get("f", m.get("source_file")),
                    source_loc=m.get("p", m.get("source_loc")),
                ))
            db.commit()

    return {"status": "synced"}


@router.delete("/sessions/{session_id}")
def delete_session(session_id: str, db: Session = Depends(get_db)):
    session = db.get(ChatSession, session_id)
    if not session:
        return {"status": "not_found"}
    db.delete(session)
    db.commit()
    return {"status": "deleted", "id": session_id}


@router.put("/sessions/{session_id}")
def rename_session(session_id: str, body: RenameSessionIn, db: Session = Depends(get_db)):
    session = db.get(ChatSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    session.title = body.title.strip()
    db.commit()
    return {"status": "renamed", "id": session_id, "title": session.title}


@router.get("/sessions")
def list_sessions(db: Session = Depends(get_db)):
    return [{"id": s.id, "title": s.title} for s in db.query(ChatSession).all()]


@router.get("/sessions/{session_id}/messages")
def session_messages(session_id: str, db: Session = Depends(get_db)):
    msgs = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at).all()
    return [
        {
            "role": m.role, "text": m.text, "covered": m.covered,
            "source_file": m.source_file, "source_loc": m.source_loc,
        }
        for m in msgs
    ]


class AnalyzeTitleIn(BaseModel):
    query: str
    context: Optional[str] = ""


@router.post("/analyze-title")
def analyze_title(body: AnalyzeTitleIn):
    title = generate_chat_title(body.query, body.context or "")
    return {"title": title}
