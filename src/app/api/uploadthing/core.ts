import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {
  mediaUploader: f({
    image: { maxFileSize: "4MB", maxFileCount: 1 },
    video: { maxFileSize: "16MB", maxFileCount: 1 },
    audio: { maxFileSize: "8MB", maxFileCount: 1 },
  })
    .onUploadComplete(async ({ file }) => {
      console.log("Upload completed. File URL:", file.url);
      return { url: file.url, name: file.name, size: file.size };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
