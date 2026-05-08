"""
rag_pipeline.py
Orchestrates the complete RAG pipeline for code repositories.

Install deps:
    pip install sentence-transformers faiss-cpu numpy anthropic openai requests
"""

import importlib
import logging
import os
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple
from dotenv import load_dotenv

from app.rag.ingestion import load_repository
from app.rag.chunking import chunk_repository, CodeChunk
from app.rag.embeddings import CodeEmbedder, EmbeddedChunk
from app.rag.vector_store import VectorStore, create_vector_store
from app.rag.prompt_builder import build_prompt

logger = logging.getLogger(__name__)
load_dotenv()

try:
    anthropic = importlib.import_module("anthropic")
    ANTHROPIC_AVAILABLE = True
except Exception:
    anthropic = None
    ANTHROPIC_AVAILABLE = False

try:
    openai = importlib.import_module("openai")
    OPENAI_AVAILABLE = True
except Exception:
    openai = None
    OPENAI_AVAILABLE = False

try:
    groq_module = importlib.import_module("groq")
    GROQ_AVAILABLE = True
except Exception:
    groq_module = None
    GROQ_AVAILABLE = False

try:
    google_genai = importlib.import_module("google.genai")
    GOOGLE_GENAI_AVAILABLE = True
except Exception:
    google_genai = None
    GOOGLE_GENAI_AVAILABLE = False

import requests
REQUESTS_AVAILABLE = True

# Gemini quota / rate-limit error substrings (checked case-insensitively)
_GEMINI_QUOTA_ERRORS = (
    "resource_exhausted",
    "quota exceeded",
    "rate limit",
    "429",
    "too many requests",
    "usage spike",
    "billing",
)


# ─── Configuration ───────────────────────────────────────────────

@dataclass
class RAGConfig:
    """Configuration for the RAG pipeline."""
    # Embedding
    embedding_model: str = "all-MiniLM-L6-v2"
    embedding_device: Optional[str] = None

    # Vector store
    index_type: str = "flat"  # "flat", "ivf", "hnsw", "in_memory"

    # Retrieval
    top_k: int = 8
    similarity_threshold: float = 0.0

    # LLM
    llm_provider: str = "ollama"          # "ollama", "anthropic", "openai"
    llm_model: str = "qwen2.5-coder:1.5b-instruct-q4_K_M"
    llm_temperature: float = 0.0
    llm_max_tokens: int = 1200

    # Ollama
    ollama_base_url: str = "http://localhost:11434"
    ollama_request_timeout: int = 240

    # API keys (loaded from env vars automatically)
    anthropic_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    gemini_model: str = "gemini-2.0-flash"
    groq_api_key: Optional[str] = None
    groq_model: str = "llama-3.1-8b-instant"

    def __post_init__(self):
        llm_provider = os.getenv("LLM_PROVIDER") or os.getenv("RAG_LLM_PROVIDER")
        if llm_provider:
            self.llm_provider = llm_provider.strip().lower()

        if not self.anthropic_api_key:
            self.anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
        if not self.openai_api_key:
            self.openai_api_key = os.getenv("OPENAI_API_KEY")
        if not self.gemini_api_key:
            self.gemini_api_key = os.getenv("GEMINI_API_KEY")
        if not self.groq_api_key:
            self.groq_api_key = os.getenv("GROQ_API_KEY")

        gemini_model_env = os.getenv("GEMINI_MODEL")
        if gemini_model_env:
            self.gemini_model = gemini_model_env
        groq_model_env = os.getenv("GROQ_MODEL")
        if groq_model_env:
            self.groq_model = groq_model_env

        llm_model = os.getenv("OLLAMA_MODEL") or os.getenv("LLM_MODEL")
        if llm_model:
            self.llm_model = llm_model

        llm_temperature = os.getenv("LLM_TEMPERATURE")
        if llm_temperature:
            try:
                self.llm_temperature = float(llm_temperature)
            except ValueError:
                logger.warning(
                    "[RAG Config] Invalid LLM_TEMPERATURE='%s'; using default %.2f",
                    llm_temperature,
                    self.llm_temperature,
                )

        llm_max_tokens = os.getenv("LLM_MAX_TOKENS")
        if llm_max_tokens:
            try:
                self.llm_max_tokens = int(llm_max_tokens)
            except ValueError:
                logger.warning(
                    "[RAG Config] Invalid LLM_MAX_TOKENS='%s'; using default %d",
                    llm_max_tokens,
                    self.llm_max_tokens,
                )

        rag_top_k = os.getenv("RAG_TOP_K")
        if rag_top_k:
            try:
                parsed_top_k = int(rag_top_k)
                if parsed_top_k > 0:
                    self.top_k = parsed_top_k
            except ValueError:
                logger.warning(
                    "[RAG Config] Invalid RAG_TOP_K='%s'; using default %d",
                    rag_top_k,
                    self.top_k,
                )

        ollama_url = os.getenv("OLLAMA_BASE_URL")
        if ollama_url:
            self.ollama_base_url = ollama_url
        ollama_timeout = os.getenv("OLLAMA_REQUEST_TIMEOUT")
        if ollama_timeout:
            try:
                self.ollama_request_timeout = int(ollama_timeout)
            except ValueError:
                logger.warning(
                    "[RAG Config] Invalid OLLAMA_REQUEST_TIMEOUT='%s'; using default %s",
                    ollama_timeout,
                    self.ollama_request_timeout,
                )


@dataclass
class RetrievalResult:
    """Result returned by RAGPipeline.retrieve()."""
    chunks: List[Tuple]   # List of (ChunkMetadata, score) tuples
    query: str
    total_found: int


@dataclass
class RAGResponse:
    """Complete response from RAGPipeline.query()."""
    query: str
    answer: str
    retrieved_chunks: List[Tuple]
    context_used: str
    metadata: Dict


# ─── LLM Client ─────────────────────────────────────────────────

class LLMClient:
    """Unified interface for Ollama, Anthropic, OpenAI, Gemini, and Groq."""

    def __init__(self, config: RAGConfig):
        self.config = config
        self.provider = config.llm_provider
        self.client: Any = None
        self._gemini_client: Any = None
        self._groq_client: Any = None

        if self.provider == "ollama":
            if not REQUESTS_AVAILABLE:
                raise RuntimeError(
                    "requests library required for Ollama. Install: pip install requests"
                )
            self.base_url = config.ollama_base_url
            self._check_ollama_connection()

        elif self.provider == "anthropic":
            if not ANTHROPIC_AVAILABLE:
                raise RuntimeError("anthropic library required. Install: pip install anthropic")
            if not config.anthropic_api_key:
                raise ValueError("ANTHROPIC_API_KEY is not set.")
            self.client = anthropic.Anthropic(api_key=config.anthropic_api_key)

        elif self.provider == "openai":
            if not OPENAI_AVAILABLE:
                raise RuntimeError("openai library required. Install: pip install openai")
            if not config.openai_api_key:
                raise ValueError("OPENAI_API_KEY is not set.")
            self.client = openai.OpenAI(api_key=config.openai_api_key)

        elif self.provider == "gemini":
            if not config.gemini_api_key:
                raise ValueError("GEMINI_API_KEY is not set.")
            from app.rag.gemini_client import GeminiClient
            self.client = GeminiClient(
                api_key=config.gemini_api_key,
                model_name=config.gemini_model,
            )

        elif self.provider == "groq":
            if not GROQ_AVAILABLE:
                raise RuntimeError("groq library required. Install: pip install groq")
            if not config.groq_api_key:
                raise ValueError("GROQ_API_KEY is not set.")
            self.client = groq_module.Groq(api_key=config.groq_api_key)

        else:
            raise ValueError(
                f"Unknown LLM provider: '{self.provider}'. "
                "Choose 'ollama', 'anthropic', 'openai', 'gemini', or 'groq'."
            )

        # Pre-warm optional fallback clients if keys are available.
        # This way fallbacks are ready without extra initialisation cost at query time.
        self._init_fallback_clients()

    def _init_fallback_clients(self):
        """Pre-initialise Gemini and Groq clients for use as fallbacks."""
        if self._gemini_client is None and GOOGLE_GENAI_AVAILABLE and self.config.gemini_api_key:
            try:
                self._gemini_client = google_genai.Client(api_key=self.config.gemini_api_key)
                logger.info("[LLM] Gemini fallback client ready (model=%s)", self.config.gemini_model)
            except Exception as exc:
                logger.warning("[LLM] Could not init Gemini fallback client: %s", exc)

        if self._groq_client is None and GROQ_AVAILABLE and self.config.groq_api_key:
            try:
                self._groq_client = groq_module.Groq(api_key=self.config.groq_api_key)
                logger.info("[LLM] Groq fallback client ready (model=%s)", self.config.groq_model)
            except Exception as exc:
                logger.warning("[LLM] Could not init Groq fallback client: %s", exc)

    def _check_ollama_connection(self):
        """Verify Ollama is reachable and log available models."""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            if response.status_code == 200:
                available_models = [
                    m["name"] for m in response.json().get("models", [])
                ]
                logger.info(
                    "[LLM] Connected to Ollama. Available models: %s", available_models
                )
                resolved_model = self._resolve_ollama_model_name(available_models)
                if resolved_model != self.config.llm_model:
                    logger.info(
                        "[LLM] Using resolved Ollama model '%s' for requested '%s'",
                        resolved_model,
                        self.config.llm_model,
                    )
                self.config.llm_model = resolved_model
            else:
                logger.warning(
                    "[LLM] Could not list Ollama models (HTTP %d)", response.status_code
                )
        except requests.exceptions.RequestException as exc:
            logger.warning(
                "[LLM] Could not connect to Ollama at %s: %s. "
                "Make sure Ollama is running: ollama serve",
                self.base_url, exc,
            )

    def _resolve_ollama_model_name(self, available_models: List[str]) -> str:
        """Resolve configured model name to an available Ollama tag if needed."""
        requested = self.config.llm_model
        if not available_models:
            return requested

        if requested in available_models:
            return requested

        requested_base = requested.split(":", 1)[0]
        for model_name in available_models:
            if model_name.split(":", 1)[0] == requested_base:
                logger.warning(
                    "[LLM] Requested model '%s' not found; using '%s'",
                    requested,
                    model_name,
                )
                return model_name

        logger.warning(
            "[LLM] Model '%s' not in available Ollama models: %s",
            requested,
            available_models,
        )
        return requested

    def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """
        Generate a response from the configured LLM with automatic fallback.

        Fallback order when primary provider fails:
          ollama  → gemini → groq
          gemini  → groq
          groq    → (no further fallback)
          others  → gemini → groq
        """
        try:
            return self._generate_primary(prompt, system_prompt)
        except Exception as primary_exc:
            logger.warning(
                "[LLM] Primary provider '%s' failed: %s — trying fallbacks.",
                self.provider, primary_exc,
            )
            return self._generate_with_fallbacks(prompt, system_prompt, primary_exc)

    def _generate_primary(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """Call the configured primary provider (no fallback)."""
        if self.provider == "ollama":
            return self._generate_ollama(prompt, system_prompt)

        if self.provider == "anthropic":
            kwargs = {
                "model": self.config.llm_model,
                "max_tokens": self.config.llm_max_tokens,
                "temperature": self.config.llm_temperature,
                "messages": [{"role": "user", "content": prompt}],
            }
            if system_prompt:
                kwargs["system"] = system_prompt
            response = self.client.messages.create(**kwargs)
            return response.content[0].text

        if self.provider == "openai":
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})
            response = self.client.chat.completions.create(
                model=self.config.llm_model,
                messages=messages,
                temperature=self.config.llm_temperature,
                max_tokens=self.config.llm_max_tokens,
            )
            return response.choices[0].message.content

        if self.provider == "gemini":
            return self._generate_gemini(prompt, system_prompt)

        if self.provider == "groq":
            return self._generate_groq(prompt, system_prompt)

        return ""

    def _generate_with_fallbacks(
        self,
        prompt: str,
        system_prompt: Optional[str],
        primary_exc: Exception,
    ) -> str:
        """Try Gemini then Groq as automatic fallbacks."""
        # ── Gemini fallback ──────────────────────────────────────
        if self.provider != "gemini" and self._gemini_client is not None:
            try:
                answer = self._generate_gemini(prompt, system_prompt)
                logger.info("[LLM] Answered via Gemini fallback (model=%s).", self.config.gemini_model)
                return answer
            except Exception as gemini_exc:
                exc_lower = str(gemini_exc).lower()
                if any(kw in exc_lower for kw in _GEMINI_QUOTA_ERRORS):
                    logger.warning(
                        "[LLM] Gemini quota/rate-limit hit: %s — falling through to Groq.",
                        gemini_exc,
                    )
                else:
                    logger.warning("[LLM] Gemini fallback failed: %s — trying Groq.", gemini_exc)

        # ── Groq fallback ────────────────────────────────────────
        if self.provider != "groq" and self._groq_client is not None:
            try:
                answer = self._generate_groq(prompt, system_prompt)
                logger.info("[LLM] Answered via Groq fallback (model=%s).", self.config.groq_model)
                return answer
            except Exception as groq_exc:
                logger.warning("[LLM] Groq fallback also failed: %s.", groq_exc)

        # ── All fallbacks exhausted ──────────────────────────────
        raise RuntimeError(
            f"All LLM providers failed. Primary ({self.provider}): {primary_exc}"
        )

    def _generate_gemini(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """Call the Gemini API.

        Works with two different client styles:
        - Primary provider: self.client is a GeminiClient (wrapper from gemini_client.py).
        - Fallback:         self._gemini_client is a raw google.genai Client.
        """
        # Primary provider path (GeminiClient wrapper)
        if self.provider == "gemini" and self.client is not None:
            return self.client.generate(prompt, system_prompt)

        # Fallback path (raw google-genai client)
        if self._gemini_client is not None:
            full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
            response = self._gemini_client.models.generate_content(
                model=self.config.gemini_model,
                contents=full_prompt
            )
            return response.text

        raise RuntimeError("Gemini client is not initialised.")

    def _generate_groq(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """Call the Groq API (OpenAI-compatible).

        Works with two client sources:
        - Primary provider: self.client is the Groq() instance.
        - Fallback:         self._groq_client is the pre-warmed Groq() instance.
        """
        groq_client = self.client if (self.provider == "groq" and self.client is not None) else self._groq_client
        if groq_client is None:
            raise RuntimeError("Groq client is not initialised.")
        messages: List[Dict] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        completion = groq_client.chat.completions.create(
            model=self.config.groq_model,
            messages=messages,
            temperature=self.config.llm_temperature,
            max_tokens=self.config.llm_max_tokens,
        )
        return completion.choices[0].message.content

    def _generate_ollama(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """Send a request to Ollama (supports /api/generate and /api/chat)."""
        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt

        max_predict = max(128, min(self.config.llm_max_tokens, 4096))
        # Keep the non-streaming request budget tight to avoid 5+ minute stalls.
        connect_timeout = 10
        base_timeout = min(max(self.config.ollama_request_timeout, 15), 45)
        retry_timeout = min(max(base_timeout + 15, 30), 60)
        attempts = [
            (base_timeout, max_predict),
            (retry_timeout, min(max_predict, 1024)),
        ]

        last_error: Optional[Exception] = None

        for attempt_idx, (timeout_seconds, num_predict) in enumerate(attempts, start=1):
            try:
                # Try native Ollama generate API first.
                generate_payload = {
                    "model": self.config.llm_model,
                    "prompt": full_prompt,
                    "stream": False,
                    "options": {
                        "temperature": self.config.llm_temperature,
                        "num_predict": num_predict,
                    },
                }
                generate_response = requests.post(
                    f"{self.base_url}/api/generate",
                    json=generate_payload,
                    timeout=(connect_timeout, timeout_seconds),
                )
                if generate_response.status_code == 404:
                    # Some deployments expose chat-style endpoint instead.
                    chat_payload = {
                        "model": self.config.llm_model,
                        "stream": False,
                        "messages": [{"role": "user", "content": full_prompt}],
                        "options": {
                            "temperature": self.config.llm_temperature,
                            "num_predict": num_predict,
                        },
                    }
                    chat_response = requests.post(
                        f"{self.base_url}/api/chat",
                        json=chat_payload,
                        timeout=(connect_timeout, timeout_seconds),
                    )
                    chat_response.raise_for_status()
                    chat_body = chat_response.json()
                    message = chat_body.get("message") or {}
                    content = message.get("content") if isinstance(message, dict) else None
                    if content:
                        return content
                    return chat_body.get("response", "")

                generate_response.raise_for_status()
                return generate_response.json().get("response", "")
            except (requests.exceptions.Timeout, requests.exceptions.RequestException) as exc:
                last_error = exc
                if attempt_idx < len(attempts):
                    logger.warning(
                        "[LLM] Ollama attempt %d/%d failed (%s). Retrying with timeout=%ds num_predict=%d",
                        attempt_idx,
                        len(attempts),
                        exc,
                        attempts[attempt_idx][0],
                        attempts[attempt_idx][1],
                    )
                    continue
                break

        if isinstance(last_error, requests.exceptions.Timeout):
            raise RuntimeError(
                f"Ollama request timed out after retries. Model '{self.config.llm_model}' "
                f"may be slow or unavailable (read_timeout={retry_timeout}s)."
            )
        raise RuntimeError(f"Ollama API error after retries: {last_error}")


# ─── Prompt Builder (internal) ────────────────────────────────────

class PromptBuilder:
    """Builds system and user prompts for the RAG pipeline."""

    @staticmethod
    def build_system_prompt() -> str:
        return (
            "You are an expert code assistant. Answer questions about a codebase "
            "using ONLY the provided code context.\n\n"
            "Guidelines:\n"
            "- Reference specific file names and line numbers.\n"
            "- Provide code snippets from the context when helpful.\n"
            "- For repository-summary requests, explain modules and structure clearly.\n"
            "- If context is insufficient, say so clearly."
        )

    @staticmethod
    def build_user_prompt(query: str, context_chunks: List[Tuple]) -> str:
        """Delegate to prompt_builder module for consistent formatting."""
        from app.rag.prompt_builder import is_repo_summary_query

        if is_repo_summary_query(query):
            return build_prompt(
                query,
                context_chunks,
                max_context_chunks=12,
                max_chunk_chars=2200,
            )

        return build_prompt(
            query,
            context_chunks,
            max_context_chunks=4,
            max_chunk_chars=1400,
        )


# ─── RAG Pipeline ────────────────────────────────────────────────

class RAGPipeline:
    """
    End-to-end RAG pipeline for code repositories.

    Basic workflow::

        pipeline = RAGPipeline(config)
        pipeline.index_repository("/path/to/repo")
        response = pipeline.query("How does authentication work?")
        print(response.answer)
    """

    def __init__(self, config: Optional[RAGConfig] = None):
        self.config = config or RAGConfig()
        self.embedder: Optional[CodeEmbedder] = None
        self.vector_store = None
        self.llm_client: Optional[LLMClient] = None
        self.prompt_builder = PromptBuilder()

        logger.info(
            "[RAG Pipeline] Initialised — embedding_model=%s, index=%s, llm=%s/%s",
            self.config.embedding_model,
            self.config.index_type,
            self.config.llm_provider,
            self.config.llm_model,
        )

    # ── Indexing ────────────────────────────────────────────────

    def index_repository(self, repo_path: str, save_path: Optional[str] = None) -> None:
        """
        Index a code repository end-to-end.

        Args:
            repo_path:  Path to the repository root.
            save_path:  Optional directory to persist the FAISS index.

        Raises:
            ValueError: If no supported files or no chunks are found.
        """
        logger.info("[RAG Pipeline] Indexing repository: %s", repo_path)

        # 1. Ingest
        logger.info("[RAG Pipeline] Step 1/4 – Loading files…")
        documents = load_repository(repo_path)
        if not documents:
            raise ValueError(f"No supported code files found in: {repo_path}")

        # 2. Chunk
        logger.info("[RAG Pipeline] Step 2/4 – Chunking %d files…", len(documents))
        chunks = chunk_repository(documents)
        if not chunks:
            raise ValueError("Chunking produced zero chunks. Check file contents.")

        # 3. Embed
        logger.info("[RAG Pipeline] Step 3/4 – Embedding %d chunks…", len(chunks))
        self.embedder = CodeEmbedder(
            model_name=self.config.embedding_model,
            device=self.config.embedding_device,
        )
        embedded_chunks = self.embedder.embed_chunks(chunks)

        # 4. Index
        logger.info("[RAG Pipeline] Step 4/4 – Building vector store…")
        self.vector_store = create_vector_store(
            embedded_chunks, index_type=self.config.index_type
        )

        if save_path:
            logger.info("[RAG Pipeline] Saving index to %s…", save_path)
            self.vector_store.save(save_path)

        stats = self.vector_store.get_stats()
        logger.info(
            "[RAG Pipeline] Indexing complete — %d chunks, languages=%s, types=%s",
            stats["total_chunks"], stats["languages"], stats["chunk_types"],
        )

    def load_index(self, load_path: str) -> None:
        """
        Load a pre-built FAISS index from disk.

        Args:
            load_path: Directory containing the saved index.
        """
        logger.info("[RAG Pipeline] Loading index from: %s", load_path)
        self.vector_store = VectorStore.load(load_path)
        self.embedder = CodeEmbedder(
            model_name=self.config.embedding_model,
            device=self.config.embedding_device,
        )
        stats = self.vector_store.get_stats()
        logger.info("[RAG Pipeline] Loaded %d chunks.", stats["total_chunks"])

    # ── Retrieval ───────────────────────────────────────────────

    def retrieve(
        self,
        query: str,
        top_k: Optional[int] = None,
        filters: Optional[Dict] = None,
    ) -> RetrievalResult:
        """
        Retrieve the most relevant code chunks for a query.

        Args:
            query:   Natural-language or code search query.
            top_k:   Override number of results (defaults to config.top_k).
            filters: Optional metadata filters, e.g. {"language": "python"}.

        Returns:
            RetrievalResult with (ChunkMetadata, score) tuples.

        Raises:
            RuntimeError: If index_repository() or load_index() has not been called.
        """
        if not self.vector_store or not self.embedder:
            raise RuntimeError(
                "Index not loaded. Call index_repository() or load_index() first."
            )

        top_k = top_k or self.config.top_k
        logger.info("[Retrieval] Query: '%s' (top_k=%d)", query, top_k)

        query_embedding = self.embedder.embed_query(query)
        results = self.vector_store.search(query_embedding, top_k=top_k, filters=filters)

        # Apply similarity threshold
        filtered = [
            (meta, score)
            for meta, score in results
            if score >= self.config.similarity_threshold
        ]

        logger.info(
            "[Retrieval] Returned %d chunks (threshold=%.3f).",
            len(filtered), self.config.similarity_threshold,
        )
        return RetrievalResult(chunks=filtered, query=query, total_found=len(filtered))

    def _build_fallback_answer(
        self,
        query: str,
        retrieved_chunks: List[Tuple],
        generation_error: Optional[str] = None,
    ) -> str:
        """Create a useful best-effort answer from retrieved chunks when LLM fails."""
        query_lower = query.lower()
        is_summary_query = any(
            term in query_lower
            for term in [
                "summarize",
                "summary",
                "overview",
                "architecture",
                "structure",
            ]
        )

        if generation_error and (
            "404" in generation_error or "timed out" in generation_error.lower()
        ):
            connectivity_hint = (
                "LLM generation is currently unavailable. Please check Ollama connectivity and endpoint.\n"
                "- Ensure service is running: ollama serve\n"
                "- Ensure OLLAMA_BASE_URL points to native Ollama (example: http://localhost:11434)\n"
                "- Ensure model exists: ollama list"
            )
        else:
            connectivity_hint = "LLM generation is currently unavailable."

        if not retrieved_chunks:
            return f"{connectivity_hint}\n\nNo relevant code context was retrieved."

        if is_summary_query:
            files = []
            for metadata, _score in retrieved_chunks:
                file_path = metadata.file_path
                if file_path not in files:
                    files.append(file_path)
                if len(files) >= 8:
                    break

            top_dirs = {}
            for file_path in files:
                normalized = file_path.replace("\\", "/")
                parts = [p for p in normalized.split("/") if p]
                key = parts[0] if parts else "root"
                top_dirs[key] = top_dirs.get(key, 0) + 1

            dir_summary = ", ".join(
                f"{name} ({count})" for name, count in sorted(top_dirs.items(), key=lambda x: x[0])
            ) or "unknown"
            formatted_files = "\n".join(f"- {path}" for path in files)

            return (
                f"{connectivity_hint}\n\n"
                "I could not produce a full natural-language summary, but I can infer a rough structure from retrieved files:\n"
                f"- Top-level areas seen: {dir_summary}\n"
                "- Example files:\n"
                f"{formatted_files}"
            )

        query_tokens = [
            token
            for token in re.findall(r"[a-zA-Z_][a-zA-Z0-9_]*", query.lower())
            if len(token) > 2
        ]

        candidate_hits: List[Tuple[str, int, str]] = []
        for metadata, _score in retrieved_chunks:
            source_lines = metadata.source_text.splitlines()
            for line_offset, source_line in enumerate(source_lines):
                source_line_lower = source_line.lower()
                if query_tokens and not any(token in source_line_lower for token in query_tokens):
                    continue

                if re.search(r"\b(login|signin|sign_in|authenticate|auth)\b", source_line_lower):
                    line_number = metadata.start_line + line_offset
                    candidate_hits.append(
                        (metadata.file_path, line_number, source_line.strip())
                    )
                    if len(candidate_hits) >= 3:
                        break
            if len(candidate_hits) >= 3:
                break

        if candidate_hits:
            formatted_hits = "\n".join(
                f"- {file_path}:{line_number} → {snippet[:160]}"
                for file_path, line_number, snippet in candidate_hits
            )
            return (
                "LLM generation failed, but I found likely login-related code locations:\n"
                f"{formatted_hits}"
            )

        top_files = []
        for metadata, _score in retrieved_chunks[:3]:
            top_files.append(f"- {metadata.file_path}:{metadata.start_line}")

        return (
            "LLM generation failed, but relevant code was retrieved. "
            "Start with these files:\n"
            + "\n".join(top_files)
        )

    @staticmethod
    def _is_location_query(query: str) -> bool:
        query_lower = query.lower()
        has_where = "where" in query_lower
        has_symbol = any(
            token in query_lower
            for token in [
                "function",
                "funtion",
                "method",
                "handler",
                "authentication",
                "authenctication",
                "auth",
                "login",
                "signin",
                "register",
                "jwt",
                "token",
            ]
        )
        return has_where and has_symbol

    def _build_location_answer(self, query: str, retrieved_chunks: List[Tuple]) -> Optional[str]:
        """Return direct file/line hits for symbol-location style queries."""
        if not retrieved_chunks:
            return None

        query_tokens = [
            token
            for token in re.findall(r"[a-zA-Z_][a-zA-Z0-9_]*", query.lower())
            if len(token) > 2 and token not in {"where", "function", "funtion", "method", "handler"}
        ]

        login_like = any(token.startswith("log") or token.startswith("auth") for token in query_tokens)
        patterns: List[re.Pattern[str]] = []
        if login_like:
            patterns.extend([
                re.compile(r"\bfunction\s+login\b", re.IGNORECASE),
                re.compile(r"\b(?:const|let|var)\s+login\s*=", re.IGNORECASE),
                re.compile(r"\blogin\s*[:=]\s*function\b", re.IGNORECASE),
                re.compile(r"\brouter\.(?:post|get)\s*\(\s*['\"]\/login['\"]", re.IGNORECASE),
                re.compile(r"\bapp\.(?:post|get)\s*\(\s*['\"]\/login['\"]", re.IGNORECASE),
                re.compile(r"\b(?:authenticate|authentication|auth)\b", re.IGNORECASE),
                re.compile(r"\brouter\.(?:post|get|use)\s*\(", re.IGNORECASE),
                re.compile(r"\bapp\.(?:post|get|use)\s*\(", re.IGNORECASE),
            ])

        if not patterns:
            for token in query_tokens:
                safe_token = re.escape(token)
                patterns.append(re.compile(rf"\b{safe_token}\b", re.IGNORECASE))

        scored_hits: List[Tuple[int, str, int, str]] = []
        for metadata, _score in retrieved_chunks:
            source_lines = metadata.source_text.splitlines()
            file_lower = metadata.file_path.lower()
            file_bonus = 0
            if any(token in file_lower for token in ["auth", "route", "login"]):
                file_bonus += 30
            elif any(token in file_lower for token in ["server", "controller", "handler"]):
                file_bonus += 15

            for line_offset, source_line in enumerate(source_lines):
                stripped = source_line.strip()
                if not stripped:
                    continue
                if not any(pattern.search(source_line) for pattern in patterns):
                    continue

                line_score = 0
                line_lower = stripped.lower()
                if re.search(r"\b(function|def|async\s+function)\b", line_lower):
                    line_score += 25
                if re.search(r"\b(router|app)\.(post|get|use)\s*\(", line_lower):
                    line_score += 30
                if re.search(r"\b(login|signin|register|auth|authenticate|jwt|token)\b", line_lower):
                    line_score += 20
                if re.search(r"\bauth\s*:\s*\{", line_lower):
                    line_score -= 15

                total_score = file_bonus + line_score
                line_number = metadata.start_line + line_offset
                scored_hits.append((total_score, metadata.file_path, line_number, stripped))

                if len(scored_hits) >= 20:
                    break
            if len(scored_hits) >= 20:
                break

        if not scored_hits:
            return None

        scored_hits.sort(key=lambda item: item[0], reverse=True)

        deduped_hits: List[Tuple[str, int, str]] = []
        seen = set()
        for _score, file_path, line_number, snippet in scored_hits:
            dedupe_key = (file_path, line_number)
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            deduped_hits.append((file_path, line_number, snippet))
            if len(deduped_hits) >= 3:
                break

        formatted_hits = "\n".join(
            f"- {file_path}:{line_number} → {snippet[:140]}"
            for file_path, line_number, snippet in deduped_hits
        )
        return f"Likely location(s) for your function:\n{formatted_hits}"

    @staticmethod
    def _extract_exact_search_term(query: str) -> Optional[str]:
        """Extract a literal search term from natural language code-search prompts."""
        query_stripped = query.strip()
        query_lower = query_stripped.lower()

        # Prefer quoted strings first.
        quoted = re.findall(r"['\"]([^'\"]{2,})['\"]", query_stripped)
        if quoted:
            return quoted[0].strip()

        # Common phrasing used in UI: "search for this statement ..."
        marker = "search for this statement"
        if marker in query_lower:
            idx = query_lower.find(marker)
            term = query_stripped[idx + len(marker):].strip(" :.-")
            if term:
                return term

        # Fallback for code-like function calls, e.g. print(hi)
        call_like = re.search(r"([a-zA-Z_][a-zA-Z0-9_]*\s*\([^\)]{0,120}\))", query_stripped)
        if call_like:
            return call_like.group(1).strip()

        return None

    def _build_exact_search_answer(self, term: str) -> Optional[str]:
        """Search literal text across indexed chunks and return file:line hits."""
        if not self.vector_store or not getattr(self.vector_store, "metadata", None):
            return None

        needle = term.strip()
        if len(needle) < 2:
            return None

        needle_lower = needle.lower()
        hits: List[Tuple[str, int, str]] = []

        for metadata in self.vector_store.metadata:
            source_lines = metadata.source_text.splitlines()
            for line_offset, source_line in enumerate(source_lines):
                if needle_lower in source_line.lower():
                    hits.append(
                        (metadata.file_path, metadata.start_line + line_offset, source_line.strip())
                    )
                    if len(hits) >= 8:
                        break
            if len(hits) >= 8:
                break

        if not hits:
            return None

        deduped_hits: List[Tuple[str, int, str]] = []
        seen = set()
        for file_path, line_number, snippet in hits:
            key = (file_path, line_number)
            if key in seen:
                continue
            seen.add(key)
            deduped_hits.append((file_path, line_number, snippet))
            if len(deduped_hits) >= 5:
                break

        formatted_hits = "\n".join(
            f"- {file_path}:{line_number} → {snippet[:180]}"
            for file_path, line_number, snippet in deduped_hits
        )
        return f"Found exact match(es) for '{needle}':\n{formatted_hits}"

    @staticmethod
    def _is_repo_summary_query(query: str) -> bool:
        query_lower = query.lower()
        return any(
            term in query_lower
            for term in [
                "summarize",
                "summary",
                "overview",
                "architecture",
                "repo structure",
                "repository structure",
                "project structure",
                "explain the repo",
                "explain this repo",
                "how is this repo organized",
            ]
        )

    # ── Full Query ───────────────────────────────────────────────

    def query(
        self,
        query: str,
        top_k: Optional[int] = None,
        filters: Optional[Dict] = None,
        return_context: bool = False,
    ) -> RAGResponse:
        """
        Full RAG query: retrieve context and generate an LLM answer.

        Args:
            query:          User question.
            top_k:          Number of chunks to retrieve.
            filters:        Optional metadata filters.
            return_context: If True, include the raw prompt in the response.

        Returns:
            RAGResponse with answer and provenance metadata.
        """
        if not self.llm_client:
            self.llm_client = LLMClient(self.config)

        effective_top_k = top_k
        if effective_top_k is None and self._is_repo_summary_query(query):
            effective_top_k = max(self.config.top_k, 12)

        retrieval_result = self.retrieve(query, effective_top_k, filters)

        if not retrieval_result.chunks:
            logger.warning("[RAG Pipeline] No relevant chunks found for query: '%s'", query)
            return RAGResponse(
                query=query,
                answer="No relevant code found in the repository for this query.",
                retrieved_chunks=[],
                context_used="",
                metadata={"total_chunks_found": 0},
            )

        exact_term = self._extract_exact_search_term(query)
        if exact_term:
            exact_answer = self._build_exact_search_answer(exact_term)
            if exact_answer:
                return RAGResponse(
                    query=query,
                    answer=exact_answer,
                    retrieved_chunks=retrieval_result.chunks,
                    context_used="",
                    metadata={
                        "total_chunks_found": retrieval_result.total_found,
                        "chunks_used": len(retrieval_result.chunks),
                        "mode": "deterministic_exact_search",
                    },
                )

        if self._is_location_query(query):
            location_answer = self._build_location_answer(query, retrieval_result.chunks)
            if location_answer:
                return RAGResponse(
                    query=query,
                    answer=location_answer,
                    retrieved_chunks=retrieval_result.chunks,
                    context_used="",
                    metadata={
                        "total_chunks_found": retrieval_result.total_found,
                        "chunks_used": len(retrieval_result.chunks),
                        "mode": "deterministic_location",
                    },
                )

        system_prompt = self.prompt_builder.build_system_prompt()
        user_prompt = self.prompt_builder.build_user_prompt(query, retrieval_result.chunks)

        logger.info("[LLM] Generating answer via %s…", self.config.llm_provider)
        answer: str
        generation_error: Optional[str] = None
        used_compact_retry = False

        try:
            answer = self.llm_client.generate(user_prompt, system_prompt)
        except Exception as exc:
            logger.warning("LLM generation failed: %s", exc)
            generation_error = str(exc)
            answer = ""

            if not answer:
                answer = self._build_fallback_answer(
                    query,
                    retrieval_result.chunks,
                    generation_error=generation_error,
                )

        return RAGResponse(
            query=query,
            answer=answer,
            retrieved_chunks=retrieval_result.chunks,
            context_used=user_prompt if return_context else "",
            metadata={
                "total_chunks_found": retrieval_result.total_found,
                "chunks_used": len(retrieval_result.chunks),
                "llm_model": self.config.llm_model,
                "embedding_model": self.config.embedding_model,
                    "effective_top_k": effective_top_k or self.config.top_k,
                "used_compact_retry": used_compact_retry,
                "generation_error": generation_error,
            },
        )

    # ── Interactive Mode ─────────────────────────────────────────

    def interactive_mode(self):
        """Launch an interactive REPL for querying the indexed codebase."""
        border = "=" * 60
        print(f"\n{border}\n🤖 RAG Pipeline – Interactive Mode\n{border}")
        print("Commands: stats | filter <lang> | clear | quit\n" + border + "\n")

        current_filters = None

        while True:
            try:
                user_input = input("\n💬 You: ").strip()
                if not user_input:
                    continue
                if user_input.lower() == "quit":
                    print("👋 Goodbye!")
                    break
                if user_input.lower() == "stats":
                    stats = self.vector_store.get_stats()
                    print(
                        f"\n📊 Stats: {stats['total_chunks']} chunks | "
                        f"Languages: {stats['languages']} | "
                        f"Types: {stats['chunk_types']}"
                    )
                    continue
                if user_input.lower().startswith("filter "):
                    lang = user_input[7:].strip()
                    current_filters = {"language": lang}
                    print(f"🔍 Filtering by language: {lang}")
                    continue
                if user_input.lower() == "clear":
                    current_filters = None
                    print("🔍 Filters cleared")
                    continue

                response = self.query(user_input, filters=current_filters)
                print(f"\n🤖 Assistant:\n{response.answer}")
                print(f"\n📚 Retrieved {response.metadata['chunks_used']} chunk(s):")
                for i, (meta, score) in enumerate(response.retrieved_chunks[:3], 1):
                    print(
                        f"   {i}. {meta.symbol_name} "
                        f"– {meta.file_path}:{meta.start_line} "
                        f"(score: {score:.3f})"
                    )

            except KeyboardInterrupt:
                print("\n👋 Goodbye!")
                break
            except Exception as exc:
                logger.error("[RAG Pipeline] Unhandled error: %s", exc, exc_info=True)
                print(f"❌ Error: {exc}")


# ─── CLI Entry Point ─────────────────────────────────────────────

def main():
    """Command-line entry point."""
    import argparse
    import sys

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s – %(message)s",
    )

    parser = argparse.ArgumentParser(description="RAG Pipeline for Code Repositories")
    parser.add_argument(
        "command",
        choices=["index", "query", "interactive", "load"],
    )
    parser.add_argument("--repo",       help="Repository path (index command)")
    parser.add_argument("--index-path", help="Path to save/load index")
    parser.add_argument("--query",      help="Query string")
    parser.add_argument("--top-k",      type=int, default=5)
    parser.add_argument("--model",      default="all-MiniLM-L6-v2")
    parser.add_argument("--llm",        default="ollama",
                        choices=["ollama", "anthropic", "openai"])
    parser.add_argument("--llm-model",  help="LLM model name (e.g. llama3.2)")
    parser.add_argument("--ollama-url", default="http://localhost:11434")

    args = parser.parse_args()

    config = RAGConfig(
        embedding_model=args.model,
        top_k=args.top_k,
        llm_provider=args.llm,
        ollama_base_url=args.ollama_url,
    )
    if args.llm_model:
        config.llm_model = args.llm_model

    pipeline = RAGPipeline(config)

    if args.command == "index":
        if not args.repo:
            parser.error("--repo required for 'index' command")
        pipeline.index_repository(args.repo, save_path=args.index_path)

    elif args.command == "load":
        if not args.index_path:
            parser.error("--index-path required for 'load' command")
        pipeline.load_index(args.index_path)
        print("✅ Index loaded successfully!")

    elif args.command == "query":
        if not args.index_path:
            parser.error("--index-path required for 'query' command")
        if not args.query:
            parser.error("--query required for 'query' command")
        pipeline.load_index(args.index_path)
        response = pipeline.query(args.query)
        print(f"\n🤖 Answer:\n{response.answer}")
        print("\n📚 Sources:")
        for i, (meta, score) in enumerate(response.retrieved_chunks, 1):
            print(f"   {i}. {meta.symbol_name} – {meta.file_path}:{meta.start_line}")

    elif args.command == "interactive":
        if not args.index_path:
            parser.error("--index-path required for 'interactive' command")
        pipeline.load_index(args.index_path)
        pipeline.interactive_mode()


if __name__ == "__main__":
    main()