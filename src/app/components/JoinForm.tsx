"use client";

import { useState } from "react";

interface JoinFormProps {
  initialPlayerName: string;
  isJoining: boolean;
  onJoin: (playerName: string) => void;
}

export const JoinForm = ({
  initialPlayerName,
  isJoining,
  onJoin,
}: JoinFormProps) => {
  const [playerName, setPlayerName] = useState(initialPlayerName);

  const handleJoin = () => {
    if (!playerName.trim() || isJoining) return;
    onJoin(playerName.trim());
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Join the Game</h2>
      <input
        type="text"
        value={playerName}
        onChange={(e) => {
          setPlayerName(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !isJoining) {
            handleJoin();
          }
        }}
        placeholder="Enter your name"
        className="border p-2 rounded w-full"
        disabled={isJoining}
      />
      <button
        onClick={handleJoin}
        className={`bg-blue-500 text-white px-4 py-2 rounded w-full ${
          isJoining ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-600"
        }`}
        disabled={isJoining}
      >
        Join Game
      </button>
    </div>
  );
};
