"use client";

import { Player } from "../../../worker/src/index";
import { getPlayerAvatarClass } from "../utils/colorUtils";

interface PlayersListProps {
  players: Player[];
  currentPlayerId: string;
  adminId: string | null;
  isAdmin: boolean;
  connectedPlayers: string[];
  onChangeTurn?: (playerId: string) => void;
}

export const PlayersList = ({
  players,
  currentPlayerId,
  adminId,
  isAdmin,
  connectedPlayers,
  onChangeTurn,
}: PlayersListProps) => {
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Players
        </h3>
        {isAdmin && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            (Click a player to change turn)
          </span>
        )}
      </div>
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden">
        {players.map((player, index) => {
          const isConnected = connectedPlayers.includes(player.id);
          return (
            <div
              key={player.id}
              className={`flex items-center py-3 px-4 ${
                index !== players.length - 1
                  ? "border-b border-gray-200 dark:border-gray-600"
                  : ""
              } ${
                player.isCurrentTurn ? "bg-green-50 dark:bg-green-900/20" : ""
              } ${
                player.id === currentPlayerId
                  ? "bg-blue-50 dark:bg-blue-900/20"
                  : ""
              } ${
                isAdmin
                  ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  : ""
              }`}
              onClick={() => {
                if (isAdmin && onChangeTurn) {
                  onChangeTurn(player.id);
                }
              }}
            >
              <div className="relative">
                <div
                  className={`h-8 w-8 rounded-full ${getPlayerAvatarClass(
                    player.id
                  )} flex items-center justify-center text-white font-bold`}
                >
                  {player.name.charAt(0).toUpperCase()}
                </div>
                <div
                  className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-white dark:border-gray-900 ${
                    isConnected
                      ? "bg-green-500 dark:bg-green-400"
                      : "bg-gray-400 dark:bg-gray-500"
                  }`}
                  title={isConnected ? "Online" : "Offline"}
                ></div>
              </div>
              <div className="ml-3 flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {player.name} {player.id === currentPlayerId ? "(You)" : ""}
                </span>
                {player.isCurrentTurn && (
                  <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-400 px-2 py-0.5 rounded-full">
                    Current Turn
                  </span>
                )}
                {adminId === player.id && (
                  <span className="text-xs bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full">
                    Host
                  </span>
                )}
                {!isConnected && (
                  <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                    Offline
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {isAdmin && (
        <div className="mt-3 text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
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
