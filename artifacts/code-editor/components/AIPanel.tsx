import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useIDE } from "@/context/IDEContext";

interface ParsedChange {
  filename: string;
  content: string;
  applied: boolean;
}

function parseFileChanges(text: string): ParsedChange[] {
  const changes: ParsedChange[] = [];
  const regex = /```(?:\w+:)?([^\s`\n]+\.\w+)\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const filename = match[1]!.trim();
    const content = match[2]!;
    if (filename && content.trim()) {
      changes.push({ filename, content, applied: false });
    }
  }
  return changes;
}

function buildProjectContext(project: any): string {
  if (!project || !project.files?.length) return "";
  const lines: string[] = [
    `Project: ${project.name}`,
    `Files (${project.files.length}):`,
  ];
  for (const f of project.files.slice(0, 20)) {
    lines.push(`\n--- ${f.name} ---`);
    lines.push(f.content.slice(0, 800));
    if (f.content.length > 800) lines.push("... (truncated)");
  }
  return lines.join("\n");
}

const QUICK_PROMPTS = [
  { label: "✨ Explain", prompt: "Explain what this code does, step by step." },
  { label: "🐛 Fix Bugs", prompt: "Find and fix all bugs in this code. Show the corrected files." },
  { label: "⚡ Optimize", prompt: "Optimize this code for performance. Show the improved version." },
  { label: "💬 Comments", prompt: "Add helpful comments and docstrings to this code." },
  { label: "🧪 Write Tests", prompt: "Write unit tests for this code." },
  { label: "📄 Refactor", prompt: "Refactor this code to be cleaner and more maintainable. Show updated files." },
];

const MODEL_PRESETS: Record<string, { label: string; model: string }[]> = {
  gemini: [
    { label: "Gemini 2.0 Flash", model: "gemini-2.0-flash" },
    { label: "Gemini 1.5 Pro", model: "gemini-1.5-pro" },
    { label: "Gemini 1.5 Flash", model: "gemini-1.5-flash" },
  ],
  openai: [
    { label: "GPT-4o Mini", model: "gpt-4o-mini" },
    { label: "GPT-4o", model: "gpt-4o" },
    { label: "GPT-4 Turbo", model: "gpt-4-turbo" },
  ],
  openrouter: [
    { label: "Deepseek Chat", model: "deepseek/deepseek-chat" },
    { label: "Llama 3.3 70B", model: "meta-llama/llama-3.3-70b-instruct" },
    { label: "Claude 3.5 Sonnet", model: "anthropic/claude-3.5-sonnet" },
    { label: "GPT-4o Mini", model: "openai/gpt-4o-mini" },
    { label: "Gemini Flash", model: "google/gemini-flash-1.5" },
  ],
  claude: [
    { label: "Claude 3.5 Sonnet", model: "claude-3-5-sonnet-20241022" },
    { label: "Claude 3.5 Haiku", model: "claude-3-5-haiku-20241022" },
    { label: "Claude 3 Opus", model: "claude-3-opus-20240229" },
  ],
  deepseek: [
    { label: "Deepseek Chat", model: "deepseek-chat" },
    { label: "Deepseek Coder", model: "deepseek-coder" },
    { label: "Deepseek Reasoner", model: "deepseek-reasoner" },
  ],
  custom: [],
};

export default function AIPanel() {
  const {
    colors, aiMessages, aiLoading, sendAiMessage, clearAiMessages,
    aiApiKey, aiProvider, aiModel, setAiModel,
    activeFile, currentProject, setActivePanel,
    updateFileContent, saveFile,
  } = useIDE();

  const [input, setInput] = useState("");
  const [agentMode, setAgentMode] = useState(false);
  const [tab, setTab] = useState<"chat" | "changes">("chat");
  const [changes, setChanges] = useState<ParsedChange[]>([]);
  const [appliedLog, setAppliedLog] = useState<string[]>([]);
  const listRef = useRef<FlatList>(null);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 120);
  }, []);

  const handleSend = useCallback(async () => {
    const msg = input.trim();
    if (!msg || aiLoading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput("");

    let context = "";
    if (agentMode && currentProject) {
      context = buildProjectContext(currentProject);
    } else if (activeFile) {
      context = `File: ${activeFile.name}\n\`\`\`\n${activeFile.content.slice(0, 3000)}\n\`\`\``;
    }

    await sendAiMessage(msg, context);

    const lastMsg = aiMessages[aiMessages.length - 1];
    if (lastMsg?.role === "assistant") {
      const parsed = parseFileChanges(lastMsg.content);
      if (parsed.length > 0) {
        setChanges(prev => [...prev, ...parsed]);
        setTab("changes");
      }
    }

    scrollToEnd();
  }, [input, aiLoading, agentMode, currentProject, activeFile, sendAiMessage, aiMessages, scrollToEnd]);

  const applyChange = useCallback((change: ParsedChange, idx: number) => {
    if (!currentProject) {
      Alert.alert("No Project", "Open a project first.");
      return;
    }
    const file = currentProject.files.find(f => f.name === change.filename);
    if (!file) {
      Alert.alert(
        "File Not Found",
        `"${change.filename}" doesn't exist in project. Create it?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Create & Apply",
            onPress: () => {
              setChanges(prev => prev.map((c, i) => i === idx ? { ...c, applied: true } : c));
              setAppliedLog(prev => [...prev, `Created: ${change.filename}`]);
            },
          },
        ],
      );
      return;
    }
    updateFileContent(file.id, change.content);
    saveFile(file.id);
    setChanges(prev => prev.map((c, i) => i === idx ? { ...c, applied: true } : c));
    setAppliedLog(prev => [...prev, `Applied: ${change.filename}`]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [currentProject, updateFileContent, saveFile]);

  const models = MODEL_PRESETS[aiProvider] ?? [];

  if (!aiApiKey) {
    return (
      <View style={[styles.noKeyContainer, { backgroundColor: colors.sidebar }]}>
        <Feather name="cpu" size={48} color={colors.aiAccent} />
        <Text style={[styles.noKeyTitle, { color: colors.text }]}>AI Agent</Text>
        <Text style={[styles.noKeyDesc, { color: colors.mutedText }]}>
          Add your API key in Settings to enable the AI assistant.{"\n\n"}
          ✅ Gemini (Google AI Studio){"\n"}
          ✅ OpenAI (ChatGPT){"\n"}
          ✅ Claude (Anthropic){"\n"}
          ✅ Deepseek{"\n"}
          ✅ Llama, OpenRouter + more
        </Text>
        <TouchableOpacity
          style={[styles.settingsBtn, { backgroundColor: colors.accent }]}
          onPress={() => setActivePanel("settings")}
        >
          <Feather name="settings" size={14} color="#fff" />
          <Text style={styles.settingsBtnTxt}>Open Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.sidebar }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Feather name="cpu" size={14} color={colors.aiAccent} />
          <Text style={[styles.headerTitle, { color: colors.mutedText }]}>AI AGENT</Text>
          <View style={[styles.providerBadge, { backgroundColor: colors.aiAccent + "22" }]}>
            <Text style={[styles.providerTxt, { color: colors.aiAccent }]}>
              {aiProvider.toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[
              styles.agentToggle,
              { backgroundColor: agentMode ? colors.accent + "33" : colors.muted ?? "#2d2d2d",
                borderColor: agentMode ? colors.accent : colors.border },
            ]}
            onPress={() => {
              setAgentMode(v => !v);
              Haptics.selectionAsync();
            }}
          >
            <Feather name="zap" size={11} color={agentMode ? colors.accent : colors.mutedText} />
            <Text style={[styles.agentTxt, { color: agentMode ? colors.accent : colors.mutedText }]}>
              Agent
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={clearAiMessages} style={styles.iconBtn}>
            <Feather name="trash-2" size={13} color={colors.mutedText} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Model presets */}
      {models.length > 0 && (
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={[styles.modelBar, { borderBottomColor: colors.border }]}
          contentContainerStyle={styles.modelBarContent}
        >
          {models.map(m => (
            <TouchableOpacity
              key={m.model}
              style={[
                styles.modelChip,
                { backgroundColor: aiModel === m.model ? colors.accent + "33" : colors.muted ?? "#2d2d2d",
                  borderColor: aiModel === m.model ? colors.accent : colors.border },
              ]}
              onPress={() => setAiModel(m.model)}
            >
              <Text style={[styles.modelChipTxt, {
                color: aiModel === m.model ? colors.accent : colors.mutedText,
              }]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Agent mode banner */}
      {agentMode && (
        <View style={[styles.agentBanner, { backgroundColor: colors.accent + "18", borderColor: colors.accent + "44" }]}>
          <Feather name="zap" size={12} color={colors.accent} />
          <Text style={[styles.agentBannerTxt, { color: colors.accent }]}>
            Agent Mode — AI reads the entire project ({currentProject?.files?.length ?? 0} files)
          </Text>
        </View>
      )}

      {/* Tabs: Chat | Changes */}
      {changes.length > 0 && (
        <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
          {(["chat", "changes"] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tabItem, tab === t && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabTxt, { color: tab === t ? colors.accent : colors.mutedText }]}>
                {t === "chat" ? "💬 Chat" : `📝 Changes (${changes.filter(c => !c.applied).length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Changes tab */}
      {tab === "changes" && changes.length > 0 ? (
        <ScrollView style={styles.changesScroll} contentContainerStyle={styles.changesContent}>
          <Text style={[styles.changesTitle, { color: colors.mutedText }]}>AI SUGGESTED CHANGES</Text>
          {changes.map((ch, idx) => (
            <View key={idx} style={[styles.changeCard, { backgroundColor: colors.card ?? colors.muted, borderColor: colors.border }]}>
              <View style={styles.changeHeader}>
                <Feather name="file-text" size={13} color={colors.accent} />
                <Text style={[styles.changeFile, { color: colors.accent }]}>{ch.filename}</Text>
                {ch.applied
                  ? <View style={[styles.appliedBadge, { backgroundColor: colors.success + "33" }]}>
                      <Text style={[styles.appliedTxt, { color: colors.success }]}>✓ Applied</Text>
                    </View>
                  : <TouchableOpacity
                      style={[styles.applyBtn, { backgroundColor: colors.accent }]}
                      onPress={() => applyChange(ch, idx)}
                    >
                      <Feather name="check" size={12} color="#fff" />
                      <Text style={styles.applyBtnTxt}>Apply</Text>
                    </TouchableOpacity>
                }
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Text style={[styles.codePreview, { color: colors.terminalText ?? "#f8f8f2" }]}>
                  {ch.content.slice(0, 300)}{ch.content.length > 300 ? "\n..." : ""}
                </Text>
              </ScrollView>
            </View>
          ))}
          {appliedLog.length > 0 && (
            <View style={[styles.logCard, { backgroundColor: colors.muted ?? "#2d2d2d", borderColor: colors.border }]}>
              <Text style={[styles.logTitle, { color: colors.mutedText }]}>APPLIED</Text>
              {appliedLog.map((l, i) => (
                <Text key={i} style={[styles.logLine, { color: colors.success }]}>✓ {l}</Text>
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        <>
          {/* Chat messages */}
          {aiMessages.length === 0 ? (
            <View style={styles.emptyArea}>
              <Text style={[styles.welcomeTxt, { color: colors.mutedText }]}>
                {agentMode
                  ? "🚀 Agent Mode: Ask me to read, fix, or build your project!"
                  : "Ask me anything about your code!"}
              </Text>
              <View style={styles.quickGrid}>
                {QUICK_PROMPTS.map(q => (
                  <TouchableOpacity
                    key={q.label}
                    style={[styles.quickBtn, { backgroundColor: colors.muted ?? "#2d2d2d", borderColor: colors.border }]}
                    onPress={() => setInput(q.prompt)}
                  >
                    <Text style={[styles.quickBtnTxt, { color: colors.text }]}>{q.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={aiMessages}
              keyExtractor={item => item.id}
              style={styles.messages}
              contentContainerStyle={styles.messagesContent}
              renderItem={({ item }) => {
                const isUser = item.role === "user";
                return (
                  <View style={[
                    styles.bubble,
                    isUser
                      ? [styles.userBubble, { backgroundColor: colors.aiUserBubble }]
                      : [styles.aiBubble, { backgroundColor: colors.aiAssistantBubble, borderColor: colors.border }],
                  ]}>
                    {!isUser && (
                      <View style={styles.aiLabel}>
                        <Feather name="cpu" size={10} color={colors.aiAccent} />
                        <Text style={[styles.aiLabelTxt, { color: colors.aiAccent }]}>
                          {aiProvider.toUpperCase()} AI
                        </Text>
                      </View>
                    )}
                    <Text selectable style={[styles.bubbleTxt, { color: colors.text }]}>
                      {item.content}
                    </Text>
                    {!isUser && parseFileChanges(item.content).length > 0 && (
                      <TouchableOpacity
                        style={[styles.viewChangesBtn, { backgroundColor: colors.accent + "22", borderColor: colors.accent }]}
                        onPress={() => {
                          const newChanges = parseFileChanges(item.content);
                          setChanges(prev => [...prev, ...newChanges]);
                          setTab("changes");
                        }}
                      >
                        <Feather name="file-text" size={12} color={colors.accent} />
                        <Text style={[styles.viewChangesTxt, { color: colors.accent }]}>
                          View {parseFileChanges(item.content).length} file change(s)
                        </Text>
                      </TouchableOpacity>
                    )}
                    <Text style={[styles.timeTxt, { color: colors.mutedText }]}>
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                );
              }}
              onContentSizeChange={() => listRef.current?.scrollToEnd?.({ animated: false })}
            />
          )}

          {aiLoading && (
            <View style={[styles.loadingRow, { borderTopColor: colors.border }]}>
              <ActivityIndicator size="small" color={colors.aiAccent} />
              <Text style={[styles.loadingTxt, { color: colors.mutedText }]}>
                {agentMode ? "Agent is analyzing project..." : "AI is thinking..."}
              </Text>
            </View>
          )}
        </>
      )}

      {/* Input */}
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={0}>
        <View style={[styles.inputRow, { borderTopColor: colors.border, backgroundColor: colors.sidebar }]}>
          {activeFile && !agentMode && (
            <View style={[styles.contextBadge, { backgroundColor: colors.muted ?? "#2d2d2d" }]}>
              <Feather name="file" size={10} color={colors.mutedText} />
              <Text style={[styles.contextTxt, { color: colors.mutedText }]} numberOfLines={1}>
                {activeFile.name}
              </Text>
            </View>
          )}
          <View style={styles.inputArea}>
            <TextInput
              style={[styles.input, {
                color: colors.text,
                backgroundColor: colors.muted ?? "#2d2d2d",
                borderColor: colors.border,
              }]}
              value={input}
              onChangeText={setInput}
              placeholder={agentMode ? "Tell AI what to do with the project..." : "Ask about your code..."}
              placeholderTextColor={colors.mutedText}
              multiline
              maxLength={4000}
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!input.trim() || aiLoading}
              style={[styles.sendBtn, { backgroundColor: input.trim() && !aiLoading ? colors.aiAccent : colors.muted ?? "#2d2d2d" }]}
            >
              {aiLoading
                ? <ActivityIndicator size="small" color={colors.aiAccent} />
                : <Feather name="send" size={15} color={input.trim() ? "#fff" : colors.mutedText} />}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  headerTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },
  providerBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  providerTxt: { fontSize: 9, fontFamily: "Inter_700Bold" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  agentToggle: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1,
  },
  agentTxt: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  iconBtn: { padding: 4 },
  modelBar: { maxHeight: 36, borderBottomWidth: StyleSheet.hairlineWidth },
  modelBarContent: { paddingHorizontal: 10, gap: 6, alignItems: "center", paddingVertical: 4 },
  modelChip: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1,
  },
  modelChipTxt: { fontSize: 11, fontFamily: "Inter_500Medium" },
  agentBanner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1,
  },
  agentBannerTxt: { fontSize: 11, fontFamily: "Inter_500Medium", flex: 1 },
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tabItem: { flex: 1, alignItems: "center", paddingVertical: 8 },
  tabTxt: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  changesScroll: { flex: 1 },
  changesContent: { padding: 10, gap: 10 },
  changesTitle: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginBottom: 4 },
  changeCard: {
    borderRadius: 8, borderWidth: 1, overflow: "hidden",
  },
  changeHeader: {
    flexDirection: "row", alignItems: "center", gap: 6,
    padding: 10, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  changeFile: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  applyBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 5,
  },
  applyBtnTxt: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  appliedBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5 },
  appliedTxt: { fontSize: 12, fontFamily: "Inter_500Medium" },
  codePreview: { padding: 10, fontSize: 11, fontFamily: "monospace", lineHeight: 16 },
  logCard: { borderRadius: 8, borderWidth: 1, padding: 10, gap: 4 },
  logTitle: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },
  logLine: { fontSize: 12, fontFamily: "Inter_500Medium" },
  emptyArea: { flex: 1, padding: 16, alignItems: "center", justifyContent: "center", gap: 16 },
  welcomeTxt: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  quickBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 6, borderWidth: 1 },
  quickBtnTxt: { fontSize: 12, fontFamily: "Inter_400Regular" },
  messages: { flex: 1 },
  messagesContent: { padding: 10, gap: 10 },
  bubble: { borderRadius: 10, padding: 10, maxWidth: "92%" },
  userBubble: { alignSelf: "flex-end" },
  aiBubble: { alignSelf: "flex-start", borderWidth: 1 },
  aiLabel: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  aiLabelTxt: { fontSize: 10, fontFamily: "Inter_700Bold" },
  bubbleTxt: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  viewChangesBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 8, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 6, borderWidth: 1,
  },
  viewChangesTxt: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  timeTxt: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 4, textAlign: "right" },
  loadingRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1,
  },
  loadingTxt: { fontSize: 12, fontFamily: "Inter_400Regular" },
  inputRow: { borderTopWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  contextBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
    alignSelf: "flex-start", marginBottom: 4,
  },
  contextTxt: { fontSize: 10, fontFamily: "Inter_400Regular", maxWidth: 120 },
  inputArea: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  input: {
    flex: 1, fontSize: 13, fontFamily: "Inter_400Regular",
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1,
    maxHeight: 120, minHeight: 38,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  noKeyContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  noKeyTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  noKeyDesc: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 24 },
  settingsBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8,
  },
  settingsBtnTxt: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
