from uuid import UUID
from app.db import get_supabase
from app.config import get_settings
from app.models import Excerpt
from app.services.embeddings import embed_text


def retrieve_chunks(course_id: UUID, query: str) -> list[Excerpt]:
    """
    Retrieve the most relevant chunks for a query within a course.
    Uses pgvector for similarity search.
    """
    settings = get_settings()
    supabase = get_supabase()
    
    # Generate query embedding
    query_embedding = embed_text(query)
    
    # Call the match_chunks RPC function
    result = supabase.rpc("match_chunks", {
        "query_embedding": query_embedding,
        "match_course_id": str(course_id),
        "match_count": settings.retrieval_top_k
    }).execute()
    
    if not result.data:
        return []
    
    excerpts = []
    for row in result.data:
        excerpts.append(Excerpt(
            filename=row["filename"],
            chunk_index=row["chunk_index"],
            content=row["content"],
            similarity=row["similarity"]
        ))
    
    return excerpts
