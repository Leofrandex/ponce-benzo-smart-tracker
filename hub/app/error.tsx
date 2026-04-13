"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App Error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
      <h2 className="text-xl font-bold mb-4">¡Algo salió mal!</h2>
      <p className="text-sm text-gray-600 mb-6">
        {error.message || "Se produjo un error inesperado."}
      </p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-blue-600 text-white rounded-md"
      >
        Intentar de nuevo
      </button>
    </div>
  );
}
