"use client";

import { usePathname } from "next/navigation";
import { useState, useLayoutEffect } from "react";

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => {
    // Start invisible on every pathname change (including mount)
    setVisible(false);

    const raf = requestAnimationFrame(() => {
      setVisible(true);
    });

    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        transition: visible
          ? "opacity 260ms cubic-bezier(0.4, 0, 0.2, 1), transform 260ms cubic-bezier(0.4, 0, 0.2, 1)"
          : "none",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      {children}
    </div>
  );
}
