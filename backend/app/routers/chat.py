from fastapi import APIRouter, HTTPException
from uuid import UUID
from app.db import get_supabase
from app.models import (
    ChatRequest, ChatResponse, ChatMessage, Guardrails, HintState,
    HintControllerInput, HintControllerOutput, Excerpt, Source
)
from app.services.retrieval import retrieve_chunks
from app.services.llm import run_hint_controller, run_student_assistant

router = APIRouter()


REFUSAL_MESSAGE = """I don't have enough information in the course materials to answer that question. 

Here's what you can do:
- Try rephrasing your question
- Ask about a specific topic from your lectures or readings
- Check if this topic is covered in your syllabus

I can only help with questions that relate to the uploaded course materials."""


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Process a chat message through the hint controller and student assistant."""
    supabase = get_supabase()
    
    # Get session info
    session = supabase.table("chat_sessions").select("*").eq(
        "id", str(request.session_id)
    ).execute()
    
    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session_data = session.data[0]
    course_id = session_data["course_id"]
    
    # Get guardrails
    guardrails_result = supabase.table("guardrails").select("config").eq(
        "course_id", course_id
    ).execute()
    
    guardrails = Guardrails(**(guardrails_result.data[0]["config"] if guardrails_result.data else {}))
    
    # Store user message
    user_msg_result = supabase.table("chat_messages").insert({
        "session_id": str(request.session_id),
        "role": "user",
        "content": request.message
    }).execute()
    
    # Retrieve relevant chunks
    excerpts = retrieve_chunks(UUID(course_id), request.message)
    
    # Calculate hint state from session history
    messages = supabase.table("chat_messages").select("role, hint_level").eq(
        "session_id", str(request.session_id)
    ).eq("role", "assistant").execute()
    
    assistant_messages = messages.data or []
    hint_levels_used = [m["hint_level"] for m in assistant_messages if m["hint_level"] is not None]
    
    hint_state = HintState(
        hint_level_used=max(hint_levels_used) if hint_levels_used else 0,
        number_of_hints_given=len(hint_levels_used)
    )
    
    # If user requested hint increase, bump the expected level
    if request.request_hint_increase and hint_state.number_of_hints_given > 0:
        hint_state.number_of_hints_given += 1
    
    # Run hint controller
    controller_input = HintControllerInput(
        student_message=request.message,
        guardrails=guardrails,
        hint_state=hint_state,
        excerpt_hit_count=len(excerpts)
    )
    
    controller_output = run_hint_controller(controller_input)
    
    # Handle refusal case
    if controller_output.action == "refuse_out_of_scope":
        # Store refusal message
        assistant_msg = supabase.table("chat_messages").insert({
            "session_id": str(request.session_id),
            "role": "assistant",
            "content": REFUSAL_MESSAGE,
            "hint_level": 0
        }).execute()
        
        return ChatResponse(
            message=ChatMessage(
                id=assistant_msg.data[0]["id"],
                session_id=request.session_id,
                role="assistant",
                content=REFUSAL_MESSAGE,
                hint_level=0,
                created_at=assistant_msg.data[0]["created_at"],
                sources=[]
            ),
            hint_level=0,
            action="refuse_out_of_scope"
        )
    
    # Run student assistant
    response_content, sources = run_student_assistant(
        student_message=request.message,
        excerpts=excerpts,
        guardrails=guardrails,
        hint_level=controller_output.hint_level,
        controller_notes=controller_output.notes_for_assistant
    )
    
    # Store assistant message
    assistant_msg = supabase.table("chat_messages").insert({
        "session_id": str(request.session_id),
        "role": "assistant",
        "content": response_content,
        "hint_level": controller_output.hint_level
    }).execute()
    
    return ChatResponse(
        message=ChatMessage(
            id=assistant_msg.data[0]["id"],
            session_id=request.session_id,
            role="assistant",
            content=response_content,
            hint_level=controller_output.hint_level,
            created_at=assistant_msg.data[0]["created_at"],
            sources=sources
        ),
        hint_level=controller_output.hint_level,
        action=controller_output.action
    )
