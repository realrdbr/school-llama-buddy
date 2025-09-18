import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedPermissions } from '@/hooks/useEnhancedPermissions';
import { supabase } from '@/integrations/supabase/client';
import { useSessionRequest } from '@/hooks/useSessionRequest';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Book, 
  Search, 
  Plus, 
  BookOpen, 
  Clock, 
  Users, 
  ArrowLeft,
  ScanLine,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  Edit,
  Trash2,
  UserSearch
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface BookType {
  id: string;
  isbn?: string;
  title: string;
  author: string;
  publisher?: string;
  publication_year?: number;
  genre?: string;
  total_copies: number;
  available_copies: number;
  description?: string;
  cover_image_url?: string;
}

interface LoanType {
  id: string;
  book_id: string;
  user_id: number;
  keycard_number?: string;
  loan_date: string;
  due_date: string;
  return_date?: string;
  is_returned: boolean;
  notes?: string;
  books: BookType;
  permissions?: {
    name: string;
    username: string;
  };
}

const Bibliothek = () => {
  const navigate = useNavigate();
  const { profile, loading, sessionId } = useAuth();
  const { hasPermission, isLoaded, reloadPermissions } = useEnhancedPermissions();
  const { withSession } = useSessionRequest();
  const { toast } = useToast();

  const [books, setBooks] = useState<BookType[]>([]);
  const [loans, setLoans] = useState<LoanType[]>([]);
  const [myLoans, setMyLoans] = useState<LoanType[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'title' | 'author' | 'genre'>('title');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState<BookType | null>(null);
  const [newBook, setNewBook] = useState({
    isbn: '',
    title: '',
    author: '',
    publisher: '',
    publication_year: '',
    genre: '',
    total_copies: 1,
    description: ''
  });
  const [scanKeycard, setScanKeycard] = useState('');
  const [scanBookBarcode, setScanBookBarcode] = useState('');
  const [scannedBooks, setScannedBooks] = useState<BookType[]>([]);
  const [multipleBarcodes, setMultipleBarcodes] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userLoans, setUserLoans] = useState<LoanType[]>([]);
  const [showAddBookDialog, setShowAddBookDialog] = useState(false);
  const [showLoanDialog, setShowLoanDialog] = useState(false);
  const [showEditBookDialog, setShowEditBookDialog] = useState(false);
  const [editingBook, setEditingBook] = useState<BookType | null>(null);
  const [activeTab, setActiveTab] = useState('loans'); // Default to loans management

  const canManageBooks = hasPermission('library_manage_books');
  const canManageLoans = hasPermission('library_manage_loans');
  const canViewAllUsers = hasPermission('library_view_all_users');

  console.log('Permissions:', { 
    canManageBooks, 
    canManageLoans, 
    canViewAllUsers,
    permissionLevel: profile?.permission_lvl,
    isLoaded 
  });

  useEffect(() => {
    if (!loading && !profile) {
      navigate('/auth');
      return;
    }

    if (!isLoaded) return; // wait for permissions to load

    if (profile && !hasPermission('library_view')) {
      navigate('/');
      return;
    }

    loadData();
  }, [profile, loading, isLoaded, hasPermission, navigate]);

  // Force permission reload when component mounts
  useEffect(() => {
    if (profile?.id) {
      console.log('Reloading permissions for user:', profile.id, profile.permission_lvl);
      reloadPermissions();
    }
  }, [profile?.id, reloadPermissions]);

  const loadData = async () => {
    if (!profile) return;
    
    try {
      setIsLoading(true);
      
      // Load books
      const { data: booksData, error: booksError } = await supabase
        .from('books')
        .select('*')
        .order('title');

      if (booksError) throw booksError;
      setBooks(booksData || []);

      // Load my loans
      const { data: myLoansData, error: myLoansError } = await supabase
        .from('loans')
        .select(`
          *,
          books (*),
          permissions!loans_user_id_fkey (name, username)
        `)
        .eq('user_id', profile.id)
        .eq('is_returned', false);

      if (myLoansError) throw myLoansError;
      setMyLoans(myLoansData || []);

      // Load all loans if librarian
      if (canManageLoans) {
        const { data: allLoansData, error: allLoansError } = await supabase
          .from('loans')
          .select(`
            *,
            books (*),
            permissions!loans_user_id_fkey (name, username)
          `)
          .order('loan_date', { ascending: false });

        if (allLoansError) throw allLoansError;
        setLoans(allLoansData || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Daten konnten nicht geladen werden."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddBook = async () => {
    if (!newBook.title || !newBook.author) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Titel und Autor sind Pflichtfelder."
      });
      return;
    }

    try {
      const { data, error } = await supabase.rpc('add_book_session', {
        b_title: newBook.title,
        b_author: newBook.author,
        b_isbn: newBook.isbn || null,
        b_publisher: newBook.publisher || null,
        b_publication_year: newBook.publication_year ? parseInt(newBook.publication_year) : null,
        b_genre: newBook.genre || null,
        b_total_copies: newBook.total_copies,
        b_description: newBook.description || null,
        v_session_id: sessionId || ''
      });

      if (error || (data && (data as any).success === false)) {
        throw new Error((data as any)?.error || error?.message || 'Hinzufügen fehlgeschlagen');
      }

      toast({
        title: "Erfolg",
        description: "Buch wurde hinzugefügt."
      });

      setNewBook({
        isbn: '',
        title: '',
        author: '',
        publisher: '',
        publication_year: '',
        genre: '',
        total_copies: 1,
        description: ''
      });
      setShowAddBookDialog(false);
      loadData();
    } catch (error) {
      console.error('Error adding book:', error);
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Buch konnte nicht hinzugefügt werden."
      });
    }
  };

  const handleEditBook = async () => {
    if (!editingBook || !editingBook.title || !editingBook.author) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Titel und Autor sind Pflichtfelder."
      });
      return;
    }

    try {
      const { data, error } = await supabase.rpc('update_book_session', {
        b_id: editingBook.id,
        b_title: editingBook.title,
        b_author: editingBook.author,
        b_isbn: editingBook.isbn || null,
        b_publisher: editingBook.publisher || null,
        b_publication_year: editingBook.publication_year || null,
        b_genre: editingBook.genre || null,
        b_total_copies: editingBook.total_copies,
        b_description: editingBook.description || null,
        v_session_id: sessionId || ''
      });

      if (error || (data && (data as any).success === false)) {
        throw new Error((data as any)?.error || error?.message || 'Aktualisierung fehlgeschlagen');
      }

      toast({
        title: "Erfolg",
        description: "Buch wurde aktualisiert."
      });

      setShowEditBookDialog(false);
      setEditingBook(null);
      loadData();
    } catch (error) {
      console.error('Error updating book:', error);
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Buch konnte nicht aktualisiert werden."
      });
    }
  };

  const handleDeleteBook = async (book: BookType) => {
    if (!confirm(`Sind Sie sicher, dass Sie "${book.title}" löschen möchten?`)) {
      return;
    }

    try {
      const { data, error } = await supabase.rpc('delete_book_session', {
        b_id: book.id,
        v_session_id: sessionId || ''
      });

      if (error || (data && (data as any).success === false)) {
        throw new Error((data as any)?.error || error?.message || 'Löschen fehlgeschlagen');
      }


      toast({
        title: "Erfolg",
        description: "Buch wurde gelöscht."
      });

      loadData();
    } catch (error) {
      console.error('Error deleting book:', error);
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Buch konnte nicht gelöscht werden."
      });
    }
  };

  const handleAddScannedBook = async () => {
    if (!scanBookBarcode.trim()) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Bitte Barcode eingeben."
      });
      return;
    }

    // Find book by barcode
    const { data: bookData, error: bookError } = await supabase
      .from('books')
      .select('*')
      .eq('isbn', scanBookBarcode.trim())
      .maybeSingle();

    if (bookError || !bookData) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Buch mit diesem Barcode nicht gefunden."
      });
      return;
    }

    // Check if already in list
    if (scannedBooks.find(book => book.id === bookData.id)) {
      toast({
        variant: "destructive",
        title: "Hinweis",
        description: "Buch bereits in der Liste."
      });
      return;
    }

    setScannedBooks(prev => [...prev, bookData]);
    setScanBookBarcode('');
  };

  const handleRemoveScannedBook = (bookId: string) => {
    setScannedBooks(prev => prev.filter(book => book.id !== bookId));
  };

  const handleBulkLoanBooks = async () => {
    if (!selectedUser) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Bitte zuerst einen Benutzer suchen."
      });
      return;
    }

    if (scannedBooks.length === 0) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Keine Bücher ausgewählt."
      });
      return;
    }

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const book of scannedBooks) {
        if (book.available_copies <= 0) {
          console.error(`Book ${book.title} not available`);
          errorCount++;
          continue;
        }

        try {
          const { data: loanResult, error: loanFunctionError } = await supabase.functions.invoke('loan-book', {
            body: {
              book_id: book.id,
              user_id: selectedUser.id,
              keycard_number: selectedUser.keycard_number,
              librarian_id: profile!.id,
              actorUserId: profile?.id,
              actorUsername: profile?.username
            }
          });

          if (loanFunctionError || !loanResult?.success) {
            throw new Error(loanResult?.error || 'Ausleihe fehlgeschlagen');
          }

          successCount++;
        } catch (sessionError) {
          console.error('Loan operation failed:', sessionError);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: "Erfolg",
          description: `${successCount} Buch${successCount > 1 ? 'er' : ''} ausgeliehen.`
        });
      }

      if (errorCount > 0) {
        toast({
          variant: "destructive",
          title: "Warnung",
          description: `${errorCount} Buch${errorCount > 1 ? 'er' : ''} konnten nicht ausgeliehen werden.`
        });
      }

      // Clear scanned books and refresh data
      setScannedBooks([]);
      handleSearchUser(); // Refresh user loans
      loadData(); // Refresh books
      setActiveTab('loans'); // Stay on loans tab after operation
    } catch (error) {
      console.error('Error loaning books:', error);
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Ausleihe konnte nicht erstellt werden."
      });
    }
  };

  const handleSearchUser = async () => {
    if (!scanKeycard.trim()) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Bitte Keycard-Nummer eingeben."
      });
      return;
    }

    try {
      // Use the admin-users edge function to search by keycard
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'search_by_keycard',
          keycard_number: scanKeycard.trim(),
          actorUserId: profile?.id,
          actorUsername: profile?.username
        }
      });

      if (error) throw error;
      if (data.error) {
        toast({
          variant: "destructive",
          title: "Fehler",
          description: data.error
        });
        return;
      }

      if (!data.user) {
        toast({
          variant: "destructive",
          title: "Fehler",
          description: "Keycard nicht gefunden."
        });
        return;
      }

      setSelectedUser(data.user);

      // Load user's active loans
      const { data: loansData, error: loansError } = await supabase
        .from('loans')
        .select(`
          *,
          books (*)
        `)
        .eq('user_id', data.user.id)
        .eq('is_returned', false);

      if (loansError) throw loansError;
      setUserLoans(loansData || []);

      setSelectedUser(data.user);

      // Load user's active loans
      const { data: userLoansData, error: userLoansError } = await supabase
        .from('loans')
        .select(`
          *,
          books (*)
        `)
        .eq('user_id', data.user.id)
        .eq('is_returned', false);

      if (userLoansError) throw userLoansError;
      setUserLoans(userLoansData || []);
    } catch (error) {
      console.error('Error searching user:', error);
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Benutzer konnte nicht gefunden werden."
      });
    }
  };

  const handleLoanBookByBarcode = async () => {
    if (!selectedUser) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Bitte zuerst einen Benutzer suchen."
      });
      return;
    }

    const barcodes = multipleBarcodes.trim() ? 
      multipleBarcodes.split('\n').map(b => b.trim()).filter(b => b) : 
      scanBookBarcode.trim() ? [scanBookBarcode.trim()] : [];

    if (barcodes.length === 0) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Bitte Barcode(s) eingeben."
      });
      return;
    }

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const barcode of barcodes) {
        // Find book by barcode (assuming ISBN or a barcode field exists)
        const { data: bookData, error: bookError } = await supabase
          .from('books')
          .select('*')
          .eq('isbn', barcode)
          .maybeSingle();

        if (bookError || !bookData) {
          console.error(`Book with barcode ${barcode} not found`);
          errorCount++;
          continue;
        }

        if (bookData.available_copies <= 0) {
          console.error(`Book ${bookData.title} not available`);
          errorCount++;
          continue;
        }

        try {
          console.log('Creating loan with session:', sessionId, 'for user:', selectedUser.id, 'book:', bookData.id, 'librarian:', profile!.id);
          
          // Try Edge Function approach first
          const { data: loanResult, error: loanFunctionError } = await supabase.functions.invoke('loan-book', {
            body: {
              book_id: bookData.id,
              user_id: selectedUser.id,
              keycard_number: selectedUser.keycard_number,
              librarian_id: profile!.id,
              actorUserId: profile?.id,
              actorUsername: profile?.username
            }
          });

          console.log('Loan function result:', { loanResult, loanFunctionError });

          if (loanFunctionError) {
            throw new Error(`Edge Function Error: ${loanFunctionError.message}`);
          }
          
          if (!loanResult?.success) {
            throw new Error(loanResult?.error || 'Ausleihe fehlgeschlagen');
          }
        } catch (sessionError) {
          console.error('Loan operation failed:', sessionError);
          errorCount++;
          continue;
        }

        successCount++;
      }

      if (successCount > 0) {
        toast({
          title: "Erfolg",
          description: `${successCount} Buch${successCount > 1 ? 'er' : ''} ausgeliehen.`
        });
      }

      if (errorCount > 0) {
        toast({
          variant: "destructive",
          title: "Warnung",
          description: `${errorCount} Buch${errorCount > 1 ? 'er' : ''} konnten nicht ausgeliehen werden.`
        });
      }

      setScanBookBarcode('');
      setMultipleBarcodes('');
      handleSearchUser(); // Refresh user loans
      loadData(); // Refresh books
    } catch (error) {
      console.error('Error loaning books:', error);
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Ausleihe konnte nicht erstellt werden."
      });
    }
  };

  const handleReturnBookByBarcode = async () => {
    if (!selectedUser) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Bitte zuerst einen Benutzer suchen."
      });
      return;
    }

    const barcodes = multipleBarcodes.trim() ? 
      multipleBarcodes.split('\n').map(b => b.trim()).filter(b => b) : 
      scanBookBarcode.trim() ? [scanBookBarcode.trim()] : [];

    if (barcodes.length === 0) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Bitte Barcode(s) eingeben."
      });
      return;
    }

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const barcode of barcodes) {
        // Find active loan by barcode
        const { data: loanData, error: loanError } = await supabase
          .from('loans')
          .select(`
            *,
            books (*)
          `)
          .eq('user_id', selectedUser.id)
          .eq('is_returned', false)
          .eq('books.isbn', barcode)
          .maybeSingle();

        if (loanError || !loanData) {
          console.error(`Active loan for barcode ${barcode} not found`);
          errorCount++;
          continue;
        }

        await withSession(async () => {
          // Mark as returned
          const { error: returnError } = await supabase
            .from('loans')
            .update({
              is_returned: true,
              return_date: new Date().toISOString()
            })
            .eq('id', loanData.id);

          if (returnError) throw returnError;

          // Update available copies
          const { error: updateError } = await supabase
            .from('books')
            .update({ available_copies: loanData.books.available_copies + 1 })
            .eq('id', loanData.book_id);

          if (updateError) throw updateError;
        });

        successCount++;
      }

      if (successCount > 0) {
        toast({
          title: "Erfolg",
          description: `${successCount} Buch${successCount > 1 ? 'er' : ''} zurückgegeben.`
        });
      }

      if (errorCount > 0) {
        toast({
          variant: "destructive",
          title: "Warnung",
          description: `${errorCount} Buch${errorCount > 1 ? 'er' : ''} konnten nicht zurückgegeben werden.`
        });
      }

      setScanBookBarcode('');
      setMultipleBarcodes('');
      handleSearchUser(); // Refresh user loans
      loadData(); // Refresh books
      setActiveTab('loans'); // Stay on loans tab after return
    } catch (error) {
      console.error('Error returning books:', error);
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Rückgabe konnte nicht verarbeitet werden."
      });
    }
  };

  const handleLoanBook = async (book: BookType) => {
    if (!scanKeycard.trim()) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Bitte Keycard-Nummer eingeben."
      });
      return;
    }

    try {
      // Find user by keycard
      const { data: userData, error: userError } = await supabase
        .from('permissions')
        .select('id, name, username')
        .eq('keycard_number', scanKeycard.trim())
        .maybeSingle();

      if (userError) throw userError;
      if (!userData) {
        toast({
          variant: "destructive",
          title: "Fehler",
          description: "Keycard nicht gefunden."
        });
        return;
      }

      if (book.available_copies <= 0) {
        toast({
          variant: "destructive",
          title: "Fehler",
          description: "Buch ist nicht verfügbar."
        });
        return;
      }

      await withSession(async () => {
        // Create loan
        const { error: loanError } = await supabase
          .from('loans')
          .insert({
            book_id: book.id,
            user_id: selectedUser.id,
            keycard_number: scanKeycard.trim(),
            librarian_id: profile!.id
          });

        if (loanError) throw loanError;

        // Update available copies
        const { error: updateError } = await supabase
          .from('books')
          .update({ available_copies: book.available_copies - 1 })
          .eq('id', book.id);

        if (updateError) throw updateError;
      });

      toast({
        title: "Erfolg",
        description: `Buch an ${userData.name} ausgeliehen.`
      });

      setScanKeycard('');
      setShowLoanDialog(false);
      setSelectedBook(null);
      loadData();
    } catch (error) {
      console.error('Error loaning book:', error);
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Ausleihe konnte nicht erstellt werden."
      });
    }
  };

  const handleReturnBook = async (loan: LoanType) => {
    try {
      await withSession(async () => {
        // Mark as returned
        const { error: returnError } = await supabase
          .from('loans')
          .update({
            is_returned: true,
            return_date: new Date().toISOString()
          })
          .eq('id', loan.id);

        if (returnError) throw returnError;

        // Update available copies
        const { error: updateError } = await supabase
          .from('books')
          .update({ available_copies: loan.books.available_copies + 1 })
          .eq('id', loan.book_id);

        if (updateError) throw updateError;
      });

      toast({
        title: "Erfolg",
        description: "Buch wurde zurückgegeben."
      });

      handleSearchUser(); // Refresh user loans
      loadData(); // Refresh books
      setActiveTab('loans'); // Stay on loans tab after return
    } catch (error) {
      console.error('Error returning book:', error);
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Rückgabe konnte nicht verarbeitet werden."
      });
    }
  };

  const filteredBooks = books
    .filter(book =>
      book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (book.genre && book.genre.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'author') return a.author.localeCompare(b.author);
      if (sortBy === 'genre') return (a.genre || '').localeCompare(b.genre || '');
      return 0;
    });

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date() && new Date(dueDate).toDateString() !== new Date().toDateString();
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Book className="h-12 w-12 animate-bounce mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Bibliothek wird geladen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Book className="h-8 w-8 text-primary" />
                Schulbibliothek
              </h1>
              <p className="text-muted-foreground">
                {canManageBooks ? 'Bibliotheksverwaltung' : 'Bücher suchen und ausleihen'}
              </p>
            </div>
          </div>
          
          {canManageBooks && (
            <Button onClick={() => setShowAddBookDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Neues Buch
            </Button>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className={`grid w-full ${canManageLoans ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <TabsTrigger value="books">
              <BookOpen className="h-4 w-4 mr-2" />
              Bücher
            </TabsTrigger>
            {!canManageBooks && (
              <TabsTrigger value="my-loans">
                <Clock className="h-4 w-4 mr-2" />
                Meine Ausleihen ({myLoans.length})
              </TabsTrigger>
            )}
            {canManageLoans && (
              <TabsTrigger value="loan-management">
                <UserSearch className="h-4 w-4 mr-2" />
                Ausleihen verwalten
              </TabsTrigger>
            )}
            {canManageLoans && (
              <TabsTrigger value="all-loans">
                <Users className="h-4 w-4 mr-2" />
                Alle Ausleihen
              </TabsTrigger>
            )}
          </TabsList>

          {/* Books Tab */}
          <TabsContent value="books" className="space-y-4">
            <div className="flex gap-4 items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Bücher suchen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="title">Nach Titel</SelectItem>
                  <SelectItem value="author">Nach Autor</SelectItem>
                  <SelectItem value="genre">Nach Genre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredBooks.map((book) => (
                <Card key={book.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg">{book.title}</CardTitle>
                    <CardDescription>{book.author}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {book.genre && (
                      <Badge variant="secondary">{book.genre}</Badge>
                    )}
                    
                    <div className="flex justify-between text-sm">
                      <span>Verfügbar:</span>
                      <span className={book.available_copies > 0 ? 'text-green-600' : 'text-red-600'}>
                        {book.available_copies} / {book.total_copies}
                      </span>
                    </div>

                    {book.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {book.description}
                      </p>
                    )}

                    {canManageBooks ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setEditingBook(book);
                            setShowEditBookDialog(true);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Bearbeiten
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1"
                          onClick={() => handleDeleteBook(book)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Löschen
                        </Button>
                      </div>
                    ) : (
                      canManageLoans && book.available_copies > 0 && (
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            setSelectedBook(book);
                            setShowLoanDialog(true);
                          }}
                        >
                          <ScanLine className="h-4 w-4 mr-2" />
                          Ausleihen
                        </Button>
                      )
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* My Loans Tab - Only for non-librarians */}
          {!canManageBooks && (
            <TabsContent value="my-loans" className="space-y-4">
              {myLoans.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-lg font-medium">Keine Ausleihen</p>
                    <p className="text-muted-foreground">Sie haben derzeit keine Bücher ausgeliehen.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {myLoans.map((loan) => (
                    <Card key={loan.id}>
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <h3 className="font-semibold text-lg">{loan.books.title}</h3>
                            <p className="text-muted-foreground">{loan.books.author}</p>
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-1">
                                <CalendarDays className="h-4 w-4" />
                                Ausgeliehen: {format(new Date(loan.loan_date), 'dd.MM.yyyy', { locale: de })}
                              </div>
                              <div className={`flex items-center gap-1 ${isOverdue(loan.due_date) ? 'text-red-600' : 'text-green-600'}`}>
                                {isOverdue(loan.due_date) ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                                Rückgabe bis: {format(new Date(loan.due_date), 'dd.MM.yyyy', { locale: de })}
                              </div>
                            </div>
                            {isOverdue(loan.due_date) && (
                              <Badge variant="destructive">Überfällig</Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          )}

          {/* Loan Management Tab - Only for librarians */}
          {canManageLoans && (
            <TabsContent value="loan-management" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Benutzer suchen</CardTitle>
                  <CardDescription>Scannen Sie die Keycard eines Schülers</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <ScanLine className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={scanKeycard}
                        onChange={(e) => setScanKeycard(e.target.value)}
                        placeholder="Keycard scannen..."
                        className="pl-10"
                      />
                    </div>
                    <Button onClick={handleSearchUser}>
                      <UserSearch className="h-4 w-4 mr-2" />
                      Suchen
                    </Button>
                  </div>
                  
                  {selectedUser && (
                    <div className="p-4 border rounded-lg bg-muted/50">
                      <h3 className="font-semibold">{selectedUser.name}</h3>
                      <p className="text-sm text-muted-foreground">Keycard: {selectedUser.keycard_number}</p>
                      <p className="text-sm text-muted-foreground">
                        Aktuelle Ausleihen: {userLoans.length}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {selectedUser && (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>Bücher ausleihen/zurückgeben</CardTitle>
                      <CardDescription>Scannen Sie Barcodes einzeln oder mehrere auf einmal</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Einzelner Barcode</Label>
                          <Input
                            value={scanBookBarcode}
                            onChange={(e) => setScanBookBarcode(e.target.value)}
                            placeholder="Barcode scannen..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Mehrere Barcodes (einen pro Zeile)</Label>
                          <Textarea
                            value={multipleBarcodes}
                            onChange={(e) => setMultipleBarcodes(e.target.value)}
                            placeholder="Barcode 1&#10;Barcode 2&#10;Barcode 3..."
                            rows={3}
                          />
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          onClick={handleLoanBookByBarcode}
                          disabled={!scanBookBarcode.trim() && !multipleBarcodes.trim()}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Ausleihen
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={handleReturnBookByBarcode}
                          disabled={!scanBookBarcode.trim() && !multipleBarcodes.trim()}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Zurückgeben
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Aktuelle Ausleihen von {selectedUser.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {userLoans.length === 0 ? (
                        <p className="text-muted-foreground">Keine aktiven Ausleihen</p>
                      ) : (
                        <div className="space-y-3">
                          {userLoans.map((loan) => (
                            <div key={loan.id} className="flex justify-between items-center p-3 border rounded">
                              <div>
                                <h4 className="font-medium">{loan.books.title}</h4>
                                <p className="text-sm text-muted-foreground">{loan.books.author}</p>
                                <p className="text-sm text-muted-foreground">
                                  Rückgabe bis: {format(new Date(loan.due_date), 'dd.MM.yyyy', { locale: de })}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {isOverdue(loan.due_date) && (
                                  <Badge variant="destructive">Überfällig</Badge>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReturnBook(loan)}
                                >
                                  Zurückgeben
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          )}

          {/* All Loans Tab (Librarians only) */}
          {canManageLoans && (
            <TabsContent value="all-loans" className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Buch</TableHead>
                    <TableHead>Benutzer</TableHead>
                    <TableHead>Ausgeliehen</TableHead>
                    <TableHead>Rückgabe bis</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans.map((loan) => (
                    <TableRow key={loan.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{loan.books.title}</div>
                          <div className="text-sm text-muted-foreground">{loan.books.author}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{loan.permissions?.name || 'Unbekannt'}</div>
                          <div className="text-sm text-muted-foreground">{loan.keycard_number}</div>
                        </div>
                      </TableCell>
                      <TableCell>{format(new Date(loan.loan_date), 'dd.MM.yyyy', { locale: de })}</TableCell>
                      <TableCell className={isOverdue(loan.due_date) && !loan.is_returned ? 'text-red-600' : ''}>
                        {format(new Date(loan.due_date), 'dd.MM.yyyy', { locale: de })}
                      </TableCell>
                      <TableCell>
                        {loan.is_returned ? (
                          <Badge variant="secondary">Zurückgegeben</Badge>
                        ) : isOverdue(loan.due_date) ? (
                          <Badge variant="destructive">Überfällig</Badge>
                        ) : (
                          <Badge variant="default">Ausgeliehen</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!loan.is_returned && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReturnBook(loan)}
                          >
                            Zurückgeben
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          )}
        </Tabs>

        {/* Add Book Dialog */}
        <Dialog open={showAddBookDialog} onOpenChange={setShowAddBookDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Neues Buch hinzufügen</DialogTitle>
              <DialogDescription>
                Fügen Sie ein neues Buch zur Bibliothek hinzu.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="isbn">ISBN (optional)</Label>
                <Input
                  id="isbn"
                  value={newBook.isbn}
                  onChange={(e) => setNewBook({ ...newBook, isbn: e.target.value })}
                  placeholder="978-3-..."
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="title">Titel *</Label>
                <Input
                  id="title"
                  value={newBook.title}
                  onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
                  placeholder="Buchtitel"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="author">Autor *</Label>
                <Input
                  id="author"
                  value={newBook.author}
                  onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
                  placeholder="Autorname"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="genre">Genre</Label>
                <Input
                  id="genre"
                  value={newBook.genre}
                  onChange={(e) => setNewBook({ ...newBook, genre: e.target.value })}
                  placeholder="z.B. Roman, Sachbuch"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="copies">Anzahl Exemplare</Label>
                <Input
                  id="copies"
                  type="number"
                  min="1"
                  value={newBook.total_copies}
                  onChange={(e) => setNewBook({ ...newBook, total_copies: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Beschreibung</Label>
                <Textarea
                  id="description"
                  value={newBook.description}
                  onChange={(e) => setNewBook({ ...newBook, description: e.target.value })}
                  placeholder="Kurzbeschreibung des Buchs"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddBookDialog(false)}>
                Abbrechen
              </Button>
              <Button type="button" onClick={handleAddBook}>
                Buch hinzufügen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Loan Book Dialog */}
        <Dialog open={showLoanDialog} onOpenChange={setShowLoanDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Buch ausleihen</DialogTitle>
              <DialogDescription>
                {selectedBook && `"${selectedBook.title}" von ${selectedBook.author}`}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="keycard">Keycard-Nummer scannen</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <ScanLine className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="keycard"
                      value={scanKeycard}
                      onChange={(e) => setScanKeycard(e.target.value)}
                      placeholder="Keycard scannen..."
                      className="pl-10"
                      autoFocus
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowLoanDialog(false)}>
                Abbrechen
              </Button>
              <Button 
                type="button" 
                onClick={() => selectedBook && handleLoanBook(selectedBook)}
                disabled={!scanKeycard.trim()}
              >
                Ausleihen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Book Dialog */}
        <Dialog open={showEditBookDialog} onOpenChange={setShowEditBookDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Buch bearbeiten</DialogTitle>
              <DialogDescription>
                Bearbeiten Sie die Buchinformationen.
              </DialogDescription>
            </DialogHeader>
            {editingBook && (
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-isbn">ISBN (optional)</Label>
                  <Input
                    id="edit-isbn"
                    value={editingBook.isbn || ''}
                    onChange={(e) => setEditingBook({ ...editingBook, isbn: e.target.value })}
                    placeholder="978-3-..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-title">Titel *</Label>
                  <Input
                    id="edit-title"
                    value={editingBook.title}
                    onChange={(e) => setEditingBook({ ...editingBook, title: e.target.value })}
                    placeholder="Buchtitel"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-author">Autor *</Label>
                  <Input
                    id="edit-author"
                    value={editingBook.author}
                    onChange={(e) => setEditingBook({ ...editingBook, author: e.target.value })}
                    placeholder="Autorname"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-genre">Genre</Label>
                  <Input
                    id="edit-genre"
                    value={editingBook.genre || ''}
                    onChange={(e) => setEditingBook({ ...editingBook, genre: e.target.value })}
                    placeholder="z.B. Roman, Sachbuch"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-copies">Anzahl Exemplare</Label>
                  <Input
                    id="edit-copies"
                    type="number"
                    min="1"
                    value={editingBook.total_copies}
                    onChange={(e) => setEditingBook({ ...editingBook, total_copies: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-description">Beschreibung</Label>
                  <Textarea
                    id="edit-description"
                    value={editingBook.description || ''}
                    onChange={(e) => setEditingBook({ ...editingBook, description: e.target.value })}
                    placeholder="Kurzbeschreibung des Buchs"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditBookDialog(false)}>
                Abbrechen
              </Button>
              <Button type="button" onClick={handleEditBook}>
                Speichern
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Bibliothek;