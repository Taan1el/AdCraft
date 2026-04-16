from starlette.responses import JSONResponse


async def health(request) -> JSONResponse:  # type: ignore[no-untyped-def]
    return JSONResponse({"ok": True})

