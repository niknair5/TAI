from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from uuid import UUID
import io
from app.db import get_supabase
from app.models import UploadResponse
from app.services.chunking import extract_text, chunk_text
from app.services.embeddings import embed_texts

router = APIRouter()


@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    course_id: str = Form(...)
):
    """Upload a file, extract text, chunk it, embed chunks, and store in database."""
    supabase = get_supabase()
    
    # Validate course exists
    course = supabase.table("courses").select("id").eq("id", course_id).execute()
    if not course.data:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Read file content
    content = await file.read()
    filename = file.filename or "unnamed_file"
    
    # Determine file type and extract text
    if filename.lower().endswith(".pdf"):
        text = extract_text(io.BytesIO(content), "pdf")
    elif filename.lower().endswith((".txt", ".md")):
        text = content.decode("utf-8")
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type. Use PDF, TXT, or MD.")
    
    if not text.strip():
        raise HTTPException(status_code=400, detail="No text content found in file")
    
    # Upload original file to storage
    storage_path = f"{course_id}/{filename}"
    try:
        supabase.storage.from_("course-files").upload(
            storage_path,
            content,
            file_options={"content-type": file.content_type or "application/octet-stream"}
        )
    except Exception:
        # File might already exist, try to update
        try:
            supabase.storage.from_("course-files").update(
                storage_path,
                content,
                file_options={"content-type": file.content_type or "application/octet-stream"}
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to upload file to storage: {e}")
    
    # Create file record
    file_result = supabase.table("course_files").insert({
        "course_id": course_id,
        "filename": filename,
        "storage_path": storage_path
    }).execute()
    
    if not file_result.data:
        raise HTTPException(status_code=500, detail="Failed to create file record")
    
    file_id = file_result.data[0]["id"]
    
    # Chunk the text
    chunks = chunk_text(text)
    
    if not chunks:
        raise HTTPException(status_code=400, detail="No chunks generated from file")
    
    # Generate embeddings for all chunks
    embeddings = embed_texts(chunks)
    
    # Prepare chunk records
    chunk_records = [
        {
            "course_id": course_id,
            "file_id": file_id,
            "chunk_index": i,
            "content": chunk,
            "embedding": embedding
        }
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings))
    ]
    
    # Batch insert chunks
    supabase.table("chunks").insert(chunk_records).execute()
    
    return UploadResponse(
        success=True,
        filename=filename,
        chunks_created=len(chunks)
    )
