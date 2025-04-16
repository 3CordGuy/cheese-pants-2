"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { nanoid } from "nanoid";
import type { GameState, WsMessage } from "../../worker/src/index";
import { GameLobby } from "./components/GameLobby";
import { GamePlaying } from "./components/GamePlaying";
import { GameComplete } from "./components/GameComplete";
import { JoinForm } from "./components/JoinForm";
import { GameHeader } from "./components/GameHeader";
import { LoadingSpinner } from "./components/LoadingSpinner";

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

export function Game(props: { gameId: string }) {
  const searchParams = useSearchParams();
  const wsRef = useRef<WebSocket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);

  const [playerId] = useState(() => {
    // Try to get playerId from URL params, otherwise generate a new one
    const idFromUrl = searchParams.get("playerId");
    return idFromUrl || nanoid();
  });

  const [playerName] = useState(() => {
    const nameFromUrl = searchParams.get("playerName");
    return nameFromUrl ? decodeURIComponent(nameFromUrl) : "";
  });

  const requiredWords = searchParams.get("requiredWords")
    ? decodeURIComponent(searchParams.get("requiredWords") || "")
    : "";

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

  const handleJoinGame = (name: string) => {
    if (!name.trim() || isJoining) return;

    setIsJoining(true);

    // Start WebSocket connection with the entered name
    const ws = startWebSocket(name.trim());
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
          playerName: name.trim(),
          playerId: playerId,
        };
        console.log("Sending join message:", message);
        ws.send(JSON.stringify(message));

        // Update URL with player info for refreshes
        const url = new URL(window.location.href);
        url.searchParams.set("playerName", name.trim());
        url.searchParams.set("playerId", playerId);
        window.history.replaceState({}, "", url.toString());
      }, 500);
    };
  };

  const handleAddWord = (word: string) => {
    if (!word.trim()) return;
    const message: WsMessage = {
      type: "add-word",
      word: word.trim(),
      playerId: playerId,
    };
    wsRef.current?.send(JSON.stringify(message));
  };

  const handleDeleteWord = (index: number) => {
    const message: WsMessage = {
      type: "delete-word",
      index,
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
      playerId: playerId,
    };
    wsRef.current?.send(JSON.stringify(message));
  };

  const handleStartGame = () => {
    const message: WsMessage = {
      type: "start-game",
      playerId,
    };
    wsRef.current?.send(JSON.stringify(message));
  };

  const handleNewGame = () => {
    window.location.href = "/";
  };

  const handleShareGame = () => {
    const url = new URL(window.location.href);
    // Create a clean URL with only gameId and requiredWords
    const cleanUrl = new URL(url.pathname, url.origin);
    const requiredWords = url.searchParams.get("requiredWords");
    if (requiredWords) {
      cleanUrl.searchParams.set("requiredWords", requiredWords);
    }
    navigator.clipboard.writeText(cleanUrl.toString());
    alert("Game link copied to clipboard!");
  };

  const isCurrentPlayer = gameState?.players.find(
    (p) => p.id === playerId
  )?.isCurrentTurn;

  const isAdmin = gameState?.startedById === playerId;

  // Check if player is in the game
  const isPlayerInGame = gameState?.players.some((p) => p.id === playerId);

  // Show loader when joining
  if (isJoining && !gameState) {
    return <LoadingSpinner />;
  }

  // Show join form if not in game and not joining
  if (!isPlayerInGame && !isJoining) {
    return (
      <div className="p-4">
        <JoinForm
          initialPlayerName={playerName}
          isJoining={isJoining}
          onJoin={handleJoinGame}
        />
      </div>
    );
  }

  // Render game content
  return (
    <div className="p-4">
      <div className="space-y-4">
        <GameHeader onNewGame={handleNewGame} onShareGame={handleShareGame} />

        {gameState && renderGamePhase()}
      </div>
    </div>
  );

  // Helper function to render the current game phase
  function renderGamePhase() {
    if (!gameState) return null;

    switch (gameState.phase) {
      case "lobby":
        return (
          <GameLobby
            players={gameState.players}
            playerId={playerId}
            adminId={gameState.startedById}
            isAdmin={isAdmin || false}
            onStartGame={handleStartGame}
          />
        );

      case "playing":
        return (
          <GamePlaying
            gameState={gameState}
            playerId={playerId}
            isAdmin={isAdmin || false}
            isCurrentPlayer={isCurrentPlayer || false}
            onAddWord={handleAddWord}
            onDeleteWord={handleDeleteWord}
            onChangeTurn={handleChangeTurn}
          />
        );

      case "complete":
        return (
          <GameComplete
            gameState={gameState}
            playerId={playerId}
            onStartNewGame={handleNewGame}
          />
        );

      default:
        return null;
    }
  }
}
