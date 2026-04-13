import { useState, useRef, useCallback, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { useSquadStore } from '../../stores/squad-store';
import type { Agent } from '../../../shared/types';

interface Props {
  agent: Agent;
  onClose: () => void;
}

export function CharterEditor({ agent, onClose }: Props) {
  const [content, setContent] = useState(agent.charterContent || '');
  const [saved, setSaved] = useState(true);
  const [preview, setPreview] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { updateAgent } = useSquadStore();

  // Autosave after 800ms idle
  const handleChange = useCallback(
    (value: string | undefined) => {
      const newContent = value || '';
      setContent(newContent);
      setSaved(false);

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(async () => {
        try {
          await updateAgent(agent.name, newContent);
          setSaved(true);
        } catch (err) {
          console.error('Autosave failed:', err);
        }
      }, 800);
    },
    [agent.name, updateAgent]
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="charter-editor">
      <div className="charter-editor-header">
        <div className="charter-editor-title">
          <h3>{agent.name}</h3>
          <span className="charter-editor-role">{agent.role}</span>
          <span className={`save-status ${saved ? 'saved' : 'unsaved'}`}>
            {saved ? '✓ Saved' : '● Unsaved'}
          </span>
        </div>
        <div className="charter-editor-actions">
          <button
            className={`btn-small ${preview ? 'active' : ''}`}
            onClick={() => setPreview(!preview)}
          >
            {preview ? '✏️ Edit' : '👁️ Preview'}
          </button>
          <button className="btn-icon" onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      <div className="charter-editor-body">
        {preview ? (
          <div className="charter-preview-pane">
            <pre>{content}</pre>
          </div>
        ) : (
          <Editor
            height="100%"
            defaultLanguage="markdown"
            value={content}
            onChange={handleChange}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              wordWrap: 'on',
              fontSize: 13,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              padding: { top: 8 },
            }}
          />
        )}
      </div>
    </div>
  );
}
