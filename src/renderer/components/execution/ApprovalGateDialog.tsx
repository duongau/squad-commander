import { useState } from 'react';

interface Props {
  stepId: string;
  message: string;
  previousOutput?: string;
  onApprove: (stepId: string) => void;
  onReject: (stepId: string) => void;
}

export function ApprovalGateDialog({ stepId, message, previousOutput, onApprove, onReject }: Props) {
  const [deciding, setDeciding] = useState(false);

  const handleApprove = () => {
    setDeciding(true);
    onApprove(stepId);
  };

  const handleReject = () => {
    setDeciding(true);
    onReject(stepId);
  };

  return (
    <div className="gate-overlay">
      <div className="gate-dialog">
        <div className="gate-header">
          <span className="gate-icon">🖐️</span>
          <h3>Approval Required</h3>
        </div>

        <div className="gate-body">
          <div className="gate-message">
            <label>Gate Message</label>
            <p>{message}</p>
          </div>

          {previousOutput && (
            <div className="gate-output">
              <label>Previous Step Output</label>
              <pre>{previousOutput.slice(0, 2000)}{previousOutput.length > 2000 ? '\n...(truncated)' : ''}</pre>
            </div>
          )}
        </div>

        <div className="gate-actions">
          <button
            className="btn-primary gate-approve"
            onClick={handleApprove}
            disabled={deciding}
          >
            ✅ Approve & Continue
          </button>
          <button
            className="btn-danger gate-reject"
            onClick={handleReject}
            disabled={deciding}
          >
            ❌ Reject & Stop
          </button>
        </div>
      </div>
    </div>
  );
}
