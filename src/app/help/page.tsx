import type { Metadata } from 'next';

import { Shell, PageHead } from '@/components/shell';
import { Icon } from '@/components/icon';
import { requireActor } from '@/lib/auth';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Help — GTS' };

/**
 * HELP — a plain-language, step-by-step manual.
 *
 * `requireActor`, not `requirePermission`: like /account, this is a page
 * every signed-in person may open regardless of role, since it explains
 * the system rather than exposing any of its data.
 */
export default async function HelpPage() {
  await requireActor();
  const dict = await t();
  const help = dict.help;

  return (
    <Shell active="/help" domain="admin">
      <main className="max-w-5xl mx-auto px-4 md:px-8 space-y-8">
        <PageHead overline={help.overline} title={help.title} lede={help.lede} />

        {/* Jump links to each topic */}
        <nav aria-label={help.tocTitle} className="bg-surface rounded-lg border border-line shadow-raised p-6">
          <h2 className="text-sm font-semibold text-fg uppercase tracking-wide mb-4">{help.tocTitle}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {help.topics.map((topic) => (
              <a
                key={topic.id}
                href={`#${topic.id}`}
                className="flex items-center gap-3 p-3 rounded-sm bg-inset hover:bg-hover transition-colors border border-line"
              >
                <Icon name={topic.icon} className="text-accent shrink-0" />
                <span className="text-sm font-medium text-fg">{topic.title}</span>
              </a>
            ))}
          </div>
        </nav>

        {/* Permission note */}
        <section className="bg-inset rounded-lg border border-line p-6 flex gap-4">
          <Icon name="info" className="text-info shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-fg mb-1">{help.permissionNoteTitle}</h3>
            <p className="text-sm text-fg-secondary max-w-prose">{help.permissionNoteBody}</p>
          </div>
        </section>

        {/* Topics */}
        <div className="space-y-6">
          {help.topics.map((topic) => (
            <section
              key={topic.id}
              id={topic.id}
              className="bg-surface rounded-lg border border-line shadow-raised p-6 scroll-mt-24"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="w-10 h-10 rounded-full bg-accent text-fg-on-accent flex items-center justify-center shrink-0">
                  <Icon name={topic.icon} filled />
                </span>
                <h2 className="text-lg font-semibold text-fg">{topic.title}</h2>
              </div>

              {topic.intro && <p className="text-sm text-fg-secondary mb-4 max-w-prose">{topic.intro}</p>}

              <ol className="flex flex-col gap-3 list-decimal ps-5">
                {topic.steps.map((step, i) => (
                  <li key={i} className="text-sm text-fg leading-relaxed max-w-prose">
                    {step}
                  </li>
                ))}
              </ol>

              {topic.note && (
                <p className="text-xs text-fg-secondary bg-inset border border-line rounded-sm p-3 mt-4 max-w-prose">
                  {topic.note}
                </p>
              )}
            </section>
          ))}
        </div>

        {/* Contact */}
        <section className="bg-surface rounded-lg border border-line shadow-raised p-6 text-center">
          <h2 className="text-lg font-semibold text-fg mb-2">{help.contactTitle}</h2>
          <p className="text-sm text-fg-secondary max-w-prose mx-auto">{help.contactBody}</p>
        </section>
      </main>
    </Shell>
  );
}
