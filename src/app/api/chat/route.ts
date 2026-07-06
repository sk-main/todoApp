import { NextRequest, NextResponse } from "next/server";
import { askClaude } from "../../../../lib/claude";

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  category?: string;
}

interface ChatRequest {
  messages: { role: "user" | "assistant"; content: string }[];
  todos: Todo[];
}

export async function POST(req: NextRequest) {
  try {
    const { messages, todos }: ChatRequest = await req.json();

    const todoList =
      todos.length === 0
        ? "No todos yet."
        : todos
            .map((t) => {
              const cat = t.category ? ` [category: ${t.category}]` : "";
              return `- [${t.completed ? "x" : " "}] (id: ${t.id})${cat} ${t.text}`;
            })
            .join("\n");

    const systemPrompt = `You are a helpful todo list assistant. You help the user manage and think through their tasks.

Current todos:
${todoList}

You MUST always respond with a JSON object in exactly this format — no exceptions, no extra text:
{"action": "complete"|"uncomplete"|"delete"|"add"|"categorize"|"ungroup"|"delete_group"|"none", "ids": ["todo-ids"], "items": ["todo text strings, for add only"], "category": "Category Name, for categorize only", "message": "human readable response"}

Rules:
- "add": include an "items" array of strings (the new todo texts). The "message" should briefly list what will be added.
- "complete": include an "ids" array of todo ids to mark as done.
- "uncomplete": include an "ids" array of todo ids to unmark.
- "delete": include an "ids" array of todo ids to remove. Requires user confirmation — the "message" should say what will be deleted.
- "categorize": include an "ids" array and a "category" string. Used to assign or move items to a category — whether they are currently ungrouped or already in a different group. The "ids" array can span multiple existing groups. Use a single "categorize" action for requests like "move X and Y to Groceries", including all relevant ids at once.
- "ungroup": include an "ids" array. Removes the category from those todos but keeps them in the list.
- "delete_group": include an "ids" array of todos to delete entirely (used for group deletion). Requires user confirmation — the "message" should say what will be deleted.
- "none": for regular conversation. "ids", "items", and "category" should be omitted or null.
- Always use exact todo ids from the list above. Never invent ids.
- The "message" field is what the user sees — keep it concise and natural.
- Never wrap the JSON in markdown or code blocks. Output raw JSON only.`;

    const reply = await askClaude(messages, systemPrompt);

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
