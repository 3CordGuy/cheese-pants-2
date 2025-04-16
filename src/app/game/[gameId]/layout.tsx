import type { Metadata } from "next";

export default function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

// Basic static metadata
export const metadata: Metadata = {
  title: "Join a Cheese Pants game!",
  description:
    "Join me in a game of Cheese Pants. Let's create something absurd together!",
  openGraph: {
    title: "Join a Cheese Pants game!",
    description:
      "Join me in a game of Cheese Pants. Let's create something absurd together!",
    images: ["/cheese-pants-carving-transparent.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Join a Cheese Pants game!",
    description:
      "Join me in a game of Cheese Pants. Let's create something absurd together!",
    images: ["/cheese-pants-carving-transparent.png"],
  },
};
