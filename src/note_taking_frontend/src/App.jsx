import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import NotesApp from './Components/NotesApp';

function App() {
  return (
    <AuthProvider>
      <NotesApp />
    </AuthProvider>
  );
}

export default App;