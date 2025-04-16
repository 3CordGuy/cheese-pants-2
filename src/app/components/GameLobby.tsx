"use client";

import { Player } from "../../../worker/src/index";

interface GameLobbyProps {
  players: Player[];
  playerId: string;
  adminId: string | null;
  isAdmin: boolean;
  onStartGame: () => void;
}

export const GameLobby = ({
  players,
  playerId,
  adminId,
  isAdmin,
  onStartGame,
}: GameLobbyProps) => {
  return (
    <div className="space-y-4">
      <div className="border p-4 rounded bg-blue-50 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
        <h3 className="font-bold mb-2">Waiting for players to join...</h3>
        <p>Share this link with other players to invite them to the game.</p>
        <p className="mt-2">Players: {players.length}</p>
        <ul className="list-disc pl-4 mt-2">
          {players.map((player) => (
            <li key={player.id}>
              {player.name} {player.id === playerId ? "(You)" : ""}
              {adminId === player.id ? " (Host)" : ""}
            </li>
          ))}
        </ul>
        {isAdmin && (
          <button
            onClick={onStartGame}
            className="mt-4 bg-green-500 text-white px-4 py-2 rounded w-full hover:bg-green-600 transition-colors"
          >
            Start Game
          </button>
        )}
      </div>
    </div>
  );
};
