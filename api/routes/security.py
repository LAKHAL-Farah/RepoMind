from fastapi import APIRouter, HTTPException
from api.state import _repo_store
from api.routes.ingest import _rehydrate_repo
from openai import OpenAI
from datetime import datetime
import os
import time
import config


# Module-level NIM client (reuse across requests)
_nim_client = OpenAI(
    api_key=config.NVIDIA_API_KEY,
    base_url=config.NVIDIA_BASE_URL,
    timeout=90.0,
    max_retries=0,
)

router = APIRouter()


def _finding_to_str(finding) -> str:
    return f"[{finding.severity.upper()}] {finding.title} — {getattr(finding, 'file', '')}: {finding.description}"


def _extract_response_text(resp) -> str:
    try:
        if hasattr(resp, "output_text") and resp.output_text:
            return resp.output_text
    except Exception:
        pass
    try:
        # openai-python Responses API shape
        return resp.output[0].content[0]["text"]
    except Exception:
        pass
    try:
        return resp.choices[0].message.content
    except Exception:
        pass
    try:
        return str(resp)
    except Exception:
        return ""


@router.get("/nim/test")
def test_nim():
    start = time.time()
    try:
        response = _nim_client.chat.completions.create(
            model=config.NVIDIA_MODEL,
            messages=[{"role": "user", "content": "Say OK."}],
            max_tokens=5,
        )
        latency = round((time.time() - start) * 1000)
        try:
            content = response.choices[0].message.content.strip()
        except Exception:
            content = _extract_response_text(response).strip()
        return {
            "status": "ok",
            "model": config.NVIDIA_MODEL,
            "latency_ms": latency,
            "response": content,
        }
    except Exception as e:
        return {
            "status": "error",
            "model": config.NVIDIA_MODEL,
            "error": str(e),
        }


@router.post("/security/analyze/{repo_id}")
def analyze_with_ai(repo_id: str):
    if not _rehydrate_repo(repo_id):
        raise HTTPException(status_code=404, detail="Repo not ingested. Call /api/ingest first.")

    store = _repo_store[repo_id]
    parsed = store.get("parsed")
    findings = [f for f in store.get("findings", []) if getattr(f, "category", "") == "security"]

    # Keep the prompt tiny and high-signal
    severity_rank = {"critical": 0, "warning": 1, "info": 2}
    top_findings = sorted(
        findings,
        key=lambda f: severity_rank.get(getattr(f, "severity", "info"), 2),
    )[:5]

    if top_findings:
        findings_text = "\n".join(
            f"- [{getattr(f, 'severity', 'info').upper()}] {getattr(f, 'title', '')} ({str(getattr(f, 'file', 'N/A'))[:40]})"
            for f in top_findings
        )
    else:
        findings_text = "None detected."

    langs = (getattr(parsed, "languages", []) or ["Unknown"])[:3]

    prompt = f"""Security review for repo: {getattr(parsed, 'name', repo_id)}
Stack: {', '.join(langs)}
Files: {len(getattr(parsed, 'all_files', []))}

Top findings:
{findings_text}

Give a short security assessment in exactly 4 labeled sections:
SUMMARY: (2 sentences max)
TOP RISKS: (3 bullets max)
ACTIONS: (3 bullets max)
MISSING: (3 bullets max)
Total response: 200 words max."""

    # Diagnostic prints for env/config visibility
    print(f"[security/analyze] NVIDIA_API_KEY present: {bool(os.getenv('NVIDIA_API_KEY'))}")
    print(f"[security/analyze] NVIDIA_BASE_URL: {os.getenv('NVIDIA_BASE_URL')}")
    print(f"[security/analyze] NVIDIA_MODEL: {os.getenv('NVIDIA_MODEL') or config.NVIDIA_MODEL}")

    # Quick connectivity test to isolate routing vs NIM failures
    try:
        try:
            test_resp = _nim_client.chat.completions.create(
                model=config.NVIDIA_MODEL,
                messages=[{"role": "user", "content": "Reply with the word OK only."}],
                max_tokens=10,
            )
            try:
                test_text = test_resp.choices[0].message.content
            except Exception:
                try:
                    test_text = _extract_response_text(test_resp)
                except Exception:
                    test_text = str(test_resp)
            print(f"[security/analyze] NIM connectivity test response: {repr(test_text)}")
            if "OK" not in str(test_text):
                print("[security/analyze] NIM test did not return OK; continuing to full prompt (may still work).")
        except Exception as e:
            print(f"[security/analyze] NIM connectivity test failed: {e}")
            raise HTTPException(status_code=500, detail=f"NIM API connection failed: {str(e)}")

        # Build a more explicit prompt as requested
        parsed_repo = parsed
        findings_list = findings
        if findings_list:
            findings_text = "\n".join(
                f"[{getattr(f, 'severity', '').upper()}] {getattr(f, 'title', '')} — {getattr(f, 'file', 'N/A')}: {getattr(f, 'description', '')}"
                for f in findings_list
            )
        else:
            findings_text = "No security issues were detected by static analysis."

        full_prompt = f"""You are a senior application security engineer reviewing a software repository.

Repository: {getattr(parsed_repo, 'name', repo_id)}
Languages: {', '.join(getattr(parsed_repo, 'languages', []) or ['Unknown'])}
Total files: {len(getattr(parsed_repo, 'all_files', []))}

Static analysis findings:
{findings_text}

Provide a structured security assessment with exactly these four sections.
Use these exact section headers:

## Security Posture Summary
2-3 sentences on overall security health. Mention the most critical category.

## Top Risks
Numbered list of the 3 most important risks. Reference actual filenames.
If no issues found, describe the top 3 proactive risks for this tech stack.

## Immediate Actions
Numbered list of 3 concrete actionable steps the developer should take right now.

## Best Practices Missing
Bullet list of security best practices not found in this repository.

Be specific to this repository. Keep total response under 400 words."""

        # Call NIM for full analysis
        try:
            resp = _nim_client.chat.completions.create(
                model=config.NVIDIA_MODEL,
                messages=[{"role": "user", "content": full_prompt}],
                max_tokens=400,
            )
            try:
                analysis_text = resp.choices[0].message.content
            except Exception:
                analysis_text = _extract_response_text(resp)
            return {"analysis": analysis_text, "generated_at": datetime.utcnow().isoformat()}
        except Exception as e:
            print(f"[security/analyze] NIM call failed: {e}")
            raise HTTPException(status_code=500, detail=f"NIM API call failed: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[security/analyze] Unexpected error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
