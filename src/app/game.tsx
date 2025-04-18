"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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

// Add a localStorage cleanup helper function at the top of the file
function cleanupExpiredGameData() {
  if (typeof window === "undefined") return;

  // Only run cleanup occasionally (1 in 10 chance)
  if (Math.random() > 0.1) return;

  try {
    // Get all localStorage keys
    const keys = Object.keys(localStorage);
    const now = new Date();

    // Find all cheesePantsGame_ keys
    const gameKeys = keys.filter((key) => key.startsWith("cheesePantsGame_"));

    gameKeys.forEach((key) => {
      try {
        const data = JSON.parse(localStorage.getItem(key) || "{}");

        // Check if this entry is older than 30 days
        if (data.lastActive || data.joinedAt) {
          const lastActiveDate = new Date(data.lastActive || data.joinedAt);
          const ageInDays =
            (now.getTime() - lastActiveDate.getTime()) / (1000 * 60 * 60 * 24);

          // Remove entries older than 30 days
          if (ageInDays > 30) {
            localStorage.removeItem(key);
          }
        }
      } catch {
        // If we can't parse the data, it might be corrupted, remove it
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error("Error cleaning up expired game data", error);
  }
}

export function Game(props: { gameId: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const wsRef = useRef<WebSocket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const joinTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const msgTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "connecting"
  >("disconnected");

  // Add loading state to prevent UI flickering
  const [uiState, setUiState] = useState<
    "initializing" | "joining" | "ready" | "error"
  >("initializing");

  // Prevent multiple join attempts
  const joinAttemptedRef = useRef(false);

  const [playerId] = useState(() => {
    // Try to get playerId from URL params, localStorage, or generate a new one
    const idFromUrl = searchParams.get("playerId");
    if (idFromUrl) return idFromUrl;

    // Check if we have a stored playerId for this game
    if (typeof window !== "undefined") {
      const storedData = localStorage.getItem(
        `cheesePantsGame_${props.gameId}`
      );
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        return parsedData.playerId;
      }
    }

    return nanoid();
  });

  const [playerName] = useState(() => {
    const nameFromUrl = searchParams.get("playerName");
    if (nameFromUrl) return decodeURIComponent(nameFromUrl);

    // Check if we have a stored playerName for this game
    if (typeof window !== "undefined") {
      const storedData = localStorage.getItem(
        `cheesePantsGame_${props.gameId}`
      );
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        return parsedData.playerName;
      }
    }

    return "";
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

  // Update the sendTurnNotification function
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
      // Construct the full game URL with all necessary parameters
      const gameUrl = `${window.location.origin}/game/${
        props.gameId
      }?playerName=${encodeURIComponent(
        playerName || ""
      )}&playerId=${playerId}&requiredWords=${encodeURIComponent(
        searchParams.get("requiredWords") || ""
      )}&turnTimeLimit=${searchParams.get("turnTimeLimit") || "0"}`;

      const notification = new Notification("Cheese Pants", {
        body: "It's your turn!",
        icon: "/favicon.ico",
        tag: `cheese-pants-turn-${props.gameId}`, // Using tag to replace previous notifications
        data: { url: gameUrl }, // Store URL in notification data
      });

      notification.onclick = () => {
        // Use the URL from notification data for navigation
        if (notification.data?.url) {
          window.open(notification.data.url, "_blank");
          window.focus();
        } else {
          window.focus(); // Fallback to just focusing the window
        }
        notification.close();
      };

      // Automatically close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  }, [notificationsEnabled, props.gameId, playerId, playerName, searchParams]);

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
      reconnectTimeoutRef.current = null;
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

      // Clear the reference since the timeout has executed
      reconnectTimeoutRef.current = null;
    }, RECONNECT_DELAY);

    // Return a cleanup function in case this callback is used in an effect
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
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

          // Clear any existing reconnect timeout
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }

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
      setUiState("joining");

      const connectTimeout = setTimeout(() => {
        const ws = startWebSocket(decodeURIComponent(nameFromUrl));
        if (ws) {
          wsRef.current = ws;

          // Also store in localStorage for future visits
          if (typeof window !== "undefined") {
            localStorage.setItem(
              `cheesePantsGame_${props.gameId}`,
              JSON.stringify({
                playerId,
                playerName: decodeURIComponent(nameFromUrl),
                gameId: props.gameId,
                joinedAt: new Date().toISOString(),
              })
            );
          }

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
            const joinMsgTimeout = setTimeout(() => {
              const message: WsMessage = {
                type: "join",
                gameId: props.gameId,
                playerName: decodeURIComponent(nameFromUrl),
                playerId: playerId,
              };
              console.log("Sending join message:", message);
              ws.send(JSON.stringify(message));
            }, 100);

            // Store the timeout in a ref so we can clear it if needed
            const prevTimeout = reconnectTimeoutRef.current;
            if (prevTimeout) clearTimeout(prevTimeout);
            reconnectTimeoutRef.current = joinMsgTimeout;
          };
        } else {
          setIsJoining(false);
          setUiState("error");
        }
      }, 50);

      return () => {
        // Clear the connect timeout if unmounting
        clearTimeout(connectTimeout);

        // Clear any pending reconnection timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }

        // Close WebSocket if it exists
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
    // Create a reference to hold any focus-related timeouts
    const focusTimeoutRef = { current: null as NodeJS.Timeout | null };

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
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }
    };
  }, []);

  // Add useEffect for initial UI state determination after data loads
  useEffect(() => {
    // If we already have game state or are joining, then UI is ready
    if (gameState || isJoining) {
      setUiState("ready");
      return;
    }

    // Short timeout to allow everything to initialize before showing the join screen
    // This prevents flickering if we're going to auto-join
    const timer = setTimeout(() => {
      setUiState("ready");
    }, 100);

    return () => clearTimeout(timer);
  }, [gameState, isJoining]);

  // Define handleJoinGame with useCallback to prevent dependency issues
  const handleJoinGame = useCallback(
    (name: string) => {
      if (!name.trim() || isJoining) return;

      // Set joining state immediately to prevent UI flickering
      setIsJoining(true);
      setUiState("joining");

      // Store player data in localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem(
          `cheesePantsGame_${props.gameId}`,
          JSON.stringify({
            playerId,
            playerName: name.trim(),
            gameId: props.gameId,
            joinedAt: new Date().toISOString(),
          })
        );
      }

      // Clear any existing timeout
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
      }

      // Slightly delay WebSocket connection to allow UI to update first
      joinTimeoutRef.current = setTimeout(() => {
        // Start WebSocket connection with the entered name
        const ws = getWebSocket(name.trim());
        if (!ws) {
          setIsJoining(false);
          setUiState("error");
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

          // Clear any existing message timeout
          if (msgTimeoutRef.current) {
            clearTimeout(msgTimeoutRef.current);
          }

          // Then send join message after a short delay
          msgTimeoutRef.current = setTimeout(() => {
            const message: WsMessage = {
              type: "join",
              gameId: props.gameId,
              playerName: name.trim(),
              playerId: playerId,
            };
            console.log("Sending join message:", message);
            ws.send(JSON.stringify(message));

            // Update URL with player info for refreshes
            // Do this silently without causing a navigation/reload
            const url = new URL(window.location.href);
            url.searchParams.set("playerName", name.trim());
            url.searchParams.set("playerId", playerId);
            window.history.replaceState({}, "", url.toString());
          }, 100);
        };
      }, 50);
    },
    [
      props.gameId,
      playerId,
      isJoining,
      getWebSocket,
      setConnectionStatus,
      setIsJoining,
      wsRef,
    ]
  );

  // Add cleanup for any timeouts when component unmounts
  useEffect(() => {
    return () => {
      // Clean up all timeouts on unmount
      if (reconnectTimeoutRef.current)
        clearTimeout(reconnectTimeoutRef.current);
      if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current);
      if (msgTimeoutRef.current) clearTimeout(msgTimeoutRef.current);
    };
  }, []);

  // Replace the auto-join useEffect with an improved version
  useEffect(() => {
    // Only run once and only if not already joining
    if (joinAttemptedRef.current || isJoining || searchParams.get("playerId"))
      return;

    // Mark as attempted so we don't try again
    joinAttemptedRef.current = true;

    // Keep UI in initializing state until we decide whether to auto-join
    setUiState("initializing");

    // Check if we have stored data for this game
    if (typeof window !== "undefined") {
      const storedData = localStorage.getItem(
        `cheesePantsGame_${props.gameId}`
      );
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData);
          // Only auto-join if we have both playerId and playerName matching current state
          if (parsedData.playerId === playerId && parsedData.playerName) {
            console.log("Auto-joining from localStorage data");

            // Small delay to ensure all states are properly initialized
            const autoJoinTimeout = setTimeout(() => {
              handleJoinGame(parsedData.playerName);
            }, 50);

            // Clean up timeout if effect unmounts
            return () => {
              clearTimeout(autoJoinTimeout);
            };
          }
        } catch (error) {
          console.error("Error parsing stored game data:", error);
        }
      }
    }

    // If we're not auto-joining, mark UI as ready to show join form
    setUiState("ready");
  }, [props.gameId, isJoining, playerId, searchParams, handleJoinGame]);

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

  // Function to clear localStorage for a specific game
  const clearGameFromStorage = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(`cheesePantsGame_${props.gameId}`);
    }
  }, [props.gameId]);

  // Add handling for game completion to clear storage
  useEffect(() => {
    // If game is complete, we can optionally clear the localStorage
    if (gameState?.phase === "complete") {
      // For completed games, we could either clear immediately or after a delay
      // Keeping it for now, but marking it as completed
      if (typeof window !== "undefined") {
        const existingData = localStorage.getItem(
          `cheesePantsGame_${props.gameId}`
        );
        if (existingData) {
          const parsedData = JSON.parse(existingData);
          localStorage.setItem(
            `cheesePantsGame_${props.gameId}`,
            JSON.stringify({
              ...parsedData,
              gamePhase: "complete",
              completedAt: new Date().toISOString(),
            })
          );
        }
      }
    }
  }, [gameState?.phase, props.gameId]);

  // Handle game quit - should clean up localStorage
  useEffect(() => {
    if (wsRef.current) {
      // Add event handler for close to clean up localStorage
      const originalOnClose = wsRef.current.onclose;
      wsRef.current.onclose = (event) => {
        // Call original handler first
        if (originalOnClose && typeof originalOnClose === "function") {
          try {
            (originalOnClose as (this: WebSocket, ev: CloseEvent) => void).call(
              wsRef.current as WebSocket,
              event
            );
          } catch (error) {
            console.error("Error calling original onclose handler:", error);
          }
        }

        // If this was a clean disconnect (code 1000) on a completed game, clear storage
        if (event.code === 1000 && gameState?.phase === "complete") {
          clearGameFromStorage();
        }
      };
    }

    // No cleanup function needed as we're just adding an event handler
    // to an existing WebSocket which will be cleaned up elsewhere
  }, [wsRef, gameState, clearGameFromStorage]);

  const handleNewGame = () => {
    // Clear current game data when starting a new game
    clearGameFromStorage();
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

  const handleUpdateTurnTimeLimit = (newTimeLimit: number) => {
    if (!wsRef.current) return;

    const message: WsMessage = {
      type: "update-turn-time-limit",
      newTimeLimit,
      playerId: playerId,
    };

    wsRef.current.send(JSON.stringify(message));

    // Update URL to reflect new time limit
    updateUrlWithTimeLimit(newTimeLimit);
  };

  // Add this helper function to update the URL
  const updateUrlWithTimeLimit = useCallback(
    (timeLimit: number) => {
      const currentUrl = new URL(window.location.href);

      // Update turnTimeLimit parameter
      currentUrl.searchParams.set("turnTimeLimit", timeLimit.toString());

      // Replace URL without full page reload
      router.replace(currentUrl.pathname + currentUrl.search, {
        scroll: false,
      });
    },
    [router]
  );

  // Also listen for game state changes to update URL when server changes timer
  useEffect(() => {
    if (gameState && gameState.turnTimeLimit !== undefined) {
      // Get current turnTimeLimit from URL
      const currentUrlTimeLimit = parseInt(
        searchParams.get("turnTimeLimit") || "0",
        10
      );

      // If they don't match, update URL
      if (currentUrlTimeLimit !== gameState.turnTimeLimit) {
        updateUrlWithTimeLimit(gameState.turnTimeLimit);
      }
    }
  }, [
    gameState?.turnTimeLimit,
    searchParams,
    gameState,
    updateUrlWithTimeLimit,
  ]);

  // Add these to your Game component
  useEffect(() => {
    // Keep track of any additional timeouts created in this effect
    const timeoutsToCleanup: NodeJS.Timeout[] = [];

    // Send ping messages every 30 seconds to keep connection alive
    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log("Sending ping to keep connection alive");
        const pingMessage: WsMessage = { type: "test-connection" };
        wsRef.current.send(JSON.stringify(pingMessage));
      } else if (connectionStatus !== "connected" && playerId && playerName) {
        // If connection is lost, try to reconnect
        console.log("Connection lost, attempting to reconnect");
        // Call startWebSocket but don't try to use its return value since it doesn't return anything
        startWebSocket(playerName);
      }
    }, 30000); // 30 seconds

    return () => {
      // Clean up the ping interval
      clearInterval(pingInterval);

      // Clean up any additional timeouts
      timeoutsToCleanup.forEach((timeout) => clearTimeout(timeout));

      // Also clear the reconnect timeout as a precaution
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [connectionStatus, playerId, playerName, startWebSocket]);

  // Add a useEffect to update localStorage when game state changes
  useEffect(() => {
    // Don't update until we have valid game state
    if (!gameState || !playerId || !playerName) return;

    // Only update if the player is in the game
    const isPlayerInGame = gameState.players.some((p) => p.id === playerId);
    if (!isPlayerInGame) return;

    // Update localStorage with latest game data
    if (typeof window !== "undefined") {
      const existingData = localStorage.getItem(
        `cheesePantsGame_${props.gameId}`
      );
      const parsedData = existingData ? JSON.parse(existingData) : {};

      localStorage.setItem(
        `cheesePantsGame_${props.gameId}`,
        JSON.stringify({
          ...parsedData,
          playerId,
          playerName,
          gameId: props.gameId,
          lastActive: new Date().toISOString(),
          // You could also store additional info like current game phase
          gamePhase: gameState.phase,
        })
      );
    }
  }, [gameState, playerId, playerName, props.gameId]);

  // Run cleanup on component mount
  useEffect(() => {
    cleanupExpiredGameData();
  }, []);

  // Show loader when initializing or joining
  if ((uiState === "initializing" || uiState === "joining") && !gameState) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex-grow flex items-center justify-center">
          <LoadingSpinner />
        </div>
        <Footer />
      </div>
    );
  }

  // Show join form if not in game and UI is ready
  if (!isPlayerInGame && uiState === "ready") {
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
            onUpdateTurnTimeLimit={handleUpdateTurnTimeLimit}
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
