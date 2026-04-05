const config = require('../config');

async function appendRecord({ projectId, stepId, newRecord, action, recordIndex }) {
  const response = await fetch(`${config.N8N_BASE_URL}/append-record`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, stepId, newRecord, action, recordIndex }),
  });
  return response.ok;
}

async function verifyProject({ projectId, token, metadata }) {
  const response = await fetch(`${config.N8N_BASE_URL}/verify-project`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, token, metadata }),
  });
  const rawResult = await response.json();
  const result = Array.isArray(rawResult) ? rawResult[0] : rawResult;
  return { ok: response.ok, result };
}

module.exports = { appendRecord, verifyProject };
