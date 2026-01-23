from openai import OpenAI
from app.config import get_settings

_client: OpenAI | None = None


def get_openai_client() -> OpenAI:
    global _client
    if _client is None:
        settings = get_settings()
        _client = OpenAI(api_key=settings.openai_api_key)
    return _client


def embed_text(text: str) -> list[float]:
    """Generate embedding for a single text."""
    settings = get_settings()
    client = get_openai_client()
    
    response = client.embeddings.create(
        model=settings.embedding_model,
        input=text
    )
    
    return response.data[0].embedding


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for multiple texts in batch."""
    if not texts:
        return []
    
    settings = get_settings()
    client = get_openai_client()
    
    # OpenAI API supports batch embedding
    response = client.embeddings.create(
        model=settings.embedding_model,
        input=texts
    )
    
    # Sort by index to maintain order
    sorted_data = sorted(response.data, key=lambda x: x.index)
    return [item.embedding for item in sorted_data]
