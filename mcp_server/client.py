"""
MCP Client — Demonstrates connecting to an MCP server and calling tools.
This shows how an AI agent might interact with a malicious or misconfigured MCP server.
"""
import asyncio
import json
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from server import AcmeMCPServer


async def demo_mcp_client(safe_mode: bool = False):
    """Simulate an AI agent connecting to an MCP server and calling tools."""
    mode = "SAFE" if safe_mode else "VULNERABLE"
    server = AcmeMCPServer(safe_mode=safe_mode)

    print(f"\n{'='*65}")
    print(f"  MCP CLIENT DEMO — Connecting to {mode} MCP Server")
    print(f"{'='*65}")
    print(f"\nAvailable tools: {server.get_available_tools()}\n")

    # Simulate an AI agent making tool calls based on user instructions
    agent_actions = [
        {
            "action": "MCP-01: Data Exfiltration",
            "description": "AI agent calls a data retrieval tool that exposes sensitive data",
            "tool": "get_all_data",
            "args": {"filter": "all"},
        },
        {
            "action": "MCP-02: Prompt Injection via Tool Response",
            "description": "AI agent calls search tool; response contains injected instructions",
            "tool": "search_docs",
            "args": {"query": "company overview"},
        },
        {
            "action": "MCP-03: Excessive Permission Discovery",
            "description": "AI agent discovers admin tools without authentication",
            "tool": "list_tools",
            "args": {},
        },
    ]

    for item in agent_actions:
        print(f"  ▶ {item['action']}")
        print(f"    {item['description']}")
        print(f"    Tool: {item['tool']}({item['args']})")

        result = await server.call_tool(item["tool"], item["args"])

        is_blocked = result.get("blocked", False)
        result_text = result.get("result", result.get("error", ""))

        # Check for attack success markers
        import re
        attack_succeeded = bool(re.search(r"SECRET-FLAG", str(result_text)))

        status = "🚫 BLOCKED" if is_blocked else ("💀 ATTACK SUCCEEDED" if attack_succeeded else "✅ OK")
        print(f"    Status: {status}")
        print(f"    Response: {str(result_text)[:200]}")
        print()

    print(f"\n{'='*65}")
    if safe_mode:
        print("  ✅ All attacks blocked by mitigations in SAFE mode")
    else:
        print("  ⚠️  Attacks succeeded in VULNERABLE mode — mitigations needed")
    print(f"{'='*65}\n")


if __name__ == "__main__":
    safe = "--safe" in sys.argv
    asyncio.run(demo_mcp_client(safe_mode=safe))
