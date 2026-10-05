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

export function formatTime(milliseconds) {
  const centiseconds = Math.floor(milliseconds / 10);
  const minutes = Math.floor(centiseconds / 6000);
  const seconds = Math.floor(centiseconds / 100) % 60;
  const hundredths = centiseconds % 100;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

export async function getTimes() {
  if (!configured()) throw new Error('Falta configurar Supabase.');
  const response = await fetch(`${endpoint}?select=name,time_ms,created_at&time_ms=not.is.null&order=time_ms.asc,created_at.asc&limit=10`, {
    headers: headers(),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`No se pudo cargar el ranking (${response.status}).`);
  return response.json();
}

export async function saveTime(name, timeMs) {
  if (!configured()) throw new Error('Falta configurar Supabase.');
  if (!/^[A-Z]{1,3}$/.test(name) || !Number.isInteger(timeMs) || timeMs < 1 || timeMs > 3600000) {
    throw new Error('Nombre o tiempo inválidos.');
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { ...headers(), Prefer: 'return=minimal' },
    body: JSON.stringify({ name, score: 0, time_ms: timeMs }),
  });
  if (!response.ok) throw new Error(`No se pudo guardar el tiempo (${response.status}).`);
}
