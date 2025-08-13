type ConversationControlsProps = {
  onStart: () => void;
  onStop: () => void;
  canStart: boolean;
  isActive: boolean;
};

export function ConversationControls({ 
  onStart, 
  onStop, 
  canStart, 
  isActive 
}: ConversationControlsProps) {
  return (
    <div className="flex gap-3">
      <button 
        onClick={onStart} 
        disabled={!canStart}
        className="px-4 py-2 rounded bg-black text-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Start call
      </button>
      <button 
        onClick={onStop} 
        disabled={!isActive}
        className="px-4 py-2 rounded border disabled:opacity-50 disabled:cursor-not-allowed"
      >
        End call
      </button>
    </div>
  );
}
