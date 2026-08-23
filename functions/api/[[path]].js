const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8'
};

const ALLOWED_STAGES = new Set(['practice', 'qualifier', 'semifinal', 'final']);
const ALLOWED_COLORS = new Set(['#2E7D32', '#0288D1', '#7B1FA2', '#E65100', '#C2185B', '#FBC02D']);

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }

  try {
    return await handleApi(request, env, url);
  } catch (error) {
    return json({ ok: false, error: error.message || 'Unexpected error' }, 500, request, env);
  }
}

async function handleApi(request, env, url) {
  if (!env.DB) {
    return json({ ok: false, error: 'D1 binding DB is not configured' }, 500, request, env);
  }

  if (request.method === 'GET' && url.pathname === '/api/health') {
    const result = await env.DB.prepare('SELECT 1 AS ok').first();
    return json({ ok: true, database: result?.ok === 1, environment: env.ENVIRONMENT || 'production' }, 200, request, env);
  }

  if (request.method === 'GET' && url.pathname === '/api/events') {
    const { results } = await env.DB.prepare(
      'SELECT * FROM events ORDER BY created_at DESC LIMIT 100'
    ).all();
    return json({ ok: true, events: results }, 200, request, env);
  }

  if (request.method === 'POST' && url.pathname === '/api/events') {
    const body = await readJson(request);
    const name = cleanText(body.name, 80);
    if (!name) return json({ ok: false, error: 'Event name is required' }, 400, request, env);

    const event = {
      id: crypto.randomUUID(),
      name,
      description: cleanText(body.description, 240),
      starts_at: cleanText(body.starts_at, 40)
    };

    await env.DB.prepare(
      'INSERT INTO events (id, name, description, starts_at) VALUES (?, ?, ?, ?)'
    ).bind(event.id, event.name, event.description, event.starts_at).run();

    return json({ ok: true, event }, 201, request, env);
  }

  if (request.method === 'GET' && url.pathname === '/api/matches') {
    const eventId = cleanText(url.searchParams.get('event_id'), 80);
    const query = eventId
      ? env.DB.prepare('SELECT * FROM matches WHERE event_id = ? ORDER BY created_at DESC LIMIT 100').bind(eventId)
      : env.DB.prepare('SELECT * FROM matches ORDER BY created_at DESC LIMIT 100');
    const { results } = await query.all();
    return json({ ok: true, matches: results }, 200, request, env);
  }

  if (request.method === 'POST' && url.pathname === '/api/matches') {
    const body = await readJson(request);
    const name = cleanText(body.name, 80);
    if (!name) return json({ ok: false, error: 'Match name is required' }, 400, request, env);

    const stage = ALLOWED_STAGES.has(body.stage) ? body.stage : 'qualifier';
    const match = {
      id: crypto.randomUUID(),
      event_id: cleanText(body.event_id, 80) || null,
      name,
      stage,
      room_pin: generatePin(),
      race_seed: crypto.randomUUID(),
      max_players: clampInteger(body.max_players, 1, 100, 30)
    };

    await env.DB.prepare(
      `INSERT INTO matches
        (id, event_id, name, stage, room_pin, race_seed, max_players)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      match.id,
      match.event_id,
      match.name,
      match.stage,
      match.room_pin,
      match.race_seed,
      match.max_players
    ).run();

    return json({ ok: true, match }, 201, request, env);
  }

  const resultsMatch = url.pathname.match(/^\/api\/matches\/([^/]+)\/results$/);
  if (request.method === 'GET' && resultsMatch) {
    const matchId = cleanText(resultsMatch[1], 80);
    const { results } = await env.DB.prepare(
      `SELECT r.*, p.display_name, p.color, p.avatar
       FROM results r
       JOIN players p ON p.id = r.player_id
       WHERE r.match_id = ?
       ORDER BY r.rank ASC`
    ).bind(matchId).all();
    return json({ ok: true, results }, 200, request, env);
  }

  if (request.method === 'POST' && url.pathname === '/api/results') {
    const body = await readJson(request);
    const matchId = cleanText(body.match_id, 80);
    const displayName = cleanText(body.display_name, 40);
    if (!matchId || !displayName) {
      return json({ ok: false, error: 'match_id and display_name are required' }, 400, request, env);
    }

    const playerId = cleanText(body.player_id, 80) || crypto.randomUUID();
    const color = ALLOWED_COLORS.has(body.color) ? body.color : '#2E7D32';
    const avatar = cleanText(body.avatar, 24) || 'dino';
    const resultId = crypto.randomUUID();

    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO players (id, display_name, color, avatar)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           display_name = excluded.display_name,
           color = excluded.color,
           avatar = excluded.avatar`
      ).bind(playerId, displayName, color, avatar),
      env.DB.prepare(
        `INSERT INTO results
          (id, match_id, player_id, rank, score, distance, survival_ms, crashed, crashed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(match_id, player_id) DO UPDATE SET
           rank = excluded.rank,
           score = excluded.score,
           distance = excluded.distance,
           survival_ms = excluded.survival_ms,
           crashed = excluded.crashed,
           crashed_at = excluded.crashed_at`
      ).bind(
        resultId,
        matchId,
        playerId,
        clampInteger(body.rank, 1, 1000, 1),
        clampInteger(body.score, 0, 999999, 0),
        clampInteger(body.distance, 0, 999999, 0),
        clampInteger(body.survival_ms, 0, 3600000, 0),
        body.crashed ? 1 : 0,
        cleanText(body.crashed_at, 40) || null
      )
    ]);

    return json({ ok: true, result: { id: resultId, match_id: matchId, player_id: playerId } }, 201, request, env);
  }

  return json({ ok: false, error: 'Not found' }, 404, request, env);
}

async function readJson(request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return {};
  return request.json();
}

function json(payload, status, request, env) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders(request, env) }
  });
}

function corsHeaders(request, env) {
  const allowedOrigin = env.ALLOWED_ORIGIN || new URL(request.url).origin;
  return {
    'access-control-allow-origin': allowedOrigin,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type'
  };
}

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function clampInteger(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function generatePin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}
