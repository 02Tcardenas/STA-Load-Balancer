import { requestsFor } from './scenarios.js';

const TICKS_PER_SECOND = 1_000_000;
const toTicks = (seconds) => Math.round(seconds * TICKS_PER_SECOND);
const toSeconds = (ticks) => ticks / TICKS_PER_SECOND;

function createServers(scenario) {
  return scenario.powers.map((power, index) => ({
    id: `S${index + 1}`,
    power,
    queue: [],
    active: null,
  }));
}

function createServerView(server, getTime) {
  return Object.freeze({
    id: server.id,
    power: server.power,
    get activeRequest() { return server.active?.job.request ?? null; },
    get queuedRequests() {
      return Object.freeze(server.queue.map(({ request }) => request));
    },
    get activeProgress() {
      if (!server.active) return 0;
      const { startedAt, finishesAt } = server.active;
      return (getTime() - startedAt) / (finishesAt - startedAt);
    },
  });
}

export function initialFrame(scenario) {
  return {
    time: 0,
    arrived: 0,
    replied: 0,
    cacheHits: 0,
    latestCacheHit: null,
    averageLatency: 0,
    latestReply: null,
    servers: createServers(scenario),
  };
}

export async function simulate(scenario, Controller) {
  const servers = createServers(scenario);
  let now = 0;
  if (!servers.length || servers.some(({ power }) => ![1, 2, 3, 4].includes(power))) {
    throw new Error('La potencia de cada servidor debe ser un entero entre 1 y 4.');
  }
  const controller = new Controller(servers.map((server) => createServerView(server, () => now)));
  const arrivals = requestsFor(scenario).map(({ time, request }) => {
    if (!Number.isFinite(time) || time < 0 || !Number.isFinite(request.work) || request.work <= 0) {
      throw new Error('Cada petición necesita un instante de llegada válido y un trabajo mayor que cero.');
    }
    return { time: toTicks(time), request };
  }).sort((left, right) => left.time - right.time);
  const frames = [];
  let nextArrival = 0;
  let replied = 0;
  let cacheHits = 0;
  let latestCacheHit = null;
  let totalLatency = 0;
  let latestReply = null;

  function startNext(server) {
    const job = server.queue.shift();
    server.active = job ? {
      job,
      startedAt: now,
      finishesAt: now + Math.max(1, toTicks(job.request.work / server.power)),
    } : null;
  }

  async function deliver(job, serverId) {
    const response = await job.response;
    if (typeof response !== 'string') {
      throw new Error('Devuelve la respuesta con return sendToServer(serverId).');
    }
    replied += 1;
    if (serverId === null) {
      cacheHits += 1;
      latestCacheHit = job.request.id;
    }
    totalLatency += toSeconds(now - job.arrivedAt);
    latestReply = { id: job.request.id, payload: response, requestPayload: job.request.payload, serverId };
  }

  async function arrive(request) {
    const job = { request, arrivedAt: now };
    let routed = false;
    let acceptingRoute = true;
    const sendToServer = (serverId) => {
      if (routed) throw new Error('La petición ya se ha enviado a un servidor.');
      if (!acceptingRoute) throw new Error('Llama a sendToServer al atender la petición.');
      const server = servers.find((candidate) => candidate.id === serverId);
      if (!server) throw new Error(`Servidor desconocido: ${String(serverId)}`);
      routed = true;
      const result = new Promise((resolve) => { job.complete = resolve; });
      server.queue.push(job);
      if (!server.active) startNext(server);
      return result;
    };

    job.response = Promise.resolve(controller.onRequestArrival(request, sendToServer));
    job.response.catch(() => {});
    acceptingRoute = false;
    if (!routed) await deliver(job, null);
  }

  while (nextArrival < arrivals.length || servers.some((server) => server.active)) {
    now = Math.min(
      arrivals[nextArrival]?.time ?? Infinity,
      ...servers.map((server) => server.active?.finishesAt ?? Infinity),
    );

    for (const server of servers) {
      if (server.active?.finishesAt !== now) continue;
      const { job } = server.active;
      startNext(server);
      job.complete([...job.request.payload].reverse().join(''));
      await deliver(job, server.id);
    }

    while (arrivals[nextArrival]?.time === now) {
      await arrive(arrivals[nextArrival].request);
      nextArrival += 1;
    }

    frames.push({
      time: toSeconds(now),
      arrived: nextArrival,
      replied,
      cacheHits,
      latestCacheHit,
      averageLatency: replied ? totalLatency / replied : 0,
      latestReply,
      servers: servers.map(({ id, power, active, queue }) => ({
        id,
        power,
        active: active && {
          request: active.job.request,
          startedAt: toSeconds(active.startedAt),
          finishesAt: toSeconds(active.finishesAt),
        },
        queue: queue.map(({ request }) => request),
      })),
    });
  }

  return frames;
}
