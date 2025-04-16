"use client";

import { useEffect, useState } from "react";

export const Footer = () => {
  const [currentYear, setCurrentYear] = useState<number>(() => {
    // Use current year as default, will be hydrated properly on client
    return new Date().getFullYear();
  });

  // Make sure the year is correct after hydration
  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  return (
    <footer className="mt-8 py-4 text-center text-gray-500 text-sm border-t border-gray-200 dark:border-gray-800">
      <p>&copy; {currentYear} Joshua Weaver All Rights Reserved</p>
    </footer>
  );
};
