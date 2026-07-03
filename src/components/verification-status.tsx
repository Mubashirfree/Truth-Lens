"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, Circle, AlertCircle } from "lucide-react";

interface VerificationStatusProps {
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  progress: string;
}

export function VerificationStatus({ status, progress }: VerificationStatusProps) {
  const isPending = status === "PENDING";
  const isProcessing = status === "PROCESSING";
  const isCompleted = status === "COMPLETED";
  const isFailed = status === "FAILED";

  const getStepState = (stepIndex: number) => {
    if (isFailed) return "failed";
    if (isCompleted) return "completed";

    const msg = progress.toLowerCase();
    
    let activeIndex = 0;
    if (msg.includes("search") || msg.includes("internet")) {
      activeIndex = 1;
    } else if (msg.includes("thinking") || msg.includes("verify") || msg.includes("evaluat")) {
      activeIndex = 2;
    } else if (msg.includes("prepar") || msg.includes("finish") || msg.includes("complete")) {
      activeIndex = 3;
    }

    if (stepIndex < activeIndex) return "completed";
    if (stepIndex === activeIndex) return "active";
    return "upcoming";
  };

  const steps = [
    { title: "Reading upload", description: "Reviewing details" },
    { title: "Searching web", description: "Finding facts online" },
    { title: "Analyzing details", description: "Checking truthfulness" },
    { title: "Preparing report", description: "Finishing up" },
  ];

  return (
    <Card className="border-slate-200/80 bg-white max-w-5xl mx-auto w-full mt-8 shadow-2xl rounded-3xl p-4 md:p-8">
      <CardHeader className="pb-6">
        <CardTitle className="text-3xl md:text-4xl font-black flex items-center justify-center gap-3">
          {isCompleted ? (
            <span className="text-emerald-600 flex items-center gap-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 fill-emerald-50" /> Completed
            </span>
          ) : isFailed ? (
            <span className="text-red-600 flex items-center gap-2">
              <AlertCircle className="h-8 w-8 text-red-500" /> Failed
            </span>
          ) : (
            <span className="flex items-center gap-2 text-sky-600">
              <Loader2 className="h-7 w-7 animate-spin text-sky-500" /> Verifying...
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8 pb-8">
        <div className="space-y-8 relative before:absolute before:left-6.5 before:top-4 before:bottom-4 before:w-[3px] before:bg-slate-100">
          {steps.map((step, index) => {
            const state = getStepState(index);

            return (
              <div key={index} className="flex gap-6 items-start relative z-10">
                <div className="flex items-center justify-center h-13 w-13 rounded-full bg-white border-2 border-slate-200 shadow-md shrink-0">
                  {state === "completed" && (
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 fill-emerald-50" />
                  )}
                  {state === "active" && (
                    <Loader2 className="h-6 w-6 text-sky-500 animate-spin" />
                  )}
                  {state === "upcoming" && (
                    <Circle className="h-3.5 w-3.5 text-slate-300 fill-slate-100" />
                  )}
                  {state === "failed" && (
                    <AlertCircle className="h-8 w-8 text-red-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pt-2">
                  <h4
                    className={`text-xl md:text-2xl font-black transition-colors duration-200 ${
                      state === "active"
                        ? "text-sky-600"
                        : state === "completed"
                        ? "text-slate-800"
                        : "text-slate-400"
                    }`}
                  >
                    {step.title}
                  </h4>
                  <p className="text-sm md:text-base text-slate-500 font-semibold mt-1">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
