import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageCircle, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UnreadMessage {
  conversation_id: string;
  sender: {
    id: number;
    name: string;
    username: string;
  };
  message_count: number;
  last_message: {
    content: string;
    created_at: string;
  };
}

export const MessageNotificationWidget: React.FC = () => {
  const [unreadMessages, setUnreadMessages] = useState<UnreadMessage[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (profile?.id) {
      fetchUnreadMessages();
    }
  }, [profile?.id]);

  // Real-time updates for new messages
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel('unread-message-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'private_messages'
        },
        (payload) => {
          // Only count messages not sent by current user
          if (payload.new.sender_id !== profile.id) {
            fetchUnreadMessages();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'private_messages'
        },
        () => {
          fetchUnreadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const fetchUnreadMessages = async () => {
    if (!profile?.id) return;

    try {
      // Get all conversations user is part of
      const { data: conversations, error: convError } = await supabase
        .from('private_conversations')
        .select('id, user1_id, user2_id')
        .or(`user1_id.eq.${profile.id},user2_id.eq.${profile.id}`);

      if (convError) throw convError;

      if (!conversations || conversations.length === 0) {
        setUnreadMessages([]);
        setTotalUnread(0);
        setLoading(false);
        return;
      }

      // Get unread messages for each conversation
      const unreadData = await Promise.all(
        conversations.map(async (conv) => {
          const otherUserId = conv.user1_id === profile.id ? conv.user2_id : conv.user1_id;

          // Get unread message count
          const { count } = await supabase
            .from('private_messages')
            .select('id', { count: 'exact' })
            .eq('conversation_id', conv.id)
            .eq('is_read', false)
            .neq('sender_id', profile.id);

          if (!count || count === 0) return null;

          // Get sender info
          const { data: senderData } = await supabase
            .from('permissions')
            .select('id, name, username')
            .eq('id', otherUserId)
            .single();

          // Get last unread message
          const { data: lastMessage } = await supabase
            .from('private_messages')
            .select('content, created_at')
            .eq('conversation_id', conv.id)
            .eq('is_read', false)
            .neq('sender_id', profile.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            conversation_id: conv.id,
            sender: senderData || { id: otherUserId, name: 'Unbekannt', username: 'unknown' },
            message_count: count,
            last_message: lastMessage || { content: '', created_at: new Date().toISOString() }
          };
        })
      );

      const validUnreadData = unreadData.filter(Boolean) as UnreadMessage[];
      const total = validUnreadData.reduce((sum, item) => sum + item.message_count, 0);

      setUnreadMessages(validUnreadData);
      setTotalUnread(total);
    } catch (error) {
      console.error('Error fetching unread messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatMessagePreview = (message: string) => {
    return message.length > 40 ? message.substring(0, 40) + '...' : message;
  };

  const handleOpenMessages = () => {
    navigate('/private-messages');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Nachrichten
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-3 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Nachrichten
            {totalUnread > 0 && (
              <Badge variant="destructive" className="text-xs px-2 py-0">
                {totalUnread > 99 ? '99+' : totalUnread}
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenMessages}
            className="h-8 px-2"
          >
            <Users className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {totalUnread === 0 ? (
          <div className="text-sm text-muted-foreground">
            Keine neuen Nachrichten
          </div>
        ) : (
          <div className="space-y-3">
            {unreadMessages.slice(0, 3).map((item) => (
              <div
                key={item.conversation_id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={handleOpenMessages}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {getInitials(item.sender.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm truncate">
                      {item.sender.name}
                    </div>
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      {item.message_count}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">
                    {formatMessagePreview(item.last_message.content)}
                  </div>
                </div>
              </div>
            ))}
            
            {unreadMessages.length > 3 && (
              <div className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenMessages}
                  className="text-xs h-8"
                >
                  +{unreadMessages.length - 3} weitere...
                </Button>
              </div>
            )}
          </div>
        )}
        
        {totalUnread > 0 && (
          <div className="mt-3 pt-3 border-t">
            <Button
              onClick={handleOpenMessages}
              size="sm"
              className="w-full"
            >
              Alle Nachrichten öffnen
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};