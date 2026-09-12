import { getAgentPreferences } from "@/lib/data";
import SpeechHeader from "@/components/brand-voice/speech/SpeechHeader";
import SpeechProfilePanel from "@/components/brand-voice/speech/SpeechProfilePanel";
import SpeechNegativeVocabulary from "@/components/brand-voice/speech/SpeechNegativeVocabulary";
import SpeechVoiceSamples from "@/components/brand-voice/speech/SpeechVoiceSamples";
import SpeechCadenceSimulator from "@/components/brand-voice/speech/SpeechCadenceSimulator";

export default async function Page() {
  const prefs = await getAgentPreferences();

  return (
    <div className="flex flex-col w-full">
      <SpeechHeader />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter mb-gutter">
        <SpeechProfilePanel brandTone={prefs?.brand_tone ?? null} />
        <SpeechNegativeVocabulary phrases={prefs?.brand_forbidden_phrases ?? []} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        <SpeechVoiceSamples samples={prefs?.brand_samples ?? []} />
        <SpeechCadenceSimulator />
      </div>
    </div>
  );
}