"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ExternalLink, ShieldCheck, ShieldAlert, Shield } from "lucide-react";

interface Source {
  id: string;
  title: string;
  url: string;
  snippet: string;
}

interface VerificationResultProps {
  mediaType: string;
  mediaUrl?: string | null;
  textContent?: string | null;
  prompt?: string | null;
  trustScore: number;
  sources: Source[];
  feedback: {
    trustScore: number;
    summary: string;
    verifications: Array<{
      claim: string;
      verdict: "True" | "False" | "Misleading" | "Unverified";
      explanation: string;
      sources: string[];
    }>;
  };
}

export function VerificationResult({
  mediaType,
  mediaUrl,
  trustScore,
  sources,
  feedback,
}: VerificationResultProps) {
  const radius = 80;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (trustScore / 100) * circumference;

  const getScoreInfo = (score: number) => {
    if (score >= 80) {
      return {
        color: "stroke-emerald-500",
        text: "text-emerald-600",
        icon: <ShieldCheck className="h-14 w-14 text-emerald-600" />,
        label: "Real / Safe",
      };
    } else if (score >= 50) {
      return {
        color: "stroke-amber-500",
        text: "text-amber-600",
        icon: <Shield className="h-14 w-14 text-amber-600" />,
        label: "Caution / Misleading",
      };
    } else {
      return {
        color: "stroke-red-500",
        text: "text-red-650",
        icon: <ShieldAlert className="h-14 w-14 text-red-600" />,
        label: "Fake / Rumor",
      };
    }
  };

  const scoreInfo = getScoreInfo(trustScore);

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case "True":
        return <Badge className="bg-emerald-50 text-emerald-700 border-2 border-emerald-200 text-sm py-1 px-3 font-bold">True</Badge>;
      case "False":
        return <Badge className="bg-red-50 text-red-700 border-2 border-red-200 text-sm py-1 px-3 font-bold">Fake</Badge>;
      case "Misleading":
        return <Badge className="bg-amber-50 text-amber-700 border-2 border-amber-200 text-sm py-1 px-3 font-bold">Misleading</Badge>;
      default:
        return <Badge className="bg-slate-50 text-slate-600 border-2 border-slate-200 text-sm py-1 px-3 font-bold">Unverified</Badge>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto w-full mt-8 space-y-10 pb-20">
      <Card className="border-slate-200 bg-white shadow-2xl rounded-3xl p-6 md:p-10">
        <CardContent className="pt-6 flex flex-col items-center text-center gap-6">
          <div className="relative flex items-center justify-center">
            <svg className="w-48 h-48 transform -rotate-90">
              <circle
                cx="96"
                cy="96"
                r={radius}
                className="stroke-slate-100"
                strokeWidth={strokeWidth}
                fill="transparent"
              />
              <circle
                cx="96"
                cy="96"
                r={radius}
                className={`transition-all duration-1000 ease-out ${scoreInfo.color}`}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-5xl font-black text-slate-800">{trustScore}%</span>
              <span className="text-xs uppercase tracking-wider text-slate-400 font-bold mt-1">Match</span>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className={`text-3xl md:text-4xl font-black ${scoreInfo.text} flex items-center justify-center gap-2.5`}>
              {scoreInfo.icon} {scoreInfo.label}
            </h3>
            <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed font-bold mt-2">
              {feedback.summary}
            </p>
          </div>
        </CardContent>
      </Card>

      {mediaUrl && (
        <Card className="border-slate-200 bg-white shadow-md rounded-3xl overflow-hidden p-4">
          <div className="relative rounded-2xl overflow-hidden bg-slate-50 flex items-center justify-center p-3">
            {mediaType === "image" && (
              <img src={mediaUrl} alt="Preview" className="max-h-[450px] object-contain rounded-xl shadow-sm" />
            )}
            {mediaType === "video" && (
              <video src={mediaUrl} controls className="max-h-[450px] w-full rounded-xl shadow-sm" />
            )}
            {mediaType === "audio" && (
              <audio src={mediaUrl} controls className="w-full py-4 px-2" />
            )}
          </div>
        </Card>
      )}

      {feedback.verifications.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-lg font-black uppercase tracking-wider text-slate-400 pl-2">Detailed Checks</h4>
          
          <div className="space-y-4">
            {feedback.verifications.map((item, idx) => (
              <Card key={idx} className="border-slate-200 bg-white shadow-md rounded-2xl overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-4 py-4 px-6 bg-slate-50/60 border-b border-slate-100">
                  <span className="text-lg md:text-xl text-slate-800 font-extrabold leading-snug">{item.claim}</span>
                  {getVerdictBadge(item.verdict)}
                </CardHeader>
                <CardContent className="py-4 px-6">
                  <p className="text-base md:text-lg text-slate-650 leading-relaxed font-semibold">
                    {item.explanation}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {sources.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-lg font-black uppercase tracking-wider text-slate-400 pl-2">Sources Checked</h4>
          
          <Card className="border-slate-200 bg-white shadow-md rounded-2xl">
            <CardContent className="py-4 px-6">
              <Accordion className="w-full">
                {sources.map((source, index) => (
                  <AccordionItem key={source.id} value={`source-${index}`} className="border-slate-100 last:border-b-0">
                    <AccordionTrigger className="text-base md:text-lg font-extrabold text-slate-700 hover:text-sky-600 text-left py-4 hover:no-underline">
                      <span className="truncate pr-4">{source.title}</span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 text-slate-600 leading-relaxed text-sm md:text-base pb-4">
                      <p className="italic bg-slate-50 p-4 rounded-xl border border-slate-100 font-semibold">"{source.snippet}"</p>
                      <div className="flex items-center justify-end">
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs md:text-sm text-sky-600 flex items-center gap-1 font-bold hover:underline"
                        >
                          Visit Website <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
