import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const ANTHROPIC_HEADERS: Record<string, string> = {
  "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
  "anthropic-version": "2023-06-01",
  "anthropic-beta": "files-api-2025-04-14",
};

async function deleteRemoteFile(fileId: string) {
  try {
    await fetch(`https://api.anthropic.com/v1/files/${fileId}`, {
      method: "DELETE",
      headers: ANTHROPIC_HEADERS,
    });
  } catch {
    // ignore — stale or already deleted
  }
}

export async function GET() {
  try {
    const [todos, fileId] = await Promise.all([
      redis.get("todos"),
      redis.get<string>("todos-file-id"),
    ]);
    return NextResponse.json({ todos: todos ?? [], fileId: fileId ?? null });
  } catch (error) {
    console.error("GET /api/todos error:", error);
    return NextResponse.json({ todos: [], fileId: null }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { todos } = await req.json();

    await redis.set("todos", todos);

    // Delete previous file if one exists
    const prevFileId = await redis.get<string>("todos-file-id");
    if (prevFileId) {
      await deleteRemoteFile(prevFileId);
    }

    // Upload new todos file
    const buffer = Buffer.from(JSON.stringify(todos));
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([buffer], { type: "text/plain" }),
      "todos.json"
    );

    const uploadRes = await fetch("https://api.anthropic.com/v1/files", {
      method: "POST",
      headers: ANTHROPIC_HEADERS,
      body: formData,
    });

    if (uploadRes.ok) {
      const uploaded = await uploadRes.json();
      await redis.set("todos-file-id", uploaded.id);
    } else {
      console.error("Files API upload failed:", await uploadRes.text());
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/todos error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
