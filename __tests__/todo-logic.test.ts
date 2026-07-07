// Pure todo logic extracted from page.tsx — no imports from the app needed.

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  category?: string;
}

function addTodo(todos: Todo[], text: string, id: string): Todo[] {
  return [...todos, { id, text, completed: false }];
}

function completeTodo(todos: Todo[], id: string, completed: boolean): Todo[] {
  return todos.map((t) => (t.id === id ? { ...t, completed } : t));
}

function deleteTodo(todos: Todo[], id: string): Todo[] {
  return todos.filter((t) => t.id !== id);
}

function categorizeTodos(todos: Todo[], ids: string[], category: string): Todo[] {
  const idSet = new Set(ids);
  return todos.map((t) => (idSet.has(t.id) ? { ...t, category } : t));
}

function ungroupTodos(todos: Todo[], ids: string[]): Todo[] {
  const idSet = new Set(ids);
  return todos.map((t) => {
    if (!idSet.has(t.id)) return t;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { category: _cat, ...rest } = t;
    return rest;
  });
}

interface ParsedReply {
  action: string;
  ids: string[] | null;
  items: string[] | null;
  category: string | null;
  message: string;
}

function parseClaudeReply(raw: string): ParsedReply {
  const fallback: ParsedReply = { action: "none", ids: null, items: null, category: null, message: raw };
  try {
    const parsed = JSON.parse(raw);
    return {
      action: parsed.action ?? "none",
      ids: Array.isArray(parsed.ids) ? parsed.ids : null,
      items: Array.isArray(parsed.items) ? parsed.items : null,
      category: typeof parsed.category === "string" ? parsed.category : null,
      message: parsed.message ?? raw,
    };
  } catch {
    return fallback;
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

const BASE_TODOS: Todo[] = [
  { id: "1", text: "Buy milk", completed: false },
  { id: "2", text: "Walk dog", completed: false },
  { id: "3", text: "Read book", completed: true },
];

describe("addTodo", () => {
  it("increases the list length by 1", () => {
    const result = addTodo(BASE_TODOS, "New task", "4");
    expect(result).toHaveLength(BASE_TODOS.length + 1);
  });

  it("appends a todo with the correct text and completed: false", () => {
    const result = addTodo(BASE_TODOS, "New task", "4");
    expect(result[result.length - 1]).toMatchObject({ id: "4", text: "New task", completed: false });
  });
});

describe("completeTodo", () => {
  it("marks the specified todo as completed", () => {
    const result = completeTodo(BASE_TODOS, "1", true);
    expect(result.find((t) => t.id === "1")?.completed).toBe(true);
  });

  it("marks a completed todo as uncompleted", () => {
    const result = completeTodo(BASE_TODOS, "3", false);
    expect(result.find((t) => t.id === "3")?.completed).toBe(false);
  });

  it("does not affect other todos", () => {
    const result = completeTodo(BASE_TODOS, "1", true);
    expect(result.find((t) => t.id === "2")?.completed).toBe(false);
  });
});

describe("deleteTodo", () => {
  it("removes the todo with the given id", () => {
    const result = deleteTodo(BASE_TODOS, "2");
    expect(result.find((t) => t.id === "2")).toBeUndefined();
  });

  it("decreases the list length by 1", () => {
    const result = deleteTodo(BASE_TODOS, "2");
    expect(result).toHaveLength(BASE_TODOS.length - 1);
  });

  it("leaves other todos intact", () => {
    const result = deleteTodo(BASE_TODOS, "2");
    expect(result.map((t) => t.id)).toEqual(["1", "3"]);
  });
});

describe("categorizeTodos", () => {
  it("assigns a category to the specified ids", () => {
    const result = categorizeTodos(BASE_TODOS, ["1", "2"], "Errands");
    expect(result.find((t) => t.id === "1")?.category).toBe("Errands");
    expect(result.find((t) => t.id === "2")?.category).toBe("Errands");
  });

  it("does not affect todos not in the ids list", () => {
    const result = categorizeTodos(BASE_TODOS, ["1"], "Errands");
    expect(result.find((t) => t.id === "3")?.category).toBeUndefined();
  });
});

describe("ungroupTodos", () => {
  it("removes the category from specified ids", () => {
    const categorized = categorizeTodos(BASE_TODOS, ["1", "2"], "Errands");
    const result = ungroupTodos(categorized, ["1"]);
    expect(result.find((t) => t.id === "1")?.category).toBeUndefined();
  });

  it("leaves the category on todos not in the ids list", () => {
    const categorized = categorizeTodos(BASE_TODOS, ["1", "2"], "Errands");
    const result = ungroupTodos(categorized, ["1"]);
    expect(result.find((t) => t.id === "2")?.category).toBe("Errands");
  });
});

describe("parseClaudeReply", () => {
  it("parses a complete action correctly", () => {
    const result = parseClaudeReply('{"action":"complete","ids":["123"],"message":"Done"}');
    expect(result.action).toBe("complete");
    expect(result.ids).toEqual(["123"]);
    expect(result.message).toBe("Done");
  });

  it("parses an add action with items", () => {
    const result = parseClaudeReply('{"action":"add","items":["Buy milk"],"message":"Adding..."}');
    expect(result.action).toBe("add");
    expect(result.items).toEqual(["Buy milk"]);
    expect(result.ids).toBeNull();
  });

  it("parses a none action", () => {
    const result = parseClaudeReply('{"action":"none","message":"Sure thing"}');
    expect(result.action).toBe("none");
    expect(result.ids).toBeNull();
    expect(result.items).toBeNull();
    expect(result.message).toBe("Sure thing");
  });

  it("falls back gracefully on invalid JSON", () => {
    const raw = "not valid json";
    const result = parseClaudeReply(raw);
    expect(result.action).toBe("none");
    expect(result.message).toBe(raw);
  });
});
