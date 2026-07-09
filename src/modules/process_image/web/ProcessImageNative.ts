// Web implementation of ProcessImageNative using Canvas API
// getBits accepts an image URL (object URL or data URL) and extracts pixel data
// Note: Image loading is async, so we use a synchronous-looking wrapper that
// throws an error - the actual processing should use getBitsAsync
export function getBits(url: string): Uint8Array[][] {
  // This synchronous API cannot work with async image loading
  // Throw an error to indicate async is required
  throw new Error(
    "getBits requires async image loading in web. The Preview component should be updated to use async loading.",
  );
}

// Async helper that should be used in web environment
export function getBitsAsync(url: string): Promise<Uint8Array[][]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get 2D context"));
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Convert to Uint8Array[][] format: rows -> columns -> RGBA bytes
      const bits: Uint8Array[][] = [];
      for (let y = 0; y < canvas.height; y++) {
        const row: Uint8Array[] = [];
        for (let x = 0; x < canvas.width; x++) {
          const index = (y * canvas.width + x) * 4;
          row.push(
            new Uint8Array([
              data[index], // R
              data[index + 1], // G
              data[index + 2], // B
              data[index + 3], // A
            ]),
          );
        }
        bits.push(row);
      }

      resolve(bits);
    };

    img.onerror = () => {
      reject(new Error("Failed to load image from URL: " + url));
    };

    img.src = url;
  });
}

export function readFileBytes(_path: string): Uint8Array {
  throw new Error(
    "readFileBytes is not available on web; use dataUrl from the file picker.",
  );
}
