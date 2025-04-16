"use client";

interface DiceProps {
  size?: number;
  className?: string;
}

const Dice = ({ size = 24, className = "" }: DiceProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 256 256"
      className={className}
    >
      <rect width="256" height="256" fill="none" />
      <rect x="40" y="40" width="176" height="176" rx="24" opacity="0.2" />
      <rect
        x="40"
        y="40"
        width="176"
        height="176"
        rx="24"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="16"
      />
      <circle cx="92" cy="84" r="12" fill="currentColor" />
      <circle cx="164" cy="84" r="12" fill="currentColor" />
      <circle cx="92" cy="128" r="12" fill="currentColor" />
      <circle cx="164" cy="128" r="12" fill="currentColor" />
      <circle cx="92" cy="172" r="12" fill="currentColor" />
      <circle cx="164" cy="172" r="12" fill="currentColor" />
    </svg>
  );
};

export default Dice;
