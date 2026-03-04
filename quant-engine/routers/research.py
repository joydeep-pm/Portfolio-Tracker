from __future__ import annotations

import io
import json
import os
import re
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, List

import faiss
import httpx
import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field
from pypdf import PdfReader
from sentence_transformers import SentenceTransformer

router = APIRouter(tags=["research"])

EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
DEFAULT_CHUNK_WORDS = 500
DEFAULT_CHUNK_OVERLAP = 80
DEFAULT_TOP_K = 5
MAX_TOP_K = 12

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "research"
DATA_DIR.mkdir(parents=True, exist_ok=True)

_model_lock = threading.Lock()
_embedding_model: SentenceTransformer | None = None


class EarningsSyncJsonPayload(BaseModel):
    symbol: str = Field(..., min_length=1)
    url: str | None = None
    chunk_words: int = Field(default=DEFAULT_CHUNK_WORDS, ge=100, le=2000)
    chunk_overlap: int = Field(default=DEFAULT_CHUNK_OVERLAP, ge=0, le=800)


class EarningsSyncResponse(BaseModel):
    symbol: str
    chunks_indexed: int
    source: str
    index_file: str
    metadata_file: str
    model: str
    synced_at: str


class EarningsChatRequest(BaseModel):
    symbol: str = Field(..., min_length=1)
    query: str = Field(..., min_length=3)
    top_k: int = Field(default=DEFAULT_TOP_K, ge=1, le=MAX_TOP_K)


class CitationChunk(BaseModel):
    rank: int
    score: float
    chunk_id: int
    text: str


class EarningsChatResponse(BaseModel):
    symbol: str
    query: str
    answer: str
    citations: List[CitationChunk]
    model: str


def _normalize_symbol(raw_symbol: str) -> str:
    symbol = str(raw_symbol).strip().upper()
    if not symbol:
        raise HTTPException(status_code=422, detail="symbol is required")
    symbol = re.sub(r"\.(NS|BO)$", "", symbol)
    return re.sub(r"[^A-Z0-9_-]", "", symbol)


def _symbol_paths(symbol: str) -> tuple[Path, Path]:
    key = _normalize_symbol(symbol)
    folder = DATA_DIR / key
    folder.mkdir(parents=True, exist_ok=True)
    return folder / "earnings.index", folder / "earnings.meta.json"


def _get_embedding_model() -> SentenceTransformer:
    global _embedding_model
    if _embedding_model is not None:
        return _embedding_model
    with _model_lock:
        if _embedding_model is None:
            _embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    return _embedding_model


def _extract_pdf_text(pdf_bytes: bytes) -> str:
    if not pdf_bytes:
        raise HTTPException(status_code=422, detail="PDF content is empty")

    reader = PdfReader(io.BytesIO(pdf_bytes))
    pages: List[str] = []
    for page in reader.pages:
        pages.append(page.extract_text() or "")

    text = "\n".join(pages)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = text.strip()

    if not text:
        raise HTTPException(status_code=422, detail="No extractable text found in PDF")
    return text


def _chunk_text(text: str, chunk_words: int, chunk_overlap: int) -> List[str]:
    words = text.split()
    if not words:
        return []

    if chunk_overlap >= chunk_words:
        raise HTTPException(status_code=422, detail="chunk_overlap must be smaller than chunk_words")

    chunks: List[str] = []
    step = max(1, chunk_words - chunk_overlap)
    for start in range(0, len(words), step):
        segment = words[start : start + chunk_words]
        if not segment:
            continue
        chunk = " ".join(segment).strip()
        if chunk:
            chunks.append(chunk)
        if start + chunk_words >= len(words):
            break
    return chunks


def _encode_texts(texts: List[str]) -> np.ndarray:
    if not texts:
        return np.zeros((0, 0), dtype=np.float32)

    model = _get_embedding_model()
    embeddings = model.encode(texts, convert_to_numpy=True, normalize_embeddings=True, show_progress_bar=False)
    embeddings = np.asarray(embeddings, dtype=np.float32)
    if embeddings.ndim == 1:
        embeddings = embeddings.reshape(1, -1)
    return embeddings


def _save_faiss_index(symbol: str, chunks: List[str], embeddings: np.ndarray, source: str) -> tuple[Path, Path]:
    if embeddings.shape[0] != len(chunks):
        raise HTTPException(status_code=500, detail="Embedding count mismatch")

    index_path, meta_path = _symbol_paths(symbol)

    if embeddings.shape[0] == 0:
        raise HTTPException(status_code=422, detail="No chunks generated for indexing")

    index = faiss.IndexFlatIP(embeddings.shape[1])
    index.add(embeddings)
    faiss.write_index(index, str(index_path))

    metadata = {
        "symbol": _normalize_symbol(symbol),
        "source": source,
        "model": EMBEDDING_MODEL_NAME,
        "chunk_words": len(chunks[0].split()) if chunks else 0,
        "chunks": [{"chunk_id": idx, "text": chunk} for idx, chunk in enumerate(chunks)],
        "synced_at": datetime.now(tz=timezone.utc).isoformat(),
    }
    meta_path.write_text(json.dumps(metadata, ensure_ascii=True, indent=2), encoding="utf-8")

    return index_path, meta_path


def _load_symbol_index(symbol: str) -> tuple[Any, dict]:
    index_path, meta_path = _symbol_paths(symbol)
    if not index_path.exists() or not meta_path.exists():
        raise HTTPException(status_code=404, detail=f"No earnings index found for symbol {symbol}")

    index = faiss.read_index(str(index_path))
    metadata = json.loads(meta_path.read_text(encoding="utf-8"))
    return index, metadata


async def _fetch_pdf_from_url(url: str) -> bytes:
    timeout = httpx.Timeout(60.0, connect=15.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        response = await client.get(url)
        response.raise_for_status()
        content = response.content

    if not content:
        raise HTTPException(status_code=422, detail="Downloaded PDF is empty")
    return content


def _build_prompt_context(citations: List[CitationChunk]) -> str:
    context_blocks = []
    for citation in citations:
        context_blocks.append(f"[C{citation.rank}] {citation.text}")
    return "\n\n".join(context_blocks)


async def _generate_grounded_answer(query: str, citations: List[CitationChunk]) -> tuple[str, str]:
    if not citations:
        return ("No relevant transcript chunks were retrieved for this question.", "none")

    context = _build_prompt_context(citations)
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")

    if api_key:
        prompt = (
            "You are a financial research assistant. "
            "Answer only from the provided citations and explicitly reference citation ids like [C1], [C2]. "
            "If evidence is insufficient, say so.\n\n"
            f"User Query: {query}\n\n"
            f"Citations:\n{context}\n"
        )
        payload = {
            "model": model,
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": "Provide grounded answers with citation ids."},
                {"role": "user", "content": prompt},
            ],
        }

        try:
            timeout = httpx.Timeout(40.0, connect=10.0)
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    f"{base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
                answer = (
                    data.get("choices", [{}])[0]
                    .get("message", {})
                    .get("content", "")
                    .strip()
                )
                if answer:
                    return answer, model
        except Exception:
            # Fall back to deterministic grounded summary if external model call fails.
            pass

    fallback_lines = [
        "Grounded summary from retrieved transcript excerpts:",
        *[f"- [C{citation.rank}] {citation.text}" for citation in citations],
        f"\nQuestion: {query}",
        "Use cited excerpts above as the evidence base.",
    ]
    return "\n".join(fallback_lines), "local-grounded-fallback"


@router.post("/earnings/sync", response_model=EarningsSyncResponse)
async def sync_earnings_transcript(
    request: Request,
    file: UploadFile | None = File(default=None),
    symbol_form: str | None = Form(default=None, alias="symbol"),
    url_form: str | None = Form(default=None, alias="url"),
    chunk_words_form: int | None = Form(default=None, alias="chunk_words"),
    chunk_overlap_form: int | None = Form(default=None, alias="chunk_overlap"),
) -> EarningsSyncResponse:
    symbol: str | None = symbol_form
    source_url: str | None = url_form
    chunk_words = chunk_words_form if isinstance(chunk_words_form, int) else DEFAULT_CHUNK_WORDS
    chunk_overlap = chunk_overlap_form if isinstance(chunk_overlap_form, int) else DEFAULT_CHUNK_OVERLAP

    content_type = str(request.headers.get("content-type", "")).lower()
    if content_type.startswith("application/json"):
        body = EarningsSyncJsonPayload.model_validate(await request.json())
        symbol = body.symbol
        source_url = body.url
        chunk_words = body.chunk_words
        chunk_overlap = body.chunk_overlap

    if not symbol:
        raise HTTPException(status_code=422, detail="symbol is required")

    if file is None and not source_url:
        raise HTTPException(status_code=422, detail="Provide either a PDF upload or transcript URL")

    if file is not None:
        pdf_bytes = await file.read()
        source = f"upload:{file.filename or 'transcript.pdf'}"
    else:
        source = str(source_url)
        try:
            pdf_bytes = await _fetch_pdf_from_url(source)
        except httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=502, detail=f"Failed to fetch transcript URL: {exc.response.status_code}") from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"Failed to fetch transcript URL: {exc}") from exc

    transcript_text = _extract_pdf_text(pdf_bytes)
    chunks = _chunk_text(transcript_text, chunk_words=chunk_words, chunk_overlap=chunk_overlap)
    if not chunks:
        raise HTTPException(status_code=422, detail="Transcript produced zero chunks after processing")

    embeddings = _encode_texts(chunks)
    index_path, meta_path = _save_faiss_index(symbol=symbol, chunks=chunks, embeddings=embeddings, source=source)

    return EarningsSyncResponse(
        symbol=_normalize_symbol(symbol),
        chunks_indexed=len(chunks),
        source=source,
        index_file=str(index_path),
        metadata_file=str(meta_path),
        model=EMBEDDING_MODEL_NAME,
        synced_at=datetime.now(tz=timezone.utc).isoformat(),
    )


@router.post("/earnings/chat", response_model=EarningsChatResponse)
async def chat_earnings_transcript(payload: EarningsChatRequest) -> EarningsChatResponse:
    symbol = _normalize_symbol(payload.symbol)
    index, metadata = _load_symbol_index(symbol)

    chunks = metadata.get("chunks", [])
    if not chunks:
        raise HTTPException(status_code=404, detail=f"No chunk metadata found for symbol {symbol}")

    query_embedding = _encode_texts([payload.query])
    k = min(max(1, payload.top_k), index.ntotal)

    scores, indices = index.search(query_embedding, k)
    scored = list(zip(indices[0].tolist(), scores[0].tolist()))

    citations: List[CitationChunk] = []
    for rank, (chunk_idx, score) in enumerate(scored, start=1):
        if chunk_idx < 0 or chunk_idx >= len(chunks):
            continue
        chunk_row = chunks[chunk_idx]
        citations.append(
            CitationChunk(
                rank=rank,
                score=round(float(score), 6),
                chunk_id=int(chunk_row.get("chunk_id", chunk_idx)),
                text=str(chunk_row.get("text", "")),
            )
        )

    answer, model_used = await _generate_grounded_answer(payload.query, citations)

    return EarningsChatResponse(
        symbol=symbol,
        query=payload.query,
        answer=answer,
        citations=citations,
        model=model_used,
    )
