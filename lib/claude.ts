import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  defaultHeaders: { "anthropic-beta": "files-api-2025-04-14" },
});

export async function askClaude(
  messages: { role: "user" | "assistant"; content: string }[],
  systemPrompt: string = "You are a helpful assistant.",
  fileId?: string
): Promise<string> {
  const apiMessages: Anthropic.MessageParam[] = messages.map((msg, i) => {
    if (i === 0 && fileId && msg.role === "user") {
      return {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "file", file_id: fileId },
          } as Anthropic.DocumentBlockParam,
          { type: "text", text: msg.content },
        ],
      };
    }
    return msg;
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages: apiMessages,
  });

  const block = response.content.find((b) => b.type === "text");
  return block?.type === "text" ? block.text : "";
}
