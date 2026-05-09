import { CopyButton } from "@/components/ui/copy-button";

interface AgentPromptBoxProps {
  promptText: string;
}

export function AgentPromptBox({ promptText }: AgentPromptBoxProps) {
  return (
    <div
      className="v2-code-block overflow-hidden rounded-lg border border-[var(--v2-accent-border)] bg-[var(--v2-code-bg)]"
      style={{
        boxShadow:
          "0 0 24px rgba(53, 242, 208, 0.08), 0 0 48px rgba(182, 244, 74, 0.04)",
      }}
    >
      <div className="flex items-center gap-2 border-b border-[var(--v2-border-subtle)] bg-[var(--v2-bg-surface)] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#3A3530]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#3A3530]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#3A3530]" />
        <span className="ml-2 font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-widest text-[var(--v2-text-tertiary)]">
          agent prompt
        </span>
        <CopyButton
          text={promptText}
          size="sm"
          variant="ghost"
          className="ml-auto h-7 rounded-md border border-[var(--v2-border)] px-2.5 text-xs text-[var(--v2-text-secondary)] hover:bg-[var(--v2-accent-soft)] hover:text-[var(--v2-text)]"
        />
      </div>
      <div className="p-5 md:p-6">
        <code className="block font-[family-name:var(--font-geist-mono)] text-sm leading-relaxed text-[var(--v2-code-text)] md:text-base">
          <span className="select-none text-[var(--v2-text-tertiary)]">
            {">"}{" "}
          </span>
          {promptText}
        </code>
      </div>
    </div>
  );
}
