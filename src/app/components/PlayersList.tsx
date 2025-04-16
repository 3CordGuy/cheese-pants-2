"use client";

import { Player } from "../../../worker/src/index";

interface PlayersListProps {
  players: Player[];
  currentPlayerId: string;
  adminId: string | null;
  isAdmin: boolean;
  onChangeTurn?: (playerId: string) => void;
}

export const PlayersList = ({
  players,
  currentPlayerId,
  adminId,
  isAdmin,
  onChangeTurn,
}: PlayersListProps) => {
  return (
    <div className="border p-4 rounded">
      <div className="flex justify-between items-center">
        <h3 className="font-bold mb-2">Players:</h3>
        {isAdmin && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            (Click a player to change turn)
          </span>
        )}
      </div>
      <ul className="list-disc pl-4">
        {players.map((player) => (
          <li
            key={player.id}
            className={`${player.isCurrentTurn ? "font-bold" : ""} ${
              isAdmin
                ? "cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                : ""
            }`}
            onClick={() => {
              if (isAdmin && onChangeTurn) {
                onChangeTurn(player.id);
              }
            }}
          >
            {player.name} {player.id === currentPlayerId ? "(You)" : ""}
            {player.isCurrentTurn ? " (Current Turn)" : ""}
            {adminId === player.id ? " (Host)" : ""}
          </li>
        ))}
      </ul>
      {isAdmin && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-2 rounded">
          <p>
            As the host, you can click on any player to make it their turn. This
            is useful if someone disconnects or you delete a word and need to
            reassign the turn.
          </p>
        </div>
      )}
    </div>
  );
};
