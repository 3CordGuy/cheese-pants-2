"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import Image from "next/image";
import { generate } from "random-words";
import Dice from "./components/icons/Dice";

export const dynamic = "force-dynamic";

export default function Home() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState("");
  const [requiredWords, setRequiredWords] = useState({
    word1: "cheese",
    word2: "pants",
  });
  const [turnTimeLimit, setTurnTimeLimit] = useState(0); // 0 means no limit
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

    // Make sure turnTimeLimit is explicitly included in the URL
    router.push(
      `/game/${gameId}?requiredWords=${encodeURIComponent(
        word1
      )},${encodeURIComponent(word2)}&playerName=${encodeURIComponent(
        playerName.trim()
      )}&playerId=${playerId}&turnTimeLimit=${turnTimeLimit}`
    );
  };

  const generateRandomWord = () => {
    // Generate a random word with minLength 4 and maxLength 8 for better playability
    const wordArray = generate({ exactly: 1, minLength: 4, maxLength: 8 });
    // Return the first (and only) element from the array
    return wordArray[0];
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-blue-950 p-4">
      <div className="mb-6 flex justify-center animate-slow-scale">
        <Image
          src="/cheese-pants-carving-transparent.png"
          alt="Cheese Pants Logo"
          width={250}
          height={250}
          priority
          className="drop-shadow-lg"
        />
      </div>
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md border border-blue-100 dark:border-blue-900 transition-all duration-300 hover:shadow-2xl">
        <h1 className="text-3xl font-bold mb-2 text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Cheese Pants
        </h1>
        <p className="text-gray-600 dark:text-gray-300 text-center mb-6 text-sm">
          The collaborative sentence-building game where creativity meets
          absurdity!
        </p>

        <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg mb-6 text-sm">
          <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-2">
            How to Play:
          </h3>
          <ul className="list-disc pl-5 space-y-1 text-gray-700 dark:text-gray-300">
            <li>Players take turns adding one word at a time</li>
            <li>Create a sentence that includes your required words</li>
            <li>End with punctuation to complete your masterpiece</li>
            <li>Share with friends for more chaotic fun!</li>
          </ul>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-lg border-l-4 border-red-500 animate-pulse">
            {error}
          </div>
        )}
        <div className="space-y-5">
          <div className="group">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              Your Name
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => {
                setPlayerName(e.target.value);
              }}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-black dark:text-white bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="Enter your name"
            />
          </div>
          <div className="group">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              First Required Word
            </label>
            <div className="relative">
              <input
                type="text"
                value={requiredWords.word1}
                onChange={(e) => {
                  setRequiredWords({ ...requiredWords, word1: e.target.value });
                }}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-black dark:text-white bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all pr-10"
                placeholder="Enter first word"
              />
              <button
                type="button"
                onClick={() => {
                  setRequiredWords({
                    ...requiredWords,
                    word1: generateRandomWord() as string,
                  });
                }}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors group/button"
                title="Choose for me"
              >
                <Dice size={24} className="text-blue-700" />
                <span className="absolute left-1/2 transform -translate-x-1/2 -top-8 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover/button:opacity-100 transition-opacity whitespace-nowrap">
                  Choose for me
                </span>
              </button>
            </div>
          </div>
          <div className="group">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              Second Required Word
            </label>
            <div className="relative">
              <input
                type="text"
                value={requiredWords.word2}
                onChange={(e) => {
                  setRequiredWords({ ...requiredWords, word2: e.target.value });
                }}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-black dark:text-white bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all pr-10"
                placeholder="Enter second word"
              />
              <button
                type="button"
                onClick={() => {
                  setRequiredWords({
                    ...requiredWords,
                    word2: generateRandomWord() as string,
                  });
                }}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors group/button"
                title="Choose for me"
              >
                <Dice size={24} className="text-blue-700" />
                <span className="absolute left-1/2 transform -translate-x-1/2 -top-8 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover/button:opacity-100 transition-opacity whitespace-nowrap">
                  Choose for me
                </span>
              </button>
            </div>
          </div>
          <div className="group">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              Turn Time Limit
            </label>
            <select
              value={turnTimeLimit}
              onChange={(e) => setTurnTimeLimit(parseInt(e.target.value, 10))}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-black dark:text-white bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            >
              <option value="0">No limit</option>
              <option value="30">30 seconds</option>
              <option value="60">1 minute</option>
              <option value="120">2 minutes</option>
              <option value="300">5 minutes</option>
              <option value="600">10 minutes</option>
              <option value="900">15 minutes</option>
              <option value="1800">30 minutes</option>
              <option value="3600">1 hour</option>
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              How long each player has to submit a word before their turn is
              skipped.
            </p>
          </div>
          <div className="mt-6">
            <button
              type="button"
              onClick={handleCreateGame}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-4 rounded-lg w-full transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg"
            >
              Create Game
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
