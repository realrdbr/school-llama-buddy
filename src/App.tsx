import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { useSessionStorage } from "@/hooks/useSessionStorage";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Stundenplan from "./pages/Stundenplan";
import Announcements from "./pages/Announcements";
import AudioAnnouncements from "./pages/AudioAnnouncements";
import DocumentAnalysis from "./pages/DocumentAnalysis";
import UserManagement from "./pages/UserManagement";
import Vertretungsplan from "./pages/Vertretungsplan";
import Klassenverwaltung from "./pages/Klassenverwaltung";
import AIChat from "./pages/AIChat";
import Keycard from "./pages/Keycard";
import Settings from "./pages/Settings";
import Permissions from "./pages/Permissions";
import ThemeSettings from "./pages/ThemeSettings";

const queryClient = new QueryClient();

// Session-aware wrapper component
const SessionAwareApp = () => {
  useSessionStorage(); // Initialize session management

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      
      {/* Protected routes with specific permissions */}
      <Route 
        path="/stundenplan" 
        element={
          <ProtectedRoute requiredPermission="view_schedule">
            <Stundenplan />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/announcements" 
        element={
          <ProtectedRoute requiredPermission="view_announcements">
            <Announcements />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/audio-announcements" 
        element={
          <ProtectedRoute requiredPermission="audio_announcements">
            <AudioAnnouncements />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/document-analysis" 
        element={
          <ProtectedRoute requiredPermission="document_analysis">
            <DocumentAnalysis />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/user-management" 
        element={
          <ProtectedRoute requiredPermission="user_management">
            <UserManagement />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/vertretungsplan" 
        element={
          <ProtectedRoute requiredPermission="view_vertretungsplan">
            <Vertretungsplan />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/ai-chat" 
        element={
          <ProtectedRoute requiredPermission="view_chat">
            <AIChat />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/klassenverwaltung" 
        element={
          <ProtectedRoute requiredPermission="manage_schedules">
            <Klassenverwaltung />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/keycard" 
        element={
          <ProtectedRoute requiredPermission="keycard_system">
            <Keycard />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/settings" 
        element={
          <ProtectedRoute requiredPermission="system_settings">
            <Settings />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/permissions" 
        element={
          <ProtectedRoute requiredPermission="permission_management">
            <Permissions />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/theme-settings" 
        element={<ThemeSettings />} 
      />
      
      {/* Legacy route alias */}
      <Route 
        path="/tts" 
        element={
          <ProtectedRoute requiredPermission="audio_announcements">
            <AudioAnnouncements />
          </ProtectedRoute>
        } 
      />
      
      {/* Catch-all route for 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <SessionAwareApp />
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;