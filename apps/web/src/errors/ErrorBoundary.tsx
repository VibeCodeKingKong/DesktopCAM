import { Component, type ReactNode } from 'react';
import { DICTS } from '../i18n/dicts';
import { initialLanguage } from '../i18n/initial';
import { report } from './reports';
import { ErrorPrompt } from './ErrorPrompt';

/**
 * Om gränssnittet kraschar: en enkel sida med Ladda om och möjlighet att
 * skicka en felrapport, i stället för en tom skärm. Projektet är autosparat.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error: unknown) {
    report('render', error);
  }

  render() {
    if (!this.state.crashed) return this.props.children;
    const t = (DICTS[(document.documentElement.lang as keyof typeof DICTS) || initialLanguage()] ?? DICTS[initialLanguage()]).crash;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-app p-6 text-center text-ink">
        <p className="text-lg font-semibold">{t.appCrashed}</p>
        <p className="max-w-md text-sm text-muted">{t.appCrashedBody}</p>
        <button className="btn btn-primary" onClick={() => location.reload()}>
          {t.reload}
        </button>
        <ErrorPrompt inline />
      </div>
    );
  }
}
