import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export async function GET() {
  try {
    const todos = await redis.get("todos");
    return NextResponse.json({ todos: todos ?? [] });
  } catch (error) {
    console.error("GET /api/todos error:", error);
    return NextResponse.json({ todos: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { todos } = await req.json();
    await redis.set("todos", todos);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/todos error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
