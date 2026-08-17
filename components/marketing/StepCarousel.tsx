"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { StepBadge } from "@/components/ui/StepBadge";
import { cn } from "@/lib/utils/cn";

export interface CarouselStep {
  icon: LucideIcon;
  title: string;
  description: string;
}

interface StepCarouselProps {
  steps: CarouselStep[];
  /** Accessible name for the scrollable region — what's being stepped through, not just "carousel". */
  label: string;
}

/**
 * A native scroll-snap carousel, not a JS-positioned slider: every step's
 * full text stays in the DOM (a screen reader or Tab-only user can read all
 * of it in document order regardless of the controls below), and dragging/
 * swiping/arrow-key-scrolling the track all work for free. The prev/next
 * buttons and dots are a layer on top.
 *
 * A few things that looked like they'd "just work" and didn't — each found
 * by instrumenting the live scrollLeft and every slide's position rather
 * than assuming, since each fix looked plausible right up until it wasn't:
 * - Tracking the active slide via IntersectionObserver: its threshold-
 *   crossing entries are only the elements that changed since the last
 *   firing, not a live snapshot of every slide's current visibility, so
 *   picking the "highest ratio among this batch's entries" picked a stale
 *   outgoing slide.
 * - scroll-snap-type pulling a JS-driven scroll off target: even `proximity`
 *   nudged a precise scrollTo toward a neighboring slide's snap point
 *   mid-animation. Fixed by suspending snap for the duration of just that
 *   one programmatic scroll (a plain property set doesn't take effect
 *   before scrollTo reads it in the same tick, so a forced reflow sits
 *   between them) and restoring it afterward — real swipes never go
 *   through this code path, so they keep snapping normally.
 * - Picking "active" by widest visible slide, rather than by distance to
 *   center: with a narrower card this track could show more than one fully
 *   at once, so a neighboring slide could out-visible the one actually
 *   centered — "centered" and "most visible" aren't the same position once
 *   more than one card fits. Sized each card to make one clearly dominant
 *   instead of fighting that ambiguity in JS, and matched computeActive's
 *   metric to the same expression goTo centers on — except at the two
 *   ends, which can never be perfectly centered (there's no more track to
 *   scroll into on one side), checked directly against scrollLeft first.
 */
export function StepCarousel({ steps, label }: StepCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const snapRestoreTimeout = useRef<number | undefined>(undefined);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let raf = 0;
    function computeActive() {
      if (!track) return;
      const maxScrollLeft = track.scrollWidth - track.clientWidth;
      if (track.scrollLeft <= 1) {
        setActiveIndex(0);
        return;
      }
      if (track.scrollLeft >= maxScrollLeft - 1) {
        setActiveIndex(steps.length - 1);
        return;
      }
      let bestIndex = 0;
      let bestDistance = Infinity;
      slideRefs.current.forEach((el, index) => {
        if (!el) return;
        const centeredLeft = el.offsetLeft - (track.clientWidth - el.clientWidth) / 2;
        const distance = Math.abs(centeredLeft - track.scrollLeft);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });
      setActiveIndex(bestIndex);
    }
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(computeActive);
    }

    computeActive();
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [steps.length]);

  useEffect(() => {
    return () => window.clearTimeout(snapRestoreTimeout.current);
  }, []);

  function goTo(index: number) {
    const clamped = Math.max(0, Math.min(steps.length - 1, index));
    const track = trackRef.current;
    const slide = slideRefs.current[clamped];
    if (!track || !slide) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Centers `slide` in the track, then clamps to the track's real
    // scrollable range — the first/last slide can't ever be truly centered.
    const centeredLeft = slide.offsetLeft - (track.clientWidth - slide.clientWidth) / 2;
    const maxScrollLeft = track.scrollWidth - track.clientWidth;
    const finalLeft = Math.max(0, Math.min(maxScrollLeft, centeredLeft));

    track.style.scrollSnapType = "none";
    void track.offsetWidth; // force the style to apply before scrollTo reads it
    track.scrollTo({ left: finalLeft, behavior: prefersReducedMotion ? "auto" : "smooth" });

    window.clearTimeout(snapRestoreTimeout.current);
    function restoreSnap() {
      track!.style.scrollSnapType = "";
      track!.removeEventListener("scrollend", restoreSnap);
      window.clearTimeout(snapRestoreTimeout.current);
    }
    // scrollend (not a fixed delay) is what lets this cover both a short
    // hop and a long one (e.g. last slide back to first) — a fixed
    // timeout short enough to feel snappy on the former re-enabled snap
    // mid-animation on the latter, which pulled the still-moving scroll
    // toward whatever point was nearest at that exact moment. The timeout
    // below is only a fallback for browsers/cases where scrollend never
    // fires.
    track.addEventListener("scrollend", restoreSnap, { once: true });
    snapRestoreTimeout.current = window.setTimeout(restoreSnap, prefersReducedMotion ? 200 : 1500);
  }

  return (
    <div className="mt-10">
      <div
        ref={trackRef}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="stagger flex snap-x snap-proximity gap-4 overflow-x-auto pb-2 motion-safe:scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] [&::-webkit-scrollbar]:hidden"
      >
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div
              key={step.title}
              ref={(el) => {
                slideRefs.current[index] = el;
              }}
              className="w-[85%] shrink-0 snap-center sm:w-[26rem]"
            >
              <Card className="h-full">
                <CardBody className="space-y-3">
                  <div className="flex items-center gap-3">
                    <StepBadge step={index + 1} size="md" />
                    <Icon className="size-5 text-brand" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{step.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </CardBody>
              </Card>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => goTo(activeIndex - 1)}
          disabled={activeIndex === 0}
          aria-label="Previous step"
          className="grid size-9 place-items-center rounded-xl border border-border text-secondary transition-all duration-200 hover:border-border-strong hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <div className="flex items-center gap-1.5">
          {steps.map((step, index) => (
            <button
              key={step.title}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Go to step ${index + 1}: ${step.title}`}
              aria-current={index === activeIndex}
              className={cn(
                "h-1.5 rounded-full transition-all duration-200",
                index === activeIndex ? "w-5 bg-brand" : "w-1.5 bg-border hover:bg-border-strong"
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => goTo(activeIndex + 1)}
          disabled={activeIndex === steps.length - 1}
          aria-label="Next step"
          className="grid size-9 place-items-center rounded-xl border border-border text-secondary transition-all duration-200 hover:border-border-strong hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
