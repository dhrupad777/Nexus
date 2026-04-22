"use client";

import { useRouter } from "next/navigation";
import { motion, type Variants } from "framer-motion";

const card: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, delay: 0.05 + i * 0.08, ease: [0.22, 1, 0.36, 1] },
  }),
};

export function EntitySelector() {
  const router = useRouter();

  return (
    <div className="selector-shell">
      <header className="selector-heading">
        <span className="hero-eyebrow" style={{ alignSelf: "center" }}>Step 1 of 2</span>
        <h1 className="selector-title">Who are you registering?</h1>
        <p className="muted-text">
          Only NGOs and organizations can join Nexus. Individuals cannot register.
          Pick the one that fits you.
        </p>
      </header>

      <div className="selector-grid">
        <motion.button
          custom={0}
          variants={card}
          initial="hidden"
          animate="show"
          whileHover={{ scale: 1.025 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className="selector-card"
          onClick={() => router.push("/onboard/chat?type=NGO")}
        >
          <span className="selector-icon" aria-hidden>🌱</span>
          <h3>NGO</h3>
          <p>
            Non-profit, charitable trust, or society. You&apos;ll verify with
            80G / 12A / PAN / Registration Certificate.
          </p>
          <span className="btn btn-primary" style={{ marginTop: "auto" }}>
            I&apos;m an NGO →
          </span>
        </motion.button>

        <motion.button
          custom={1}
          variants={card}
          initial="hidden"
          animate="show"
          whileHover={{ scale: 1.025 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className="selector-card"
          onClick={() => router.push("/onboard/chat?type=ORG")}
        >
          <span className="selector-icon" aria-hidden>🏢</span>
          <h3>Organization</h3>
          <p>
            Company, hospital, manufacturer, or service provider. You&apos;ll
            verify with GST / CIN / PAN.
          </p>
          <span className="btn btn-primary" style={{ marginTop: "auto" }}>
            We&apos;re an ORG →
          </span>
        </motion.button>
      </div>
    </div>
  );
}
