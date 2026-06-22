import { Feather } from "@expo/vector-icons";
  import * as Haptics from "expo-haptics";
  import React, { useCallback, useEffect, useRef, useState } from "react";
  import {
    Animated, FlatList, Modal, ScrollView,
    StyleSheet, Text, TouchableOpacity, View,
  } from "react-native";
  import { useIDE } from "@/context/IDEContext";

  interface Props { onBack: () => void; }

  // Lines that should be removed: # comments, """ docstrings, // comments, /* */ blocks (single line)
  function isCommentLine(line: string): boolean {
    const t = line.trim();
    if (t === "") return false; // blank lines handled separately
    if (t.startsWith("#")) return true;
    if (t.startsWith("//")) return true;
    if (t.startsWith("/*") && t.endsWith("*/")) return true;
    if (t.startsWith('"""') && t.endsWith('"""') && t.length > 6) return true;
    if (t.startsWith("'''") && t.endsWith("'''") && t.length > 6) return true;
    if (t === '"""' || t === "'''") return true;
    return false;
  }

  function isBlankLine(line: string): boolean {
    return line.trim() === "";
  }

  interface AnimLine {
    id: string;
    text: string;
    isComment: boolean;
    opacity: Animated.Value;
    translateX: Animated.Value;
  }

  export default function CladPlugin({ onBack }: Props) {
    const ctx = useIDE() as any;
    const { colors, cladInstalled, cladEnabled, setCladInstalled, setCladEnabled,
            activeFile, updateFileContent } = ctx;

    const [installing, setInstalling] = useState(false);
    const [installProgress, setInstallProgress] = useState(0);
    const progressAnim = useRef(new Animated.Value(0)).current;

    // Wave modal state
    const [waveVisible, setWaveVisible] = useState(false);
    const [animLines, setAnimLines] = useState<AnimLine[]>([]);
    const [wavePhase, setWavePhase] = useState<"scanning" | "removing" | "done">("scanning");
    const [removedCount, setRemovedCount] = useState(0);
    const flatListRef = useRef<FlatList>(null);

    // ── Install flow ──────────────────────────────────────────
    const handleInstall = useCallback(async () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setInstalling(true);
      setInstallProgress(0);
      progressAnim.setValue(0);

      Animated.timing(progressAnim, {
        toValue: 1, duration: 2600, useNativeDriver: false,
      }).start(() => {
        setInstalling(false);
        setCladInstalled(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      });

      // Update displayed progress
      const interval = setInterval(() => {
        setInstallProgress(p => {
          const next = p + Math.random() * 18;
          if (next >= 100) { clearInterval(interval); return 100; }
          return next;
        });
      }, 200);
    }, [progressAnim, setCladInstalled]);

    // ── Toggle ON/OFF ──────────────────────────────────────────
    const handleToggle = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCladEnabled(!cladEnabled);
    }, [cladEnabled, setCladEnabled]);

    // ── Wave animation: remove comments ───────────────────────
    const runWave = useCallback(() => {
      if (!activeFile) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const lines = activeFile.content.split("\n");
      const animatedLines: AnimLine[] = lines.map((text, i) => ({
        id: String(i),
        text,
        isComment: isCommentLine(text),
        opacity: new Animated.Value(1),
        translateX: new Animated.Value(0),
      }));

      setAnimLines(animatedLines);
      setWavePhase("scanning");
      setRemovedCount(0);
      setWaveVisible(true);

      // Phase 1: scan — highlight comment lines with a wave (top to bottom)
      let delay = 0;
      const WAVE_SPEED = 38; // ms per line

      const scanAnims = animatedLines.map((al, idx) => {
        const anim = Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.spring(al.translateX, { toValue: al.isComment ? 8 : 0, useNativeDriver: true, speed: 40, bounciness: 6 }),
          ]),
        ]);
        delay += WAVE_SPEED;
        return anim;
      });

      Animated.sequence([
        Animated.parallel(scanAnims),
        Animated.delay(400),
      ]).start(() => {
        // Phase 2: remove — fade out comment lines in wave order
        setWavePhase("removing");
        let removeDelay = 0;
        let count = 0;

        const removeAnims = animatedLines.map((al, idx) => {
          if (!al.isComment) return Animated.delay(0);
          count++;
          const anim = Animated.sequence([
            Animated.delay(removeDelay),
            Animated.parallel([
              Animated.timing(al.opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
              Animated.timing(al.translateX, { toValue: 60, duration: 220, useNativeDriver: true }),
            ]),
          ]);
          removeDelay += 55;
          return anim;
        });

        setRemovedCount(count);

        Animated.sequence([
          Animated.parallel(removeAnims),
          Animated.delay(300),
        ]).start(() => {
          // Phase 3: done — update file content
          setWavePhase("done");

          // Build cleaned content: remove comment lines + collapse multiple blank lines
          const cleanedLines: string[] = [];
          let prevBlank = false;
          for (const line of lines) {
            if (isCommentLine(line)) continue;
            if (isBlankLine(line)) {
              if (!prevBlank) { cleanedLines.push(line); prevBlank = true; }
            } else {
              cleanedLines.push(line);
              prevBlank = false;
            }
          }
          const cleaned = cleanedLines.join("\n");
          updateFileContent(activeFile.id, cleaned);

          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

          setTimeout(() => { setWaveVisible(false); }, 1200);
        });
      });
    }, [activeFile, updateFileContent]);

    const progressBarWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

    // ── RENDER ─────────────────────────────────────────────────
    return (
      <ScrollView style={[s.container, { backgroundColor: colors.sidebar }]} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onBack} style={s.backBtn}>
            <Feather name="arrow-left" size={16} color={colors.mutedText} />
          </TouchableOpacity>
          <Feather name="zap" size={14} color={colors.mutedText} />
          <Text style={[s.headerTitle, { color: colors.mutedText }]}>CLAD PLUGIN</Text>
        </View>

        {/* Hero / Store card */}
        <View style={[s.heroCard, { backgroundColor: "#1a1040", borderColor: "#a78bfa44" }]}>
          <View style={s.heroTop}>
            <View style={[s.heroIcon, { backgroundColor: "#a78bfa22" }]}>
              <Feather name="zap" size={32} color="#a78bfa" />
            </View>
            <View style={s.heroInfo}>
              <Text style={s.heroName}>Clad</Text>
              <Text style={s.heroAuthor}>KIU Studio · Code Tools</Text>
              <View style={s.starsRow}>
                {[1,2,3,4,5].map(i => <Feather key={i} name="star" size={12} color={i<=4?"#f59e0b":"#333"} />)}
                <Text style={s.ratingTxt}>4.8 (2.1k)</Text>
              </View>
            </View>
          </View>
          <Text style={s.heroDesc}>
            Clad removes comment lines and extra blank spaces from your code with a beautiful wave animation.
            Supports Python (#, """), JavaScript (//), and more.
          </Text>

          {/* Feature pills */}
          <View style={s.pills}>
            {["Wave Animation","Auto Clean","Multi-language","Fast"].map(f => (
              <View key={f} style={s.pill}>
                <Text style={s.pillTxt}>{f}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Screenshots row (decorative) */}
        <View style={s.screensRow}>
          {["#→ removed","// gone","""" cleaned","⚡ wave"].map((label, i) => (
            <View key={i} style={[s.screenThumb, { backgroundColor: colors.card ?? colors.muted, borderColor: colors.border }]}>
              <Text style={[s.screenTxt, { color: "#a78bfa" }]}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Install / Toggle area */}
        {!cladInstalled ? (
          <View style={s.installBox}>
            {installing ? (
              <>
                <Text style={[s.installLabel, { color: colors.text }]}>
                  Installing... {Math.min(100, Math.floor(installProgress))}%
                </Text>
                <View style={[s.progressTrack, { backgroundColor: colors.muted }]}>
                  <Animated.View style={[s.progressBar, { width: progressBarWidth, backgroundColor: "#a78bfa" }]} />
                </View>
                <Text style={[s.installSub, { color: colors.mutedText }]}>
                  Fetching package · Verifying assets · Done
                </Text>
              </>
            ) : (
              <TouchableOpacity style={[s.installBtn, { backgroundColor: "#a78bfa" }]} onPress={handleInstall} activeOpacity={0.85}>
                <Feather name="download" size={18} color="#fff" />
                <Text style={s.installBtnTxt}>Install Clad — Free</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={s.controlBox}>
            {/* ON / OFF toggle */}
            <View style={[s.toggleRow, { borderColor: colors.border, backgroundColor: colors.card ?? colors.muted }]}>
              <View style={s.toggleInfo}>
                <Feather name="zap" size={18} color={cladEnabled ? "#a78bfa" : colors.mutedText} />
                <View>
                  <Text style={[s.toggleLabel, { color: colors.text }]}>Clad Engine</Text>
                  <Text style={[s.toggleSub, { color: colors.mutedText }]}>
                    {cladEnabled ? "Active — tap 'Clad' in editor to clean" : "Disabled"}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[s.toggleBtn, { backgroundColor: cladEnabled ? "#a78bfa" : colors.muted }]}
                onPress={handleToggle}
                activeOpacity={0.8}
              >
                <Text style={[s.toggleBtnTxt, { color: cladEnabled ? "#fff" : colors.mutedText }]}>
                  {cladEnabled ? "ON" : "OFF"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Run wave button */}
            {cladEnabled && (
              <TouchableOpacity
                style={[s.runBtn, { backgroundColor: activeFile ? "#a78bfa" : colors.muted, opacity: activeFile ? 1 : 0.5 }]}
                onPress={runWave}
                disabled={!activeFile}
                activeOpacity={0.85}
              >
                <Feather name="zap" size={16} color="#fff" />
                <Text style={s.runBtnTxt}>
                  {activeFile ? `Clean "${activeFile.name}"` : "Open a file first"}
                </Text>
              </TouchableOpacity>
            )}

            {cladEnabled && activeFile && (
              <View style={[s.infoBox, { backgroundColor: "#a78bfa15", borderColor: "#a78bfa44" }]}>
                <Feather name="info" size={12} color="#a78bfa" />
                <Text style={[s.infoTxt, { color: colors.mutedText }]}>
                  Clad will remove # comments, """ docstrings, // lines and collapse extra blank lines using a top-to-bottom wave.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* What it does */}
        <View style={[s.section, { borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>What Clad removes</Text>
          {[
            { icon: "hash",      label: "# Python comments",    color: "#f59e0b" },
            { icon: "code",      label: '""" Docstrings """',    color: "#60a5fa" },
            { icon: "slash",     label: "// JS/TS comments",     color: "#34d399" },
            { icon: "minus",     label: "/* inline blocks */",   color: "#f87171" },
            { icon: "more-horizontal", label: "Extra blank lines", color: "#a78bfa" },
          ].map(item => (
            <View key={item.label} style={s.featureRow}>
              <View style={[s.featureIcon, { backgroundColor: item.color + "22" }]}>
                <Feather name={item.icon as any} size={13} color={item.color} />
              </View>
              <Text style={[s.featureTxt, { color: colors.mutedText }]}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Wave animation modal */}
        <Modal visible={waveVisible} transparent animationType="fade" onRequestClose={() => setWaveVisible(false)}>
          <View style={s.waveOverlay}>
            <View style={[s.waveBox, { backgroundColor: "#0d1117", borderColor: "#a78bfa55" }]}>
              {/* Header */}
              <View style={s.waveHeader}>
                <Animated.View style={[s.waveDot, { backgroundColor: "#a78bfa" }]} />
                <Text style={s.waveTitle}>
                  {wavePhase === "scanning"  ? "🔍 Scanning lines…"
                 : wavePhase === "removing" ? "⚡ Removing comments…"
                 : `✅ Cleaned! ${removedCount} line${removedCount !== 1 ? "s" : ""} removed`}
                </Text>
              </View>

              {/* Animated line list */}
              <FlatList
                ref={flatListRef}
                data={animLines}
                keyExtractor={item => item.id}
                style={s.waveList}
                showsVerticalScrollIndicator={false}
                renderItem={({ item, index }) => (
                  <Animated.View
                    style={[
                      s.waveLine,
                      {
                        opacity: item.opacity,
                        transform: [{ translateX: item.translateX }],
                        backgroundColor: item.isComment ? "#a78bfa18" : "transparent",
                      },
                    ]}
                  >
                    <Text style={s.waveLineNum}>{String(index + 1).padStart(3, " ")}</Text>
                    <Text
                      style={[s.waveLineText, { color: item.isComment ? "#a78bfa" : "#8b949e" }]}
                      numberOfLines={1}
                    >
                      {item.text || " "}
                    </Text>
                    {item.isComment && <Feather name="x" size={10} color="#a78bfa88" />}
                  </Animated.View>
                )}
              />

              {wavePhase === "done" && (
                <TouchableOpacity
                  style={[s.waveClose, { backgroundColor: "#a78bfa" }]}
                  onPress={() => setWaveVisible(false)}
                >
                  <Text style={s.waveCloseTxt}>Close</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Modal>
      </ScrollView>
    );
  }

  const s = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1 },
    backBtn: { padding: 2 },
    headerTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },

    heroCard: { margin: 10, borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
    heroTop: { flexDirection: "row", gap: 12, alignItems: "center" },
    heroIcon: { width: 60, height: 60, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    heroInfo: { flex: 1, gap: 3 },
    heroName: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#e6edf3" },
    heroAuthor: { fontSize: 12, color: "#8b949e", fontFamily: "Inter_400Regular" },
    starsRow: { flexDirection: "row", alignItems: "center", gap: 3 },
    ratingTxt: { fontSize: 11, color: "#8b949e", fontFamily: "Inter_400Regular", marginLeft: 4 },
    heroDesc: { fontSize: 13, color: "#8b949e", fontFamily: "Inter_400Regular", lineHeight: 19 },
    pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    pill: { backgroundColor: "#a78bfa22", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    pillTxt: { fontSize: 11, color: "#a78bfa", fontFamily: "Inter_600SemiBold" },

    screensRow: { flexDirection: "row", gap: 8, paddingHorizontal: 10, marginBottom: 10 },
    screenThumb: { flex: 1, height: 50, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    screenTxt: { fontSize: 10, fontFamily: "Inter_700Bold" },

    installBox: { marginHorizontal: 10, marginBottom: 12, gap: 10 },
    installBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 14, borderRadius: 12 },
    installBtnTxt: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
    installLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", textAlign: "center" },
    progressTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
    progressBar: { height: 8, borderRadius: 4 },
    installSub: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },

    controlBox: { marginHorizontal: 10, marginBottom: 12, gap: 10 },
    toggleRow: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1, gap: 10 },
    toggleInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
    toggleLabel: { fontSize: 14, fontFamily: "Inter_700Bold" },
    toggleSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
    toggleBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8 },
    toggleBtnTxt: { fontSize: 14, fontFamily: "Inter_700Bold" },
    runBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 12 },
    runBtnTxt: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
    infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
    infoTxt: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },

    section: { marginHorizontal: 10, marginBottom: 20, borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
    sectionTitle: { fontSize: 13, fontFamily: "Inter_700Bold" },
    featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    featureIcon: { width: 26, height: 26, borderRadius: 6, alignItems: "center", justifyContent: "center" },
    featureTxt: { fontSize: 13, fontFamily: "Inter_400Regular" },

    // Wave modal
    waveOverlay: { flex: 1, backgroundColor: "#000000cc", justifyContent: "flex-end" },
    waveBox: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 16, maxHeight: "75%" },
    waveHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
    waveDot: { width: 8, height: 8, borderRadius: 4 },
    waveTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#e6edf3" },
    waveList: { maxHeight: 340 },
    waveLine: { flexDirection: "row", alignItems: "center", paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, gap: 6 },
    waveLineNum: { fontSize: 10, color: "#30363d", fontFamily: "Inter_400Regular", width: 24, textAlign: "right" },
    waveLineText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular" },
    waveClose: { marginTop: 12, paddingVertical: 11, borderRadius: 10, alignItems: "center" },
    waveCloseTxt: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  });
  