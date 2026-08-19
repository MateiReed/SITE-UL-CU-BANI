import { NextRequest, NextResponse } from "next/server";
import {
  transformExecutorPayload,
  getRadarState,
  setRadarState,
  getRadarRawState,
  setRadarRawState,
  type ExecutorPayload,
} from "@/lib/radarStore";
import { broadcastRadarState, clearRadarState } from "@/lib/wsServer";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Invalid payload: Expected JSON object" },
      { status: 400 }
    );
  }

  setRadarRawState(body);
  const transformed = transformExecutorPayload(body as ExecutorPayload);
  setRadarState(transformed);

  // Broadcast to WebSocket clients if WS server is running
  try {
    broadcastRadarState(transformed, body);
  } catch {
    /* ignore if running on Vercel without WS server */
  }

  return NextResponse.json({
    ok: true,
    players: transformed.players.length,
    smokes: transformed.smokes?.length ?? 0,
    molotovs: transformed.molotovs?.length ?? 0,
    guns: transformed.guns?.length ?? 0,
    map: transformed.map,
  });
}

export async function GET(): Promise<NextResponse> {
  const state = getRadarState() ?? null;
  const raw = getRadarRawState() ?? state;
  return NextResponse.json(
    { state, raw },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}

export async function DELETE(): Promise<NextResponse> {
  setRadarState(undefined);
  setRadarRawState(undefined);
  try {
    clearRadarState();
  } catch {
    /* ignore */
  }
  return NextResponse.json({ ok: true, message: "Radar state cleared" });
}

