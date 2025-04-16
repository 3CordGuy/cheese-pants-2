"use client";

interface GameHeaderProps {
  onNewGame: () => void;
  onShareGame: () => void;
}

export const GameHeader = ({ onNewGame, onShareGame }: GameHeaderProps) => {
  return (
    <div className="flex justify-between items-center">
      <h2 className="text-xl font-bold">Cheese Pants: The Sequel</h2>
      <div className="flex space-x-2">
        <button
          onClick={onNewGame}
          className="bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600 transition-colors"
        >
          New Game
        </button>
        <button
          onClick={onShareGame}
          className="bg-blue-500 text-white px-4 py-2 rounded text-sm hover:bg-blue-600 transition-colors"
        >
          Share Game
        </button>
      </div>
    </div>
  );
};
