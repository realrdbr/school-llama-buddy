import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, MessageSquare, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface ChatConversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatSidebarProps {
  currentConversationId?: string;
  onConversationSelect: (conversationId: string | null) => void;
  onNewChat: () => void;
}

const ChatSidebar = ({ currentConversationId, onConversationSelect, onNewChat }: ChatSidebarProps) => {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = async () => {
    if (!profile?.id) return;

    try {
      // Hole Konversationen über Edge Function (um RLS-Probleme zu vermeiden)
      const { data, error } = await supabase.functions.invoke('chat-service', {
        body: {
          action: 'list_conversations',
          profileId: userId,
        }
      });

      if (error) throw error;
      setConversations(data?.conversations || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast({
        title: "Fehler",
        description: "Chatverlauf konnte nicht geladen werden",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const { error } = await supabase
        .from('chat_conversations')
        .delete()
        .eq('id', conversationId);

      if (error) throw error;

      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
      
      if (currentConversationId === conversationId) {
        onConversationSelect(null);
      }

      toast({
        title: "Erfolg",
        description: "Chat wurde gelöscht"
      });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast({
        title: "Fehler",
        description: "Chat konnte nicht gelöscht werden",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [profile?.id]);

  if (loading) {
    return (
      <div className="w-80 border-r bg-card p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-10 bg-muted rounded"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-muted rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 border-r bg-card flex flex-col">
      <div className="p-4 border-b">
        <Button onClick={onNewChat} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Neuer Chat
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Keine Chats vorhanden</p>
              <p className="text-xs">Starten Sie einen neuen Chat</p>
            </div>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`p-3 rounded-lg cursor-pointer group transition-colors ${
                  currentConversationId === conversation.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
                onClick={() => onConversationSelect(conversation.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">
                      {conversation.title}
                    </h4>
                    <p className="text-xs opacity-70 mt-1">
                      {formatDistanceToNow(new Date(conversation.updated_at), {
                        addSuffix: true,
                        locale: de
                      })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 ${
                      currentConversationId === conversation.id 
                        ? 'hover:bg-primary-foreground/20' 
                        : 'hover:bg-destructive hover:text-destructive-foreground'
                    }`}
                    onClick={(e) => deleteConversation(conversation.id, e)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ChatSidebar;