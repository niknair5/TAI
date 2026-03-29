import json
from app.config import get_settings
from app.models import (
    Guardrails, HintControllerInput, HintControllerOutput, Excerpt, Source
)
from app.prompts.hint_controller import HINT_CONTROLLER_PROMPT
from app.prompts.student_assistant import STUDENT_ASSISTANT_PROMPT
from app.prompts.redirect import SOCRATIC_REDIRECT_PROMPT, build_policy_acknowledgment
from app.services.embeddings import get_openai_client


def run_hint_controller(input_data: HintControllerInput) -> HintControllerOutput:
    """
    Run the hint controller to decide action and hint level.
    """
    settings = get_settings()
    client = get_openai_client()
    
    user_content = f"""STUDENT_MESSAGE: {input_data.student_message}

GUARDRAILS: {input_data.guardrails.model_dump_json()}

HINT_STATE: {json.dumps({"hint_level_used": input_data.hint_state.hint_level_used, "number_of_hints_given": input_data.hint_state.number_of_hints_given})}

EXCERPT_HIT_COUNT: {input_data.excerpt_hit_count}"""

    response = client.chat.completions.create(
        model=settings.chat_model,
        messages=[
            {"role": "system", "content": HINT_CONTROLLER_PROMPT},
            {"role": "user", "content": user_content}
        ],
        response_format={"type": "json_object"},
        temperature=0.1
    )
    
    result = json.loads(response.choices[0].message.content)
    
    raw_hint_level = result.get("hint_level", 0)
    clamped_hint_level = min(raw_hint_level, input_data.guardrails.max_hint_level)
    
    return HintControllerOutput(
        action=result.get("action", "answer"),
        hint_level=clamped_hint_level,
        raw_hint_level=raw_hint_level,
        notes_for_assistant=result.get("notes_for_assistant", ""),
        student_requested_code=result.get("student_requested_code", False),
        student_requested_worked_example=result.get("student_requested_worked_example", False),
    )


def run_student_assistant(
    student_message: str,
    excerpts: list[Excerpt],
    guardrails: Guardrails,
    hint_level: int,
    controller_notes: str,
    action: str = "answer",
) -> tuple[str, list[Source]]:
    """
    Run the student assistant to generate a response.
    Returns the response content and list of sources used.
    """
    settings = get_settings()
    client = get_openai_client()
    
    # Format excerpts for the prompt
    excerpts_text = ""
    for i, excerpt in enumerate(excerpts):
        excerpts_text += f"""
--- Excerpt {i+1} ---
Filename: {excerpt.filename}
Chunk ID: {excerpt.chunk_index}
Content:
{excerpt.content}
---
"""
    
    user_content = f"""STUDENT_MESSAGE: {student_message}

HINT_LEVEL: {hint_level}

ACTION: {action}

GUARDRAILS: {guardrails.model_dump_json()}

CONTROLLER_NOTES: {controller_notes}

EXCERPTS:
{excerpts_text if excerpts_text else "No excerpts available."}"""

    response = client.chat.completions.create(
        model=settings.chat_model,
        messages=[
            {"role": "system", "content": STUDENT_ASSISTANT_PROMPT},
            {"role": "user", "content": user_content}
        ],
        temperature=0.3
    )
    
    response_content = response.choices[0].message.content
    sources = _extract_sources(excerpts)
    
    return response_content, sources


def _extract_sources(excerpts: list[Excerpt]) -> list[Source]:
    seen: set[str] = set()
    sources: list[Source] = []
    for e in excerpts:
        if e.filename not in seen:
            seen.add(e.filename)
            sources.append(Source(filename=e.filename, chunk_index=e.chunk_index))
    return sources


def _format_excerpts(excerpts: list[Excerpt]) -> str:
    if not excerpts:
        return "No excerpts available."
    parts: list[str] = []
    for i, excerpt in enumerate(excerpts):
        parts.append(
            f"--- Excerpt {i+1} ---\n"
            f"Filename: {excerpt.filename}\n"
            f"Chunk ID: {excerpt.chunk_index}\n"
            f"Content:\n{excerpt.content}\n---"
        )
    return "\n".join(parts)


def build_redirect_response(
    breaches: list[str],
    guardrails: Guardrails,
    student_message: str,
    excerpts: list[Excerpt],
    clamped_hint_level: int,
    raw_hint_level: int,
) -> tuple[str, list[Source]]:
    """
    Build a redirect response when a guardrail breach is detected.
    Returns (combined_response, sources).

    The response has two parts:
    1. A deterministic, template-driven policy acknowledgment
    2. An LLM-generated Socratic redirect at the allowed hint level
    """
    acknowledgment = build_policy_acknowledgment(
        breaches=breaches,
        raw_hint_level=raw_hint_level,
        max_hint_level=guardrails.max_hint_level,
        instructor_note=guardrails.instructor_note,
    )

    settings = get_settings()
    client = get_openai_client()

    excerpts_text = _format_excerpts(excerpts)

    user_content = f"""STUDENT_MESSAGE: {student_message}

ALLOWED_HINT_LEVEL: {clamped_hint_level}

EXCERPTS:
{excerpts_text}"""

    response = client.chat.completions.create(
        model=settings.chat_model,
        messages=[
            {"role": "system", "content": SOCRATIC_REDIRECT_PROMPT},
            {"role": "user", "content": user_content},
        ],
        temperature=0.3,
    )

    socratic_redirect = response.choices[0].message.content
    combined = f"{acknowledgment}\n\n---\n\n{socratic_redirect}"
    sources = _extract_sources(excerpts)

    return combined, sources


TOPIC_EXTRACTION_PROMPT = """You are a topic tagger for an educational Q&A system.
Given a student's question and (optionally) the course excerpts it matched against,
return a SHORT topic label (2-5 words) that captures the academic concept being asked about.

Rules:
- Use canonical / textbook terminology (e.g. "Le Chatelier's Principle", "Binary Search Trees")
- Be consistent: the same concept should always get the same label
- If the question is vague or conversational, return "General"
- Return ONLY the label string, nothing else."""


def extract_topic(student_message: str, excerpts: list[Excerpt]) -> str:
    """
    Extract a short topic label from the student's message.
    Uses a lightweight LLM call with temperature=0 for consistency.
    """
    settings = get_settings()
    client = get_openai_client()

    excerpt_context = ""
    if excerpts:
        excerpt_context = "\n".join(
            f"- {e.filename}: {e.content[:120]}..." for e in excerpts[:3]
        )

    user_content = f"STUDENT_MESSAGE: {student_message}"
    if excerpt_context:
        user_content += f"\n\nMATCHED EXCERPTS:\n{excerpt_context}"

    try:
        response = client.chat.completions.create(
            model=settings.chat_model,
            messages=[
                {"role": "system", "content": TOPIC_EXTRACTION_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0,
            max_tokens=30,
        )
        topic = response.choices[0].message.content.strip().strip('"').strip("'")
        # Clamp length to something reasonable
        return topic[:80] if topic else "General"
    except Exception:
        return "General"
