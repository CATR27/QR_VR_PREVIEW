import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-4 bg-neutral-950 p-6 text-center text-white">
      <h1 className="text-2xl font-bold">Modelo no encontrado</h1>
      <p className="text-white/80">
        Este código QR no corresponde a ningún modelo disponible.
      </p>
      <Link
        href="/"
        className="rounded-full bg-orange-500 px-6 py-3 font-semibold text-black hover:bg-orange-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        Ver modelos
      </Link>
    </main>
  );
}
