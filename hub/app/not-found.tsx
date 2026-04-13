import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
      <h2 className="text-xl font-bold mb-4">404 - Página no encontrada</h2>
      <p className="text-sm text-gray-600 mb-6">
        La página que buscas no existe.
      </p>
      <Link
        href="/"
        className="px-4 py-2 bg-blue-600 text-white rounded-md"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
