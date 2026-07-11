import Link from "next/link";

export default function Navigation() {
  return (
    <div
      style={{
        borderBottom: "1px solid var(--border)",
        padding: "14px 40px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        position: "relative",
        zIndex: 2,
        background: "linear-gradient(180deg, rgba(20,10,10,1) 0%, rgba(15,15,20,1) 100%)",
      }}
    >
      <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
        <span className="title" style={{ fontSize: "20px", letterSpacing: "4px" }}>
          THE MMA FORMULA
        </span>
      </Link>
      <div style={{ display: "flex", gap: "32px" }}>
        {["Events", "Fighters", "History"].map((page) => (
          <Link
            key={page}
            href={`/${page.toLowerCase()}`}
            style={{
              fontSize: "11px",
              letterSpacing: "3px",
              color: "var(--muted)",
              textDecoration: "none",
              textTransform: "uppercase",
            }}
          >
            {page}
          </Link>
        ))}
      </div>
    </div>
  );
}
