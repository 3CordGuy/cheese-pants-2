"use client";

import { GameState, Player, WordInfo } from "../../../worker/src/index";
import Trophy from "./icons/Trophy";

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

  // Most words contributed
  if (playerStats[0].wordsAdded > 0) {
    achievements.push({
      title: "Word Master",
      player: `${playerStats[0].name} (${playerStats[0].wordsAdded} words)`,
    });
  }

  // Longest average word length
  const vocabChamp = [...playerStats].sort(
    (a, b) => b.avgWordLength - a.avgWordLength
  )[0];
  if (vocabChamp.avgWordLength > 0) {
    achievements.push({
      title: "Vocabulary Champion",
      player: `${vocabChamp.name} (avg: ${vocabChamp.avgWordLength.toFixed(
        1
      )})`,
    });
  }

  // Most required words used
  const requiredWordsChamp = [...playerStats].sort(
    (a, b) => b.requiredWordsUsed - a.requiredWordsUsed
  )[0];
  if (requiredWordsChamp.requiredWordsUsed > 0) {
    achievements.push({
      title: "Objective Completer",
      player: `${requiredWordsChamp.name} (${requiredWordsChamp.requiredWordsUsed} req. words)`,
    });
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
  return (
    <div className="space-y-4">
      <div className="border p-4 rounded bg-green-50 text-green-800">
        <h3 className="font-bold mb-2 text-3xl bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent animate-pulse text-center">
          🎉 Game Complete! 🏆
        </h3>
        <p className="font-light text-md -mt-1 text-gray-600 text-center italic">
          Your Masterpiece Awaits...
        </p>
        <p className="italic mt-2 text-3xl text-black text-center">
          {gameState.words.map((word, i) => (
            <span
              key={i}
              className={word.isRequired ? "font-semibold text-blue-600" : ""}
            >
              {word.text}
              {i < gameState.words.length - 1 ? " " : ""}
            </span>
          ))}
        </p>
      </div>

      <div className="border p-4 rounded bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
        <h3 className="font-bold mb-3 text-xl dark:text-gray-200">
          Game Statistics
        </h3>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-white p-3 rounded shadow-sm dark:bg-gray-700">
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

          <div className="bg-white p-3 rounded shadow-sm dark:bg-gray-700">
            <h4 className="font-bold text-gray-700 dark:text-gray-300">
              Total Words
            </h4>
            <p className="text-2xl dark:text-white">{gameState.words.length}</p>
          </div>

          <div className="bg-white p-3 rounded shadow-sm dark:bg-gray-700">
            <h4 className="font-bold text-gray-700 dark:text-gray-300">
              Longest Word
            </h4>
            <p className="text-2xl dark:text-white">
              {findLongestWord(gameState.words)}
            </p>
          </div>

          <div className="bg-white p-3 rounded shadow-sm dark:bg-gray-700">
            <h4 className="font-bold text-gray-700 dark:text-gray-300">
              Sentence Length
            </h4>
            <p className="text-2xl dark:text-white">
              {calculateSentenceLength(gameState.words)} chars
            </p>
          </div>
        </div>

        <h4 className="font-bold mb-2 dark:text-gray-200">Player Rankings</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white dark:bg-gray-700">
            <thead>
              <tr className="bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200">
                <th className="py-2 px-3 text-left">Player</th>
                <th className="py-2 px-3 text-center">Words Added</th>
                <th className="py-2 px-3 text-center">Avg Word Length</th>
                <th className="py-2 px-3 text-center">Required Words</th>
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
                    {player.name} {player.id === playerId ? "(You)" : ""}
                  </td>
                  <td className="py-2 px-3 border-t dark:border-gray-600 text-center">
                    {player.wordsAdded}
                  </td>
                  <td className="py-2 px-3 border-t dark:border-gray-600 text-center">
                    {player.avgWordLength.toFixed(1)}
                  </td>
                  <td className="py-2 px-3 border-t dark:border-gray-600 text-center">
                    {player.requiredWordsUsed}
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

        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-900 p-2 rounded">
          <p>
            <span className="font-bold">Scoring Formula:</span> (Words Added ×
            1.0) + (Avg Word Length × 0.7)
          </p>
          <p>
            Players with higher word counts, longer words, or both will rank
            higher in the table.
          </p>
        </div>

        <h4 className="font-bold mt-4 mb-2 dark:text-gray-200">
          Game Achievements
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:grid-cols-3">
          {getAchievements(gameState).map((achievement, index) => (
            <div
              key={index}
              className="bg-white p-3 rounded shadow-sm border-l-4 border-yellow-400 dark:bg-gray-700 dark:text-gray-200 flex items-center gap-6"
            >
              <Trophy size={32} className="text-yellow-400 ml-2" />
              <div className="flex flex-col">
                <div className="font-bold text-yellow-700 dark:text-yellow-400">
                  {achievement.title}
                </div>
                <div>{achievement.player}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border p-4 rounded">
        <h3 className="font-bold mb-2">Players:</h3>
        <ul className="list-disc pl-4">
          {gameState.players.map((player) => (
            <li key={player.id}>
              {player.name} {player.id === playerId ? "(You)" : ""}
              {gameState.startedById === player.id ? " (Host)" : ""}
            </li>
          ))}
        </ul>
      </div>
      <button
        onClick={onStartNewGame}
        className="bg-blue-500 text-white px-4 py-2 rounded w-full"
      >
        Start New Game
      </button>
    </div>
  );
};
