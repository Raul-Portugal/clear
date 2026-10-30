import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { X } from 'lucide-react';
import { getAudio } from '../../data/audio';
import styles from './ClipPlayer.module.css';

interface Props {
  audioId: string;
  label: string;
  onRemove?: () => void;
}

/** Plays back one stored voice recording with the browser's own accessible controls. */
export function ClipPlayer({ audioId, label, onRemove }: Props) {
  const [url, setUrl] = useState<string>();

  // Live, so a recording downloaded by sync appears without reopening.
  useEffect(() => {
    let made: string | undefined;
    const sub = liveQuery(() => getAudio(audioId)).subscribe({
      next: (blob) => {
        if (made) URL.revokeObjectURL(made);
        made = blob ? URL.createObjectURL(blob) : undefined;
        setUrl(made);
      },
      error: () => {},
    });
    return () => {
      sub.unsubscribe();
      if (made) URL.revokeObjectURL(made);
    };
  }, [audioId]);

  if (!url) return null;
  return (
    <div className={styles.clip}>
      <audio controls preload="metadata" src={url} aria-label={label} className={styles.audio} />
      {onRemove && (
        <button type="button" className={styles.remove} aria-label={`Remove ${label}`} onClick={onRemove}>
          <X size={16} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
