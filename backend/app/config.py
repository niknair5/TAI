from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_service_key: str
    
    # OpenAI
    openai_api_key: str
    
    # App settings
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:3001"]
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
    return Settings()
