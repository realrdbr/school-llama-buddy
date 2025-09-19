import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSessionRequest } from '@/hooks/useSessionRequest';
import { useEnhancedPermissions } from '@/hooks/useEnhancedPermissions';
import { supabase } from '@/integrations/supabase/client';
import { PrivateChatSidebar } from '@/components/PrivateChat/PrivateChatSidebar';
import { PrivateChat } from '@/components/PrivateChat/PrivateChat';
import { ContactSearch } from '@/components/PrivateChat/ContactSearch';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type View = 'sidebar' | 'chat' | 'contacts';

interface CurrentChat {
  conversationId: string;
  otherUser: {
    id: number;
    name: string;
  };
}

const PrivateMessaging = () => {
  const [currentView, setCurrentView] = useState<View>('sidebar');
  const [currentChat, setCurrentChat] = useState<CurrentChat | null>(null);
  const { profile } = useAuth();
  const { withSession } = useSessionRequest();
  const { hasPermission } = useEnhancedPermissions();
  const navigate = useNavigate();

  // Check if user has private messages permission
  if (!profile || !hasPermission('private_messages')) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Zugriff verweigert</h2>
          <p className="text-muted-foreground">Sie benötigen die Berechtigung für private Nachrichten, um die Chat-Funktion zu nutzen.</p>
        </div>
      </div>
    );
  }

  const handleConversationSelect = (conversationId: string, otherUser: { id: number; name: string }) => {
    setCurrentChat({ conversationId, otherUser });
    setCurrentView('chat');
  };

  const handleShowContacts = () => {
    setCurrentView('contacts');
  };

  const handleContactAdded = () => {
    // Refresh conversations when a contact is added
    setCurrentView('sidebar');
  };

  const handleStartChat = async (userId: number, userName: string) => {
    // Create or get conversation with this user
    try {
      console.log('🚀 Starting chat with user:', { userId, userName, currentUserId: profile?.id });
      
      if (!profile?.id) {
        console.error('❌ No current user profile');
        return;
      }

      const conversationId = await withSession(async () => {
        // Determine user order (smaller ID first for consistency)
        const currentUserId = profile.id;
        const user1Id = currentUserId < userId ? currentUserId : userId;
        const user2Id = currentUserId < userId ? userId : currentUserId;

        console.log('🔍 Looking for existing conversation:', { user1Id, user2Id });

        // First, try to find existing conversation
        const { data: existingConversation, error: searchError } = await supabase
          .from('private_conversations')
          .select('id')
          .eq('user1_id', user1Id)
          .eq('user2_id', user2Id)
          .single();

        if (searchError && searchError.code !== 'PGRST116') { // PGRST116 = no rows found
          console.error('❌ Error searching for conversation:', searchError);
          throw searchError;
        }

        if (existingConversation) {
          console.log('✅ Found existing conversation:', existingConversation.id);
          return existingConversation.id;
        }

        // Create new conversation
        console.log('🆕 Creating new conversation');
        const { data: newConversation, error: createError } = await supabase
          .from('private_conversations')
          .insert({
            user1_id: user1Id,
            user2_id: user2Id
          })
          .select('id')
          .single();

        if (createError) {
          console.error('❌ Error creating conversation:', createError);
          throw createError;
        }

        console.log('✅ Created new conversation:', newConversation.id);
        return newConversation.id;
      });

      console.log('✅ Setting up chat with conversation:', conversationId);
      
      setCurrentChat({
        conversationId,
        otherUser: { id: userId, name: userName }
      });
      setCurrentView('chat');
      
      console.log('✅ Chat setup complete');
    } catch (error) {
      console.error('❌ Error starting chat:', error);
      // Add user-friendly error handling
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      console.error('Chat konnte nicht gestartet werden:', errorMessage);
    }
  };

  const handleBack = () => {
    setCurrentView('sidebar');
    setCurrentChat(null);
  };

  return (
    <div className="container mx-auto p-6 h-[calc(100vh-6rem)]">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/')}
          className="flex items-center gap-2"
        >
          <Home className="h-4 w-4" />
          Startseite
        </Button>
        <h1 className="text-2xl font-bold">Private Nachrichten</h1>
      </div>
      
      <div className="h-full max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          {/* Sidebar - Always visible on desktop, conditional on mobile */}
          <div className={`
            ${currentView === 'sidebar' ? 'block' : 'hidden lg:block'}
            lg:col-span-1 h-full
          `}>
            <PrivateChatSidebar
              currentConversationId={currentChat?.conversationId}
              onConversationSelect={handleConversationSelect}
              onShowContacts={handleShowContacts}
            />
          </div>

          {/* Main Content Area */}
          <div className={`
            ${currentView === 'sidebar' ? 'hidden lg:block' : 'block'}
            lg:col-span-2 h-full
          `}>
            {currentView === 'chat' && currentChat ? (
              <PrivateChat
                conversationId={currentChat.conversationId}
                otherUser={currentChat.otherUser}
                onBack={handleBack}
              />
            ) : currentView === 'contacts' ? (
              <div className="h-full">
                <ContactSearch
                  onContactAdded={handleContactAdded}
                  onStartChat={handleStartChat}
                />
                <div className="mt-4">
                  <button
                    onClick={handleBack}
                    className="text-primary hover:underline"
                  >
                    ← Zurück zu den Chats
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center bg-muted/10 rounded-lg border-2 border-dashed border-muted-foreground/20">
                <div className="text-center text-muted-foreground">
                  <div className="text-lg font-medium mb-2">Willkommen beim privaten Chat</div>
                  <div>Wählen Sie eine Unterhaltung aus oder fügen Sie neue Kontakte hinzu</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivateMessaging;