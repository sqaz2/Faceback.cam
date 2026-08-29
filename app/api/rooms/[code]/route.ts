import {
  heartbeatRoom,
  RoomError,
  setPlayerReady,
  startRoom,
} from "../../../../db/room-queries";
import { requireApiUser } from "../../_shared";

type RoomRouteContext = {
  params: Promise<{ code: string }>;
};

export async function POST(request: Request, { params }: RoomRouteContext) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const { code } = await params;
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = typeof payload.action === "string" ? payload.action : "heartbeat";

    if (action === "ready") {
      const room = await setPlayerReady(code, user, payload.ready === true);
      return Response.json({ room });
    }
    if (action === "start") {
      const room = await startRoom(code, user);
      return Response.json({ room });
    }

    const room = await heartbeatRoom(code, user);
    return Response.json({ room });
  } catch (error) {
    if (error instanceof RoomError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to update the room." },
      { status: 500 },
    );
  }
}
