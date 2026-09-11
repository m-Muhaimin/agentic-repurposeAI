import { NextResponse } from "next/server";

// Liveness probe for uptime monitors. Public by design — returns a timestamp
// and a 200 so hosts like https://vervai.onrender.com/api/healtz can be used as
// a simple reachability check. No user data, no secrets.
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      ok: true,
      service: "verv-ai-backend",
      time: new Date().toISOString()
    },
    { status: 200 }
  );
}