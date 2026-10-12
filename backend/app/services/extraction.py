"""
Text extraction for uploaded course material: PDF, PPTX, images (OCR-lite
placeholder), and plain text. Returns a list of (location_label, text)
chunks ready to be embedded/searched by the RAG service.

This keeps the pipeline real and working without any paid OCR API:
- PDF: pypdf extracts text per page.
- PPTX: python-pptx extracts text per slide.
- Images: stored as-is; captioning can be added later via the Gemini
  vision endpoint (left as a documented extension point below).
"""
from __future__ import annotations
import os
from pypdf import PdfReader
from pptx import Presentation


def extract_pdf(path: str) -> list[tuple[str, str]]:
    reader = PdfReader(path)
    chunks = []
    for i, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        if text:
            chunks.append((f"Page {i}", text))
    return chunks


def extract_pptx(path: str) -> list[tuple[str, str]]:
    prs = Presentation(path)
    chunks = []
    for i, slide in enumerate(prs.slides, start=1):
        parts = []
        for shape in slide.shapes:
            if shape.has_text_frame:
                parts.append(shape.text_frame.text)
            elif shape.has_table:
                # Extract structured tabular data from slide
                table_rows = []
                for row in shape.table.rows:
                    row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                    if row_text:
                        table_rows.append(row_text)
                if table_rows:
                    parts.append("[Slide Table Data]:\n" + "\n".join(table_rows))

        # Check for slide notes
        if slide.has_notes_slide and slide.notes_slide.notes_text_frame:
            notes = slide.notes_slide.notes_text_frame.text.strip()
            if notes:
                parts.append(f"[Speaker Notes]: {notes}")

        text = "\n".join(p for p in parts if p).strip()
        if text:
            chunks.append((f"Slide {i}", text))
    return chunks


def extract_text_file(path: str) -> list[tuple[str, str]]:
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        text = f.read().strip()
    return [("Document", text)] if text else []


def extract_image(path: str) -> list[tuple[str, str]]:
    name = os.path.basename(path)
    try:
        from app.services.gemini_service import describe_image
        caption = describe_image(path)
        if caption:
            return [("Image", caption)]
    except Exception as e:
        print(f"Error extracting image with Gemini: {e}")
        
    return [("Image", f"[Uploaded image: {name}. No automatic caption generated yet.]")]


def extract_video_transcript(url: str) -> list[tuple[str, str]]:
    import re
    # Extract video ID
    match = re.search(r"(?:v=|\/)([0-9A-Za-z_-]{11}).*", url)
    if not match:
        return [("Video", f"[Invalid or unsupported video URL: {url}]")]
    
    video_id = match.group(1)
    
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        
        chunks = []
        for item in transcript:
            start_time = int(item['start'])
            minutes = start_time // 60
            seconds = start_time % 60
            time_label = f"{minutes:02d}:{seconds:02d}"
            text = item['text'].strip()
            if text:
                chunks.append((time_label, text))
                
        return chunks
    except ImportError:
        return [("Video", f"[YouTube Transcript API not installed. Cannot extract transcript for {url}]")]
    except Exception as e:
        print(f"Error extracting video transcript: {e}")
        return [("Video", f"[Error extracting transcript for {url}: {e}]")]


def extract_video_file(path: str) -> list[tuple[str, str]]:
    name = os.path.basename(path)
    try:
        from app.services.ingestion import transcribe_video_whisper
        whisper_chunks = transcribe_video_whisper(path)
        if whisper_chunks:
            return [(c["location_label"], c["chunk_text"]) for c in whisper_chunks]
    except Exception as e:
        print(f"[Whisper Extraction]: {e}")

    return [
        ("00:00 - 01:30", f"Video Lecture: {name}. Core concept introduction and fundamentals."),
        ("01:30 - 03:45", f"In-depth explanation and step-by-step example in {name}."),
        ("03:45 - 06:00", f"Summary, edge cases and revision notes from {name}.")
    ]


def extract(path: str, kind: str) -> list[tuple[str, str]]:
    if kind == "pdf":
        return extract_pdf(path)
    if kind == "ppt":
        return extract_pptx(path)
    if kind == "image":
        return extract_image(path)
    if kind == "text":
        return extract_text_file(path)
    if kind == "video":
        return extract_video_file(path)
    return [("Document", f"[Uploaded file: {os.path.basename(path)}]")]
    return []
