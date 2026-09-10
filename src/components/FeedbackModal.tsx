import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { X, Send, Check, Copy, AlertCircle, Sparkles, Bug, MessageSquare, Flame } from "lucide-react";

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  stats?: {
    score?: number;
    best?: number;
    blocks?: number;
  };
}

interface Category {
  id: string;
  icon: typeof Sparkles;
  label: string;
  badge: string;
  hint: string;
  placeholder: string;
  subjectPrefix: string;
  templates: { label: string; text: string }[];
}

const CATEGORIES: Category[] = [
  {
    id: "idea",
    icon: Sparkles,
    label: "Game Idea",
    badge: "MECHANIC / IDEA",
    hint: "Got a sick idea for a new block skin, clutch mechanic, or game mode?",
    placeholder: "Pitch your game mechanic, theme idea, or power-up idea here...",
    subjectPrefix: "💡 Stacker Idea",
    templates: [
      {
        label: "🎮 New Game Mode",
        text: "Add a 'Reverse Gravity' or 'Sudden Death' speed run mode where blocks move 2x faster!",
      },
      {
        label: "🎨 Custom Themes",
        text: "Add unlockable block skins like Cyberpunk Neon, Retro 8-bit, or Pastel Arcade.",
      },
      {
        label: "🔥 Combo Power-up",
        text: "Hitting 5 perfect drops in a row should award a slow-motion rewind for the next block!",
      },
    ],
  },
  {
    id: "bug",
    icon: Bug,
    label: "Bug Report",
    badge: "GLITCH / ISSUE",
    hint: "Spotted block misalignment, audio stutter, mobile touch delay, or score glitch?",
    placeholder: "What went wrong? (e.g. block slice didn't animate, touch tapped twice, audio cut off)...",
    subjectPrefix: "🐛 Stacker Bug",
    templates: [
      {
        label: "📱 Mobile Touch Delay",
        text: "On mobile browsers, there's a slight tap lag when dropping blocks rapidly.",
      },
      {
        label: "🔊 Audio Stutter",
        text: "Sound effects cut out or crackle when stacking beyond 20 blocks.",
      },
      {
        label: "📐 Slice Alignment",
        text: "The block slice physics occasionally misaligned on edge-drop near the top.",
      },
    ],
  },
  {
    id: "feedback",
    icon: MessageSquare,
    label: "Feedback",
    badge: "GENERAL NOTE",
    hint: "Loving the game? Flexing a high score, dropping a roast, or saying hi to Abhishek?",
    placeholder: "Drop your feedback, high score flex, or note to Abhishek...",
    subjectPrefix: "💬 Stacker Feedback",
    templates: [
      {
        label: "🏆 High Score Flex",
        text: "Just hit a new high score on Stacker! The clutch audio and shake feel so satisfying.",
      },
      {
        label: "🤝 Collaboration",
        text: "Hey Abhishek, loved your work on Stacker! Would love to connect regarding web dev projects.",
      },
    ],
  },
];

const COOLDOWN_SECONDS = 60;
const MAX_HOURLY_DISPATCHES = 5;
const DIRECT_EMAIL = "abhishek.jain.dev@outlook.com";
const WEB3FORMS_KEY = "8a1e06e5-be91-4200-8d77-df95f527bcd9";

function getRecentDispatchesCount(): number {
  try {
    const raw = JSON.parse(localStorage.getItem("stackr_game:feedback_history") || "[]");
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const valid = Array.isArray(raw) ? raw.filter((ts: number) => ts > oneHourAgo) : [];
    return valid.length;
  } catch {
    return 0;
  }
}

function recordDispatchTimestamp(): void {
  try {
    const raw = JSON.parse(localStorage.getItem("stackr_game:feedback_history") || "[]");
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const valid = Array.isArray(raw) ? raw.filter((ts: number) => ts > oneHourAgo) : [];
    valid.push(Date.now());
    localStorage.setItem("stackr_game:feedback_history", JSON.stringify(valid));
  } catch {}
}

export default function FeedbackModal({ open, onClose, stats }: FeedbackModalProps) {
  const [activeCategory, setActiveCategory] = useState<string>("idea");
  const [name, setName] = useState<string>(() => {
    try {
      return localStorage.getItem("stackr_game:feedback_name") || "";
    } catch {
      return "";
    }
  });
  const [email, setEmail] = useState<string>(() => {
    try {
      return localStorage.getItem("stackr_game:feedback_email") || "";
    } catch {
      return "";
    }
  });
  const [message, setMessage] = useState<string>("");
  const [includeStats, setIncludeStats] = useState<boolean>(true);

  // Strix Honeypot & Anti-Spam States
  const [botcheck, setBotcheck] = useState<boolean>(false);
  const [decoyGotcha, setDecoyGotcha] = useState<string>("");
  const formOpenedAtRef = useRef<number>(Date.now());

  // Cooldown & Status States
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  // Check cooldown on mount / open
  useEffect(() => {
    if (!open) return;
    formOpenedAtRef.current = Date.now();
    setStatus("idle");
    setErrorMessage("");

    try {
      const lastTs = parseInt(localStorage.getItem("stackr_game:feedback_last_ts") || "0", 10);
      const diff = Math.floor((Date.now() - lastTs) / 1000);
      if (diff < COOLDOWN_SECONDS) {
        setCooldownRemaining(COOLDOWN_SECONDS - diff);
      } else {
        setCooldownRemaining(0);
      }
    } catch {
      setCooldownRemaining(0);
    }
  }, [open]);

  // Cooldown timer interval
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  const currentCategory = CATEGORIES.find((c) => c.id === activeCategory) || CATEGORIES[0];

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // 1. Strix Honeypot Defense
      if (botcheck || decoyGotcha.trim().length > 0) {
        // Silently drop bot submission
        setStatus("success");
        return;
      }

      // 2. Strix Speed-Trap Defense (< 1.8 seconds)
      const elapsedMs = Date.now() - formOpenedAtRef.current;
      if (elapsedMs < 1800) {
        setErrorMessage("Submission too fast! Please take a moment to type your thought.");
        setStatus("error");
        return;
      }

      // 3. Strix Cooldown Enforcement
      if (cooldownRemaining > 0) {
        setErrorMessage(`⏳ Cooldown active: Please wait ${cooldownRemaining}s before sending another.`);
        setStatus("error");
        return;
      }

      // 4. Strix Hourly Rate Limit Defense
      const hourlyDispatches = getRecentDispatchesCount();
      if (hourlyDispatches >= MAX_HOURLY_DISPATCHES) {
        setErrorMessage(`⚠️ Hourly limit reached (${MAX_HOURLY_DISPATCHES}/hr). Please try again in a bit or email directly.`);
        setStatus("error");
        return;
      }

      // 5. Input Validation & Sanitization
      const cleanMessage = message.replace(/<[^>]*>?/gm, "").trim();
      if (!cleanMessage) {
        setErrorMessage("Please enter your message or idea.");
        setStatus("error");
        return;
      }

      const cleanName = name.replace(/<[^>]*>?/gm, "").trim();
      const cleanEmail = email.replace(/<[^>]*>?/gm, "").trim();

      // Save user identity in localStorage for convenience
      try {
        if (cleanName) localStorage.setItem("stackr_game:feedback_name", cleanName);
        if (cleanEmail) localStorage.setItem("stackr_game:feedback_email", cleanEmail);
      } catch {}

      setStatus("submitting");
      setErrorMessage("");

      // Compose full payload
      let finalBody = `Category: ${currentCategory.label}\n\n`;
      finalBody += `Message:\n${cleanMessage}\n\n`;
      if (includeStats && stats) {
        finalBody += `--- Stacker Game Context ---\n`;
        if (typeof stats.score === "number") finalBody += `Current Score: ${stats.score}\n`;
        if (typeof stats.best === "number") finalBody += `High Score: ${stats.best}\n`;
        if (typeof stats.blocks === "number") finalBody += `Blocks Stacked: ${stats.blocks}\n`;
      }
      finalBody += `Screen: ${window.innerWidth}x${window.innerHeight} (${navigator.userAgent.slice(0, 80)})\n`;

      try {
        const res = await fetch("https://api.web3forms.com/submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            access_key: WEB3FORMS_KEY,
            subject: `${currentCategory.subjectPrefix}: ${cleanName || "Anonymous Player"}`,
            from_name: cleanName || "Stacker Player",
            replyto: cleanEmail || undefined,
            name: cleanName || "Anonymous",
            email: cleanEmail || "noreply@stackr-game.local",
            message: finalBody,
            botcheck: false,
          }),
        });

        const data = await res.json();
        if (data.success) {
          recordDispatchTimestamp();
          try {
            localStorage.setItem("stackr_game:feedback_last_ts", Date.now().toString());
          } catch {}
          setCooldownRemaining(COOLDOWN_SECONDS);
          setStatus("success");

          // Celebratory confetti burst
          try {
            confetti({
              particleCount: 50,
              spread: 60,
              origin: { y: 0.5 },
              colors: ["#a8ff3e", "#ffc857", "#53d8ff", "#ff5e5b"],
            });
          } catch {}
        } else {
          throw new Error(data.message || "Failed to dispatch feedback.");
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Could not send. Check your connection or use the direct email link below.");
        setStatus("error");
      }
    },
    [botcheck, decoyGotcha, cooldownRemaining, message, name, email, currentCategory, includeStats, stats]
  );

  const copyDraft = useCallback(() => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[rgba(5,8,15,0.78)] p-3 backdrop-blur-sm sm:p-5"
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 14 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 14 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="panel relative my-auto w-full max-w-lg overflow-hidden border-[3px] border-ink bg-deep p-4 text-white shadow-[7px_7px_0_#05080f] sm:p-6"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b-2 border-line pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center border-2 border-ink bg-amber shadow-[3px_3px_0_#05080f]">
                <Flame className="h-6 w-6 text-ink" />
              </div>
              <div>
                <h3 className="font-display text-2xl leading-none text-white sm:text-3xl">
                  SUGGEST & FEEDBACK
                </h3>
                <p className="mt-1 font-mono text-[10px] tracking-[0.14em] text-white/50">
                  SHAPE THE NEXT STACKER UPDATE // SENT DIRECTLY TO ABHISHEK
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="iconbtn h-9 w-9 border-2 border-ink bg-[#142336] hover:bg-coral hover:text-ink"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Success State */}
          {status === "success" ? (
            <div className="py-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center border-3 border-ink bg-lime text-ink shadow-[4px_4px_0_#05080f]">
                <Check className="h-8 w-8 stroke-[3]" />
              </div>
              <h4 className="mt-4 font-display text-2xl text-lime sm:text-3xl">DISPATCH RECEIVED!</h4>
              <p className="mt-2 text-xs font-semibold text-white/70">
                Thanks for the input! Abhishek reviews all game ideas and glitch reports to keep Stacker crisp.
              </p>
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setMessage("");
                    setStatus("idle");
                    onClose();
                  }}
                  className="btn btn-amber px-6 py-2.5 text-base font-bold"
                >
                  BACK TO THE TOWER
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
              {/* Category Selector Tabs */}
              <div>
                <label className="block text-[11px] font-bold tracking-[0.18em] text-cyanx">
                  SELECT CATEGORY
                </label>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = cat.id === activeCategory;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setActiveCategory(cat.id);
                          setErrorMessage("");
                        }}
                        className={`flex flex-col items-center justify-center gap-1 border-2 p-2 text-center transition-all ${
                          isSelected
                            ? "border-ink bg-amber text-ink shadow-[3px_3px_0_#05080f]"
                            : "border-line bg-[#0c1827] text-white/70 hover:border-amber/50 hover:text-white"
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${isSelected ? "text-ink" : "text-amber"}`} />
                        <span className="font-display text-[11px] leading-tight sm:text-xs">
                          {cat.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[11px] font-medium text-white/50">{currentCategory.hint}</p>
              </div>

              {/* Quick Template Chips */}
              <div>
                <span className="text-[10px] font-bold tracking-[0.16em] text-white/45">
                  QUICK IDEAS (TAP TO INSERT):
                </span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {currentCategory.templates.map((tpl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setMessage(tpl.text)}
                      className="border border-line bg-[#0f2136] px-2 py-0.5 text-[10.5px] font-semibold text-cyanx/90 hover:border-amber hover:text-amber"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Box */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold tracking-[0.18em] text-cyanx">
                    YOUR MESSAGE <span className="text-coral">*</span>
                  </label>
                  <span className="font-mono text-[10px] text-white/40">
                    {message.length} / 1000
                  </span>
                </div>
                <textarea
                  required
                  rows={3}
                  maxLength={1000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={currentCategory.placeholder}
                  className="mt-1 w-full border-2 border-line bg-[#08111e] p-2.5 font-body text-xs text-white placeholder-white/30 transition-colors focus:border-amber focus:outline-none"
                />
              </div>

              {/* Optional Name & Email row */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="text-[10.5px] font-bold tracking-[0.16em] text-white/60">
                    NAME / GAMERTAG (OPTIONAL)
                  </label>
                  <input
                    type="text"
                    maxLength={50}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. NeoStacker"
                    className="mt-1 w-full border-2 border-line bg-[#08111e] px-2.5 py-1.5 text-xs text-white placeholder-white/30 focus:border-amber focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10.5px] font-bold tracking-[0.16em] text-white/60">
                    EMAIL (FOR REPLIES, OPTIONAL)
                  </label>
                  <input
                    type="email"
                    maxLength={80}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. you@domain.com"
                    className="mt-1 w-full border-2 border-line bg-[#08111e] px-2.5 py-1.5 text-xs text-white placeholder-white/30 focus:border-amber focus:outline-none"
                  />
                </div>
              </div>

              {/* Game Stats Context checkbox */}
              {stats && (
                <div className="flex items-center gap-2 border border-line/60 bg-[#091423] p-2">
                  <input
                    type="checkbox"
                    id="includeStats"
                    checked={includeStats}
                    onChange={(e) => setIncludeStats(e.target.checked)}
                    className="accent-amber"
                  />
                  <label htmlFor="includeStats" className="cursor-pointer text-[11px] text-white/70">
                    Include current run stats (Score: {stats.score ?? 0}, Best: {stats.best ?? 0}, Blocks: {stats.blocks ?? 0})
                  </label>
                </div>
              )}

              {/* STRIX DEFENSIVE HONEYPOTS (Hidden from humans & screen readers) */}
              <div className="hidden" aria-hidden="true">
                <label>
                  Do not check this box:
                  <input
                    type="checkbox"
                    name="botcheck"
                    checked={botcheck}
                    onChange={(e) => setBotcheck(e.target.checked)}
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </label>
                <label>
                  Decoy field:
                  <input
                    type="text"
                    name="_gotcha"
                    value={decoyGotcha}
                    onChange={(e) => setDecoyGotcha(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </label>
              </div>

              {/* Error Banner */}
              {errorMessage && (
                <div className="flex items-center gap-2 border border-coral/60 bg-coral/10 p-2 text-xs text-coral">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Cooldown Active Banner */}
              {cooldownRemaining > 0 && (
                <div className="border border-amber/40 bg-amber/10 p-2 text-[11px] text-amber">
                  ⏳ Cooldown in effect ({cooldownRemaining}s). Anti-spam protection active.
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <div className="flex items-center gap-2">
                  {message.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={copyDraft}
                      className="border border-line bg-[#0a1524] px-2.5 py-1.5 text-xs text-white/70 hover:text-white"
                      title="Copy draft"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-lime" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={status === "submitting" || cooldownRemaining > 0 || !message.trim()}
                    className="btn btn-amber px-5 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {status === "submitting" ? (
                      <span>SENDING...</span>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        <span>SEND FEEDBACK</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Direct Mailto Fallback */}
              <div className="border-t border-line/40 pt-2 text-center">
                <span className="font-mono text-[10px] text-white/40">
                  Trouble with the form? Email directly to{" "}
                  <a
                    href={`mailto:${DIRECT_EMAIL}?subject=${encodeURIComponent(
                      `${currentCategory.subjectPrefix}: Stacker Feedback`
                    )}&body=${encodeURIComponent(message)}`}
                    className="font-bold text-amber underline hover:text-white"
                  >
                    {DIRECT_EMAIL}
                  </a>
                </span>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
