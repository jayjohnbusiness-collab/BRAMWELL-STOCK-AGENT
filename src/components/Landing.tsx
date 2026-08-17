import { useEffect, useRef, useState } from "react";
import { Bell } from "../brand/Bell";
import { VoiceOrb } from "./VoiceOrb";
import { Login } from "./Login";
import { EarlyAccess } from "./EarlyAccess";
import "../styles/landing.css";

/*
 * The front door for prospects — a marketing page in Bramwell's own register.
 * Same ink/brass/paper, same frosted glass, restrained motion (a light
 * scroll-reveal, nothing that shouts). Every call to action drops the visitor
 * into the live app via onEnter.
 */
export function Landing({ onEnter }: { onEnter: () => void }) {
  const [showLogin, setShowLogin] = useState(false);
  const [showEarlyAccess, setShowEarlyAccess] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  // Reveal elements as they scroll into view (skipped under reduced motion).
  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    if (reduced) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Scroll-driven motion: a progress line, gentle parallax on tagged layers.
  // One rAF-throttled pass per frame; disabled entirely under reduced motion.
  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduced) return;

    const layers = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));
    let ticking = false;

    const apply = () => {
      ticking = false;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, y / max) : 0;
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${p})`;
      for (const el of layers) {
        const speed = Number(el.dataset.parallax) || 0;
        el.style.transform = `translate3d(0, ${(y * speed).toFixed(1)}px, 0)`;
      }
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(apply);
      }
    };

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className="lp">
      {/* Scroll progress line — fills as the page is read. */}
      <div className="lp-progress" aria-hidden="true">
        <div ref={progressRef} className="lp-progress-fill" />
      </div>

      {/* Ambient drifting orbs behind everything (parallax + slow drift). */}
      <div className="lp-orbs" aria-hidden="true">
        <span className="lp-orb lp-orb-1" data-parallax="-0.12">
          <i />
        </span>
        <span className="lp-orb lp-orb-2" data-parallax="0.08">
          <i />
        </span>
        <span className="lp-orb lp-orb-3" data-parallax="-0.05">
          <i />
        </span>
      </div>

      {/* ---------------------------------------------------------- Nav */}
      <header className="lp-nav">
        <a className="lp-brand" href="#home">
          <Bell size={26} tone="brass" />
          <span className="lp-word">Bramwell</span>
        </a>
        <nav className="lp-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="lp-nav-cta">
          <button type="button" className="lp-ghost" onClick={() => setShowLogin(true)}>
            Log in
          </button>
          <button type="button" className="lp-btn" onClick={onEnter}>
            Try it free
          </button>
        </div>
      </header>

      {showLogin ? <Login onClose={() => setShowLogin(false)} onSuccess={onEnter} /> : null}
      {showEarlyAccess ? <EarlyAccess onClose={() => setShowEarlyAccess(false)} /> : null}

      {/* --------------------------------------------------------- Hero */}
      <section className="lp-hero">
        <div className="lp-hero-copy reveal reveal-l">
          <span className="lp-eyebrow">Meet Bramwell</span>
          <h1 className="lp-h1">Your market, kept in order.</h1>
          <p className="lp-lead">
            A market butler who watches the names you care about and speaks up the moment
            something's worth your while — a mover, a level you set, the story behind a jump.
            By keyboard or by voice.
          </p>
          <div className="lp-hero-cta">
            <button type="button" className="lp-btn lp-btn-lg" onClick={onEnter}>
              Try it free
            </button>
            <a className="lp-textlink" href="#how">
              See how it works ↓
            </a>
          </div>
          <p className="lp-fineprint">No account. Runs in your browser. Sample data out of the box.</p>
        </div>
        <div className="lp-hero-visual reveal reveal-r">
          <div className="lp-hero-float" data-parallax="-0.06">
            <Preview />
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- Features */}
      <section id="features" className="lp-section">
        <div className="lp-section-head reveal">
          <span className="lp-eyebrow">What Bramwell does</span>
          <h2 className="lp-h2">Everything you need to keep an eye on the market — nothing you don't.</h2>
        </div>
        <div className="lp-grid">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="lp-card reveal" style={{ transitionDelay: `${i * 60}ms` }}>
              <span className="lp-icon">{f.icon}</span>
              <h3 className="lp-card-title">{f.title}</h3>
              <p className="lp-card-body">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------- How it works */}
      <section id="how" className="lp-section lp-how">
        <div className="lp-section-head reveal">
          <span className="lp-eyebrow">How it works</span>
          <h2 className="lp-h2">Three steps, then he takes the watch.</h2>
        </div>
        <ol className="lp-steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="lp-step reveal" style={{ transitionDelay: `${i * 80}ms` }}>
              <span className="lp-step-num">{i + 1}</span>
              <h3 className="lp-step-title">{s.title}</h3>
              <p className="lp-card-body">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------------------------- Voice */}
      <section className="lp-voice">
        <div className="lp-voice-orb reveal reveal-l" aria-hidden="true">
          <VoiceOrb speaking={false} working={false} listening={false} />
        </div>
        <div className="lp-voice-copy reveal reveal-r">
          <span className="lp-eyebrow">Hands-free</span>
          <h2 className="lp-h2">Talk to your market.</h2>
          <p className="lp-lead">
            Say “Hey Bramwell,” then ask. He listens, answers aloud, and stays out of the way —
            a quiet presence at the desk, never a chatbot.
          </p>
          <button type="button" className="lp-btn" onClick={onEnter}>
            Hear it yourself
          </button>
        </div>
      </section>

      {/* ----------------------------------------------------- Pricing */}
      <section id="pricing" className="lp-section">
        <div className="lp-section-head reveal">
          <span className="lp-eyebrow">Pricing</span>
          <h2 className="lp-h2">Start free. Upgrade when you're ready.</h2>
        </div>
        <div className="lp-tiers">
          <div className="lp-tier reveal">
            <div className="lp-tier-name">Free</div>
            <div className="lp-price">
              $0<span className="lp-price-sub">/forever</span>
            </div>
            <p className="lp-price-alt">no card, no catch</p>
            <ul className="lp-tier-list">
              {FREE.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <button type="button" className="lp-btn lp-btn-block" onClick={onEnter}>
              Start free
            </button>
          </div>
          <div className="lp-tier lp-tier-pro reveal">
            <div className="lp-tier-flag">Coming soon</div>
            <div className="lp-tier-name">Bramwell Concierge</div>
            <div className="lp-price">
              $100<span className="lp-price-sub">/month</span>
            </div>
            <p className="lp-price-alt">Founding access — lock in launch pricing</p>
            <ul className="lp-tier-list">
              {CONCIERGE.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <button
              type="button"
              className="lp-btn lp-btn-block"
              onClick={() => setShowEarlyAccess(true)}
            >
              Request early access
            </button>
          </div>
        </div>
        <p className="lp-fineprint lp-center">
          Concierge is in active development — the Free demo is fully live today.
        </p>
      </section>

      {/* --------------------------------------------------------- FAQ */}
      <section id="faq" className="lp-section lp-faq">
        <div className="lp-section-head reveal">
          <span className="lp-eyebrow">Questions</span>
          <h2 className="lp-h2">Good to know.</h2>
        </div>
        <div className="lp-faq-list">
          {FAQ.map((q) => (
            <div key={q.q} className="lp-faq-item reveal">
              <h3 className="lp-faq-q">{q.q}</h3>
              <p className="lp-card-body">{q.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------- Final CTA */}
      <section className="lp-final reveal">
        <h2 className="lp-h2">Let Bramwell keep the watch.</h2>
        <button type="button" className="lp-btn lp-btn-lg" onClick={onEnter}>
          Try it free
        </button>
      </section>

      {/* ------------------------------------------------------ Footer */}
      <footer className="lp-footer">
        <div className="lp-brand">
          <Bell size={22} tone="brass" />
          <span className="lp-word">Bramwell</span>
        </div>
        <span className="lp-foot-tag">Your market, kept in order.</span>
        <span className="lp-foot-copy">© {new Date().getFullYear()} Bramwell</span>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------ Product preview */

/** A static, on-brand glimpse of the app: a frosted card with a few live-looking rows. */
function Preview() {
  const rows = [
    { sym: "NVDA", name: "NVIDIA", price: "181.43", chg: "+7.21%", tone: "up" },
    { sym: "AAPL", name: "Apple", price: "228.12", chg: "−1.06%", tone: "down" },
    { sym: "MSFT", name: "Microsoft", price: "431.50", chg: "+0.21%", tone: "up" },
  ];
  return (
    <div className="lp-preview card">
      <div className="lp-preview-head">
        <Bell size={20} tone="brass" />
        <span className="lp-preview-word">Bramwell</span>
        <span className="lp-preview-tag">Your market, kept in order.</span>
      </div>
      <div className="lp-preview-rows">
        {rows.map((r) => (
          <div key={r.sym} className="lp-preview-row">
            <span className="lp-preview-name">
              <b>{r.sym}</b>
              <em>{r.name}</em>
            </span>
            <span className="lp-preview-fig">
              <span className="lp-preview-price">{r.price}</span>
              <span className={`chg ${r.tone}`}>{r.chg}</span>
            </span>
          </div>
        ))}
      </div>
      <svg className="lp-preview-spark" viewBox="0 0 320 60" preserveAspectRatio="none" aria-hidden="true">
        <path
          className="lp-preview-path"
          d="M0,44 L40,40 L70,46 L100,30 L130,34 L160,20 L190,26 L220,14 L250,18 L280,8 L320,12"
          fill="none"
          stroke="var(--data-up)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/* --------------------------------------------------------------- content */

const FEATURES = [
  { title: "Your watchlist", body: "Follow the names you care about — live prices, clean and quiet.", icon: <EyeIcon /> },
  { title: "Alerts & triggers", body: "Name a level; hear the moment it's crossed — price, a % move, or your whole book's P/L.", icon: <BellIcon /> },
  { title: "Ask anything", body: "“How's NVIDIA?” “What's moving today?” Bramwell answers in plain words, by type or voice.", icon: <ChatIcon /> },
  { title: "Every ticker, in depth", body: "One click opens the range, key stats, next earnings, and the latest headlines.", icon: <DrawerIcon /> },
  { title: "Dividends & income", body: "See what your holdings pay and when — income and yield, totalled for you.", icon: <CoinIcon /> },
  { title: "Morning briefing", body: "Open to an unprompted recap: your movers, alerts that fired, earnings due today.", icon: <SunIcon /> },
];

const STEPS = [
  { title: "Add your names", body: "Type a ticker or a company — Bramwell finds it and keeps the list." },
  { title: "He watches, quietly", body: "Live prices, causes, and the marks you've set — tracked without the noise." },
  { title: "He speaks when it matters", body: "A mover, a crossed level, a story worth knowing — surfaced the moment it lands." },
];

const FREE = [
  "Watchlist, movers & breadth",
  "Ask Bramwell (chat)",
  "Price & detail cards",
  "Sample market data",
  "One dashboard board",
];

const CONCIERGE = [
  "Everything in Free",
  "Live spoken squawk — Bramwell calls you",
  "AI analyst over filings & earnings",
  "Your portfolio, linked & risk-watched",
  "Licensed real-time market data",
  "Proactive briefings, voice & unlimited alerts",
];

const FAQ = [
  { q: "Do I need an account?", a: "No. Try everything right in the browser — your watchlist, holdings, and notes stay on your device." },
  { q: "What is Bramwell Concierge?", a: "The premium tier: a voice-first analyst on call — licensed real-time data, a spoken squawk that phones you on your own holdings, and AI that reasons over filings and earnings. Request early access from Pricing." },
  { q: "When does Concierge launch?", a: "It's in active development. Founding early-access members lock in launch pricing — the Free demo is fully live in the meantime." },
  { q: "Do I need an API key?", a: "The Free demo runs on sample data. Connect a free Finnhub key any time for live prices; Concierge brings licensed real-time data with no key needed." },
  { q: "Which browsers handle voice?", a: "Voice works best in Chrome or Edge; everything else runs everywhere." },
  { q: "Is my data private?", a: "On Free there's no server — your data lives only in your browser. Concierge links your portfolio securely so Bramwell can watch it for you." },
];

/* ---------------------------------------------------------- small icons */

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" stroke="var(--brass)" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="2.6" fill="var(--brass)" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 16.5c0-1 .8-1.6.8-4.5 0-3 2-5 5.2-5s5.2 2 5.2 5c0 2.9.8 3.5.8 4.5Z" stroke="var(--brass)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M10.2 19a1.9 1.9 0 0 0 3.6 0" stroke="var(--brass)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 5.5h16v10H9l-4 3.5v-3.5H4Z" stroke="var(--brass)" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
function DrawerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" stroke="var(--brass)" strokeWidth="1.6" />
      <path d="M14 4.5v15" stroke="var(--brass)" strokeWidth="1.6" />
    </svg>
  );
}
function CoinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <ellipse cx="12" cy="7" rx="7" ry="3" stroke="var(--brass)" strokeWidth="1.6" />
      <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" stroke="var(--brass)" strokeWidth="1.6" />
    </svg>
  );
}
function SunIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" fill="var(--brass)" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" stroke="var(--brass)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
