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
        } px-0.5 py-0 rounded-md cursor-pointer transition-all duration-200 group-hover:px-1.5 group-hover:py-1 group-hover:rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 hover:shadow-sm ${
          showPopover ? "bg-blue-50 dark:bg-blue-900/30" : ""
        }`}
        onClick={() => {
          setShowPopover(!showPopover);
        }}
      >
        {word.text}
      </span>

      {showPopover && (
        <div
          ref={popoverRef}
          className="absolute left-0 top-full mt-2 z-10 bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-lg rounded-lg p-3 w-56 text-gray-900 dark:text-gray-200 animate-fadeIn"
        >
          <p className="font-bold text-lg">{word.text}</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
              {word.authorName.charAt(0).toUpperCase()}
            </div>
            <p>Added by: {word.authorName}</p>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {formattedTime}
          </p>
          {word.isRequired && (
            <p className="text-blue-600 dark:text-blue-400 font-semibold mt-2 flex items-center">
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Required word
            </p>
          )}
          {isAdmin && (
            <button
              onClick={() => {
                onDelete(index);
              }}
              className="mt-3 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 px-3 py-1.5 rounded-md w-full text-center flex items-center justify-center font-medium transition-colors"
            >
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Delete Word
            </button>
          )}
        </div>
      )}

      {!isLast && (
        <span className="transition-all duration-200 group-hover:mx-0.5">
          &nbsp;
        </span>
      )}
    </div>
  );
};
