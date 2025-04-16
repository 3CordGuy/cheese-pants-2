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
    <>
      <div className="border p-4 rounded">
        <h3 className="font-bold mb-2">Current Sentence:</h3>
        <div className="flex flex-wrap gap-1">
          {gameState.words.length === 0 ? (
            <p>No words yet...</p>
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
      <div className="border p-4 rounded">
        <h3 className="font-bold mb-2">Game Rules:</h3>
        <p className="mb-2 text-sm">To complete the game:</p>
        <ol className="list-decimal pl-6 mb-2">
          <li>Use all required words listed below</li>
          <li>End the sentence with punctuation (., !, ?)</li>
        </ol>
        <div className="mt-3">
          <h4 className="font-bold text-sm">Required Words:</h4>
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
      </div>

      <PlayersList
        players={gameState.players}
        currentPlayerId={playerId}
        adminId={gameState.startedById}
        isAdmin={isAdmin}
        onChangeTurn={onChangeTurn}
      />

      {isCurrentPlayer && (
        <div className="space-y-2">
          <input
            type="text"
            value={wordInput}
            onChange={(e) => setWordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleAddWord();
              }
            }}
            placeholder="Enter your word"
            className="border p-2 rounded w-full"
          />
          <p className="text-xs text-gray-500">
            {gameState.hasRequiredWords.every(Boolean)
              ? "All required words have been used! Add punctuation (., !, ?) to complete the game."
              : "Add a word to continue the sentence."}
          </p>
          <button
            onClick={handleAddWord}
            className="bg-green-500 text-white px-4 py-2 rounded w-full"
          >
            Add Word
          </button>
        </div>
      )}

      {isAdmin && !isCurrentPlayer && (
        <div className="mt-4 text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-2 rounded">
          <p>
            As the host, you can delete any word by clicking it and selecting
            &quot;Delete Word&quot;.
          </p>
        </div>
      )}
    </>
  );
};
