"use client";
import { useCallback, useEffect, useState } from "react";

type Stat = { done: number; goal: number };
type Person = { id: string; name: string; day: Stat; week: Stat };

export default function Home() {
  const [view, setView] = useState<"day" | "week">("day");
  const [joined, setJoined] = useState<boolean | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [oauth, setOauth] = useState(false);
  const [joinCode, setJoinCode] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const j = await (await fetch("/api/board", { cache: "no-store" })).json();
    setJoined(j.joined);
    setPeople(j.people);
    setOauth(j.oauth);
    setJoinCode(j.joinCode);
  }, []);

  useEffect(() => {
    // Show the result of a Todoist sign-in, then clean up the address bar.
    const q = new URLSearchParams(window.location.search);
    const note = q.get("error") ?? "";
    if (note) setMsg(note);
    if (q.toString()) window.history.replaceState(null, "", "/");
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  async function joinBoard(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (oauth) {
      window.location.href = `/api/auth/start?${new URLSearchParams({ name: body.name ?? "", code: body.code ?? "" })}`;
      return;
    }
    setMsg("Checking…");
    const r = await fetch("/api/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) return setMsg(j.error ?? "Something went wrong.");
    setMsg("");
    load();
  }

  async function leaveBoard() {
    if (!window.confirm("Leave the board? Your name will be removed and you won't see anyone else until you join again.")) return;
    await fetch("/api/leave", { method: "POST" });
    load();
  }

  if (joined === null) return <main />;

  if (!joined) {
    return (
      <main className="center">
        <h1 className="title">Todoist Compare</h1>
        <p className="sub">Join to see everyone&apos;s Todoist progress for today and this week.</p>
        <form onSubmit={joinBoard}>
          <input name="name" placeholder="Your name" required maxLength={40} />
          {joinCode && <input name="code" placeholder="Join code" required />}
          {!oauth && <input name="token" placeholder="Todoist API token" required autoComplete="off" />}
          <button type="submit">{oauth ? "Connect with Todoist" : "Join"}</button>
          {msg && <p className="msg">{msg}</p>}
          <p className="hint">
            Todoist asks you to approve read-only access. It&apos;s used once to read your goals and today&apos;s
            count, then thrown away; nothing that can access your account is stored. After that, Todoist notifies
            the board when you complete tasks. Revoke anytime in Todoist → Settings → Integrations.
          </p>
        </form>
      </main>
    );
  }

  return (
    <main>
      <div className="toggle">
        <button className={view === "day" ? "on" : ""} onClick={() => setView("day")}>Day</button>
        <button className={view === "week" ? "on" : ""} onClick={() => setView("week")}>Week</button>
      </div>

      <div className="board">
        {people.map((p) => {
          const s = p[view];
          const hit = s.goal > 0 && s.done >= s.goal;
          return (
            <div key={p.id} className={`person${hit ? " hit" : ""}`}>
              <div className="name">{p.name}</div>
              <div className="count">{s.done}<span className="goal"> / {s.goal}</span></div>
            </div>
          );
        })}
      </div>

      <div className="foot">
        <button className="link" onClick={leaveBoard}>Leave</button>
      </div>
    </main>
  );
}
