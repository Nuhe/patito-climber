const config = window.PATITO_CONFIG || {};
const endpoint = `${(config.supabaseUrl || '').replace(/\/$/, '')}/rest/v1/patito_scores`;

function headers() {
  return {
    apikey: config.supabaseAnonKey,
    'Content-Type': 'application/json',
  };
}

function configured() {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}

export async function getScores() {
  if (!configured()) throw new Error('Falta configurar Supabase.');
  const response = await fetch(`${endpoint}?select=name,score,created_at&order=score.desc,created_at.asc&limit=10`, {
    headers: headers(),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`No se pudo cargar el ranking (${response.status}).`);
  return response.json();
}

export async function saveScore(name, score) {
  if (!configured()) throw new Error('Falta configurar Supabase.');
  if (!/^[A-Z]{1,3}$/.test(name) || !Number.isInteger(score) || score < 0 || score > 9999999) {
    throw new Error('Nombre o puntuación inválidos.');
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { ...headers(), Prefer: 'return=minimal' },
    body: JSON.stringify({ name, score }),
  });
  if (!response.ok) throw new Error(`No se pudo guardar la puntuación (${response.status}).`);
}
