import io
from typing import BinaryIO
import tiktoken
import pdfplumber
from app.config import get_settings


def extract_text(file: BinaryIO, file_type: str) -> str:
    """Extract text from a file based on its type."""
    if file_type == "pdf":
        return extract_pdf_text(file)
    else:
        # Assume text file
        return file.read().decode("utf-8")


def extract_pdf_text(file: BinaryIO) -> str:
    """Extract text from a PDF file using pdfplumber."""
    text_parts = []
    
    with pdfplumber.open(file) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    
    return "\n\n".join(text_parts)


def count_tokens(text: str, model: str = "gpt-4o-mini") -> int:
    """Count the number of tokens in a text string."""
    try:
        encoding = tiktoken.encoding_for_model(model)
    except KeyError:
        encoding = tiktoken.get_encoding("cl100k_base")
    
    return len(encoding.encode(text))


def chunk_text(text: str) -> list[str]:
    """
    Split text into chunks targeting the configured chunk size.
    
    Strategy:
    1. Split by paragraphs (double newlines)
    2. If a paragraph is too large, split by sentences
    3. Merge small paragraphs to reach target size
    """
    settings = get_settings()
    target_size = settings.chunk_size
    overlap = settings.chunk_overlap
    
    # Clean and normalize text
    text = text.strip()
    text = "\n".join(line.strip() for line in text.split("\n"))
    
    # Split into paragraphs
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    
    chunks = []
    current_chunk = []
    current_tokens = 0
    
    for para in paragraphs:
        para_tokens = count_tokens(para)
        
        # If single paragraph exceeds target, split it further
        if para_tokens > target_size * 1.5:
            # Flush current chunk first
            if current_chunk:
                chunks.append("\n\n".join(current_chunk))
                current_chunk = []
                current_tokens = 0
            
            # Split large paragraph by sentences
            sentences = split_into_sentences(para)
            for sentence in sentences:
                sent_tokens = count_tokens(sentence)
                
                if current_tokens + sent_tokens > target_size and current_chunk:
                    chunks.append(" ".join(current_chunk))
                    # Keep some overlap
                    overlap_text = " ".join(current_chunk[-2:]) if len(current_chunk) >= 2 else ""
                    current_chunk = [overlap_text] if overlap_text else []
                    current_tokens = count_tokens(overlap_text) if overlap_text else 0
                
                current_chunk.append(sentence)
                current_tokens += sent_tokens
        else:
            # Check if adding this paragraph exceeds target
            if current_tokens + para_tokens > target_size and current_chunk:
                chunks.append("\n\n".join(current_chunk))
                current_chunk = []
                current_tokens = 0
            
            current_chunk.append(para)
            current_tokens += para_tokens
    
    # Don't forget the last chunk
    if current_chunk:
        chunks.append("\n\n".join(current_chunk))
    
    # Filter out empty chunks
    chunks = [c.strip() for c in chunks if c.strip()]
    
    return chunks


def split_into_sentences(text: str) -> list[str]:
    """Simple sentence splitter."""
    import re
    
    # Split on sentence-ending punctuation followed by space
    sentences = re.split(r'(?<=[.!?])\s+', text)
    return [s.strip() for s in sentences if s.strip()]
