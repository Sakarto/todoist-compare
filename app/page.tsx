"use client";
import { useCallback, useEffect, useState } from "react";

type Person = {
  id: string; name: string; error?: boolean;
  day?: { done: number; goal: number }; week?: { done: number; goal: number };
};

export default function Home() {
  const [view, setView] = useState<"day" | "week">("day");
  const [people, setPeople] = useState<Person[] | null>(null);
  const [panel, setPanel] = useState<"none" | "join" | "leave">("none");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/board", { cache: "no-store" });
    setPeople((await r.json()).people);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
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
        <div className="foot">
          <button className="link" onClick={() => setPanel("join")}>Join</button>
          <button className="link" onClick={() => setPanel("leave")}>Leave</button>
        </div>
      ) : (
        <form onSubmit={submit}>
          {panel === "join" && <input name="name" placeholder="Your name" required maxLength={40} />}
          <input name="token" placeholder="Todoist API token" required autoComplete="off" />
          {panel === "join" && <input name="code" placeholder="Join code (if the board has one)" />}
          <button type="submit">{panel === "join" ? "Join" : "Leave board"}</button>
          <p className="hint">Find your token in Todoist → Settings → Integrations → Developer. It stays on the server; only your name and counts are shown. Your goals come from Todoist → Settings → Productivity.</p>
          {msg && <p className="msg">{msg}</p>}
          <button type="button" className="link" onClick={() => { setPanel("none"); setMsg(""); }}>Cancel</button>
        </form>
      )}
    </main>
  );
}
