from supabase import create_client, Client
from app.config import get_settings
import os

_client: Client | None = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        settings = get_settings()
        # Debug: print what we're getting
        print(f"DEBUG: SUPABASE_URL = {settings.supabase_url}")
        print(f"DEBUG: Key starts with = {settings.supabase_service_key[:20]}...")
        print(f"DEBUG: Key length = {len(settings.supabase_service_key)}")
        print(f"DEBUG: Raw env SUPABASE_SERVICE_KEY starts with = {os.environ.get('SUPABASE_SERVICE_KEY', 'NOT SET')[:20]}...")
        _client = create_client(settings.supabase_url, settings.supabase_service_key)
    return _client
