"""
main.py — FastAPI backend for the AI Security POC Dashboard
Serves the web UI and provides REST APIs for attack demos.
"""
import sys
import os
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "attacks"))

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import json
import csv
from io import StringIO
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

from model_provider import get_llm_response, list_available_models
from chatbot import chat
from agent import run_agent
from mitigations import apply_all_mitigations
from all_attacks import (
    run_llm01, run_llm02, run_llm03, run_llm08, run_llm10,
    run_asi01, run_asi02, run_asi03, run_asi05, run_asi06, run_mcp,
    LLM01_CASES, LLM02_CASES, LLM03_CASES, LLM08_CASES, LLM10_CASES,
    ASI01_CASES, ASI02_CASES, ASI03_CASES, ASI05_CASES, ASI06_CASES, MCP_CASES,
)

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"
RESULTS_DIR = Path(__file__).parent.parent / "results"
RESULTS_DIR.mkdir(exist_ok=True)

app = FastAPI(
    title="OWASP AI Security POC",
    description="Proof of concept demonstrating OWASP LLM Top 10 and Agentic AI Top 10 risks",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


# ─── Pydantic Models ──────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    model: str = "claude-3-5-sonnet"
    mitigation_enabled: bool = False
    conversation_history: Optional[List[dict]] = None


class AgentRequest(BaseModel):
    task: str
    model: str = "claude-3-5-sonnet"
    mitigation_enabled: bool = False


class AttackRequest(BaseModel):
    risk_id: str
    model: str = "claude-3-5-sonnet"
    mitigation_enabled: bool = False


class RunAllRequest(BaseModel):
    models: List[str] = ["claude-3-5-sonnet", "gemini-1.5-flash"]
    risks: Optional[List[str]] = None
    mitigation_states: List[bool] = [False, True]


ATTACK_RUNNERS = {
    "LLM01": (run_llm01, LLM01_CASES),
    "LLM02": (run_llm02, LLM02_CASES),
    "LLM03": (run_llm03, LLM03_CASES),
    "LLM08": (run_llm08, LLM08_CASES),
    "LLM10": (run_llm10, LLM10_CASES),
    "ASI01": (run_asi01, ASI01_CASES),
    "ASI02": (run_asi02, ASI02_CASES),
    "ASI03": (run_asi03, ASI03_CASES),
    "ASI05": (run_asi05, ASI05_CASES),
    "ASI06": (run_asi06, ASI06_CASES),
    "MCP":   (run_mcp, MCP_CASES),
}

RISK_METADATA = {
    "LLM01": {"title": "Prompt Injection", "category": "LLM", "severity": "Critical"},
    "LLM02": {"title": "Sensitive Information Disclosure", "category": "LLM", "severity": "High"},
    "LLM03": {"title": "Excessive Agency", "category": "LLM", "severity": "High"},
    "LLM08": {"title": "Hidden Context Exposure", "category": "LLM", "severity": "Medium"},
    "LLM10": {"title": "Improper Output Handling", "category": "LLM", "severity": "High"},
    "ASI01": {"title": "Agent Goal Hijack", "category": "Agentic", "severity": "Critical"},
    "ASI02": {"title": "Tool Misuse", "category": "Agentic", "severity": "Critical"},
    "ASI03": {"title": "Identity & Privilege Abuse", "category": "Agentic", "severity": "High"},
    "ASI05": {"title": "Unexpected Code Execution", "category": "Agentic", "severity": "Critical"},
    "ASI06": {"title": "Memory & Context Poisoning", "category": "Agentic", "severity": "High"},
    "MCP":   {"title": "MCP Connection Risk", "category": "Bonus", "severity": "Critical"},
}


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def serve_ui():
    """Serve the main dashboard."""
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return HTMLResponse(content=index_path.read_text(encoding="utf-8"))
    return HTMLResponse(content="<h1>Frontend not found. Run from project root.</h1>")


@app.get("/api/models")
async def get_models():
    """List available models."""
    return list_available_models()


@app.get("/api/risks")
async def get_risks():
    """List all risk IDs with metadata."""
    return [
        {"id": risk_id, **meta, "case_count": len(ATTACK_RUNNERS[risk_id][1])}
        for risk_id, meta in RISK_METADATA.items()
    ]


@app.get("/api/risks/{risk_id}/cases")
async def get_risk_cases(risk_id: str):
    """Get test cases for a specific risk."""
    if risk_id not in ATTACK_RUNNERS:
        raise HTTPException(status_code=404, detail=f"Risk {risk_id} not found")
    _, cases = ATTACK_RUNNERS[risk_id]
    return {"risk_id": risk_id, "cases": cases}


@app.post("/api/chat")
async def chatbot_endpoint(request: ChatRequest):
    """Chat with the vulnerable/secured chatbot."""
    try:
        result = chat(
            user_message=request.message,
            model=request.model,
            conversation_history=request.conversation_history,
            mitigation_enabled=request.mitigation_enabled,
        )
        return {
            "text": result.get("text", ""),
            "model": result.get("model", request.model),
            "provider": result.get("provider", "unknown"),
            "blocked": result.get("blocked", False),
            "is_mock": result.get("is_mock", False),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/agent")
async def agent_endpoint(request: AgentRequest):
    """Run the AI agent with a task."""
    try:
        result = run_agent(
            task=request.task,
            model=request.model,
            mitigation_enabled=request.mitigation_enabled,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/attack")
async def run_attack(request: AttackRequest):
    """Run attack tests for a specific risk."""
    if request.risk_id not in ATTACK_RUNNERS:
        raise HTTPException(status_code=404, detail=f"Risk {request.risk_id} not found")

    runner, _ = ATTACK_RUNNERS[request.risk_id]
    try:
        results = runner(model=request.model, mitigation=request.mitigation_enabled)
        return {"risk_id": request.risk_id, "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/run-all")
async def run_all_attacks(request: RunAllRequest):
    """Run all attacks on all specified models."""
    all_results = []
    risks = request.risks or list(ATTACK_RUNNERS.keys())

    for model in request.models:
        for risk_id in risks:
            if risk_id not in ATTACK_RUNNERS:
                continue
            runner, _ = ATTACK_RUNNERS[risk_id]
            for mit in request.mitigation_states:
                try:
                    results = runner(model=model, mitigation=mit)
                    all_results.extend(results)
                except Exception as e:
                    all_results.append({
                        "risk_id": risk_id,
                        "model": model,
                        "mitigation": mit,
                        "error": str(e),
                        "result": "Error",
                    })

    # Save to file
    _save_results(all_results)
    return {"total": len(all_results), "results": all_results}


@app.get("/api/results")
async def get_results():
    """Get the latest test results."""
    result_files = sorted(RESULTS_DIR.glob("results_*.json"), reverse=True)
    if not result_files:
        return {"results": [], "message": "No results yet. Run the full test suite first."}

    with open(result_files[0], encoding="utf-8") as f:
        data = json.load(f)
    return {"results": data, "file": result_files[0].name}


@app.get("/api/results/csv")
async def download_results_csv():
    """Download the latest results as CSV."""
    result_files = sorted(RESULTS_DIR.glob("results_*.json"), reverse=True)
    if not result_files:
        raise HTTPException(status_code=404, detail="No results found")

    with open(result_files[0], encoding="utf-8") as f:
        data = json.load(f)

    # Convert to CSV
    output = StringIO()
    fields = ["risk_id", "case_id", "name", "model", "mitigation", "prompt", "response_preview", "result", "mitigation_desc"]
    writer = csv.DictWriter(output, fieldnames=fields)
    writer.writeheader()
    for row in data:
        filtered = {k: row.get(k, "") for k in fields}
        writer.writerow(filtered)

    from fastapi.responses import Response
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=owasp_ai_results.csv"},
    )


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "version": "1.0.0",
        "risks_available": len(ATTACK_RUNNERS),
        "models_available": list_available_models(),
    }


def _save_results(results: list):
    from datetime import datetime
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = RESULTS_DIR / f"results_{ts}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    # Also save CSV
    csv_path = RESULTS_DIR / f"results_{ts}.csv"
    fields = ["risk_id", "case_id", "name", "model", "mitigation", "prompt", "response_preview", "result", "mitigation_desc"]
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for row in results:
            filtered = {k: row.get(k, "") for k in fields}
            writer.writerow(filtered)


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("APP_HOST", "0.0.0.0")
    port = int(os.getenv("APP_PORT", 8000))
    uvicorn.run("main:app", host=host, port=port, reload=True)
