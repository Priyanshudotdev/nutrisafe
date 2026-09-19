import { Platform } from "react-native";

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
    form.append(field, {
      uri: imageUri,
      type: mime,
      name,
    } as unknown as Blob);
  }
  return { form, mime };
}
