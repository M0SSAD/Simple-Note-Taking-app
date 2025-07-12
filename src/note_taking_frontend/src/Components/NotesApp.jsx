import React, { useState, useEffect, useRef } from "react";
import { Plus, Edit, Trash2, Save, X, ChevronDown, ChevronRight } from "lucide-react";
import { note_taking_backend } from "../../../declarations/note_taking_backend";

export default function NotesApp() {
  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [formData, setFormData] = useState({ title: "", content: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [showNoteIds, setShowNoteIds] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState(new Set());
  const noteRefs = useRef({});

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    try {
      setIsLoading(true);
      const fetchedNotes = await note_taking_backend.get_notes();
      const mappedNotes = fetchedNotes.map((note) => ({
        id: Number(note.id),
        title: note.title,
        content: note.content,
      }));
      setNotes(mappedNotes);
    } catch (error) {
      console.error("Error loading notes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.title.trim() || !formData.content.trim()) {
      alert("Please fill in both title and content");
      return;
    }

    console.log("Form submitted with data:", formData);
    setIsSubmitting(true);

    try {
      if (editingNote) {
        console.log("Updating existing note with ID:", editingNote.id);
        console.log("Update data:", { title: formData.title, content: formData.content });
        
        // Ensure we're passing the correct types
        const idNumber = Number(editingNote.id);
        const titleString = String(formData.title);
        const contentString = String(formData.content);
        
        console.log("Calling backend.edit with:", idNumber, titleString, contentString);
        const result = await note_taking_backend.edit(idNumber, titleString, contentString);
        console.log("Edit result:", result);
        
        // Handle the Result<text, text> response
        if (result && result.Ok) {
          console.log("Note updated successfully");
          // Update local state
          setNotes(prevNotes => 
            prevNotes.map(note => 
              note.id === editingNote.id 
                ? { ...note, title: formData.title, content: formData.content }
                : note
            )
          );
          
          // Close form after successful update
          setShowForm(false);
          setFormData({ title: '', content: '' });
          setEditingNote(null);
          
          // Scroll to updated note
          setTimeout(() => {
            const noteElement = noteRefs.current[editingNote.id];
            if (noteElement) {
              noteElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              noteElement.style.backgroundColor = '#dbeafe';
              setTimeout(() => noteElement.style.backgroundColor = '', 2000);
            }
          }, 100);
        } else if (result && result.Err) {
          throw new Error(result.Err);
        } else {
          throw new Error("Unexpected response format");
        }
        
        console.log("Note updated successfully");
        
      } else {
        console.log("Creating new note...");
        console.log("Create data:", { title: formData.title, content: formData.content });
        
        // Ensure we're passing strings, not objects
        const titleString = String(formData.title);
        const contentString = String(formData.content);
        
        console.log("Calling backend.create with:", titleString, contentString);
        const result = await note_taking_backend.create(titleString, contentString);
        console.log("Create result:", result);
        console.log("Create result type:", typeof result);
        
        // Close form after successful creation
        setShowForm(false);
        setFormData({ title: '', content: '' });
        setEditingNote(null);
        
        // Since your backend's create method actually returns Result<text, text> according to Candid
        // (not Result<Note, String> as in the Rust code), we need to handle it differently
        console.log("Create result:", result);
        
        // The result should be { Ok: "some_text" } or { Err: "error_message" }
        if (result && result.Ok) {
          console.log("Note created successfully, reloading notes...");
          // Since we don't get the Note object back, we need to reload to get the new note
          await loadNotes();
          
          // After reload, try to find and highlight the newly created note
          setTimeout(() => {
            const allNoteElements = Object.values(noteRefs.current);
            const lastNoteElement = allNoteElements[allNoteElements.length - 1];
            
            if (lastNoteElement) {
              console.log("Scrolling to new note...");
              lastNoteElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              lastNoteElement.style.backgroundColor = '#dbeafe';
              setTimeout(() => lastNoteElement.style.backgroundColor = '', 2000);
            }
          }, 200);
        } else if (result && result.Err) {
          throw new Error(result.Err);
        } else {
          throw new Error("Unexpected response format");
        }
        
        console.log("Note created successfully");
      }
      
    } catch (error) {
      console.error('Detailed error saving note:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      // More specific error messages
      let errorMessage = 'Error saving note. Please try again.';
      if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      alert(errorMessage);
      
      // Only reload notes if there's an actual error
      try {
        await loadNotes();
      } catch (reloadError) {
        console.error('Error reloading notes:', reloadError);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this note?")) return;
    
    try {
      const result = await note_taking_backend.delete(id);
      
      // Handle the Result<text, text> response
      if (result && result.Ok) {
        console.log("Note deleted successfully");
        // Since your backend reassigns IDs after deletion, we need to reload
        await loadNotes();
      } else if (result && result.Err) {
        throw new Error(result.Err);
      } else {
        throw new Error("Unexpected response format");
      }
      
    } catch (error) {
      console.error("Error deleting note:", error);
      alert(`Error deleting note: ${error.message}`);
      // Reload notes to restore state if delete failed
      await loadNotes();
    }
  };

  const startCreating = () => {
    setEditingNote(null);
    setFormData({ title: "", content: "" });
    setShowForm(true);
  };

  const startEditing = (note) => {
    setEditingNote(note);
    setFormData({ title: note.title, content: note.content });
    setShowForm(true);
  };

  const cancelForm = () => {
    setEditingNote(null);
    setFormData({ title: "", content: "" });
    setShowForm(false);
  };

  const toggleNoteExpansion = (noteId) => {
    setExpandedNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(noteId)) {
        newSet.delete(noteId);
      } else {
        newSet.add(noteId);
      }
      return newSet;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-pink-50 p-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="mb-4">
            <span className="text-6xl">📝</span>
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-3">
            Notes dApp
          </h1>
          <p className="text-gray-600 text-lg">Decentralized note-taking on the Internet Computer</p>
          <div className="mt-4 w-24 h-1 bg-gradient-to-r from-violet-500 to-pink-500 mx-auto rounded-full"></div>
        </div>

        <div className="mb-8 flex justify-center gap-4 flex-wrap">
          <button
            onClick={startCreating}
            disabled={isSubmitting}
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 text-white px-8 py-4 rounded-xl flex items-center gap-3 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
          >
            <Plus size={22} /> Create New Note
          </button>
          
          {notes.length > 0 && (
            <>
              <button
                onClick={() => setShowAllNotes(!showAllNotes)}
                className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-6 py-4 rounded-xl flex items-center gap-3 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
              >
                {showAllNotes ? "Show Last Note Only" : "Show All Notes"}
              </button>
              
              <button
                onClick={() => setShowNoteIds(!showNoteIds)}
                className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white px-6 py-4 rounded-xl flex items-center gap-3 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
              >
                {showNoteIds ? "Hide IDs" : "Show IDs"}
              </button>
              
              <button
                onClick={() => {
                  const displayedNotes = showAllNotes ? notes : notes.slice(-1);
                  const allExpanded = displayedNotes.every(note => expandedNotes.has(note.id));
                  if (allExpanded) {
                    setExpandedNotes(new Set());
                  } else {
                    setExpandedNotes(new Set(displayedNotes.map(note => note.id)));
                  }
                }}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-6 py-4 rounded-xl flex items-center gap-3 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
              >
                {(() => {
                  const displayedNotes = showAllNotes ? notes : notes.slice(-1);
                  const allExpanded = displayedNotes.every(note => expandedNotes.has(note.id));
                  return allExpanded ? "Collapse All" : "Expand All";
                })()}
              </button>
            </>
          )}
        </div>

        {showForm && (
          <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-2xl mb-8 border border-white/50">
            <h2 className="text-2xl font-semibold mb-6 bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
              {editingNote ? "✏️ Edit Note" : "✨ Create New Note"}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2 text-gray-700">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border-2 border-gray-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-200"
                  placeholder="Enter note title..."
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2 text-gray-700">Content</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full border-2 border-gray-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-200 resize-none"
                  rows="5"
                  placeholder="Write your note content here..."
                  disabled={isSubmitting}
                  required
                ></textarea>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:from-gray-400 disabled:to-gray-500 text-white px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                >
                  <Save size={18} /> 
                  {isSubmitting ? "Saving..." : (editingNote ? "Update Note" : "Create Note")}
                </button>
                <button
                  type="button"
                  onClick={cancelForm}
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                >
                  <X size={18} /> Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-16">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-violet-200 border-t-violet-600 mx-auto"></div>
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-400 to-purple-400 opacity-20 animate-pulse"></div>
            </div>
            <p className="mt-6 text-gray-600 text-lg">Loading your notes...</p>
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-20 bg-white/50 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-2xl font-semibold text-gray-700 mb-2">No notes yet!</h3>
            <p className="text-gray-500 text-lg">Create your first note to get started</p>
          </div>
        ) : (
          <>
            {!showAllNotes && notes.length > 1 && (
              <div className="text-center mb-6">
                <div className="inline-block bg-gradient-to-r from-violet-100 to-purple-100 border border-violet-200 p-4 rounded-xl">
                  <p className="text-violet-700 font-medium">
                    📌 Showing latest note ({notes.length} total notes available)
                  </p>
                </div>
              </div>
            )}
            <div className="space-y-6">
              {/* Display logic: show all notes or just the last one */}
              {(showAllNotes ? notes : notes.slice(-1)).map((note) => (
              <div 
                key={note.id} 
                ref={el => noteRefs.current[note.id] = el}
                className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-white/50 transition-all duration-300 hover:shadow-2xl hover:bg-white/70 transform hover:-translate-y-1"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3 flex-1">
                    <button
                      onClick={() => toggleNoteExpansion(note.id)}
                      className="text-violet-600 hover:text-violet-800 p-2 rounded-full hover:bg-violet-100 transition-all duration-200"
                      title={expandedNotes.has(note.id) ? "Collapse content" : "Expand content"}
                    >
                      {expandedNotes.has(note.id) ? 
                        <ChevronDown size={22} /> : 
                        <ChevronRight size={22} />
                      }
                    </button>
                    <h3 
                      className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent cursor-pointer hover:from-violet-700 hover:to-purple-700 transition-all duration-200"
                      onClick={() => toggleNoteExpansion(note.id)}
                    >
                      {note.title}
                    </h3>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEditing(note)}
                      className="text-emerald-600 hover:text-emerald-800 p-2 rounded-full hover:bg-emerald-100 transition-all duration-200"
                      title="Edit note"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="text-rose-600 hover:text-rose-800 p-2 rounded-full hover:bg-rose-100 transition-all duration-200"
                      title="Delete note"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                {expandedNotes.has(note.id) && (
                  <div className="mt-6 pl-8">
                    <div className="bg-gradient-to-r from-violet-50 to-purple-50 border-l-4 border-violet-300 p-4 rounded-r-xl">
                      <p className="text-gray-700 whitespace-pre-wrap leading-relaxed text-lg">
                        {note.content}
                      </p>
                    </div>
                  </div>
                )}
                
                {showNoteIds && (
                  <div className="mt-4 pl-8">
                    <span className="inline-block bg-gradient-to-r from-violet-100 to-purple-100 text-violet-700 px-3 py-1 rounded-full text-sm font-medium">
                      ID: {note.id}
                    </span>
                  </div>
                )}
              </div>
            ))}
            </div>
          </>
        )}

        <div className="text-center mt-16">
          <div className="inline-block bg-white/30 backdrop-blur-sm rounded-full px-6 py-3 border border-white/50">
            <p className="text-gray-600 font-medium">Built on the Internet Computer Protocol 🚀</p>
          </div>
        </div>
      </div>
    </div>
  );
}
