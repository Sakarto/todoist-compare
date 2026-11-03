"use client";
import { useCallback, useEffect, useState } from "react";

type Stat = { done: number; goal: number };
type Person = { id: string; name: string; error?: boolean; day?: Stat; week?: Stat };

export default function Home() {
  const [view, setView] = useState<"day" | "week">("day");
  const [people, setPeople] = useState<Person[] | null>(null);
  const [oauth, setOauth] = useState(false);
  const [joinCode, setJoinCode] = useState(false);
  const [panel, setPanel] = useState<"none" | "join" | "leave">("none");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const j = await (await fetch("/api/board", { cache: "no-store" })).json();
    setPeople(j.people);
    setOauth(j.oauth);
    setJoinCode(j.joinCode);
  }, []);

  useEffect(() => {
    // Show the result of a Todoist sign-in, then clean up the address bar.
    const q = new URLSearchParams(window.location.search);
    const note = q.get("error") ?? (q.get("joined") ? "You're on the board." : q.get("left") ? "You've left the board." : "");
    if (note) {
      setMsg(note);
      window.history.replaceState(null, "", "/");
      setTimeout(() => setMsg(""), 6000);
    }
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (oauth) {
      const q = new URLSearchParams(panel === "leave" ? { intent: "leave" } : { name: body.name ?? "", code: body.code ?? "" });
      window.location.href = `/api/auth/start?${q}`;
      return;
    }
    setMsg("Checking…");
    const r = await fetch(`/api/${panel}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) return setMsg(j.error ?? "Something went wrong.");
    setMsg(""); setPanel("none"); load();
  }

  return (
    <main>
      <div className="toggle">
        <button className={view === "day" ? "on" : ""} onClick={() => setView("day")}>Day</button>
        <button className={view === "week" ? "on" : ""} onClick={() => setView("week")}>Week</button>
      </div>

      <div className="board">
        {people === null ? null : people.length === 0 ? (
          <p className="empty">No one yet. Join below.</p>
        ) : (
          people.map((p) => {
            const s = p[view];
            const hit = s && s.goal > 0 && s.done >= s.goal;
            return (
              <div key={p.id} className={`person${hit ? " hit" : ""}`}>
                <div className="name">{p.name}</div>
                {p.error || !s ? (
                  <div className="err">couldn&apos;t load</div>
                ) : (
                  <div className="count">{s.done}<span className="goal"> / {s.goal}</span></div>
                )}
              </div>
            );
          })
        )}
      </div>

      {panel === "none" ? (
        <>
          {msg && <p className="msg">{msg}</p>}
          <div className="foot">
            <button className="link" onClick={() => { setPanel("join"); setMsg(""); }}>Join</button>
            <button className="link" onClick={() => { setPanel("leave"); setMsg(""); }}>Leave</button>
          </div>
        </>
      ) : (
        <form onSubmit={submit}>
          {panel === "join" && <input name="name" placeholder="Your name" required maxLength={40} />}
          {panel === "join" && joinCode && <input name="code" placeholder="Join code" required />}
          {!oauth && <input name="token" placeholder="Todoist API token" required autoComplete="off" />}
          <button type="submit">
            {oauth ? (panel === "join" ? "Connect with Todoist" : "Confirm with Todoist") : panel === "join" ? "Join" : "Leave board"}
          </button>
          <p className="hint">
            {oauth
              ? panel === "join"
                ? "Todoist will ask you to approve read-only access. This app can see your completion counts but can't change anything. Revoke it anytime in Todoist → Settings → Integrations."
                : "Todoist will confirm it's you, then you're removed from the board."
              : "Find your token in Todoist → Settings → Integrations → Developer."}
          </p>
          {msg && <p className="msg">{msg}</p>}
          <button type="button" className="link" onClick={() => { setPanel("none"); setMsg(""); }}>Cancel</button>
        </form>
      )}
    </main>
  );
}
