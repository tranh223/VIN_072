import os
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "gpt-4o")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")


# --- Paths ---
_SRC_DIR = os.path.dirname(os.path.abspath(__file__))
_ROOT_DIR = os.path.dirname(_SRC_DIR)
DATA_DIR = os.path.join(_ROOT_DIR, "docs", "data_phapluat_thue")

# --- Chunking ---
HIERARCHICAL_PARENT_SIZE: int = 2048   # chars per parent chunk  (~800–1000 tokens VN)
HIERARCHICAL_CHILD_SIZE: int = 512     # chars per child chunk   (~150–250 tokens VN)
HIERARCHICAL_CHILD_OVERLAP: int = 150  # overlap between children (~40–50 tokens VN)
MIN_CHUNK_CHARS: int = 100             # drop chunks shorter than this

# --- Embedding ---
EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")
EMBEDDING_DIM: int = 1024

# --- Pinecone ---
PINECONE_API_KEY: str = os.getenv("PINECONE_API_KEY", "")
PINECONE_INDEX_NAME: str = os.getenv("PINECONE_INDEX_NAME", "tax-law")
# Namespace vector từ admin upload — "" = Pinecone default namespace
PINECONE_PUBLIC_NAMESPACE: str = os.getenv("PINECONE_PUBLIC_NAMESPACE", "")
PINECONE_PRIVATE_NAMESPACE: str = os.getenv("PINECONE_PRIVATE_NAMESPACE", "user-data")

# --- Search ---
BM25_TOP_K: int = 20
DENSE_TOP_K: int = 20
HYBRID_TOP_K: int = 10 
RERANK_TOP_K: int = 3

# --- Rerank (Jina API — bắt buộc cho pipeline RAG; model mặc định jina-reranker-v3) ---
JINA_API_KEY: str = os.getenv("JINA_API_KEY", "").strip()
JINA_RERANK_MODEL: str = os.getenv("JINA_RERANK_MODEL", "jina-reranker-v3")
JINA_RERANK_URL: str = os.getenv("JINA_RERANK_URL", "https://api.jina.ai/v1/rerank")
JINA_RERANK_TIMEOUT: float = float(os.getenv("JINA_RERANK_TIMEOUT", "60"))
# Cloudflare trên api.jina.ai thường chặn UA mặc định Python-urllib (lỗi 1010).
JINA_HTTP_USER_AGENT: str = os.getenv(
    "JINA_HTTP_USER_AGENT",
    "Mozilla/5.0 (compatible; TaxLawRAG/1.0; +https://jina.ai/)",
).strip()

# --- Generation (LLM) ---
# OpenAI API (hoặc bất kỳ endpoint tương thích OpenAI nào)
LLM_API_KEY: str    = os.getenv("DEFAULT_API_KEY")
LLM_BASE_URL: str   = os.getenv("DEFAULT_BASE_URL")
LLM_MODEL: str      = os.getenv("DEFAULT_MODEL_ID")
LLM_TEMPERATURE: float = float(os.getenv("LLM_TEMPERATURE", "0.1"))  # thấp → ít hallucinate
LLM_MAX_TOKENS: int    = int(os.getenv("LLM_MAX_TOKENS", "2048"))
LLM_TOP_P: float       = float(os.getenv("LLM_TOP_P", "0.9"))

# RAG query rewrite (retrieval) — LangSmith span: rag.query_rewrite
RAG_REWRITE_MODEL: str = os.getenv("RAG_REWRITE_MODEL", "gpt-5-nano")
RAG_REWRITE_MAX_TOKENS: int = int(os.getenv("RAG_REWRITE_MAX_TOKENS", "256"))
RAG_REWRITE_ENABLED: bool = os.getenv("RAG_REWRITE_ENABLED", "true").strip().lower() in {
    "1", "true", "yes",
}

# --- Bot identity (dùng để render template trong systemprompt.txt) ---
BOT_NAME: str = os.getenv("BOT_NAME", "Kaify Bot")
COMPANY_NAME: str = os.getenv("COMPANY_NAME", "Scaify")
BOT_DESCRIPTION: str = os.getenv(
    "BOT_DESCRIPTION",
    "trợ lý giải thích căn cứ pháp lý, hỗ trợ thuế, chứng từ, kê khai "
    "và đối soát dữ liệu cho hộ/cá nhân kinh doanh TMĐT",
)

# --- Paths ---
_RAG_DIR = os.path.join(_SRC_DIR, "rag")
SYSTEM_PROMPT_PATH: str = os.path.join(_RAG_DIR, "systemprompt.txt")
# Law data riêng — render vào placeholder {{BASE_KNOWLEDGE}} trong system prompt
BASE_KNOWLEDGE_PATH: str = os.getenv(
    "BASE_KNOWLEDGE_PATH", os.path.join(_RAG_DIR, "base_knowledge.md")
)

# --- Generation retrieval ---
RETRIEVE_TOP_K: int = int(os.getenv("RETRIEVE_TOP_K", "20"))

# --- LLM client ---
LLM_TIMEOUT: float = float(os.getenv("LLM_TIMEOUT", "60"))
LLM_MAX_RETRIES: int = int(os.getenv("LLM_MAX_RETRIES", "2"))

# --- History context window ---
HISTORY_MAX_MESSAGES: int = int(os.getenv("HISTORY_MAX_MESSAGES", "20"))
HISTORY_MAX_SUMMARY_CHARS: int = int(os.getenv("HISTORY_MAX_SUMMARY_CHARS", "4000"))
HISTORY_MAX_MSG_CHARS: int = int(os.getenv("HISTORY_MAX_MSG_CHARS", "500"))

# --- Clarification loop ---
CLARIFICATION_MAX_COUNT: int = int(os.getenv("CLARIFICATION_MAX_COUNT", "3"))

# --- Query malformed detection ---
QUERY_MIN_LEN: int = int(os.getenv("QUERY_MIN_LEN", "4"))
UNCLEAR_SUSPICIOUS_MAX_WORDS: int = int(os.getenv("UNCLEAR_SUSPICIOUS_MAX_WORDS", "5"))
UNCLEAR_MAX_WORDS: int = int(os.getenv("UNCLEAR_MAX_WORDS", "4"))

# --- Hallucination guard thresholds ---
HALLUCINATION_NO_CONTEXT_SKIP_LEN: int = int(os.getenv("HALLUCINATION_NO_CONTEXT_SKIP_LEN", "500"))
HALLUCINATION_H2_MIN_LEN: int = int(os.getenv("HALLUCINATION_H2_MIN_LEN", "300"))
HALLUCINATION_H3_MIN_LEN: int = int(os.getenv("HALLUCINATION_H3_MIN_LEN", "200"))
HALLUCINATION_CONTEXT_SAMPLE: int = int(os.getenv("HALLUCINATION_CONTEXT_SAMPLE", "3"))
HALLUCINATION_WORD_SAMPLE: int = int(os.getenv("HALLUCINATION_WORD_SAMPLE", "30"))

# --- Display / metadata truncation ---
CITATION_SNIPPET_LEN: int = int(os.getenv("CITATION_SNIPPET_LEN", "120"))
LAW_NAME_DISPLAY_LEN: int = int(os.getenv("LAW_NAME_DISPLAY_LEN", "60"))
BREADCRUMB_DISPLAY_LEN: int = int(os.getenv("BREADCRUMB_DISPLAY_LEN", "80"))