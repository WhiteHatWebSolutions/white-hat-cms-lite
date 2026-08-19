import type { ReactNode } from "react";

type SectionCardProps = {
  children: ReactNode;
  className?: string;
  eyebrow?: string;
  id?: string;
  title?: string;
};

export function SectionCard({
  children,
  className = "",
  eyebrow,
  id,
  title,
}: SectionCardProps) {
  return (
    <section className={`section-card ${className}`.trim()} id={id}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  );
}
