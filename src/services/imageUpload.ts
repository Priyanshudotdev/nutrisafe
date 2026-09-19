import { Platform } from "react-native";

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
  const mime = imageUri.startsWith("data:")
    ? (imageUri.slice(5, imageUri.indexOf(";")) || guessMimeType(imageUri))
    : guessMimeType(imageUri);
  const name = `${filename}.${fileExtensionFor(mime)}`;

  const form = new FormData();
  if (Platform.OS === "web" && imageUri.startsWith("data:")) {
    const blob = await (await fetch(imageUri)).blob();
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
