import os

from dotenv import load_dotenv

load_dotenv()


def _get_bool(name: str, default: bool) -> bool:
    v = os.getenv(name)
    if v is None:
        return default
    return v.strip().lower() in {"1", "true", "yes", "y", "on"}


class Settings:
    def __init__(self) -> None:
        self.openai_api_key = os.getenv("OPENAI_API_KEY") or None
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
        self.gemini_api_key = os.getenv("GEMINI_API_KEY") or None
        self.gemini_model = os.getenv("GEMINI_MODEL", "gemini-flash-latest")
        self.mock_analysis = _get_bool("MOCK_ANALYSIS", False)
        self.allowed_origins = os.getenv(
            "ALLOWED_ORIGINS",
            ",".join(
                [
                    "http://localhost:3000",
                    "http://127.0.0.1:3000",
                    "http://localhost:3002",
                    "http://127.0.0.1:3002",
                    "https://taan1el.github.io",
                ]
            ),
        )

    @property
    def has_llm_credentials(self) -> bool:
        return bool(self.gemini_api_key or self.openai_api_key)

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


settings = Settings()
