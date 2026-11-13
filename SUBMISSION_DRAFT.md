# Final Submission Guide & Email Draft

**YGF NGO — AI Security Internship (Round 2)**  
**Deadline:** 14th November 2026, 11:59 PM IST  
**Candidate:** Daksh Kumar Shah  

---

## 1. Email Submission Details

- **To:** `infolalit409@gmail.com`
- **CC:** `ygfngo@gmail.com`
- **Subject:** `AI Security POC – Daksh Kumar Shah`

### Email Body Template:

```
Dear Hiring Team at YGF NGO,

I hope this email finds you well.

Please find my submission for Round 2 of the AI Security Internship (3 months) assignment. 

I have built a complete, end-to-end Proof of Concept (POC) simulating and mitigating the OWASP Top 10 for Large Language Model Applications (2026) and OWASP Top 10 for Agentic AI Threats (2026), evaluated across both Anthropic Claude 3.5 Sonnet and Google Gemini 1.5 Flash.

Key Deliverables Summary:
1. GitHub Repository: https://github.com/dakshshah05/owasp-ai-security-poc
   (Full codebase, FastAPI server, dark-mode cybersecurity UI, automated test suite, MCP server, and zero hardcoded credentials)

2. Technical PDF Report (9 Pages): 
   Attached: AI_Security_POC_Report_Daksh_Shah.pdf
   (Detailed breakdown of all 11 risks, before/after mitigations, empirical test results, and Claude vs. Gemini comparison matrix)

3. Empirical Results Sheet:
   Attached: results_sheet.csv
   (140 test executions across 11 OWASP categories with Risk ID, Model, Prompt, Before/After Result)

4. Demo Video Walkthrough (5–10 Minutes):
   [Insert your Google Drive / YouTube Video Link Here]
   (Live demonstration showing prompt injection, sensitive data leaks, agent path traversal, SSRF, RCE, and MCP risks with mitigations)

Technical Highlights:
• Target Application: "AcmeBot" (KB-augmented chatbot with fake corporate data) and "SecureAgent" (autonomous agent with 4 tools: read_file, send_email, call_http, execute_code).
• MCP Connection Risk: Dedicated POC showing malicious tool exfiltration, tool response prompt injection, and excessive permission abuse.
• Dual-Model Testing: Seamless runtime model switching between Claude 3.5 Sonnet and Gemini 1.5 Flash.
• Mitigation Efficacy: Implemented deterministic input pattern filters, egress regex redactors, canonical path traversal checks, and capability sandboxing achieving 100% attack mitigation across all 140 test runs.
• Rules & Safety Compliance: Tested strictly with synthetic data, simulated sandboxed tools, and harmless proof tokens (SECRET-FLAG-123-*).

I have also submitted these details via the required Google Form.

Thank you for this challenging and engaging assignment. I look forward to hearing your feedback and discussing how I can contribute to AI Security initiatives at YGF NGO.

Best regards,
Daksh Kumar Shah
Aspiring Software Developer | AI Security & Full-Stack Development
GitHub: https://github.com/dakshshah05
Portfolio: https://3-d-portfolio-lime-kappa.vercel.app/
LinkedIn: https://www.linkedin.com/in/daksh-kumar-shah/
```

---

## 2. Google Form Submission Checklist

**Google Form Link:**  
https://docs.google.com/forms/d/e/1FAIpQLSeAVR9QBLuQKnH3L5Rgkapb_yQHW4ocoHnTsMweJ6yf1GHVYA/viewform?usp=publish-editor

Fields to fill:
- **Full Name:** Daksh Kumar Shah
- **Email:** [Your email, e.g. dakshkshah05@gmail.com]
- **GitHub Repository URL:** Link to your pushed GitHub repository
- **PDF Report:** Upload `AI_Security_POC_Report_Daksh_Shah.pdf` (located in `d:\YGF\ai-security-poc\results\`)
- **Demo Video URL:** Paste your Google Drive / YouTube link
- **Results Sheet:** Upload or link `results_sheet.csv` (located in `d:\YGF\ai-security-poc\results\`)
