"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { GameState, WsMessage } from "../../worker/src/index";

export function Game(props: { gameId: string }) {
  const wsRef = useRef<WebSocket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [wordInput, setWordInput] = useState("");
  const [, dispatchMessage] = useReducer(messageReducer, {
    in: "",
    out: "",
  });

  const startWebSocket = useCallback(() => {
    const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsHost = process.env.NEXT_PUBLIC_WS_HOST;
    if (!wsHost) {
      console.error(
        "WebSocket host not configured. Please set NEXT_PUBLIC_WS_HOST environment variable."
      );
      return null;
    }
    const ws = new WebSocket(
      `${wsProtocol}://${wsHost}/ws?gameId=${props.gameId}`
    );

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onopen = () => {
      console.log("WebSocket connected");
      dispatchMessage({ type: "out", message: "get-game-state" });
      const message: WsMessage = { type: "get-game-state" };
      ws.send(JSON.stringify(message));
    };
    ws.onmessage = (message) => {
      const messageData: WsMessage = JSON.parse(message.data);
      dispatchMessage({ type: "in", message: messageData.type });
      switch (messageData.type) {
        case "quit":
          setGameState(null);
          break;
        case "get-game-state-response":
          setGameState(messageData.gameState);
          break;
        case "game-complete":
          alert(
            `Game Complete! Final sentence: ${messageData.sentence.join(" ")}`
          );
          break;
        case "message":
          alert(messageData.data);
          break;
      }
    };
    ws.onclose = () => setGameState(null);
    return ws;
  }, [props.gameId]);

  useEffect(() => {
    wsRef.current = startWebSocket();
    return () => wsRef.current?.close();
  }, [props.gameId, startWebSocket]);

  const handleJoinGame = () => {
    if (!playerName.trim()) return;
    const message: WsMessage = {
      type: "join",
      gameId: props.gameId,
      playerName: playerName.trim(),
    };
    console.log("Sending message:", message);
    wsRef.current?.send(JSON.stringify(message));
  };

  const handleAddWord = () => {
    if (!wordInput.trim()) return;
    const message: WsMessage = {
      type: "add-word",
      word: wordInput.trim(),
      playerId: props.gameId,
    };
    wsRef.current?.send(JSON.stringify(message));
    setWordInput("");
  };

  const isCurrentPlayer = gameState?.players.find(
    (p) => p.id === props.gameId
  )?.isCurrentTurn;

  return (
    <div className="p-4">
      {!gameState?.players.find((p) => p.id === props.gameId) ? (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Join the Game</h2>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            className="border p-2 rounded"
          />
          <button
            onClick={handleJoinGame}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Join Game
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Cheese Pants Game</h2>
          <div className="border p-4 rounded">
            <h3 className="font-bold mb-2">Current Sentence:</h3>
            <p>{gameState.words.join(" ") || "No words yet..."}</p>
          </div>
          <div className="border p-4 rounded">
            <h3 className="font-bold mb-2">Required Words:</h3>
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
          <div className="border p-4 rounded">
            <h3 className="font-bold mb-2">Players:</h3>
            <ul className="list-disc pl-4">
              {gameState.players.map((player) => (
                <li
                  key={player.id}
                  className={player.isCurrentTurn ? "font-bold" : ""}
                >
                  {player.name}
                  {player.isCurrentTurn ? " (Current Turn)" : ""}
                </li>
              ))}
            </ul>
          </div>
          {isCurrentPlayer && (
            <div className="space-y-2">
              <input
                type="text"
                value={wordInput}
                onChange={(e) => setWordInput(e.target.value)}
                placeholder="Enter your word"
                className="border p-2 rounded w-full"
              />
              <button
                onClick={handleAddWord}
                className="bg-green-500 text-white px-4 py-2 rounded w-full"
              >
                Add Word
              </button>
            </div>
          )}
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
