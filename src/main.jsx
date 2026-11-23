import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import LoadBalancer from "../LoadBalancer.js";
import { scenarios } from "./scenarios.js";
import { initialFrame, simulate } from "./simulation.js";
import "./style.css";

const PLAYBACK_MS_PER_SECOND = 3000;
const decimal = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });
const seconds = (value) => `${decimal.format(value)} s`;
const demoModules =
  import.meta.env.MODE === "projector"
    ? Object.values(import.meta.glob("./demo/*.js", { eager: true }))
    : [];
const controllers = [
  { label: "Mi controlador", default: LoadBalancer },
  ...demoModules,
];

function RequestTile({ request, waiting = false }) {
  const work = decimal.format(request.work);
  const width = Math.min(92, Math.max(56, Math.round(48 + request.work * 4.4)));

  return (
    <span
      className={waiting ? "packet waiting" : "packet"}
      style={{ "--packet-width": width + "px" }}
      title={"Carga útil: " + request.payload}
    >
      <span className="packet-id">{request.id}</span>
      <span className="packet-work">{work}u</span>
    </span>
  );
}

function ServerLane({ server }) {
  const { id, power, active, queue } = server;
  const progress = active && {
    "--duration": `${(active.finishesAt - active.startedAt) * PLAYBACK_MS_PER_SECOND}ms`,
  };

  return (
    <article className="server" aria-label={`Servidor ${id}`}>
      <div className="server-identity">
        <div className="server-symbol" aria-hidden="true">
          <span />
          <span />
        </div>
        <div>
          <h2>{id}</h2>
          <div
            className="power"
            aria-label={`Potencia ${power} de 4`}
            title={`Potencia ${power} de 4`}
          >
            {[1, 2, 3, 4].map((level) => (
              <i key={level} className={level <= power ? "filled" : ""} />
            ))}
          </div>
        </div>
      </div>
      <div className="queue">
        {queue.length ? (
          queue.map((request) => (
            <RequestTile key={request.id} request={request} waiting />
          ))
        ) : (
          <span className="empty">—</span>
        )}
      </div>
      <div className="processing">
        {active ? (
          <div className="active" key={active.request.id}>
            <RequestTile request={active.request} />
            <div className="progress-track" aria-hidden="true">
              <span style={progress} />
            </div>
          </div>
        ) : (
          <span className="empty">—</span>
        )}
      </div>
    </article>
  );
}

function App() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [controllerIndex, setControllerIndex] = useState(0);
  const [frame, setFrame] = useState(() => initialFrame(scenarios[0]));
  const [status, setStatus] = useState("ready");
  const [error, setError] = useState("");
  const timer = useRef(null);
  const playback = useRef(0);
  const scenario = scenarios[scenarioIndex];

  function stop() {
    clearTimeout(timer.current);
    playback.current += 1;
  }

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      playback.current += 1;
    },
    [],
  );

  function reset(nextScenario) {
    stop();
    setFrame(initialFrame(nextScenario));
    setStatus("ready");
    setError("");
  }

  async function run() {
    reset(scenario);
    const runId = playback.current;
    setStatus("running");
    try {
      const frames = await simulate(
        scenario,
        controllers[controllerIndex].default,
      );
      function show(index, previousTime) {
        if (playback.current !== runId) return;
        const next = frames[index];
        if (!next) {
          setStatus("done");
          return;
        }
        timer.current = setTimeout(
          () => {
            if (playback.current !== runId) return;
            setFrame(next);
            show(index + 1, next.time);
          },
          (next.time - previousTime) * PLAYBACK_MS_PER_SECOND,
        );
      }
      show(0, 0);
    } catch (failure) {
      if (playback.current !== runId) return;
      setError(failure instanceof Error ? failure.message : String(failure));
      setStatus("error");
    }
  }

  const statusLabel = {
    ready: "Listo",
    running: "En curso",
    done: "Finalizado",
    error: "Error",
  }[status];

  return (
    <main className="shell">
      <header className="header">
        <h1>Laboratorio de balanceo</h1>
        <div className="controls">
          <label>
            Escenario
            <select
              value={scenarioIndex}
              onChange={(event) => {
                const next = Number(event.target.value);
                setScenarioIndex(next);
                reset(scenarios[next]);
              }}
            >
              {scenarios.map(({ name }, index) => (
                <option key={name} value={index}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {controllers.length > 1 && (
            <label>
              Controlador
              <select
                value={controllerIndex}
                onChange={(event) => {
                  setControllerIndex(Number(event.target.value));
                  reset(scenario);
                }}
              >
                {controllers.map(({ label }, index) => (
                  <option key={label} value={index}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="button" onClick={run}>
            {status === "ready" ? "Ejecutar" : "Reiniciar"}
          </button>
        </div>
      </header>

      <section className="board" aria-label="Simulación">
        <div className="flow">
          <div>
            <span className="label">Peticiones recibidas</span>
            <strong>
              {frame.arrived}
              <span> / {scenario.arrivals.length}</span>
            </strong>
          </div>
          <div className={scenario.showCache ? "balancer balancer-cache" : "balancer"}>
            <span aria-hidden="true">⇢</span> Balanceador
            {scenario.showCache && frame.latestCacheHit && (
              <output className="cache-pop" key={frame.latestCacheHit}>
                {frame.latestCacheHit} · En caché
              </output>
            )}
          </div>
          <div className={`status ${status}`} role="status">
            {statusLabel}
          </div>
        </div>
        <div className="columns" aria-hidden="true">
          <span>Servidor</span>
          <span>Cola</span>
          <span>En proceso</span>
        </div>
        <div className="lanes" key={`${scenarioIndex}-${playback.current}`}>
          {frame.servers.map((server) => (
            <ServerLane key={server.id} server={server} />
          ))}
        </div>
        {error && (
          <p className="error-message" role="alert">
            Error en el controlador: {error}
          </p>
        )}
      </section>

      <dl className={scenario.showCache ? "metrics metrics-cache" : "metrics"}>
        <div>
          <dt>Respondidas</dt>
          <dd>
            {frame.replied} <small>/ {scenario.arrivals.length}</small>
          </dd>
        </div>
        <div>
          <dt>Tiempo simulado</dt>
          <dd>{seconds(frame.time)}</dd>
        </div>
        <div>
          <dt>Tiempo medio de respuesta</dt>
          <dd>{frame.replied ? seconds(frame.averageLatency) : "—"}</dd>
        </div>
        <div>
          <dt>Última respuesta</dt>
          <dd className="reply" title={frame.latestReply ? "Carga útil: " + frame.latestReply.requestPayload : undefined}>
            {frame.latestReply
              ? frame.latestReply.id + " · " + frame.latestReply.payload
              : "—"}
          </dd>
        </div>
        {scenario.showCache && (
          <div>
            <dt>Aciertos de caché</dt>
            <dd>{frame.cacheHits}</dd>
          </div>
        )}
      </dl>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
