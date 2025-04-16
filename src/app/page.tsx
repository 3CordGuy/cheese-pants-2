"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";

export default function Home() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState("");
  const [requiredWords, setRequiredWords] = useState({
    word1: "cheese",
    word2: "pants",
  });
  const [error, setError] = useState("");

  const handleCreateGame = () => {
    // Reset error
    setError("");

    // Validate player name
    if (!playerName.trim()) {
      setError("Please enter your name");
      return;
    }

    // Validate required words
    if (!requiredWords.word1.trim()) {
      setError("First required word cannot be empty");
      return;
    }

    if (!requiredWords.word2.trim()) {
      setError("Second required word cannot be empty");
      return;
    }

    // Create game IDs
    const gameId = nanoid();
    const playerId = nanoid();

    // Clean the words to ensure no empty strings
    const word1 = requiredWords.word1.trim();
    const word2 = requiredWords.word2.trim();

    router.push(
      `/game/${gameId}?requiredWords=${encodeURIComponent(
        word1
      )},${encodeURIComponent(word2)}&playerName=${encodeURIComponent(
        playerName.trim()
      )}&playerId=${playerId}`
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center text-blue-800 dark:text-blue-800">
          Cheese Pants
        </h1>
        {error && (
          <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Name
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full border rounded px-3 py-2 text-black"
              placeholder="Enter your name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Required Word
            </label>
            <input
              type="text"
              value={requiredWords.word1}
              onChange={(e) =>
                setRequiredWords({ ...requiredWords, word1: e.target.value })
              }
              className="w-full border rounded px-3 py-2 text-black"
              placeholder="Enter first word"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Second Required Word
            </label>
            <input
              type="text"
              value={requiredWords.word2}
              onChange={(e) =>
                setRequiredWords({ ...requiredWords, word2: e.target.value })
              }
              className="w-full border rounded px-3 py-2 text-black"
              placeholder="Enter second word"
            />
          </div>
          <button
            onClick={handleCreateGame}
            className="w-full bg-blue-500 text-white dark:bg-blue-900 dark:text-blue-200 py-2 rounded hover:bg-blue-600 transition-colors"
          >
            Create Game
          </button>
        </div>
      </div>
    </div>
  );
}
