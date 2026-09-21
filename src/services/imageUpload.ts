import { Image, Platform } from "react-native";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

function parseDataUriMime(uri: string): string | null {
  if (!uri.startsWith("data:")) return null;
  // Explicit data-URI parse: require the ";" terminator (e.g. "data:image/jpeg;base64,...").
  // Without it the slice would be meaningless, so fall back to extension guessing.
  const semi = uri.indexOf(";", 5);
  if (semi === -1) return null;
  const mime = uri.slice(5, semi).trim().toLowerCase();
  return mime.includes("/") ? mime : null;
}

function guessMimeType(uri: string): string {
  const clean = uri.split("?")[0].split("#")[0].toLowerCase();
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".heic") || clean.endsWith(".heif")) return "image/heic";
  if (clean.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

function fileExtensionFor(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  // HEIC/HEIF: preserve the .heic extension so the server can detect the
  // container and convert to JPEG before vision inference. Do NOT remap to
  // .jpg — the filename must match the payload format.
  if (mime === "image/heic" || mime === "image/heif") return "heic";
  return "jpg";
}

/** Max long-edge (px) for uploads — full-res camera photos are 2–5 MB and
 *  time out on slow connections. 1024px JPEG q0.75 lands at ~100–200 KB,
 *  plenty for food recognition, and normalizes HEIC into vision-ready JPEG. */
const UPLOAD_MAX_EDGE = 1024;

/** getImageSize silently never resolves for some URIs (no timeout, and on
 *  some Android builds neither callback fires). Race it so a stuck probe
 *  degrades to "compress without resize" instead of hanging the upload
 *  forever behind an infinite spinner. */
const IMAGE_SIZE_TIMEOUT_MS = 8000;

function getImageSize(uri: string): Promise<{ width: number; height: number } | null> {  return new Promise((resolve) => {
    let settled = false;
    const done = (value: { width: number; height: number } | null) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(value);
      }
    };
    const timer = setTimeout(() => done(null), IMAGE_SIZE_TIMEOUT_MS);
    try {
      Image.getSize(
        uri,
        (width, height) => done({ width, height }),
        () => done(null)
      );
    } catch {
      done(null);
    }
  });
}

/**
 * Best-effort HEIC → JPEG conversion on web via canvas. Returns null when
 * the browser can't decode the blob (most desktop browsers can't decode
 * HEIC), letting the caller surface a clear "retake as JPEG" message.
 */
async function tryConvertHeicToJpeg(blob: Blob): Promise<Blob | null> {
  try {
    if (typeof createImageBitmap !== "function") return null;
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    if (typeof bitmap.close === "function") bitmap.close();
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((out) => resolve(out), "image/jpeg", 0.85);
    });
  } catch {
    return null;
  }
}

/**
 * Build a multipart form with an image file.
 *
 * React Native's `{ uri, type, name }` FormData convention only works on
 * native — on web it serializes to "[object Object]" and the server rejects
 * the upload. On web we convert data-URIs to a real Blob first.
 */
export async function buildImageForm(
  imageUri: string,
  field = "image",
  filename = "photo"
): Promise<{ form: FormData; mime: string }> {
  // NOTE: content:// URIs (Android) carry no file extension, so
  // guessMimeType falls through to image/jpeg — that default is intentional.
  // NOTE (HEIC): native normalizes HEIC→JPEG via manipulateAsync; if that
  // conversion fails we throw (uploading raw HEIC would always fail vision).
  // On web we attempt a canvas conversion, else throw with the same message.
  // The server also rejects HEIC early with a clear 400 (no provider call).
  // NOTE (size guard): no client-side byte cap here — captures are already
  // downscaled (max width 1280, JPEG q0.85) and picker quality is 0.8; the
  // server enforces the upload size limit and returns 413 when exceeded.
  const mime = parseDataUriMime(imageUri) ?? guessMimeType(imageUri);
  const name = `${filename}.${fileExtensionFor(mime)}`;

  const form = new FormData();
  if (Platform.OS === "web") {
    // On web, always materialize a real Blob — fetch() handles data:, blob:,
    // and http(s): URIs. The RN `{ uri, type, name }` convention would
    // serialize to "[object Object]" on web and the server rejects it.
    let blob: Blob;
    try {
      const res = await fetch(imageUri);
      if (!res.ok) {
        throw new Error(`image fetch failed with status ${res.status}`);
      }
      blob = await res.blob();
    } catch (e) {
      throw new Error(
        `Could not read the selected image (${e instanceof Error ? e.message : "unknown error"}). ` +
          "Try picking the photo again."
      );
    }
    // Multer filters on the part's Content-Type, not the filename. An empty
    // Blob.type would arrive as application/octet-stream and be rejected
    // with "Only image files are accepted" — fail fast with a clear message.
    const wireMime = (blob.type || mime).toLowerCase();
    if (!wireMime.startsWith("image/")) {
      throw new Error(
        "This file doesn't look like an image. Please pick a JPEG or PNG photo."
      );
    }
    if (/heic|heif/i.test(wireMime)) {
      // Browsers can't reliably decode HEIC; convert via canvas when possible.
      const converted = await tryConvertHeicToJpeg(blob);
      if (converted) {
        blob = converted;
      } else {
        throw new Error(
          "This photo is in HEIC format (iPhone), which can't be analyzed. " +
            "Please retake it as JPEG, or pick a JPEG/PNG from your gallery."
        );
      }
    }
    const finalName =
      blob.type === "image/jpeg" && /heic/i.test(name) ? `${filename}.jpg` : name;
    form.append(field, blob, finalName);
  } else {
    // Downscale on-device before upload — this also normalizes HEIC into
    // vision-ready JPEG (expo-image-manipulator). A big upload that might
    // succeed beats no upload, EXCEPT for HEIC: an unconverted HEIC is
    // guaranteed to be rejected by vision providers, so fail fast instead.
    let uri = imageUri;
    let outMime = mime;
    let outName = name;
    try {
      const dims = await getImageSize(imageUri);
      const actions: { resize: { width?: number; height?: number } }[] = [];
      if (dims && Math.max(dims.width, dims.height) > UPLOAD_MAX_EDGE) {
        const scale = UPLOAD_MAX_EDGE / Math.max(dims.width, dims.height);
        actions.push({
          resize: {
            width: Math.round(dims.width * scale),
            height: Math.round(dims.height * scale),
          },
        });
      }
      const manipulated = await manipulateAsync(imageUri, actions, {
        compress: 0.75,
        format: SaveFormat.JPEG,
      });
      uri = manipulated.uri;
      outMime = "image/jpeg";
      outName = `${filename}.jpg`;
    } catch (e) {
      if (/heic|heif/i.test(mime)) {
        throw new Error(
          "This photo is in HEIC format (iPhone) and couldn't be converted. " +
            "Please retake it as JPEG, or pick a JPEG/PNG from your gallery."
        );
      }
      console.warn("buildImageForm: downscale failed, uploading original", e);
    }
    // On native, use the `{ uri, type, name }` FormData convention directly.
    // Do NOT `fetch(file://|content://)` -> Blob here: on Android that fetch
    // deterministically returns 404 for content:// URIs and evicted cache
    // files, which only produced
    // "buildImageForm: Blob materialization failed ..." warnings before
    // falling back to this exact form. Blob is web-only.
    form.append(field, {
      uri,
      type: outMime,
      name: outName,
    } as unknown as Blob);
  }
  return { form, mime };
}

/** Max decoded image bytes for the JSON upload path (~2.5 MB; downscaled
 *  1024px q0.75 JPEGs land at ~100–200 KB, base64 inflates by ~33%). */
export const JSON_UPLOAD_MAX_BYTES = 2_500_000;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read the selected image."));
      reader.onload = () => {
        const url = String(reader.result ?? "");
        const comma = url.indexOf(",");
        resolve(comma === -1 ? url : url.slice(comma + 1));
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      reject(e instanceof Error ? e : new Error("Could not read the selected image."));
    }
  });
}

async function blobToPayload(
  blob: Blob,
  fallbackMime: string
): Promise<{ base64: string; mime: string }> {
  const wireMime = (blob.type || fallbackMime).toLowerCase();
  if (!wireMime.startsWith("image/")) {
    throw new Error(
      "This file doesn't look like an image. Please pick a JPEG or PNG photo."
    );
  }
  let finalBlob = blob;
  let finalMime = wireMime;
  if (/heic|heif/i.test(wireMime)) {
    const converted = await tryConvertHeicToJpeg(blob);
    if (converted) {
      finalBlob = converted;
      finalMime = "image/jpeg";
    } else {
      throw new Error(
        "This photo is in HEIC format (iPhone), which can't be analyzed. " +
          `Please retake it as JPEG, or pick a JPEG/PNG from your gallery.`
      );
    }
  }
  const base64 = await blobToBase64(finalBlob);
  // ~4 base64 chars per 3 bytes; cheap pre-check before the server's 413.
  if (base64.length > Math.ceil((JSON_UPLOAD_MAX_BYTES * 4) / 3) + 64) {
    throw new Error(
      "This photo is too large to analyze. Try a smaller photo or retake it."
    );
  }
  return { base64, mime: finalMime };
}

/**
 * Build a base64 JSON payload for the `-json` vision endpoints.
 *
 * Unlike buildImageForm (multipart), the payload is a plain string: one URI
 * scheme on every platform, no boundary/Content-Type footguns, and safely
 * reusable across retries (FormData bodies are consumable on Android).
 * Preferred path for mobile; multipart stays as fallback for old servers.
 */
export async function buildImagePayload(
  imageUri: string
): Promise<{ base64: string; mime: string }> {
  const mime = parseDataUriMime(imageUri) ?? guessMimeType(imageUri);

  if (Platform.OS === "web") {
    let blob: Blob;
    try {
      const res = await fetch(imageUri);
      if (!res.ok) throw new Error(`image fetch failed with status ${res.status}`);
      blob = await res.blob();
    } catch (e) {
      throw new Error(
        `Could not read the selected image (${e instanceof Error ? e.message : "unknown error"}). ` +
          "Try picking the photo again."
      );
    }
    return blobToPayload(blob, mime);
  }

  // Native: normalize to JPEG first (also converts HEIC). The manipulated
  // output is a fresh file:// URI, which fetch() can read — unlike the
  // original content:// URI, which 404s on Android (see buildImageForm).
  let uri = imageUri;
  try {
    const dims = await getImageSize(imageUri);
    const actions: { resize: { width?: number; height?: number } }[] = [];
    if (dims && Math.max(dims.width, dims.height) > UPLOAD_MAX_EDGE) {
      const scale = UPLOAD_MAX_EDGE / Math.max(dims.width, dims.height);
      actions.push({
        resize: {
          width: Math.round(dims.width * scale),
          height: Math.round(dims.height * scale),
        },
      });
    }
    const manipulated = await manipulateAsync(imageUri, actions, {
      compress: 0.75,
      format: SaveFormat.JPEG,
    });
    uri = manipulated.uri;
  } catch (e) {
    if (/heic|heif/i.test(mime)) {
      throw new Error(
        "This photo is in HEIC format (iPhone) and couldn't be converted. " +
          "Please retake it as JPEG, or pick a JPEG/PNG from your gallery."
      );
    }
    // Non-HEIC downscale failure: proceed with the original URI; the
    // fetch below still fails fast with a clear message if unreadable.
    console.warn("buildImagePayload: downscale failed, reading original", e);
  }

  let blob: Blob;
  try {
    const res = await fetch(uri);
    if (!res.ok) throw new Error(`image fetch failed with status ${res.status}`);
    blob = await res.blob();
  } catch (e) {
    throw new Error(
      `Could not read the selected image (${e instanceof Error ? e.message : "unknown error"}). ` +
        "Try picking the photo again."
    );
  }
  // Post-manipulation output is JPEG; fall back to image/jpeg only when
  // the Blob carries no type.
  return blobToPayload(blob, "image/jpeg");
}
