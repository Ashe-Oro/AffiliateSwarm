import { CopyButton } from "@/components/ui/copy-button";

interface AgentPromptBoxProps {
  promptText: string;
}

export function AgentPromptBox({ promptText }: AgentPromptBoxProps) {
  return (
    <div
      className="v2-code-block overflow-hidden rounded-lg border border-[rgba(255,181,71,0.2)] bg-[var(--v2-code-bg)]"
      style={{
        boxShadow:
          "0 0 24px rgba(255, 181, 71, 0.06), 0 0 48px rgba(255, 181, 71, 0.03)",
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
          className="ml-auto h-7 rounded-md border border-[rgba(255,181,71,0.16)] px-2.5 text-xs text-[var(--v2-text-secondary)] hover:bg-[rgba(255,181,71,0.08)] hover:text-[var(--v2-text)]"
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
