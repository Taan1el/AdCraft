from starlette.applications import Starlette
from starlette.middleware.cors import CORSMiddleware
from starlette.routing import Route

from app.api.routes.analyze import analyze
from app.api.routes.health import health
from app.core.config import settings


def create_app() -> Starlette:
    routes = [
        Route("/health", endpoint=health, methods=["GET"]),
        Route("/analyze", endpoint=analyze, methods=["POST"]),
    ]
    app = Starlette(debug=True, routes=routes)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    return app


app = create_app()

