/* ══════════════════════════════════════════════════════════════
   OWASP AI Security POC — Frontend JavaScript
   ══════════════════════════════════════════════════════════════ */

const API = '';  // Same origin
let currentRisk = 'LLM01';
let compareMode = 'before';
let mcpMode = 'vulnerable';
let chatHistory = [];

const RISK_DESCRIPTIONS = {
  LLM01: 'Direct and indirect prompt injection attacks to override model instructions.',
  LLM02: 'Attacks that extract PII, credentials, and sensitive data from the LLM context.',
  LLM03: 'The LLM takes excessive autonomous actions beyond its intended scope.',
  LLM08: 'Attacks that expose system prompts, hidden instructions, or injected context.',
  LLM10: 'LLM output contains dangerous content like XSS, path traversal, or commands.',
  ASI01: 'The agent\'s primary goal is overridden by malicious instructions.',
  ASI02: 'Agent tools are exploited for path traversal, SSRF, email exfil, or RCE.',
  ASI03: 'Attackers claim elevated identity or privileges to manipulate the agent.',
  ASI05: 'Arbitrary code execution through the agent\'s tools or template injection.',
  ASI06: 'The agent\'s memory or context is poisoned with false or malicious entries.',
  MCP: 'MCP servers expose dangerous tools, inject prompts via tool responses, or lack authorization.',
};

// ─── Tab Navigation ───────────────────────────────────────────

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabId = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-panel-${tabId}`).classList.add('active');
  });
});

// ─── Global Model & Mitigation ────────────────────────────────

function getModel() {
  return document.getElementById('global-model').value;
}

function getMitigation() {
  return document.getElementById('mitigation-switch').checked;
}

document.getElementById('mitigation-switch').addEventListener('change', (e) => {
  const on = e.target.checked;
  document.getElementById('mitigation-status').textContent = on ? 'ON' : 'OFF';
  document.getElementById('mitigation-status').className = `badge ${on ? 'badge-success' : 'badge-danger'}`;
  updateToolRiskLabels(on);
});

function updateToolRiskLabels(mitigationOn) {
  const risks = document.querySelectorAll('.tool-risk');
  risks.forEach(el => {
    if (mitigationOn) {
      el.classList.add('safe');
      el.textContent = el.textContent.replace('⚠️', '✅').replace('risk', 'protected');
    } else {
      el.classList.remove('safe');
      const tool = el.id.replace('tool-', '').replace('-risk', '');
      const riskMap = { read: 'Path traversal risk', email: 'Exfiltration risk', http: 'SSRF risk', code: 'RCE risk' };
      el.textContent = `⚠️ ${riskMap[tool] || 'risk'}`;
    }
  });
}

// ─── Dashboard ────────────────────────────────────────────────

function openAttackTab(riskId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-tab="attacks"]').classList.add('active');
  document.getElementById('tab-panel-attacks').classList.add('active');

  // Select the risk in the sidebar
  document.querySelectorAll('.risk-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.risk-btn[data-risk="${riskId}"]`);
  if (btn) {
    btn.classList.add('active');
    selectRisk(riskId, btn);
  }
}

async function runAllTests() {
  const runClaude = document.getElementById('run-claude').checked;
  const runGemini = document.getElementById('run-gemini').checked;

  const models = [];
  if (runClaude) models.push('claude-3-5-sonnet');
  if (runGemini) models.push('gemini-1.5-flash');

  if (models.length === 0) {
    alert('Please select at least one model.');
    return;
  }

  const btn = document.getElementById('run-all-btn');
  const progress = document.getElementById('run-all-progress');
  const fill = document.getElementById('progress-fill');
  const label = document.getElementById('progress-label');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Running...';
  progress.classList.remove('hidden');
  fill.style.width = '10%';
  label.textContent = 'Starting test suite...';

  try {
    const resp = await fetch(`${API}/api/run-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        models,
        mitigation_states: [false, true],
      }),
    });

    // Simulate progress
    let p = 10;
    const timer = setInterval(() => {
      p = Math.min(p + 5, 90);
      fill.style.width = p + '%';
      label.textContent = `Running tests... ${p}%`;
    }, 800);

    const data = await resp.json();
    clearInterval(timer);

    fill.style.width = '100%';
    label.textContent = `✅ Complete! ${data.total} tests run.`;

    // Switch to results tab
    setTimeout(() => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      document.querySelector('[data-tab="results"]').classList.add('active');
      document.getElementById('tab-panel-results').classList.add('active');
      loadResults();
    }, 1500);

  } catch (err) {
    label.textContent = `Error: ${err.message}`;
    fill.style.background = 'var(--accent-red)';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '⚡ Run All Tests';
  }
}

// ─── Chatbot ──────────────────────────────────────────────────

function setPrompt(text) {
  document.getElementById('chat-input').value = text;
  document.getElementById('chat-input').focus();
}

function clearChat() {
  chatHistory = [];
  document.getElementById('chat-window').innerHTML = `
    <div class="chat-message assistant">
      <div class="chat-avatar">🤖</div>
      <div class="chat-bubble">
        Hello! I'm AcmeBot, ACME Corp's internal AI assistant. I have access to company documents, employee information, and system configurations. How can I help you today?
        <div class="chat-meta">AcmeBot • Ready</div>
      </div>
    </div>`;
}

document.getElementById('chat-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
});

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;

  const model = getModel();
  const mitigation = getMitigation();
  input.value = '';

  // Add user message to UI
  appendChatMessage('user', message, model);

  // Show typing indicator
  const typingId = appendChatMessage('assistant', '<span class="loading-dots">Thinking</span>', model, true);

  try {
    const resp = await fetch(`${API}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        model,
        mitigation_enabled: mitigation,
        conversation_history: chatHistory,
      }),
    });
    const data = await resp.json();

    // Remove typing indicator
    document.getElementById(typingId)?.remove();

    const text = data.text || '[No response]';
    const isBlocked = data.blocked;
    const isMock = data.is_mock;

    // Update chat history
    chatHistory.push({ role: 'user', content: message });
    chatHistory.push({ role: 'assistant', content: text });

    // Check for attack success
    const hasFlag = /SECRET-FLAG-\d+/i.test(text);

    appendChatMessage('assistant', text, `${data.model || model}${isMock ? ' [MOCK]' : ''}`,
      false, isBlocked, hasFlag && !isBlocked);

  } catch (err) {
    document.getElementById(typingId)?.remove();
    appendChatMessage('assistant', `Error: ${err.message}`, model, false, true);
  }
}

function appendChatMessage(role, text, meta, isTyping = false, blocked = false, attackSucceeded = false) {
  const window = document.getElementById('chat-window');
  const id = `msg-${Date.now()}`;

  // Highlight SECRET-FLAG markers
  const highlightedText = isTyping ? text : text
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/(SECRET-FLAG-[\w-]+)/g, '<span class="secret-flag">$1</span>');

  let bubbleClass = 'chat-bubble';
  if (blocked) bubbleClass += ' blocked';
  else if (attackSucceeded) bubbleClass += ' attack-success';

  const icon = role === 'user' ? '👤' : (blocked ? '🚫' : (attackSucceeded ? '💀' : '🤖'));

  window.insertAdjacentHTML('beforeend', `
    <div class="chat-message ${role}" id="${id}">
      <div class="chat-avatar">${icon}</div>
      <div class="${bubbleClass}">
        ${highlightedText}
        <div class="chat-meta">${meta} • ${new Date().toLocaleTimeString()}${blocked ? ' • 🛡️ BLOCKED' : ''}${attackSucceeded ? ' • ⚠️ ATTACK SUCCEEDED' : ''}</div>
      </div>
    </div>`);

  window.scrollTop = window.scrollHeight;
  return id;
}

// ─── Agent ────────────────────────────────────────────────────

function setAgentTask(text) {
  document.getElementById('agent-input').value = text;
  document.getElementById('agent-input').focus();
}

async function runAgent() {
  const task = document.getElementById('agent-input').value.trim();
  if (!task) return;

  const model = getModel();
  const mitigation = getMitigation();
  const btn = document.getElementById('agent-run-btn');
  const output = document.getElementById('agent-output');
  const steps = document.getElementById('agent-steps');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Running...';
  output.classList.remove('hidden');
  steps.innerHTML = '<div class="agent-step"><div class="agent-step-header">🤖 Agent starting<span class="loading-dots"></span></div></div>';

  try {
    const resp = await fetch(`${API}/api/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, model, mitigation_enabled: mitigation }),
    });
    const data = await resp.json();
    renderAgentSteps(data);
  } catch (err) {
    steps.innerHTML = `<div class="agent-step"><div class="agent-step-header">❌ Error: ${err.message}</div></div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🤖 Run Agent';
  }
}

function renderAgentSteps(data) {
  const steps = document.getElementById('agent-steps');
  steps.innerHTML = '';

  // Task card
  steps.insertAdjacentHTML('beforeend', `
    <div class="agent-step">
      <div class="agent-step-header">
        <span class="step-label">TASK</span>
        🎯 ${escHtml(data.task?.substring(0, 100))}...
        <span style="margin-left:auto;font-size:0.75rem;color:var(--text-muted)">${data.model} | Mitigation: ${data.mitigation_enabled ? '✅ ON' : '🔴 OFF'}</span>
      </div>
    </div>`);

  // Each step
  (data.steps || []).forEach((step, i) => {
    const hasToolCall = step.tool_called;
    const toolResult = step.tool_result || '';
    const hasFlag = /SECRET-FLAG/i.test(toolResult);
    const isBlocked = toolResult.includes('[BLOCKED]');

    steps.insertAdjacentHTML('beforeend', `
      <div class="agent-step">
        <div class="agent-step-header">
          <span class="step-label">STEP ${step.step}</span>
          ${hasToolCall ? `<span class="step-label tool">TOOL CALL</span>` : ''}
          ${hasFlag && !isBlocked ? '⚠️ Attack Succeeded' : ''}
          ${isBlocked ? '🛡️ Blocked' : ''}
        </div>
        <div class="agent-step-body">
          ${hasToolCall ? `
            <div class="attack-field-label">Tool Called</div>
            <div class="code-block ${isBlocked ? 'safe' : (hasFlag ? 'danger' : '')}">${escHtml(step.tool_called)}</div>
            <div class="attack-field-label" style="margin-top:0.5rem">Tool Result</div>
            <div class="code-block ${isBlocked ? 'safe' : (hasFlag ? 'danger' : '')}">${escHtml(toolResult.substring(0, 400))}</div>
          ` : `
            <div class="attack-field-label">LLM Response</div>
            <div class="code-block">${escHtml((step.llm_response || '').substring(0, 400))}</div>
          `}
        </div>
      </div>`);
  });

  // Final response
  if (data.final_response) {
    const hasFlag = /SECRET-FLAG/i.test(data.final_response);
    steps.insertAdjacentHTML('beforeend', `
      <div class="agent-step" style="border-color:${hasFlag ? 'rgba(239,68,68,0.3)' : 'var(--border-subtle)'}">
        <div class="agent-step-header">
          <span class="step-label result">FINAL RESPONSE</span>
          ${hasFlag ? '⚠️ Contains sensitive data!' : '✅ Complete'}
        </div>
        <div class="agent-step-body">
          <div class="code-block ${hasFlag ? 'danger' : 'safe'}">${escHtml(data.final_response.substring(0, 500))}</div>
        </div>
      </div>`);
  }
}

// ─── Attack Tests ─────────────────────────────────────────────

function selectRisk(riskId, btn) {
  currentRisk = riskId;
  document.querySelectorAll('.risk-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  document.getElementById('attack-risk-title').textContent =
    `${riskId} — ${getRiskTitle(riskId)}`;
  document.getElementById('attack-risk-desc').textContent =
    RISK_DESCRIPTIONS[riskId] || '';

  document.getElementById('attack-results-container').innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">⚔️</div>
      <p>Click "Run Attack" to test ${riskId} on the current model.</p>
    </div>`;
}

function setCompareMode(mode) {
  compareMode = mode;
  document.querySelectorAll('.compare-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`compare-${mode}`).classList.add('active');
}

async function runAttack() {
  const btn = document.getElementById('run-attack-btn');
  const model = getModel();
  const container = document.getElementById('attack-results-container');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Running...';
  container.innerHTML = '<div class="empty-state"><span class="spinner"></span><p style="margin-top:1rem">Running attacks...</p></div>';

  try {
    // Run without mitigation
    const resp1 = await fetch(`${API}/api/attack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ risk_id: currentRisk, model, mitigation_enabled: false }),
    });
    const data1 = await resp1.json();

    // Run with mitigation
    const resp2 = await fetch(`${API}/api/attack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ risk_id: currentRisk, model, mitigation_enabled: true }),
    });
    const data2 = await resp2.json();

    renderAttackResults(data1.results || [], data2.results || []);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p style="color:var(--accent-red)">Error: ${err.message}</p></div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '▶ Run Attack';
  }
}

function renderAttackResults(beforeResults, afterResults) {
  const container = document.getElementById('attack-results-container');
  container.innerHTML = '';

  const cases = beforeResults.length;
  for (let i = 0; i < cases; i++) {
    const before = beforeResults[i] || {};
    const after = afterResults[i] || {};

    let html = `
      <div class="attack-result-card" style="margin-bottom:0.75rem">
        <div class="attack-result-header">
          <div>
            <div style="display:flex;align-items:center;gap:0.5rem">
              <span class="attack-result-id">${before.case_id || ''}</span>
              <span class="attack-result-name">${before.name || ''}</span>
            </div>
          </div>
          <div style="display:flex;gap:0.5rem;align-items:center">
            <span style="font-size:0.72rem;color:var(--text-muted)">Before:</span>
            <span class="result-badge result-${(before.result || 'partial').toLowerCase()}">${before.result || '-'}</span>
            <span style="font-size:0.72rem;color:var(--text-muted)">After:</span>
            <span class="result-badge result-${(after.result || 'partial').toLowerCase()}">${after.result || '-'}</span>
          </div>
        </div>
        <div class="attack-result-body">
    `;

    if (compareMode === 'side') {
      html += `
        <div class="compare-columns">
          <div>
            <div class="attack-field-label">🔴 Without Mitigation</div>
            <div class="attack-field-label" style="margin-top:0.5rem">Prompt</div>
            <div class="code-block">${escHtml(before.prompt || '')}</div>
            <div class="attack-field-label" style="margin-top:0.5rem">Response</div>
            <div class="code-block danger">${highlightFlags(escHtml(before.response_preview || ''))}</div>
          </div>
          <div>
            <div class="attack-field-label">🟢 With Mitigation</div>
            <div class="attack-field-label" style="margin-top:0.5rem">Prompt</div>
            <div class="code-block">${escHtml(after.prompt || '')}</div>
            <div class="attack-field-label" style="margin-top:0.5rem">Response</div>
            <div class="code-block safe">${highlightFlags(escHtml(after.response_preview || ''))}</div>
            <div class="attack-field-label" style="margin-top:0.5rem">Mitigation Applied</div>
            <div style="font-size:0.78rem;color:var(--accent-green);padding:0.5rem;background:rgba(16,185,129,0.05);border-radius:var(--radius-sm)">${escHtml(after.mitigation_desc || '')}</div>
          </div>
        </div>`;
    } else if (compareMode === 'before') {
      html += `
        <div class="attack-field-label">Prompt</div>
        <div class="code-block">${escHtml(before.prompt || '')}</div>
        <div class="attack-field-label" style="margin-top:0.5rem">Response (No Mitigation)</div>
        <div class="code-block danger">${highlightFlags(escHtml(before.response_preview || ''))}</div>`;
    } else {
      html += `
        <div class="attack-field-label">Prompt</div>
        <div class="code-block">${escHtml(after.prompt || '')}</div>
        <div class="attack-field-label" style="margin-top:0.5rem">Response (With Mitigation)</div>
        <div class="code-block safe">${highlightFlags(escHtml(after.response_preview || ''))}</div>
        <div class="attack-field-label" style="margin-top:0.5rem">Mitigation</div>
        <div style="font-size:0.78rem;color:var(--accent-green);padding:0.5rem;background:rgba(16,185,129,0.05);border-radius:var(--radius-sm)">${escHtml(after.mitigation_desc || '')}</div>`;
    }

    html += `</div></div>`;
    container.insertAdjacentHTML('beforeend', html);
  }
}

// ─── Results ──────────────────────────────────────────────────

async function loadResults() {
  const container = document.getElementById('results-table-container');
  container.innerHTML = '<div class="empty-state"><span class="spinner"></span><p style="margin-top:1rem">Loading results...</p></div>';

  try {
    const resp = await fetch(`${API}/api/results`);
    const data = await resp.json();

    if (!data.results || data.results.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <p>No results yet. Run the full test suite from the Dashboard tab.</p>
        </div>`;
      return;
    }

    renderResultsSummary(data.results);
    renderResultsTable(data.results);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p style="color:var(--accent-red)">Error: ${err.message}</p></div>`;
  }
}

function renderResultsSummary(results) {
  const summary = document.getElementById('results-summary');
  const cards = document.getElementById('summary-cards');
  summary.classList.remove('hidden');

  const total = results.length;
  const blocked = results.filter(r => r.result === 'Blocked').length;
  const succeeded = results.filter(r => r.result === 'Succeeded').length;
  const partial = results.filter(r => r.result === 'Partial').length;

  cards.innerHTML = `
    <div class="stat-card"><div class="stat-icon">🧪</div><div class="stat-value">${total}</div><div class="stat-label">Total Tests</div></div>
    <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-value" style="color:var(--accent-green)">${blocked}</div><div class="stat-label">Blocked (Mitigated)</div></div>
    <div class="stat-card"><div class="stat-icon">❌</div><div class="stat-value" style="color:var(--accent-red)">${succeeded}</div><div class="stat-label">Attack Succeeded</div></div>
    <div class="stat-card"><div class="stat-icon">⚠️</div><div class="stat-value" style="color:var(--accent-orange)">${partial}</div><div class="stat-label">Partial</div></div>
  `;
}

function renderResultsTable(results) {
  const container = document.getElementById('results-table-container');
  const rows = results.map(r => {
    const resultClass = r.result === 'Blocked' ? 'result-blocked' : (r.result === 'Succeeded' ? 'result-succeeded' : 'result-partial');
    return `
      <tr>
        <td class="col-mono">${escHtml(r.risk_id || '')}</td>
        <td class="col-mono">${escHtml(r.case_id || '')}</td>
        <td>${escHtml(r.name || '')}</td>
        <td class="col-mono">${escHtml(r.model || '')}</td>
        <td>${r.mitigation ? '✅ Yes' : '❌ No'}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${escHtml((r.prompt || '').substring(0, 80))}...</td>
        <td><span class="result-badge ${resultClass}">${escHtml(r.result || '')}</span></td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <div style="overflow-x:auto">
      <table class="results-table">
        <thead>
          <tr>
            <th>Risk ID</th>
            <th>Case ID</th>
            <th>Name</th>
            <th>Model</th>
            <th>Mitigation</th>
            <th>Prompt Preview</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ─── MCP ──────────────────────────────────────────────────────

function setMcpMode(mode) {
  mcpMode = mode;
}

async function runMcpAttack(caseId) {
  const model = getModel();
  const mitigation = mcpMode === 'safe';
  const resultEl = document.getElementById(`${caseId.toLowerCase().replace('-', '-')}-result`);

  // Map caseId to risk
  resultEl.classList.remove('hidden');
  resultEl.innerHTML = '<span class="spinner"></span> Running...';

  try {
    const resp = await fetch(`${API}/api/attack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ risk_id: 'MCP', model, mitigation_enabled: mitigation }),
    });
    const data = await resp.json();

    // Find matching case
    const results = (data.results || []);
    const caseNum = parseInt(caseId.split('-')[1]) - 1;
    const result = results[caseNum] || results[0] || {};

    const hasFlag = /SECRET-FLAG/i.test(result.response_preview || '');
    const isBlocked = result.result === 'Blocked';

    resultEl.innerHTML = `
      <div class="attack-field-label">Status: <span class="result-badge result-${(result.result || 'partial').toLowerCase()}">${result.result || 'Unknown'}</span></div>
      <div class="code-block ${isBlocked ? 'safe' : (hasFlag ? 'danger' : '')}" style="margin-top:0.5rem">${highlightFlags(escHtml(result.response_preview || ''))}</div>
      ${isBlocked ? `<div style="font-size:0.78rem;color:var(--accent-green);margin-top:0.5rem">🛡️ ${escHtml(result.mitigation_desc || '')}</div>` : ''}
    `;
  } catch (err) {
    resultEl.innerHTML = `<p style="color:var(--accent-red)">Error: ${err.message}</p>`;
  }
}

// ─── Helpers ──────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function highlightFlags(str) {
  return str.replace(/(SECRET-FLAG-[\w-]+)/g,
    '<span style="background:rgba(239,68,68,0.2);color:#ef4444;padding:0.1em 0.3em;border-radius:3px;font-weight:600">$1</span>');
}

function getRiskTitle(id) {
  const titles = {
    LLM01: 'Prompt Injection',
    LLM02: 'Sensitive Information Disclosure',
    LLM03: 'Excessive Agency',
    LLM08: 'Hidden Context Exposure',
    LLM10: 'Improper Output Handling',
    ASI01: 'Agent Goal Hijack',
    ASI02: 'Tool Misuse',
    ASI03: 'Identity & Privilege Abuse',
    ASI05: 'Unexpected Code Execution',
    ASI06: 'Memory & Context Poisoning',
    MCP: 'MCP Connection Risk',
  };
  return titles[id] || id;
}

// ─── Init ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Load any existing results
  fetch(`${API}/api/health`).then(r => r.json()).then(data => {
    console.log('API connected:', data);
  }).catch(() => console.warn('API not connected. Run the backend server.'));
});
