export function parseSseEvent(rawEvent: string) {
  const data = rawEvent
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n")
    .trim();
  if (!data) {
    return null;
  }
  if (data === "[DONE]") {
    return { done: true, content: "" };
  }
  const json = JSON.parse(data) as {
    choices?: Array<{
      delta?: {
        content?: string | Array<{ text?: string; type?: string }>;
        reasoning?: string | Array<{ text?: string; type?: string }>;
        thinking?: string | Array<{ text?: string; type?: string }>;
      };
      message?: {
        content?: string | Array<{ text?: string; type?: string }>;
        reasoning?: string | Array<{ text?: string; type?: string }>;
        thinking?: string | Array<{ text?: string; type?: string }>;
      };
      finish_reason?: string | null;
    }>;
  };
  const choice = json.choices?.[0];
  return {
    done: choice?.finish_reason != null,
    content: extractContentString(choice?.delta?.content ?? choice?.message?.content),
    reasoning: extractReasoningString(choice),
  };
}

export function extractContentString(content: string | Array<{ text?: string; type?: string }> | undefined) {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map((part) => part.text ?? "").join("");
  }
  return "";
}

export function extractReasoningString(
  choice:
    | {
        delta?: {
          reasoning?: string | Array<{ text?: string; type?: string }>;
          thinking?: string | Array<{ text?: string; type?: string }>;
        };
        message?: {
          reasoning?: string | Array<{ text?: string; type?: string }>;
          thinking?: string | Array<{ text?: string; type?: string }>;
        };
      }
    | undefined,
) {
  return extractContentString(
    choice?.delta?.reasoning ?? choice?.delta?.thinking ?? choice?.message?.reasoning ?? choice?.message?.thinking,
  );
}

export function completedTokenCount(completion: string, tokenCount: number) {
  const trailing = completion.at(-1) ?? "";
  if (!trailing || /\s/.test(trailing) || /[.,!?;:)\]"'`]/.test(trailing)) {
    return tokenCount;
  }
  return Math.max(0, tokenCount - 1);
}

export function resolveBackendThinkSetting(rawValue: string | undefined, provider: string) {
  const trimmed = rawValue?.trim();
  if (!trimmed) {
    return provider === "ollama" ? false : undefined;
  }
  const normalized = trimmed.toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return trimmed;
}
