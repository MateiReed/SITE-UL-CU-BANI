import { NextRequest, NextResponse } from "next/server";
import {
  transformExecutorPayload,
  getRadarState,
  setRadarState,
  type ExecutorPayload,
} from "@/lib/radarStore";
import { broadcastRadarState, clearRadarState } from "@/lib/wsServer";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: ExecutorPayload;
  try {
    body = (await req.json()) as ExecutorPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || !body.map || !Array.isArray(body.players)) {
    return NextResponse.json(
      { error: "Invalid payload structure. Expected { map, players[] }" },
      { status: 422 }
    );
  }

  const transformed = transformExecutorPayload(body);

  // Broadcast to WebSocket clients if WS server is running
  try {
    broadcastRadarState(transformed);
  } catch {
    /* ignore if running on Vercel without WS server */
  }

  return NextResponse.json({
    ok: true,
    players: transformed.players.length,
    map: transformed.map,
  });
}

export async function GET(): Promise<NextResponse> {
  const state = getRadarState() ?? null;
  return NextResponse.json(
    { state },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}

export async function DELETE(): Promise<NextResponse> {
  setRadarState(undefined);
  try {
    clearRadarState();
  } catch {
    /* ignore */
  }
  return NextResponse.json({ ok: true, message: "Radar state cleared" });
}
