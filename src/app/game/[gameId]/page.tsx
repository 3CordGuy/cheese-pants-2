"use client";

import { Game } from "../../game";
import { useParams } from "next/navigation";

export const dynamic = "force-dynamic";

export default function GamePage() {
  const params = useParams();
  const gameId = params.gameId as string;

  return <Game gameId={gameId} />;
}
