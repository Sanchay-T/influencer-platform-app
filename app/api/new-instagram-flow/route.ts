import { NextResponse } from "next/server";
import { buildInstagramFeed } from "@/lib/services/instagram-feed";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { keyword } = await request.json();
    const targetKeyword = typeof keyword === "string" && keyword.trim().length > 0 ? keyword.trim() : "nutritionists";
    const result = await buildInstagramFeed(targetKeyword);
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
