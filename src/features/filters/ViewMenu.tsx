import { useState } from 'react';
import { Sheet } from '../../ui/Sheet';
import { Chip } from '../../ui/Chip';
import { useView } from '../../app/views';
import type { SortMode } from '../../domain/sort';
import { useSettings, type Theme } from '../../app/settings';
import { Segmented } from '../../ui/Segmented';
import { useToast } from '../../ui/Toast';
import { TagSettings } from './TagSettings';
import { SyncSection } from '../sync/SyncSection';
import { tagColor, useTags } from './useTags';
import styles from './ViewMenu.module.css';

const SORTS: { id: SortMode; label: string }[] = [
  { id: 'smart', label: 'Smart' },
  { id: 'urgency', label: 'Urgency' },
  { id: 'effort', label: 'Effort' },
  { id: 'due', label: 'Due date' },
  { id: 'manual', label: 'Manual' },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

/** One quiet place for sort, tag filter, Done and tag settings. */
export function ViewMenu({ open, onClose }: Props) {
  const { view, setView, sort, setSort, reverseEffort, toggleReverseEffort, tagFilter, setTagFilter } = useView();
  const tags = useTags();
  const { theme, setTheme } = useSettings();
  const [page, setPage] = useState<'main' | 'tags'>('main');
  const current = sort[view] ?? 'smart';
  const selected = tagFilter[view] ?? [];

  const close = () => {
    setPage('main');
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} title="View options">
      {page === 'tags' ? (
        <TagSettings onBack={() => setPage('main')} />
      ) : (
        <div className={styles.body}>
          {view !== 'done' && view !== 'inbox' && (
            <section aria-label="Sort">
              <h2 className={styles.h}>Sort</h2>
              <div className={styles.row}>
                {SORTS.map((s) => (
                  <Chip key={s.id} selected={current === s.id} onClick={() => setSort(view, s.id)}>
                    {s.label}
                  </Chip>
                ))}
              </div>
              {current === 'effort' && (
                <button type="button" className={styles.link} onClick={toggleReverseEffort}>
                  {reverseEffort ? 'Quick first' : 'Deep first'}
                </button>
              )}
            </section>
          )}
          {tags.length > 0 && (
            <section aria-label="Filter by tag">
              <h2 className={styles.h}>Filter</h2>
              <div className={styles.row}>
                {tags.map((t) => (
                  <Chip
                    key={t.id}
                    color={tagColor(t.color)}
                    selected={selected.includes(t.id)}
                    onClick={() =>
                      setTagFilter(view, selected.includes(t.id) ? selected.filter((x) => x !== t.id) : [...selected, t.id])
                    }
                  >
                    #{t.name}
                  </Chip>
                ))}
              </div>
            </section>
          )}
          <section aria-label="Theme">
            <h2 className={styles.h}>Theme</h2>
            <Segmented<Theme>
              label="Theme"
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'System' },
              ]}
            />
          </section>
          <SyncSection />
          <section className={styles.links}>
            <button
              type="button"
              className={styles.link}
              onClick={() => {
                setView('done');
                close();
              }}
            >
              Done
            </button>
            <button type="button" className={styles.link} onClick={() => setPage('tags')}>
              Tags
            </button>
            <button
              type="button"
              className={styles.link}
              onClick={async () => {
                const url = URL.createObjectURL(new Blob([await (await import("../../data/backup")).exportJson()], { type: "application/json" }));
                const a = document.createElement("a");
                a.href = url;
                a.download = `clear-backup-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export backup
            </button>
            <label className={styles.link}>
              Import backup
              <input
                type="file"
                accept="application/json"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const r = await (await import("../../data/backup")).importJson(await file.text());
                    useToast.getState().show(`Imported ${r.tasks} tasks`);
                  } catch {
                    useToast.getState().show("That file is not a Clear backup");
                  }
                  e.target.value = "";
                }}
              />
            </label>
          </section>
        </div>
      )}
    </Sheet>
  );
}
