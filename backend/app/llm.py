"""LLM provider abstraction.

A single `generate()` interface with two interchangeable implementations:

* AnthropicProvider - real LLM calls via the official SDK.
* MockProvider      - deterministic, offline output so the whole slice runs
                      from a clean clone with no API key. Mock output is
                      clearly flagged (is_mock=True) and recorded as such in
                      the audit trail, so a stub is never disguised as real.

Adding OpenAI (or any provider) is just another subclass implementing
`generate()` — nothing else in the app changes.
"""
from __future__ import annotations

from dataclasses import dataclass

from .config import settings


@dataclass
class LLMResult:
    text: str
    model: str
    is_mock: bool
    prompt: str


class LLMProvider:
    def generate(self, prompt: str, *, system: str = "", max_tokens: int | None = None) -> LLMResult:
        raise NotImplementedError


class MockProvider(LLMProvider):
    """Deterministic offline provider. No network, no key required."""

    model_name = "mock-llm-v1"

    def generate(self, prompt: str, *, system: str = "", max_tokens: int | None = None) -> LLMResult:
        # Intentionally simple and deterministic. The real provider replaces
        # this verbatim; the audit/governance path is identical either way.
        text = (
            "[MOCK OUTPUT — no LLM key configured]\n"
            "Generated from the prompt below using a deterministic template so "
            "the slice runs offline.\n\n"
            f"{prompt.strip()[:800]}"
        )
        return LLMResult(text=text, model=self.model_name, is_mock=True, prompt=prompt)


class AnthropicProvider(LLMProvider):
    def __init__(self) -> None:
        # Imported lazily so the app does not hard-depend on the SDK when the
        # mock provider is in use.
        from anthropic import Anthropic

        self._client = Anthropic(api_key=settings.anthropic_api_key)
        self.model_name = settings.anthropic_model

    def generate(self, prompt: str, *, system: str = "", max_tokens: int | None = None) -> LLMResult:
        msg = self._client.messages.create(
            model=self.model_name,
            max_tokens=max_tokens or settings.llm_max_tokens,
            system=system or "You are a helpful assistant.",
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(block.text for block in msg.content if block.type == "text")
        return LLMResult(text=text, model=self.model_name, is_mock=False, prompt=prompt)


def get_provider() -> LLMProvider:
    """Resolve the active provider from settings, with a safe fallback."""
    choice = settings.llm_provider.lower()
    if choice == "mock":
        return MockProvider()
    if choice in {"anthropic", "auto"} and settings.anthropic_api_key:
        try:
            return AnthropicProvider()
        except Exception:  # SDK missing or misconfigured -> degrade, don't crash
            return MockProvider()
    # "auto" with no key, or "anthropic" with no key -> mock
    return MockProvider()
