"""
Playwright Browser Tools for Content Strategist Agent

Using official LangChain pattern with VISIBLE browser for watching agent.
Config: headless=False + slow_mo for easy viewing.
"""

import logging
from typing import List, Optional
from langchain_core.tools import BaseTool

logger = logging.getLogger(__name__)

# Lazy initialization
_browser_tools: Optional[List[BaseTool]] = None
_async_browser = None


async def get_browser_tools() -> List[BaseTool]:
    """
    Get Playwright browser tools with VISIBLE browser.
    
    Browser opens in a window so you can watch the agent work.
    slow_mo adds 500ms delay between actions for visibility.
    """
    global _browser_tools, _async_browser
    
    if _browser_tools is not None:
        return _browser_tools
    
    try:
        from playwright.async_api import async_playwright
        from langchain_community.agent_toolkits import PlayWrightBrowserToolkit
        
        # Start playwright directly with custom options for visibility
        playwright = await async_playwright().start()
        
        # Launch VISIBLE browser with slow motion for watching
        _async_browser = await playwright.chromium.launch(
            headless=False,  # Show browser window
            slow_mo=500,     # 500ms delay between actions - easy to watch
            args=[
                '--start-maximized',  # Start maximized
                '--disable-blink-features=AutomationControlled',  # Less bot-like
            ]
        )
        
        # Create a new page with larger viewport
        context = await _async_browser.new_context(
            viewport={'width': 1280, 'height': 800}
        )
        await context.new_page()
        
        # Create toolkit from browser
        toolkit = PlayWrightBrowserToolkit.from_browser(async_browser=_async_browser)
        _browser_tools = toolkit.get_tools()
        
        logger.info(f"Browser tools loaded (VISIBLE mode): {[t.name for t in _browser_tools]}")
        return _browser_tools
        
    except Exception as e:
        logger.error(f"Failed to load browser tools: {e}")
        return []


# For import compatibility
browser_tools: List[BaseTool] = []
