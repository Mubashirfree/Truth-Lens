import { NextRequest } from "next/server";
import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "./core";

const token = process.env.UPLOADTHING_TOKEN || "";
const hasValidToken = token.startsWith("eyJ") && token.length > 20;

export async function GET(req: NextRequest) {
  if (!hasValidToken) {
    console.warn("Uploadthing token is missing or invalid. Media uploads will not function.");
    return new Response(
      JSON.stringify({ error: "Uploadthing is not configured. Please add a valid UPLOADTHING_TOKEN to your .env file." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
  
  const handler = createRouteHandler({
    router: ourFileRouter,
  });
  return handler.GET(req);
}

export async function POST(req: NextRequest) {
  if (!hasValidToken) {
    console.warn("Uploadthing token is missing or invalid. Media uploads will not function.");
    return new Response(
      JSON.stringify({ error: "Uploadthing is not configured. Please add a valid UPLOADTHING_TOKEN to your .env file." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const handler = createRouteHandler({
    router: ourFileRouter,
  });
  return handler.POST(req);
}
