"use client";

import { Player } from "../../../worker/src/index";
import { useState } from "react";
import { getPlayerAvatarClass } from "../utils/colorUtils";

interface GameLobbyProps {
  players: Player[];
  playerId: string;
  adminId: string | null;
  isAdmin: boolean;
  connectedPlayers: string[];
  onStartGame: () => void;
  onRemovePlayer: (playerIdToRemove: string) => void;
}

export const GameLobby = ({
  players,
  playerId,
  adminId,
  isAdmin,
  connectedPlayers,
  onStartGame,
  onRemovePlayer,
}: GameLobbyProps) => {
  const [copied, setCopied] = useState(false);

  const copyGameLink = () => {
    // Create a URL object from the current window location
    const url = new URL(window.location.href);

    // Keep only the gameId and requiredWords parameters, remove player-specific info
    const gameId = url.pathname; // Keep the pathname with the game ID
    const requiredWords = url.searchParams.get("requiredWords");

    // Create a clean URL with only necessary parameters
    const cleanUrl = new URL(gameId, window.location.origin);
    if (requiredWords) {
      cleanUrl.searchParams.set("requiredWords", requiredWords);
    }

    // Copy the sanitized URL to clipboard
    navigator.clipboard.writeText(cleanUrl.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="md:flex md:gap-6">
      {/* Main content area */}
      <div className="md:flex-1 space-y-6">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl border border-blue-100 dark:border-blue-900 transition-all duration-300">
          <h3 className="text-2xl font-bold mb-2 text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Game Lobby
          </h3>
          <p className="text-gray-600 dark:text-gray-300 text-center mb-6">
            Waiting for players to join...
          </p>

          <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg mb-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-blue-800 dark:text-blue-300">
                Share Game Link:
              </h4>
              <button
                onClick={copyGameLink}
                className="text-sm bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-md hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors flex items-center"
              >
                {copied ? "Copied!" : "Copy Link"}
              </button>
            </div>
            <p className="text-gray-700 dark:text-gray-300 text-sm mb-3">
              Send this link to friends so they can join your game:
            </p>
            <div className="bg-white dark:bg-gray-700 p-2 rounded border border-blue-200 dark:border-blue-800 text-gray-600 dark:text-gray-300 text-xs break-all">
              {(() => {
                // Display sanitized URL in the UI
                const url = new URL(window.location.href);
                const gameId = url.pathname;
                const requiredWords = url.searchParams.get("requiredWords");

                const cleanUrl = new URL(gameId, window.location.origin);
                if (requiredWords) {
                  cleanUrl.searchParams.set("requiredWords", requiredWords);
                }

                return cleanUrl.toString();
              })()}
            </div>
          </div>

          {isAdmin && (
            <button
              onClick={onStartGame}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-4 rounded-lg w-full transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg"
              disabled={players.length < 2}
            >
              {players.length < 2 ? "Waiting for Players..." : "Start Game"}
            </button>
          )}

          {!isAdmin && (
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg text-center text-gray-700 dark:text-gray-300">
              Waiting for the host to start the game...
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className="md:w-80 lg:w-96 space-y-6 mt-6 md:mt-0">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl border border-blue-100 dark:border-blue-900 transition-all duration-300">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-gray-700 dark:text-gray-300">
                Players ({players.length})
              </h4>
              {isAdmin && players.length < 2 && (
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  Invite more players!
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
                      player.id === playerId
                        ? "bg-blue-50 dark:bg-blue-900/20"
                        : ""
                    }`}
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
                    <div className="ml-3 flex-grow">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-medium">
                          {player.name} {player.id === playerId ? "(You)" : ""}
                        </span>
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

                    {/* Add remove button for admin */}
                    {isAdmin && player.id !== playerId && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemovePlayer(player.id);
                        }}
                        className="ml-auto text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        title="Remove player"
                        aria-label="Remove player"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="w-5 h-5"
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
                );
              })}
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg text-sm">
            <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2">
              How to Play:
            </h4>
            <ol className="list-decimal pl-5 space-y-1 text-gray-700 dark:text-gray-300">
              <li>Players take turns adding one word at a time</li>
              <li>Build a sentence that includes all required words</li>
              <li>End with punctuation to complete the game</li>
              <li>The funniest sentences win!</li>
            </ol>

            {/* Display Required Words Section */}
            <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
              <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2">
                Required Words:
              </h4>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  // Get required words from URL
                  const url = new URL(window.location.href);
                  const requiredWordsParam =
                    url.searchParams.get("requiredWords");
                  const words = requiredWordsParam
                    ? decodeURIComponent(requiredWordsParam).split(",")
                    : ["cheese", "pants"]; // Default words

                  return words.map((word) => (
                    <span
                      key={word}
                      className="px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400"
                    >
                      {word}
                    </span>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
