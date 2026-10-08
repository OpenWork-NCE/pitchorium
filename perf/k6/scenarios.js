/* global __ENV */
// Load test of the main paths (docs/operations/performance.md): feed, search, project page,
// contribution creation and message send, by signed-in demonstration members.
// Usage: pnpm perf:load (api on API_URL, demonstration data of pnpm db:seed:dev).
import http from 'k6/http';
import { check } from 'k6';
import exec from 'k6/execution';

const API = __ENV.API_URL || 'http://127.0.0.1:3100';
const ORIGIN = __ENV.WEB_ORIGIN || 'http://localhost:5173';
const PASSWORD = 'pitchorium-demo-2026';
const DURATION = __ENV.DURATION || '60s';
// RATE_FACTOR multiplies every arrival rate (5 for the stress run of the report).
const FACTOR = Number(__ENV.RATE_FACTOR || 1);
const MEMBERS = [
  'aissatou-ba',
  'kofi-mensah',
  'ama-owusu',
  'jean-baptiste-kouassi',
  'marie-claire-joseph',
  'nadia-benali',
  'samuel-okafor',
  'grace-wanjiru',
  'fatou-sow',
  'rodrigue-mbemba',
];
const QUERIES = ['irrigation', 'solaire', 'cacao', 'mentor', 'agriculture', 'eau', 'finance'];

const rate = (name, perSecond, vus) => ({
  executor: 'constant-arrival-rate',
  exec: name,
  rate: Math.round(perSecond * FACTOR),
  timeUnit: '1s',
  duration: DURATION,
  preAllocatedVUs: Math.ceil(vus * FACTOR),
  maxVUs: Math.ceil(vus * FACTOR * 4),
  tags: { scenario: name },
});

export const options = {
  scenarios: {
    feed: rate('feed', 20, 10),
    search: rate('search', 20, 10),
    projectPage: rate('projectPage', 20, 10),
    contribution: rate('contribution', 2, 4),
    messageSend: rate('messageSend', 5, 4),
  },
  // Objectives of docs/operations/slo-and-alerts.md: reads p95 < 300 ms, writes p95 < 800 ms.
  thresholds: {
    'http_req_duration{scenario:feed}': ['p(95)<300'],
    'http_req_duration{scenario:search}': ['p(95)<300'],
    'http_req_duration{scenario:projectPage}': ['p(95)<300'],
    'http_req_duration{scenario:contribution}': ['p(95)<800'],
    'http_req_duration{scenario:messageSend}': ['p(95)<800'],
    checks: ['rate>0.99'],
  },
};

const headers = (cookie, write) => ({
  origin: ORIGIN,
  cookie,
  'content-type': 'application/json',
  ...(write
    ? { 'idempotency-key': `${exec.vu.idInTest}-${exec.scenario.iterationInTest}-${Date.now()}` }
    : {}),
});

/** One session per member, opened before the load; projects and conversations to target. */
export function setup() {
  const sessions = {};
  for (const handle of MEMBERS) {
    const response = http.post(
      `${API}/v1/auth/sign-in/email`,
      JSON.stringify({
        email: `${handle.replaceAll('-', '.')}@demo.pitchorium.test`,
        password: PASSWORD,
      }),
      { headers: { origin: ORIGIN, 'content-type': 'application/json' } },
    );
    const cookie = Object.entries(response.cookies)
      .map(([name, values]) => `${name}=${values[0].value}`)
      .join('; ');
    if (response.status === 200) sessions[handle] = cookie;
  }
  const first = Object.values(sessions)[0];
  const showcase = http.get(`${API}/v1/projects?limit=20`, { headers: headers(first) }).json();
  const funding = showcase.items.filter((item) => item.status === 'funding');
  // Projects whose holder can receive payments (a quote succeeds), for the contributions.
  const payable = funding.filter(
    (item) =>
      http.post(
        `${API}/v1/projects/${item.id}/contribution-quotes`,
        JSON.stringify({
          kind: 'donation',
          amount: { amountMinor: '1000', currency: 'EUR' },
          method: 'card',
        }),
        { headers: headers(first) },
      ).status === 200,
  );
  const projects = funding;
  const conversations = {};
  for (const [handle, cookie] of Object.entries(sessions)) {
    const page = http.get(`${API}/v1/messaging/conversations?limit=5`, {
      headers: headers(cookie),
    });
    const active = (page.json().items || []).find((item) => item.requestState === 'none');
    if (active) conversations[handle] = active.id;
  }
  return { sessions, projects, payable, conversations };
}

const member = (data) => {
  const handles = Object.keys(data.sessions);
  const handle = handles[exec.vu.idInTest % handles.length];
  return { handle, cookie: data.sessions[handle] };
};

export function feed(data) {
  const { cookie } = member(data);
  check(http.get(`${API}/v1/feed?limit=20`, { headers: headers(cookie) }), {
    'feed 200': (r) => r.status === 200,
  });
}

export function search(data) {
  const { cookie } = member(data);
  const q = QUERIES[exec.scenario.iterationInTest % QUERIES.length];
  const response = http.get(`${API}/v1/discovery/search?q=${q}&limit=20`, {
    headers: headers(cookie),
  });
  check(response, { 'search 200': (r) => r.status === 200 });
}

export function projectPage(data) {
  const { cookie } = member(data);
  const project = data.projects[exec.scenario.iterationInTest % data.projects.length];
  const response = http.get(`${API}/v1/projects/by-slug/${project.slug}`, {
    headers: headers(cookie),
  });
  check(response, { 'project 200': (r) => r.status === 200 });
}

export function contribution(data) {
  const { cookie } = member(data);
  const project = data.payable[exec.scenario.iterationInTest % data.payable.length];
  const response = http.post(
    `${API}/v1/projects/${project.id}/contributions`,
    JSON.stringify({
      kind: 'donation',
      amount: { amountMinor: '1000', currency: 'EUR' },
      method: 'card',
    }),
    { headers: headers(cookie, true) },
  );
  // The anti-abuse limits (PAYMENTS_*_PER_HOUR) are raised for the measurement.
  check(response, { 'contribution created': (r) => r.status === 201 });
}

export function messageSend(data) {
  const handles = Object.keys(data.conversations);
  const handle = handles[exec.vu.idInTest % handles.length];
  const response = http.post(
    `${API}/v1/messaging/conversations/${data.conversations[handle]}/messages`,
    JSON.stringify({
      clientMessageId: `k6-${exec.vu.idInTest}-${exec.scenario.iterationInTest}-${Date.now()}`,
      body: 'Message de charge',
    }),
    { headers: headers(data.sessions[handle], true) },
  );
  check(response, { 'message 201': (r) => r.status === 201 });
}
