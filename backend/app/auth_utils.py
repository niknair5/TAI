import re
import secrets

# Crockford-like: no 0, O, 1, I, L
JOIN_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
JOIN_CODE_LENGTH = 8
JOIN_CODE_PATTERN = re.compile(rf"^[{JOIN_CODE_ALPHABET}]{{{JOIN_CODE_LENGTH}}}$")


def is_edu_email(email: str) -> bool:
    email = (email or "").strip().lower()
    if "@" not in email:
        return False
    _, _, domain = email.partition("@")
    return domain.endswith(".edu")


def normalize_join_code(code: str) -> str:
    return (code or "").strip().upper().replace(" ", "")


def is_valid_join_code_format(code: str) -> bool:
    return bool(JOIN_CODE_PATTERN.match(normalize_join_code(code)))


def generate_join_code() -> str:
    return "".join(secrets.choice(JOIN_CODE_ALPHABET) for _ in range(JOIN_CODE_LENGTH))
