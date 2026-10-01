import Link from "next/link";

export function CreateToggle({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
    >
      {label}
    </Link>
  );
}
