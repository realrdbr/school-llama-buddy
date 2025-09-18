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
  AlertCircle
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
  const { profile, loading } = useAuth();
  const { hasPermission, isLoaded } = useEnhancedPermissions();
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
  const [showAddBookDialog, setShowAddBookDialog] = useState(false);
  const [showLoanDialog, setShowLoanDialog] = useState(false);

  const canManageBooks = hasPermission('library_manage_books');
  const canManageLoans = hasPermission('library_manage_loans');
  const canViewAllUsers = hasPermission('library_view_all_users');

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
      await withSession(async () => {
        const { error } = await supabase
          .from('books')
          .insert({
            isbn: newBook.isbn || null,
            title: newBook.title,
            author: newBook.author,
            publisher: newBook.publisher || null,
            publication_year: newBook.publication_year ? parseInt(newBook.publication_year) : null,
            genre: newBook.genre || null,
            total_copies: newBook.total_copies,
            available_copies: newBook.total_copies,
            description: newBook.description || null
          });

        if (error) throw error;
      });

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
            user_id: userData.id,
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

      loadData();
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

        <Tabs defaultValue="books" className="space-y-6">
          <TabsList className={`grid w-full ${canManageLoans ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <TabsTrigger value="books">
              <BookOpen className="h-4 w-4 mr-2" />
              Bücher
            </TabsTrigger>
            <TabsTrigger value="my-loans">
              <Clock className="h-4 w-4 mr-2" />
              Meine Ausleihen ({myLoans.length})
            </TabsTrigger>
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

                    {canManageLoans && book.available_copies > 0 && (
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
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* My Loans Tab */}
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
      </div>
    </div>
  );
};

export default Bibliothek;