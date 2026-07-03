import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { performVerification } from "@/lib/factchecker";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mediaType, mediaUrl, textContent, prompt } = body;

    if (!mediaUrl && !textContent) {
      return NextResponse.json(
        { error: "At least text content or media URL must be provided." },
        { status: 400 }
      );
    }

    if (!["text", "image", "video", "audio"].includes(mediaType)) {
      return NextResponse.json(
        { error: "Invalid media type. Must be 'text', 'image', 'video', or 'audio'." },
        { status: 400 }
      );
    }

    const verification = await prisma.verification.create({
      data: {
        mediaType,
        mediaUrl: mediaUrl || null,
        textContent: textContent || null,
        prompt: prompt || null,
        status: "PENDING",
        progress: "Analyzing media and extracting claims...",
      },
    });

    performVerification(verification.id).catch((err) => {
      console.error(`Background verification promise failed for ${verification.id}:`, err);
    });

    return NextResponse.json({ id: verification.id, status: verification.status });
  } catch (error: any) {
    console.error("API /api/verify POST error:", error);
    return NextResponse.json(
      { error: error.message || "Something went wrong" },
      { status: 500 }
    );
  }
}
