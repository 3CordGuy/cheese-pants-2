"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { nanoid } from "nanoid";
import type { GameState, WsMessage, WordInfo } from "../../worker/src/index";

// Word component for displaying words with metadata popover
const Word = ({
  word,
  index,
  isAdmin,
  isLast,
  onDelete,
}: {
  word: WordInfo;
  index: number;
  isAdmin: boolean;
  isLast: boolean;
  onDelete: (index: number) => void;
}) => {
  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLSpanElement>(null);

  // Format the timestamp using native Intl API instead of date-fns
  const formattedTime = word.addedAt
    ? new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      }).format(new Date(word.addedAt))
    : "";

  // Handle mouse events for both the word and popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        wordRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        !wordRef.current.contains(event.target as Node)
      ) {
        setShowPopover(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="inline-block relative">
      <span
        ref={wordRef}
        className={`${
          word.isRequired
            ? "font-semibold text-blue-600 dark:text-blue-400"
            : ""
        } hover:bg-gray-100 dark:hover:bg-gray-800 px-1 py-0.5 rounded cursor-pointer`}
        onClick={() => setShowPopover(!showPopover)}
      >
        {word.text}
      </span>

      {showPopover && (
        <div
          ref={popoverRef}
          className="absolute left-0 top-full mt-1 z-10 bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-lg rounded p-2 text-xs w-48 text-gray-900 dark:text-gray-200"
        >
          <p className="font-bold">{word.text}</p>
          <p>Added by: {word.authorName}</p>
          <p className="text-gray-500 dark:text-gray-400">{formattedTime}</p>
          {word.isRequired && (
            <p className="text-blue-600 dark:text-blue-400 font-semibold mt-1">
              Required word
            </p>
          )}
          {isAdmin && (
            <button
              onClick={() => onDelete(index)}
              className="mt-2 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-xs bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 px-2 py-1 rounded w-full text-center"
            >
              Delete Word
            </button>
          )}
        </div>
      )}

      {!isLast && <span>&nbsp;</span>}
    </div>
  );
};

export function Game(props: { gameId: string }) {
  const searchParams = useSearchParams();
  const wsRef = useRef<WebSocket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId] = useState(() => {
    // Try to get playerId from URL params, otherwise generate a new one
    const idFromUrl = searchParams.get("playerId");
    return idFromUrl || nanoid();
  });
  const [playerName, setPlayerName] = useState(() => {
    const nameFromUrl = searchParams.get("playerName");
    return nameFromUrl ? decodeURIComponent(nameFromUrl) : "";
  });
  const requiredWords = searchParams.get("requiredWords")
    ? decodeURIComponent(searchParams.get("requiredWords") || "")
    : "";
  const [wordInput, setWordInput] = useState("");
  const [, dispatchMessage] = useReducer(messageReducer, {
    in: "",
    out: "",
  });
  // Track if we're already connected to prevent double joins
  const [isJoining, setIsJoining] = useState(false);

  const startWebSocket = useCallback(
    (name: string) => {
      const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
      const wsHost = process.env.NEXT_PUBLIC_WS_HOST;
      if (!wsHost) {
        console.error(
          "WebSocket host not configured. Please set NEXT_PUBLIC_WS_HOST environment variable."
        );
        return null;
      }
      const ws = new WebSocket(
        `${wsProtocol}://${wsHost}/ws?gameId=${
          props.gameId
        }&playerId=${playerId}&playerName=${encodeURIComponent(
          name
        )}&requiredWords=${encodeURIComponent(requiredWords)}`
      );

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setIsJoining(false);
      };

      ws.onopen = () => {
        console.log("WebSocket connected");
        dispatchMessage({ type: "out", message: "get-game-state" });
        const message: WsMessage = { type: "get-game-state" };
        ws.send(JSON.stringify(message));
      };

      ws.onmessage = (message) => {
        const messageData: WsMessage = JSON.parse(message.data);
        console.log("Received WebSocket message:", messageData);
        dispatchMessage({ type: "in", message: messageData.type });
        switch (messageData.type) {
          case "quit":
            console.log("Player quit, resetting game state");
            setGameState(null);
            setIsJoining(false);
            break;
          case "get-game-state-response":
            console.log("Received game state:", messageData.gameState);
            setGameState(messageData.gameState);
            setIsJoining(false);
            break;
          case "game-complete":
            alert(
              `Game Complete! Final sentence: ${messageData.sentence.join(" ")}`
            );
            break;
          case "message":
            console.log(messageData.data);
            break;
        }
      };
      ws.onclose = () => {
        setGameState(null);
        setIsJoining(false);
      };
      return ws;
    },
    [props.gameId, playerId, requiredWords]
  );

  useEffect(() => {
    // Check if both playerName and playerId are present in URL
    const nameFromUrl = searchParams.get("playerName");
    const idFromUrl = searchParams.get("playerId");

    if (nameFromUrl && idFromUrl === playerId) {
      // User is returning with playerId in URL, auto-connect
      setIsJoining(true);
      wsRef.current = startWebSocket(decodeURIComponent(nameFromUrl));

      // After connection is established, send join message
      if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.onopen = () => {
          // Send a test connection message first to verify the requiredWords
          const testMessage: WsMessage = { type: "test-connection" };
          wsRef.current?.send(JSON.stringify(testMessage));

          // Then send join message
          setTimeout(() => {
            const message: WsMessage = {
              type: "join",
              gameId: props.gameId,
              playerName: decodeURIComponent(nameFromUrl),
              playerId: playerId,
            };
            console.log("Sending join message:", message);
            wsRef.current?.send(JSON.stringify(message));
          }, 500);
        };
      }

      return () => wsRef.current?.close();
    }
  }, [props.gameId, startWebSocket, searchParams, playerId]);

  const handleJoinGame = () => {
    if (!playerName.trim() || isJoining) return;

    setIsJoining(true);

    // Start WebSocket connection with the entered name
    const ws = startWebSocket(playerName.trim());
    if (!ws) {
      setIsJoining(false);
      return;
    }

    wsRef.current = ws;

    // Send join message after connection is established
    ws.onopen = () => {
      // First send test connection to verify game state
      const testMessage: WsMessage = { type: "test-connection" };
      wsRef.current?.send(JSON.stringify(testMessage));

      // Then send join message after a short delay
      setTimeout(() => {
        const message: WsMessage = {
          type: "join",
          gameId: props.gameId,
          playerName: playerName.trim(),
          playerId: playerId,
        };
        console.log("Sending join message:", message);
        ws.send(JSON.stringify(message));

        // Update URL with player info for refreshes
        const url = new URL(window.location.href);
        url.searchParams.set("playerName", playerName.trim());
        url.searchParams.set("playerId", playerId);
        window.history.replaceState({}, "", url.toString());
      }, 500);
    };
  };

  const handleAddWord = () => {
    if (!wordInput.trim()) return;
    const message: WsMessage = {
      type: "add-word",
      word: wordInput.trim(),
      playerId: playerId,
    };
    wsRef.current?.send(JSON.stringify(message));
    setWordInput("");
  };

  const handleDeleteWord = (index: number) => {
    const message: WsMessage = {
      type: "delete-word",
      index,
      playerId,
    };
    wsRef.current?.send(JSON.stringify(message));
  };

  const isCurrentPlayer = gameState?.players.find(
    (p) => p.id === playerId
  )?.isCurrentTurn;

  const isAdmin = gameState?.startedById === playerId;

  const handleStartGame = () => {
    const message: WsMessage = {
      type: "start-game",
      playerId,
    };
    wsRef.current?.send(JSON.stringify(message));
  };

  const handleChangeTurn = (newCurrentPlayerId: string) => {
    // Only the admin can change turns
    if (!isAdmin) return;

    const message: WsMessage = {
      type: "change-turn",
      newCurrentPlayerId: newCurrentPlayerId,
      playerId: playerId, // This is the admin's ID making the request
    };
    wsRef.current?.send(JSON.stringify(message));
  };

  // Render function based on game phase
  const renderPhaseContent = () => {
    if (!gameState) return null;

    switch (gameState.phase) {
      case "lobby": {
        return (
          <div className="space-y-4">
            <div className="border p-4 rounded bg-blue-50 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
              <h3 className="font-bold mb-2">Waiting for players to join...</h3>
              <p>
                Share this link with other players to invite them to the game.
              </p>
              <p className="mt-2">Players: {gameState.players.length}</p>
              <ul className="list-disc pl-4 mt-2">
                {gameState.players.map((player) => (
                  <li key={player.id}>
                    {player.name} {player.id === playerId ? "(You)" : ""}
                    {gameState.startedById === player.id ? " (Host)" : ""}
                  </li>
                ))}
              </ul>
              {isAdmin && (
                <button
                  onClick={handleStartGame}
                  className="mt-4 bg-green-500 text-white px-4 py-2 rounded w-full hover:bg-green-600 transition-colors"
                >
                  Start Game
                </button>
              )}
            </div>
          </div>
        );
      }

      case "playing": {
        return (
          <>
            <div className="border p-4 rounded">
              <h3 className="font-bold mb-2">Current Sentence:</h3>
              <div className="flex flex-wrap gap-1">
                {gameState.words.length === 0 ? (
                  <p>No words yet...</p>
                ) : (
                  gameState.words.map((word, index) => (
                    <Word
                      key={index}
                      word={word}
                      index={index}
                      isAdmin={isAdmin}
                      isLast={index === gameState.words.length - 1}
                      onDelete={handleDeleteWord}
                    />
                  ))
                )}
              </div>
            </div>
            <div className="border p-4 rounded">
              <h3 className="font-bold mb-2">Game Requirements:</h3>
              <p className="mb-2 text-sm">To complete the game:</p>
              <ol className="list-decimal pl-6 mb-2">
                <li>Use all required words listed below</li>
                <li>End the sentence with punctuation (., !, ?)</li>
              </ol>
              <div className="mt-3">
                <h4 className="font-bold text-sm">Required Words:</h4>
                <ul className="list-disc pl-4">
                  {gameState.requiredWords.map((word, index) => (
                    <li
                      key={word}
                      className={
                        gameState.hasRequiredWords[index] ? "line-through" : ""
                      }
                    >
                      {word}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
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
                {gameState.players.map((player) => (
                  <li
                    key={player.id}
                    className={`${player.isCurrentTurn ? "font-bold" : ""} ${
                      isAdmin
                        ? "cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                        : ""
                    }`}
                    onClick={() => {
                      if (isAdmin) {
                        handleChangeTurn(player.id);
                      }
                    }}
                  >
                    {player.name} {player.id === playerId ? "(You)" : ""}
                    {player.isCurrentTurn ? " (Current Turn)" : ""}
                    {gameState.startedById === player.id ? " (Host)" : ""}
                  </li>
                ))}
              </ul>
              {isAdmin && (
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-2 rounded">
                  <p>
                    As the host, you can click on any player to make it their
                    turn. This is useful if someone disconnects or you delete a
                    word and need to reassign the turn.
                  </p>
                </div>
              )}
            </div>

            {isCurrentPlayer && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={wordInput}
                  onChange={(e) => setWordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAddWord();
                    }
                  }}
                  placeholder="Enter your word"
                  className="border p-2 rounded w-full"
                />
                <p className="text-xs text-gray-500">
                  {gameState.hasRequiredWords.every(Boolean)
                    ? "All required words have been used! Add punctuation (., !, ?) to complete the game."
                    : "Add a word to continue the sentence."}
                </p>
                <button
                  onClick={handleAddWord}
                  className="bg-green-500 text-white px-4 py-2 rounded w-full"
                >
                  Add Word
                </button>
              </div>
            )}

            {isAdmin && !isCurrentPlayer && (
              <div className="mt-4 text-xs text-gray-600 bg-gray-100 p-2 rounded">
                <p>
                  As the host, you can delete any word by clicking it and
                  selecting &quot;Delete Word&quot;.
                </p>
              </div>
            )}
          </>
        );
      }

      case "complete": {
        return (
          <div className="space-y-4">
            <div className="border p-4 rounded bg-green-50 text-green-800">
              <h3 className="font-bold mb-2">Game Complete!</h3>
              <p className="font-bold">Final Sentence:</p>
              <p className="italic mt-2">
                {gameState.words.map((word, i) => (
                  <span
                    key={i}
                    className={
                      word.isRequired ? "font-semibold text-blue-600" : ""
                    }
                  >
                    {word.text}
                    {i < gameState.words.length - 1 ? " " : ""}
                  </span>
                ))}
              </p>
            </div>
            <div className="border p-4 rounded">
              <h3 className="font-bold mb-2">Players:</h3>
              <ul className="list-disc pl-4">
                {gameState.players.map((player) => (
                  <li key={player.id}>
                    {player.name} {player.id === playerId ? "(You)" : ""}
                    {gameState.startedById === player.id ? " (Host)" : ""}
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => {
                // Return to home page to start a new game
                window.location.href = "/";
              }}
              className="bg-blue-500 text-white px-4 py-2 rounded w-full"
            >
              Start New Game
            </button>
          </div>
        );
      }

      default:
        return null;
    }
  };

  // Show loader when joining
  if (isJoining && !gameState) {
    return (
      <div className="p-4 flex items-center justify-center h-48">
        <div className="text-center">
          <div className="mb-2">Connecting to game...</div>
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  // Show join form only if we're not already in the game or joining
  const isPlayerInGame = gameState?.players.some((p) => p.id === playerId);

  return (
    <div className="p-4">
      {!isPlayerInGame && !isJoining ? (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Join the Game</h2>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isJoining) {
                handleJoinGame();
              }
            }}
            placeholder="Enter your name"
            className="border p-2 rounded"
            disabled={isJoining}
          />
          <button
            onClick={handleJoinGame}
            className={`bg-blue-500 text-white px-4 py-2 rounded ${
              isJoining ? "opacity-50 cursor-not-allowed" : ""
            }`}
            disabled={isJoining}
          >
            Join Game
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Cheese Pants: The Sequel</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  window.location.href = "/";
                }}
                className="bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600 transition-colors"
              >
                New Game
              </button>
              <button
                onClick={() => {
                  const url = new URL(window.location.href);
                  // Create a clean URL with only gameId and requiredWords
                  const cleanUrl = new URL(url.pathname, url.origin);
                  const requiredWords = url.searchParams.get("requiredWords");
                  if (requiredWords) {
                    cleanUrl.searchParams.set("requiredWords", requiredWords);
                  }
                  navigator.clipboard.writeText(cleanUrl.toString());
                  alert("Game link copied to clipboard!");
                }}
                className="bg-blue-500 text-white px-4 py-2 rounded text-sm"
              >
                Share Game
              </button>
            </div>
          </div>
          {renderPhaseContent()}
        </div>
      )}
    </div>
  );
}

type MessageState = { in: string; out: string };
type MessageAction = { type: "in" | "out"; message: string };
function messageReducer(state: MessageState, action: MessageAction) {
  switch (action.type) {
    case "in":
      return { ...state, in: action.message };
    case "out":
      return { ...state, out: action.message };
    default:
      return state;
  }
}
