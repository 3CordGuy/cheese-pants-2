"use client";

interface LoadingSpinnerProps {
  message?: string;
}

export const LoadingSpinner = ({
  message = "Connecting to game...",
}: LoadingSpinnerProps) => {
  return (
    <div className="p-4 flex items-center justify-center h-48">
      <div className="text-center">
        <div className="mb-2">{message}</div>
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    </div>
  );
};
