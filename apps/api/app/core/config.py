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
        self.debug = _get_bool("DEBUG", False)
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
        # Starlette's CORSMiddleware matches allow_origins against the request's
        # Origin header by *exact string*. Browsers never send a trailing slash
        # (the Origin is scheme://host[:port] only), so an entry like
        # "https://taan1el.github.io/" would silently never match and the
        # deployed frontend gets CORS-blocked with no server-side error. Strip a
        # trailing slash from each entry and drop duplicates while preserving
        # order so a misconfigured env var can't quietly break CORS.
        seen: set[str] = set()
        origins: list[str] = []
        for raw in self.allowed_origins.split(","):
            origin = raw.strip().rstrip("/")
            if origin and origin not in seen:
                seen.add(origin)
                origins.append(origin)
        return origins


settings = Settings()
