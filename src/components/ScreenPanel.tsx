import type { Alert, Instrument, ScreenPayload } from "../agent/types";
import { InstrumentRow } from "./InstrumentRow";

/*
 * "The screen." The same answer is delivered twice, differently: spoken it is
 * rounded and capped at three; here it is exact, tabular, and complete —
 * each block a rounded card. The unprompted alert sits on a soft accent tint.
 */
export function ScreenPanel({
  payload,
  alert,
  onAck,
}: {
  payload: ScreenPayload;
  alert: Alert | null;
  onAck?: () => void;
}) {
  const showResting = payload.kind === "none" && !alert;
  return (
    <section
      aria-label="Ledger"
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}
    >
      {alert ? <AlertBlock alert={alert} onAck={onAck} /> : null}

      {payload.kind === "table" ? (
        <div className="card">
          <Ledger title={payload.title} rows={payload.rows} />
        </div>
      ) : payload.kind === "quote" ? (
        <div className="card">
          <Quote instrument={payload.instrument} />
        </div>
      ) : showResting ? (
        <div className="card">
          <span className="label">Now</span>
          <p className="body" style={{ margin: "var(--space-2) 0 0", color: "var(--ink-soft)" }}>
            Nothing worth reporting.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function AlertBlock({ alert, onAck }: { alert: Alert; onAck?: () => void }) {
  return (
    <div
      className="card"
      style={{
        background: "var(--accent-tint)",
        borderColor: "var(--accent-line)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span className="label" style={{ color: "var(--brass)" }}>
          Worth an interruption
        </span>
        {onAck ? (
          <button type="button" className="chip" onClick={onAck} style={{ padding: "2px 12px" }}>
            Acknowledge
          </button>
        ) : null}
      </div>
      <p className="body" style={{ margin: 0 }}>
        {alert.spoken}
      </p>
      <div style={{ marginTop: "var(--space-2)" }}>
        <InstrumentRow instrument={alert.instrument} />
      </div>
    </div>
  );
}

function Ledger({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Instrument[];
  empty?: string;
}) {
  return (
    <div>
      <h2 className="h2" style={{ marginBottom: "var(--space-3)" }}>
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="small" style={{ color: "var(--ink-soft)", margin: 0 }}>
          {empty ?? "Nothing to show."}
        </p>
      ) : (
        <div>
          {rows.map((r) => (
            <InstrumentRow key={r.symbol} instrument={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function Quote({ instrument }: { instrument: Instrument }) {
  return (
    <div>
      <h2 className="h2" style={{ marginBottom: "var(--space-1)" }}>
        {cap(instrument.name)}
      </h2>
      <span className="label">{instrument.symbol}</span>
      <div style={{ marginTop: "var(--space-4)" }}>
        <InstrumentRow instrument={instrument} />
      </div>
      {instrument.cause ? (
        <div style={{ marginTop: "var(--space-4)" }}>
          {instrument.cause.confidence === "unconfirmed" ? (
            <span className="label" style={{ display: "block", marginBottom: "var(--space-1)" }}>
              Unconfirmed
            </span>
          ) : null}
          <p className="small" style={{ color: "var(--ink-soft)", margin: 0 }}>
            {cap(instrument.cause.text)}.
          </p>
          {instrument.cause.source ? (
            <p className="small" style={{ color: "var(--ink-soft)", margin: "var(--space-1) 0 0" }}>
              Source:{" "}
              {instrument.cause.url ? (
                <a
                  href={instrument.cause.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--brass)" }}
                >
                  {instrument.cause.source}
                </a>
              ) : (
                instrument.cause.source
              )}
              .
            </p>
          ) : null}
        </div>
      ) : (
        <p className="small" style={{ color: "var(--ink-soft)", marginTop: "var(--space-4)" }}>
          No established cause on the wire yet.
        </p>
      )}
    </div>
  );
}

function cap(s: string): string {
  const t = s.replace(/^the\s+/i, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
