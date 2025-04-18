"use client";

import { Player } from "../../../worker/src/index";
import {
  getPlayerAvatarClass,
  getPlayerBadgeClasses,
} from "../utils/colorUtils";

interface PlayersListProps {
  players: Player[];
  currentPlayerId: string;
  adminId: string | null;
  isAdmin: boolean;
  connectedPlayers: string[];
  onChangeTurn: (playerId: string) => void;
  onRemovePlayer?: (playerIdToRemove: string) => void;
}

export const PlayersList = ({
  players,
  currentPlayerId,
  adminId,
  isAdmin,
  connectedPlayers,
  onChangeTurn,
  onRemovePlayer,
}: PlayersListProps) => {
  console.log("PlayersList rendered with:", {
    players: players.map((p) => p.id),
    connectedPlayers,
    currentPlayerId,
  });

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
                  )} flex items-center justify-center font-bold`}
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
                  <span className={getPlayerBadgeClasses(player.id, "current")}>
                    Current Turn
                  </span>
                )}
                {adminId === player.id && (
                  <span className={getPlayerBadgeClasses(player.id, "host")}>
                    Host
                  </span>
                )}
                {!isConnected && (
                  <span className={getPlayerBadgeClasses(player.id, "offline")}>
                    Offline
                  </span>
                )}
              </div>
              <div className="ml-auto">
                {isAdmin && player.id !== currentPlayerId && onRemovePlayer && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemovePlayer(player.id);
                    }}
                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1"
                    title="Remove player"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {isAdmin && (
        <div className="mt-3 text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
          <p>
            As the host, you can click on any player to make it their turn. You
            can also remove players who are no longer participating by clicking
            the red remove button.
          </p>
        </div>
      )}
    </div>
  );
};
