import { useState } from "react";
import { Landing } from "./components/Landing";
import { RoomPage } from "./components/RoomPage";

function parseRoomToken(): string | null {
  const match = window.location.pathname.match(/^\/room\/([^/]+)$/);
  return match?.[1] ?? null;
}

export function App() {
  const [roomToken] = useState(parseRoomToken);

  if (!roomToken) {
    return <Landing />;
  }
  return <RoomPage roomToken={roomToken} />;
}
