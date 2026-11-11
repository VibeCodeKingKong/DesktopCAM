/**
 * Rundtur för nybörjare: går igenom arbetsflödet steg för steg och markerar
 * delarna i gränssnittet. driver.js (MIT) sköter markeringen och rutan;
 * bilderna är egna animerade SVG:er (TourArt.tsx).
 *
 * Startar av sig själv första gången appen öppnas (inte för den som redan har
 * ett sparat projekt) och kan alltid startas om med ?-knappen i sidhuvudet.
 */
import { driver, type DriveStep, type Side } from 'driver.js';
import 'driver.js/dist/driver.css';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getT } from '../i18n';
import { useAppStore, type RibbonTabId } from '../store/useAppStore';
import { ArtDesign, ArtDone, ArtOutput, ArtProperties, ArtSetup, ArtSimulate, ArtToolpaths, ArtViewport, ArtWelcome } from './TourArt';

const DONE_KEY = 'desktopcam.tourDone';

/** Elementet om det syns (paneler är dolda på små skärmar) – annars visas rutan mitt på skärmen. */
const visible = (selector: string) => () => {
  const el = document.querySelector(selector);
  return (el && (el as HTMLElement).offsetParent !== null ? el : undefined) as Element;
};

const html = (art: ComponentType, body: string) => `<div class="tour-art">${renderToStaticMarkup(createElement(art))}</div><p>${body}</p>`;

type Key = keyof ReturnType<typeof getT>['tour']['steps'];

export function startTour() {
  const t = getT().tour;
  const store = useAppStore.getState();
  store.openDialog(null);
  store.setMobilePanel(null);
  const prevTab = store.activeTab;

  const step = (key: Key, art: ComponentType, element?: string, side: Side = 'bottom', tab?: RibbonTabId): DriveStep => ({
    element: element ? visible(element) : undefined,
    onHighlightStarted: tab ? () => useAppStore.getState().setTab(tab) : undefined,
    popover: { title: t.steps[key].title, description: html(art, t.steps[key].body), side, align: 'start' },
  });

  const tour = driver({
    showProgress: true,
    allowClose: true,
    smoothScroll: true,
    stagePadding: 6,
    stageRadius: 8,
    popoverClass: 'dc-tour',
    nextBtnText: t.next,
    prevBtnText: t.prev,
    doneBtnText: t.done,
    progressText: t.progress,
    steps: [
      step('welcome', ArtWelcome),
      step('beginner', ArtProperties, '[data-tour="beginner"]', 'bottom'),
      step('setup', ArtSetup, '[data-tour="ribbon"]', 'bottom', 'setup'),
      step('design', ArtDesign, '[data-tour="ribbon"]', 'bottom', 'design'),
      step('toolpaths', ArtToolpaths, '[data-tour="ribbon"]', 'bottom', 'toolpaths'),
      step('viewport', ArtViewport, '[data-tour="viewport"]', 'top'),
      step('properties', ArtProperties, '[data-tour="panel-props"]', 'left'),
      step('simulate', ArtSimulate, '[data-tour="ribbon"]', 'bottom', 'simulate'),
      step('output', ArtOutput, '[data-tour="ribbon"]', 'bottom', 'output'),
      step('done', ArtDone, '[data-tour="help"]', 'bottom'),
    ],
    onDestroyed: () => {
      try {
        localStorage.setItem(DONE_KEY, '1');
      } catch {
        /* privat läge */
      }
      useAppStore.getState().setTab(prevTab === 'file' ? 'design' : prevTab);
    },
  });
  // Bandet ska vara utfällt så att markeringen får rätt storlek.
  store.setTab('setup');
  tour.drive();
}

/**
 * Ny användare? Avgörs när modulen laddas – innan autosparning och
 * nyhetsrutan hunnit skriva i localStorage.
 */
const NEW_USER = (() => {
  try {
    return !localStorage.getItem(DONE_KEY) && !localStorage.getItem('desktopcam.autosave.v1') && !localStorage.getItem('desktopcam.seenVersion');
  } catch {
    return false;
  }
})();

/** Startar rundturen för nya användare. Returnerar en timer att avbryta. */
export function maybeStartTour(): ReturnType<typeof setTimeout> | undefined {
  if (!NEW_USER) return undefined;
  return setTimeout(() => {
    if (!useAppStore.getState().dialog) startTour();
  }, 900);
}
