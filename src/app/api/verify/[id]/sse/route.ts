import { NextRequest } from "next/server";
import { progressEmitter } from "@/lib/emitter";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const { id } = resolvedParams;

  const responseHeaders = new Headers({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
  });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const current = await prisma.verification.findUnique({
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

        if (current) {
          controller.enqueue(`data: ${JSON.stringify(current)}\n\n`);
          if (current.status === "COMPLETED" || current.status === "FAILED") {
            controller.close();
            return;
          }
        }
      } catch (err) {
        console.error("Error reading initial verification job for SSE:", err);
      }

      const listener = (data: any) => {
        try {
          controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
          if (data.status === "COMPLETED" || data.status === "FAILED") {
            cleanup();
          }
        } catch (e) {
          cleanup();
        }
      };

      const cleanup = () => {
        progressEmitter.off(`progress:${id}`, listener);
        try {
          controller.close();
        } catch (e) {
        }
      };

      progressEmitter.on(`progress:${id}`, listener);

      req.signal.addEventListener("abort", () => {
        cleanup();
      });
    },
  });

  return new Response(stream, { headers: responseHeaders });
}
