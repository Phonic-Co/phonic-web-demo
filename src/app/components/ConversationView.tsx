import { type ConversationItem } from "@phonic-web/sdk";

type ConversationViewProps = {
  conversationItems: ConversationItem[];
  isActive: boolean;
};

export function ConversationView({ conversationItems, isActive }: ConversationViewProps) {
  return (
    <div>
      <h3 className="text-sm font-medium mb-2">Conversation</h3>
      <div className="border rounded max-h-96 overflow-auto divide-y">
        {conversationItems.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">
            {isActive ? "Say something to start the conversation..." : "No conversation yet"}
          </div>
        ) : (
          conversationItems.map((item) => (
            <div key={item.itemIdx} className="p-3 flex gap-3">
              <span className={
                "shrink-0 uppercase text-xs font-semibold " + 
                (item.role === "user" ? "text-blue-600" : "text-emerald-600")
              }>
                {item.role}
              </span>
              <span className="text-sm whitespace-pre-wrap">
                {item.text === null ? "(listening...)" : item.text}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
