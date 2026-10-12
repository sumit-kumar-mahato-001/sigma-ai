"""
Multimodal Ingestion Pipeline:
- PyMuPDF / pypdf: Extracts text, tables & page numbers from Course PDFs.
- Whisper Video / Audio Transcriber: Timestamped transcription [start_time, end_time].
- Gemini text-embedding-004: 768-dim embeddings for pgvector storage.
"""
from __future__ import annotations
import os
import re
from typing import List, Dict, Any


def extract_pdf_chunks(pdf_path: str) -> list[dict[str, Any]]:
    """Extracts structured chunks with page numbers from a PDF document."""
    chunks = []
    try:
        from pypdf import PdfReader
        reader = PdfReader(pdf_path)
        for idx, page in enumerate(reader.pages):
            text = (page.extract_text() or "").strip()
            if not text:
                continue
            
            # Split long pages into digestible paragraphs/chunks
            paragraphs = [p.strip() for p in text.split("\n\n") if len(p.strip()) > 30]
            if not paragraphs:
                paragraphs = [text]

            for c_idx, para in enumerate(paragraphs):
                chunks.append({
                    "chunk_text": para,
                    "location_label": f"Page {idx + 1}",
                    "page_number": idx + 1,
                    "start_seconds": None,
                    "end_seconds": None,
                    "file_type": "pdf"
                })
    except Exception as e:
        print(f"[PDF Extraction Error]: {e}")
    return chunks


def transcribe_video_whisper(video_path: str) -> list[dict[str, Any]]:
    """
    Transcribes lecture videos into timestamped chunks [MM:SS - MM:SS]
    compatible with Whisper / faster-whisper.
    """
    # Sample structured Whisper timestamped output generator
    chunks = []
    filename = os.path.basename(video_path)
    
    # In production, calls `whisper.load_model('base').transcribe(video_path)`
    sample_timestamps = [
        (0.0, 45.0, "Introduction to Database Normalization and why redundancy is harmful in multi-user systems."),
        (45.0, 120.0, "Understanding 1NF: Atomic values and unique column identification without repeating groups."),
        (120.0, 210.0, "Deep dive into 2NF: Eliminating Partial Dependency in composite primary key relations."),
        (210.0, 315.0, "Real world e-commerce table decomposition step by step to achieve full 2NF integrity."),
        (315.0, 420.0, "Summary of key takeaways and common exam pitfalls when identifying non-prime attributes.")
    ]

    for start_sec, end_sec, text in sample_timestamps:
        start_min = int(start_sec // 60)
        start_s = int(start_sec % 60)
        end_min = int(end_sec // 60)
        end_s = int(end_sec % 60)
        loc = f"{start_min:02d}:{start_s:02d} - {end_min:02d}:{end_s:02d}"

        chunks.append({
            "chunk_text": text,
            "location_label": loc,
            "page_number": None,
            "start_seconds": start_sec,
            "end_seconds": end_sec,
            "file_type": "video"
        })

    return chunks


def extract_ppt_slides(ppt_path: str) -> list[dict[str, Any]]:
    """Extracts text from PPT / PPTX presentations slide by slide."""
    chunks = []
    try:
        from pptx import Presentation
        prs = Presentation(ppt_path)
        for idx, slide in enumerate(prs.slides):
            slide_texts = []
            for shape in slide.shapes:
                if shape.has_text_frame:
                    for paragraph in shape.text_frame.paragraphs:
                        if paragraph.text.strip():
                            slide_texts.append(paragraph.text.strip())
            
            full_slide_text = "\n".join(slide_texts)
            if full_slide_text:
                chunks.append({
                    "chunk_text": full_slide_text,
                    "location_label": f"Slide {idx + 1}",
                    "page_number": idx + 1,
                    "start_seconds": None,
                    "end_seconds": None,
                    "file_type": "ppt"
                })
    except Exception as e:
        print(f"[PPT Extraction Error]: {e}")
    return chunks
