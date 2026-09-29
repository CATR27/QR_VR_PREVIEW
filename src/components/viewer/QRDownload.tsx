type Props = {
  slug: string;
  name: string;
  url: string;
  svgMarkup: string;
  printable: boolean;
};

const linkClass =
  "inline-flex min-h-11 items-center rounded-full border border-white/30 px-4 text-sm hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white";

export default function QRDownload({ slug, name, url, svgMarkup, printable }: Props) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        role="img"
        aria-label={`Código QR de ${name}`}
        className="w-48 overflow-hidden rounded-lg bg-white [&>svg]:h-auto [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svgMarkup }}
      />
      <p className="max-w-xs break-all text-center text-xs text-white/70">{url}</p>
      {!printable && (
        <p className="max-w-xs text-center text-xs text-amber-300">
          Origen local: este QR sólo sirve en esta computadora. Configura
          APP_ORIGIN con tu dominio HTTPS antes de imprimirlo.
        </p>
      )}
      <div className="flex gap-2">
        <a className={linkClass} href={`/api/qr/${slug}?format=png`} download>
          Descargar PNG
        </a>
        <a className={linkClass} href={`/api/qr/${slug}?format=svg`} download>
          Descargar SVG
        </a>
      </div>
    </div>
  );
}
