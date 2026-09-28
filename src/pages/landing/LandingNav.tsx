import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";

const links = [
  { label: "Home", href: "#top" },
  { label: "Features", href: "#features" },
  { label: "Solutions", href: "#solutions" },
  { label: "Pricing", href: "#pricing" },
  { label: "Resources", href: "#resources" },
];

export function LandingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="sticky top-4 z-50 px-4">
      <nav className="mx-auto flex h-16 max-w-[1240px] items-center justify-between rounded-full border border-border bg-surface/85 px-3 pl-5 shadow-elevation-2 backdrop-blur-xl sm:px-4">
        <a href="#top" className="flex shrink-0 items-center gap-2">
          <img src="/logo-64.png" alt="UManager" className="h-8 w-8 object-contain" />
          <span className="font-headline text-base font-bold tracking-tight text-text">UManager</span>
        </a>

        <div className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <Link
            to="/login"
            className="rounded-full px-4 py-2 text-sm font-medium text-text-muted outline-none transition-colors hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary shadow-elevation-1 outline-none transition-all hover:bg-primary-hover hover:shadow-elevation-2 focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            Request Demo
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          className="flex h-10 w-10 items-center justify-center rounded-full text-text outline-none transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40 lg:hidden"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {mobileOpen && (
        <div className="mx-auto mt-2 max-w-[1240px] rounded-3xl border border-border bg-surface p-4 shadow-elevation-2 lg:hidden">
          <div className="flex flex-col gap-1">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-xl px-4 py-3 text-sm font-medium text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
            <Link
              to="/login"
              className="rounded-xl px-4 py-3 text-center text-sm font-medium text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="rounded-full bg-primary px-4 py-3 text-center text-sm font-semibold text-on-primary shadow-elevation-1 transition-colors hover:bg-primary-hover"
            >
              Request Demo
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
