import { ArrowLeft, Trash2 } from 'lucide-react';
import { TAG_COLORS, deleteTag, recolorTag, renameTag } from '../../data/tags';
import { toastWithUndo } from '../tasks/actions';
import { tagColor, useTags } from './useTags';
import styles from './TagSettings.module.css';

export function TagSettings({ onBack }: { onBack: () => void }) {
  const tags = useTags();
  return (
    <div className={styles.body}>
      <button type="button" className={styles.back} onClick={onBack}>
        <ArrowLeft size={20} strokeWidth={1.5} aria-hidden /> Tags
      </button>
      {tags.length === 0 && <p className={styles.empty}>Tags you create with # show up here.</p>}
      {tags.map((t) => (
        <div key={t.id} className={styles.tag}>
          <input
            className={styles.name}
            defaultValue={t.name}
            aria-label={`Rename ${t.name}`}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== t.name) void renameTag(t.id, v);
            }}
          />
          <div className={styles.colors} role="group" aria-label={`Colour for ${t.name}`}>
            {TAG_COLORS.map((c, i) => (
              <button
                key={c}
                type="button"
                className={`${styles.swatch} ${t.color === c ? styles.on : ''}`}
                style={{ background: tagColor(c) }}
                aria-label={`Colour ${i + 1}`}
                aria-pressed={t.color === c}
                onClick={() => void recolorTag(t.id, c)}
              />
            ))}
          </div>
          <button
            type="button"
            className={styles.del}
            aria-label={`Delete ${t.name}`}
            onClick={async () => {
              await deleteTag(t.id);
              toastWithUndo('Tag deleted');
            }}
          >
            <Trash2 size={20} strokeWidth={1.5} />
          </button>
        </div>
      ))}
    </div>
  );
}
