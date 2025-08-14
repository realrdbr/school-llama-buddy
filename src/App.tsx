import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Stundenplan from "./pages/Stundenplan";
import Announcements from "./pages/Announcements";
import AudioAnnouncements from "./pages/AudioAnnouncements";
import UserManagement from "./pages/UserManagement";
import Vertretungsplan from "./pages/Vertretungsplan";
import Klassenverwaltung from "./pages/Klassenverwaltung";
import AIChat from "./pages/AIChat";
import Keycard from "./pages/Keycard";
import Settings from "./pages/Settings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/stundenplan" element={<Stundenplan />} />
            <Route path="/announcements" element={<Announcements />} />
            <Route path="/audio-announcements" element={<AudioAnnouncements />} />
            <Route path="/user-management" element={<UserManagement />} />
            <Route path="/vertretungsplan" element={<Vertretungsplan />} />
            <Route path="/ai-chat" element={<AIChat />} />
            <Route path="/klassenverwaltung" element={<Klassenverwaltung />} />
            <Route path="/keycard" element={<Keycard />} />
            <Route path="/settings" element={<Settings />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
