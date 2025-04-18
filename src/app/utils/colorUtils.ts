// Collection of color combinations for avatar backgrounds with improved contrast
// Define classes that will be directly used without string interpolation so Tailwind doesn't purge them
const AVATAR_CLASSES = [
  "bg-gradient-to-br from-indigo-600 to-purple-700 text-white",
  "bg-gradient-to-br from-blue-600 to-indigo-700 text-white",
  "bg-gradient-to-br from-cyan-600 to-blue-700 text-white",
  "bg-gradient-to-br from-emerald-600 to-teal-700 text-white",
  "bg-gradient-to-br from-green-600 to-emerald-700 text-white",
  "bg-gradient-to-br from-orange-600 to-red-700 text-white",
  "bg-gradient-to-br from-amber-600 to-orange-700 text-white",
  "bg-gradient-to-br from-rose-600 to-pink-700 text-white",
  "bg-gradient-to-br from-fuchsia-600 to-purple-700 text-white",
  "bg-gradient-to-br from-violet-600 to-indigo-700 text-white",
];

/**
 * Generates a consistent avatar class based on a string input
 *
 * @param input - The string to generate a color from (player name or ID)
 * @returns A string with Tailwind CSS classes for the avatar
 */
export const getPlayerAvatarClass = (input: string): string => {
  // Create a simple hash of the input string
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }

  // Get a positive index based on the hash
  const positiveHash = Math.abs(hash);

  // Use modulo to get an index within our avatar classes array
  const colorIndex = positiveHash % AVATAR_CLASSES.length;

  return AVATAR_CLASSES[colorIndex];
};

/**
 * Determines badge classes based on type for consistent styling
 *
 * @param type - The type of badge (host, current, or offline)
 * @returns A string with Tailwind classes for badge backgrounds
 */
export const getPlayerBadgeClasses = (
  _input: string,
  type: "host" | "current" | "offline"
): string => {
  // Base styles that are always applied
  const baseClasses = "text-xs px-2 py-0.5 rounded-full font-medium";

  // Create badge styles based on type with better contrast
  if (type === "host") {
    return `${baseClasses} bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-200`;
  } else if (type === "current") {
    return `${baseClasses} bg-green-200 text-green-900 dark:bg-green-800 dark:text-green-200`;
  } else if (type === "offline") {
    return `${baseClasses} bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300`;
  }

  return baseClasses;
};
