export type SkipLinkProps = { targetId: string; text: string };

/** First focusable element on every page (SRS 5.1). Hidden until focused. */
export function SkipLink({ targetId, text }: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:inset-x-0 focus:top-0 focus:z-50 focus:block focus:bg-navy focus:px-4 focus:py-2 focus:text-center focus:font-semibold focus:text-white"
      onClick={(e) => {
        // Move focus into the target so the next Tab continues from there.
        const target = document.getElementById(targetId);
        if (target) {
          e.preventDefault();
          if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
          target.focus();
          target.scrollIntoView({ block: 'start' });
        }
      }}
    >
      {text}
    </a>
  );
}
