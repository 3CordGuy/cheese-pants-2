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
import { Footer } from "./components/Footer";

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

const RECONNECT_DELAY = 2000; // 2 seconds
const MAX_RECONNECT_ATTEMPTS = 5;

export function Game(props: { gameId: string }) {
  const searchParams = useSearchParams();
  const wsRef = useRef<WebSocket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "connecting"
  >("disconnected");

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

  // Add a new state for notifications permission at the top with other states
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Add state to track previous turn status
  const [wasCurrentPlayer, setWasCurrentPlayer] = useState(false);

  // Get the turnTimeLimit from URL params
  const turnTimeLimit = parseInt(searchParams.get("turnTimeLimit") || "0", 10);
  console.log("Game initialized with turn time limit:", turnTimeLimit);

  // Add this function to request notification permissions
  const requestNotificationPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      console.log("This browser does not support notifications");
      alert("This browser does not support desktop notifications");
      return;
    }

    try {
      // If already enabled, toggle off
      if (notificationsEnabled) {
        setNotificationsEnabled(false);
        console.log("Notifications disabled by user");
        return;
      }

      // Request permission
      console.log("Requesting notification permission...");
      const permission = await Notification.requestPermission();
      console.log("Notification permission response:", permission);

      if (permission === "granted") {
        setNotificationsEnabled(true);
        console.log("Notification permission granted");

        // Show a test notification to confirm it's working
        const notification = new Notification("Notifications Enabled", {
          body: "You will be notified when it's your turn",
          icon: "/favicon.ico",
        });

        setTimeout(() => notification.close(), 3000);
      } else {
        setNotificationsEnabled(false);
        console.log("Notification permission denied");
        alert("Please enable notifications to be alerted when it's your turn");
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      alert(
        "Error requesting notification permission. Please check your browser settings."
      );
    }
  }, [notificationsEnabled]);

  // Add this function to send a notification
  const sendTurnNotification = useCallback(() => {
    if (!notificationsEnabled) {
      console.log("Notifications not enabled");
      return;
    }

    if (Notification.permission !== "granted") {
      console.log("Notification permission not granted");
      return;
    }

    console.log("Sending turn notification");

    try {
      const notification = new Notification("Cheese Pants", {
        body: "It's your turn!",
        icon: "/favicon.ico",
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Automatically close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  }, [notificationsEnabled]);

  // Move the isCurrentPlayer definition here, before it's used in effects
  const isCurrentPlayer = gameState?.players.find(
    (p) => p.id === playerId
  )?.isCurrentTurn;

  const isAdmin = gameState?.startedById === playerId;

  // Improved effect to handle turn notifications - now detects when turn changes
  useEffect(() => {
    // Only run this effect when we have game state and can determine turns
    if (!gameState) return;

    const isPlayerTurn = isCurrentPlayer === true;
    console.log("Turn check:", {
      isPlayerTurn,
      wasCurrentPlayer,
      notificationsEnabled,
    });

    // If it just became the player's turn (wasn't their turn before)
    if (isPlayerTurn && !wasCurrentPlayer) {
      console.log("It's now your turn!");
      sendTurnNotification();
    }

    // Update previous turn state
    setWasCurrentPlayer(isPlayerTurn);
  }, [
    gameState,
    isCurrentPlayer,
    wasCurrentPlayer,
    notificationsEnabled,
    sendTurnNotification,
  ]);

  // Add an effect to check notification permissions on load
  useEffect(() => {
    // Check if notification permission was previously granted
    if ("Notification" in window) {
      console.log("Current notification permission:", Notification.permission);
      if (Notification.permission === "granted") {
        setNotificationsEnabled(true);
      }
    }
  }, []);

  // Check if player is in the game
  const isPlayerInGame = gameState?.players.some((p) => p.id === playerId);

  // Define startWebSocket first without the attempt reconnect dependency
  const startWebSocket = useCallback(
    (name: string) => {
      const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
      const wsHost = process.env.NEXT_PUBLIC_WS_HOST;
      if (!wsHost) {
        console.error(
          "WebSocket host not configured. Please set NEXT_PUBLIC_WS_HOST environment variable."
        );
        setConnectionStatus("disconnected");
        return null;
      }

      setConnectionStatus("connecting");

      const ws = new WebSocket(
        `${wsProtocol}://${wsHost}/ws?gameId=${
          props.gameId
        }&playerId=${playerId}&playerName=${encodeURIComponent(
          name
        )}&requiredWords=${encodeURIComponent(
          requiredWords
        )}&turnTimeLimit=${turnTimeLimit}`
      );

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setConnectionStatus("disconnected");
        ws.close();
      };

      ws.onopen = () => {
        console.log("WebSocket connected");
        setConnectionStatus("connected");
        reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection
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
          case "message":
            console.log(messageData.data);
            break;
        }
      };

      // We'll set onclose handler after defining attemptReconnect
      return ws;
    },
    [props.gameId, playerId, requiredWords, turnTimeLimit]
  );

  // Now define attemptReconnect with startWebSocket already defined
  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.log("Max reconnection attempts reached");
      reconnectAttemptsRef.current = 0;
      setConnectionStatus("disconnected");
      return;
    }

    const nameFromUrl = searchParams.get("playerName");
    if (!nameFromUrl) return;

    console.log(
      `Attempting to reconnect (${
        reconnectAttemptsRef.current + 1
      }/${MAX_RECONNECT_ATTEMPTS})...`
    );
    reconnectAttemptsRef.current++;
    setConnectionStatus("connecting");

    // Clear any existing timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        const ws = startWebSocket(decodeURIComponent(nameFromUrl));
        if (ws) {
          // Save the original onopen handler
          const originalOnOpen = ws.onopen;

          // Create a new onopen handler that combines both actions
          ws.onopen = (event: Event) => {
            // First call the original handler to ensure normal connection is established
            if (originalOnOpen) {
              // Since TypeScript has issues with the EventHandler types, we'll handle it carefully
              try {
                // Try invoking it as a function
                if (typeof originalOnOpen === "function") {
                  (originalOnOpen as (this: WebSocket, ev: Event) => void).call(
                    ws,
                    event
                  );
                }
              } catch (error) {
                console.error("Error calling original onopen handler:", error);
              }
            }

            // Make sure we update the connection status
            setConnectionStatus("connected");
            console.log("Reconnection established, sending join message");
            // Then send join message to reconnect
            const message: WsMessage = {
              type: "join",
              gameId: props.gameId,
              playerName: decodeURIComponent(nameFromUrl),
              playerId: playerId,
            };
            console.log("Sending reconnect message:", message);
            ws.send(JSON.stringify(message));
          };

          wsRef.current = ws;
        }
      }
    }, RECONNECT_DELAY);
  }, [props.gameId, searchParams, playerId, startWebSocket]);

  // Update the WebSocket onclose handler
  const enhanceWebSocketWithReconnect = useCallback(
    (ws: WebSocket) => {
      ws.onclose = (event) => {
        console.log("WebSocket closed:", event);

        // Don't attempt reconnect if this was a normal closure or if we're already reconnecting
        if (event.code !== 1000 && connectionStatus !== "connecting") {
          // This was an abnormal closure, attempt to reconnect
          setConnectionStatus("disconnected");
          attemptReconnect();
        } else if (event.code === 1000) {
          // Normal closure, reset game state
          setConnectionStatus("disconnected");
          setGameState(null);
          setIsJoining(false);
        }
      };
      return ws;
    },
    [attemptReconnect, connectionStatus]
  );

  // Modify the startWebSocket function usage to apply the onclose handler
  const getWebSocket = useCallback(
    (name: string) => {
      const ws = startWebSocket(name);
      if (ws) {
        return enhanceWebSocketWithReconnect(ws);
      }
      return null;
    },
    [startWebSocket, enhanceWebSocketWithReconnect]
  );

  useEffect(() => {
    // Check if both playerName and playerId are present in URL
    const nameFromUrl = searchParams.get("playerName");
    const idFromUrl = searchParams.get("playerId");

    if (nameFromUrl && idFromUrl === playerId) {
      // User is returning with playerId in URL, auto-connect
      setIsJoining(true);
      const ws = startWebSocket(decodeURIComponent(nameFromUrl));
      if (ws) {
        wsRef.current = ws;

        // Save the original onopen handler
        const originalOnOpen = ws.onopen;

        // Send join message after connection is established
        ws.onopen = (event: Event) => {
          // First call the original handler to ensure connection status is updated
          if (originalOnOpen && typeof originalOnOpen === "function") {
            try {
              (originalOnOpen as (this: WebSocket, ev: Event) => void).call(
                ws,
                event
              );
            } catch (error) {
              console.error("Error calling original onopen handler:", error);
              // Make sure we still update the connection status
              setConnectionStatus("connected");
            }
          }

          // First send test connection to verify game state
          const testMessage: WsMessage = { type: "test-connection" };
          wsRef.current?.send(JSON.stringify(testMessage));

          // Then send join message after a short delay
          setTimeout(() => {
            const message: WsMessage = {
              type: "join",
              gameId: props.gameId,
              playerName: decodeURIComponent(nameFromUrl),
              playerId: playerId,
            };
            console.log("Sending join message:", message);
            ws.send(JSON.stringify(message));
          }, 500);
        };
      } else {
        setIsJoining(false);
      }

      return () => {
        if (wsRef.current) {
          wsRef.current.close(1000); // Normal closure
        }
      };
    }
  }, [props.gameId, startWebSocket, searchParams, playerId]);

  // Clean up the reconnect timeout on component unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (wsRef.current) {
        wsRef.current.close(1000); // 1000 = normal closure
      }
    };
  }, []);

  // Add this effect to the Game component
  useEffect(() => {
    const handleWindowFocus = () => {
      // When window is focused, send a test-connection message to check timer and get fresh state
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log("Window focused, sending connection test to check timer");
        const message: WsMessage = { type: "test-connection" };
        wsRef.current.send(JSON.stringify(message));
      }
    };

    // Add focus event listener
    window.addEventListener("focus", handleWindowFocus);

    // Clean up
    return () => {
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, []);

  const handleJoinGame = (name: string) => {
    if (!name.trim() || isJoining) return;

    setIsJoining(true);

    // Start WebSocket connection with the entered name
    const ws = getWebSocket(name.trim());
    if (!ws) {
      setIsJoining(false);
      return;
    }

    wsRef.current = ws;

    // Save the original onopen handler
    const originalOnOpen = ws.onopen;

    // Send join message after connection is established
    ws.onopen = (event: Event) => {
      // First call the original handler to ensure connection status is updated
      if (originalOnOpen && typeof originalOnOpen === "function") {
        try {
          (originalOnOpen as (this: WebSocket, ev: Event) => void).call(
            ws,
            event
          );
        } catch (error) {
          console.error("Error calling original onopen handler:", error);
          // Make sure we still update the connection status
          setConnectionStatus("connected");
        }
      }

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

  // Show loader when joining
  if (isJoining && !gameState) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex-grow flex items-center justify-center">
          <LoadingSpinner />
        </div>
        <Footer />
      </div>
    );
  }

  // Show join form if not in game and not joining
  if (!isPlayerInGame && !isJoining) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex-grow p-4">
          <JoinForm
            initialPlayerName={playerName}
            isJoining={isJoining}
            onJoin={handleJoinGame}
          />
        </div>
        <Footer />
      </div>
    );
  }

  // Render game content
  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-grow p-4">
        <div className="space-y-4">
          <GameHeader
            onNewGame={handleNewGame}
            onShareGame={handleShareGame}
            onToggleNotifications={requestNotificationPermission}
            notificationsEnabled={notificationsEnabled}
          />

          {/* Connection status indicator */}
          {connectionStatus !== "connected" && gameState && (
            <div
              className={`text-center py-1 px-3 text-sm rounded-md ${
                connectionStatus === "connecting"
                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 animate-pulse"
                  : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
              }`}
            >
              {connectionStatus === "connecting"
                ? "Reconnecting to game..."
                : "Disconnected - trying to reconnect..."}
            </div>
          )}

          {gameState && renderGamePhase()}
        </div>
      </div>

      <Footer />
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
            connectedPlayers={gameState.connectedPlayers}
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
