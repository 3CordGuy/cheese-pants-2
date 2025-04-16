"use client";

import { useState } from "react";
import { GameState } from "../../../worker/src/index";
import { Word } from "./Word";
import { PlayersList } from "./PlayersList";

interface GamePlayingProps {
  gameState: GameState;
  playerId: string;
  isAdmin: boolean;
  isCurrentPlayer: boolean;
  onAddWord: (word: string) => void;
  onDeleteWord: (index: number) => void;
  onChangeTurn: (playerId: string) => void;
}

export const GamePlaying = ({
  gameState,
  playerId,
  isAdmin,
  isCurrentPlayer,
  onAddWord,
  onDeleteWord,
  onChangeTurn,
}: GamePlayingProps) => {
  const [wordInput, setWordInput] = useState("");

  const handleAddWord = () => {
    if (!wordInput.trim()) return;
    onAddWord(wordInput.trim());
    setWordInput("");
  };

  return (
    <div className="md:flex md:gap-6">
      {/* Main content area */}
      <div className="md:flex-1 space-y-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl border border-blue-100 dark:border-blue-900 transition-all duration-300 hover:shadow-2xl">
          <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center">
            <svg
              className="w-6 h-6 mr-2 text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Current Sentence
          </h3>
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-800 p-5 rounded-lg min-h-[80px] flex flex-wrap gap-0 shadow-inner text-lg border border-blue-100/50 dark:border-blue-900/30 animate-gradient animate-pulse-subtle group hover:gap-1 transition-all duration-200">
            {gameState.words.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 italic w-full text-center">
                No words yet... Start adding words!
              </p>
            ) : (
              gameState.words.map((word, index) => (
                <Word
                  key={index}
                  word={word}
                  index={index}
                  isAdmin={isAdmin}
                  isLast={index === gameState.words.length - 1}
                  onDelete={onDeleteWord}
                />
              ))
            )}
          </div>
        </div>

        {isCurrentPlayer && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl border border-blue-100 dark:border-blue-900 transition-all duration-300">
            <h3 className="text-xl font-bold mb-3 bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">
              Your Turn,{" "}
              {gameState.players.find((p) => p.id === playerId)?.name}!
            </h3>
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-3">
                <input
                  type="text"
                  value={wordInput}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  onChange={(e) => {
                    setWordInput(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAddWord();
                    }
                  }}
                  placeholder="Enter your word"
                  className="flex-grow border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-black dark:text-white bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                  autoFocus
                />
                <button
                  onClick={handleAddWord}
                  className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-bold py-3 px-6 rounded-lg md:w-auto transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg"
                >
                  Add Word
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                {gameState.hasRequiredWords.every(Boolean)
                  ? "🎉 All required words have been used! Add punctuation (., !, ?) to complete the game."
                  : "Add a word to continue building the sentence."}
              </p>
            </div>
          </div>
        )}

        {isAdmin && !isCurrentPlayer && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl border border-blue-100 dark:border-blue-900 transition-all duration-300">
            <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-lg text-sm text-indigo-800 dark:text-indigo-300">
              <h4 className="font-bold mb-2">Host Controls:</h4>
              <p>
                As the host, you can delete any word by clicking it and
                selecting &quot;Delete Word&quot;. You can also change whose
                turn it is by clicking on their name in the player list.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="md:w-80 lg:w-96 space-y-6 mt-6 md:mt-0">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl border border-blue-100 dark:border-blue-900 transition-all duration-300">
          <h3 className="text-xl font-bold mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Game Rules:
          </h3>
          <div className="mb-4">
            <p className="mb-2 text-sm text-gray-700 dark:text-gray-300">
              To complete the game:
            </p>
            <ol className="list-decimal pl-6 mb-2 text-gray-700 dark:text-gray-300">
              <li className="mb-1">Use all required words listed below</li>
              <li>End the sentence with punctuation (., !, ?)</li>
            </ol>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
            <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2">
              Required Words:
            </h4>
            <div className="flex flex-wrap gap-2">
              {gameState.requiredWords.map((word, index) => (
                <span
                  key={word}
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    gameState.hasRequiredWords[index]
                      ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400 line-through"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400"
                  }`}
                >
                  {word}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl border border-blue-100 dark:border-blue-900 transition-all duration-300">
          <PlayersList
            players={gameState.players}
            currentPlayerId={playerId}
            adminId={gameState.startedById}
            isAdmin={isAdmin}
            connectedPlayers={gameState.connectedPlayers}
            onChangeTurn={onChangeTurn}
          />
        </div>
      </div>
    </div>
  );
};
