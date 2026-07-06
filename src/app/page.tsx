"use client";

import { useState, useRef, useEffect } from "react";

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  category?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingTodos, setPendingTodos] = useState<string[] | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);
  const [pendingCategorize, setPendingCategorize] = useState<{ ids: string[]; category: string } | null>(null);
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<string[] | null>(null);
  const [showGroupPanel, setShowGroupPanel] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupSelected, setGroupSelected] = useState<Set<string>>(new Set());
  const [isLoadingTodos, setIsLoadingTodos] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Load todos on mount
  useEffect(() => {
    setIsLoadingTodos(true);
    fetch("/api/todos")
      .then((r) => r.json())
      .then((data) => setTodos(data.todos ?? []))
      .catch(() => {})
      .finally(() => setIsLoadingTodos(false));
  }, []);

  // Persist todos whenever they change
  useEffect(() => {
    if (isLoadingTodos) return;
    fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ todos }),
    }).catch(() => {});
  }, [todos]); // eslint-disable-line react-hooks/exhaustive-deps

  async function applySuggestionReply(data: { reply: string }, label: string) {
    console.log(`${label} response:`, data.reply);
    try {
      const parsed = JSON.parse(data.reply);
      if (
        parsed.action === "categorize" &&
        Array.isArray(parsed.ids) &&
        parsed.ids.length > 0 &&
        typeof parsed.category === "string"
      ) {
        setPendingCategorize({ ids: parsed.ids, category: parsed.category });
        return true;
      } else if (parsed.action === "none") {
        console.log(`${label}: no suggestion needed`);
      }
    } catch {
      // silently ignore parse errors
    }
    return false;
  }

  async function checkForExistingGroupSuggestion(currentTodos: Todo[]) {
    if (pendingCategorize) return;

    const ungroupedTodos = currentTodos.filter((t) => !t.category);
    if (ungroupedTodos.length === 0) return;

    const existingCategories = Array.from(new Set(
      currentTodos.map((t) => t.category).filter((c): c is string => !!c)
    ));
    if (existingCategories.length === 0) return;

    const latestUngrouped = ungroupedTodos[ungroupedTodos.length - 1];
    console.log("checkForExistingGroupSuggestion called for:", latestUngrouped.text);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: `Does this todo: "${latestUngrouped.text}" clearly fit into any of these existing categories: ${existingCategories.join(", ")}? If yes return categorize with just that todo's id and the matching category. If not a clear fit, return none.` }],
          todos: currentTodos,
        }),
      });
      const data = await res.json();
      await applySuggestionReply(data, "existingGroup");
    } catch {
      // silently ignore network errors
    }
  }

  async function checkForNewGroupSuggestion(currentTodos: Todo[]) {
    if (pendingCategorize) return;

    const ungroupedTodos = currentTodos.filter((t) => !t.category);
    if (ungroupedTodos.length < 3) return;
    console.log("checkForNewGroupSuggestion called, ungrouped count:", ungroupedTodos.length);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Do 3 or more of these ungrouped todos belong together in a new category? If yes return categorize with all their ids and a new category name. Minimum 2 ids. If no clear pattern, return none." }],
          todos: ungroupedTodos,
        }),
      });
      const data = await res.json();
      await applySuggestionReply(data, "newGroup");
    } catch {
      // silently ignore network errors
    }
  }

  async function checkForGroupSuggestions(currentTodos: Todo[]) {
    await checkForExistingGroupSuggestion(currentTodos);
    if (!pendingCategorize) {
      await checkForNewGroupSuggestion(currentTodos);
    }
  }

  function addTodo() {
    const text = inputText.trim();
    if (!text) return;
    const newTodo = { id: crypto.randomUUID(), text, completed: false };
    const newTodos = [...todos, newTodo];
    setTodos(newTodos);
    setInputText("");
    checkForGroupSuggestions(newTodos);
  }

  function toggleTodo(id: string) {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  }

  function deleteTodo(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }

  function ungroupIds(ids: string[]) {
    const idSet = new Set(ids);
    setTodos((prev) =>
      prev.map((t) => {
        if (!idSet.has(t.id)) return t;
        const { category: _cat, ...rest } = t;
        return rest;
      })
    );
  }

  function addTodosFromChat(items: string[]) {
    const newTodos = [
      ...todos,
      ...items.map((text) => ({ id: crypto.randomUUID(), text, completed: false })),
    ];
    setTodos(newTodos);
    setPendingTodos(null);
    checkForGroupSuggestions(newTodos);
  }

  async function sendMessage() {
    const text = chatInput.trim();
    if (!text || isLoading) return;

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(newMessages);
    setChatInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, todos }),
      });
      const data = await res.json();

      let action: string = "none";
      let ids: string[] | null = null;
      let items: string[] | null = null;
      let category: string | null = null;
      let message: string = data.reply ?? data.error ?? "Error";

      try {
        const parsed = JSON.parse(data.reply);
        action = parsed.action ?? "none";
        ids = Array.isArray(parsed.ids) ? parsed.ids : null;
        items = Array.isArray(parsed.items) ? parsed.items : null;
        category = typeof parsed.category === "string" ? parsed.category : null;
        message = parsed.message ?? message;
      } catch {
        // reply wasn't JSON — show it as-is
      }

      if (action === "add" && items && items.length > 0) {
        setPendingTodos(items);
      } else if (action === "delete" && ids && ids.length > 0) {
        setPendingDelete(ids);
      } else if (action === "categorize" && ids && ids.length > 0 && category) {
        setPendingCategorize({ ids, category });
      } else if (action === "ungroup" && ids && ids.length > 0) {
        ungroupIds(ids);
      } else if (action === "delete_group" && ids && ids.length > 0) {
        setPendingDeleteGroup(ids);
      } else if (ids && ids.length > 0) {
        const idSet = new Set(ids);
        if (action === "complete") {
          setTodos((prev) =>
            prev.map((t) => (idSet.has(t.id) ? { ...t, completed: true } : t))
          );
        } else if (action === "uncomplete") {
          setTodos((prev) =>
            prev.map((t) => (idSet.has(t.id) ? { ...t, completed: false } : t))
          );
        }
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: message },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  // Group todos: categories in insertion order, ungrouped at the end
  const categoryOrder: string[] = [];
  const byCategory: Record<string, Todo[]> = {};
  const ungrouped: Todo[] = [];

  for (const todo of todos) {
    if (todo.category) {
      if (!byCategory[todo.category]) {
        byCategory[todo.category] = [];
        categoryOrder.push(todo.category);
      }
      byCategory[todo.category].push(todo);
    } else {
      ungrouped.push(todo);
    }
  }

  function TodoItem({ todo }: { todo: Todo }) {
    return (
      <li className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2.5">
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={() => toggleTodo(todo.id)}
          className="accent-neutral-400 w-4 h-4 flex-shrink-0 cursor-pointer"
        />
        <span
          className={`flex-1 text-sm ${
            todo.completed ? "line-through text-neutral-500" : "text-neutral-100"
          }`}
        >
          {todo.text}
        </span>
        <button
          onClick={() => deleteTodo(todo.id)}
          className="text-neutral-600 hover:text-neutral-400 text-xs transition-colors"
        >
          ✕
        </button>
      </li>
    );
  }

  function ConfirmBox({
    title,
    items,
    borderClass = "border-neutral-700",
    confirmClass = "bg-neutral-600 hover:bg-neutral-500",
    onConfirm,
    onCancel,
  }: {
    title: string;
    items: string[];
    borderClass?: string;
    confirmClass?: string;
    onConfirm: () => void;
    onCancel: () => void;
  }) {
    return (
      <div className={`bg-neutral-900 border ${borderClass} rounded-lg px-4 py-3 text-sm flex flex-col gap-2`}>
        <span className="text-neutral-300">{title}</span>
        <ul className="flex flex-col gap-1 pl-1">
          {items.map((item, i) => (
            <li key={i} className="text-neutral-100 text-sm before:content-['·'] before:mr-2 before:text-neutral-500">
              {item}
            </li>
          ))}
        </ul>
        <div className="flex gap-2 mt-1">
          <button onClick={onConfirm} className={`px-3 py-1.5 rounded-md font-medium transition-colors ${confirmClass}`}>
            Confirm
          </button>
          <button onClick={onCancel} className="px-3 py-1.5 text-neutral-400 hover:text-neutral-200 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="border-b border-neutral-800 px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Todo + Claude</h1>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Left: Todo list */}
        <section className="w-1/2 flex flex-col border-r border-neutral-800 p-6 gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-widest flex-1">
              Todos
            </h2>
            <button
              onClick={() => {
                setShowGroupPanel((v) => !v);
                setGroupName("");
                setGroupSelected(new Set());
              }}
              className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              {showGroupPanel ? "Done" : "Manage Groups"}
            </button>
          </div>

          {/* Manage groups panel */}
          {showGroupPanel && (
            <div className="bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-3 flex flex-col gap-3 text-sm">
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Category name..."
                className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-1.5 text-sm placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
              />
              {todos.length === 0 ? (
                <p className="text-neutral-600 text-xs">No todos to group.</p>
              ) : (
                <ul className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                  {todos.map((todo) => (
                    <li key={todo.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`gp-${todo.id}`}
                        checked={groupSelected.has(todo.id)}
                        onChange={(e) => {
                          setGroupSelected((prev) => {
                            const next = new Set(prev);
                            e.target.checked ? next.add(todo.id) : next.delete(todo.id);
                            return next;
                          });
                        }}
                        className="accent-neutral-400 w-4 h-4 flex-shrink-0 cursor-pointer"
                      />
                      <label htmlFor={`gp-${todo.id}`} className="text-neutral-200 cursor-pointer flex-1 truncate">
                        {todo.text}
                        {todo.category && (
                          <span className="ml-1.5 text-neutral-500 text-xs">{todo.category}</span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <button
                onClick={() => {
                  const name = groupName.trim();
                  if (!name || groupSelected.size === 0) return;
                  setTodos((prev) =>
                    prev.map((t) =>
                      groupSelected.has(t.id) ? { ...t, category: name } : t
                    )
                  );
                  setGroupName("");
                  setGroupSelected(new Set());
                }}
                disabled={!groupName.trim() || groupSelected.size === 0}
                className="self-start px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-md font-medium transition-colors"
              >
                Create Group
              </button>
            </div>
          )}

          {/* Add todo */}
          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTodo()}
              placeholder="Add a task..."
              disabled={isLoadingTodos}
              className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm placeholder-neutral-500 focus:outline-none focus:border-neutral-500 disabled:opacity-50"
            />
            <button
              onClick={addTodo}
              disabled={isLoadingTodos}
              className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
            >
              Add
            </button>
          </div>

          {/* Todo items grouped */}
          <ul className="flex flex-col gap-2 overflow-y-auto flex-1">
            {isLoadingTodos ? (
              <li className="text-sm text-neutral-600 mt-2">Loading...</li>
            ) : todos.length === 0 ? (
              <li className="text-sm text-neutral-600 mt-2">No tasks yet.</li>
            ) : null}

            {categoryOrder.map((cat) => {
              const catTodos = byCategory[cat];
              const catIds = catTodos.map((t) => t.id);
              return (
                <li key={cat}>
                  <div className="flex items-center gap-2 px-1 py-1 mt-1">
                    <span className="text-xs font-medium text-neutral-400 flex-1">
                      📁 {cat}
                    </span>
                    <button
                      onClick={() => ungroupIds(catIds)}
                      className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                    >
                      Ungroup
                    </button>
                    <button
                      onClick={() => setPendingDeleteGroup(catIds)}
                      className="text-xs text-red-700 hover:text-red-500 transition-colors"
                    >
                      Delete group
                    </button>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {catTodos.map((todo) => (
                      <TodoItem key={todo.id} todo={todo} />
                    ))}
                  </ul>
                </li>
              );
            })}

            {ungrouped.length > 0 && (
              <>
                {categoryOrder.length > 0 && (
                  <li className="flex items-center gap-2 px-1 mt-2">
                    <span className="h-px flex-1 bg-neutral-800" />
                    <span className="text-xs text-neutral-600">Other</span>
                    <span className="h-px flex-1 bg-neutral-800" />
                  </li>
                )}
                {ungrouped.map((todo) => (
                  <TodoItem key={todo.id} todo={todo} />
                ))}
              </>
            )}
          </ul>
        </section>

        {/* Right: Chat */}
        <section className="w-1/2 flex flex-col p-6 gap-4">
          <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-widest">
            Chat with Claude
          </h2>

          {/* Message history */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
            {messages.length === 0 && (
              <p className="text-sm text-neutral-600">
                Ask Claude about your tasks...
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-neutral-700 text-neutral-100 rounded-br-sm"
                      : "bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-bl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-neutral-500">
                  Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Confirmation banners */}
          {pendingTodos && (
            <ConfirmBox
              title="Add these items to your list?"
              items={pendingTodos}
              onConfirm={() => addTodosFromChat(pendingTodos)}
              onCancel={() => setPendingTodos(null)}
            />
          )}

          {pendingDelete && (
            <ConfirmBox
              title="Delete these items?"
              items={pendingDelete.map((id) => todos.find((t) => t.id === id)?.text ?? id)}
              borderClass="border-red-900/50"
              confirmClass="bg-red-800 hover:bg-red-700"
              onConfirm={() => {
                const idSet = new Set(pendingDelete);
                setTodos((prev) => prev.filter((t) => !idSet.has(t.id)));
                setPendingDelete(null);
              }}
              onCancel={() => setPendingDelete(null)}
            />
          )}

          {pendingCategorize && (
            <ConfirmBox
              title={`Group these items under "${pendingCategorize.category}"?`}
              items={pendingCategorize.ids.map((id) => todos.find((t) => t.id === id)?.text ?? id)}
              onConfirm={() => {
                const { ids, category } = pendingCategorize;
                const idSet = new Set(ids);
                const updatedTodos = todos.map((t) =>
                  idSet.has(t.id) ? { ...t, category } : t
                );
                setTodos(updatedTodos);
                setPendingCategorize(null);
                setTimeout(() => checkForGroupSuggestions(updatedTodos), 500);
              }}
              onCancel={() => setPendingCategorize(null)}
            />
          )}

          {pendingDeleteGroup && (
            <ConfirmBox
              title="Delete these items permanently?"
              items={pendingDeleteGroup.map((id) => todos.find((t) => t.id === id)?.text ?? id)}
              borderClass="border-red-900/50"
              confirmClass="bg-red-800 hover:bg-red-700"
              onConfirm={() => {
                const idSet = new Set(pendingDeleteGroup);
                setTodos((prev) => prev.filter((t) => !idSet.has(t.id)));
                setPendingDeleteGroup(null);
              }}
              onCancel={() => setPendingDeleteGroup(null)}
            />
          )}

          {/* Chat input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Ask Claude..."
              disabled={isLoading}
              className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm placeholder-neutral-500 focus:outline-none focus:border-neutral-500 disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !chatInput.trim()}
              className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
            >
              Send
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
