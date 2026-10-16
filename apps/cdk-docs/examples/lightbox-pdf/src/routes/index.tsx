import { signal } from "@rivetjs/reactivity";
import { Lightbox, LightboxCarousel, LightboxClose, LightboxToolbar, type LightboxSlide } from "@rivetjs/cdk/lightbox";
import { LightboxPdf } from "@rivetjs/cdk/lightbox/pdf";
import { FileText, X } from "lucide";
import { Icon } from "../components/Icon.tsx";
import sample from "../assets/lightbox-sample.pdf?url";

export const head = { title: "Lightbox PDF slide" };

const slides: LightboxSlide[] = [{ type: "pdf", src: sample, title: "Sample document", width: 420, height: 595 }];

// #region demo
export default function PdfLightbox() {
  const open = signal(false);
  return (
    <div class="m-4">
      <button
        id="open"
        type="button"
        class="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 font-medium"
        onClick={() => open.set(true)}
      >
        <Icon icon={FileText} size={18} />
        Sample document
      </button>
      <Lightbox isOpen={open} slides={slides} aria-label="Document" overlayClass="z-50 bg-black/90" class="text-white">
        {() => (
          <>
            <LightboxCarousel>
              {() => (
                <LightboxPdf
                  class="rounded-xl bg-white"
                  fallbackClass="flex h-full flex-col items-center justify-center gap-3 rounded-xl bg-white p-6 text-slate-900"
                  fallback={<span>Download the PDF</span>}
                />
              )}
            </LightboxCarousel>
            <LightboxToolbar class="absolute end-0 top-0 z-10 flex gap-2 p-3 [grid-area:main]">
              <LightboxClose class="inline-flex size-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-0">
                <Icon icon={X} size={20} />
              </LightboxClose>
            </LightboxToolbar>
          </>
        )}
      </Lightbox>
    </div>
  );
}
// #endregion
