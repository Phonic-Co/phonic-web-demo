type StatusDisplayProps = {
  status: string;
  isCapturing: boolean;
  error?: string | null;
};

export function StatusDisplay({ status, isCapturing, error }: StatusDisplayProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Phonic Web Demo</h1>
        <div className="flex items-center gap-3">
          {isCapturing && (
            <span className="flex items-center gap-1 text-red-500 text-sm">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              Recording
            </span>
          )}
          <span className="text-sm text-gray-500">Status: {status}</span>
        </div>
      </div>
      
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          Microphone error: {error}
        </div>
      )}
    </>
  );
}
