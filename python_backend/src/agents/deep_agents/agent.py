#!/usr/bin/env python3
"""
Content Writer Agent

A content writer agent configured entirely through files on disk:
- AGENTS.md defines brand voice and style guide
- skills/ provides specialized workflows (blog posts, social media)
- skills/*/scripts/ provides tools bundled with each skill
- subagents handle research and other delegated tasks

Reference: https://github.com/langchain-ai/deepagents/tree/master/examples/content-builder-agent

Usage:
    # Via FastAPI endpoint
    POST /api/v1/deep-agents/chat
"""

import os
import yaml
from pathlib import Path
from typing import Literal

from langchain_core.tools import tool
from deepagents import create_deep_agent
from deepagents.backends import FilesystemBackend

# Directory containing this agent's files
AGENT_DIR = Path(__file__).parent


# =============================================================================
# Tools
# =============================================================================

@tool
def web_search(
    query: str,
    max_results: int = 5,
    topic: Literal["general", "news"] = "general",
) -> dict:
    """Search the web for current information.

    Args:
        query: The search query (be specific and detailed)
        max_results: Number of results to return (default: 5)
        topic: "general" for most queries, "news" for current events

    Returns:
        Search results with titles, URLs, and content excerpts.
    """
    try:
        from tavily import TavilyClient

        api_key = os.environ.get("TAVILY_API_KEY")
        if not api_key:
            return {"error": "TAVILY_API_KEY not set"}

        client = TavilyClient(api_key=api_key)
        return client.search(query, max_results=max_results, topic=topic)
    except Exception as e:
        return {"error": f"Search failed: {e}"}


@tool
def generate_cover(prompt: str, slug: str) -> str:
    """Generate a cover image for a blog post.

    Args:
        prompt: Detailed description of the image to generate.
        slug: Blog post slug. Image saves to blogs/<slug>/hero.png
    """
    try:
        from google import genai

        client = genai.Client()
        response = client.models.generate_content(
            model="gemini-2.5-flash-image",
            contents=[prompt],
        )

        for part in response.parts:
            if part.inline_data is not None:
                image = part.as_image()
                output_path = AGENT_DIR / "blogs" / slug / "hero.png"
                output_path.parent.mkdir(parents=True, exist_ok=True)
                image.save(str(output_path))
                return f"Image saved to {output_path}"

        return "No image generated"
    except Exception as e:
        return f"Error: {e}"


@tool
def generate_social_image(prompt: str, platform: str, slug: str) -> str:
    """Generate an image for a social media post.

    Args:
        prompt: Detailed description of the image to generate.
        platform: Either "linkedin" or "tweets"
        slug: Post slug. Image saves to <platform>/<slug>/image.png
    """
    try:
        from google import genai

        client = genai.Client()
        response = client.models.generate_content(
            model="gemini-2.5-flash-image",
            contents=[prompt],
        )

        for part in response.parts:
            if part.inline_data is not None:
                image = part.as_image()
                output_path = AGENT_DIR / platform / slug / "image.png"
                output_path.parent.mkdir(parents=True, exist_ok=True)
                image.save(str(output_path))
                return f"Image saved to {output_path}"

        return "No image generated"
    except Exception as e:
        return f"Error: {e}"


# =============================================================================
# Subagent Loader
# =============================================================================

def load_subagents(config_path: Path) -> list:
    """Load subagent definitions from YAML and wire up tools.

    NOTE: This is a custom utility for this example. Unlike `memory` and `skills`,
    deepagents doesn't natively load subagents from files - they're normally
    defined inline in the create_deep_agent() call. We externalize to YAML here
    to keep configuration separate from code.
    """
    # Map tool names to actual tool objects
    available_tools = {
        "web_search": web_search,
    }

    with open(config_path) as f:
        config = yaml.safe_load(f)

    subagents = []
    for name, spec in config.items():
        subagent = {
            "name": name,
            "description": spec["description"],
            "system_prompt": spec["system_prompt"],
        }
        if "model" in spec:
            subagent["model"] = spec["model"]
        if "tools" in spec:
            subagent["tools"] = [available_tools[t] for t in spec["tools"]]
        subagents.append(subagent)

    return subagents


# =============================================================================
# Agent Factory
# =============================================================================

def create_content_writer():
    """Create a content writer agent configured by filesystem files."""
    return create_deep_agent(
        model="google_genai:gemini-2.5-flash",  # Use Gemini instead of default Claude
        memory=["./AGENTS.md"],           # Loaded by MemoryMiddleware
        skills=["./skills/"],             # Loaded by SkillsMiddleware
        tools=[generate_cover, generate_social_image],  # Image generation
        subagents=load_subagents(AGENT_DIR / "subagents.yaml"),  # Custom helper
        backend=FilesystemBackend(root_dir=AGENT_DIR, virtual_mode=True),  # virtual_mode for Windows
    )


# Global agent instance
_agent = None


def get_agent():
    """Get or create the content writer agent."""
    global _agent
    if _agent is None:
        _agent = create_content_writer()
    return _agent
