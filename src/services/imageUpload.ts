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

function getImageSize(uri: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
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
  // NOTE (HEIC): when the mime is image/heic|heif we keep it as-is and
  // preserve the .heic filename; the server must convert to JPEG before
  // vision inference since most vision models don't accept HEIC directly.
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
    form.append(field, blob, name);
  } else {
    // Downscale on-device before upload. Any failure here falls back to the
    // original file — a big upload that might succeed beats no upload.
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
      console.warn("buildImageForm: downscale failed, uploading original", e);
    }
    form.append(field, {
      uri,
      type: outMime,
      name: outName,
    } as unknown as Blob);
  }
  return { form, mime };
}
