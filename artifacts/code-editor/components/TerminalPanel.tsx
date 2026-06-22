import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useIDE } from "@/context/IDEContext";

const TERMUX_PLAY = "https://play.google.com/store/apps/details?id=com.termux";
type TStatus = "checking" | "installed" | "not_installed";

export default function TerminalPanel() {
  const { colors, fontSize, toggleTerminal, activeFile } = useIDE();
  const [status, setStatus] = useState<TStatus>("checking");
  const [cmd, setCmd] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, tension: 65, friction: 11 }).start();
    checkTermux();
  }, []);

  const checkTermux = useCallback(async () => {
    setStatus("checking");
    try {
      const ok = await Linking.canOpenURL("termux://");
      setStatus(ok ? "installed" : "not_installed");
    } catch { setStatus("not_installed"); }
  }, []);

  const getRunCmd = useCallback(() => {
    if (!activeFile) return null;
    const ext = activeFile.name.split(".").pop()?.toLowerCase() ?? "";
    const fp = activeFile.path || `/sdcard/${activeFile.name}`;
    const dir = fp.includes("/") ? fp.substring(0, fp.lastIndexOf("/")) : "/sdcard";
    if (ext === "py") return { dir, run: `python ${activeFile.name}` };
    if (["js","mjs"].includes(ext)) return { dir, run: `node ${activeFile.name}` };
    if (ext === "ts") return { dir, run: `npx ts-node ${activeFile.name}` };
    if (["sh","bash"].includes(ext)) return { dir, run: `bash ${activeFile.name}` };
    if (ext === "rb") return { dir, run: `ruby ${activeFile.name}` };
    if (ext === "go") return { dir, run: `go run ${activeFile.name}` };
    if (["cpp","c"].includes(ext)) return { dir, run: `g++ ${activeFile.name} -o out && ./out` };
    if (ext === "java") return { dir, run: `javac ${activeFile.name} && java ${activeFile.name.replace(".java","")}` };
    return null;
  }, [activeFile]);

  const launchTermux = useCallback(async (customCmd?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    let command = customCmd;
    if (!command) {
      const ri = getRunCmd();
      command = ri ? `cd "${ri.dir}" && ${ri.run}` : cmd.trim() || "echo Termux ready";
    }
    try { await Clipboard.setStringAsync(command); } catch {}
    setHistory(prev => [command!, ...prev.slice(0, 49)]);
    setHistIdx(-1); setCmd("");
    try { await Linking.openURL("termux://"); }
    catch { await Linking.openURL(TERMUX_PLAY); }
  }, [cmd, getRunCmd]);

  const handleSend = useCallback(() => {
    if (!cmd.trim()) return;
    launchTermux(cmd.trim());
  }, [cmd, launchTermux]);

  const fs = fontSize ?? 14;
  const ri = getRunCmd();
  const slideStyle = {
    transform: [{ translateY: slideAnim.interpolate({ inputRange:[0,1], outputRange:[300,0] }) }],
  };

  if (Platform.OS !== "android") {
    return (
      <View style={[s.container, { backgroundColor: colors.terminalBg }]}>
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <View style={s.hLeft}>
            <View style={[s.dot, { backgroundColor:"#ff5f57" }]} />
            <View style={[s.dot, { backgroundColor:"#ffbd2e" }]} />
            <View style={[s.dot, { backgroundColor:"#27c93f" }]} />
            <Text style={[s.hTitle, { color: colors.mutedText }]}> TERMINAL</Text>
          </View>
          <TouchableOpacity onPress={toggleTerminal} style={s.iBtn}>
            <Feather name="x" size={14} color={colors.mutedText} />
          </TouchableOpacity>
        </View>
        <View style={s.center}>
          <Feather name="smartphone" size={40} color={colors.mutedText} />
          <Text style={[s.bigTxt, { color: colors.text }]}>Android Only</Text>
          <Text style={[s.desc, { color: colors.mutedText }]}>Terminal only works on Android via Termux.</Text>
        </View>
      </View>
    );
  }

  return (
    <Animated.View style={[s.container, { backgroundColor: colors.terminalBg }, slideStyle]}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <View style={s.hLeft}>
          <View style={[s.dot, { backgroundColor:"#ff5f57" }]} />
          <View style={[s.dot, { backgroundColor:"#ffbd2e" }]} />
          <View style={[s.dot, { backgroundColor:"#27c93f" }]} />
          <Text style={[s.hTitle, { color: colors.mutedText }]}> TERMUX TERMINAL</Text>
        </View>
        <View style={s.hRight}>
          <TouchableOpacity onPress={checkTermux} style={s.iBtn}>
            <Feather name="refresh-cw" size={13} color={colors.mutedText} />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleTerminal} style={s.iBtn}>
            <Feather name="x" size={14} color={colors.mutedText} />
          </TouchableOpacity>
        </View>
      </View>

      {status === "checking" && (
        <View style={s.center}>
          <Text style={[s.desc, { color: colors.mutedText }]}>Checking Termux...</Text>
        </View>
      )}

      {status === "not_installed" && (
        <View style={s.center}>
          <Feather name="terminal" size={48} color={colors.mutedText} />
          <Text style={[s.bigTxt, { color: colors.text }]}>Terminal Not Installed</Text>
          <Text style={[s.desc, { color: colors.mutedText }]}>
            Termux is required to run code.{"\n"}Install from Play Store to continue.
          </Text>
          <TouchableOpacity style={[s.installBtn, { backgroundColor: colors.accent }]}
            onPress={() => Linking.openURL(TERMUX_PLAY)}>
            <Feather name="download" size={16} color="#fff" />
            <Text style={s.installTxt}>Install Now</Text>
          </TouchableOpacity>
          <Text style={[s.pkg, { color: colors.mutedText }]}>Package: com.termux</Text>
          <TouchableOpacity onPress={checkTermux} style={[s.retryBtn]}>
            <Feather name="refresh-cw" size={13} color={colors.mutedText} />
            <Text style={[s.retryTxt, { color: colors.mutedText }]}>Check Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === "installed" && (
        <>
          <View style={[s.banner, { backgroundColor: colors.accent+"18", borderColor: colors.accent+"44" }]}>
            <Feather name="info" size={12} color={colors.accent} />
            <Text style={[s.bannerTxt, { color: colors.accent }]}>
              Command is copied → long-press in Termux to paste & run
            </Text>
          </View>

          {activeFile && ri && (
            <View style={[s.runCard, { backgroundColor: (colors as any).card ?? colors.muted, borderColor: colors.border }]}>
              <View style={s.runLeft}>
                <Feather name="file-text" size={13} color={colors.accent} />
                <Text style={[s.runName, { color: colors.text }]} numberOfLines={1}>{activeFile.name}</Text>
              </View>
              <TouchableOpacity style={[s.runBtn, { backgroundColor: colors.success+"22" }]}
                onPress={() => launchTermux(`cd "${ri.dir}" && ${ri.run}`)}>
                <Feather name="play" size={13} color={colors.success} />
                <Text style={[s.runBtnTxt, { color: colors.success }]}>Run in Termux</Text>
              </TouchableOpacity>
            </View>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={[s.shortcuts, { borderBottomColor: colors.border+"44" }]}
            contentContainerStyle={s.shortcutsC}>
            {["ls","pwd","cd ~","clear","python --version","node --version","git status","pip list"].map(k => (
              <TouchableOpacity key={k} style={[s.shortBtn, { backgroundColor: colors.muted ?? "#21222c" }]}
                onPress={() => { setCmd(k); inputRef.current?.focus(); }}>
                <Text style={[s.shortTxt, { color: colors.mutedText, fontSize: fs-4 }]}>{k}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {history.length > 0 && (
            <ScrollView style={[s.histScroll, { borderBottomColor: colors.border+"33" }]}
              contentContainerStyle={s.histC}>
              <Text style={[s.histLabel, { color: colors.mutedText }]}>RECENT COMMANDS</Text>
              {history.slice(0,5).map((h,i) => (
                <TouchableOpacity key={i} style={[s.histItem, { backgroundColor: colors.muted ?? "#21222c" }]}
                  onPress={() => { setCmd(h); inputRef.current?.focus(); }}>
                  <Feather name="clock" size={10} color={colors.mutedText} />
                  <Text style={[s.histTxt, { color: colors.mutedText, fontSize: fs-3 }]} numberOfLines={1}>{h}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity style={[s.openBtn, { backgroundColor: colors.accent+"22", borderColor: colors.accent+"66" }]}
            onPress={() => launchTermux()}>
            <Feather name="external-link" size={14} color={colors.accent} />
            <Text style={[s.openBtnTxt, { color: colors.accent }]}>Open Termux</Text>
          </TouchableOpacity>

          <View style={[s.inputRow, { borderTopColor: colors.border, backgroundColor: colors.terminalBg }]}>
            <Text style={[s.prompt, { color: colors.terminalPrompt ?? "#50fa7b" }]}>$</Text>
            <TextInput ref={inputRef}
              style={[s.input, { color: colors.terminalText ?? "#f8f8f2", fontSize: fs-1 }]}
              value={cmd} onChangeText={setCmd} placeholder="Enter command..."
              placeholderTextColor={(colors.mutedText ?? "#6272a4")+"88"}
              autoCorrect={false} autoCapitalize="none" spellCheck={false}
              onSubmitEditing={handleSend} blurOnSubmit={false} returnKeyType="send" />
            <TouchableOpacity onPress={() => {
              const ni = Math.min(histIdx+1, history.length-1);
              if (ni >= 0) { setHistIdx(ni); setCmd(history[ni] ?? ""); }
            }} style={s.iBtn}>
              <Feather name="chevron-up" size={16} color={colors.mutedText} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSend} disabled={!cmd.trim()}
              style={[s.sendBtn, { backgroundColor: cmd.trim() ? colors.accent : colors.muted ?? "#44475a" }]}>
              <Feather name="send" size={13} color="#fff" />
            </TouchableOpacity>
          </View>
        </>
      )}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container:{flex:1},
  header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:12,paddingVertical:7,borderBottomWidth:1},
  hLeft:{flexDirection:"row",alignItems:"center"},
  hRight:{flexDirection:"row",alignItems:"center",gap:8},
  dot:{width:10,height:10,borderRadius:5,marginRight:4},
  hTitle:{fontSize:11,fontFamily:"Inter_600SemiBold",letterSpacing:1},
  iBtn:{padding:4},
  center:{flex:1,alignItems:"center",justifyContent:"center",padding:24,gap:12},
  bigTxt:{fontSize:18,fontFamily:"Inter_700Bold",textAlign:"center"},
  desc:{fontSize:13,fontFamily:"Inter_400Regular",textAlign:"center",lineHeight:20,opacity:0.8},
  installBtn:{flexDirection:"row",alignItems:"center",gap:8,paddingHorizontal:24,paddingVertical:13,borderRadius:10,marginTop:8},
  installTxt:{color:"#fff",fontSize:16,fontFamily:"Inter_700Bold"},
  pkg:{fontSize:11,fontFamily:"Inter_400Regular",opacity:0.5,marginTop:4},
  retryBtn:{flexDirection:"row",alignItems:"center",gap:6,marginTop:4,paddingVertical:6},
  retryTxt:{fontSize:12,fontFamily:"Inter_400Regular"},
  banner:{flexDirection:"row",alignItems:"center",gap:6,paddingHorizontal:12,paddingVertical:8,borderBottomWidth:1},
  bannerTxt:{fontSize:11,fontFamily:"Inter_400Regular",flex:1},
  runCard:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:12,paddingVertical:8,borderBottomWidth:1},
  runLeft:{flexDirection:"row",alignItems:"center",gap:6,flex:1},
  runName:{fontSize:12,fontFamily:"Inter_500Medium",flex:1},
  runBtn:{flexDirection:"row",alignItems:"center",gap:4,paddingHorizontal:10,paddingVertical:6,borderRadius:6},
  runBtnTxt:{fontSize:12,fontFamily:"Inter_600SemiBold"},
  shortcuts:{maxHeight:38,borderBottomWidth:1},
  shortcutsC:{paddingHorizontal:8,gap:6,alignItems:"center",paddingVertical:5},
  shortBtn:{paddingHorizontal:10,paddingVertical:4,borderRadius:5},
  shortTxt:{fontFamily:"monospace"},
  histScroll:{maxHeight:110,borderBottomWidth:1},
  histC:{paddingHorizontal:10,paddingVertical:6,gap:4},
  histLabel:{fontSize:10,fontFamily:"Inter_600SemiBold",letterSpacing:1,marginBottom:2},
  histItem:{flexDirection:"row",alignItems:"center",gap:6,paddingHorizontal:8,paddingVertical:4,borderRadius:4},
  histTxt:{fontFamily:"monospace",flex:1},
  openBtn:{flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8,marginHorizontal:12,marginVertical:8,paddingVertical:10,borderRadius:8,borderWidth:1},
  openBtnTxt:{fontSize:14,fontFamily:"Inter_600SemiBold"},
  inputRow:{flexDirection:"row",alignItems:"center",paddingHorizontal:10,paddingVertical:8,borderTopWidth:1,gap:8},
  prompt:{fontFamily:"monospace",fontSize:16,fontWeight:"bold"},
  input:{flex:1,fontFamily:"monospace",paddingVertical:2},
  sendBtn:{width:32,height:32,borderRadius:6,alignItems:"center",justifyContent:"center"},
});
