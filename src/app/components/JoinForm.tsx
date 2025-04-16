"use client";

import { useState } from "react";
import Image from "next/image";

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
    <div className="flex flex-col items-center p-4">
      <div className="mb-6 flex justify-center animate-bounce">
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
        <h2 className="text-3xl font-bold mb-2 text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Join the Game
        </h2>
        <p className="text-gray-600 dark:text-gray-300 text-center mb-6 text-sm">
          Your friends are waiting! Enter your name to join the fun.
        </p>

        <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg mb-6 text-sm">
          <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-2">
            Get Ready To:
          </h3>
          <ul className="list-disc pl-5 space-y-1 text-gray-700 dark:text-gray-300">
            <li>Collaborate with friends on a single sentence</li>
            <li>Add creative words when it&apos;s your turn</li>
            <li>Use the required words in your masterpiece</li>
            <li>Have fun creating something ridiculous!</li>
          </ul>
        </div>

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
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isJoining) {
                  handleJoin();
                }
              }}
              placeholder="Enter your name"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-black dark:text-white bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              disabled={isJoining}
            />
          </div>

          <button
            onClick={handleJoin}
            className={`bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-4 rounded-lg w-full transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg mt-6 ${
              isJoining ? "opacity-50 cursor-not-allowed" : ""
            }`}
            disabled={isJoining}
          >
            {isJoining ? "Joining..." : "Join Game"}
          </button>
        </div>
      </div>
    </div>
  );
};
