import * as cheerio from "cheerio";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export async function duckDuckGoSearch(query: string): Promise<SearchResult[]> {
  try {
    const apiKey = process.env.TAVILY_API_KEY || "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";
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        query,
        search_depth: "advanced"
      }),
      signal: AbortSignal.timeout(6000)
    });

    if (!response.ok) {
      throw new Error(`Tavily search failed with status: ${response.status}`);
    }

    const data = await response.json();
    const results = data?.results || [];

    return results.slice(0, 5).map((item: any) => ({
      title: item.title || "",
      url: item.url || "",
      snippet: item.content || "",
    }));
  } catch (error) {
    console.error("Tavily search error:", error);
    return [];
  }
}

export async function fetchPageContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      return `Failed to load page. Status: ${response.status}`;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    $("script, style, noscript, iframe, svg, nav, footer, header, head, link, meta").remove();

    let text = $("body").text() || $.text();
    
    text = text
      .replace(/\s+/g, " ")
      .replace(/\n+/g, " ")
      .trim();

    if (text.length > 6000) {
      return text.substring(0, 6000) + "...";
    }

    return text;
  } catch (error) {
    console.error(`Page content scrape error: ${url}`, error);
    return `Could not load page content: ${url}`;
  }
}
