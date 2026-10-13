import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    let filePath = path.join(process.cwd(), "public", "cyber-styling.txt");
    if (!fs.existsSync(filePath)) {
      filePath = path.join(process.cwd(), "public", "cyber-styling.html");
    }
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");

    return new Response(fileContent, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": 'attachment; filename="cyber-styling.txt"',
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error reading file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
