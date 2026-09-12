import IntakeHeader from "@/components/source-intake/IntakeHeader";
import DropZone from "@/components/source-intake/DropZone";
import UrlFetchBar from "@/components/source-intake/UrlFetchBar";
import IntakeProtocol from "@/components/source-intake/IntakeProtocol";
import IngestionList from "@/components/source-intake/IngestionList";
import { getSourcesWithOutputs } from "@/lib/data";

export default async function Page() {
  const sources = await getSourcesWithOutputs(30);
  return (
    <div className="flex flex-col w-full">
      <IntakeHeader />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg mb-space-xl">
        <div className="lg:col-span-8 flex flex-col justify-between p-space-xl bg-surface-container-lowest rounded-xl shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/5 via-transparent to-transparent pointer-events-none rounded-tr-xl"></div>
          <DropZone />
          <UrlFetchBar />
        </div>
        <IntakeProtocol />
      </div>
      <IngestionList sources={sources} />
    </div>
  );
}