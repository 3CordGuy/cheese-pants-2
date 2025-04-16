"use client";

import { GameState, Player, WordInfo } from "../../../worker/src/index";
import Trophy from "./icons/Trophy";
import { getPlayerAvatarClass } from "../utils/colorUtils";
import { useState } from "react";

interface GameCompleteProps {
  gameState: GameState;
  playerId: string;
  onStartNewGame: () => void;
}

interface PlayerStats extends Player {
  wordsAdded: number;
  avgWordLength: number;
  requiredWordsUsed: number;
}

interface Achievement {
  title: string;
  player: string;
}

// Calculate time difference between two ISO strings
const calculateTimeDiff = (startTime: string, endTime: string): string => {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const diffMs = end - start;

  // Convert to minutes and seconds
  const minutes = Math.floor(diffMs / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);

  return `${minutes}m ${seconds}s`;
};

// Calculate statistics for each player
const calculatePlayerStats = (gameState: GameState): PlayerStats[] => {
  // Create a map to store stats for each player
  const playerStatsMap = new Map<string, PlayerStats>();

  // Initialize stats for each player
  gameState.players.forEach((player) => {
    playerStatsMap.set(player.id, {
      ...player,
      wordsAdded: 0,
      avgWordLength: 0,
      requiredWordsUsed: 0,
    });
  });

  // Calculate total words and lengths for each player
  const playerWordLengths: { [playerId: string]: number[] } = {};

  gameState.words.forEach((word) => {
    const playerId = word.authorId;
    const playerStats = playerStatsMap.get(playerId);

    if (playerStats) {
      // Increment words count
      playerStats.wordsAdded += 1;

      // Track word length for average calculation (without punctuation)
      if (!playerWordLengths[playerId]) {
        playerWordLengths[playerId] = [];
      }
      const cleanWordLength = removePunctuation(word.text).length;
      playerWordLengths[playerId].push(cleanWordLength);

      // Count required words
      if (word.isRequired) {
        playerStats.requiredWordsUsed += 1;
      }

      playerStatsMap.set(playerId, playerStats);
    }
  });

  // Calculate average word length for each player
  playerStatsMap.forEach((stats, playerId) => {
    const lengths = playerWordLengths[playerId] || [];
    if (lengths.length > 0) {
      const sum = lengths.reduce((total, length) => total + length, 0);
      stats.avgWordLength = sum / lengths.length;
    }
  });

  // Sort players by a combined score of words added and average word length
  return Array.from(playerStatsMap.values()).sort((a, b) => {
    const scoreA = calculateScore(a.wordsAdded, a.avgWordLength);
    const scoreB = calculateScore(b.wordsAdded, b.avgWordLength);

    return scoreB - scoreA;
  });
};

// Find the longest word in the sentence
const findLongestWord = (words: WordInfo[]): string => {
  if (words.length === 0) return "N/A";

  let longest = words[0].text;
  let longestLength = removePunctuation(longest).length;

  words.forEach((word) => {
    const cleanWord = removePunctuation(word.text);
    if (cleanWord.length > longestLength) {
      longest = word.text;
      longestLength = cleanWord.length;
    }
  });

  return longest;
};

// Remove punctuation from a word
const removePunctuation = (word: string): string => {
  return word.replace(/[.,!?;:'"()[\]{}]/g, "");
};

// Calculate the total length of the sentence
const calculateSentenceLength = (words: WordInfo[]): number => {
  if (words.length === 0) return 0;

  // Count characters in all words + spaces between words
  const totalCharCount = words.reduce((total, word) => {
    // Use original word length for total sentence count
    return total + word.text.length;
  }, 0);

  return totalCharCount + (words.length - 1); // Add spaces between words
};

// Generate achievements based on game stats
const getAchievements = (gameState: GameState): Achievement[] => {
  const achievements: Achievement[] = [];
  const playerStats = calculatePlayerStats(gameState);

  // Don't generate achievements if no players or words
  if (playerStats.length === 0 || gameState.words.length === 0) {
    return achievements;
  }

  // Most words contributed (with tie handling)
  if (playerStats[0].wordsAdded > 0) {
    const maxWordsAdded = playerStats[0].wordsAdded;
    const tiedPlayers = playerStats.filter(
      (p) => p.wordsAdded === maxWordsAdded
    );

    if (tiedPlayers.length === 1) {
      // No tie, just one winner
      achievements.push({
        title: "Word Master",
        player: `${tiedPlayers[0].name} (${maxWordsAdded} words)`,
      });
    } else {
      // Handle tie - find a tiebreaker
      // Sort by average word length as a tiebreaker
      tiedPlayers.sort((a, b) => b.avgWordLength - a.avgWordLength);

      achievements.push({
        title: "Word Master",
        player: `${
          tiedPlayers[0].name
        } (${maxWordsAdded} words, avg length: ${tiedPlayers[0].avgWordLength.toFixed(
          1
        )})`,
      });

      // Add runner-up mentions for the tied players
      if (tiedPlayers.length > 1) {
        achievements.push({
          title: "Word Master (Tied)",
          player: `${tiedPlayers
            .slice(1)
            .map((p) => p.name)
            .join(", ")} (${maxWordsAdded} words each)`,
        });
      }
    }
  }

  // Longest average word length (with tie handling)
  if (playerStats.length > 0) {
    const sortedByWordLength = [...playerStats].sort(
      (a, b) => b.avgWordLength - a.avgWordLength
    );

    if (sortedByWordLength[0].avgWordLength > 0) {
      const maxAvgLength = sortedByWordLength[0].avgWordLength;
      const tiedPlayers = sortedByWordLength.filter(
        (p) => Math.abs(p.avgWordLength - maxAvgLength) < 0.01 // Floating point comparison with small epsilon
      );

      if (tiedPlayers.length === 1) {
        // No tie
        achievements.push({
          title: "Vocabulary Champion",
          player: `${tiedPlayers[0].name} (avg: ${maxAvgLength.toFixed(1)})`,
        });
      } else {
        // Handle tie - use word count as tiebreaker
        tiedPlayers.sort((a, b) => b.wordsAdded - a.wordsAdded);

        achievements.push({
          title: "Vocabulary Champion",
          player: `${tiedPlayers[0].name} (avg: ${maxAvgLength.toFixed(1)}, ${
            tiedPlayers[0].wordsAdded
          } words)`,
        });

        if (tiedPlayers.length > 1) {
          achievements.push({
            title: "Vocabulary Champion (Tied)",
            player: `${tiedPlayers
              .slice(1)
              .map((p) => p.name)
              .join(", ")} (avg: ${maxAvgLength.toFixed(1)})`,
          });
        }
      }
    }
  }

  // Most required words used (with tie handling)
  if (playerStats.length > 0) {
    const sortedByRequiredWords = [...playerStats].sort(
      (a, b) => b.requiredWordsUsed - a.requiredWordsUsed
    );

    if (sortedByRequiredWords[0].requiredWordsUsed > 0) {
      const maxRequiredWords = sortedByRequiredWords[0].requiredWordsUsed;
      const tiedPlayers = sortedByRequiredWords.filter(
        (p) => p.requiredWordsUsed === maxRequiredWords
      );

      if (tiedPlayers.length === 1) {
        // No tie
        achievements.push({
          title: "Objective Completer",
          player: `${tiedPlayers[0].name} (${maxRequiredWords} req. words)`,
        });
      } else {
        // Handle tie - use total word count as tiebreaker
        tiedPlayers.sort((a, b) => b.wordsAdded - a.wordsAdded);

        achievements.push({
          title: "Objective Completer",
          player: `${tiedPlayers[0].name} (${maxRequiredWords} req. words, ${tiedPlayers[0].wordsAdded} total words)`,
        });

        if (tiedPlayers.length > 1) {
          achievements.push({
            title: "Objective Completer (Tied)",
            player: `${tiedPlayers
              .slice(1)
              .map((p) => p.name)
              .join(", ")} (${maxRequiredWords} req. words each)`,
          });
        }
      }
    }
  }

  // Find who added the longest word
  const longestWordInfo = gameState.words.reduce((longest, current) => {
    const longestCleanLength = removePunctuation(longest.text).length;
    const currentCleanLength = removePunctuation(current.text).length;
    return currentCleanLength > longestCleanLength ? current : longest;
  }, gameState.words[0]);

  achievements.push({
    title: "Longest Word Award",
    player: `${longestWordInfo.authorName} ("${longestWordInfo.text}")`,
  });

  // Find who finished the sentence (added last word)
  if (gameState.words.length > 0) {
    const lastWord = gameState.words[gameState.words.length - 1];
    achievements.push({
      title: "Sentence Finisher",
      player: lastWord.authorName,
    });
  }

  return achievements;
};

// Calculate player ranking score based on word count and average length
const calculateScore = (wordCount: number, avgWordLength: number): number => {
  const wordCountWeight = 1;
  const avgLengthWeight = 0.7; // Relative to word count

  return wordCount * wordCountWeight + avgWordLength * avgLengthWeight;
};

export const GameComplete = ({
  gameState,
  playerId,
  onStartNewGame,
}: GameCompleteProps) => {
  const [copiedMasterpiece, setCopiedMasterpiece] = useState(false);

  const copyMasterpiece = () => {
    const sentence = gameState.words.map((word) => word.text).join(" ");
    navigator.clipboard.writeText(sentence);
    setCopiedMasterpiece(true);
    setTimeout(() => setCopiedMasterpiece(false), 2000);
  };

  return (
    <div className="md:flex md:gap-6">
      {/* Main content area */}
      <div className="md:flex-1 space-y-6">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl border border-green-200 dark:border-green-800 transition-all duration-300">
          <h3 className="font-bold mb-2 text-3xl bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent animate-pulse text-center">
            🎉 Game Complete! 🏆
          </h3>
          <p className="font-light text-md -mt-1 text-gray-600 dark:text-gray-400 text-center italic">
            Your Masterpiece Awaits...
          </p>
          <div className="mt-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 p-6 rounded-lg shadow-inner">
            <p className="italic mt-2 text-3xl text-black dark:text-white text-center">
              {gameState.words.map((word, i) => (
                <span
                  key={i}
                  className={
                    word.isRequired
                      ? "font-semibold text-blue-600 dark:text-blue-400"
                      : ""
                  }
                >
                  {word.text}
                  {i < gameState.words.length - 1 ? " " : ""}
                </span>
              ))}
            </p>
          </div>
          <div className="mt-4 flex justify-center">
            <button
              onClick={copyMasterpiece}
              className="flex items-center gap-2 bg-indigo-100 dark:bg-indigo-900 hover:bg-indigo-200 dark:hover:bg-indigo-800 text-indigo-700 dark:text-indigo-300 py-2 px-4 rounded-lg transition-colors font-medium"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              {copiedMasterpiece ? "Copied!" : "Copy this masterpiece"}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl border border-blue-100 dark:border-blue-900 transition-all duration-300">
          <h3 className="font-bold mb-3 text-xl text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Game Statistics
          </h3>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg shadow-sm">
              <h4 className="font-bold text-gray-700 dark:text-gray-300">
                Completion Time
              </h4>
              <p className="text-2xl dark:text-white">
                {calculateTimeDiff(
                  gameState.startedAt,
                  gameState.endedAt || new Date().toISOString()
                )}
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg shadow-sm">
              <h4 className="font-bold text-gray-700 dark:text-gray-300">
                Total Words
              </h4>
              <p className="text-2xl dark:text-white">
                {gameState.words.length}
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg shadow-sm">
              <h4 className="font-bold text-gray-700 dark:text-gray-300">
                Longest Word
              </h4>
              <p className="text-2xl dark:text-white">
                {findLongestWord(gameState.words)}
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg shadow-sm">
              <h4 className="font-bold text-gray-700 dark:text-gray-300">
                Sentence Length
              </h4>
              <p className="text-2xl dark:text-white">
                {calculateSentenceLength(gameState.words)} chars
              </p>
            </div>
          </div>

          <div className="mt-6">
            <h4 className="font-bold mb-4 text-lg text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Player Rankings
            </h4>
            <div className="overflow-x-auto bg-gray-50 dark:bg-gray-700 rounded-lg">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200">
                    <th className="py-2 px-3 text-left">Player</th>
                    <th className="py-2 px-3 text-center">Words</th>
                    <th className="py-2 px-3 text-center">Avg Length</th>
                    <th className="py-2 px-3 text-center">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {calculatePlayerStats(gameState).map((player) => (
                    <tr
                      key={player.id}
                      className={
                        player.id === playerId
                          ? "bg-blue-50 dark:bg-blue-900/20"
                          : "dark:text-gray-200"
                      }
                    >
                      <td className="py-2 px-3 border-t dark:border-gray-600">
                        <div className="flex items-center">
                          <div
                            className={`h-7 w-7 rounded-full ${getPlayerAvatarClass(
                              player.id
                            )} flex items-center justify-center text-white font-bold text-xs mr-2`}
                          >
                            {player.name.charAt(0).toUpperCase()}
                          </div>
                          <span>
                            {player.name}{" "}
                            {player.id === playerId ? "(You)" : ""}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-3 border-t dark:border-gray-600 text-center">
                        {player.wordsAdded}
                      </td>
                      <td className="py-2 px-3 border-t dark:border-gray-600 text-center">
                        {player.avgWordLength.toFixed(1)}
                      </td>
                      <td className="py-2 px-3 border-t dark:border-gray-600 text-center font-bold text-blue-600 dark:text-blue-400">
                        {calculateScore(
                          player.wordsAdded,
                          player.avgWordLength
                        ).toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-900 p-3 rounded-lg">
            <p>
              <span className="font-bold">Scoring Formula:</span> (Words Added ×
              1.0) + (Avg Word Length × 0.7)
            </p>
            <p>
              Players with higher word counts, longer words, or both will rank
              higher in the table.
            </p>
          </div>
        </div>

        <button
          onClick={onStartNewGame}
          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-4 rounded-lg w-full transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg"
        >
          Start New Game
        </button>
      </div>

      {/* Sidebar */}
      <div className="md:w-80 lg:w-96 space-y-6 mt-6 md:mt-0">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl border border-blue-100 dark:border-blue-900 transition-all duration-300">
          <h3 className="font-bold mb-3 text-lg text-gray-800 dark:text-gray-200">
            Players:
          </h3>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden">
            {gameState.players.map((player, index) => {
              const isConnected = gameState.connectedPlayers.includes(
                player.id
              );
              return (
                <div
                  key={player.id}
                  className={`flex items-center py-3 px-4 ${
                    index !== gameState.players.length - 1
                      ? "border-b border-gray-200 dark:border-gray-600"
                      : ""
                  } ${
                    player.id === playerId
                      ? "bg-blue-50 dark:bg-blue-900/20"
                      : ""
                  }`}
                >
                  <div className="relative">
                    <div
                      className={`h-8 w-8 rounded-full ${getPlayerAvatarClass(
                        player.id
                      )} flex items-center justify-center text-white font-bold`}
                    >
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <div
                      className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-white dark:border-gray-900 ${
                        isConnected
                          ? "bg-green-500 dark:bg-green-400"
                          : "bg-gray-400 dark:bg-gray-500"
                      }`}
                      title={isConnected ? "Online" : "Offline"}
                    ></div>
                  </div>
                  <div className="ml-3">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="font-medium">
                        {player.name} {player.id === playerId ? "(You)" : ""}
                      </span>
                      {gameState.startedById === player.id && (
                        <span className="text-xs bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full">
                          Host
                        </span>
                      )}
                      {!isConnected && (
                        <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                          Offline
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl border border-blue-100 dark:border-blue-900 transition-all duration-300">
          <h4 className="font-bold mb-3 text-lg text-gray-800 dark:text-gray-200">
            Game Achievements
          </h4>
          <div className="space-y-3">
            {getAchievements(gameState).map((achievement, index) => (
              <div
                key={index}
                className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg shadow-sm border-l-4 border-yellow-400 flex items-center gap-6"
              >
                <Trophy size={32} className="text-yellow-400 ml-2" />
                <div className="flex flex-col">
                  <div className="font-bold text-yellow-700 dark:text-yellow-400">
                    {achievement.title}
                  </div>
                  <div className="text-gray-700 dark:text-gray-300">
                    {achievement.player}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
