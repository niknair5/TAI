HINT_LEVEL_NAMES = {
    0: "concept-only hints",
    1: "gentle hints",
    2: "structured hints",
    3: "worked examples",
}


POLICY_TEMPLATES = {
    "hint_level_exceeded": (
        "You asked for a level {raw_level} hint ({raw_level_name}), "
        "but your instructor has set the maximum to level {max_level} "
        "({max_level_name}) for this assignment."
    ),
    "code_not_allowed": (
        "You requested code. Your instructor has disabled code generation "
        "for this course to support independent problem solving."
    ),
    "worked_example_not_allowed": (
        "You asked for a worked example. Your instructor has configured "
        "this assistant to provide hints without full worked examples "
        "for this assignment."
    ),
}


def build_policy_acknowledgment(
    breaches: list[str],
    raw_hint_level: int,
    max_hint_level: int,
    instructor_note: str | None,
) -> str:
    """Build a deterministic, template-driven policy acknowledgment string."""
    parts: list[str] = []

    for breach in breaches:
        template = POLICY_TEMPLATES.get(breach)
        if template and breach == "hint_level_exceeded":
            parts.append(template.format(
                raw_level=raw_hint_level,
                raw_level_name=HINT_LEVEL_NAMES.get(raw_hint_level, f"level {raw_hint_level}"),
                max_level=max_hint_level,
                max_level_name=HINT_LEVEL_NAMES.get(max_hint_level, f"level {max_hint_level}"),
            ))
        elif template:
            parts.append(template)

    if instructor_note:
        parts.append(f"Note from your instructor: {instructor_note}")

    return "\n\n".join(parts)


SOCRATIC_REDIRECT_PROMPT = """Role
You are TA-I, providing a Socratic redirect after a policy acknowledgment has already been shown to the student. The acknowledgment is handled separately — do NOT repeat or reference it. Your job is to pivot the conversation into a productive learning moment at the allowed hint level.

You will receive:
STUDENT_MESSAGE: what the student originally asked
ALLOWED_HINT_LEVEL: the maximum level you can provide (0-3)
EXCERPTS: relevant course material

Hint levels
0, Concept only. Explain the underlying concept and relevant definitions. Ask the student what they already know.
1, Gentle hint. Give a small nudge toward the approach without calculations or final form.
2, Structured hint. Provide a short plan with 2 to 5 abstract steps, no plugging in exact numbers.
3, Worked example with different numbers or scenario. Do not solve the student's exact instance.

Your response must:
1. Reference the student's actual question — do not give a generic prompt
2. Ask what the student already understands about the underlying concept
3. Provide a conceptual nudge using the course material at the allowed hint level
4. End with a guiding question that moves the student toward the answer

Do NOT:
- Repeat, reference, or apologize about the policy restriction
- Provide help beyond the allowed hint level
- Use information not in the excerpts
- Include a Sources section — the system handles that separately"""
