import React, { useState, useEffect, useRef } from "react";
import { Plus, Edit, Trash2, Save, X } from "lucide-react";
import { note_taking_backend } from "../../../declarations/note_taking_backend";

export default function NotesApp() {
  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [formData, setFormData] = useState({ title: "", content: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">📝 Notes dApp</h1>
          <p className="text-gray-600">Decentralized note-taking on the Internet Computer</p>
        </div>

        <div className="mb-6 flex justify-center">
          <button
            onClick={startCreating}
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-3 rounded-lg flex items-center gap-2 shadow-lg"
          >
            <Plus size={20} /> Create New Note
          </button>
        </div>

        {showForm && (
          <div className="bg-white p-6 rounded-xl shadow-lg mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">
              {editingNote ? "Edit Note" : "Create New Note"}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter note title..."
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Content</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="4"
                  placeholder="Write your note content here..."
                  disabled={isSubmitting}
                  required
                ></textarea>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <Save size={16} /> 
                  {isSubmitting ? "Saving..." : (editingNote ? "Update" : "Create")}
                </button>
                <button
                  type="button"
                  onClick={cancelForm}
                  disabled={isSubmitting}
                  className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <X size={16} /> Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading notes...</p>
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-lg">
            <p className="text-gray-500 text-lg">No notes yet. Create your first note!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notes.map((note) => (
              <div 
                key={note.id} 
                ref={el => noteRefs.current[note.id] = el}
                className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 transition-colors duration-300"
              >
                <div className="flex justify-between items-start">
                  <h3 className="text-xl font-semibold text-gray-800">{note.title}</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEditing(note)}
                      className="text-blue-600 hover:text-blue-800 p-1 rounded"
                      title="Edit note"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="text-red-600 hover:text-red-800 p-1 rounded"
                      title="Delete note"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <p className="text-gray-600 mt-2 whitespace-pre-wrap">{note.content}</p>
                <div className="text-sm text-gray-400 mt-4">Note ID: {note.id}</div>
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-12 text-gray-500">
          <p>Built on the Internet Computer Protocol 🚀</p>
        </div>
      </div>
    </div>
  );
}