import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const verification = await prisma.verification.findUnique({
      where: { id },
      include: {
        sources: {
          select: {
            id: true,
            title: true,
            url: true,
            snippet: true,
          },
        },
      },
    });

    if (!verification) {
      return NextResponse.json({ error: "Verification job not found" }, { status: 404 });
    }

    return NextResponse.json(verification);
  } catch (error: any) {
    console.error(`API /api/verify/${(await params).id} GET error:`, error);
    return NextResponse.json(
      { error: error.message || "Something went wrong" },
      { status: 500 }
    );
  }
}
