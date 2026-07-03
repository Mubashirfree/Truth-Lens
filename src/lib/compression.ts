export function compressImage(
  file: File,
  maxWidth = 1000,
  maxHeight = 1000,
  quality = 0.75
): Promise<File> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return resolve(file);
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve(file);
            }
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + "_compressed.jpg", {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

export function compressVideo(file: File, progressCallback?: (percent: number) => void): Promise<File> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("video/")) {
      return resolve(file);
    }

    try {
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      video.src = URL.createObjectURL(file);

      video.onloadedmetadata = () => {
        const maxDim = 640;
        let width = video.videoWidth;
        let height = video.videoHeight;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(video.src);
          return resolve(file);
        }

        const canvasStream = (canvas as any).captureStream ? (canvas as any).captureStream(24) : null;
        if (!canvasStream) {
          URL.revokeObjectURL(video.src);
          return resolve(file);
        }

        let combinedStream = canvasStream;
        try {
          const originalStream = (video as any).captureStream 
            ? (video as any).captureStream() 
            : (video as any).mozCaptureStream 
              ? (video as any).mozCaptureStream() 
              : null;
          
          if (originalStream) {
            const audioTrack = originalStream.getAudioTracks()[0];
            if (audioTrack) {
              combinedStream = new MediaStream([
                canvasStream.getVideoTracks()[0],
                audioTrack
              ]);
            }
          }
        } catch (e) {
          console.warn("Failed to capture audio track from video:", e);
        }

        const chunks: Blob[] = [];
        let mimeType = "video/webm;codecs=vp8";
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = "video/mp4";
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = "";
        }

        const recorder = new MediaRecorder(combinedStream, {
          mimeType: mimeType || undefined,
          videoBitsPerSecond: 450000,
        });

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType || "video/webm" });
          const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + "_compressed.webm", {
            type: mimeType || "video/webm",
            lastModified: Date.now(),
          });
          URL.revokeObjectURL(video.src);
          resolve(compressedFile);
        };

        let animationId: number;
        const drawFrame = () => {
          if (video.paused || video.ended) {
            cancelAnimationFrame(animationId);
            return;
          }
          ctx.drawImage(video, 0, 0, width, height);
          
          if (progressCallback && video.duration) {
            const percent = Math.round((video.currentTime / video.duration) * 100);
            progressCallback(percent);
          }
          
          animationId = requestAnimationFrame(drawFrame);
        };

        recorder.start();
        video.play();
        drawFrame();

        video.onended = () => {
          recorder.stop();
        };

        video.onerror = () => {
          URL.revokeObjectURL(video.src);
          resolve(file);
        };
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve(file);
      };
    } catch (err) {
      console.error("Video compression failed, falling back to original:", err);
      resolve(file);
    }
  });
}

export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
