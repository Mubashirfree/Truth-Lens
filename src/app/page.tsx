"use client";

import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  UploadCloud, FileText, Image as ImageIcon, Video, Music, Trash2, 
  Loader2, Sparkles, RefreshCw, ShieldAlert, History, X, Clock 
} from "lucide-react";
import { uploadFiles } from "@/lib/uploadthing";
import { compressImage, compressVideo } from "@/lib/compression";
import { VerificationStatus } from "@/components/verification-status";
import { VerificationResult } from "@/components/verification-result";

export default function Home() {
  const [textContent, setTextContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<"text" | "image" | "video" | "audio">("text");
  
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [videoCompressPercent, setVideoCompressPercent] = useState<number | null>(null);
  const [jobStatus, setJobStatus] = useState<"PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | null>(null);
  const [jobProgressMsg, setJobProgressMsg] = useState("");
  const [verificationData, setVerificationData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [localMediaUrl, setLocalMediaUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("truthlens:history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const saveToHistory = (item: any) => {
    setHistory((prev) => {
      const filtered = prev.filter((h) => h.id !== item.id);
      const updated = [item, ...filtered];
      localStorage.setItem("truthlens:history", JSON.stringify(updated));
      return updated;
    });
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory((prev) => {
      const updated = prev.filter((h) => h.id !== id);
      localStorage.setItem("truthlens:history", JSON.stringify(updated));
      return updated;
    });
  };

  const clearHistory = () => {
    localStorage.removeItem("truthlens:history");
    setHistory([]);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processSelectedFile(e.target.files[0]);
    }
  };

  const processSelectedFile = async (selectedFile: File) => {
    setErrorMsg(null);
    setOriginalFile(selectedFile);
    setVideoCompressPercent(null);
    
    let type: "image" | "video" | "audio" = "image";
    if (selectedFile.type.startsWith("image/")) {
      type = "image";
    } else if (selectedFile.type.startsWith("video/")) {
      type = "video";
    } else if (selectedFile.type.startsWith("audio/")) {
      type = "audio";
    } else {
      setErrorMsg("Unsupported file type. Please upload a photo, video, or audio recording.");
      return;
    }

    setMediaType(type);

    if (type === "image") {
      setUploadProgress("Preparing...");
      try {
        const compressed = await compressImage(selectedFile);
        setFile(compressed);
        setLocalMediaUrl(URL.createObjectURL(compressed));
      } catch (err) {
        console.error("Compression error:", err);
        setFile(selectedFile);
        setLocalMediaUrl(URL.createObjectURL(selectedFile));
      } finally {
        setUploadProgress("");
      }
    } else if (type === "video") {
      setUploadProgress("Preparing...");
      try {
        const compressed = await compressVideo(selectedFile, (percent) => {
          setVideoCompressPercent(percent);
        });
        setFile(compressed);
        setLocalMediaUrl(URL.createObjectURL(compressed));
      } catch (err) {
        console.error("Video compression error:", err);
        setFile(selectedFile);
        setLocalMediaUrl(URL.createObjectURL(selectedFile));
      } finally {
        setUploadProgress("");
        setVideoCompressPercent(null);
      }
    } else {
      setFile(selectedFile);
      setLocalMediaUrl(URL.createObjectURL(selectedFile));
    }
  };

  const removeFile = () => {
    if (localMediaUrl) {
      URL.revokeObjectURL(localMediaUrl);
      setLocalMediaUrl(null);
    }
    setFile(null);
    setOriginalFile(null);
    setMediaType("text");
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textContent && !file) {
      setErrorMsg("Please type a message or add a photo/video first.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setVerificationData(null);
    setJobStatus("PENDING");
    setJobProgressMsg("Checking your submission...");

    let uploadedUrl = "";
    
    try {
      if (file) {
        setUploadProgress("Preparing...");
        const uploadRes = await uploadFiles("mediaUploader", { files: [file] });
        if (!uploadRes || uploadRes.length === 0) {
          throw new Error("Could not upload file. Try again.");
        }
        uploadedUrl = (uploadRes[0] as any).ufsUrl || uploadRes[0].url;
        setUploadProgress("");
      }

      const finalMediaType = file ? mediaType : "text";

      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaType: finalMediaType,
          mediaUrl: uploadedUrl || null,
          textContent: textContent || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start fact-check process.");
      }

      connectToSSE(data.id);
    } catch (err: any) {
      console.error("Verification submit error details:", err);
      setErrorMsg("Something went wrong. Please try again.");
      setLoading(false);
      setJobStatus(null);
    }
  };

  const connectToSSE = (id: string) => {
    const eventSource = new EventSource(`/api/verify/${id}/sse`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setJobStatus(data.status);
        setJobProgressMsg(data.progress);

        if (data.status === "COMPLETED") {
          eventSource.close();
          setVerificationData(data);
          setLoading(false);
          
          const historyItem = {
            id: data.id,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " " + new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }),
            textContent: data.textContent,
            prompt: data.prompt,
            mediaType: data.mediaType,
            trustScore: data.trustScore,
            sources: data.sources,
            feedback: data.feedback
          };
          saveToHistory(historyItem);
        } else if (data.status === "FAILED") {
          eventSource.close();
          setErrorMsg("Checking failed. Please try again.");
          setLoading(false);
        }
      } catch (err) {
        console.error("Error reading SSE packet:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE connection error:", err);
      eventSource.close();
    };
  };

  const getMediaIcon = () => {
    switch (mediaType) {
      case "image": return <ImageIcon className="h-10 w-10 text-sky-500" />;
      case "video": return <Video className="h-10 w-10 text-emerald-500" />;
      case "audio": return <Music className="h-10 w-10 text-purple-500" />;
      default: return <FileText className="h-10 w-10 text-slate-500" />;
    }
  };

  const startNewVerification = () => {
    if (localMediaUrl) {
      URL.revokeObjectURL(localMediaUrl);
      setLocalMediaUrl(null);
    }
    setTextContent("");
    setFile(null);
    setOriginalFile(null);
    setMediaType("text");
    setVerificationData(null);
    setJobStatus(null);
    setJobProgressMsg("");
    setErrorMsg(null);
  };

  const isHome = !loading && !verificationData;
  const parentClass = isHome 
    ? "h-screen overflow-hidden flex flex-col justify-center py-6 px-4 md:px-8 relative bg-slate-50" 
    : "min-h-screen overflow-y-auto py-10 px-4 md:px-8 relative bg-slate-50";

  return (
    <div className={`${parentClass} w-full transition-all duration-500`}>
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-400/20 rounded-full blur-[140px] pointer-events-none animate-pulse duration-[8000ms]" />
      <div className="absolute top-[20%] right-[-10%] w-[50%] h-[50%] bg-pink-400/20 rounded-full blur-[140px] pointer-events-none animate-pulse duration-[6000ms]" />
      <div className="absolute bottom-[-10%] left-[10%] w-[50%] h-[50%] bg-amber-400/20 rounded-full blur-[140px] pointer-events-none animate-pulse duration-[10000ms]" />

      <div className={`${isHome ? "mb-6 space-y-2" : "mb-8 space-y-3"} max-w-4xl mx-auto text-center relative z-10 flex flex-col items-center`}>
        {isHome && (
          <div className="w-full flex items-center justify-between mb-4 px-2">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setIsHistoryOpen(true)}
              className="bg-white border-slate-200 text-slate-655 hover:text-slate-800 shadow-sm rounded-xl h-12 w-12 cursor-pointer transition-all hover:scale-105 active:scale-95"
            >
              <History className="h-6 w-6" />
            </Button>
            <div className="w-12" />
          </div>
        )}

        <h1 className="text-5xl md:text-7xl font-black tracking-tight bg-gradient-to-r from-indigo-600 via-pink-600 to-amber-500 bg-clip-text text-transparent pb-1">
          TruthLens
        </h1>
        <p className="text-slate-500 text-lg md:text-xl font-bold max-w-xl mx-auto leading-normal">
          Is this photo, video, or news message real?
        </p>
      </div>

      <div className="relative z-10">
        {!loading && !verificationData && (
          <Card className="border-white bg-white/70 backdrop-blur-xl max-w-4xl mx-auto shadow-[0_20px_50px_rgba(99,_102,_241,_0.12)] rounded-3xl p-4 md:p-6 border border-white/60">
            <CardContent className="space-y-6 pt-2">
              <form onSubmit={handleVerify} className="space-y-6">
                
                <div className="space-y-2">
                  <Textarea
                    placeholder="Type or paste what you want to check here..."
                    className="h-28 bg-white/80 border-slate-200 text-slate-850 placeholder:text-slate-400 focus-visible:ring-indigo-500 focus-visible:border-indigo-500 rounded-2xl resize-none text-base md:text-lg font-bold p-5 shadow-sm"
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  {!file ? (
                    <div
                      className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all cursor-pointer ${
                        isDragActive 
                          ? "border-indigo-500 bg-indigo-50/20" 
                          : "border-slate-250 bg-white/80 hover:border-indigo-400 hover:bg-slate-50"
                      } shadow-sm`}
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*,audio/*"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      <UploadCloud className="h-12 w-12 text-slate-400 mb-3" />
                      <p className="text-lg md:text-xl font-black text-slate-655 text-center">
                        Add Photo or Video
                      </p>
                    </div>
                  ) : (
                    <div className="bg-white/80 rounded-2xl p-4 border border-slate-200 flex items-center justify-between gap-4 shadow-sm">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 shadow-sm shrink-0">
                          {getMediaIcon()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-base font-black text-slate-800 truncate pr-2">
                            {originalFile ? originalFile.name : file.name}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={removeFile}
                        className="h-10 w-10 text-slate-400 hover:text-red-500 hover:bg-red-50 shrink-0"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  )}
                </div>

                {errorMsg && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs md:text-sm p-3.5 rounded-xl flex items-start gap-2 font-bold shadow-sm">
                    <ShieldAlert className="h-4.5 w-4.5 shrink-0 text-red-500 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {uploadProgress && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs md:text-sm font-black text-emerald-650">
                      <span>Preparing...</span>
                      <span>{videoCompressPercent !== null ? `${videoCompressPercent}%` : ""}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner">
                      <div 
                        className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${videoCompressPercent !== null ? videoCompressPercent : 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-95 text-white font-black py-6 rounded-2xl transition-all shadow-[0_8px_24px_rgba(99,_102,_241,_0.3)] active:scale-[0.98] text-lg md:text-xl cursor-pointer"
                >
                  <Sparkles className="h-5 w-5 mr-2" /> Check Now
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {loading && jobStatus && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <VerificationStatus status={jobStatus} progress={jobProgressMsg} />
            
            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm md:text-base p-6 rounded-2xl flex flex-col gap-3 font-bold shadow-md">
                <div className="flex gap-2.5">
                  <ShieldAlert className="h-5 w-5 shrink-0 text-red-555" />
                  <span>{errorMsg}</span>
                </div>
                <Button 
                  onClick={startNewVerification} 
                  variant="outline" 
                  className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 w-fit self-end text-xs py-2 px-4 h-auto font-black"
                >
                  Go Back
                </Button>
              </div>
            )}
          </div>
        )}

        {verificationData && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between gap-4">
              <Button
                onClick={() => setIsHistoryOpen(true)}
                variant="outline"
                className="bg-white border-slate-200 hover:bg-slate-50 text-slate-650 hover:text-slate-800 text-sm md:text-base shadow-sm h-auto py-2.5 px-5 font-bold animate-pulse-hover"
              >
                <History className="h-4 w-4 mr-1.5" /> History
              </Button>
              <Button
                onClick={startNewVerification}
                variant="outline"
                className="bg-white border-slate-200 hover:bg-slate-50 text-slate-650 hover:text-slate-800 text-sm md:text-base shadow-sm h-auto py-2.5 px-5 font-bold animate-pulse-hover"
              >
                <RefreshCw className="h-4 w-4 mr-1.5" /> Start Over
              </Button>
            </div>

            <VerificationResult
              mediaType={verificationData.mediaType}
              mediaUrl={localMediaUrl || verificationData.mediaUrl}
              textContent={verificationData.textContent}
              prompt={verificationData.prompt}
              trustScore={verificationData.trustScore}
              sources={verificationData.sources}
              feedback={verificationData.feedback}
            />
          </div>
        )}
      </div>

      <div className={`fixed top-0 left-0 h-full w-80 bg-white shadow-2xl z-50 transform transition-transform duration-300 border-r border-slate-200 flex flex-col ${isHistoryOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-xl font-black text-slate-850 flex items-center gap-2">
            <Clock className="h-5 w-5 text-indigo-500" /> History
          </h2>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsHistoryOpen(false)}
            className="h-10 w-10 text-slate-400 hover:text-slate-600 rounded-xl"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {history.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <History className="h-12 w-12 text-slate-300 mb-3" />
              <p className="text-base font-bold">No history saved</p>
              <p className="text-xs font-semibold text-slate-450 mt-1">Your check results will show here.</p>
            </div>
          ) : (
            history.map((item) => (
              <div 
                key={item.id} 
                onClick={() => {
                  setVerificationData(item);
                  setIsHistoryOpen(false);
                }}
                className="p-4 rounded-2xl border border-slate-150 bg-slate-50/50 hover:bg-slate-100/50 cursor-pointer transition-all relative group"
              >
                <div className="flex items-start justify-between gap-3 pr-6">
                  <span className="text-[10px] font-black text-slate-400">{item.timestamp}</span>
                  <Badge 
                    className={`border-none text-[10px] font-bold ${
                      item.trustScore >= 80 
                        ? 'bg-emerald-50 text-emerald-700' 
                        : item.trustScore >= 50 
                          ? 'bg-amber-50 text-amber-700' 
                          : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {item.trustScore}%
                  </Badge>
                </div>
                
                <p className="text-sm font-bold text-slate-700 mt-2 line-clamp-2 leading-snug">
                  {item.textContent || `[Media Check: ${item.mediaType}]`}
                </p>
                
                <p className="text-xs text-slate-450 font-semibold mt-1 line-clamp-2">
                  {item.feedback?.summary}
                </p>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => deleteHistoryItem(item.id, e)}
                  className="absolute bottom-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        {history.length > 0 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50">
            <Button 
              variant="outline" 
              onClick={clearHistory}
              className="w-full border-slate-200 hover:bg-red-50 hover:text-red-650 font-bold py-4 rounded-xl text-sm"
            >
              Clear History
            </Button>
          </div>
        )}
      </div>

      {isHistoryOpen && (
        <div 
          onClick={() => setIsHistoryOpen(false)} 
          className="fixed inset-0 bg-slate-900/10 backdrop-blur-[2px] z-40 transition-all duration-300"
        />
      )}
    </div>
  );
}
