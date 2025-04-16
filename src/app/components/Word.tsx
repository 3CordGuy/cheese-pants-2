"use client";

import { useEffect, useRef, useState } from "react";
import type { WordInfo } from "../../../worker/src/index";

interface WordProps {
  word: WordInfo;
  index: number;
  isAdmin: boolean;
  isLast: boolean;
  onDelete: (index: number) => void;
}

export const Word = ({ word, index, isAdmin, isLast, onDelete }: WordProps) => {
  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLSpanElement>(null);

  // Format the timestamp using native Intl API
  const formattedTime = word.addedAt
    ? new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      }).format(new Date(word.addedAt))
    : "";

  // Handle mouse events for both the word and popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        wordRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        !wordRef.current.contains(event.target as Node)
      ) {
        setShowPopover(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="inline-block relative">
      <span
        ref={wordRef}
        className={`${
          word.isRequired
            ? "font-semibold text-blue-600 dark:text-blue-400"
            : ""
        } hover:bg-gray-100 dark:hover:bg-gray-800 px-1 py-0.5 rounded cursor-pointer`}
        onClick={() => setShowPopover(!showPopover)}
      >
        {word.text}
      </span>

      {showPopover && (
        <div
          ref={popoverRef}
          className="absolute left-0 top-full mt-1 z-10 bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-lg rounded p-2 text-xs w-48 text-gray-900 dark:text-gray-200"
        >
          <p className="font-bold">{word.text}</p>
          <p>Added by: {word.authorName}</p>
          <p className="text-gray-500 dark:text-gray-400">{formattedTime}</p>
          {word.isRequired && (
            <p className="text-blue-600 dark:text-blue-400 font-semibold mt-1">
              Required word
            </p>
          )}
          {isAdmin && (
            <button
              onClick={() => onDelete(index)}
              className="mt-2 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-xs bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 px-2 py-1 rounded w-full text-center"
            >
              Delete Word
            </button>
          )}
        </div>
      )}

      {!isLast && <span>&nbsp;</span>}
    </div>
  );
};
