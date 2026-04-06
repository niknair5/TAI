from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_service_key: str
    supabase_anon_key: str

    # CORS (comma-separated origins, e.g. https://ta-i.vercel.app,http://localhost:3000)
    cors_origins: str = "http://localhost:3000,https://ta-i.vercel.app"
    
    # OpenAI
    openai_api_key: str
    
    # App settings (legacy list unused; use cors_origins string above)
    embedding_model: str = "text-embedding-3-small"
    chat_model: str = "gpt-4o-mini"
    chunk_size: int = 400  # target tokens per chunk
    chunk_overlap: int = 50
    retrieval_top_k: int = 5
    
    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()  # pyright: ignore[reportCallIssue]
