export function NexusLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const fontSize = size === "lg" ? "clamp(72px, 12vw, 136px)" : size === "sm" ? "22px" : "clamp(56px, 11vw, 120px)";
  return (
    <span
      className="home-logo"
      style={{ fontSize }}
      aria-label="Nexus"
    >
      nexus<span className="home-logo-dot">.</span>
    </span>
  );
}
