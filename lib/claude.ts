import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function askClaude(
  messages: { role: "user" | "assistant"; content: string }[],
  systemPrompt: string = "You are a helpful assistant."
): Promise<string> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  const block = response.content.find((b) => b.type === "text");
  return block?.type === "text" ? block.text : "";
}
