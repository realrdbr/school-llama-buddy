import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSessionRequest } from '@/hooks/useSessionRequest';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, Avatar as AvatarComponent, AvatarFallback } from '@/components/ui/avatar';
import { Search, UserPlus, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: number;
  username: string;
  name: string;
  permission_lvl: number;
}

interface Contact {
  id: string;
  contact_user_id: number;
  contact_user: User;
}

interface ContactSearchProps {
  onContactAdded: () => void;
  onStartChat: (userId: number, userName: string) => void;
}

export const ContactSearch: React.FC<ContactSearchProps> = ({ onContactAdded, onStartChat }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const { profile } = useAuth();
  const { withSession } = useSessionRequest();
  const { toast } = useToast();

  // Load existing contacts
  useEffect(() => {
    if (profile?.id) {
      loadContacts();
    }
  }, [profile?.id]);

  const loadContacts = async () => {
    try {
      const { data: contactsData, error: contactsError } = await supabase
        .from('user_contacts')
        .select('id, contact_user_id')
        .eq('status', 'active');

      if (contactsError) throw contactsError;

      if (!contactsData || contactsData.length === 0) {
        setContacts([]);
        return;
      }

      // Get user details for contacts
      const contactUserIds = contactsData.map(c => c.contact_user_id);
      const { data: usersData, error: usersError } = await supabase
        .from('permissions')
        .select('id, username, name, permission_lvl')
        .in('id', contactUserIds);

      if (usersError) throw usersError;

      // Combine contact and user data
      const contactsWithUsers = contactsData.map(contact => ({
        ...contact,
        contact_user: usersData?.find(user => user.id === contact.contact_user_id)
      })).filter(contact => contact.contact_user) as Contact[];

      setContacts(contactsWithUsers);
    } catch (error) {
      console.error('Error loading contacts:', error);
      toast({
        title: "Fehler",
        description: "Kontakte konnten nicht geladen werden",
        variant: "destructive",
      });
    }
  };

  // Search users
  useEffect(() => {
    const searchUsers = async () => {
      if (searchTerm.length < 2) {
        setSearchResults([]);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('permissions')
          .select('id, username, name, permission_lvl')
          .or(`username.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`)
          .neq('id', profile?.id || 0)
          .limit(10);

        if (error) throw error;
        
        // Filter out users that are already contacts
        const existingContactIds = contacts.map(c => c.contact_user_id);
        const filteredResults = (data || []).filter(user => 
          !existingContactIds.includes(user.id)
        );
        
        setSearchResults(filteredResults);
      } catch (error) {
        console.error('Error searching users:', error);
        setSearchResults([]);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, contacts, profile?.id]);

  const addContact = async (userId: number) => {
    if (!profile?.id) return;

    try {
      await withSession(async () => {
        const { error } = await supabase
          .from('user_contacts')
          .insert({
            user_id: profile.id,
            contact_user_id: userId,
            status: 'active'
          });

        if (error) throw error;
      });

      toast({
        title: "Kontakt hinzugefügt",
        description: "Der Benutzer wurde zu Ihren Kontakten hinzugefügt",
      });

      loadContacts();
      onContactAdded();
      
      // Remove from search results
      setSearchResults(prev => prev.filter(user => user.id !== userId));
    } catch (error) {
      console.error('Error adding contact:', error);
      toast({
        title: "Fehler",
        description: "Kontakt konnte nicht hinzugefügt werden",
        variant: "destructive",
      });
    }
  };

  const removeContact = async (contactId: string) => {
    try {
      await withSession(async () => {
        const { error } = await supabase
          .from('user_contacts')
          .delete()
          .eq('id', contactId);

        if (error) throw error;
      });

      toast({
        title: "Kontakt entfernt",
        description: "Der Kontakt wurde entfernt",
      });

      loadContacts();
    } catch (error) {
      console.error('Error removing contact:', error);
      toast({
        title: "Fehler",
        description: "Kontakt konnte nicht entfernt werden",
        variant: "destructive",
      });
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-4">
      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Benutzer suchen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nach Benutzername oder Name suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {loading && (
            <div className="mt-4 text-center text-muted-foreground">
              Suche...
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              {searchResults.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <AvatarComponent className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </AvatarComponent>
                    <div>
                      <div className="font-medium">{user.name}</div>
                      <div className="text-sm text-muted-foreground">@{user.username}</div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => addContact(user.id)}
                    className="flex items-center gap-2"
                  >
                    <UserPlus className="h-4 w-4" />
                    Hinzufügen
                  </Button>
                </div>
              ))}
            </div>
          )}

          {searchTerm.length >= 2 && !loading && searchResults.length === 0 && (
            <div className="mt-4 text-center text-muted-foreground">
              Keine Benutzer gefunden
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contacts Section */}
      <Card>
        <CardHeader>
          <CardTitle>Meine Kontakte ({contacts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              Noch keine Kontakte hinzugefügt
            </div>
          ) : (
            <div className="space-y-2">
              {contacts.map((contact) => (
                <div key={contact.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <AvatarComponent className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {getInitials(contact.contact_user.name)}
                      </AvatarFallback>
                    </AvatarComponent>
                    <div>
                      <div className="font-medium">{contact.contact_user.name}</div>
                      <div className="text-sm text-muted-foreground">@{contact.contact_user.username}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => onStartChat(contact.contact_user_id, contact.contact_user.name)}
                    >
                      Chat starten
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeContact(contact.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};