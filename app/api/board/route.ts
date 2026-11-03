import { NextResponse } from "next/server";
import { getMembers } from "@/lib/store";
import { fetchProgress } from "@/lib/stats";

export const dynamic = "force-dynamic";

// Returns names + progress only. Tokens never leave the server.
export async function GET() {
  const members = await getMembers();
  const people = await Promise.all(
    members.map(async (m) => {
      try {
        return { id: m.id, name: m.name, ...(await fetchProgress(m.token)) };
      } catch {
        return { id: m.id, name: m.name, error: true };
      }
    })
  );
  return NextResponse.json({ people });
}
