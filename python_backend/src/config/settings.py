"""
Configuration Settings
Using Pydantic Settings v2.6+ for environment variable management
"""
import re
from typing import Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Server Configuration
    HOST: str = Field(default="0.0.0.0", description="Server host")
    PORT: int = Field(default=8000, description="Server port")
    DEBUG: bool = Field(default=False, description="Debug mode")
    
    # AI Provider API Keys
    GOOGLE_API_KEY: Optional[str] = Field(default=None, description="Google/Gemini API key")
    GEMINI_API_KEY: Optional[str] = Field(default=None, description="Gemini API key (alias)")
    OPENAI_API_KEY: Optional[str] = Field(default=None, description="OpenAI API key")
    ANTHROPIC_API_KEY: Optional[str] = Field(default=None, description="Anthropic/Claude API key")
    GROQ_API_KEY: Optional[str] = Field(default=None, description="Groq API key")
    DEEPSEEK_API_KEY: Optional[str] = Field(default=None, description="DeepSeek API key")
    ELEVENLABS_API_KEY: Optional[str] = Field(default=None, description="ElevenLabs API key")
    
    # Supabase Configuration
    SUPABASE_URL: Optional[str] = Field(default=None, description="Supabase project URL")
    SUPABASE_KEY: Optional[str] = Field(default=None, description="Supabase anon key")
    SUPABASE_SERVICE_KEY: Optional[str] = Field(default=None, description="Supabase service role key")
    
    # Database Configuration (for LangGraph checkpointer)
    DATABASE_URL: Optional[str] = Field(
        default=None,
        description="PostgreSQL connection string for LangGraph checkpointer"
    )
    
    # App Configuration
    APP_URL: str = Field(default="http://localhost:3000", description="Frontend app URL")
    
    @field_validator('APP_URL', mode='before')
    @classmethod
    def normalize_app_url(cls, v: str) -> str:
        """
        Transform Render's internal URL format to external HTTPS URL.
        Examples:
            - 'content-creator-frontend-xlki' -> 'https://content-creator-frontend-xlki.onrender.com'
            - 'http://localhost:3000' -> 'http://localhost:3000' (unchanged)
        """
        if not v:
            return "http://localhost:3000"
        
        url = v.strip()
        
        # Handle Render's internal format (no protocol, no dots)
        if '://' not in url and 'localhost' not in url and '127.0.0.1' not in url:
            # Remove port if present (e.g., ":8000")
            url = re.sub(r':\d+$', '', url)
            # Add .onrender.com if not already a full domain
            if '.' not in url:
                url = f"{url}.onrender.com"
            # Add https:// for production
            url = f"https://{url}"
        elif not url.startswith('http://') and not url.startswith('https://'):
            # URL without protocol
            if 'localhost' in url or '127.0.0.1' in url:
                url = f"http://{url}"
            else:
                url = f"https://{url}"
        
        # Remove trailing slash
        return url.rstrip('/')
    
    # Social Platform OAuth Credentials
    FACEBOOK_CLIENT_ID: Optional[str] = Field(default=None, description="Facebook App ID")
    FACEBOOK_CLIENT_SECRET: Optional[str] = Field(default=None, description="Facebook App Secret")
    INSTAGRAM_CLIENT_ID: Optional[str] = Field(default=None, description="Instagram Client ID")
    INSTAGRAM_CLIENT_SECRET: Optional[str] = Field(default=None, description="Instagram Client Secret")
    LINKEDIN_CLIENT_ID: Optional[str] = Field(default=None, description="LinkedIn Client ID")
    LINKEDIN_CLIENT_SECRET: Optional[str] = Field(default=None, description="LinkedIn Client Secret")
    TWITTER_CLIENT_ID: Optional[str] = Field(default=None, description="Twitter Client ID")
    TWITTER_CLIENT_SECRET: Optional[str] = Field(default=None, description="Twitter Client Secret")
    TIKTOK_CLIENT_ID: Optional[str] = Field(default=None, description="TikTok Client Key")
    TIKTOK_CLIENT_SECRET: Optional[str] = Field(default=None, description="TikTok Client Secret")
    YOUTUBE_CLIENT_ID: Optional[str] = Field(default=None, description="YouTube/Google Client ID")
    YOUTUBE_CLIENT_SECRET: Optional[str] = Field(default=None, description="YouTube/Google Client Secret")
    
    # Twitter API Keys (alternative naming for OAuth 1.0a)
    TWITTER_API_KEY: Optional[str] = Field(default=None, description="Twitter API Key (OAuth 1.0a)")
    TWITTER_API_SECRET: Optional[str] = Field(default=None, description="Twitter API Secret (OAuth 1.0a)")
    
    # Canva Integration
    CANVA_CLIENT_ID: Optional[str] = Field(default=None, description="Canva Client ID")
    CANVA_CLIENT_SECRET: Optional[str] = Field(default=None, description="Canva Client Secret")

    
    # Model Configuration Defaults
    DEFAULT_MODEL_ID: str = Field(
        default="google-genai:gemini-3-flash-preview",
        description="Default LLM model ID"
    )
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",  # Ignore extra fields in .env
    )
    
    @property
    def gemini_key(self) -> Optional[str]:
        """Get Gemini API key (supports both GOOGLE_API_KEY and GEMINI_API_KEY)"""
        return self.GOOGLE_API_KEY or self.GEMINI_API_KEY
    
    def get_api_key(self, provider: str) -> Optional[str]:
        """Get API key for a specific provider"""
        key_map = {
            "openai": self.OPENAI_API_KEY,
            "anthropic": self.ANTHROPIC_API_KEY,
            "google": self.gemini_key,
            "google-genai": self.gemini_key,
            "groq": self.GROQ_API_KEY,
            "deepseek": self.DEEPSEEK_API_KEY,
            "elevenlabs": self.ELEVENLABS_API_KEY,
        }
        return key_map.get(provider.lower())


# Global settings instance
settings = Settings()
