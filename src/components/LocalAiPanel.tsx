import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Platform, Pressable, Text, View } from "react-native";

import { MODEL_FILENAME, type ExplanationLanguage } from "../local-ai/prompt";
import { LocalAiSession, getSavedModel, importModel, isLocalAiAvailable, type SavedModel } from "../local-ai/runtime";

type Phase = "importing" | "loading" | "generating" | "stopping" | "unloading" | null;
type Props = { reviewedText: string | null; disabled: boolean; onBusyChange: (busy: boolean) => void };
const languages: { value: ExplanationLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "fil", label: "Filipino" },
];

function Action({ label, disabled = false, primary = false, onPress }: {
  label: string; disabled?: boolean; primary?: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: disabled ? 0.45 : pressed ? 0.75 : 1 })}
      className={`min-h-12 justify-center rounded-lg border border-blue-700 px-4 py-3 ${primary ? "bg-blue-700" : "bg-white"}`}
    >
      <Text className={`text-center text-base font-semibold ${primary ? "text-white" : "text-blue-800"}`}>{label}</Text>
    </Pressable>
  );
}

export function LocalAiPanel({ reviewedText, disabled, onBusyChange }: Props) {
  const available = isLocalAiAvailable();
  const sessionRef = useRef<LocalAiSession | null>(null);
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const tokenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingText = useRef("");
  const [initialState] = useState(() => {
    try { return { model: available ? getSavedModel() : null, error: null }; }
    catch (cause) { return { model: null, error: cause instanceof Error ? cause.message : String(cause) }; }
  });
  const [model, setModel] = useState<SavedModel | null>(initialState.model);
  const [loaded, setLoaded] = useState(false);
  const [phase, setPhase] = useState<Phase>(null);
  const [explanation, setExplanation] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialState.error);
  const [language, setLanguage] = useState<ExplanationLanguage>("en");
  const [resultLanguage, setResultLanguage] = useState<ExplanationLanguage>("en");
  const [resultSource, setResultSource] = useState(reviewedText);
  const resultCurrent = resultSource === reviewedText && resultLanguage === language;
  const busy = phase !== null;
  const locked = disabled || busy;

  useEffect(() => {
    mounted.current = true;
    const session = new LocalAiSession();
    sessionRef.current = session;
    inFlight.current = false;
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") void session.stop().catch(() => undefined);
    });
    return () => {
      mounted.current = false;
      if (tokenTimer.current) clearTimeout(tokenTimer.current);
      tokenTimer.current = null;
      listener.remove();
      sessionRef.current = null;
      onBusyChange(false);
      void session.dispose().catch(() => undefined);
    };
  }, [available, onBusyChange]);

  useEffect(() => {
    if (tokenTimer.current) clearTimeout(tokenTimer.current);
    tokenTimer.current = null;
    pendingText.current = "";
  }, [reviewedText]);

  function current(session: LocalAiSession): boolean {
    return mounted.current && sessionRef.current === session;
  }

  async function run(nextPhase: NonNullable<Phase>, action: (session: LocalAiSession) => Promise<void>) {
    const session = sessionRef.current;
    if (!session || !available || disabled || inFlight.current) return;
    inFlight.current = true;
    onBusyChange(true);
    if (!resultCurrent) {
      setExplanation("");
      setNote(null);
    }
    setResultSource(reviewedText);
    setResultLanguage(language);
    setPhase(nextPhase);
    setError(null);
    try { await action(session); }
    catch (cause) {
      if (current(session)) {
        setError(cause instanceof Error ? cause.message : String(cause));
        if (nextPhase === "generating" && pendingText.current) {
          setExplanation(pendingText.current);
          setNote("Generation failed. The explanation above is unfinished.");
        }
      }
    } finally {
      if (current(session)) {
        inFlight.current = false;
        setPhase(null);
        onBusyChange(false);
      }
    }
  }

  function pickModel() {
    if (loaded) return;
    void run("importing", async (session) => {
      const selected = await importModel();
      if (selected && current(session)) {
        setModel(selected);
        setExplanation("");
        setNote(null);
      }
    });
  }

  function loadModel() {
    void run("loading", async (session) => {
      await session.load();
      if (current(session)) setLoaded(true);
    });
  }

  function unloadModel() {
    void run("unloading", async (session) => {
      await session.unload();
      if (current(session)) setLoaded(false);
    });
  }

  function explain() {
    if (!loaded || !reviewedText?.trim()) return;
    void run("generating", async (session) => {
      setExplanation("");
      setNote(null);
      pendingText.current = "";
      try {
        const result = await session.explain(reviewedText, (value) => {
          if (!current(session)) return;
          pendingText.current = value;
          // Bound React updates while tokens arrive; only this panel rerenders.
          if (!tokenTimer.current) {
            tokenTimer.current = setTimeout(() => {
              tokenTimer.current = null;
              if (current(session)) setExplanation(pendingText.current);
            }, 80);
          }
        }, language);
        if (!current(session)) return;
        setExplanation(result.text);
        setNote(result.stopped
          ? "Generation stopped. Any text above is an unfinished explanation."
          : result.limited ? "The answer reached its length limit and may be unfinished." : null);
      } finally {
        if (current(session)) {
          if (tokenTimer.current) clearTimeout(tokenTimer.current);
          tokenTimer.current = null;
        }
      }
    });
  }

  function chooseLanguage(next: ExplanationLanguage) {
    if (locked || inFlight.current || next === language) return;
    setLanguage(next);
    setExplanation("");
    setNote(null);
    setError(null);
    pendingText.current = "";
    if (tokenTimer.current) clearTimeout(tokenTimer.current);
    tokenTimer.current = null;
  }

  async function stop() {
    const session = sessionRef.current;
    if (!session || phase !== "generating") return;
    setPhase("stopping");
    try { await session.stop(); }
    catch (cause) {
      if (current(session) && inFlight.current) {
        setError(cause instanceof Error ? cause.message : String(cause));
        setPhase("generating");
      }
    }
  }

  const phaseLabel = phase === "importing" ? "Importing model…"
    : phase === "loading" ? "Loading model…"
    : phase === "generating" ? "Explaining your text…"
    : phase === "stopping" ? "Stopping…"
    : phase === "unloading" ? "Freeing model memory…" : null;

  return (
    <View className="gap-3 rounded-xl border border-slate-300 bg-white p-4">
      <Text accessibilityRole="header" className="text-lg font-semibold text-slate-900">Local AI explanation</Text>
      <Text className="text-base leading-6 text-slate-700">
        GabayAI explains your reviewed text in simple words. Everything runs on this phone.
      </Text>
      {!available ? (
        <Text accessibilityRole="alert" className="text-base leading-6 text-red-800">
          {Platform.OS !== "android" ? "Local explanations currently support Android." : "Update this Android development app to enable local explanations."}
        </Text>
      ) : (
        <>
          <Text className="text-base leading-6 text-slate-700">
            {model ? `${MODEL_FILENAME} · ${Math.round(model.bytes / 1024 / 1024)} MB · ${loaded ? "Ready" : "Saved on phone"}` : `Import ${MODEL_FILENAME} from your phone's storage. It is saved privately for future use.`}
          </Text>
          <Action label={model ? "Choose another model file" : "Import model file"} disabled={locked || loaded} onPress={pickModel} />
          {loaded ? (
            <Action label="Unload model to free memory" disabled={locked} onPress={unloadModel} />
          ) : (
            <Action label="Load model" disabled={locked || !model} onPress={loadModel} />
          )}
          <View className="gap-2">
            <Text className="text-base font-semibold text-slate-900">Explanation language</Text>
            <View accessibilityRole="radiogroup" className="flex-row gap-3">
              {languages.map((option) => {
                const selected = language === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityLabel={`${option.label} explanation`}
                    accessibilityState={{ checked: selected, disabled: locked }}
                    disabled={locked}
                    onPress={() => chooseLanguage(option.value)}
                    style={({ pressed }) => ({ opacity: locked ? 0.45 : pressed ? 0.75 : 1 })}
                    className={`min-h-12 flex-1 justify-center rounded-lg border border-blue-700 px-3 py-3 ${selected ? "bg-blue-700" : "bg-white"}`}
                  >
                    <Text className={`text-center text-base font-semibold ${selected ? "text-white" : "text-blue-800"}`}>
                      {selected ? "● " : "○ "}{option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text className="text-base leading-6 text-slate-700">
              {language === "fil" ? "Ipapaliwanag sa simpleng Filipino gamit ang maiikling pangungusap." : "Uses everyday words and short sentences."}
            </Text>
          </View>
          <Action label="Explain reviewed text" primary disabled={locked || !loaded || !reviewedText?.trim()} onPress={explain} />
          {!reviewedText?.trim() && <Text className="text-base leading-6 text-slate-700">Extract and review some text first.</Text>}
          {(phase === "generating" || phase === "stopping") && (
            <Action label={phase === "stopping" ? "Stopping…" : "Stop explanation"} disabled={phase === "stopping"} onPress={() => { void stop(); }} />
          )}
        </>
      )}
      {phaseLabel && (
        <View className="flex-row items-center gap-3">
          <ActivityIndicator accessibilityLabel={phaseLabel} />
          <Text accessibilityLiveRegion="polite" className="flex-1 text-base leading-6 text-slate-700">{phaseLabel}</Text>
        </View>
      )}
      {resultCurrent && error && <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" className="text-base leading-6 text-red-800">{error}</Text>}
      {resultCurrent && explanation && <Text selectable className="text-base leading-6 text-slate-900">{explanation}</Text>}
      {resultCurrent && note && <Text accessibilityLiveRegion="polite" className="text-base leading-6 text-slate-700">{note}</Text>}
      <Text className="text-base leading-6 text-slate-700">AI explanations can contain mistakes. Check them against the document.</Text>
    </View>
  );
}
