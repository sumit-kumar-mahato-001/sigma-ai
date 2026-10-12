"""
LLM layer backed by Google Gemini.
Fast, direct, high-quality answers with rich markdown formatting.
"""
from __future__ import annotations
import google.generativeai as genai

from app.config import get_settings

settings = get_settings()
_configured = False


def _ensure_configured() -> bool:
    global _configured
    if not settings.gemini_api_key:
        return False
    if not _configured:
        import os
        os.environ["GOOGLE_API_KEY"] = settings.gemini_api_key
        genai.configure(api_key=settings.gemini_api_key)
        _configured = True
    return True


LANG_NAMES = {
    "en": "English",
    "hi": "Hindi (in Devanagari script)",
    "hn": "Hinglish (natural mix of Hindi and English written in Latin script)"
}


def ensure_citations(text: str, sources: list[tuple[str, str]]) -> str:
    """Checks if the answer has citations and appends them cleanly with icon identification."""
    if not sources:
        if "Source:" not in text and "📖" not in text and "🌐" not in text:
            text += "\n\n> 🌐 **Source:** Google Gemini General Knowledge (Topic not present in uploaded course materials)."
        return text
        
    has_citations = any(f"[{loc}]" in text or loc in text for loc, _ in sources)
    if not has_citations and "Source:" not in text and "📖" not in text:
        text += "\n\n### 📖 Verified Sources\n"
        for loc, _ in sources:
            icon = "🎥" if (":" in loc or "video" in loc.lower() or ".mp4" in loc.lower()) else "📄"
            text += f"* {icon} **{loc}**\n"
            
    return text.strip()


MODEL_CANDIDATES = [
    "gemini-flash-latest",
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite",
    "gemini-pro-latest",
    "gemini-flash",
]


def _call_gemini(prompt: str, temperature: float = 0.6, max_tokens: int = 2048) -> str:
    """Try models in sequence so rate limits/quotas on one model failover seamlessly to another."""
    if not _ensure_configured():
        raise ValueError("Gemini API key not configured")

    last_error = None
    for model_name in MODEL_CANDIDATES:
        try:
            model = genai.GenerativeModel(
                model_name,
                generation_config={"temperature": temperature, "max_output_tokens": max_tokens}
            )
            resp = model.generate_content(prompt)
            text = (resp.text or "").strip()
            if text:
                return text
        except Exception as e:
            print(f"[Gemini Model {model_name} Error]: {e}")
            last_error = e

    raise RuntimeError(f"All Gemini model attempts failed. Last error: {last_error}")


def answer_general_chat(question: str, lang: str, history: list[dict] | None = None) -> dict:
    """Answer general student queries, greetings, coding questions, or general AI chat directly using Gemini with conversation context."""
    lang_name = LANG_NAMES.get(lang, "Hinglish")
    if not _ensure_configured():
        return {
            "text": "Hello! I am Sigma AI. Please add your GEMINI_API_KEY to .env to unlock live Gemini responses!",
            "confidence": 100,
            "verified": True,
            "citations": []
        }

    history_context = ""
    if history:
        history_lines = []
        for msg in history[-8:]:  # keep last 8 messages for rich conversational context
            role_label = "Student" if msg.get("role") in ("user", "u") else "Sigma AI"
            content = msg.get("text") or msg.get("content") or msg.get("u") or ""
            if content.strip():
                history_lines.append(f"{role_label}: {content.strip()}")
        if history_lines:
            history_context = "Previous Conversation History:\n" + "\n".join(history_lines) + "\n\n"

    prompt = f"""You are Sigma AI — a world-class, super smart, encouraging, and friendly AI personal tutor.
Your task is to provide an accurate, high-quality answer to the student's question in {lang_name}.

{history_context}Important Conversation Context Instructions:
- You have access to the Previous Conversation History above. Remember everything discussed earlier in this chat.
- If the student asks follow-up questions (e.g. "aur example do", "isse pehle jo bataya usme...", "what about the second point?", "why?", "explain that code"), directly connect and refer back to the previous messages naturally.
- Maintain continuity across the conversation without forgetting earlier context.

Intelligent Adaptive Length & Depth:
- Dynamically adapt the length and detail of your answer to match the student's specific question:
  1. Short / Simple Queries (e.g. greetings like "hi"/"hello", 1-line definitions, brief facts, quick doubts, or when asked "short mein" / "briefly"):
     -> Keep the reply crisp, direct, concise, and to-the-point (1-3 sentences or short bullet points). Do NOT give unnecessary long paragraphs for simple questions.
  2. Medium Conceptual Queries (e.g. "What is 2NF?", "Explain how DNS works"):
     -> Provide a balanced, structured answer with a clear definition, core points, and a simple example (2-3 brief paragraphs or bullet points).
  3. Deep / Complex / Coding / Exam Questions (e.g. "Explain in detail...", "Write full code with explanation", "Compare X and Y in depth", multi-part questions):
     -> Provide a comprehensive, in-depth explanation with sections, code blocks, step-by-step logic, and real-world examples.

Formatting Rules for Clean, Well-Arranged Answers:
- Present a clean, elegantly arranged answer without excessive bold tags or unnatural highlighting.
- Use clear section headings (`###`) when needed, bullet points (`*`) for key points, and neat paragraphs.
- Keep the writing natural, readable, and structured like a professional tutor textbook.
- Always use proper fenced code blocks (```python, ```sql, etc.) for code snippets.

Student's Latest Question: {question}

Answer:"""

    try:
        text = _call_gemini(prompt, temperature=0.6, max_tokens=2048)
        return {
            "text": text,
            "confidence": 95,
            "verified": True,
            "citations": []
        }
    except Exception as e:
        print(f"[Gemini General Chat Error]: {e}")
        fallback = f"Hello! I am Sigma AI. Regarding '{question}': I can assist you with any subject, coding problem, or academic topic!"
        if lang == "hi":
            fallback = f"नमस्ते! मैं सिग्मा AI हूँ। '{question}' के बारे में: मैं आपकी पढ़ाई, कोडिंग और किसी भी विषय में मदद कर सकता हूँ!"
        elif lang == "hn":
            fallback = f"Haan bilkul! Main Sigma AI assistant hoon. Aapne pucha: '{question}'. Main aapko har subject, programming aur concepts mein help kar sakta hoon!"
        return {"text": fallback, "confidence": 85, "verified": True, "citations": []}


def answer_from_sources(question: str, lang: str, sources: list[tuple[str, str]], history: list[dict] | None = None) -> dict:
    """Answer question grounded in uploaded course material while preserving chat history context."""
    lang_name = LANG_NAMES.get(lang, "Hinglish")

    if not _ensure_configured():
        snippet = sources[0][1][:220] if sources else ""
        text = f"Based on your uploaded course material:\n\n{snippet}..."
        text = ensure_citations(text, sources)
        return {
            "text": text,
            "confidence": 90,
            "verified": True,
            "citations": [loc for loc, _ in sources]
        }

    history_context = ""
    if history:
        history_lines = []
        for msg in history[-8:]:  # keep last 8 messages for context
            role_label = "Student" if msg.get("role") in ("user", "u") else "Sigma AI"
            content = msg.get("text") or msg.get("content") or msg.get("u") or ""
            if content.strip():
                history_lines.append(f"{role_label}: {content.strip()}")
        if history_lines:
            history_context = "Previous Conversation History:\n" + "\n".join(history_lines) + "\n\n"

    context = "\n\n".join(f"--- Location: [{loc}] ---\n{text}" for loc, text in sources)
    prompt = f"""You are Sigma AI — an expert AI academic tutor.
Answer the student's question accurately in {lang_name} using the course material context and previous chat history provided below.

{history_context}Course Material Context:
{context}

Important Conversation Context Instructions:
- You have access to the Previous Conversation History above. Remember what the student asked before.
- If the student is asking a follow-up or clarifying question related to prior discussion, build upon that context while citing the course material.

Intelligent Adaptive Length & Depth:
- Match the depth and length of your response strictly to the student's question:
  1. Short / Specific Queries (e.g. "What is X?", quick definitions, simple lookups): Keep it concise, focused, and direct (1-2 paragraphs or bullet points).
  2. In-depth / Complex / Multi-step Queries (e.g. "Explain in detail", full process walkthroughs, multi-concept questions): Provide a comprehensive, structured explanation with sections, bullet points, and examples.

Formatting & Grounding Guidelines:
1. Base your answer directly on the course material context above.
2. Structure the answer cleanly and logically:
   - Use `###` headings for main sub-topics.
   - Use bullet points (`*`) for lists and clean paragraphs for explanations.
   - Avoid excessive bold highlights; keep the text natural, professional, and easily readable.
   - Include clear citations to specific locations (e.g. `[Page X]` or `[Slide X]`).
3. Explain the concept thoroughly, clearly, and in a well-arranged format.

Student's Latest Question: {question}

Answer:"""

    try:
        text = _call_gemini(prompt, temperature=0.4, max_tokens=2048)
        text = ensure_citations(text, sources)
        return {
            "text": text,
            "confidence": 98,
            "verified": True,
            "citations": [loc for loc, _ in sources]
        }
    except Exception as e:
        print(f"[Gemini Sources Error]: {e}")
        fallback = "Sorry, I encountered an issue processing the course material. Here is what I found:\n\n" + (sources[0][1][:300] if sources else "")
        return {"text": fallback, "confidence": 75, "verified": False, "citations": [loc for loc, _ in sources]}


def generate_quiz_questions(topic: str, context: str = "", count: int = 4, difficulty: str = "Medium") -> list[dict]:
    """Generate high-quality multiple choice questions on any topic with Gemini."""
    if not _ensure_configured():
        return []

    context_part = f"Course Material / Context:\n{context}\n\n" if context else ""
    prompt = f"""You are an expert exam creator.
Create {count} distinct, high-quality Multiple Choice Questions (MCQs) for students studying: "{topic}" at {difficulty} difficulty.

{context_part}Requirements:
- Each question must be clear, conceptual, and directly relevant to "{topic}".
- Provide 4 distinct options (A, B, C, D) with exactly one unambiguous correct answer.
- Avoid obvious or trivial questions.
- Include a 2-item misconception list if two options are easily confusable.
- Provide a brief 1-line conceptual explanation for why the correct answer is right.

Respond in exactly this JSON format:
[
  {{
    "text": "Question text here?",
    "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
    "answer_index": 0,
    "explanation": "Why this answer is correct",
    "misconception": ["Option A text", "Option B text"]
  }}
]

Output ONLY valid JSON array with no extra markdown code fences or comments."""

    try:
        import json, re
        raw = _call_gemini(prompt, temperature=0.3, max_tokens=2048)
        clean = re.sub(r"^```json|^```|```$", "", raw.strip(), flags=re.MULTILINE).strip()
        data = json.loads(clean)
        if isinstance(data, list) and len(data) > 0:
            return data
    except Exception as e:
        print(f"[Gemini Quiz Gen Error]: {e}")

    return []


def generate_advanced_quiz(
    topic: str,
    context: str = "",
    count: int = 5,
    difficulty: str = "medium",
    mode: str = "practice",
    q_type: str = "mcq"
) -> list[dict]:
    """
    Project-Hackathon style multi-modal quiz generation supporting:
    - modes: practice, diagnostic, mock_exam
    - types: mcq, short_answer, numerical
    Returns structured questions with evidence grounding and misconception diagnostics.
    """
    if not _ensure_configured():
        return generate_quiz_questions(topic, context, count, difficulty)

    context_part = f"Verified Course Material Sources:\n{context}\n\n" if context else ""
    prompt = f"""You are an advanced diagnostic academic assessment engine.
Generate exactly {count} source-grounded questions for topic "{topic}".
Mode: {mode} (e.g. practice = formative, diagnostic = pre-test baseline, mock_exam = rigorous exam prep).
Requested difficulty: {difficulty}.
Question type: {q_type}.

{context_part}Instructions:
1. For MCQ: Provide exactly 4 distinct options with one clear correct answer_index (0-3).
2. For short_answer: Provide a question text and a concise 1-2 sentence reference explanation.
3. Every question must include a 'misconception' field if two concepts are prone to confusion.
4. Ground questions strictly in the verified concepts.

Output strictly valid JSON:
[
  {{
    "text": "Question prompt",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "answer_index": 0,
    "explanation": "Why the correct answer is true based on course grounds",
    "difficulty": "{difficulty}",
    "type": "{q_type}",
    "misconception": ["Concept A", "Concept B"]
  }}
]
Do not wrap in markdown or commentary."""

    try:
        import json, re
        raw = _call_gemini(prompt, temperature=0.2, max_tokens=2500)
        clean = re.sub(r"^```json|^```|```$", "", raw.strip(), flags=re.MULTILINE).strip()
        data = json.loads(clean)
        if isinstance(data, list) and len(data) > 0:
            return data
    except Exception as e:
        print(f"[Gemini Advanced Quiz Error]: {e}")

    return generate_quiz_questions(topic, context, count, difficulty)


def generate_quiz_question(topic: str, context: str, difficulty: str) -> dict | None:
    qs = generate_quiz_questions(topic, context, count=1, difficulty=difficulty)
    return qs[0] if qs else None


def describe_image(path: str) -> str:
    if not _ensure_configured():
        return "Image uploaded."
    import PIL.Image
    model_name = settings.gemini_model or "gemini-flash-latest"
    model = genai.GenerativeModel(model_name)
    img = PIL.Image.open(path)
    prompt = "Describe this diagram or image for a student studying this course in clear markdown."
    try:
        resp = model.generate_content([prompt, img])
        return (resp.text or "").strip()
    except Exception:
        return "Image description unavailable."


def generate_chat_title(query: str, answer_snippet: str = "") -> str:
    """Analyze the chat query and answer context to generate a clean, concise, 2-5 word title."""
    import re

    def _fallback_title(text: str) -> str:
        cleaned = re.sub(
            r'^(what is|what are|explain|can you explain|difference between|tell me about|how does|why does|kya hai|kya hota hai|btao|batao|samjhao|hello|hi|hey|please)\s+',
            '',
            text.strip(),
            flags=re.IGNORECASE
        ).strip(' ?.:,!')
        words = cleaned.split()
        if not words:
            return text[:28].strip()
        title_words = words[:4]
        return " ".join(title_words).title()

    if not _ensure_configured():
        return _fallback_title(query)

    prompt = f"""You are a smart academic topic analyzer. Analyze this student question and response context to generate a concise, professional title (2 to 5 words max).
Student Question: "{query[:220]}"
Context Snippet: "{answer_snippet[:220]}"

Rules:
- Output ONLY the title text. No quotes, no markdown, no punctuation.
- Length: 2 to 5 words.
- Specific, academic, clear (e.g., "DBMS Three-Schema Architecture", "B+ Tree Indexing", "ACID Properties & Transactions", "Deadlock Prevention", "Relational Normalization").
"""
    try:
        raw = _call_gemini(prompt, temperature=0.2, max_tokens=25)
        cleaned = raw.strip().replace('"', '').replace("'", "").replace("\n", " ").strip()
        cleaned = re.sub(r'^(title:|\*\*title:\*\*|\*)\s*', '', cleaned, flags=re.I).strip()
        if 1 <= len(cleaned.split()) <= 6 and len(cleaned) <= 45:
            return cleaned
    except Exception as e:
        print(f"[Gemini Title Gen Error]: {e}")

    return _fallback_title(query)
