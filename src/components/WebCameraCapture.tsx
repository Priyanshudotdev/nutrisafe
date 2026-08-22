import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "../theme/tokens";

interface WebCameraCaptureProps {
  onCapture: (dataUri: string) => void;
  onCancel: () => void;
  onFallbackUpload: () => void;
}

/**
 * Web-only camera via getUserMedia.
 * Native platforms should use expo-image-picker instead.
 */
export function WebCameraCapture({
  onCapture,
  onCancel,
  onFallbackUpload,
}: WebCameraCaptureProps): React.ReactElement | null {
  const videoRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;

    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera is not supported in this browser. Upload a photo instead.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch {
        setError("Camera permission denied or unavailable. Upload a photo instead.");
      }
    }

    start();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [stopStream]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !ready) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUri = canvas.toDataURL("image/jpeg", 0.85);
    stopStream();
    onCapture(dataUri);
  };

  if (Platform.OS !== "web") return null;

  if (error) {
    return (
      <View style={styles.card}>
        <Ionicons name="videocam-off-outline" size={28} color={colors.dangerIcon} />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.primaryButton} onPress={onFallbackUpload}>
          <Text style={styles.primaryButtonText}>Upload Photo</Text>
        </Pressable>
        <Pressable style={styles.linkButton} onPress={onCancel}>
          <Text style={styles.linkText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {/* Web-only video element for live camera preview */}
      {React.createElement("video", {
        ref: videoRef,
        playsInline: true,
        muted: true,
        style: {
          width: "100%",
          height: 260,
          borderRadius: 16,
          backgroundColor: "#000",
          objectFit: "cover",
        },
      })}
      <View style={styles.actions}>
        <Pressable style={styles.secondaryButton} onPress={() => { stopStream(); onCancel(); }}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.primaryButton, !ready && styles.disabled]}
          onPress={handleCapture}
          disabled={!ready}
        >
          <Ionicons name="camera" size={18} color={colors.white} />
          <Text style={styles.primaryButtonText}>Capture</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.xl,
    backgroundColor: colors.cardBg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: "center",
  },
  errorText: {
    fontSize: 14,
    color: colors.dangerText,
    textAlign: "center",
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    width: "100%",
  },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: colors.primaryDark,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  primaryButtonText: { color: colors.white, fontSize: 15, fontWeight: "700" },
  secondaryButton: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: { color: colors.primaryDark, fontSize: 15, fontWeight: "700" },
  linkButton: { paddingVertical: spacing.sm },
  linkText: { color: colors.primaryDark, fontWeight: "600" },
  disabled: { opacity: 0.5 },
});
