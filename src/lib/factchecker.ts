import { GoogleGenAI, Type } from "@google/genai";
import { prisma } from "./db";
import { duckDuckGoSearch, fetchPageContent } from "./scraper";
import { progressEmitter } from "./emitter";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];

async function generateWithTimeout(model: string, contents: any[], config: any, timeoutMs = 3500) {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`API request timed out after ${timeoutMs}ms`)), timeoutMs)
  );
  return Promise.race([
    ai.models.generateContent({
      model,
      contents,
      config,
    }),
    timeoutPromise
  ]);
}

async function generateContentWithFallback(contents: any[], config: any) {
  let lastError: any = null;

  for (const model of MODELS) {
    try {
      console.log(`Sending API call using model: ${model}`);
      const isRealModel = model === "gemini-2.5-flash" || model === "gemini-2.5-flash-lite";
      const timeoutMs = isRealModel ? 15000 : 3000;
      const response = await generateWithTimeout(model, contents, config, timeoutMs);
      return response;
    } catch (error: any) {
      console.warn(`Model ${model} failed:`, error.message || error);
      lastError = error;
    }
  }

  throw lastError || new Error("All fallback models failed.");
}

async function publishProgress(id: string, status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED", progress: string, extra: any = {}) {
  try {
    const updated = await prisma.verification.update({
      where: { id },
      data: {
        status,
        progress,
        ...extra,
      },
      include: {
        sources: {
          select: {
            id: true,
            title: true,
            url: true,
            snippet: true,
          }
        }
      }
    });
    
    progressEmitter.emit(`progress:${id}`, updated);
    console.log(`[Job ${id}] State: ${status} | Msg: ${progress}`);
  } catch (e) {
    console.error("Error publishing progress:", e);
  }
}

async function getMediaPart(mediaUrl: string) {
  try {
    const res = await fetch(mediaUrl, {
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch media from ${mediaUrl}. Status: ${res.status}`);
    }
    const contentType = res.headers.get("content-type") || "";
    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return {
      inlineData: {
        data: base64,
        mimeType: contentType,
      },
    };
  } catch (error) {
    console.error("Error fetching media for Gemini:", error);
    return null;
  }
}

interface ClaimExtractionResult {
  claims: Array<{
    claim: string;
    searchQuery: string;
  }>;
}

interface FactCheckResult {
  trustScore: number;
  summary: string;
  verifications: Array<{
    claim: string;
    verdict: "True" | "False" | "Misleading" | "Unverified";
    explanation: string;
    sources: string[];
  }>;
}

export async function performVerification(verificationId: string) {
  try {
    const currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    await publishProgress(verificationId, "PROCESSING", "Checking your statement...");

    const verification = await prisma.verification.findUnique({
      where: { id: verificationId },
    });

    if (!verification) {
      console.error(`Verification job ${verificationId} not found in database.`);
      return;
    }

    const contents: any[] = [];
    
    if (verification.textContent) {
      contents.push({ text: `Content to check: ${verification.textContent}` });
    }
    if (verification.prompt) {
      contents.push({ text: `Context context: ${verification.prompt}` });
    }
    if (verification.mediaUrl) {
      const mediaPart = await getMediaPart(verification.mediaUrl);
      if (mediaPart) {
        contents.push(mediaPart);
      }
    }

    if (contents.length === 0) {
      throw new Error("Nothing was entered to verify.");
    }

    const claimExtractionPrompt = 
      `Identify the core facts or claims in this submission that need checking. The current date is ${currentDate}. For each claim, write a simple search query to check it online. Return a JSON list.`;
    
    contents.push({ text: claimExtractionPrompt });

    const claimsResponse = await generateContentWithFallback(contents, {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            claims: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  claim: { type: Type.STRING },
                  searchQuery: { type: Type.STRING },
                },
                required: ["claim", "searchQuery"],
              },
            },
          },
          required: ["claims"],
        },
    });

    const claimsText = claimsResponse.text;
    if (!claimsText) {
      throw new Error("Failed to read claims.");
    }

    const claimsResult = JSON.parse(claimsText) as ClaimExtractionResult;

    if (!claimsResult.claims || claimsResult.claims.length === 0) {
      await publishProgress(verificationId, "COMPLETED", "Checking complete.", {
        trustScore: 100,
        feedback: {
          trustScore: 100,
          summary: "This appears to be general conversation, greeting, or personal opinion. There are no historical or factual events to verify.",
          verifications: []
        },
      });
      return;
    }

    await publishProgress(verificationId, "PROCESSING", "Searching the internet...");

    const claimSearchPromises = claimsResult.claims.map(async (item) => {
      const searchResults = await duckDuckGoSearch(item.searchQuery);
      
      const scrapePromises = searchResults.slice(0, 2).map(async (res) => {
        const pageText = await fetchPageContent(res.url);
        
        await prisma.source.create({
          data: {
            verificationId,
            title: res.title,
            url: res.url,
            snippet: res.snippet,
            content: pageText,
          },
        });

        return `Source: ${res.url}\nExcerpt:\n${pageText}\n---`;
      });

      return Promise.all(scrapePromises);
    });

    const searchContextsList = await Promise.all(claimSearchPromises);
    const aggregatedSearchContexts = searchContextsList.flat();

    await publishProgress(verificationId, "PROCESSING", "Thinking and verifying...");

    const finalVerifyContents: any[] = [];
    
    if (verification.textContent) {
      finalVerifyContents.push({ text: `User statement: ${verification.textContent}` });
    }
    if (verification.prompt) {
      finalVerifyContents.push({ text: `User request: ${verification.prompt}` });
    }
    if (verification.mediaUrl) {
      const mediaPart = await getMediaPart(verification.mediaUrl);
      if (mediaPart) {
        finalVerifyContents.push(mediaPart);
      }
    }

    const searchContextBlock = `\n=== SEARCH DETAILS ===\n${aggregatedSearchContexts.join("\n\n")}\n======================`;
    finalVerifyContents.push({ text: searchContextBlock });

    const analysisPrompt = `
You are a simple, friendly helper. Verify the user's statement using the search details.
The current date is ${currentDate}. Always evaluate timelines and present findings relative to the current year/date (today is ${currentDate}). For example, if the statement or query is about "now" or "recently", evaluate it relative to ${currentDate}.

CRITICAL INSTRUCTIONS:
- Check if the visual media, statement, or audio is a joke, a meme, a comedy edit, or satirical context (like a dancing baby meme or "Chota Dakait" viral videos).
- If it is a joke/meme/satire or is digitally altered for comedy, do NOT mark it as 100% True/Real. You must mark it as "Misleading" or "False" or "Unverified" (trustScore below 50). Explain in very simple words that this is a funny edit/meme created for entertainment rather than an authentic factual news story.
- Be extremely critical of viral edits, deepfakes, and funny/satirical posts presented as real news.

CRITICAL LANGUAGE REQUIREMENT:
- Write the overall summary and each explanation in extremely simple, plain English.
- Think of explaining it to an elderly person or someone who finds reading difficult.
- Use short sentences. Use common words.
- Avoid technical jargon, complex terms, or heavy vocabulary.
- Keep explanation clear, short, yet comprehensive.

Break down the statement into these claims:
${claimsResult.claims.map((c, i) => `Claim ${i + 1}: ${c.claim}`).join("\n")}

Assign a trustScore (0 to 100):
- 80-100: True / Reliable.
- 50-79: Partly true or slightly confusing.
- 20-49: Has mistakes / Unverified.
- 0-19: Completely fake / Untrue.

For each claim, provide:
1. Verdict: Must be 'True', 'False', 'Misleading', or 'Unverified'.
2. Explanation: A very simple, easy-to-understand explanation using the sources.
3. Sources: List of supporting or refuting source URLs.

Provide a short overall 'summary' in simple English.
Return a JSON object adhering to the schema.
`;
    finalVerifyContents.push({ text: analysisPrompt });

    const finalResponse = await generateContentWithFallback(finalVerifyContents, {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            trustScore: { type: Type.INTEGER },
            summary: { type: Type.STRING },
            verifications: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  claim: { type: Type.STRING },
                  verdict: { 
                    type: Type.STRING,
                    enum: ["True", "False", "Misleading", "Unverified"] 
                  },
                  explanation: { type: Type.STRING },
                  sources: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  }
                },
                required: ["claim", "verdict", "explanation", "sources"],
              },
            },
          },
          required: ["trustScore", "summary", "verifications"],
        },
    });

    const finalResultText = finalResponse.text;
    if (!finalResultText) {
      throw new Error("Verification failed to complete.");
    }

    const finalResult = JSON.parse(finalResultText) as FactCheckResult;

    await publishProgress(verificationId, "COMPLETED", "Checking complete.", {
      trustScore: finalResult.trustScore,
      feedback: finalResult as any,
    });

    if (verification.mediaUrl) {
      const isUT = verification.mediaUrl.includes("utfs.io") || 
                   verification.mediaUrl.includes("ufs.sh") || 
                   verification.mediaUrl.includes("uploadthing");
      if (isUT) {
        try {
          const url = verification.mediaUrl;
          const fileKey = url.includes("/f/") 
            ? url.substring(url.indexOf("/f/") + 3) 
            : url.substring(url.lastIndexOf("/") + 1);
          console.log(`Cleaning up Uploadthing storage. Deleting key: ${fileKey}`);
          const { UTApi } = await import("uploadthing/server");
          const utapi = new UTApi();
          await utapi.deleteFiles(fileKey);
          console.log(`Uploadthing file ${fileKey} deleted successfully.`);
        } catch (err) {
          console.error("Failed to delete file from Uploadthing:", err);
        }
      }
    }
  } catch (error: any) {
    console.error(`Verification job ${verificationId} failed with details:`, error);
    await publishProgress(verificationId, "FAILED", "Checking failed. Please try again.");
  }
}
