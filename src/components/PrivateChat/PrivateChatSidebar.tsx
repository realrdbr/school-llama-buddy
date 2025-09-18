import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface Conversation {
  id: string;
  user1_id: number;
  user2_id: number;
  updated_at: string;
  other_user: {
    id: number;
    name: string;
    username: string;
  };
  unread_count: number;
  last_message?: {
    content: string;
    created_at: string;
    sender_id: number;
  };
}

interface PrivateChatSidebarProps {
  currentConversationId?: string;
  onConversationSelect: (conversationId: string, otherUser: { id: number; name: string }) => void;
  onShowContacts: () => void;
}

export const PrivateChatSidebar: React.FC<PrivateChatSidebarProps> = ({
  currentConversationId,
  onConversationSelect,
  onShowContacts
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  useEffect(() => {
    if (profile?.id) {
      fetchConversations();
    }
  }, [profile?.id]);

  // Real-time updates for conversations
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel('private-conversations-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'private_conversations'
        },
        () => {
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'private_messages'
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const fetchConversations = async () => {
    if (!profile?.id) return;

    try {
      // Get conversations
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('private_conversations')
        .select('id, user1_id, user2_id, updated_at')
        .or(`user1_id.eq.${profile.id},user2_id.eq.${profile.id}`)
        .order('updated_at', { ascending: false });

      if (conversationsError) throw conversationsError;

      if (!conversationsData || conversationsData.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Get other users data and last messages
      const conversationsWithData = await Promise.all(
        conversationsData.map(async (conv) => {
          const otherUserId = conv.user1_id === profile.id ? conv.user2_id : conv.user1_id;
          
          // Get other user data
          const { data: userData } = await supabase
            .from('permissions')
            .select('id, name, username')
            .eq('id', otherUserId)
            .single();

          // Get last message
          const { data: lastMessage } = await supabase
            .from('private_messages')
            .select('content, created_at, sender_id')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Get unread count
          const { count: unreadCount } = await supabase
            .from('private_messages')
            .select('id', { count: 'exact' })
            .eq('conversation_id', conv.id)
            .eq('is_read', false)
            .neq('sender_id', profile.id);

          return {
            ...conv,
            other_user: userData || { id: otherUserId, name: 'Unbekannter Benutzer', username: 'unknown' },
            last_message: lastMessage,
            unread_count: unreadCount || 0
          };
        })
      );

      setConversations(conversationsWithData);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatMessagePreview = (message: string) => {
    return message.length > 50 ? message.substring(0, 50) + '...' : message;
  };

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Private Chats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 animate-pulse">
                <div className="w-10 h-10 bg-muted-foreground/20 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="w-3/4 h-4 bg-muted-foreground/20 rounded" />
                  <div className="w-1/2 h-3 bg-muted-foreground/20 rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Private Chats
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={onShowContacts}
            className="flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            Kontakte
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full">
          {conversations.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Noch keine Unterhaltungen</p>
              <p className="text-sm mt-1">Fügen Sie Kontakte hinzu, um zu chatten</p>
            </div>
          ) : (
            <div className="space-y-1 p-4">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors
                    ${currentConversationId === conversation.id 
                      ? 'bg-primary text-primary-foreground' 
                      : 'hover:bg-muted/50'
                    }
                  `}
                  onClick={() => onConversationSelect(conversation.id, conversation.other_user)}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="text-sm">
                      {getInitials(conversation.other_user.name)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="font-medium truncate">
                        {conversation.other_user.name}
                      </div>
                      <div className="flex items-center gap-2">
                        {conversation.unread_count > 0 && (
                          <Badge variant="destructive" className="text-xs px-2 py-0 min-w-[1.25rem] h-5">
                            {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                          </Badge>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(conversation.updated_at), { 
                            addSuffix: true, 
                            locale: de 
                          })}
                        </div>
                      </div>
                    </div>
                    
                    {conversation.last_message && (
                      <div className="text-sm text-muted-foreground truncate mt-1">
                        {conversation.last_message.sender_id === profile?.id ? 'Sie: ' : ''}
                        {formatMessagePreview(conversation.last_message.content)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};