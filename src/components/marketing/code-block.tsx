/**
 * Styled code block for documentation pages.
 * Renders a <pre><code> block with monospace font, distinct background,
 * and optional language label.
 */
export function CodeBlock({
  children,
  label,
}: {
  children: string;
  label?: string;
}) {
  return (
    <div className="v2-code-block not-prose my-4 overflow-hidden rounded-lg border border-[var(--v2-border)]">
      {label && (
        <div className="border-b border-[var(--v2-border)] bg-[var(--v2-bg-surface)] px-4 py-1.5">
          <span className="font-[family-name:var(--font-geist-mono)] text-xs font-medium text-[var(--v2-text-tertiary)]">
            {label}
          </span>
        </div>
      )}
      <pre className="max-w-full overflow-x-auto bg-[var(--v2-code-bg)] p-4">
        <code className="whitespace-pre font-[family-name:var(--font-geist-mono)] text-xs leading-relaxed text-[var(--v2-code-text)] sm:text-sm">
          {children}
        </code>
      </pre>
    </div>
  );
}

/**
 * Inline code span with distinct styling.
 * Use inside prose content for API paths, parameter names, etc.
 */
export function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="not-prose rounded bg-[var(--v2-accent-muted)] px-1.5 py-0.5 font-[family-name:var(--font-geist-mono)] text-sm font-medium text-[var(--v2-accent-light)]">
      {children}
    </code>
  );
}
