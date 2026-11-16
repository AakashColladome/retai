from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    MONGODB_URI: str = "mongodb://127.0.0.1:27017/retai_hospitality?retryWrites=true&w=majority"
    DATABASE_NAME: str = "retai_hospitality"

    JWT_SECRET: str = "retai-hospitality-os-jwt-secret-key-2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    DEMO_MODE: bool = True

    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-haiku-5-5"
    ANTHROPIC_UPSELL_MODEL: str = "claude-sonnet-5-5"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
