import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export function LandingFooter() {
  return (
    <footer id="resources" className="mx-auto max-w-290 px-4 pb-16">
      <div className="rounded-[32px] bg-primary px-8 py-14 text-center shadow-elevation-3 sm:px-16" id="demo">
        <h2 className="text-2xl font-semibold tracking-tight text-on-primary sm:text-3xl">
          Ready to run your business from one place?
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-on-primary/80">
          Set up your workspace in minutes — no credit card required to get started.
        </p>
        <Link
          to="/register"
          className="mt-7 inline-flex h-[52px] items-center gap-2 rounded-full bg-surface px-7 text-[15px] font-semibold text-primary shadow-elevation-2 transition-all hover:-translate-y-0.5 hover:shadow-elevation-3"
        >
          Get Started
          <ArrowRight size={18} />
        </Link>
      </div>

      <div className="mt-16 flex flex-col items-center justify-between gap-6 border-t border-border pt-8 sm:flex-row">
        <div className="flex items-center gap-2">
          <img src="/logo-64.png" alt="UManager" className="h-7 w-7 object-contain" />
          <span className="font-headline text-sm font-bold text-text">UManager</span>
        </div>
        <p className="text-xs text-text-muted">© {new Date().getFullYear()} UManager. All rights reserved.</p>
        <div className="flex items-center gap-5 text-xs text-text-muted">
          <a href="#features" className="hover:text-text">
            Features
          </a>
          <a href="#pricing" className="hover:text-text">
            Pricing
          </a>
          <Link to="/login" className="hover:text-text">
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
