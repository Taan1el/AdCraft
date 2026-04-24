"""Reload API stack so `Settings` picks up the current process environment."""

from __future__ import annotations

import importlib


def reload_analysis_stack():
    import app.core.config as cfg

    importlib.reload(cfg)
    import app.services.analysis_pipeline as pipe

    importlib.reload(pipe)
    import app.api.routes.analyze as analyze_mod

    importlib.reload(analyze_mod)
    import app.main as main_mod

    importlib.reload(main_mod)
    return main_mod.app
