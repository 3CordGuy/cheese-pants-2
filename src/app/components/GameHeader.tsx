"use client";

import Image from "next/image";

interface GameHeaderProps {
  onNewGame: () => void;
  onShareGame: () => void;
}

export const GameHeader = ({ onNewGame, onShareGame }: GameHeaderProps) => {
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-blue-100 dark:border-blue-900 mb-6 overflow-visible relative">
      {/* Blurred background logo */}
      <div className="absolute inset-0 overflow-hidden rounded-lg opacity-10">
        <div className="absolute -inset-10 flex items-center justify-center">
          <Image
            src="/cheese-pants-carving-transparent.png"
            alt=""
            width={400}
            height={400}
            className="object-contain blur-xl transform scale-150 "
            priority
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center relative z-10">
        <div className="flex items-center  mb-12 md:mb-0">
          <div className="relative flex items-center justify-center max-h-16 h-24 w-24 md:h-32 md:w-32">
            <Image
              src="/cheese-pants-carving-transparent.png"
              alt="Cheese Pants Logo"
              width={140}
              height={140}
              className="object-contain transition-all duration-300"
              priority
            />
          </div>
          <div className="flex flex-col">
            <h2 className="text-xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent leading-tight">
              Cheese Pants
            </h2>
            <span className="text-sm md:text-base text-gray-500 dark:text-gray-400 font-light">
              The Sequel
            </span>
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={onNewGame}
            className="relative bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-medium rounded-full h-12 shadow-md hover:shadow-lg transition-all duration-300 group overflow-hidden w-12 hover:w-44"
            aria-label="New Game"
          >
            <span className="flex items-center justify-center w-full h-full">
              <span className="flex items-center justify-center absolute left-0 top-0 w-12 h-12 text-white">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M12 5V19M5 12H19"
                    stroke="white"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="ml-10 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100 pr-4">
                New Game
              </span>
            </span>
          </button>
          <button
            onClick={onShareGame}
            className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium px-5 py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            Share
          </button>
        </div>
      </div>
    </div>
  );
};
