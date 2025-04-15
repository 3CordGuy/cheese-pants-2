"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";

export default function Home() {
  const router = useRouter();
  const [requiredWords, setRequiredWords] = useState({
    word1: "cheese",
    word2: "pants",
  });

  const handleCreateGame = () => {
    const gameId = nanoid();
    router.push(
      `/game/${gameId}?requiredWords=${requiredWords.word1},${requiredWords.word2}`
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center">Cheese Pants</h1>
        <div className="space-y-4">
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
              className="w-full border rounded px-3 py-2"
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
              className="w-full border rounded px-3 py-2"
              placeholder="Enter second word"
            />
          </div>
          <button
            onClick={handleCreateGame}
            className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 transition-colors"
          >
            Create Game
          </button>
        </div>
      </div>
    </div>
  );
}
