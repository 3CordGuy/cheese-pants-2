// Collection of color combinations for avatar backgrounds
const COLOR_PAIRS = [
  { from: "indigo-500", to: "purple-600" },
  { from: "blue-500", to: "indigo-600" },
  { from: "cyan-500", to: "blue-600" },
  { from: "emerald-500", to: "teal-600" },
  { from: "green-500", to: "emerald-600" },
  { from: "orange-500", to: "red-600" },
  { from: "amber-500", to: "orange-600" },
  { from: "rose-500", to: "pink-600" },
  { from: "fuchsia-500", to: "purple-600" },
  { from: "violet-500", to: "indigo-600" },
];

/**
 * Generates a consistent color pair based on a string input (name or ID)
 *
 * @param input - The string to generate a color from (player name or ID)
 * @returns An object with from and to color classes for gradients
 */
export const getPlayerColor = (input: string): { from: string; to: string } => {
  // Create a simple hash of the input string
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }

  // Get a positive index based on the hash
  const positiveHash = Math.abs(hash);

  // Use modulo to get an index within our color pairs array
  const colorIndex = positiveHash % COLOR_PAIRS.length;

  return COLOR_PAIRS[colorIndex];
};

/**
 * Generates a Tailwind CSS class string for a player avatar background
 *
 * @param input - The string to generate a color from (player name or ID)
 * @returns A string of Tailwind CSS classes for the background
 */
export const getPlayerAvatarClass = (input: string): string => {
  const { from, to } = getPlayerColor(input);
  return `bg-gradient-to-br from-${from} to-${to}`;
};
