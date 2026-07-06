import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const FILE_ID_PATH = path.join(process.cwd(), ".todos-file-id");
const API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

const ANTHROPIC_HEADERS: Record<string, string> = {
  "x-api-key": API_KEY,
  "anthropic-version": "2023-06-01",
  "anthropic-beta": "files-api-2025-04-14",
};

function readStoredFileId(): string | null {
  try {
    return fs.readFileSync(FILE_ID_PATH, "utf-8").trim() || null;
  } catch {
    return null;
  }
}

function writeStoredFileId(id: string) {
  fs.writeFileSync(FILE_ID_PATH, id, "utf-8");
}

async function deleteRemoteFile(fileId: string) {
  try {
    await fetch(`https://api.anthropic.com/v1/files/${fileId}`, {
      method: "DELETE",
      headers: ANTHROPIC_HEADERS,
    });
  } catch {
    // ignore — stale id, already deleted externally, etc.
  }
}

export async function GET() {
  console.log("GET /api/todos called");
  console.log("FILE_ID_PATH:", FILE_ID_PATH);
  console.log("file exists:", fs.existsSync(FILE_ID_PATH));

  const fileId = readStoredFileId();
  console.log("fileId read:", fileId);

  if (!fileId) {
    return NextResponse.json({ todos: [] });
  }

  try {
    const url = `https://api.anthropic.com/v1/files/${fileId}/content`;
    console.log("fetching:", url);

    const res = await fetch(url, { headers: ANTHROPIC_HEADERS });
    console.log("fetch status:", res.status);

    const text = await res.text();
    console.log("raw content:", text.slice(0, 200));

    if (!res.ok) {
      fs.rmSync(FILE_ID_PATH, { force: true });
      return NextResponse.json({ todos: [] });
    }

    const todos = JSON.parse(text);
    return NextResponse.json({ todos });
  } catch (error) {
    console.error("GET /api/todos error:", error);
    return NextResponse.json({ todos: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { todos } = await req.json();

    // Delete the previous file before uploading a new one
    const oldFileId = readStoredFileId();
    if (oldFileId) {
      await deleteRemoteFile(oldFileId);
    }

    // Upload todos as a JSON file via multipart/form-data
    const buffer = Buffer.from(JSON.stringify(todos));
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([buffer], { type: "text/plain" }),
      "todos.txt"
    );

    const uploadRes = await fetch("https://api.anthropic.com/v1/files", {
      method: "POST",
      headers: ANTHROPIC_HEADERS,
      body: formData,
    });

    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      console.error("Files API upload failed:", text);
      return NextResponse.json({ success: false }, { status: 500 });
    }

    const uploaded = await uploadRes.json();
    writeStoredFileId(uploaded.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/todos error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
