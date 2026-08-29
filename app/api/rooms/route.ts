import { createRoom, joinRoom, RoomError } from "../../../db/room-queries";
import { requireApiUser } from "../_shared";

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = payload.action === "join" ? "join" : "create";
    const room = action === "join" ? await joinRoom(payload.code, user) : await createRoom(user);
    return Response.json({ room }, { status: action === "create" ? 201 : 200 });
  } catch (error) {
    return roomErrorResponse(error);
  }
}

function roomErrorResponse(error: unknown) {
  if (error instanceof RoomError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return Response.json(
    { error: error instanceof Error ? error.message : "Unable to connect to the room." },
    { status: 500 },
  );
}
